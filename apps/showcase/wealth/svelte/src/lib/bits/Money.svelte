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
-->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let value: number;
  export let currency: string = 'EUR';
  export let compact = false;
  /** Force a fraction-digit count. Default: 0 standard, 1 compact. */
  export let digits: number | undefined = undefined;
</script>

<span class="num">
  {$t.formatCurrency(value, {
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}
</span>
