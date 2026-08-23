/**
 * Object-valued props, for a renderer that only emits attributes.
 *
 * `chart.series`, `sparkline.data` and `orgChart.nodes` have no plain attribute
 * form. The React build assigns them to the element instance from an effect;
 * Astro has no instance to assign to, because it produces a string of HTML and
 * stops.
 *
 * The library solves this from the other side. `serializeProperty` from
 * `@awc-ui/core/hydrate` encodes any structured value into a `serialized:…`
 * string, and a component reads that back out of its own attribute — it is the
 * same encoder the hydrate runtime uses when it serializes a rendered tree, so
 * what we write and what the component parses cannot drift apart. Verified
 * end-to-end: a `<md-bar-chart>` given `series` this way server-renders with
 * its heading, legend and accessible data-table description intact.
 *
 * WHAT THIS CANNOT CARRY: functions, and — for reasons that are the
 * components' rather than the format's — `xAxis`, `yAxis` and `yAxes`, which do
 * not deserialize from their attributes the way `series` does. Both go through
 * a small client script instead; see `lib/charts.ts`, which explains why that
 * is free for a canvas-backed component and would not have been for a table.
 */

import { serializeProperty } from '@awc-ui/core/hydrate';

/**
 * Encode one object prop as the attribute string its component will parse.
 *
 * Returns `undefined` for nullish input so a spread omits the attribute rather
 * than writing the string "undefined", which the component would then try to
 * parse and reject.
 */
export function prop(value: unknown): string | number | boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return serializeProperty(value);
}

/**
 * Encode several at once, converting camelCase keys to their dash-case
 * attribute names — Stencil exposes a `xAxis` prop as the `x-axis` attribute,
 * so an unconverted key is simply never seen by the component.
 */
export function props(values: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    const encoded = prop(value);
    if (encoded === undefined) continue;
    out[key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)] = encoded;
  }
  return out;
}
