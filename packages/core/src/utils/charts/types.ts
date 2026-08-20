/*
 * Shared chart types
 * ===========================================================
 * Every md-* chart component shares this vocabulary so authors
 * can move data between charts (e.g. swap line for area, or
 * embed a sparkline inside a card that hosts a bar chart)
 * without rewriting their data adapters.
 *
 * Everything here is intentionally framework-agnostic: no
 * ECharts types leak out at this layer. Public chart props
 * accept the union types below and the per-chart components
 * translate them into ECharts options internally.
 * ===========================================================
 */

/**
 * A single x-axis category label OR a numeric value (for
 * `scale: 'value'` and `scale: 'time'` charts). Time values
 * accept ISO-8601 strings, epoch milliseconds, or Date objects.
 */
export type MdChartAxisValue = string | number | Date;

/**
 * Y-axis values can be `null` to represent a gap in the line.
 * Bar / pie / sparkline coerce `null` to 0 visually but emit
 * the original `null` back in event payloads so downstream
 * consumers can distinguish "no data" from "zero".
 */
export type MdChartDataPoint = number | null;

/**
 * A datum that carries its own x position instead of borrowing one from
 * `xAxis.data` by index. This is what irregular data needs: samples taken at
 * uneven moments, or several series measured on entirely different dates.
 *
 * ```ts
 * data: [
 *   { x: '2021-10-29', y: 0 },
 *   { x: '2021-11-13', y: 0.12 },  // 15 days later
 *   { x: '2021-11-14', y: 0.15 },  // 1 day later
 * ]
 * ```
 *
 * A series is either all bare values or all points — mixing them drops the
 * bare ones, since they have no x to sit at. Express a gap as a point with a
 * `null` y (`{ x: date, y: null }`), which breaks the line the same way a bare
 * `null` does.
 */
export interface MdChartXYPoint {
  x: MdChartAxisValue;
  y: MdChartDataPoint;
}

/** `[x, y]` shorthand for {@link MdChartXYPoint}. */
export type MdChartXYTuple = readonly [MdChartAxisValue, MdChartDataPoint];

/**
 * One datum in a series: a bare y value (positioned by index against
 * `xAxis.data`) or a point carrying its own x ({@link MdChartXYPoint}).
 */
export type MdChartDatum = MdChartDataPoint | MdChartXYPoint | MdChartXYTuple;

/**
 * One low/high sample of a RANGE series — a band between two values at an x,
 * rather than a line measured down to the baseline. `null` (or a null edge) is
 * a gap, which breaks the band the same way a null y breaks a line.
 *
 * Kept as its own datum type, and carried on its own `range` field, because
 * `[low, high]` and {@link MdChartXYTuple}'s `[x, y]` are indistinguishable at
 * runtime — a series says which it means by WHICH FIELD it fills in.
 */
export type MdChartRangeDatum = readonly [number | null, number | null] | { low: number | null; high: number | null } | null;

/**
 * Axis scale type. Pie charts ignore this (they're inherently
 * categorical). For sparklines, only `category` and `time` are
 * supported (numeric scale would be misleading at sparkline
 * dimensions).
 *   • category — discrete x values, evenly spaced
 *   • time     — Date / ISO-8601 / epoch ms; ticks auto-snap
 *   • value    — continuous numeric, supports min/max + log
 *   • log      — continuous numeric on a log10 scale
 */
export type MdChartScaleType = 'category' | 'time' | 'value' | 'log';

/**
 * MD3 colour role used to tint a series. Maps onto the matching
 * `--md-sys-color-*` token at render time, so a chart with
 * `roles: ['primary', 'secondary', 'tertiary']` automatically
 * re-themes on dark mode / brand-token override without code
 * changes. Hex / rgb / hsl strings also accepted for one-off
 * overrides (e.g. a data-viz palette).
 */
export type MdChartColorRole =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'error'
  | 'primary-container'
  | 'secondary-container'
  | 'tertiary-container'
  | 'error-container'
  | 'surface-variant'
  /* Semantic status roles. Deliberately NOT part of the default categorical
     cycle: these carry meaning, so they are opt-in per series rather than
     something an auto-palette can hand out to an arbitrary category. */
  | 'success'
  | 'warning'
  | 'info'
  | 'success-container'
  | 'warning-container'
  | 'info-container';

/**
 * Curve interpolation between points for line / area charts.
 *   • linear    — straight segments (precise data, financial)
 *   • smooth    — Catmull-Rom spline (default, MD3 expressive)
 *   • monotone  — monotone cubic spline (won't overshoot, good
 *                  for monotonically-increasing time series)
 *   • step      — step-after (value holds, then jumps)
 *   • step-before — value jumps, then holds
 *   • step-middle — value jumps at the midpoint between points
 */
export type MdChartCurve =
  | 'linear'
  | 'smooth'
  | 'monotone'
  | 'step'
  | 'step-before'
  | 'step-middle';

/**
 * Stroke style for a drawn line — a series line, an axis line, a gridline or a
 * mark line.
 *   • solid (default) · dashed · dotted
 */
export type MdChartLineStyle = 'solid' | 'dashed' | 'dotted';

/** Where the legend renders relative to the plot area. */
export type MdChartLegendPosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end';

/**
 * Tooltip interaction model.
 *   • axis    — single tooltip per x-axis position, lists every
 *               series at that x (default — matches MUI X)
 *   • item    — tooltip per data marker (hover individual points)
 *   • none    — no tooltip rendered (still announces via aria-live)
 */
export type MdChartTooltipTrigger = 'axis' | 'item' | 'none';

/**
 * Horizontal alignment of the chart title over the plot area.
 *   • start  — left-aligned to the plot's left edge (default)
 *   • center — centred over the plot
 *   • end    — right-aligned to the plot's right edge
 */
export type MdChartTitleAlign = 'start' | 'center' | 'end';

/**
 * Entry-animation style played once on first render. All variants
 * honour `prefers-reduced-motion` (and the `no-animation` prop),
 * falling back to an instant static paint.
 *   • expressive — MD3-expressive spring: data rises / grows / sweeps
 *                  in from the baseline with a small overshoot (default)
 *   • grow       — same spatial motion, calm decelerate easing, no overshoot
 *   • fade       — geometry fades in (opacity), no spatial motion
 *   • draw       — progressive left-to-right reveal: the line draws itself,
 *                  the area wipes in, bars stagger, the pie sweeps
 *   • stagger    — like `draw`, but one series at a time: each line draws
 *                  left-to-right in sequence (line 1 completes, then line 2 …)
 *   • none        — no animation (instant paint)
 */
export type MdChartAnimation = 'expressive' | 'grow' | 'fade' | 'draw' | 'stagger' | 'none';

/**
 * Data-point marker shape (line / area charts, when marks are shown).
 *   • circle (default) · square · diamond · triangle · triangle-down
 *   • none — suppress this series' markers even when marks are on
 */
export type MdChartSymbol = 'circle' | 'square' | 'diamond' | 'triangle' | 'triangle-down' | 'none';

/**
 * Bar chart layout.
 *   • vertical   — categories on x, values on y (default)
 *   • horizontal — values on x, categories on y (good for long labels)
 */
export type MdChartBarLayout = 'vertical' | 'horizontal';

/**
 * How a bar / area chart stacks its series.
 *   • none       — series render side-by-side (grouped bars / overlapping areas)
 *   • normal     — additive stacking (most common)
 *   • percentage — series rescaled so each x-tick totals 100%
 *   • silhouette — symmetric around 0 (streamgraph)
 *   • wiggle     — minimised slope changes (streamgraph)
 */
export type MdChartStackMode =
  | 'none'
  | 'normal'
  | 'percentage'
  | 'silhouette'
  | 'wiggle';

/** A single series. */
export interface MdChartSeries {
  /** Human-readable label used in legend, tooltip, and a11y announcements. */
  label?: string;
  /** Per-row data. Length should match the x-axis data length. */
  data: MdChartDataPoint[];
  /**
   * Draw this series' line. `false` gives fill only — which is what a
   * streamgraph wants, since a band on a floating baseline has no meaningful
   * top edge to trace. Defaults to on, except for the `wiggle` / `silhouette`
   * stack modes, which default to off.
   */
  stroke?: boolean;
  /**
   * Opt this one series out of the area fill (area charts only). A line drawn
   * over a range band should not fill down to the axis itself — it would bury
   * the band it is meant to sit inside.
   */
  fill?: boolean;
  /**
   * Draw this series as a BAND between two values per row — a min/max envelope,
   * a confidence interval — instead of a line filled down to the baseline. When
   * set, `data` is ignored and the band is drawn with no stroke, so a plain line
   * series layered after it reads as the value inside the range.
   *
   * Area charts only; a range series never participates in stacking (a band has
   * no single value to stack) and is measured on the axis like any other.
   */
  range?: MdChartRangeDatum[];
  /**
   * Visual tint for the series. Either an MD3 role (auto-themed)
   * or a raw CSS colour string. If omitted, the chart cycles
   * through `primary` → `tertiary` → `secondary` → `error`.
   */
  color?: MdChartColorRole | string;
  /**
   * Stack key. Series with the same `stack` value are stacked
   * together. Series with no `stack` render independently. The
   * chart-level `stack` prop sets a default for all series.
   */
  stack?: string;
  /** Per-series curve override (line / area charts). */
  curve?: MdChartCurve;
  /** Stroke style for this series' own drawn line (line / area). `'dotted'`
   *  suits average / reference lines; pairs with the axes' `dash`/`gridDash`. */
  dash?: MdChartLineStyle;
  /** Per-series visibility — useful for legend toggling. */
  hidden?: boolean;
  /**
   * Whether to bridge `null` gaps with a straight line (line/area
   * only). Overrides the chart-level `connectNulls`.
   */
  connectNulls?: boolean;
  /** Show data-point markers (line / area). */
  showMarks?: boolean;
  /**
   * Marker for shown marks (line / area). A shape keyword
   * (`MdChartSymbol`) or any emoji / short text, which renders as a
   * glyph. Default `circle`.
   */
  symbol?: MdChartSymbol | (string & {});
  /**
   * Per-point marker override, keyed by data index — a shape keyword or an
   * emoji / short text. Renders even when `showMarks` is off, so you can accent
   * a single point (e.g. `{ 7: '☀️' }` on a peak) without markers everywhere.
   */
  pointSymbols?: Record<number, MdChartSymbol | string>;
  /**
   * Per-datum colour override, keyed by data index — an MD3 role or a CSS
   * colour. A datum not named here keeps the series colour.
   *
   * This is what a bar chart whose bars are entities rather than samples
   * needs: a race, a ranking, a single series where each bar is its own
   * country. It is read by `md-bar-chart`; line and area charts tint by
   * series, not by point.
   */
  pointColors?: Record<number, MdChartColorRole | string>;
  /**
   * Per-datum band WIDTH weight, keyed by data index — a VARIWIDE chart, where
   * a column's width carries a second variable alongside its height (price
   * against volume, cost against the size of the economy it is measured in).
   *
   * Weights are relative: a category with weight `2` takes twice the axis a
   * category with weight `1` does, and one left out takes `1`. A category band
   * is shared by every series, so the first series to supply these sets the
   * widths for the whole axis. Read by `md-bar-chart`.
   */
  pointWidths?: Record<number, number>;
  /**
   * Draw this series centred ON the category band at {@link widthRatio} of it,
   * in front of the series that share the band, instead of taking a slot beside
   * them — "fixed placement" columns. Read by `md-bar-chart`.
   */
  overlay?: boolean;
  /**
   * Width of an {@link overlay} series' bar as a fraction of the category
   * band's inner width. Default `0.45`. Ignored unless `overlay` is set.
   */
  widthRatio?: number;
  /** Series-level click identifier (returned in the click event detail). */
  id?: string;
  /** For a multi-axis chart (`y-axes`): index into `yAxes` this series is
   *  measured against. Omitted / out-of-range falls back to the first axis. */
  yAxisIndex?: number;
  /** Draw the line solid up to this data index, then dotted after it (the
   *  boundary point is shared) — for past-vs-forecast lines. */
  dashAfter?: number;
  /** Open (ring) markers — stroked in the series colour with a surface-filled
   *  centre — instead of filled dots. */
  hollow?: boolean;
  /** Line stroke width in px (line / area). Default 2.5. */
  lineWidth?: number;
  /** Marker RADIUS in px (line / area). Overrides the per-symbol default. */
  markSize?: number;
}

/**
 * A line/area series whose `data` may carry per-point x values
 * ({@link MdChartDatum}) — for irregular sampling, or several series measured
 * on different dates. Plain {@link MdChartSeries} arrays are still valid here:
 * a bare number list means "positioned by index against `xAxis.data`".
 *
 * Series with their own x are merged onto one shared axis internally, so
 * tooltips, zoom and the screen-reader table keep working across all of them.
 */
export interface MdChartXYSeries extends Omit<MdChartSeries, 'data'> {
  data: MdChartDatum[];
}

/** A vertical reference line drawn across the plot at an x position, with an
 *  optional label — e.g. a "current time" divider on a forecast chart. */
export interface MdChartMarkLine {
  /** X position: a value/time axis value, or a (possibly fractional) index on a
   *  category axis. */
  value: MdChartAxisValue;
  /** Label drawn at the top of the line. */
  label?: string;
  /** Line colour (MD3 role or CSS colour). Defaults to the themed axis colour. */
  color?: MdChartColorRole | string;
  /** Line style. Default `'dashed'`. */
  dash?: MdChartLineStyle;
}

/**
 * A range cut out of an axis. Everything between `from` and `to` is removed
 * and replaced by a small gap with a break mark, so clusters that sit far
 * apart both stay readable instead of one collapsing onto the axis.
 */
export interface MdChartAxisBreak {
  from: MdChartAxisValue;
  to: MdChartAxisValue;
  /** Pixels the cut occupies. Default 14. */
  gap?: number;
}

/** Longhand break configuration — explicit cuts, automatic ones, or both. */
export interface MdChartAxisBreakOptions {
  /** Cuts you name yourself. */
  ranges?: MdChartAxisBreak[];
  /** Also cut empty stretches the axis finds on its own. */
  auto?: boolean;
  /** How many times the median spacing a gap must exceed to be cut. Default 8. */
  minGap?: number;
  /** Most automatic cuts to make. Default 2. */
  maxBreaks?: number;
  /** Pixels each cut occupies. Default 14. */
  gap?: number;
  /**
   * How the sections left over share the axis.
   *   • `equal` (default) — each section gets the same share, which is what
   *     makes a point at 1 and a point at 1e12 both readable.
   *   • `proportional` — one unit-per-pixel across the whole axis, so widths
   *     stay comparable across sections. Classic break behaviour; note it
   *     leaves a tiny section tiny.
   */
  sizing?: 'equal' | 'proportional';
}

/**
 * Axis breaks: a list of cuts, `'auto'`, or the longhand options.
 *
 * ```ts
 * yAxis = { breaks: [{ from: 120, to: 950_000_000_000 }] }   // explicit
 * yAxis = { breaks: 'auto' }                                  // find the empty stretches
 * yAxis = { breaks: { auto: true, minGap: 12, sizing: 'proportional' } }
 * ```
 */
export type MdChartAxisBreaks = MdChartAxisBreak[] | 'auto' | MdChartAxisBreakOptions;

/**
 * A shaded range across the plot, drawn behind the data — the classification
 * bands a reading is *read against* rather than data of its own: Beaufort
 * force behind a wind trace, a healthy blood-pressure range, off-hours behind
 * a load graph.
 *
 * `from`/`to` are values on the axis the band is declared on (a data index on
 * a category axis). A band on the y axis spans the plot horizontally; one on
 * the x axis spans it vertically.
 */
export interface MdChartAxisBand {
  /** Band start (inclusive). */
  from: MdChartAxisValue;
  /** Band end (inclusive). */
  to: MdChartAxisValue;
  /** Fill — an MD3 role or a CSS colour. Defaults to a faint tint of the axis
   *  colour, which reads on both light and dark themes. */
  color?: MdChartColorRole | string;
  /** Text drawn inside the band. */
  label?: string;
  /** Where the label sits along the band. Default `start`. */
  labelAlign?: 'start' | 'center' | 'end';
  /** Label colour (MD3 role or CSS colour). Defaults to the muted text colour. */
  labelColor?: MdChartColorRole | string;
}

/**
 * Axis configuration (line / area / bar charts). Pie / sparkline
 * either don't have axes or render them implicitly.
 */
export interface MdChartAxis {
  /** Tick label values (category axis) or [min, max] hints (value axis). */
  data?: MdChartAxisValue[];
  /** Axis scale type. Defaults to `category` for x, `value` for y. */
  scale?: MdChartScaleType;
  /** Axis label rendered at the start/end of the axis. */
  label?: string;
  /** Force min — useful for fixed-scale comparisons across charts. */
  min?: number;
  /** Force max. */
  max?: number;
  /**
   * Format tick labels. Receives the raw value; returns the
   * string to render. Default formats numbers with the user's
   * locale, dates with `toLocaleDateString`, and categories as-is.
   */
  valueFormatter?: (value: MdChartAxisValue) => string;
  /** Shaded ranges drawn behind the data, measured on this axis. */
  bands?: MdChartAxisBand[];
  /**
   * Ranges cut out of this axis, so far-apart clusters both stay readable.
   * Data inside a cut is not drawn and the line splits there.
   */
  breaks?: MdChartAxisBreaks;
  /** Hide tick labels (still renders the axis line). */
  hideTicks?: boolean;
  /** Hide the axis line + ticks entirely. */
  hidden?: boolean;
  /** Draw this axis' own line (the frame edge). Default `true`; `false` keeps the
   *  ticks + gridlines but drops the line itself — a cleaner look for e.g. a
   *  force diagram that reads off the gridlines alone. */
  axisLine?: boolean;
  /** Inversion — useful for waterfall / mortality / depth charts. */
  reverse?: boolean;
  /** For a multi-axis chart (`yAxes`): which side this value axis stacks on.
   *  Default: the first axis goes left, the rest go right. */
  position?: 'left' | 'right';
  /** Axis colour — tints this axis' line, tick labels and title. An MD3 role
   *  (e.g. `'primary'`) or a raw CSS colour. Defaults to the themed axis colour
   *  (the same muted grey as the x-axis). */
  color?: MdChartColorRole | string;
  /**
   * Rotate this axis' tick labels by this many degrees. Negative leans the text
   * up to the right with its end under the tick — the convention for names too
   * long to sit upright without colliding. Upright labels that don't fit their
   * own band are truncated with an ellipsis instead.
   *
   * Read by `md-bar-chart` for the category axis of a vertical chart.
   */
  labelRotation?: number;
  /**
   * Repeat this axis' tick labels in the opposite gutter as well. A population
   * pyramid is the case it exists for: the rows run out from a centre line in
   * both directions, so a name printed on one side only sits a long way from
   * half the data it names.
   *
   * Read by `md-bar-chart` for the category axis of a horizontal chart.
   */
  mirrorLabels?: boolean;
  /** Stroke style for this axis' own line and tick marks. Default `'solid'`. */
  dash?: MdChartLineStyle;
  /**
   * Stroke style for the gridlines this axis' ticks draw across the plot —
   * horizontal ones for a y axis, vertical ones for an x axis. Default
   * `'solid'`; `'dashed'` / `'dotted'` let the grid recede behind the data.
   * Needs the matching `grid` mode on the chart to be on.
   */
  gridDash?: MdChartLineStyle;
}

/**
 * The detail payload of `mdMarkerClick` / `mdLegendClick` / `mdBarClick`
 * / `mdSliceClick`. Series + datum identifiers are always present so
 * consumers can drive interactive UIs (drill-down, popovers, selection)
 * without re-mapping to chart-internal coordinates.
 */
export interface MdChartClickDetail<T = unknown> {
  /** Series index (0-based) within the `series` array. */
  seriesIndex: number;
  /** Series label / id (if provided). */
  seriesId?: string;
  /** Data-point index within the series. */
  dataIndex: number;
  /** Raw data value at the clicked point. `null` for empty slots. */
  value: MdChartDataPoint;
  /** Original x-axis value at the clicked column (line/area/bar). */
  axisValue?: MdChartAxisValue;
  /** Native pointer event for modifiers (ctrl-click etc.). */
  /** The event that triggered this — a KeyboardEvent when the chart was
   *  activated from the keyboard rather than clicked. */
  nativeEvent: PointerEvent | MouseEvent | KeyboardEvent;
  /** Original series object (re-typed by consumer). */
  series: T;
}

/**
 * Detail payload of `mdHover` — fires continuously as the pointer
 * crosses tooltip-active regions. Throttled to one event per
 * frame.
 */
export interface MdChartHoverDetail {
  /** Index of the highlighted x position (axis-trigger mode). */
  dataIndex: number;
  /** Axis value at the highlighted x position. */
  axisValue?: MdChartAxisValue;
  /** Highlighted series (item-trigger mode) or all series at the x. */
  seriesIndices: number[];
}

/**
 * One visible series' reading at the clicked x position, as `mdAxisClick`
 * reports it — the same rows the tooltip lists there.
 */
export interface MdChartAxisSeriesValue {
  /** Series index (0-based) within the `series` array. */
  seriesIndex: number;
  /** Series `id` (if provided). */
  seriesId?: string;
  /** Series label, as shown in the legend and tooltip. */
  label: string;
  /**
   * Index of the clicked x within THIS series' own `data` array (which differs
   * from the axis `dataIndex` for series carrying their own x values), or `-1`
   * when the series has no point there.
   */
  dataIndex: number;
  /** Raw value there. `null` when this series has no point at that x. */
  value: MdChartDataPoint;
}

/**
 * Detail payload of `mdAxisClick` — a click on the plot background, i.e. inside
 * the plot but not on a mark, a line or a filled area.
 *
 * It reports the x position the click is nearest plus *every visible series'*
 * value there, which is what makes it useful for drill-down: one click gives
 * the whole column, the same way the axis tooltip shows it. Series hidden by a
 * legend toggle are left out.
 */
export interface MdChartAxisClickDetail {
  /** Index of the nearest x position. */
  dataIndex: number;
  /** Original x-axis value at that position. */
  axisValue?: MdChartAxisValue;
  /** Each visible series' value at that x. */
  seriesValues: MdChartAxisSeriesValue[];
  /** Native pointer event for modifiers (ctrl-click etc.). */
  /** The event that triggered this — a KeyboardEvent when the chart was
   *  activated from the keyboard rather than clicked. */
  nativeEvent: PointerEvent | MouseEvent | KeyboardEvent;
}
