/**
 * Axe (WCAG 2.1 A/AA) sweep + ARIA-contract checks for the composable
 * md-table family, mapped to the W3C WAI Tables tutorial patterns:
 *   - one header row (columnheader roles)
 *   - two headers (row headers via head scope="row")
 *   - irregular / multi-level headers (colspan groups → aria-colspan)
 *   - caption & summary association
 *   - selection state exposure (aria-selected only where meaningful)
 *   - pagination positions (aria-rowcount / aria-rowindex)
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdTable } from './md-table';
import { MdTableHead } from '../md-table-head/md-table-head';
import { MdTableBody } from '../md-table-body/md-table-body';
import { MdTableFoot } from '../md-table-foot/md-table-foot';
import { MdTableRow } from '../md-table-row/md-table-row';
import { MdTableCell } from '../md-table-cell/md-table-cell';
import { MdTableSortLabel } from '../md-table-sort-label/md-table-sort-label';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [
  MdTable,
  MdTableHead,
  MdTableBody,
  MdTableFoot,
  MdTableRow,
  MdTableCell,
  MdTableSortLabel,
];
const wrap = (inner: string) => `<body><h1>Page</h1><main>${inner}</main></body>`;

const create = (html: string) => newSpecPage({ components: COMPONENTS, html });

/** The table ROLE lives on the shadow structural wrapper (the host also
 *  carries caption/live-region/overlays, which the table content model
 *  forbids as children). */
const tableEl = (page: { root?: HTMLElement | null }) =>
  page.root!.shadowRoot!.querySelector('[role="table"]')!;


const ONE_HEADER = `
  <md-table caption="Concerts">
    <md-table-head>
      <md-table-row>
        <md-table-cell head>Date</md-table-cell>
        <md-table-cell head>Event</md-table-cell>
        <md-table-cell head>Venue</md-table-cell>
      </md-table-row>
    </md-table-head>
    <md-table-body>
      <md-table-row>
        <md-table-cell>12 Feb</md-table-cell>
        <md-table-cell>Waltz with Strauss</md-table-cell>
        <md-table-cell>Main Hall</md-table-cell>
      </md-table-row>
    </md-table-body>
  </md-table>
`;

const TWO_HEADERS = `
  <md-table label="Delivery slots">
    <md-table-head>
      <md-table-row>
        <md-table-cell></md-table-cell>
        <md-table-cell head>Monday</md-table-cell>
        <md-table-cell head>Tuesday</md-table-cell>
      </md-table-row>
    </md-table-head>
    <md-table-body>
      <md-table-row>
        <md-table-cell head scope="row">09:00 – 11:00</md-table-cell>
        <md-table-cell>Closed</md-table-cell>
        <md-table-cell>Open</md-table-cell>
      </md-table-row>
    </md-table-body>
  </md-table>
`;

const IRREGULAR = `
  <md-table label="Poster availability" summary="Columns are grouped by size under each poster name." columns="4">
    <md-table-head>
      <md-table-row>
        <md-table-cell></md-table-cell>
        <md-table-cell head scope="colgroup" colspan="3">Sizes</md-table-cell>
      </md-table-row>
      <md-table-row>
        <md-table-cell head>Poster</md-table-cell>
        <md-table-cell head>A2</md-table-cell>
        <md-table-cell head>A3</md-table-cell>
        <md-table-cell head>A4</md-table-cell>
      </md-table-row>
    </md-table-head>
    <md-table-body>
      <md-table-row>
        <md-table-cell head scope="row">Zen garden</md-table-cell>
        <md-table-cell>Yes</md-table-cell>
        <md-table-cell>Yes</md-table-cell>
        <md-table-cell>No</md-table-cell>
      </md-table-row>
    </md-table-body>
  </md-table>
`;

describe('md-table · axe (WAI tables tutorial patterns)', () => {
  it('one-header table — no violations', async () => {
    const page = await create(ONE_HEADER);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('two-headers table (row headers) — no violations', async () => {
    const page = await create(TWO_HEADERS);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('irregular (grouped colspan) table — no violations', async () => {
    const page = await create(IRREGULAR);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('selectable + sortable table — no violations', async () => {
    const page = await create(`
      <md-table label="Employees" selection="multiple">
        <md-table-head>
          <md-table-row>
            <md-table-cell head>
              <md-table-sort-label column="name">Name</md-table-sort-label>
            </md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row selected><md-table-cell>Ada</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>Alan</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  // Expandable rows stamp aria-expanded on the ROW host — a conditional row
  // property that is valid only inside a treegrid (axe aria-conditional-attr
  // flags it on a plain table row). So the structural element promotes from
  // role="table" to role="treegrid" whenever any row is expandable.
  it('expandable-rows table promotes to role="treegrid" (rows may carry aria-expanded) — no violations', async () => {
    const page = await create(`
      <md-table label="Files">
        <md-table-head>
          <md-table-row>
            <md-table-cell head>Details</md-table-cell>
            <md-table-cell head>Name</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row expandable>
            <md-table-cell></md-table-cell>
            <md-table-cell>Report.pdf</md-table-cell>
            <div slot="expanded">Details about Report.pdf</div>
          </md-table-row>
          <md-table-row>
            <md-table-cell></md-table-cell>
            <md-table-cell>Notes.txt</md-table-cell>
          </md-table-row>
        </md-table-body>
      </md-table>
    `);
    const sr = page.root!.shadowRoot!;
    expect(sr.querySelector('[role="treegrid"]')).toBeTruthy();
    expect(sr.querySelector('[role="table"]')).toBeNull();
    // aria-expanded stays on the row host (the expand-toggle mirrors it too).
    const bodyRow = page.body.querySelector('md-table-body md-table-row');
    expect(bodyRow!.getAttribute('aria-expanded')).toBe('false');
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  // A table with NO expandable rows stays a plain role="table".
  it('non-expandable table keeps role="table"', async () => {
    const page = await create(ONE_HEADER);
    const sr = page.root!.shadowRoot!;
    expect(sr.querySelector('[role="table"]')).toBeTruthy();
    expect(sr.querySelector('[role="treegrid"]')).toBeNull();
  });

  // Frozen header splits the table into a separate (clipped) header grid and a
  // scrollable body grid. The body scroller is a focusable tab stop (keyboard
  // scroll of the capped body), and a focusable element may not be a bare child
  // of role="table" — only rowgroup/row are allowed (axe aria-required-children).
  // So the body scroller IS the body rowgroup, and the slotted body/foot drop to
  // presentation so their rows promote into it rather than nesting a rowgroup.
  it('frozen-header table (rowgroup scroll wrapper) — valid content model, no violations', async () => {
    const page = await create(`
      <md-table frozen-header label="Employees" column-template="1.5fr 1fr 1fr">
        <md-table-head>
          <md-table-row>
            <md-table-cell head scope="col">
              <md-table-sort-label column="name">Name</md-table-sort-label>
            </md-table-cell>
            <md-table-cell head scope="col">Role</md-table-cell>
            <md-table-cell head scope="col" numeric>Salary</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row><md-table-cell>Ada</md-table-cell><md-table-cell>Eng</md-table-cell><md-table-cell numeric>100</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>Alan</md-table-cell><md-table-cell>Eng</md-table-cell><md-table-cell numeric>90</md-table-cell></md-table-row>
        </md-table-body>
        <md-table-foot>
          <md-table-row><md-table-cell>Total</md-table-cell><md-table-cell></md-table-cell><md-table-cell numeric>190</md-table-cell></md-table-row>
        </md-table-foot>
      </md-table>
    `);
    const sr = page.root!.shadowRoot!;
    // The focusable body scroller carries the body rowgroup role...
    expect(sr.querySelector('.md-table__body-scroll')!.getAttribute('role')).toBe('rowgroup');
    // ...its inner grid is layout-only...
    expect(sr.querySelector('.md-table__grid--body')!.getAttribute('role')).toBe('presentation');
    // ...and the slotted body/foot step down to presentation (no nested rowgroup)
    // while the head — in the presentational header wrapper — keeps its rowgroup.
    expect(page.body.querySelector('md-table-body')!.getAttribute('role')).toBe('presentation');
    expect(page.body.querySelector('md-table-foot')!.getAttribute('role')).toBe('presentation');
    expect(page.body.querySelector('md-table-head')!.getAttribute('role')).toBe('rowgroup');
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  // Toggling frozen off must restore the slotted body/foot to real rowgroups
  // (they are then direct children of role="table").
  it('non-frozen table keeps slotted body/foot as rowgroups', async () => {
    const page = await create(ONE_HEADER);
    expect(page.body.querySelector('md-table-body')!.getAttribute('role')).toBe('rowgroup');
  });
});

describe('md-table · ARIA contract', () => {
  it('caption names the table when no explicit label is set', async () => {
    const page = await create(ONE_HEADER);
    expect(tableEl(page).getAttribute('aria-label')).toBe('Concerts');
  });

  it('summary is exposed as aria-description', async () => {
    const page = await create(IRREGULAR);
    expect(tableEl(page).getAttribute('aria-description')).toContain('grouped by size');
  });

  it('spanning header cells expose aria-colspan', async () => {
    const page = await create(IRREGULAR);
    const group = page.body.querySelector('md-table-cell[colspan="3"]');
    expect(group?.getAttribute('aria-colspan')).toBe('3');
    expect(group?.getAttribute('role')).toBe('columnheader');
  });

  it('head scope="row" renders role="rowheader"', async () => {
    const page = await create(TWO_HEADERS);
    const rh = page.body.querySelector('md-table-cell[scope="row"]');
    expect(rh?.getAttribute('role')).toBe('rowheader');
  });

  it('aria-sort is stamped on the columnheader cell, not the sort button', async () => {
    const page = await create(`
      <md-table label="E" sort-by="name" sort-order="asc">
        <md-table-head>
          <md-table-row>
            <md-table-cell head>
              <md-table-sort-label column="name">Name</md-table-sort-label>
            </md-table-cell>
            <md-table-cell head>
              <md-table-sort-label column="role">Role</md-table-sort-label>
            </md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row><md-table-cell>a</md-table-cell><md-table-cell>b</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    const cells = page.body.querySelectorAll('md-table-cell[head]');
    expect(cells[0].getAttribute('aria-sort')).toBe('ascending');
    expect(cells[1].getAttribute('aria-sort')).toBe('none');
    const label = page.body.querySelector('md-table-sort-label');
    expect(label?.hasAttribute('aria-sort')).toBe(false);
  });

  it('aria-selected appears only on body rows of a selection-enabled table', async () => {
    const page = await create(`
      <md-table label="E" selection="multiple">
        <md-table-head>
          <md-table-row><md-table-cell head>Name</md-table-cell></md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row selected><md-table-cell>Ada</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>Alan</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    const rows = page.body.querySelectorAll('md-table-row');
    expect(rows[0].hasAttribute('aria-selected')).toBe(false); // head row
    expect(rows[1].getAttribute('aria-selected')).toBe('true');
    expect(rows[2].getAttribute('aria-selected')).toBe('false');
  });

  it('read-only tables expose NO aria-selected anywhere', async () => {
    const page = await create(ONE_HEADER);
    expect(page.body.querySelector('md-table-row[aria-selected]')).toBeNull();
  });

  it('row-count + row-offset stamp aria-rowcount / aria-rowindex', async () => {
    const page = await create(`
      <md-table label="E" row-count="100" row-offset="40">
        <md-table-head>
          <md-table-row><md-table-cell head>Name</md-table-cell></md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row><md-table-cell>a</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>b</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    // 100 data rows + 1 header row
    expect(tableEl(page).getAttribute('aria-rowcount')).toBe('101');
    const rows = page.body.querySelectorAll('md-table-row');
    expect(rows[0].getAttribute('aria-rowindex')).toBe('1'); // header
    expect(rows[1].getAttribute('aria-rowindex')).toBe('42'); // 1 head + offset 40 + 1
    expect(rows[2].getAttribute('aria-rowindex')).toBe('43');
  });
});
