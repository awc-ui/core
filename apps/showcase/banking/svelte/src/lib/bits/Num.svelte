<!-- A plain number: a quantity, a count, a basis-point figure. -->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let value: number;
  export let digits = 0;
</script>

<span class="num">
  {$t.formatNumber(value, { maximumFractionDigits: digits, minimumFractionDigits: digits })}
</span>
