<!--
  A proportion, as a meter.

  The bar is clamped into 0…max but the TEXT is not, so a category 15% over its
  cap reads "115%" beside a full bar rather than silently looking complete.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ label: string; fraction: number; color: string; max?: number; thickness?: number }>(),
  { max: 1, thickness: 10 },
);
const t = useT();
const clamped = computed(() => Math.max(0, Math.min(props.max, props.fraction)) * 100);
const valueText = computed(() =>
  t.value.formatPercent(props.fraction, { maximumFractionDigits: 1 }),
);
</script>

<template>
  <md-meter
    :value="clamped"
    min="0"
    :max="max * 100"
    :color="color"
    :thickness="thickness"
    :label="label"
    show-label
    show-value
    :value-text="valueText"
  ></md-meter>
</template>
