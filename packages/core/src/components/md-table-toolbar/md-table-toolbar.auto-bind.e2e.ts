import { newE2EPage } from '@stencil/core/testing';

// Gate 1 (native parity): `auto-bind` documents that the toolbar's selection
// state "will track the table without any glue code". It only listened for
// FUTURE mdSelectionChange events from componentDidLoad: a toolbar added after
// rows were already selected showed 0, and a toolbar moved (disconnected and
// reconnected) lost its listener for good.
const markup = `<md-table-container><md-table selection="multiple" columns="1"><md-table-body>
  <md-table-row value="a"><md-table-cell>Alpha</md-table-cell></md-table-row>
  <md-table-row value="b"><md-table-cell>Beta</md-table-cell></md-table-row>
  <md-table-row value="c"><md-table-cell>Gamma</md-table-cell></md-table-row>
</md-table-body></md-table></md-table-container>`;

describe('md-table-toolbar auto-bind lifecycle', () => {
  it('seeds the count from the current selection when it binds late', async () => {
    const page = await newE2EPage();
    await page.setContent(markup);
    await (await page.find('md-table')).callMethod('selectAll');
    await page.waitForChanges();
    await page.evaluate(async () => {
      const toolbar = document.createElement('md-table-toolbar');
      toolbar.setAttribute('slot', 'top');
      toolbar.setAttribute('auto-bind', '');
      toolbar.setAttribute('headline', 'Orders');
      document.querySelector('md-table-container')!.prepend(toolbar);
      await (toolbar as any).componentOnReady();
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    await page.waitForChanges();
    expect(await (await page.find('md-table-toolbar')).getProperty('numSelected')).toBe(3);
    expect((await page.find('md-table-toolbar >>> [part="selection-caption"]')).textContent).toBe('3 selected');
  });

  it('keeps tracking the table after being moved (disconnect + reconnect)', async () => {
    const page = await newE2EPage();
    await page.setContent(markup.replace('<md-table ', '<md-table-toolbar slot="top" auto-bind headline="Orders"></md-table-toolbar><md-table '));
    const toolbar = await page.find('md-table-toolbar');
    const table = await page.find('md-table');
    await table.callMethod('selectAll');
    await page.waitForChanges();
    expect(await toolbar.getProperty('numSelected')).toBe(3);
    // Move: detach and re-attach in the same container (e.g. a framework re-order).
    await page.evaluate(() => {
      const t = document.querySelector('md-table-toolbar')!;
      const c = document.querySelector('md-table-container')!;
      t.remove();
      c.prepend(t);
    });
    await page.waitForChanges();
    await (await page.find('md-table-body md-table-row')).setProperty('selected', false);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    expect(await (await page.find('md-table-toolbar')).getProperty('numSelected')).toBe(2);
  });
});
