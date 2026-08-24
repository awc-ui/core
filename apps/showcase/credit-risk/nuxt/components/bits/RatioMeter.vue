<!-- Concentration or utilisation against a cap, as a labelled linear meter. -->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{
  label: string;
  fraction: number;
  color: string;
  max?: number;
}>();

const t = useT();
const max = computed(() => props.max ?? 1);
const value = computed(() => Math.max(0, Math.min(max.value, props.fraction)) * 100);
</script>

<template>
  <md-meter
    :value="value"
    min="0"
    :max="max * 100"
    :color="color"
    thickness="10"
    :label="label"
    show-label
    show-value
    :value-text="t.formatPercent(fraction, { maximumFractionDigits: 1 })"
  ></md-meter>
</template>
