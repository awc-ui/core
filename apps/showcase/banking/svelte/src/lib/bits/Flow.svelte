<!--
  A signed movement, coloured by DIRECTION rather than by sentiment.

  Credits are green; debits are the ordinary body colour. A statement where
  every purchase is red is unreadable after four rows.

  `<bdi>` is load-bearing: the `+` is composed by hand because the kit's
  `CurrencyOptions` has no `signDisplay`, and a leading `+` is a bidi-NEUTRAL
  character — under `dir="rtl"` the algorithm moves it to the other end.
-->
<script lang="ts">
  import { flowColor } from '@awc-ui/showcase-kit/banking';
  import { t } from '$lib/showcase';

  export let value: number;
  export let currency: string = 'EUR';
  export let compact = false;

  $: up = flowColor(value) === 'success';
</script>

<bdi class={up ? 'num pl-up' : 'num'}>
  {value > 0 ? '+' : ''}{$t.formatCurrency(value, {
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? undefined : 2,
    minimumFractionDigits: compact ? undefined : 2,
  })}
</bdi>
