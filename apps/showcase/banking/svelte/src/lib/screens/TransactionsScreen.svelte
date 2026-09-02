<!--
  The statement — every movement across every account.

  GROUPED BY DAY, NOT PAGED. A statement is read by day, and paging would cut a
  day across a boundary.

  A STATEMENT HAS A PERIOD. The default is the reporting month; the whole twelve
  months is 652 rows and ~990 custom elements, which is a data dump rather than
  a statement. The period is a facet, so the year is one chip away.

  ON A PHONE THE FILTERS COLLAPSE. Open, they are the entire first screen with
  no transaction visible until you scroll past controls for a list you have not
  seen.
-->
<script lang="ts">
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
  import { t } from '$lib/showcase';
  import { phone } from '$lib/media';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Flow from '$lib/bits/Flow.svelte';
  import StatementRow from '$lib/bits/StatementRow.svelte';
  import TransactionsFilters from './TransactionsFilters.svelte';

  /** `reverted` is too rare to earn a chip. */
  const STATUSES: TransactionStatus[] = ['completed', 'pending', 'declined'];
  const ALL_MONTHS = 'all';

  const accounts = getAccounts();
  /* Built from the whole month's categories, not the filtered set, so the chips
     do not disappear as soon as one is chosen. */
  const categories = getCategorySpend();
  /* Newest first — the six months a reader might plausibly scroll back to. */
  const months = getMonthlyFlow().map((m) => m.month).reverse().slice(0, 6);
  const total = getTransactions().length;

  let month = REPORTING_MONTH;
  let accountId: string | null = null;
  let category: Category | null = null;
  let status: TransactionStatus | null = null;
  let search = '';

  $: rows = getTransactions({
    month: month === ALL_MONTHS ? undefined : month,
    accountId: accountId ?? undefined,
    category: category ?? undefined,
    status: status ?? undefined,
    search,
  });
  $: days = statementDays(rows);
  $: filtered =
    month !== REPORTING_MONTH ||
    accountId !== null ||
    category !== null ||
    status !== null ||
    search !== '';
  $: activeCount =
    (month === REPORTING_MONTH ? 0 : 1) +
    (accountId ? 1 : 0) +
    (category ? 1 : 0) +
    (status ? 1 : 0) +
    (search ? 1 : 0);

  const clear = () => {
    month = REPORTING_MONTH;
    accountId = null;
    category = null;
    status = null;
    search = '';
  };
</script>

<Screen
  title={$t('banking.screen.transactions.title')}
  subtitle={$t('banking.screen.transactions.subtitle')}
>
  <svelte:fragment slot="aside"><Count value={rows.length} /></svelte:fragment>

  {#if $phone}
    <md-accordion variant="outlined" heading-level="2">
      <md-accordion-item
        headline={$t('banking.action.filter')}
        icon="filter_list"
        supporting-text={activeCount > 0
          ? $t('banking.common.showing', { shown: rows.length, total })
          : undefined}
      >
        <TransactionsFilters
          {accounts}
          {categories}
          {months}
          allMonths={ALL_MONTHS}
          statuses={STATUSES}
          shown={rows.length}
          {total}
          {filtered}
          bind:month
          bind:accountId
          bind:category
          bind:status
          bind:search
          onClear={clear}
        />
      </md-accordion-item>
    </md-accordion>
  {:else}
    <Panel title={$t('banking.action.filter')}>
      <TransactionsFilters
        {accounts}
        {categories}
        {months}
        allMonths={ALL_MONTHS}
        statuses={STATUSES}
        shown={rows.length}
        {total}
        {filtered}
        bind:month
        bind:accountId
        bind:category
        bind:status
        bind:search
        onClear={clear}
      />
    </Panel>
  {/if}

  {#if days.length === 0}
    <EmptyState message={$t('banking.empty.transactions')} hint />
  {:else}
    <Panel>
      {#each days as day (day.date)}
        <div class="stack">
          <div class="statement-day">
            <span><DateText value={day.date} format="long" /></span>
            <Flow value={day.netEur} />
          </div>
          <md-list
            label={$t.formatDate(day.date, 'long')}
            interaction-mode="multi-action"
            list-style="segmented"
          >
            {#each day.rows as txn (txn.id)}<StatementRow {txn} showDate={false} />{/each}
          </md-list>
        </div>
      {/each}
    </Panel>
  {/if}
</Screen>
