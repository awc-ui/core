<!--
  A count. COMPACT ABOVE TEN THOUSAND, EXACT BELOW IT — the numbers here are
  members, friends and reactions, all of which a reader compares between rows,
  and "1.2K" against "1.4K" is a comparison the rounding has thrown away.
-->
<script lang="ts">
  import { t } from '$lib/showcase';
  export let value: number;
  export let compact = false;
</script>

<span class="num"
  >{$t.formatNumber(
    value,
    compact && value >= 10_000
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { maximumFractionDigits: 0 },
  )}</span
>
