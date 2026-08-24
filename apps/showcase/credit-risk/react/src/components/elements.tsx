/**
 * The three things React 18 cannot do with a custom element, done once.
 *
 * 1. OBJECT PROPS. `chart.series`, `orgChart.nodes` and `sparkline.data` have no
 *    attribute form — React 18 would stringify them to `[object Object]`. They
 *    are assigned to the element instance in an effect. Stencil's lazy proxy
 *    picks up own properties set before the element upgrades, so it does not
 *    matter whether the runtime has finished loading.
 * 2. CUSTOM EVENTS. `onMdSortChange` is not a React prop; React 18 only maps
 *    known DOM events. `useCustomEvent` attaches a real listener.
 * 3. TYPES. See `types/custom-elements.d.ts`.
 *
 * Everything else — strings, numbers, booleans — is a plain attribute and needs
 * none of this. Stencil parses `"true"`/`"false"` back to booleans, which is what
 * React writes for a boolean JSX value.
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

/** Attach a listener for one of the library's `md*` custom events. */
export function useCustomEvent<E extends CustomEvent>(
  ref: MutableRefObject<HTMLElement | null>,
  name: string,
  handler: (event: E) => void,
): void {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = (event: Event) => latest.current(event as E);
    el.addEventListener(name, listener);
    return () => el.removeEventListener(name, listener);
  }, [ref, name]);
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
  /** Locale, for the effect deps — see `chartDeps`. Also a real chart attribute. */
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
  // functions, so like the others it has to be assigned as a JS property —
  // an attribute would stringify it to "[object Object]".
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
  // here rather than at each call site so no chart can be added without it —
  // fourteen of them exist and every one had shipped the English default into
  // the Romanian and Arabic pages. A call site may still override it.
  const t = useT();
  const withPlotLabel = { 'label-plot': t('chart.plotHint'), ...attributes };

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

/* -------------------------------------------------------------- org  chart */

export interface OrgNode {
  id: string;
  name: string;
  title?: string;
  avatarInitials?: string;
  children?: OrgNode[];
}

export function OrganizationChart({
  nodes,
  ...attributes
}: {
  nodes: OrgNode[];
  [attribute: string]: unknown;
}) {
  const ref = useElementProps({ nodes }, [JSON.stringify(nodes)]);
  return <md-organization-chart ref={ref} {...attributes} />;
}
