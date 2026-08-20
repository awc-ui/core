/*
 * Chart accessibility helpers
 * ===========================================================
 * Charts are a tricky a11y surface because:
 *   • SVG nodes carry no inherent semantics to screen readers;
 *     a bare `<svg>` of a line chart announces as "graphic"
 *     with no values.
 *   • Sighted users get visual tooltips on hover; SR users
 *     need text equivalents triggered by keyboard focus.
 *   • Data tables are the WCAG-required fallback for visual
 *     charts (SC 1.3.1, 1.1.1); even with rich SVG semantics,
 *     a screen-reader-only table is the most-reliable backstop.
 *
 * Our pattern (matches BBC, GOV.UK, and Highcharts' a11y
 * module):
 *   • Host element gets `role="img"` + an aria-label summary.
 *   • A visually-hidden `<table>` mirrors the chart data,
 *     announced when the user tabs into it.
 *   • An aria-live region narrates hover / focus events so
 *     keyboard + SR users get the same tooltip text as
 *     pointer users.
 * ===========================================================
 */

import type { MdChartAxisValue, MdChartRangeDatum, MdChartSeries } from './types';
import { defaultValueFormatter } from './options';
import { normalizeRange } from './xy';

/**
 * Compose the chart's `aria-label` summary. Keep it under
 * ~120 chars — screen readers truncate long labels and the
 * full data lives in the SR-only table anyway.
 */
/**
 * Translatable strings for the generated chart summary. Each is a plain string
 * a consumer hands over from their own dictionary — the components stay
 * i18n-engine-agnostic. `%count%` / `%min%` / `%max%` are substituted.
 */
export interface MdChartSummaryLabels {
  line?: string;
  area?: string;
  bar?: string;
  pie?: string;
  sparkline?: string;
  /** e.g. `'with %count% series'`. */
  series?: string;
  /** A pie's parts are slices, not series — e.g. `'with %count% slices'`. Used
   *  in place of `series` for `chartType: 'pie'`. */
  slices?: string;
  /** e.g. `'from %min% to %max%'`. */
  range?: string;
}

export function buildChartSummary(opts: {
  title?: string;
  chartType: 'line' | 'area' | 'bar' | 'pie' | 'sparkline';
  seriesCount: number;
  xMin?: MdChartAxisValue;
  xMax?: MdChartAxisValue;
  /** BCP-47 locale for the formatted range. */
  locale?: string;
  labels?: MdChartSummaryLabels;
}): string {
  const l = opts.labels ?? {};
  const verb =
    opts.chartType === 'pie'
      ? l.pie ?? 'Pie chart'
      : opts.chartType === 'bar'
        ? l.bar ?? 'Bar chart'
        : opts.chartType === 'area'
          ? l.area ?? 'Area chart'
          : opts.chartType === 'sparkline'
            ? l.sparkline ?? 'Sparkline'
            : l.line ?? 'Line chart';
  const parts: string[] = [];
  if (opts.title) parts.push(opts.title);
  parts.push(verb);
  if (opts.chartType === 'pie') {
    // A pie has slices, and its count is worth saying even at one — "Pie chart."
    // alone tells a screen-reader user nothing about how much is in it.
    if (opts.seriesCount > 0) {
      const tpl = l.slices ?? (opts.seriesCount === 1 ? 'with %count% slice' : 'with %count% slices');
      parts.push(tpl.replace('%count%', String(opts.seriesCount)));
    }
  } else if (opts.seriesCount > 1) {
    parts.push((l.series ?? 'with %count% series').replace('%count%', String(opts.seriesCount)));
  }
  if (opts.xMin != null && opts.xMax != null && opts.chartType !== 'pie') {
    parts.push(
      (l.range ?? 'from %min% to %max%')
        .replace('%min%', defaultValueFormatter(opts.xMin, opts.locale))
        .replace('%max%', defaultValueFormatter(opts.xMax, opts.locale)),
    );
  }
  return parts.join(', ') + '.';
}

/**
 * Build the screen-reader-only HTML data table for the chart.
 * Returns an HTML string so the host can inject it with
 * `innerHTML` on a hidden node; no per-cell DOM manipulation
 * needed.
 *
 * Caveats:
 *   • Series with > 200 rows are truncated to 200 (an SR user
 *     reading row-by-row past 200 is rare enough that we trade
 *     completeness for performance). The full data is still
 *     accessible programmatically via the component instance.
 *   • Categorical / time / numeric x-axes all flatten to
 *     strings via the user formatter (or the default).
 */
export function buildDataTableHtml(opts: {
  title?: string;
  xAxisLabel?: string;
  xAxisData?: readonly MdChartAxisValue[];
  xValueFormatter?: (v: MdChartAxisValue) => string;
  /** `undefined` in `data` is a slot this series has no sample for (see
   *  `utils/charts/xy.ts`) and prints the same as a `null` gap. A series with
   *  `range` is a band: its cells print `low–high`, since `data` holds no
   *  reading for it. */
  series: readonly {
    label?: string;
    data: readonly (number | null | undefined)[];
    range?: readonly MdChartRangeDatum[];
  }[];
  valueFormatter?: (v: number | null) => string;
  /** BCP-47 locale for the default number / date formatting. */
  locale?: string;
  /** Translatable table chrome. `%shown%` / `%total%` are substituted. */
  labels?: {
    /** Header over the x column when the chart has an x axis. Default `X`. */
    x?: string;
    /** Header over the row-number column when it doesn't. Default `#`. */
    index?: string;
    /** Fallback header for a series with no label. Default `Series`. */
    series?: string;
    /** Default `Showing first %shown% of %total% rows.` */
    truncated?: string;
  };
}): string {
  const MAX = 200;
  const lb = opts.labels ?? {};
  const fmtX = opts.xValueFormatter ?? ((v: MdChartAxisValue) => defaultValueFormatter(v, opts.locale));
  const fmtY =
    opts.valueFormatter ??
    ((v: number | null) => (v == null ? '—' : v.toLocaleString(opts.locale || undefined)));
  // Charts render fine without an explicit x-axis (points/bars plot by data
  // index), so the SR table must too: fall back to the series' own length and
  // number the rows, otherwise a visually-populated chart has an empty table.
  const hasX = (opts.xAxisData?.length ?? 0) > 0;
  const total = hasX
    ? opts.xAxisData!.length
    : Math.max(0, ...opts.series.map(s => (s.range ? s.range.length : s.data.length)));
  const n = Math.min(total, MAX);
  const rowsArr: string[] = [];
  for (let i = 0; i < n; i++) {
    const cells = opts.series
      .map(s => {
        if (s.range) {
          const b = normalizeRange(s.range[i]);
          // En dash, not a hyphen: a screen reader reads "3 to 9" for a range
          // and "3 minus 9" for a hyphen between two numbers.
          return `<td>${escapeHtml(b ? `${fmtY(b[0])}–${fmtY(b[1])}` : fmtY(null))}</td>`;
        }
        return `<td>${escapeHtml(fmtY(s.data[i] ?? null))}</td>`;
      })
      .join('');
    const rowHeader = hasX ? fmtX(opts.xAxisData![i]) : String(i + 1);
    rowsArr.push(`<tr><th scope="row">${escapeHtml(rowHeader)}</th>${cells}</tr>`);
  }
  const rows = rowsArr.join('');
  const head = opts.series
    .map(s => `<th scope="col">${escapeHtml(s.label ?? lb.series ?? 'Series')}</th>`)
    .join('');
  const caption = opts.title ? `<caption>${escapeHtml(opts.title)}</caption>` : '';
  const truncatedNote =
    total > MAX
      ? `<tfoot><tr><td colspan="${1 + opts.series.length}">${escapeHtml(
          (lb.truncated ?? 'Showing first %shown% of %total% rows.')
            .replace('%shown%', String(MAX))
            .replace('%total%', String(total)),
        )}</td></tr></tfoot>`
      : '';
  return `<table>
    ${caption}
    <thead><tr><th scope="col">${escapeHtml(
      opts.xAxisLabel ?? (hasX ? lb.x ?? 'X' : lb.index ?? '#'),
    )}</th>${head}</tr></thead>
    <tbody>${rows}</tbody>
    ${truncatedNote}
  </table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
