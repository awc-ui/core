<!--
  Where the money went this month.

  THE RING, THEN THE BUDGETS, THEN THE MERCHANTS — decreasing abstraction. The
  ring says how the month was shaped; the budgets say whether that was the plan;
  the merchant list says what to do about it. "Groceries €456" tells nobody
  anything actionable; "Nordmarkt €212 over 6 visits" does.

  EVERY FIGURE HERE IS A POSITIVE MAGNITUDE, the one place this app's sign
  convention is set aside — a ring cannot draw a negative slice. It is set aside
  by taking the kit's own positive `amountEur`, never by negating in a template.
-->
<script setup lang="ts">
import {
  budgetRows,
  categoryRing,
  categoryColor,
  categoryIcon,
  flowSeries,
  getTotals,
  spendSeries,
  topMerchants,
  uncappedCategories,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Chart from '~/components/Chart.vue';
import Sparkline from '~/components/Sparkline.vue';
import EmptyState from '~/components/EmptyState.vue';
import Count from '~/components/bits/Count.vue';
import KpiTile from '~/components/bits/KpiTile.vue';
import Money from '~/components/bits/Money.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';
import StateChip from '~/components/bits/StateChip.vue';
import BudgetMeter from '~/components/bits/BudgetMeter.vue';
import { budgetColor } from '@awc-ui/showcase-kit/banking';

const t = useT();
const totals = getTotals();
const ring = categoryRing();
const budgets = budgetRows();
const merchants = topMerchants(6);
const flow = flowSeries();
const spend = spendSeries();
const uncapped = uncappedCategories();
</script>

<template>
  <Screen :title="t('banking.screen.analytics.title')" :subtitle="t('banking.screen.analytics.subtitle')">
    <template #aside><Count :value="totals.monthTransactionCount" /></template>

    <section class="kpi-grid">
      <KpiTile
        :label="t('banking.kpi.spentThisMonth')"
        :trend="spend.map((p) => p.spentEur)"
        :trend-labels="spend.map((p) => t.formatDate(`${p.month}-01`, 'monthYear'))"
        :format-trend="(v) => t.formatCurrency(v ?? 0, { notation: 'compact' })"
      >
        <template #value><Money :value="totals.spentThisMonthEur" /></template>
        <template #hint>
          <Signed :value="totals.spendChangePct" kind="percent" /> {{ t('banking.common.vsLastMonth') }}
        </template>
      </KpiTile>
      <KpiTile :label="t('banking.kpi.income')">
        <template #value><Money :value="totals.incomeThisMonthEur" /></template>
        <template #hint>{{ t('banking.common.thisMonth') }}</template>
      </KpiTile>
      <KpiTile :label="t('banking.kpi.netThisMonth')">
        <template #value><Signed :value="totals.netThisMonthEur" /></template>
        <template #hint>{{ t('banking.common.thisMonth') }}</template>
      </KpiTile>
      <KpiTile :label="t('banking.kpi.subscriptions')">
        <template #value><Money :value="totals.subscriptionMonthlyEur" /></template>
        <template #hint>{{ t('banking.common.perMonth') }}</template>
        <template #trailing><Count :value="totals.activeSubscriptionCount" /></template>
      </KpiTile>
    </section>

    <div class="grid-2">
      <Panel :title="t('banking.panel.byCategory')" :subtitle="t('banking.common.thisMonth')">
        <!--
          `inner-radius` is what makes it a donut — there is no `variant` prop.
          `show-labels` is OFF: eight slices, the smallest under 5%, each
          printing a currency figure in white on a mid-tone fill, with the two
          smallest overlapping outright. The legend names them, the tooltip
          gives values, the generated data table carries the full set, and every
          figure is listed below anyway. The total goes in the hole.
        -->
        <Chart
          tag="md-pie-chart"
          class="chart-md"
          :data-prop="ring.map((slice) => ({ id: slice.id, label: t(slice.labelKey), value: slice.value }))"
          :value-formatter="(v) => t.formatCurrency(v ?? 0, { notation: 'compact' })"
          :summary="t('banking.panel.byCategory')"
          inner-radius="62%"
          show-labels="false"
          legend="bottom"
        >
          <div slot="center" class="ring-centre">
            <span class="ring-centre__value"><Money :value="totals.spentThisMonthEur" compact /></span>
            <span class="ring-centre__label">{{ t('banking.common.thisMonth') }}</span>
          </div>
        </Chart>
      </Panel>

      <Panel :title="t('banking.panel.flow')">
        <!-- Two bars per month rather than one signed bar: in and out are
             different quantities, and a net bar hides a month where both
             doubled. -->
        <Chart
          tag="md-bar-chart"
          class="chart-md"
          :series="[
            { id: 'in', label: t('banking.kpi.income'), data: flow.map((p) => p.inEur) },
            { id: 'out', label: t('banking.panel.spending'), data: flow.map((p) => p.outEur) },
          ]"
          :x-axis="{ data: flow.map((p) => t.formatDate(`${p.month}-01`, 'monthYear')) }"
          :y-axis="{ min: 0 }"
          :value-formatter="(v) => t.formatCurrency(v ?? 0, { notation: 'compact' })"
          :label="t('banking.panel.flow')"
          legend="top-end"
        />
      </Panel>
    </div>

    <Panel :title="t('banking.panel.budgets')" :subtitle="t('banking.common.thisMonth')">
      <template v-if="totals.budgetOverCount > 0" #actions>
        <md-chip
          variant="assist"
          appearance="outlined"
          color="error"
          :label="String(totals.budgetOverCount)"
          icon="warning"
        ></md-chip>
      </template>

      <div class="grid-2">
        <md-card v-for="budget in budgets" :key="budget.category" variant="outlined" full-width class="surface-card">
          <div class="budget-row">
            <div class="budget-row__head">
              <StateChip
                :label-key="budget.categoryKey"
                :color="categoryColor[budget.category]"
                :icon="categoryIcon[budget.category]"
              />
              <StateChip :label-key="budget.statusKey" :color="budgetColor[budget.status]" />
            </div>
            <BudgetMeter :fraction="budget.usedPct" :status="budget.status" />
            <div class="budget-row__foot">
              <span><Money :value="budget.spent" /> / <Money :value="budget.monthlyLimit" /></span>
              <span><Percent :value="budget.usedPct" /></span>
            </div>
            <!-- The trend separates "over for the first time in a year" from
                 "over every month", which the number alone cannot say. -->
            <Sparkline
              :data="budget.trend"
              :labels="spend.map((p) => t.formatDate(`${p.month}-01`, 'monthYear'))"
              :value-formatter="(v) => t.formatCurrency(v ?? 0, { notation: 'compact' })"
              variant="area"
              :color="budget.status === 'over' ? 'error' : 'primary'"
              curve="monotone"
              height="34px"
            />
          </div>
        </md-card>
      </div>

      <div v-if="uncapped.length > 0" class="row">
        <span class="muted">{{ t('banking.action.setBudget') }}</span>
        <StateChip
          v-for="row in uncapped"
          :key="row.category"
          :label-key="row.categoryKey"
          :color="categoryColor[row.category]"
          :icon="categoryIcon[row.category]"
        />
      </div>
    </Panel>

    <Panel :title="t('banking.panel.byMerchant')">
      <template #actions><Count :value="merchants.length" /></template>
      <EmptyState v-if="merchants.length === 0" :message="t('banking.empty.transactions')" />
      <md-list v-else :label="t('banking.panel.byMerchant')" interaction-mode="multi-action" list-style="segmented">
        <md-list-item
          v-for="merchant in merchants"
          :key="merchant.merchantId"
          :headline="merchant.name"
          :overline="t(merchant.categoryKey)"
          :supporting-text="t('banking.common.visits', { count: merchant.transactionCount })"
          lines="3"
        >
          <span slot="leading"><md-avatar :initials="merchant.initials" size="small"></md-avatar></span>
          <span slot="trailing"><Money :value="merchant.amountEur" /></span>
        </md-list-item>
      </md-list>
    </Panel>
  </Screen>
</template>
