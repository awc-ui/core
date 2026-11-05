import { newSpecPage } from '@stencil/core/testing';
import { MdTooltip } from './md-tooltip';

describe('md-tooltip public focus and binding lifecycle', () => {
  it('normalizes an authored open update while disabled and stays closed on re-enable', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip disabled text="Help"><button>Anchor</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement, opened = jest.fn(), closed = jest.fn();
    root.addEventListener('mdOpen', opened); root.addEventListener('mdClose', closed);
    root.open = true; await page.waitForChanges();
    expect(root.open).toBe(false); expect(opened).not.toHaveBeenCalled(); expect(closed).not.toHaveBeenCalled();
    root.disabled = false; await page.waitForChanges();
    expect(root.open).toBe(false); expect(opened).not.toHaveBeenCalled();
    await root.show(); await page.waitForChanges(); expect(root.open).toBe(true); expect(opened).toHaveBeenCalledTimes(1);
    root.remove();
  });
  it('cancels a delayed pointer opening when hide is called while still closed', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip text="Help" show-delay="20"><button>Anchor</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement, opened = jest.fn();
    root.addEventListener('mdOpen', opened);
    root.querySelector('button')!.dispatchEvent(new MouseEvent('mouseenter'));
    await root.hide();
    await new Promise(resolve => setTimeout(resolve, 40));
    await page.waitForChanges();
    expect(root.open).toBe(false);
    expect(opened).not.toHaveBeenCalled();
    root.remove();
  });

  it('cancels a delayed pointer dismissal when show is called while already open', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip open text="Help" hide-delay="20"><button>Anchor</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement, closed = jest.fn();
    root.addEventListener('mdClose', closed);
    root.querySelector('button')!.dispatchEvent(new MouseEvent('mouseleave'));
    await root.show();
    await new Promise(resolve => setTimeout(resolve, 40));
    await page.waitForChanges();
    expect(root.open).toBe(true);
    expect(closed).not.toHaveBeenCalled();
    root.remove();
  });

  it('dismisses and releases the old trigger when its slot becomes empty', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip open text="Help"><button>Anchor</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement, old = root.querySelector('button')!, closed = jest.fn();
    root.addEventListener('mdClose', closed);
    old.remove();
    root.shadowRoot!.querySelector('slot:not([name])')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect(root.open).toBe(false);
    expect(old.hasAttribute('aria-description')).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);
    root.remove();
  });

  it('normalizes an initially disabled open tooltip without emitting a close', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip open disabled text="Help"><button>Anchor</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement;
    expect(root.open).toBe(false);
    root.disabled = false;
    await page.waitForChanges();
    expect(root.open).toBe(false);
    await root.show();
    await page.waitForChanges();
    expect(root.open).toBe(true);
    root.remove();
  });

  it('describes authored rich slots instead of their hidden fallback properties', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip variant="rich" text="Fallback text" subhead="Fallback heading"><button>Anchor</button><span slot="subhead">Authored heading</span><span slot="content">Authored content</span><button slot="actions">Action</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement, trigger = root.querySelector('button')!;
    expect(trigger.getAttribute('aria-description')).toBe('Authored heading. Authored content');
    root.variant = 'plain';
    await page.waitForChanges();
    expect(trigger.getAttribute('aria-description')).toBe('Fallback text');
    root.remove();
  });

  it('rebinds a replacement trigger and removes descriptions while disabled', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip text="Help"><button>Original</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement;
    const old = root.querySelector('button')!;
    const replacement = page.doc.createElement('button'); replacement.textContent = 'New'; root.replaceChild(replacement, old);
    root.shadowRoot!.querySelector('slot:not([name])')!.dispatchEvent(new Event('slotchange'));
    expect(old.hasAttribute('aria-description')).toBe(false);
    expect(replacement.getAttribute('aria-description')).toBe('Help');
    root.open = true; await page.waitForChanges();
    root.disabled = true; await page.waitForChanges();
    expect(root.open).toBe(false); expect(replacement.hasAttribute('aria-description')).toBe(false);
    root.disabled = false; await page.waitForChanges();
    expect(replacement.getAttribute('aria-description')).toBe('Help');
  });

  it('retains a rich tooltip when focus enters its action, then dismisses after focus exits', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip variant="rich" text="Help" open hide-delay="0"><button id="trigger">Help</button><button slot="actions" id="action">Read more</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement;
    const trigger = root.querySelector('#trigger')!; const action = root.querySelector('#action')!;
    trigger.dispatchEvent(new FocusEvent('blur', { relatedTarget: action }));
    root.dispatchEvent(new FocusEvent('focusout', { relatedTarget: action }));
    await new Promise(resolve => setTimeout(resolve, 5)); await page.waitForChanges(); expect(root.open).toBe(true);
    root.shadowRoot!.querySelector('.md-tooltip__popup')!.dispatchEvent(new MouseEvent('mouseenter'));
    root.shadowRoot!.querySelector('.md-tooltip__popup')!.dispatchEvent(new MouseEvent('mouseleave'));
    root.dispatchEvent(new FocusEvent('focusout', { relatedTarget: page.body }));
    await new Promise(resolve => setTimeout(resolve, 5)); await page.waitForChanges(); expect(root.open).toBe(false);
  });
});

describe('md-tooltip public geometry on document scrolling', () => {
  it('updates open placement options without requiring a scroll or a size change', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip text="Help" auto-position="false"><button>Help</button></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement, trigger = root.querySelector('button')!;
    const popup = root.shadowRoot!.querySelector('.md-tooltip__popup') as HTMLElement;
    jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({ top: 100, left: 200, right: 240, bottom: 130, width: 40, height: 30, x: 200, y: 100, toJSON() {} });
    Object.defineProperties(popup, { offsetWidth: { value: 80 }, offsetHeight: { value: 40 } });
    root.open = true;
    await page.waitForChanges();
    root.position = 'bottom'; root.offset = 20; root.crossOffset = 17;
    await page.waitForChanges();
    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(popup.style.top).toBe('150px');
    expect(popup.style.left).toBe('197px');
    root.remove();
  });

  const placements = [
    ['top-start', 52, 200], ['top-end', 52, 160], ['bottom-start', 138, 200], ['bottom-end', 138, 160],
    ['left-start', 100, 112], ['left-end', 90, 112], ['right-start', 100, 248], ['right-end', 90, 248],
  ] as const;
  it.each(placements)('repositions %s against the visible trigger box', async (position, expectedTop, expectedLeft) => {
    const page = await newSpecPage({ components: [MdTooltip], html: `<md-tooltip text="Help" position="${position}" auto-position="false"><button>Help</button></md-tooltip>` });
    const root = page.root as HTMLMdTooltipElement; const trigger = root.querySelector('button')!;
    const popup = root.shadowRoot!.querySelector('.md-tooltip__popup') as HTMLElement;
    jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({ top: 100, left: 200, right: 240, bottom: 130, width: 40, height: 30, x: 200, y: 100, toJSON() {} });
    Object.defineProperties(popup, { offsetWidth: { value: 80 }, offsetHeight: { value: 40 } });
    root.open = true; await page.waitForChanges(); page.win.dispatchEvent(new Event('scroll'));
    // Top placements sit 40px tooltip + 8px gap above the trigger.
    expect(popup.style.top).toBe(`${expectedTop}px`);
    expect(popup.style.left).toBe(`${expectedLeft}px`);
    root.open = false; await page.waitForChanges(); root.remove();
  });

  it.each([
    ['left-start', 1, 1, 49, 8],
    ['right-end', 1000, 1, 912, 8],
    ['top-start', 1, 1, 8, 39],
  ] as const)('flips %s at the viewport edge and clamps the cross axis', async (position, left, top, expectedLeft, expectedTop) => {
    const page = await newSpecPage({ components: [MdTooltip], html: `<md-tooltip text="Help" position="${position}"><button>Help</button></md-tooltip>` });
    Object.defineProperties(page.win, { innerWidth: { value: 1024, configurable: true }, innerHeight: { value: 768, configurable: true } });
    const root = page.root as HTMLMdTooltipElement; const popup = root.shadowRoot!.querySelector('.md-tooltip__popup') as HTMLElement;
    jest.spyOn(root.querySelector('button')!, 'getBoundingClientRect').mockReturnValue({ top, left, right: left + 40, bottom: top + 30, width: 40, height: 30, x: left, y: top, toJSON() {} });
    Object.defineProperties(popup, { offsetWidth: { value: 80 }, offsetHeight: { value: 40 } });
    root.open = true; await page.waitForChanges(); page.win.dispatchEvent(new Event('scroll'));
    expect(popup.style.left).toBe(`${expectedLeft}px`); expect(popup.style.top).toBe(`${expectedTop}px`);
    root.open = false; await page.waitForChanges(); root.remove();
  });
});

describe('md-tooltip fixed containing blocks', () => {
  it.each(['translate', 'backdropFilter', 'contain', 'contentVisibility', 'containerType'])('converts viewport coordinates inside a %s containing block', async property => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<div id="block"><md-tooltip text="Tip" position="bottom" auto-position="false"><button>Trigger</button></md-tooltip></div>' });
    const root = page.body.querySelector('md-tooltip') as HTMLMdTooltipElement;
    const block = page.body.querySelector('#block') as HTMLElement; const popup = root.shadowRoot!.querySelector('.md-tooltip__popup') as HTMLElement;
    const values: Record<string, string> = { translate: '10px 20px', backdropFilter: 'blur(2px)', contain: 'paint', contentVisibility: 'auto', containerType: 'inline-size' };
    const original = globalThis.getComputedStyle;
    const style = jest.spyOn(globalThis, 'getComputedStyle').mockImplementation(el => {
      const result = original(el); if (el === block) Object.defineProperty(result, property, { configurable: true, value: values[property] }); return result;
    });
    try {
      jest.spyOn(block, 'getBoundingClientRect').mockReturnValue({ top: 20, left: 30, width: 300, height: 300, right: 330, bottom: 320, x: 30, y: 20, toJSON() {} });
      jest.spyOn(root.querySelector('button')!, 'getBoundingClientRect').mockReturnValue({ top: 100, left: 100, width: 40, height: 30, right: 140, bottom: 130, x: 100, y: 100, toJSON() {} });
      Object.defineProperties(popup, { offsetWidth: { value: 80 }, offsetHeight: { value: 40 } });
      root.open = true; await page.waitForChanges(); page.win.dispatchEvent(new Event('scroll'));
      expect(popup.style.left).toBe('50px'); expect(popup.style.top).toBe('118px');
      root.open = false; await page.waitForChanges(); root.remove();
    } finally { style.mockRestore(); }
  });
});

describe('md-tooltip pointer grace and Escape suppression', () => {
  it('tracks a presentational trigger on the host and cancels delayed hiding over the popup', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<md-tooltip text="Weekday" show-delay="0" hide-delay="15"><span>Monday</span></md-tooltip>' });
    const root = page.root as HTMLMdTooltipElement;
    root.dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise(resolve => setTimeout(resolve, 5)); await page.waitForChanges(); expect(root.open).toBe(true);
    root.dispatchEvent(new MouseEvent('mouseleave'));
    root.shadowRoot!.querySelector('.md-tooltip__popup')!.dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise(resolve => setTimeout(resolve, 20)); await page.waitForChanges(); expect(root.open).toBe(true);
    root.shadowRoot!.querySelector('.md-tooltip__popup')!.dispatchEvent(new MouseEvent('mouseleave'));
    await new Promise(resolve => setTimeout(resolve, 20)); await page.waitForChanges(); expect(root.open).toBe(false);
    root.remove();
  });

  it('dismisses on Escape without stealing outside focus and waits for pointer reentry', async () => {
    const page = await newSpecPage({ components: [MdTooltip], html: '<button id="outside">Other action</button><md-tooltip text="Help" show-delay="0" hide-delay="0"><span tabindex="0">Help</span></md-tooltip>' });
    const root = page.body.querySelector('md-tooltip') as HTMLMdTooltipElement;
    const trigger = root.querySelector('span')!;
    Object.defineProperty(page.doc, 'activeElement', { configurable: true, get: () => page.body.querySelector('#outside') });
    const focused = jest.spyOn(trigger, 'focus').mockImplementation(() => undefined);
    await root.show(); await page.waitForChanges();
    page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); await page.waitForChanges();
    expect(root.open).toBe(false); expect(focused).not.toHaveBeenCalled();
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise(resolve => setTimeout(resolve, 5)); await page.waitForChanges(); expect(root.open).toBe(false);
    trigger.dispatchEvent(new MouseEvent('mouseleave')); trigger.dispatchEvent(new MouseEvent('mouseenter'));
    await new Promise(resolve => setTimeout(resolve, 5)); await page.waitForChanges(); expect(root.open).toBe(true);
    await root.hide(); await page.waitForChanges(); root.remove();
  });
});
