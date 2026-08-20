/*
 * Chart engine — geometry (curves, stacking, gaps)
 * ===========================================================
 * Pure data→shape math shared by both renderer backends. Curves
 * are TESSELLATED into flat polyline points (not left as bezier
 * segments) so the shape is decided once, in one place, and the
 * renderer just
 * lineTo's through them. No DOM here; fully unit-testable.
 * ===========================================================
 */

import type { MdChartCurve, MdChartDataPoint, MdChartStackMode, MdChartSymbol } from '../types';

export interface Pt {
  x: number;
  y: number;
}

/**
 * Vertex angles (degrees, screen space where +y is down) for each
 * polygonal marker symbol, measured from the marker centre at the
 * circumradius. `circle`/`none` have no polygon.
 */
const MARKER_ANGLES: Partial<Record<MdChartSymbol, number[]>> = {
  square: [45, 135, 225, 315], // corners on the diagonals → axis-aligned square
  diamond: [0, 90, 180, 270],
  triangle: [-90, 150, 30], // apex up
  'triangle-down': [90, -30, 210], // apex down
};

/** Convex polygon vertices for a marker symbol, or `null` for circle/none. */
export function markerPolygon(symbol: MdChartSymbol | undefined, cx: number, cy: number, r: number): Pt[] | null {
  const angles = symbol ? MARKER_ANGLES[symbol] : undefined;
  if (!angles) return null;
  return angles.map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Substeps used to sample smooth/monotone curve segments. */
const CURVE_SAMPLES = 20;

/**
 * Only decimate once a run carries this many points per horizontal pixel.
 * Below it every point still lands in the polyline, so ordinary charts are
 * untouched; above it the extra points cannot be resolved on screen anyway.
 */
const DECIMATE_PER_PX = 4;

/**
 * Collapse a dense run to its per-pixel-column min/max envelope.
 *
 * A 500k-point run over a ~900px plot is ~550 points per column: the stroke
 * spends all its time drawing sub-pixel detail nobody can see, and a noisy
 * series turns that into tens of seconds of overdraw. Emitting the first,
 * lowest, highest and last point of each column keeps the silhouette — the
 * vertical extent a dense series reads as — while bounding the polyline to
 * ~4x the plot width. Same trick as Highcharts' Boost and uPlot.
 *
 * Returns the input untouched when it isn't dense enough to matter. Only the
 * DRAWN polyline is decimated; hover lookup and markers keep the full run, so
 * tooltips still report real datapoints.
 */
export function decimateMinMax(points: Pt[], plotWidth: number): Pt[] {
  const width = Math.max(1, Math.floor(plotWidth));
  if (points.length <= width * DECIMATE_PER_PX) return points;

  const out: Pt[] = [];
  let col = Math.round(points[0].x);
  let firstI = 0;
  let lastI = 0;
  let minI = 0;
  let maxI = 0;

  // Emit one column: its first point, the two extremes in the order they
  // occurred (the polyline is stroked in sequence, so occurrence order is what
  // keeps the zig-zag faithful), then its last point. Indices that coincide are
  // emitted once.
  const flush = () => {
    const picked = [firstI, minI < maxI ? minI : maxI, minI < maxI ? maxI : minI, lastI];
    let prev = -1;
    for (const i of picked) {
      if (i !== prev) out.push(points[i]);
      prev = i;
    }
  };

  for (let i = 1; i < points.length; i++) {
    const c = Math.round(points[i].x);
    if (c !== col) {
      flush();
      col = c;
      firstI = minI = maxI = i;
    } else {
      if (points[i].y < points[minI].y) minI = i;
      if (points[i].y > points[maxI].y) maxI = i;
    }
    lastI = i;
  }
  flush();
  return out;
}

/**
 * Interpolate a run of on-screen points per the curve type,
 * returning the polyline the renderers stroke. `linear` returns
 * the input; `smooth`/`monotone` tessellate; `step*` insert the
 * corner points.
 */
/**
 * Clamp interpolated points into a rect.
 *
 * A Catmull-Rom spline (`smooth`) is an INTERPOLATING curve, not a hull-bounded
 * one: it passes through every sample but its control tangents can bulge past
 * them. Where a stacked series collapses onto the axis the bulge lands outside
 * the plot — measured at ~1.7px past 0% on a composition profile — which paints
 * a stray line over the axis. Clamping the emitted points keeps the curve inside
 * the box it belongs to; `monotone` and `linear` never overshoot and are
 * unaffected.
 */
export function clampToRect(points: Pt[], x: number, y: number, w: number, h: number): Pt[] {
  const x2 = x + w;
  const y2 = y + h;
  let dirty = false;
  for (const p of points) {
    if (p.x < x || p.x > x2 || p.y < y || p.y > y2) {
      dirty = true;
      break;
    }
  }
  if (!dirty) return points;
  return points.map((p) => ({
    x: p.x < x ? x : p.x > x2 ? x2 : p.x,
    y: p.y < y ? y : p.y > y2 ? y2 : p.y,
  }));
}

export function interpolate(points: Pt[], curve: MdChartCurve): Pt[] {
  if (points.length < 2) return points.slice();
  switch (curve) {
    case 'linear':
      return points.slice();
    case 'step':
    case 'step-before':
    case 'step-middle':
      return stepPoints(points, curve);
    case 'monotone':
      return monotone(points);
    case 'smooth':
    default:
      return catmullRom(points);
  }
}

/** Step interpolation — insert the corner vertices. */
function stepPoints(pts: Pt[], mode: MdChartCurve): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (mode === 'step' /* step-after: hold a.y then jump */) {
      out.push({ x: b.x, y: a.y }, b);
    } else if (mode === 'step-before' /* jump then hold */) {
      out.push({ x: a.x, y: b.y }, b);
    } else {
      // step-middle: jump at the horizontal midpoint.
      const mx = (a.x + b.x) / 2;
      out.push({ x: mx, y: a.y }, { x: mx, y: b.y }, b);
    }
  }
  return out;
}

/**
 * Catmull-Rom spline sampled into a polyline. A centripetal-ish
 * uniform Catmull-Rom gives the MD3 "smooth" look without the
 * overshoot of a naive cubic through sparse points.
 */
function catmullRom(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    for (let s = 1; s <= CURVE_SAMPLES; s++) {
      const t = s / CURVE_SAMPLES;
      const t2 = t * t;
      const t3 = t2 * t;
      // Uniform Catmull-Rom basis (tension 0.5).
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.push({ x, y });
    }
  }
  return out;
}

/**
 * Monotone cubic Hermite (Fritsch-Carlson tangents) sampled into
 * a polyline — never overshoots, so it won't invent peaks between
 * monotonically-increasing points (good for cumulative series).
 */
function monotone(pts: Pt[]): Pt[] {
  const n = pts.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x || 1e-6;
    dx.push(h);
    slope.push((pts[i + 1].y - pts[i].y) / h);
  }
  // Tangents m[i].
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m.push(0); // local extremum → flat tangent (no overshoot)
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
    }
  }
  m.push(slope[n - 2]);

  const out: Pt[] = [pts[0]];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const h = dx[i];
    for (let s = 1; s <= CURVE_SAMPLES; s++) {
      const t = s / CURVE_SAMPLES;
      const t2 = t * t;
      const t3 = t2 * t;
      // Hermite basis.
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      out.push({
        x: p0.x + t * h,
        y: h00 * p0.y + h10 * h * m[i] + h01 * p1.y + h11 * h * m[i + 1],
      });
    }
  }
  return out;
}

/**
 * Split a series' data into contiguous runs, breaking at `null`
 * gaps unless `connectNulls`. Each run is a list of
 * `{ index, value }` so the caller can map through scales. When
 * bridging, nulls are simply dropped (the line spans the gap).
 *
 * `undefined` is a HOLE, not a gap: the slot exists because some *other*
 * series was sampled there (see `utils/charts/xy.ts`). Holes never break a
 * run — the line runs straight through to this series' next real sample —
 * whereas an authored `null` still means "measured, no value".
 */
export function splitRuns(
  data: readonly (MdChartDataPoint | undefined)[],
  connectNulls: boolean,
): { index: number; value: number }[][] {
  const runs: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v === undefined) continue;
    // null AND non-finite (NaN/±Infinity) are gaps — otherwise a stray NaN
    // becomes a real vertex at toPxY(NaN) and corrupts the polyline.
    if (v == null || !Number.isFinite(v)) {
      if (connectNulls) continue;
      if (current.length) {
        runs.push(current);
        current = [];
      }
      continue;
    }
    current.push({ index: i, value: v });
  }
  if (current.length) runs.push(current);
  return runs;
}

/**
 * Stack series' values. Returns, per series, an array of
 * `[base, top]` bands (null / non-finite preserved as `null`,
 * holes as `undefined` — see {@link splitRuns}).
 * Non-stacked series get `[0, value]`. Percentage rescales each
 * column so each sign fills its own 0..±100 envelope; silhouette
 * and wiggle centre the column around 0 (streamgraph baselines).
 */
export function stackSeries(
  seriesData: readonly (readonly (MdChartDataPoint | undefined)[])[],
  mode: MdChartStackMode,
  stackKeys: (string | undefined)[],
): ([number, number] | null | undefined)[][] {
  const rows = Math.max(0, ...seriesData.map((s) => s.length));
  const out: ([number, number] | null | undefined)[][] = seriesData.map(() => []);
  // silhouette + wiggle both render a centred (streamgraph) baseline.
  const centred = mode === 'silhouette' || mode === 'wiggle';

  for (let r = 0; r < rows; r++) {
    // Column totals from FINITE values only: signed total centres streamgraphs;
    // per-sign totals normalise percentage so positives top out at +100% and
    // negatives bottom out at -100% (dividing by the signed total would flip
    // an all-negative column into positive bars and overshoot mixed columns).
    // Totals and cursors are kept PER STACK KEY, so several named stacks in one
    // column each start at the baseline and each normalise against their own
    // total. A chart with `stack: 'a'` and `stack: 'b'` series is two stacks
    // that happen to share a category, not one tall one.
    const signedTotal = new Map<string, number>();
    const posTotal = new Map<string, number>();
    const negTotal = new Map<string, number>();
    const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
    for (let si = 0; si < seriesData.length; si++) {
      const v = seriesData[si][r];
      const k = stackKeys[si] ?? 'stacked';
      // An unstacked series sits on the baseline on its own; letting it into the
      // totals would renormalise everyone else's percentage against a bar that
      // is not part of the stack.
      if (k === '__unstacked__' || v == null || !Number.isFinite(v)) continue;
      add(signedTotal, k, v);
      if (v >= 0) add(posTotal, k, v);
      else add(negTotal, k, -v);
    }

    const posCursor = new Map<string, number>();
    const negCursor = new Map<string, number>();

    for (let si = 0; si < seriesData.length; si++) {
      const raw = seriesData[si][r];
      // A hole contributes nothing to the column and stays a hole downstream.
      if (raw === undefined) {
        out[si][r] = undefined;
        continue;
      }
      if (raw == null || !Number.isFinite(raw)) {
        out[si][r] = null;
        continue;
      }
      const key = stackKeys[si] ?? 'stacked';
      const stacked = mode !== 'none' && key !== '__unstacked__';
      if (!stacked) {
        out[si][r] = [0, raw];
        continue;
      }
      const base = centred ? -(signedTotal.get(key) ?? 0) / 2 : 0;
      if (!posCursor.has(key)) posCursor.set(key, base);
      if (!negCursor.has(key)) negCursor.set(key, base);
      const pos = posTotal.get(key) ?? 0;
      const neg = negTotal.get(key) ?? 0;
      let v = raw;
      if (mode === 'percentage') {
        v = raw >= 0 ? (pos > 0 ? (raw / pos) * 100 : 0) : neg > 0 ? (raw / neg) * 100 : 0;
      }
      if (v >= 0) {
        const c = posCursor.get(key)!;
        out[si][r] = [c, c + v];
        posCursor.set(key, c + v);
      } else {
        const c = negCursor.get(key)!;
        out[si][r] = [c + v, c];
        negCursor.set(key, c + v);
      }
    }
  }
  return out;
}
