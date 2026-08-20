/**
 * Real-browser (Puppeteer) e2e for md-sparkline — the runtime net the jsdom spec
 * can't provide: it renders the canvas, so it can check where the line actually
 * lands. See the repo's Node-25/puppeteer note; run under `test:e2e`.
 */
import { newE2EPage } from '@stencil/core/testing';

/** Fraction down the canvas of the TOPMOST drawn (line) pixel — 0 = top, 1 = bottom.
 *  Fresh page per call (reusing one across setContent invalidates element handles). */
async function topInkFrac(data: number[], props: Record<string, unknown> = {}) {
  const page = await newE2EPage();
  await page.setContent('<md-sparkline height="100px" color="#6750A4" show-marks="none"></md-sparkline>');
  const el = await page.find('md-sparkline');
  await el.setProperty('data', data);
  for (const [k, v] of Object.entries(props)) await el.setProperty(k, v);
  await page.waitForChanges();
  await new Promise((r) => setTimeout(r, 300));
  return page.evaluate(() => {
    const canvas = document.querySelector('md-sparkline')!.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height) as ImageData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 100) return y / height; // any opaque (line) pixel
      }
    }
    return 1;
  });
}

describe('md-sparkline e2e', () => {
  it('renders a canvas with content', async () => {
    expect(await topInkFrac([1, 4, 2, 5, 7, 2, 4, 6])).toBeLessThan(1);
  });

  it('min/max pin the value scale — small-range data sits low on a wide scale', async () => {
    const auto = await topInkFrac([10, 15, 12, 18]); // auto-scales to fill the height
    const pinned = await topInkFrac([10, 15, 12, 18], { min: 0, max: 100 }); // 10..18 of 0..100
    // Pinning to a wide 0..100 scale pushes the small-range line well DOWN vs auto.
    expect(pinned).toBeGreaterThan(auto + 0.25);
    expect(pinned).toBeGreaterThan(0.5); // ...into the lower half
  });

  it('the hover tooltip floats ABOVE the tiny host instead of being clipped inside it', async () => {
    const page = await newE2EPage();
    // Room above the sparkline for the card to float into.
    await page.setContent('<div style="padding:80px 40px"><md-sparkline height="28px" style="width:200px"></md-sparkline></div>');
    const el = await page.find('md-sparkline');
    await el.setProperty('data', [3, 7, 4, 9, 5, 8]);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 200));

    const rect = await page.evaluate(() => {
      const c = document.querySelector('md-sparkline')!.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    await page.mouse.move(rect.x + rect.w / 2, rect.y + rect.h / 2); // hover mid-plot
    await new Promise((r) => setTimeout(r, 150)); // hover rAF + card layout

    const m = await page.evaluate(() => {
      const host = document.querySelector('md-sparkline') as HTMLElement;
      const tip = host.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement | null;
      if (!tip) return null;
      const h = host.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      return { hostTop: h.top, hostH: h.height, tipTop: t.top, tipH: t.height, tipVisible: t.width > 0 && t.height > 0 };
    });
    expect(m).not.toBeNull(); // a tooltip card rendered
    expect(m!.tipVisible).toBe(true);
    expect(m!.tipH).toBeGreaterThan(m!.hostH); // the card is taller than the 28px host...
    expect(m!.tipTop).toBeLessThan(m!.hostTop); // ...and floats ABOVE it (not clipped inside)
    expect(m!.tipTop).toBeGreaterThan(0); // ...still on-screen
  });

  it('show-marks="all" renders a mark per point even on a monotonic line', async () => {
    // Count distinct marker blobs by scanning the top band for opaque runs. On a
    // rising line the min/max ARE the first/last points, so extremes+edges collapse
    // to 2 — "all" must instead dot every one of the 6 points.
    const countMarks = async (mode: string) => {
      const page = await newE2EPage();
      await page.setContent(`<md-sparkline color="#6750A4" height="120px" show-marks="${mode}" style="width:300px"></md-sparkline>`);
      const el = await page.find('md-sparkline');
      await el.setProperty('data', [2, 4, 6, 8, 10, 12]); // strictly increasing
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 300));
      return page.evaluate(() => {
        const c = document.querySelector('md-sparkline')!.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
        const { data, width, height } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height) as ImageData;
        // Column has ink → collapse to runs; each marker is a filled disc wider than the line.
        const cols: boolean[] = [];
        for (let x = 0; x < width; x++) {
          let thick = 0;
          for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] > 150) thick++;
          cols[x] = thick > 6; // disc columns are much taller than the ~2px line
        }
        let runs = 0;
        for (let x = 1; x < width; x++) if (cols[x] && !cols[x - 1]) runs++;
        return runs;
      });
    };
    const extremes = await countMarks('extremes');
    const all = await countMarks('all');
    expect(extremes).toBeLessThanOrEqual(2); // collapses to the two ends
    expect(all).toBeGreaterThanOrEqual(5); // a dot at (nearly) every one of the 6 points
    expect(all).toBeGreaterThan(extremes);
  });

  it('does not clip extreme markers in compact mode', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-sparkline variant="area" color="#6750A4" height="120px" show-marks="extremes" style="width:120px"></md-sparkline>');
    const el = await page.find('md-sparkline');
    await el.setProperty('data', [3, 5, 4, 7, 6, 9, 8, 12]); // rising: min bottom-left, max top-right
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 300));
    const b = await page.evaluate(() => {
      const c = document.querySelector('md-sparkline')!.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      const { data, width, height } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height) as ImageData;
      let top = height, left = width;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (data[(y * width + x) * 4 + 3] > 120) {
            if (y < top) top = y;
            if (x < left) left = x;
          }
      return { top, left };
    });
    // The extreme markers sit at the plot's edges; compact mode reserves their
    // radius so they render WHOLE (a margin from the edge), not cut off.
    expect(b.top).toBeGreaterThan(0);
    expect(b.left).toBeGreaterThan(0);
  });
});
