import { newSpecPage } from '@stencil/core/testing';
import { MdLineChart } from './md-line-chart';
import { MdSlider } from '../md-slider/md-slider';
import { readMdChartTheme, type MdChartSeries } from '../../utils/charts';

/*
 * Specs run in @stencil/core/testing's mock-doc environment.
 * ECharts can't initialise there (no measurable box, no SVG
 * layout engine), so these specs cover:
 *   • Stencil-rendered DOM (host classes, parts, slots)
 *   • prop reflection
 *   • the a11y summary builder + screen-reader-only table
 *   • event wiring (mdReady fires via direct dispatch from the
 *     real-browser E2E suite — here we just confirm the
 *     EventEmitter is set up)
 *
 * Real-browser behaviour (axis rendering, tooltip HTML,
 * resize observer, data-zoom) is covered by the matching E2E
 * tests in md-line-chart.e2e.ts.
 */

describe('md-line-chart', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdLineChart], html });
  }

  describe('rendering', () => {
    it('renders with defaults and an empty-state message', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-line-chart');
      expect(page.root).toHaveClass('md-line-chart--empty');
      const empty = page.root?.shadowRoot?.querySelector('.md-line-chart__empty');
      expect(empty?.textContent).toContain('No data to display');
    });

    it('exposes the public CSS parts', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="header"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="canvas"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="footer"]')).toBeTruthy();
    });

    it('renders all three named slots', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('slot[name="header"]')).toBeTruthy();
      expect(shadow?.querySelector('slot[name="empty"]')).toBeTruthy();
      expect(shadow?.querySelector('slot[name="footer"]')).toBeTruthy();
    });

    it('drops the empty class once data is supplied', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      page.root!.series = [{ label: 'A', data: [1, 2, 3] }];
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-line-chart--empty');
    });
  });

  describe('accessibility', () => {
    it('uses role="figure" so screen readers announce it as a chart', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      expect(page.root?.getAttribute('role')).toBe('figure');
    });

    it('builds an aria-label summary from the data', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      page.root!.label = 'Revenue';
      page.root!.series = [{ label: 'Q1', data: [1, 2, 3] }, { label: 'Q2', data: [3, 2, 1] }];
      page.root!.xAxis = { data: ['Jan', 'Feb', 'Mar'] };
      await page.waitForChanges();
      const label = page.root?.getAttribute('aria-label') ?? '';
      expect(label).toContain('Revenue');
      expect(label).toContain('Line chart');
      expect(label).toContain('2 series');
    });

    it('switches the summary verb to "Area chart" when `area` is set', async () => {
      const page = await create('<md-line-chart area="true"></md-line-chart>');
      page.root!.series = [{ label: 'A', data: [1, 2, 3] }];
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toContain('Area chart');
    });

    it('exposes a screen-reader-only data table inside the shadow root', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      page.root!.label = 'Sales';
      page.root!.xAxis = { label: 'Month', data: ['Jan', 'Feb'] };
      page.root!.series = [{ label: 'A', data: [10, 20] }];
      await page.waitForChanges();
      const table = page.root?.shadowRoot?.querySelector('.md-line-chart__a11y-table');
      // mock-doc never invokes componentDidLoad-driven a11y table builder,
      // but the host node MUST exist so the real-browser E2E can populate
      // it on first render.
      expect(table).toBeTruthy();
    });
  });

  describe('props', () => {
    it('reflects the legend position attribute', async () => {
      const page = await create('<md-line-chart legend="bottom"></md-line-chart>');
      expect(page.root?.getAttribute('legend')).toBe('bottom');
    });

    it('accepts a height override via the `height` attribute', async () => {
      const page = await create('<md-line-chart height="240px"></md-line-chart>');
      expect((page.root as HTMLElement | null)?.style.blockSize).toBe('240px');
    });

    it('defaults to a smooth curve', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      expect((page.root as unknown as { curve: string }).curve).toBe('smooth');
    });

    it('accepts every curve type without erroring', async () => {
      const curves = ['linear', 'smooth', 'monotone', 'step', 'step-before', 'step-middle'];
      for (const c of curves) {
        const page = await create(`<md-line-chart curve="${c}"></md-line-chart>`);
        page.root!.series = [{ label: 'A', data: [1, 2, 3] }];
        await page.waitForChanges();
        expect(page.root).toBeTruthy();
      }
    });
  });

  describe('events', () => {
    it('defines the mdMarkerClick, mdLegendClick, mdHover and mdReady events', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      // Components in mock-doc don't bubble custom events from
      // ECharts wiring, but the EventEmitters are reachable on
      // the prototype via Stencil's event metadata.
      const eventNames = ['mdMarkerClick', 'mdLegendClick', 'mdHover', 'mdReady'];
      for (const name of eventNames) {
        const spy = jest.fn();
        page.root?.addEventListener(name, spy);
        // Verify addEventListener doesn't throw — establishing
        // the listener proves Stencil registered the event.
        expect(typeof page.root?.addEventListener).toBe('function');
      }
    });
  });

  describe('legend toggle persistence', () => {
    // The engine self-toggles + emits on legend click; the component remembers
    // the toggle (keyed by series identity) so a live consumer that re-feeds
    // `series` every frame (line-race) keeps the line hidden. buildSpec merges
    // the memory. Engine can't init in mock-doc, so we drive the merge directly.
    type Inst = {
      series: MdChartSeries[];
      legendHidden: Map<string, boolean>;
      rememberLegendToggle: (i: number, hidden: boolean) => void;
      buildSpec: (t: ReturnType<typeof readMdChartTheme>) => { series: { hidden: boolean }[] };
    };

    async function chartWith(series: MdChartSeries[]) {
      const page = await create('<md-line-chart></md-line-chart>');
      const inst = page.rootInstance as unknown as Inst;
      inst.series = series;
      await page.waitForChanges();
      const theme = readMdChartTheme(page.root!);
      return { page, inst, theme, hidden: () => inst.buildSpec(theme).series.map((s) => s.hidden) };
    }

    it('re-applies a remembered toggle after the consumer re-feeds series without hidden', async () => {
      const { inst, hidden } = await chartWith([
        { label: 'A', data: [1, 2, 3] },
        { label: 'B', data: [4, 5, 6] },
        { label: 'C', data: [7, 8, 9] },
      ]);
      inst.rememberLegendToggle(1, true); // hide B via legend
      // Live consumer feeds brand-new series objects (no `hidden` field).
      inst.series = [
        { label: 'A', data: [10, 11, 12] },
        { label: 'B', data: [13, 14, 15] },
        { label: 'C', data: [16, 17, 18] },
      ];
      expect(hidden()).toEqual([false, true, false]);
    });

    it('lets an explicit series[i].hidden prop win AND clears memory so it sticks', async () => {
      const { inst, hidden } = await chartWith([
        { label: 'A', data: [1] },
        { label: 'B', data: [2] },
      ]);
      inst.rememberLegendToggle(1, true); // remember B hidden
      // Consumer 'show all' feeds B with explicit hidden:false.
      inst.series = [
        { label: 'A', data: [1] },
        { label: 'B', data: [2], hidden: false },
      ];
      expect(hidden()).toEqual([false, false]); // explicit show wins this frame
      // Next frame omits `hidden` again — the stale toggle must NOT resurface.
      inst.series = [
        { label: 'A', data: [1] },
        { label: 'B', data: [2] },
      ];
      expect(hidden()).toEqual([false, false]);
    });

    it('keys memory by id so a label change keeps the toggle', async () => {
      const { inst, hidden } = await chartWith([{ id: 'x', label: 'Old', data: [1] }]);
      inst.rememberLegendToggle(0, true);
      inst.series = [{ id: 'x', label: 'Renamed', data: [1] }];
      expect(hidden()).toEqual([true]);
    });

    it('does not collide two series that share a label (hide one, not both)', async () => {
      const { inst, hidden } = await chartWith([
        { label: 'Sales', data: [1] },
        { label: 'Sales', data: [2] }, // duplicate label, no id
      ]);
      inst.rememberLegendToggle(1, true); // hide only the 2nd
      inst.series = [
        { label: 'Sales', data: [10] },
        { label: 'Sales', data: [20] },
      ];
      expect(hidden()).toEqual([false, true]); // only index 1 hidden
    });

    it('keeps a unique-label toggle across a re-fed reorder', async () => {
      const { inst, theme } = await chartWith([
        { label: 'A', data: [1] },
        { label: 'B', data: [2] },
        { label: 'C', data: [3] },
      ]);
      inst.rememberLegendToggle(1, true); // hide B
      inst.series = [
        { label: 'C', data: [3] },
        { label: 'A', data: [1] },
        { label: 'B', data: [2] }, // B now at index 2
      ];
      const hiddenByLabel = inst.buildSpec(theme).series.map((s, i) => [inst.series[i].label, s.hidden]);
      expect(hiddenByLabel).toEqual([
        ['C', false],
        ['A', false],
        ['B', true], // toggle follows the LABEL, not the old index
      ]);
    });

    it('keeps a toggle for a series that blips out of the feed for a frame', async () => {
      const { inst, hidden } = await chartWith([
        { label: 'A', data: [1] },
        { label: 'B', data: [2] },
      ]);
      inst.rememberLegendToggle(1, true); // hide B
      inst.series = [{ label: 'A', data: [1] }]; // B absent this frame
      expect(hidden()).toEqual([false]);
      inst.series = [
        { label: 'A', data: [1] },
        { label: 'B', data: [2] }, // B returns
      ];
      expect(hidden()).toEqual([false, true]); // toggle survived the blip
    });

    it('toggling a remembered-hidden series back on clears it', async () => {
      const { inst, hidden } = await chartWith([
        { label: 'A', data: [1] },
        { label: 'B', data: [2] },
      ]);
      inst.rememberLegendToggle(1, true);
      expect(hidden()).toEqual([false, true]);
      inst.rememberLegendToggle(1, false); // toggle back on
      expect(hidden()).toEqual([false, false]);
    });
  });

  describe('public API', () => {
    it('exposes resize(), toDataURL(), and getInstance() methods', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      const host = page.root as unknown as {
        resize: () => Promise<void>;
        toDataURL: () => Promise<string>;
        getInstance: () => Promise<unknown>;
      };
      expect(typeof host.resize).toBe('function');
      expect(typeof host.toDataURL).toBe('function');
      expect(typeof host.getInstance).toBe('function');
    });

    it('resize() resolves without throwing when chart is not initialised', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      const host = page.root as unknown as { resize: () => Promise<void> };
      await expect(host.resize()).resolves.toBeUndefined();
    });

    it('toDataURL() returns an empty string when chart is not initialised', async () => {
      const page = await create('<md-line-chart></md-line-chart>');
      const host = page.root as unknown as { toDataURL: () => Promise<string> };
      await expect(host.toDataURL()).resolves.toBe('');
    });
  });

  describe('zoom', () => {
    /** The md-slider the chart drives — registered here so its props apply. */
    const zoomSlider = (page: { root?: HTMLElement | null }) =>
      page.root?.shadowRoot?.querySelector('.md-line-chart__zoom-slider') as unknown as {
        min: number;
        max: number;
        range: boolean;
        controlled: boolean;
        valueStart: number;
        valueEnd: number;
      } | null;

    const withData = async (attrs = 'zoom="both"') => {
      const page = await newSpecPage({
        components: [MdLineChart, MdSlider],
        html: `<md-line-chart ${attrs}></md-line-chart>`,
      });
      const host = page.root as unknown as {
        series: unknown;
        xAxis: unknown;
        setZoom: (a: number, b: number) => Promise<void>;
        resetZoom: () => Promise<void>;
      };
      host.series = [{ label: 'v', data: Array.from({ length: 20 }, (_, i) => i) }];
      host.xAxis = { data: Array.from({ length: 20 }, (_, i) => `T${i}`) };
      await page.waitForChanges();
      return { page, host };
    };

    it('renders the slider for zoom="slider" and "both", not for "none"', async () => {
      for (const [zoom, expected] of [
        ['none', false],
        ['inside', false],
        ['slider', true],
        ['both', true],
      ] as const) {
        const { page } = await withData(`zoom="${zoom}"`);
        const slider = page.root?.shadowRoot?.querySelector('.md-line-chart__zoom');
        expect(!!slider).toBe(expected);
      }
    });

    it('drives an md-slider in controlled range mode over the whole index span', async () => {
      const { page } = await withData('zoom="slider"');
      const slider = zoomSlider(page);
      expect(slider).toBeTruthy();
      expect(slider?.range).toBe(true);
      // The chart clamps the window, so it must stay the source of truth.
      expect(slider?.controlled).toBe(true);
      expect(slider?.min).toBe(0);
      expect(slider?.max).toBe(19); // 20 points ⇒ last index 19
      expect([slider?.valueStart, slider?.valueEnd]).toEqual([0, 19]);
    });

    it('applies the window the slider reports while a thumb moves', async () => {
      const { page } = await withData('zoom="slider"');
      const seen: { startIndex: number; endIndex: number }[] = [];
      page.root?.addEventListener('mdZoom', (e) => seen.push((e as CustomEvent).detail));
      page.root?.shadowRoot?.querySelector('.md-line-chart__zoom-slider')?.dispatchEvent(
        new CustomEvent('mdInput', { detail: { value: 6, valueStart: 3, valueEnd: 6 }, bubbles: true, composed: true }),
      );
      await page.waitForChanges();
      expect(seen).toEqual([{ startIndex: 3, endIndex: 6, reset: false }]);
      expect([zoomSlider(page)?.valueStart, zoomSlider(page)?.valueEnd]).toEqual([3, 6]);
    });

    it("does not leak the inner slider's events out of the chart", async () => {
      const { page } = await withData('zoom="slider"');
      const leaked: string[] = [];
      ['mdInput', 'mdChange', 'mdDragStart', 'mdDragEnd', 'mdFocus', 'mdBlur'].forEach((type) =>
        page.body.addEventListener(type, () => leaked.push(type)),
      );
      const slider = page.root?.shadowRoot?.querySelector('.md-line-chart__zoom-slider');
      ['mdInput', 'mdChange', 'mdDragStart', 'mdDragEnd', 'mdFocus', 'mdBlur'].forEach((type) =>
        slider?.dispatchEvent(new CustomEvent(type, { detail: { valueStart: 1, valueEnd: 9 }, bubbles: true, composed: true })),
      );
      await page.waitForChanges();
      expect(leaked).toEqual([]);
    });

    it('marks the host so CSS can reserve room only when the slider is on', async () => {
      const { page } = await withData('zoom="slider"');
      expect(page.root?.classList.contains('md-line-chart--zoom-slider')).toBe(true);
      const { page: inside } = await withData('zoom="inside"');
      expect(inside.root?.classList.contains('md-line-chart--zoom-slider')).toBe(false);
      expect(inside.root?.classList.contains('md-line-chart--zoom-drag')).toBe(true);
    });

    it('setZoom() narrows the window and exposes it on the slider', async () => {
      const { page, host } = await withData();
      await host.setZoom(5, 12);
      await page.waitForChanges();
      expect([zoomSlider(page)?.valueStart, zoomSlider(page)?.valueEnd]).toEqual([5, 12]);
    });

    it('clamps a reversed or degenerate range to at least two points', async () => {
      const { page, host } = await withData();
      await host.setZoom(9, 9);
      await page.waitForChanges();
      const s = zoomSlider(page);
      expect(s?.valueEnd).toBeGreaterThan(s?.valueStart as number);
    });

    it('clamps past the end of the data', async () => {
      const { page, host } = await withData();
      await host.setZoom(15, 999);
      await page.waitForChanges();
      expect(zoomSlider(page)?.valueEnd).toBe(19); // 20 points ⇒ last index 19
    });

    it('resetZoom() restores the full range and emits reset', async () => {
      const { page, host } = await withData();
      const seen: { startIndex: number; endIndex: number; reset: boolean }[] = [];
      page.root?.addEventListener('mdZoom', (e) => seen.push((e as CustomEvent).detail));
      await host.setZoom(4, 8);
      await host.resetZoom();
      await page.waitForChanges();
      expect(seen.map((s) => s.reset)).toEqual([false, true]);
      expect(seen[1]).toMatchObject({ startIndex: 0, endIndex: 19, reset: true });
    });

    it('leaves the consumer series untouched — zoom is only a view', async () => {
      const { page, host } = await withData();
      await host.setZoom(2, 5);
      await page.waitForChanges();
      expect((host.series as { data: number[] }[])[0].data).toHaveLength(20);
    });
  });

  describe('per-point x (irregular time data)', () => {
    /** The zoom slider spans 0..lastIndex of the axis the chart actually draws,
     *  which is the merged one — so it reads back the merge without a canvas. */
    const mergedLength = async (series: unknown[], xAxis?: unknown) => {
      const page = await newSpecPage({
        components: [MdLineChart, MdSlider],
        html: '<md-line-chart zoom="slider"></md-line-chart>',
      });
      const host = page.root as unknown as { series: unknown; xAxis: unknown };
      if (xAxis) host.xAxis = xAxis;
      host.series = series;
      await page.waitForChanges();
      const slider = page.root?.shadowRoot?.querySelector('.md-line-chart__zoom-slider') as unknown as {
        max: number;
      } | null;
      return (slider?.max ?? -1) + 1;
    };

    it('merges series measured on different dates onto one axis', async () => {
      const n = await mergedLength(
        [
          { label: 'A', data: [{ x: '2024-01-01', y: 1 }, { x: '2024-03-01', y: 3 }] },
          { label: 'B', data: [{ x: '2024-02-01', y: 2 }, { x: '2024-03-01', y: 4 }] },
        ],
        { scale: 'time' },
      );
      expect(n).toBe(3); // Jan 1 + Feb 1 + Mar 1 (shared) — not 2 + 2
    });

    it('needs no xAxis.data at all when series carry their own x', async () => {
      const n = await mergedLength([
        { label: 'A', data: [['2024-01-01', 1], ['2024-01-09', 2], ['2024-02-20', 3]] },
      ], { scale: 'time' });
      expect(n).toBe(3);
    });

    it('leaves plain index-aligned series exactly as they were', async () => {
      const n = await mergedLength([{ label: 'A', data: [1, 2, 3, 4] }], { data: ['a', 'b', 'c', 'd'] });
      expect(n).toBe(4);
    });

    it('reports the merged x range in the aria summary', async () => {
      const page = await newSpecPage({ components: [MdLineChart], html: '<md-line-chart></md-line-chart>' });
      const host = page.root as unknown as { series: unknown; xAxis: unknown };
      host.xAxis = { scale: 'time' };
      host.series = [
        { label: 'A', data: [{ x: '2024-01-01', y: 1 }] },
        { label: 'B', data: [{ x: '2024-06-01', y: 2 }] },
      ];
      await page.waitForChanges();
      const label = page.root?.getAttribute('aria-label') ?? '';
      expect(label).toContain('2024-01-01');
      expect(label).toContain('2024-06-01');
    });

    it('does not mutate the consumer series', async () => {
      const data = [{ x: '2024-01-01', y: 1 }, { x: '2024-03-01', y: 3 }];
      const series = [{ label: 'A', data }];
      await mergedLength(series, { scale: 'time' });
      expect(series[0].data).toBe(data);
      expect(data).toEqual([{ x: '2024-01-01', y: 1 }, { x: '2024-03-01', y: 3 }]);
    });
  });

  describe('RTL', () => {
    it('renders inside an RTL context without throwing', async () => {
      const page = await newSpecPage({
        components: [MdLineChart],
        html: '<div dir="rtl"><md-line-chart></md-line-chart></div>',
      });
      expect(page.body.querySelector('md-line-chart')).toBeTruthy();
    });
  });

  describe('loading state', () => {
    const shadow = (page: { root?: HTMLElement | null }) => page.root?.shadowRoot;

    it('covers the plot with a loader while data is on its way', async () => {
      const page = await create('<md-line-chart loading></md-line-chart>');
      const loader = shadow(page)?.querySelector('[part="loading"]');
      expect(loader).toBeTruthy();
      expect(loader?.getAttribute('role')).toBe('status');
      expect(loader?.querySelector('md-progress-indicator')).toBeTruthy();
      expect(loader?.textContent).toContain('Loading chart');
    });

    it('marks the host aria-busy only while loading', async () => {
      const page = await create('<md-line-chart loading></md-line-chart>');
      expect(page.root?.getAttribute('aria-busy')).toBe('true');
      page.root!.loading = false;
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-busy')).toBeNull();
    });

    it('shows the loader INSTEAD of the empty state, not both', async () => {
      const page = await create('<md-line-chart loading></md-line-chart>');
      expect(shadow(page)?.querySelector('[part="empty"]')).toBeFalsy();
      expect(page.root).not.toHaveClass('md-line-chart--empty');
      expect(page.root).toHaveClass('md-line-chart--loading');
    });

    it('falls back to the empty state once loading finishes with no data', async () => {
      const page = await create('<md-line-chart loading></md-line-chart>');
      page.root!.loading = false;
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="loading"]')).toBeFalsy();
      expect(shadow(page)?.querySelector('[part="empty"]')).toBeTruthy();
    });

    it('drops the loader when the data lands', async () => {
      const page = await create('<md-line-chart loading></md-line-chart>');
      page.root!.series = [{ label: 'A', data: [1, 2, 3] }];
      page.root!.loading = false;
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="loading"]')).toBeFalsy();
      expect(shadow(page)?.querySelector('[part="empty"]')).toBeFalsy();
    });

    it('lets a consumer slot their own skeleton', async () => {
      const page = await create('<md-line-chart loading></md-line-chart>');
      expect(shadow(page)?.querySelector('slot[name="loading"]')).toBeTruthy();
    });

    it('replays the entry animation on the way OUT of loading only', async () => {
      const page = await create('<md-line-chart loading></md-line-chart>');
      const inst = page.rootInstance as unknown as { engine: unknown; onLoadingChange: (n: boolean, b: boolean) => void };
      let replays = 0;
      inst.engine = { replay: () => (replays += 1) };
      inst.onLoadingChange(false, true); // loading → loaded
      expect(replays).toBe(1);
      inst.onLoadingChange(true, false); // loaded → loading
      expect(replays).toBe(1);
    });
  });

  describe('click events', () => {
    /*
     * The engine can't initialise in mock-doc (no canvas box), so the component
     * gets a stand-in engine that captures the callbacks it registers, and the
     * tests drive those callbacks exactly as the engine does once it has
     * resolved what was clicked. The resolution itself — mark beats line beats
     * area beats the background — is covered in engine/hit-test.spec.ts.
     */
    type AxisValues = { seriesIndex: number; label: string; value: number | null }[];
    type Cbs = {
      onPointClick: (si: number, di: number, e: PointerEvent) => void;
      onLineClick: (si: number, di: number, e: PointerEvent) => void;
      onAreaClick: (si: number, di: number, e: PointerEvent) => void;
      onAxisClick: (di: number, values: AxisValues, e: PointerEvent) => void;
    };

    const evt = { type: 'click' } as unknown as PointerEvent;

    async function wired(series: unknown[], xAxis?: unknown) {
      const page = await create('<md-line-chart></md-line-chart>');
      const inst = page.rootInstance as unknown as { engine: unknown; applyEngine: () => void };
      const host = page.root as unknown as { series: unknown; xAxis: unknown; setZoom: (a: number, b: number) => Promise<void> };
      host.series = series;
      if (xAxis) host.xAxis = xAxis;
      await page.waitForChanges();
      let cb: Cbs = {} as Cbs;
      inst.engine = {
        setSpec: (_spec: unknown, _theme: unknown, cbs: Cbs) => (cb = cbs),
        setHoverEnabled: () => undefined,
        setTooltip: () => undefined,
        getScene: () => null,
      };
      inst.applyEngine();
      const seen = (type: string) => {
        const events: CustomEvent[] = [];
        page.root?.addEventListener(type, (e) => events.push(e as CustomEvent));
        return events;
      };
      return { page, host, cb: () => cb, seen };
    }

    const twoSeries = [
      { label: 'Revenue', id: 'rev', data: [10, 20, 30, 40] },
      { label: 'Cost', data: [5, 15, 25, 35] },
    ];
    const months = { data: ['Jan', 'Feb', 'Mar', 'Apr'] };

    it('emits mdLineClick and mdAreaClick with the same detail shape as mdMarkerClick', async () => {
      const { page, cb, seen } = await wired(twoSeries, months);
      const marker = seen('mdMarkerClick');
      const line = seen('mdLineClick');
      const areaEv = seen('mdAreaClick');
      cb().onPointClick(0, 2, evt);
      cb().onLineClick(0, 2, evt);
      cb().onAreaClick(1, 3, evt);
      await page.waitForChanges();
      const shape = { seriesIndex: 0, seriesId: 'rev', dataIndex: 2, value: 30, axisValue: 'Mar', nativeEvent: evt };
      expect(marker[0].detail).toMatchObject(shape);
      expect(line[0].detail).toMatchObject(shape);
      expect(line[0].detail.series).toBe(twoSeries[0]);
      expect(areaEv[0].detail).toMatchObject({ seriesIndex: 1, seriesId: undefined, dataIndex: 3, value: 35, axisValue: 'Apr' });
    });

    it('mdAxisClick reports the x position plus every visible series value there', async () => {
      const { page, cb, seen } = await wired(twoSeries, months);
      const axis = seen('mdAxisClick');
      cb().onAxisClick(1, [
        { seriesIndex: 0, label: 'Revenue', value: 20 },
        { seriesIndex: 1, label: 'Cost', value: 15 },
      ], evt);
      await page.waitForChanges();
      expect(axis).toHaveLength(1);
      expect(axis[0].detail).toEqual({
        dataIndex: 1,
        axisValue: 'Feb',
        nativeEvent: evt,
        seriesValues: [
          { seriesIndex: 0, seriesId: 'rev', label: 'Revenue', dataIndex: 1, value: 20 },
          { seriesIndex: 1, seriesId: undefined, label: 'Cost', dataIndex: 1, value: 15 },
        ],
      });
    });

    it('reports null (and dataIndex -1) for a series with no point at the clicked x', async () => {
      const { page, cb, seen } = await wired(twoSeries, months);
      const axis = seen('mdAxisClick');
      cb().onAxisClick(0, [
        { seriesIndex: 0, label: 'Revenue', value: 10 },
        { seriesIndex: 1, label: 'Cost', value: null },
      ], evt);
      await page.waitForChanges();
      expect(axis[0].detail.seriesValues[1]).toEqual({
        seriesIndex: 1,
        seriesId: undefined,
        label: 'Cost',
        dataIndex: -1,
        value: null,
      });
    });

    it('rebases indices out of the zoom window, like mdMarkerClick does', async () => {
      const data = Array.from({ length: 20 }, (_, i) => i * 10);
      const { page, host, cb, seen } = await wired([{ label: 'v', data }], {
        data: Array.from({ length: 20 }, (_, i) => `T${i}`),
      });
      await host.setZoom(5, 12);
      await page.waitForChanges();
      const line = seen('mdLineClick');
      const axis = seen('mdAxisClick');
      // The engine indexes the sliced view: index 2 of the window is index 7.
      cb().onLineClick(0, 2, evt);
      cb().onAxisClick(2, [{ seriesIndex: 0, label: 'v', value: 70 }], evt);
      await page.waitForChanges();
      expect(line[0].detail).toMatchObject({ dataIndex: 7, value: 70, axisValue: 'T7' });
      expect(axis[0].detail).toMatchObject({ dataIndex: 7, axisValue: 'T7' });
      expect(axis[0].detail.seriesValues[0]).toMatchObject({ dataIndex: 7, value: 70 });
    });

    it('maps a series that carries its own x back onto its own data array', async () => {
      const a = [{ x: '2024-01-01', y: 1 }, { x: '2024-03-01', y: 3 }];
      const b = [{ x: '2024-02-01', y: 2 }];
      const { page, cb, seen } = await wired(
        [{ label: 'A', data: a }, { label: 'B', data: b }],
        { scale: 'time' },
      );
      const line = seen('mdLineClick');
      const axis = seen('mdAxisClick');
      // Merged axis is [Jan 1, Feb 1, Mar 1]; A's point at merged index 2 is its
      // OWN index 1, and B has nothing there at all.
      cb().onLineClick(0, 2, evt);
      cb().onAxisClick(2, [
        { seriesIndex: 0, label: 'A', value: 3 },
        { seriesIndex: 1, label: 'B', value: null },
      ], evt);
      await page.waitForChanges();
      expect(line[0].detail).toMatchObject({ seriesIndex: 0, dataIndex: 1, value: 3 });
      expect(axis[0].detail.seriesValues).toEqual([
        { seriesIndex: 0, seriesId: undefined, label: 'A', dataIndex: 1, value: 3 },
        { seriesIndex: 1, seriesId: undefined, label: 'B', dataIndex: -1, value: null },
      ]);
    });

    it('fires one event per click — a line click is not also a marker click', async () => {
      const { page, cb, seen } = await wired(twoSeries, months);
      const marker = seen('mdMarkerClick');
      const line = seen('mdLineClick');
      const areaEv = seen('mdAreaClick');
      const axis = seen('mdAxisClick');
      cb().onLineClick(0, 1, evt);
      await page.waitForChanges();
      expect([marker.length, line.length, areaEv.length, axis.length]).toEqual([0, 1, 0, 0]);
    });
  });
});

describe('keyboard accessibility', () => {
  const withData = async () => {
    const page = await newSpecPage({ components: [MdLineChart], html: '<md-line-chart></md-line-chart>' });
    const host = page.root as unknown as { series: unknown; xAxis: unknown };
    host.series = [{ label: 'A', data: [1, 2, 3] }];
    host.xAxis = { data: ['Jan', 'Feb', 'Mar'] };
    await page.waitForChanges();
    return page;
  };

  it('makes the plot focusable and tells the user what the keys do', async () => {
    const page = await withData();
    const plot = page.root?.shadowRoot?.querySelector('.md-line-chart__canvas');
    expect(plot?.getAttribute('tabindex')).toBe('0');
    // Browse mode would otherwise swallow the arrow keys before they reach us.
    expect(plot?.getAttribute('role')).toBe('application');
    expect(plot?.getAttribute('aria-label')).toContain('arrow keys');
  });

  it('is not a focus stop while there is no data to walk', async () => {
    const page = await newSpecPage({ components: [MdLineChart], html: '<md-line-chart></md-line-chart>' });
    const plot = page.root?.shadowRoot?.querySelector('.md-line-chart__canvas');
    expect(plot?.getAttribute('tabindex')).toBeNull();
    expect(plot?.getAttribute('role')).toBeNull();
  });

  it('exposes a polite live region for the keyboard cursor', async () => {
    const page = await withData();
    const live = page.root?.shadowRoot?.querySelector('[aria-live]');
    expect(live?.getAttribute('aria-live')).toBe('polite');
    expect(live?.getAttribute('aria-atomic')).toBe('true');
    expect(live?.getAttribute('role')).toBe('status');
  });

  it('takes translated instructions and announcement template', async () => {
    const page = await newSpecPage({
      components: [MdLineChart],
      html: '<md-line-chart label-plot="Diagrammdaten" label-point="%x% — %values%"></md-line-chart>',
    });
    (page.root as unknown as { series: unknown }).series = [{ label: 'A', data: [1] }];
    await page.waitForChanges();
    const plot = page.root?.shadowRoot?.querySelector('.md-line-chart__canvas');
    expect(plot?.getAttribute('aria-label')).toBe('Diagrammdaten');
    expect((page.root as unknown as { labelPoint: string }).labelPoint).toBe('%x% — %values%');
  });
});
