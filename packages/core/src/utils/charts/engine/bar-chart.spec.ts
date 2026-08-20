import {
  BarChartEngine,
  barKey,
  barsByKey,
  barsDiffer,
  emphasizePolar,
  lerpBar,
  sliceAt,
} from './bar-chart';
import type { BarChartSpec } from './bar-layout';
import type { EngineTheme } from './layout';
import type { RenderScene, SceneBar, SceneSlice } from './scene';
import {
  flushFrames,
  installCanvas,
  makeChartContainer,
  nextFrame,
  type RecordingCtx,
} from './test-utils/canvas-harness';

const theme: EngineTheme = {
  background: 'transparent',
  textColor: '#1C1B1F',
  textColorMuted: '#49454F',
  axisLineColor: '#79747E',
  gridLineColor: '#CAC4D0',
  surface: '#FFFBFE',
  fontFamily: 'Roboto',
  labelSize: 11,
  titleSize: 14,
};

const bar = (over: Partial<SceneBar> = {}): SceneBar => ({
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  color: '#000',
  radius: [0, 0, 0, 0],
  seriesIndex: 0,
  dataIndex: 0,
  ...over,
});

const slice = (over: Partial<SceneSlice> = {}): SceneSlice => ({
  cx: 100,
  cy: 100,
  innerR: 20,
  outerR: 60,
  startAngle: 0,
  endAngle: Math.PI / 2,
  color: '#123456',
  dataIndex: 0,
  ...over,
});

const scene = (over: Partial<RenderScene> = {}): RenderScene =>
  ({
    width: 400,
    height: 300,
    plot: { x: 0, y: 0, w: 400, h: 300 },
    gridlines: [],
    axisLines: [],
    areas: [],
    bars: [],
    slices: [],
    lines: [],
    markers: [],
    texts: [],
    legend: [],
    ...over,
  }) as RenderScene;

describe('bar-chart helpers', () => {
  describe('sliceAt', () => {
    it('finds the segment under the pointer', () => {
      const s = slice();
      // Inside the radius band, ~45° into a 0..90° span.
      expect(sliceAt([s], 130, 130)).toBe(s);
    });

    it('returns null inside the donut hole', () => {
      // This is what keeps the tooltip from appearing over the middle.
      expect(sliceAt([slice()], 100, 100)).toBeNull();
    });

    it('returns null beyond the outer radius', () => {
      expect(sliceAt([slice()], 400, 400)).toBeNull();
    });

    it('returns null outside the angular span', () => {
      // Same radius band, but the opposite quadrant.
      expect(sliceAt([slice()], 60, 60)).toBeNull();
    });

    it('skips zero-sweep segments so an empty category cannot be hit', () => {
      const empty = slice({ startAngle: 1, endAngle: 1 });
      expect(sliceAt([empty], empty.cx + 40, empty.cy)).toBeNull();
    });

    it('handles a span that wraps past the angle origin', () => {
      // Folded range: a rotated / negative sweep must still hit.
      const s = slice({ startAngle: -Math.PI / 4, endAngle: Math.PI / 4 });
      expect(sliceAt([s], 140, 100)).toBe(s);
    });

    it('returns the first match when segments overlap', () => {
      const a = slice({ dataIndex: 0 });
      const b = slice({ dataIndex: 1 });
      expect(sliceAt([a, b], 130, 130)).toBe(a);
    });

    it('returns null for an empty ring', () => {
      expect(sliceAt([], 100, 100)).toBeNull();
    });
  });

  describe('emphasizePolar', () => {
    it('leaves an undimmed segment untouched, object identity included', () => {
      const s = slice();
      const out = emphasizePolar(scene({ slices: [s] }), new Map(), '#FFF');
      // Cheap re-render: an unchanged segment should not be cloned.
      expect(out.slices[0]).toBe(s);
    });

    it('fades a dimmed segment toward the surface', () => {
      const s = slice({ color: '#000000', dataIndex: 2, seriesIndex: 1 });
      const out = emphasizePolar(scene({ slices: [s] }), new Map([['2:1', 1]]), '#FFFFFF');
      expect(out.slices[0].color).not.toBe('#000000');
      expect(out.slices[0]).not.toBe(s);
    });

    it('ignores a dim below the noise floor rather than re-mixing every frame', () => {
      const s = slice();
      const out = emphasizePolar(scene({ slices: [s] }), new Map([['0:-1', 0.001]]), '#FFF');
      expect(out.slices[0]).toBe(s);
    });

    it('keys a segment with no series as -1', () => {
      const s = slice({ dataIndex: 3, seriesIndex: undefined, color: '#000000' });
      const out = emphasizePolar(scene({ slices: [s] }), new Map([['3:-1', 1]]), '#FFFFFF');
      expect(out.slices[0].color).not.toBe('#000000');
    });

    it('preserves everything else about the scene', () => {
      const s = scene({ slices: [slice()], width: 999 });
      expect(emphasizePolar(s, new Map(), '#FFF').width).toBe(999);
    });
  });

  describe('barKey / barsByKey', () => {
    it('keys by CATEGORY when categories are unique, so a bar survives a reorder', () => {
      const before = scene({ xValues: ['ATL', 'BOS'], bars: [bar({ dataIndex: 0 }), bar({ dataIndex: 1 })] });
      const after = scene({ xValues: ['BOS', 'ATL'], bars: [bar({ dataIndex: 0 }), bar({ dataIndex: 1 })] });
      // "ATL" moved from slot 0 to slot 1 but is the SAME bar sliding between ranks.
      expect(barKey(before, before.bars[0])).toBe(barKey(after, after.bars[1]));
    });

    it('falls back to the SLOT when categories repeat', () => {
      // A rolling window (Q1,Q2,Q1) — keyed by category the two Q1 bars would
      // collide onto one key and one would draw on top of the other.
      const s = scene({
        xValues: ['Q1', 'Q2', 'Q1'],
        bars: [bar({ dataIndex: 0 }), bar({ dataIndex: 1 }), bar({ dataIndex: 2 })],
      });
      const keys = s.bars.map((b) => barKey(s, b));
      expect(new Set(keys).size).toBe(3);
    });

    it('falls back to the slot when there are no categories at all', () => {
      const s = scene({ bars: [bar({ dataIndex: 0 }), bar({ dataIndex: 1 })] });
      expect(new Set(s.bars.map((b) => barKey(s, b))).size).toBe(2);
    });

    it('separates series that share a category', () => {
      const s = scene({
        xValues: ['ATL'],
        bars: [bar({ seriesIndex: 0 }), bar({ seriesIndex: 1 })],
      });
      expect(barKey(s, s.bars[0])).not.toBe(barKey(s, s.bars[1]));
    });

    it('tolerates a null category', () => {
      const s = scene({ xValues: [null as unknown as string], bars: [bar()] });
      expect(typeof barKey(s, s.bars[0])).toBe('string');
    });

    it('keeps every piece of a bar split by a value-axis break', () => {
      // Both pieces carry the same (series, category); without an occurrence
      // suffix they collapse to one entry and the piece past the break is
      // dropped, leaving the outlier stuck at the break line.
      const s = scene({
        xValues: ['ATL'],
        bars: [bar({ y: 0, h: 10 }), bar({ y: 40, h: 10 })],
      });
      const m = barsByKey(s);
      expect(m.size).toBe(2);
      expect([...m.keys()].some((k) => k.includes('~1'))).toBe(true);
    });

    it('maps every bar for an ordinary scene', () => {
      const s = scene({ xValues: ['a', 'b'], bars: [bar({ dataIndex: 0 }), bar({ dataIndex: 1 })] });
      expect(barsByKey(s).size).toBe(2);
    });
  });

  describe('lerpBar', () => {
    it('interpolates position and size', () => {
      const out = lerpBar(bar({ x: 0, y: 0, w: 10, h: 10 }), bar({ x: 10, y: 20, w: 30, h: 50 }), 0.5);
      expect(out).toEqual(expect.objectContaining({ x: 5, y: 10, w: 20, h: 30 }));
    });

    it('sits exactly on each end at e=0 and e=1', () => {
      const from = bar({ x: 0 });
      const to = bar({ x: 100 });
      expect(lerpBar(from, to, 0).x).toBe(0);
      expect(lerpBar(from, to, 1).x).toBe(100);
    });

    it('takes non-geometric properties from the destination', () => {
      const out = lerpBar(bar({ color: '#000' }), bar({ color: '#FFF', dataIndex: 7 }), 0.5);
      expect(out.color).toBe('#FFF');
      expect(out.dataIndex).toBe(7);
    });
  });

  describe('barsDiffer', () => {
    const withBars = (bars: SceneBar[]) => scene({ xValues: ['a', 'b'], bars });

    it('is false for two identical scenes', () => {
      expect(barsDiffer(withBars([bar()]), withBars([bar()]))).toBe(false);
    });

    it('is true when a bar enters or leaves', () => {
      expect(barsDiffer(withBars([bar()]), withBars([bar(), bar({ dataIndex: 1 })]))).toBe(true);
    });

    it('is true when a bar moved or resized', () => {
      expect(barsDiffer(withBars([bar({ x: 0 })]), withBars([bar({ x: 10 })]))).toBe(true);
      expect(barsDiffer(withBars([bar({ h: 10 })]), withBars([bar({ h: 40 })]))).toBe(true);
    });

    it('ignores sub-half-pixel drift, which is layout noise not motion', () => {
      expect(barsDiffer(withBars([bar({ x: 0 })]), withBars([bar({ x: 0.4 })]))).toBe(false);
    });

    it('is true when identity changed even though the count did not', () => {
      const a = scene({ xValues: ['ATL'], bars: [bar({ seriesIndex: 0 })] });
      const b = scene({ xValues: ['ATL'], bars: [bar({ seriesIndex: 1 })] });
      expect(barsDiffer(a, b)).toBe(true);
    });
  });
});

describe('BarChartEngine', () => {
  let ctx: RecordingCtx;
  let restore: () => void;
  let container: HTMLElement;
  let engine: BarChartEngine;

  const spec = (over: Partial<BarChartSpec> = {}): BarChartSpec => ({
    series: [{ label: 'S1', color: '#6750A4', data: [3, 5, 2], hidden: false }],
    categories: ['A', 'B', 'C'],
    categoryFormatter: (v) => String(v),
    valueScale: 'value',
    valueFormatter: (v) => String(v),
    stack: 'none',
    horizontal: false,
    categoryGapRatio: 0.3,
    barGapRatio: 0.2,
    cornerRadius: 6,
    showLabels: false,
    ...over,
  });

  beforeEach(() => {
    ({ ctx, restore } = installCanvas());
    container = makeChartContainer(400, 300);
    engine = new BarChartEngine(container);
  });

  afterEach(() => {
    engine.dispose();
    container.remove();
    restore();
  });

  it('builds a canvas into the container', () => {
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('has no scene until a spec arrives', () => {
    expect(engine.getScene()).toBeNull();
  });

  it('renders bars and paints them', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    expect(engine.getScene()?.bars.length).toBeGreaterThan(0);
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it('skips the intro when animation is off', async () => {
    engine.setSpec(spec(), theme, {}, { animate: false });
    await flushFrames(4);
    expect(engine.getScene()).toBeTruthy();
  });

  it('re-renders on a new spec', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    engine.setSpec(spec({ categories: ['A'], series: [{ label: 'S1', color: '#000', data: [1], hidden: false }] }), theme);
    await flushFrames(8);
    expect(engine.getScene()?.bars).toHaveLength(1);
  });

  it('survives an empty dataset', async () => {
    engine.setSpec(spec({ categories: [], series: [] }), theme);
    await flushFrames(4);
    expect(engine.getScene()?.bars ?? []).toHaveLength(0);
  });

  it('ignores the observer’s initial same-size callback', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    const before = ctx.calls.length;
    engine.resize();
    expect(ctx.calls.length).toBe(before);
  });

  it('repaints when the box actually changed', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    const before = ctx.calls.length;
    container.getBoundingClientRect = () =>
      ({ width: 700, height: 400, top: 0, left: 0, right: 700, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    engine.resize();
    await nextFrame();
    expect(ctx.calls.length).toBeGreaterThan(before);
  });

  it('toggles hover and click handling without throwing', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    expect(() => {
      engine.setHoverEnabled(false);
      engine.setHoverEnabled(true);
      engine.setClickable(false);
      engine.setClickable(true);
      engine.setTooltip({});
    }).not.toThrow();
  });

  it('moves focus to a bar', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    expect(() => engine.focusIndex(1)).not.toThrow();
    await flushFrames(8);
  });

  it('replays the intro', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    engine.replay();
    await flushFrames(20);
    expect(engine.getScene()).toBeTruthy();
  });

  it('drills and settles on the new level', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    engine.drill(0, 'down');
    engine.setSpec(spec({ categories: ['A1'], series: [{ label: 'S1', color: '#000', data: [1], hidden: false }] }), theme);
    await flushFrames(40);
    expect(engine.getScene()?.bars).toHaveLength(1);
  });

  it('exports a data URL', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    expect(engine.toDataURL()).toContain('data:image/png');
  });

  it('stops painting after dispose', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    engine.dispose();
    ctx.reset();
    await flushFrames(10);
    expect(ctx.calls).toHaveLength(0);
  });

  it('tolerates a second dispose', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(4);
    engine.dispose();
    expect(() => engine.dispose()).not.toThrow();
  });
});
