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
  /** Force a fraction-digit count. Default: 2 standard, 1 compact. */
  export let digits: number | undefined = undefined;

  /*
   * TWO DECIMALS BY DEFAULT in standard notation, and this vertical is why.
   * The wealth console's default is whole units, right for a book measured in
   * millions. A current account holds €4,218.64, and rendering that as "€4,219"
   * is not a rounding, it is a different balance.
   */
  $: places = digits ?? (compact ? undefined : 2);
</script>

<span class="num">
  {$t.formatCurrency(value, {
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: places,
    minimumFractionDigits: places,
  })}
</span>
