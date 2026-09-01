import { ascending, mirrorScene } from './rtl';
import { computeLayout, type EngineTheme, type LineChartSpec } from './layout';
import { hitTestScene, seriesSampleLines } from './hit-test';

/*
 * RTL is a mirror of the FINISHED frame, so these check the transform's
 * invariants (gutters swap, geometry reflects, text anchors flip) and that the
 * consumers which bisect on x still work when the samples run right-to-left.
 */

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
  series: [
    { label: 'A', color: '#6750A4', data: [10, 40, 20, 50], curve: 'linear', connectNulls: false, showMarks: true, hidden: false },
  ],
  xValues: ['Jan', 'Feb', 'Mar', 'Apr'],
  xScale: 'category',
  xFormatter: (v) => String(v),
  yScale: 'value',
  yFormatter: (v) => String(v),
  stack: 'none',
  area: false,
  title: 'Sales',
  gridY: true,
  ...over,
});

const W = 500;
const H = 320;
const ltr = () => computeLayout(spec(), theme, W, H);

describe('mirrorScene', () => {
  it('moves the y-axis gutter to the other side, keeping the plot width', () => {
    const a = ltr();
    const b = mirrorScene(a);
    expect(b.plot.width).toBe(a.plot.width);
    // The wide (label-bearing) gutter was on the left; now it is on the right.
    const leftGutterAfter = b.plot.x;
    const rightGutterAfter = b.width - (b.plot.x + b.plot.width);
    expect(rightGutterAfter).toBeCloseTo(a.plot.x, 5);
    expect(leftGutterAfter).toBeCloseTo(a.width - (a.plot.x + a.plot.width), 5);
  });

  it('reverses the data direction: the first point ends up on the right', () => {
    const a = ltr();
    const b = mirrorScene(a);
    const first = (s: typeof a) => s.hoverPoints[0].byIndex[0].x;
    const last = (s: typeof a) => s.hoverPoints[0].byIndex[3].x;
    expect(first(a)).toBeLessThan(last(a)); // LTR: index 0 leftmost
    expect(first(b)).toBeGreaterThan(last(b)); // RTL: index 0 rightmost
    expect(first(b)).toBeCloseTo(a.width - first(a), 5);
  });

  it('keeps y untouched — only the horizontal is mirrored', () => {
    const a = ltr();
    const b = mirrorScene(a);
    expect(b.hoverPoints[0].byIndex[1].y).toBe(a.hoverPoints[0].byIndex[1].y);
    expect(b.lines[0].points.map((p) => p.y)).toEqual(a.lines[0].points.map((p) => p.y));
  });

  it('flips which side text anchors from, without touching the string', () => {
    const a = ltr();
    const b = mirrorScene(a);
    const title = (s: typeof a) => s.texts.find((t) => t.key === 'title')!;
    expect(title(a).align).toBe('start');
    expect(title(b).align).toBe('end');
    expect(title(b).text).toBe('Sales');
    expect(title(b).x).toBeCloseTo(a.width - title(a).x, 5);
    // y tick labels: right-aligned in the left gutter → left-aligned in the right one.
    const yTick = (s: typeof a) => s.texts.find((t) => t.key?.startsWith('yt-'))!;
    expect(yTick(a).align).toBe('end');
    expect(yTick(b).align).toBe('start');
  });

  it('mirrors rotation too, so tilted labels lean the other way', () => {
    const a = ltr();
    // A rotated tick label and a rotated (vertical) axis title.
    const withRotation = {
      ...a,
      texts: [
        { ...a.texts[0], key: 'xt-0', rotate: -35 },
        { ...a.texts[0], key: 'ylabel', rotate: -90 },
        { ...a.texts[0], key: 'title', rotate: 0 },
      ],
    };
    const out = mirrorScene(withRotation).texts;
    expect(out[0].rotate).toBe(35);
    expect(out[1].rotate).toBe(90); // reads top-to-bottom on the right-hand axis
    expect(out[2].rotate).toBe(0); // unrotated text is untouched, not -0
    expect(Object.is(out[2].rotate, -0)).toBe(false);
  });

  it('mirrors rects by their far edge, so they keep their width', () => {
    const bars = mirrorScene({
      ...ltr(),
      bars: [{ x: 10, y: 0, w: 30, h: 5, color: '#000', radius: [0, 0, 0, 0], seriesIndex: 0, dataIndex: 0 }],
    }).bars;
    expect(bars[0].x).toBe(W - 40); // 500 - (10 + 30)
    expect(bars[0].w).toBe(30);
  });

  it('is its own inverse (to float precision — W − (W − x) drifts ~1e-14)', () => {
    const a = ltr();
    const back = mirrorScene(mirrorScene(a));
    expect(back.plot.x).toBeCloseTo(a.plot.x, 9);
    expect(back.plot.width).toBeCloseTo(a.plot.width, 9);
    back.xPositions.forEach((x, i) => expect(x).toBeCloseTo(a.xPositions[i], 9));
    back.texts.forEach((t, i) => {
      expect(t.x).toBeCloseTo(a.texts[i].x, 9);
      expect(t.align).toBe(a.texts[i].align);
    });
  });

  it('leaves the x VALUES and labels alone — only pixels move', () => {
    const a = ltr();
    const b = mirrorScene(a);
    expect(b.xValues).toEqual(a.xValues);
    expect(b.xLabels).toEqual(a.xLabels);
  });
});

describe('ascending', () => {
  it('passes an already-ascending run straight through (same reference)', () => {
    const pts: [number, number][] = [
      [0, 1],
      [5, 2],
    ];
    expect(ascending(pts)).toBe(pts);
  });

  it('reverses a descending run without mutating the input', () => {
    const pts: [number, number][] = [
      [5, 2],
      [0, 1],
    ];
    const out = ascending(pts);
    expect(out.map((p) => p[0])).toEqual([0, 5]);
    expect(pts[0][0]).toBe(5);
  });
});

describe('hit-testing a mirrored scene', () => {
  it('finds the same data point, at its mirrored position', () => {
    const a = ltr();
    const b = mirrorScene(a);
    const p = a.hoverPoints[0].byIndex[1];
    const hitLtr = hitTestScene(a, p.x, p.y);
    const hitRtl = hitTestScene(b, b.width - p.x, p.y);
    expect(hitLtr).toEqual({ kind: 'mark', seriesIndex: 0, dataIndex: 1 });
    expect(hitRtl).toEqual(hitLtr);
  });

  it('still resolves a click on the LINE, which needs ascending samples', () => {
    const a = ltr();
    const b = mirrorScene(a);
    const p1 = a.hoverPoints[0].byIndex[1];
    const p2 = a.hoverPoints[0].byIndex[2];
    // 60% along the segment: clear of both marks' radius.
    const x = p1.x + 0.6 * (p2.x - p1.x);
    const y = p1.y + 0.6 * (p2.y - p1.y);
    expect(hitTestScene(a, x, y)?.kind).toBe('line');
    expect(hitTestScene(b, b.width - x, y)?.kind).toBe('line');
  });

  it('hands the distance test ascending samples even though the scene descends', () => {
    const b = mirrorScene(ltr());
    const xs = b.hoverPoints[0].byIndex;
    expect(xs[0].x).toBeGreaterThan(xs[3].x); // the scene itself runs right-to-left
    const lines = seriesSampleLines(b);
    expect(lines[0][0][0]).toBeLessThan(lines[0][lines[0].length - 1][0]);
  });

  it('reports the background for a click in the (now right-hand) gutter', () => {
    const b = mirrorScene(ltr());
    // Just outside the plot's right edge = the mirrored y-axis gutter.
    expect(hitTestScene(b, b.plot.x + b.plot.width + 6, b.plot.y + b.plot.height / 2)).toBeNull();
  });
});

describe('mirrorScene — bar corners', () => {
  /*
   * A bar is rounded on the end its value grows towards. Mirroring the box
   * without the corners left every RTL bar square at the value and rounded
   * against the axis, so the shape read backwards.
   *
   * Built from a real layout so the scene carries every field `mirrorScene`
   * touches, with the bars swapped in — a hand-rolled literal drifts the day
   * the scene grows a field.
   */
  const withBars = (radius: [number, number, number, number]) => {
    const base = ltr();
    return {
      ...base,
      bars: [{ x: 10, y: 5, w: 40, h: 10, horizontal: true, radius, color: '#000' }],
    } as typeof base;
  };

  it('swaps the horizontal corner pairs with the box', () => {
    // [top-start, top-end, bottom-end, bottom-start] — the two ends trade.
    expect(mirrorScene(withBars([0, 8, 8, 0])).bars[0].radius).toEqual([8, 0, 0, 8]);
  });

  it('carries the rounded end along with the mirrored box', () => {
    const out = mirrorScene(withBars([0, 8, 8, 0]));
    // x mirrors to width - (x + w), and the rounding follows it to the start.
    expect(out.bars[0].x).toBe(out.width - 50);
    expect(out.bars[0].radius[0]).toBe(8);
  });

  it('leaves a uniformly rounded bar unchanged', () => {
    expect(mirrorScene(withBars([4, 4, 4, 4])).bars[0].radius).toEqual([4, 4, 4, 4]);
  });
});
