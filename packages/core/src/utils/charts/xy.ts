/*
 * Per-point x values — irregular / independent series data
 * ===========================================================
 * A series is normally a bare list of y values positioned by INDEX against
 * `xAxis.data`. Real time series rarely line up like that: two sensors sample
 * at different moments, three winters are measured on entirely different dates.
 * Those series carry their own x per point (`{ x, y }` or `[x, y]`).
 *
 * The engine draws every series against ONE shared x array, so this module
 * merges all the x values into a single sorted axis and re-aligns each series
 * onto it. A slot a series has no sample for becomes a HOLE (`undefined`),
 * which is deliberately distinct from an authored `null`:
 *
 *   • hole (`undefined`) — "this series wasn't measured here". The line is
 *     drawn straight through it to the series' next real sample.
 *   • gap (`null`)       — "measured, no value". Breaks the line (unless
 *     `connectNulls`), exactly as it always has.
 *
 * Everything downstream stays index-aligned to the merged axis, so tooltips,
 * the zoom window, markers and the screen-reader table keep working unchanged.
 * ===========================================================
 */

import { toNumeric } from './engine/scale';
import type {
  MdChartAxisValue,
  MdChartDataPoint,
  MdChartDatum,
  MdChartRangeDatum,
  MdChartScaleType,
  MdChartXYPoint,
  MdChartXYTuple,
} from './types';

/** A value aligned to the merged axis: a number, a `null` gap, or a hole. */
export type MdChartAlignedValue = MdChartDataPoint | undefined;

export interface NormalizedSeriesX {
  /** The merged x axis every series' data is aligned to. */
  xValues: MdChartAxisValue[];
  /** Per series, values aligned to `xValues` (`undefined` = no sample here). */
  data: MdChartAlignedValue[][];
  /**
   * Per series, that series' own datum index → merged index. `null` when the
   * series was already index-aligned (own index *is* the merged index).
   */
  toMerged: (number[] | null)[];
  /** Per series, merged index → own datum index (`-1` where it has no sample). */
  toOwn: (number[] | null)[];
  /** True when at least one series carried its own x values. */
  hasPointX: boolean;
}

/** Does this datum carry its own x? */
export function isPointDatum(d: MdChartDatum | undefined): d is MdChartXYPoint | MdChartXYTuple {
  return d != null && typeof d === 'object' && !(d instanceof Date);
}

/** The y value of any datum shape. */
export function datumY(d: MdChartDatum | undefined): MdChartDataPoint {
  if (d == null) return null;
  if (typeof d === 'number') return d;
  if (!isPointDatum(d)) return null;
  // `in` rather than Array.isArray: the tuple form is readonly, which
  // Array.isArray does not narrow.
  return ('y' in d ? d.y : d[1]) ?? null;
}

/** The x value of a point datum, or `undefined` for a bare value. */
export function datumX(d: MdChartDatum | undefined): MdChartAxisValue | undefined {
  if (!isPointDatum(d)) return undefined;
  return 'x' in d ? d.x : d[0];
}

/** Does this series carry its own x values? Reads the first non-empty datum —
 *  a series is all points or all bare values, never a mix. */
function seriesHasPointX(data: readonly MdChartDatum[] | undefined): boolean {
  return isPointDatum(data?.find((d) => d != null));
}

/**
 * Merge every series onto one x axis.
 *
 * With no point-carrying series this is a pass-through: the original arrays are
 * handed straight back, so the common (and possibly very large) index-aligned
 * case allocates nothing.
 *
 * @param series   the series to align (only `data` is read)
 * @param axisData the consumer's `xAxis.data`, if any
 * @param scale    the x scale — decides the merge order (numeric/chronological
 *                 for value/time/log, first-seen for category)
 */
export function normalizeSeriesX(
  series: readonly { data?: readonly MdChartDatum[] }[],
  axisData: readonly MdChartAxisValue[] | undefined,
  scale: MdChartScaleType,
): NormalizedSeriesX {
  const hasPointX = series.some((s) => seriesHasPointX(s.data));
  if (!hasPointX) {
    return {
      xValues: (axisData as MdChartAxisValue[] | undefined) ?? [],
      // Safe: no datum in any series is a point, so the array already IS
      // (number | null)[] — no copy, which keeps 100k-point feeds cheap.
      data: series.map((s) => (s.data ?? []) as MdChartAlignedValue[]),
      toMerged: series.map(() => null),
      toOwn: series.map(() => null),
      hasPointX: false,
    };
  }

  // ── build the merged axis ──
  // Category x values have no numeric order, so they merge in first-seen order
  // (axis data first, then whatever the series introduce). Everything else
  // sorts by its numeric / epoch value, which is what makes uneven gaps render
  // proportionally rather than evenly.
  const category = scale === 'category';
  const keyOf = (v: MdChartAxisValue) => (category ? `c${String(v)}` : `n${toNumeric(v, scale)}`);
  const slots = new Map<string, { sort: number; value: MdChartAxisValue }>();
  const add = (v: MdChartAxisValue) => {
    const k = keyOf(v);
    if (!slots.has(k)) slots.set(k, { sort: category ? slots.size : toNumeric(v, scale), value: v });
  };
  axisData?.forEach(add);
  for (const s of series) {
    if (!seriesHasPointX(s.data)) continue;
    for (const d of s.data ?? []) {
      const x = datumX(d);
      if (x !== undefined) add(x);
    }
  }
  const xValues = [...slots.values()].sort((a, b) => a.sort - b.sort).map((s) => s.value);
  const indexOf = new Map<string, number>(xValues.map((v, i) => [keyOf(v), i]));
  const n = xValues.length;

  // ── align each series onto it ──
  const data: MdChartAlignedValue[][] = [];
  const toMerged: (number[] | null)[] = [];
  const toOwn: (number[] | null)[] = [];

  series.forEach((s) => {
    const own = s.data ?? [];
    if (!seriesHasPointX(own)) {
      // Index-aligned series: it borrows x from `xAxis.data`, so it lands on
      // whatever merged slots those values took. Without an axis to borrow
      // from, its index is its position.
      if (!axisData?.length) {
        const row: MdChartAlignedValue[] = new Array(n).fill(undefined);
        for (let j = 0; j < own.length && j < n; j++) row[j] = datumY(own[j]);
        data.push(row);
        toMerged.push(null);
        toOwn.push(null);
        return;
      }
      const row: MdChartAlignedValue[] = new Array(n).fill(undefined);
      const fwd: number[] = new Array(own.length).fill(-1);
      const back: number[] = new Array(n).fill(-1);
      for (let j = 0; j < own.length; j++) {
        const at = j < axisData.length ? indexOf.get(keyOf(axisData[j])) : undefined;
        if (at === undefined) continue;
        row[at] = datumY(own[j]);
        fwd[j] = at;
        back[at] = j;
      }
      data.push(row);
      toMerged.push(fwd);
      toOwn.push(back);
      return;
    }

    const row: MdChartAlignedValue[] = new Array(n).fill(undefined);
    const fwd: number[] = new Array(own.length).fill(-1);
    const back: number[] = new Array(n).fill(-1);
    for (let j = 0; j < own.length; j++) {
      const x = datumX(own[j]);
      // A bare value inside a point series has no x to sit at — drop it rather
      // than inventing a position for it.
      if (x === undefined) continue;
      const at = indexOf.get(keyOf(x));
      if (at === undefined) continue;
      // Duplicate x within one series: the last one wins.
      row[at] = datumY(own[j]);
      fwd[j] = at;
      back[at] = j;
    }
    data.push(row);
    toMerged.push(fwd);
    toOwn.push(back);
  });

  return { xValues, data, toMerged, toOwn, hasPointX: true };
}

/** Remap an index-keyed record (e.g. `pointSymbols`) from a series' own indices
 *  onto the merged axis. Entries with no merged slot are dropped. */
export function remapIndexRecord<T>(
  rec: Record<number, T> | undefined,
  toMerged: number[] | null,
): Record<number, T> | undefined {
  if (!rec || !toMerged) return rec;
  const out: Record<number, T> = {};
  for (const [k, v] of Object.entries(rec)) {
    const at = toMerged[Number(k)];
    if (at != null && at >= 0) out[at] = v;
  }
  return out;
}

/**
 * Flatten a {@link MdChartRangeDatum} to a `[low, high]` pair, or `null` for a
 * gap. Both the tuple and the `{ low, high }` object forms are accepted, and
 * the edges are ordered — a caller who writes `[max, min]` still gets a band
 * rather than an inverted one that draws backwards.
 */
export function normalizeRange(d: MdChartRangeDatum | undefined): [number, number] | null {
  if (d == null) return null;
  const lo = Array.isArray(d) ? d[0] : (d as { low: number | null }).low;
  const hi = Array.isArray(d) ? d[1] : (d as { high: number | null }).high;
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return [Math.min(lo, hi), Math.max(lo, hi)];
}
