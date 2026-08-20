/*
 * Developer-injectable chart tooltips
 * ===========================================================
 * The built-in tooltip is a small MD3 card: the x label, then one
 * row per series (swatch · label · value). `tooltipRenderer` lets a
 * consumer replace that content entirely while the engine keeps
 * owning *placement* — the card is still the `tooltip` CSS part and
 * still flips away from the right/bottom edges.
 *
 * The contract is deliberately plain DOM rather than JSX, so the
 * same callback works from HTML/JS, React, Angular and Vue. A
 * framework renders into a detached node and hands that node back:
 *
 *   React    createRoot(el).render(<Card …/>); return el;
 *   Vue      render(h(Card, …), el);           return el;
 *   Angular  createComponent(Card, …);         return el;
 *   plain JS build it with document.createElement, or return a string
 *
 * SAFETY: a returned string is set as TEXT (`textContent`), never
 * parsed, so untrusted data can't inject markup. Opting into HTML is
 * explicit and named for what it is — `{ unsafeHtml }` — because the
 * string is assigned to `innerHTML` verbatim, with no sanitising. Do
 * not build it from user-controlled data.
 * ===========================================================
 */

import type { MdChartAxisValue } from './types';

/**
 * One series' state at the hovered x position.
 *
 * Appears in {@link MdChartTooltipContext.series} when the series has a real
 * value there, and in {@link MdChartTooltipContext.missing} when it does not
 * (an authored `null` gap, or no datum at all — see `value`).
 */
export interface MdChartTooltipSeries {
  /** Index into the chart's `series` prop (0-based). Stable across hides:
   *  hidden series are omitted entirely rather than renumbered. */
  seriesIndex: number;
  /** Series label — what the legend and the default tooltip show. */
  label: string;
  /** The series' resolved CSS colour (MD3 roles are already mapped to a real
   *  colour, so this can go straight into a style). */
  color: string;
  /**
   * Raw y value at the hovered x.
   *   • `number`    — a real reading (entries in `series`)
   *   • `null`      — the series HAS a datum here and it is null/non-finite:
   *                   "measured, no value"
   *   • `undefined` — the series has no datum here at all: it starts later,
   *                   ends earlier, or was never sampled at this x
   */
  value: number | null | undefined;
  /** `value` run through the chart's `valueFormatter` (or the series' own axis
   *  formatter on a multi-axis chart). `''` for a missing value the formatter
   *  chose not to name. */
  formattedValue: string;
  /** True for the series the pointer is nearest — the one the chart emphasises
   *  while the others dim. At most one entry is focused. */
  focused: boolean;
  /** True for entries in `missing` — i.e. `value` is `null` or `undefined`. */
  missing: boolean;
}

/** Everything the chart knows about the hovered x position. */
export interface MdChartTooltipContext {
  /** Index of the hovered x slot. On a chart whose series carry their own x,
   *  this indexes the merged axis (see `utils/charts/xy.ts`), which is also
   *  what `axisValue` is read from. */
  dataIndex: number;
  /** Raw x value at that slot — a category string, a number, or a Date. */
  axisValue: MdChartAxisValue | undefined;
  /** `axisValue` run through the x-axis `valueFormatter` — the string the
   *  default tooltip uses as its header. */
  axisLabel: string;
  /** Visible series that HAVE a value at this x, in series order. A series with
   *  no sample here is absent from this list (it is in `missing` instead). */
  series: MdChartTooltipSeries[];
  /** Visible series with NO value at this x, in series order. Usually empty;
   *  populated for partial / irregular data, where it lets you render your own
   *  "no reading" treatment. */
  missing: MdChartTooltipSeries[];
  /** Index of the emphasised series, or `-1` when nothing is emphasised (a
   *  single-series chart never emphasises). */
  focusedSeriesIndex: number;
}

/**
 * What a {@link MdChartTooltipRenderer} may return.
 *   • `Node`               — inserted as-is. The safest option, and the one
 *                            framework renderers produce.
 *   • `string`             — set as TEXT. Markup in it is shown, not parsed.
 *   • `{ unsafeHtml }`     — assigned to `innerHTML` with NO sanitising. Only
 *                            for markup you fully control.
 *   • `undefined`          — fall back to the built-in tooltip for this x.
 *   • `null`               — render no tooltip at all for this x.
 */
export type MdChartTooltipContent = Node | string | { unsafeHtml: string } | null | undefined;

/**
 * Builds the tooltip body for the hovered x position. Called on every hover
 * frame, so keep it cheap — and note the engine positions whatever you return,
 * so don't set `position` / `left` / `top` on the outermost node.
 *
 * ```ts
 * chart.tooltipRenderer = (ctx) => {
 *   const el = document.createElement('div');
 *   el.textContent = `${ctx.axisLabel}: ${ctx.series.map((s) => s.formattedValue).join(', ')}`;
 *   return el;
 * };
 * ```
 */
export type MdChartTooltipRenderer = (context: MdChartTooltipContext) => MdChartTooltipContent;

/**
 * Formats a series' MISSING value at the hovered x — `null` for an authored
 * gap, `undefined` for "no datum here". This is the chart's own
 * `valueFormatter`, which the tooltip consults for series it would otherwise
 * omit; returning a non-empty string opts that series into a row.
 */
export type MdChartMissingFormatter = (value: null | undefined) => string;

/** Duck-typed `instanceof Node`, so a node built in another document (an
 *  iframe, a template, a framework's detached renderer) is still recognised. */
export function isDomNode(value: unknown): value is Node {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Node).nodeType === 'number' &&
    typeof (value as Node).nodeName === 'string'
  );
}
