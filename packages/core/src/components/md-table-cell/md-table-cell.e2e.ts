import { newE2EPage } from '@stencil/core/testing';

describe('md-table-cell e2e', () => {
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
