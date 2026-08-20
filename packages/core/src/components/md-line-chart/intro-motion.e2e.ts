/**
 * Real-browser (Puppeteer) verification that every chart type plays the ONE
 * shared entrance: the geometry grows while the canvas layer FADES in on the
 * MD3 token timing (emphasized-decelerate, extra-long1). The pure-function math
 * is pinned in fixes.spec.ts / pie-layout.spec.ts — this proves the per-engine
 * WIRING (each playIntro drives the canvas opacity) and that the sparkline, which
 * used to opt out entirely, now animates too.
 *
 * Headless forces prefers-reduced-motion: reduce (so intros normally snap), so
 * each measurement patches window.matchMedia OFF in-page, then replays the entry
 * motion through the engine and samples the layer opacity across the intro.
 */
import { newE2EPage, type E2EPage } from '@stencil/core/testing';

/** Replay the intro with reduced-motion disabled and report the lowest canvas
 *  opacity seen during it (a real fade dips well below 1) plus the settled value. */
async function fadeProfile(page: E2EPage, selector: string): Promise<{ min: number; settled: number }> {
  return page.evaluate(async (sel: string) => {
    const host = document.querySelector(sel) as any;
    // Turn reduced-motion OFF for this measurement; pass every other query through.
    const real = window.matchMedia.bind(window);
    window.matchMedia = ((q: string) =>
      q.includes('reduced-motion')
        ? { matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } }
        : real(q)) as typeof window.matchMedia;

    const canvas = host.shadowRoot.querySelector('canvas') as HTMLCanvasElement;
    const engine = await host.getInstance();
    engine.replay(); // re-play the entrance, now un-reduced

    let min = 1;
    const t0 = performance.now();
    await new Promise<void>((res) => {
      const tick = () => {
        const op = parseFloat(getComputedStyle(canvas).opacity || '1');
        if (op < min) min = op;
        if (performance.now() - t0 < 650) requestAnimationFrame(tick);
        else res();
      };
      requestAnimationFrame(tick);
    });
    await new Promise((r) => setTimeout(r, 400)); // let it settle past the 700ms intro
    const settled = parseFloat(getComputedStyle(canvas).opacity || '1');
    return { min, settled };
  }, selector);
}
 

describe('chart intro — one shared grow + fade across every chart type', () => {
  it('sparkline (line engine) grows and fades in — it no longer opts out of the entrance', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-sparkline height="120px" color="#6750A4" style="width:280px"></md-sparkline>');
    const el = await page.find('md-sparkline');
    await el.setProperty('data', [3, 7, 4, 9, 6, 11, 8, 13]);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 150));

    const { min, settled } = await fadeProfile(page, 'md-sparkline');
    expect(min).toBeLessThan(0.7); // the layer faded in from near-transparent
    expect(settled).toBeCloseTo(1, 1); // ...and ended fully opaque
  });

  it('bar (bar engine) grows and fades its canvas layer in', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-bar-chart style="width:400px;height:300px"></md-bar-chart>');
    const el = await page.find('md-bar-chart');
    await el.setProperty('xAxis', { data: ['Q1', 'Q2', 'Q3'] });
    await el.setProperty('series', [{ label: 'A', data: [10, 20, 30] }]);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 150));

    const { min, settled } = await fadeProfile(page, 'md-bar-chart');
    expect(min).toBeLessThan(0.7);
    expect(settled).toBeCloseTo(1, 1);
  });

  it('pie (pie engine) scales up from the centre and fades in', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-pie-chart style="width:400px;height:400px"></md-pie-chart>');
    const el = await page.find('md-pie-chart');
    await el.setProperty('data', [
      { label: 'A', value: 50, color: '#6750A4' },
      { label: 'B', value: 30, color: '#B3261E' },
      { label: 'C', value: 20, color: '#7D5260' },
    ]);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 150));

    const { min, settled } = await fadeProfile(page, 'md-pie-chart');
    expect(min).toBeLessThan(0.7);
    expect(settled).toBeCloseTo(1, 1);
  });
});
