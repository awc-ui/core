/**
 * Object-valued props, for a build that only emits attributes.
 *
 * `chart.series`, `sparkline.data` and `orgChart.nodes` have no plain attribute
 * form. The React build assigns them to the element instance from an effect;
 * there is no instance here, because this build produces a string of HTML and
 * stops.
 *
 * `serializeProperty` from `@awc-ui/core/hydrate` is the library's own answer:
 * it encodes a structured value into a `serialized:…` string that the component
 * reads back out of its own attribute. It is the same encoder the hydrate
 * runtime uses, so what is written here and what the component parses cannot
 * drift apart.
 *
 * WHAT IT CANNOT CARRY: functions, and — for reasons that belong to the
 * components rather than the format — `xAxis` / `yAxis` / `yAxes`, which do not
 * deserialize from their attributes the way `series` does. Both travel in
 * `data-chart` and are applied by the client script instead; see `charts.mjs`.
 */

import { serializeProperty } from '@awc-ui/core/hydrate';

/**
 * Encode one object prop as the attribute string its component will parse.
 * Nullish input returns `undefined` so `attrs()` omits the attribute rather
 * than writing the string "undefined" for the component to choke on.
 */
export function prop(value) {
  if (value === undefined || value === null) return undefined;
  return serializeProperty(value);
}
