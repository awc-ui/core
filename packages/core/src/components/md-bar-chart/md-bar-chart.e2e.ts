/**
 * Real-browser (Puppeteer) e2e for md-bar-chart — the runtime net the pure-unit
 * specs can't provide: it actually renders the canvas and drives the engine.
 *
 * It guards the class of bug the unit tests are structurally blind to: the
 * canvas going BLANK (a bar that draws to nothing, or a follow/animation loop
 * painting on the wrong side of render()'s canvas-clear). `canvasHasContent`
 * reads real pixels; a blank frame fails it.
 *
 * NOTE: needs a Puppeteer-capable environment. It is skipped in a headless CI /
 * dev box where Chrome can't launch or the WS transport hangs (see the repo's
 * Node-25/puppeteer note); run under `pnpm --filter @awc-ui/core test:e2e`.
 */
import { newE2EPage } from '@stencil/core/testing';

const SERIES = [{ label: 'Sales', data: [10, 20, 30, 15] }];
const XAXIS = { data: ['Q1', 'Q2', 'Q3', 'Q4'] };

async function mount(page: Awaited<ReturnType<typeof newE2EPage>>, attrs = '') {
  await page.setContent(`<md-bar-chart style="width:400px;height:300px" ${attrs}></md-bar-chart>`);
  const el = await page.find('md-bar-chart');
  await el.setProperty('series', SERIES);
  await el.setProperty('xAxis', XAXIS);
  await page.waitForChanges();
  await new Promise((r) => setTimeout(r, 120)); // let the intro + layout settle
  await page.waitForChanges();
  return el;
}

/** True if the plot canvas has ANY non-transparent pixel (bars/axes were drawn). */
function canvasHasContent(page: Awaited<ReturnType<typeof newE2EPage>>): Promise<boolean> {
  return page.evaluate(() => {
    const chart = document.querySelector('md-bar-chart');
    const canvas = chart?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !canvas.width) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
    return false;
  });
}

/** Count of non-transparent (drawn) pixels — a proxy for total bar area. A layout
 *  that is still animating changes this frame to frame; a snapped one holds it. */
function canvasInkCount(page: Awaited<ReturnType<typeof newE2EPage>>): Promise<number> {
  return page.evaluate(() => {
    const chart = document.querySelector('md-bar-chart');
    const canvas = chart?.shadowRoot?.querySelector('canvas') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !canvas.width) return -1;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++;
    return n;
  });
}

describe('md-bar-chart e2e', () => {
  it('renders and paints the canvas', async () => {
    const page = await newE2EPage();
    await mount(page);
    expect(await canvasHasContent(page)).toBe(true);
  });

  it('exports a PNG via toDataURL', async () => {
    const page = await newE2EPage();
    const el = await mount(page);
    const url = await el.callMethod('toDataURL');
    expect(typeof url).toBe('string');
    expect((url as string).startsWith('data:image/png')).toBe(true);
  });

  it('keeps the canvas painted after a data update (no blank frame)', async () => {
    const page = await newE2EPage();
    const el = await mount(page);
    await el.setProperty('series', [{ label: 'Sales', data: [30, 10, 25, 40] }]);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 150)); // let the follow loop run
    await page.waitForChanges();
    expect(await canvasHasContent(page)).toBe(true);
  });

  it('is keyboard-activatable: focus + arrow + Enter fires mdBarClick', async () => {
    const page = await newE2EPage();
    const el = await mount(page);
    const click = await el.spyOnEvent('mdBarClick');
    const plot = await page.find('md-bar-chart >>> .md-bar-chart__canvas');
    await plot.press('ArrowRight'); // move the keyboard cursor onto a category
    await plot.press('Enter'); // activate it
    await page.waitForChanges();
    expect(click).toHaveReceivedEvent();
    expect(click.lastEvent.detail.dataIndex).toBeGreaterThanOrEqual(0);
  });

  it('drill() resolves and leaves the canvas painted', async () => {
    const page = await newE2EPage();
    const el = await mount(page);
    await el.callMethod('drill', 0, 'down'); // must not throw
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 120));
    expect(await canvasHasContent(page)).toBe(true);
  });

  it('renders the zoom slider when zoom includes the slider', async () => {
    const page = await newE2EPage();
    await mount(page, 'zoom="slider"');
    const slider = await page.find('md-bar-chart >>> .md-bar-chart__zoom-slider');
    expect(slider).not.toBeNull();
  });

  it('setZoom windows the categories and rebases reported indices to absolute', async () => {
    const page = await newE2EPage();
    const el = await mount(page, 'zoom="slider"');
    const zoomed = await el.spyOnEvent('mdZoom');
    const click = await el.spyOnEvent('mdBarClick');
    await el.callMethod('setZoom', 1, 2); // window = [Q2, Q3]
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 80));
    expect(zoomed).toHaveReceivedEventDetail({ startIndex: 1, endIndex: 2, reset: false });
    expect(await canvasHasContent(page)).toBe(true); // still painted, not blank

    // The keyboard now walks the WINDOW; Home = first visible bar, which is the
    // absolute index 1 (Q2) — proving the reported index is rebased, not windowed.
    const plot = await page.find('md-bar-chart >>> .md-bar-chart__canvas');
    await plot.press('Home');
    await plot.press('Enter');
    await page.waitForChanges();
    expect(click).toHaveReceivedEvent();
    expect(click.lastEvent.detail.dataIndex).toBe(1);
    expect(click.lastEvent.detail.value).toBe(20); // SERIES data[1]
  });

  it('resetZoom restores the full range', async () => {
    const page = await newE2EPage();
    const el = await mount(page, 'zoom="slider"');
    await el.callMethod('setZoom', 1, 2);
    await page.waitForChanges();
    const zoomed = await el.spyOnEvent('mdZoom');
    await el.callMethod('resetZoom');
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 60));
    expect(zoomed).toHaveReceivedEventDetail({ startIndex: 0, endIndex: 3, reset: true });
    expect(await canvasHasContent(page)).toBe(true);
  });

  it('SNAPS to the zoom window instead of morphing the bars into it', async () => {
    // A zoom changes the whole category layout at once. Easing the bars across
    // it (the bar-race follow loop) reads as them sliding together; a view change
    // must snap. Guard it: the drawn bar area must be identical one frame after
    // the zoom and a quarter-second later — a follow-loop morph would grow it.
    const page = await newE2EPage();
    await page.setContent('<md-bar-chart style="width:560px;height:300px" zoom="slider"></md-bar-chart>');
    const el = await page.find('md-bar-chart');
    await el.setProperty('series', [{ label: 'DAU', data: Array.from({ length: 24 }, (_, i) => 20 + ((i * 5) % 30)) }]);
    await el.setProperty('xAxis', { data: Array.from({ length: 24 }, (_, i) => `D${i + 1}`) });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 300)); // let the intro settle
    await page.waitForChanges();

    await el.callMethod('setZoom', 8, 14); // 24 bars → a 7-bar window
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 16));
    const early = await canvasInkCount(page);
    await new Promise((r) => setTimeout(r, 260)); // longer than the follow ease
    const late = await canvasInkCount(page);
    expect(early).toBeGreaterThan(0);
    expect(late).toBe(early); // identical → snapped, not eased
  });

  it('a broken-axis outlier spans PAST the break (split piece survives the follow path)', async () => {
    // Mount empty, THEN feed data — the normal path, which runs the follow loop.
    // A value-axis break splits the 1200 bar into pieces sharing one category key;
    // the follow loop used to drop all but the last, stalling the outlier at the
    // break (~55% down). Its top piece must reach the top of the plot.
    const page = await newE2EPage();
    await page.setContent('<md-bar-chart style="width:560px;height:360px" show-labels></md-bar-chart>');
    const el = await page.find('md-bar-chart');
    await el.setProperty('series', [{ label: 'Spend', color: '#6750A4', data: [42, 55, 38, 1200, 61, 47] }]);
    await el.setProperty('xAxis', { data: ['Design', 'Eng', 'Sales', 'Infra', 'Support', 'Ops'] });
    await el.setProperty('yAxis', { breaks: 'auto' });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 500)); // let the follow settle
    await page.waitForChanges();

    const topFrac = await page.evaluate(() => {
      const c = document.querySelector('md-bar-chart')!.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height) as ImageData;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          // purple bar fill: opaque, blue-dominant, red > green
          if (data[i + 3] > 200 && data[i + 2] > 120 && data[i + 2] > data[i] + 20 && data[i] > data[i + 1]) return y / height;
        }
      }
      return 1;
    });
    expect(topFrac).toBeLessThan(0.25); // reaches the top quarter, not stuck at the break
  });

  it('shows a hand (pointer) cursor over a bar only when clickable', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-bar-chart style="width:600px;height:320px"></md-bar-chart>');
    const el = await page.find('md-bar-chart');
    await el.setProperty('series', [{ label: 'v', data: [80, 80, 80] }]); // all bars tall
    await el.setProperty('xAxis', { data: ['A', 'B', 'C'] });
    await el.setProperty('yAxis', { max: 100 }); // ~80% of the plot height, empty above
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 200));

    const box = await page.evaluate(() => {
      const c = document.querySelector('md-bar-chart')!.shadowRoot!.querySelector('canvas')!;
      const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const cursor = () => page.evaluate(() => (document.querySelector('md-bar-chart')!.shadowRoot!.querySelector('canvas') as HTMLElement).style.cursor);
    const midX = box.x + box.w * 0.5; // the middle category's bar

    // Not clickable → no hand over the middle bar.
    await page.mouse.move(midX, box.y + box.h * 0.75);
    await new Promise((r) => setTimeout(r, 60));
    expect(await cursor()).not.toBe('pointer');

    // Clickable → hand over the bar.
    await el.setProperty('clickable', true);
    await page.waitForChanges();
    await page.mouse.move(midX, box.y + box.h * 0.72); // nudge to re-fire pointermove
    await new Promise((r) => setTimeout(r, 60));
    expect(await cursor()).toBe('pointer');

    // ...but NOT over the empty space above the bars (hit-tested like a click).
    await page.mouse.move(midX, box.y + box.h * 0.05);
    await new Promise((r) => setTimeout(r, 60));
    expect(await cursor()).not.toBe('pointer');
  });
});
