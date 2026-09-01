<!--
  A goal's funded percentage.

  The bar is clamped at 100% but the TEXT is not, so an over-funded objective
  reads "112%" beside a full bar rather than silently looking merely complete.
-->
<script lang="ts">
  import { goalColor, type GoalStatus } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';

  export let fraction: number;
  export let status: GoalStatus;
</script>

<md-meter
  value={Math.max(0, Math.min(1, fraction)) * 100}
  min="0"
  max="100"
  color={goalColor[status]}
  thickness="8"
  label={$t('wealth.table.funded')}
  show-label
  show-value
  value-text={$t.formatPercent(fraction, { maximumFractionDigits: 0 })}
></md-meter>
