/**
 * The one thing Svelte cannot do with a custom element, done once.
 *
 * OBJECT AND FUNCTION PROPS. `chart.series`, `orgChart.nodes`,
 * `transferList.items`, `autocomplete.options`, `rating.getLabel`,
 * `sparkline.data` — none has an attribute form, and Svelte would stringify
 * them to `[object Object]`. The `objectProps` action assigns them to the
 * element INSTANCE instead. Stencil's lazy proxy keeps own properties set
 * before an element upgrades, so it does not matter whether the runtime has
 * finished loading.
 *
 * Everything else the React build needed a hook for, Svelte has syntax for:
 *
 * - CUSTOM EVENTS (`useCustomEvent` there): `on:mdSortChange` is a real
 *   `addEventListener` — the library's `md*` events just work, on the element
 *   or on any ancestor they bubble to.
 * - CAPTURE-PHASE NATIVE LISTENERS (`useDomEvent(…, true)` there): the
 *   `on:click|capture` modifier. The compact navigation bar needs it —
 *   `md-navigation-tab` reads `event.defaultPrevented` BEFORE it acts, so only
 *   a capture-phase ancestor listener can have set it.
 *
 * Strings, numbers and booleans are plain attributes and need none of this.
 * NEVER bind a literal `false` into a boolean attribute (`disabled={cond}`
 * where the element is form-associated is fine — Svelte omits `false` — but a
 * string `"false"` is presence, and presence disables).
 */

import type { Action } from 'svelte/action';

/**
 * Assign object- and function-valued props to a custom element.
 *
 * `update` re-assigns on every change, which is what a locale switch needs: the
 * formatters are closures over the translator, and a chart whose
 * `valueFormatter` is not re-assigned keeps labelling its axis in the previous
 * language.
 */
export const objectProps: Action<HTMLElement, Record<string, unknown>> = (node, values) => {
  const apply = (next: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(next ?? {})) {
      if (value === undefined) continue;
      (node as unknown as Record<string, unknown>)[key] = value;
    }
  };
  apply(values ?? {});
  return { update: apply };
};

export interface ChartSeries {
  label: string;
  data?: (number | null)[];
  id?: string;
  /** Which entry of `yAxes` measures this series. Omit for the first axis. */
  yAxisIndex?: number;
}
