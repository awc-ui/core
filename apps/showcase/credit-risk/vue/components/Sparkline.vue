<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: (number | null)[];
  /** Tooltip x labels — quarters or month-end dates, already formatted. */
  labels?: string[];
  valueFormatter?: (value: number | null) => string;
}>();

const objectProps = computed(() => ({
  data: props.data,
  labels: props.labels,
  valueFormatter: props.valueFormatter,
}));
</script>

<template>
  <md-sparkline v-awc="{ props: objectProps }"></md-sparkline>
</template>
