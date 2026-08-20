/**
 * Regression e2e: data assigned AFTER the element hydrates must still end up
 * VISIBLE.
 *
 * The first (dataless) render starts the entry animation, which fades the layer
 * in from `opacity: 0`. When the data lands before that animation finishes, the
 * second render takes the bar-race FOLLOW path — which cancels the intro rAF and
 * returns without restoring the layer opacity — so the canvas is left at its
 * inline `opacity: 0` forever. The bars ARE drawn (the backing store is full of
 * ink); the element is simply invisible.
 *
 * Measured, not asserted-by-feel: each case reports the inline opacity AND the
 * count of non-transparent pixels, so a "fix" that hides the drawing instead of
 * showing it fails too.
 *
 * NOTE: needs a Puppeteer-capable environment (see md-bar-chart.e2e.ts).
 */
import { newE2EPage } from '@stencil/core/testing';

const SERIES = [{ label: 'Sales', data: [10, 20, 30, 15] }];
const XAXIS = { data: ['Q1', 'Q2', 'Q3', 'Q4'] };

type Probe = { opacity: string; computed: string; ink: number };

/** Mount a chart, feed it data at `when`, let everything settle, and report the
 *  plot canvas' inline opacity + how much was actually drawn. */
function probe(
  page: Awaited<ReturnType<typeof newE2EPage>>,
  when: 'before-upgrade' | 'on-ready',
  attrs: Record<string, string> = {},
): Promise<Probe> {
  return page.evaluate(
    async (series: unknown, xAxis: unknown, when: string, attrs: Record<string, string>) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const el = document.createElement('md-bar-chart') as HTMLElement & { series?: unknown; xAxis?: unknown };
      el.style.cssText = 'display:block;width:420px;height:300px';
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      const feed = () => {
        el.series = series;
        el.xAxis = xAxis;
      };
      // 'before-upgrade': the data is on the element for its FIRST render (what a
      // markup/SSR-fed chart gets). 'on-ready': it arrives right after that first,
      // dataless render — the demo pattern that assigns props post-hydration.
      if (when === 'before-upgrade') feed();
      else el.addEventListener('mdReady', feed, { once: true });
      document.body.appendChild(el);
      for (let i = 0; i < 200 && !el.classList.contains('hydrated'); i++) await sleep(10);
      await sleep(1500); // well past the 700ms entrance

      const canvas = el.shadowRoot!.querySelector('canvas[part="plot-canvas"]') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) ink++;
      return { opacity: canvas.style.opacity, computed: getComputedStyle(canvas).opacity, ink };
    },
    SERIES,
    XAXIS,
    when,
    attrs,
  ) as Promise<Probe>;
}

describe('md-bar-chart — late data must not leave the canvas invisible', () => {
  it('data assigned after hydration ends fully opaque', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="root"></div>');
    const late = await probe(page, 'on-ready');
    expect(late.ink).toBeGreaterThan(0); // the bars really were drawn
    expect(late.opacity).toBe(''); // …and the layer is not left faded out
    expect(Number(late.computed)).toBe(1);
  });

  it('control: data present for the first render ends fully opaque', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="root"></div>');
    const early = await probe(page, 'before-upgrade');
    expect(early.ink).toBeGreaterThan(0);
    expect(early.opacity).toBe('');
  });

  it('control: with the entrance off, late data is never faded', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="root"></div>');
    const off = await probe(page, 'on-ready', { animation: 'none' });
    expect(off.ink).toBeGreaterThan(0);
    expect(off.opacity).toBe('');
  });
});
