/*
 * Range series — a band between two values per row, rather than a line filled
 * down to the baseline. Pins the geometry a range unlocks (area-range,
 * range-with-line and fan-chart charts all rest on it).
 */
import { computeLayout, type EngineTheme, type LineChartSpec } from './layout';
import { areaSeriesAt } from './hit-test';
import { buildDataTableHtml } from '../a11y';
import { normalizeRange } from '../xy';

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

const spec = (over: Partial<LineChartSpec> = {}): LineChartSpec => ({
  series: [],
  xValues: ['A', 'B', 'C'],
  xScale: 'category',
  xFormatter: (v) => String(v),
  yScale: 'value',
  yFormatter: (v) => String(v),
  stack: 'none',
  area: true,
  ...over,
});

const rangeSeries = (range: LineChartSpec['series'][number]['range']) => ({
  label: 'Range',
  color: '#6750A4',
  data: range!.map(() => null),
  range,
  curve: 'linear' as const,
  connectNulls: false,
  showMarks: false,
  hidden: false,
});

describe('normalizeRange', () => {
  it('accepts both the tuple and the object form, and orders the edges', () => {
    expect(normalizeRange([3, 9])).toEqual([3, 9]);
    expect(normalizeRange({ low: 3, high: 9 })).toEqual([3, 9]);
    // A caller who writes [max, min] still gets a band, not one drawn backwards.
    expect(normalizeRange([9, 3])).toEqual([3, 9]);
  });

  it('treats a null datum or a null edge as a gap', () => {
    expect(normalizeRange(null)).toBeNull();
    expect(normalizeRange([null, 9])).toBeNull();
    expect(normalizeRange({ low: 3, high: null })).toBeNull();
    expect(normalizeRange(undefined)).toBeNull();
  });
});

describe('range series layout', () => {
  it('fills between the two edges instead of down to the baseline', () => {
    const scene = computeLayout(
      spec({ series: [rangeSeries([[10, 20], [12, 24], [8, 18]])] }),
      theme,
      400,
      300,
    );
    expect(scene.areas).toHaveLength(1);
    const a = scene.areas[0];
    // basePoints is what makes it a band: without them the fill runs to
    // `baselineY` and the low edge is never drawn.
    expect(a.basePoints).toBeTruthy();
    expect(a.basePoints!.length).toBe(a.points.length);
    // The low edge sits BELOW the high edge on screen (y grows downward).
    a.points.forEach((p, i) => expect(a.basePoints![i].y).toBeGreaterThan(p.y));
  });

  it('takes the axis domain from both edges, not just the drawn top', () => {
    const scene = computeLayout(
      spec({ series: [rangeSeries([[-5, 5], [-3, 7]])], xValues: ['A', 'B'] }),
      theme,
      400,
      300,
    );
    const ticks = scene.texts.filter((t) => t.key?.startsWith('yt-')).map((t) => Number(t.text));
    // A domain taken from the high edge alone would floor at 0, and the axis
    // would carry no negative label at all.
    expect(Math.min(...ticks)).toBeLessThan(0);
    // Both edges land inside the plot: a domain that missed the lows would push
    // the base below the plot floor, where it is clipped away.
    const a = scene.areas[0];
    const top = scene.plot.y;
    const bottom = scene.plot.y + scene.plot.height;
    for (const p of [...a.points, ...a.basePoints!]) {
      expect(p.y).toBeGreaterThanOrEqual(top - 0.5);
      expect(p.y).toBeLessThanOrEqual(bottom + 0.5);
    }
  });

  it('draws no stroke — the band has no single value to trace', () => {
    const scene = computeLayout(spec({ series: [rangeSeries([[1, 2], [3, 4]])] }), theme, 400, 300);
    expect(scene.lines).toHaveLength(0);
  });

  it('keeps an even tint across the band rather than fading to nothing', () => {
    const scene = computeLayout(spec({ series: [rangeSeries([[1, 2], [3, 4]])] }), theme, 400, 300);
    expect(scene.areas[0].colorTop).toBe(scene.areas[0].colorBottom);
  });

  it('gives a STACKED layer the same even tint, and keeps the fade for a plain fill', () => {
    const s2 = (stack: LineChartSpec['stack']) =>
      computeLayout(
        spec({
          stack,
          series: [
            { label: 'A', color: '#6750A4', data: [3, 4], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
            { label: 'B', color: '#B3261E', data: [2, 5], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
          ],
        }),
        theme,
        400,
        300,
      );
    // Stacked: every layer fills its own band, so no layer fades into the one
    // below it — that fade is what made adjacent bands bleed together.
    for (const a of s2('normal').areas) expect(a.colorTop).toBe(a.colorBottom);
    // Unstacked: the fill runs to the axis and still fades away from the line.
    for (const a of s2('none').areas) expect(a.colorTop).not.toBe(a.colorBottom);
  });

  it('stays out of the stack so layers above it are not pushed up by its top edge', () => {
    const line = {
      label: 'Line',
      color: '#B3261E',
      data: [10, 10, 10],
      curve: 'linear' as const,
      connectNulls: false,
      showMarks: false,
      hidden: false,
    };
    const withRange = computeLayout(
      spec({ stack: 'normal', series: [rangeSeries([[100, 200], [100, 200], [100, 200]]), line] }),
      theme,
      400,
      300,
    );
    const alone = computeLayout(spec({ stack: 'normal', series: [line] }), theme, 400, 300);
    // The line's own values are unchanged by the band next to it; only the
    // axis domain (which now covers the band) moves.
    expect(withRange.hoverPoints.find((h) => h.label === 'Line')!.byIndex[0].value).toBe(10);
    expect(alone.hoverPoints.find((h) => h.label === 'Line')!.byIndex[0].value).toBe(10);
  });

  it('carries both edges on the hover point so the tooltip can print the band', () => {
    const scene = computeLayout(spec({ series: [rangeSeries([[10, 20], [12, 24]])] }), theme, 400, 300);
    const p = scene.hoverPoints[0].byIndex[0];
    expect(p.low).toBe(10);
    expect(p.high).toBe(20);
  });

  it('breaks the band at a null row', () => {
    const scene = computeLayout(
      spec({ series: [rangeSeries([[10, 20], null, [8, 18]])] }),
      theme,
      400,
      300,
    );
    // Two disjoint bands, not one bridged across the gap.
    expect(scene.areas).toHaveLength(2);
  });
});

describe('range series accessibility', () => {
  it('prints the band in the screen-reader table', () => {
    const html = buildDataTableHtml({
      xAxisData: ['Mon', 'Tue'],
      series: [{ label: 'Temperature', range: [[-4.8, 1], null] }] as never,
      valueFormatter: (v) => (v == null ? '—' : `${v}°C`),
    });
    expect(html).toContain('-4.8°C–1°C');
    // A gap reads as the missing-value placeholder, not as "0–0".
    expect(html).toContain('—');
  });
});

describe('inverted area layout', () => {
  const invSpec = (over: Partial<LineChartSpec> = {}) =>
    spec({
      inverted: true,
      series: [
        {
          label: 'Revenue',
          color: '#6750A4',
          data: [10, 40, 70],
          curve: 'linear',
          connectNulls: false,
          showMarks: false,
          hidden: false,
        },
      ],
      ...over,
    });

  it('emits an area at all (it used to drop every fill when transposed)', () => {
    expect(computeLayout(invSpec(), theme, 400, 300).areas).toHaveLength(1);
  });

  it('closes the fill against a baseline X, not a baseline Y', () => {
    const scene = computeLayout(invSpec(), theme, 400, 300);
    const a = scene.areas[0];
    expect(a.horizontal).toBe(true);
    expect(a.basePoints).toBeTruthy();
    // Every base point shares one x (the value baseline) and mirrors its
    // point's y — that is what makes the polygon close sideways.
    const baseXs = new Set(a.basePoints!.map((p) => Math.round(p.x)));
    expect(baseXs.size).toBe(1);
    a.points.forEach((p, i) => expect(a.basePoints![i].y).toBeCloseTo(p.y, 5));
    // ...and the fill runs out from that baseline, not down to the plot floor.
    expect(Math.max(...a.points.map((p) => p.x))).toBeGreaterThan([...baseXs][0]);
  });

  it('keeps the fill inside the plot', () => {
    const scene = computeLayout(invSpec(), theme, 400, 300);
    for (const p of [...scene.areas[0].points, ...scene.areas[0].basePoints!]) {
      expect(p.x).toBeGreaterThanOrEqual(scene.plot.x - 0.5);
      expect(p.x).toBeLessThanOrEqual(scene.plot.x + scene.plot.width + 0.5);
    }
  });

  it('still draws no area when the chart is a plain line chart', () => {
    expect(computeLayout(invSpec({ area: false }), theme, 400, 300).areas).toHaveLength(0);
  });
});

describe('inverted stacking', () => {
  const composition = (over: Partial<LineChartSpec> = {}) =>
    spec({
      inverted: true,
      stack: 'percentage',
      xValues: [0, 100, 200],
      xScale: 'value',
      series: [
        { label: 'N2', color: '#6750A4', data: [78, 40, 5], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
        { label: 'O', color: '#7D5260', data: [1, 55, 90], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
      ],
      ...over,
    });

  it('stacks layers along the value axis instead of restarting each at the baseline', () => {
    const scene = computeLayout(composition(), theme, 400, 300);
    expect(scene.areas).toHaveLength(2);
    const [first, second] = scene.areas;
    // The second layer's base is the first layer's top — that IS the stack.
    second.basePoints!.forEach((b, i) => expect(b.x).toBeCloseTo(first.points[i].x, 0));
    // ...and the first still bases on the axis origin.
    const originX = Math.min(...first.basePoints!.map((p) => p.x));
    expect(Math.max(...first.basePoints!.map((p) => p.x))).toBeCloseTo(originX, 5);
  });

  it('fills the full width at every row when percentage-stacked', () => {
    const scene = computeLayout(composition(), theme, 400, 300);
    const top = scene.areas[1].points;
    // Each column totals 100%, so the outer edge is flush at every row.
    const xs = top.map((p) => Math.round(p.x));
    expect(new Set(xs).size).toBe(1);
  });

  it('leaves an unstacked inverted chart basing on zero', () => {
    const scene = computeLayout(composition({ stack: 'none' }), theme, 400, 300);
    for (const a of scene.areas) {
      const baseXs = new Set(a.basePoints!.map((p) => Math.round(p.x)));
      expect(baseXs.size).toBe(1);
    }
  });
});

describe('subtitle across layouts', () => {
  const withSub = (over: Partial<LineChartSpec>) =>
    computeLayout(
      spec({
        title: 'Composition',
        subtitle: 'Source: a model',
        series: [
          { label: 'A', color: '#6750A4', data: [1, 2, 3], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
        ],
        ...over,
      }),
      theme,
      400,
      300,
    );

  it('renders the subtitle in the upright, inverted and multi-axis layouts', () => {
    for (const over of [
      {},
      { inverted: true },
      { yAxes: [{ formatter: (v: number) => String(v) }] } as Partial<LineChartSpec>,
    ]) {
      const scene = withSub(over);
      expect(scene.texts.find((t) => t.key === 'subtitle')?.text).toBe('Source: a model');
    }
  });

  it('reserves room for it, so it never lands on the plot', () => {
    for (const over of [{}, { inverted: true }, { yAxes: [{ formatter: (v: number) => String(v) }] } as Partial<LineChartSpec>]) {
      const scene = withSub(over);
      const sub = scene.texts.find((t) => t.key === 'subtitle')!;
      expect(sub.y).toBeLessThan(scene.plot.y);
    }
  });
});

describe('hover on filled bands', () => {
  const stream = (over: Partial<LineChartSpec> = {}) =>
    computeLayout(
      spec({
        stack: 'normal',
        xValues: [0, 1, 2],
        xScale: 'value',
        series: [
          { label: 'Lower', color: '#6750A4', data: [10, 10, 10], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
          { label: 'Upper', color: '#B3261E', data: [10, 10, 10], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
        ],
        ...over,
      }),
      theme,
      400,
      300,
    );

  it('names the band the cursor is INSIDE, not the nearest line', () => {
    const scene = stream();
    const [lower, upper] = scene.areas;
    const midX = (lower.points[0].x + lower.points[lower.points.length - 1].x) / 2;
    const yIn = (a: (typeof lower)) => {
      const top = a.points[Math.floor(a.points.length / 2)].y;
      const base = a.basePoints![Math.floor(a.basePoints!.length / 2)].y;
      return (top + base) / 2;
    };
    // Deep inside the lower band, the NEAREST LINE is the upper series' own
    // edge sitting right above it — the old test handed hover to the wrong one.
    expect(areaSeriesAt(scene, midX, yIn(lower))).toBe(0);
    expect(areaSeriesAt(scene, midX, yIn(upper))).toBe(1);
  });

  it('returns -1 outside every band, so the line fallback still applies', () => {
    // Headroom above the stack, or the two bands fill the plot and there is no
    // "outside" left to test.
    const scene = stream({ yMax: 60 });
    expect(areaSeriesAt(scene, scene.plot.x + 5, scene.plot.y + 2)).toBe(-1);
    // ...and outside the plot entirely.
    expect(areaSeriesAt(scene, 2, 2)).toBe(-1);
  });

  it('picks the nearest top edge where unstacked areas overlap', () => {
    const scene = stream({ stack: 'none' });
    // Both fill to zero and so both contain a low point; the one whose own edge
    // is nearer wins rather than whichever happened to be drawn last.
    const midX = (scene.areas[0].points[0].x + scene.areas[0].points[2].x) / 2;
    const at = areaSeriesAt(scene, midX, scene.plot.y + scene.plot.height - 4);
    expect(at).toBeGreaterThanOrEqual(0);
  });
});

describe('streamgraph stroke default', () => {
  const modes = (stack: LineChartSpec['stack'], stroke?: boolean) =>
    computeLayout(
      spec({
        stack,
        series: [
          { label: 'A', color: '#6750A4', data: [1, 2, 3], curve: 'linear', connectNulls: false, showMarks: false, hidden: false, stroke },
        ],
      }),
      theme,
      400,
      300,
    );

  it('draws no line when a series opts out', () => {
    expect(modes('normal', false).lines).toHaveLength(0);
    expect(modes('normal').lines.length).toBeGreaterThan(0);
  });
});

describe('spline overshoot and collapsed bands', () => {
  // A composition profile: heavy gases run out with altitude, so several
  // stacked layers collapse to zero width at the top of the range.
  const KM = [0, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const PROFILE: Record<string, number[]> = {
    N2: [78.1, 78.0, 68.0, 42.0, 12.0, 2.4, 0.4, 0.05, 0.005, 0.0005, 0, 0],
    O2: [20.9, 20.8, 10.0, 3.6, 0.5, 0.05, 0.004, 0, 0, 0, 0, 0],
    O: [0.0, 0.3, 20.0, 52.0, 82.0, 88.0, 82.0, 62.0, 34.0, 13.0, 3.6, 0.8],
    He: [0.0005, 0.001, 0.05, 0.3, 2.5, 8.0, 16.0, 33.0, 55.0, 68.0, 66.0, 52.0],
  };
  const profile = (over: Partial<LineChartSpec> = {}) =>
    computeLayout(
      spec({
        stack: 'percentage',
        xValues: KM,
        xScale: 'value',
        series: Object.entries(PROFILE).map(([label, data]) => ({
          label,
          color: '#6750A4',
          data,
          curve: 'smooth' as const,
          connectNulls: false,
          showMarks: false,
          hidden: false,
        })),
        ...over,
      }),
      theme,
      588,
      588,
    );

  const outside = (scene: ReturnType<typeof profile>) => {
    const { x, y, width, height } = scene.plot;
    const pts = [
      ...scene.lines.flatMap((l) => l.points),
      ...scene.areas.flatMap((a) => [...a.points, ...(a.basePoints ?? [])]),
    ];
    return pts.filter((p) => p.x < x - 0.5 || p.x > x + width + 0.5 || p.y < y - 0.5 || p.y > y + height + 0.5);
  };

  it('keeps a smooth curve inside the plot', () => {
    // Catmull-Rom interpolates through its samples but its tangents can bulge
    // past them; where a layer collapses onto the axis that bulge painted a
    // stray line over the axis itself.
    expect(outside(profile())).toHaveLength(0);
    expect(outside(profile({ inverted: true }))).toHaveLength(0);
  });

  it('strokes each stacked layer end to end', () => {
    const scene = computeLayout(
      spec({
        stack: 'normal',
        series: [
          { label: 'A', color: '#6750A4', data: [5, 6, 7], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
          { label: 'B', color: '#B3261E', data: [4, 5, 6], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
        ],
      }),
      theme,
      400,
      300,
    );
    // One unbroken stroke per layer — a stroke that stopped and restarted where
    // a band got thin left visible stubs part-way along a chart whose series
    // simply grow from small values.
    expect(scene.lines.filter((l) => l.seriesIndex === 0)).toHaveLength(1);
    expect(scene.lines.filter((l) => l.seriesIndex === 1)).toHaveLength(1);
  });
});

describe('unanchored series', () => {
  const fillOnly = (over: Partial<LineChartSpec> = {}) =>
    computeLayout(
      spec({
        stack: 'percentage',
        series: [
          { label: 'A', color: '#6750A4', data: [60, 50, 40], curve: 'linear', connectNulls: false, showMarks: false, hidden: false, stroke: false },
          { label: 'B', color: '#B3261E', data: [40, 50, 60], curve: 'linear', connectNulls: false, showMarks: false, hidden: false, stroke: false },
        ],
        ...over,
      }),
      theme,
      400,
      300,
    );

  it('flags a series with no line and no marks, so hover skips its dot', () => {
    // The dot would sit on the band's top edge, which in a stack is a
    // cumulative total rather than any reading this series took.
    expect(fillOnly().hoverPoints.every((h) => h.unanchored)).toBe(true);
  });

  it('does not flag a series that draws something to anchor to', () => {
    const stroked = fillOnly({
      series: [
        { label: 'A', color: '#6750A4', data: [60, 50, 40], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
      ],
    });
    expect(stroked.hoverPoints[0].unanchored).toBe(false);
    // Marks alone are enough of an anchor, even with the line off.
    const marked = fillOnly({
      series: [
        { label: 'A', color: '#6750A4', data: [60, 50, 40], curve: 'linear', connectNulls: false, showMarks: true, hidden: false, stroke: false },
      ],
    });
    expect(marked.hoverPoints[0].unanchored).toBe(false);
  });

  it('flags a range band too — it has no single value to mark', () => {
    const scene = computeLayout(spec({ series: [rangeSeries([[1, 5], [2, 6]])] }), theme, 400, 300);
    expect(scene.hoverPoints[0].unanchored).toBe(true);
  });
});
