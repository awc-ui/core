import { newSpecPage } from '@stencil/core/testing';
import { MdNavigationRailTab } from './md-navigation-rail-tab';

async function create(html: string) {
  return newSpecPage({
    components: [MdNavigationRailTab],
    html,
  });
}

describe('md-navigation-rail-tab', () => {
  // ----------------------------------------------------------------
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" icon="home"></md-navigation-rail-tab>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-navigation-rail-tab');
    });

    it('renders icon from the icon prop', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      const icon = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toContain('home');
    });

    it('renders label when label prop is set', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      const label = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__label');
      expect(label?.textContent).toBe('Home');
    });

    it('omits the label element when no label is provided', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" aria-label="Home"></md-navigation-rail-tab>');
      const label = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__label');
      expect(label).toBeFalsy();
    });

    it('adds md-navigation-rail-tab--active class when active', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home" active></md-navigation-rail-tab>');
      expect(page.root).toHaveClass('md-navigation-rail-tab--active');
    });
  });

  // ----------------------------------------------------------------
  describe('accessibility', () => {
    it('uses role="tab" by default', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('role')).toBe('tab');
    });

    it('uses role="link" when href is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('role')).toBe('link');
    });

    it('sets aria-selected="false" by default', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBe('false');
    });

    it('sets aria-selected="true" when active', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" active></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBe('true');
    });

    it('sets aria-current="page" when active AND href is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home" active></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-current')).toBe('page');
    });

    it('does not set aria-selected when href is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home" active></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-selected')).toBeNull();
    });

    it('sets aria-disabled="true" when disabled', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('makes the destination non-focusable when disabled', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('makes active destination focusable (tabindex=0)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" active></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('makes inactive destination non-focusable by default (roving tabindex managed by parent)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ----------------------------------------------------------------
  describe('events', () => {
    it('emits mdTabClick on click', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('emits mdTabClick with value detail', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" value="home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ value: 'home' });
    });

    it('does NOT emit mdTabClick when disabled', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  describe('keyboard activation', () => {
    it('activates on Enter', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('activates on Space', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('does NOT activate on Enter when disabled', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('ignores other keys (e.g. ArrowDown propagates to parent rail)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      const spy = jest.fn();
      page.root?.addEventListener('mdTabClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  describe('badges', () => {
    it('renders a dot badge when `badge` is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Inbox" badge></md-navigation-rail-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__badge--dot');
      expect(badge).toBeTruthy();
    });

    it('renders a large badge when badge-value is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Inbox" badge-value="3"></md-navigation-rail-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__badge--large');
      expect(badge?.textContent).toBe('3');
    });

    it('clamps badge values above 999 to "999+"', async () => {
      const page = await create('<md-navigation-rail-tab label="Inbox" badge-value="1234"></md-navigation-rail-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__badge--large');
      expect(badge?.textContent).toBe('999+');
    });

    it('badge has accessible label', async () => {
      const page = await create('<md-navigation-rail-tab label="Inbox" badge></md-navigation-rail-tab>');
      const badge = page.root?.shadowRoot?.querySelector('.md-navigation-rail-tab__badge');
      expect(badge?.getAttribute('aria-label')).toBe('new notifications');
    });
  });

  // ----------------------------------------------------------------
  describe('CSS parts', () => {
    it('exposes state-layer part', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes indicator part', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="indicator"]')).toBeTruthy();
    });

    it('exposes icon-wrapper part', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon-wrapper"]')).toBeTruthy();
    });

    it('exposes icon part when icon prop is set', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
    });

    it('exposes label part when label is set', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeTruthy();
    });

    it('exposes anchor part in link mode', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home"></md-navigation-rail-tab>');
      expect(page.root?.shadowRoot?.querySelector('[part="anchor"]')).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  describe('slots', () => {
    it('renders the named icon slot', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"><svg slot="icon"></svg></md-navigation-rail-tab>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="icon"]');
      expect(slot).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  describe('link mode', () => {
    it('renders an internal anchor element when href is set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home"></md-navigation-rail-tab>');
      const anchor = page.root?.shadowRoot?.querySelector('a.md-navigation-rail-tab__anchor') as HTMLAnchorElement | null;
      expect(anchor).toBeTruthy();
      expect(anchor?.getAttribute('href')).toBe('/home');
    });

    it('adds rel="noopener noreferrer" for target=_blank', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home" target="_blank"></md-navigation-rail-tab>');
      const anchor = page.root?.shadowRoot?.querySelector('a.md-navigation-rail-tab__anchor');
      expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('does NOT render anchor when disabled (even with href)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home" disabled></md-navigation-rail-tab>');
      const anchor = page.root?.shadowRoot?.querySelector('a.md-navigation-rail-tab__anchor');
      expect(anchor).toBeFalsy();
    });

    it('names the role=link host via aria-label (its label content is in the aria-hidden anchor)', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" href="/home"></md-navigation-rail-tab>');
      // Without this, the link would be nameless (WCAG 2.4.4 / 4.1.2): the
      // visible label lives inside the aria-hidden anchor.
      expect(page.root?.getAttribute('aria-label')).toBe('Home');
    });

    it('falls back to an author aria-label in link mode when no label is set', async () => {
      const page = await create('<md-navigation-rail-tab icon="home" aria-label="Home" href="/home"></md-navigation-rail-tab>');
      expect(page.root?.getAttribute('aria-label')).toBe('Home');
    });

    it('does NOT add a redundant aria-label to a role=tab host that already has a visible label', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      // tab mode is named by its rendered label contents — no aria-label needed.
      expect(page.root?.hasAttribute('aria-label')).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  describe('label visibility', () => {
    it('applies labels-all class by default', async () => {
      const page = await create('<md-navigation-rail-tab label="Home"></md-navigation-rail-tab>');
      expect(page.root).toHaveClass('md-navigation-rail-tab--labels-all');
    });

    it('applies labels-selected class when set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" label-visibility="selected"></md-navigation-rail-tab>');
      expect(page.root).toHaveClass('md-navigation-rail-tab--labels-selected');
    });

    it('applies labels-none class when set', async () => {
      const page = await create('<md-navigation-rail-tab label="Home" label-visibility="none"></md-navigation-rail-tab>');
      expect(page.root).toHaveClass('md-navigation-rail-tab--labels-none');
    });
  });

  // ----------------------------------------------------------------
  describe('RTL', () => {
    it('renders inside dir="rtl" context', async () => {
      const page = await newSpecPage({
        components: [MdNavigationRailTab],
        html: `<div dir="rtl"><md-navigation-rail-tab icon="home" label="الرئيسية"></md-navigation-rail-tab></div>`,
      });
      const tab = page.body.querySelector('md-navigation-rail-tab');
      expect(tab).toBeTruthy();
    });
  });
});

describe('md-navigation-rail-tab layout motion', () => {
  type Box = { left: number; top: number; width: number; height: number };
  type RecordedAnimation = {
    frames: Keyframe[];
    options: KeyframeAnimationOptions;
    cancel: jest.Mock;
    playState: string;
    finished: Promise<unknown>;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
  };
  const rect = (box: Box): DOMRect => ({
    ...box, x: box.left, y: box.top,
    right: box.left + box.width, bottom: box.top + box.height,
    toJSON: () => box,
  } as DOMRect);
  const collapsed = {
    icon: { left: 120, top: 72, width: 56, height: 32 },
    indicator: { left: 120, top: 72, width: 56, height: 32 },
  };
  const expanded = {
    icon: { left: 108, top: 80, width: 24, height: 24 },
    indicator: { left: 96, top: 68, width: 248, height: 56 },
  };

  /** Read the visible bounds represented by a FLIP frame; assert geometry,
   * not a serialized animation snapshot or a specific number of frames. */
  function frameBox(target: Box, frame: Keyframe): Box {
    const transform = String(frame.transform || 'none');
    const translation = /translate\(\s*([-\d.e]+)(?:px)?\s*,\s*([-\d.e]+)(?:px)?\s*\)/i.exec(transform)
      || /translate\(\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*\)/i.exec(transform);
    const scale = /scale\(\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*\)/i.exec(transform);
    return {
      left: target.left + (translation ? Number(translation[1]) : 0),
      top: target.top + (translation ? Number(translation[2]) : 0),
      width: target.width * (scale ? Number(scale[1]) : 1),
      height: target.height * (scale ? Number(scale[2]) : 1),
    };
  }
  function expectBox(actual: Box, expected: Box) {
    for (const key of ['left', 'top', 'width', 'height'] as const)
      expect(actual[key]).toBeCloseTo(expected[key], 5);
  }
  function expectSameCenter(actual: Box, expected: Box) {
    expect(actual.left + actual.width / 2).toBeCloseTo(expected.left + expected.width / 2, 5);
    expect(actual.top + actual.height / 2).toBeCloseTo(expected.top + expected.height / 2, 5);
  }

  let restoreMedia: (() => void) | undefined;
  afterEach(() => {
    jest.restoreAllMocks();
    restoreMedia?.();
    restoreMedia = undefined;
  });

  async function fixture() {
    const page = await create('<md-navigation-rail-tab icon="home" label="Home" active></md-navigation-rail-tab>');
    const icon = page.root!.shadowRoot!.querySelector('[part="icon-wrapper"]') as HTMLElement;
    const indicator = page.root!.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
    const label = page.root!.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    let layout = collapsed;
    let visualIcon: Box | null = null;
    let visualIndicator: Box | null = null;
    let labelOpacity = '1';
    let reduced = false;
    const originalMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: jest.fn(() => ({
      matches: reduced, media: '(prefers-reduced-motion: reduce)',
      addEventListener: jest.fn(), removeEventListener: jest.fn(),
    })) });
    restoreMedia = () => {
      if (originalMedia) Object.defineProperty(window, 'matchMedia', originalMedia);
      else delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    };
    jest.spyOn(icon, 'getBoundingClientRect').mockImplementation(() => rect(visualIcon || layout.icon));
    jest.spyOn(indicator, 'getBoundingClientRect').mockImplementation(() => rect(visualIndicator || layout.indicator));
    const computed = globalThis.getComputedStyle;
    jest.spyOn(globalThis, 'getComputedStyle').mockImplementation((element: Element) => {
      if (element === label) return { opacity: labelOpacity, getPropertyValue: (name: string) => name === 'opacity' ? labelOpacity : '' } as CSSStyleDeclaration;
      return computed(element);
    });
    function recorder(element: HTMLElement, onCancel: () => void) {
      const animations: RecordedAnimation[] = [];
      Object.defineProperty(element, 'animate', { configurable: true, value: jest.fn((frames: Keyframe[], options: KeyframeAnimationOptions) => {
        const animation: RecordedAnimation = {
          frames, options, playState: 'running', finished: new Promise(() => undefined),
          cancel: jest.fn(() => { animation.playState = 'idle'; onCancel(); }),
          addEventListener: jest.fn(), removeEventListener: jest.fn(),
        };
        animations.push(animation);
        return animation;
      }) });
      return animations;
    }
    const iconAnimations = recorder(icon, () => { visualIcon = null; });
    const indicatorAnimations = recorder(indicator, () => { visualIndicator = null; });
    const labelAnimations = recorder(label, () => { labelOpacity = '1'; });
    return {
      page, icon, indicator, label,
      iconAnimations, indicatorAnimations, labelAnimations,
      setVisual(iconBox: Box, indicatorBox: Box, opacity: string) {
        visualIcon = iconBox; visualIndicator = indicatorBox; labelOpacity = opacity;
      },
      setReduced(value: boolean) { reduced = value; },
      async toggle(value: boolean) {
        // Stencil's watcher observes the currently painted layout, before the
        // following render changes the expanded class and measured target.
        page.rootInstance.expanded = value;
        layout = value ? expanded : collapsed;
        await page.waitForChanges();
      },
    };
  }

  it('expands the active indicator from its previous nonzero position and size', async () => {
    const f = await fixture();
    await f.toggle(true);
    expect(f.iconAnimations).toHaveLength(1);
    expect(f.indicatorAnimations).toHaveLength(1);
    const iconMotion = f.iconAnimations[0];
    const indicatorMotion = f.indicatorAnimations[0];
    expectSameCenter(frameBox(expanded.icon, iconMotion.frames[0]), collapsed.icon);
    expectSameCenter(frameBox(expanded.icon, iconMotion.frames[iconMotion.frames.length - 1]), expanded.icon);
    expectBox(frameBox(expanded.indicator, indicatorMotion.frames[0]), collapsed.indicator);
    expectBox(frameBox(expanded.indicator, indicatorMotion.frames[indicatorMotion.frames.length - 1]), expanded.indicator);
    const origin = String(indicatorMotion.frames[0].transformOrigin || f.indicator.style.transformOrigin).trim();
    expect(['top left', 'left top', '0 0', '0px 0px']).toContain(origin);
    expect(indicatorMotion.options.duration).toBeGreaterThan(0);
  });

  it('reverses from the visible in-flight geometry and opacity before cancelling old motion', async () => {
    const f = await fixture();
    await f.toggle(true);
    const previous = [f.iconAnimations[0], f.indicatorAnimations[0], f.labelAnimations[0]];
    const visibleIcon = { left: 116, top: 78, width: 24, height: 24 };
    const visibleIndicator = { left: 110, top: 70, width: 144, height: 44 };
    f.setVisual(visibleIcon, visibleIndicator, '0.42');
    await f.toggle(false);
    for (const animation of previous) expect(animation.cancel).toHaveBeenCalledTimes(1);
    expect(f.iconAnimations).toHaveLength(2);
    expect(f.indicatorAnimations).toHaveLength(2);
    expect(f.labelAnimations).toHaveLength(2);
    expectSameCenter(frameBox(collapsed.icon, f.iconAnimations[1].frames[0]), visibleIcon);
    expectBox(frameBox(collapsed.indicator, f.indicatorAnimations[1].frames[0]), visibleIndicator);
    expect(Number(f.labelAnimations[1].frames[0].opacity)).toBeCloseTo(0.42);
    expect(Number(f.labelAnimations[1].frames[f.labelAnimations[1].frames.length - 1].opacity)).toBe(1);
  });

  it('cancels all ongoing layout motion when toggled under reduced motion', async () => {
    const f = await fixture();
    await f.toggle(true);
    const previous = [f.iconAnimations[0], f.indicatorAnimations[0], f.labelAnimations[0]];
    f.setReduced(true);
    await f.toggle(false);
    for (const animation of previous) expect(animation.cancel).toHaveBeenCalledTimes(1);
    expect(f.iconAnimations).toHaveLength(1);
    expect(f.indicatorAnimations).toHaveLength(1);
    expect(f.labelAnimations).toHaveLength(1);
  });

  it('uses the final layout without starting animations when reduced motion is already enabled', async () => {
    const f = await fixture();
    f.setReduced(true);
    await f.toggle(true);
    expect(f.page.root).toHaveClass('md-navigation-rail-tab--expanded');
    expect(f.iconAnimations).toHaveLength(0);
    expect(f.indicatorAnimations).toHaveLength(0);
    expect(f.labelAnimations).toHaveLength(0);
  });

  it('cancels owned animations when the destination disconnects', async () => {
    const f = await fixture();
    await f.toggle(true);
    f.page.rootInstance.disconnectedCallback();
    for (const animation of [f.iconAnimations[0], f.indicatorAnimations[0], f.labelAnimations[0]])
      expect(animation.cancel).toHaveBeenCalledTimes(1);
  });
});
