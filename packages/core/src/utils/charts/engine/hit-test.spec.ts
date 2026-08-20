import { axisSeriesValues, hitTestScene, LINE_HIT_TOLERANCE, MARK_HIT_RADIUS, type SceneHit } from './hit-test';
import type { HoverPoint, HoverSeries, RenderScene, SceneArea } from './scene';

/*
 * Click hit-testing — the precedence rule (mark > line > area > axis
 * background) and the geometry each step uses. Pure functions over a
 * RenderScene, so these run without a canvas.
 *
 * Geometry shared by most cases: plot x 50…350, y 20…260, with two data points
 * at (100, 100) and (300, 100) — 200px apart, so a click at their midpoint is
 * far outside the mark radius and can only read as the line.
 */

function scene(over: Partial<RenderScene> = {}): RenderScene {
  return {
    width: 400,
    height: 300,
    plot: { x: 50, y: 20, width: 300, height: 240 },
    gridlines: [],
    axisLines: [],
    areas: [],
    bars: [],
    slices: [],
    lines: [],
    markers: [],
    texts: [],
    legend: [],
    xPositions: [100, 300],
    xValues: ['a', 'b'],
    xLabels: ['a', 'b'],
    hoverPoints: [],
    ...over,
  };
}

function series(seriesIndex: number, byIndex: Record<number, HoverPoint>, label = `S${seriesIndex}`): HoverSeries {
  return { seriesIndex, color: '#6750A4', label, byIndex };
}

/** The hit's series, for the kinds that have one (the background has none). */
function hitSeries(hit: SceneHit): number | undefined {
  return hit && hit.kind !== 'axis' ? hit.seriesIndex : undefined;
}

/** The flat two-point series used by most cases. */
const flat = series(0, { 0: { x: 100, y: 100, value: 10 }, 1: { x: 300, y: 100, value: 10 } });

function area(over: Partial<SceneArea> = {}): SceneArea {
  return {
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ],
    baselineY: 260,
    colorTop: 'rgba(103,80,164,0.35)',
    colorBottom: 'rgba(103,80,164,0.02)',
    seriesIndex: 0,
    ...over,
  };
}

describe('hitTestScene', () => {
  describe('marks', () => {
    it('reports a mark when the click lands on a data point', () => {
      expect(hitTestScene(scene({ hoverPoints: [flat] }), 100, 100)).toEqual({
        kind: 'mark',
        seriesIndex: 0,
        dataIndex: 0,
      });
    });

    it('takes precedence over the line: a click ON a mark is never a line click', () => {
      // 10px along the line from the point — on the line AND inside the mark radius.
      expect(hitTestScene(scene({ hoverPoints: [flat], areas: [area()] }), 110, 100)?.kind).toBe('mark');
    });

    it('picks the series whose point at that x is nearest', () => {
      const s1 = series(1, { 0: { x: 100, y: 130, value: 4 }, 1: { x: 300, y: 130, value: 4 } });
      const hit = hitTestScene(scene({ hoverPoints: [flat, s1] }), 100, 122);
      expect(hit).toEqual({ kind: 'mark', seriesIndex: 1, dataIndex: 0 });
    });

    it('still fires outside the plot rect (a click just past the axis counts)', () => {
      // py 10 is above the plot (y starts at 20) but within the mark radius.
      expect(hitTestScene(scene({ hoverPoints: [flat] }), 100, 80)?.kind).toBe('mark');
      const belowPlot = series(0, { 0: { x: 100, y: 255, value: 1 }, 1: { x: 300, y: 255, value: 1 } });
      expect(hitTestScene(scene({ hoverPoints: [belowPlot] }), 100, 275)?.kind).toBe('mark');
    });

    it('gives up on the mark just past the radius, and falls through', () => {
      const inside = hitTestScene(scene({ hoverPoints: [flat] }), 100, 100 + MARK_HIT_RADIUS);
      const outside = hitTestScene(scene({ hoverPoints: [flat] }), 100, 100 + MARK_HIT_RADIUS + 1);
      expect(inside?.kind).toBe('mark');
      expect(outside?.kind).toBe('axis');
    });
  });

  describe('lines', () => {
    it('reports the line for a click between two marks', () => {
      // Midway (220, 100): 120px / 80px from the two points, so no mark can win.
      expect(hitTestScene(scene({ hoverPoints: [flat] }), 220, 100)).toEqual({
        kind: 'line',
        seriesIndex: 0,
        dataIndex: 1,
      });
    });

    it('interpolates between the samples bracketing the click (sloped line)', () => {
      const sloped = series(0, { 0: { x: 100, y: 60, value: 1 }, 1: { x: 300, y: 260, value: 3 } });
      // Halfway along, the drawn line is at y = 160.
      expect(hitTestScene(scene({ hoverPoints: [sloped] }), 200, 160)?.kind).toBe('line');
      expect(hitTestScene(scene({ hoverPoints: [sloped] }), 200, 200)?.kind).toBe('axis');
    });

    it('holds to its tolerance: inside hits the line, one pixel further does not', () => {
      const hp = { hoverPoints: [flat] };
      expect(hitTestScene(scene(hp), 220, 100 + LINE_HIT_TOLERANCE)?.kind).toBe('line');
      expect(hitTestScene(scene(hp), 220, 100 + LINE_HIT_TOLERANCE + 1)?.kind).toBe('axis');
    });

    it('picks the nearest of several lines', () => {
      const s1 = series(1, { 0: { x: 100, y: 160, value: 4 }, 1: { x: 300, y: 160, value: 4 } });
      expect(hitSeries(hitTestScene(scene({ hoverPoints: [flat, s1] }), 220, 157))).toBe(1);
      expect(hitSeries(hitTestScene(scene({ hoverPoints: [flat, s1] }), 220, 103))).toBe(0);
    });

    it('takes precedence over the area under it', () => {
      expect(hitTestScene(scene({ hoverPoints: [flat], areas: [area()] }), 220, 104)?.kind).toBe('line');
    });
  });

  describe('areas', () => {
    it('reports the area for a click between the line and the baseline', () => {
      expect(hitTestScene(scene({ hoverPoints: [flat], areas: [area()] }), 220, 180)).toEqual({
        kind: 'area',
        seriesIndex: 0,
        dataIndex: 1,
      });
    });

    it('does not fire above the line, where nothing is filled', () => {
      expect(hitTestScene(scene({ hoverPoints: [flat], areas: [area()] }), 220, 60)?.kind).toBe('axis');
    });

    it('is off entirely when the chart draws no areas', () => {
      expect(hitTestScene(scene({ hoverPoints: [flat] }), 220, 180)?.kind).toBe('axis');
    });

    it('fills only its own band when the layer is stacked (basePoints)', () => {
      // Top layer of a stack: drawn from y=100 down to its base at y=200 — NOT
      // down to the shared baseline at 260.
      const stacked = area({
        basePoints: [
          { x: 100, y: 200 },
          { x: 300, y: 200 },
        ],
      });
      expect(hitTestScene(scene({ hoverPoints: [flat], areas: [stacked] }), 220, 150)?.kind).toBe('area');
      expect(hitTestScene(scene({ hoverPoints: [flat], areas: [stacked] }), 220, 230)?.kind).toBe('axis');
    });

    it('attributes a click to the band it is actually in, in a two-layer stack', () => {
      const upper = area({
        seriesIndex: 1,
        points: [
          { x: 100, y: 100 },
          { x: 300, y: 100 },
        ],
        basePoints: [
          { x: 100, y: 200 },
          { x: 300, y: 200 },
        ],
      });
      const lower = area({
        seriesIndex: 0,
        points: [
          { x: 100, y: 200 },
          { x: 300, y: 200 },
        ],
      });
      const s = scene({ hoverPoints: [flat], areas: [lower, upper] });
      expect(hitSeries(hitTestScene(s, 220, 150))).toBe(1);
      expect(hitSeries(hitTestScene(s, 220, 240))).toBe(0);
    });

    it('ignores x positions outside the area span', () => {
      const short = area({
        points: [
          { x: 100, y: 100 },
          { x: 180, y: 100 },
        ],
      });
      expect(hitTestScene(scene({ hoverPoints: [flat], areas: [short] }), 220, 180)?.kind).toBe('axis');
    });
  });

  describe('the plot background', () => {
    it('reports the nearest x index', () => {
      expect(hitTestScene(scene({ hoverPoints: [flat] }), 260, 220)).toEqual({ kind: 'axis', dataIndex: 1 });
      expect(hitTestScene(scene({ hoverPoints: [flat] }), 140, 220)).toEqual({ kind: 'axis', dataIndex: 0 });
    });

    it('stays quiet outside the plot rect (title, legend, axis gutters)', () => {
      const hp = { hoverPoints: [flat] };
      expect(hitTestScene(scene(hp), 220, 10)).toBeNull(); // above the plot (title)
      expect(hitTestScene(scene(hp), 220, 280)).toBeNull(); // below it (x-axis gutter)
      expect(hitTestScene(scene(hp), 20, 200)).toBeNull(); // left of it (y-axis gutter)
      expect(hitTestScene(scene(hp), 380, 200)).toBeNull(); // right of it
    });

    it('stays quiet when the chart has no x positions at all', () => {
      expect(hitTestScene(scene({ xPositions: [] }), 200, 150)).toBeNull();
    });
  });

  describe('inverted charts', () => {
    // Axes transposed: xPositions are y coordinates and the line runs vertically.
    const vertical = series(0, { 0: { x: 150, y: 100, value: 1 }, 1: { x: 150, y: 240, value: 2 } });
    const inv = (over: Partial<RenderScene> = {}) =>
      scene({ inverted: true, xPositions: [100, 240], hoverPoints: [vertical], ...over });

    it('measures the line along the transposed axis', () => {
      expect(hitTestScene(inv(), 150, 180)?.kind).toBe('line');
    });

    it('falls through to the background away from the line', () => {
      expect(hitTestScene(inv(), 190, 180)).toEqual({ kind: 'axis', dataIndex: 1 });
    });
  });
});

describe('axisSeriesValues', () => {
  const a = series(0, { 0: { x: 100, y: 100, value: 5 }, 1: { x: 300, y: 120, value: 7 } }, 'A');
  const b = series(1, { 0: { x: 100, y: 200, value: 0 } }, 'B');

  it('lists every visible series at that x', () => {
    expect(axisSeriesValues(scene({ hoverPoints: [a, b] }), 0)).toEqual([
      { seriesIndex: 0, label: 'A', value: 5 },
      { seriesIndex: 1, label: 'B', value: 0 },
    ]);
  });

  it('reports null for a series with no point there — and keeps a real zero', () => {
    expect(axisSeriesValues(scene({ hoverPoints: [a, b] }), 1)).toEqual([
      { seriesIndex: 0, label: 'A', value: 7 },
      { seriesIndex: 1, label: 'B', value: null },
    ]);
  });
});
