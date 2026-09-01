<!--
  A money amount.

  `currency` defaults to EUR because every aggregate in the fixture is in EUR;
  pass a position's or an order's own `currency` for a local amount. `compact`
  gives €3.2m — the right choice for a KPI tile or a chart axis, the wrong one
  for a table cell where the reader is comparing figures digit by digit.

  A SIGNED money figure is `<Signed>`, not a flag here: the kit's
  CurrencyOptions has no `signDisplay`, so composing the `+` is a real piece of
  work rather than one more option, and it belongs next to the colour decision
  that goes with it.

  THE CONTRACT FOR SCREENS (this and every bit beside it): never call `Intl`
  and never call `toFixed`. Money goes through `<Money>`, ratios through
  `<Percent>`, signed figures through `<Signed>`, dates through `<DateText>`.
  They are pinned to the dock's locale and to UTC. Never write
  `status === 'x' ? 'error' : …` — use the chip or the dot; every colour
  mapping is already in the kit. A `…Key` field is a dictionary key, not a
  label. Pass it to `t()`.
-->
<script setup lang="ts">
import { useT } from '~/composables/useShowcase';

withDefaults(
  defineProps<{
    value: number;
    currency?: string;
    compact?: boolean;
    /** Force a fraction-digit count. Default: 0 standard, 1 compact. */
    digits?: number;
  }>(),
  { currency: 'EUR', compact: false },
);

const t = useT();
</script>

<template>
  <span class="num">{{
    t.formatCurrency(value, {
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    })
  }}</span>
</template>
