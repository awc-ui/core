/**
 * Chart configuration that cannot travel in an attribute.
 *
 * Two things forced this, and together they make it the right shape rather than
 * a workaround.
 *
 * 1. `xAxis` / `yAxis` / `yAxes` do not deserialize from their attributes,
 *    though `series` does — an inconsistency in the components' prop
 *    declarations, reported upstream. Set them from markup and the chart draws
 *    with `0..6` down the axis instead of the category names, with no error.
 * 2. `valueFormatter` is a closure over the translator and could never have
 *    travelled in an attribute under any circumstances.
 *
 * Paying for a script here costs this build NOTHING, which is the part worth
 * understanding. A chart draws into a `<canvas>`, and a canvas cannot be
 * server-painted; the plot is already conditional on JavaScript in every one of
 * the six framework builds. So handing the chart its axes from a script makes no
 * page worse than it already was — whereas doing the same for the tables would
 * have, which is why those are rendered fully on the server.
 *
 * `series` deliberately stays on the attribute even though this script could
 * carry it. It works, and it is what makes the component's accessible data
 * table — the screen-reader-readable version of the plot — render on the server.
 * That table is the one thing that makes a canvas chart legible with JavaScript
 * off, so it is worth the split.
 */

/** What a chart needs that markup cannot give it. */
export interface ChartConfig {
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  yAxes?: Record<string, unknown>[];
  /**
   * How to format a value: `currency` in the base currency, `percent`, or
   * `number`. A name rather than a function, because this crosses into the
   * page as JSON and is turned back into a real formatter on the client.
   */
  format?: 'currency' | 'percent' | 'number';
  /** Which of `yAxes` each format applies to, when they differ per axis. */
  axisFormats?: ('currency' | 'percent' | 'number')[];
}

/** Serialise a config for the `data-chart` attribute. */
export function chartConfig(config: ChartConfig): string {
  return JSON.stringify(config);
}
