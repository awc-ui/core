<!--
  A currency amount.

  TWO DECIMALS BY DEFAULT in standard notation, one in compact — the same rule
  the React build applies, and for the same reason: this vertical holds a
  current account at €4,218.64, and rendering that as "€4,219" is not a
  rounding, it is a different balance.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ value: number; currency?: string; compact?: boolean; digits?: number }>(),
  { currency: 'EUR', compact: false, digits: undefined },
);

const t = useT();
const text = computed(() => {
  const places = props.digits ?? (props.compact ? undefined : 2);
  return t.value.formatCurrency(props.value, {
    currency: props.currency,
    notation: props.compact ? 'compact' : 'standard',
    maximumFractionDigits: places,
    minimumFractionDigits: places,
  });
});
</script>

<template>
  <span class="num">{{ text }}</span>
</template>
