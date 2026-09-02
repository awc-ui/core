<!--
  The statement — every movement across every account.

  GROUPED BY DAY, NOT PAGED. A statement is read by day: the heading is what
  lets someone find "that Tuesday", and it carries the day's net so nobody adds
  six rows up by eye. Paging would cut a day across a boundary, which is the one
  place a statement must not break.

  A STATEMENT HAS A PERIOD. The default is the reporting month — the whole
  twelve months is 652 rows and ~990 custom elements, which is a data dump
  rather than a statement. The period is a facet like the others, so the year
  is one chip away.

  ON A PHONE THE FILTERS COLLAPSE. Open, they are the entire first screen with
  no transaction visible until you scroll past controls for a list you have not
  seen.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  REPORTING_MONTH,
  getAccounts,
  getCategorySpend,
  getMonthlyFlow,
  getTransactions,
  statementDays,
  type Category,
  type TransactionStatus,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '~/composables/useShowcase';
import { PHONE, useMediaQuery } from '~/lib/media';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import EmptyState from '~/components/EmptyState.vue';
import Count from '~/components/bits/Count.vue';
import Flow from '~/components/bits/Flow.vue';
import DateText from '~/components/bits/DateText.vue';
import StatementRow from '~/components/bits/StatementRow.vue';
import TransactionsFilters from './TransactionsFilters.vue';

/** `reverted` is too rare to earn a chip. */
const STATUSES: TransactionStatus[] = ['completed', 'pending', 'declined'];
const ALL_MONTHS = 'all';

const t = useT();
const phone = useMediaQuery(PHONE);

const month = ref<string>(REPORTING_MONTH);
const accountId = ref<string | null>(null);
const category = ref<Category | null>(null);
const status = ref<TransactionStatus | null>(null);
const search = ref('');

const accounts = getAccounts();
/* Built from the whole month's categories, not the filtered set, so the chips
   do not disappear as soon as one is chosen. */
const categories = getCategorySpend();
/* Newest first — the six months a reader might plausibly scroll back to. */
const months = getMonthlyFlow().map((m) => m.month).reverse().slice(0, 6);
const total = getTransactions().length;

const rows = computed(() =>
  getTransactions({
    month: month.value === ALL_MONTHS ? undefined : month.value,
    accountId: accountId.value ?? undefined,
    category: category.value ?? undefined,
    status: status.value ?? undefined,
    search: search.value,
  }),
);

const days = computed(() => statementDays(rows.value));

const filtered = computed(
  () =>
    month.value !== REPORTING_MONTH ||
    accountId.value !== null ||
    category.value !== null ||
    status.value !== null ||
    search.value !== '',
);

const activeCount = computed(
  () =>
    (month.value === REPORTING_MONTH ? 0 : 1) +
    (accountId.value ? 1 : 0) +
    (category.value ? 1 : 0) +
    (status.value ? 1 : 0) +
    (search.value ? 1 : 0),
);

const clear = () => {
  month.value = REPORTING_MONTH;
  accountId.value = null;
  category.value = null;
  status.value = null;
  search.value = '';
};
</script>

<template>
  <Screen
    :title="t('banking.screen.transactions.title')"
    :subtitle="t('banking.screen.transactions.subtitle')"
  >
    <template #aside><Count :value="rows.length" /></template>

    <!--
      THE FILTERS COLLAPSE ON A PHONE. Open, they are four chip rows and a
      search bar — the whole first screen, with no transaction visible until
      the reader scrolls past controls for a list they have not seen yet.
      Behind a disclosure, the statement is what the screen opens on, and the
      header carries the count so a filtered list never looks like the whole
      one.
    -->
    <md-accordion v-if="phone" variant="outlined" heading-level="2">
      <md-accordion-item
        :headline="t('banking.action.filter')"
        icon="filter_list"
        :supporting-text="activeCount > 0 ? t('banking.common.showing', { shown: rows.length, total }) : undefined"
      >
        <TransactionsFilters
          v-model:month="month"
          v-model:account-id="accountId"
          v-model:category="category"
          v-model:status="status"
          v-model:search="search"
          :accounts="accounts"
          :categories="categories"
          :months="months"
          :all-months="ALL_MONTHS"
          :statuses="STATUSES"
          :shown="rows.length"
          :total="total"
          :filtered="filtered"
          @clear="clear"
        />
      </md-accordion-item>
    </md-accordion>

    <Panel v-else :title="t('banking.action.filter')">
      <TransactionsFilters
        v-model:month="month"
        v-model:account-id="accountId"
        v-model:category="category"
        v-model:status="status"
        v-model:search="search"
        :accounts="accounts"
        :categories="categories"
        :months="months"
        :all-months="ALL_MONTHS"
        :statuses="STATUSES"
        :shown="rows.length"
        :total="total"
        :filtered="filtered"
        @clear="clear"
      />
    </Panel>

    <EmptyState v-if="days.length === 0" :message="t('banking.empty.transactions')" hint />
    <Panel v-else>
      <div v-for="day in days" :key="day.date" class="stack">
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
