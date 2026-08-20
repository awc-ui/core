import { newSpecPage } from '@stencil/core/testing';
import { MdSegmentedButton } from './md-segmented-button';

describe('md-segmented-button', () => {
  let warnSpy: jest.SpyInstance;
  beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  // ── Rendering ─────────────────────────────────────────────
  it('renders with default props', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-segmented-button')).toBe(true);
  });

  it('renders label text', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Week"></md-segmented-button>`,
    });
    const label = page.root?.shadowRoot?.querySelector('.md-segmented-button__label');
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe('Week');
  });

  it('renders icon in graphic element when icon prop is set', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button icon="star" label="Starred"></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic).toBeTruthy();
    expect(graphic?.textContent).toBe('star');
  });

  it('renders hidden graphic + trailing spacer on text-only unselected segment', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic).toBeTruthy();
    expect(graphic?.classList.contains('md-segmented-button__graphic--hidden')).toBe(true);
    const spacer = page.root?.shadowRoot?.querySelector('.md-segmented-button__spacer');
    expect(spacer).toBeTruthy();
  });

  it('does not render graphic or spacer on text-only segment with no-checkmark', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" no-checkmark></md-segmented-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic')).toBeNull();
    expect(page.root?.shadowRoot?.querySelector('.md-segmented-button__spacer')).toBeNull();
  });

  it('renders trailing spacer on text-only segment even when selected (stable width)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" selected></md-segmented-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('.md-segmented-button__spacer')).toBeTruthy();
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic?.classList.contains('md-segmented-button__graphic--hidden')).toBe(false);
    expect(graphic?.textContent).toBe('check');
  });

  // ── Selected ──────────────────────────────────────────────
  it('applies selected class when selected', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" selected></md-segmented-button>`,
    });
    expect(page.root?.classList.contains('md-segmented-button--selected')).toBe(true);
  });

  it('shows checkmark in graphic when selected', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" selected></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic).toBeTruthy();
    expect(graphic?.textContent).toBe('check');
    expect(graphic?.getAttribute('part')).toBe('checkmark');
  });

  it('swaps icon to checkmark in same element when selected', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button icon="star" label="Starred" selected></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic).toBeTruthy();
    expect(graphic?.textContent).toBe('check');
    expect(graphic?.getAttribute('part')).toBe('checkmark');
  });

  it('keeps icon when selected with no-checkmark', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button icon="star" label="Starred" selected no-checkmark></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic).toBeTruthy();
    expect(graphic?.textContent).toBe('star');
    expect(graphic?.getAttribute('part')).toBe('icon');
  });

  it('renders checkmark graphic on text-only segment when selected', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" selected></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic).toBeTruthy();
    expect(graphic?.textContent).toBe('check');
  });

  // ── Disabled ──────────────────────────────────────────────
  it('applies disabled class', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" disabled></md-segmented-button>`,
    });
    expect(page.root?.classList.contains('md-segmented-button--disabled')).toBe(true);
  });

  it('has tabindex -1 when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" disabled></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('does not emit mdSegmentClick when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" disabled></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not emit on Enter when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" disabled></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Soft-Disabled ────────────────────────────────────────
  it('applies disabled class when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" soft-disabled></md-segmented-button>`,
    });
    expect(page.root?.classList.contains('md-segmented-button--disabled')).toBe(true);
  });

  it('keeps tabindex="0" when soft-disabled (stays in tab order)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" soft-disabled></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('0');
  });

  it('has aria-disabled="true" when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" soft-disabled></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  it('does not emit mdSegmentClick when soft-disabled (click)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" soft-disabled></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not emit mdSegmentClick when soft-disabled (Enter)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" soft-disabled></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('disables md-ripple when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" soft-disabled></md-segmented-button>`,
    });
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple?.getAttribute('disabled')).not.toBeNull();
  });

  // ── Events ────────────────────────────────────────────────
  it('emits mdSegmentClick on click', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits selected=false on click in multiselect when already selected (toggle off)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day" selected segment-multiselect></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].detail).toEqual({ value: 'a', selected: false });
  });

  it('emits selected=false on Enter in multiselect when already selected (toggle off)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day" selected segment-multiselect></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].detail).toEqual({ value: 'a', selected: false });
  });

  it('emits mdSegmentClick on Enter key', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits mdSegmentClick on Space key', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('ignores non-Enter/Space keys', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Accessibility ─────────────────────────────────────────
  it('has role="radio" by default (single-select)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('role')).toBe('radio');
  });

  it('has role="checkbox" in multiselect mode', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day" segment-multiselect></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('role')).toBe('checkbox');
  });

  it('has aria-checked matching selected state', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day" selected></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('aria-checked')).toBe('true');
  });

  it('has aria-checked="false" when not selected', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('aria-checked')).toBe('false');
  });

  it('has aria-disabled when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" disabled></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  it('has tabindex="0" when enabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('0');
  });

  it('state-layer has aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    const sl = page.root?.shadowRoot?.querySelector('.md-segmented-button__state-layer');
    expect(sl?.getAttribute('aria-hidden')).toBe('true');
  });

  it('graphic has aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button icon="star" label="Starred"></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic?.getAttribute('aria-hidden')).toBe('true');
  });

  // ── WCAG 1.1.1 — Non-text Content ────────────────────────
  it('WCAG 1.1.1: warns when segment has no label or aria-label', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a"></md-segmented-button>`,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('WCAG 1.1.1'),
      expect.anything(),
    );
  });

  it('WCAG 1.1.1: no warning when label is present', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('WCAG 1.1.1: no warning when aria-label is present (no label prop)', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" icon="star" aria-label="Starred"></md-segmented-button>`,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ── WCAG 1.3.2 — Meaningful Sequence (decorative hiding) ─
  it('WCAG 1.3.2: outline element has aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    const outline = page.root?.shadowRoot?.querySelector('.md-segmented-button__outline');
    expect(outline?.getAttribute('aria-hidden')).toBe('true');
  });

  it('WCAG 1.3.2: spacer element has aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    const spacer = page.root?.shadowRoot?.querySelector('.md-segmented-button__spacer');
    expect(spacer?.getAttribute('aria-hidden')).toBe('true');
  });

  it('WCAG 1.3.2: hidden placeholder graphic has aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic--hidden');
    expect(graphic?.getAttribute('aria-hidden')).toBe('true');
  });

  // ── WCAG 1.4.1 — Use of Color ──────────────────────────
  it('WCAG 1.4.1: selected state uses checkmark as non-color indicator', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" selected></md-segmented-button>`,
    });
    const checkmark = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(checkmark).toBeTruthy();
    expect(checkmark?.textContent).toBe('check');
  });

  it('WCAG 1.4.1: icon segments swap to checkmark as non-color indicator', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button icon="star" label="Starred" selected></md-segmented-button>`,
    });
    const graphic = page.root?.shadowRoot?.querySelector('.md-segmented-button__graphic');
    expect(graphic?.textContent).toBe('check');
  });

  // ── WCAG 2.1.1 — Keyboard ──────────────────────────────
  it('WCAG 2.1.1: tabindex="-1" removes disabled segment from tab order', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" disabled></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('WCAG 2.1.1: tabindex="0" keeps enabled segment in tab order', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('0');
  });

  it('WCAG 2.1.1: Space key activates segment (keyboard operable)', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('WCAG 2.1.1: disabled segment blocks keyboard activation', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" disabled></md-segmented-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdSegmentClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── WCAG 4.1.2 — Name, Role, Value ─────────────────────
  it('WCAG 4.1.2: aria-disabled="false" when enabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('aria-disabled')).toBe('false');
  });

  it('WCAG 4.1.2: aria-checked updates dynamically', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('aria-checked')).toBe('false');

    (page.root as any).selected = true;
    await page.waitForChanges();
    expect(page.root?.getAttribute('aria-checked')).toBe('true');

    (page.root as any).selected = false;
    await page.waitForChanges();
    expect(page.root?.getAttribute('aria-checked')).toBe('false');
  });

  it('WCAG 4.1.2: role reflects multiselect mode dynamically', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button value="a" label="Day"></md-segmented-button>`,
    });
    expect(page.root?.getAttribute('role')).toBe('radio');

    (page.root as any).segmentMultiselect = true;
    await page.waitForChanges();
    expect(page.root?.getAttribute('role')).toBe('checkbox');
  });

  // ── CSS Parts ─────────────────────────────────────────────
  it('exposes state-layer part', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    const sl = page.root?.shadowRoot?.querySelector('[part="state-layer"]');
    expect(sl).toBeTruthy();
  });

  it('exposes label part', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    const label = page.root?.shadowRoot?.querySelector('[part="label"]');
    expect(label).toBeTruthy();
  });

  it('exposes icon part', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button icon="star" label="Starred"></md-segmented-button>`,
    });
    const icon = page.root?.shadowRoot?.querySelector('[part="icon"]');
    expect(icon).toBeTruthy();
  });

  it('exposes checkmark part when selected', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" selected></md-segmented-button>`,
    });
    const check = page.root?.shadowRoot?.querySelector('[part="checkmark"]');
    expect(check).toBeTruthy();
  });

  // ── Ripple ────────────────────────────────────────────────
  it('renders md-ripple by default', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day"></md-segmented-button>`,
    });
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple).toBeTruthy();
  });

  it('does not render md-ripple when ripple=false', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" ripple="false"></md-segmented-button>`,
    });
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple).toBeNull();
  });

  it('md-ripple is disabled when host is disabled', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="Day" disabled></md-segmented-button>`,
    });
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple?.getAttribute('disabled')).not.toBeNull();
  });

  // ── Position classes ──────────────────────────────────────
  it('applies first class when segmentIndex=0', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="A" segment-index="0" segment-total="3"></md-segmented-button>`,
    });
    expect(page.root?.classList.contains('md-segmented-button--first')).toBe(true);
    expect(page.root?.classList.contains('md-segmented-button--last')).toBe(false);
  });

  it('applies last class when segmentIndex equals total-1', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="C" segment-index="2" segment-total="3"></md-segmented-button>`,
    });
    expect(page.root?.classList.contains('md-segmented-button--last')).toBe(true);
    expect(page.root?.classList.contains('md-segmented-button--first')).toBe(false);
  });

  // ── Density ───────────────────────────────────────────────
  it('applies density class from prop', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<md-segmented-button label="A" segment-density="-2"></md-segmented-button>`,
    });
    expect(page.root?.classList.contains('md-segmented-button--density-2')).toBe(true);
  });

  // ── RTL — corner radius rules use logical properties ─────
  // We can't compute the resolved style in the mock DOM, but we can
  // assert the CSS source uses `border-start-start-radius` /
  // `border-end-start-radius` (which auto-flip in RTL) instead of the
  // physical 4-value `border-radius` shorthand that would glue the
  // rounded corners to the visual left edge in every direction.
  it('uses logical border-radius corners (so first/last segments flip in RTL)', async () => {
    const fs = require('fs');
    const path = require('path');
    const cssPath = path.join(__dirname, 'md-segmented-button.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // First segment: rounded on the inline-start (visual left in LTR / right in RTL)
    expect(css).toMatch(/\.md-segmented-button--first[\s\S]*?border-start-start-radius:/);
    expect(css).toMatch(/\.md-segmented-button--first[\s\S]*?border-end-start-radius:/);

    // Last segment: rounded on the inline-end (visual right in LTR / left in RTL)
    expect(css).toMatch(/\.md-segmented-button--last[\s\S]*?border-start-end-radius:/);
    expect(css).toMatch(/\.md-segmented-button--last[\s\S]*?border-end-end-radius:/);

    // Regression guard: the original physical 4-corner shorthand was
    //   border-radius: var(--_container-shape) 0 0 var(--_container-shape);
    //   border-radius: 0 var(--_container-shape) var(--_container-shape) 0;
    // Either of those patterns coming back means the RTL fix was reverted.
    expect(css).not.toMatch(
      /border-radius:\s*var\(--_container-shape\)\s+0\s+0\s+var\(--_container-shape\)/,
    );
    expect(css).not.toMatch(
      /border-radius:\s*0\s+var\(--_container-shape\)\s+var\(--_container-shape\)\s+0/,
    );
  });

  // ── Arrow key navigation ──────────────────────────────────
  // Arrow key handler calls this.el.closest('md-segmented-button-set'), so
  // these tests must render the button inside a set with both components
  // registered so the DOM parent chain is intact.
  describe('arrow key navigation', () => {
    async function createSet(html: string) {
      const { MdSegmentedButtonSet } = await import('../md-segmented-button-set/md-segmented-button-set');
      return newSpecPage({
        components: [MdSegmentedButton, MdSegmentedButtonSet],
        html,
      });
    }

    it('ArrowRight moves focus to the next segment', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
          <md-segmented-button value="c" label="C"></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, segB] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const focusSpy = jest.spyOn(segB as HTMLElement, 'focus');
      segA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('ArrowLeft moves focus to the previous segment', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
          <md-segmented-button value="b" label="B" selected></md-segmented-button>
          <md-segmented-button value="c" label="C"></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, segB] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const focusSpy = jest.spyOn(segA as HTMLElement, 'focus');
      segB.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('ArrowDown moves focus to the next segment', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, segB] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const focusSpy = jest.spyOn(segB as HTMLElement, 'focus');
      segA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('ArrowUp moves focus to the previous segment', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
          <md-segmented-button value="b" label="B" selected></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, segB] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const focusSpy = jest.spyOn(segA as HTMLElement, 'focus');
      segB.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('ArrowRight wraps from last to first', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A"></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
          <md-segmented-button value="c" label="C" selected></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, , segC] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const focusSpy = jest.spyOn(segA as HTMLElement, 'focus');
      segC.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('ArrowLeft wraps from first to last', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
          <md-segmented-button value="c" label="C"></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, , segC] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const focusSpy = jest.spyOn(segC as HTMLElement, 'focus');
      segA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('skips disabled segments when navigating', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B" disabled></md-segmented-button>
          <md-segmented-button value="c" label="C"></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, , segC] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const focusSpy = jest.spyOn(segC as HTMLElement, 'focus');
      segA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('single-select: ArrowRight also clicks the next segment to select it', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, segB] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const clickSpy = jest.spyOn(segB as HTMLElement, 'click');
      segA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('multi-select: ArrowRight moves focus only — does not click', async () => {
      const page = await createSet(`
        <md-segmented-button-set multiselect>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, segB] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const clickSpy = jest.spyOn(segB as HTMLElement, 'click');
      const focusSpy = jest.spyOn(segB as HTMLElement, 'focus');
      segA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('arrow keys do nothing when segment has no parent set', async () => {
      const page = await newSpecPage({
        components: [MdSegmentedButton],
        html: `<md-segmented-button value="a" label="A"></md-segmented-button>`,
      });
      // Should not throw
      expect(() => {
        page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      }).not.toThrow();
    });

    it('non-arrow keys are ignored by the navigation handler', async () => {
      const page = await createSet(`
        <md-segmented-button-set>
          <md-segmented-button value="a" label="A" selected></md-segmented-button>
          <md-segmented-button value="b" label="B"></md-segmented-button>
        </md-segmented-button-set>
      `);
      const [segA, segB] = Array.from(page.root!.querySelectorAll('md-segmented-button'));
      const focusSpy = jest.spyOn(segB as HTMLElement, 'focus');
      segA.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      await page.waitForChanges();
      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  it('renders inside a dir="rtl" ancestor without errors', async () => {
    const page = await newSpecPage({
      components: [MdSegmentedButton],
      html: `<div dir="rtl"><md-segmented-button label="اليوم" segment-index="0" segment-total="3"></md-segmented-button></div>`,
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-segmented-button--first')).toBe(true);
  });
});
