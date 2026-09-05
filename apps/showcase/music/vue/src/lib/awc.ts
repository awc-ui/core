/**
 * `v-awc` — the one thing Vue cannot do with these custom elements.
 *
 * TWO PROBLEMS, ONE DIRECTIVE.
 *
 * 1. OBJECT AND FUNCTION PROPS. `chart.series`, `orgChart.nodes`,
 *    `sparkline.data` and `valueFormatter` have no attribute form. Vue assigns
 *    a value as a DOM property only when the key is already `in` the element,
 *    and on a lazily-upgraded custom element it usually is not yet — so the
 *    value goes out as an attribute and arrives as `[object Object]`. This
 *    assigns to the instance directly. Stencil's lazy proxy keeps own
 *    properties set before an element upgrades, so assigning early is not a
 *    race, it is the supported path.
 *
 * 2. CAMELCASE CUSTOM EVENTS. `@mdSortChange` does NOT work, and the reason is
 *    worth stating precisely because it fails silently. Vue's runtime parses a
 *    listener key as `hyphenate(key.slice(2))` — so the template's
 *    `@mdSortChange` compiles to `onMdSortChange` and the runtime listens for
 *    `md-sort-change`, an event the library never emits. Nothing warns; the
 *    table simply never sorts. (The one escape Vue offers is a prop literally
 *    named `on:mdSortChange`, whose colon skips the hyphenation — usable only
 *    through `v-bind` with a quoted key, which is harder to read than this.)
 *
 * So both halves go through one directive:
 *
 *     <md-table v-awc="{ on: { mdSortChange: onSortChange } }" />
 *     <md-bar-chart v-awc="{ props: { series, xAxis, valueFormatter } }" />
 *
 * Props are re-assigned on every update, which is what a locale switch needs:
 * the formatters close over the translator, and a chart whose `valueFormatter`
 * is not re-assigned keeps labelling its axis in the previous language.
 * Listeners are attached once and only re-bound if the handler identity
 * changes, so a re-render does not stack duplicates.
 *
 * WHAT CHANGED FROM THE TWIN. In the Nuxt build this is `plugins/awc.ts`, a
 * `defineNuxtPlugin` that reaches `nuxtApp.vueApp` to register the directive,
 * and it carries a `getSSRProps` hook so Vue does not warn that the directive
 * has no server-side behaviour. There is no server here and no plugin system to
 * hook into, so it is a plain `Directive` object that `main.ts` hands to
 * `app.directive('awc', …)`, and `getSSRProps` is gone with the renderer that
 * would have called it. The three lifecycle hooks and every line inside them are
 * unchanged.
 */

import type { Directive } from 'vue';

type Listeners = Record<string, EventListener>;

interface AwcBinding {
  props?: Record<string, unknown>;
  on?: Listeners;
}

interface Bound {
  listeners: Listeners;
  attached: Map<string, EventListener>;
}

const bound = new WeakMap<HTMLElement, Bound>();

function applyProps(el: HTMLElement, props: Record<string, unknown> | undefined): void {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    (el as unknown as Record<string, unknown>)[key] = value;
  }
}

function applyListeners(el: HTMLElement, listeners: Listeners | undefined): void {
  // The annotation is load-bearing under `strict`. Without it the fallback
  // literal infers as `{ listeners: {}; attached: Map<any, any> }`, `record`
  // widens to a union with `Bound`, and the `name` in the loop below degrades to
  // `any` — which is how the twin's copy of this file compiles while silently
  // type-checking nothing inside it.
  const record: Bound = bound.get(el) ?? { listeners: {}, attached: new Map() };
  bound.set(el, record);

  // Remove anything that is gone or whose handler identity changed.
  for (const [name, attached] of record.attached) {
    if (listeners?.[name] === record.listeners[name]) continue;
    el.removeEventListener(name, attached);
    record.attached.delete(name);
  }

  for (const [name, handler] of Object.entries(listeners ?? {})) {
    if (record.attached.has(name)) continue;
    // A stable wrapper, so re-binding is driven by handler identity above
    // rather than by the anonymous function a template creates each render.
    const wrapper: EventListener = (event) => handler(event);
    el.addEventListener(name, wrapper);
    record.attached.set(name, wrapper);
  }

  record.listeners = { ...(listeners ?? {}) };
}

export const awcDirective: Directive<HTMLElement, AwcBinding> = {
  mounted(el, binding) {
    applyProps(el, binding.value?.props);
    applyListeners(el, binding.value?.on);
  },
  updated(el, binding) {
    applyProps(el, binding.value?.props);
    applyListeners(el, binding.value?.on);
  },
  unmounted(el) {
    const record = bound.get(el);
    if (!record) return;
    for (const [name, attached] of record.attached) el.removeEventListener(name, attached);
    bound.delete(el);
  },
};
