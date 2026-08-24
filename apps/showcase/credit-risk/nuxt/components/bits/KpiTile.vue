<!--
  A KPI tile: label, figure, its own eight-point sparkline, and a footnote.

  The sparkline's `valueFormatter` closes over the translator, so `v-awc`
  re-assigns it whenever the locale changes — which is what keeps the tooltip in
  the page's current language rather than the one it first rendered in.
-->
<script setup lang="ts">
import Sparkline from '../Sparkline.vue';

defineProps<{
  label: string;
  value: string;
  hint?: string;
  /** Historical values for the sparkline, oldest first. */
  trend?: number[];
  /** Tooltip x labels — quarters or month-end dates, already formatted. */
  trendLabels?: string[];
  formatTrend?: (value: number | null) => string;
  color?: string;
}>();
</script>

<template>
  <md-card variant="filled" full-width>
    <div class="kpi">
      <p class="kpi__label">{{ label }}</p>
      <p class="kpi__value">{{ value }}</p>
      <div v-if="trend && trend.length > 1" class="kpi__spark">
        <Sparkline
          :data="trend"
          :labels="trendLabels"
          :value-formatter="formatTrend"
          variant="area"
          :color="color ?? 'primary'"
          curve="monotone"
          show-marks="extremes"
          height="34px"
        />
      </div>
      <div v-if="hint || $slots.badge" class="kpi__foot">
        <span>{{ hint }}</span>
        <slot name="badge" />
      </div>
    </div>
  </md-card>
</template>
