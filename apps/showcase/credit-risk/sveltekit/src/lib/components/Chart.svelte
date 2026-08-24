<!--
  One wrapper for all three plot types.

  `<svelte:element>` picks the tag, so `md-bar-chart`, `md-line-chart` and
  `md-area-chart` share one implementation rather than three files that would
  drift. Everything structured — series, axes, the value formatter — goes
  through the `objectProps` action; everything else spreads as an attribute.

  `label-plot` is defaulted here rather than at each call site. A chart's plot
  is a focusable `role="application"` region whose accessible name comes from
  that prop, and its default is an English sentence — so without this every
  chart on the Romanian and Arabic pages names the region in English. Fourteen
  charts exist across the six screens; defaulting it centrally means one cannot
  be added without it. A call site may still override it.
-->
<script lang="ts">
  import { t } from '$lib/showcase';
  import { objectProps, type ChartSeries } from '$lib/elements';

  export let tag: 'md-bar-chart' | 'md-line-chart' | 'md-area-chart' = 'md-bar-chart';
  export let series: ChartSeries[] = [];
  export let xAxis: Record<string, unknown> | undefined = undefined;
  export let yAxis: Record<string, unknown> | undefined = undefined;
  /** Multiple value axes. Supersedes `yAxis`; series pick one via `yAxisIndex`. */
  export let yAxes: Record<string, unknown>[] | undefined = undefined;
  export let valueFormatter: ((value: number | null) => string) | undefined = undefined;

  $: attributes = { 'label-plot': $t('chart.plotHint'), ...$$restProps };
  $: props = { series, xAxis, yAxis, yAxes, valueFormatter };
</script>

<svelte:element this={tag} use:objectProps={props} {...attributes} on:mdBarClick />
