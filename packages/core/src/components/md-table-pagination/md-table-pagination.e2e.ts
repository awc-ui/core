import { newE2EPage } from '@stencil/core/testing';

describe('md-table-pagination e2e', () => {
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
