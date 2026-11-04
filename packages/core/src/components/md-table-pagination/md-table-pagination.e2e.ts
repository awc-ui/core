import { newE2EPage } from '@stencil/core/testing';

describe('md-table-pagination e2e', () => {
  it('navigates each boundary, clamps changing datasets and rejects invalid page sizes', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-pagination count="23" rows-per-page="5" show-first-last style="--md-sys-density-scale:-4"></md-table-pagination>');
    const pagination = await page.find('md-table-pagination');
    const changes = await pagination.spyOnEvent('mdPageChange');
    for (const [part, expected] of [['last', 4], ['prev', 3], ['first', 0], ['next', 1]] as const) {
      await (await page.find(`md-table-pagination >>> [part="${part}-button"]`)).click();
      expect(await pagination.getProperty('page')).toBe(expected);
      expect(changes.lastEvent.detail).toEqual({ page: expected });
    }
    await pagination.callMethod('goToPage', 99);
    expect(await pagination.getProperty('page')).toBe(4);
    await pagination.callMethod('setRowsPerPage', 10);
    await pagination.callMethod('setRowsPerPage', 0);
    await pagination.callMethod('setRowsPerPage', 10);
    expect(await pagination.getProperty('rowsPerPage')).toBe(10);
    expect(await pagination.getProperty('page')).toBe(0);
    await pagination.callMethod('goToPage', 2);
    await pagination.setProperty('count', 0);
    await page.waitForChanges();
    expect((await page.find('md-table-pagination >>> [part="display"]')).textContent).toBe('0–0 of 0');
    expect(await pagination.getProperty('page')).toBe(0);
    expect(await (await page.find('md-table-pagination >>> md-select')).getProperty('density')).toBe(-4);
  });

  it('changes page size through the real selector without leaking its internal change event', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-pagination count="23" page="2" rows-per-page="5" rows-per-page-options="5,,bad,0,-1,ALL,10"></md-table-pagination>');
    const pagination = await page.find('md-table-pagination');
    const changes = await pagination.spyOnEvent('mdRowsPerPageChange');
    const leaked = await page.spyOnEvent('mdChange');
    const select = await page.find('md-table-pagination >>> md-select');
    expect(await select.getProperty('options')).toEqual([{ value: '5', label: '5' }, { value: '23', label: 'All' }, { value: '10', label: '10' }]);
    await select.callMethod('show');
    await page.waitForChanges();
    await page.waitForFunction(() => !!document.querySelector('md-table-pagination')!.shadowRoot!.querySelector('md-select')!.shadowRoot!.querySelector('md-menu-item[id$="-opt-23"]'));
    await page.evaluate(() => (document.querySelector('md-table-pagination')!.shadowRoot!.querySelector('md-select')!.shadowRoot!.querySelector('md-menu-item[id$="-opt-23"]') as HTMLElement).click());
    await page.waitForChanges();
    expect(changes.lastEvent.detail).toEqual({ rowsPerPage: 23 });
    expect(await pagination.getProperty('page')).toBe(0);
    expect((await page.find('md-table-pagination >>> [part="display"]')).textContent).toBe('1–23 of 23');
    expect(leaked).not.toHaveReceivedEvent();
  });
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-pagination count="100"></md-table-pagination>');
    const el = await page.find('md-table-pagination');
    expect(el).toBeTruthy();
  });

  it('clicking next emits mdPageChange', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-pagination count="50" rows-per-page="10"></md-table-pagination>');
    const pag = await page.find('md-table-pagination');
    const ev = await pag.spyOnEvent('mdPageChange');
    const next = await page.find('md-table-pagination >>> [part="next-button"]');
    await next.click();
    await page.waitForChanges();
    expect(ev).toHaveReceivedEvent();
    expect(ev).toHaveReceivedEventDetail({ page: 1 });
  });
});
