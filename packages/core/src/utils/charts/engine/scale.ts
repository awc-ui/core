/*
 * Chart engine — scales & tick generation
 * ===========================================================
 * The pure-math foundation of the from-scratch chart engine
 * (replacing ECharts). The renderer and the DOM text
 * overlay consume these — nothing
 * here touches the DOM, so it's fully unit-testable and shared.
 *
 * A "scale" maps a DATA value (a number, a Date's epoch ms, or a
 * category index) to a PIXEL coordinate within a [0, size] plot
 * range, and back. Tick generators pick human-friendly gridline
 * positions ("nice" round numbers, sensible time steps).
 * ===========================================================
 */

import type { MdChartAxisBreakOptions, MdChartAxisBreaks, MdChartAxisValue, MdChartScaleType } from '../types';

/** A resolved numeric domain `[min, max]` in data space. */
export type Domain = readonly [number, number];

/**
 * Maps data ↔ pixels for a continuous or banded axis. `range` is
 * always in ascending pixel order `[0, size]`; `reverse` and the
 * plot's own origin flip are applied by the caller when drawing.
 */
export interface Scale {
  readonly type: MdChartScaleType;
  /** Data value → pixel offset within `[0, size]`. */
  scale(value: number): number;
  /** Pixel offset → data value (inverse; for hit-testing/zoom). */
  invert(pixel: number): number;
  /** The pixel a category index / value sits at, for markers. */
  readonly size: number;
  /** Resolved numeric domain the scale spans. */
  readonly domain: Domain;
  /** For category scales: the pixel band width per category. */
  readonly bandwidth: number;
}

/** Coerce any axis value to the number the scales operate on. */
export function toNumeric(value: MdChartAxisValue, scale: MdChartScaleType): number {
  if (scale === 'category') return typeof value === 'number' ? value : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  // ISO-8601 / date-like string for time; numeric string for value/log.
  const asNum = Number(value);
  if (!Number.isNaN(asNum) && scale !== 'time') return asNum;
  const asDate = Date.parse(value);
  return Number.isNaN(asDate) ? 0 : asDate;
}

/**
 * Continuous linear scale. `time` reuses this (epoch ms are
 * linear); `log` is handled by {@link makeLogScale}.
 */
export function makeLinearScale(
  domain: Domain,
  size: number,
  type: MdChartScaleType = 'value',
): Scale {
  let [min, max] = domain;
  if (min === max) {
    // Degenerate domain (single value / all-equal series): pad so
    // the point lands mid-plot instead of dividing by zero.
    min -= 1;
    max += 1;
  }
  const span = max - min;
  return {
    type,
    size,
    domain: [min, max],
    bandwidth: 0,
    scale: (v) => ((v - min) / span) * size,
    invert: (px) => min + (px / size) * span,
  };
}

/** Continuous base-10 log scale (positive domain only). */
export function makeLogScale(domain: Domain, size: number): Scale {
  // Guard non-positive mins — log10 is undefined at/below 0. Clamp to a small
  // positive floor derived from the max so the axis is still meaningful for
  // datasets that dip to 0. If the WHOLE domain is <= 0 (unsupported garbage-in),
  // fall back to a benign [1e-6, 1] range instead of a denormal ~1e-323 axis.
  const positiveMax = domain[1] > 0 ? domain[1] : 1;
  const safeMin = domain[0] > 0 ? domain[0] : Math.max(positiveMax / 1e6, Number.MIN_VALUE);
  const lo = Math.log10(safeMin);
  const hi = Math.log10(Math.max(positiveMax, safeMin * 10));
  const span = hi - lo || 1;
  return {
    type: 'log',
    size,
    domain: [safeMin, Math.pow(10, hi)],
    bandwidth: 0,
    scale: (v) => ((Math.log10(v <= 0 ? safeMin : v) - lo) / span) * size,
    invert: (px) => Math.pow(10, lo + (px / size) * span),
  };
}

/**
 * Category (band) scale. `count` evenly-spaced categories over
 * `size`. `alignWithLabel` centers a category's point in its band
 * (line/area: point sits AT the category) vs the band's leading
 * edge (bars: sit BETWEEN ticks).
 */
export function makeCategoryScale(count: number, size: number, alignWithLabel = true): Scale {
  const n = Math.max(count, 1);
  // Line/area put points at category centers with a half-band inset
  // at each end; ECharts' `boundaryGap:false` equivalent centers the
  // first/last points on the axis ends. We use the centered model.
  const bandwidth = size / n;
  const offset = alignWithLabel ? bandwidth / 2 : 0;
  return {
    type: 'category',
    size,
    domain: [0, n - 1],
    bandwidth,
    scale: (i) => offset + i * bandwidth,
    invert: (px) => Math.round((px - offset) / bandwidth),
  };
}

// ─────────────────── axis breaks ───────────────────

/** Default pixels an axis break occupies — enough to read as a cut. */
export const DEFAULT_BREAK_GAP = 14;

/** A break resolved into numbers on the axis' own scale. */
export interface BreakRange {
  from: number;
  to: number;
  /** Pixels the cut occupies on the axis. */
  gap: number;
}

/** A break as positioned on the axis, for drawing the cut. */
export interface ScaleBreak extends BreakRange {
  /** Pixel offset (within `[0, size]`) where the cut starts. */
  px: number;
}

/** A scale that has had one or more ranges cut out of it. */
export interface BrokenScale extends Scale {
  /** The cuts, in ascending order, with their pixel positions. */
  readonly breaks: readonly ScaleBreak[];
}

/**
 * Clip breaks to the domain, drop degenerate ones, sort, and merge any that
 * overlap or touch — so the scale can walk them in one pass and two authored
 * ranges that happen to abut don't double-count their gaps.
 */
export function normalizeBreaks(breaks: readonly BreakRange[], domain: Domain): BreakRange[] {
  const [lo, hi] = domain[0] <= domain[1] ? domain : [domain[1], domain[0]];
  const clipped = breaks
    .map((b) => ({
      from: Math.max(lo, Math.min(b.from, b.to)),
      to: Math.min(hi, Math.max(b.from, b.to)),
      gap: b.gap ?? DEFAULT_BREAK_GAP,
    }))
    // A cut that starts at the very bottom would just shift the axis up, and a
    // zero-width one has nothing to remove. A cut reaching the TOP is kept: the
    // literal "one point at 1, one at 1e12" case ends exactly at the domain
    // max, and dropping it would leave the small point pinned to the axis.
    .filter((b) => b.to > b.from && b.from > lo && b.to <= hi)
    .sort((a, b) => a.from - b.from);

  const merged: BreakRange[] = [];
  for (const b of clipped) {
    const last = merged[merged.length - 1];
    if (last && b.from <= last.to) {
      last.to = Math.max(last.to, b.to);
      last.gap = Math.max(last.gap, b.gap);
    } else {
      merged.push({ ...b });
    }
  }
  return merged;
}

/**
 * A cut that runs to the very top of the domain leaves the section ABOVE it a
 * single point — the outlier pinned to the axis top, with no ticks or gridlines
 * to read it against. Pull that cut's top edge DOWN so the outlier sits in a real
 * top section, of the same value-range as the plain section just below the cut,
 * so both sections tick at the same density.
 *
 * Only touches a top-edge cut on a linear axis; a normal in-range cut, a log
 * axis, or a section that already has range is left exactly as it was.
 */
export function openTopSection(ranges: readonly BreakRange[], domain: Domain, scale: MdChartScaleType): BreakRange[] {
  const out = ranges.map((r) => ({ ...r }));
  if (!out.length || scale === 'log') return out;
  const last = out[out.length - 1];
  if (domain[1] - last.to > 1e-9) return out; // the top section already has a range
  const belowFrom = out.length > 1 ? out[out.length - 2].to : domain[0];
  const belowRange = last.from - belowFrom; // the plain section just under this cut
  if (!(belowRange > 0)) return out;
  // Range for the opened section: at least the section below it (so the two tick
  // at the same density), but no finer than a nice step of the OUTLIER's own
  // magnitude — otherwise, at a huge outlier, ticks a few units apart round to
  // identical labels (…000, …000, …000).
  const t = niceLinearTicks(0, domain[1], 6);
  const outlierStep = t.length > 1 ? t[1] - t[0] : 0;
  const range = Math.max(belowRange, outlierStep);
  const newTo = domain[1] - range;
  if (newTo > last.from + 1e-9) last.to = newTo;
  return out;
}

/**
 * Find the empty stretches worth cutting out of `values`.
 *
 * A gap qualifies when it is at least `minGap`× the median gap between
 * neighbouring values — the "one cluster at 1, another at a trillion" shape.
 * The widest qualifying gaps win, capped at `maxBreaks`, and each cut stops
 * short of the data on either side so the outermost points aren't sitting on
 * the cut itself.
 */
export function autoBreaks(
  values: readonly number[],
  opts: { minGap?: number; maxBreaks?: number; gap?: number } = {},
): BreakRange[] {
  const minGap = opts.minGap ?? 8;
  const maxBreaks = opts.maxBreaks ?? 2;
  const sorted = [...new Set(values.filter((v) => Number.isFinite(v)))].sort((a, b) => a - b);
  if (sorted.length < 4) return [];
  const gaps: { from: number; to: number; size: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push({ from: sorted[i - 1], to: sorted[i], size: sorted[i] - sorted[i - 1] });
  }
  const sizes = gaps.map((g) => g.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] || 0;
  if (median <= 0) return [];
  const chosen = gaps
    .filter((g) => g.size >= median * minGap)
    .sort((a, b) => b.size - a.size)
    .slice(0, maxBreaks);
  // Cut exactly from the last value below to the first value above — the cut's
  // own pixel gap is the visual separation. Padding the cut by a fraction OF
  // THE GAP would be self-defeating here: 10% of the emptiness between 18 and
  // 8e11 is 8e10, which swallows the very cluster the break exists to rescue.
  // Detection only — clipping and merging happen in makeBrokenScale, against
  // the real AXIS domain. Normalising here against the data extent would drop
  // a gap that ends on the last data value, even though the axis runs past it.
  return chosen
    .map((g) => ({ from: g.from, to: g.to, gap: opts.gap ?? DEFAULT_BREAK_GAP }))
    .sort((a, b) => a.from - b.from);
}

/**
 * How the axis divides the pixels between the sections a break leaves behind.
 *
 *   • `equal` (default) — every section gets the same share. This is what makes
 *     a break worth having when the clusters are orders of magnitude apart: a
 *     point at 1 and a point at 1e12 each land in a readable half, instead of
 *     the small one collapsing onto the axis. Sections of similar width look
 *     the same as `proportional`, so it only differs where it matters.
 *   • `proportional` — one unit-per-pixel across the whole axis, so widths stay
 *     comparable between sections; only the cut ranges are removed. Classic
 *     break behaviour. Note this leaves a tiny section tiny: breaking the empty
 *     middle out of 1 … 1e12 does NOT rescue the low end.
 */
export type BreakSizing = 'equal' | 'proportional';

/**
 * Wrap a scale so the given ranges are cut out of it. Each cut costs its `gap`
 * in pixels instead of its true width, and what is left is divided between the
 * surviving sections per {@link BreakSizing}.
 *
 * A value *inside* a cut has no honest position — it maps to the near edge, and
 * callers are expected to drop such data rather than draw it (the line layout
 * splits its polylines at the cut).
 */
export function makeBrokenScale(
  domain: Domain,
  size: number,
  type: MdChartScaleType,
  breaks: readonly BreakRange[],
  sizing: BreakSizing = 'equal',
): BrokenScale {
  const base = type === 'log' ? makeLogScale(domain, size) : makeLinearScale(domain, size, type);
  const ranges = normalizeBreaks(breaks, base.domain);
  if (!ranges.length) return { ...base, breaks: [] };

  // Work in the base scale's pixel space, so a log axis breaks in log space.
  const cuts = ranges.map((b) => ({ ...b, fromPx: base.scale(b.from), toPx: base.scale(b.to) }));
  const gaps = cuts.reduce((sum, c) => sum + c.gap, 0);

  // The surviving stretches of the axis, in base pixels.
  const spans: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const c of cuts) {
    spans.push({ from: cursor, to: c.fromPx });
    cursor = c.toPx;
  }
  spans.push({ from: cursor, to: size });

  const usable = Math.max(0, size - gaps);
  const totalSpan = spans.reduce((sum, s) => sum + Math.max(0, s.to - s.from), 0);
  // Each section's output width, and where it starts.
  const sections = spans.map((s) => {
    const width = Math.max(0, s.to - s.from);
    const out =
      sizing === 'equal'
        ? usable / spans.length
        : totalSpan > 0
          ? (width / totalSpan) * usable
          : usable / spans.length;
    return { ...s, width, out };
  });
  let outCursor = 0;
  const placed = sections.map((sec, i) => {
    const start = outCursor;
    outCursor += sec.out + (cuts[i]?.gap ?? 0);
    return { ...sec, outStart: start };
  });

  const scaleBreaks: ScaleBreak[] = cuts.map((c, i) => ({
    from: c.from,
    to: c.to,
    gap: c.gap,
    px: placed[i].outStart + placed[i].out,
  }));

  return {
    type,
    size,
    domain: base.domain,
    bandwidth: 0,
    breaks: scaleBreaks,
    scale: (v) => {
      const px = base.scale(v);
      for (let i = 0; i < placed.length; i++) {
        const sec = placed[i];
        if (px <= sec.to || i === placed.length - 1) {
          // Inside the preceding cut: pin to its near edge (the end of the
          // section before it), per this function's contract.
          if (px < sec.from) return i > 0 ? placed[i - 1].outStart + placed[i - 1].out : sec.outStart;
          // A section with no width holds a single value (a lone high point at
          // the domain max): put it at the section's far end, not its start.
          const t = sec.width > 0 ? (px - sec.from) / sec.width : 1;
          return sec.outStart + t * sec.out;
        }
      }
      return size;
    },
    invert: (px) => {
      for (let i = 0; i < placed.length; i++) {
        const sec = placed[i];
        const end = sec.outStart + sec.out;
        if (px <= end || i === placed.length - 1) {
          const t = sec.out > 0 ? (Math.max(px, sec.outStart) - sec.outStart) / sec.out : 0;
          return base.invert(sec.from + t * sec.width);
        }
      }
      return base.domain[1];
    },
  };
}

/**
 * Turn an axis' public `breaks` config into concrete ranges on this axis'
 * numbers, combining any explicit cuts with automatically-found ones.
 *
 * `values` are the data values on this axis, needed for the automatic pass.
 */
export function resolveAxisBreaks(
  breaks: MdChartAxisBreaks | undefined,
  values: readonly number[],
  scale: MdChartScaleType,
): { ranges: BreakRange[]; sizing: BreakSizing } {
  if (!breaks) return { ranges: [], sizing: 'equal' };
  const opts: MdChartAxisBreakOptions =
    breaks === 'auto' ? { auto: true } : Array.isArray(breaks) ? { ranges: breaks } : breaks;
  const gap = opts.gap ?? DEFAULT_BREAK_GAP;
  const explicit: BreakRange[] = (opts.ranges ?? []).map((b) => ({
    from: toNumeric(b.from, scale),
    to: toNumeric(b.to, scale),
    gap: b.gap ?? gap,
  }));
  const found = opts.auto
    ? autoBreaks(values, { minGap: opts.minGap, maxBreaks: opts.maxBreaks, gap })
    : [];
  return { ranges: [...explicit, ...found], sizing: opts.sizing ?? 'equal' };
}

/**
 * How many ticks a section should end up with before we stop asking for more.
 * Three is what makes a section read as ruled rather than as a bare pair of
 * edges — roughly the density an unbroken axis of that pixel height would have,
 * since each section holds `target / sections` of the axis.
 */
const SECTION_MIN_TICKS = 3;

/**
 * Ticks for an axis that has been cut, generated PER SECTION.
 *
 * A broken axis needs this: run the usual tick algorithm over the whole domain
 * and every tick can land in the big section, leaving the rescued cluster with
 * nothing to read against — which defeats the break. Each surviving section
 * gets its own share of the tick budget instead.
 */
export function sectionedTicks(
  domain: Domain,
  breaks: readonly BreakRange[],
  scale: MdChartScaleType,
  target = 6,
): number[] {
  const ticksFor = (lo: number, hi: number, n: number) =>
    scale === 'log' ? logTicks(lo, hi) : scale === 'time' ? timeTicks(lo, hi, n) : niceLinearTicks(lo, hi, n);
  // Against the AXIS domain, exactly as makeBrokenScale does: a cut the domain
  // rejects (one starting at the very bottom, say) is not drawn, so it must not
  // section the ticks either — that ruled only the ghost section and left the
  // rest of the axis bare.
  const ranges = normalizeBreaks(breaks, domain);
  if (!ranges.length) return ticksFor(domain[0], domain[1], target);

  const sections: [number, number][] = [];
  let cursor = domain[0];
  for (const b of ranges) {
    sections.push([cursor, b.from]);
    cursor = b.to;
  }
  sections.push([cursor, domain[1]]);

  // Floor of 3: the nice-tick algorithm asked for 2 returns a single usable
  // tick (it rounds the step up past the section), which would leave a rescued
  // cluster unlabelled — the very thing per-section ticks exist to prevent.
  const per = Math.max(3, Math.round(target / sections.length));

  /**
   * One section's ticks, asking for more until the section is actually ruled.
   *
   * Nice-step rounding overshoots badly on a section that is narrow relative to
   * where it sits, and the ticks that fall outside the section are then dropped:
   * 810B…1.1T asked for 3 rounds the step to 200B, whose grid (800B, 1T, 1.2T)
   * leaves ONE value inside — a band with a single gridline and nothing to read
   * the rescued cluster against. 0…18 asked for 3 lands only 0 and 10, so the
   * top third of that band is blank too.
   *
   * Asking again with a bigger count halves the step (100B → 900B/1T/1.1T;
   * 5 → 0/5/10/15) without giving up round numbers, which is what makes each
   * section read like a normal axis of its own size. Log ticks ignore the
   * count, so they are taken as they come.
   */
  const sectionTicks = (lo: number, hi: number): number[] => {
    let ticks: number[] = [];
    for (const n of [per, per * 2, per * 4]) {
      // Keep ticks to their own section; the cut edges themselves are useful
      // labels, so they are allowed through.
      ticks = ticksFor(lo, hi, n).filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9);
      if (ticks.length >= SECTION_MIN_TICKS || scale === 'log') break;
    }
    return ticks;
  };

  const out: number[] = [];
  for (const [lo, hi] of sections) {
    if (hi <= lo) continue;
    out.push(...sectionTicks(lo, hi));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Is this value inside one of the cuts (and so unplottable)? */
export function inBreak(breaks: readonly BreakRange[], v: number): boolean {
  return breaks.some((b) => v > b.from && v < b.to);
}

// ─────────────────── tick generation ───────────────────

/** A resolved tick: its numeric position + preformatted label. */
export interface Tick {
  value: number;
  /** Original axis value (for the user's valueFormatter). */
  raw: MdChartAxisValue;
}

/**
 * "Nice" linear ticks — round step sizes (1/2/5 × 10ⁿ) covering
 * `[min, max]` with ~`target` ticks. The staple axis algorithm
 * (Heckbert). Returns tick values within the domain.
 */
export function niceLinearTicks(min: number, max: number, target = 6): number[] {
  // Order-independent: ticks span the same nice values whichever way the domain
  // runs (a reversed [max,min] override still yields a populated axis; the scale
  // handles the inversion). niceNum(negative) would otherwise NaN-cascade to [].
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (lo === hi) return [lo];
  // Step from the ACTUAL span, not a "nice"-rounded one. Rounding the span up
  // first (23.8 → 50) then dividing inflates the step by a whole notch, and
  // since the outermost nice ticks are clipped back to the data below, a domain
  // like [-6, 18] was left with just 0 and 10 — no negative label at all on a
  // chart whose whole point was that it crosses zero.
  const step = niceNum((hi - lo) / Math.max(target - 1, 1), true);
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Guard against fp accumulation with an explicit bound.
  const maxTicks = Math.round((niceMax - niceMin) / step) + 1;
  for (let i = 0; i < maxTicks; i++) {
    const v = niceMin + i * step;
    // Snap tiny fp residue to 0.
    ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  }
  return ticks.filter((v) => v >= lo - step / 1e6 && v <= hi + step / 1e6);
}

/** Round a range to a "nice" value; `round` snaps to nearest vs ceil. */
function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range));
  const frac = range / Math.pow(10, exp);
  let nice: number;
  if (round) {
    nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  } else {
    nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  }
  return nice * Math.pow(10, exp);
}

/** Powers-of-ten ticks for a log axis, within `[min, max]`. */
export function logTicks(min: number, max: number): number[] {
  const lo = Math.floor(Math.log10(min > 0 ? min : max / 1e6));
  const hi = Math.ceil(Math.log10(max));
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e++) ticks.push(Math.pow(10, e));
  return ticks.filter((v) => v >= min && v <= max);
}

/** Nice time-interval ticks. Picks a step from a human ladder. */
export function timeTicks(minMs: number, maxMs: number, target = 6): number[] {
  const span = maxMs - minMs;
  if (span <= 0) return [minMs];
  const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;
  const steps = [S, 5 * S, 15 * S, 30 * S, M, 5 * M, 15 * M, 30 * M, H, 3 * H, 6 * H, 12 * H, D, 2 * D, 7 * D, 14 * D, 30 * D, 90 * D, 180 * D, 365 * D];
  const ideal = span / Math.max(target - 1, 1);
  const idx = steps.findIndex((s) => s >= ideal);
  let step = idx === -1 ? steps[steps.length - 1] : steps[idx];
  // The ladder is coarse at the top (a month, then a quarter), so rounding up
  // can triple the spacing: seven months of data asks for a ~35-day step and
  // would get quarters. Drop to the next finer step when it still lands near
  // the target count (never more than ~1.4x it, so labels can't crowd).
  const finer = idx > 0 ? steps[idx - 1] : undefined;
  if (finer && span / finer <= Math.max(target - 1, 1) * 1.4) step = finer;
  const start = Math.ceil(minMs / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= maxMs; t += step) ticks.push(t);
  return ticks;
}

/**
 * Compute the numeric domain for a value/log/time axis from the
 * series data, honoring explicit `min`/`max` overrides and (for
 * value axes) extending to a nice zero-anchored range.
 */
export function computeDomain(
  values: number[],
  opts: { min?: number; max?: number; scale: MdChartScaleType; includeZero?: boolean } = { scale: 'value' },
): Domain {
  // Loop over the data rather than spreading into Math.min/Math.max: the spread
  // overflows the call-stack past ~1e5 args, and a single NaN/Infinity would
  // otherwise poison the whole aggregate. Only finite values feed the extent.
  const isLog = opts.scale === 'log';
  let dataLo = Infinity;
  let dataHi = -Infinity;
  let hasFinite = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    // A log axis is undefined at/below 0, and stacked bands contribute a 0
    // baseline; ignore non-positive values so the extent reflects the data.
    if (isLog && v <= 0) continue;
    hasFinite = true;
    if (v < dataLo) dataLo = v;
    if (v > dataHi) dataHi = v;
  }
  if (!hasFinite) {
    dataLo = isLog ? 1 : 0;
    dataHi = isLog ? 10 : 1;
  }

  // Explicit overrides win outright; `includeZero` only ever extends a
  // DATA-derived bound toward zero, never a user-supplied min/max.
  const loExplicit = opts.min != null && Number.isFinite(opts.min);
  const hiExplicit = opts.max != null && Number.isFinite(opts.max);
  let lo = loExplicit ? (opts.min as number) : dataLo;
  let hi = hiExplicit ? (opts.max as number) : dataHi;

  if (isLog) {
    // Snap a data-derived bound out to its enclosing decade (10ⁿ) so the data
    // sits cleanly between power-of-ten gridlines (10 → 100 → 1k → 10k …).
    if (!loExplicit && lo > 0) lo = Math.pow(10, Math.floor(Math.log10(lo)));
    if (!hiExplicit && hi > 0) hi = Math.pow(10, Math.ceil(Math.log10(hi)));
    if (lo === hi) {
      lo /= 10;
      hi *= 10;
    }
    return [lo, hi];
  }

  if (opts.includeZero) {
    if (!loExplicit && lo > 0) lo = 0;
    if (!hiExplicit && hi < 0) hi = 0;
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  return [lo, hi];
}
