<!--
  A signed figure — profit and loss, an excess return, a drift.

  THE COLOUR IS NEVER THE ONLY CARRIER. The sign is always in the text
  (`signDisplay: 'exceptZero'`), so the cell still says which way it went in
  monochrome, in a screenshot, and to a reader who cannot distinguish the two
  hues. That is the WCAG 1.4.1 rule, and a financial table is exactly where it
  gets broken.

  `plColor` has a dead band: a move smaller than the rounding scale is neither
  green nor red, which is what stops a table of near-flat positions reading as
  a chequerboard.

  `<bdi>`, NOT `<span>`, and this one was found by looking at the page. The
  money branch composes its `+` by hand, because the kit's `CurrencyOptions`
  has no `signDisplay` to hand to `Intl`. A leading `+` is a bidi-NEUTRAL
  character, so under `dir="rtl"` the algorithm resolves it against the
  paragraph direction and moves it to the other end: `+€1.5m` renders as
  `€1.5m+`, which reads as a different number. `<bdi>` isolates the run and
  auto-detects its direction from its own first strong character, so the sign
  stays where it was written. The percent branch does not need it — `Intl`
  places that sign itself and gets the bidi right — but one wrapper for both
  keeps the two from drifting.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { plColor } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(
  defineProps<{
    value: number;
    /** `money` formats with a currency; `percent` treats the value as a fraction. */
    kind?: 'money' | 'percent';
    currency?: string;
    compact?: boolean;
    digits?: number;
  }>(),
  { kind: 'money', currency: 'EUR', compact: false },
);

const t = useT();

// The dead band is a fraction for percentages and a currency unit for money —
// half a cent is not a move, but half a euro on a €40m book is not either.
const className = computed(() => {
  const color = plColor(props.value, props.kind === 'percent' ? 0.0005 : 1);
  return color === 'success' ? 'pl-up' : color === 'error' ? 'pl-down' : 'pl-flat';
});

const text = computed(() =>
  props.kind === 'percent'
    ? t.value.formatPercent(props.value, {
        maximumFractionDigits: props.digits ?? 2,
        minimumFractionDigits: Math.min(props.digits ?? 2, 1),
        signDisplay: 'exceptZero',
      })
    : `${props.value > 0 ? '+' : ''}${t.value.formatCurrency(props.value, {
        currency: props.currency,
        notation: props.compact ? 'compact' : 'standard',
        maximumFractionDigits: props.digits,
        minimumFractionDigits: props.digits,
      })}`,
);
</script>

<template>
  <bdi class="num" :class="className">{{ text }}</bdi>
</template>
