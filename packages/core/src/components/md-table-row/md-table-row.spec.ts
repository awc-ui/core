import { newSpecPage } from '@stencil/core/testing';
import { MdTableRow } from './md-table-row';

const create = (html: string) =>
  newSpecPage({ components: [MdTableRow], html });

describe('md-table-row', () => {
  describe('rendering', () => {
    it('renders with role=row', async () => {
      const page = await create('<md-table-row></md-table-row>');
      expect(page.root?.getAttribute('role')).toBe('row');
    });

    it('reflects selected', async () => {
      const page = await create('<md-table-row selected></md-table-row>');
      expect(page.root).toHaveClass('md-table-row--selected');
      // aria-selected is NOT rendered by the row itself — md-table stamps it
      // only on selectable body rows of a selection-enabled table (a bare row
      // must not announce "not selected" in read-only tables).
      expect(page.root?.hasAttribute('aria-selected')).toBe(false);
    });

    it('reflects disabled', async () => {
      const page = await create('<md-table-row disabled></md-table-row>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('renders the expanded region when expandable', async () => {
      const page = await create('<md-table-row expandable></md-table-row>');
      const region = page.root?.shadowRoot?.querySelector('.md-table-row__expanded');
      expect(region).toBeTruthy();
      // A row may only own cells/headers in the ARIA table content model —
      // the panel is exposed as a full-width cell (aria-colspan spans all
      // columns); collapsed panels are inert + aria-hidden.
      expect(region?.getAttribute('role')).toBe('cell');
    });

    it('keeps the expanded region in the tree (animatable) but closed + aria-hidden when not expanded', async () => {
      const page = await create('<md-table-row expandable></md-table-row>');
      const region = page.root?.shadowRoot?.querySelector('.md-table-row__expanded');
      expect(region).toBeTruthy();
      expect(region?.classList.contains('md-table-row__expanded--open')).toBe(false);
      expect(region?.getAttribute('aria-hidden')).toBe('true');
    });

    it('marks the expanded region open when expanded', async () => {
      const page = await create('<md-table-row expandable expanded></md-table-row>');
      const region = page.root?.shadowRoot?.querySelector('.md-table-row__expanded');
      expect(region?.classList.contains('md-table-row__expanded--open')).toBe(true);
      expect(region?.hasAttribute('aria-hidden')).toBe(false);
    });
  });

  describe('events', () => {
    it('emits mdRowSelectionChange when selected toggles', async () => {
      const page = await create('<md-table-row value="a"></md-table-row>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRowSelectionChange', spy);
      page.rootInstance.selected = true;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail).toEqual({ selected: true, value: 'a' });
    });

    it('emits mdRowExpandedChange', async () => {
      const page = await create('<md-table-row expandable></md-table-row>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRowExpandedChange', spy);
      page.rootInstance.expanded = true;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('emits mdRowClick on click when clickable', async () => {
      const page = await create('<md-table-row clickable value="x"></md-table-row>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRowClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail.value).toBe('x');
    });

    it('does NOT emit mdRowClick when disabled', async () => {
      const page = await create('<md-table-row clickable disabled></md-table-row>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRowClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('Enter key activates clickable row', async () => {
      const page = await create('<md-table-row clickable></md-table-row>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRowClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('Space key activates clickable row', async () => {
      const page = await create('<md-table-row clickable></md-table-row>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRowClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('methods', () => {
    it('toggle() flips expanded', async () => {
      const page = await create('<md-table-row expandable></md-table-row>');
      await page.rootInstance.toggle();
      expect(page.rootInstance.expanded).toBe(true);
      await page.rootInstance.toggle();
      expect(page.rootInstance.expanded).toBe(false);
    });

    it('toggle() is a no-op when not expandable', async () => {
      const page = await create('<md-table-row></md-table-row>');
      await page.rootInstance.toggle();
      expect(page.rootInstance.expanded).toBe(false);
    });
  });
});
