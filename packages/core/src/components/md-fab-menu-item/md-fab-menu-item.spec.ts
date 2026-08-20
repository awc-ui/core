import { newSpecPage } from '@stencil/core/testing';
import { MdFabMenuItem } from './md-fab-menu-item';

describe('md-fab-menu-item', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdFabMenuItem],
      html,
    });
  }

  /* ── Rendering ── */

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-fab-menu-item');
    });

    it('renders icon from prop', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      const icon = page.root?.shadowRoot?.querySelector('.md-fab-menu-item__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('edit');
    });

    it('renders label from prop', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      const label = page.root?.shadowRoot?.querySelector('.md-fab-menu-item__label');
      expect(label).toBeTruthy();
      expect(label?.textContent?.trim()).toBe('Edit');
    });

    it('adds with-icon class when icon is set', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      expect(page.root).toHaveClass('md-fab-menu-item--with-icon');
    });

    it('does not add with-icon class when no icon', async () => {
      const page = await create('<md-fab-menu-item label="Edit"></md-fab-menu-item>');
      expect(page.root).not.toHaveClass('md-fab-menu-item--with-icon');
    });

    it('renders ripple', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
      expect(ripple).toBeTruthy();
    });
  });

  /* ── Accessibility ── */

  describe('accessibility', () => {
    it('has role=menuitem', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      expect(page.root?.getAttribute('role')).toBe('menuitem');
    });

    it('defaults to tabindex=-1 (parent manages roving tabindex)', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('has tabindex=-1 when disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not set aria-disabled when enabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      expect(page.root?.getAttribute('aria-disabled')).toBeNull();
    });
  });

  /* ── Events ── */

  describe('events', () => {
    it('emits mdClick on click', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not emit mdClick when disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  /* ── Keyboard ── */

  describe('keyboard', () => {
    it('emits mdClick on Enter', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdClick on Space', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not emit on Enter when disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  /* ── Disabled state ── */

  describe('disabled', () => {
    it('reflects disabled attribute', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>');
      expect(page.root).toHaveClass('md-fab-menu-item--disabled');
    });

    it('disables ripple when disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" disabled></md-fab-menu-item>');
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
      expect(ripple?.getAttribute('disabled')).not.toBeNull();
    });
  });

  /* ── Parts ── */

  describe('parts', () => {
    it('exposes state-layer part', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes icon part', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
    });

    it('exposes label part', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeTruthy();
    });
  });

  /* ── Slots ── */

  describe('slots', () => {
    it('renders icon slot', async () => {
      const page = await create(`
        <md-fab-menu-item label="Edit">
          <svg slot="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
        </md-fab-menu-item>
      `);
      const slot = page.root?.shadowRoot?.querySelector('slot[name="icon"]');
      expect(slot).toBeTruthy();
    });

    it('renders default slot for label fallback', async () => {
      const page = await create('<md-fab-menu-item icon="edit">Custom Label</md-fab-menu-item>');
      const labelSlot = page.root?.shadowRoot?.querySelector('.md-fab-menu-item__label slot');
      expect(labelSlot).toBeTruthy();
    });
  });

  /* ── Soft-disabled ── */

  describe('soft-disabled', () => {
    it('applies disabled class when soft-disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" soft-disabled></md-fab-menu-item>');
      expect(page.root).toHaveClass('md-fab-menu-item--disabled');
    });

    it('sets aria-disabled when soft-disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" soft-disabled></md-fab-menu-item>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not emit mdClick when soft-disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" soft-disabled></md-fab-menu-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not emit on Enter when soft-disabled', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" soft-disabled></md-fab-menu-item>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  /* ── Slotchange detection ── */

  describe('slotchange detection', () => {
    it('sets up slotchange listener on icon slot', async () => {
      const page = await create('<md-fab-menu-item label="Edit"></md-fab-menu-item>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="icon"]') as HTMLSlotElement;
      expect(slot).toBeTruthy();
    });

    it('preserves externally set tabindex', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit" tabindex="0"></md-fab-menu-item>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });
  });

  /* ── Roving focus visible ── */

  describe('roving focus visible', () => {
    it('adds roving-focus-visible class when rovingFocusVisible is set', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      const root = page.root as HTMLElement & { rovingFocusVisible: boolean };
      root.rovingFocusVisible = true;
      await page.waitForChanges();

      expect(page.root).toHaveClass('md-fab-menu-item--roving-focus-visible');
    });

    it('drops roving-focus-visible when rovingFocusVisible is false', async () => {
      const page = await create('<md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item>');
      const root = page.root as HTMLElement & { rovingFocusVisible: boolean };
      root.rovingFocusVisible = true;
      await page.waitForChanges();
      root.rovingFocusVisible = false;
      await page.waitForChanges();

      expect(page.root).not.toHaveClass('md-fab-menu-item--roving-focus-visible');
    });
  });

  /* ── RTL ── */

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdFabMenuItem],
        html: `<div dir="rtl"><md-fab-menu-item icon="edit" label="Edit"></md-fab-menu-item></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });
});
