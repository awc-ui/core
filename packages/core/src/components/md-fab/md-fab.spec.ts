import { newSpecPage } from '@stencil/core/testing';
import { MdFab } from './md-fab';

describe('md-fab', () => {
  let warnSpy: jest.SpyInstance;
  beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  // ── Rendering ───────────────────────────────────────────────
  it('renders with default props', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-fab')).toBe(true);
    expect(page.root?.classList.contains('md-fab--primary-container')).toBe(true);
    expect(page.root?.classList.contains('md-fab--standard')).toBe(true);
  });

  it('renders icon inside shadow root', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="edit"></md-fab>`,
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-fab__icon');
    expect(icon).toBeTruthy();
    expect(icon?.textContent).toBe('edit');
  });

  it('does not render icon when icon prop is empty', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab label="Create"></md-fab>`,
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-fab__icon');
    expect(icon).toBeNull();
  });

  // ── Variant ─────────────────────────────────────────────────
  it('applies variant class: primary-container (default)', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--primary-container')).toBe(true);
  });

  it('applies variant class: secondary-container', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab variant="secondary-container" icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--secondary-container')).toBe(true);
  });

  it('applies variant class: tertiary-container', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab variant="tertiary-container" icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--tertiary-container')).toBe(true);
  });

  it('applies variant class: primary (direct)', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab variant="primary" icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--primary')).toBe(true);
  });

  it('applies variant class: secondary (direct)', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab variant="secondary" icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--secondary')).toBe(true);
  });

  it('applies variant class: tertiary (direct)', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab variant="tertiary" icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--tertiary')).toBe(true);
  });

  // ── Size ────────────────────────────────────────────────────
  it('applies size class: standard (default)', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--standard')).toBe(true);
  });

  it('applies size class: medium (80dp)', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab size="medium" icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--medium')).toBe(true);
  });

  it('applies size class: large', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab size="large" icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--large')).toBe(true);
  });

  // ── Extended FAB ────────────────────────────────────────────
  it('becomes extended when label is set', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" label="Create"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--extended')).toBe(true);
    expect(page.root?.classList.contains('md-fab--standard')).toBe(false);
  });

  it('renders label text in extended mode', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" label="Create"></md-fab>`,
    });
    const label = page.root?.shadowRoot?.querySelector('.md-fab__label');
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe('Create');
  });

  it('allows extended FAB without icon', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab label="Reroute"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--extended')).toBe(true);
    const icon = page.root?.shadowRoot?.querySelector('.md-fab__icon');
    expect(icon).toBeNull();
  });

  it('does not render label in non-extended mode', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const label = page.root?.shadowRoot?.querySelector('.md-fab__label');
    expect(label).toBeNull();
  });

  it('applies with-icon class when icon prop is set', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" label="Create"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--with-icon')).toBe(true);
  });

  it('does not apply with-icon class when icon is empty', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab label="Reroute"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--with-icon')).toBe(false);
  });

  // ── Lowered ─────────────────────────────────────────────────
  it('applies lowered class', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" lowered></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--lowered')).toBe(true);
  });

  // ── Disabled ────────────────────────────────────────────────
  it('applies disabled class and aria-disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab disabled icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--disabled')).toBe(true);
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  it('sets tabindex -1 when disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab disabled icon="add"></md-fab>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('does not emit mdClick when disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab disabled icon="add"></md-fab>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Soft-Disabled ───────────────────────────────────────────
  it('applies disabled class for soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab soft-disabled icon="add"></md-fab>`,
    });
    expect(page.root?.classList.contains('md-fab--disabled')).toBe(true);
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps tabindex 0 when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab soft-disabled icon="add"></md-fab>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('0');
  });

  it('does not emit mdClick when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab soft-disabled icon="add"></md-fab>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Events ──────────────────────────────────────────────────
  it('emits mdClick on click', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits mdClick on Enter key', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits mdClick on Space key', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('does not emit mdClick on Enter when disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" disabled></md-fab>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not emit mdClick on Enter when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" soft-disabled></md-fab>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores non-Enter/Space keys', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Accessibility ───────────────────────────────────────────
  it('has role="button"', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    expect(page.root?.getAttribute('role')).toBe('button');
  });

  it('has tabindex 0 when enabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('0');
  });

  it('has aria-disabled false when enabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    expect(page.root?.getAttribute('aria-disabled')).toBe('false');
  });

  // ── CSS Parts ───────────────────────────────────────────────
  it('exposes state-layer part', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const stateLayer = page.root?.shadowRoot?.querySelector('[part="state-layer"]');
    expect(stateLayer).toBeTruthy();
  });

  it('exposes icon part', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const icon = page.root?.shadowRoot?.querySelector('[part="icon"]');
    expect(icon).toBeTruthy();
  });

  it('exposes label part when extended', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" label="Create"></md-fab>`,
    });
    const label = page.root?.shadowRoot?.querySelector('[part="label"]');
    expect(label).toBeTruthy();
  });

  // ── Ripple ──────────────────────────────────────────────────
  it('renders md-ripple by default', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple).toBeTruthy();
  });

  it('does not render md-ripple when ripple=false', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" ripple="false"></md-fab>`,
    });
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple).toBeNull();
  });

  // ── Accessibility (extended) ──────────────────────────────
  it('passes through aria-label attribute', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" aria-label="Create new item"></md-fab>`,
    });
    expect(page.root?.getAttribute('aria-label')).toBe('Create new item');
  });

  it('state-layer has aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const stateLayer = page.root?.shadowRoot?.querySelector('.md-fab__state-layer');
    expect(stateLayer?.getAttribute('aria-hidden')).toBe('true');
  });

  it('md-ripple is disabled when host is soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" soft-disabled></md-fab>`,
    });
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple?.getAttribute('disabled')).not.toBeNull();
  });

  it('md-ripple is disabled when host is disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" disabled></md-fab>`,
    });
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple?.getAttribute('disabled')).not.toBeNull();
  });

  it('icon has material-symbols-outlined class', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-fab__icon');
    expect(icon?.classList.contains('material-symbols-outlined')).toBe(true);
  });

  // ── WCAG 2.1 AA ──────────────────────────────────────────────

  // 1.1.1 — Extended FAB auto-sets aria-label from label prop
  it('WCAG 1.1.1: extended FAB auto-sets aria-label from label prop', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" label="Create"></md-fab>`,
    });
    expect(page.root?.getAttribute('aria-label')).toBe('Create');
  });

  // 1.1.1 — Consumer-provided aria-label takes precedence
  it('WCAG 1.1.1: explicit aria-label is preserved on extended FAB', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" label="Create" aria-label="Add new item"></md-fab>`,
    });
    expect(page.root?.getAttribute('aria-label')).toBe('Add new item');
  });

  // 1.1.1 — aria-labelledby prevents auto aria-label
  it('WCAG 1.1.1: aria-labelledby prevents auto aria-label', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" label="Create" aria-labelledby="external-label"></md-fab>`,
    });
    expect(page.root?.hasAttribute('aria-labelledby')).toBe(true);
    const ariaLabel = page.root?.getAttribute('aria-label');
    expect(ariaLabel == null || ariaLabel === '').toBeTruthy();
  });

  // 1.1.1 — Icon element is aria-hidden (decorative)
  it('WCAG 1.1.1: icon element has aria-hidden="true"', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    const icon = page.root?.shadowRoot?.querySelector('.md-fab__icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  // 1.1.1 — Dev warning for missing accessible name
  it('WCAG 1.1.1: warns when icon-only FAB has no accessible name', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('WCAG 1.1.1'),
      expect.anything(),
    );
  });

  // 1.1.1 — No warning when aria-label is provided
  it('WCAG 1.1.1: no warning when aria-label is present', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" aria-label="Add"></md-fab>`,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // 1.1.1 — No warning when label is provided (extended)
  it('WCAG 1.1.1: no warning for extended FAB with label', async () => {
    warnSpy.mockClear();
    await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" label="Create"></md-fab>`,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // 4.1.2 — aria-disabled reflects disabled state
  it('WCAG 4.1.2: aria-disabled="false" when enabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add"></md-fab>`,
    });
    expect(page.root?.getAttribute('aria-disabled')).toBe('false');
  });

  it('WCAG 4.1.2: aria-disabled="true" when disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" disabled></md-fab>`,
    });
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  it('WCAG 4.1.2: aria-disabled="true" when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" soft-disabled></md-fab>`,
    });
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  // 2.1.1 — Keyboard: disabled removes from tab order, soft-disabled keeps it
  it('WCAG 2.1.1: disabled FAB has tabindex=-1', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" disabled></md-fab>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('WCAG 2.1.1: soft-disabled FAB keeps tabindex=0', async () => {
    const page = await newSpecPage({
      components: [MdFab],
      html: `<md-fab icon="add" soft-disabled></md-fab>`,
    });
    expect(page.root?.getAttribute('tabindex')).toBe('0');
  });
});
