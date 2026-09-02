<!--
  One wrapper for all four plot types.

  `<svelte:element>` picks the tag, so `md-bar-chart`, `md-line-chart`,
  `md-area-chart` and `md-pie-chart` share one implementation rather than four
  files that would drift. Everything structured — series, axes, the value
  formatter — goes through the `objectProps` action; everything else spreads as
  an attribute.

  NOTE ON `md-pie-chart`: it takes `data`, not `series` — pass it through the
  `data` prop here (the overview's donut also slots its own centre content, so
  a screen may bypass this wrapper and wire `use:objectProps` by hand exactly
  as the React build hand-wires its donut).

  `label-plot` is defaulted here rather than at each call site. A chart's plot
  is a focusable `role="application"` region whose accessible name comes from
  that prop, and its default is an English sentence — so without this every
  chart on the Romanian and Arabic pages names the region in English. A call
  site may still override it.
-->
<script lang="ts">
  import { t } from '$lib/showcase';
  import { objectProps, type ChartSeries } from '$lib/elements';

  export let tag: 'md-bar-chart' | 'md-line-chart' | 'md-area-chart' | 'md-pie-chart' =
    'md-bar-chart';
  export let series: ChartSeries[] = [];
  /** `md-pie-chart` only — it takes `data`, not `series`. */
  export let data: Record<string, unknown>[] | undefined = undefined;
  export let xAxis: Record<string, unknown> | undefined = undefined;
  export let yAxis: Record<string, unknown> | undefined = undefined;
  /** Multiple value axes. Supersedes `yAxis`; series pick one via `yAxisIndex`. */
  export let yAxes: Record<string, unknown>[] | undefined = undefined;
  export let valueFormatter: ((value: number | null) => string) | undefined = undefined;

  $: attributes = { 'label-plot': $t('banking.chart.plotHint'), ...$$restProps };
  $: props = { series, data, xAxis, yAxis, yAxes, valueFormatter };
</script>

<svelte:element this={tag} use:objectProps={props} {...attributes} on:mdBarClick>
  <slot />
  <!--
    THE DONUT'S CENTRE, and it has to be wrapped HERE rather than by the caller.

    `slot="center"` written on a child of a Svelte COMPONENT is Svelte's own
    slot syntax: it is consumed at compile time and never reaches the DOM, so
    the custom element's shadow `<slot name="center">` finds nothing and the
    centre figure vanishes without an error. Measured: the pie had zero
    children in this port while React's had one.

    Emitting the wrapper here puts a real `slot="center"` attribute in the DOM
    and keeps the markup identical to the React build's — `div.ring-centre`
    holding the caller's two spans. The Vue port needs none of this: Vue 3
    dropped the `slot="x"` syntax, so there it stays a plain attribute.
  -->
  {#if $$slots.center}
    <div slot="center" class="ring-centre"><slot name="center" /></div>
  {/if}
</svelte:element>
