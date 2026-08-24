<!-- Concentration or utilisation against a cap, as a labelled linear meter. -->
<script lang="ts">
  import { t } from '$lib/showcase';

  export let label: string;
  export let fraction: number;
  export let color: string;
  export let max = 1;
</script>

<md-meter
  value={Math.max(0, Math.min(max, fraction)) * 100}
  min="0"
  max={max * 100}
  {color}
  thickness="10"
  {label}
  show-label
  show-value
  value-text={$t.formatPercent(fraction, { maximumFractionDigits: 1 })}
></md-meter>
