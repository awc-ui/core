import { newSpecPage } from '@stencil/core/testing';
import { MdMenuItemGroup } from './md-menu-item-group';

describe('md-menu-item-group', () => {
  it('renders with defaults', async () => {
    const page = await newSpecPage({
      components: [MdMenuItemGroup],
      html: `<md-menu-item-group></md-menu-item-group>`,
    });
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-menu-item-group')).toBe(true);
  });

  it('renders label when provided', async () => {
    const page = await newSpecPage({
      components: [MdMenuItemGroup],
      html: `<md-menu-item-group label="File"></md-menu-item-group>`,
    });
    const label = page.root?.shadowRoot?.querySelector('.md-menu-item-group__label');
    expect(label?.textContent).toBe('File');
  });

  it('does not render label when empty', async () => {
    const page = await newSpecPage({
      components: [MdMenuItemGroup],
      html: `<md-menu-item-group></md-menu-item-group>`,
    });
    const label = page.root?.shadowRoot?.querySelector('.md-menu-item-group__label');
    expect(label).toBeFalsy();
  });

  it('renders items slot', async () => {
    const page = await newSpecPage({
      components: [MdMenuItemGroup],
      html: `<md-menu-item-group></md-menu-item-group>`,
    });
    const itemsContainer = page.root?.shadowRoot?.querySelector('.md-menu-item-group__items');
    expect(itemsContainer).toBeTruthy();
    const slot = itemsContainer?.querySelector('slot');
    expect(slot).toBeTruthy();
  });

  // ── Accessibility ──

  it('has role="group"', async () => {
    const page = await newSpecPage({
      components: [MdMenuItemGroup],
      html: `<md-menu-item-group label="Actions"></md-menu-item-group>`,
    });
    expect(page.root?.getAttribute('role')).toBe('group');
  });

  it('sets aria-label from label prop', async () => {
    const page = await newSpecPage({
      components: [MdMenuItemGroup],
      html: `<md-menu-item-group label="Edit"></md-menu-item-group>`,
    });
    expect(page.root?.getAttribute('aria-label')).toBe('Edit');
  });

  it('does not set aria-label when no label', async () => {
    const page = await newSpecPage({
      components: [MdMenuItemGroup],
      html: `<md-menu-item-group></md-menu-item-group>`,
    });
    expect(page.root?.getAttribute('aria-label')).toBeNull();
  });

  it('items container has role="presentation"', async () => {
    const page = await newSpecPage({
      components: [MdMenuItemGroup],
      html: `<md-menu-item-group></md-menu-item-group>`,
    });
    const container = page.root?.shadowRoot?.querySelector('.md-menu-item-group__items');
    expect(container?.getAttribute('role')).toBe('presentation');
  });
});
