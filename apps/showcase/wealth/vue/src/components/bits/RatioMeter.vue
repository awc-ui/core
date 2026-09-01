<!--
  A fraction against a cap, as a labelled linear meter.

  `md-meter` is for a read-only value in a known range — a funded percentage, a
  weight, a coverage ratio. It is NOT a progress indicator: nothing here is
  loading.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

withDefaults(
  defineProps<{
    label: string;
    /** A fraction. Clamped into 0…`max` for the bar; the text keeps the real value. */
    fraction: number;
    color: string;
    max?: number;
    thickness?: number;
  }>(),
  { max: 1, thickness: 10 },
);

const t = useT();
</script>

<template>
  <md-meter
    :value="Math.max(0, Math.min(max, fraction)) * 100"
    min="0"
    :max="max * 100"
    :color="color"
    :thickness="thickness"
    :label="label"
    show-label
    show-value
    :value-text="t.formatPercent(fraction, { maximumFractionDigits: 1 })"
  ></md-meter>
</template>
