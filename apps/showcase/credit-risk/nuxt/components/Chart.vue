<!--
  One wrapper for all three plot types.

  `<component :is>` picks the tag, so `md-bar-chart`, `md-line-chart` and
  `md-area-chart` share one implementation rather than three files that would
  drift. Everything structured — series, axes, the value formatter — goes
  through `v-awc`; everything else falls through as an attribute.

  `label-plot` is defaulted here rather than at each call site. A chart's plot is
  a focusable `role="application"` region whose accessible name comes from that
  prop, and its default is an English sentence — so without this every chart on
  the Romanian and Arabic pages names the region in English. Fourteen charts
  exist across the six screens; defaulting it centrally means one cannot be added
  without it. A call site may still override it.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';
import type { ChartSeries } from '~/lib/types';

const props = defineProps<{
  tag?: 'md-bar-chart' | 'md-line-chart' | 'md-area-chart';
  series: ChartSeries[];
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  /** Multiple value axes. Supersedes `yAxis`; series pick one via `yAxisIndex`. */
  yAxes?: Record<string, unknown>[];
  valueFormatter?: (value: number | null) => string;
  /** Forwarded to the chart's `mdBarClick`, which has no attribute form. */
  onBarClick?: (event: Event) => void;
}>();

const t = useT();

const objectProps = computed(() => ({
  series: props.series,
  xAxis: props.xAxis,
  yAxis: props.yAxis,
  yAxes: props.yAxes,
  valueFormatter: props.valueFormatter,
}));

const listeners = computed(() => (props.onBarClick ? { mdBarClick: props.onBarClick } : {}));
</script>

<template>
  <component
    :is="tag ?? 'md-bar-chart'"
    v-awc="{ props: objectProps, on: listeners }"
    :label-plot="t('chart.plotHint')"
  ></component>
</template>
