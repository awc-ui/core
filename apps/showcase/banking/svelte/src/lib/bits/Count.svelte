<!--
  A count, as a small chip.

  This is what goes in a KPI tile's `trailing` slot and beside a panel title —
  NOT `md-badge`. A badge has to sit on a host it can overlap, and dropped into
  a card's foot it anchors to the card's corner and is clipped in half. A chip
  is a standalone element that takes its own space, which is what a count in a
  row of facts actually is.
-->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let value: number;
  export let color = 'primary';
</script>

<md-chip
  variant="assist"
  appearance="outlined"
  {color}
  label={$t.formatNumber(value, { maximumFractionDigits: 0 })}
></md-chip>
