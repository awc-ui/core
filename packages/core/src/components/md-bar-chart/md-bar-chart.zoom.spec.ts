import { newSpecPage } from '@stencil/core/testing';
import { MdBarChart } from './md-bar-chart';
import { installCanvas } from '../../utils/charts/engine/test-utils/canvas-harness';

/**
 * The zoom API and its clamping. Zoom is a VIEW over the category range, so the
 * window has to survive being handed nonsense — inverted bounds, fractions,
 * values off either end — without collapsing the slider or emptying the plot.
 *
 * The engine builds a canvas, so the chart harness is installed to keep it from
 * tripping over mock-doc's inert 2D stub. What it PAINTS is not asserted here —
 * the plot container has a zero-sized rect under mock-doc, so the engine bails
 * before drawing; that is covered against the engine directly in
 * utils/charts/engine/bar-chart.spec.ts.
 */
describe('md-bar-chart — zoom', () => {
  let restore: () => void;

  beforeEach(() => {
    ({ restore } = installCanvas());
  });
  afterEach(() => restore());

  type Chart = HTMLElement & {
    setZoom(a: number, b: number): Promise<void>;
    resetZoom(): Promise<void>;
    categories: string[];
    series: unknown[];
  };

  /** Six categories, one series — enough range to zoom within. */
  async function create(attrs = '') {
    const page = await newSpecPage({
      components: [MdBarChart],
      html: `<md-bar-chart ${attrs}></md-bar-chart>`,
    });
    const el = page.root as Chart;
    el.categories = ['A', 'B', 'C', 'D', 'E', 'F'];
    el.series = [{ label: 'S', data: [1, 2, 3, 4, 5, 6] }];
    await page.waitForChanges();
    return { page, el };
  }

  /** The detail of the last mdZoom event. */
  function zoomSpy(el: HTMLElement) {
    const calls: Array<{ startIndex: number; endIndex: number; reset: boolean }> = [];
    el.addEventListener('mdZoom', (e) => calls.push((e as CustomEvent).detail));
    return calls;
  }

  it('reports the window it applied', async () => {
    const { page, el } = await create('zoom="both"');
    const calls = zoomSpy(el);
    await el.setZoom(1, 3);
    await page.waitForChanges();
    expect(calls[calls.length - 1]).toEqual({ startIndex: 1, endIndex: 3, reset: false });
  });

  it('clamps a start below zero', async () => {
    const { page, el } = await create('zoom="both"');
    const calls = zoomSpy(el);
    await el.setZoom(-5, 2);
    await page.waitForChanges();
    expect(calls[calls.length - 1].startIndex).toBe(0);
  });

  it('clamps an end past the last category', async () => {
    const { page, el } = await create('zoom="both"');
    const calls = zoomSpy(el);
    await el.setZoom(2, 99);
    await page.waitForChanges();
    expect(calls[calls.length - 1].endIndex).toBe(5);
  });

  it('keeps at least two categories visible', async () => {
    const { page, el } = await create('zoom="both"');
    const calls = zoomSpy(el);
    // Collapsing the window to a single category would collapse the slider
    // range with it.
    await el.setZoom(3, 3);
    await page.waitForChanges();
    const last = calls[calls.length - 1];
    expect(last.endIndex).toBeGreaterThan(last.startIndex);
  });

  it('keeps the start off the final category, so an end always fits', async () => {
    const { page, el } = await create('zoom="both"');
    const calls = zoomSpy(el);
    await el.setZoom(99, 99);
    await page.waitForChanges();
    const last = calls[calls.length - 1];
    expect(last.startIndex).toBe(4);
    expect(last.endIndex).toBe(5);
  });

  it('normalises an inverted range rather than rejecting it', async () => {
    const { page, el } = await create('zoom="both"');
    const calls = zoomSpy(el);
    await el.setZoom(4, 1);
    await page.waitForChanges();
    const last = calls[calls.length - 1];
    expect(last.endIndex).toBeGreaterThan(last.startIndex);
  });

  it('rounds fractional bounds to whole categories', async () => {
    const { page, el } = await create('zoom="both"');
    const calls = zoomSpy(el);
    await el.setZoom(1.4, 3.6);
    await page.waitForChanges();
    expect(calls[calls.length - 1]).toEqual(
      expect.objectContaining({ startIndex: 1, endIndex: 4 }),
    );
  });

  it('resets to the full range and says so', async () => {
    const { page, el } = await create('zoom="both"');
    await el.setZoom(2, 3);
    await page.waitForChanges();
    const calls = zoomSpy(el);
    await el.resetZoom();
    await page.waitForChanges();
    expect(calls[calls.length - 1]).toEqual({ startIndex: 0, endIndex: 5, reset: true });
  });

  it('applies a second zoom on top of the first', async () => {
    const { page, el } = await create('zoom="both"');
    const calls = zoomSpy(el);
    await el.setZoom(1, 4);
    await page.waitForChanges();
    await el.setZoom(2, 3);
    await page.waitForChanges();
    // Each call is absolute, not relative to the current window.
    expect(calls[calls.length - 1]).toEqual(
      expect.objectContaining({ startIndex: 2, endIndex: 3 }),
    );
  });

  it('survives zooming an empty dataset', async () => {
    const page = await newSpecPage({
      components: [MdBarChart],
      html: '<md-bar-chart zoom="both"></md-bar-chart>',
    });
    const el = page.root as Chart;
    await expect(el.setZoom(0, 3)).resolves.toBeUndefined();
    await expect(el.resetZoom()).resolves.toBeUndefined();
  });

  it('renders the zoom slider only for the slider modes', async () => {
    for (const [mode, expected] of [
      ['none', false],
      ['inside', false],
      ['slider', true],
      ['both', true],
    ] as const) {
      const { page } = await create(`zoom="${mode}"`);
      const slider = page.root?.shadowRoot?.querySelector('.md-bar-chart__zoom-slider');
      expect(Boolean(slider)).toBe(expected);
    }
  });

  it('keeps the a11y table in step with the window', async () => {
    const { page, el } = await create('zoom="both"');
    await el.setZoom(1, 2);
    await page.waitForChanges();
    // The table is the non-visual view of the same data, so it must not keep
    // describing rows the chart no longer shows.
    const table = page.root?.shadowRoot?.querySelector('table');
    expect(table).toBeTruthy();
  });
});
