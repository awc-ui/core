import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdAreaChart } from './md-area-chart';
import { installCanvas } from '../../utils/charts/engine/test-utils/canvas-harness';

/**
 * The zoom API and legend hiding.
 *
 * The KEYBOARD cursor and the pointer-driven zoom are covered in
 * md-area-chart.pointer.spec.ts, which stubs the host and canvas boxes so the
 * engine actually lays out. Both were dead without that: this component gates
 * onPlotKeyDown on `this.engine.getScene()`, where md-line-chart derives its
 * bound from `dataLength()` — from the DATA — so in a browser this one needs
 * to have painted at least once before arrow keys do anything.
 */
describe('md-area-chart — keyboard, zoom, legend', () => {
  let restore: () => void;
  beforeEach(() => {
    ({ restore } = installCanvas());
  });
  afterEach(() => restore());

  type Chart = HTMLElement & {
    setZoom(a: number, b: number): Promise<void>;
    resetZoom(): Promise<void>;
    series: unknown[];
    xAxis?: unknown;
  };

  const X = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  async function create(attrs = ''): Promise<{ page: SpecPage; el: Chart }> {
    const page = await newSpecPage({
      components: [MdAreaChart],
      html: `<md-area-chart ${attrs}></md-area-chart>`,
    });
    const el = page.root as Chart;
    el.xAxis = { data: X };
    el.series = [
      { label: 'A', data: [1, 2, 3, 4, 5, 6] },
      { label: 'B', data: [6, 5, 4, 3, 2, 1] },
    ];
    await page.waitForChanges();
    return { page, el };
  }

  /**
   * The focusable plot. It is `.md-area-chart__canvas` (role=application,
   * tabindex=0) — the keydown handler is bound THERE in the JSX, so dispatching
   * on the host would never reach it.
   */
  const plot = (page: SpecPage) =>
    page.root!.shadowRoot!.querySelector('.md-area-chart__canvas') as HTMLElement | null;

  async function press(page: SpecPage, key: string) {
    const target = plot(page) ?? (page.root as HTMLElement);
    const ev = new KeyboardEvent('keydown', { key, bubbles: true });
    target.dispatchEvent(ev);
    await page.waitForChanges();
    return ev;
  }

  describe('zoom API', () => {
    const zoomSpy = (el: HTMLElement) => {
      const calls: Array<{ startIndex: number; endIndex: number; reset: boolean }> = [];
      el.addEventListener('mdZoom', (e) => calls.push((e as CustomEvent).detail));
      return calls;
    };

    it('reports the window it applied', async () => {
      const { page, el } = await create('zoom="both"');
      const calls = zoomSpy(el);
      await el.setZoom(1, 3);
      await page.waitForChanges();
      expect(calls[calls.length - 1]).toEqual({ startIndex: 1, endIndex: 3, reset: false });
    });

    it('clamps out-of-range bounds', async () => {
      const { page, el } = await create('zoom="both"');
      const calls = zoomSpy(el);
      await el.setZoom(-5, 99);
      await page.waitForChanges();
      expect(calls[calls.length - 1]).toEqual(
        expect.objectContaining({ startIndex: 0, endIndex: X.length - 1 }),
      );
    });

    it('keeps at least two points in the window', async () => {
      const { page, el } = await create('zoom="both"');
      const calls = zoomSpy(el);
      await el.setZoom(2, 2);
      await page.waitForChanges();
      const last = calls[calls.length - 1];
      expect(last.endIndex).toBeGreaterThan(last.startIndex);
    });

    it('normalises an inverted range', async () => {
      const { page, el } = await create('zoom="both"');
      const calls = zoomSpy(el);
      await el.setZoom(4, 1);
      await page.waitForChanges();
      const last = calls[calls.length - 1];
      expect(last.endIndex).toBeGreaterThan(last.startIndex);
    });

    it('resets to the full range and says so', async () => {
      const { page, el } = await create('zoom="both"');
      await el.setZoom(2, 3);
      await page.waitForChanges();
      const calls = zoomSpy(el);
      await el.resetZoom();
      await page.waitForChanges();
      expect(calls[calls.length - 1]).toEqual({
        startIndex: 0,
        endIndex: X.length - 1,
        reset: true,
      });
    });

    it('survives zooming with no data', async () => {
      const page = await newSpecPage({
        components: [MdAreaChart],
        html: '<md-area-chart zoom="both"></md-area-chart>',
      });
      const el = page.root as Chart;
      await expect(el.setZoom(0, 2)).resolves.toBeUndefined();
      await expect(el.resetZoom()).resolves.toBeUndefined();
    });
  });

  describe('legend hiding', () => {
    it('records the toggle so it survives a series re-feed', async () => {
      const { page } = await create();
      const inst = page.rootInstance as unknown as {
        rememberLegendToggle(i: number, hidden: boolean): void;
        legendHidden: Map<string, boolean>;
      };
      inst.rememberLegendToggle(1, true);
      await page.waitForChanges();
      expect([...inst.legendHidden.values()]).toContain(true);

      inst.rememberLegendToggle(1, false);
      await page.waitForChanges();
      expect([...inst.legendHidden.values()]).toContain(false);
    });

    it('falls back to the series flag when there is no scene', async () => {
      // NOTE a divergence from md-line-chart: its fallback also consults the
      // legendHidden map, this one only reads `series[i].hidden`. With a scene
      // present (any real browser) both read hoverPoints and agree; without
      // one they do not.
      const { page, el } = await create();
      const inst = page.rootInstance as unknown as { visibleSeriesIndices(): number[] };
      expect(inst.visibleSeriesIndices()).toEqual([0, 1]);

      el.series = [
        { label: 'A', data: [1, 2, 3, 4, 5, 6] },
        { label: 'B', data: [6, 5, 4, 3, 2, 1], hidden: true },
      ];
      await page.waitForChanges();
      expect(inst.visibleSeriesIndices()).toEqual([0]);
    });

    it('ignores a series index that does not exist', async () => {
      const { page } = await create();
      const inst = page.rootInstance as unknown as {
        rememberLegendToggle(i: number, hidden: boolean): void;
        legendHidden: Map<string, boolean>;
      };
      expect(() => inst.rememberLegendToggle(99, true)).not.toThrow();
      expect(inst.legendHidden.size).toBe(0);
    });

    it('evicts the oldest toggle rather than growing without bound', async () => {
      const { page } = await create();
      const inst = page.rootInstance as unknown as {
        rememberLegendToggle(i: number, hidden: boolean): void;
        legendHidden: Map<string, boolean>;
      };
      // The backstop evicts ONE entry per insertion — it bounds growth going
      // forward rather than trimming retroactively. So seed it to the cap and
      // check the next toggle does not push it over.
      for (let i = 0; i < 256; i++) {
        inst.legendHidden.set(`synthetic-${i}`, true);
      }
      inst.rememberLegendToggle(0, true);
      expect(inst.legendHidden.size).toBe(256);
      // ...and the OLDEST is the one that went.
      expect(inst.legendHidden.has('synthetic-0')).toBe(false);
    });
  });
});
