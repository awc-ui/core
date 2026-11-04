import { newSpecPage } from '@stencil/core/testing';
import { MdTabs } from './md-tabs';
import { MdTab } from '../md-tab/md-tab';

describe('md-tabs public runtime updates', () => {
  it('normalizes the width policy and preserves the selected element after insertion', async () => {
    const page = await newSpecPage({ components: [MdTabs, MdTab], html: '<md-tabs active-tab-index="1"><md-tab label="A"></md-tab><md-tab label="B"></md-tab></md-tabs>' });
    const root = page.root as HTMLMdTabsElement;
    root.tabWidth = 'auto'; await page.waitForChanges();
    expect(root).toHaveClass('md-tabs--tw-auto');
    const selected = root.children[1];
    const extra = page.doc.createElement('md-tab'); extra.label = 'New';
    root.insertBefore(extra, root.firstChild);
    root.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect(root.activeTabIndex).toBe(2);
    expect(selected.hasAttribute('active')).toBe(true);
    selected.remove();
    root.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect(selected.hasAttribute('active')).toBe(false);
    expect(root.activeTabIndex).toBeLessThan(root.children.length);
  });

  it('removes the Tab stop when all tabs become disabled and restores one when reenabled', async () => {
    const page = await newSpecPage({ components: [MdTabs, MdTab], html: '<md-tabs><md-tab label="A"></md-tab><md-tab label="B"></md-tab></md-tabs>' });
    const root = page.root as HTMLMdTabsElement;
    const tabs = Array.from(root.children) as HTMLMdTabElement[];
    tabs.forEach(tab => tab.disabled = true); await page.waitForChanges();
    expect(tabs.map(tab => tab.getAttribute('tabindex'))).toEqual(['-1', '-1']);
    tabs[1].disabled = false; await page.waitForChanges();
    expect(tabs[1].getAttribute('tabindex')).toBe('0');
  });

  it.each([0, 1, 2])('translates a vertical wheel in deltaMode=%s while leaving horizontal gestures alone', async mode => {
    const page = await newSpecPage({ components: [MdTabs, MdTab], html: '<md-tabs><md-tab>A</md-tab><md-tab>B</md-tab></md-tabs>' });
    const container = page.root!.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
    Object.defineProperties(container, { scrollWidth: { value: 500 }, clientWidth: { value: 100 } });
    const scrollBy = jest.fn(); container.scrollBy = scrollBy;
    const wheel = (x: number, y: number) => {
      const event = new Event('wheel', { cancelable: true });
      Object.assign(event, { deltaX: x, deltaY: y, deltaMode: mode });
      container.dispatchEvent(event); return event;
    };
    expect(wheel(20, 2).defaultPrevented).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(wheel(0, 2).defaultPrevented).toBe(true);
    expect(scrollBy).toHaveBeenCalledWith({ left: 2 * [1, 16, 100][mode], behavior: 'instant' });
  });
});

describe('md-tabs deferred controlled selection', () => {
  it('honors a requested index when delayed children arrive and normalizes invalid writes', async () => {
    const page = await newSpecPage({ components: [MdTabs, MdTab], html: '<md-tabs aria-label="Views" active-tab-index="2" tab-width="160px" width="480px"></md-tabs>' });
    const root = page.root as HTMLMdTabsElement;
    expect(root).toHaveClass('md-tabs--tw-fixed'); expect(root.style.getPropertyValue('--_tab-width')).toBe('160px');
    root.innerHTML = '<md-tab label="A"></md-tab><md-tab label="B" disabled></md-tab><md-tab label="C"></md-tab>';
    root.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange')); await page.waitForChanges();
    expect(root.activeTabIndex).toBe(2); expect(root.children[2].hasAttribute('active')).toBe(true);
    root.activeTabIndex = Number.NaN; await page.waitForChanges(); expect(root.activeTabIndex).toBe(0);
    root.remove(); page.body.append(root); await page.waitForChanges(); await Promise.resolve();
    expect(root.activeTabIndex).toBe(0); expect(root.children[0].hasAttribute('active')).toBe(true);
  });

  it('clears selection when all children are removed and safely accepts an empty selection request', async () => {
    const page = await newSpecPage({ components: [MdTabs, MdTab], html: '<md-tabs aria-label="Views"><md-tab label="A"></md-tab></md-tabs>' });
    const root = page.root as HTMLMdTabsElement;
    root.innerHTML = ''; root.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange')); await page.waitForChanges();
    expect(root.querySelector('[active]')).toBeNull();
    await root.selectTab(0); await page.waitForChanges(); expect(root.children.length).toBe(0);
  });
});

describe('md-tabs selection indicator motion', () => {
  it('starts from the outgoing indicator geometry and settles on the selected tab', async () => {
    const page = await newSpecPage({ components: [MdTabs, MdTab], html: '<md-tabs><md-tab>A</md-tab><md-tab>B</md-tab><md-tab>C</md-tab></md-tabs>' });
    const root = page.root as HTMLMdTabsElement;
    const tabs = Array.from(root.children) as HTMLElement[];
    tabs.forEach((tab, index) => {
      const indicator = tab.shadowRoot!.querySelector('.md-tab__indicator')!;
      jest.spyOn(indicator, 'getBoundingClientRect').mockReturnValue({ left: index * 120, width: 80 + index * 20 } as DOMRect);
    });
    const frames: FrameRequestCallback[] = [];
    const frame = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
    try {
      await root.selectTab(1); await page.waitForChanges();
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-x')).toBe('-130px');
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-scale')).toBe('0.8');
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-duration')).toBe('0s');
      while (frames.length) frames.shift()!(0);
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-x')).toBe('0px');
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-scale')).toBe('1');
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-duration')).toBe('');
      await new Promise(resolve => setTimeout(resolve, 510));
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-x')).toBe('');
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-scale')).toBe('');
      expect(root.activeTabIndex).toBe(1);
    } finally { frame.mockRestore(); }
  });

  it('keeps a rapid second selection from being overwritten by the earlier animation', async () => {
    const page = await newSpecPage({ components: [MdTabs, MdTab], html: '<md-tabs><md-tab>A</md-tab><md-tab>B</md-tab><md-tab>C</md-tab></md-tabs>' });
    const root = page.root as HTMLMdTabsElement;
    const tabs = Array.from(root.children) as HTMLElement[];
    tabs.forEach((tab, index) => jest.spyOn(tab.shadowRoot!.querySelector('.md-tab__indicator')!, 'getBoundingClientRect').mockReturnValue({ left: index * 100, width: 80 } as DOMRect));
    const frames: FrameRequestCallback[] = [];
    const frame = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
    try {
      await root.selectTab(1); await page.waitForChanges();
      await root.selectTab(2); await page.waitForChanges();
      while (frames.length) frames.shift()!(0);
      expect(tabs[1].style.getPropertyValue('--md-tab-glide-x')).toBe('');
      expect(tabs[2].style.getPropertyValue('--md-tab-glide-x')).toBe('0px');
      expect(root.activeTabIndex).toBe(2);
      expect(tabs.map(tab => tab.hasAttribute('active'))).toEqual([false, false, true]);
      await new Promise(resolve => setTimeout(resolve, 510));
      expect(tabs[2].style.getPropertyValue('--md-tab-glide-x')).toBe('');
    } finally { frame.mockRestore(); }
  });
});
