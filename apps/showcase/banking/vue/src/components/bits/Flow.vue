<!--
  A signed movement, coloured by DIRECTION rather than by sentiment.

  Credits are green; debits are the ordinary body colour. A statement where
  every purchase is red is unreadable after four rows.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { flowColor } from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{ value: number; currency?: string; compact?: boolean }>(),
  { currency: 'EUR', compact: false },
);

const t = useT();
const up = computed(() => flowColor(props.value) === 'success');
const text = computed(
  () =>
    `${props.value > 0 ? '+' : ''}${t.value.formatCurrency(props.value, {
      currency: props.currency,
      notation: props.compact ? 'compact' : 'standard',
      maximumFractionDigits: props.compact ? undefined : 2,
      minimumFractionDigits: props.compact ? undefined : 2,
    })}`,
);
</script>

<template>
  <bdi :class="up ? 'num pl-up' : 'num'">{{ text }}</bdi>
</template>
