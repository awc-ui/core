import { newSpecPage } from '@stencil/core/testing';
import { MdAreaChart } from './md-area-chart';

describe('md-area-chart', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdAreaChart], html });
  }

  describe('rendering', () => {
    it('renders with defaults + empty state', async () => {
      const page = await create('<md-area-chart></md-area-chart>');
      expect(page.root).toHaveClass('md-area-chart');
      expect(page.root).toHaveClass('md-area-chart--empty');
    });

    it('exposes header / canvas / footer / empty parts', async () => {
      const page = await create('<md-area-chart></md-area-chart>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="header"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="canvas"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="footer"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="empty"]')).toBeTruthy();
    });

    it('drops the empty class once series are supplied', async () => {
      const page = await create('<md-area-chart></md-area-chart>');
      page.root!.series = [{ label: 'A', data: [1, 2] }];
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-area-chart--empty');
    });
  });

  describe('accessibility', () => {
    it('announces itself as an area chart', async () => {
      const page = await create('<md-area-chart></md-area-chart>');
      page.root!.series = [{ label: 'A', data: [1] }];
      await page.waitForChanges();
      expect(page.root?.getAttribute('aria-label')).toContain('Area chart');
    });

    it('uses role="figure"', async () => {
      const page = await create('<md-area-chart></md-area-chart>');
      expect(page.root?.getAttribute('role')).toBe('figure');
    });
  });

  describe('props', () => {
    it('defaults stack to "normal" (area charts are usually stacked)', async () => {
      const page = await create('<md-area-chart></md-area-chart>');
      expect((page.root as unknown as { stack: string }).stack).toBe('normal');
    });

    it('accepts streamgraph baselines (silhouette / wiggle)', async () => {
      for (const stack of ['silhouette', 'wiggle']) {
        const page = await create(`<md-area-chart stack="${stack}"></md-area-chart>`);
        expect((page.root as unknown as { stack: string }).stack).toBe(stack);
      }
    });

    it('accepts a fill-opacity override', async () => {
      const page = await create('<md-area-chart fill-opacity="0.2"></md-area-chart>');
      expect((page.root as unknown as { fillOpacity: number }).fillOpacity).toBeCloseTo(0.2);
    });
  });

  describe('public API', () => {
    it('exposes the resize / toDataURL / getInstance methods', async () => {
      const page = await create('<md-area-chart></md-area-chart>');
      const host = page.root as unknown as {
        resize: () => Promise<void>;
        toDataURL: () => Promise<string>;
        getInstance: () => Promise<unknown>;
      };
      expect(typeof host.resize).toBe('function');
      expect(typeof host.toDataURL).toBe('function');
      expect(typeof host.getInstance).toBe('function');
    });
  });

  describe('click events', () => {
    /* The engine can't initialise in mock-doc, so the component gets a stand-in
     * that captures the callbacks it registers; the tests then drive them as the
     * engine does once it has resolved what was clicked (engine/hit-test.spec.ts
     * covers the mark > line > area > background precedence itself). */
    type AxisValues = { seriesIndex: number; label: string; value: number | null }[];
    type Cbs = {
      onPointClick: (si: number, di: number, e: PointerEvent) => void;
      onLineClick: (si: number, di: number, e: PointerEvent) => void;
      onAreaClick: (si: number, di: number, e: PointerEvent) => void;
      onAxisClick: (di: number, values: AxisValues, e: PointerEvent) => void;
    };

    const evt = { type: 'click' } as unknown as PointerEvent;
    const series = [
      { label: 'Desktop', id: 'd', data: [10, 20, 30] },
      { label: 'Mobile', data: [5, 15, 25] },
    ];

    async function wired() {
      const page = await create('<md-area-chart></md-area-chart>');
      const inst = page.rootInstance as unknown as { engine: unknown; applyEngine: () => void };
      page.root!.series = series;
      page.root!.xAxis = { data: ['Jan', 'Feb', 'Mar'] };
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
      return { page, cb: () => cb, seen };
    }

    it('emits mdAreaClick / mdLineClick with the marker-click detail shape', async () => {
      const { page, cb, seen } = await wired();
      const areaEv = seen('mdAreaClick');
      const line = seen('mdLineClick');
      cb().onAreaClick(0, 1, evt);
      cb().onLineClick(1, 2, evt);
      await page.waitForChanges();
      expect(areaEv[0].detail).toMatchObject({ seriesIndex: 0, seriesId: 'd', dataIndex: 1, value: 20, axisValue: 'Feb' });
      expect(areaEv[0].detail.series).toBe(series[0]);
      expect(line[0].detail).toMatchObject({ seriesIndex: 1, dataIndex: 2, value: 25, axisValue: 'Mar' });
    });

    it('emits mdAxisClick with every visible series value at that x', async () => {
      const { page, cb, seen } = await wired();
      const axis = seen('mdAxisClick');
      cb().onAxisClick(2, [
        { seriesIndex: 0, label: 'Desktop', value: 30 },
        { seriesIndex: 1, label: 'Mobile', value: null },
      ], evt);
      await page.waitForChanges();
      expect(axis[0].detail).toEqual({
        dataIndex: 2,
        axisValue: 'Mar',
        nativeEvent: evt,
        seriesValues: [
          { seriesIndex: 0, seriesId: 'd', label: 'Desktop', dataIndex: 2, value: 30 },
          { seriesIndex: 1, seriesId: undefined, label: 'Mobile', dataIndex: -1, value: null },
        ],
      });
    });
  });

  describe('RTL', () => {
    it('renders inside an RTL parent', async () => {
      const page = await newSpecPage({
        components: [MdAreaChart],
        html: '<div dir="rtl"><md-area-chart></md-area-chart></div>',
      });
      expect(page.body.querySelector('md-area-chart')).toBeTruthy();
    });
  });
});

describe('keyboard accessibility', () => {
  it('makes the plot focusable and explains the keys', async () => {
    const page = await newSpecPage({ components: [MdAreaChart], html: '<md-area-chart></md-area-chart>' });
    (page.root as unknown as { series: unknown }).series = [{ label: 'A', data: [1, 2, 3] }];
    await page.waitForChanges();
    const plot = page.root?.shadowRoot?.querySelector('.md-area-chart__canvas');
    expect(plot?.getAttribute('tabindex')).toBe('0');
    // role=application keeps a screen reader's browse mode off the arrow keys.
    expect(plot?.getAttribute('role')).toBe('application');
    expect(plot?.getAttribute('aria-label')).toContain('arrow keys');
  });

  it('is not a focus stop with no data to walk', async () => {
    const page = await newSpecPage({ components: [MdAreaChart], html: '<md-area-chart></md-area-chart>' });
    expect(page.root?.shadowRoot?.querySelector('.md-area-chart__canvas')?.getAttribute('tabindex')).toBeNull();
  });

  it('exposes a polite live region for the keyboard cursor', async () => {
    const page = await newSpecPage({ components: [MdAreaChart], html: '<md-area-chart></md-area-chart>' });
    const live = page.root?.shadowRoot?.querySelector('[aria-live]');
    expect(live?.getAttribute('aria-live')).toBe('polite');
    expect(live?.getAttribute('role')).toBe('status');
  });
});

describe('range series', () => {
  async function withRange() {
    const page = await newSpecPage({ components: [MdAreaChart], html: '<md-area-chart></md-area-chart>' });
    page.root!.xAxis = { data: ['Mon', 'Tue'] };
    page.root!.valueFormatter = (v: number | null) => (v == null ? '—' : `${v}°C`);
    page.root!.series = [{ label: 'Spread', range: [[-4.8, 1], [0, 6]] }];
    await page.waitForChanges();
    return page;
  }

  it('accepts a band in place of data and reads both edges in the SR table', async () => {
    const page = await withRange();
    const table = page.root?.shadowRoot?.querySelector('.md-area-chart__a11y-table')?.innerHTML ?? '';
    // One cell per row carrying both edges — not two columns, and not the
    // series' (absent) `data`.
    expect(table).toContain('-4.8°C–1°C');
    expect(table).toContain('0°C–6°C');
  });

  it('keeps the row count from `range` when `data` is absent', async () => {
    const page = await withRange();
    const rows = page.root?.shadowRoot?.querySelectorAll('.md-area-chart__a11y-table tbody tr') ?? [];
    expect(rows.length).toBe(2);
  });
});

describe('per-series fill and stroke', () => {
  it('passes both through to the engine spec', async () => {
    const page = await newSpecPage({ components: [MdAreaChart], html: '<md-area-chart></md-area-chart>' });
    page.root!.series = [
      { label: 'Band', range: [[1, 2]] },
      { label: 'Line', data: [3], fill: false, stroke: false },
    ];
    await page.waitForChanges();
    // The props exist on the public series type and survive a render; the
    // geometry they drive is pinned in engine/range.spec.ts.
    expect(page.root!.series[1].fill).toBe(false);
    expect(page.root!.series[1].stroke).toBe(false);
  });
});

describe('zoom', () => {
  async function zoomable(zoom = 'both') {
    const page = await newSpecPage({ components: [MdAreaChart], html: `<md-area-chart zoom="${zoom}"></md-area-chart>` });
    page.root!.xAxis = { data: [0, 1, 2, 3, 4, 5], scale: 'value' };
    page.root!.series = [{ label: 'A', data: [1, 2, 3, 4, 5, 6] }];
    await page.waitForChanges();
    return page;
  }

  it('renders the slider and pan grip only when the slider mode is on', async () => {
    const on = await zoomable('slider');
    expect(on.root?.shadowRoot?.querySelector('[part="zoom-slider"]')).toBeTruthy();
    expect(on.root?.shadowRoot?.querySelector('[part="zoom-pan"]')).toBeTruthy();
    const off = await zoomable('inside');
    expect(off.root?.shadowRoot?.querySelector('[part="zoom-slider"]')).toBeFalsy();
  });

  it('flags the host so the plot can reserve room / show the drag cursor', async () => {
    expect(await zoomable('slider').then(p => p.root!.className)).toContain('md-area-chart--zoom-slider');
    expect(await zoomable('inside').then(p => p.root!.className)).toContain('md-area-chart--zoom-drag');
  });

  it('setZoom emits absolute indices and resetZoom reports the full range', async () => {
    const page = await zoomable();
    const seen: { startIndex: number; endIndex: number; reset: boolean }[] = [];
    page.root!.addEventListener('mdZoom', (e: Event) => seen.push((e as CustomEvent).detail));
    await page.root!.setZoom(1, 3);
    await page.root!.resetZoom();
    await page.waitForChanges();
    expect(seen[0]).toEqual({ startIndex: 1, endIndex: 3, reset: false });
    // Reset reports the whole span, not the window it replaced.
    expect(seen[1]).toEqual({ startIndex: 0, endIndex: 5, reset: true });
  });

  it('clamps a nonsense window instead of drawing nothing', async () => {
    const page = await zoomable();
    const seen: { startIndex: number; endIndex: number }[] = [];
    page.root!.addEventListener('mdZoom', (e: Event) => seen.push((e as CustomEvent).detail));
    // Out of range, and inverted: at least two points must survive or there is
    // no band to draw.
    await page.root!.setZoom(-5, 99);
    await page.root!.setZoom(4, 2);
    expect(seen[0]).toEqual({ startIndex: 0, endIndex: 5, reset: false });
    expect(seen[1].endIndex).toBeGreaterThan(seen[1].startIndex);
  });

  it('leaves `series` untouched — zoom is a view, not a filter', async () => {
    const page = await zoomable();
    await page.root!.setZoom(1, 2);
    await page.waitForChanges();
    expect(page.root!.series[0].data).toHaveLength(6);
  });
});

describe('label overrides', () => {
  it('uses labelEmpty for the empty state', async () => {
    const page = await newSpecPage({
      components: [MdAreaChart],
      html: '<md-area-chart label-empty="Ingen data"></md-area-chart>',
    });
    expect(page.root?.shadowRoot?.querySelector('[part="empty"]')?.textContent).toContain('Ingen data');
  });

  it('shows the loader instead of the empty state while loading', async () => {
    const page = await newSpecPage({
      components: [MdAreaChart],
      html: '<md-area-chart loading loading-label="Laster…"></md-area-chart>',
    });
    expect(page.root?.shadowRoot?.querySelector('[part="loading"]')).toBeTruthy();
    // "No data" would be the wrong answer to "where is my data?" mid-load.
    expect(page.root?.shadowRoot?.querySelector('[part="empty"]')).toBeFalsy();
  });

  it('replaces the generated summary outright', async () => {
    const page = await newSpecPage({
      components: [MdAreaChart],
      html: '<md-area-chart summary="Nedbør per måned"></md-area-chart>',
    });
    page.root!.series = [{ label: 'A', data: [1] }];
    await page.waitForChanges();
    expect(page.root?.getAttribute('aria-label')).toBe('Nedbør per måned');
  });

  it('translates the data table chrome', async () => {
    const page = await newSpecPage({ components: [MdAreaChart], html: '<md-area-chart></md-area-chart>' });
    page.root!.tableLabels = { index: 'Rad', series: 'Serie' };
    page.root!.series = [{ data: [1, 2] }];
    await page.waitForChanges();
    const table = page.root?.shadowRoot?.querySelector('.md-area-chart__a11y-table')?.innerHTML ?? '';
    expect(table).toContain('Rad');
    expect(table).toContain('Serie');
  });
});

describe('series labels and inverted', () => {
  it('accepts both without disturbing the rendered structure', async () => {
    const page = await newSpecPage({
      components: [MdAreaChart],
      html: '<md-area-chart inverted series-labels></md-area-chart>',
    });
    page.root!.xAxis = { data: [0, 100], scale: 'value' };
    page.root!.series = [{ label: 'A', data: [1, 2] }];
    await page.waitForChanges();
    expect(page.root!.inverted).toBe(true);
    expect(page.root!.seriesLabels).toBe(true);
    expect(page.root?.shadowRoot?.querySelector('[part="canvas"]')).toBeTruthy();
  });
});
