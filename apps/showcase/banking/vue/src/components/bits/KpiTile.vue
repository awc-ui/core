<!--
  A headline figure.

  `trend` is optional and drives the sparkline; the tile renders without one
  rather than reserving space for a chart it has no data for.
-->
<script setup lang="ts">
import Sparkline from '~/components/Sparkline.vue';

withDefaults(
  defineProps<{
    label: string;
    trend?: number[];
    trendLabels?: string[];
    formatTrend?: (value: number | null) => string;
    color?: string;
  }>(),
  { trend: undefined, trendLabels: undefined, formatTrend: undefined, color: 'primary' },
);
</script>

<template>
  <md-card variant="filled" full-width>
    <div class="kpi">
      <p class="kpi__label">{{ label }}</p>
      <p class="kpi__value"><slot name="value" /></p>
      <div v-if="$slots.hint || $slots.trailing" class="kpi__foot">
        <slot name="hint" />
        <!-- A small node at the end of the foot row — a chip, a dot, a count.
             NOT a bare `md-badge`: a badge anchors against the nearest
             positioned ancestor and is sliced by the card's own overflow. -->
        <slot name="trailing" />
      </div>
      <div v-if="trend && trend.length > 1" class="kpi__spark">
        <Sparkline
          :data="trend"
          :labels="trendLabels"
          :value-formatter="formatTrend"
          variant="area"
          :color="color"
          curve="monotone"
          height="34px"
        />
      </div>
    </div>
  </md-card>
</template>
