import { newSpecPage } from '@stencil/core/testing';
import { MdLoadingIndicator } from './md-loading-indicator';

describe('md-loading-indicator', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdLoadingIndicator],
      html,
    });
  }

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-loading-indicator');
      expect(page.root).toHaveClass('md-loading-indicator--uncontained');
    });

    it('renders the morphing shape element', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      const shape = page.root?.shadowRoot?.querySelector('.md-loading-indicator__shape');
      expect(shape).toBeTruthy();
    });

    it('does not have contained class by default', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root).not.toHaveClass('md-loading-indicator--contained');
    });
  });

  describe('props', () => {
    it('defaults to uncontained variant', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root).toHaveClass('md-loading-indicator--uncontained');
    });

    it('applies contained variant class', async () => {
      const page = await create('<md-loading-indicator variant="contained"></md-loading-indicator>');
      expect(page.root).toHaveClass('md-loading-indicator--contained');
      expect(page.root).not.toHaveClass('md-loading-indicator--uncontained');
    });

    it('reflects variant as attribute', async () => {
      const page = await create('<md-loading-indicator variant="contained"></md-loading-indicator>');
      expect(page.root?.getAttribute('variant')).toBe('contained');
    });

    it('uses default label', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root?.getAttribute('aria-label')).toBe('Loading');
    });

    it('accepts custom label', async () => {
      const page = await create('<md-loading-indicator label="Fetching results"></md-loading-indicator>');
      expect(page.root?.getAttribute('aria-label')).toBe('Fetching results');
    });
  });

  describe('accessibility', () => {
    it('has role=progressbar', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root?.getAttribute('role')).toBe('progressbar');
    });

    it('has aria-label with default text', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root?.getAttribute('aria-label')).toBe('Loading');
    });

    it('has aria-label with custom text', async () => {
      const page = await create('<md-loading-indicator label="Saving changes"></md-loading-indicator>');
      expect(page.root?.getAttribute('aria-label')).toBe('Saving changes');
    });

    it('has aria-live=polite for dynamic announcements', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root?.getAttribute('aria-live')).toBe('polite');
    });

    it('does not set aria-valuenow (indeterminate)', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root?.getAttribute('aria-valuenow')).toBeNull();
    });

    it('does not set aria-valuemin (indeterminate)', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root?.getAttribute('aria-valuemin')).toBeNull();
    });

    it('does not set aria-valuemax (indeterminate)', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root?.getAttribute('aria-valuemax')).toBeNull();
    });

    it('is not focusable by default (no tabindex)', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      expect(page.root?.getAttribute('tabindex')).toBeNull();
    });

    it('renders visually-hidden status text for screen readers', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      const srOnly = page.root?.shadowRoot?.querySelector('.md-loading-indicator__sr-only');
      expect(srOnly).toBeTruthy();
      expect(srOnly?.getAttribute('role')).toBe('status');
      expect(srOnly?.textContent).toBe('Loading');
    });

    it('updates status text when label prop changes', async () => {
      const page = await create('<md-loading-indicator label="Uploading file"></md-loading-indicator>');
      const srOnly = page.root?.shadowRoot?.querySelector('.md-loading-indicator__sr-only');
      expect(srOnly?.textContent).toBe('Uploading file');
    });

    it('hides the decorative shape from assistive technology', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      const shape = page.root?.shadowRoot?.querySelector('.md-loading-indicator__shape');
      expect(shape?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('parts', () => {
    it('exposes shape part', async () => {
      const page = await create('<md-loading-indicator></md-loading-indicator>');
      const shape = page.root?.shadowRoot?.querySelector('[part="shape"]');
      expect(shape).toBeTruthy();
    });
  });

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdLoadingIndicator],
        html: '<div dir="rtl"><md-loading-indicator></md-loading-indicator></div>',
      });
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-loading-indicator');
    });
  });

  describe('custom CSS API', () => {
    it('accepts CSS custom property overrides', async () => {
      const page = await create(
        '<md-loading-indicator style="--md-loading-indicator-color: red; --md-loading-indicator-size: 64px;"></md-loading-indicator>',
      );
      expect(page.root).toBeTruthy();
    });

    it('accepts container custom properties on contained variant', async () => {
      const page = await create(
        '<md-loading-indicator variant="contained" style="--md-loading-indicator-container-color: blue;"></md-loading-indicator>',
      );
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-loading-indicator--contained');
    });
  });
});
