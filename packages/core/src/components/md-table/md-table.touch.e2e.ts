import { newE2EPage } from '@stencil/core/testing';
import type { Page } from 'puppeteer';

// Real touch input is essential for issue #6: assigning scrollLeft or firing
// a synthetic DOM TouchEvent still passes when overflow-x:hidden blocks swipes.
describe.each(['overlay', 'gutter'])('md-table native touch (%s)', (scrollbar) => {
  it.each(['ltr', 'rtl'])('pans both axes and synchronizes the frozen header in %s', async (dir) => {
    const page = await newE2EPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setContent(`
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <div dir="${dir}">
        <md-table-container max-height="220px" style="inline-size:calc(100vw - 32px)">
          <md-table frozen-header scrollbar="${scrollbar}" label="Watchlist" min-width="1200px"
            column-template="400px 400px 400px">
            <md-table-head><md-table-row>
              <md-table-cell head>Counterparty</md-table-cell>
              <md-table-cell head>Signal</md-table-cell>
              <md-table-cell head>Owner</md-table-cell>
            </md-table-row></md-table-head>
            <md-table-body>${Array.from({ length: 12 }, (_, i) => `
              <md-table-row><md-table-cell><a href="#opened">Company ${i}</a></md-table-cell>
                <md-table-cell>Review required</md-table-cell><md-table-cell>Analyst ${i}</md-table-cell>
              </md-table-row>`).join('')}
            </md-table-body>
          </md-table>
        </md-table-container>
      </div>`);
    await page.waitForChanges();
    const box = await page.evaluate(() => {
      const root = document.querySelector('md-table')!.shadowRoot!;
      const sc = root.querySelector('.md-table__body-scroll') as HTMLElement;
      const rect = sc.getBoundingClientRect();
      return {
        x: rect.x, y: rect.y, width: sc.clientWidth, height: sc.clientHeight,
        headerTop: root.querySelector('.md-table__head-scroll')!.getBoundingClientRect().top,
        available: sc.scrollWidth - sc.clientWidth,
      };
    });
    expect(box.available).toBeGreaterThan(800);
    const client = await (page as unknown as Page).createCDPSession();
    try {
      const swipe = async (x1: number, y1: number, x2: number, y2: number) => {
        const point = (x: number, y: number) => [{ x, y, radiusX: 4, radiusY: 4, id: 1 }];
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x1, y1) });
        for (let i = 1; i <= 12; i++) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: point(x1 + (x2 - x1) * i / 12, y1 + (y2 - y1) * i / 12),
          });
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await new Promise((resolve) => setTimeout(resolve, 300));
      };
      const left = box.x + 36;
      const right = box.x + box.width - 36;
      const y = box.y + Math.min(36, box.height / 2);
      await swipe(dir === 'rtl' ? left : right, y, dir === 'rtl' ? right : left, y);
      const horizontal = await page.evaluate(() => {
        const root = document.querySelector('md-table')!.shadowRoot!;
        const sc = root.querySelector('.md-table__body-scroll') as HTMLElement;
        const head = root.querySelector('.md-table__head-scroll') as HTMLElement;
        return {
          body: sc.scrollLeft, head: head.scrollLeft,
          customBar: getComputedStyle(root.querySelector('.md-table__hscroll')!).display,
          hash: location.hash,
        };
      });
      expect(Math.abs(horizontal.body)).toBeGreaterThan(60);
      expect(Math.abs(horizontal.body - horizontal.head)).toBeLessThanOrEqual(1);
      expect(horizontal.hash).not.toBe('#opened');
      expect(horizontal.customBar === 'none').toBe(scrollbar === 'gutter');

      // A horizontal fix must leave native vertical movement available too.
      await swipe(box.x + box.width / 2, box.y + box.height - 24, box.x + box.width / 2, box.y + 24);
      const vertical = await page.evaluate(() => {
        const root = document.querySelector('md-table')!.shadowRoot!;
        return {
          top: (root.querySelector('.md-table__body-scroll') as HTMLElement).scrollTop,
          headerTop: root.querySelector('.md-table__head-scroll')!.getBoundingClientRect().top,
        };
      });
      expect(vertical.top).toBeGreaterThan(20);
      expect(vertical.headerTop).toBeCloseTo(box.headerTop, 0);
    } finally {
      await client.detach();
      await page.close();
    }
  }, 60000);
});
