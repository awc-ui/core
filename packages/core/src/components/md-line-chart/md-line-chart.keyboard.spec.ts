import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdLineChart } from './md-line-chart';
import { installCanvas } from '../../utils/charts/engine/test-utils/canvas-harness';

/**
 * The keyboard cursor, the zoom API and legend hiding.
 *
 * The pointer-driven zoom (grab, slider track, plot hit-testing) is NOT here:
 * every one of those paths reads getBoundingClientRect, which mock-doc reports
 * as zeros, so they bail before doing anything. That is browser work and
 * belongs in e2e; what is covered here is the logic that does not need layout.
 */
describe('md-line-chart — keyboard, zoom, legend', () => {
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
      components: [MdLineChart],
      html: `<md-line-chart ${attrs}></md-line-chart>`,
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
   * The focusable plot. It is `.md-line-chart__canvas` (role=application,
   * tabindex=0) — the keydown handler is bound THERE in the JSX, so dispatching
   * on the host would never reach it.
   */
  const plot = (page: SpecPage) =>
    page.root!.shadowRoot!.querySelector('.md-line-chart__canvas') as HTMLElement | null;

  /** The live region the keyboard cursor narrates into. */
  const announcement = (page: SpecPage) =>
    (page.root!.shadowRoot!.querySelector('[aria-live]')?.textContent ?? '').trim();

  async function press(page: SpecPage, key: string) {
    const target = plot(page) ?? (page.root as HTMLElement);
    const ev = new KeyboardEvent('keydown', { key, bubbles: true });
    target.dispatchEvent(ev);
    await page.waitForChanges();
    return ev;
  }

  describe('keyboard cursor', () => {
    it('announces the point it lands on', async () => {
      const { page } = await create();
      await press(page, 'ArrowRight');
      // The live region is the non-visual equivalent of the hover tooltip, so
      // it has to carry the x value AND the series values.
      const text = announcement(page);
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain('Jan');
    });

    it('reports a hover as it moves', async () => {
      const { page, el } = await create();
      const onHover = jest.fn();
      el.addEventListener('mdHover', onHover);
      await press(page, 'ArrowRight');
      expect(onHover).toHaveBeenCalled();
      expect((onHover.mock.calls[0][0] as CustomEvent).detail.dataIndex).toBe(0);
    });

    it('steps along the series', async () => {
      const { page, el } = await create();
      const seen: number[] = [];
      el.addEventListener('mdHover', (e) => seen.push((e as CustomEvent).detail.dataIndex));
      await press(page, 'ArrowRight');
      await press(page, 'ArrowRight');
      await press(page, 'ArrowRight');
      expect(seen).toEqual([0, 1, 2]);
    });

    it('steps back', async () => {
      const { page, el } = await create();
      const seen: number[] = [];
      el.addEventListener('mdHover', (e) => seen.push((e as CustomEvent).detail.dataIndex));
      await press(page, 'ArrowRight');
      await press(page, 'ArrowRight');
      await press(page, 'ArrowLeft');
      expect(seen[seen.length - 1]).toBe(0);
    });

    it('clamps at the last point', async () => {
      const { page, el } = await create();
      const seen: number[] = [];
      el.addEventListener('mdHover', (e) => seen.push((e as CustomEvent).detail.dataIndex));
      for (let i = 0; i < 12; i++) await press(page, 'ArrowRight');
      expect(seen[seen.length - 1]).toBe(X.length - 1);
    });

    it('narrates the x value, which needs no layout', async () => {
      const { page } = await create();
      await press(page, 'ArrowRight');
      // The SERIES values in this announcement come from the engine's scene
      // (hoverPoints), and the engine bails on mock-doc's zero-sized container —
      // so only the x half is assertable here. The full announcement is browser
      // work.
      expect(announcement(page)).toContain('Jan');
    });

    it('reports which series are visible', async () => {
      const { page, el } = await create();
      const onHover = jest.fn();
      el.addEventListener('mdHover', onHover);
      await press(page, 'ArrowRight');
      expect((onHover.mock.calls[0][0] as CustomEvent).detail.seriesIndices).toEqual([0, 1]);
    });
  });

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
        components: [MdLineChart],
        html: '<md-line-chart zoom="both"></md-line-chart>',
      });
      const el = page.root as Chart;
      await expect(el.setZoom(0, 2)).resolves.toBeUndefined();
      await expect(el.resetZoom()).resolves.toBeUndefined();
    });
  });

  describe('legend hiding', () => {
    it('drops a hidden series from the visible set', async () => {
      const { page, el } = await create();
      const inst = page.rootInstance as unknown as {
        rememberLegendToggle(i: number, hidden: boolean): void;
        visibleSeriesIndices(): number[];
      };
      inst.rememberLegendToggle(1, true);
      await page.waitForChanges();
      expect(inst.visibleSeriesIndices()).toEqual([0]);

      inst.rememberLegendToggle(1, false);
      await page.waitForChanges();
      expect(inst.visibleSeriesIndices()).toEqual([0, 1]);
      expect(el).toBeTruthy();
    });

    it('ignores a series index that does not exist', async () => {
      const { page } = await create();
      const inst = page.rootInstance as unknown as {
        rememberLegendToggle(i: number, hidden: boolean): void;
        visibleSeriesIndices(): number[];
      };
      expect(() => inst.rememberLegendToggle(99, true)).not.toThrow();
      expect(inst.visibleSeriesIndices()).toEqual([0, 1]);
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
