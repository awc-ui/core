<!--
  The detail pane beside the org chart, on a surface of its own.

  The card is HERE rather than inside each branch below: all four of them —
  client, objective, mandate, household — are the same pane showing whatever is
  selected, so they share one surface, and wrapping once means a fifth branch
  cannot forget it. `variant="outlined"` is the same
  `--md-sys-color-surface-container-low` the charts sit on, which is what makes
  this read as a panel beside the tree rather than as loose text under it.

  Whatever the reader picked in the tree: the id comes from the chart, which
  got it from the fixture, so every branch here is a selector lookup rather
  than a cache — and each one may return `undefined`, which is what the
  household fallback at the end is for.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  getClientById,
  getGoalById,
  getPortfolioById,
  type Household,
} from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import ClientRoleChip from '~/components/bits/ClientRoleChip.vue';
import DateText from '~/components/bits/DateText.vue';
import Fact from '~/components/bits/Fact.vue';
import FundedMeter from '~/components/bits/FundedMeter.vue';
import GoalStatusChip from '~/components/bits/GoalStatusChip.vue';
import KycChip from '~/components/bits/KycChip.vue';
import MandateChip from '~/components/bits/MandateChip.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import PriorityChip from '~/components/bits/PriorityChip.vue';
import RiskToleranceChip from '~/components/bits/RiskToleranceChip.vue';
import SegmentChip from '~/components/bits/SegmentChip.vue';
import StrategyChip from '~/components/bits/StrategyChip.vue';

const props = defineProps<{ id: string; household: Household }>();

const t = useT();

const client = computed(() => getClientById(props.id));
const goal = computed(() => (client.value ? undefined : getGoalById(props.id)));
const portfolio = computed(() =>
  client.value || goal.value ? undefined : getPortfolioById(props.id),
);
</script>

<template>
  <md-card variant="outlined" full-width class="surface-card fact-card">
    <div v-if="client" class="stack">
      <div class="row">
        <ClientRoleChip :role="client.role" />
        <KycChip :status="client.kycStatus" />
        <RiskToleranceChip :tolerance="client.riskTolerance" />
      </div>
      <dl class="dl">
        <Fact :label="t('wealth.table.client')">{{ client.name }}</Fact>
        <Fact :label="t('wealth.table.age')">
          <Num :value="client.age" />
        </Fact>
        <Fact :label="t('wealth.table.domicile')">{{ t(`wealth.country.${client.domicile}`) }}</Fact>
        <Fact :label="t('wealth.table.kycReview')">
          <DateText :value="client.kycReviewDate" />
        </Fact>
        <Fact :label="t('wealth.table.contact')">
          <span class="muted">{{ client.email }}</span>
        </Fact>
        <Fact :label="t('wealth.table.id')">{{ client.id }}</Fact>
      </dl>
    </div>

    <div v-else-if="goal" class="stack">
      <div class="row">
        <PriorityChip :priority="goal.priority" />
        <GoalStatusChip :status="goal.status" />
      </div>
      <FundedMeter :fraction="goal.fundedPct" :status="goal.status" />
      <dl class="dl">
        <Fact :label="t('wealth.table.goal')">{{ t(goal.typeKey) }}</Fact>
        <Fact :label="t('wealth.table.targetAmount')">
          <Money :value="goal.targetAmount" compact />
        </Fact>
        <Fact :label="t('wealth.table.targetDate')">
          <DateText :value="goal.targetDate" />
        </Fact>
        <Fact :label="t('wealth.table.projected')">
          <Money :value="goal.projectedAmount" compact />
        </Fact>
      </dl>
    </div>

    <div v-else-if="portfolio" class="stack">
      <div class="row">
        <StrategyChip :strategy="portfolio.strategy" />
      </div>
      <dl class="dl">
        <Fact :label="t('wealth.table.id')">{{ portfolio.reference }}</Fact>
        <Fact :label="t('wealth.table.benchmark')">{{ portfolio.benchmarkName }}</Fact>
        <Fact :label="t('wealth.table.marketValue')">
          <Money :value="portfolio.marketValue" compact />
        </Fact>
        <Fact :label="t('wealth.kpi.cash')">
          <Money :value="portfolio.cashBalance" compact />
        </Fact>
        <Fact :label="t('wealth.table.inception')">
          <DateText :value="portfolio.inceptionDate" />
        </Fact>
        <Fact :label="t('wealth.table.fee')">
          {{ t('wealth.unit.bps', { value: t.formatNumber(portfolio.feeBps) }) }}
        </Fact>
      </dl>
    </div>

    <div v-else class="stack">
      <div class="row">
        <SegmentChip :segment="household.segment" />
        <MandateChip :mandate="household.mandate" />
      </div>
      <dl class="dl">
        <Fact :label="t('wealth.table.household')">{{ household.name }}</Fact>
        <Fact :label="t('wealth.table.domicile')">
          {{ t(`wealth.country.${household.domicile}`) }}
        </Fact>
        <Fact :label="t('wealth.table.members')">
          <Num :value="household.memberCount" />
        </Fact>
        <Fact :label="t('wealth.table.onboarded')">
          <DateText :value="household.onboardedDate" />
        </Fact>
        <Fact :label="t('wealth.table.advisor')">{{ household.advisorName }}</Fact>
        <Fact :label="t('wealth.table.aum')">
          <Money :value="household.totalAum" compact />
        </Fact>
      </dl>
    </div>
  </md-card>
</template>
