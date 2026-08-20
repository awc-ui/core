/*
 * Chart engine — bar layout (spec → RenderScene)
 * ===========================================================
 * The bar-chart sibling of layout.ts. Turns a resolved bar-chart
 * spec + theme + pixel size into a backend-agnostic RenderScene
 * whose `bars` array the Canvas2D backend draws. Handles
 * vertical + horizontal orientation, grouped / stacked / percentage
 * modes, category + bar gaps, rounded outer corners and optional
 * value labels. Pure — no DOM — so it's unit-tested on its numbers.
 * ===========================================================
 */

import type { MdChartAnimation, MdChartAxisBreaks, MdChartAxisValue, MdChartDataPoint, MdChartLegendPosition, MdChartLineStyle, MdChartScaleType, MdChartStackMode, MdChartTitleAlign } from '../types';
import { computeDomain, inBreak, makeBrokenScale, normalizeBreaks, openTopSection, resolveAxisBreaks, sectionedTicks, type Domain, type Scale } from './scale';
import { stackSeries } from './geometry';
import type { BarLabel, HoverPoint, HoverSeries, LegendItem, Rect, RenderScene, SceneBar, SceneSegment, TextItem } from './scene';
import { axisLineWithBreaks, breakBandSegments, dashPattern, estimateLegendRows, titlePlacement, type EngineTheme } from './layout';
import { onColorFor } from './color';
import { chevronTipDepth } from './renderer-canvas';

export interface BarSeriesSpec {
  label: string;
  color: string;
  data: MdChartDataPoint[];
  hidden: boolean;
  /** `[low, high]` pairs instead of `data` — a bar that FLOATS between two
   *  values rather than growing from the baseline. Both ends are free, so both
   *  are rounded and both are labelled. A range never joins a stack.
   *  Normalised by the component, same as the line/area layout's. */
  range?: ([number, number] | null | undefined)[];
  /** Per-datum band WIDTH weights, keyed by data index — a variwide chart,
   *  where a column's width carries a second variable. A category band is
   *  shared by every series, so the first series to supply these sets the
   *  widths for the whole axis. */
  pointWidths?: Record<number, number>;
  /** Which value axis this series is measured against: 0 (default, the left /
   *  bottom one) or 1 (the opposite gutter). See {@link BarChartSpec.valueAxis2}. */
  axisIndex?: number;
  /** Ignore the group slotting and draw this series centred on the category
   *  band, at {@link widthRatio} of it — a column IN FRONT of the others rather
   *  than beside them. Fixed placement, in Highcharts' terms. */
  overlay?: boolean;
  /** Width of an overlaid series' bar as a fraction of the FULL category band
   *  (not the gapped inner width — so it does not compound with
   *  {@link BarChartSpec.categoryGapRatio}, and `0.5` really is half the band).
   *  Ignored unless {@link overlay} is set. Default 0.45. */
  widthRatio?: number;
  /** Named stack group. Series sharing a name stack together; different names
   *  sit SIDE BY SIDE, so one category can carry several stacks. Ignored when
   *  the chart is not stacked. */
  stack?: string;
  /** Per-datum colour overrides, keyed by data index. A bar not named here
   *  keeps the series colour. This is what a bar race needs: one series whose
   *  every bar is a different entity. */
  pointColors?: Record<number, string>;
}

export interface BarChartSpec {
  series: BarSeriesSpec[];
  title?: string;
  /** Horizontal alignment of the title over the plot. Default 'start'. */
  titleAlign?: MdChartTitleAlign;
  categories: MdChartAxisValue[];
  categoryFormatter: (v: MdChartAxisValue) => string;
  categoryLabel?: string;
  categoryHidden?: boolean;
  categoryHideTicks?: boolean;
  /** Stroke style for the category axis' line + tick marks. Default solid. */
  categoryDash?: MdChartLineStyle;
  /** Rotate the category tick labels by this many degrees. Negative leans the
   *  text up to the right with its END under the tick, which is the convention
   *  for long names on a bottom axis. 0 (default) leaves them upright, in which
   *  case a label wider than its band is truncated with an ellipsis. Applies to
   *  the bottom axis of a vertical chart; a horizontal chart's names already
   *  have the whole gutter to run into. */
  categoryLabelRotation?: number;
  /** Repeat the category names in the opposite gutter as well. A population
   *  pyramid is the case: the rows run out from a centre line in both
   *  directions, so a name on one side only is a long way from half its data.
   *  Horizontal charts (names in the side gutters). */
  categoryLabelsMirrored?: boolean;
  valueScale: MdChartScaleType;
  /** Ranges cut out of the value axis, so far-apart bars stay comparable. */
  valueBreaks?: MdChartAxisBreaks;
  valueMin?: number;
  valueMax?: number;
  valueFormatter: (v: number) => string;
  /** Formats the value AXIS ticks, when they want to read differently from the
   *  values themselves — `300k` on the axis, `300,000` in the tooltip. */
  valueTickFormatter?: (v: number) => string;
  valueLabel?: string;
  /** A SECOND value axis, drawn in the opposite gutter and used by any series
   *  whose `axisIndex` is 1. Two quantities on one category axis — a count and
   *  a rate, a volume and a price — that share no scale. */
  valueAxis2?: {
    min?: number;
    max?: number;
    label?: string;
    formatter?: (v: number) => string;
    hidden?: boolean;
  };
  valueHidden?: boolean;
  valueHideTicks?: boolean;
  /** Draw the category axis' own line (the frame edge). Default true. */
  categoryAxisLine?: boolean;
  /** Draw the value axis' own line (the frame edge). Default true. Ticks +
   *  gridlines are unaffected — a force diagram wants the grid but not the box. */
  valueAxisLine?: boolean;
  /** Stroke style for the value axis' line + tick marks. Default solid. */
  valueDash?: MdChartLineStyle;
  /** Stroke style for the gridlines drawn off the value ticks. Default solid. */
  valueGridDash?: MdChartLineStyle;
  stack: MdChartStackMode;
  horizontal: boolean;
  /** Fraction of the category band that is whitespace (0..1). */
  categoryGapRatio: number;
  /** Gap between sibling grouped bars, as a fraction of bar width (0..1). */
  barGapRatio: number;
  /** Fixed bar WIDTH in px, centred in each slot. Undefined = auto (fill the slot). */
  barWidth?: number;
  cornerRadius: number;
  /** Wrap the bars around a circle: one concentric RING per category, the value
   *  axis running as an angle. A radial (polar) bar chart. */
  polar?: boolean;
  /** Radius of the hole at the centre of a polar chart, as a fraction of the
   *  full radius. Default 0.22. */
  polarHole?: number;
  /** How much of the circle the value axis spans, as a fraction. Default 0.75 —
   *  the remaining quarter is where the category names go. */
  polarSweep?: number;
  /** Draw the bars as CHEVRONS pointing away from the baseline, interlocking
   *  along a stack — a force diagram, where each segment hands its contribution
   *  on to the next rather than merely sitting on it. */
  chevron?: boolean;
  showLabels: boolean;
  /** Print each stack's TOTAL past the end of the column, on top of the
   *  per-segment labels. Stacked charts only — an unstacked bar IS its total. */
  showTotals?: boolean;
  /** A quieter line under the title. */
  subtitle?: string;
  /** Legend anchor, or `'none'` to hide it. */
  legend?: MdChartLegendPosition | 'none';
  /** Measured legend extent (px) from the engine's two-pass render — reserves the
   *  gutter to the legend's REAL wrapped size instead of an estimate, so a
   *  many-series legend can't spill onto the plot. Set by the engine, not authors. */
  legendExtent?: number;
  /** Sparkline mode: edge-to-edge, no axes / grid / title / legend. */
  compact?: boolean;
  /** Small perpendicular tick marks on the value + category axes. Default false. */
  axisTicks?: boolean;
  /** Entry-animation variant played on first render. Default 'expressive'. */
  animation?: MdChartAnimation;
  /** Entry-animation duration override (ms); ≤ 0 disables. */
  animationDuration?: number;
  /** Legacy on/off flag (pre-variant). `false` → no animation. */
  animate?: boolean;
}

function approxWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

/**
 * Extend whichever value axis has the smaller below-zero share so both axes'
 * ZERO lands on the same pixel — the shared baseline a dual-axis bar chart needs
 * so bars from either axis grow from one line and a negative on either opens the
 * same below-zero band. The axis that already has the larger share is untouched
 * (nothing is squashed); the other's negative side is stretched to match. Left
 * alone when an axis has no positive extent, or both are already zero-based.
 */
function alignZeroAxes(a: Domain, b: Domain): [Domain, Domain] {
  const topA = a[1];
  const topB = b[1];
  if (!(topA > 0) || !(topB > 0)) return [a, b];
  const rA = a[0] < 0 ? -a[0] / topA : 0;
  const rB = b[0] < 0 ? -b[0] / topB : 0;
  const share = Math.max(rA, rB);
  if (share <= 0) return [a, b];
  return [
    [-share * topA, topA],
    [-share * topB, topB],
  ];
}

/** Cut `text` to `maxW` pixels, ending in an ellipsis. Same width estimate as
 *  {@link approxWidth}, so the two agree about what fits. */
function ellipsize(text: string, maxW: number, fontSize: number): string {
  if (maxW <= 0 || approxWidth(text, fontSize) <= maxW) return text;
  const per = fontSize * 0.58;
  const n = Math.floor(maxW / per) - 1;
  return n >= 1 ? `${text.slice(0, n)}…` : '';
}

/**
 * Phase 1 of the bar layout: turn the series into value BANDS (`[base, top]`
 * per datum, stacked if asked), derive the value domain(s), and resolve the
 * axis ticks / breaks / category labels off them. Pure `(spec, theme) → bundle`
 * with no pixel geometry — the plot rect doesn't exist yet. Everything a later
 * phase needs from here is returned; nothing here reads the box size.
 */
function computeValueAxes(spec: BarChartSpec, theme: EngineTheme) {
  const C = spec.categories.length || Math.max(0, ...spec.series.map((s) => (s.range ?? s.data ?? []).length));
  const stacked = spec.stack !== 'none';

  // A range series is never stacked — it already carries both its edges, and
  // piling one onto a cumulative baseline would put its low somewhere that is
  // not a value anyone measured.
  const stackKeys = spec.series.map((s) => (stacked && !s.range ? s.stack || 'stacked' : '__unstacked__'));
  // Hidden series contribute empty data so they don't reserve a stack band.
  const bands = stackSeries(
    spec.series.map((s) => (s.hidden || s.range ? [] : (s.data ?? []))),
    spec.stack,
    stackKeys,
  );
  // Range bands are the datum itself, low edge first so the band is always
  // [base, top] like every other one downstream.
  spec.series.forEach((s, si) => {
    if (!s.range || s.hidden) return;
    bands[si] = s.range.map((d) => (d ? ([Math.min(d[0], d[1]), Math.max(d[0], d[1])] as [number, number]) : d));
  });
  const vVals: number[] = [];
  spec.series.forEach((s, si) => {
    if (s.hidden) return;
    bands[si].forEach((b) => {
      if (b) vVals.push(b[0], b[1]);
    });
  });
  const onAxis2 = (si: number) => (spec.series[si].axisIndex ?? 0) === 1;
  const hasAxis2 = !!spec.valueAxis2 && spec.series.some((sr, si) => !sr.hidden && onAxis2(si));
  const vVals2: number[] = [];
  if (hasAxis2) {
    // Split the collected values by axis — a series on the right-hand scale
    // must not stretch the left one's domain, which is the whole point of
    // having two.
    vVals.length = 0;
    spec.series.forEach((sr, si) => {
      if (sr.hidden) return;
      bands[si].forEach((b) => {
        if (b) (onAxis2(si) ? vVals2 : vVals).push(b[0], b[1]);
      });
    });
  }
  let vDomain = computeDomain(vVals, {
    min: spec.valueMin,
    max: spec.valueMax,
    scale: spec.valueScale,
    includeZero: true,
  });
  let vDomain2 = hasAxis2
    ? computeDomain(vVals2, { min: spec.valueAxis2!.min, max: spec.valueAxis2!.max, scale: spec.valueScale, includeZero: true })
    : vDomain;
  // Zero-align the two value axes so a dual-axis chart shares ONE baseline (see
  // alignZeroAxes). Only for the linear, auto-ranged case — a pinned min/max is
  // the author's own call, and a log axis has no zero to share. Both axes then
  // tick across their aligned range, so the below-zero band carries gridlines and
  // labels on the primary axis instead of reading as empty space.
  if (hasAxis2 && spec.valueScale === 'value' && spec.valueMin == null && spec.valueMax == null && spec.valueAxis2!.min == null && spec.valueAxis2!.max == null) {
    [vDomain, vDomain2] = alignZeroAxes(vDomain, vDomain2);
  }

  // Value-axis breaks: same treatment as the line chart's y axis — the cut
  // costs its gap in pixels, and each surviving section gets its own ticks.
  // Normalised against the axis domain straight away (see computeLayout): a cut
  // the domain rejects must not section the ticks either.
  const vFound = resolveAxisBreaks(spec.valueBreaks, vVals, spec.valueScale);
  // Open a top-edge cut (an outlier pinned to the axis top) into a real section so
  // it carries ticks + gridlines instead of a blank band above the break.
  const vBreaks = { ...vFound, ranges: openTopSection(normalizeBreaks(vFound.ranges, vDomain), vDomain, spec.valueScale) };
  const vTickVals = sectionedTicks(vDomain, vBreaks.ranges, spec.valueScale, 6).filter(
    (t) => !inBreak(vBreaks.ranges, t),
  );
  const vTickLabels = vTickVals.map((v) => (spec.valueTickFormatter ?? spec.valueFormatter)(v));
  const v2Fmt = spec.valueAxis2?.formatter ?? spec.valueTickFormatter ?? spec.valueFormatter;
  const v2TickVals = hasAxis2 && !spec.valueAxis2!.hidden ? sectionedTicks(vDomain2, [], spec.valueScale, 6) : [];
  const v2TickLabels = v2TickVals.map((v) => v2Fmt(v));
  const maxV2LabelW = Math.max(0, ...v2TickLabels.map((t) => approxWidth(t, theme.labelSize)));
  const catLabels: string[] = [];
  for (let i = 0; i < C; i++) catLabels.push(spec.categoryFormatter(spec.categories[i] ?? i));

  return { C, stacked, stackKeys, bands, onAxis2, hasAxis2, vDomain, vDomain2, vBreaks, vTickVals, vTickLabels, v2TickVals, v2TickLabels, maxV2LabelW, catLabels };
}

/**
 * Phase 4: category band geometry along the MAIN axis (x for a vertical chart,
 * y for a horizontal one). Needs the plot rect, so it runs after the gutters are
 * known. Returns closures — `sizeAt`/`bandCenter`/`groupInnerAt`/`barWAt` — plus
 * the slot bookkeeping (`groupNames`, `visibleIdx`) and the per-stack outermost-
 * segment maps (`topSeriesFor`/`botSeriesFor`) used to round only the free end.
 */
function computeBandGeometry(
  spec: BarChartSpec,
  plot: { x: number; y: number; width: number; height: number },
  horizontal: boolean,
  C: number,
  stacked: boolean,
  stackKeys: string[],
  bands: ReturnType<typeof computeValueAxes>['bands'],
) {
  const mainStart = horizontal ? plot.y : plot.x;
  const mainLen = horizontal ? plot.height : plot.width;
  // Category bands are equal unless a series supplies width weights, in which
  // case each band takes a share of the main axis proportional to its weight —
  // a variwide chart, where the column's width is a second variable. The bands
  // are shared by every series, so the first series to ask decides for all.
  const widthWeights = spec.series.find((s) => !s.hidden && s.pointWidths)?.pointWidths;
  const weightAt = (i: number) => {
    const w = widthWeights?.[i];
    return typeof w === 'number' && Number.isFinite(w) && w > 0 ? w : 1;
  };
  let weightSum = 0;
  const bandStarts: number[] = [];
  for (let i = 0; i < C; i++) {
    bandStarts.push(weightSum);
    weightSum += weightAt(i);
  }
  if (weightSum <= 0) weightSum = Math.max(1, C);
  const sizeAt = (i: number) => (C > 0 ? (mainLen * weightAt(i)) / weightSum : mainLen);
  const startAt = (i: number) => mainStart + (mainLen * bandStarts[i]) / weightSum;
  const bandCenter = (i: number) => startAt(i) + sizeAt(i) / 2;
  const groupInnerAt = (i: number) => sizeAt(i) * (1 - spec.categoryGapRatio);

  // An overlaid series is drawn ON the band rather than in a slot of it, so it
  // is left out of the slot count — otherwise it would reserve a place it never
  // stands in and narrow every other bar for nothing.
  const visibleIdx = spec.series.map((_, i) => i).filter((i) => !spec.series[i].hidden && !spec.series[i].overlay);
  // Slots along the category band. Unstacked, every visible series gets one.
  // Stacked, every distinct stack GROUP gets one — so a chart mixing
  // `stack: 'a'` and `stack: 'b'` draws two stacks side by side rather than
  // piling all six series into one column.
  const groupNames: string[] = [];
  for (const i of visibleIdx) {
    const k = stackKeys[i];
    if (!groupNames.includes(k)) groupNames.push(k);
  }
  const groupCount = stacked ? Math.max(1, groupNames.length) : Math.max(1, visibleIdx.length);
  // barW: split the group among sibling bars, leaving barGapRatio between them.
  const barWAt = (i: number) => groupInnerAt(i) / (groupCount + (groupCount - 1) * spec.barGapRatio);

  // Outermost segment per category, per sign, for rounding the free (outer) end:
  // the top of the highest positive segment (max band[1]) and the bottom of the
  // lowest negative segment (min band[0]).
  // Keyed `${group}|${category}` — the outermost segment is per STACK, not per
  // category, or only one of two side-by-side stacks would get a rounded cap.
  const topSeriesFor = new Map<string, number>();
  const botSeriesFor = new Map<string, number>();
  if (stacked) {
    for (let r = 0; r < C; r++) {
      const topV = new Map<string, number>();
      const botV = new Map<string, number>();
      spec.series.forEach((s, si) => {
        if (s.hidden) return;
        const b = bands[si][r];
        if (!b) return;
        const k = `${stackKeys[si]}|${r}`;
        if (b[1] > (topV.get(k) ?? -Infinity)) {
          topV.set(k, b[1]);
          topSeriesFor.set(k, si);
        }
        if (b[0] < (botV.get(k) ?? Infinity)) {
          botV.set(k, b[0]);
          botSeriesFor.set(k, si);
        }
      });
    }
  }

  return { sizeAt, bandCenter, groupInnerAt, barWAt, groupNames, visibleIdx, topSeriesFor, botSeriesFor, mainLen };
}

/**
 * Phase 2: reserve gutters for the chrome — title, legend, axis tick labels,
 * axis titles, and the room a free-end / low-end data label needs — then derive
 * the plot rect from what's left. Returns the plot plus the handful of label /
 * legend metrics the later text phase still needs (`compact`, the legend band
 * heights, `lowEndRoom`, the rotation, `mirrorCats`, `maxDataLabelW`).
 */
function computeGutters(
  spec: BarChartSpec,
  theme: EngineTheme,
  width: number,
  height: number,
  horizontal: boolean,
  hasAxis2: boolean,
  vTickLabels: string[],
  catLabels: string[],
  maxV2LabelW: number,
) {
  const subtitleH = spec.subtitle ? theme.labelSize + 4 : 0;
  const titleH = spec.title ? theme.titleSize + 10 + subtitleH : 0;
  const maxVLabelW = spec.valueHidden || spec.valueHideTicks ? 0 : Math.max(0, ...vTickLabels.map((t) => approxWidth(t, theme.labelSize)));
  const maxCatLabelW = spec.categoryHidden || spec.categoryHideTicks ? 0 : Math.max(0, ...catLabels.map((t) => approxWidth(t, theme.labelSize)));
  /**
   * Room the value labels need past the end of a bar.
   *
   * Estimated from the widest one the chart will actually print, not a flat
   * margin: "8" and "4,695" are the same reservation under a constant, and the
   * long one then ran off the plot — on a horizontal chart the longest bar is
   * also the one whose label has least room, so it is always the value that
   * matters most that gets clipped.
   */
  // Widest label that will actually be printed — a range series prints both of
  // its edges, an ordinary one its value.
  const maxDataLabelW = spec.showLabels
    ? Math.max(
        0,
        ...spec.series.flatMap((sr) =>
          sr.range
            ? sr.range.flatMap((d) => (d ? [approxWidth(spec.valueFormatter(d[0]), theme.labelSize), approxWidth(spec.valueFormatter(d[1]), theme.labelSize)] : []))
            : (sr.data ?? []).map((v) => (typeof v === 'number' ? approxWidth(spec.valueFormatter(v), theme.labelSize) : 0)),
        ),
      )
    : 0;
  const axisTitleV = spec.valueLabel ? theme.labelSize + 6 : 0;
  const axisTitleC = spec.categoryLabel ? theme.labelSize + 6 : 0;
  const labelRowH = theme.labelSize + 8;
  // Rotated category labels take a taller row: the text's own length now runs
  // partly DOWN the page, so the row has to hold its vertical projection.
  const catRot = !horizontal ? (spec.categoryLabelRotation ?? 0) : 0;
  const catRotRad = (Math.abs(catRot) * Math.PI) / 180;
  const catLabelRowH = catRot
    ? maxCatLabelW * Math.sin(catRotRad) + theme.labelSize * Math.cos(catRotRad) + 8
    : labelRowH;

  // A top/bottom legend gets a reserved band; a left/right legend gets a
  // reserved side gutter (a vertically-centred column) so it never overlaps the
  // plot or the axis labels.
  const legendActive = !!spec.legend && spec.legend !== 'none' && spec.series.length > 1;
  const legendSide = legendActive && (spec.legend === 'left' || spec.legend === 'right');
  const legendAtBottom = legendActive && !legendSide && spec.legend!.startsWith('bottom');
  const legendTopRow = legendActive && !legendSide && !legendAtBottom;
  const legendRows = legendTopRow || legendAtBottom ? estimateLegendRows(spec.series.map((s) => s.label), theme.labelSize, width * 0.86) : 1;
  // Prefer the engine's MEASURED legend extent (two-pass render) over the estimate.
  const legendBandH = spec.legendExtent != null && (legendTopRow || legendAtBottom) ? spec.legendExtent + 8 : legendRows * (theme.labelSize + 8) + 6;
  const legendBandTop = legendTopRow ? legendBandH : 0;
  const legendBandBottom = legendAtBottom ? legendBandH : 0;
  const legendSideW = legendSide ? (spec.legendExtent != null ? spec.legendExtent + 16 : Math.max(0, ...spec.series.map((s) => approxWidth(s.label, theme.labelSize))) + 34) : 0;
  const legendLeftW = spec.legend === 'left' ? legendSideW : 0;
  const legendRightW = spec.legend === 'right' ? legendSideW : 0;

  // Sparkline mode fills its host edge-to-edge — no gutters for chrome.
  // Does any data label land at the LOW end of a bar (left on a horizontal
  // chart, below on a vertical one)? A range prints both edges; an ordinary
  // series prints below the baseline only where it goes negative. Without this
  // the gutter is sized for the high side alone and the low label runs into the
  // category names.
  const labelsAtLowEnd =
    (spec.showLabels || spec.showTotals) &&
    spec.series.some((sr) => !sr.hidden && (!!sr.range || (sr.data ?? []).some((v) => typeof v === 'number' && v < 0)));

  const mirrorCats = !!spec.categoryLabelsMirrored && horizontal && !spec.categoryHidden && !spec.categoryHideTicks;
  const compact = !!spec.compact;
  // Both the category name and a low-end data label are anchored to the plot's
  // edge, so widening the gutter alone just makes them overlap further out.
  // The category name steps back past the data label's lane.
  const lowEndRoom = labelsAtLowEnd ? (horizontal ? maxDataLabelW + 8 : theme.labelSize + 4) : 0;
  let padTop: number;
  let padRight: number;
  let padBottom: number;
  let padLeft: number;
  if (compact) {
    padTop = padRight = padBottom = padLeft = 2;
  } else if (horizontal) {
    // categories on the y (left) gutter, values on the x (bottom) gutter
    padTop = titleH + 8 + legendBandTop;
    padLeft = maxCatLabelW + 12 + axisTitleC + legendLeftW + (labelsAtLowEnd ? maxDataLabelW + 8 : 0);
    padBottom = (spec.valueHidden || spec.valueHideTicks ? 0 : labelRowH) + axisTitleV + 6 + legendBandBottom;
    padRight = 12 + (spec.showLabels ? maxDataLabelW + 8 : 0) + legendRightW + (mirrorCats ? maxCatLabelW + 12 : 0);
  } else {
    padTop = titleH + 8 + legendBandTop + (spec.showLabels ? theme.labelSize + 4 : 0);
    // A vertical chart's labels sit ABOVE the bar, so their width is not the
    // constraint — but the outermost columns' labels still overhang sideways.
    padRight = 12 + legendRightW + (spec.showLabels ? maxDataLabelW / 2 : 0) + (hasAxis2 ? maxV2LabelW + 10 + (spec.valueAxis2!.label ? theme.labelSize + 6 : 0) : 0);
    padLeft = maxVLabelW + 10 + axisTitleV + legendLeftW;
    padBottom = (spec.categoryHidden || spec.categoryHideTicks ? 0 : catLabelRowH) + axisTitleC + 6 + legendBandBottom + (labelsAtLowEnd ? theme.labelSize + 4 : 0);
  }

  const plot = {
    x: padLeft,
    y: padTop,
    width: Math.max(1, width - padLeft - padRight),
    height: Math.max(1, height - padTop - padBottom),
  };

  return { plot, compact, legendBandTop, legendBandBottom, lowEndRoom, mirrorCats, maxDataLabelW, catRot, catRotRad };
}

export function computeBarLayout(spec: BarChartSpec, theme: EngineTheme, width: number, height: number): RenderScene {
  const horizontal = spec.horizontal;
  // Phase 1: value bands, domains, ticks, breaks, category labels (no pixels yet).
  const { C, stacked, stackKeys, bands, onAxis2, hasAxis2, vDomain, vDomain2, vBreaks, vTickVals, vTickLabels, v2TickVals, v2TickLabels, maxV2LabelW, catLabels } =
    computeValueAxes(spec, theme);

  if (spec.polar) return radialScene(spec, theme, width, height, bands, vDomain, catLabels, C);

  // Phase 2: reserve gutters for the chrome (title, legend, axis labels) and
  // derive the plot rect + the label metrics later phases still need.
  const { plot, compact, legendBandTop, legendBandBottom, lowEndRoom, mirrorCats, maxDataLabelW, catRot, catRotRad } =
    computeGutters(spec, theme, width, height, horizontal, hasAxis2, vTickLabels, catLabels, maxV2LabelW);

  // ── value scale maps onto the cross length ──
  const crossLen = horizontal ? plot.width : plot.height;
  const vScale: Scale = makeBrokenScale(vDomain, crossLen, spec.valueScale, vBreaks.ranges, vBreaks.sizing);
  // Bars grow from zero; clamp it into the (zero-including) domain.
  const baselineVal = Math.min(vDomain[1], Math.max(vDomain[0], 0));
  // pixel of a value along the cross axis
  const vScale2: Scale = hasAxis2 ? makeBrokenScale(vDomain2, crossLen, spec.valueScale, [], vBreaks.sizing) : vScale;
  const valPx = (v: number) => (horizontal ? plot.x + vScale.scale(v) : plot.y + plot.height - vScale.scale(v));
  const valPx2 = (v: number) => (horizontal ? plot.x + vScale2.scale(v) : plot.y + plot.height - vScale2.scale(v));
  /** Project a value for the axis THIS series is measured against. */
  const valPxFor = (si: number, v: number) => (hasAxis2 && onAxis2(si) ? valPx2(v) : valPx(v));
  const basePx = valPx(baselineVal);

  /**
   * The pixel strips the cuts occupy, along the value axis. A bar drawn
   * straight through one would hide the very discontinuity the break exists to
   * show — every bar grows from the baseline, so every bar crosses it.
   */
  // Taken from each cut's own pixel span rather than by re-scaling its
  // endpoints: a cut whose top section holds a single value has zero data
  // width, so scaling `to` would return the far end of that section and the
  // "strip" would swallow half the axis.
  const breakStrips = ((vScale as { breaks?: readonly { px: number; gap: number }[] }).breaks ?? []).map((b) =>
    horizontal
      ? { lo: plot.x + b.px, hi: plot.x + b.px + b.gap }
      : { lo: plot.y + plot.height - b.px - b.gap, hi: plot.y + plot.height - b.px },
  );

  /** A bar with any strip removed from it — one rect per surviving piece. */
  const splitBar = (bar: SceneBar): SceneBar[] => {
    if (!breakStrips.length) return [bar];
    const lo = horizontal ? bar.x : bar.y;
    const hi = lo + (horizontal ? bar.w : bar.h);
    let pieces: { lo: number; hi: number }[] = [{ lo, hi }];
    for (const strip of breakStrips) {
      const next: { lo: number; hi: number }[] = [];
      for (const p of pieces) {
        if (strip.hi <= p.lo || strip.lo >= p.hi) {
          next.push(p);
          continue;
        }
        if (strip.lo > p.lo) next.push({ lo: p.lo, hi: strip.lo });
        if (strip.hi < p.hi) next.push({ lo: strip.hi, hi: p.hi });
      }
      pieces = next;
    }
    if (pieces.length === 1 && pieces[0].lo === lo && pieces[0].hi === hi) return [bar];
    return pieces
      .filter((p) => p.hi - p.lo > 0.5)
      .map((p, idx, all) => ({
        ...bar,
        // Only the outermost piece keeps the rounded cap.
        radius: (idx === (horizontal ? all.length - 1 : 0) ? bar.radius : [0, 0, 0, 0]) as SceneBar['radius'],
        ...(horizontal ? { x: p.lo, w: p.hi - p.lo } : { y: p.lo, h: p.hi - p.lo }),
      }));
  };

  // Phase 4: category band geometry — where each band sits along the main axis,
  // how the group splits into sibling bar slots, and which segment caps a stack.
  const { sizeAt, bandCenter, groupInnerAt, barWAt, groupNames, visibleIdx, topSeriesFor, botSeriesFor, mainLen } =
    computeBandGeometry(spec, plot, horizontal, C, stacked, stackKeys, bands);

  const bars: SceneBar[] = [];
  const hoverPoints: HoverSeries[] = [];
  const texts: TextItem[] = [];
  // Value labels bound to their bar rather than to a fixed pixel, so the bar-
  // label overlay can re-derive their position from the (animating) bar tip
  // every frame instead of leaving them stranded at the final geometry.
  const barLabels: BarLabel[] = [];
  const r = spec.cornerRadius;

  spec.series.forEach((s, si) => {
    if (s.hidden) return;
    const groupPos = stacked ? Math.max(0, groupNames.indexOf(stackKeys[si])) : Math.max(0, visibleIdx.indexOf(si));
    const byIndex: Record<number, HoverPoint> = {};
    for (let i = 0; i < C; i++) {
      const band = bands[si][i];
      if (!band) continue;
      const isRange = !!s.range;
      const raw = isRange ? null : s.data[i];
      const rawNum = typeof raw === 'number' ? raw : band[1];
      const p0 = valPxFor(si, band[0]);
      const p1 = valPxFor(si, band[1]);
      // Overlaid: centred on the band at its own width, in front of whatever
      // the slotted series drew. Otherwise: one slot of the group.
      // Overlay width is a fraction of the FULL band, so widthRatio doesn't
      // silently compound with the category gap (which made it read far thinner
      // than the number suggests). A slotted bar still lives inside the gap.
      const autoW = s.overlay ? sizeAt(i) * (s.widthRatio ?? 0.45) : barWAt(i);
      const barGap = autoW * spec.barGapRatio;
      // A configured `barWidth` (px) narrows each bar and CENTRES it in its slot,
      // leaving the slot geometry (so grouped bars stay put) alone, clamped to the
      // slot so it can't overrun a neighbour. Undefined → auto (fills the slot).
      const barW = spec.barWidth != null && !s.overlay ? Math.min(Math.max(1, spec.barWidth), autoW) : autoW;
      const slotStart = s.overlay
        ? bandCenter(i) - autoW / 2
        : bandCenter(i) - groupInnerAt(i) / 2 + groupPos * (autoW + barGap);
      const barStart = slotStart + (autoW - barW) / 2;
      // Direction comes from the raw value's sign — stacked bands are always
      // stored [base, top] so band[1] >= band[0] would misread negatives.
      const positive = rawNum >= 0;
      const stackCell = `${stackKeys[si]}|${i}`;
      // The segment sitting ON the baseline has nothing behind it to fill a
      // notch — two stacks meeting at zero would leave a hole between them.
      const atBaseline = positive ? band[0] === 0 : band[1] === 0;
      // A range bar has TWO free ends, so both get the cap.
      const isTop = isRange || !stacked || (positive ? topSeriesFor.get(stackCell) === si : botSeriesFor.get(stackCell) === si);

      // Chevron force diagram: recede each segment from its shared boundaries so
      // the interlocking arrows read as SEPARATE areas rather than one continuous
      // ribbon. The tip/notch depth comes from the (unchanged) thickness, so both
      // edges pull back together and the V-shaped gap between neighbours stays
      // uniform. Clamped so a short segment keeps most of its length.
      const chevInset = spec.chevron ? Math.min(barW * 0.03, 5, Math.abs(p1 - p0) * 0.35) : 0;
      // A chevron's drawn point overflows its rect by the tip depth, and the
      // rect is itself pulled back by half the inset. The hover marker belongs
      // ON that point: left at the plain value edge it floats behind the arrow,
      // reading as though it marks nothing.
      const chevLead = spec.chevron ? chevronTipDepth(barW) - chevInset / 2 : 0;

      let bar: SceneBar;
      if (horizontal) {
        const x = Math.min(p0, p1) + chevInset / 2;
        const w = Math.abs(p1 - p0) - chevInset;
        const radius: [number, number, number, number] = isRange
          ? [r, r, r, r]
          : isTop
            ? positive
              ? [0, r, r, 0]
              : [r, 0, 0, r]
            : [0, 0, 0, 0];
        bar = { x, y: barStart, w, h: barW, color: s.pointColors?.[i] ?? s.color, radius, seriesIndex: si, dataIndex: i, horizontal: true, arrow: spec.chevron ? (positive ? 1 : -1) : undefined, notch: spec.chevron ? !atBaseline : undefined };
        byIndex[i] = { x: (positive ? Math.max(p0, p1) + chevLead : Math.min(p0, p1) - chevLead), y: barStart + barW / 2, value: rawNum, color: bar.color, ...(isRange ? { low: band[0], high: band[1] } : null) };
      } else {
        const y = Math.min(p0, p1) + chevInset / 2;
        const h = Math.abs(p1 - p0) - chevInset;
        const radius: [number, number, number, number] = isRange
          ? [r, r, r, r]
          : isTop
            ? positive
              ? [r, r, 0, 0]
              : [0, 0, r, r]
            : [0, 0, 0, 0];
        bar = { x: barStart, y, w: barW, h, color: s.pointColors?.[i] ?? s.color, radius, seriesIndex: si, dataIndex: i, horizontal: false, arrow: spec.chevron ? (positive ? 1 : -1) : undefined, notch: spec.chevron ? !atBaseline : undefined };
        byIndex[i] = { x: barStart + barW / 2, y: (positive ? Math.min(p0, p1) - chevLead : Math.max(p0, p1) + chevLead), value: rawNum, color: bar.color, ...(isRange ? { low: band[0], high: band[1] } : null) };
      }
      bars.push(...splitBar(bar));

      if (spec.showLabels && isRange) {
        // Both edges, each bound to its OWN free end of the floating bar, so they
        // ride out from the baseline (zero line) with the bar as it opens during
        // the intro instead of sitting frozen at the final low/high.
        barLabels.push(
          { seriesIndex: si, dataIndex: i, text: spec.valueFormatter(band[0]), color: theme.textColor, size: theme.labelSize, atLowEnd: true },
          { seriesIndex: si, dataIndex: i, text: spec.valueFormatter(band[1]), color: theme.textColor, size: theme.labelSize, atLowEnd: false },
        );
      } else if (spec.showLabels && stacked && typeof raw === 'number') {
        // A stacked segment has no free end to hang a label off — every segment
        // but the outermost is boxed in by its neighbours. The value goes INSIDE
        // the segment, in whichever of black/white reads on that fill, and is
        // dropped when the segment is too small to hold it rather than spilling
        // over the segments either side.
        // In percentage mode the SHARE is what the column shows, and it is
        // already what the band holds — labelling `raw` would print the
        // un-normalised figure against a percent formatter (33600%).
        const shown = spec.stack === 'percentage' ? Math.abs(band[1] - band[0]) * (raw < 0 ? -1 : 1) : raw;
        const txt = spec.valueFormatter(shown);
        const fits = horizontal
          ? bar.w > approxWidth(txt, theme.labelSize) + 8 && bar.h > theme.labelSize
          : bar.h > theme.labelSize + 6 && bar.w > approxWidth(txt, theme.labelSize) + 4;
        if (fits) {
          // Bound to the bar so it stays centred as the segment grows in — the
          // overlay recomputes its position from the bar each frame.
          barLabels.push({ seriesIndex: si, dataIndex: i, text: txt, color: onColorFor(bar.color), size: theme.labelSize, fontWeight: 600, inside: true });
        }
      } else if (spec.showLabels && typeof raw === 'number') {
        // Free-end value label. Bound to the bar (not a fixed pixel) so it rides
        // out to the tip with the bar during the entry animation instead of
        // snapping to the final position. The overlay derives the exact anchor +
        // alignment from the bar's live geometry and orientation.
        barLabels.push({ seriesIndex: si, dataIndex: i, text: spec.valueFormatter(raw), color: theme.textColor, size: theme.labelSize, atLowEnd: !positive });
      }
    }
    hoverPoints.push({ seriesIndex: si, color: s.color, label: s.label, byIndex, values: s.range ? bands[si].map((b) => (b ? b[1] : null)) : s.data });
  });

  // ── stack totals ──
  // One label per stack per category, past its free end. Read off the bands
  // rather than re-summing the data, so a hidden series drops out of the total
  // the same way it drops out of the column.
  // Percentage mode has nothing to total: every column is 100 by construction.
  if (spec.showTotals && stacked && spec.stack !== 'percentage') {
    for (let i = 0; i < C; i++) {
      for (const g of groupNames) {
        let top = -Infinity;
        let bottom = Infinity;
        let sum = 0;
        let any = false;
        spec.series.forEach((s, si) => {
          if (s.hidden || stackKeys[si] !== g) return;
          const b = bands[si][i];
          const v = s.data?.[i];
          if (!b) return;
          any = true;
          top = Math.max(top, b[1]);
          bottom = Math.min(bottom, b[0]);
          if (typeof v === 'number') sum += v;
        });
        if (!any) continue;
        // Percentage mode normalises every column to 100, so the interesting
        // total is the raw one the percentages were taken from.
        const txt = spec.valueFormatter(sum);
        // Past whichever end the stack actually reaches — an all-negative
        // column's free end is the bottom.
        const positive = top > 0 || bottom >= 0;
        // Bind the total to the stack's OUTERMOST segment (the one that carries
        // the free end), so the overlay tracks it past the column top as the
        // stack grows in — a fixed `texts` label would hang at the final total
        // while the column rose into it.
        const outerSeg = positive ? topSeriesFor.get(`${g}|${i}`) : botSeriesFor.get(`${g}|${i}`);
        if (outerSeg == null) continue;
        barLabels.push({ seriesIndex: outerSeg, dataIndex: i, text: txt, color: theme.textColor, size: theme.labelSize, fontWeight: 600, atLowEnd: !positive });
      }
    }
  }

  // ── gridlines (value axis) + axis frame ──
  const gridlines: SceneSegment[] = [];
  const axisLines: SceneSegment[] = [];
  const TICK = 5;
  const yb = plot.y + plot.height;
  // Stroke styles for the chrome. The value axis owns the gridlines (they are
  // drawn off its ticks); the two frame lines take the dash of the axis that
  // runs along them, which swaps with `horizontal`.
  const valueDash = dashPattern(spec.valueDash);
  const gridDash = dashPattern(spec.valueGridDash);
  const categoryDash = dashPattern(spec.categoryDash);
  if (!spec.valueHidden && !compact) {
    for (const t of vTickVals) {
      const pv = valPx(t);
      if (horizontal) {
        gridlines.push({ x1: pv, y1: plot.y, x2: pv, y2: yb, color: theme.gridLineColor, width: 1, dash: gridDash });
        if (spec.axisTicks) axisLines.push({ x1: pv, y1: yb, x2: pv, y2: yb + TICK, color: theme.axisLineColor, width: 1, dash: valueDash });
      } else {
        gridlines.push({ x1: plot.x, y1: pv, x2: plot.x + plot.width, y2: pv, color: theme.gridLineColor, width: 1, dash: gridDash });
        if (spec.axisTicks) axisLines.push({ x1: plot.x - TICK, y1: pv, x2: plot.x, y2: pv, color: theme.axisLineColor, width: 1, dash: valueDash });
      }
    }
  }
  if (!compact) {
    const catLine = spec.categoryAxisLine !== false;
    const valLine = spec.valueAxisLine !== false;
    const valBreaks = (vScale as { breaks?: readonly { px: number; gap: number }[] }).breaks ?? [];
    // horizontal: the category axis runs up the LEFT edge, the value axis along
    // the BOTTOM. vertical: value up the left, category along the bottom. The
    // VALUE axis is interrupted (with a zigzag) around each break; the category
    // axis is always a plain line.
    if (catLine) {
      axisLines.push(
        horizontal
          ? { x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: categoryDash }
          : { x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: categoryDash },
      );
    }
    if (valLine) {
      if (horizontal) {
        // Value axis along the bottom (x). A cut sits `px` from the left. The
        // tear runs vertically, up the plot's whole height, at the cut.
        const cuts = valBreaks.map((b) => ({ px: b.px, gap: b.gap }));
        axisLines.push(...axisLineWithBreaks('x', plot.x, plot.x + plot.width, plot.y + plot.height, cuts, theme.axisLineColor, valueDash));
        for (const c of cuts) axisLines.push(...breakBandSegments('x', plot.x + c.px, plot.x + c.px + c.gap, plot.y, plot.y + plot.height, theme.axisLineColor));
      } else {
        // Value axis up the left (y), bottom-up: a cut at offset `px` sits
        // `plot.height - px - gap` above the bottom. The tear runs horizontally,
        // across the plot's whole width, at the cut.
        const cuts = valBreaks.map((b) => ({ px: plot.height - b.px - b.gap, gap: b.gap }));
        axisLines.push(...axisLineWithBreaks('y', plot.y, plot.y + plot.height, plot.x, cuts, theme.axisLineColor, valueDash));
        for (const c of cuts) axisLines.push(...breakBandSegments('y', plot.y + c.px, plot.y + c.px + c.gap, plot.x, plot.x + plot.width, theme.axisLineColor));
      }
    }
  }

  // ── overlay text (title, value ticks, category ticks, axis titles) ──
  if (spec.title && !compact) {
    const tt = titlePlacement(spec.titleAlign, plot.x, plot.width);
    texts.push({ x: tt.x, y: legendBandTop + 6, text: spec.title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: 'top', key: 'title' });
    // Under the title and sharing its alignment — a source line, a unit, the
    // caveat a title should not have to carry.
    if (spec.subtitle) {
      texts.push({
        x: tt.x,
        y: legendBandTop + 6 + theme.titleSize + 4,
        text: spec.subtitle,
        color: theme.textColorMuted,
        fontSize: theme.labelSize,
        align: tt.align,
        baseline: 'top',
        key: 'subtitle',
      });
    }
  }
  // The second value axis: its own line down the right-hand gutter, its own
  // ticks, no gridlines. Two sets of gridlines at two spacings turn the plot
  // into a mesh nobody can read a value off.
  if (hasAxis2 && !spec.valueAxis2!.hidden && !compact && !horizontal) {
    const rx = plot.x + plot.width;
    axisLines.push({ x1: rx, y1: plot.y, x2: rx, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: valueDash });
    v2TickVals.forEach((t, i) => {
      const pv = valPx2(t);
      if (spec.axisTicks) axisLines.push({ x1: rx, y1: pv, x2: rx + TICK, y2: pv, color: theme.axisLineColor, width: 1, dash: valueDash });
      texts.push({ x: rx + 8, y: pv, text: v2TickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, align: 'start', baseline: 'middle', key: `v2t-${i}` });
    });
    if (spec.valueAxis2!.label) {
      texts.push({ x: width - 4, y: plot.y + plot.height / 2, text: spec.valueAxis2!.label, color: theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'bottom', rotate: -90, key: 'val2-axis-title' });
    }
  }
  if (!spec.valueHidden && !spec.valueHideTicks && !compact) {
    vTickVals.forEach((t, i) => {
      const pv = valPx(t);
      if (horizontal) {
        texts.push({ x: pv, y: plot.y + plot.height + 6, text: vTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, align: 'center', baseline: 'top', key: `vt-${i}` });
      } else {
        texts.push({ x: plot.x - 8, y: pv, text: vTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, align: 'end', baseline: 'middle', key: `vt-${i}` });
      }
    });
  }
  const mainPositions: number[] = [];
  // Category labels along y (horizontal) stack tightly; along x (vertical) they
  // need more room. Thin them to the available spacing per orientation.
  const minSpacing = horizontal ? theme.labelSize + 6 : 48;
  const step = Math.max(1, Math.ceil(C / Math.max(1, Math.floor(mainLen / minSpacing))));
  for (let i = 0; i < C; i++) {
    const bc = bandCenter(i);
    mainPositions.push(bc);
    const atTick = i % step === 0;
    if (spec.axisTicks && !compact && atTick && !spec.categoryHidden) {
      if (horizontal) axisLines.push({ x1: plot.x - TICK, y1: bc, x2: plot.x, y2: bc, color: theme.axisLineColor, width: 1 });
      else axisLines.push({ x1: bc, y1: yb, x2: bc, y2: yb + TICK, color: theme.axisLineColor, width: 1 });
    }
    if (spec.categoryHidden || spec.categoryHideTicks || compact || !atTick) continue;
    if (horizontal) {
      texts.push({ x: plot.x - 8 - lowEndRoom, y: bc, text: catLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, align: 'end', baseline: 'middle', key: `ct-${i}` });
      if (mirrorCats) {
        texts.push({ x: plot.x + plot.width + 8 + (spec.showLabels ? maxDataLabelW + 4 : 0), y: bc, text: catLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, align: 'start', baseline: 'middle', key: `ctm-${i}` });
      }
    } else if (catRot) {
      // Rotated about the label's own centre by the overlay, so the centre is
      // placed where the tilted box's END lands on the tick: step back along the
      // text direction by half its length, in both axes.
      const w = approxWidth(catLabels[i], theme.labelSize);
      const dir = catRot < 0 ? -1 : 1;
      texts.push({
        x: bc + (dir * w * Math.cos(catRotRad)) / 2,
        y: plot.y + plot.height + 6 + lowEndRoom + (w * Math.sin(catRotRad)) / 2,
        text: catLabels[i],
        color: theme.textColorMuted,
        fontSize: theme.labelSize,
        align: 'center',
        baseline: 'middle',
        rotate: catRot,
        key: `ct-${i}`,
      });
    } else {
      // Upright, a label may use the room up to its neighbouring SHOWN labels —
      // when the axis is thinned (every `step`-th band labelled), the skipped
      // bands between them are free, so a many-category axis isn't truncated to
      // its bare band width (…which turned "Day 1", "Day 2"… all into "D…").
      // step === 1 collapses to the old own-band width, so a variwide column's
      // name still can't run over its neighbours'.
      const nextC = i + step < C ? bandCenter(i + step) : bc + step * sizeAt(i);
      const prevC = i - step >= 0 ? bandCenter(i - step) : bc - step * sizeAt(i);
      const room = Math.min(nextC - bc, bc - prevC) - 6;
      texts.push({ x: bc, y: plot.y + plot.height + 6 + lowEndRoom, text: ellipsize(catLabels[i], room, theme.labelSize), color: theme.textColorMuted, fontSize: theme.labelSize, align: 'center', baseline: 'top', key: `ct-${i}` });
    }
  }

  // ── axis titles (gutters reserved above) — category runs along the main axis
  //    (x for vertical, y for horizontal), value along the cross axis ──
  if (!compact) {
    const catTitle = spec.categoryLabel;
    const valTitle = spec.valueLabel;
    if (horizontal) {
      // categories on y (left, rotated), values on x (bottom, centred)
      if (catTitle) texts.push({ x: 4, y: plot.y + plot.height / 2, text: catTitle, color: theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'top', rotate: -90, key: 'cat-axis-title' });
      if (valTitle) texts.push({ x: plot.x + plot.width / 2, y: height - 2 - legendBandBottom, text: valTitle, color: theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'bottom', key: 'val-axis-title' });
    } else {
      // values on y (left, rotated), categories on x (bottom, centred)
      if (valTitle) texts.push({ x: 4, y: plot.y + plot.height / 2, text: valTitle, color: theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'top', rotate: -90, key: 'val-axis-title' });
      if (catTitle) texts.push({ x: plot.x + plot.width / 2, y: height - 2 - legendBandBottom, text: catTitle, color: theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'bottom', key: 'cat-axis-title' });
    }
  }

  const legend: LegendItem[] =
    spec.legend === 'none' || compact ? [] : spec.series.map((s, si) => ({ label: s.label, color: s.color, seriesIndex: si, hidden: s.hidden, x: 0, y: 0 }));

  return {
    width,
    height,
    plot,
    background: theme.background === 'transparent' ? undefined : theme.background,
    gridlines,
    axisLines,
    areas: [],
    bars,
    slices: [],
    lines: [],
    markers: [],
    texts,
    barLabels,
    legend,
    legendPosition: spec.legend,
    xPositions: mainPositions,
    xValues: spec.categories,
    xLabels: catLabels,
    barBaseline: basePx,
    hoverPoints,
  };
}

/**
 * The polar form: one concentric RING per category, with the value axis running
 * as an angle instead of a length.
 *
 * It reuses everything above it — the same stacked bands, the same domain — and
 * only changes how a band becomes geometry: `[base, top]` becomes a pair of
 * angles rather than a pair of pixels, and the category index picks a radius
 * instead of a position along an axis. That keeps stacking, hiding a series
 * from the legend, and percentage normalisation working unchanged.
 *
 * The value axis deliberately spans less than the full circle. A ring that
 * closes on itself has no readable start or end, and the quarter it gives up is
 * where the category names go.
 */
function radialScene(
  spec: BarChartSpec,
  theme: EngineTheme,
  width: number,
  height: number,
  bands: ([number, number] | null | undefined)[][],
  vDomain: Domain,
  catLabels: string[],
  C: number,
): RenderScene {
  const texts: TextItem[] = [];
  const subtitleH = spec.subtitle ? theme.labelSize + 4 : 0;
  const titleH = spec.title ? theme.titleSize + 10 + subtitleH : 0;

  const legendActive = !!spec.legend && spec.legend !== 'none' && spec.series.length > 1;
  const legendAtBottom = legendActive && spec.legend!.startsWith('bottom');
  const legendTopRow = legendActive && !legendAtBottom && !(spec.legend === 'left' || spec.legend === 'right');
  const legendRows = legendActive ? estimateLegendRows(spec.series.map((s) => s.label), theme.labelSize, width * 0.86) : 1;
  const legendBandH = spec.legendExtent != null && (legendTopRow || legendAtBottom) ? spec.legendExtent + 8 : legendRows * (theme.labelSize + 8) + 6;
  const legendBandTop = legendTopRow ? legendBandH : 0;
  const legendBandBottom = legendAtBottom ? legendBandH : 0;

  // The names hang off the left of the circle, so they get a gutter of their
  // own — otherwise the rings are centred in the full width and the whole chart
  // reads as pushed to the right by however long the longest name is.
  const nameGutter =
    spec.categoryHidden || spec.categoryHideTicks
      ? 0
      : Math.max(0, ...catLabels.map((t) => approxWidth(t, theme.labelSize))) + 12;
  const plot: Rect = {
    x: nameGutter,
    y: titleH + legendBandTop,
    width: Math.max(1, width - nameGutter),
    height: Math.max(1, height - titleH - legendBandTop - legendBandBottom),
  };
  const cx = plot.x + plot.width / 2;
  const cy = plot.y + plot.height / 2;
  // The value axis wraps around the OUTSIDE as tick labels, so reserve a ring of
  // gutter for them before sizing the plot radius.
  const vFmt = spec.valueTickFormatter ?? spec.valueFormatter;
  const vTicks = spec.valueHidden || spec.valueHideTicks ? [] : sectionedTicks(vDomain, [], spec.valueScale, 8).filter((t) => t >= vDomain[0] - 1e-9 && t <= vDomain[1] + 1e-9);
  const vTickMaxW = Math.max(0, ...vTicks.map((t) => approxWidth(vFmt(t), theme.labelSize)));
  const valueGutter = vTicks.length ? vTickMaxW + 18 : 0;
  const R = Math.max(8, Math.min(plot.width, plot.height) / 2 - 8 - valueGutter);
  const hole = R * Math.max(0, Math.min(0.9, spec.polarHole ?? 0.22));
  const ring = C > 0 ? (R - hole) / C : R - hole;
  const thickness = Math.max(1, ring * (1 - spec.categoryGapRatio));

  const START = -Math.PI / 2; // 12 o'clock
  const sweep = 2 * Math.PI * Math.max(0.1, Math.min(1, spec.polarSweep ?? 0.75));
  const [lo, hi] = vDomain;
  const span = hi - lo || 1;
  const angleOf = (v: number) => START + ((v - lo) / span) * sweep;

  const slices: RenderScene['slices'] = [];
  const hoverPoints: HoverSeries[] = [];
  const midRadii: number[] = [];
  for (let i = 0; i < C; i++) {
    // Category 0 takes the OUTSIDE ring: a reader's eye lands on the outermost
    // band first, and the first category is the one the data leads with.
    const outerR = R - i * ring;
    midRadii.push(outerR - thickness / 2);
  }

  spec.series.forEach((s, si) => {
    if (s.hidden) return;
    const byIndex: Record<number, HoverPoint> = {};
    for (let i = 0; i < C; i++) {
      const band = bands[si][i];
      if (!band) continue;
      const outerR = R - i * ring;
      const innerR = outerR - thickness;
      const a0 = angleOf(band[0]);
      const a1 = angleOf(band[1]);
      if (Math.abs(a1 - a0) < 1e-6) continue;
      slices.push({
        cx,
        cy,
        innerR,
        outerR,
        startAngle: Math.min(a0, a1),
        endAngle: Math.max(a0, a1),
        color: s.pointColors?.[i] ?? s.color,
        dataIndex: i,
        seriesIndex: si,
        // A stroked band with flat internal joins; the ring's head + tail get a
        // round cap in the post-pass below, so stacked segments blend into one
        // band rather than each rounding its own corners into a split.
        pill: true,
        capStart: false,
        capEnd: false,
      });
      // The hover anchor is the middle of this segment's arc, so the tooltip
      // and its marker land ON the band rather than at the plot centre.
      const mid = (a0 + a1) / 2;
      const midR = (innerR + outerR) / 2;
      byIndex[i] = { x: cx + midR * Math.cos(mid), y: cy + midR * Math.sin(mid), value: typeof s.data?.[i] === 'number' ? (s.data[i] as number) : band[1] };
    }
    hoverPoints.push({ seriesIndex: si, color: s.color, label: s.label, byIndex, values: s.data ?? [] });
  });

  // Round only the OUTERMOST ends of each ring: the segment that opens the ring
  // gets a round head, the one that closes it a round tail; every internal join
  // stays flat so the colours blend into a single band.
  for (let i = 0; i < C; i++) {
    const ringSlices = slices.filter((s) => s.dataIndex === i);
    if (!ringSlices.length) continue;
    let first = ringSlices[0];
    let last = ringSlices[0];
    for (const s of ringSlices) {
      if (s.startAngle < first.startAngle) first = s;
      if (s.endAngle > last.endAngle) last = s;
    }
    first.capStart = true;
    last.capEnd = true;
  }

  // Value-axis scale wrapped around the outside: each tick sits at its own angle
  // just beyond the outermost ring, so the reader can trace a band back to a value.
  // Anchor each label by the EDGE facing the centre (via align/baseline chosen
  // from the tick's direction) so the gap to the ring is EVEN regardless of how
  // wide the number is — centring made a long number crowd the band while a short
  // one sat off it.
  const labelR = R + 16;
  for (const t of vTicks) {
    const a = angleOf(t);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    texts.push({
      x: cx + labelR * cos,
      y: cy + labelR * sin,
      text: vFmt(t),
      color: theme.textColorMuted,
      fontSize: theme.labelSize,
      align: cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'center',
      baseline: sin > 0.35 ? 'top' : sin < -0.35 ? 'bottom' : 'middle',
      key: `vt-${t}`,
    });
  }

  // Category names in the quarter the value axis gives up, each on its own
  // ring's centre line, right-aligned to the 12 o'clock radius they start at.
  if (!spec.categoryHidden && !spec.categoryHideTicks) {
    for (let i = 0; i < C; i++) {
      texts.push({
        // Clear of the bars: a band starts at 12 o'clock reaching left to
        // cx - thickness/2, so hold the name a gap short of that.
        x: cx - thickness / 2 - 12,
        y: cy - midRadii[i],
        text: catLabels[i],
        color: theme.textColorMuted,
        fontSize: theme.labelSize,
        align: 'end',
        baseline: 'middle',
        key: `ct-${i}`,
      });
    }
  }

  if (spec.title) {
    const tt = titlePlacement(spec.titleAlign, plot.x, plot.width);
    texts.push({ x: tt.x, y: legendBandTop + 6, text: spec.title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: 'top', key: 'title' });
    if (spec.subtitle) {
      texts.push({ x: tt.x, y: legendBandTop + 6 + theme.titleSize + 6, text: spec.subtitle, color: theme.textColorMuted, fontSize: theme.labelSize, align: tt.align, baseline: 'top', key: 'subtitle' });
    }
  }

  const legend: LegendItem[] =
    spec.legend === 'none' ? [] : spec.series.map((s, si) => ({ label: s.label, color: s.color, seriesIndex: si, hidden: s.hidden, x: 0, y: 0 }));

  return {
    width,
    height,
    plot,
    background: theme.background === 'transparent' ? undefined : theme.background,
    gridlines: [],
    axisLines: [],
    areas: [],
    bars: [],
    slices,
    lines: [],
    markers: [],
    texts,
    legend,
    legendPosition: spec.legend,
    polar: true,
    // Radii, not positions along an axis: the engine resolves a polar hover by
    // how far the pointer is from the centre, which is exactly which ring it is
    // over.
    xPositions: midRadii,
    xValues: spec.categories,
    xLabels: catLabels,
    hoverPoints,
  };
}
