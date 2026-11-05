import { newE2EPage } from '@stencil/core/testing';

const markup = `<md-table label="Invoices" selection="multiple" column-template="minmax(120px, 1fr) 120px 120px" row-count="100" row-offset="20">
  <md-table-head><md-table-row><md-table-cell padding="checkbox"><md-checkbox aria-label="Select all"></md-checkbox></md-table-cell><md-table-cell><md-table-sort-label column="name">Name</md-table-sort-label></md-table-cell><md-table-cell>Amount</md-table-cell></md-table-row></md-table-head>
  <md-table-body>
    <md-table-row value="a" selected><md-table-cell padding="checkbox"><md-checkbox aria-label="Select Alpha"></md-checkbox></md-table-cell><md-table-cell>Alpha</md-table-cell><md-table-cell>120</md-table-cell></md-table-row>
    <md-table-row value="b" selected><md-table-cell padding="checkbox"><md-checkbox aria-label="Select Beta"></md-checkbox></md-table-cell><md-table-cell>Beta</md-table-cell><md-table-cell>240</md-table-cell></md-table-row>
    <md-table-row value="c" disabled><md-table-cell padding="checkbox"><md-checkbox aria-label="Select Gamma"></md-checkbox></md-table-cell><md-table-cell>Gamma</md-table-cell><md-table-cell>360</md-table-cell></md-table-row>
  </md-table-body>
  <md-table-foot><md-table-row><md-table-cell>Total</md-table-cell><md-table-cell>3 invoices</md-table-cell><md-table-cell>720</md-table-cell></md-table-row></md-table-foot>
</md-table>`;

describe('md-table changing consumer contracts', () => {
  it('enforces single-selection when changing modes and maintains virtual row indices', async () => {
    const page = await newE2EPage(); await page.setContent(markup);
    const table = await page.find('md-table');
    expect(await table.callMethod('getSelection')).toEqual(expect.objectContaining({ count: 2, values: ['a', 'b'] }));
    expect((await page.find('md-table-body md-table-row[value="a"]')).getAttribute('aria-rowindex')).toBe('22');
    expect((await page.find('md-table-foot md-table-row')).getAttribute('aria-rowindex')).toBe('102');
    await table.setProperty('selection', 'single'); await page.waitForChanges();
    expect((await table.callMethod('getSelection')).values).toEqual(['a']);
    await table.callMethod('selectAll');
    expect((await table.callMethod('getSelection')).values).toEqual(['a']);
    expect(await (await page.find('md-table-head md-checkbox')).getProperty('disabled')).toBe(true);
    await (await page.find('md-table-row[value="b"] md-checkbox')).click(); await page.waitForChanges();
    expect((await table.callMethod('getSelection')).values).toEqual(['b']);
    expect((await page.find('md-table-row[value="a"]')).getAttribute('aria-selected')).toBe('false');
    expect((await page.find('md-table-row[value="c"]')).getAttribute('aria-selected')).toBeNull();
    await table.setProperty('selection', 'multiple'); await page.waitForChanges();
    expect(await (await page.find('md-table-head md-checkbox')).getProperty('disabled')).toBe(false);
    await table.callMethod('toggleSelectAll'); await page.waitForChanges();
    expect((await table.callMethod('getSelection')).values).toEqual(['a', 'b']);
    await table.setProperty('selection', 'none'); await page.waitForChanges();
    expect((await page.find('md-table-row[value="a"]')).getAttribute('aria-selected')).toBeNull();
  });

  it('pins both edges, stacks measured sticky offsets, preserves custom pin labels and restores columns', async () => {
    const page = await newE2EPage(); await page.setContent(markup);
    const table = await page.find('md-table');
    await table.setProperty('pinIcon', 'keep'); await page.waitForChanges();
    expect(await table.callMethod('pinColumn', 0, 'start')).toBe('start');
    expect(await table.callMethod('pinColumn', 1, 'start')).toBe('start');
    expect(await table.callMethod('pinColumn', 2, 'end')).toBe('end');
    await table.setProperty('pinMode', 'static'); await page.waitForChanges();
    const offsets = await page.evaluate(() => Array.from(document.querySelector('md-table-body md-table-row')!.querySelectorAll('md-table-cell'), cell => cell.style.getPropertyValue('--_sticky-offset')));
    expect(offsets[0]).toBe('0px'); expect(parseFloat(offsets[1])).toBeGreaterThan(0); expect(offsets[2]).toBe('0px');
    expect(await (await page.find('md-table-head md-table-cell[sticky="start"]')).getProperty('pinIcon')).toBe('keep');
    await table.setProperty('pinIcon', ''); await page.waitForChanges();
    expect((await page.find('md-table-head md-table-cell[sticky="start"]')).getAttribute('pin-icon')).toBeNull();
    await table.setProperty('pinMode', 'stack'); await page.waitForChanges();
    expect(await page.evaluate(() => document.querySelector<HTMLMdTableCellElement>('md-table-body md-table-row md-table-cell')!.style.getPropertyValue('--_sticky-offset'))).toBe('');
    expect(await table.callMethod('setColumnVisibility', -1, false)).toBe(true);
    expect(await table.callMethod('setColumnVisibility', 2, false)).toBe(false);
    expect(await table.callMethod('setColumnVisibility', 2, true)).toBe(true);
    await table.callMethod('pinColumn', 1, 'none'); await page.waitForChanges();
    expect((await page.find('md-table-body md-table-row md-table-cell:nth-child(2)')).textContent).toBe('Alpha');
  });

  it.each([
    ['repeat(3, 1fr)', '<md-table-cell>A</md-table-cell><md-table-cell>B</md-table-cell><md-table-cell>C</md-table-cell>'],
    ['1fr 1fr', '<md-table-cell colspan="2">A</md-table-cell>'],
    ['1fr 1fr 1fr', '<md-table-cell>A</md-table-cell><md-table-cell>B</md-table-cell>'],
  ])('refuses ambiguous column mutations atomically (%s)', async (template, cells) => {
    const page = await newE2EPage();
    await page.setContent(`<md-table label="Invalid pin layout" column-template="${template}"><md-table-body><md-table-row>${cells}</md-table-row></md-table-body></md-table>`);
    const table = await page.find('md-table');
    expect(await table.callMethod('pinColumn', 0, 'end')).toBeNull();
    expect(await table.callMethod('setColumnVisibility', 0, false)).toBe(true);
    expect(await page.findAll('md-table-cell[sticky="start"], md-table-cell[sticky="end"]')).toHaveLength(0);
    expect(await page.findAll('md-table-cell[data-md-col-hidden]')).toHaveLength(0);
    expect(table.getAttribute('column-template')).toBe(template);
  });
});
