/*
 * Chart engine — layout (spec → RenderScene)
 * ===========================================================
 * The brain: turns a resolved line-chart spec + theme + pixel
 * size into a backend-agnostic {@link RenderScene}. Owns axis
 * gutter sizing, scale + tick selection, series→polyline mapping
 * (via scale + geometry), gridlines, and text-item placement for
 * the DOM overlay. Pure — no DOM, no canvas — so it's unit-tested
 * on its numeric output.
 * ===========================================================
 */

import type { MdChartAnimation, MdChartAxisBreaks, MdChartAxisValue, MdChartCurve, MdChartDataPoint, MdChartLegendPosition, MdChartLineStyle, MdChartScaleType, MdChartStackMode, MdChartSymbol, MdChartTitleAlign } from '../types';
import {
  computeDomain,
  inBreak,
  logTicks,
  makeBrokenScale,
  makeCategoryScale,
  makeLinearScale,
  makeLogScale,
  niceLinearTicks,
  normalizeBreaks,
  resolveAxisBreaks,
  sectionedTicks,
  timeTicks,
  toNumeric,
  type BreakRange,
  type BrokenScale,
  type Scale,
} from './scale';
import { decimateMinMax, interpolate, splitRuns, stackSeries, type Pt, clampToRect } from './geometry';
import type { EndLabel, GlyphMarker, HoverPoint, HoverSeries, LegendItem, Rect, RenderScene, SceneArea, SceneBand, SceneBar, SceneMarker, ScenePolyline, SceneSegment, TextItem } from './scene';

export interface EngineTheme {
  background: string;
  textColor: string;
  textColorMuted: string;
  axisLineColor: string;
  gridLineColor: string;
  /** Surface colour — the interior fill for hollow (open) markers. */
  surface: string;
  fontFamily: string;
  labelSize: number;
  titleSize: number;
}

export interface LineSeriesSpec {
  label: string;
  /** Resolved CSS colour. */
  color: string;
  /**
   * Values aligned to `LineChartSpec.xValues`. `null` is a gap (breaks the
   * line unless `connectNulls`); `undefined` is a HOLE — a slot that exists
   * only because another series was sampled there, which the line bridges.
   * See `utils/charts/xy.ts`.
   */
  data: (MdChartDataPoint | undefined)[];
  /** `false` opts this series out of the area fill (a line over a band). */
  fill?: boolean;
  /** `false` draws no line for this series — fill only (streamgraphs). */
  stroke?: boolean;
  /**
   * Low/high band per row, aligned to `xValues`. When present the series is a
   * RANGE: it fills between the two edges instead of down to the baseline, is
   * left out of stacking (a band has no single value to stack), and is drawn
   * with no stroke so a line layered over it stays readable. `null` is a gap.
   */
  range?: ([number, number] | null | undefined)[];
  curve: MdChartCurve;
  connectNulls: boolean;
  showMarks: boolean;
  hidden: boolean;
  /** Marker for shown marks: a shape keyword, or an emoji/text glyph. Default circle. */
  symbol?: MdChartSymbol | (string & {});
  /** Per-index marker override (shape or emoji); shows even when marks are off. */
  pointSymbols?: Record<number, MdChartSymbol | string>;
  /** Draw markers only at these data indices (sparkline extremes/edges). */
  markIndices?: number[];
  /** Line style — `'dotted'` for average / reference lines. */
  dash?: 'solid' | 'dashed' | 'dotted';
  /** Index into `LineChartSpec.yAxes` this series is measured against (multi-axis
   *  charts). Out-of-range / omitted falls back to axis 0. */
  yAxisIndex?: number;
  /** Draw the line solid up to this data index, then dotted after it (a shared
   *  boundary point). For past-vs-forecast lines (the segment beyond "now"). */
  dashAfter?: number;
  /** Open (ring) markers — stroked in the series colour with a surface-filled
   *  centre — instead of filled dots. */
  hollow?: boolean;
  /** Stroke width of the line, in px. Default 2.5. */
  lineWidth?: number;
  /** Marker RADIUS in px. Overrides the per-symbol default (circle 3.5, square/
   *  diamond 4.2, triangle 4.6). */
  markSize?: number;
}

/** A vertical reference line drawn across the plot at an x position, with an
 *  optional label (e.g. "Current time"). */
export interface MarkLineSpec {
  /** X position — a value/time axis value, or a (possibly fractional) index on a
   *  category axis. */
  value: MdChartAxisValue;
  label?: string;
  /** Resolved colour. Default: the themed axis colour. */
  color?: string;
  dash?: 'solid' | 'dashed' | 'dotted';
}

/** One value (y) axis for a multi-axis chart. Each has its own domain, scale,
 *  ticks and formatter; axes stack outward from the plot on their side. */
export interface ValueAxisSpec {
  scale: MdChartScaleType;
  min?: number;
  max?: number;
  formatter: (v: number) => string;
  label?: string;
  /** Which side to stack on. Default: axis 0 → left, the rest → right. */
  position?: 'left' | 'right';
  hidden?: boolean;
  hideTicks?: boolean;
  /** Resolved colour for this axis' line/labels/title. Omitted → themed (matches
   *  the x-axis). */
  color?: string;
  /** Shaded ranges measured on this axis. */
  bands?: AxisBandSpec[];
  /** Stroke style for this axis' line + tick marks. Default solid. */
  dash?: MdChartLineStyle;
  /** Stroke style for the gridlines this axis draws (primary axis only, since
   *  one grid is shared). Default solid. */
  gridDash?: MdChartLineStyle;
}

/** A highlighted x-range band (sparkline reference areas). */
export interface RefBand {
  /** Start data index (category axis). */
  from: number;
  /** End data index. */
  to: number;
  /** Fill colour (already alpha-composited). */
  color: string;
}

/** A shaded value range on one axis, with an optional label inside it. */
export interface AxisBandSpec {
  /** Band start / end in axis values (a data index on a category axis). */
  from: MdChartAxisValue;
  to: MdChartAxisValue;
  /** Resolved fill colour. Omitted → a faint tint of the axis colour. */
  color?: string;
  label?: string;
  labelAlign?: 'start' | 'center' | 'end';
  /** Resolved label colour. Omitted → the muted text colour. */
  labelColor?: string;
}

export interface LineChartSpec {
  series: LineSeriesSpec[];
  title?: string;
  /** Sub-title, drawn under the title in the muted text colour. */
  subtitle?: string;
  /** Horizontal alignment of the title over the plot. Default 'start'. */
  titleAlign?: MdChartTitleAlign;
  /** Vertical reference lines drawn across the plot (e.g. a "current time" mark). */
  markLines?: MarkLineSpec[];
  xValues: MdChartAxisValue[];
  xScale: MdChartScaleType;
  xFormatter: (v: MdChartAxisValue) => string;
  xLabel?: string;
  xHidden?: boolean;
  xHideTicks?: boolean;
  /** Stroke style for the x axis' line + tick marks. Default solid. */
  xDash?: MdChartLineStyle;
  /** Stroke style for the vertical gridlines the x ticks draw. Default solid. */
  xGridDash?: MdChartLineStyle;
  yScale: MdChartScaleType;
  yMin?: number;
  yMax?: number;
  /** Formats y VALUES — tooltip rows, data labels, and (unless
   *  `yTickFormatter` overrides it) the axis ticks. */
  yFormatter: (v: number) => string;
  /** Formats the y AXIS tick labels only, so an axis can read `15` while the
   *  tooltip reads `15 m/s`. Falls back to `yFormatter`. */
  yTickFormatter?: (v: number) => string;
  yLabel?: string;
  yHidden?: boolean;
  yHideTicks?: boolean;
  /** Stroke style for the y axis' line + tick marks. Default solid. */
  yDash?: MdChartLineStyle;
  /** Stroke style for the horizontal gridlines the y ticks draw. Default solid. */
  yGridDash?: MdChartLineStyle;
  yReverse?: boolean;
  /** Multiple independent value axes. When present (non-empty), each series is
   *  measured against `yAxes[series.yAxisIndex ?? 0]` and the axes stack outward
   *  on their side. Supersedes the single-axis `y*` fields. */
  yAxes?: ValueAxisSpec[];
  stack: MdChartStackMode;
  area: boolean;
  /** Area-fill top-stop opacity (0..1). Default 0.35. */
  fillOpacity?: number;
  /** Legend anchor, or `'none'` to hide it. */
  legend?: MdChartLegendPosition | 'none';
  /**
   * Measured legend extent in px (height for top/bottom, width for left/right).
   * The engine fills this in on a second pass so a wrapped multi-row legend
   * reserves its real size instead of the first-pass estimate.
   */
  legendExtent?: number;
  /** Sparkline mode: edge-to-edge, no axes / grid / title / legend. */
  compact?: boolean;
  /** Highlighted x-range bands (sparkline reference areas). */
  refBands?: RefBand[];
  /** Shaded ranges on the x axis (vertical bands across the plot). */
  xBands?: AxisBandSpec[];
  /** Ranges cut out of the x axis. */
  xBreaks?: MdChartAxisBreaks;
  /** Ranges cut out of the single y axis. Multi-axis charts break per axis. */
  yBreaks?: MdChartAxisBreaks;
  /** Shaded ranges on the single y axis (horizontal bands across the plot).
   *  Multi-axis charts declare bands per axis on {@link ValueAxisSpec}. */
  yBands?: AxisBandSpec[];
  /** Horizontal gridlines (at y ticks). Default true. */
  gridY?: boolean;
  /** Vertical gridlines (at x ticks). Default false. */
  gridX?: boolean;
  /** Small perpendicular tick marks on the x/y axes. Default false. */
  axisTicks?: boolean;
  /** Print each point's value as a data label beside the marker. Default false. */
  showLabels?: boolean;
  /** Label each series at its last point (a marker + the series name), so the
   *  name follows the end of the line — for racing / progression charts. */
  seriesLabels?: boolean;
  /** Transpose the axes: the independent axis (xValues) runs vertically and the
   *  value axis horizontally — a spline that's a function of the vertical axis
   *  (e.g. temperature by altitude). */
  inverted?: boolean;
  /** Entry-animation variant played on first render. Default 'expressive'. */
  animation?: MdChartAnimation;
  /** Entry-animation duration override (ms); ≤ 0 disables. */
  animationDuration?: number;
  /** Legacy on/off flag (pre-variant). `false` → no animation. */
  animate?: boolean;
}

/** Whether a hover dot has anything to sit on: a drawn line, or markers. */
function hasAnchor(s: LineSeriesSpec): boolean {
  const strokes = !s.range && s.stroke !== false;
  const marks = s.showMarks || !!s.markIndices?.length || !!s.pointSymbols;
  return strokes || marks;
}

/** Length (px) of the perpendicular axis tick marks. */
const AXIS_TICK_LEN = 5;

/** Rough text width without a canvas — good enough for gutter sizing. */
function approxWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

/** Estimate how many rows a horizontal (top/bottom) legend wraps into, so the
 *  reserved band grows with the series count instead of overflowing the plot. */
export function estimateLegendRows(labels: string[], fontSize: number, availW: number): number {
  let rows = 1;
  let rowW = 0;
  for (const label of labels) {
    const iw = approxWidth(label, fontSize) + 28; // swatch + gaps + chip padding
    if (rowW > 0 && rowW + iw > availW) {
      rows++;
      rowW = iw;
    } else {
      rowW += iw;
    }
  }
  return rows;
}

/** Map a line style to a px on/off dash pattern (round-capped). */
export function dashPattern(dash: MdChartLineStyle | undefined, width = 1): number[] | undefined {
  if (dash === 'dashed') return [width * 3.5, width * 3];
  if (dash === 'dotted') return [Math.max(1, width * 0.4), width * 2.6];
  return undefined;
}

/** The break tear's shape: a smooth sine wave, not a hard sawtooth. */
const BREAK_WAVE_LEN = 30; // wavelength (px) — one full undulation
const BREAK_WAVE_STEP = 3; // polyline sampling step (px); small → the sine reads smooth, not faceted
const BREAK_WAVE_AMP = 4; // half the wave's height (px), clamped to the gap

/**
 * The break drawn ACROSS the whole plot, not just as a mark on the axis: a
 * smooth wave "tear" spanning the plot at the cut, so the discontinuity reads
 * over the bars themselves. For a y-axis break (a vertical chart) it runs
 * horizontally through the gap; for an x-axis break (a horizontal chart) it runs
 * vertically. A sine — not a sawtooth — so it reads as a soft, deliberate seam
 * (Material) rather than a jagged technical mark.
 *
 * `gapLo`/`gapHi` are the near/far pixel edges of the cut ON the value axis;
 * `spanFrom`/`spanTo` bound the OTHER axis (the plot's width for a horizontal
 * tear, its height for a vertical one). The wave undulates about the gap's centre
 * so it sits in the empty seam the split bars leave. Emitted as many short
 * segments; `renderScene` strokes each, and on a gentle curve the butt-cap joints
 * are sub-pixel, so it reads as one continuous wave.
 */
export function breakBandSegments(
  axis: 'x' | 'y',
  gapLo: number,
  gapHi: number,
  spanFrom: number,
  spanTo: number,
  color: string,
): SceneSegment[] {
  const segs: SceneSegment[] = [];
  const len = spanTo - spanFrom;
  if (len <= 0) return segs;
  const mid = (gapLo + gapHi) / 2;
  const amp = Math.min(BREAK_WAVE_AMP, (gapHi - gapLo) / 2);
  const n = Math.max(4, Math.round(len / BREAK_WAVE_STEP));
  // Sample the sine at each step; `off` is the perpendicular offset from the
  // gap centre, `p` the position along the span.
  const at = (i: number) => {
    const p = spanFrom + (len * i) / n;
    return { p, off: mid + amp * Math.sin((p / BREAK_WAVE_LEN) * Math.PI * 2) };
  };
  let prev = at(0);
  for (let i = 1; i <= n; i++) {
    const cur = at(i);
    segs.push(
      axis === 'y'
        ? { x1: prev.p, y1: prev.off, x2: cur.p, y2: cur.off, color, width: 1.5 }
        : { x1: prev.off, y1: prev.p, x2: cur.off, y2: cur.p, color, width: 1.5 },
    );
    prev = cur;
  }
  return segs;
}

/**
 * An axis line split around its cuts — one segment per surviving section, so
 * the line is visibly interrupted where the scale jumps.
 */
export function axisLineWithBreaks(
  axis: 'x' | 'y',
  from: number,
  to: number,
  along: number,
  breaks: readonly { px: number; gap: number }[],
  color: string,
  dash?: number[],
): SceneSegment[] {
  const segs: SceneSegment[] = [];
  let cursor = from;
  const seg = (a: number, b: number): SceneSegment =>
    axis === 'y'
      ? { x1: along, y1: a, x2: along, y2: b, color, width: 1, dash }
      : { x1: a, y1: along, x2: b, y2: along, color, width: 1, dash };
  for (const b of breaks) {
    const start = from + b.px;
    if (start > cursor) segs.push(seg(cursor, start));
    cursor = start + b.gap;
  }
  if (to > cursor) segs.push(seg(cursor, to));
  return segs;
}

/** Inset of a band's label from the band's near edge, in px. */
const BAND_LABEL_PAD = 8;

/**
 * Band rects + their labels for one axis.
 *
 * `toPx` maps an axis value to its pixel on that axis; `plot` bounds the
 * result, so a band that runs off the visible domain is clipped to the plot
 * rather than painted outside it. Bands whose range falls entirely outside are
 * dropped. Horizontal bands (a y axis) span the plot's width and vice versa.
 */
function buildAxisBands(
  bands: AxisBandSpec[] | undefined,
  axis: 'x' | 'y',
  toPx: (value: MdChartAxisValue) => number,
  plot: Rect,
  theme: EngineTheme,
  keyPrefix: string,
): { rects: SceneBand[]; labels: TextItem[] } {
  const rects: SceneBand[] = [];
  const labels: TextItem[] = [];
  if (!bands?.length) return { rects, labels };
  const horizontal = axis === 'y';
  const lo = horizontal ? plot.y : plot.x;
  const hi = horizontal ? plot.y + plot.height : plot.x + plot.width;

  bands.forEach((b, i) => {
    const a = toPx(b.from);
    const z = toPx(b.to);
    if (!Number.isFinite(a) || !Number.isFinite(z)) return;
    const start = Math.max(lo, Math.min(a, z));
    const end = Math.min(hi, Math.max(a, z));
    if (end <= start) return; // entirely outside the visible domain
    const color = b.color ?? hexToRgba(theme.axisLineColor, 0.07);
    rects.push(
      horizontal
        ? { x: plot.x, y: start, w: plot.width, h: end - start, color }
        : { x: start, y: plot.y, w: end - start, h: plot.height, color },
    );
    if (!b.label) return;
    const align = b.labelAlign ?? 'start';
    // Along the band: start / centre / end of the plot's other axis.
    const along =
      align === 'center'
        ? (horizontal ? plot.x + plot.width / 2 : plot.y + plot.height / 2)
        : align === 'end'
          ? (horizontal ? plot.x + plot.width - BAND_LABEL_PAD : plot.y + plot.height - BAND_LABEL_PAD)
          : (horizontal ? plot.x + BAND_LABEL_PAD : plot.y + BAND_LABEL_PAD);
    labels.push({
      x: horizontal ? along : start + BAND_LABEL_PAD,
      y: horizontal ? start + BAND_LABEL_PAD : along,
      text: b.label,
      color: b.labelColor ?? theme.textColorMuted,
      fontSize: theme.labelSize,
      align: horizontal ? (align === 'center' ? 'center' : align) : 'start',
      baseline: horizontal ? 'top' : align === 'center' ? 'middle' : align === 'end' ? 'bottom' : 'top',
      key: `${keyPrefix}-${i}`,
    });
  });
  return { rects, labels };
}

function hexToRgba(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb(')) return color.replace(/^rgb\(/, 'rgba(').replace(/\)$/, `, ${alpha})`);
  return color;
}

export function computeLayout(spec: LineChartSpec, theme: EngineTheme, width: number, height: number): RenderScene {
  if (spec.inverted) return computeInvertedLayout(spec, theme, width, height);
  if (spec.yAxes && spec.yAxes.length > 0) return computeMultiAxisLayout(spec, theme, width, height);
  const visible = spec.series.filter((s) => !s.hidden);
  const rows = spec.xValues.length || Math.max(0, ...spec.series.map((s) => s.data.length));

  // ── stacked bands → the value extent that drives the y domain ──
  // A range series carries its own band, so it is excluded from the stack: it
  // has no single value to add to a column, and letting its `high` land in the
  // totals would push every stacked layer above it up by the band's top edge.
  const stackKeys = spec.series.map((s) => (spec.stack !== 'none' && !s.range ? 'stacked' : '__unstacked__'));
  // Hidden series contribute empty data so they don't reserve a band — otherwise
  // a visible series above a toggled-off one keeps a gap and the domain (which
  // excludes hidden series) disagrees with the stack offsets.
  const bands = stackSeries(
    spec.series.map((s) => (s.hidden ? [] : s.data)),
    spec.stack,
    stackKeys,
  );
  // A range series' band IS its data — substitute it before the domain is taken
  // below, so the axis covers both edges rather than just the drawn top.
  spec.series.forEach((s, si) => {
    if (!s.range || s.hidden) return;
    bands[si] = s.range.map((r) => (r ? ([Math.min(r[0], r[1]), Math.max(r[0], r[1])] as [number, number]) : r));
  });
  const yVals: number[] = [];
  spec.series.forEach((s, si) => {
    if (s.hidden) return;
    bands[si].forEach((b) => {
      if (b) {
        yVals.push(b[0], b[1]);
      }
    });
  });

  const yDomain = computeDomain(yVals, {
    min: spec.yMin,
    max: spec.yMax,
    scale: spec.yScale,
    includeZero: spec.stack !== 'none' || spec.yScale === 'value',
  });

  // ── axis breaks (resolved before ticks so cut-out ticks never render) ──
  const xNums = spec.xValues.map((v) => toNumeric(v, spec.xScale));
  const xDomain = computeDomain(xNums, { scale: spec.xScale });
  // Sparklines are deliberately chrome-free — no break marks to read, so no cuts.
  const noBreaks = { ranges: [] as BreakRange[], sizing: 'equal' as const };
  const yFound = spec.compact ? noBreaks : resolveAxisBreaks(spec.yBreaks, yVals, spec.yScale);
  const xFound =
    spec.compact || spec.xScale === 'category' ? noBreaks : resolveAxisBreaks(spec.xBreaks, xNums, spec.xScale);
  // Detection runs on the DATA; the axis then rejects the cuts its domain can't
  // take (one starting at the very bottom would just shift the axis up). Settle
  // that here, once, so the ticks, the gridlines, the split runs and the scale
  // all work from the same set — a cut the scale drops used to keep sectioning
  // the ticks, which ruled one band and left the rest of the axis bare.
  const yBreaks = { ...yFound, ranges: normalizeBreaks(yFound.ranges, yDomain) };
  const xBreaks = { ...xFound, ranges: normalizeBreaks(xFound.ranges, xDomain) };

  // ── y ticks + gutter sizing (need widest y label to inset left) ──
  const yTickVals = sectionedTicks(yDomain, yBreaks.ranges, spec.yScale, 6).filter(
    (t) => !inBreak(yBreaks.ranges, t),
  );
  const yTickLabels = yTickVals.map((v) => (spec.yTickFormatter ?? spec.yFormatter)(v));
  const maxYLabelW = spec.yHidden || spec.yHideTicks ? 0 : Math.max(0, ...yTickLabels.map((t) => approxWidth(t, theme.labelSize)));

  const subtitleH = spec.subtitle ? theme.labelSize + 4 : 0;
  const titleH = spec.title ? theme.titleSize + 10 + subtitleH : 0;
  const xLabelH = spec.xHidden || spec.xHideTicks ? 0 : theme.labelSize + 8;
  const yAxisLabelW = spec.yLabel ? theme.labelSize + 6 : 0;
  const xAxisLabelH = spec.xLabel ? theme.labelSize + 6 : 0;

  // A top/bottom legend gets a reserved band; a left/right legend gets a
  // reserved side gutter (its column is a vertically-centred list) so it never
  // overlaps the plot or the y-axis labels.
  const legendActive = !!spec.legend && spec.legend !== 'none' && spec.series.length > 1;
  const legendSide = legendActive && (spec.legend === 'left' || spec.legend === 'right');
  const legendAtBottom = legendActive && !legendSide && spec.legend!.startsWith('bottom');
  const legendTopRow = legendActive && !legendSide && !legendAtBottom;
  // A horizontal legend wraps into as many rows as the labels need — reserve
  // that height so many-series legends don't spill onto the plot.
  const legendRows = legendTopRow || legendAtBottom ? estimateLegendRows(spec.series.map((s) => s.label), theme.labelSize, width * 0.86) : 1;
  // Second-pass measured extent wins over the first-pass estimate.
  const legendBandH = spec.legendExtent != null && (legendTopRow || legendAtBottom) ? spec.legendExtent + 8 : legendRows * (theme.labelSize + 8) + 6;
  const legendBandTop = legendTopRow ? legendBandH : 0;
  const legendBandBottom = legendAtBottom ? legendBandH : 0;
  const legendSideW = legendSide ? (spec.legendExtent != null ? spec.legendExtent + 16 : Math.max(0, ...spec.series.map((s) => approxWidth(s.label, theme.labelSize))) + 34) : 0;
  // Room on the right for end-of-line series-name labels.
  const seriesLabelW = spec.seriesLabels ? Math.max(0, ...spec.series.filter((s) => !s.hidden).map((s) => approxWidth(s.label, theme.labelSize))) + 20 : 0;

  // Sparkline mode fills its host edge-to-edge — no gutters for chrome. But a
  // marker at the first / last / extreme point sits ON that edge, and its radius
  // spills past it and is CLIPPED. Reserve the widest drawn marker's radius (+1px)
  // so the dots stay whole; with no markers it stays the tight 2px.
  const compact = !!spec.compact;
  const markPad = compact
    ? Math.max(
        2,
        ...spec.series
          .filter((s) => !s.hidden && (s.showMarks || (s.markIndices?.length ?? 0) > 0 || s.pointSymbols))
          .map((s) => markerRadius(s.symbol as MdChartSymbol | undefined, s.markSize) + 2),
      )
    : 0;
  const padTop = compact ? markPad : titleH + 8 + legendBandTop;
  const padRight = compact ? markPad : 12 + approxWidth(yTickLabels[yTickLabels.length - 1] ?? '', theme.labelSize) / 2 + (spec.legend === 'right' ? legendSideW : 0) + seriesLabelW;
  const padBottom = compact ? markPad : xLabelH + xAxisLabelH + 6 + legendBandBottom;
  const padLeft = compact ? markPad : maxYLabelW + 10 + yAxisLabelW + (spec.legend === 'left' ? legendSideW : 0);

  const plot = {
    x: padLeft,
    y: padTop,
    width: Math.max(1, width - padLeft - padRight),
    height: Math.max(1, height - padTop - padBottom),
  };

  // ── scales (break-aware: a cut costs its gap in px, not its true width) ──
  const x: Scale =
    spec.xScale === 'category'
      ? makeCategoryScale(rows, plot.width, true)
      : makeBrokenScale(xDomain, plot.width, spec.xScale, xBreaks.ranges, xBreaks.sizing);
  const y: Scale = makeBrokenScale(yDomain, plot.height, spec.yScale, yBreaks.ranges, yBreaks.sizing);

  // Data value → pixel Y within the plot (top-origin: bigger value = higher = smaller y).
  const toPxY = (v: number) => plot.y + plot.height - y.scale(v);
  const toPxX = (i: number) =>
    plot.x + (spec.xScale === 'category' ? x.scale(i) : x.scale(toNumeric(spec.xValues[i], spec.xScale)));

  // ── axis bands (behind everything; their labels join the text overlay) ──
  // Named `axisBands` because `bands` below is the stacked-value bands.
  const bandLabels: TextItem[] = [];
  const axisBands: SceneBand[] = [];
  if (!compact) {
    const onY = buildAxisBands(spec.yBands, 'y', (v) => toPxY(toNumeric(v, spec.yScale)), plot, theme, 'yband');
    const onX = buildAxisBands(
      spec.xBands,
      'x',
      (v) => plot.x + x.scale(spec.xScale === 'category' ? Number(v) : toNumeric(v, spec.xScale)),
      plot,
      theme,
      'xband',
    );
    axisBands.push(...onY.rects, ...onX.rects);
    bandLabels.push(...onY.labels, ...onX.labels);
  }

  const gridlines: SceneSegment[] = [];
  const axisLines: SceneSegment[] = [];
  // Chrome stroke styles — solid unless the axis asked for dashed/dotted. The
  // break mark stays solid either way: it is a symbol, not a line.
  const yGridDash = dashPattern(spec.yGridDash, 1);
  const xGridDash = dashPattern(spec.xGridDash, 1);
  const yAxisDash = dashPattern(spec.yDash, 1);
  const xAxisDash = dashPattern(spec.xDash, 1);
  if (!spec.yHidden && !compact) {
    for (const t of yTickVals) {
      const py = toPxY(t);
      if (spec.gridY !== false) {
        gridlines.push({ x1: plot.x, y1: py, x2: plot.x + plot.width, y2: py, color: theme.gridLineColor, width: 1, dash: yGridDash });
      }
      if (spec.axisTicks) {
        axisLines.push({ x1: plot.x - AXIS_TICK_LEN, y1: py, x2: plot.x, y2: py, color: theme.axisLineColor, width: 1, dash: yAxisDash });
      }
    }
    // The y axis runs bottom-up in data space, so a cut at scale-offset `px`
    // sits `px` above the plot's bottom edge.
    const yCuts = ((y as BrokenScale).breaks ?? []).map((b) => ({ px: plot.height - b.px - b.gap, gap: b.gap }));
    axisLines.push(
      ...axisLineWithBreaks('y', plot.y, plot.y + plot.height, plot.x, yCuts, theme.axisLineColor, yAxisDash),
    );
    // The tear runs HORIZONTALLY across the whole plot width at the y cut.
    for (const c of yCuts) {
      axisLines.push(...breakBandSegments('y', plot.y + c.px, plot.y + c.px + c.gap, plot.x, plot.x + plot.width, theme.axisLineColor));
    }
  }
  if (!spec.xHidden && !compact) {
    const yb = plot.y + plot.height;
    const xCuts = ((x as BrokenScale).breaks ?? []).map((b) => ({ px: b.px, gap: b.gap }));
    axisLines.push(...axisLineWithBreaks('x', plot.x, plot.x + plot.width, yb, xCuts, theme.axisLineColor, xAxisDash));
    // The tear runs VERTICALLY up the whole plot height at the x cut.
    for (const c of xCuts) {
      axisLines.push(...breakBandSegments('x', plot.x + c.px, plot.x + c.px + c.gap, plot.y, plot.y + plot.height, theme.axisLineColor));
    }
  }

  // ── series → polylines / areas / markers ──
  const lines: ScenePolyline[] = [];
  const areas: SceneArea[] = [];
  const markers: SceneMarker[] = [];
  const glyphs: GlyphMarker[] = [];
  const endLabelCands: EndLabel[] = [];
  const hoverPoints: HoverSeries[] = [];
  const baselineY = toPxY(Math.max(yDomain[0], 0));

  /**
   * A cut has no coordinates, so nothing may be drawn across it: split a run
   * wherever consecutive points sit on opposite sides of a break (or one of
   * them lands inside it, in which case that point is dropped entirely).
   */
  const splitAtBreaks = (run: { index: number; value: number }[]) => {
    if (!yBreaks.ranges.length && !xBreaks.ranges.length) return [run];
    const out: { index: number; value: number }[][] = [];
    let current: { index: number; value: number }[] = [];
    let prevSection = '';
    for (const pt of run) {
      const xv = xNums[pt.index];
      if (inBreak(yBreaks.ranges, pt.value) || (xv !== undefined && inBreak(xBreaks.ranges, xv))) {
        if (current.length) out.push(current);
        current = [];
        prevSection = '';
        continue;
      }
      // Which section of each axis this point falls in; a change means the
      // pair straddles a cut.
      const section =
        yBreaks.ranges.filter((b) => pt.value >= b.to).length +
        ':' +
        xBreaks.ranges.filter((b) => xv !== undefined && xv >= b.to).length;
      if (prevSection && section !== prevSection && current.length) {
        out.push(current);
        current = [];
      }
      prevSection = section;
      current.push(pt);
    }
    if (current.length) out.push(current);
    return out;
  };

  spec.series.forEach((s, si) => {
    if (s.hidden) return;
    const runs = splitRuns(
      // A hole stays a hole (the line bridges it); a null band is a real gap.
      bands[si].map((b) => (b === undefined ? undefined : b ? b[1] : null)),
      s.connectNulls,
    ).flatMap(splitAtBreaks);
    const byIndex: Record<number, HoverPoint> = {};
    let endPt: Pt | undefined;
    for (const run of runs) {
      if (!run.length) continue;
      const raw: Pt[] = run.map((r) => ({ x: toPxX(r.index), y: toPxY(r.value) }));
      endPt = raw[raw.length - 1];
      run.forEach((r, k) => {
        // Tooltip shows the RAW datum; y follows the drawn (stacked) top. The
        // hover highlight mirrors the point's marker (per-point override, else
        // the series symbol, else a circle) instead of always a circle.
        const hoverSym = s.pointSymbols?.[r.index] ?? (s.symbol && s.symbol !== 'none' ? s.symbol : 'circle');
        const band = s.range ? (bands[si][r.index] as [number, number] | null | undefined) : undefined;
        byIndex[r.index] = {
          x: raw[k].x,
          y: raw[k].y,
          value: (s.data[r.index] as number) ?? r.value,
          symbol: hoverSym,
          // Both edges, so the tooltip reads the band rather than only its top.
          ...(band ? { low: band[0], high: band[1] } : {}),
        };
      });
      const poly = clampToRect(interpolate(decimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height);
      // `dashAfter`: draw solid up to the boundary index, dotted after it (the
      // boundary point is shared), for past-vs-forecast lines.
      const splitAt = s.dashAfter != null ? run.findIndex((r) => r.index >= s.dashAfter!) : -1;
      const lw = s.lineWidth ?? 2.5;
      // A range series is a band, not a line: stroking its top edge would read
      // as the series' value, which is exactly what a range does not have.
      if (s.range || s.stroke === false) {
        /* fill only — a range band has no single value to trace, and a
           streamgraph layer has no meaningful top edge on a free baseline */
      } else if (splitAt > 0 && splitAt < run.length) {
        lines.push({ points: clampToRect(interpolate(decimateMinMax(raw.slice(0, splitAt + 1), plot.width), s.curve), plot.x, plot.y, plot.width, plot.height), color: s.color, width: lw, dash: dashPattern(s.dash, lw), seriesIndex: si });
        lines.push({ points: clampToRect(interpolate(decimateMinMax(raw.slice(splitAt), plot.width), s.curve), plot.x, plot.y, plot.width, plot.height), color: s.color, width: lw, dash: dashPattern('dotted', lw), seriesIndex: si });
      } else if (splitAt === 0) {
        lines.push({ points: poly, color: s.color, width: lw, dash: dashPattern('dotted', lw), seriesIndex: si });
      } else {
        lines.push({ points: poly, color: s.color, width: lw, dash: dashPattern(s.dash, lw), seriesIndex: si });
      }
      if (spec.area && s.fill !== false) {
        const fo = spec.fillOpacity ?? 0.35;
        // Stacked layers and range bands fill only their own band (top → base);
        // overlapping (unstacked) areas fill down to the global zero line.
        const basePoints =
          spec.stack !== 'none' || s.range
            ? clampToRect(
                interpolate(
                  run.map((r) => ({ x: toPxX(r.index), y: toPxY((bands[si][r.index] as [number, number])[0]) })),
                  s.curve,
                ),
                plot.x,
                plot.y,
                plot.width,
                plot.height,
              )
            : undefined;
        areas.push({
          points: poly,
          baselineY,
          colorTop: hexToRgba(s.color, fo),
          // A BAND — a stacked layer or a range — is read as one solid extent,
          // so it keeps an even tint. The fade-to-nothing gradient belongs only
          // to a fill that runs to the baseline, where it stops the fill from
          // competing with the axis; inside a stack it just makes every layer
          // bleed into the one below and the bands stop reading as separate.
          colorBottom: basePoints ? hexToRgba(s.color, fo) : hexToRgba(s.color, Math.max(0.02, fo * 0.06)),
          basePoints,
          seriesIndex: si,
        });
      }
      // Markers: an explicit per-point override (shape or emoji) always shows;
      // otherwise the series symbol shows where marks are enabled. Emoji / text
      // symbols route to the DOM glyph overlay, which can draw a glyph.
      const markSet = s.markIndices ? new Set(s.markIndices) : null;
      run.forEach((r, k) => {
        const idx = r.index;
        const override = s.pointSymbols?.[idx];
        const showDefault = markSet ? markSet.has(idx) : s.showMarks;
        const sym = override ?? (showDefault ? s.symbol ?? 'circle' : undefined);
        if (!sym || sym === 'none') return;
        const pt = raw[k];
        if (isShapeSymbol(sym)) {
          markers.push({ x: pt.x, y: pt.y, r: markerRadius(sym, s.markSize), color: s.color, symbol: sym, seriesIndex: si, hollow: s.hollow, fill: s.hollow ? theme.surface : undefined });
        } else {
          glyphs.push({ x: pt.x, y: pt.y, text: sym, size: GLYPH_SIZE });
        }
      });
      // Data labels — each point's value just above its marker. Routed through
      // the glyph layer (not the static text overlay) so they lift / reveal /
      // fade WITH the point during the intro animation.
      if (spec.showLabels && !compact) {
        run.forEach((r, k) => {
          // Above the point by default, FLIPPED below when there is no room for
          // it there. The topmost point sits on the plot's ceiling, so a label
          // hung above it lands outside the plot and collides with the title —
          // nothing reserves headroom for these, so the label gives way.
          const above = raw[k].y - 9 - theme.labelSize >= plot.y;
          glyphs.push({
            x: raw[k].x,
            y: raw[k].y,
            text: spec.yFormatter((s.data[r.index] as number) ?? r.value),
            size: theme.labelSize,
            label: {
              color: theme.textColor,
              weight: 600,
              dx: 0,
              dy: above ? -9 : 9,
              anchorX: '-50%',
              anchorY: above ? '-100%' : '0',
            },
          });
        });
      }
    }
    // End-of-line series label — a marker (always) + the series name at the last
    // point. The name is collision-managed below so stacked ends don't overlap.
    if (spec.seriesLabels && endPt && !compact) {
      markers.push({ x: endPt.x, y: endPt.y, r: 4, color: s.color, symbol: 'circle', seriesIndex: si });
      endLabelCands.push({ key: `sl-${si}`, x: endPt.x, y: endPt.y, text: s.label, color: theme.textColor, size: theme.labelSize + 1, visible: true });
    }
    hoverPoints.push({ seriesIndex: si, color: s.color, label: s.label, byIndex, values: s.data, unanchored: !hasAnchor(s) });
  });

  // Hide end labels that would overlap a higher one (greedy top-down) so they
  // fade out when the line ends cluster and back in as they fan apart.
  if (endLabelCands.length > 1) {
    const minGap = theme.labelSize + 5;
    let lastY = -Infinity;
    for (const c of [...endLabelCands].sort((a, b) => a.y - b.y)) {
      c.visible = c.y - lastY >= minGap;
      if (c.visible) lastY = c.y;
    }
  }

  // ── reference bands (sparkline highlight windows) → translucent rects ──
  const bars: SceneBar[] = [];
  if (spec.refBands) {
    for (const b of spec.refBands) {
      const bx1 = toPxX(b.from);
      const bx2 = toPxX(b.to);
      const bx = Math.min(bx1, bx2);
      const bw = Math.abs(bx2 - bx1);
      if (bw <= 0) continue;
      bars.push({ x: bx, y: plot.y, w: bw, h: plot.height, color: b.color, radius: [0, 0, 0, 0], seriesIndex: -1, dataIndex: -1 });
    }
  }

  // ── overlay text items ──
  // Band labels lead, so a tick label drawn at the same spot wins the overlay.
  const texts: TextItem[] = [...bandLabels];
  if (spec.title && !compact) {
    const tt = titlePlacement(spec.titleAlign, plot.x, plot.width);
    texts.push({
      x: tt.x,
      y: legendBandTop + 6,
      text: spec.title,
      color: theme.textColor,
      fontSize: theme.titleSize,
      fontWeight: 600,
      align: tt.align,
      baseline: 'top',
      key: 'title',
    });
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
  // ── mark lines (vertical reference lines, e.g. "current time") ──
  if (spec.markLines && !compact) {
    for (const ml of spec.markLines) {
      const mv = spec.xScale === 'category' ? Number(ml.value) : toNumeric(ml.value, spec.xScale);
      const px = plot.x + x.scale(mv);
      if (!Number.isFinite(px) || px < plot.x - 1 || px > plot.x + plot.width + 1) continue;
      gridlines.push({ x1: px, y1: plot.y, x2: px, y2: plot.y + plot.height, color: ml.color ?? theme.axisLineColor, width: 1.5, dash: dashPattern(ml.dash ?? 'dashed', 1.5) });
      if (ml.label) {
        texts.push({ x: px + 4, y: plot.y + 2, text: ml.label, color: theme.textColorMuted, fontSize: theme.labelSize, align: 'start', baseline: 'top', key: `markline-${Math.round(px)}` });
      }
    }
  }
  if (!spec.yHidden && !spec.yHideTicks && !compact) {
    yTickVals.forEach((t, i) => {
      texts.push({
        x: plot.x - 8,
        y: toPxY(t),
        text: yTickLabels[i],
        color: theme.textColorMuted,
        fontSize: theme.labelSize,
        align: 'end',
        baseline: 'middle',
        key: `yt-${i}`,
      });
    });
  }
  // xPositions always populate (hover/click hit-testing needs them, even in
  // compact sparkline mode); only the tick *labels* are chrome we can skip.
  const xPositions: number[] = [];
  for (let i = 0; i < rows; i++) xPositions.push(toPxX(i));

  // Tick anchors: a category axis labels its points (thinned to fit), while a
  // value / log / time axis labels nice round values — so a dense or irregularly
  // sampled axis prints ~one label per 90px instead of one per data point.
  const xAnchors: { px: number; text: string; key: string }[] = [];
  if (spec.xScale === 'category') {
    const step = Math.max(1, Math.ceil(rows / Math.max(1, Math.floor(plot.width / 60))));
    for (let i = 0; i < rows; i += step) {
      xAnchors.push({ px: xPositions[i], text: spec.xFormatter(spec.xValues[i] ?? i), key: `xt-${i}` });
    }
  } else if (rows) {
    const xd = computeDomain(xNums, { scale: spec.xScale });
    const target = Math.max(2, Math.floor(plot.width / 90));
    const xTicks = sectionedTicks(xd, xBreaks.ranges, spec.xScale, target).filter(
      (t) => !inBreak(xBreaks.ranges, t),
    );
    for (const tv of xTicks) {
      const px = plot.x + x.scale(tv);
      if (px < plot.x - 1 || px > plot.x + plot.width + 1) continue;
      // Format with the ORIGINAL typed value: a time axis needs a Date, not the
      // raw epoch number (a Date formatter would otherwise throw).
      xAnchors.push({ px, text: spec.xFormatter(spec.xScale === 'time' ? new Date(tv) : tv), key: `xt-${tv}` });
    }
  }
  if (!compact) {
    for (const a of xAnchors) {
      // Vertical gridline at each shown x tick (skip the y-axis edge).
      if (spec.gridX && a.px > plot.x + 0.5) {
        gridlines.push({ x1: a.px, y1: plot.y, x2: a.px, y2: plot.y + plot.height, color: theme.gridLineColor, width: 1, dash: xGridDash });
      }
      // Perpendicular tick mark below the x-axis.
      if (spec.axisTicks && !spec.xHidden) {
        const yb = plot.y + plot.height;
        axisLines.push({ x1: a.px, y1: yb, x2: a.px, y2: yb + AXIS_TICK_LEN, color: theme.axisLineColor, width: 1, dash: xAxisDash });
      }
      if (spec.xHidden || spec.xHideTicks) continue;
      texts.push({
        x: a.px,
        y: plot.y + plot.height + 6,
        text: a.text,
        color: theme.textColorMuted,
        fontSize: theme.labelSize,
        align: 'center',
        baseline: 'top',
        key: a.key,
      });
    }
  }

  // ── axis titles (the gutters above already reserved room for these) ──
  if (spec.xLabel && !compact) {
    texts.push({
      x: plot.x + plot.width / 2,
      // Sit above the bottom-legend band so the axis title and legend stack
      // (title, then legend) instead of overlapping.
      y: height - legendBandBottom - 2,
      text: spec.xLabel,
      color: theme.textColor,
      fontSize: theme.labelSize,
      align: 'center',
      baseline: 'bottom',
      key: 'x-axis-title',
    });
  }
  if (spec.yLabel && !compact) {
    texts.push({
      x: 4,
      y: plot.y + plot.height / 2,
      text: spec.yLabel,
      color: theme.textColor,
      fontSize: theme.labelSize,
      align: 'center',
      baseline: 'top',
      rotate: -90,
      key: 'y-axis-title',
    });
  }

  // ── legend (positions filled by the overlay flow-layout; we
  //     provide the entries, colour, and hidden state) ──
  const legend: LegendItem[] =
    spec.legend === 'none' || compact
      ? []
      : spec.series.map((s, si) => ({
          label: s.label,
          color: s.color,
          seriesIndex: si,
          hidden: s.hidden,
          x: 0,
          y: 0,
        }));

  const xLabels: string[] = [];
  for (let i = 0; i < rows; i++) xLabels.push(spec.xFormatter(spec.xValues[i] ?? i));

  return {
    width,
    height,
    plot,
    background: theme.background === 'transparent' ? undefined : theme.background,
    bands: axisBands,
    gridlines,
    axisLines,
    areas,
    bars,
    slices: [],
    lines,
    markers,
    glyphs,
    endLabels: endLabelCands,
    texts,
    legend,
    legendPosition: spec.legend,
    xPositions,
    xValues: spec.xValues,
    xLabels,
    hoverPoints,
  };
}

/**
 * Multi-axis line layout: each series is measured against its own value axis
 * (`spec.yAxes[series.yAxisIndex]`), and the axes stack outward from the plot —
 * left axes to the left, right axes to the right — each with its own domain,
 * ticks, formatter and (when it carries a single series) a matching tint. A
 * separate path from computeLayout; lines are independent (no stacking).
 */
export function computeMultiAxisLayout(spec: LineChartSpec, theme: EngineTheme, width: number, height: number): RenderScene {
  const axesSpec = spec.yAxes ?? [];
  const rows = spec.xValues.length || Math.max(0, ...spec.series.map((s) => s.data.length));
  const axisIndexOf = (s: LineSeriesSpec): number => {
    const i = s.yAxisIndex ?? 0;
    return i >= 0 && i < axesSpec.length ? i : 0;
  };

  interface AxisInfo {
    spec: ValueAxisSpec;
    domain: readonly [number, number];
    tickVals: number[];
    tickLabels: string[];
    side: 'left' | 'right';
    gutterW: number;
    tint: string | null;
    hasData: boolean;
    scale?: Scale;
    axisX?: number;
    toPxY?: (v: number) => number;
  }

  // ── per-axis domain / ticks / gutter width ──
  const axes: AxisInfo[] = axesSpec.map((a, ai) => {
    const seriesOn = spec.series.filter((s) => !s.hidden && axisIndexOf(s) === ai);
    const vals: number[] = [];
    for (const s of seriesOn) for (const d of s.data) if (typeof d === 'number' && Number.isFinite(d)) vals.push(d);
    const domain = computeDomain(vals, { min: a.min, max: a.max, scale: a.scale, includeZero: a.scale === 'value' });
    const tickVals = a.scale === 'log' ? logTicks(domain[0], domain[1]) : niceLinearTicks(domain[0], domain[1], 6);
    const tickLabels = tickVals.map((v) => a.formatter(v));
    const side: 'left' | 'right' = a.position ?? (ai === 0 ? 'left' : 'right');
    const labelW = a.hidden || a.hideTicks ? 0 : Math.max(0, ...tickLabels.map((t) => approxWidth(t, theme.labelSize)));
    const titleW = a.label ? theme.labelSize + 6 : 0;
    const gutterW = a.hidden ? 4 : labelW + 12 + titleW;
    // Axes default to the themed colour (the same muted grey as the x-axis); a
    // developer can tint an axis to match its series via the axis `color`.
    const tint = a.color ?? null;
    return { spec: a, domain, tickVals, tickLabels, side, gutterW, tint, hasData: seriesOn.length > 0 };
  });

  const leftAxes = axes.filter((a) => a.side === 'left');
  const rightAxes = axes.filter((a) => a.side === 'right');
  const sumGut = (arr: AxisInfo[]) => arr.reduce((n, a) => n + a.gutterW, 0);

  // ── outer chrome gutters ──
  const titleH = spec.title ? theme.titleSize + 10 + (spec.subtitle ? theme.labelSize + 4 : 0) : 0;
  const xLabelH = spec.xHidden || spec.xHideTicks ? 0 : theme.labelSize + 8;
  const xAxisLabelH = spec.xLabel ? theme.labelSize + 6 : 0;
  const legendActive = !!spec.legend && spec.legend !== 'none' && spec.series.length > 1;
  const legendSide = legendActive && (spec.legend === 'left' || spec.legend === 'right');
  const legendAtBottom = legendActive && !legendSide && spec.legend!.startsWith('bottom');
  const legendTopRow = legendActive && !legendSide && !legendAtBottom;
  const legendRows = legendTopRow || legendAtBottom ? estimateLegendRows(spec.series.map((s) => s.label), theme.labelSize, width * 0.86) : 1;
  const legendBandH = spec.legendExtent != null && (legendTopRow || legendAtBottom) ? spec.legendExtent + 8 : legendRows * (theme.labelSize + 8) + 6;
  const legendBandTop = legendTopRow ? legendBandH : 0;
  const legendBandBottom = legendAtBottom ? legendBandH : 0;
  const legendSideW = legendSide ? (spec.legendExtent != null ? spec.legendExtent + 16 : Math.max(0, ...spec.series.map((s) => approxWidth(s.label, theme.labelSize))) + 34) : 0;

  // With no right-side axis, reserve the right half of the last x-tick label so
  // it isn't clipped at the canvas edge (a right axis' gutter already covers it).
  const lastXText = spec.xHidden || spec.xHideTicks ? '' : spec.xFormatter(spec.xValues[rows - 1] ?? rows - 1);
  const xOverhang = rightAxes.length === 0 ? approxWidth(lastXText, theme.labelSize) / 2 : 0;

  const padTop = titleH + 8 + legendBandTop;
  const padBottom = xLabelH + xAxisLabelH + 6 + legendBandBottom;
  const padLeft = sumGut(leftAxes) + 8 + (spec.legend === 'left' ? legendSideW : 0);
  const padRight = sumGut(rightAxes) + 8 + xOverhang + (spec.legend === 'right' ? legendSideW : 0);

  const plot = {
    x: padLeft,
    y: padTop,
    width: Math.max(1, width - padLeft - padRight),
    height: Math.max(1, height - padTop - padBottom),
  };

  // ── x scale + hit-test positions ──
  const x: Scale =
    spec.xScale === 'category'
      ? makeCategoryScale(rows, plot.width, true)
      : spec.xScale === 'log'
        ? makeLogScale(computeDomain(spec.xValues.map((v) => toNumeric(v, spec.xScale)), { scale: 'log' }), plot.width)
        : makeLinearScale(computeDomain(spec.xValues.map((v) => toNumeric(v, spec.xScale)), { scale: spec.xScale }), plot.width, spec.xScale);
  const toPxX = (i: number) => plot.x + (spec.xScale === 'category' ? x.scale(i) : x.scale(toNumeric(spec.xValues[i], spec.xScale)));

  // ── position each axis + build its scale / toPxY ──
  const makeAxisScale = (a: AxisInfo) => {
    a.scale = a.spec.scale === 'log' ? makeLogScale(a.domain, plot.height) : makeLinearScale(a.domain, plot.height, a.spec.scale);
    a.toPxY = (v: number) => plot.y + plot.height - a.scale!.scale(v);
  };
  let offL = 0;
  for (const a of leftAxes) {
    a.axisX = plot.x - offL;
    makeAxisScale(a);
    offL += a.gutterW;
  }
  let offR = 0;
  for (const a of rightAxes) {
    a.axisX = plot.x + plot.width + offR;
    makeAxisScale(a);
    offR += a.gutterW;
  }

  // ── axis bands (behind everything) — each value axis bands its own scale,
  //     plus any declared on the x axis ──
  const bands: SceneBand[] = [];
  const bandLabels: TextItem[] = [];
  axes.forEach((a, ai) => {
    const built = buildAxisBands(a.spec.bands, 'y', (v) => a.toPxY!(toNumeric(v, a.spec.scale)), plot, theme, `yband-${ai}`);
    bands.push(...built.rects);
    bandLabels.push(...built.labels);
  });
  {
    const onX = buildAxisBands(
      spec.xBands,
      'x',
      (v) => plot.x + x.scale(spec.xScale === 'category' ? Number(v) : toNumeric(v, spec.xScale)),
      plot,
      theme,
      'xband',
    );
    bands.push(...onX.rects);
    bandLabels.push(...onX.labels);
  }

  // ── gridlines + axis lines ──
  const gridlines: SceneSegment[] = [];
  const axisLines: SceneSegment[] = [];
  // Horizontal gridlines follow the primary axis — the first non-hidden axis
  // that actually carries data, so an empty / hidden axis 0 can't anchor the
  // grid to a phantom [0,1] scale.
  const primary = axes.find((a) => !a.spec.hidden && a.hasData) ?? axes.find((a) => a.hasData);
  const xAxisDash = dashPattern(spec.xDash, 1);
  const xGridDash = dashPattern(spec.xGridDash, 1);
  if (primary && spec.gridY !== false) {
    // The shared horizontal grid follows the primary axis, so it takes that
    // axis' gridDash.
    const gridDash = dashPattern(primary.spec.gridDash, 1);
    for (const t of primary.tickVals) {
      const py = primary.toPxY!(t);
      gridlines.push({ x1: plot.x, y1: py, x2: plot.x + plot.width, y2: py, color: theme.gridLineColor, width: 1, dash: gridDash });
      if (spec.axisTicks) axisLines.push({ x1: plot.x - AXIS_TICK_LEN, y1: py, x2: plot.x, y2: py, color: theme.axisLineColor, width: 1, dash: dashPattern(primary.spec.dash, 1) });
    }
  }
  for (const a of axes) {
    if (a.spec.hidden) continue;
    const col = a.tint ?? theme.axisLineColor;
    const dash = dashPattern(a.spec.dash, 1);
    axisLines.push({ x1: a.axisX!, y1: plot.y, x2: a.axisX!, y2: plot.y + plot.height, color: col, width: 1, dash });
    // Perpendicular tick marks on this axis (opt-in via axisTicks).
    if (spec.axisTicks && !a.spec.hideTicks) {
      const dir = a.side === 'left' ? -1 : 1;
      for (const t of a.tickVals) {
        const py = a.toPxY!(t);
        axisLines.push({ x1: a.axisX!, y1: py, x2: a.axisX! + dir * AXIS_TICK_LEN, y2: py, color: col, width: 1, dash });
      }
    }
  }
  if (!spec.xHidden) {
    axisLines.push({ x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: xAxisDash });
  }

  // ── series → polylines / areas / markers / glyphs ──
  const lines: ScenePolyline[] = [];
  const areas: SceneArea[] = [];
  const markers: SceneMarker[] = [];
  const glyphs: GlyphMarker[] = [];
  const hoverPoints: HoverSeries[] = [];

  spec.series.forEach((s, si) => {
    if (s.hidden) return;
    const ax = axes[axisIndexOf(s)];
    const toPxY = ax.toPxY!;
    const zeroInDomain = ax.domain[0] <= 0 && ax.domain[1] >= 0;
    const baselineY = toPxY(zeroInDomain ? 0 : ax.domain[0]);
    const runs = splitRuns(
      s.data.map((d) => (d === undefined ? undefined : typeof d === 'number' ? d : null)),
      s.connectNulls,
    );
    const byIndex: Record<number, HoverPoint> = {};
    for (const run of runs) {
      if (!run.length) continue;
      const raw: Pt[] = run.map((r) => ({ x: toPxX(r.index), y: toPxY(r.value) }));
      run.forEach((r, k) => {
        const hoverSym = s.pointSymbols?.[r.index] ?? (s.symbol && s.symbol !== 'none' ? s.symbol : 'circle');
        byIndex[r.index] = { x: raw[k].x, y: raw[k].y, value: (s.data[r.index] as number) ?? r.value, symbol: hoverSym };
      });
      const poly = clampToRect(interpolate(decimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height);
      lines.push({ points: poly, color: s.color, width: 2.5, dash: dashPattern(s.dash, 2.5), seriesIndex: si });
      if (spec.area && s.fill !== false) {
        const fo = spec.fillOpacity ?? 0.35;
        areas.push({ points: poly, baselineY, colorTop: hexToRgba(s.color, fo), colorBottom: hexToRgba(s.color, Math.max(0.02, fo * 0.06)), seriesIndex: si });
      }
      const markSet = s.markIndices ? new Set(s.markIndices) : null;
      run.forEach((r, k) => {
        const idx = r.index;
        const override = s.pointSymbols?.[idx];
        const showDefault = markSet ? markSet.has(idx) : s.showMarks;
        const sym = override ?? (showDefault ? s.symbol ?? 'circle' : undefined);
        if (!sym || sym === 'none') return;
        const pt = raw[k];
        if (isShapeSymbol(sym)) markers.push({ x: pt.x, y: pt.y, r: markerRadius(sym, s.markSize), color: s.color, symbol: sym, seriesIndex: si });
        else glyphs.push({ x: pt.x, y: pt.y, text: sym, size: GLYPH_SIZE });
      });
      if (spec.showLabels) {
        run.forEach((r, k) => {
          // Above the point by default, but FLIPPED below when there is no room
          // for it there: the topmost point sits on the plot's ceiling, so a
          // label hung above it lands outside the plot and collides with the
          // title. Nothing reserves headroom for these, so the label has to be
          // the thing that gives way.
          const above = raw[k].y - 9 - theme.labelSize >= plot.y;
          glyphs.push({
            x: raw[k].x,
            y: raw[k].y,
            text: ax.spec.formatter((s.data[r.index] as number) ?? r.value),
            size: theme.labelSize,
            label: {
              color: theme.textColor,
              weight: 600,
              dx: 0,
              dy: above ? -9 : 9,
              anchorX: '-50%',
              anchorY: above ? '-100%' : '0',
            },
          });
        });
      }
    }
    hoverPoints.push({ seriesIndex: si, color: s.color, label: s.label, byIndex, values: s.data, valueFormat: ax.spec.formatter, unanchored: !hasAnchor(s) });
  });

  // ── text items ──
  const texts: TextItem[] = [...bandLabels];
  if (spec.title) {
    const tt = titlePlacement(spec.titleAlign, plot.x, plot.width);
    texts.push({ x: tt.x, y: legendBandTop + 6, text: spec.title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: 'top', key: 'title' });
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
  // per-axis tick labels + rotated axis titles (tinted to the single series, if any)
  axes.forEach((a, ai) => {
    if (a.spec.hidden) return;
    const labelColor = a.tint ?? theme.textColorMuted;
    if (!a.spec.hideTicks) {
      a.tickVals.forEach((t, i) => {
        texts.push({
          x: a.side === 'left' ? a.axisX! - 8 : a.axisX! + 8,
          y: a.toPxY!(t),
          text: a.tickLabels[i],
          color: labelColor,
          fontSize: theme.labelSize,
          align: a.side === 'left' ? 'end' : 'start',
          baseline: 'middle',
          key: `yt-${ai}-${i}`,
        });
      });
    }
    if (a.spec.label) {
      const outerX = a.side === 'left' ? a.axisX! - a.gutterW + theme.labelSize : a.axisX! + a.gutterW - theme.labelSize;
      texts.push({ x: outerX, y: plot.y + plot.height / 2, text: a.spec.label, color: a.tint ?? theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'top', rotate: -90, key: `yaxis-title-${ai}` });
    }
  });

  // x tick anchors: category → per-point (thinned); value/log/time → nice round
  // values (e.g. decades / month boundaries) so a dense series doesn't print a
  // label per data point. Computed ONCE and reused for gridlines, tick marks and
  // labels so vertical gridlines (gridX) render even when labels are hidden.
  const xPositions: number[] = [];
  for (let i = 0; i < rows; i++) xPositions.push(toPxX(i));
  const yb = plot.y + plot.height;
  const xAnchors: { px: number; text: string; key: string }[] = [];
  if (spec.xScale === 'category') {
    const step = Math.max(1, Math.ceil(rows / Math.max(1, Math.floor(plot.width / 60))));
    for (let i = 0; i < rows; i++) {
      if (i % step !== 0) continue;
      xAnchors.push({ px: xPositions[i], text: spec.xFormatter(spec.xValues[i] ?? i), key: `xt-${i}` });
    }
  } else {
    const xd = computeDomain(spec.xValues.map((v) => toNumeric(v, spec.xScale)), { scale: spec.xScale });
    const xTicks =
      spec.xScale === 'log' ? logTicks(xd[0], xd[1]) : spec.xScale === 'time' ? timeTicks(xd[0], xd[1], Math.max(2, Math.floor(plot.width / 90))) : niceLinearTicks(xd[0], xd[1], Math.max(2, Math.floor(plot.width / 90)));
    for (const tv of xTicks) {
      const px = plot.x + x.scale(tv);
      if (px < plot.x - 1 || px > plot.x + plot.width + 1) continue;
      // Format with the ORIGINAL typed value: a time axis needs a Date, not the
      // raw epoch number (a Date formatter would otherwise throw).
      xAnchors.push({ px, text: spec.xFormatter(spec.xScale === 'time' ? new Date(tv) : tv), key: `xt-${tv}` });
    }
  }
  // Vertical gridlines — independent of x-tick label visibility.
  if (spec.gridX) for (const a of xAnchors) gridlines.push({ x1: a.px, y1: plot.y, x2: a.px, y2: yb, color: theme.gridLineColor, width: 1, dash: xGridDash });
  if (!spec.xHidden && !spec.xHideTicks) {
    for (const a of xAnchors) {
      if (spec.axisTicks) axisLines.push({ x1: a.px, y1: yb, x2: a.px, y2: yb + AXIS_TICK_LEN, color: theme.axisLineColor, width: 1, dash: xAxisDash });
      texts.push({ x: a.px, y: yb + 6, text: a.text, color: theme.textColorMuted, fontSize: theme.labelSize, align: 'center', baseline: 'top', key: a.key });
    }
  }
  if (spec.xLabel) {
    texts.push({ x: plot.x + plot.width / 2, y: height - legendBandBottom - 2, text: spec.xLabel, color: theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'bottom', key: 'x-axis-title' });
  }

  const legend: LegendItem[] =
    spec.legend === 'none' ? [] : spec.series.map((s, si) => ({ label: s.label, color: s.color, seriesIndex: si, hidden: s.hidden, x: 0, y: 0 }));
  const xLabels: string[] = [];
  for (let i = 0; i < rows; i++) xLabels.push(spec.xFormatter(spec.xValues[i] ?? i));

  return {
    width,
    height,
    plot,
    background: theme.background === 'transparent' ? undefined : theme.background,
    bands,
    gridlines,
    axisLines,
    areas,
    bars: [],
    slices: [],
    lines,
    markers,
    glyphs,
    endLabels: [],
    texts,
    legend,
    legendPosition: spec.legend,
    xPositions,
    xValues: spec.xValues,
    xLabels,
    hoverPoints,
  };
}

/**
 * Transposed line layout: the independent axis (xValues, e.g. altitude) runs
 * VERTICALLY and the series-value axis (e.g. temperature) runs HORIZONTALLY, so
 * the line is a function of the vertical axis and can snake back and forth. A
 * separate path from computeLayout so the normal orientation is untouched.
 */
export function computeInvertedLayout(spec: LineChartSpec, theme: EngineTheme, width: number, height: number): RenderScene {
  const rows = spec.xValues.length || Math.max(0, ...spec.series.map((s) => s.data.length));
  const compact = !!spec.compact;
  const category = spec.xScale === 'category';

  // ── stacked bands → the value extent (see computeLayout; same rules, but the
  // resulting band runs horizontally once the axes are transposed) ──
  const stackKeys = spec.series.map((s) => (spec.stack !== 'none' && !s.range ? 'stacked' : '__unstacked__'));
  const bands = stackSeries(
    spec.series.map((s) => (s.hidden ? [] : s.data)),
    spec.stack,
    stackKeys,
  );
  spec.series.forEach((s, si) => {
    if (!s.range || s.hidden) return;
    bands[si] = s.range.map((r) => (r ? ([Math.min(r[0], r[1]), Math.max(r[0], r[1])] as [number, number]) : r));
  });

  // value axis (series values → horizontal)
  const valVals: number[] = [];
  spec.series.forEach((s, si) => {
    if (s.hidden) return;
    for (const b of bands[si]) if (b) valVals.push(b[0], b[1]);
  });
  const valDomain = computeDomain(valVals, { min: spec.yMin, max: spec.yMax, scale: spec.yScale, includeZero: false });
  const valTicks = spec.yScale === 'log' ? logTicks(valDomain[0], valDomain[1]) : niceLinearTicks(valDomain[0], valDomain[1], 8);
  const valTickLabels = valTicks.map((v) => (spec.yTickFormatter ?? spec.yFormatter)(v));

  // main axis (xValues → vertical)
  const mainDomain = category ? ([0, Math.max(1, rows - 1)] as [number, number]) : computeDomain(spec.xValues.map((v) => toNumeric(v, spec.xScale)), { scale: spec.xScale });
  const mainTickIdx = category ? Array.from({ length: rows }, (_, i) => i) : niceLinearTicks(mainDomain[0], mainDomain[1], 6);
  const mainTickLabels = mainTickIdx.map((v) => (category ? spec.xFormatter(spec.xValues[v] ?? v) : spec.xFormatter(v)));

  // ── gutters (mirror computeLayout, but altitude labels go LEFT + temperature
  //    labels go BOTTOM) ──
  const legendActive = !!spec.legend && spec.legend !== 'none' && spec.series.length > 1;
  const legendSide = legendActive && (spec.legend === 'left' || spec.legend === 'right');
  const legendAtBottom = legendActive && !legendSide && spec.legend!.startsWith('bottom');
  const legendTopRow = legendActive && !legendSide && !legendAtBottom;
  // A horizontal legend wraps into as many rows as the labels need — reserve
  // that height so many-series legends don't spill onto the plot.
  const legendRows = legendTopRow || legendAtBottom ? estimateLegendRows(spec.series.map((s) => s.label), theme.labelSize, width * 0.86) : 1;
  // Second-pass measured extent wins over the first-pass estimate.
  const legendBandH = spec.legendExtent != null && (legendTopRow || legendAtBottom) ? spec.legendExtent + 8 : legendRows * (theme.labelSize + 8) + 6;
  const legendBandTop = legendTopRow ? legendBandH : 0;
  const legendBandBottom = legendAtBottom ? legendBandH : 0;
  const legendSideW = legendSide ? (spec.legendExtent != null ? spec.legendExtent + 16 : Math.max(0, ...spec.series.map((s) => approxWidth(s.label, theme.labelSize))) + 34) : 0;
  const titleH = spec.title ? theme.titleSize + 10 + (spec.subtitle ? theme.labelSize + 4 : 0) : 0;
  const maxMainLabelW = spec.xHidden || spec.xHideTicks ? 0 : Math.max(0, ...mainTickLabels.map((t) => approxWidth(t, theme.labelSize)));
  const valLabelH = spec.yHidden || spec.yHideTicks ? 0 : theme.labelSize + 8;
  const mainAxisTitleW = spec.xLabel ? theme.labelSize + 6 : 0;
  const valAxisTitleH = spec.yLabel ? theme.labelSize + 6 : 0;

  const padTop = compact ? 2 : titleH + 8 + legendBandTop;
  const padRight = compact ? 2 : 12 + approxWidth(valTickLabels[valTickLabels.length - 1] ?? '', theme.labelSize) / 2 + (spec.legend === 'right' ? legendSideW : 0);
  const padBottom = compact ? 2 : valLabelH + valAxisTitleH + 6 + legendBandBottom;
  const padLeft = compact ? 2 : maxMainLabelW + 10 + mainAxisTitleW + (spec.legend === 'left' ? legendSideW : 0);

  const plot = {
    x: padLeft,
    y: padTop,
    width: Math.max(1, width - padLeft - padRight),
    height: Math.max(1, height - padTop - padBottom),
  };

  const valScale: Scale = spec.yScale === 'log' ? makeLogScale(valDomain, plot.width) : makeLinearScale(valDomain, plot.width, spec.yScale);
  const mainScale: Scale = category
    ? makeCategoryScale(rows, plot.height, true)
    : spec.xScale === 'log'
      ? makeLogScale(mainDomain, plot.height)
      : makeLinearScale(mainDomain, plot.height, spec.xScale);

  const toPxX = (v: number) => plot.x + valScale.scale(v); // temperature → horizontal
  // Vertical pixel for a main-axis coordinate (a tick value, or a data point's
  // altitude): map through the main scale, top-origin.
  const toPxYval = (coord: number) => plot.y + plot.height - mainScale.scale(coord);
  const toPxYidx = (i: number) => toPxYval(category ? i : toNumeric(spec.xValues[i], spec.xScale));

  // ── gridlines + axis lines ──
  const gridlines: SceneSegment[] = [];
  const axisLines: SceneSegment[] = [];
  const yb = plot.y + plot.height;
  // Axes are transposed here: the VALUE (y) axis runs along the bottom and the
  // x-data axis up the side — the dash options follow the axis they belong to,
  // not the screen direction.
  const yAxisDash = dashPattern(spec.yDash, 1);
  const yGridDash = dashPattern(spec.yGridDash, 1);
  const xAxisDash = dashPattern(spec.xDash, 1);
  const xGridDash = dashPattern(spec.xGridDash, 1);
  if (!spec.yHidden && !compact) {
    for (const t of valTicks) {
      const px = toPxX(t);
      if (spec.gridY !== false) gridlines.push({ x1: px, y1: plot.y, x2: px, y2: yb, color: theme.gridLineColor, width: 1, dash: yGridDash });
      if (spec.axisTicks) axisLines.push({ x1: px, y1: yb, x2: px, y2: yb + AXIS_TICK_LEN, color: theme.axisLineColor, width: 1, dash: yAxisDash });
    }
    axisLines.push({ x1: plot.x, y1: yb, x2: plot.x + plot.width, y2: yb, color: theme.axisLineColor, width: 1, dash: yAxisDash });
  }
  if (!spec.xHidden && !compact) {
    for (const t of mainTickIdx) {
      const py = toPxYval(t);
      if (spec.gridX) gridlines.push({ x1: plot.x, y1: py, x2: plot.x + plot.width, y2: py, color: theme.gridLineColor, width: 1, dash: xGridDash });
      if (spec.axisTicks) axisLines.push({ x1: plot.x - AXIS_TICK_LEN, y1: py, x2: plot.x, y2: py, color: theme.axisLineColor, width: 1, dash: xAxisDash });
    }
    axisLines.push({ x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, color: theme.axisLineColor, width: 1, dash: xAxisDash });
  }

  // ── series → polylines / areas / markers / glyphs (no stacking when inverted) ──
  const lines: ScenePolyline[] = [];
  const areas: SceneArea[] = [];
  const markers: SceneMarker[] = [];
  const glyphs: GlyphMarker[] = [];
  const hoverPoints: HoverSeries[] = [];
  // The value axis runs horizontally here, so the fill closes against a
  // baseline X (clamped into the plot, as the vertical layout does for y).
  const baselineX = toPxX(Math.max(valDomain[0], Math.min(valDomain[1], 0)));
  spec.series.forEach((s, si) => {
    if (s.hidden) return;
    const byIndex: Record<number, HoverPoint> = {};
    // Walk the STACKED top edge, as the upright layout does — `r.value` is the
    // band's top, so a stacked layer sits on the one below it instead of every
    // series starting again from the baseline.
    for (const run of splitRuns(
      bands[si].map((b) => (b === undefined ? undefined : b ? b[1] : null)),
      s.connectNulls,
    )) {
      if (!run.length) continue;
      const raw: Pt[] = run.map((r) => ({ x: toPxX(r.value), y: toPxYidx(r.index) }));
      run.forEach((r, k) => {
        const hoverSym = s.pointSymbols?.[r.index] ?? (s.symbol && s.symbol !== 'none' ? s.symbol : 'circle');
        byIndex[r.index] = { x: raw[k].x, y: raw[k].y, value: (s.data[r.index] as number) ?? r.value, symbol: hoverSym };
      });
      const poly = clampToRect(interpolate(decimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height);
      // Same rule as upright: a range band and a fill-only series draw no line,
      // and a stacked layer is stroked only where its band has real width.
      if (!s.range && s.stroke !== false) {
        lines.push({ points: poly, color: s.color, width: 2.5, dash: dashPattern(s.dash, 2.5), seriesIndex: si });
      }
      if (spec.area && s.fill !== false) {
        const fo = spec.fillOpacity ?? 0.35;
        const banded = spec.stack !== 'none' || !!s.range;
        areas.push({
          points: poly,
          baselineY: baselineX,
          colorTop: hexToRgba(s.color, fo),
          // Even tint for a band, fade only for a fill that runs to the axis —
          // see the upright layout.
          colorBottom: banded ? hexToRgba(s.color, fo) : hexToRgba(s.color, Math.max(0.02, fo * 0.06)),
          // Mirror each point onto the layer's base so the polygon closes along
          // the value axis; `baselineY` alone would close it vertically, which
          // is the wrong direction once the axes are transposed. A stacked or
          // range layer bases on its own band, everything else on zero.
          basePoints:
            spec.stack !== 'none' || s.range
              ? clampToRect(
                  interpolate(
                    run.map((r) => ({ x: toPxX((bands[si][r.index] as [number, number])[0]), y: toPxYidx(r.index) })),
                    s.curve,
                  ),
                  plot.x,
                  plot.y,
                  plot.width,
                  plot.height,
                )
              : poly.map((p) => ({ x: baselineX, y: p.y })),
          horizontal: true,
          seriesIndex: si,
        });
      }
      const markSet = s.markIndices ? new Set(s.markIndices) : null;
      run.forEach((r, k) => {
        const override = s.pointSymbols?.[r.index];
        const sym = override ?? ((markSet ? markSet.has(r.index) : s.showMarks) ? s.symbol ?? 'circle' : undefined);
        if (!sym || sym === 'none') return;
        const pt = raw[k];
        if (isShapeSymbol(sym)) markers.push({ x: pt.x, y: pt.y, r: markerRadius(sym, s.markSize), color: s.color, symbol: sym, seriesIndex: si });
        else glyphs.push({ x: pt.x, y: pt.y, text: sym, size: GLYPH_SIZE });
      });
      // Data labels — to the right of each point (value axis is horizontal),
      // via the glyph layer so they animate with the point.
      if (spec.showLabels && !compact) {
        run.forEach((r, k) => {
          glyphs.push({
            x: raw[k].x,
            y: raw[k].y,
            text: spec.yFormatter((s.data[r.index] as number) ?? r.value),
            size: theme.labelSize,
            label: { color: theme.textColor, weight: 600, dx: 9, dy: 0, anchorX: '0', anchorY: '-50%' },
          });
        });
      }
    }
    hoverPoints.push({ seriesIndex: si, color: s.color, label: s.label, byIndex, values: s.data, unanchored: !hasAnchor(s) });
  });

  // ── overlay text (title, altitude labels LEFT, temperature labels BOTTOM, titles) ──
  const texts: TextItem[] = [];
  if (spec.title && !compact) {
    const tt = titlePlacement(spec.titleAlign, plot.x, plot.width);
    texts.push({ x: tt.x, y: legendBandTop + 6, text: spec.title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: 'top', key: 'title' });
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
  if (!spec.xHidden && !spec.xHideTicks && !compact) {
    mainTickIdx.forEach((t, i) => {
      texts.push({ x: plot.x - 8, y: toPxYval(t), text: mainTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, align: 'end', baseline: 'middle', key: `mt-${i}` });
    });
  }
  if (!spec.yHidden && !spec.yHideTicks && !compact) {
    valTicks.forEach((t, i) => {
      texts.push({ x: toPxX(t), y: yb + 6, text: valTickLabels[i], color: theme.textColorMuted, fontSize: theme.labelSize, align: 'center', baseline: 'top', key: `vt-${i}` });
    });
  }
  if (spec.xLabel && !compact) {
    texts.push({ x: 4, y: plot.y + plot.height / 2, text: spec.xLabel, color: theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'top', rotate: -90, key: 'x-axis-title' });
  }
  if (spec.yLabel && !compact) {
    texts.push({ x: plot.x + plot.width / 2, y: height - legendBandBottom - 2, text: spec.yLabel, color: theme.textColor, fontSize: theme.labelSize, align: 'center', baseline: 'bottom', key: 'y-axis-title' });
  }

  const legend: LegendItem[] =
    spec.legend === 'none' || compact ? [] : spec.series.map((s, si) => ({ label: s.label, color: s.color, seriesIndex: si, hidden: s.hidden, x: 0, y: 0 }));

  const xPositions: number[] = [];
  const xLabels: string[] = [];
  for (let i = 0; i < rows; i++) {
    xPositions.push(toPxYidx(i));
    xLabels.push(spec.xFormatter(spec.xValues[i] ?? i));
  }

  return {
    width,
    height,
    plot,
    background: theme.background === 'transparent' ? undefined : theme.background,
    gridlines,
    axisLines,
    areas,
    bars: [],
    slices: [],
    lines,
    markers,
    glyphs,
    texts,
    legend,
    legendPosition: spec.legend,
    inverted: true,
    xPositions,
    xValues: spec.xValues,
    xLabels,
    hoverPoints,
  };
}

/** Default emoji / text glyph-marker size in px. */
const GLYPH_SIZE = 18;

const SHAPE_SYMBOLS = new Set<string>(['circle', 'square', 'diamond', 'triangle', 'triangle-down']);

/** Whether a symbol is a drawable shape (canvas) vs an emoji/text glyph (DOM). */
function isShapeSymbol(symbol: string): symbol is MdChartSymbol {
  return SHAPE_SYMBOLS.has(symbol);
}

/** Marker circumradius per symbol — polygons get a touch more so they read at
 *  a similar visual weight to the circle (corners recede). */
function markerRadius(symbol: MdChartSymbol | undefined, override?: number): number {
  if (override != null && override > 0) return override;
  if (symbol === 'square' || symbol === 'diamond') return 4.2;
  if (symbol === 'triangle' || symbol === 'triangle-down') return 4.6;
  return 3.5;
}

/**
 * Resolve a title's anchor x + text-align from the requested alignment,
 * relative to the plot box. Shared by the line/bar/pie layouts so the
 * `titleAlign` prop behaves identically across chart types.
 */
export function titlePlacement(
  align: MdChartTitleAlign | undefined,
  plotX: number,
  plotWidth: number,
): { x: number; align: 'start' | 'center' | 'end' } {
  if (align === 'center') return { x: plotX + plotWidth / 2, align: 'center' };
  if (align === 'end') return { x: plotX + plotWidth, align: 'end' };
  return { x: plotX, align: 'start' };
}
