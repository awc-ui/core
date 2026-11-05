import { newE2EPage } from '@stencil/core/testing';

// Gate 7 (d5): md-table-row `selectable="false"` takes no part in selection — click, its checkbox and select-all skip it
// (readme; selectAll(): "select all selectable body rows"). getSelectableRows() only excluded head / foot rows, so
// select-all selected the unselectable row too: its selected state, mdRowSelectionChange and selected background.
const markup = `<md-table selection="multiple">
  <md-table-head><md-table-row><md-table-cell head padding="checkbox"><md-checkbox aria-label="Select all rows"></md-checkbox></md-table-cell><md-table-cell head>Name</md-table-cell></md-table-row></md-table-head>
  <md-table-body>
    <md-table-row value="a"><md-table-cell padding="checkbox"><md-checkbox aria-label="Select A"></md-checkbox></md-table-cell><md-table-cell>A</md-table-cell></md-table-row>
    <md-table-row value="b" selectable="false"><md-table-cell padding="checkbox"><md-checkbox aria-label="Select B"></md-checkbox></md-table-cell><md-table-cell>B</md-table-cell></md-table-row>
    <md-table-row value="c"><md-table-cell padding="checkbox"><md-checkbox aria-label="Select C"></md-checkbox></md-table-cell><md-table-cell>C</md-table-cell></md-table-row>
  </md-table-body></md-table>`;

describe('md-table select-all and selectable="false"', () => {
  for (const how of ['method', 'checkbox'] as const) {
    it(`skips an unselectable row (${how})`, async () => {
      const page = await newE2EPage();
      await page.setContent(markup);
      await page.waitForChanges();
      const rowEvents = await page.spyOnEvent('mdRowSelectionChange');
      if (how === 'method') await page.$eval('md-table', (t: any) => t.selectAll());
      else await (await page.find('md-table-head md-checkbox')).click();
      await page.waitForChanges();
      const state = await page.$$eval('md-table-body md-table-row', (rows) => rows.map((r: any) => ({ v: r.value, sel: !!r.selected, aria: r.getAttribute('aria-selected') })));
      expect(state).toEqual([{ v: 'a', sel: true, aria: 'true' }, { v: 'b', sel: false, aria: null }, { v: 'c', sel: true, aria: 'true' }]);
      expect(rowEvents.events.map((e) => e.detail.value)).toEqual(['a', 'c']);
      await page.$eval('md-table', (t: any) => t.deselectAll());
      await page.waitForChanges();
      expect(await page.$$eval('md-table-body md-table-row', (rows) => rows.map((r: any) => !!r.selected))).toEqual([false, false, false]);
      expect(rowEvents.events.map((e) => `${e.detail.value}:${e.detail.selected}`)).toEqual(['a:true', 'c:true', 'a:false', 'c:false']);
    });
  }
});
