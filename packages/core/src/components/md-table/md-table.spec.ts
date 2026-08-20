import { newSpecPage } from '@stencil/core/testing';
import { MdTable } from './md-table';
import { MdTableHead } from '../md-table-head/md-table-head';
import { MdTableBody } from '../md-table-body/md-table-body';
import { MdTableRow } from '../md-table-row/md-table-row';
import { MdTableCell } from '../md-table-cell/md-table-cell';

const create = (html: string) =>
  newSpecPage({
    components: [MdTable, MdTableHead, MdTableBody, MdTableRow, MdTableCell],
    html,
  });

describe('md-table', () => {
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-table></md-table>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-table');
      expect(page.root).toHaveClass('md-table--density-standard');
    });

    it('reflects density', async () => {
      const page = await create('<md-table density="compact"></md-table>');
      expect(page.root).toHaveClass('md-table--density-compact');
    });

    it('reflects sticky-header', async () => {
      const page = await create('<md-table sticky-header></md-table>');
      expect(page.root).toHaveClass('md-table--sticky-header');
    });

    it('reflects striped', async () => {
      const page = await create('<md-table striped></md-table>');
      expect(page.root).toHaveClass('md-table--striped');
    });

    it('hoverable defaults to true and class is applied', async () => {
      const page = await create('<md-table></md-table>');
      expect(page.root).toHaveClass('md-table--hoverable');
    });

    it('renders caption when set', async () => {
      const page = await create('<md-table caption="Users"></md-table>');
      const caption = page.root?.shadowRoot?.querySelector('.md-table__caption');
      expect(caption?.textContent).toBe('Users');
    });

    it('renders the loading overlay when loading', async () => {
      const page = await create('<md-table loading></md-table>');
      const overlay = page.root?.shadowRoot?.querySelector('.md-table__loading');
      expect(overlay).toBeTruthy();
    });

    it('renders the empty state when empty', async () => {
      const page = await create('<md-table empty></md-table>');
      const empty = page.root?.shadowRoot?.querySelector('.md-table__empty');
      expect(empty).toBeTruthy();
    });

    it('hides empty state while loading', async () => {
      const page = await create('<md-table empty loading></md-table>');
      expect(page.root?.shadowRoot?.querySelector('.md-table__empty')).toBeFalsy();
    });
  });

  describe('accessibility', () => {
    // role="table" lives on the shadow STRUCTURAL wrapper — the host also
    // carries the caption, live region and overlays, which the table content
    // model forbids as children (axe aria-required-children).
    const tableEl = (page: { root?: HTMLElement | null }) =>
      page.root!.shadowRoot!.querySelector('[role="table"]');

    it('exposes role=table on the structural wrapper (not the host)', async () => {
      const page = await create('<md-table></md-table>');
      expect(page.root?.hasAttribute('role')).toBe(false);
      expect(tableEl(page)).toBeTruthy();
    });

    it('reflects label as aria-label', async () => {
      const page = await create('<md-table label="My Data"></md-table>');
      expect(tableEl(page)?.getAttribute('aria-label')).toBe('My Data');
    });

    it('sets aria-busy when loading', async () => {
      const page = await create('<md-table loading></md-table>');
      expect(tableEl(page)?.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('grid template', () => {
    it('uses repeat() when columns prop is set', async () => {
      const page = await create('<md-table columns="3"></md-table>');
      const style = (page.root as HTMLElement).getAttribute('style') || '';
      expect(style).toContain('--_columns-template');
      expect(style).toContain('repeat(3, minmax(0, 1fr))');
    });

    it('uses column-template verbatim when set', async () => {
      const page = await create('<md-table column-template="auto 1fr 120px"></md-table>');
      const style = (page.root as HTMLElement).getAttribute('style') || '';
      expect(style).toContain('auto 1fr 120px');
    });
  });

  describe('sort coordination', () => {
    it('handles mdSortRequest by toggling asc -> desc -> none', async () => {
      const page = await create('<md-table></md-table>');
      const event = (column: string) =>
        new CustomEvent('mdSortRequest', { detail: { column }, bubbles: true, composed: true });

      page.root?.dispatchEvent(event('name'));
      await page.waitForChanges();
      expect(page.rootInstance.sortBy).toBe('name');
      expect(page.rootInstance.sortOrder).toBe('asc');

      page.root?.dispatchEvent(event('name'));
      await page.waitForChanges();
      expect(page.rootInstance.sortOrder).toBe('desc');

      page.root?.dispatchEvent(event('name'));
      await page.waitForChanges();
      expect(page.rootInstance.sortBy).toBe('');
    });

    it('emits mdSortChange', async () => {
      const page = await create('<md-table></md-table>');
      const spy = jest.fn();
      page.root?.addEventListener('mdSortChange', spy);
      page.root?.dispatchEvent(
        new CustomEvent('mdSortRequest', { detail: { column: 'name' }, bubbles: true, composed: true }),
      );
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0].detail).toEqual({ column: 'name', order: 'asc' });
    });

    it('setSort programmatically changes sort and emits', async () => {
      const page = await create('<md-table></md-table>');
      const spy = jest.fn();
      page.root?.addEventListener('mdSortChange', spy);
      await page.rootInstance.setSort('age', 'desc');
      await page.waitForChanges();
      expect(page.rootInstance.sortBy).toBe('age');
      expect(page.rootInstance.sortOrder).toBe('desc');
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('selection coordination', () => {
    it('emits mdSelectionChange on row selection change', async () => {
      const page = await create(`
        <md-table selection="multiple">
          <md-table-body>
            <md-table-row value="1"></md-table-row>
            <md-table-row value="2"></md-table-row>
          </md-table-body>
        </md-table>
      `);
      const spy = jest.fn();
      page.root?.addEventListener('mdSelectionChange', spy);

      const row = page.root?.querySelector('md-table-row') as HTMLElement & { selected: boolean };
      row.selected = true;
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('selectAll selects all selectable rows', async () => {
      const page = await create(`
        <md-table selection="multiple">
          <md-table-body>
            <md-table-row value="1"></md-table-row>
            <md-table-row value="2"></md-table-row>
            <md-table-row value="3" disabled></md-table-row>
          </md-table-body>
        </md-table>
      `);
      await page.rootInstance.selectAll();
      await page.waitForChanges();
      const rows = Array.from(page.root!.querySelectorAll('md-table-row')) as Array<
        HTMLElement & { selected: boolean }
      >;
      expect(rows[0].selected).toBe(true);
      expect(rows[1].selected).toBe(true);
      // disabled row should NOT be selected
      expect(rows[2].selected).toBe(false);
    });

    it('deselectAll deselects every row', async () => {
      const page = await create(`
        <md-table selection="multiple">
          <md-table-body>
            <md-table-row value="1" selected></md-table-row>
            <md-table-row value="2" selected></md-table-row>
          </md-table-body>
        </md-table>
      `);
      await page.rootInstance.deselectAll();
      await page.waitForChanges();
      const rows = Array.from(page.root!.querySelectorAll('md-table-row')) as Array<
        HTMLElement & { selected: boolean }
      >;
      expect(rows.every((r) => !r.selected)).toBe(true);
    });

    it('single selection mode deselects others', async () => {
      const page = await create(`
        <md-table selection="single">
          <md-table-body>
            <md-table-row value="1" selected></md-table-row>
            <md-table-row value="2"></md-table-row>
          </md-table-body>
        </md-table>
      `);
      const rows = Array.from(page.root!.querySelectorAll('md-table-row')) as Array<
        HTMLElement & { selected: boolean }
      >;

      rows[1].selected = true;
      await page.waitForChanges();
      // single-mode should deselect the previously selected row when another is selected
      expect(rows[1].selected).toBe(true);
      expect(rows[0].selected).toBe(false);
    });

    it('getSelection returns the current snapshot', async () => {
      const page = await create(`
        <md-table selection="multiple">
          <md-table-body>
            <md-table-row value="a" selected></md-table-row>
            <md-table-row value="b"></md-table-row>
          </md-table-body>
        </md-table>
      `);
      const sel = await page.rootInstance.getSelection();
      expect(sel.count).toBe(1);
      expect(sel.values).toEqual(['a']);
      expect(sel.indeterminate).toBe(true);
      expect(sel.all).toBe(false);
    });
  });

  describe('RTL', () => {
    it('renders inside dir=rtl', async () => {
      const page = await newSpecPage({
        components: [MdTable],
        html: '<div dir="rtl"><md-table></md-table></div>',
      });
      expect(page.body.querySelector('md-table')).toBeTruthy();
    });
  });

  describe('selection="single" (radio-like)', () => {
    const SINGLE = `
      <md-table label="t" selection="single" columns="1">
        <md-table-head>
          <md-table-row><md-table-cell head padding="checkbox"><md-checkbox aria-label="Select all"></md-checkbox></md-table-cell></md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row><md-table-cell>a</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>b</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>c</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `;
    type Row = HTMLElement & { selected: boolean };

    it('selecting a second row deselects the first', async () => {
      const page = await create(SINGLE);
      const rows = Array.from(page.body.querySelectorAll('md-table-body md-table-row')) as Row[];
      rows[0].selected = true;
      await page.waitForChanges();
      rows[2].selected = true;
      await page.waitForChanges();
      expect(rows.map((r) => !!r.selected)).toEqual([false, false, true]);
    });

    it('selectAll() is inert (bulk select would violate the invariant)', async () => {
      const page = await create(SINGLE);
      const table = page.root as HTMLMdTableElement;
      await table.selectAll();
      await page.waitForChanges();
      const rows = Array.from(page.body.querySelectorAll('md-table-body md-table-row')) as Row[];
      expect(rows.filter((r) => r.selected).length).toBe(0);
    });

    it('disables + clears the select-all checkbox', async () => {
      const page = await create(SINGLE);
      const rows = Array.from(page.body.querySelectorAll('md-table-body md-table-row')) as Row[];
      rows[1].selected = true;
      await page.waitForChanges();
      const head = page.body.querySelector('md-table-head md-checkbox') as HTMLElement & {
        disabled: boolean;
        checked: boolean;
      };
      expect(head.disabled).toBe(true);
      expect(head.checked).toBeFalsy(); // never set truthy in single mode
    });
  });


  describe('auto-wired selection checkboxes (zero consumer wiring)', () => {
    const UNWIRED = `
      <md-table label="t" selection="multiple" columns="1">
        <md-table-head>
          <md-table-row><md-table-cell head padding="checkbox"><md-checkbox aria-label="Select all"></md-checkbox></md-table-cell></md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row><md-table-cell padding="checkbox"><md-checkbox aria-label="Select a"></md-checkbox></md-table-cell></md-table-row>
          <md-table-row><md-table-cell padding="checkbox"><md-checkbox aria-label="Select b"></md-checkbox></md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `;
    type Row = HTMLElement & { selected: boolean };
    const change = (el: Element, checked: boolean) =>
      el.dispatchEvent(new CustomEvent('mdChange', { detail: { checked }, bubbles: true, composed: true }));

    it('head checkbox mdChange selects/deselects every row with NO handlers', async () => {
      const page = await create(UNWIRED);
      const head = page.body.querySelector('md-table-head md-checkbox')!;
      change(head, true);
      await page.waitForChanges();
      const rows = Array.from(page.body.querySelectorAll('md-table-body md-table-row')) as Row[];
      expect(rows.every((r) => r.selected)).toBe(true);
      change(head, false);
      await page.waitForChanges();
      expect(rows.every((r) => !r.selected)).toBe(true);
    });

    it('row checkbox mdChange selects its row with NO handlers', async () => {
      const page = await create(UNWIRED);
      const rowCb = page.body.querySelectorAll('md-table-body md-checkbox')[1]!;
      change(rowCb, true);
      await page.waitForChanges();
      const rows = Array.from(page.body.querySelectorAll('md-table-body md-table-row')) as Row[];
      expect(rows.map((r) => !!r.selected)).toEqual([false, true]);
    });
  });


  describe('selection mode TRANSITIONS (no re-mount)', () => {
    type Row = HTMLElement & { selected: boolean };
    type Cb = HTMLElement & { disabled: boolean; checked: boolean };
    const WIRED = `
      <md-table label="t" selection="multiple" columns="1">
        <md-table-head>
          <md-table-row><md-table-cell head padding="checkbox"><md-checkbox aria-label="Select all"></md-checkbox></md-table-cell></md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row><md-table-cell>a</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>b</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `;

    it('multiple -> single trims selection to one and disables the select-all box', async () => {
      const page = await create(WIRED);
      const table = page.root as HTMLMdTableElement;
      const rows = Array.from(page.body.querySelectorAll('md-table-body md-table-row')) as Row[];
      rows[0].selected = true;
      rows[1].selected = true;
      await page.waitForChanges();
      table.selection = 'single';
      await page.waitForChanges();
      expect(rows.filter((r) => r.selected).length).toBe(1);
      expect((page.body.querySelector('md-table-head md-checkbox') as Cb).disabled).toBe(true);
    });

    it('single -> multiple re-enables the select-all box (was permanently dead)', async () => {
      const page = await create(WIRED.replace('selection="multiple"', 'selection="single"'));
      const table = page.root as HTMLMdTableElement;
      await page.waitForChanges();
      const head = page.body.querySelector('md-table-head md-checkbox') as Cb;
      // trigger a sync so single-mode disables it (as a real session would)
      (page.body.querySelector('md-table-body md-table-row') as Row).selected = true;
      await page.waitForChanges();
      expect(head.disabled).toBe(true);
      table.selection = 'multiple';
      await page.waitForChanges();
      expect(head.disabled).toBe(false);
      // and the auto-wire selects all rows again
      head.dispatchEvent(new CustomEvent('mdChange', { detail: { checked: true }, bubbles: true, composed: true }));
      await page.waitForChanges();
      const rows = Array.from(page.body.querySelectorAll('md-table-body md-table-row')) as Row[];
      expect(rows.every((r) => r.selected)).toBe(true);
    });

    it('ENTERING single disables the select-all box immediately (no event needed)', async () => {
      const page = await create(WIRED);
      const table = page.root as HTMLMdTableElement;
      table.selection = 'single';
      await page.waitForChanges();
      expect((page.body.querySelector('md-table-head md-checkbox') as Cb).disabled).toBe(true);
    });
  });


  it('pin-icon casts to pinned header cells; author-set values win', async () => {
    const page = await create(`
      <md-table label="t" pin-icon="anchor" columns="3">
        <md-table-head>
          <md-table-row>
            <md-table-cell head sticky="start">A</md-table-cell>
            <md-table-cell head sticky="end" pin-icon="star">B</md-table-cell>
            <md-table-cell head>C</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body><md-table-row><md-table-cell>1</md-table-cell><md-table-cell>2</md-table-cell><md-table-cell>3</md-table-cell></md-table-row></md-table-body>
      </md-table>
    `);
    const cells = page.body.querySelectorAll('md-table-head md-table-cell');
    expect(cells[0].getAttribute('pin-icon')).toBe('anchor'); // cast
    expect(cells[1].getAttribute('pin-icon')).toBe('star'); // author override kept
    expect(cells[2].hasAttribute('pin-icon')).toBe(false); // not pinned
    // clearing the table prop removes only OUR cast
    (page.root as HTMLMdTableElement).pinIcon = '';
    await page.waitForChanges();
    expect(cells[0].hasAttribute('pin-icon')).toBe(false);
    expect(cells[1].getAttribute('pin-icon')).toBe('star');
  });

});
