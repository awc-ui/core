<!--
  One account: its details, its month, and its statement.

  A DRILL, NOT A DESTINATION — there is no `/accounts/` index, so this is only
  reachable from the home screen's account list, and it renders breadcrumbs
  because it is one level down.

  THE GUARD IS HERE, NOT IN THE ROUTER. A component taking a plain string from
  a URL must not trust its caller.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  BASE_CURRENCY,
  accountSummaries,
  cardStateColor,
  crumbsFor,
  getAccountById,
  getCards,
  getTransactions,
  statementDays,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import { usePathname } from '~/lib/router';
import { route, withBase } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import Flow from '~/components/bits/Flow.vue';
import Money from '~/components/bits/Money.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';
import StateChip from '~/components/bits/StateChip.vue';
import VaultMeter from '~/components/bits/VaultMeter.vue';
import StatementRow from '~/components/bits/StatementRow.vue';

const props = defineProps<{ accountId: string }>();

const t = useT();
const pathname = usePathname();

const account = computed(() => getAccountById(props.accountId));
const summary = computed(() => accountSummaries().find((s) => s.account.id === props.accountId));
const cards = computed(() => (account.value ? getCards({ accountId: account.value.id }) : []));
const rows = computed(() =>
  account.value ? getTransactions({ accountId: account.value.id, limit: 40 }) : [],
);
const days = computed(() => statementDays(rows.value));
const crumbs = computed(() => crumbsFor(pathname.value, account.value?.nickname ?? null));
const net = computed(() => (summary.value?.inThisMonth ?? 0) - (summary.value?.outThisMonth ?? 0));
</script>

<template>
  <Screen
    v-if="!account"
    :crumbs="crumbs"
    :title="t('banking.screen.notFound.title')"
    :subtitle="t('banking.screen.notFound.body')"
  >
    <EmptyState :message="t('banking.screen.notFound.body')" />
  </Screen>

  <Screen
    v-else
    :crumbs="crumbs"
    :title="account.nickname"
    :subtitle="t('banking.screen.account.subtitle')"
  >
    <template #aside>
      <StateChip :label-key="account.kindKey" color="info" />
      <md-chip variant="assist" appearance="outlined" color="secondary" :label="account.currency"></md-chip>
    </template>

    <div class="grid-2">
      <Panel :title="t('banking.panel.details')">
        <dl class="dl">
          <div>
            <dt>{{ t('banking.table.balance') }}</dt>
            <dd><Money :value="account.balance" :currency="account.currency" /></dd>
          </div>
          <div>
            <dt>{{ t('banking.table.available') }}</dt>
            <dd><Money :value="account.available" :currency="account.currency" /></dd>
          </div>
          <div v-if="account.currency !== BASE_CURRENCY">
            <dt>{{ BASE_CURRENCY }}</dt>
            <dd><Money :value="account.balanceEur" /></dd>
          </div>
          <div>
            <dt>{{ t('banking.table.iban') }}</dt>
            <!-- `bdi`: an IBAN is a neutral-direction string that must not be
                 re-ordered inside the Arabic layout. -->
            <dd><bdi class="num">{{ account.iban }}</bdi></dd>
          </div>
          <div v-if="account.interestRate !== null">
            <dt>{{ t('banking.table.interest') }}</dt>
            <dd><Percent :value="account.interestRate" /></dd>
          </div>
        </dl>

        <div v-if="account.goalTarget !== null" class="budget-row">
          <div class="budget-row__head">
            <span class="strong">{{ account.goalName }}</span>
            <span class="muted">
              {{
                t('banking.hint.vault', {
                  pct: t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
                  target: t.formatCurrency(account.goalTarget, { notation: 'compact' }),
                })
              }}
            </span>
          </div>
          <VaultMeter :fraction="account.goalFundedPct ?? 0" :label="account.goalName ?? ''" />
        </div>
      </Panel>

      <Panel :title="t('banking.common.thisMonth')">
        <dl class="dl">
          <div>
            <dt>{{ t('banking.kpi.income') }}</dt>
            <dd><Money :value="summary?.inThisMonth ?? 0" :currency="account.currency" /></dd>
          </div>
          <div>
            <dt>{{ t('banking.panel.spending') }}</dt>
            <dd><Money :value="summary?.outThisMonth ?? 0" :currency="account.currency" /></dd>
          </div>
          <div>
            <dt>{{ t('banking.kpi.netThisMonth') }}</dt>
            <dd><Signed :value="net" :currency="account.currency" /></dd>
          </div>
        </dl>

        <EmptyState v-if="cards.length === 0" :message="t('banking.empty.cards')" />
        <md-list v-else :label="t('banking.panel.cards')" interaction-mode="navigation" list-style="segmented">
          <md-list-item
            v-for="card in cards"
            :key="card.id"
            type="link"
            :href="withBase(route.cards())"
            :headline="card.label"
            :overline="t('banking.unit.endingIn', { last4: card.last4 })"
            lines="2"
            leading-icon="credit_card"
          >
            <span slot="trailing">
              <StateChip :label-key="card.stateKey" :color="cardStateColor[card.state]" />
            </span>
          </md-list-item>
        </md-list>
      </Panel>
    </div>

    <Panel :title="t('banking.action.statement')">
      <template #actions><Count :value="rows.length" /></template>
      <EmptyState v-if="days.length === 0" :message="t('banking.empty.transactions')" />
      <div v-for="day in days" v-else :key="day.date" class="stack">
        <div class="statement-day">
          <span><DateText :value="day.date" format="long" /></span>
          <Flow :value="day.netEur" />
        </div>
        <md-list
          :label="t.formatDate(day.date, 'long')"
          interaction-mode="multi-action"
          list-style="segmented"
        >
          <StatementRow v-for="txn in day.rows" :key="txn.id" :txn="txn" :show-date="false" />
        </md-list>
      </div>
    </Panel>
  </Screen>
</template>
