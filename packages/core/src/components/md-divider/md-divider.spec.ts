import { newSpecPage } from '@stencil/core/testing';
import { MdDivider } from './md-divider';

describe('md-divider', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdDivider],
      html,
    });
  }

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-divider></md-divider>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-divider');
    });

    it('does not have inset classes by default', async () => {
      const page = await create('<md-divider></md-divider>');
      expect(page.root).not.toHaveClass('md-divider--inset');
      expect(page.root).not.toHaveClass('md-divider--inset-start');
      expect(page.root).not.toHaveClass('md-divider--inset-end');
      expect(page.root).not.toHaveClass('md-divider--vertical');
    });
  });

  describe('props', () => {
    it('applies inset class (middle-inset)', async () => {
      const page = await create('<md-divider inset></md-divider>');
      expect(page.root).toHaveClass('md-divider--inset');
    });

    it('applies inset-start class', async () => {
      const page = await create('<md-divider inset-start></md-divider>');
      expect(page.root).toHaveClass('md-divider--inset-start');
    });

    it('applies inset-end class', async () => {
      const page = await create('<md-divider inset-end></md-divider>');
      expect(page.root).toHaveClass('md-divider--inset-end');
    });

    it('applies vertical class', async () => {
      const page = await create('<md-divider vertical></md-divider>');
      expect(page.root).toHaveClass('md-divider--vertical');
    });

    it('reflects inset prop as attribute', async () => {
      const page = await create('<md-divider inset></md-divider>');
      expect(page.root?.getAttribute('inset')).not.toBeNull();
    });

    it('reflects vertical prop as attribute', async () => {
      const page = await create('<md-divider vertical></md-divider>');
      expect(page.root?.getAttribute('vertical')).not.toBeNull();
    });
  });

  describe('accessibility', () => {
    it('has role=separator', async () => {
      const page = await create('<md-divider></md-divider>');
      expect(page.root?.getAttribute('role')).toBe('separator');
    });

    it('has aria-orientation=horizontal by default', async () => {
      const page = await create('<md-divider></md-divider>');
      expect(page.root?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('has aria-orientation=vertical when vertical', async () => {
      const page = await create('<md-divider vertical></md-divider>');
      expect(page.root?.getAttribute('aria-orientation')).toBe('vertical');
    });
  });

  describe('parts', () => {
    // The part moved off the host onto the painted rule inside the shadow
    // root: insets are margins, and a host margin loses to any page-level
    // `* { margin: 0 }` reset, so the line has to live where the page cannot
    // reach it. `::part(divider)` still targets the rule from outside.
    it('exposes the divider part on the rule inside the shadow root', async () => {
      const page = await create('<md-divider></md-divider>');
      expect(page.root?.getAttribute('part')).toBeNull();
      const line = page.root?.shadowRoot?.querySelector('[part="divider"]');
      expect(line).not.toBeNull();
      expect(line?.classList.contains('md-divider__line')).toBe(true);
    });
  });

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdDivider],
        html: '<div dir="rtl"><md-divider inset-start></md-divider></div>',
      });
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-divider--inset-start');
    });
  });

  describe('custom CSS API', () => {
    it('accepts CSS custom property overrides', async () => {
      const page = await create(
        '<md-divider style="--md-divider-color: red; --md-divider-thickness: 2px;"></md-divider>',
      );
      expect(page.root).toBeTruthy();
    });
  });
});
