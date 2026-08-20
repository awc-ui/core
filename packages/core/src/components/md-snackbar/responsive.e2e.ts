import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * The snackbar must never overflow a narrow viewport. Below 600px it goes
 * full-width-minus-margins instead of holding its 288px min-width (which used to
 * clip off-screen on a phone).
 */
describe('md-snackbar responsive width', () => {
  async function measure(width: number) {
    const page = await newE2EPage();
    await page.setViewport({ width, height: 640 });
    await page.setContent(
      `<md-snackbar id="s" open auto-hide="false" message="A snackbar message" closeable></md-snackbar>`,
    );
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 300));
    return page.evaluate(() => {
      const b = (document.getElementById('s')!.shadowRoot!.querySelector(
        '.md-snackbar__surface',
      ) as HTMLElement).getBoundingClientRect();
      return {
        vw: window.innerWidth,
        left: Math.round(b.left),
        right: Math.round(b.right),
        width: Math.round(b.width),
        docScrollW: document.documentElement.scrollWidth,
      };
    });
  }

  it('does not overflow a very narrow phone viewport (280px)', async () => {
    const r = await measure(280);
    expect(r.left).toBeGreaterThanOrEqual(0); // not clipped off the left
    expect(r.right).toBeLessThanOrEqual(r.vw); // not clipped off the right
    expect(r.width).toBeLessThanOrEqual(r.vw); // fits the viewport
    expect(r.docScrollW).toBeLessThanOrEqual(r.vw); // no horizontal scroll
  }, 60000);

  it('fills most of the width on a compact viewport (360px)', async () => {
    const r = await measure(360);
    // 360 − 2×16px margin = 328 available; it should fill that, not sit at 288.
    expect(r.width).toBeGreaterThan(300);
    expect(r.left).toBeGreaterThanOrEqual(0);
  }, 60000);

  it('keeps the 568px max width on a roomy desktop viewport', async () => {
    const r = await measure(1200);
    expect(r.width).toBeLessThanOrEqual(568);
    expect(r.width).toBeGreaterThanOrEqual(288);
  }, 60000);
});
