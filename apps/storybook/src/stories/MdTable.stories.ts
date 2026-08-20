import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';
import { flipRows, captureFlip } from '@awc-ui/core';

// ---------------------------------------------------------------------------
// play() shadow-piercing helpers — testing-library can't cross shadow roots,
// so interactions address the real internals directly. Used by the play
// functions on Sortable / Selectable / Pagination / ExpandableRows below.
// ---------------------------------------------------------------------------
type MdSelectionDetail = {
  count: number;
  total: number;
  values: string[];
  all: boolean;
  indeterminate: boolean;
};
/** Resolve once an element has hydrated — pre-hydration clicks are silent
 *  no-ops in Stencil, so every driven element is gated on this first. */
const whenHydrated = async <T extends Element>(el: T): Promise<T> => {
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  return el;
};
const getTable = (canvasElement: HTMLElement) =>
  whenHydrated(canvasElement.querySelector('md-table') as HTMLElement);
const bodyRows = (root: ParentNode) =>
  Array.from(root.querySelectorAll('md-table-body md-table-row')) as HTMLElement[];
const visibleRows = (root: ParentNode) =>
  bodyRows(root).filter((r) => r.style.display !== 'none');
const firstCellText = (row: Element | null | undefined) =>
  (row?.querySelector('md-table-cell')?.textContent || '').trim();

const meta: Meta = {
  title: 'Data Display/Table',
  component: 'md-table',
  tags: ['autodocs'],
  parameters: {
    // Full-width (block) root, not the global 'centered' — a centered root is
    // shrink-to-fit, which collapses scrollable/frozen-header tables (they have
    // 0 intrinsic width). Real apps place tables in definite-width parents.
    layout: 'padded',
    docs: {
      description: {
        component: `
A **Material Design 3 Expressive** data-table system. Composable atoms
('md-table-container', 'md-table', 'md-table-head/body/foot', 'md-table-row',
'md-table-cell', 'md-table-sort-label', 'md-table-pagination', 'md-table-toolbar')
that snap together to cover everything from a tiny dense table to an
ag-grid-class data grid.

**Architecture highlights**

* CSS Grid layout (single \`grid-template-columns\` controls all rows)
* Sticky headers + sticky columns out of the box
* Density: \`compact | standard | comfortable\`
* Built-in **sort** coordination (\`md-table-sort-label\` -> \`md-table\`)
* Built-in **selection** coordination (single / multiple)
* MD3 **expressive motion** on sort, selection, expand, toolbar, pagination
* **Horizontal scroll** when the content is wider than the container (never squishes columns)
* Loading + empty-state slots
* WAI-ARIA roles, keyboard activation, RTL via logical properties
        `,
      },
      source: { language: 'html' },
    },
  },
  argTypes: {
    density: { control: 'select', options: ['compact', 'standard', 'comfortable'] },
    scrollbar: { control: 'inline-radio', options: ['overlay', 'gutter'] },
    pinMode: { control: 'inline-radio', options: ['stack', 'static'], name: 'pin-mode' },
    stickyHeader: { control: 'boolean', name: 'sticky-header' },
    striped: { control: 'boolean' },
    hoverable: { control: 'boolean' },
    selection: { control: 'select', options: ['none', 'single', 'multiple'] },
    label: { control: 'text' },
    elevation: { control: { type: 'range', min: 0, max: 5, step: 1 }, name: 'container elevation' },
  },
  args: {
    density: 'standard',
    scrollbar: 'overlay',
    pinMode: 'stack',
    stickyHeader: false,
    striped: false,
    hoverable: true,
    selection: 'none',
    label: 'Users',
    elevation: 1,
  },
};
export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const PEOPLE = [
  { id: '1', name: 'Ada Lovelace', role: 'Mathematician', team: 'Engineering', salary: 120000, joined: '2024-01-12', location: 'London', level: 'Principal', projects: 12, manager: 'Charles Babbage', rating: 4.9 },
  { id: '2', name: 'Alan Turing', role: 'Cryptanalyst', team: 'Security', salary: 145000, joined: '2023-08-19', location: 'Manchester', level: 'Staff', projects: 9, manager: 'Max Newman', rating: 4.8 },
  { id: '3', name: 'Grace Hopper', role: 'Compiler Engineer', team: 'Platform', salary: 132000, joined: '2024-03-04', location: 'New York', level: 'Senior', projects: 7, manager: 'Howard Aiken', rating: 4.7 },
  { id: '4', name: 'Linus Torvalds', role: 'Kernel Engineer', team: 'Infrastructure', salary: 168000, joined: '2022-12-01', location: 'Portland', level: 'Principal', projects: 15, manager: 'Andrew Morton', rating: 4.6 },
  { id: '5', name: 'Margaret Hamilton', role: 'Software Lead', team: 'Avionics', salary: 175000, joined: '2023-05-22', location: 'Boston', level: 'Lead', projects: 11, manager: 'Charles Draper', rating: 4.9 },
  { id: '6', name: 'Donald Knuth', role: 'Author / Researcher', team: 'Research', salary: 195000, joined: '2024-04-30', location: 'Stanford', level: 'Principal', projects: 20, manager: 'George Forsythe', rating: 5.0 },
  { id: '7', name: 'Barbara Liskov', role: 'Programming Language Designer', team: 'Research', salary: 188000, joined: '2023-11-15', location: 'Cambridge', level: 'Staff', projects: 8, manager: 'John McCarthy', rating: 4.8 },
  { id: '8', name: 'Tim Berners-Lee', role: 'Web Architect', team: 'Web', salary: 205000, joined: '2024-02-18', location: 'Geneva', level: 'Principal', projects: 14, manager: 'Mike Sendall', rating: 4.7 },
  { id: '9', name: 'Edsger Dijkstra', role: 'Algorithm Researcher', team: 'Research', salary: 178000, joined: '2023-07-04', location: 'Austin', level: 'Senior', projects: 6, manager: 'Adriaan van Wijngaarden', rating: 4.5 },
  { id: '10', name: 'John von Neumann', role: 'Architecture Lead', team: 'Hardware', salary: 220000, joined: '2024-06-01', location: 'Princeton', level: 'Principal', projects: 18, manager: 'Oswald Veblen', rating: 5.0 },
];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// Minimal client-side sort for showcase stories: reorder the body's rows by a
// cell's text (rows carry data-idx for the 'none' restore). The table's
// built-in motion="expressive" bracketing makes the reorder glide — the story
// only mutates.
const sortRowsByCell = (bodyId: string, cellIdx: number, order: string) => {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const rows = Array.from(body.querySelectorAll('md-table-row')) as HTMLElement[];
  rows.sort((a, b) => {
    if (order === 'none') return Number(a.dataset.idx) - Number(b.dataset.idx);
    const av = (a.querySelectorAll('md-table-cell')[cellIdx]?.textContent || '').trim();
    const bv = (b.querySelectorAll('md-table-cell')[cellIdx]?.textContent || '').trim();
    return order === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
  });
  rows.forEach((r) => body.appendChild(r));
};

const labelStyle =
  'font: 500 11px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;';

// =====================================================================
// PLAYGROUND
// =====================================================================
export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-table-container variant="elevated" elevation=${args.elevation} max-height="480px">
      <md-table
        frozen-header
        scrollbar=${args.scrollbar}
        pin-mode=${args.pinMode}
        density=${args.density}
        ?sticky-header=${args.stickyHeader}
        ?striped=${args.striped}
        ?hoverable=${args.hoverable}
        selection=${args.selection}
        label=${args.label}
        column-template=${args.selection !== 'none'
          ? 'auto 1.5fr 1fr 1fr auto auto'
          : '1.5fr 1fr 1fr auto auto'}
      >
        <md-table-head>
          <md-table-row>
            ${args.selection !== 'none'
              ? html`<md-table-cell head padding="checkbox">
                  <md-checkbox aria-label="Select all"></md-checkbox>
                </md-table-cell>`
              : ''}
            <md-table-cell head scope="col">${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell head scope="col">${t(globals.locale, 'table.role')}</md-table-cell>
            <md-table-cell head scope="col">${t(globals.locale, 'table.team')}</md-table-cell>
            <md-table-cell head scope="col" numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
            <md-table-cell head scope="col">${t(globals.locale, 'table.joined')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          ${PEOPLE.map(
            (p) => html`
              <md-table-row value=${p.id}>
                ${args.selection !== 'none'
                  ? html`<md-table-cell padding="checkbox">
                      <md-checkbox aria-label=${`Select ${p.name}`}></md-checkbox>
                    </md-table-cell>`
                  : ''}
                <md-table-cell>${p.name}</md-table-cell>
                <md-table-cell>${p.role}</md-table-cell>
                <md-table-cell>${p.team}</md-table-cell>
                <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                <md-table-cell>${p.joined}</md-table-cell>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
};

// =====================================================================
// BASIC
// =====================================================================
export const Basic: Story = {
  render: (_args, { globals }) => html`
    <md-table-container>
      <md-table caption="${t(globals.locale, 'table.commonCurrencies')}" column-template="auto 1fr auto">
        <md-table-head>
          <md-table-row>
            <md-table-cell head scope="col">${t(globals.locale, 'table.code')}</md-table-cell>
            <md-table-cell head scope="col">${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell head scope="col" numeric>${t(globals.locale, 'table.rate')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row>
            <md-table-cell head scope="row">USD</md-table-cell>
            <md-table-cell>US Dollar</md-table-cell>
            <md-table-cell numeric>1.000</md-table-cell>
          </md-table-row>
          <md-table-row>
            <md-table-cell head scope="row">EUR</md-table-cell>
            <md-table-cell>Euro</md-table-cell>
            <md-table-cell numeric>0.918</md-table-cell>
          </md-table-row>
          <md-table-row>
            <md-table-cell head scope="row">JPY</md-table-cell>
            <md-table-cell>Japanese Yen</md-table-cell>
            <md-table-cell numeric>156.42</md-table-cell>
          </md-table-row>
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
};

// =====================================================================
// SORTABLE
// =====================================================================
export const Sortable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Use `<md-table-sort-label>` inside any header cell. The parent `<md-table>` listens to `mdSortRequest` and updates `sort-by` / `sort-order` automatically. Subscribe to `mdSortChange` to apply the sort to your data.',
      },
    },
  },
  render: (_args, { globals }) => {
    const COLS = ['name', 'role', 'team', 'salary'];
    // Reorder the actual row elements on sort (order 'none' restores the
    // original order via the stamped data-idx). Rows are never rebuilt.
    const applySort = (column: string, order: string) => {
      const body = document.getElementById('sortable-body');
      if (!body) return;
      const rows = Array.from(body.querySelectorAll('md-table-row')) as HTMLElement[];
      const col = COLS.indexOf(column);
      const numeric = column === 'salary';
      rows.sort((a, b) => {
        if (order === 'none' || col < 0) {
          return Number(a.dataset.idx) - Number(b.dataset.idx);
        }
        const av = (a.children[col]?.textContent || '').trim();
        const bv = (b.children[col]?.textContent || '').trim();
        const cmp = numeric
          ? parseFloat(av.replace(/[^0-9.-]/g, '')) - parseFloat(bv.replace(/[^0-9.-]/g, ''))
          : av.localeCompare(bv);
        return order === 'desc' ? -cmp : cmp;
      });
      rows.forEach((r) => body.appendChild(r));
    };
    return html`
      <md-table-container>
        <md-table
          label="Employees"
          column-template="1.5fr 1fr 1fr auto"
          @mdSortChange=${(e: CustomEvent<{ column: string; order: string }>) =>
            applySort(e.detail.column, e.detail.order)}
        >
          <md-table-head>
            <md-table-row>
              <md-table-cell head>
                <md-table-sort-label column="name">${t(globals.locale, 'table.name')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head>
                <md-table-sort-label column="role">${t(globals.locale, 'table.role')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head>
                <md-table-sort-label column="team">${t(globals.locale, 'table.team')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head numeric>
                <md-table-sort-label column="salary">${t(globals.locale, 'table.salary')}</md-table-sort-label>
              </md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body id="sortable-body">
            ${PEOPLE.slice(0, 6).map(
              (p, i) => html`
                <md-table-row data-idx=${i}>
                  <md-table-cell>${p.name}</md-table-cell>
                  <md-table-cell>${p.role}</md-table-cell>
                  <md-table-cell>${p.team}</md-table-cell>
                  <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>
      </md-table-container>
    `;
  },
  /** Clicking a sort header cycles asc → desc, reorders the rows, and stamps
   *  aria-sort on the columnheader — asserted as live transitions + payload. */
  play: async ({ canvasElement, step }) => {
    const table = await getTable(canvasElement);
    const teamLabel = await whenHydrated(
      table.querySelector('md-table-sort-label[column="team"]') as HTMLElement,
    );
    const teamCell = teamLabel.closest('md-table-cell') as HTMLElement;
    const firstName = () => firstCellText(table.querySelector('#sortable-body md-table-row'));

    await step('Sortable column starts unsorted (aria-sort="none")', async () => {
      await waitFor(() => expect(teamCell.getAttribute('aria-sort')).toBe('none'));
      expect(firstName()).toBe('Ada Lovelace'); // original data order
      expect(teamLabel.hasAttribute('active')).toBe(false);
    });

    await step('Click sorts ascending — rows reorder + aria-sort flips', async () => {
      const before = firstName();
      let detail: { column: string; order: string } | undefined;
      table.addEventListener(
        'mdSortChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      teamLabel.click();
      await waitFor(() => expect(firstName()).not.toBe(before)); // proves the rows MOVED
      expect(firstName()).toBe('Margaret Hamilton'); // "Avionics" sorts first
      expect(detail).toEqual({ column: 'team', order: 'asc' }); // the component fired it
      await waitFor(() => {
        expect(teamCell.getAttribute('aria-sort')).toBe('ascending');
        expect(teamLabel.getAttribute('order')).toBe('asc');
      });
    });

    await step('Second click toggles to descending — order + rows invert', async () => {
      const before = firstName(); // 'Margaret Hamilton'
      let detail: { column: string; order: string } | undefined;
      table.addEventListener(
        'mdSortChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      teamLabel.click();
      await waitFor(() => expect(firstName()).not.toBe(before));
      expect(firstName()).toBe('Alan Turing'); // "Security" sorts last asc → first desc
      expect(detail).toEqual({ column: 'team', order: 'desc' });
      await waitFor(() => expect(teamCell.getAttribute('aria-sort')).toBe('descending'));
      // Let the expressive row-FLIP settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('setSort() drives the sort programmatically (name asc)', async () => {
      const nameLabel = await whenHydrated(
        table.querySelector('md-table-sort-label[column="name"]') as HTMLElement,
      );
      let detail: { column: string; order: string } | undefined;
      table.addEventListener(
        'mdSortChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      // The public @Method sets sort-by/sort-order AND emits mdSortChange, which
      // this story's handler applies — so the rows physically re-sort by name.
      await (table as unknown as { setSort: (c: string, o: string) => Promise<void> }).setSort(
        'name',
        'asc',
      );
      expect(detail).toEqual({ column: 'name', order: 'asc' }); // the method emitted it
      await waitFor(() => expect(table.getAttribute('sort-by')).toBe('name')); // reflected prop
      expect(table.getAttribute('sort-order')).toBe('asc');
      await waitFor(() => expect(firstName()).toBe('Ada Lovelace')); // rows re-sorted by name
      // The sort labels track the new active column: name active, team cleared.
      await waitFor(() => expect(nameLabel.getAttribute('order')).toBe('asc'));
      await waitFor(() => expect(teamCell.getAttribute('aria-sort')).toBe('none'));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

// =====================================================================
// SELECTABLE (multiple)
// =====================================================================
export const Selectable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Set `selection="multiple"` and listen to `mdSelectionChange` on `<md-table>`. The toolbar can use `auto-bind` to follow the selection automatically and switch to "selection mode" UI.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <md-table-container>
      <md-table-toolbar
        slot="top"
        headline="${t(globals.locale, 'table.employees')}"
        supporting-text="${t(globals.locale, 'table.manageTeam')}"
        auto-bind
      >
        <md-icon-button slot="actions" icon="filter_list" aria-label="Filter"></md-icon-button>
        <md-icon-button slot="actions" icon="more_vert" aria-label="More"></md-icon-button>

        <md-icon-button slot="selection-actions" icon="delete" aria-label="Delete"></md-icon-button>
        <md-icon-button slot="selection-actions" icon="archive" aria-label="Archive"></md-icon-button>
      </md-table-toolbar>

      <md-table
        selection="multiple"
        label="Employees"
        column-template="auto 1.5fr 1fr 1fr auto"
      >
        <md-table-head>
          <md-table-row>
            <md-table-cell head padding="checkbox">
              <md-checkbox
                id="select-all"
                aria-label="Select all"
                @mdChange=${(e: CustomEvent) => {
                  const tbl = (e.target as HTMLElement).closest('md-table-container')?.querySelector('md-table') as any;
                  void tbl?.toggleSelectAll();
                }}
              ></md-checkbox>
            </md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
            <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          ${PEOPLE.slice(0, 6).map(
            (p) => html`
              <md-table-row value=${p.id}>
                <md-table-cell padding="checkbox">
                  <md-checkbox
                    aria-label=${`Select ${p.name}`}
                    @mdChange=${(e: CustomEvent) => {
                      const checked = (e.detail as { checked: boolean }).checked;
                      const row = (e.target as HTMLElement).closest('md-table-row') as any;
                      if (row) row.selected = checked;
                    }}
                  ></md-checkbox>
                </md-table-cell>
                <md-table-cell>${p.name}</md-table-cell>
                <md-table-cell>${p.role}</md-table-cell>
                <md-table-cell>${p.team}</md-table-cell>
                <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
  /** A row checkbox selects its row and the table tallies it; the header box
   *  drives select-all — every assertion reads the emitted mdSelectionChange
   *  payload or the stamped aria-selected, never a value the play set. */
  play: async ({ canvasElement, step }) => {
    const table = await getTable(canvasElement);
    const rows = bodyRows(table);
    const headCb = await whenHydrated(
      table.querySelector('md-table-head md-checkbox') as HTMLElement,
    );
    const numSelected = () =>
      table.querySelectorAll('md-table-body md-table-row[aria-selected="true"]').length;

    await step('Selection is on, nothing selected yet', async () => {
      await waitFor(() =>
        expect(rows.every((r) => r.getAttribute('aria-selected') === 'false')).toBe(true),
      );
      expect(numSelected()).toBe(0);
    });

    let rowValue = '';
    await step('Checking a row selects it → count 1, header box goes mixed', async () => {
      const targetRow = rows[2]; // Grace Hopper
      rowValue = targetRow.getAttribute('value') || '';
      const cb = await whenHydrated(targetRow.querySelector('md-checkbox') as HTMLElement);
      let detail: MdSelectionDetail | undefined;
      table.addEventListener(
        'mdSelectionChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      cb.click();
      await waitFor(() => expect(detail?.count).toBe(1)); // the table emitted the tally
      expect(detail?.values).toEqual([rowValue]); // that exact row's value
      expect(detail?.indeterminate).toBe(true);
      expect(detail?.all).toBe(false);
      await waitFor(() => expect(targetRow.getAttribute('aria-selected')).toBe('true'));
      expect(numSelected()).toBe(1);
      // A partial selection puts the select-all checkbox into the mixed state.
      await waitFor(() => expect(headCb.getAttribute('aria-checked')).toBe('mixed'));
    });

    await step('Header box selects every row (all=true)', async () => {
      let detail: MdSelectionDetail | undefined;
      table.addEventListener(
        'mdSelectionChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      headCb.click();
      await waitFor(() => expect(detail?.all).toBe(true));
      expect(detail?.count).toBe(rows.length); // grew from 1 → all
      expect(detail?.indeterminate).toBe(false);
      await waitFor(() => expect(numSelected()).toBe(rows.length));
      await waitFor(() => expect(headCb.getAttribute('aria-checked')).toBe('true'));
    });

    await step('Header box again clears the whole selection (guard)', async () => {
      let detail: MdSelectionDetail | undefined;
      table.addEventListener(
        'mdSelectionChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      headCb.click();
      await waitFor(() => expect(detail?.count).toBe(0));
      expect(detail?.all).toBe(false);
      await waitFor(() => expect(numSelected()).toBe(0));
      // Let the toolbar's auto-bind mode fade settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });

    const api = table as unknown as {
      selectAll: () => Promise<void>;
      deselectAll: () => Promise<void>;
      getSelection: () => Promise<MdSelectionDetail>;
      selection: string;
    };

    await step('selectAll() + getSelection() report the whole selection', async () => {
      await api.selectAll();
      const snap = await api.getSelection(); // synchronous snapshot from the component
      expect(snap.all).toBe(true);
      expect(snap.count).toBe(rows.length); // every row selected
      expect(snap.values.length).toBe(rows.length);
      await waitFor(() => expect(numSelected()).toBe(rows.length)); // aria mirrors the model
    });

    await step('Switching to selection="single" trims to one selected row', async () => {
      let detail: MdSelectionDetail | undefined;
      table.addEventListener(
        'mdSelectionChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      api.selection = 'single'; // radio-like: keep the first, deselect the rest
      await waitFor(() => expect(detail?.count).toBe(1)); // the trim emitted a change
      await waitFor(() => expect(numSelected()).toBe(1));
      // The select-all checkbox is inert (disabled) in single mode.
      await waitFor(() =>
        expect((headCb as unknown as { disabled: boolean }).disabled).toBe(true),
      );
    });

    await step('In single mode selecting another row deselects the previous one', async () => {
      const targetRow = rows[4];
      const cb = await whenHydrated(targetRow.querySelector('md-checkbox') as HTMLElement);
      let detail: MdSelectionDetail | undefined;
      table.addEventListener(
        'mdSelectionChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      cb.click();
      await waitFor(() => expect(detail?.count).toBe(1)); // still exactly one
      await waitFor(() => expect(targetRow.getAttribute('aria-selected')).toBe('true'));
      await waitFor(() => expect(numSelected()).toBe(1)); // the earlier row was cleared
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

// =====================================================================
// PAGINATION
// =====================================================================
export const Pagination: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Client pagination wired to the table: all rows are rendered once and the pagination shows only the current page by toggling row visibility, so changing the page OR rows-per-page re-slices the table (and selection would survive, since rows are never rebuilt). The rows-per-page select width is set via `--md-table-pagination-select-width`.',
      },
    },
  },
  render: (_args, { globals }) => {
    let page = 0;
    let rowsPerPage = 5;

    // Paginate by showing only the current page's rows (never rebuild them).
    const renderPage = () => {
      const rows = Array.from(document.querySelectorAll('#pag-body md-table-row')) as HTMLElement[];
      const start = page * rowsPerPage;
      const end = start + rowsPerPage;
      rows.forEach((r, i) => {
        r.style.display = i >= start && i < end ? '' : 'none';
      });
      // WAI/ARIA pagination positions: row-offset + row-count let the table
      // stamp aria-rowindex so AT reports "row 7 of 10", not "row 2 of 5".
      document.querySelector('#pag-table')?.setAttribute('row-offset', String(start));
    };
    requestAnimationFrame(renderPage); // initial slice once rows are in the DOM

    return html`
      <!-- Capped at exactly 5 body rows (5 x 53px; the frozen-header semantic
           hands max-height to the BODY scroll area): at rows-per-page=5
           everything fits with no scrollbar; at 10/25 the body scrolls
           internally behind the frozen header with the persistent classic
           gutter bar. The table height NEVER changes, so no outer scrollbar
           can ever flash — macOS auto-hides overlay bars, which otherwise
           reads as "a scrollbar appears then disappears" whenever the page
           grows past the viewport. -->
      <md-table-container max-height="265px">
        <md-table
          id="pag-table"
          frozen-header
          label="Employees"
          row-count="10"
          column-template="1.5fr 1fr 1fr auto"
        >
          <md-table-head>
            <md-table-row>
              <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
              <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body id="pag-body">
            ${PEOPLE.map(
              (p) => html`
                <md-table-row>
                  <md-table-cell>${p.name}</md-table-cell>
                  <md-table-cell>${p.role}</md-table-cell>
                  <md-table-cell>${p.team}</md-table-cell>
                  <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>

        <md-table-pagination
          slot="bottom"
          count=${PEOPLE.length}
          rows-per-page="5"
          rows-per-page-options="5,10,25,50"
          show-first-last
          @mdPageChange=${(e: CustomEvent<{ page: number }>) => {
            page = e.detail.page;
            renderPage();
          }}
          @mdRowsPerPageChange=${(e: CustomEvent<{ rowsPerPage: number }>) => {
            rowsPerPage = e.detail.rowsPerPage;
            page = 0;
            renderPage();
          }}
        ></md-table-pagination>
      </md-table-container>
    `;
  },
  /** The Next control turns the page: the visible row slice, the range label,
   *  and row-offset all move together, proven as before→after transitions. */
  play: async ({ canvasElement, step }) => {
    const table = await getTable(canvasElement);
    const pag = await whenHydrated(
      canvasElement.querySelector('md-table-pagination') as HTMLElement,
    );
    const label = () => (pag.shadowRoot!.querySelector('[part="display"]')?.textContent || '').trim();
    const firstVisibleName = () => firstCellText(visibleRows(table)[0]);
    const nextBtn = () => pag.shadowRoot!.querySelector('[part="next-button"]') as HTMLElement;

    await step('First page shows the first five rows', async () => {
      await waitFor(() => expect(visibleRows(table).length).toBe(5));
      expect(firstVisibleName()).toBe('Ada Lovelace');
      await waitFor(() => expect(label()).toBe('1–5 of 10'));
      await waitFor(() => expect(table.getAttribute('row-offset')).toBe('0'));
    });

    await step('Next turns the page — slice, label + offset all advance', async () => {
      const before = firstVisibleName();
      let detail: { page: number } | undefined;
      pag.addEventListener(
        'mdPageChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      nextBtn().click();
      await waitFor(() => expect(firstVisibleName()).not.toBe(before)); // the page turned
      expect(firstVisibleName()).toBe('Donald Knuth'); // row 6 leads page 2
      expect(detail?.page).toBe(1); // component emitted the new page
      await waitFor(() => expect(label()).toBe('6–10 of 10'));
      await waitFor(() => expect(table.getAttribute('row-offset')).toBe('5'));
    });

    await step('On the last page Next is disabled and inert (guard)', async () => {
      await waitFor(() => expect(nextBtn().hasAttribute('disabled')).toBe(true));
      const before = firstVisibleName();
      let fired = false;
      pag.addEventListener('mdPageChange', () => (fired = true), { once: true });
      nextBtn().click(); // clamped — there is no page past the last
      expect(firstVisibleName()).toBe(before);
      expect(fired).toBe(false);
      await new Promise((r) => setTimeout(r, 300)); // let the page-turn FLIP settle
    });
  },
};

// =====================================================================
// DENSITY
// =====================================================================
export const DensityCompact: Story = {
  name: 'Density: compact',
  render: (_args, { globals }) => html`
    <md-table-container>
      <md-table label="Compact" density="compact" column-template="1fr 1fr 1fr">
        <md-table-head>
          <md-table-row>
            <md-table-cell head>${t(globals.locale, 'table.sym')}</md-table-cell>
            <md-table-cell head numeric>${t(globals.locale, 'table.bid')}</md-table-cell>
            <md-table-cell head numeric>${t(globals.locale, 'table.ask')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          ${['BTC', 'ETH', 'SOL', 'ADA', 'MATIC', 'DOT', 'XRP', 'LINK'].map(
            (s) => html`
              <md-table-row>
                <md-table-cell>${s}</md-table-cell>
                <md-table-cell numeric>${(Math.random() * 1000).toFixed(2)}</md-table-cell>
                <md-table-cell numeric>${(Math.random() * 1000).toFixed(2)}</md-table-cell>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
};

export const DensityComfortable: Story = {
  name: 'Density: comfortable',
  render: (_args, { globals }) => html`
    <md-table-container>
      <md-table label="Comfortable" density="comfortable" column-template="1.5fr 1fr 1fr">
        <md-table-head>
          <md-table-row>
            <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          ${PEOPLE.slice(0, 4).map(
            (p) => html`
              <md-table-row>
                <md-table-cell>${p.name}</md-table-cell>
                <md-table-cell>${p.role}</md-table-cell>
                <md-table-cell>${p.team}</md-table-cell>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
};

// =====================================================================
// EXPRESSIVE MOTION (sort + select + expand)
// =====================================================================
export const ExpressiveMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'MD3 expressive motion: sort arrow rotates with emphasized easing, toolbar fades to selection mode, expandable rows slide in.',
      },
    },
  },
  render: (_args, { globals }) => {
    // Sort really reorders the rows here (not just the arrow) — the core
    // motion="expressive" bracketing makes them glide with zero extra wiring.
    const EM_COL_IDX: Record<string, number> = { name: 1, team: 2, salary: 3 };
    const applySort = (column: string, order: string) => {
      const body = document.getElementById('em-body');
      if (!body) return;
      const rows = Array.from(body.querySelectorAll('md-table-row')) as HTMLElement[];
      rows.sort((a, b) => {
        if (order === 'none' || !column) return Number(a.dataset.idx) - Number(b.dataset.idx);
        const idx = EM_COL_IDX[column];
        const av = (a.querySelectorAll('md-table-cell')[idx]?.textContent || '').trim();
        const bv = (b.querySelectorAll('md-table-cell')[idx]?.textContent || '').trim();
        const cmp =
          column === 'salary'
            ? parseFloat(av.replace(/[^0-9.-]/g, '')) - parseFloat(bv.replace(/[^0-9.-]/g, ''))
            : av.localeCompare(bv);
        return order === 'desc' ? -cmp : cmp;
      });
      rows.forEach((r) => body.appendChild(r));
    };
    return html`
    <md-table-container>
      <md-table-toolbar slot="top" headline="${t(globals.locale, 'table.motionDemo')}" auto-bind>
        <md-icon-button slot="actions" icon="info" aria-label="Info"></md-icon-button>
        <md-icon-button slot="selection-actions" icon="delete" aria-label="Delete"></md-icon-button>
      </md-table-toolbar>

      <md-table
        selection="multiple"
        column-template="auto 1.5fr 1fr 1fr auto"
        @mdSortChange=${(e: CustomEvent<{ column: string; order: string }>) =>
          applySort(e.detail.column, e.detail.order)}
      >
        <md-table-head>
          <md-table-row>
            <md-table-cell head padding="checkbox">
              <md-checkbox
                aria-label="Select all"
                @mdChange=${(e: CustomEvent) => {
                  const t = (e.target as HTMLElement).closest('md-table-container')?.querySelector('md-table') as any;
                  void t?.toggleSelectAll();
                }}
              ></md-checkbox>
            </md-table-cell>
            <md-table-cell head>
              <md-table-sort-label column="name">${t(globals.locale, 'table.name')}</md-table-sort-label>
            </md-table-cell>
            <md-table-cell head>
              <md-table-sort-label column="team">${t(globals.locale, 'table.team')}</md-table-sort-label>
            </md-table-cell>
            <md-table-cell head numeric>
              <md-table-sort-label column="salary">${t(globals.locale, 'table.salary')}</md-table-sort-label>
            </md-table-cell>
            <md-table-cell head><span style="position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;">Row details</span></md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body id="em-body">
          ${PEOPLE.slice(0, 5).map(
            (p, i) => html`
              <md-table-row expandable value=${p.id} data-idx=${i}>
                <md-table-cell padding="checkbox">
                  <md-checkbox
                    aria-label=${`Select ${p.name}`}
                    @mdChange=${(e: CustomEvent) => {
                      const checked = (e.detail as { checked: boolean }).checked;
                      const row = (e.target as HTMLElement).closest('md-table-row') as any;
                      if (row) row.selected = checked;
                    }}
                  ></md-checkbox>
                </md-table-cell>
                <md-table-cell>${p.name}</md-table-cell>
                <md-table-cell>${p.team}</md-table-cell>
                <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                <md-table-cell align="center">
                  <md-table-expand-toggle button-label="Expand details for ${p.name}"></md-table-expand-toggle>
                </md-table-cell>
                <div slot="expanded">
                  <strong>${p.name}</strong> joined on ${p.joined} as ${p.role} in the
                  <em>${p.team}</em> team.
                </div>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `;
  },
};

// =====================================================================
// HORIZONTAL SCROLL (min-width)
// =====================================================================
export const HorizontalScroll: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Set `min-width` (or `--md-table-min-width`) so the table keeps its width and the container shows a horizontal scrollbar when the space is narrower — instead of squishing columns. Drag the corner below 560px to see it.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="width: 760px; max-width: 100%; min-width: 240px; resize: horizontal; overflow: hidden;
                border: 1px dashed var(--md-sys-color-outline-variant); padding: 8px;">
      <md-table-container variant="outlined">
        <md-table label="Wide" min-width="560px" column-template="1.5fr 1fr 1fr auto">
          <md-table-head>
            <md-table-row>
              <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
              <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            ${PEOPLE.slice(0, 5).map(
              (p) => html`
                <md-table-row>
                  <md-table-cell>${p.name}</md-table-cell>
                  <md-table-cell>${p.role}</md-table-cell>
                  <md-table-cell>${p.team}</md-table-cell>
                  <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>
      </md-table-container>
      <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant, #49454F); margin-top: 8px;">
        ↔ Drag the corner below 560px — the table keeps its width and scrolls horizontally.
      </p>
    </div>
  `,
};

// =====================================================================
// STICKY HEADER
// =====================================================================
// ---------------------------------------------------------------------------
// Scrollbar modes — overlay (over the rows) vs gutter (classic inset)
// ---------------------------------------------------------------------------

export const ScrollbarModes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `scrollbar` prop picks the frozen body\'s vertical scrollbar presentation. `overlay` (the default) floats an always-visible thumb OVER the rows — no gutter is reserved, so row backgrounds and dividers run the full width and the bar never takes layout space. `gutter` restores the classic inset bar: `scrollbar-gutter: stable` reserves a strip inside the table, rows stop short of the edge, and the native bar renders in the gap.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start;">
      ${(
        [
          {
            mode: 'overlay',
            blurb: 'floating thumb over the rows — full-width rows, no reserved space',
          },
          {
            mode: 'gutter',
            blurb: 'classic inset bar in a reserved strip — rows stop at the gutter',
          },
        ] as const
      ).map(
        ({ mode, blurb }) => html`
          <div style="flex: 1 1 380px; min-inline-size: 360px; max-inline-size: 520px;">
            <p
              style="margin: 0 0 8px; font: 500 13px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);"
            >
              <code>scrollbar="${mode}"</code> — ${blurb}
            </p>
            <md-table-container max-height="212px">
              <md-table
                frozen-header
                scrollbar=${mode}
                label="Employees (${mode} scrollbar)"
                column-template="1.5fr 1fr auto"
              >
                <md-table-head>
                  <md-table-row>
                    <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
                    <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
                    <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
                  </md-table-row>
                </md-table-head>
                <md-table-body>
                  ${PEOPLE.map(
                    (p) => html`
                      <md-table-row>
                        <md-table-cell>${p.name}</md-table-cell>
                        <md-table-cell>${p.team}</md-table-cell>
                        <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                      </md-table-row>
                    `,
                  )}
                </md-table-body>
              </md-table>
            </md-table-container>
          </div>
        `,
      )}
    </div>
  `,
};

export const StickyHeader: Story = {
  render: (_args, { globals }) => html`
    <md-table-container max-height="320px" style="inline-size: 720px; max-inline-size: 100%;">
      <md-table frozen-header label="Many rows" column-template="1.5fr 1fr 1fr auto">
        <md-table-head>
          <md-table-row>
            <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
            <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          ${[...PEOPLE, ...PEOPLE, ...PEOPLE].map(
            (p, i) => html`
              <md-table-row>
                <md-table-cell>${i + 1}. ${p.name}</md-table-cell>
                <md-table-cell>${p.role}</md-table-cell>
                <md-table-cell>${p.team}</md-table-cell>
                <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
};

// =====================================================================
// STICKY COLUMN
// =====================================================================
export const StickyColumn: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Use `sticky="start"` (or `sticky="end"`) on `<md-table-cell>` to pin columns. With SEVERAL pinned on one side, `pin-mode` picks the scroll behavior: `stack` (default) lets later pinned columns slide OVER earlier ones — a deck-of-cards effect with one visible; `static` gives each a cumulative inset so ALL stay visible side-by-side (spreadsheet-style). Toggle live below.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div role="group" aria-label="Pin mode" style="display: flex; gap: 8px; margin-bottom: 12px;">
      ${(['stack', 'static'] as const).map(
        (m) => html`<md-button
          variant="tonal"
          @click=${() => document.getElementById('stickycol-table')?.setAttribute('pin-mode', m)}
          >pin-mode="${m}"</md-button
        >`,
      )}
    </div>
    <md-table-container max-height="360px" style="inline-size: 600px; max-inline-size: 100%;">
      <md-table id="stickycol-table" frozen-header column-template="170px 150px 200px 200px 200px 200px">
        <md-table-head>
          <md-table-row>
            <md-table-cell head sticky="start">${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell head sticky="start">${t(globals.locale, 'table.team')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
            <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.joined')}</md-table-cell>
            <md-table-cell head sticky="end">${t(globals.locale, 'table.actions')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          ${PEOPLE.map(
            (p) => html`
              <md-table-row>
                <!-- Row header (WAI two-headers pattern): the sticky Name
                     cell identifies its row for AT in both directions. -->
                <md-table-cell head scope="row" sticky="start">${p.name}</md-table-cell>
                <md-table-cell sticky="start">${p.team}</md-table-cell>
                <md-table-cell>${p.role}</md-table-cell>
                <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                <md-table-cell>${p.joined}</md-table-cell>
                <md-table-cell sticky="end">
                  <md-icon-button icon="edit" size="xs" aria-label="Edit"></md-icon-button>
                  <md-icon-button icon="delete" size="xs" aria-label="Delete"></md-icon-button>
                </md-table-cell>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
  /** `pin-mode="static"` stamps cumulative sticky offsets on the pinned columns,
   *  and the frozen body is keyboard-scrollable (ArrowRight / Ctrl+End/Home) —
   *  which also drives the rAF-throttled `mdScroll` emit. */
  play: async ({ canvasElement, step }) => {
    const table = await getTable(canvasElement);
    const staticBtn = await whenHydrated(
      (Array.from(canvasElement.querySelectorAll('md-button')) as HTMLElement[]).find((b) =>
        (b.textContent || '').includes('static'),
      ) as HTMLElement,
    );
    // Team is the 2nd sticky="start" body cell (Name is the 1st).
    const teamCell = () => bodyRows(table)[0].querySelectorAll('md-table-cell')[1] as HTMLElement;

    await step('pin-mode="static" stamps a cumulative sticky offset', async () => {
      // In the default stack mode the cumulative-offset var is never set.
      await waitFor(() => expect(teamCell().style.getPropertyValue('--_sticky-offset')).toBe(''));
      staticBtn.click(); // flips the table to pin-mode="static"
      await waitFor(() => expect(table.getAttribute('pin-mode')).toBe('static'));
      // The 2nd pinned-start column now carries a non-zero inset (Name's width).
      await waitFor(() =>
        expect(parseFloat(teamCell().style.getPropertyValue('--_sticky-offset'))).toBeGreaterThan(0),
      );
    });

    await step('Keyboard scrolls the frozen body and emits mdScroll', async () => {
      await waitFor(() =>
        expect(table.shadowRoot!.querySelector('.md-table__body-scroll')).toBeTruthy(),
      );
      const sc = table.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement;
      expect(sc.scrollWidth).toBeGreaterThan(sc.clientWidth); // horizontally overflowing
      const max = sc.scrollWidth - sc.clientWidth;
      let scrollDetail: { scrollLeft: number; scrollTop: number } | undefined;
      table.addEventListener('mdScroll', (e) => (scrollDetail = (e as CustomEvent).detail));

      sc.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await waitFor(() => expect(sc.scrollLeft).toBeGreaterThan(0)); // the body moved
      await waitFor(() => expect(scrollDetail?.scrollLeft).toBeGreaterThan(0)); // rAF mdScroll fired

      sc.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true }));
      await waitFor(() => expect(sc.scrollLeft).toBeGreaterThanOrEqual(max - 2)); // jumped to the end

      sc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true, bubbles: true }));
      await waitFor(() => expect(sc.scrollLeft).toBeLessThanOrEqual(1)); // back to the start
    });
  },
};

// =====================================================================
// LOADING / EMPTY STATES
// =====================================================================
export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Two loading modes via `loading-mode`: `overlay` (default) shows an indeterminate progress line under the header and a scrim that dims/disables the body while the header stays interactive; `skeleton` replaces the body with shimmer rows, header and footer untouched.',
      },
    },
  },
  render: (_args, { globals }) => {
    const body = (mode: string) => html`
      <div style="flex: 1 1 340px;">
        <div style=${labelStyle}>loading-mode="${mode}"</div>
        <md-table-container>
          <md-table loading loading-mode=${mode} column-template="1.5fr 1fr auto">
            <md-table-head>
              <md-table-row>
                <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
                <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
                <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body>
              ${PEOPLE.slice(0, 4).map(
                (p) => html`
                  <md-table-row>
                    <md-table-cell>${p.name}</md-table-cell>
                    <md-table-cell>${p.role}</md-table-cell>
                    <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                  </md-table-row>
                `,
              )}
            </md-table-body>
          </md-table>
        </md-table-container>
      </div>
    `;
    return html`<div style="display: flex; gap: 32px; flex-wrap: wrap;">${body('overlay')}${body('skeleton')}</div>`;
  },
};

// =====================================================================
// SERVER PAGINATION (simulated fetch + loading flat line)
// =====================================================================
export const ServerPagination: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Server-side pagination **and sorting**: the full dataset lives "on the server" and the client only holds the current page. The FIRST load has no data yet, so it shows the **skeleton** loader; afterwards, page / rows-per-page / sort changes keep the current rows visible and show the **indeterminate overlay** line while the next page is fetched. Clicking a sortable header re-sorts the whole dataset server-side and returns to page 1.',
      },
    },
  },
  render: (_args, { globals }) => {
    // The full dataset "lives on the server". The client only ever holds the
    // current page; sorting + paging are done server-side (here: in fetchPage).
    const DATA = Array.from({ length: 47 }, (_, i) => ({
      name: `Employee ${String(i + 1).padStart(2, '0')}`,
      role: ['Engineer', 'Designer', 'Product Manager', 'Analyst'][i % 4],
      team: `Team ${(i % 6) + 1}`,
      salary: 90000 + ((i * 37) % 40) * 2500,
    }));
    const TOTAL = DATA.length;
    let page = 0;
    let rowsPerPage = 5;
    let sortBy = '';
    let sortOrder: 'asc' | 'desc' | 'none' = 'none';
    let timer = 0;

    const fetchPage = () => {
      const tbl = document.getElementById('srv-table') as
        | (HTMLElement & { loading: boolean; loadingMode: string })
        | null;
      const body = document.getElementById('srv-body');
      if (!tbl || !body) return;
      // No rows yet → skeleton (nothing to keep on screen); already populated →
      // indeterminate overlay over the current rows while the next page loads.
      const hasRows = body.querySelector('md-table-row') != null;
      tbl.loadingMode = hasRows ? 'overlay' : 'skeleton';
      tbl.loading = true;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        // ---- "server": sort the full dataset, then slice the page ----
        let rows = DATA.slice();
        if (sortBy && sortOrder !== 'none') {
          const dir = sortOrder === 'desc' ? -1 : 1;
          rows.sort((a, b) => {
            const av = (a as Record<string, string | number>)[sortBy];
            const bv = (b as Record<string, string | number>)[sortBy];
            const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
            return cmp * dir;
          });
        }
        const start = page * rowsPerPage;
        const slice = rows.slice(start, start + rowsPerPage);
        // The rebuild happens AFTER fake server latency — outside the table's
        // event-bracketed motion. innerHTML-created rows are lazy Stencil
        // components: they HYDRATE asynchronously and measure 0px for a few
        // frames (the table itself can't dip below its initial height thanks
        // to the core keep-height ratchet). Capture FIRST now, rebuild, then
        // wait until the fresh rows are laid out before playing the enter
        // stagger — playing earlier would classify nothing.
        const play = captureFlip(body, { enter: true, stagger: 18, staggerCap: 6 });
        body.innerHTML = slice
          .map(
            (r) =>
              `<md-table-row><md-table-cell>${r.name}</md-table-cell><md-table-cell>${r.role}</md-table-cell><md-table-cell>${r.team}</md-table-cell><md-table-cell numeric>${fmtMoney(r.salary)}</md-table-cell></md-table-row>`,
          )
          .join('');
        const waitHydrated = (tries = 0) => {
          const first = body.querySelector('md-table-row');
          if ((first && first.getBoundingClientRect().height > 1) || tries > 30) play();
          else requestAnimationFrame(() => waitHydrated(tries + 1));
        };
        requestAnimationFrame(() => waitHydrated());
        tbl.loading = false;
      }, 900);
    };
    requestAnimationFrame(fetchPage); // initial "fetch" (skeleton — no data yet)
    return html`
      <div style="max-width: 820px;">
        <md-table-container>
          <md-table-toolbar slot="top" headline="${t(globals.locale, 'table.employees')}" supporting-text="${t(globals.locale, 'table.serverPaginated')}"></md-table-toolbar>
          <md-table
            id="srv-table"
            label="Employees"
            loading
            loading-mode="skeleton"
            loading-rows="5"
            column-template="1.5fr 1fr 1fr auto"
            @mdSortChange=${(e: CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>) => {
              sortBy = e.detail.column;
              sortOrder = e.detail.order;
              page = 0; // server sort resets to the first page
              const pag = document.querySelector('md-table-pagination') as (HTMLElement & { page: number }) | null;
              if (pag) pag.page = 0;
              fetchPage();
            }}
          >
            <md-table-head>
              <md-table-row>
                <md-table-cell head><md-table-sort-label column="name">${t(globals.locale, 'table.name')}</md-table-sort-label></md-table-cell>
                <md-table-cell head><md-table-sort-label column="role">${t(globals.locale, 'table.role')}</md-table-sort-label></md-table-cell>
                <md-table-cell head><md-table-sort-label column="team">${t(globals.locale, 'table.team')}</md-table-sort-label></md-table-cell>
                <md-table-cell head numeric><md-table-sort-label column="salary">${t(globals.locale, 'table.salary')}</md-table-sort-label></md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body id="srv-body"></md-table-body>
          </md-table>
          <md-table-pagination
            slot="bottom"
            count=${TOTAL}
            rows-per-page="5"
            rows-per-page-options="5,10,25"
            show-first-last
            @mdPageChange=${(e: CustomEvent<{ page: number }>) => {
              page = e.detail.page;
              fetchPage();
            }}
            @mdRowsPerPageChange=${(e: CustomEvent<{ rowsPerPage: number }>) => {
              rowsPerPage = e.detail.rowsPerPage;
              page = 0;
              fetchPage();
            }}
          ></md-table-pagination>
        </md-table-container>
      </div>
    `;
  },
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The empty state is centered on both axes and grows to fill the available height (set `--md-table-empty-min-height` or a container height). Provide custom content via `slot="empty"`.',
      },
    },
  },
  render: (_args, { globals }) => {
    const head = html`
      <md-table-head>
        <md-table-row>
          <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
          <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
          <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
        </md-table-row>
      </md-table-head>
    `;
    const icon = (name: string, size = 48) => html`
      <span class="material-symbols-outlined" style="font-size: ${size}px; color: var(--md-sys-color-on-surface-variant);">${name}</span>
    `;
    return html`
      <div style="display: grid; gap: 32px; max-width: 900px;">
        <div>
          <div style=${labelStyle}>No results — with action (tall container, centered both axes)</div>
          <md-table-container style="min-block-size: 340px;">
            <md-table empty column-template="1fr 1fr auto">
              ${head}
              <div slot="empty" style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                ${icon('search_off')}
                <p style="margin: 0; font: 500 16px Roboto, sans-serif;">${t(globals.locale, 'table.noEmployeesMatch')}</p>
                <p style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t(globals.locale, 'table.tryAdjusting')}</p>
                <md-button variant="filled">${t(globals.locale, 'table.clearFilters')}</md-button>
              </div>
            </md-table>
          </md-table-container>
        </div>

        <div>
          <div style=${labelStyle}>First-run empty — primary call to action</div>
          <md-table-container style="min-block-size: 320px;">
            <md-table empty column-template="1fr 1fr auto">
              ${head}
              <div slot="empty" style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                ${icon('group_add', 56)}
                <p style="margin: 0; font: 500 16px Roboto, sans-serif;">${t(globals.locale, 'table.noEmployeesYet')}</p>
                <p style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t(globals.locale, 'table.addFirstMember')}</p>
                <md-button variant="filled">${t(globals.locale, 'table.addEmployee')}</md-button>
              </div>
            </md-table>
          </md-table-container>
        </div>

        <div>
          <div style=${labelStyle}>Error state — retry (tonal action)</div>
          <md-table-container style="min-block-size: 300px;">
            <md-table empty column-template="1fr 1fr auto">
              ${head}
              <div slot="empty" style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                ${icon('cloud_off')}
                <p style="margin: 0; font: 500 16px Roboto, sans-serif;">${t(globals.locale, 'table.couldntLoad')}</p>
                <p style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t(globals.locale, 'table.checkConnection')}</p>
                <md-button variant="tonal">${t(globals.locale, 'table.retry')}</md-button>
              </div>
            </md-table>
          </md-table-container>
        </div>

        <div>
          <div style=${labelStyle}>Minimal — default text only (via empty-text style)</div>
          <md-table-container style="min-block-size: 240px;">
            <md-table empty column-template="1fr 1fr auto">
              ${head}
              <div slot="empty" style="color: var(--md-sys-color-on-surface-variant);">${t(globals.locale, 'table.nothingToSee')}</div>
            </md-table>
          </md-table-container>
        </div>
      </div>
    `;
  },
};

// =====================================================================
// EXPANDABLE ROWS
// =====================================================================
export const ExpandableRows: Story = {
  render: (_args, { globals }) => html`
    <style>
      .exp-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 4px 12px;
      }
      .exp-toolbar span {
        font: 500 12px/16px Roboto, sans-serif;
        color: var(--md-sys-color-on-surface-variant, #49454f);
      }
    </style>
    <div class="exp-toolbar">
      <span>${t(globals.locale, 'table.density')}</span>
      <!-- Compact toggle: flips the table's density prop. Row heights + cell
           padding animate to the compact scale (see md-table density). -->
      <md-chip
        variant="filter"
        @mdSelect=${(e: CustomEvent<{ selected: boolean }>) => {
          const t = document.getElementById('exp-table') as (HTMLElement & { density: string }) | null;
          if (t) t.density = e.detail.selected ? 'compact' : 'standard';
        }}
        >${t(globals.locale, 'table.compact')}</md-chip
      >
    </div>
    <md-table-container>
      <md-table id="exp-table" keep-height="false" column-template="auto 1.5fr 1fr 1fr auto">
        <md-table-head>
          <md-table-row>
            <md-table-cell head padding="checkbox"><span style="position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;">Row details</span></md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
            <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          ${PEOPLE.slice(0, 5).map(
            (p) => html`
              <md-table-row expandable>
                <md-table-cell padding="checkbox">
                  <!-- The core expand caret: one standard size (xs), rotation,
                       toggle + aria-expanded wiring all built in. -->
                  <md-table-expand-toggle button-label="Expand details for ${p.name}"></md-table-expand-toggle>
                </md-table-cell>
                <md-table-cell>${p.name}</md-table-cell>
                <md-table-cell>${p.role}</md-table-cell>
                <md-table-cell>${p.team}</md-table-cell>
                <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                <div slot="expanded" style="display: grid; gap: 8px; grid-template-columns: 1fr 1fr;">
                  <div><strong>${t(globals.locale, 'table.joinedColon')}</strong> ${p.joined}</div>
                  <div><strong>${t(globals.locale, 'table.employeeIdColon')}</strong> ${p.id}</div>
                  <div style="grid-column: 1 / -1;">
                    <strong>${t(globals.locale, 'table.bioColon')}</strong> ${p.name} is a ${p.role.toLowerCase()} working in the ${p.team} team.
                  </div>
                </div>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
  /** The caret toggles the row's detail zone: aria-expanded, the panel's
   *  hidden/inert state, and the mdRowExpandedChange payload all flip together. */
  play: async ({ canvasElement, step }) => {
    const table = await getTable(canvasElement);
    const firstRow = bodyRows(table)[0]; // Ada Lovelace — expandable
    const toggle = await whenHydrated(
      firstRow.querySelector('md-table-expand-toggle') as HTMLElement,
    );
    const toggleBtn = () => toggle.shadowRoot!.querySelector('md-icon-button') as HTMLElement;
    const panel = () => firstRow.shadowRoot!.querySelector('[part="expanded"]') as HTMLElement;

    await step('Row starts collapsed — detail panel hidden + inert', async () => {
      await waitFor(() => expect(firstRow.getAttribute('aria-expanded')).toBe('false'));
      expect(panel().getAttribute('aria-hidden')).toBe('true');
      expect(panel().hasAttribute('inert')).toBe(true);
      expect(toggleBtn().getAttribute('aria-expanded')).toBe('false');
    });

    await step('Clicking the caret expands the row + reveals its detail', async () => {
      let detail: { expanded: boolean } | undefined;
      firstRow.addEventListener(
        'mdRowExpandedChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      toggleBtn().click();
      await waitFor(() => expect(detail?.expanded).toBe(true)); // the row emitted the change
      await waitFor(() => expect(firstRow.getAttribute('aria-expanded')).toBe('true'));
      await waitFor(() => expect(panel().getAttribute('aria-hidden')).toBe(null)); // now shown
      expect(panel().hasAttribute('inert')).toBe(false); // and reachable
      expect(panel().classList.contains('md-table-row__expanded--open')).toBe(true);
      await waitFor(() => expect(toggleBtn().getAttribute('aria-expanded')).toBe('true'));
    });

    await step('Clicking again collapses it back (guard)', async () => {
      let detail: { expanded: boolean } | undefined;
      firstRow.addEventListener(
        'mdRowExpandedChange',
        (e) => (detail = (e as CustomEvent).detail),
        { once: true },
      );
      toggleBtn().click();
      await waitFor(() => expect(detail?.expanded).toBe(false));
      await waitFor(() => expect(firstRow.getAttribute('aria-expanded')).toBe('false'));
      await waitFor(() => expect(panel().getAttribute('aria-hidden')).toBe('true'));
      // Let the expand/collapse height spring settle before teardown.
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

// =====================================================================
// EDITABLE CELL
// =====================================================================
export const EditableCells: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Drop any input component into a cell. The table doesn\'t care — it just lays things out.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      /* Let the cell content wrapper fill the cell so full-width controls
         (md-text-field is width:100%) actually stretch across it. */
      .editable md-table-cell::part(content) {
        inline-size: 100%;
      }
    </style>
    <md-table-container class="editable">
      <md-table column-template="1fr 1fr 1fr">
        <md-table-head>
          <md-table-row>
            <md-table-cell head>${t(globals.locale, 'table.field')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.value')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.notes')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row>
            <md-table-cell>${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell><md-text-field variant="outlined" value="Ada Lovelace" aria-label="Name value"></md-text-field></md-table-cell>
            <md-table-cell><md-text-field variant="outlined" value="VIP" aria-label="Name notes"></md-text-field></md-table-cell>
          </md-table-row>
          <md-table-row>
            <md-table-cell>${t(globals.locale, 'table.role')}</md-table-cell>
            <md-table-cell>
              <md-select variant="outlined" value="lead" aria-label="Role value">
                <md-select-option value="ic">${t(globals.locale, 'table.individualContributor')}</md-select-option>
                <md-select-option value="lead">${t(globals.locale, 'table.lead')}</md-select-option>
                <md-select-option value="manager">${t(globals.locale, 'table.manager')}</md-select-option>
              </md-select>
            </md-table-cell>
            <md-table-cell><md-text-field variant="outlined" value="" aria-label="Role notes"></md-text-field></md-table-cell>
          </md-table-row>
          <md-table-row>
            <md-table-cell>${t(globals.locale, 'table.active')}</md-table-cell>
            <md-table-cell><md-switch checked aria-label="Active"></md-switch></md-table-cell>
            <md-table-cell><md-text-field variant="outlined" value="" aria-label="Active notes"></md-text-field></md-table-cell>
          </md-table-row>
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
  /** Cells just host normal inputs. Editing the Name field commits a new value
   *  (the field's own value transitions and it emits mdInput/mdChange), and the
   *  Active switch toggles + emits — every assertion reads live control state. */
  play: async ({ canvasElement, step }) => {
    const table = await getTable(canvasElement);
    const rows = bodyRows(table);
    const nameField = (await whenHydrated(
      rows[0].querySelector('md-text-field') as HTMLElement,
    )) as HTMLElement & { value: string };
    const input = () =>
      nameField.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;

    await step('Name cell is seeded with its starting value', async () => {
      await waitFor(() => expect(nameField.value).toBe('Ada Lovelace'));
      expect(input().value).toBe('Ada Lovelace'); // the visible input mirrors it
    });

    await step('Committing a new value updates the field + emits mdChange (before != after)', async () => {
      const before = nameField.value; // 'Ada Lovelace'
      let inputDetail: string | undefined;
      let changeDetail: string | undefined;
      nameField.addEventListener('mdInput', (e) => (inputDetail = (e as CustomEvent).detail), { once: true });
      nameField.addEventListener('mdChange', (e) => (changeDetail = (e as CustomEvent).detail), { once: true });
      const el = input();
      el.focus();
      el.value = 'Augusta Ada King';
      el.dispatchEvent(new Event('input', { bubbles: true })); // live edit
      el.dispatchEvent(new Event('change', { bubbles: true })); // commit
      await waitFor(() => expect(changeDetail).toBe('Augusta Ada King')); // field emitted the commit
      expect(inputDetail).toBe('Augusta Ada King'); // and the keystroke
      await waitFor(() => expect(nameField.value).toBe('Augusta Ada King')); // host value moved
      expect(nameField.value).not.toBe(before); // proves it actually changed
    });

    await step('The Active switch cell toggles + emits its own mdChange (guard: live-state read)', async () => {
      const sw = await whenHydrated(rows[2].querySelector('md-switch') as HTMLElement);
      const before = sw.getAttribute('aria-checked'); // whatever it currently renders
      let detail: { selected: boolean } | undefined;
      sw.addEventListener('mdChange', (e) => (detail = (e as CustomEvent).detail), { once: true });
      sw.click();
      await waitFor(() => expect(sw.getAttribute('aria-checked')).not.toBe(before)); // state flipped
      const now = sw.getAttribute('aria-checked');
      expect(detail?.selected).toBe(now === 'true'); // the event agrees with the live DOM
    });
  },
};

// =====================================================================
// FOOTER (totals)
// =====================================================================
export const FooterTotals: Story = {
  render: (_args, { globals }) => {
    const total = PEOPLE.reduce((sum, p) => sum + p.salary, 0);
    return html`
      <md-table-container>
        <md-table column-template="1.5fr 1fr auto">
          <md-table-head>
            <md-table-row>
              <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
              <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            ${PEOPLE.slice(0, 5).map(
              (p) => html`
                <md-table-row>
                  <md-table-cell>${p.name}</md-table-cell>
                  <md-table-cell>${p.team}</md-table-cell>
                  <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
          <md-table-foot>
            <md-table-row>
              <md-table-cell head scope="row" colspan="2">${t(globals.locale, 'table.total')}</md-table-cell>
              <md-table-cell numeric><strong>${fmtMoney(total)}</strong></md-table-cell>
            </md-table-row>
          </md-table-foot>
        </md-table>
      </md-table-container>
    `;
  },
};

// =====================================================================
// SPANNING TABLE (grouped headers + totals via colspan)
// =====================================================================
export const SpanningTable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Grouped column headers and an invoice-style totals footer using `colspan` on `md-table-cell` (the MUI "spanning table" pattern). Cross-row `rowspan` is not supported (rows are independent subgrids), but `colspan` covers grouped headers and footer totals.',
      },
    },
  },
  render: (_args, { globals }) => {
    const items = [
      { desc: 'Paperclips (Box)', qty: 100, unit: 1.15 },
      { desc: 'Paper (Case)', qty: 10, unit: 45.99 },
      { desc: 'Waste Basket', qty: 2, unit: 17.99 },
    ];
    const ccy = (n: number) => n.toFixed(2);
    const sum = (i: { qty: number; unit: number }) => i.qty * i.unit;
    const subtotal = items.reduce((s, i) => s + sum(i), 0);
    const tax = subtotal * 0.07;
    return html`
      <style>
        /* The empty Desc column in the footer stays blank (no row dividers) —
           the divider only spans the content cells, mimicking MUI's rowSpan. */
        /* Kill the foot ROWS' own full-width top border (they read --_divider,
           inherited) so it doesn't double with the per-cell borders below. */
        .inv-foot {
          --_divider: transparent;
        }
        /* Body↔footer boundary: a FULL-WIDTH line under the last line item —
           all cells of the first footer (Subtotal) row, incl. the Desc column. */
        .inv-foot md-table-row:first-child md-table-cell {
          border-block-start: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        }
        /* Within the totals block: separators are interrupted over the empty
           Desc column (non-first cells only) for the remaining footer rows. */
        .inv-foot md-table-row:not(:first-child) md-table-cell:not(:first-child) {
          border-block-start: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        }
      </style>
      <div style="max-width: 760px;">
        <md-table-container variant="elevated">
          <md-table label="Invoice" column-template="2fr 1fr 1fr 1fr">
            <md-table-head>
              <md-table-row>
                <md-table-cell head colspan="3" scope="colgroup" align="center">${t(globals.locale, 'table.details')}</md-table-cell>
                <md-table-cell head numeric>${t(globals.locale, 'table.price')}</md-table-cell>
              </md-table-row>
              <md-table-row>
                <md-table-cell head scope="col">${t(globals.locale, 'table.desc')}</md-table-cell>
                <md-table-cell head scope="col" numeric>${t(globals.locale, 'table.qty')}</md-table-cell>
                <md-table-cell head scope="col" numeric>${t(globals.locale, 'table.unit')}</md-table-cell>
                <md-table-cell head scope="col" numeric>${t(globals.locale, 'table.sum')}</md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body>
              ${items.map(
                (i) => html`
                  <md-table-row>
                    <md-table-cell>${i.desc}</md-table-cell>
                    <md-table-cell numeric>${i.qty}</md-table-cell>
                    <md-table-cell numeric>${ccy(i.unit)}</md-table-cell>
                    <md-table-cell numeric>${ccy(sum(i))}</md-table-cell>
                  </md-table-row>
                `,
              )}
            </md-table-body>
            <md-table-foot class="inv-foot">
              <md-table-row>
                <md-table-cell></md-table-cell>
                <md-table-cell head scope="row" colspan="2">${t(globals.locale, 'table.subtotal')}</md-table-cell>
                <md-table-cell numeric>${ccy(subtotal)}</md-table-cell>
              </md-table-row>
              <md-table-row>
                <md-table-cell></md-table-cell>
                <md-table-cell head scope="row">${t(globals.locale, 'table.tax')}</md-table-cell>
                <md-table-cell numeric>7 %</md-table-cell>
                <md-table-cell numeric>${ccy(tax)}</md-table-cell>
              </md-table-row>
              <md-table-row>
                <md-table-cell></md-table-cell>
                <md-table-cell head scope="row" colspan="2">${t(globals.locale, 'table.total')}</md-table-cell>
                <md-table-cell numeric>${ccy(subtotal + tax)}</md-table-cell>
              </md-table-row>
            </md-table-foot>
          </md-table>
        </md-table-container>
      </div>
    `;
  },
};

// =====================================================================
// COLUMN GROUPING (two-tier headers via colspan)
// =====================================================================
export const ColumnGrouping: Story = {
  name: 'Column Grouping',
  parameters: {
    docs: {
      description: {
        story:
          'MUI-style column groups: a second header row of `md-table-cell head colspan="…"` cells spans its child columns (the MUI "column groups" pattern). Group cells are ordinary header cells, so grouping composes with sorting, the frozen header (scroll the body — BOTH header tiers stay pinned) and column templates. Rows are independent subgrids, so `rowspan` across the two tiers is not supported — leave an empty group cell over ungrouped columns instead.',
      },
    },
  },
  render: (_args, { globals }) => {
    // Leaf-header sorting under grouped headers — reorders rows; the core
    // motion="expressive" bracketing makes them glide.
    const CG_COLS: Record<string, { idx: number; numeric?: boolean }> = {
      name: { idx: 0 },
      role: { idx: 1 },
      team: { idx: 2 },
      salary: { idx: 3, numeric: true },
      joined: { idx: 4 },
    };
    const applySort = (column: string, order: string) => {
      const body = document.getElementById('cg-body');
      const col = CG_COLS[column];
      if (!body || !col) return;
      const rows = Array.from(body.querySelectorAll('md-table-row')) as HTMLElement[];
      rows.sort((a, b) => {
        if (order === 'none') return Number(a.dataset.idx) - Number(b.dataset.idx);
        const av = (a.querySelectorAll('md-table-cell')[col.idx]?.textContent || '').trim();
        const bv = (b.querySelectorAll('md-table-cell')[col.idx]?.textContent || '').trim();
        const cmp = col.numeric
          ? parseFloat(av.replace(/[^0-9.-]/g, '')) - parseFloat(bv.replace(/[^0-9.-]/g, ''))
          : av.localeCompare(bv);
        return order === 'desc' ? -cmp : cmp;
      });
      rows.forEach((r) => body.appendChild(r));
    };
    return html`
      <style>
        /* Group tier: shorter cells, centered labels, a hairline between
           adjacent groups so the grouping boundary reads at a glance. */
        .cg-group {
          --md-table-cell-min-height: 36px;
          font-size: var(--md-sys-typescale-label-large-font-size, 14px);
          letter-spacing: 0.4px;
        }
        .cg-group + .cg-group,
        .cg-blank + .cg-group {
          border-inline-start: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
        }
        .cg-blank {
          --md-table-cell-min-height: 36px;
        }
      </style>
      <md-table-container max-height="340px" style="inline-size: 860px; max-inline-size: 100%;">
        <md-table
          frozen-header
          label="Employees, grouped columns"
          summary="Columns are grouped under Profile (Role, Team) and Employment (Salary, Joined); Name is ungrouped."
          column-template="1.5fr 1fr 1fr auto auto"
          @mdSortChange=${(e: CustomEvent<{ column: string; order: string }>) =>
            applySort(e.detail.column, e.detail.order)}
        >
          <md-table-head>
            <!-- Tier 1 — the GROUPS. Plain header cells with colspan. -->
            <md-table-row>
              <!-- WAI two-tier pattern: the spacer over the ungrouped Name
                   column is a plain DATA cell (an empty columnheader would be
                   announced namelessly); group headers span via colspan, which
                   the cell also exposes as aria-colspan. -->
              <md-table-cell class="cg-blank"></md-table-cell>
              <md-table-cell head scope="colgroup" colspan="2" align="center" class="cg-group">${t(globals.locale, 'table.profile')}</md-table-cell>
              <md-table-cell head scope="colgroup" colspan="2" align="center" class="cg-group">${t(globals.locale, 'table.employment')}</md-table-cell>
            </md-table-row>
            <!-- Tier 2 — the LEAF columns (sortable as usual). -->
            <md-table-row>
              <md-table-cell head>
                <md-table-sort-label column="name">${t(globals.locale, 'table.name')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head>
                <md-table-sort-label column="role">${t(globals.locale, 'table.role')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head>
                <md-table-sort-label column="team">${t(globals.locale, 'table.team')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head numeric>
                <md-table-sort-label column="salary">${t(globals.locale, 'table.salary')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head>
                <md-table-sort-label column="joined">${t(globals.locale, 'table.joined')}</md-table-sort-label>
              </md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body id="cg-body">
            ${PEOPLE.map(
              (p, i) => html`
                <md-table-row data-idx=${i}>
                  <md-table-cell>${p.name}</md-table-cell>
                  <md-table-cell>${p.role}</md-table-cell>
                  <md-table-cell>${p.team}</md-table-cell>
                  <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                  <md-table-cell>${p.joined}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>
      </md-table-container>
    `;
  },
};

// =====================================================================
// CLICKABLE ROWS
// =====================================================================
export const ClickableRows: Story = {
  render: (_args, { globals }) => html`
    <md-table-container>
      <md-table
        column-template="1.5fr 1fr 1fr"
        @mdRowClick=${(e: CustomEvent) => {
          const { value } = e.detail as { value: string };
          // eslint-disable-next-line no-alert
          alert('Row clicked: ' + value);
        }}
      >
        <md-table-head>
          <md-table-row>
            <md-table-cell head>${t(globals.locale, 'table.name')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
            <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          ${PEOPLE.slice(0, 5).map(
            (p) => html`
              <md-table-row clickable value=${p.id}>
                <md-table-cell>${p.name}</md-table-cell>
                <md-table-cell>${p.role}</md-table-cell>
                <md-table-cell>${p.team}</md-table-cell>
              </md-table-row>
            `,
          )}
        </md-table-body>
      </md-table>
    </md-table-container>
  `,
  /** Rows are `clickable`: activating one emits mdRowClick carrying that row's
   *  own value + element, while the non-clickable header row stays inert. */
  play: async ({ canvasElement, step }) => {
    const table = await getTable(canvasElement);
    const rows = bodyRows(table);
    // The story's own @mdRowClick handler pops an alert() — capture the event in
    // the CAPTURE phase and stop it before that bubble-phase handler can block.
    const grabRowClick = () => {
      let detail: { value: string; row: HTMLElement } | undefined;
      table.addEventListener(
        'mdRowClick',
        (e) => {
          detail = (e as CustomEvent).detail;
          e.stopPropagation();
        },
        { capture: true, once: true },
      );
      return () => detail;
    };

    await step('Rows render as activatable (role=row, focusable, clickable)', async () => {
      const row = await whenHydrated(rows[0]);
      await waitFor(() => expect(row.getAttribute('role')).toBe('row'));
      await waitFor(() => expect(row.getAttribute('tabindex')).toBe('0')); // keyboard-reachable
      expect(row.classList.contains('md-table-row--clickable')).toBe(true);
    });

    let firstValue = '';
    await step('Clicking a row emits mdRowClick with its id + element', async () => {
      const targetRow = await whenHydrated(rows[2]); // Grace Hopper, value "3"
      firstValue = targetRow.getAttribute('value') || '';
      const read = grabRowClick();
      (targetRow.querySelector('md-table-cell') as HTMLElement).click();
      await waitFor(() => expect(read()?.value).toBe(firstValue)); // the row emitted its own id
      expect(read()?.row).toBe(targetRow); // and a handle to its own element
      expect(bodyRows(table).indexOf(read()!.row)).toBe(2); // which ties the id to its index
    });

    await step('Payload tracks the clicked row; the header row is inert (guard)', async () => {
      const otherRow = await whenHydrated(rows[0]); // Ada Lovelace, value "1"
      const read = grabRowClick();
      (otherRow.querySelector('md-table-cell') as HTMLElement).click();
      await waitFor(() => expect(read()?.value).toBe(otherRow.getAttribute('value')));
      expect(read()?.value).not.toBe(firstValue); // a live per-row payload, not a constant

      // The header row is not `clickable`, so clicking it emits nothing.
      const headRow = table.querySelector('md-table-head md-table-row') as HTMLElement;
      let fired = false;
      const onHead = (e: Event) => {
        fired = true;
        e.stopPropagation();
      };
      table.addEventListener('mdRowClick', onHead, { capture: true, once: true });
      (headRow.querySelector('md-table-cell') as HTMLElement).click();
      expect(fired).toBe(false);
      table.removeEventListener('mdRowClick', onHead, { capture: true });
    });
  },
};

// =====================================================================
// CUSTOM CSS
// =====================================================================
// ---------------------------------------------------------------------------
// Full Customization — every hook at once: vars, ::parts, light-DOM cell CSS
// ---------------------------------------------------------------------------

export const FullCustomization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A maximalist "blueprint" re-skin exercising EVERY customization surface: **public CSS custom properties** (header/stripe/hover/selection surfaces, divider color, row heights, pin color+size, pagination colors, container outline/shape, expand-toggle rotation), **::part() styling** (`caption`, `header-grid`, `vscrollbar-thumb`, `hscrollbar-thumb`, `pin`, sort-label `icon`/`label`, row `expanded`, pagination `display`/`nav`/buttons, container `top`/`bottom`), and **light-DOM cell CSS** (cells are slotted, so plain selectors style them: dashed column rules, first-column accent, mono numerics, icon chips), and **custom affordance icons** — `pin-icon` on the table (cast to pinned headers), `icon` on `md-table-sort-label` and `md-table-expand-toggle`.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .bp-scope {
        /* ── System tokens scoped locally (the supported theming route):
           the whole scope goes dark-blueprint. ─────────────────────── */
        --md-sys-color-surface: #102437;
        --md-sys-color-on-surface: #cfe9f7;
        --md-sys-color-surface-container-low: #0d1b2a;
        --md-sys-color-on-surface-variant: #9fc5dc;
        --md-sys-color-outline-variant: rgba(127, 212, 255, 0.28);
        /* ── Public custom properties ─────────────────────────────── */
        --md-table-head-bg: #0d1b2a;
        --md-table-head-color: #7fd4ff;
        --md-table-divider-color: rgba(127, 212, 255, 0.28);
        --md-table-stripe-color: rgba(127, 212, 255, 0.05);
        --md-table-row-hover-color: #7fd4ff;
        --md-table-row-selected-bg: rgba(255, 171, 64, 0.18);
        --md-table-row-selected-color: #ffd9a0;
        --md-table-row-height-standard: 48px;
        --md-table-cell-padding-inline: 14px;
        --md-table-cell-pin-color: #ffab40;
        --md-table-cell-pin-size: 15px;
        /* Sort-label colors must be read against the dark head bg (#0d1b2a) —
           the default active color (system primary #6750a4) only reaches 2.7:1.
           Cyan matches the header text; amber matches the sort icon accent. */
        --md-table-sort-label-color: #7fd4ff;
        --md-table-sort-label-active-color: #ffab40;
        --md-table-expand-toggle-rotation: 180deg;
        --md-table-pagination-color: #7fd4ff;
        --md-table-pagination-bg: #0d1b2a;
        --md-table-container-outline-color: #7fd4ff;
        --md-table-container-outline-width: 2px;
        --md-table-container-shape: 4px;
        --md-table-surface: #102437;
        font-family: 'SF Mono', ui-monospace, Menlo, monospace;
      }
      /* ── ::part() styling ───────────────────────────────────────── */
      .bp-scope md-table::part(caption) {
        color: #ffab40;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        font-size: 11px;
        border-block-end: 1px dashed rgba(255, 171, 64, 0.5);
      }
      .bp-scope md-table::part(header-grid) {
        background-image:
          linear-gradient(rgba(127, 212, 255, 0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(127, 212, 255, 0.07) 1px, transparent 1px);
        background-size: 12px 12px;
      }
      .bp-scope md-table::part(vscrollbar-thumb),
      .bp-scope md-table::part(hscrollbar-thumb) {
        background: #7fd4ff;
        border-radius: 0; /* square blueprint handles */
        box-shadow: 0 0 0 1px #0d1b2a;
      }
      .bp-scope md-table-cell::part(pin) {
        filter: drop-shadow(0 0 3px rgba(255, 171, 64, 0.8));
      }
      .bp-scope md-table-sort-label::part(label) {
        text-decoration: underline dotted rgba(127, 212, 255, 0.6);
        text-underline-offset: 4px;
      }
      .bp-scope md-table-sort-label::part(icon) {
        color: #ffab40;
      }
      .bp-scope md-table-row::part(expanded) {
        background: rgba(127, 212, 255, 0.06);
        border-block-start: 1px dashed rgba(127, 212, 255, 0.4);
      }
      .bp-scope md-table-pagination::part(display) {
        color: #ffab40;
        letter-spacing: 0.08em;
      }
      .bp-scope md-table-pagination::part(nav) {
        gap: 0;
        border: 1px dashed rgba(127, 212, 255, 0.4);
        border-radius: 4px;
      }
      .bp-scope md-table-pagination::part(prev-button),
      .bp-scope md-table-pagination::part(next-button),
      .bp-scope md-table-pagination::part(first-button),
      .bp-scope md-table-pagination::part(last-button) {
        --md-icon-button-icon-color: #7fd4ff;
      }
      .bp-scope md-table-container::part(bottom) {
        border-block-start: 2px solid #7fd4ff;
      }
      .bp-scope md-table-container {
        background: #102437;
        color: #cfe9f7;
      }
      /* ── Light-DOM cell CSS (cells are slotted — style them directly) ── */
      .bp-scope md-table-body md-table-cell {
        border-inline-end: 1px dashed rgba(127, 212, 255, 0.18);
        color: #cfe9f7;
      }
      .bp-scope md-table-body md-table-cell:last-of-type {
        border-inline-end: none;
      }
      .bp-scope md-table-body md-table-cell[sticky='start'] {
        border-inline-start: 3px solid #ffab40;
        font-weight: 700;
      }
      .bp-scope md-table-cell[numeric] {
        font-variant-numeric: tabular-nums;
        color: #7fd4ff;
      }
      .bp-scope .bp-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        padding: 1px 8px;
        border: 1px solid rgba(127, 212, 255, 0.45);
        border-radius: 3px;
        color: #7fd4ff;
      }
      .bp-scope .bp-chip .material-symbols-outlined {
        font-size: 14px;
        color: #ffab40;
      }
    </style>
    <div class="bp-scope" style="max-inline-size: 760px;">
      <md-table-container variant="outlined" max-height="285px">
        <md-table
          frozen-header
          pin-icon="anchor"
          caption="${t(globals.locale, 'table.blueprintCaption')}"
          selection="multiple"
          striped
          min-width="900px"
          column-template="auto auto 1.4fr 1fr auto auto"
          sort-by="name"
          sort-order="asc"
        >
          <md-table-head>
            <md-table-row>
              <md-table-cell head padding="checkbox">
                <md-checkbox
                  aria-label="Select all"
                  @mdChange=${(e: CustomEvent) => {
                    const tbl = (e.target as HTMLElement).closest('md-table-container')?.querySelector('md-table') as HTMLMdTableElement | null;
                    void tbl?.toggleSelectAll();
                  }}
                ></md-checkbox>
              </md-table-cell>
              <md-table-cell head padding="checkbox"><span style="position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);">Row details</span></md-table-cell>
              <md-table-cell head sticky="start">
                <md-table-sort-label column="name" icon="north">${t(globals.locale, 'table.machine')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.class')}</md-table-cell>
              <md-table-cell head numeric>
                <md-table-sort-label column="mass" icon="north">${t(globals.locale, 'table.massT')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.status')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            ${[
              { n: 'Difference Engine', c: 'Mechanical', m: '4.20', s: 'settings', ok: 'calibrated' },
              { n: 'Analytical Engine', c: 'Mechanical', m: '13.60', s: 'precision_manufacturing', ok: 'drafted' },
              { n: 'Bombe', c: 'Electromechanical', m: '1.00', s: 'lock_open', ok: 'operational' },
              { n: 'ENIAC', c: 'Vacuum tube', m: '27.00', s: 'bolt', ok: 'operational' },
              { n: 'Zuse Z3', c: 'Relay', m: '1.00', s: 'memory', ok: 'restored' },
              { n: 'Colossus', c: 'Vacuum tube', m: '5.00', s: 'visibility', ok: 'classified' },
            ].map(
              (r) => html`
                <md-table-row expandable>
                  <md-table-cell padding="checkbox">
                    <md-checkbox
                      aria-label="Select ${r.n}"
                      @mdChange=${(e: CustomEvent) => {
                        const row = (e.target as HTMLElement).closest('md-table-row') as (HTMLElement & { selected: boolean }) | null;
                        if (row) row.selected = (e.detail as { checked: boolean }).checked;
                      }}
                    ></md-checkbox>
                  </md-table-cell>
                  <md-table-cell padding="checkbox">
                    <md-table-expand-toggle
                      icon="expand_circle_right"
                      button-label="Expand details for ${r.n}"
                    ></md-table-expand-toggle>
                  </md-table-cell>
                  <md-table-cell sticky="start">${r.n}</md-table-cell>
                  <md-table-cell>${r.c}</md-table-cell>
                  <md-table-cell numeric>${r.m}</md-table-cell>
                  <md-table-cell>
                    <span class="bp-chip"><span class="material-symbols-outlined" aria-hidden="true">${r.s}</span>${r.ok}</span>
                  </md-table-cell>
                  <div slot="expanded">
                    Schematic ref: <strong>BP-${r.n.replace(/\s/g, '').slice(0, 6).toUpperCase()}</strong> —
                    tolerances within 0.02mm; last inspection passed.
                  </div>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>
        <md-table-pagination
          slot="bottom"
          count="6"
          rows-per-page="6"
          rows-per-page-options="6"
          label-displayed-rows="units %from%–%to% / %count%"
        ></md-table-pagination>
      </md-table-container>
    </div>
  `,
};

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .brand {
        --md-table-container-color: #f0f7ff;
        --md-table-head-bg: #1f6feb;
        --md-table-head-color: #ffffff;
        --md-table-row-hover-color: #1f6feb; /* opaque — the 8% state-layer opacity is applied by the row */
        --md-table-row-selected-bg: rgba(31, 111, 235, 0.2);
        --md-table-divider-color: rgba(31, 111, 235, 0.2);
      }
      .brand md-table-sort-label {
        --md-table-sort-label-active-color: #ffffff;
        /* Full-opacity white — the 0.85 alpha composited to #dde9fc on the
           #1f6feb header (3.78:1); opaque white reaches 4.63:1. */
        --md-table-sort-label-color: #ffffff;
      }
      .brand md-table::part(grid) {
        font-family: 'IBM Plex Mono', monospace;
      }
      .pill {
        --md-table-container-shape: 999px;
      }
      .stripey md-table-cell:not(.md-table-cell--head) {
        --md-table-cell-padding-block: 18px;
      }
    </style>

    <div style="display: flex; flex-direction: column; gap: 24px;">
      <md-table-container class="brand">
        <md-table-toolbar slot="top" headline="${t(globals.locale, 'table.brand')}"></md-table-toolbar>
        <md-table
          column-template="1.5fr 1fr auto"
          @mdSortChange=${(e: CustomEvent<{ column: string; order: string }>) =>
            sortRowsByCell('brand-body', 0, e.detail.order)}
        >
          <md-table-head>
            <md-table-row>
              <md-table-cell head><md-table-sort-label column="n">${t(globals.locale, 'table.name')}</md-table-sort-label></md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
              <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body id="brand-body">
            ${PEOPLE.slice(0, 3).map(
              (p, i) => html`
                <md-table-row data-idx=${i}>
                  <md-table-cell>${p.name}</md-table-cell>
                  <md-table-cell>${p.role}</md-table-cell>
                  <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>
      </md-table-container>

      <md-table-container class="pill" variant="outlined">
        <md-table column-template="1fr 1fr">
          <md-table-head>
            <md-table-row>
              <md-table-cell head>${t(globals.locale, 'table.symbol')}</md-table-cell>
              <md-table-cell head numeric>${t(globals.locale, 'table.price')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            <md-table-row>
              <md-table-cell>BTC</md-table-cell>
              <md-table-cell numeric>$58,432</md-table-cell>
            </md-table-row>
            <md-table-row>
              <md-table-cell>ETH</md-table-cell>
              <md-table-cell numeric>$3,212</md-table-cell>
            </md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>
    </div>
  `,
};

// =====================================================================
// RTL
// =====================================================================
// ---------------------------------------------------------------------------
// Localization — every i18n knob on one table, driven by a locale switcher
// ---------------------------------------------------------------------------

export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Everything user-facing is localizable: column headers and cell content are slotted (your strings), numbers/dates format via `Intl`, and the chrome exposes label props — `md-table-pagination` (`label-rows-per-page`, `label-first/previous/next/last-page`, `label-all`, and the `label-displayed-rows` template with `%from%/%to%/%count%` tokens), `md-table` (`label`, `caption`, `summary`), and `md-table-expand-toggle` (`button-label`). Pair with `dir="rtl"` (see the RTL story) for bidi.',
      },
    },
  },
  render: () => {
    type LocaleDef = {
      tag: string;
      caption: string;
      headers: [string, string, string, string];
      pag: Record<string, string>;
    };
    const LOCALES: Record<string, LocaleDef> = {
      en: {
        tag: 'en-US',
        caption: 'Employees',
        headers: ['Name', 'Role', 'Salary', 'Joined'],
        pag: {
          'label-rows-per-page': 'Rows per page:',
          'label-displayed-rows': 'Showing %from%–%to% of %count%',
          'label-first-page': 'First page',
          'label-previous-page': 'Previous page',
          'label-next-page': 'Next page',
          'label-last-page': 'Last page',
        },
      },
      de: {
        tag: 'de-DE',
        caption: 'Mitarbeiter',
        headers: ['Name', 'Rolle', 'Gehalt', 'Eingestellt'],
        pag: {
          'label-rows-per-page': 'Zeilen pro Seite:',
          'label-displayed-rows': '%from%–%to% von %count%',
          'label-first-page': 'Erste Seite',
          'label-previous-page': 'Vorherige Seite',
          'label-next-page': 'Nächste Seite',
          'label-last-page': 'Letzte Seite',
        },
      },
      ja: {
        tag: 'ja-JP',
        caption: '従業員',
        headers: ['名前', '役職', '給与', '入社日'],
        pag: {
          'label-rows-per-page': '1ページの行数:',
          'label-displayed-rows': '%count%件中 %from%–%to%件',
          'label-first-page': '最初のページ',
          'label-previous-page': '前のページ',
          'label-next-page': '次のページ',
          'label-last-page': '最後のページ',
        },
      },
    };
    const CCY: Record<string, string> = { en: 'USD', de: 'EUR', ja: 'JPY' };
    let current = 'en';

    const applyLocale = (key: string) => {
      current = key;
      const L = LOCALES[key];
      const table = document.getElementById('l10n-table');
      const pag = document.getElementById('l10n-pag');
      if (!table || !pag) return;
      table.setAttribute('caption', L.caption);
      Object.entries(L.pag).forEach(([attr, v]) => pag.setAttribute(attr, v));
      document.querySelectorAll('#l10n-head-row md-table-cell').forEach((c, i) => {
        c.textContent = L.headers[i];
      });
      const money = new Intl.NumberFormat(L.tag, { style: 'currency', currency: CCY[key], maximumFractionDigits: 0 });
      const date = new Intl.DateTimeFormat(L.tag, { dateStyle: 'medium' });
      document.querySelectorAll('#l10n-body md-table-row').forEach((row, i) => {
        const p = PEOPLE[i];
        const cells = row.querySelectorAll('md-table-cell');
        cells[2].textContent = money.format(p.salary);
        cells[3].textContent = date.format(new Date(p.joined));
      });
      document.querySelectorAll('.l10n-switch md-chip').forEach((ch) => {
        (ch as HTMLElement & { selected: boolean }).selected = ch.getAttribute('data-loc') === key;
      });
    };
    requestAnimationFrame(() => applyLocale('en'));

    return html`
      <div class="l10n-switch" role="group" aria-label="Locale" style="display: flex; gap: 8px; margin-bottom: 16px;">
        ${Object.keys(LOCALES).map(
          (key) => html`<md-chip variant="filter" data-loc=${key} @mdSelect=${() => applyLocale(key)}>
            ${key === 'en' ? 'English' : key === 'de' ? 'Deutsch' : '日本語'}
          </md-chip>`,
        )}
      </div>
      <md-table-container max-height="265px" style="max-inline-size: 720px;">
        <md-table id="l10n-table" frozen-header caption="Employees" row-count="10" column-template="1.5fr 1fr auto auto">
          <md-table-head>
            <md-table-row id="l10n-head-row">
              <md-table-cell head>Name</md-table-cell>
              <md-table-cell head>Role</md-table-cell>
              <md-table-cell head numeric>Salary</md-table-cell>
              <md-table-cell head>Joined</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body id="l10n-body">
            ${PEOPLE.map(
              (p) => html`
                <md-table-row>
                  <md-table-cell head scope="row">${p.name}</md-table-cell>
                  <md-table-cell>${p.role}</md-table-cell>
                  <md-table-cell numeric>${p.salary}</md-table-cell>
                  <md-table-cell>${p.joined}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>
        <md-table-pagination id="l10n-pag" slot="bottom" count="10" rows-per-page="5" rows-per-page-options="5,10"></md-table-pagination>
      </md-table-container>
    `;
  },
};

// ---------------------------------------------------------------------------
// Responsive — scroll-don't-squish, live-resizable
// ---------------------------------------------------------------------------

export const Responsive: Story = {
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story:
          'The responsive contract is **scroll, don’t squish**: columns keep at least `min-width` (default: their natural width) and never wrap or truncate into a stacked layout — when the container is narrower, the body scrolls horizontally under the frozen header with the custom overlay bar (keyboard: ArrowLeft/Right, ⌘Home/End), and `sticky="start"` columns stay pinned. Drag the handle at the card’s right edge, or use the presets.',
      },
    },
  },
  render: (_args, { globals }) => {
    const setW = (w: string) => {
      const box = document.getElementById('resp-box');
      if (box) box.style.inlineSize = w;
    };
    return html`
      <div role="group" aria-label="Viewport presets" style="display: flex; gap: 8px; margin-bottom: 12px;">
        <md-button variant="tonal" @click=${() => setW('360px')}>${t(globals.locale, 'table.phone')} 360</md-button>
        <md-button variant="tonal" @click=${() => setW('768px')}>${t(globals.locale, 'table.tablet')} 768</md-button>
        <md-button variant="tonal" @click=${() => setW('100%')}>${t(globals.locale, 'table.desktop')}</md-button>
      </div>
      <!-- resize: horizontal makes the wrapper draggable at its right edge -->
      <div
        id="resp-box"
        style="resize: horizontal; overflow: hidden; inline-size: 100%; max-inline-size: 100%; min-inline-size: 300px; padding-block-end: 4px;"
      >
        <md-table-container max-height="320px">
          <md-table frozen-header label="Employees" min-width="860px" column-template="180px 1fr 1fr auto auto">
            <md-table-head>
              <md-table-row>
                <md-table-cell head sticky="start">${t(globals.locale, 'table.name')}</md-table-cell>
                <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
                <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
                <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
                <md-table-cell head>${t(globals.locale, 'table.joined')}</md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body>
              ${PEOPLE.map(
                (p) => html`
                  <md-table-row>
                    <md-table-cell head scope="row" sticky="start">${p.name}</md-table-cell>
                    <md-table-cell>${p.role}</md-table-cell>
                    <md-table-cell>${p.team}</md-table-cell>
                    <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                    <md-table-cell>${p.joined}</md-table-cell>
                  </md-table-row>
                `,
              )}
            </md-table-body>
          </md-table>
        </md-table-container>
      </div>
    `;
  },
};

export const RTL: Story = {
  render: () => {
    const AR = [
      { name: 'أحمد بن علي', role: 'مهندس', salary: '$120,000' },
      { name: 'فاطمة الكاتب', role: 'محلل', salary: '$95,000' },
      { name: 'خالد العمري', role: 'مصمم', salary: '$110,000' },
      { name: 'سارة حسن', role: 'مطوّر', salary: '$130,000' },
      { name: 'عمر ناصر', role: 'مدير', salary: '$150,000' },
      { name: 'ليلى إبراهيم', role: 'محلل بيانات', salary: '$105,000' },
      { name: 'يوسف مراد', role: 'مهندس أول', salary: '$140,000' },
    ];
    let page = 0;
    let rowsPerPage = 3;
    const renderPage = () => {
      const rows = Array.from(document.querySelectorAll('#rtl-body md-table-row')) as HTMLElement[];
      const start = page * rowsPerPage;
      rows.forEach((r, i) => (r.style.display = i >= start && i < start + rowsPerPage ? '' : 'none'));
    };
    requestAnimationFrame(renderPage);
    return html`
      <div dir="rtl">
        <md-table-container>
          <md-table-toolbar slot="top" headline="مستخدمون"></md-table-toolbar>
          <md-table column-template="1.5fr 1fr auto">
            <md-table-head>
              <md-table-row>
                <md-table-cell head>الاسم</md-table-cell>
                <md-table-cell head>الدور</md-table-cell>
                <md-table-cell head numeric>الراتب</md-table-cell>
              </md-table-row>
            </md-table-head>
            <md-table-body id="rtl-body">
              ${AR.map(
                (p) => html`
                  <md-table-row>
                    <md-table-cell>${p.name}</md-table-cell>
                    <md-table-cell>${p.role}</md-table-cell>
                    <md-table-cell numeric>${p.salary}</md-table-cell>
                  </md-table-row>
                `,
              )}
            </md-table-body>
          </md-table>
          <md-table-pagination
            slot="bottom"
            count=${AR.length}
            rows-per-page="3"
            rows-per-page-options="3,5,10"
            show-first-last
            label-rows-per-page="عدد الصفوف في الصفحة:"
            label-displayed-rows="%from%–%to% من %count%"
            label-all="الكل"
            label-first-page="الصفحة الأولى"
            label-previous-page="الصفحة السابقة"
            label-next-page="الصفحة التالية"
            label-last-page="الصفحة الأخيرة"
            @mdPageChange=${(e: CustomEvent<{ page: number }>) => {
              page = e.detail.page;
              renderPage();
            }}
            @mdRowsPerPageChange=${(e: CustomEvent<{ rowsPerPage: number }>) => {
              rowsPerPage = e.detail.rowsPerPage;
              page = 0;
              renderPage();
            }}
          ></md-table-pagination>
        </md-table-container>
      </div>
    `;
  },
};

// =====================================================================
// VIBRANT TONALITY
// =====================================================================
export const Vibrant: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Set `vibrant` on `md-table-container` for a primary-tinted surface with a coloured header, primary hover and tertiary selection — cascaded to the table via CSS custom properties.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="max-width: 860px;">
      <md-table-container vibrant variant="elevated">
        <md-table-toolbar slot="top" headline="${t(globals.locale, 'table.employees')}" supporting-text="${t(globals.locale, 'table.vibrantTonality')}"></md-table-toolbar>
        <md-table
          striped
          selection="multiple"
          column-template="auto 1.5fr 1fr 1fr auto"
          @mdSortChange=${(e: CustomEvent<{ column: string; order: string }>) =>
            sortRowsByCell('vibrant-body', 1, e.detail.order)}
        >
          <md-table-head>
            <md-table-row>
              <md-table-cell head padding="checkbox">
                <md-checkbox
                  aria-label="Select all"
                  @mdChange=${(e: CustomEvent) => {
                    const t = (e.target as HTMLElement).closest('md-table-container')?.querySelector('md-table') as any;
                    void t?.toggleSelectAll();
                  }}
                ></md-checkbox>
              </md-table-cell>
              <md-table-cell head><md-table-sort-label column="name">${t(globals.locale, 'table.name')}</md-table-sort-label></md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
              <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body id="vibrant-body">
            ${PEOPLE.slice(0, 6).map(
              (p, i) => html`
                <md-table-row value=${p.id} data-idx=${i}>
                  <md-table-cell padding="checkbox">
                    <md-checkbox
                      aria-label=${`Select ${p.name}`}
                      @mdChange=${(e: CustomEvent) => {
                        const checked = (e.detail as { checked: boolean }).checked;
                        const row = (e.target as HTMLElement).closest('md-table-row') as any;
                        if (row) row.selected = checked;
                      }}
                    ></md-checkbox>
                  </md-table-cell>
                  <md-table-cell>${p.name}</md-table-cell>
                  <md-table-cell>${p.role}</md-table-cell>
                  <md-table-cell>${p.team}</md-table-cell>
                  <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>
      </md-table-container>
    </div>
  `,
};

// =====================================================================
// DARK THEME
// =====================================================================
export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div data-theme="dark" style="background: var(--md-sys-color-surface, #1c1b1f); padding: 24px; border-radius: 16px;">
      <md-table-container variant="elevated">
        <md-table-toolbar slot="top" headline="${t(globals.locale, 'table.darkMode')}"></md-table-toolbar>
        <md-table
          column-template="1.5fr 1fr 1fr auto"
          @mdSortChange=${(e: CustomEvent<{ column: string; order: string }>) =>
            sortRowsByCell('dark-body', 0, e.detail.order)}
        >
          <md-table-head>
            <md-table-row>
              <md-table-cell head>
                <md-table-sort-label column="name">${t(globals.locale, 'table.name')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.role')}</md-table-cell>
              <md-table-cell head>${t(globals.locale, 'table.team')}</md-table-cell>
              <md-table-cell head numeric>${t(globals.locale, 'table.salary')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body id="dark-body">
            ${PEOPLE.slice(0, 4).map(
              (p, i) => html`
                <md-table-row data-idx=${i}>
                  <md-table-cell>${p.name}</md-table-cell>
                  <md-table-cell>${p.role}</md-table-cell>
                  <md-table-cell>${p.team}</md-table-cell>
                  <md-table-cell numeric>${fmtMoney(p.salary)}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
        </md-table>
      </md-table-container>
    </div>
  `,
};

// =====================================================================
// FULL DATA-GRID DEMO (toolbar + sort + selection + pagination + sticky)
// =====================================================================
export const FullDataGrid: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Everything in one place: a toolbar with a working quick-filter (filter icon reveals a search field), a CSV export, and an overflow menu (the 3-dots) with actions; plus selection mode, sortable columns, multiple selection with a "select all" checkbox, sticky header, sticky first column, and pagination.',
      },
    },
  },
  decorators: [
    (story, ctx) => {
      const container = ctx.canvasElement;
      if (container) container.innerHTML = '';
      return story();
    },
  ],
  render: (_args, { globals }) => {
    const getTable = () => document.querySelector('#fdg-table') as any;

    // Combined view state: sort + quick-filter + client pagination, applied by
    // reordering / toggling row VISIBILITY (rows are never rebuilt, so selection
    // survives). Sort columns map to cell indices after the checkbox column.
    let query = '';
    let page = 0;
    let rowsPerPage = 5;
    const activeTeams = new Set<string>();
    const TEAMS = [...new Set(PEOPLE.map((p) => p.team))];
    const SALARY_MIN = 90000;
    const SALARY_MAX = 220000;
    let salaryRange: [number, number] = [SALARY_MIN, SALARY_MAX];
    let joinedFrom = '';
    let joinedTo = '';
    const fmtK = (n: number) => `$${Math.round(n / 1000)}k`;

    // Column model — used for both sorting (by data-col, order-independent) and
    // column pinning/reordering. `_select` (checkbox) is always the first column.
    const FIX_COLS = [
      { key: 'name', label: t(globals.locale, 'table.name') },
      { key: 'role', label: t(globals.locale, 'table.role') },
      { key: 'team', label: t(globals.locale, 'table.team') },
      { key: 'availability', label: t(globals.locale, 'table.availability') },
      { key: 'salary', label: t(globals.locale, 'table.salary') },
      { key: 'joined', label: t(globals.locale, 'table.joined') },
      { key: 'location', label: t(globals.locale, 'table.location') },
      { key: 'level', label: t(globals.locale, 'table.level') },
      { key: 'projects', label: t(globals.locale, 'table.projects') },
      { key: 'manager', label: t(globals.locale, 'table.manager') },
      { key: 'rating', label: t(globals.locale, 'table.rating') },
    ];
    // Column widths live in the table's column-template markup attribute; the
    // core pinColumn() permutes + floors them from there.
    const AVAIL = ['Full-time', 'Part-time', 'Contract', 'On leave'];
    const pins = new Map<string, 'start' | 'end'>(); // column key → pinned side

    // Cell text for a row + column key (order-independent — reads by data-col).
    const cellText = (row: HTMLElement, key: string) =>
      (row.querySelector(`[data-col="${key}"]`)?.textContent || '').trim();

    const escapeHtml = (s: string) =>
      s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    // Wrap every occurrence of `needle` in <mark class="fdg-hl"> (case-insensitive).
    const markText = (text: string, needle: string) => {
      if (!needle) return escapeHtml(text);
      const lower = text.toLowerCase();
      const q = needle.toLowerCase();
      let out = '';
      let i = 0;
      for (let hit = lower.indexOf(q); hit !== -1; hit = lower.indexOf(q, i)) {
        out += escapeHtml(text.slice(i, hit)) + `<mark class="fdg-hl">${escapeHtml(text.slice(hit, hit + q.length))}</mark>`;
        i = hit + q.length;
      }
      return out + escapeHtml(text.slice(i));
    };
    // Re-render the Name + Role cells with the search substring highlighted
    // (rebuilt from the row's source data so repeated searches don't nest marks).
    const highlightMatches = (needle: string) => {
      document.querySelectorAll('#fdg-body md-table-row').forEach((row) => {
        const p = PEOPLE[Number((row as HTMLElement).dataset.idx)];
        if (!p) return;
        const nameCell = row.querySelector('[data-col="name"]');
        const roleCell = row.querySelector('[data-col="role"]');
        if (nameCell) nameCell.innerHTML = `<strong>${markText(p.name, needle)}</strong>`;
        if (roleCell) roleCell.innerHTML = markText(p.role, needle);
      });
    };

    const applySort = (column: string, order: string) => {
      const body = document.getElementById('fdg-body');
      if (!body) return;
      const rows = Array.from(body.querySelectorAll('md-table-row')) as HTMLElement[];
      const numeric = column === 'salary' || column === 'projects' || column === 'rating';
      rows.sort((a, b) => {
        if (order === 'none' || !column) return Number(a.dataset.idx) - Number(b.dataset.idx);
        const av = cellText(a, column);
        const bv = cellText(b, column);
        const cmp = numeric
          ? parseFloat(av.replace(/[^0-9.-]/g, '')) - parseFloat(bv.replace(/[^0-9.-]/g, ''))
          : av.localeCompare(bv);
        return order === 'desc' ? -cmp : cmp;
      });
      // Plain mutation — md-table's built-in motion (motion="expressive")
      // brackets the sort event and FLIP-animates this reorder itself; a
      // manual flipRows wrap here would double-animate.
      rows.forEach((r) => body.appendChild(r));
      renderView();
    };

    const renderView = () => {
      const all = Array.from(document.querySelectorAll('#fdg-body md-table-row')) as HTMLElement[];
      const needle = query.trim().toLowerCase();
      const matched = all.filter((r) => {
        // Free-text search scans Name + Role.
        if (needle) {
          const hay = `${cellText(r, 'name')} ${cellText(r, 'role')}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        if (activeTeams.size) {
          const team = cellText(r, 'team');
          if (!activeTeams.has(team)) return false;
        }
        const salary = parseFloat(cellText(r, 'salary').replace(/[^0-9.]/g, ''));
        if (salary < salaryRange[0] || salary > salaryRange[1]) return false;
        const joined = cellText(r, 'joined'); // YYYY-MM-DD sorts lexically
        if (joinedFrom && joined < joinedFrom) return false;
        if (joinedTo && joined > joinedTo) return false;
        return true;
      });
      const total = matched.length;
      const lastPage = rowsPerPage > 0 ? Math.max(0, Math.ceil(total / rowsPerPage) - 1) : 0;
      if (page > lastPage) page = lastPage;
      const start = page * rowsPerPage;
      const end = rowsPerPage > 0 ? start + rowsPerPage : total;
      all.forEach((r) => (r.style.display = 'none'));
      matched.slice(start, end).forEach((r) => (r.style.display = ''));
      highlightMatches(query.trim());
      const tb = document.getElementById('fdg-toolbar') as any;
      if (tb) tb.supportingText = `${total} ${total === 1 ? t(globals.locale, 'table.person') : t(globals.locale, 'table.people')}`;
      const pag = document.getElementById('fdg-pag') as any;
      if (pag) {
        pag.count = total;
        pag.page = page;
      }
      const table = getTable();
      if (table) table.empty = total === 0; // show the empty state when nothing matches
    };
    requestAnimationFrame(renderView); // initial filter + page slice

    // Animated variant of renderView for DISCRETE FILTER changes (team facet,
    // joined-date) — no table event brackets those, so the story drives the
    // core flipRows export directly. Sort + page changes are animated by
    // md-table's built-in motion; rapid/continuous inputs (search typing,
    // salary slider drag) call renderView() directly so they stay instant.
    const flipRender = () => {
      const body = document.getElementById('fdg-body');
      if (body) flipRows(body, renderView, { spring: 'fast', stagger: 18, staggerCap: 6, enter: true });
      else renderView();
    };

    const setQuery = (q: string) => {
      query = q;
      page = 0;
      renderView();
    };

    const toggleTeam = (team: string, on: boolean) => {
      if (on) activeTeams.add(team);
      else activeTeams.delete(team);
      page = 0;
      flipRender();
    };

    const setSalaryRange = (lo: number, hi: number) => {
      salaryRange = [lo, hi];
      const lbl = document.getElementById('fdg-salary-label');
      if (lbl) lbl.textContent = `${t(globals.locale, 'table.salary')}: ${fmtK(lo)} – ${fmtK(hi)}`;
      page = 0;
      renderView();
    };
    const setJoined = (which: 'from' | 'to', value: string) => {
      if (which === 'from') joinedFrom = value;
      else joinedTo = value;
      page = 0;
      flipRender();
    };

    const toggleFilterBar = () => {
      const bar = document.getElementById('fdg-filterbar') as HTMLElement | null;
      if (!bar) return;
      const showing = bar.style.display !== 'none';
      if (showing) {
        // hide + reset all filters
        bar.style.display = 'none';
        query = '';
        activeTeams.clear();
        salaryRange = [SALARY_MIN, SALARY_MAX];
        joinedFrom = '';
        joinedTo = '';
        bar.querySelectorAll('md-chip').forEach((c) => ((c as HTMLElement & { selected: boolean }).selected = false));
        const tf = bar.querySelector('md-text-field') as (HTMLElement & { value: string }) | null;
        if (tf) tf.value = '';
        const slider = bar.querySelector('md-slider') as (HTMLElement & { valueStart: number; valueEnd: number }) | null;
        if (slider) {
          slider.valueStart = SALARY_MIN;
          slider.valueEnd = SALARY_MAX;
        }
        bar.querySelectorAll('md-date-picker').forEach((d) => ((d as HTMLElement & { value: string }).value = ''));
        const lbl = document.getElementById('fdg-salary-label');
        if (lbl) lbl.textContent = `${t(globals.locale, 'table.salary')}: ${fmtK(SALARY_MIN)} – ${fmtK(SALARY_MAX)}`;
        page = 0;
        renderView();
      } else {
        bar.style.display = '';
        try {
          (bar.querySelector('md-text-field') as HTMLElement | null)?.focus();
        } catch {
          /* focus is best-effort */
        }
      }
    };

    const exportCsv = () => {
      const rows = [
        ['Name', 'Role', 'Team', 'Availability', 'Salary', 'Joined', 'Location', 'Level', 'Projects', 'Manager', 'Rating'],
        ...PEOPLE.map((p, i) => [
          p.name,
          p.role,
          p.team,
          AVAIL[i % AVAIL.length],
          String(p.salary),
          p.joined,
          p.location,
          p.level,
          String(p.projects),
          p.manager,
          p.rating.toFixed(1),
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employees.csv';
      a.click();
      URL.revokeObjectURL(url);
    };

    // Pin-mode switch (kebab menu option): flips how MULTIPLE pinned columns
    // behave on horizontal scroll (stack = deck-of-cards, static =
    // side-by-side) and re-labels the menu item to name the OTHER mode.
    const togglePinMode = () => {
      const tbl = getTable();
      const item = document.getElementById('fdg-pinmode') as (HTMLElement & { headline: string }) | null;
      if (!tbl || !item) return;
      const next = tbl.getAttribute('pin-mode') === 'static' ? 'stack' : 'static';
      tbl.setAttribute('pin-mode', next);
      const glyph = item.querySelector('.material-symbols-outlined');
      // Label + icon advertise what a click will DO (switch to the other mode).
      item.headline = next === 'static' ? t(globals.locale, 'table.stackPinned') : t(globals.locale, 'table.unstackPinned');
      if (glyph) glyph.textContent = next === 'static' ? 'layers' : 'view_week';
    };

    const toggleMenu = () => {
      const m = document.getElementById('fdg-menu') as any;
      if (m) void (m.open ? m.close() : m.show());
    };

    // Reflect the current pins as checkmarks in the Fix-column submenu.
    const updateFixMenu = () => {
      document.querySelectorAll('#fdg-menu [data-fix]').forEach((item) => {
        const [side, key] = (item.getAttribute('data-fix') || '').split(':');
        (item as HTMLElement & { selected: boolean }).selected =
          pins.get(key) === (side === 'left' ? 'start' : 'end');
      });
    };

    // Pin a column to a side (toggles off if it's already pinned there). The
    // WHOLE mechanic — cell reorder, sticky attrs, template permutation and the
    // content-driven header floors (pin icon / sort arrow never clip) — is
    // md-table's own pinColumn(); the story only maps its column keys to
    // original indices and keeps the menu checkmarks in sync.
    const ORDER_KEYS = ['_select', ...FIX_COLS.map((c) => c.key)];
    // Toolbar > Columns: toggle visibility through the core API (same
    // ORIGINAL-index addressing as pinColumn); checkbox state mirrors the
    // component's answer (it refuses to hide the last visible column).
    const toggleColumnVisibility = (key: string) => {
      const table = getTable();
      if (!table) return;
      const item = document.querySelector(`[data-colvis="${key}"]`) as (HTMLElement & { selected: boolean }) | null;
      if (!item) return;
      // md-menu-item auto-toggles `selected` BEFORE emitting mdClick — the
      // fresh value already IS the desired visibility.
      const wantVisible = item.selected;
      void (table as HTMLElement & { setColumnVisibility: (c: number, v: boolean) => Promise<boolean> })
        .setColumnVisibility(ORDER_KEYS.indexOf(key), wantVisible)
        .then((visible) => {
          item.selected = visible; // mirror the component's answer (last-column guard)
        });
    };

    const pinColumn = (key: string, side: 'start' | 'end') => {
      const table = getTable();
      if (!table) return;
      const next = pins.get(key) === side ? 'none' : side;
      if (next === 'none') pins.delete(key);
      else pins.set(key, next);
      void table.pinColumn(ORDER_KEYS.indexOf(key), next);
      updateFixMenu();
    };

    return html`
      <style>
        .fdg-filterbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px 16px;
          padding: 4px 16px 16px;
        }
        /* Row 1: search + the two date pickers share one line. Align by the TOP
           of the fields (the date pickers carry a MM/DD/YYYY helper line below,
           so centering would push the shorter search field down). */
        .fdg-searchrow {
          flex: 1 0 100%;
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 12px;
        }
        /* Search takes half the row; the two date pickers split the other half
           (so each is a quarter). */
        .fdg-searchrow md-text-field {
          flex: 1 1 0;
          min-inline-size: 0;
        }
        .fdg-dates {
          display: flex;
          gap: 12px;
          flex: 1 1 0;
          min-inline-size: 0;
        }
        .fdg-dates md-date-picker {
          flex: 1 1 0;
          min-inline-size: 0;
        }
        /* Chips + salary each on their own line below. */
        .fdg-salary,
        .fdg-chips {
          flex: 1 0 100%;
        }
        .fdg-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .fdg-salary {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .fdg-salary md-slider {
          inline-size: 100%;
        }
        .fdg-field-label {
          font: 500 12px/16px Roboto, sans-serif;
          color: var(--md-sys-color-on-surface-variant, #49454f);
        }
        /* Search-match highlight inside Name / Role cells. */
        .fdg-hl {
          background: var(--md-sys-color-tertiary-container, #ffd8e4);
          color: var(--md-sys-color-on-tertiary-container, #31111d);
          border-radius: 3px;
          padding: 0 1px;
        }
      </style>
      <md-table-container max-height="520px" style="inline-size: 980px; max-inline-size: 100%;">
        <md-table-toolbar id="fdg-toolbar" slot="top" headline="${t(globals.locale, 'table.employees')}" supporting-text="${PEOPLE.length} ${t(globals.locale, 'table.people')}" auto-bind>
          <md-icon-button slot="actions" icon="filter_list" aria-label="Filter" @mdClick=${toggleFilterBar}></md-icon-button>
          <md-icon-button slot="actions" icon="download" aria-label="Export" @mdClick=${exportCsv}></md-icon-button>
          <md-icon-button id="fdg-more" slot="actions" icon="more_vert" aria-label="More" @mdClick=${toggleMenu}></md-icon-button>
          <md-icon-button slot="selection-actions" icon="delete" aria-label="Delete"></md-icon-button>
          <md-icon-button slot="selection-actions" icon="archive" aria-label="Archive"></md-icon-button>
          <md-icon-button slot="selection-actions" icon="forward_to_inbox" aria-label="Email"></md-icon-button>
        </md-table-toolbar>

        <div slot="top" id="fdg-filterbar" class="fdg-filterbar" style="display: none;">
          <div class="fdg-searchrow">
            <md-text-field
              variant="outlined"
              clearable="internal"
              placeholder="${t(globals.locale, 'table.searchNameRole')}"
              aria-label="Search employees"
              @mdInput=${(e: CustomEvent<string>) => setQuery(e.detail)}
              @mdChange=${(e: CustomEvent<string>) => setQuery(e.detail)}
              @mdClear=${() => setQuery('')}
            >
              <span slot="leading-icon" class="material-symbols-outlined">search</span>
            </md-text-field>
            <div class="fdg-dates">
              <md-date-picker
                variant="modal-input"
                clearable
                label="${t(globals.locale, 'table.joinedFrom')}"
                min="2022-01-01"
                max="2024-12-31"
                @mdChange=${(e: CustomEvent<{ value: string }>) => setJoined('from', e.detail.value)}
              ></md-date-picker>
              <md-date-picker
                variant="modal-input"
                clearable
                label="${t(globals.locale, 'table.joinedTo')}"
                min="2022-01-01"
                max="2024-12-31"
                @mdChange=${(e: CustomEvent<{ value: string }>) => setJoined('to', e.detail.value)}
              ></md-date-picker>
            </div>
          </div>
          <div class="fdg-chips" role="group" aria-label="Filter by team">
            ${TEAMS.map(
              (t) => html`
                <md-chip variant="filter" @mdSelect=${(e: CustomEvent<{ selected: boolean }>) => toggleTeam(t, e.detail.selected)}
                  >${t}</md-chip
                >
              `,
            )}
          </div>
          <div class="fdg-salary">
            <span id="fdg-salary-label" class="fdg-field-label">${t(globals.locale, 'table.salary')}: ${fmtK(SALARY_MIN)} – ${fmtK(SALARY_MAX)}</span>
            <md-slider
              range
              min=${SALARY_MIN}
              max=${SALARY_MAX}
              value-start=${SALARY_MIN}
              value-end=${SALARY_MAX}
              step="2500"
              aria-label="Salary range"
              @mdInput=${(e: CustomEvent<{ valueStart?: number; valueEnd?: number }>) =>
                setSalaryRange(e.detail.valueStart ?? SALARY_MIN, e.detail.valueEnd ?? SALARY_MAX)}
              @mdChange=${(e: CustomEvent<{ valueStart?: number; valueEnd?: number }>) =>
                setSalaryRange(e.detail.valueStart ?? SALARY_MIN, e.detail.valueEnd ?? SALARY_MAX)}
            ></md-slider>
          </div>
        </div>

        <md-table
          id="fdg-table"
          label="Employees"
          frozen-header
          selection="multiple"
          column-template="auto 200px 1fr 1fr auto auto auto auto auto auto auto auto"
          min-width="1500px"
          @mdSortChange=${(e: CustomEvent<{ column: string; order: string }>) =>
            applySort(e.detail.column, e.detail.order)}
        >
          <md-table-head>
            <md-table-row>
              <md-table-cell head padding="checkbox" sticky="start" data-col="_select">
                <md-checkbox
                  aria-label="Select all"
                  @mdChange=${(e: CustomEvent) => {
                    const t = (e.target as HTMLElement).closest('md-table-container')?.querySelector('md-table') as any;
                    void t?.toggleSelectAll();
                  }}
                ></md-checkbox>
              </md-table-cell>
              <md-table-cell head data-col="name">
                <md-table-sort-label column="name">${t(globals.locale, 'table.name')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head data-col="role">
                <md-table-sort-label column="role">${t(globals.locale, 'table.role')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head data-col="team">
                <md-table-sort-label column="team">${t(globals.locale, 'table.team')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head data-col="availability">
                <md-table-sort-label column="availability">${t(globals.locale, 'table.availability')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head numeric data-col="salary">
                <md-table-sort-label column="salary">${t(globals.locale, 'table.salary')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head data-col="joined">
                <md-table-sort-label column="joined">${t(globals.locale, 'table.joined')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head data-col="location">
                <md-table-sort-label column="location">${t(globals.locale, 'table.location')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head data-col="level">
                <md-table-sort-label column="level">${t(globals.locale, 'table.level')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head numeric data-col="projects">
                <md-table-sort-label column="projects">${t(globals.locale, 'table.projects')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head data-col="manager">
                <md-table-sort-label column="manager">${t(globals.locale, 'table.manager')}</md-table-sort-label>
              </md-table-cell>
              <md-table-cell head numeric data-col="rating">
                <md-table-sort-label column="rating">${t(globals.locale, 'table.rating')}</md-table-sort-label>
              </md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body id="fdg-body">
            ${PEOPLE.map(
              (p, i) => html`
                <md-table-row value=${p.id} data-idx=${i}>
                  <md-table-cell padding="checkbox" sticky="start" data-col="_select">
                    <md-checkbox
                      aria-label=${`Select ${p.name}`}
                      @mdChange=${(e: CustomEvent) => {
                        const checked = (e.detail as { checked: boolean }).checked;
                        const row = (e.target as HTMLElement).closest('md-table-row') as any;
                        if (row) row.selected = checked;
                      }}
                    ></md-checkbox>
                  </md-table-cell>
                  <md-table-cell data-col="name"><strong>${p.name}</strong></md-table-cell>
                  <md-table-cell data-col="role">${p.role}</md-table-cell>
                  <md-table-cell data-col="team">${p.team}</md-table-cell>
                  <md-table-cell data-col="availability">${AVAIL[i % AVAIL.length]}</md-table-cell>
                  <md-table-cell numeric data-col="salary">${fmtMoney(p.salary)}</md-table-cell>
                  <md-table-cell data-col="joined">${p.joined}</md-table-cell>
                  <md-table-cell data-col="location">${p.location}</md-table-cell>
                  <md-table-cell data-col="level">${p.level}</md-table-cell>
                  <md-table-cell numeric data-col="projects">${p.projects}</md-table-cell>
                  <md-table-cell data-col="manager">${p.manager}</md-table-cell>
                  <md-table-cell numeric data-col="rating">${p.rating.toFixed(1)}</md-table-cell>
                </md-table-row>
              `,
            )}
          </md-table-body>
          <div slot="empty" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <span class="material-symbols-outlined" style="font-size: 44px; color: var(--md-sys-color-on-surface-variant);">search_off</span>
            <p style="margin: 0; font: 500 16px Roboto, sans-serif;">${t(globals.locale, 'table.noEmployeesFound')}</p>
            <p style="margin: 0; color: var(--md-sys-color-on-surface-variant);">${t(globals.locale, 'table.noDataMatches')}</p>
          </div>
        </md-table>

        <md-table-pagination
          id="fdg-pag"
          slot="bottom"
          count=${PEOPLE.length}
          rows-per-page="5"
          rows-per-page-options="5,10,25,50"
          show-first-last
          label-displayed-rows="${t(globals.locale, 'table.fdgDisplayedRows')}"
          @mdPageChange=${(e: CustomEvent<{ page: number }>) => {
            // Plain re-slice: md-table-container hears this event in the
            // capture phase and arms the table's built-in FLIP motion.
            page = e.detail.page;
            renderView();
          }}
          @mdRowsPerPageChange=${(e: CustomEvent<{ rowsPerPage: number }>) => {
            rowsPerPage = e.detail.rowsPerPage;
            page = 0;
            renderView();
          }}
        ></md-table-pagination>
      </md-table-container>

      <!-- Overflow menu (3-dots). Placed outside the container so the container's
           overflow:hidden can't clip it. -->
      <md-menu id="fdg-menu" anchor="fdg-more" placement="bottom-end">
        <md-menu-item headline="${t(globals.locale, 'table.exportCsv')}" @mdClick=${exportCsv}>
          <span slot="leading-icon" class="material-symbols-outlined">download</span>
        </md-menu-item>
        <md-menu-item headline="${t(globals.locale, 'table.selectAll')}" @mdClick=${() => void getTable()?.selectAll()}>
          <span slot="leading-icon" class="material-symbols-outlined">select_all</span>
        </md-menu-item>
        <md-menu-item id="fdg-pinmode" keep-open headline="${t(globals.locale, 'table.unstackPinned')}" @mdClick=${togglePinMode}>
          <span slot="leading-icon" class="material-symbols-outlined">view_week</span>
        </md-menu-item>
        <md-sub-menu-item headline="${t(globals.locale, 'table.columns')}">
          <span slot="leading-icon" class="material-symbols-outlined">visibility</span>
          <md-menu slot="submenu" max-height="280">
            ${FIX_COLS.map(
              (c) => html`<md-menu-item
                type="checkbox"
                keep-open
                selected
                data-colvis=${c.key}
                headline=${c.label}
                @mdClick=${() => toggleColumnVisibility(c.key)}
              ></md-menu-item>`,
            )}
          </md-menu>
        </md-sub-menu-item>
        <md-sub-menu-item headline="${t(globals.locale, 'table.fixColumn')}" divider>
          <span slot="leading-icon" class="material-symbols-outlined">push_pin</span>
          <md-menu slot="submenu">
            <md-sub-menu-item headline="${t(globals.locale, 'table.left')}">
              <span slot="leading-icon" class="material-symbols-outlined">align_horizontal_left</span>
              <!-- Long column list: cap the flyout so it scrolls instead of
                   running off-screen. md-menu's max-height caps the height and
                   scrolls the overflowing items. -->
              <md-menu slot="submenu" max-height="280">
                ${FIX_COLS.map(
                  (c) => html`<md-menu-item
                    type="checkbox"
                    keep-open
                    data-fix=${`left:${c.key}`}
                    headline=${c.label}
                    @mdClick=${() => pinColumn(c.key, 'start')}
                  ></md-menu-item>`,
                )}
              </md-menu>
            </md-sub-menu-item>
            <md-sub-menu-item headline="${t(globals.locale, 'table.right')}">
              <span slot="leading-icon" class="material-symbols-outlined">align_horizontal_right</span>
              <md-menu slot="submenu" max-height="280">
                ${FIX_COLS.map(
                  (c) => html`<md-menu-item
                    type="checkbox"
                    keep-open
                    data-fix=${`right:${c.key}`}
                    headline=${c.label}
                    @mdClick=${() => pinColumn(c.key, 'end')}
                  ></md-menu-item>`,
                )}
              </md-menu>
            </md-sub-menu-item>
          </md-menu>
        </md-sub-menu-item>
        <md-menu-item
          headline="${t(globals.locale, 'table.compactDensity')}"
          type="checkbox"
          keep-open
          @mdClick=${(e: Event) => {
            const t = getTable();
            if (!t) return;
            t.density = t.density === 'compact' ? 'standard' : 'compact';
            (e.currentTarget as any).selected = t.density === 'compact';
          }}
        ></md-menu-item>
      </md-menu>
    `;
  },
};
