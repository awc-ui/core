<!--
  A ratio, as a percentage.

  The value is a FRACTION — `0.0135` renders as `1.35%`. Every ratio in the
  fixture is stored that way, so pass it straight in and never multiply by 100
  first.
-->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let value: number;
  export let digits = 2;
  /** Prefix a `+` on positives. Use it for drift, excess return and P/L. */
  export let sign = false;
</script>

<span class="num">
  {$t.formatPercent(value, {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(digits, 1),
    signDisplay: sign ? 'exceptZero' : undefined,
  })}
</span>
