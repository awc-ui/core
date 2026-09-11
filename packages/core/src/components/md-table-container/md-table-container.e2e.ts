import { newE2EPage } from '@stencil/core/testing';

describe('md-table-container e2e', () => {
  it.each(['ltr', 'rtl'])('keeps top and bottom controls stationary while a mobile table scrolls (%s)', async (direction) => {
    const page = await newE2EPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.setContent(`<md-table-container dir="${direction}" style="width:100%;min-width:0">
      <md-table-toolbar slot="top" headline="Records"></md-table-toolbar>
      <md-table style="min-width:900px"><md-table-body><md-table-row>
        <md-table-cell>Wide record</md-table-cell><md-table-cell>Details</md-table-cell>
      </md-table-row></md-table-body></md-table>
      <md-table-pagination slot="bottom" count="20" rows-per-page="10"></md-table-pagination>
    </md-table-container>`);
    const measure = () => page.evaluate(() => {
      const host = document.querySelector('md-table-container')!;
      const scroll = host.shadowRoot!.querySelector('[part="scroll"]')!;
      const top = document.querySelector('md-table-toolbar')!.getBoundingClientRect();
      const bottom = document.querySelector('md-table-pagination')!.getBoundingClientRect();
      return { top: top.left, bottom: bottom.left, scroll: scroll.scrollLeft,
        available: scroll.scrollWidth - scroll.clientWidth,
        page: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    const before = await measure();
    await page.$eval('md-table-container', (host, dir: string) => {
      host.shadowRoot!.querySelector('[part="scroll"]')!.scrollLeft = dir === 'rtl' ? -240 : 240;
    }, direction);
    const after = await measure();
    expect(before.available).toBeGreaterThan(200);
    expect(Math.abs(after.scroll)).toBeGreaterThan(100);
    expect(after.top).toBeCloseTo(before.top, 0);
    expect(after.bottom).toBeCloseTo(before.bottom, 0);
    expect(after.page).toBeLessThanOrEqual(after.viewport);
  });

  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-container><div>content</div></md-table-container>');
    const el = await page.find('md-table-container');
    expect(el).toBeTruthy();
  });
});
