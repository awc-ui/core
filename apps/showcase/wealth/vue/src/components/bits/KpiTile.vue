<!--
  The KPI tile: label, value, optional sparkline, foot row.

  The primary figure goes in the `value` SLOT (it is usually a `<Money>` or a
  `<Percent>`, not a string); a plain string may use the `value` prop instead.
  The foot note is the same pair: the `hint` slot for composed content (text
  beside a `<Signed>`), the `hint` prop for a plain string — mirroring the
  Svelte twin's KpiTile, because the React source passes nodes for both.

  `trailing` (a slot here) is a small node at the end of the foot row — a chip,
  a dot, a `<Count>`. NOT a bare `md-badge`: a badge anchors absolutely against
  the nearest POSITIONED ancestor and translates itself past that ancestor's
  corner, so dropped in here it lands on the card's top-right corner and is
  sliced in half by the card's own `overflow: hidden`. A badge needs a host to
  sit on and a `.badge-anchor` wrapper around it; see the pattern in `app.css`.

  `color` is one of the md colour roles. Use a `status.ts` map, not a guess.
-->
<script setup lang="ts">
import Sparkline from '../Sparkline.vue';

withDefaults(
  defineProps<{
    label: string;
    /** A plain-string figure. For formatted nodes, fill the `value` slot instead. */
    value?: string;
    hint?: string;
    /** Historical values for the sparkline, oldest first. */
    trend?: number[];
    /** Tooltip x labels — month ends, already formatted. */
    trendLabels?: string[];
    formatTrend?: (value: number | null) => string;
    color?: string;
  }>(),
  { color: 'primary' },
);

// The React source keys the sparkline's props on the locale so its formatter
// is re-assigned after a locale switch; `v-awc` re-assigns object props on
// EVERY update, so no locale key (and no `locale` attribute in the DOM, which
// React does not render either) is needed here.
</script>

<template>
  <md-card variant="filled" full-width>
    <div class="kpi">
      <p class="kpi__label">{{ label }}</p>
      <p class="kpi__value"><slot name="value">{{ value }}</slot></p>
      <div v-if="trend && trend.length > 1" class="kpi__spark">
        <Sparkline
          :data="trend"
          :labels="trendLabels"
          :value-formatter="formatTrend"
          variant="area"
          :color="color"
          curve="monotone"
          show-marks="extremes"
          height="34px"
        />
      </div>
      <div v-if="hint || $slots.hint || $slots.trailing" class="kpi__foot">
        <span><slot name="hint">{{ hint }}</slot></span>
        <slot name="trailing" />
      </div>
    </div>
  </md-card>
</template>
