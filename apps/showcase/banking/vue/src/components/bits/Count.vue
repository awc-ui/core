<!--
  A count, as a small chip.

  NOT `md-badge`: a badge anchors against the nearest positioned ancestor and
  is clipped by a card's own overflow. A chip takes its own space, which is
  what a count beside a panel title is.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ value: number; color?: string }>(), { color: 'primary' });
const t = useT();
const label = computed(() => t.value.formatNumber(props.value, { maximumFractionDigits: 0 }));
</script>

<template>
  <md-chip variant="assist" appearance="outlined" :color="color" :label="label"></md-chip>
</template>
