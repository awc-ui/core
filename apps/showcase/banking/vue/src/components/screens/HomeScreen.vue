<!--
  Home — what someone opens the app to see.

  FOUR HEADLINES, THEN THE ACCOUNTS, THEN WHAT NEEDS ATTENTION. The order is
  the reading order of the question "am I fine?": the net figure first, then
  where the money physically is, then anything unusual.

  NOTHING HERE COMPUTES ANYTHING. Every figure is a field on a kit record or
  the return value of a kit function — `headlines()`, `balanceSeries()`,
  `accountSummaries()`, `budgetOverall()`, `upcomingCharges()`.
-->
<script setup lang="ts">
import {
  BASE_CURRENCY,
  accountSummaries,
  balanceSeries,
  budgetOverall,
  getCards,
  getTotals,
  getTransactions,
  headlines,
  upcomingCharges,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import { route, withBase } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Chart from '~/components/Chart.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import KpiTile from '~/components/bits/KpiTile.vue';
import Money from '~/components/bits/Money.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';
import StateChip from '~/components/bits/StateChip.vue';
import BudgetMeter from '~/components/bits/BudgetMeter.vue';
import VaultMeter from '~/components/bits/VaultMeter.vue';
import StatementRow from '~/components/bits/StatementRow.vue';
import { cardStateColor } from '@awc-ui/showcase-kit/banking';

const t = useT();
const totals = getTotals();
const summaries = accountSummaries();
const curve = balanceSeries();
const budget = budgetOverall();
const charges = upcomingCharges(4);
const cards = getCards();
/* The last handful of movements — a preview of the statement, in the
   statement's own default order. */
const recent = getTransactions({ limit: 6 });

const vaults = summaries.filter(({ account }) => account.goalTarget !== null);

/* The overall meter takes the WORST status of the five, not an average: one
   category 15% over is the thing worth surfacing. */
const budgetStatus = totals.budgetOverCount > 0 ? 'over' : totals.budgetNearCount > 0 ? 'near' : 'under';
</script>

<template>
  <Screen :title="t('banking.screen.home.title')" :subtitle="t('banking.screen.home.subtitle')">
    <template #aside>
      <md-button variant="tonal" size="sm" icon="currency_exchange" :href="withBase(route.exchange())">
        {{ t('banking.action.exchange') }}
      </md-button>
      <md-button variant="text" size="sm" icon="receipt_long" :href="withBase(route.transactions())">
        {{ t('banking.action.statement') }}
      </md-button>
    </template>

    <section class="kpi-grid">
      <KpiTile
        v-for="h in headlines()"
        :key="h.labelKey"
        :label="t(h.labelKey)"
        :trend="h.labelKey === 'banking.kpi.balance' ? curve.map((p) => p.balanceEur) : undefined"
        :trend-labels="curve.map((p) => t.formatDate(`${p.month}-01`, 'monthYear'))"
        :format-trend="(v) => t.formatCurrency(v ?? 0, { notation: 'compact' })"
      >
        <template #value><Money :value="h.valueEur" compact /></template>
        <template v-if="h.changePct !== null" #hint>
          <Signed :value="h.changePct" kind="percent" />
          {{ h.labelKey === 'banking.kpi.spentThisMonth' ? t('banking.common.vsLastMonth') : t('banking.kpi.unrealisedPl') }}
        </template>
      </KpiTile>
    </section>

    <div class="grid-2">
      <Panel
        :title="t('banking.panel.accounts')"
        :subtitle="t('banking.app.baseCurrency', { currency: BASE_CURRENCY })"
      >
        <template #actions><Count :value="totals.accountCount" /></template>

        <md-list :label="t('banking.panel.accounts')" interaction-mode="navigation" list-style="segmented">
          <md-list-item
            v-for="{ account, transactionCount } in summaries"
            :key="account.id"
            type="link"
            :href="withBase(route.account(account.id))"
            :headline="account.nickname"
            lines="3"
            :overline="`${t(account.kindKey)} · ${account.currency}`"
            :supporting-text="t('banking.common.transactions', { count: transactionCount })"
            :leading-icon="account.kind === 'vault' ? 'savings' : 'account_balance_wallet'"
          >
            <span slot="trailing" class="account-row__figures">
              <Money :value="account.balance" :currency="account.currency" />
              <!-- The EUR twin only when it differs — printing the same figure
                   twice is noise on the three EUR accounts. -->
              <span v-if="account.currency !== BASE_CURRENCY" class="muted">
                <Money :value="account.balanceEur" compact />
              </span>
            </span>
          </md-list-item>
        </md-list>

        <!-- The vault's progress, under the list it belongs to rather than as
             a sixth row — it is the same account, shown a second way. -->
        <div v-for="{ account } in vaults" :key="account.id" class="budget-row">
          <div class="budget-row__head">
            <span class="strong">{{ account.goalName }}</span>
            <span class="muted">
              {{
                t('banking.hint.vault', {
                  pct: t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
                  target: t.formatCurrency(account.goalTarget ?? 0, { notation: 'compact' }),
                })
              }}
            </span>
          </div>
          <VaultMeter :fraction="account.goalFundedPct ?? 0" :label="account.goalName ?? ''" />
        </div>
      </Panel>

      <Panel
        :title="t('banking.panel.balanceTrend')"
        :subtitle="t('banking.common.showing', { shown: curve.length, total: curve.length })"
      >
        <Chart
          tag="md-area-chart"
          class="chart-md"
          :series="[{ id: 'balance', label: t('banking.kpi.balance'), data: curve.map((p) => p.balanceEur) }]"
          :x-axis="{ data: curve.map((p) => t.formatDate(`${p.month}-01`, 'monthYear')), scale: 'category' }"
          :value-formatter="(v) => t.formatCurrency(v ?? 0, { notation: 'compact' })"
          :summary="t('banking.panel.balanceTrend')"
          curve="monotone"
          grid="horizontal"
        />
      </Panel>
    </div>

    <div class="grid-2">
      <Panel :title="t('banking.panel.spending')" :subtitle="t('banking.common.thisMonth')">
        <template #actions>
          <md-button variant="text" size="sm" :href="withBase(route.analytics())">
            {{ t('banking.action.viewAll') }}
          </md-button>
        </template>

        <dl class="dl">
          <div>
            <dt>{{ t('banking.kpi.spentThisMonth') }}</dt>
            <dd><Money :value="totals.spentThisMonthEur" /></dd>
          </div>
          <div>
            <dt>{{ t('banking.kpi.income') }}</dt>
            <dd><Money :value="totals.incomeThisMonthEur" /></dd>
          </div>
          <div>
            <dt>{{ t('banking.kpi.netThisMonth') }}</dt>
            <dd><Signed :value="totals.netThisMonthEur" /></dd>
          </div>
        </dl>

        <div class="budget-row">
          <div class="budget-row__head">
            <span>{{ t('banking.kpi.budgetUsed') }}</span>
            <span class="strong"><Percent :value="budget.usedPct" /></span>
          </div>
          <BudgetMeter :fraction="budget.usedPct" :status="budgetStatus" />
          <div class="budget-row__foot">
            <span>
              <Money :value="budget.spent" compact /> / <Money :value="budget.limit" compact />
            </span>
            <span v-if="totals.budgetOverCount > 0">{{ t('banking.budgetStatus.over') }}</span>
          </div>
        </div>
      </Panel>

      <Panel :title="t('banking.panel.upcoming')" :subtitle="t('banking.kpi.subscriptions')">
        <template #actions><Count :value="totals.activeSubscriptionCount" /></template>
        <md-list :label="t('banking.panel.upcoming')" interaction-mode="multi-action" list-style="segmented">
          <md-list-item
            v-for="charge in charges"
            :key="charge.subscriptionId"
            :headline="charge.name"
            :overline="t(charge.cadenceKey)"
            lines="2"
          >
            <span slot="leading">
              <md-avatar :initials="charge.initials" size="small"></md-avatar>
            </span>
            <span slot="trailing" class="account-row__figures">
              <Money :value="charge.amountEur" />
              <span class="muted"><DateText :value="charge.nextChargeDate" /></span>
            </span>
          </md-list-item>
        </md-list>
      </Panel>
    </div>

    <div class="grid-2">
      <Panel :title="t('banking.panel.recent')">
        <template #actions>
          <md-button variant="text" size="sm" :href="withBase(route.transactions())">
            {{ t('banking.action.viewAll') }}
          </md-button>
        </template>
        <md-list :label="t('banking.panel.recent')" interaction-mode="multi-action" list-style="segmented">
          <StatementRow v-for="txn in recent" :key="txn.id" :txn="txn" />
        </md-list>
      </Panel>

      <Panel :title="t('banking.panel.cards')">
        <template #actions>
          <md-button variant="text" size="sm" :href="withBase(route.cards())">
            {{ t('banking.action.viewAll') }}
          </md-button>
        </template>
        <md-list :label="t('banking.panel.cards')" interaction-mode="navigation" list-style="segmented">
          <md-list-item
            v-for="card in cards"
            :key="card.id"
            type="link"
            :href="withBase(route.cards())"
            :headline="card.label"
            :overline="t('banking.unit.endingIn', { last4: card.last4 })"
            :supporting-text="`${t(card.kindKey)} · ${t(card.stateKey)}`"
            lines="3"
            leading-icon="credit_card"
          >
            <!-- No status dot: it anchors absolutely and has nothing to anchor
                 to here, and the chip beside it already says the same word. -->
            <span slot="trailing">
              <StateChip :label-key="card.stateKey" :color="cardStateColor[card.state]" />
            </span>
          </md-list-item>
        </md-list>
      </Panel>
    </div>
  </Screen>
</template>
