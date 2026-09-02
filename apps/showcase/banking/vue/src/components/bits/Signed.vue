<!--
  A signed figure, coloured by direction, where direction IS sentiment.

  `<bdi>`, NOT `<span>`: the money branch composes its `+` by hand because the
  kit's `CurrencyOptions` has no `signDisplay`, and a leading `+` is a
  bidi-NEUTRAL character — under `dir="rtl"` the algorithm moves it to the other
  end and `+€1.5m` renders as `€1.5m+`, which reads as a different number.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { plColor } from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{
    value: number;
    kind?: 'money' | 'percent';
    currency?: string;
    compact?: boolean;
    digits?: number;
  }>(),
  { kind: 'money', currency: 'EUR', compact: false, digits: undefined },
);

const t = useT();
const colour = computed(() => plColor(props.value, props.kind === 'percent' ? 0.0005 : 1));
const cls = computed(() =>
  colour.value === 'success' ? 'pl-up' : colour.value === 'error' ? 'pl-down' : 'pl-flat',
);
const text = computed(() => {
  if (props.kind === 'percent') {
    return t.value.formatPercent(props.value, {
      maximumFractionDigits: props.digits ?? 2,
      minimumFractionDigits: Math.min(props.digits ?? 2, 1),
      signDisplay: 'exceptZero',
    });
  }
  const places = props.digits ?? (props.compact ? undefined : 2);
  return `${props.value > 0 ? '+' : ''}${t.value.formatCurrency(props.value, {
    currency: props.currency,
    notation: props.compact ? 'compact' : 'standard',
    maximumFractionDigits: places,
    minimumFractionDigits: places,
  })}`;
});
</script>

<template>
  <bdi :class="`num ${cls}`">{{ text }}</bdi>
</template>
