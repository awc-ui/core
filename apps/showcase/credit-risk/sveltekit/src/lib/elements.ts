/**
 * The two things Svelte cannot do with a custom element, done once.
 *
 * 1. OBJECT PROPS. `chart.series`, `orgChart.nodes` and `sparkline.data` have no
 *    attribute form — Svelte would stringify them to `[object Object]`. The
 *    `objectProps` action assigns them to the element INSTANCE instead.
 *    Stencil's lazy proxy keeps own properties set before an element upgrades,
 *    so it does not matter whether the runtime has finished loading.
 * 2. FUNCTION PROPS. `valueFormatter` closes over the translator and could
 *    never have travelled in an attribute at all. Same action, same reason.
 *
 * Everything else — strings, numbers, booleans — is a plain attribute and needs
 * none of this. Custom EVENTS need nothing either: Svelte's `on:mdSortChange`
 * is a real `addEventListener`, not a mapped React-style prop, so the library's
 * `md*` events just work.
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
  apply(values);
  return { update: apply };
};

export interface ChartSeries {
  label: string;
  data?: (number | null)[];
  id?: string;
  /** Which entry of `yAxes` measures this series. Omit for the first axis. */
  yAxisIndex?: number;
}

export interface OrgNode {
  id: string;
  name: string;
  title?: string;
  avatarInitials?: string;
  children?: OrgNode[];
}
