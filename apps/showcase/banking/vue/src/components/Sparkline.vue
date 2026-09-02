<!--
  The tiny trend line inside a KPI tile or a table row.

  `data`, `labels` and `valueFormatter` are object/function props with no
  attribute form, so they go through `v-awc`. The formatter closes over the
  translator, and `v-awc` re-assigns props on every update, so a locale switch
  re-labels the tooltip without any extra wiring. Everything else (`variant`,
  `color`, `curve`, `height`, …) falls through as an attribute.
-->
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: (number | null)[];
  /** Tooltip x labels — month ends, already formatted. */
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
