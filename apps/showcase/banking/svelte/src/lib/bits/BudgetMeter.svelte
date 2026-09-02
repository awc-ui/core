<!-- A budget's usage. Clamped bar, uncapped text — 115% reads as 115%. -->
<script lang="ts">
  import { budgetColor, type BudgetStatus } from '@awc-ui/showcase-kit/banking';
  import { t } from '$lib/showcase';
  import RatioMeter from './RatioMeter.svelte';

  export let fraction: number;
  export let status: BudgetStatus;
</script>

<RatioMeter label={$t('banking.kpi.budgetUsed')} {fraction} color={budgetColor[status]} />
