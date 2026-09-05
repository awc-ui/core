/**
 * The three things React 18 cannot do with a custom element, done once.
 *
 * 1. OBJECT PROPS. `chart.series`, `sparkline.data`, a chart's `valueFormatter`
 *    — none has an attribute form, and React 18 would stringify them to
 *    `[object Object]`. They are assigned to the element instance in an effect.
 *    Stencil's lazy proxy picks up own properties set before the element
 *    upgrades, so it does not matter whether the runtime has finished loading.
 * 2. CUSTOM EVENTS. `onMdTabChange` is not a React prop; React 18 only maps
 *    known DOM events. `useCustomEvent` attaches a real listener.
 * 3. TYPES. See `types/custom-elements.d.ts`.
 *
 * Everything else — strings, numbers, booleans — is a plain attribute and needs
 * none of this. Stencil parses `"true"`/`"false"` back to booleans, which is
 * what React writes for a boolean JSX value.
 *
 * THE CONTRACT FOR SCREENS. Charts go through the wrappers below; do not emit
 * `md-line-chart` yourself, because the `series` prop will silently do nothing.
 * Anything else is a plain `md-*` tag with plain attributes.
 */

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useT } from '@/lib/showcase';

/** A ref the caller owns, so a screen can attach `mdBarClick` to a chart it renders. */
export type ElementRef = MutableRefObject<HTMLElement | null>;

/**
 * Assign object/function props to a custom element after render.
 *
 * `deps` decides when to re-assign. Pass the values the props were built from,
 * not the props object — it is a fresh literal on every render and would make
 * the effect run forever.
 */
export function useElementProps<T extends HTMLElement>(
  props: Record<string, unknown>,
  deps: unknown[],
): MutableRefObject<T | null> {
  const ref = useRef<T | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const [key, value] of Object.entries(latest.current)) {
      (el as unknown as Record<string, unknown>)[key] = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Attach a listener for one of the library's `md*` custom events.
 *
 * The listener is removed before it is re-added, so React's double-invoked
 * effects in StrictMode cannot leave two of them attached.
 */
export function useCustomEvent<E extends CustomEvent>(
  ref: MutableRefObject<HTMLElement | null>,
  name: string,
  handler: (event: E) => void,
): void {
  const latest = useRef(handler);
  latest.current = handler;

  /*
   * NO DEPENDENCY ARRAY, AND THAT IS THE WHOLE POINT.
   *
   * With `[ref, name]` this ran exactly once, at mount — and a ref OBJECT is
   * stable, so nothing ever told the effect that `ref.current` had gone from
   * null to an element. Any element rendered CONDITIONALLY inside the same
   * component that binds it therefore got no listener at all: the composer's
   * text field is behind an `open` flag, so on first render there was nothing
   * to attach to, and when it appeared the effect never re-ran. Typing into it
   * did nothing and the Post button stayed disabled for ever, silently — no
   * error, no warning, a field that simply was not wired.
   *
   * Re-running after every render is the fix, and it is cheap: `latest` already
   * holds the current handler so nothing here depends on the closure, and
   * add/removeEventListener on one element is nothing next to the render that
   * just happened. The alternative — a callback ref — would change every call
   * site in the app to catch a case this handles in one line.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = (event: Event) => latest.current(event as E);
    el.addEventListener(name, listener);
    return () => el.removeEventListener(name, listener);
  });
}

/**
 * Attach a NATIVE listener, optionally in the capture phase.
 *
 * The shell needs this and nothing else does: a rail tab and a navigation tab
 * both act on the native `click`, so vetoing their navigation means getting in
 * front of them rather than listening for the `md*` event they emit afterwards.
 * `md-navigation-tab` in particular checks `event.defaultPrevented` BEFORE it
 * acts, which only a capture-phase listener on an ancestor can have set.
 */
export function useDomEvent<K extends keyof HTMLElementEventMap>(
  ref: MutableRefObject<HTMLElement | null>,
  name: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  capture = false,
): void {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = (event: Event) => latest.current(event as HTMLElementEventMap[K]);
    el.addEventListener(name, listener, capture);
    return () => el.removeEventListener(name, listener, capture);
  }, [ref, name, capture]);
}

/* ------------------------------------------------------------------ charts */

export interface ChartSeries {
  label: string;
  data?: (number | null)[];
  id?: string;
  /** Which entry of `yAxes` measures this series. Omit for the first axis. */
  yAxisIndex?: number;
}

interface ChartProps {
  series: ChartSeries[];
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  /** Multiple value axes. Supersedes `yAxis`; series pick one via `yAxisIndex`. */
  yAxes?: Record<string, unknown>[];
  valueFormatter?: (value: number | null) => string;
  /** Locale, for the effect deps — see `useChart`. Also a real chart attribute. */
  locale?: string;
  /** Hands the host element back so the screen can listen for `mdBarClick`. */
  elementRef?: ElementRef;
  /** Anything the readme lists as an attribute. */
  [attribute: string]: unknown;
}

/**
 * `deps` for a chart: the data identity plus the locale. `valueFormatter` closes
 * over the translator, so a locale change has to re-assign it or the axis keeps
 * formatting in the previous language.
 */
function useChart(props: ChartProps) {
  const { series, xAxis, yAxis, yAxes, valueFormatter, elementRef, ...attributes } = props;
  // `yAxes` carries an array of axis objects and per-axis valueFormatter
  // functions, so like the others it has to be assigned as a JS property — an
  // attribute would stringify it to "[object Object]".
  const internal = useElementProps({ series, xAxis, yAxis, yAxes, valueFormatter }, [
    JSON.stringify(series),
    JSON.stringify(xAxis),
    JSON.stringify(yAxis),
    JSON.stringify(yAxes?.map(({ valueFormatter: _fn, ...rest }) => rest)),
    props.locale,
  ]);

  // Both refs are stable objects, so this callback ref is stable too and React
  // does not detach/reattach it on every render.
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      internal.current = node;
      if (elementRef) elementRef.current = node;
    },
    [internal, elementRef],
  );

  // A chart's plot is a focusable `role="application"` region, and its name
  // comes from `label-plot`, whose default is an English sentence. Defaulted
  // here rather than at each call site so no chart can be added without one.
  // A call site may still override it.
  const t = useT();
  const withPlotLabel = { 'label-plot': t('music.chart.plotHint'), ...attributes };

  return { setRef, attributes: withPlotLabel };
}

export function BarChart(props: ChartProps) {
  const { setRef, attributes } = useChart(props);
  return <md-bar-chart ref={setRef} {...attributes} />;
}

export function LineChart(props: ChartProps) {
  const { setRef, attributes } = useChart(props);
  return <md-line-chart ref={setRef} {...attributes} />;
}

export function AreaChart(props: ChartProps) {
  const { setRef, attributes } = useChart(props);
  return <md-area-chart ref={setRef} {...attributes} />;
}

/**
 * The donut / pie.
 *
 * `md-pie-chart`'s payload prop is `data`, NOT `series` — it is the one chart
 * in the library that differs. Routing it through the shared `useChart` would
 * assign `series` and render an empty ring, which is why this takes its own
 * prop and assigns it directly. The wealth build hit the same trap and worked
 * around it with a local component per screen; doing it here means a screen
 * cannot get it wrong.
 */
export function PieChart({
  data,
  valueFormatter,
  locale,
  elementRef,
  ...attributes
}: {
  data: { id?: string; label: string; value: number; color?: string }[];
  valueFormatter?: (value: number | null) => string;
  locale?: string;
  elementRef?: ElementRef;
  [attribute: string]: unknown;
}) {
  const ref = useElementProps<HTMLElement>({ data, valueFormatter }, [
    JSON.stringify(data),
    valueFormatter,
    locale,
  ]);

  return (
    <md-pie-chart
      ref={(node: HTMLElement | null) => {
        ref.current = node;
        if (elementRef) elementRef.current = node;
      }}
      locale={locale}
      {...attributes}
    />
  );
}

/* --------------------------------------------------------------- sparkline */

export function Sparkline({
  data,
  labels,
  valueFormatter,
  locale,
  ...attributes
}: {
  data: (number | null)[];
  labels?: string[];
  valueFormatter?: (value: number | null) => string;
  locale?: string;
  [attribute: string]: unknown;
}) {
  const ref = useElementProps({ data, labels, valueFormatter }, [
    JSON.stringify(data),
    JSON.stringify(labels),
    locale,
  ]);
  return <md-sparkline ref={ref} {...attributes} />;
}

/**
 * `md-slider`, wired to a React callback.
 *
 * TWO TRAPS, AND THIS EXISTS TO CLOSE BOTH.
 *
 * REACT 18 DOES NOT ATTACH CUSTOM EVENT LISTENERS. An `onMdInput={...}` prop on
 * a custom element is not a listener — React sets it as a property and the
 * handler never runs. Every custom event in this app goes through
 * `useCustomEvent` and a ref for that reason, and a slider written the obvious
 * way is silently inert: it moves under the pointer, because the component
 * manages its own thumb, and nothing else in the app ever changes.
 *
 * ITS DETAIL IS `{ value }`, AN OBJECT — while `md-text-field`'s detail IS the
 * bare string. Assuming one shape for both compiles cleanly and yields
 * `Number({value: 42})` → `NaN`, which then fails silently again because the
 * clamps in `derive.ts` turn NaN back into the value that was already there.
 *
 * A COMPONENT RATHER THAN A HOOK, because the mixer renders two sliders per
 * strip inside a loop and hooks cannot be called in one. Each instance owns its
 * own ref.
 */
export function Slider({
  onInput,
  ...attributes
}: {
  onInput: (value: number) => void;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ value: number }>>(ref, 'mdInput', (event) => {
    const raw = event.detail?.value;
    onInput(Number.isFinite(raw) ? Number(raw) : 0);
  });
  return <md-slider ref={ref} {...attributes} />;
}
