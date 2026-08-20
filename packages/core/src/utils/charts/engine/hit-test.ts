/*
 * Chart engine — click hit-testing
 * ===========================================================
 * Turns a pointer position over a rendered scene into the most
 * specific thing under it: a data mark, a series line, a filled
 * area, or the plot background (an "axis" click). Pure functions
 * over the RenderScene, so the precedence rule is unit-testable
 * without a canvas — the engine only maps the result onto its
 * callbacks.
 * ===========================================================
 */

import { distanceToLine } from './emphasis';
import type { Pt } from './geometry';
import { ascending } from './rtl';
import type { RenderScene, Rect, SceneArea } from './scene';

/**
 * Max cursor→point distance (px) for a click to count as a mark click.
 * Deliberately generous: a mark is the thing consumers most want to catch, and
 * at this radius a click anywhere in a fingertip-sized region around the point
 * still lands on it.
 */
export const MARK_HIT_RADIUS = 26;

/**
 * Max cursor→line distance (px) for a click to count as a line click.
 *
 * The stroke is 2.5px wide (±1.25px from the centreline), so this leaves ~6.75px
 * of pointer slop on either side — comfortable for an imprecise mouse without
 * reaching so far into the fill below that "clicked the area just under the
 * line" gets stolen by the line. It also absorbs the small error in
 * {@link distanceToLine}, which measures against the straight segment between
 * two samples while a `smooth` curve bows a little away from it.
 */
export const LINE_HIT_TOLERANCE = 8;

/** What sits under the pointer, most specific first. */
export type SceneHit =
  | { kind: 'mark'; seriesIndex: number; dataIndex: number }
  | { kind: 'line'; seriesIndex: number; dataIndex: number }
  | { kind: 'area'; seriesIndex: number; dataIndex: number }
  | { kind: 'axis'; dataIndex: number }
  | null;

/** One visible series' value at an x index — the rows the tooltip lists. */
export interface AxisSeriesValue {
  seriesIndex: number;
  label: string;
  /** Raw value there, or `null` when this series has no point at that x. */
  value: number | null;
}

/** Index of the xPosition nearest to `px` (or -1 if none). */
export function nearestIndex(positions: number[], px: number): number {
  if (!positions.length) return -1;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < positions.length; i++) {
    const d = Math.abs(positions[i] - px);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Each visible series' samples as `[main, value]` pixel pairs ordered along the
 * main axis (x for a normal chart, y for an inverted one) — the input
 * {@link distanceToLine} expects. (Integer-keyed records enumerate in ascending
 * numeric order, so `byIndex` is already in main-axis order.)
 */
export function seriesSampleLines(scene: RenderScene): [number, number][][] {
  const inverted = !!scene.inverted;
  return scene.hoverPoints.map((hp) =>
    // `ascending`: an RTL scene is mirrored, so its samples descend in x — the
    // distance search bisects on that axis and needs them the other way round.
    ascending(
      Object.keys(hp.byIndex).map((k): [number, number] => {
        const p = hp.byIndex[Number(k)];
        return inverted ? [p.y, p.x] : [p.x, p.y];
      }),
    ),
  );
}

/** Every visible series' value at `index` — what an axis click reports. */
export function axisSeriesValues(scene: RenderScene, index: number): AxisSeriesValue[] {
  return scene.hoverPoints.map((hp) => ({
    seriesIndex: hp.seriesIndex,
    label: hp.label,
    value: hp.byIndex[index]?.value ?? null,
  }));
}

/** Is (px, py) inside the plot rect (i.e. not in the title / legend / gutters)? */
export function insidePlot(plot: Rect, px: number, py: number): boolean {
  return px >= plot.x && px <= plot.x + plot.width && py >= plot.y && py <= plot.y + plot.height;
}

/**
 * The polyline's y at `x`, linearly interpolated between the samples bracketing
 * it, or `null` when `x` is outside its span. Assumes points ascend in x, which
 * every drawn series polyline does.
 */
function polylineY(input: readonly Pt[], x: number): number | null {
  const n = input.length;
  if (!n) return null;
  // A mirrored (RTL) area runs right-to-left; bisecting needs ascending x.
  const points = n > 1 && input[0].x > input[n - 1].x ? [...input].reverse() : input;
  if (x < points[0].x || x > points[n - 1].x) return null;
  if (n === 1) return points[0].y;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x <= x) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/**
 * Is (px, py) inside this filled area — between its top edge and its base?
 *
 * A stacked layer fills only its own band, so its `basePoints` (not the global
 * baseline) are the bottom edge; an unstacked area fills down to `baselineY`.
 * `min`/`max` rather than `<`/`>` because a negative series fills *upward* to
 * the zero line.
 */
function areaContains(area: SceneArea, px: number, py: number): boolean {
  const top = polylineY(area.points, px);
  if (top == null) return false;
  const base = (area.basePoints ? polylineY(area.basePoints, px) : null) ?? area.baselineY;
  return py >= Math.min(top, base) && py <= Math.max(top, base);
}

/**
 * Which series' filled band contains (px, py), or -1.
 *
 * This is what the eye reads on an area chart: the cursor sits INSIDE a band,
 * so the band it is in owns it — not whichever series' drawn line happens to
 * pass nearest, which on a thick stacked band is usually a different series
 * altogether. Where unstacked areas overlap and several contain the cursor,
 * the one whose own top edge is nearest wins.
 */
export function areaSeriesAt(scene: RenderScene, px: number, py: number): number {
  if (!insidePlot(scene.plot, px, py)) return -1;
  let best = -1;
  let bestD = Infinity;
  for (const a of scene.areas) {
    if (a.seriesIndex == null || !areaContains(a, px, py)) continue;
    const top = polylineY(a.points, px);
    const d = top == null ? Infinity : Math.abs(py - top);
    if (d < bestD) {
      bestD = d;
      best = a.seriesIndex;
    }
  }
  return best;
}

/**
 * What a click at (px, py) — canvas-relative pixels — landed on.
 *
 * Most specific first: a data **mark**, else a series **line**, else a filled
 * **area**, else the plot background (**axis**). So a click on a mark never
 * also reads as a click on that series' line, and one on the line never reads
 * as its area.
 *
 * Only the mark test reaches outside the plot rect (it always has: a click just
 * past the axis still counts as the point it is nearest). Line / area / axis
 * are plot-only, since the geometry is clipped to the plot and a click in the
 * title, legend or an axis gutter is not a click on the chart background.
 *
 * `lines` is {@link seriesSampleLines}, passed in so the engine can reuse its
 * per-scene cache.
 */
export function hitTestScene(
  scene: RenderScene,
  px: number,
  py: number,
  lines: [number, number][][] = seriesSampleLines(scene),
): SceneHit {
  const inverted = !!scene.inverted;
  const cursorMain = inverted ? py : px;
  const cursorValue = inverted ? px : py;
  const dataIndex = nearestIndex(scene.xPositions, cursorMain);
  if (dataIndex < 0) return null;

  // ── 1. a data mark: the series whose point at this x is nearest (2D) ──
  let markSeries = -1;
  let markD = Infinity;
  for (const hp of scene.hoverPoints) {
    const p = hp.byIndex[dataIndex];
    if (!p) continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < markD) {
      markD = d;
      markSeries = hp.seriesIndex;
    }
  }
  if (markSeries >= 0 && markD <= MARK_HIT_RADIUS) return { kind: 'mark', seriesIndex: markSeries, dataIndex };

  if (!insidePlot(scene.plot, px, py)) return null;

  // ── 2. a series line: distance to the DRAWN line, not to the sample at this
  //      x (series can be measured at different x and have no sample here) ──
  let lineSeries = -1;
  let lineD = Infinity;
  scene.hoverPoints.forEach((hp, i) => {
    const d = distanceToLine(lines[i] ?? [], cursorMain, cursorValue);
    if (d < lineD) {
      lineD = d;
      lineSeries = hp.seriesIndex;
    }
  });
  if (lineSeries >= 0 && lineD <= LINE_HIT_TOLERANCE) return { kind: 'line', seriesIndex: lineSeries, dataIndex };

  // ── 3. a filled area (only when the chart draws them). Where unstacked areas
  //      overlap, the one whose own line is nearest above/below wins — that is
  //      the band the click reads as being "under". ──
  let areaSeries = -1;
  let areaD = Infinity;
  for (const a of scene.areas) {
    if (a.seriesIndex == null || !areaContains(a, px, py)) continue;
    const d = Math.abs(py - (polylineY(a.points, px) as number));
    if (d < areaD) {
      areaD = d;
      areaSeries = a.seriesIndex;
    }
  }
  if (areaSeries >= 0) return { kind: 'area', seriesIndex: areaSeries, dataIndex };

  // ── 4. plot background ──
  return { kind: 'axis', dataIndex };
}
