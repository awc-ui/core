<!--
  A fraction against a cap, as a labelled linear meter.

  `md-meter` is for a read-only value in a known range — a funded percentage, a
  weight, a coverage ratio. It is NOT a progress indicator: nothing here is
  loading. The bar is clamped into 0…max; the text keeps the real value.
-->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let label: string;
  /** A fraction. Clamped into 0…`max` for the bar; the text keeps the real value. */
  export let fraction: number;
  export let color: string;
  export let max = 1;
  export let thickness = 10;
</script>

<md-meter
  value={Math.max(0, Math.min(max, fraction)) * 100}
  min="0"
  max={max * 100}
  {color}
  {thickness}
  {label}
  show-label
  show-value
  value-text={$t.formatPercent(fraction, { maximumFractionDigits: 1 })}
></md-meter>
