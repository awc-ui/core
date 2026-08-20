/*
 * Chart engine — render scene
 * ===========================================================
 * The backend-agnostic description of a frame. `computeLayout`
 * (layout.ts) turns a chart spec + theme + size into one of
 * these; the Canvas2D backend knows how to draw
 * it, and the DOM overlay renders `texts`. Keeping the scene
 * declarative means the two renderers can't drift — they consume
 * the identical geometry.
 * ===========================================================
 */

import type { Pt } from './geometry';

/**
 * The most of a chart's width a side legend may take.
 *
 * Shared by the layout, which reserves the gutter, and the overlay, which lays
 * the chips into it: with two different numbers the chips ran past the gutter
 * and printed over the plot, which is exactly what a reserved gutter is for.
 */
export const LEGEND_SIDE_MAX_FRACTION = 0.3;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A stroked polyline (the series line, tessellated). */
export interface ScenePolyline {
  points: Pt[];
  color: string;
  width: number;
  /** On/off dash pattern in px (round-capped). Omitted → solid. */
  dash?: number[];
  /** Owning series (for hover emphasis / dimming). */
  seriesIndex?: number;
  /**
   * Radial geometry (a pie's slice separators), not a cartesian series line.
   *
   * The intro animations are written for a plot with a baseline and a left-to-
   * right sweep: they LIFT a line from the plot's bottom edge, or TRIM it by x.
   * Both are meaningless on a line running from a ring's centre to its rim —
   * lifting slid the separators up the plot while the slices swept angularly,
   * so they arrived from somewhere else and settled at the end. Flagged lines
   * are left alone by those transforms.
   */
  radial?: boolean;
  /**
   * Stroke cap. Defaults to `round`, which is right for a data line but adds a
   * half-width nub past each end of a separator — visible poking out beyond the
   * pie's circumference.
   */
  cap?: CanvasLineCap;
}

/**
 * A shaded band across the plot (an axis value range — Beaufort force, a
 * target zone, off-hours). Painted first, under the gridlines, so it reads as
 * background the data sits on rather than as data.
 */
export interface SceneBand {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/**
 * A filled area between a top polyline and a baseline y, painted
 * with a vertical gradient (color at `y=top` → transparent at the
 * baseline). `points` is the top edge; the renderer closes it down
 * to `baselineY`.
 */
export interface SceneArea {
  points: Pt[];
  baselineY: number;
  colorTop: string;
  colorBottom: string;
  /**
   * Optional bottom edge (same x-sampling as `points`, reversed at draw time).
   * Stacked areas set this to their band base so each layer fills only its own
   * slice instead of down to the global zero line. Absent → close to baselineY.
   */
  basePoints?: Pt[];
  /**
   * Fill sideways (left→right) instead of top→bottom. An inverted chart's value
   * axis is horizontal, so its areas run out from a baseline X — the gradient
   * has to fade along that direction or it reads as a band with a stray
   * vertical wash across it.
   */
  horizontal?: boolean;
  /** Owning series (for hover emphasis / dimming). */
  seriesIndex?: number;
}

/** An end-of-line series-name label (racing charts). Rendered into a persistent,
 *  keyed layer so it can fade in/out as collisions open and close. */
export interface EndLabel {
  /** Stable key (series id) for cross-frame reconciliation + the fade. */
  key: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  /** False when this label collides with a higher one → fades out. */
  visible: boolean;
  /**
   * Which way the text extends from the line's end point. `start` (default)
   * puts it to the right, following an LTR line that ends on the right; `end`
   * puts it to the left, which is where a mirrored (RTL) line ends.
   */
  side?: 'start' | 'end';
}

/** A data-point marker. `symbol` selects the shape (default circle). */
export interface SceneMarker {
  x: number;
  y: number;
  r: number;
  color: string;
  /** Shape — 'circle' (default) | 'square' | 'diamond' | 'triangle' | 'triangle-down'. */
  symbol?: import('../types').MdChartSymbol;
  /** Owning series (for hover emphasis / dimming). */
  seriesIndex?: number;
  /** Open marker: stroke in `color`, fill with `fill` (the surface) so the line
   *  is occluded and the point reads as a ring. */
  hollow?: boolean;
  /** Interior fill for a hollow marker (usually the surface colour). */
  fill?: string;
}

/** An emoji / short-text point marker, or a data-value label, drawn by the DOM
 *  overlay so it can animate with the point each frame. Anchored at (x, y). */
export interface GlyphMarker {
  x: number;
  y: number;
  text: string;
  /** Font size in px. */
  size: number;
  /**
   * Present → render as a styled data label (offset from the point, bold,
   * themed) instead of a centred emoji. dx/dy offset the anchor; anchorX/anchorY
   * are the CSS translate percentages.
   */
  label?: { color: string; weight: number; dx: number; dy: number; anchorX: string; anchorY: string };
}

/**
 * A filled bar rectangle. `radius` are the four corner radii in
 * CSS order `[topLeft, topRight, bottomRight, bottomLeft]` so the
 * renderers can round only the "outer" end (top for vertical bars,
 * inline-end for horizontal). Carries its category + series index
 * for hit-testing.
 */
export interface SceneBar {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  radius: [number, number, number, number];
  seriesIndex: number;
  dataIndex: number;
  /**
   * True for a horizontal-bar-chart bar (value runs along x). The intro/draw
   * animations need this because a short vertical bar can be wider than it is
   * tall, so the `w > h` aspect-ratio heuristic would misclassify it.
   */
  horizontal?: boolean;
  /**
   * Draw the bar as a CHEVRON pointing along the value axis: `1` toward the
   * high end, `-1` toward the low end, `0`/absent for an ordinary rectangle.
   *
   * The leading edge comes to a point and the trailing edge is cut with the
   * matching notch, so a chain of them interlocks — which is what a force
   * diagram is: contributions handed along in a direction, not stacked
   * quantities that happen to touch. Overrides `radius`.
   */
  arrow?: -1 | 0 | 1;
  /**
   * Cut the matching notch out of the TRAILING edge. Default true wherever
   * `arrow` is set; false for the segment sitting on the baseline, which has no
   * neighbour behind it to fill the notch — two stacks meeting at zero would
   * otherwise leave a lens-shaped hole between their two tails.
   */
  notch?: boolean;
}

/**
 * A pie / donut slice (an annular sector). Angles are in radians in
 * screen space (0 = +x / 3-o'clock, clockwise since y points down).
 * `innerR` 0 = solid pie; > 0 = donut ring.
 */
export interface SceneSlice {
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  startAngle: number;
  endAngle: number;
  color: string;
  dataIndex: number;
  /** Owning series — set on a polar bar's ring segments so a hover can resolve
   *  the exact segment (category + series), not just the ring. */
  seriesIndex?: number;
  /** Corner rounding in px, applied where the outer arc meets each radial edge.
   *  Clamped by the renderer against the slice's own size. */
  cornerRadius?: number;
  /**
   * Separation from the neighbouring slices, in px — cut out of THIS slice's
   * own geometry rather than painted over it afterwards.
   *
   * Drawing the wedges edge to edge and stroking a line along each join is the
   * obvious way and it goes wrong in three places at once: the line keeps its
   * width while the wedge tapers, so it swallows a narrow slice's tip; every
   * join's line converges on the apex, where they pool into a blob; and a
   * stroke laid over two antialiased shapes that already meet blends with both.
   * A gap that is part of the shape has none of those failure modes — nothing
   * overlaps anything.
   *
   * Each radial edge is inset by half of this — a constant perpendicular
   * offset, so the separation reads the same width at the hub as at the rim.
   * Two such edges cross at `g / sin(sweep/2)`, which is why a solid pie's
   * slices are given a small common `innerR` to stop at rather than being run
   * to a point: past that crossing there is no wedge left to draw.
   */
  gap?: number;
  /** What shows through the gap. Painted as one shape under all the slices, so
   *  a consumer can set a separator colour that isn't the chart's background. */
  gapColor?: string;
  /**
   * Fill with a gradient running outward along the slice's own mid-angle,
   * rather than flat. Decorative: it gives the ring depth without changing what
   * any slice means, so it is opt-in.
   */
  gradient?: { from: string; to: string };
  /**
   * Draw as a pill-ended band rather than a filled wedge — a stroked arc with
   * round caps. Filling gives square INNER corners (the corner rounding only
   * reaches the outer ones), and on a thin band those corners are the whole
   * shape: they poked past the slice they sit on. Stroking rounds both ends by
   * construction.
   */
  pill?: boolean;
  /**
   * Per-end round caps for a `pill` band. When EITHER is set, the arc is stroked
   * with flat (butt) ends and a round cap disc is added only where flagged — so a
   * chain of stacked segments abuts seamlessly (no rounded split at every join)
   * while the whole ring keeps a rounded head and tail. Absent (both undefined) →
   * the pill keeps round caps on both ends (a lone band / the pie's thin slice).
   */
  capStart?: boolean;
  capEnd?: boolean;
}

/**
 * A press ripple, clipped to the slice it started on.
 *
 * Declared on the scene rather than painted by the engine directly so it rides
 * along with whatever geometry that frame holds — including a drill in flight,
 * where the wedge it is clipped to is busy opening out into the next level.
 */
export interface SceneRipple {
  /** The slice it belongs to; it is clipped to that wedge's own path. */
  dataIndex: number;
  /** Where the press landed, in canvas px. */
  x: number;
  y: number;
  radius: number;
  color: string;
  /** 0..1, multiplied into whatever alpha the frame is already drawing at. */
  alpha: number;
}

/** A straight line — gridlines and axis lines. */
export interface SceneSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  /** Optional dash pattern (gridlines). */
  dash?: number[];
}

/**
 * A value label bound to a bar (by its series + data index) rather than to a
 * fixed position. The bar-label overlay recomputes its screen position from the
 * bar's CURRENT geometry every frame, so — unlike a {@link TextItem}, which is
 * synced once at the final layout — it tracks the bar as it grows in during the
 * entry animation instead of snapping to the final tip. `inside` centres it
 * within the bar (a stacked segment); otherwise it sits just past the bar's free
 * (value) end, on the low side when `atLowEnd` is set (a negative bar).
 */
export interface BarLabel {
  seriesIndex: number;
  dataIndex: number;
  text: string;
  color: string;
  size: number;
  fontWeight?: number;
  inside?: boolean;
  atLowEnd?: boolean;
}

/** A positioned text label rendered by the DOM overlay. */
export interface TextItem {
  x: number;
  y: number;
  text: string;
  color: string;
  /** CSS font shorthand or size in px (overlay resolves family). */
  fontSize: number;
  fontWeight?: number;
  align: 'start' | 'center' | 'end';
  baseline: 'top' | 'middle' | 'bottom';
  /** Rotation in degrees (rotated axis labels), default 0. */
  rotate?: number;
  /** A stable key so the overlay can diff/reuse nodes. */
  key: string;
}

/** A data point's pixel position + raw value, for hover lookup. */
export interface HoverPoint {
  x: number;
  y: number;
  value: number;
  /** Both edges, for a range series — the tooltip prints `low – high` rather
   *  than the single `value` (which is only the band's top). */
  low?: number;
  high?: number;
  /** Effective marker at this point (shape keyword or emoji) so the hover
   *  highlight matches it instead of always drawing a circle. */
  symbol?: string;
  /**
   * The point's OWN resolved colour, when it differs from the series colour — a
   * bar whose fill came from `pointColors` (a bar race, a per-category palette).
   * The hover dot and the tooltip swatch prefer it so they match the bar under
   * the cursor rather than the series default. Absent → the series colour.
   */
  color?: string;
}

/** Per-series hover index — maps an x data index to its point. */
export interface HoverSeries {
  seriesIndex: number;
  color: string;
  label: string;
  /**
   * The series draws neither a line nor markers, so there is no point for a
   * hover highlight to sit on — a fill-only layer or a range band. The dot
   * would land on the band's TOP EDGE, which on a stack is a cumulative total
   * and not a reading this series ever took. The crosshair and the tooltip row
   * still show; only the dot is dropped.
   */
  unanchored?: boolean;
  /** index → point (only for non-null, non-hidden points). */
  byIndex: Record<number, HoverPoint>;
  /**
   * The series' values aligned to the same indices as `byIndex`, INCLUDING the
   * ones that have no point: `null` where the series has a datum that is null
   * (or non-finite), `undefined` where it has no datum at all. Lets the tooltip
   * tell the two absences apart and offer a row for either.
   */
  values?: readonly (number | null | undefined)[];
  /** Per-series value formatter — set for multi-axis charts so each series'
   *  tooltip value uses its own axis formatter. Falls back to the chart's. */
  valueFormat?: (v: number) => string;
}

/** A legend entry (rendered in the DOM overlay, clickable). */
export interface LegendItem {
  label: string;
  color: string;
  seriesIndex: number;
  hidden: boolean;
  x: number;
  y: number;
}

/**
 * Everything needed to paint one frame. `plot` is the inner
 * drawing rect (inside axis gutters); the backends clip series
 * geometry to it.
 */
export interface RenderScene {
  /**
   * Pixel position of the value axis' ZERO line, along the value axis (a y for
   * a vertical bar chart, an x for a horizontal one).
   *
   * The entry animation needs it: a bar has to grow from the line its value is
   * measured against, and for every segment of a stack but the first that line
   * is NOT its own base. Scaling each segment about its own edge collapses a
   * stack into a row of separate slivers partway up the plot instead of one
   * column rising off the axis. Absent for charts with no bars.
   */
  barBaseline?: number;
  width: number;
  height: number;
  plot: Rect;
  background?: string;
  /** Shaded axis ranges behind everything else (empty for most charts). */
  bands?: SceneBand[];
  gridlines: SceneSegment[];
  axisLines: SceneSegment[];
  areas: SceneArea[];
  /** Filled bars (bar chart / bar sparkline) — empty for line charts. */
  bars: SceneBar[];
  /** Pie / donut slices — empty for cartesian charts. */
  slices: SceneSlice[];
  lines: ScenePolyline[];
  markers: SceneMarker[];
  /** DOM-overlay emoji / text point markers (empty for most charts). */
  glyphs?: GlyphMarker[];
  /** End-of-line series-name labels (collision-managed, fade in/out). */
  endLabels?: EndLabel[];
  /** DOM-overlay text (tick labels, title, axis titles). */
  texts: TextItem[];
  /** DOM-overlay value labels bound to bars, repositioned from the bars' live
   *  geometry each frame so they animate with the bars (absent for non-bar
   *  charts, and for the range / stack-total labels which stay in `texts`). */
  barLabels?: BarLabel[];
  /** DOM-overlay legend (clickable) — empty when no legend. */
  legend: LegendItem[];
  /** Legend anchor: `top-start` … `bottom-end` / `left` / `right`. */
  legendPosition?: string;
  /**
   * Where a pie's centre-slot content should be anchored.
   *
   * NOT the plot rect's centre. A pie that sweeps less than a full turn is
   * fitted to the sector it actually paints, so its ring centre sits wherever
   * that sector's flat side is — the bottom edge, for a top half-donut. And the
   * hole of a half-donut is a half-disc, whose middle is above the ring centre,
   * so anchoring at the centre puts the caption across the arc rather than
   * inside it.
   */
  pieCenterSlot?: { x: number; y: number };
  /** The ring's own centre — the point every slice is measured from. Not the
   *  plot centre once a partial sweep is fitted to its sector, and not
   *  `pieCenterSlot`, which is the middle of the hole. */
  pieCenter?: { x: number; y: number };
  /** Width of the largest rectangle inside a donut's hole, so centre-slot
   *  content can size itself against the space it actually has instead of
   *  spilling over the ring. */
  pieHoleSize?: number;
  /** Height of that same rectangle. */
  pieHoleHeight?: number;
  /** Axes are transposed (independent axis vertical, value axis horizontal) —
   *  the engine hit-tests hover by y and draws a horizontal crosshair. */
  inverted?: boolean;
  /** Polar (radial) BAR chart: the slices are concentric ring bands, so the
   *  intro sweeps each ring along its ANGLE (drawn from nothing to its end) at a
   *  fixed radius, rather than blooming a pie's wedges out from the centre. */
  polar?: boolean;
  /** Per-x pixel positions for hover hit-testing (category/value x). For an
   *  inverted chart these are the vertical (main-axis) pixel positions. */
  xPositions: number[];
  /** The original x values (for tooltip headers). */
  xValues: import('../types').MdChartAxisValue[];
  /** Formatted x label per index (tooltip header). */
  xLabels: string[];
  /** Per-series data-point index for hover crosshair + tooltip. */
  hoverPoints: HoverSeries[];
  /** A press ripple in flight (pie/donut). */
  ripple?: SceneRipple;
}
