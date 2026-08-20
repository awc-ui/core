import { newSpecPage } from '@stencil/core/testing';
import { MdSplitButton } from './md-split-button';

describe('md-split-button', () => {
  let warnSpy: jest.SpyInstance;
  beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  // ── Rendering ─────────────────────────────────────────────
  it('renders with default props', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-split-button')).toBe(true);
  });

  it('renders leading button with label', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const label = page.root?.shadowRoot?.querySelector('.md-split-button__label');
    expect(label?.textContent).toBe('Save');
  });

  it('renders leading button with icon', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button icon="save" label="Save"></md-split-button>`,
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-split-button__icon');
    expect(icon).toBeTruthy();
    expect(icon?.textContent).toBe('save');
  });

  it('does not render icon element when icon prop is empty', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-split-button__icon');
    expect(icon).toBeNull();
  });

  it('renders trailing button with default keyboard_arrow_down icon', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const trailingIcon = page.root?.shadowRoot?.querySelector('.md-split-button__trailing-icon');
    expect(trailingIcon?.textContent).toBe('keyboard_arrow_down');
  });

  it('renders trailing button with custom icon', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" trailing-icon="more_vert"></md-split-button>`,
    });
    const trailingIcon = page.root?.shadowRoot?.querySelector('.md-split-button__trailing-icon');
    expect(trailingIcon?.textContent).toBe('more_vert');
  });

  it('renders two button elements', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.length).toBe(2);
  });

  // ── Variants ──────────────────────────────────────────────
  it('applies filled variant by default', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--filled')).toBe(true);
  });

  it('applies elevated variant', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" variant="elevated"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--elevated')).toBe(true);
  });

  it('applies tonal variant', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" variant="tonal"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--tonal')).toBe(true);
  });

  it('applies outlined variant', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" variant="outlined"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--outlined')).toBe(true);
  });

  // ── Sizes ─────────────────────────────────────────────────
  it('applies sm size by default', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--sm')).toBe(true);
  });

  it('applies xs size', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" size="xs"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--xs')).toBe(true);
  });

  it('applies md size', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" size="md"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--md')).toBe(true);
  });

  it('applies lg size', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" size="lg"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--lg')).toBe(true);
  });

  it('applies xl size', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" size="xl"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--xl')).toBe(true);
  });

  // ── Events ────────────────────────────────────────────────
  it('emits mdLeadingClick on leading button click', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdLeadingClick', spy);
    const leading = page.root?.shadowRoot?.querySelector('.md-split-button__leading') as HTMLElement;
    leading?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits mdLeadingClick on Enter key', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdLeadingClick', spy);
    const leading = page.root?.shadowRoot?.querySelector('.md-split-button__leading') as HTMLElement;
    leading?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits mdLeadingClick on Space key', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdLeadingClick', spy);
    const leading = page.root?.shadowRoot?.querySelector('.md-split-button__leading') as HTMLElement;
    leading?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits mdTrailingClick on trailing button click', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdTrailingClick', spy);
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    trailing?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0].detail).toEqual({ checked: true });
  });

  it('toggles trailingChecked on trailing click', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;

    trailing?.click();
    await page.waitForChanges();
    expect(page.root?.classList.contains('md-split-button--trailing-checked')).toBe(true);

    trailing?.click();
    await page.waitForChanges();
    expect(page.root?.classList.contains('md-split-button--trailing-checked')).toBe(false);
  });

  it('emits mdTrailingClick on Enter key', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdTrailingClick', spy);
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    trailing?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits mdTrailingClick on Space key', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdTrailingClick', spy);
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    trailing?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('does not emit mdTrailingClick when leading button is clicked', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdTrailingClick', spy);
    const leading = page.root?.shadowRoot?.querySelector('.md-split-button__leading') as HTMLElement;
    leading?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not emit mdLeadingClick when trailing button is clicked', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdLeadingClick', spy);
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    trailing?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores non-Enter/Space keys on leading', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdLeadingClick', spy);
    const leading = page.root?.shadowRoot?.querySelector('.md-split-button__leading') as HTMLElement;
    leading?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores non-Enter/Space keys on trailing', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdTrailingClick', spy);
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    trailing?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Disabled ──────────────────────────────────────────────
  it('applies disabled class', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--disabled')).toBe(true);
  });

  it('sets disabled attribute on both buttons', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.hasAttribute('disabled')).toBe(true);
    expect(buttons?.[1]?.hasAttribute('disabled')).toBe(true);
  });

  it('sets tabindex=-1 on buttons when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.getAttribute('tabindex')).toBe('-1');
    expect(buttons?.[1]?.getAttribute('tabindex')).toBe('-1');
  });

  it('does not emit mdLeadingClick when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdLeadingClick', spy);
    const leading = page.root?.shadowRoot?.querySelector('.md-split-button__leading') as HTMLElement;
    leading?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not emit mdTrailingClick when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdTrailingClick', spy);
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    trailing?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks keyboard on leading when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdLeadingClick', spy);
    const leading = page.root?.shadowRoot?.querySelector('.md-split-button__leading') as HTMLElement;
    leading?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks keyboard on trailing when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdTrailingClick', spy);
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    trailing?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Soft-Disabled ─────────────────────────────────────────
  it('applies disabled class when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" soft-disabled></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--disabled')).toBe(true);
  });

  it('keeps tabindex=0 on buttons when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" soft-disabled></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.getAttribute('tabindex')).toBe('0');
    expect(buttons?.[1]?.getAttribute('tabindex')).toBe('0');
  });

  it('does not emit events when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" soft-disabled></md-split-button>`,
    });
    const leadingSpy = jest.fn();
    const trailingSpy = jest.fn();
    page.root?.addEventListener('mdLeadingClick', leadingSpy);
    page.root?.addEventListener('mdTrailingClick', trailingSpy);
    const leading = page.root?.shadowRoot?.querySelector('.md-split-button__leading') as HTMLElement;
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    leading?.click();
    trailing?.click();
    await page.waitForChanges();
    expect(leadingSpy).not.toHaveBeenCalled();
    expect(trailingSpy).not.toHaveBeenCalled();
  });

  it('sets aria-disabled on both buttons when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" soft-disabled></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.getAttribute('aria-disabled')).toBe('true');
    expect(buttons?.[1]?.getAttribute('aria-disabled')).toBe('true');
  });

  it('disables ripple when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" soft-disabled></md-split-button>`,
    });
    const ripples = page.root?.shadowRoot?.querySelectorAll('md-ripple');
    ripples?.forEach(r => expect(r.getAttribute('disabled')).not.toBeNull());
  });

  // ── Trailing Checked ──────────────────────────────────────
  it('applies trailing-checked class', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" trailing-checked></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--trailing-checked')).toBe(true);
  });

  it('applies trailing--checked class on the trailing button element', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" trailing-checked></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(trailing?.classList.contains('md-split-button__trailing--checked')).toBe(true);
  });

  it('does not apply trailing--checked class when not checked', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(trailing?.classList.contains('md-split-button__trailing--checked')).toBe(false);
  });

  it('toggles trailing--checked class on the button element', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;

    trailing?.click();
    await page.waitForChanges();
    const updated = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(updated?.classList.contains('md-split-button__trailing--checked')).toBe(true);

    trailing?.click();
    await page.waitForChanges();
    const final = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(final?.classList.contains('md-split-button__trailing--checked')).toBe(false);
  });

  it('sets aria-expanded=true on trailing when checked', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" trailing-checked></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(trailing?.getAttribute('aria-expanded')).toBe('true');
  });

  it('sets aria-expanded=false on trailing when not checked', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(trailing?.getAttribute('aria-expanded')).toBe('false');
  });

  // ── Ripple ────────────────────────────────────────────────
  it('renders two md-ripple by default', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const ripples = page.root?.shadowRoot?.querySelectorAll('md-ripple');
    expect(ripples?.length).toBe(2);
  });

  it('does not render md-ripple when ripple=false', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" ripple="false"></md-split-button>`,
    });
    const ripples = page.root?.shadowRoot?.querySelectorAll('md-ripple');
    expect(ripples?.length).toBe(0);
  });

  // ── With-Icon class ───────────────────────────────────────
  it('applies with-icon class when icon prop is set', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button icon="save" label="Save"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--with-icon')).toBe(true);
  });

  it('does not apply with-icon class when no icon', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.classList.contains('md-split-button--with-icon')).toBe(false);
  });

  // ── CSS Parts ─────────────────────────────────────────────
  it('exposes leading part', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('[part="leading"]')).toBeTruthy();
  });

  it('exposes trailing part', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('[part="trailing"]')).toBeTruthy();
  });

  it('exposes icon part', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button icon="save" label="Save"></md-split-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
  });

  it('exposes label part', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeTruthy();
  });

  it('exposes trailing-icon part', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('[part="trailing-icon"]')).toBeTruthy();
  });

  it('exposes leading-state-layer part', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('[part="leading-state-layer"]')).toBeTruthy();
  });

  it('exposes trailing-state-layer part', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('[part="trailing-state-layer"]')).toBeTruthy();
  });

  // ── WCAG 1.1.1 — Non-text Content ────────────────────────
  it('WCAG 1.1.1: warns when leading has no label or aria-label', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button icon="save"></md-split-button>`,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('WCAG 1.1.1'),
      expect.anything(),
    );
  });

  it('WCAG 1.1.1: no warning when label is present', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('WCAG 1.1.1: no warning when aria-label is present', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button icon="save" aria-label="Save file"></md-split-button>`,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ── WCAG 1.3.2 — Decorative elements hidden ──────────────
  it('WCAG 1.3.2: state layers have aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const leadingSL = page.root?.shadowRoot?.querySelector('.md-split-button__leading-state-layer');
    const trailingSL = page.root?.shadowRoot?.querySelector('.md-split-button__trailing-state-layer');
    expect(leadingSL?.getAttribute('aria-hidden')).toBe('true');
    expect(trailingSL?.getAttribute('aria-hidden')).toBe('true');
  });

  it('WCAG 1.3.2: icons have aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button icon="save" label="Save"></md-split-button>`,
    });
    const leadingIcon = page.root?.shadowRoot?.querySelector('.md-split-button__icon');
    const trailingIcon = page.root?.shadowRoot?.querySelector('.md-split-button__trailing-icon');
    expect(leadingIcon?.getAttribute('aria-hidden')).toBe('true');
    expect(trailingIcon?.getAttribute('aria-hidden')).toBe('true');
  });

  // ── WCAG 2.1.1 — Keyboard ────────────────────────────────
  it('WCAG 2.1.1: both buttons are keyboard operable', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.getAttribute('tabindex')).toBe('0');
    expect(buttons?.[1]?.getAttribute('tabindex')).toBe('0');
  });

  it('WCAG 2.1.1: disabled removes from tab order', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.getAttribute('tabindex')).toBe('-1');
    expect(buttons?.[1]?.getAttribute('tabindex')).toBe('-1');
  });

  it('WCAG 2.1.1: soft-disabled keeps in tab order', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" soft-disabled></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.getAttribute('tabindex')).toBe('0');
    expect(buttons?.[1]?.getAttribute('tabindex')).toBe('0');
  });

  // ── WCAG 4.1.2 — Name, Role, Value ───────────────────────
  it('WCAG 4.1.2: trailing has aria-expanded', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(trailing?.getAttribute('aria-expanded')).toBe('false');
  });

  it('WCAG 4.1.2: trailing has aria-label', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(trailing?.getAttribute('aria-label')).toBe('Toggle menu');
  });

  it('WCAG 4.1.2: aria-expanded updates dynamically', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const trailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing') as HTMLElement;
    expect(trailing?.getAttribute('aria-expanded')).toBe('false');

    trailing?.click();
    await page.waitForChanges();
    const updatedTrailing = page.root?.shadowRoot?.querySelector('.md-split-button__trailing');
    expect(updatedTrailing?.getAttribute('aria-expanded')).toBe('true');
  });

  it('WCAG 4.1.2: aria-disabled on buttons when disabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.getAttribute('aria-disabled')).toBe('true');
    expect(buttons?.[1]?.getAttribute('aria-disabled')).toBe('true');
  });

  it('WCAG 4.1.2: no aria-disabled when enabled', async () => {
    const page = await newSpecPage({
      components: [MdSplitButton],
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    const buttons = page.root?.shadowRoot?.querySelectorAll('button');
    expect(buttons?.[0]?.getAttribute('aria-disabled')).toBeNull();
    expect(buttons?.[1]?.getAttribute('aria-disabled')).toBeNull();
  });
});
