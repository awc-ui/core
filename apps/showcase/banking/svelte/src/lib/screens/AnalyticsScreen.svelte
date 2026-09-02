<!--
  Where the money went this month.

  THE RING, THEN THE BUDGETS, THEN THE MERCHANTS — decreasing abstraction. The
  ring says how the month was shaped; the budgets whether that was the plan; the
  merchant list what to do about it.

  EVERY FIGURE HERE IS A POSITIVE MAGNITUDE, the one place this app's sign
  convention is set aside — a ring cannot draw a negative slice. It is set aside
  by taking the kit's own positive `amountEur`, never by negating in markup.
-->
<script lang="ts">
  import {
    budgetColor,
    budgetRows,
    categoryColor,
    categoryIcon,
    categoryRing,
    flowSeries,
    getTotals,
    spendSeries,
    topMerchants,
    uncappedCategories,
  } from '@awc-ui/showcase-kit/banking';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import StateChip from '$lib/bits/StateChip.svelte';
  import BudgetMeter from '$lib/bits/BudgetMeter.svelte';

  const totals = getTotals();
  const ring = categoryRing();
  const budgets = budgetRows();
  const merchants = topMerchants(6);
  const flow = flowSeries();
  const spend = spendSeries();
  const uncapped = uncappedCategories();

  $: monthLabels = spend.map((p) => $t.formatDate(`${p.month}-01`, 'monthYear'));
</script>

<Screen title={$t('banking.screen.analytics.title')} subtitle={$t('banking.screen.analytics.subtitle')}>
  <svelte:fragment slot="aside"><Count value={totals.monthTransactionCount} /></svelte:fragment>

  <section class="kpi-grid">
    <KpiTile
      label={$t('banking.kpi.spentThisMonth')}
      trend={spend.map((p) => p.spentEur)}
      trendLabels={monthLabels}
      formatTrend={(v) => $t.formatCurrency(v ?? 0, { notation: 'compact' })}
    >
      <svelte:fragment slot="value"><Money value={totals.spentThisMonthEur} /></svelte:fragment>
      <svelte:fragment slot="hint">
        <Signed value={totals.spendChangePct} kind="percent" /> {$t('banking.common.vsLastMonth')}
      </svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('banking.kpi.income')}>
      <svelte:fragment slot="value"><Money value={totals.incomeThisMonthEur} /></svelte:fragment>
      <svelte:fragment slot="hint">{$t('banking.common.thisMonth')}</svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('banking.kpi.netThisMonth')}>
      <svelte:fragment slot="value"><Signed value={totals.netThisMonthEur} /></svelte:fragment>
      <svelte:fragment slot="hint">{$t('banking.common.thisMonth')}</svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('banking.kpi.subscriptions')}>
      <svelte:fragment slot="value"><Money value={totals.subscriptionMonthlyEur} /></svelte:fragment>
      <svelte:fragment slot="hint">{$t('banking.common.perMonth')}</svelte:fragment>
      <svelte:fragment slot="trailing"><Count value={totals.activeSubscriptionCount} /></svelte:fragment>
    </KpiTile>
  </section>

  <div class="grid-2">
    <Panel title={$t('banking.panel.byCategory')} subtitle={$t('banking.common.thisMonth')}>
      <!--
        `inner-radius` makes it a donut — there is no `variant` prop.
        `show-labels` is OFF: eight slices, the smallest under 5%, each printing
        a currency figure in white on a mid-tone fill, the two smallest
        overlapping outright. The legend names them, the tooltip gives values,
        the data table carries the full set, and every figure is listed below.
      -->
      <Chart
        tag="md-pie-chart"
        class="chart-md"
        data={ring.map((slice) => ({ id: slice.id, label: $t(slice.labelKey), value: slice.value }))}
        valueFormatter={(v) => $t.formatCurrency(v ?? 0, { notation: 'compact' })}
        summary={$t('banking.panel.byCategory')}
        inner-radius="62%"
        show-labels="false"
        legend="bottom"
      >
        <svelte:fragment slot="center">
          <span class="ring-centre__value"><Money value={totals.spentThisMonthEur} compact /></span>
          <span class="ring-centre__label">{$t('banking.common.thisMonth')}</span>
        </svelte:fragment>
      </Chart>
    </Panel>

    <Panel title={$t('banking.panel.flow')}>
      <!-- Two bars per month rather than one signed bar: in and out are
           different quantities, and a net bar hides a month where both
           doubled. -->
      <Chart
        tag="md-bar-chart"
        class="chart-md"
        series={[
          { id: 'in', label: $t('banking.kpi.income'), data: flow.map((p) => p.inEur) },
          { id: 'out', label: $t('banking.panel.spending'), data: flow.map((p) => p.outEur) },
        ]}
        xAxis={{ data: flow.map((p) => $t.formatDate(`${p.month}-01`, 'monthYear')) }}
        yAxis={{ min: 0 }}
        valueFormatter={(v) => $t.formatCurrency(v ?? 0, { notation: 'compact' })}
        label={$t('banking.panel.flow')}
        legend="top-end"
      />
    </Panel>
  </div>

  <Panel title={$t('banking.panel.budgets')} subtitle={$t('banking.common.thisMonth')}>
    <svelte:fragment slot="actions">
      {#if totals.budgetOverCount > 0}
        <md-chip
          variant="assist"
          appearance="outlined"
          color="error"
          label={String(totals.budgetOverCount)}
          icon="warning"
        ></md-chip>
      {/if}
    </svelte:fragment>

    <div class="grid-2">
      {#each budgets as budget (budget.category)}
        <md-card variant="outlined" full-width class="surface-card">
          <div class="budget-row">
            <div class="budget-row__head">
              <StateChip
                labelKey={budget.categoryKey}
                color={categoryColor[budget.category]}
                icon={categoryIcon[budget.category]}
              />
              <StateChip labelKey={budget.statusKey} color={budgetColor[budget.status]} />
            </div>
            <BudgetMeter fraction={budget.usedPct} status={budget.status} />
            <div class="budget-row__foot">
              <span><Money value={budget.spent} /> / <Money value={budget.monthlyLimit} /></span>
              <span><Percent value={budget.usedPct} /></span>
            </div>
            <!-- The trend separates "over for the first time in a year" from
                 "over every month", which the number alone cannot say. -->
            <Sparkline
              data={budget.trend}
              labels={monthLabels}
              valueFormatter={(v) => $t.formatCurrency(v ?? 0, { notation: 'compact' })}
              variant="area"
              color={budget.status === 'over' ? 'error' : 'primary'}
              curve="monotone"
              height="34px"
            />
          </div>
        </md-card>
      {/each}
    </div>

    {#if uncapped.length > 0}
      <div class="row">
        <span class="muted">{$t('banking.action.setBudget')}</span>
        {#each uncapped as row (row.category)}
          <StateChip
            labelKey={row.categoryKey}
            color={categoryColor[row.category]}
            icon={categoryIcon[row.category]}
          />
        {/each}
      </div>
    {/if}
  </Panel>

  <Panel title={$t('banking.panel.byMerchant')}>
    <svelte:fragment slot="actions"><Count value={merchants.length} /></svelte:fragment>
    {#if merchants.length === 0}
      <EmptyState message={$t('banking.empty.transactions')} />
    {:else}
      <md-list label={$t('banking.panel.byMerchant')} interaction-mode="multi-action" list-style="segmented">
        {#each merchants as merchant (merchant.merchantId)}
          <md-list-item
            headline={merchant.name}
            overline={$t(merchant.categoryKey)}
            supporting-text={$t('banking.common.visits', { count: merchant.transactionCount })}
            lines="3"
          >
            <span slot="leading"><md-avatar initials={merchant.initials} size="small"></md-avatar></span>
            <span slot="trailing"><Money value={merchant.amountEur} /></span>
          </md-list-item>
        {/each}
      </md-list>
    {/if}
  </Panel>
</Screen>
