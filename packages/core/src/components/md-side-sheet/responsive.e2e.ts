import { newE2EPage } from '@stencil/core/testing';

/**
 * The modal sheet must never be wider than the viewport — on screens narrower
 * than its configured width it goes full-width (flush to the anchored edge)
 * rather than overflowing off-screen and clipping its content.
 */
describe('md-side-sheet responsive width', () => {
  async function measure(width: number, side: 'start' | 'end') {
    const page = await newE2EPage();
    await page.setViewport({ width, height: 700 });
    await page.setContent(`
      <md-side-sheet id="s" variant="modal" side="${side}" headline="X" open closeable>
        <p>content</p>
      </md-side-sheet>
    `);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 350));
    return page.evaluate(() => {
      const c = document
        .getElementById('s')!
        .shadowRoot!.querySelector('.md-side-sheet__container') as HTMLElement;
      const b = c.getBoundingClientRect();
      return {
        vw: window.innerWidth,
        left: Math.round(b.left),
        right: Math.round(b.right),
        width: Math.round(b.width),
        docScrollW: document.documentElement.scrollWidth,
      };
    });
  }

  it('does not overflow when the viewport is narrower than the sheet width (end)', async () => {
    const r = await measure(320, 'end'); // configured width is 360
    expect(r.width).toBeLessThanOrEqual(r.vw); // capped to viewport
    expect(r.left).toBeGreaterThanOrEqual(0); // not clipped off-screen left
    expect(r.right).toBe(r.vw); // flush to the (end) edge
    expect(r.docScrollW).toBeLessThanOrEqual(r.vw); // no horizontal scroll
  }, 60000);

  it('does not overflow when narrower than the sheet width (start)', async () => {
    const r = await measure(320, 'start');
    expect(r.width).toBeLessThanOrEqual(r.vw);
    expect(r.left).toBe(0); // flush to the (start) edge
    expect(r.docScrollW).toBeLessThanOrEqual(r.vw);
  }, 60000);

  it('keeps the configured width on a roomy viewport', async () => {
    const r = await measure(1024, 'end');
    expect(r.width).toBe(360);
    expect(r.right).toBe(1024);
  }, 60000);
});
