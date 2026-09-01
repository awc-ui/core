<!-- The mandate the growth assumption comes from. A standalone accordion item. -->
<script lang="ts">
  import { getHouseholdById, getPortfolioFor } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';
  import Chips from '$lib/bits/Chips.svelte';
  import Fact from '$lib/bits/Fact.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import DateText from '$lib/bits/DateText.svelte';

  export let householdId: string;

  $: household = getHouseholdById(householdId);
  $: portfolio = getPortfolioFor(householdId);
</script>

{#if household}
  <md-accordion-item headline={$t('wealth.panel.mandate')} icon="account_balance">
    <div class="row">
      <Chips kind="riskProfile" value={household.riskProfile} />
      <Chips kind="strategy" value={household.strategy} />
      <Chips kind="mandate" value={household.mandate} />
    </div>
    <dl class="dl">
      <Fact label={$t('wealth.table.benchmark')}>
        {portfolio?.benchmarkName ?? $t('wealth.common.na')}
      </Fact>
      <Fact label={$t('wealth.table.aum')}>
        <Money value={household.totalAum} compact />
      </Fact>
      <Fact label={$t('wealth.table.ytd')}>
        <Percent value={household.ytdReturn} digits={1} sign />
      </Fact>
      <Fact label={$t('wealth.table.nextReview')}>
        <DateText value={household.nextReviewDate} />
      </Fact>
    </dl>
  </md-accordion-item>
{/if}
