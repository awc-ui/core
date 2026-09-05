<!--
  A number, formatted for the reader's locale. `compact` only above ten
  thousand: below that the compact form hides whether "9.9k" is 9,900 or 9,949.
-->
<script lang="ts">
  import { t } from '$lib/showcase';
  export let value: number;
  export let compact = false;
</script>

<span class="num">{$t.formatNumber(
  value,
  compact && value >= 10000
    ? { notation: 'compact', maximumFractionDigits: 1 }
    : { maximumFractionDigits: 0 },
)}</span>
