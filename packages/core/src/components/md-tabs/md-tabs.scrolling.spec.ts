import { newSpecPage } from '@stencil/core/testing';
import { MdTabs } from './md-tabs';
import { MdTab } from '../md-tab/md-tab';

const rect = (left: number, width: number, top = 800) => ({ left, right: left + width, top, bottom: top + 48, width, height: 48, x: left, y: top, toJSON: () => ({}) } as DOMRect);

async function fixture({ direction = 'ltr', clientWidth = 300, scrollWidth = 900, offsetWidth = 300, clientLeft = 0, containerRect = rect(100, 300), targetRect = rect(390, 100) } = {}) {
  const page = await newSpecPage({ components: [MdTabs, MdTab], html: `<md-tabs dir="${direction}"><md-tab>A</md-tab><md-tab>B</md-tab><md-tab>C</md-tab></md-tabs>` });
  const root = page.root as HTMLMdTabsElement;
  const tabs = Array.from(root.children) as HTMLElement[];
  const container = root.shadowRoot!.querySelector('[part="container"]') as HTMLElement;
  Object.defineProperties(container, {
    clientWidth: { value: clientWidth, configurable: true }, scrollWidth: { value: scrollWidth, configurable: true },
    offsetWidth: { value: offsetWidth, configurable: true }, clientLeft: { value: clientLeft, configurable: true },
  });
  jest.spyOn(container, 'getBoundingClientRect').mockReturnValue(containerRect);
  const targetBox = jest.spyOn(tabs[1], 'getBoundingClientRect').mockReturnValue(targetRect);
  const scrollBy = jest.fn(); container.scrollBy = scrollBy;
  const ancestorScroll = jest.fn(); root.scrollIntoView = ancestorScroll; page.body.scrollIntoView = ancestorScroll;
  tabs.forEach(tab => tab.scrollIntoView = ancestorScroll);
  return { page, root, tabs, container, targetBox, scrollBy, ancestorScroll };
}

describe('md-tabs scroll containment', () => {
  afterEach(() => jest.restoreAllMocks());

  it('programmatic selection scrolls only its own strip horizontally, even far below the viewport', async () => {
    const { root, scrollBy, ancestorScroll } = await fixture();
    await root.selectTab(1);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ left: 90, behavior: 'smooth' });
    expect(ancestorScroll).not.toHaveBeenCalled();
  });

  it('click activation reveals the selected tab using only its own horizontal scrollport', async () => {
    const { page, root, tabs, scrollBy, ancestorScroll } = await fixture();
    const changed = jest.fn(); root.addEventListener('mdTabChange', changed);
    tabs[1].dispatchEvent(new CustomEvent('mdTabClick', { bubbles: true, composed: true }));
    await page.waitForChanges();
    expect(root.activeTabIndex).toBe(1);
    expect(changed.mock.calls[0][0].detail).toEqual({ index: 1, previousIndex: 0 });
    expect(scrollBy).toHaveBeenCalledWith({ left: 90, behavior: 'smooth' });
    expect(ancestorScroll).not.toHaveBeenCalled();
  });

  it('controlled activeTabIndex updates reveal a clipped tab without scrolling ancestors', async () => {
    const { page, root, scrollBy, ancestorScroll } = await fixture({ targetRect: rect(50, 100) });
    root.activeTabIndex = 1; await page.waitForChanges();
    expect(scrollBy).toHaveBeenCalledWith({ left: -50, behavior: 'smooth' });
    expect(root.children[1].hasAttribute('active')).toBe(true);
    expect(ancestorScroll).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'fully visible', targetRect: rect(180, 100) },
    { name: 'exactly aligned', targetRect: rect(100, 300) },
    { name: 'no horizontal overflow', targetRect: rect(390, 100), scrollWidth: 300 },
    { name: 'hidden container', targetRect: rect(390, 100), containerRect: rect(100, 0) },
    { name: 'hidden tab', targetRect: rect(390, 0) },
    { name: 'zero-size viewport', targetRect: rect(390, 100), clientWidth: 0 },
  ])('does not scroll a $name tab strip', async options => {
    const { root, scrollBy, ancestorScroll } = await fixture(options);
    await root.selectTab(1);
    expect(scrollBy).not.toHaveBeenCalled();
    expect(ancestorScroll).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'left', targetRect: rect(-30, 100), expected: -130 },
    { name: 'right', targetRect: rect(450, 100), expected: 150 },
  ])('uses physical $name deltas in RTL instead of depending on scrollLeft sign conventions', async ({ targetRect, expected }) => {
    const { root, container, scrollBy, ancestorScroll } = await fixture({ direction: 'rtl', targetRect });
    container.scrollLeft = -200;
    await root.selectTab(1);
    expect(scrollBy).toHaveBeenCalledWith({ left: expected, behavior: 'smooth' });
    expect(ancestorScroll).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'spanning both edges', targetRect: rect(50, 400), expected: null },
    { name: 'entirely right', targetRect: rect(450, 500), expected: 350 },
    { name: 'entirely left', targetRect: rect(-500, 500), expected: -400 },
    { name: 'partly right', targetRect: rect(150, 500), expected: 50 },
    { name: 'partly left', targetRect: rect(-150, 500), expected: -50 },
  ])('reveals oversized tabs $name with nearest-edge movement', async ({ targetRect, expected }) => {
    const { root, scrollBy, ancestorScroll } = await fixture({ targetRect });
    await root.selectTab(1);
    if (expected === null) expect(scrollBy).not.toHaveBeenCalled();
    else expect(scrollBy).toHaveBeenCalledWith({ left: expected, behavior: 'smooth' });
    expect(ancestorScroll).not.toHaveBeenCalled();
  });

  it('converts scaled and bordered physical geometry back to CSS scroll distance', async () => {
    // A 304px border box scaled to 152px: inner viewport is x=101..251.
    const { root, scrollBy, ancestorScroll } = await fixture({ clientWidth: 300, offsetWidth: 304, clientLeft: 2,
      containerRect: rect(100, 152), targetRect: rect(240, 50) });
    await root.selectTab(1);
    expect(scrollBy).toHaveBeenCalledWith({ left: 78, behavior: 'smooth' });
    expect(ancestorScroll).not.toHaveBeenCalled();
  });

  it('uses immediate own-strip scrolling for reduced-motion users', async () => {
    const original = globalThis.matchMedia;
    globalThis.matchMedia = jest.fn().mockReturnValue({ matches: true });
    try {
      const { root, scrollBy } = await fixture();
      await root.selectTab(1);
      expect(scrollBy).toHaveBeenCalledWith({ left: 90, behavior: 'auto' });
    } finally { globalThis.matchMedia = original; }
  });

  it.each(['ltr', 'rtl'])('keyboard focus in %s prevents ancestor scrolling while revealing the selected tab', async direction => {
    const { page, root, tabs, scrollBy, ancestorScroll } = await fixture({ direction });
    const originalStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = jest.fn().mockReturnValue({ direction });
    const focus = jest.fn(); tabs[1].focus = focus;
    try {
      const event = new KeyboardEvent('keydown', { key: direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight', bubbles: true, cancelable: true });
      event.composedPath = () => [tabs[0], root]; root.dispatchEvent(event); await page.waitForChanges();
      expect(event.defaultPrevented).toBe(true);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(root.activeTabIndex).toBe(1);
      expect(scrollBy).toHaveBeenCalledWith({ left: 90, behavior: 'smooth' });
      expect(ancestorScroll).not.toHaveBeenCalled();
    } finally { globalThis.getComputedStyle = originalStyle; }
  });
});
