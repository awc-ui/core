import { newSpecPage } from '@stencil/core/testing';
import { MdSideSheet } from './md-side-sheet';

describe('md-side-sheet', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdSideSheet],
      html,
    });
  }

  // ── Rendering ───────────────────────────────────────────

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-side-sheet open headline="Filters"></md-side-sheet>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-side-sheet');
      expect(page.root).toHaveClass('md-side-sheet--standard');
      expect(page.root).toHaveClass('md-side-sheet--end');
    });

    it('applies variant class', async () => {
      const page = await create('<md-side-sheet open variant="modal" headline="Details"></md-side-sheet>');
      expect(page.root).toHaveClass('md-side-sheet--modal');
    });

    it('applies side class', async () => {
      const page = await create('<md-side-sheet open side="start" headline="Nav"></md-side-sheet>');
      expect(page.root).toHaveClass('md-side-sheet--start');
    });

    it('applies open class when open', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      expect(page.root).toHaveClass('md-side-sheet--open');
    });

    it('applies detached class', async () => {
      const page = await create('<md-side-sheet open detached headline="Test"></md-side-sheet>');
      expect(page.root).toHaveClass('md-side-sheet--detached');
    });

    it('renders headline text', async () => {
      const page = await create('<md-side-sheet open headline="Filters"></md-side-sheet>');
      const hl = page.root?.shadowRoot?.querySelector('.md-side-sheet__headline');
      expect(hl?.textContent).toContain('Filters');
    });

    it('does not render when standard and closed', async () => {
      const page = await create('<md-side-sheet headline="Hidden"></md-side-sheet>');
      expect(page.root).not.toHaveClass('md-side-sheet--open');
    });
  });

  // ── Variants ────────────────────────────────────────────

  describe('variants', () => {
    it('renders scrim for modal variant', async () => {
      const page = await create('<md-side-sheet open variant="modal" headline="Modal"></md-side-sheet>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-side-sheet__scrim');
      expect(scrim).toBeTruthy();
    });

    it('does not render scrim for standard variant', async () => {
      const page = await create('<md-side-sheet open variant="standard" headline="Standard"></md-side-sheet>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-side-sheet__scrim');
      expect(scrim).toBeNull();
    });
  });

  // ── Close button ────────────────────────────────────────

  describe('close button', () => {
    it('renders close icon button when closeable', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      const close = page.root?.shadowRoot?.querySelector('.md-side-sheet__close md-icon-button');
      expect(close).toBeTruthy();
      expect(close?.getAttribute('icon')).toBe('close');
    });

    it('hides close button when closeable is false', async () => {
      const page = await create('<md-side-sheet open headline="Test" closeable="false"></md-side-sheet>');
      const close = page.root?.shadowRoot?.querySelector('.md-side-sheet__close');
      expect(close).toBeNull();
    });
  });

  // ── Back button (modal) ─────────────────────────────────

  describe('back button', () => {
    it('renders back icon button for modal with show-back', async () => {
      const page = await create('<md-side-sheet open variant="modal" show-back headline="Detail"></md-side-sheet>');
      const back = page.root?.shadowRoot?.querySelector('.md-side-sheet__back md-icon-button');
      expect(back).toBeTruthy();
      expect(back?.getAttribute('icon')).toBe('arrow_back');
    });

    it('does not render back button for standard variant', async () => {
      const page = await create('<md-side-sheet open variant="standard" show-back headline="Test"></md-side-sheet>');
      const back = page.root?.shadowRoot?.querySelector('.md-side-sheet__back');
      expect(back).toBeNull();
    });
  });

  // ── Dividers ────────────────────────────────────────────

  describe('dividers', () => {
    it('renders top divider when top-divider set', async () => {
      const page = await create('<md-side-sheet open top-divider headline="Test"></md-side-sheet>');
      const dividers = page.root?.shadowRoot?.querySelectorAll('.md-side-sheet__divider');
      expect(dividers?.length).toBeGreaterThanOrEqual(1);
    });

    it('does not render dividers by default', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      const dividers = page.root?.shadowRoot?.querySelectorAll('.md-side-sheet__divider');
      expect(dividers?.length).toBe(0);
    });
  });

  // ── Accessibility ───────────────────────────────────────

  describe('accessibility', () => {
    it('has region role for standard variant', async () => {
      const page = await create('<md-side-sheet open headline="Filters"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      expect(container?.getAttribute('role')).toBe('region');
    });

    it('has dialog role for modal variant', async () => {
      const page = await create('<md-side-sheet open variant="modal" headline="Details"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      expect(container?.getAttribute('role')).toBe('dialog');
    });

    it('sets aria-modal for modal variant', async () => {
      const page = await create('<md-side-sheet open variant="modal" headline="Details"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      expect(container?.getAttribute('aria-modal')).toBe('true');
    });

    it('does not set aria-modal for standard variant', async () => {
      const page = await create('<md-side-sheet open headline="Filters"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      expect(container?.getAttribute('aria-modal')).toBeNull();
    });

    it('sets aria-labelledby when headline is present', async () => {
      const page = await create('<md-side-sheet open headline="Filters"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      const headlineId = page.root?.shadowRoot?.querySelector('.md-side-sheet__headline')?.id;
      expect(container?.getAttribute('aria-labelledby')).toBe(headlineId);
    });

    it('uses aria-label fallback when no headline', async () => {
      const page = await create('<md-side-sheet open></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      expect(container?.getAttribute('aria-label')).toBe('Side sheet');
    });

    it('has focusable container with tabindex', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      expect(container?.getAttribute('tabindex')).toBe('-1');
    });

    it('sets aria-hidden on container when closed', async () => {
      const page = await create('<md-side-sheet headline="Test"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      expect(container?.getAttribute('aria-hidden')).toBe('true');
    });

    it('removes aria-hidden when open', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container');
      expect(container?.getAttribute('aria-hidden')).toBeNull();
    });

    it('is inert when closed (no focusable content in the aria-hidden subtree)', async () => {
      const page = await create('<md-side-sheet headline="Test"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container') as HTMLElement;
      expect(container?.hasAttribute('inert') || (container as unknown as { inert?: boolean }).inert).toBeTruthy();
    });

    it('is not inert when open (content stays reachable / focus-trappable)', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      const container = page.root?.shadowRoot?.querySelector('.md-side-sheet__container') as HTMLElement;
      // mock-doc maps the `inert` boolean prop to a boolean attribute; a false
      // prop leaves the attribute unset (or falsy).
      const attr = container?.getAttribute('inert');
      const propVal = (container as unknown as { inert?: boolean }).inert;
      expect(attr === null || attr === 'false' || propVal === false).toBe(true);
    });

    it('close button has descriptive aria-label', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      const close = page.root?.shadowRoot?.querySelector('.md-side-sheet__close md-icon-button');
      expect(close?.getAttribute('aria-label')).toBe('Close side sheet');
    });
  });

  // ── Events ──────────────────────────────────────────────

  describe('events', () => {
    it('emits mdOpen when opened', async () => {
      const page = await create('<md-side-sheet headline="Test"></md-side-sheet>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);
      page.root!.open = true;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdClose when closed', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);
      page.root!.open = false;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ── Keyboard ────────────────────────────────────────────

  describe('keyboard', () => {
    it('closes a MODAL sheet on Escape', async () => {
      const page = await create('<md-side-sheet variant="modal" open headline="Test"></md-side-sheet>');
      const cancelSpy = jest.fn();
      page.root?.addEventListener('mdCancel', cancelSpy);
      page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(page.root?.open).toBe(false);
    });

    // `standard` is a non-modal inline region: no scrim, no focus trap, and no
    // document-level Escape. It used to listen anyway, so a single Escape closed
    // every inline sheet on the page at once — including ones the user never
    // interacted with.
    it('leaves a STANDARD sheet open on Escape', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      const cancelSpy = jest.fn();
      page.root?.addEventListener('mdCancel', cancelSpy);
      page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(page.root?.open).toBe(true);
    });
  });

  // ── Public methods ──────────────────────────────────────

  describe('methods', () => {
    it('show() sets open to true', async () => {
      const page = await create('<md-side-sheet headline="Test"></md-side-sheet>');
      await page.root!.show();
      await page.waitForChanges();
      expect(page.root?.open).toBe(true);
    });

    it('close() sets open to false', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      await page.root!.close();
      await page.waitForChanges();
      expect(page.root?.open).toBe(false);
    });
  });

  // ── Parts ───────────────────────────────────────────────

  describe('parts', () => {
    it('exposes container part', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('exposes header part', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="header"]')).toBeTruthy();
    });

    it('exposes headline part', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="headline"]')).toBeTruthy();
    });

    it('exposes close part', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="close"]')).toBeTruthy();
    });

    it('exposes content part', async () => {
      const page = await create('<md-side-sheet open headline="Test"></md-side-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="content"]')).toBeTruthy();
    });

    it('exposes scrim part for modal', async () => {
      const page = await create('<md-side-sheet open variant="modal" headline="Test"></md-side-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="scrim"]')).toBeTruthy();
    });

    it('exposes divider-top part when top-divider set', async () => {
      const page = await create('<md-side-sheet open top-divider headline="Test"></md-side-sheet>');
      expect(page.root?.shadowRoot?.querySelector('[part="divider-top"]')).toBeTruthy();
    });
  });

  // ── Slots ───────────────────────────────────────────────

  describe('slots', () => {
    it('renders default slot for content', async () => {
      const page = await create('<md-side-sheet open headline="Test"><p>Body text</p></md-side-sheet>');
      expect(page.root?.textContent).toContain('Body text');
    });

    it('renders headline slot', async () => {
      const page = await create('<md-side-sheet open><span slot="headline">Custom Title</span></md-side-sheet>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="headline"]');
      expect(slot).toBeTruthy();
    });

    it('renders close slot', async () => {
      const page = await create('<md-side-sheet open headline="Test"><button slot="close">X</button></md-side-sheet>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="close"]');
      expect(slot).toBeTruthy();
    });

    it('renders back slot for modal', async () => {
      const page = await create('<md-side-sheet open variant="modal" show-back headline="Test"><button slot="back">←</button></md-side-sheet>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="back"]');
      expect(slot).toBeTruthy();
    });

    it('renders actions slot', async () => {
      const page = await create('<md-side-sheet open headline="Test"><button slot="actions">Apply</button></md-side-sheet>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="actions"]');
      expect(slot).toBeTruthy();
    });
  });

  // ── RTL ─────────────────────────────────────────────────

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdSideSheet],
        html: `<div dir="rtl"><md-side-sheet open headline="RTL Content"></md-side-sheet></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });
});
