import { newE2EPage } from '@stencil/core/testing';

describe('md-table-cell e2e', () => {
  it('keeps header scope, span semantics and pin affordance in sync with runtime column changes', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-cell head scope="rowgroup" sticky="end" pin-icon="anchor" colspan="2" rowspan="3">Total</md-table-cell>');
    const cell = await page.find('md-table-cell');
    expect(cell.getAttribute('role')).toBe('rowheader');
    expect(cell.getAttribute('aria-colspan')).toBe('2');
    expect(cell.getAttribute('aria-rowspan')).toBe('3');
    const pin = await page.find('md-table-cell >>> [part="pin"]');
    expect(pin.textContent).toBe('anchor');
    expect(pin.getAttribute('title')).toBe('Pinned right');
    await cell.setProperty('scope', 'colgroup');
    await cell.setProperty('noPinIndicator', true);
    await cell.setProperty('colSpan', 1);
    await cell.setProperty('rowSpan', 1);
    await page.waitForChanges();
    expect(cell.getAttribute('role')).toBe('columnheader');
    expect(cell.getAttribute('aria-colspan')).toBeNull();
    expect(await page.find('md-table-cell >>> [part="pin"]')).toBeNull();
    await cell.setProperty('noPinIndicator', false);
    await cell.setProperty('padding', 'checkbox');
    await page.waitForChanges();
    expect(await page.find('md-table-cell >>> [part="pin"]')).toBeNull();
  });
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-cell>data</md-table-cell>');
    const el = await page.find('md-table-cell');
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('cell');
  });

  it('inherits row state via cast custom properties (selected row recolors its cells)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table column-template="1fr">
        <md-table-body>
          <md-table-row id="plain"><md-table-cell>data</md-table-cell></md-table-row>
          <md-table-row id="sel" selected><md-table-cell>data</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    await page.waitForChanges();
    const colors = await page.evaluate(() => {
      const color = (rowId: string) =>
        getComputedStyle(document.querySelector(`#${rowId} md-table-cell`)!).color;
      return { plain: color('plain'), selected: color('sel') };
    });
    expect(colors.selected).not.toBe(colors.plain); // on-secondary-container cast
    const bg = await page.evaluate(
      () => getComputedStyle(document.getElementById('sel')!).backgroundColor,
    );
    expect(bg).not.toBe('rgba(0, 0, 0, 0)'); // the row itself paints the selection
  });
});
