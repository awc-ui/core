import { newSpecPage } from '@stencil/core/testing';
import { MdTable } from './md-table';
import { MdTableHead } from '../md-table-head/md-table-head';
import { MdTableRow } from '../md-table-row/md-table-row';
import { MdTableCell } from '../md-table-cell/md-table-cell';
import { MdTableSortLabel } from '../md-table-sort-label/md-table-sort-label';

const components = [MdTable, MdTableHead, MdTableRow, MdTableCell, MdTableSortLabel];
const header = (attributes = '') => `<md-table-head><md-table-row>
  <md-table-cell><md-table-sort-label ${attributes}>Name</md-table-sort-label></md-table-cell>
</md-table-row></md-table-head>`;

describe('md-table — property-driven sort labels', () => {
  it('cycles a property-only column through ascending, descending, and cleared indicators', async () => {
    const page = await newSpecPage({ components, html: `<md-table>${header()}</md-table>` });
    const label = page.root!.querySelector('md-table-sort-label')!;
    const cell = label.closest('md-table-cell')!;
    label.column = 'name';
    expect(label.hasAttribute('column')).toBe(false);

    for (const [order, aria] of [['asc', 'ascending'], ['desc', 'descending'], ['none', 'none']]) {
      label.click();
      await page.waitForChanges();
      expect(label.order).toBe(order);
      expect(label.active).toBe(order !== 'none');
      expect(cell.getAttribute('aria-sort')).toBe(aria);
      expect(label.shadowRoot!.querySelector('[part="icon"]')!.classList.contains('md-table-sort-label__icon--desc'))
        .toBe(order === 'desc');
    }
  });

  it('uses live property changes over a stale attribute, including an explicit empty column', async () => {
    const page = await newSpecPage({
      components,
      html: `<md-table sort-by="name" sort-order="desc">${header('column="name"')}</md-table>`,
    });
    const label = page.root!.querySelector('md-table-sort-label')!;
    const cell = label.closest('md-table-cell')!;
    expect(label.active).toBe(true);

    label.column = 'age';
    await page.waitForChanges();
    expect(label.getAttribute('column')).toBe('name');
    expect(label.active).toBe(false);
    expect(cell.getAttribute('aria-sort')).toBe('none');

    await page.root!.setSort('age', 'desc');
    await page.waitForChanges();
    expect(label.order).toBe('desc');
    expect(cell.getAttribute('aria-sort')).toBe('descending');

    label.column = '';
    await page.waitForChanges();
    await page.root!.setSort('name', 'asc');
    await page.waitForChanges();
    expect(label.getAttribute('column')).toBe('name');
    expect(label.active).toBe(false);
    expect(label.order).toBe('none');
    expect(cell.getAttribute('aria-sort')).toBe('none');
  });

  it('initializes a label inserted inside an existing header cell from the current sort state', async () => {
    const page = await newSpecPage({
      components,
      html: '<md-table sort-by="name" sort-order="desc"><md-table-head><md-table-row><md-table-cell></md-table-cell></md-table-row></md-table-head></md-table>',
    });
    const cell = page.root!.querySelector('md-table-cell')!;
    const label = page.doc.createElement('md-table-sort-label');
    label.column = 'name';
    cell.appendChild(label);
    await page.waitForChanges();

    expect(label.active).toBe(true);
    expect(label.order).toBe('desc');
    expect(cell.getAttribute('aria-sort')).toBe('descending');
  });

  it('restamps replacement header labels and supports not-yet-upgraded attribute bindings', async () => {
    const page = await newSpecPage({
      components: [MdTable, MdTableHead, MdTableRow, MdTableCell],
      html: `<md-table sort-by="name" sort-order="desc">${header('column="old"')}</md-table>`,
    });
    const head = page.root!.querySelector('md-table-head')!;
    head.innerHTML = '<md-table-row><md-table-cell><md-table-sort-label column="name">Name</md-table-sort-label></md-table-cell></md-table-row>';
    // mock-doc does not dispatch native slotchange after DOM mutations.
    head.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    const label = head.querySelector('md-table-sort-label')!;

    expect(label.column).toBeUndefined();
    expect(label.active).toBe(true);
    expect(label.order).toBe('desc');
    expect(label.closest('md-table-cell')!.getAttribute('aria-sort')).toBe('descending');
  });

  it('leaves nested table indicators under their nearest table owner', async () => {
    const page = await newSpecPage({
      components,
      html: `<md-table sort-by="age" sort-order="asc">${header('column="age"')}
        <md-table-row><md-table-cell><md-table id="inner" sort-by="name" sort-order="desc">${header('column="name"')}</md-table></md-table-cell></md-table-row>
      </md-table>`,
    });
    const inner = page.root!.querySelector('#inner') as HTMLMdTableElement;
    const label = inner.querySelector('md-table-sort-label')!;
    expect(label.order).toBe('desc');

    await page.root!.setSort('name', 'asc');
    await page.waitForChanges();
    expect(label.order).toBe('desc');

    label.column = 'age';
    await page.waitForChanges();
    expect(label.active).toBe(false);
    await inner.setSort('age', 'desc');
    await page.waitForChanges();
    expect(label.order).toBe('desc');
    expect(label.closest('md-table-cell')!.getAttribute('aria-sort')).toBe('descending');
  });
});
