<!--
  A number, formatted for the reader's locale.

  `compact` only above ten thousand: below that the compact form hides whether
  "9.9k" is 9,900 or 9,949, and a play count is a number a reader compares.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ value: number; compact?: boolean }>(), { compact: false });
const t = useT();

const text = computed(() =>
  t.value.formatNumber(
    props.value,
    props.compact && props.value >= 10000
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { maximumFractionDigits: 0 },
  ),
);
</script>

<template>
  <span class="num">{{ text }}</span>
</template>
