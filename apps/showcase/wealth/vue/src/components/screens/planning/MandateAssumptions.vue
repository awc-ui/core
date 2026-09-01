<!--
  The mandate the growth assumption comes from. A standalone accordion item —
  the SFC's single root IS the `md-accordion-item`, so in the DOM it is a
  direct child of the screen's `md-accordion`, exactly as in the React source.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { getHouseholdById, getPortfolioFor } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import DateText from '~/components/bits/DateText.vue';
import Fact from '~/components/bits/Fact.vue';
import MandateChip from '~/components/bits/MandateChip.vue';
import Money from '~/components/bits/Money.vue';
import Percent from '~/components/bits/Percent.vue';
import RiskProfileChip from '~/components/bits/RiskProfileChip.vue';
import StrategyChip from '~/components/bits/StrategyChip.vue';

const props = defineProps<{ householdId: string }>();

const t = useT();

const household = computed(() => getHouseholdById(props.householdId));
const portfolio = computed(() => getPortfolioFor(props.householdId));
</script>

<template>
  <md-accordion-item v-if="household" :headline="t('wealth.panel.mandate')" icon="account_balance">
    <div class="row">
      <RiskProfileChip :profile="household.riskProfile" />
      <StrategyChip :strategy="household.strategy" />
      <MandateChip :mandate="household.mandate" />
    </div>
    <dl class="dl">
      <Fact :label="t('wealth.table.benchmark')">{{
        portfolio?.benchmarkName ?? t('wealth.common.na')
      }}</Fact>
      <Fact :label="t('wealth.table.aum')">
        <Money :value="household.totalAum" compact />
      </Fact>
      <Fact :label="t('wealth.table.ytd')">
        <Percent :value="household.ytdReturn" :digits="1" sign />
      </Fact>
      <Fact :label="t('wealth.table.nextReview')">
        <DateText :value="household.nextReviewDate" />
      </Fact>
    </dl>
  </md-accordion-item>
</template>
