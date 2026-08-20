import { newE2EPage } from '@stencil/core/testing';

describe('md-slider responsive sizing', () => {
  it('horizontal slider fills its container width', async () => {
    const page = await newE2EPage();
    await page.setContent(`<div style="width:600px;"><md-slider value="50"></md-slider></div>`);
    await page.waitForChanges();
    const w = await page.evaluate(() =>
      Math.round(document.querySelector('md-slider')!.getBoundingClientRect().width),
    );
    expect(w).toBe(600);
  }, 60000);

  it('vertical full-height fills a definite-height parent, falls back otherwise', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="tall" style="height:360px;">
        <md-slider orientation="vertical" full-height value="50"></md-slider>
      </div>
      <div id="auto" style="display:inline-block;">
        <md-slider orientation="vertical" full-height value="50"></md-slider>
      </div>
      <div id="fixed" style="display:inline-block;">
        <md-slider orientation="vertical" value="50"></md-slider>
      </div>
    `);
    await page.waitForChanges();
    const r = await page.evaluate(() => {
      const h = (sel: string) =>
        Math.round(document.querySelector(sel)!.getBoundingClientRect().height);
      return { tall: h('#tall md-slider'), auto: h('#auto md-slider'), fixed: h('#fixed md-slider') };
    });
    // Fills the 360px parent.
    expect(r.tall).toBe(360);
    // Indefinite-height parent → small usable floor (88px), not 0 (no collapse).
    expect(r.auto).toBe(88);
    // Without full-height it stays the fixed track length.
    expect(r.fixed).toBe(200);
  }, 60000);

  it('shrinks to fit a small container instead of overflowing / clipping (the reported bug)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="box" style="height:120px; overflow:auto;">
        <md-slider id="s" orientation="vertical" full-height value="40"></md-slider>
      </div>
    `);
    await page.waitForChanges();
    const r = await page.evaluate(() => {
      const box = document.getElementById('box')!;
      const sr = document.getElementById('s')!.shadowRoot!;
      const h = (el: Element) => Math.round(el.getBoundingClientRect().height);
      const host = document.getElementById('s')!;
      const rail = sr.querySelector('.md-slider__rail')!;
      const thumb = sr.querySelector('.md-slider__thumb')!;
      return {
        host: h(host),
        rail: h(rail),
        // Thumb must stay within the container (not clipped below it).
        thumbBottom: Math.round(thumb.getBoundingClientRect().bottom),
        boxBottom: Math.round(box.getBoundingClientRect().bottom),
        scrolls: box.scrollHeight > box.clientHeight + 1,
      };
    });
    expect(r.host).toBe(120); // fits the box exactly — no 200px overflow
    expect(r.rail).toBeLessThanOrEqual(120); // rail shrank too
    expect(r.scrolls).toBe(false); // nothing clipped / no scrollbar
    expect(r.thumbBottom).toBeLessThanOrEqual(r.boxBottom + 1); // thumb inside the box
  }, 60000);

  it('the visible rail (not just the host) fills the container at full-height', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<div style="height:360px;"><md-slider id="s" orientation="vertical" full-height value="40"></md-slider></div>`,
    );
    await page.waitForChanges();
    const rail = await page.evaluate(() =>
      Math.round(
        document
          .getElementById('s')!
          .shadowRoot!.querySelector('.md-slider__rail')!
          .getBoundingClientRect().height,
      ),
    );
    // The rail used to be pinned at the 200px track length even when the host grew.
    expect(rail).toBeGreaterThan(330);
  }, 60000);

  it('dragging maps to value across the responsive height', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<div style="height:360px;"><md-slider id="s" orientation="vertical" full-height value="50"></md-slider></div>`,
    );
    await page.waitForChanges();
    const rect = await page.evaluate(() => {
      const r = document
        .getElementById('s')!
        .shadowRoot!.querySelector('.md-slider__rail')!
        .getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, midX: Math.round(r.left + r.width / 2) };
    });
    // Click near the top of the (tall) rail → value should go high.
    await page.mouse.click(rect.midX, Math.round(rect.top + 8));
    await page.waitForChanges();
    const high = await page.evaluate(() => (document.getElementById('s') as any).value);
    expect(high).toBeGreaterThan(85);
    // Click near the bottom → value should go low.
    await page.mouse.click(rect.midX, Math.round(rect.bottom - 8));
    await page.waitForChanges();
    const low = await page.evaluate(() => (document.getElementById('s') as any).value);
    expect(low).toBeLessThan(15);
  }, 60000);
});
