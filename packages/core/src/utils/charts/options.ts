/*
 * Shared chart helpers (renderer-agnostic)
 * ===========================================================
 * What remains of the old ECharts option module after the charts
 * moved to the in-house engine: two small, pure helpers still used
 * across every md-* chart. The engine's own layout/scale/geometry
 * live under `./engine`.
 * ===========================================================
 */

import type { MdChartAxisValue } from './types';

/**
 * Stable colour selector. Cycles through the palette for series
 * that didn't supply a colour. Series colour spec is resolved
 * separately via `resolveSeriesColor()` (theme.ts).
 */
export function pickPaletteColor(palette: string[], seriesIndex: number): string {
  return palette[seriesIndex % palette.length];
}

/**
 * Default value formatter — locale-aware. Used by tooltips,
 * axis labels, and a11y text when the consumer doesn't supply
 * one of their own.
 */
export function defaultValueFormatter(v: MdChartAxisValue, locale?: string): string {
  if (v == null) return '';
  // An empty/absent locale means "whatever Intl resolves" — the browser's, which
  // is the right default when the page hasn't said otherwise.
  const l = locale || undefined;
  if (v instanceof Date) return v.toLocaleString(l);
  if (typeof v === 'number') return v.toLocaleString(l);
  return String(v);
}
