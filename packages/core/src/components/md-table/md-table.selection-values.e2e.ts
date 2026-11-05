import { newE2EPage } from '@stencil/core/testing';

// Gate 1 (native parity): rows without a `value` must be identified by their ROW
// index, as md-table-row documents ("Defaults to row index") and as the selection
// state documents ("value … or row index"). The table used the index within the
// SELECTED subset, and the row emitted an empty string.
const row = (cells: string, attrs = '') =>
  `<md-table-row ${attrs}><md-table-cell padding="checkbox"><md-checkbox aria-label="pick"></md-checkbox></md-table-cell>${cells}</md-table-row>`;
const markup = `<md-table selection="multiple" column-template="56px 1fr">
  <md-table-head><md-table-row><md-table-cell head padding="checkbox"></md-table-cell><md-table-cell head>Name</md-table-cell></md-table-row></md-table-head>
  <md-table-body>
    ${row('<md-table-cell>Zero</md-table-cell>', 'clickable')}
    ${row('<md-table-cell>One</md-table-cell>', 'clickable')}
    ${row('<md-table-cell>Two</md-table-cell>', 'clickable')}
    ${row('<md-table-cell>Three</md-table-cell>', 'clickable value="x3"')}
  </md-table-body>
</md-table>`;

describe('md-table row identity when rows have no value', () => {
  it('reports the row index (not the index within the selection) in getSelection and mdSelectionChange', async () => {
    const page = await newE2EPage();
    await page.setContent(markup);
    const changes = await page.spyOnEvent('mdSelectionChange');
    const rows = await page.findAll('md-table-body md-table-row');
    await rows[1].setProperty('selected', true);
    await page.waitForChanges();
    await rows[2].setProperty('selected', true);
    await page.waitForChanges();
    await rows[3].setProperty('selected', true);
    await page.waitForChanges();
    const table = await page.find('md-table');
    expect((await table.callMethod('getSelection')).values).toEqual(['1', '2', 'x3']);
    expect(changes.lastEvent.detail.values).toEqual(['1', '2', 'x3']);
  });

  it('emits the row index as the value of mdRowClick and mdRowSelectionChange', async () => {
    const page = await newE2EPage();
    await page.setContent(markup);
    const clicks = await page.spyOnEvent('mdRowClick');
    const rowSel = await page.spyOnEvent('mdRowSelectionChange');
    await (await page.find('md-table-body md-table-row:nth-child(3) md-table-cell:last-child')).click();
    await page.waitForChanges();
    expect(clicks.lastEvent.detail.value).toBe('2');
    await (await page.find('md-table-body md-table-row:nth-child(2)')).setProperty('selected', true);
    await page.waitForChanges();
    expect(rowSel.lastEvent.detail).toEqual({ selected: true, value: '1' });
    await (await page.find('md-table-body md-table-row:nth-child(4) md-table-cell:last-child')).click();
    await page.waitForChanges();
    expect(clicks.lastEvent.detail.value).toBe('x3');
  });
});
