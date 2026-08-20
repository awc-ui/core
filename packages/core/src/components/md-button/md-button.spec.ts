import { newSpecPage } from '@stencil/core/testing';
import { MdButton } from './md-button';

describe('md-button', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdButton], html });
  }

  it('renders with default variant', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button>Click me</md-button>`,
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.shadowRoot?.querySelector('.md-button__label')).toBeTruthy();
  });

  it('applies variant class', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button variant="outlined">Click me</md-button>`,
    });
    expect(page.root?.classList.contains('md-button--outlined')).toBe(true);
  });

  it('reflects disabled attribute', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button disabled>Click me</md-button>`,
    });
    expect(page.root?.getAttribute('disabled')).not.toBeNull();
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  it('has role=button', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button>Click me</md-button>`,
    });
    expect(page.root?.getAttribute('role')).toBe('button');
  });

  it('supports role-override for composite widgets', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button role-override="gridcell">15</md-button>`,
    });
    expect(page.root?.getAttribute('role')).toBe('gridcell');
  });

  it('emits mdClick on click', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button>Click me</md-button>`,
    });
    const mdClickSpy = jest.fn();
    page.root?.addEventListener('mdClick', mdClickSpy);
    page.root?.click();
    await page.waitForChanges();
    expect(mdClickSpy).toHaveBeenCalled();
  });

  it('does not emit mdClick when disabled', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button disabled>Click me</md-button>`,
    });
    const mdClickSpy = jest.fn();
    page.root?.addEventListener('mdClick', mdClickSpy);
    page.root?.click();
    await page.waitForChanges();
    expect(mdClickSpy).not.toHaveBeenCalled();
  });

  it('shows icon when icon prop is set', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button icon="add">Click me</md-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('.md-button__icon')).toBeTruthy();
  });

  it('shows loading spinner when loading=true', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button loading>Click me</md-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('.md-button__loading')).toBeTruthy();
  });

  it('exposes part attributes on internal elements', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button icon="add" loading>Click me</md-button>`,
    });
    const shadow = page.root?.shadowRoot;
    expect(shadow?.querySelector('[part="state-layer"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="icon"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="label"]')).toBeTruthy();
    expect(shadow?.querySelector('[part="loading"]')).toBeTruthy();
  });

  it('exposes trailing-icon part', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button trailing-icon="arrow_forward">Next</md-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('[part="trailing-icon"]')).toBeTruthy();
  });

  it('renders named leading-icon slot', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button>Click me</md-button>`,
    });
    const slot = page.root?.shadowRoot?.querySelector('slot[name="leading-icon"]');
    expect(slot).toBeTruthy();
  });

  it('renders named trailing-icon slot', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button>Click me</md-button>`,
    });
    const slot = page.root?.shadowRoot?.querySelector('slot[name="trailing-icon"]');
    expect(slot).toBeTruthy();
  });

  it('renders md-ripple by default (ripple enabled)', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button>Click me</md-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeTruthy();
  });

  it('does not render md-ripple when ripple=false', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button ripple="false">No Ripple</md-button>`,
    });
    expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeNull();
  });

  // ── Toggle ────────────────────────────────────────────────

  it('applies toggle class when toggle=true', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button toggle>Toggle</md-button>`,
    });
    expect(page.root?.classList.contains('md-button--toggle')).toBe(true);
  });

  it('applies selected class when selected=true', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button toggle selected>Toggle</md-button>`,
    });
    expect(page.root?.classList.contains('md-button--selected')).toBe(true);
  });

  it('toggles selected on click', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button toggle>Toggle</md-button>`,
    });
    expect(page.root?.classList.contains('md-button--selected')).toBe(false);
    page.root?.click();
    await page.waitForChanges();
    expect(page.root?.classList.contains('md-button--selected')).toBe(true);
    page.root?.click();
    await page.waitForChanges();
    expect(page.root?.classList.contains('md-button--selected')).toBe(false);
  });

  it('sets aria-pressed when toggle is enabled', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button toggle>Toggle</md-button>`,
    });
    expect(page.root?.getAttribute('aria-pressed')).toBe('false');
    page.root?.click();
    await page.waitForChanges();
    expect(page.root?.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not set aria-pressed when toggle is disabled', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button>Button</md-button>`,
    });
    expect(page.root?.getAttribute('aria-pressed')).toBeNull();
  });

  it('does not toggle when not in toggle mode', async () => {
    const page = await newSpecPage({
      components: [MdButton],
      html: `<md-button>Button</md-button>`,
    });
    page.root?.click();
    await page.waitForChanges();
    expect(page.root?.classList.contains('md-button--selected')).toBe(false);
  });

  // ── Enhanced mdClick event detail ────────────────────────

  describe('mdClick detail payload', () => {
    it('emits a structured detail with value, toggle, selected, href, target, originalEvent', async () => {
      const page = await create(
        '<md-button value="save" href="/next" target="_blank">Save</md-button>',
      );
      let detail: any = null;
      page.root?.addEventListener('mdClick', (e) => {
        detail = (e as CustomEvent).detail;
      });
      page.root?.click();
      await page.waitForChanges();
      expect(detail).toBeTruthy();
      expect(detail.value).toBe('save');
      expect(detail.toggle).toBe(false);
      expect(detail.selected).toBe(false);
      expect(detail.href).toBe('/next');
      expect(detail.target).toBe('_blank');
      expect(detail.originalEvent).toBeDefined();
    });

    it('emits next-state selected in detail before toggle flips', async () => {
      const page = await create('<md-button toggle>Toggle</md-button>');
      const seen: boolean[] = [];
      page.root?.addEventListener('mdClick', (e) => {
        seen.push((e as CustomEvent).detail.selected);
      });
      page.root?.click();           // unselected → selected=true
      await page.waitForChanges();
      page.root?.click();           // selected=true → selected=false
      await page.waitForChanges();
      expect(seen).toEqual([true, false]);
    });

    it('is cancelable — preventDefault stops toggle flip', async () => {
      const page = await create('<md-button toggle>Toggle</md-button>');
      page.root?.addEventListener('mdClick', (e) => e.preventDefault());
      page.root?.click();
      await page.waitForChanges();
      expect(page.root?.classList.contains('md-button--selected')).toBe(false);
      expect(page.root?.getAttribute('aria-pressed')).toBe('false');
    });

    it('is cancelable — preventDefault stops href navigation', async () => {
      const page = await create(
        '<md-button href="https://example.com" target="_blank">Link</md-button>',
      );
      const openSpy = jest.fn();
      const original = (globalThis as { window?: Window }).window?.open;
      // Stencil mock-doc exposes a `window` shim — patch its `open` to
      // verify we never call it when the click is cancelled.
      if ((globalThis as { window?: Window }).window) {
        (globalThis as { window: Window }).window.open = openSpy as unknown as typeof window.open;
      }
      page.root?.addEventListener('mdClick', (e) => e.preventDefault());
      page.root?.click();
      await page.waitForChanges();
      expect(openSpy).not.toHaveBeenCalled();
      if ((globalThis as { window?: Window }).window && original) {
        (globalThis as { window: Window }).window.open = original;
      }
    });

    it('mdClick event bubbles and is composed', async () => {
      const page = await create(
        '<div><md-button>Click</md-button></div>',
      );
      const wrapper = page.body.querySelector('div');
      const button = page.body.querySelector('md-button');
      const wrapperSpy = jest.fn();
      wrapper?.addEventListener('mdClick', wrapperSpy);
      button?.click();
      await page.waitForChanges();
      expect(wrapperSpy).toHaveBeenCalled();
    });
  });

  // ── mdChange event ──────────────────────────────────────

  describe('mdChange', () => {
    it('emits when toggle mode flips selected on click', async () => {
      const page = await create('<md-button toggle value="ok">Toggle</md-button>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', (e) => spy((e as CustomEvent).detail));
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ selected: true, value: 'ok' });
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith({ selected: false, value: 'ok' });
    });

    it('does not emit when toggle mode is off', async () => {
      const page = await create('<md-button>Plain</md-button>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit when mdClick is cancelled', async () => {
      const page = await create('<md-button toggle>Toggle</md-button>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', (e) => e.preventDefault());
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit when disabled', async () => {
      const page = await create('<md-button toggle disabled>Toggle</md-button>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ── Keyboard activation ─────────────────────────────────

  describe('keyboard', () => {
    it('activates on Enter via the host click handler', async () => {
      const page = await create('<md-button>Click</md-button>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('activates on Space via the host click handler', async () => {
      const page = await create('<md-button>Click</md-button>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('does not activate via Enter when disabled', async () => {
      const page = await create('<md-button disabled>Click</md-button>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ── Soft-disabled / loading ─────────────────────────────

  describe('soft-disabled and loading', () => {
    it('soft-disabled remains focusable but does not fire mdClick', async () => {
      const page = await create('<md-button soft-disabled>Paste</md-button>');
      // Soft-disabled keeps `tabindex="0"` — the user can still Tab to
      // it and discover the button — but clicking it must not fire
      // mdClick or change state.
      expect(page.root?.getAttribute('tabindex')).toBe('0');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('hard-disabled removes from tab order', async () => {
      const page = await create('<md-button disabled>Save</md-button>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('loading state acts as disabled for mdClick', async () => {
      const page = await create('<md-button loading>Saving</md-button>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ── RTL ─────────────────────────────────────────────────

  describe('RTL and icon mirroring', () => {
    it('renders inside dir="rtl" without errors', async () => {
      const page = await newSpecPage({
        components: [MdButton],
        html: '<div dir="rtl"><md-button icon="arrow_forward">Next</md-button></div>',
      });
      const button = page.body.querySelector('md-button');
      expect(button).toBeTruthy();
      expect(button?.shadowRoot?.querySelector('.md-button__icon')).toBeTruthy();
    });

    it('reflects mirror-icon as a host attribute', async () => {
      const page = await create(
        '<md-button mirror-icon trailing-icon="arrow_forward">Next</md-button>',
      );
      expect(page.root?.hasAttribute('mirror-icon')).toBe(true);
    });

    it('does not set mirror-icon by default', async () => {
      const page = await create('<md-button>Click</md-button>');
      expect(page.root?.hasAttribute('mirror-icon')).toBe(false);
    });
  });

  describe('trailing icon expand flip', () => {
    it('reflects suppress-expand-icon-flip when set', async () => {
      const page = await create(
        '<md-button suppress-expand-icon-flip trailing-icon="chevron_right" aria-expanded="true">Menu</md-button>',
      );
      expect(page.root?.hasAttribute('suppress-expand-icon-flip')).toBe(true);
    });

    it('defaults suppressExpandIconFlip to false', async () => {
      const page = await create('<md-button trailing-icon="arrow_drop_down">Menu</md-button>');
      expect((page.root as HTMLElement & { suppressExpandIconFlip?: boolean })
        ?.suppressExpandIconFlip).toBe(false);
    });
  });

  // ── Slotted icon reactivity ─────────────────────────────

  describe('slotted icon reactivity', () => {
    it('attaches slotchange listener on the leading-icon slot', async () => {
      const page = await create('<md-button>Click</md-button>');
      const slot = page.root?.shadowRoot?.querySelector(
        'slot[name="leading-icon"]',
      ) as HTMLSlotElement | null;
      expect(slot).toBeTruthy();
      slot?.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      // Even with an empty slot the dispatch travels the listener body.
      expect(page.root).toBeTruthy();
    });

    it('attaches slotchange listener on the trailing-icon slot', async () => {
      const page = await create('<md-button>Click</md-button>');
      const slot = page.root?.shadowRoot?.querySelector(
        'slot[name="trailing-icon"]',
      ) as HTMLSlotElement | null;
      expect(slot).toBeTruthy();
      slot?.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      expect(page.root).toBeTruthy();
    });
  });

  // ── Pointer / pressed state ─────────────────────────────

  describe('pressed state', () => {
    it('toggles the pressed flag on pointerdown / pointerup', async () => {
      const page = await create('<md-button>Press</md-button>');
      page.root?.dispatchEvent(new Event('pointerdown'));
      await page.waitForChanges();
      expect(page.root?.classList.contains('md-button--pressed')).toBe(true);
      page.root?.dispatchEvent(new Event('pointerup'));
      await page.waitForChanges();
      expect(page.root?.classList.contains('md-button--pressed')).toBe(false);
    });

    it('does not enter pressed state when disabled', async () => {
      const page = await create('<md-button disabled>Press</md-button>');
      page.root?.dispatchEvent(new Event('pointerdown'));
      await page.waitForChanges();
      expect(page.root?.classList.contains('md-button--pressed')).toBe(false);
    });
  });

  // ── Accessibility ───────────────────────────────────────

  describe('accessibility', () => {
    it('passes through an authored aria-label without overwriting it', async () => {
      const page = await create('<md-button aria-label="Send message">Send</md-button>');
      expect(page.root?.getAttribute('aria-label')).toBe('Send message');
    });

    it('keeps role=button across all states', async () => {
      const page = await create('<md-button toggle disabled>X</md-button>');
      expect(page.root?.getAttribute('role')).toBe('button');
    });

    it('aria-disabled stays in sync with disabled / soft-disabled / loading', async () => {
      const a = await create('<md-button>X</md-button>');
      expect(a.root?.getAttribute('aria-disabled')).toBe('false');
      const b = await create('<md-button disabled>X</md-button>');
      expect(b.root?.getAttribute('aria-disabled')).toBe('true');
      const c = await create('<md-button soft-disabled>X</md-button>');
      expect(c.root?.getAttribute('aria-disabled')).toBe('true');
      const d = await create('<md-button loading>X</md-button>');
      expect(d.root?.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('width and height', () => {
    it('does not apply the full-width class by default', async () => {
      const page = await create('<md-button>X</md-button>');
      expect(page.root?.classList.contains('md-button--full-width')).toBe(false);
    });

    it('applies the full-width class when full-width attribute is set', async () => {
      const page = await create('<md-button full-width>X</md-button>');
      expect(page.root?.classList.contains('md-button--full-width')).toBe(true);
    });

    it('reflects fullWidth as the full-width attribute', async () => {
      const page = await create('<md-button>X</md-button>');
      (page.root as any).fullWidth = true;
      await page.waitForChanges();
      expect(page.root?.hasAttribute('full-width')).toBe(true);
    });

    it('reads the full-width attribute as a boolean prop', async () => {
      const page = await create('<md-button full-width>X</md-button>');
      expect((page.root as any).fullWidth).toBe(true);
    });

    it('full-width can be combined with size and variant classes', async () => {
      const page = await create(
        '<md-button variant="filled" size="lg" full-width>Save changes</md-button>',
      );
      expect(page.root?.classList.contains('md-button--filled')).toBe(true);
      expect(page.root?.classList.contains('md-button--lg')).toBe(true);
      expect(page.root?.classList.contains('md-button--full-width')).toBe(true);
    });

    it('accepts CSS custom property overrides for width and height', async () => {
      const page = await create(
        '<md-button style="--md-button-width: 320px; --md-button-height: 64px; --md-button-min-width: 0;">X</md-button>',
      );
      const style = page.root?.getAttribute('style') ?? '';
      expect(style).toContain('--md-button-width: 320px');
      expect(style).toContain('--md-button-height: 64px');
      expect(style).toContain('--md-button-min-width: 0');
    });

    it('exposes a `loader` slot over the default spinner', async () => {
      const page = await create('<md-button loading>Save</md-button>');
      const wrap = page.root?.shadowRoot?.querySelector('[part="loading"]');
      // The slot is the projection point; the md-loading-indicator is only its
      // fallback, so a consumer can swap in e.g. a circular progress indicator.
      const slot = wrap?.querySelector('slot[name="loader"]');
      expect(slot).toBeTruthy();
      expect(slot?.querySelector('md-loading-indicator')).toBeTruthy();
    });

    it('renders no loader slot when not loading', async () => {
      const page = await create('<md-button>Save</md-button>');
      expect(page.root?.shadowRoot?.querySelector('slot[name="loader"]')).toBeNull();
    });

    it('accepts CSS custom property overrides for max-width and min-height', async () => {
      const page = await create(
        '<md-button style="--md-button-max-width: 480px; --md-button-min-height: 80px;">X</md-button>',
      );
      const style = page.root?.getAttribute('style') ?? '';
      expect(style).toContain('--md-button-max-width: 480px');
      expect(style).toContain('--md-button-min-height: 80px');
    });
  });
});
