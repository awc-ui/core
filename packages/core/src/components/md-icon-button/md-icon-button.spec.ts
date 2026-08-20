import { newSpecPage } from '@stencil/core/testing';
import { MdIconButton } from './md-icon-button';

describe('md-icon-button', () => {
  // ── Rendering ──────────────────────────────────────────────
  it('renders with default props', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-icon-button')).toBe(true);
  });

  it('defaults to standard variant', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--standard')).toBe(true);
  });

  it('defaults to sm size', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--sm')).toBe(true);
  });

  it('defaults to round shape', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--round')).toBe(true);
  });

  // ── Variants ──────────────────────────────────────────────
  it('applies filled variant class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button variant="filled" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--filled')).toBe(true);
  });

  it('applies tonal variant class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button variant="tonal" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--tonal')).toBe(true);
  });

  it('applies outlined variant class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button variant="outlined" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--outlined')).toBe(true);
  });

  // ── Sizes ─────────────────────────────────────────────────
  it('applies xs size class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button size="xs" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--xs')).toBe(true);
  });

  it('applies md size class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button size="md" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--md')).toBe(true);
  });

  it('applies lg size class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button size="lg" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--lg')).toBe(true);
  });

  it('applies xl size class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button size="xl" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--xl')).toBe(true);
  });

  // ── Widths ────────────────────────────────────────────────
  it('defaults to default width (no width class)', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--width-narrow')).toBe(false);
    expect(page.root?.classList.contains('md-icon-button--width-wide')).toBe(false);
  });

  it('applies narrow width class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button button-width="narrow" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--width-narrow')).toBe(true);
  });

  it('applies wide width class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button button-width="wide" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--width-wide')).toBe(true);
  });

  it('combines narrow width with size class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button button-width="narrow" size="lg" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--width-narrow')).toBe(true);
    expect(page.root?.classList.contains('md-icon-button--lg')).toBe(true);
  });

  it('combines wide width with size and shape classes', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button button-width="wide" size="md" shape="square" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--width-wide')).toBe(true);
    expect(page.root?.classList.contains('md-icon-button--md')).toBe(true);
    expect(page.root?.classList.contains('md-icon-button--square')).toBe(true);
  });

  // ── Shapes ────────────────────────────────────────────────
  it('applies square shape class', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button shape="square" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--square')).toBe(true);
  });

  // ── Accessibility ─────────────────────────────────────────
  describe('accessibility', () => {
    it('has role="button"', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('role')).toBe('button');
    });

    it('sets aria-disabled="true" when disabled', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button disabled icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('sets aria-disabled="false" when enabled', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('aria-disabled')).toBe('false');
    });

    it('sets aria-disabled="true" when soft-disabled', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button soft-disabled icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('sets tabindex="-1" when disabled', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button disabled icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('sets tabindex="0" when soft-disabled (focusable)', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button soft-disabled icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('sets tabindex="0" when enabled', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('sets aria-pressed for toggle buttons', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button toggle icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('aria-pressed')).toBe('false');
    });

    it('does not set aria-pressed for non-toggle buttons', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('aria-pressed')).toBeNull();
    });

    it('updates aria-pressed when toggled', async () => {
      const page = await newSpecPage({
        components: [MdIconButton],
        html: '<md-icon-button toggle icon="favorite"></md-icon-button>',
      });
      expect(page.root?.getAttribute('aria-pressed')).toBe('false');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // ── Events ────────────────────────────────────────────────
  it('emits mdClick on click', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('does not emit mdClick when disabled', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button disabled icon="favorite"></md-icon-button>',
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not emit mdClick when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button soft-disabled icon="favorite"></md-icon-button>',
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits mdClick with selected state', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button toggle icon="favorite"></md-icon-button>',
    });
    let detail: any;
    page.root?.addEventListener('mdClick', (e: any) => { detail = e.detail; });
    page.root?.click();
    await page.waitForChanges();
    expect(detail.selected).toBe(true);
  });

  // ── Toggle ────────────────────────────────────────────────
  it('toggles selected on click when toggle=true', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button toggle icon="favorite"></md-icon-button>',
    });
    expect(page.rootInstance.selected).toBe(false);
    page.root?.click();
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(true);
  });

  it('does not toggle when toggle=false', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.rootInstance.selected).toBe(false);
    page.root?.click();
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(false);
  });

  it('applies selected class when selected', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button toggle selected icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--selected')).toBe(true);
  });

  it('applies toggle class when toggle=true', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button toggle icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--toggle')).toBe(true);
  });

  // ── Disabled classes ──────────────────────────────────────
  it('applies disabled class when disabled', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button disabled icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--disabled')).toBe(true);
  });

  it('applies disabled class when soft-disabled', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button soft-disabled icon="favorite"></md-icon-button>',
    });
    expect(page.root?.classList.contains('md-icon-button--disabled')).toBe(true);
  });

  // ── Icon rendering ────────────────────────────────────────
  it('renders icon text inside material-symbols-outlined span', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    const iconFont = page.root?.shadowRoot?.querySelector('.material-symbols-outlined');
    expect(iconFont).toBeTruthy();
    expect(iconFont?.textContent).toBe('favorite');
  });

  it('renders icon prop when light DOM has whitespace-only default slot content', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: `<md-icon-button icon="more_vert">
            </md-icon-button>`,
    });
    await page.waitForChanges();
    const iconFont = page.root?.shadowRoot?.querySelector('.material-symbols-outlined');
    expect(iconFont).toBeTruthy();
    expect(iconFont?.textContent).toBe('more_vert');
  });

  it('renders selectedIcon when toggle is selected', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button toggle selected icon="favorite_border" selected-icon="favorite"></md-icon-button>',
    });
    const visibleIcons = page.root?.shadowRoot?.querySelectorAll('.md-icon-button__icon--on .material-symbols-outlined');
    expect(visibleIcons?.length).toBeGreaterThan(0);
  });

  // ── CSS parts ─────────────────────────────────────────────
  it('exposes "state-layer" CSS part', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
  });

  it('exposes "icon" CSS part', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
  });

  it('exposes "selected-icon" CSS part when toggle + selectedIcon', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button toggle selected-icon="check" icon="close"></md-icon-button>',
    });
    expect(page.root?.shadowRoot?.querySelector('[part="selected-icon"]')).toBeTruthy();
  });

  // ── Slots ─────────────────────────────────────────────────
  it('renders default slot', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    const slot = page.root?.shadowRoot?.querySelector('slot:not([name])');
    expect(slot).toBeTruthy();
  });

  it('shows slotted SVG in the visible icon layer', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: `<md-icon-button aria-label="Menu">
        <svg id="slotted-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"></svg>
      </md-icon-button>`,
    });
    await page.waitForChanges();
    const iconLayer = page.root?.shadowRoot?.querySelector('.md-icon-button__icon--on');
    const slot = page.root?.shadowRoot?.querySelector('slot:not([name])') as HTMLSlotElement | null;
    expect(iconLayer).toBeTruthy();
    expect(slot?.assignedElements().length).toBeGreaterThan(0);
    expect(page.root?.querySelector('#slotted-icon')).toBeTruthy();
  });

  it('shows slotted SVG in default slot', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: `<md-icon-button aria-label="Menu">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M3 18h18v-2H3v2z"/>
        </svg>
      </md-icon-button>`,
    });
    await page.waitForChanges();
    const slot = page.root?.shadowRoot?.querySelector('slot:not([name])') as HTMLSlotElement | undefined;
    expect(slot?.assignedElements().length).toBe(1);
    expect(page.root?.shadowRoot?.querySelector('.md-icon-button__icon--on')).toBeTruthy();
  });

  it('renders selected slot when toggle + selectedIcon', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button toggle selected-icon="check" icon="close"></md-icon-button>',
    });
    const slot = page.root?.shadowRoot?.querySelector('slot[name="selected"]');
    expect(slot).toBeTruthy();
  });

  // ── md-ripple ─────────────────────────────────────────────
  it('renders md-ripple by default', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeTruthy();
  });

  it('does not render md-ripple when ripple=false', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button ripple="false" icon="favorite"></md-icon-button>',
    });
    expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeNull();
  });

  // ── Keyboard handling ──────────────────────────────────────
  it('emits mdClick on Enter key', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('emits mdClick on Space key', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('does not emit mdClick on other keys', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button icon="favorite"></md-icon-button>',
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not emit on Enter when disabled', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button disabled icon="favorite"></md-icon-button>',
    });
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  it('toggles selected on Enter key when toggle=true', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button toggle icon="favorite"></md-icon-button>',
    });
    expect(page.rootInstance.selected).toBe(false);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(true);
  });

  // ── Edge cases ────────────────────────────────────────────
  it('renders without icon prop (empty)', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button></md-icon-button>',
    });
    expect(page.root).toBeTruthy();
  });

  it('soft-disabled reflects as attribute', async () => {
    const page = await newSpecPage({
      components: [MdIconButton],
      html: '<md-icon-button soft-disabled icon="favorite"></md-icon-button>',
    });
    expect(page.root?.getAttribute('soft-disabled')).not.toBeNull();
  });
});
