<!--
  Home — what someone opens the app to see.

  FOUR HEADLINES, THEN THE ACCOUNTS, THEN WHAT NEEDS ATTENTION. The order is
  the reading order of "am I fine?": the net figure, then where the money
  physically is, then anything unusual.

  NOTHING HERE COMPUTES ANYTHING. Every figure is a kit field or the return of
  a kit function — `headlines()`, `balanceSeries()`, `accountSummaries()`,
  `budgetOverall()`, `upcomingCharges()`.
-->
<script lang="ts">
  import {
    BASE_CURRENCY,
    accountSummaries,
    balanceSeries,
    budgetOverall,
    cardStateColor,
    getCards,
    getTotals,
    getTransactions,
    headlines,
    upcomingCharges,
  } from '@awc-ui/showcase-kit/banking';
  import { t } from '$lib/showcase';
  import { route, withBase } from '$lib/routes';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Count from '$lib/bits/Count.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import StateChip from '$lib/bits/StateChip.svelte';
  import BudgetMeter from '$lib/bits/BudgetMeter.svelte';
  import VaultMeter from '$lib/bits/VaultMeter.svelte';
  import StatementRow from '$lib/bits/StatementRow.svelte';

  const totals = getTotals();
  const summaries = accountSummaries();
  const curve = balanceSeries();
  const budget = budgetOverall();
  const charges = upcomingCharges(4);
  const cards = getCards();
  /* A preview of the statement, in the statement's own default order. */
  const recent = getTransactions({ limit: 6 });
  const vaults = summaries.filter(({ account }) => account.goalTarget !== null);

  /* The overall meter takes the WORST status of the five, not an average: one
     category 15% over is the thing worth surfacing. */
  const budgetStatus =
    totals.budgetOverCount > 0 ? 'over' : totals.budgetNearCount > 0 ? 'near' : 'under';

  $: trendLabels = curve.map((p) => $t.formatDate(`${p.month}-01`, 'monthYear'));
</script>

<Screen title={$t('banking.screen.home.title')} subtitle={$t('banking.screen.home.subtitle')}>
  <svelte:fragment slot="aside">
    <md-button variant="tonal" size="sm" icon="currency_exchange" href={withBase(route.exchange())}>
      {$t('banking.action.exchange')}
    </md-button>
    <md-button variant="text" size="sm" icon="receipt_long" href={withBase(route.transactions())}>
      {$t('banking.action.statement')}
    </md-button>
  </svelte:fragment>

  <section class="kpi-grid">
    {#each headlines() as h (h.labelKey)}
      <KpiTile
        label={$t(h.labelKey)}
        trend={h.labelKey === 'banking.kpi.balance' ? curve.map((p) => p.balanceEur) : undefined}
        {trendLabels}
        formatTrend={(v) => $t.formatCurrency(v ?? 0, { notation: 'compact' })}
      >
        <svelte:fragment slot="value"><Money value={h.valueEur} compact /></svelte:fragment>
        <svelte:fragment slot="hint">
          {#if h.changePct !== null}
            <Signed value={h.changePct} kind="percent" />
            {h.labelKey === 'banking.kpi.spentThisMonth'
              ? $t('banking.common.vsLastMonth')
              : $t('banking.kpi.unrealisedPl')}
          {/if}
        </svelte:fragment>
      </KpiTile>
    {/each}
  </section>

  <div class="grid-2">
    <Panel
      title={$t('banking.panel.accounts')}
      subtitle={$t('banking.app.baseCurrency', { currency: BASE_CURRENCY })}
    >
      <svelte:fragment slot="actions"><Count value={totals.accountCount} /></svelte:fragment>

      <md-list label={$t('banking.panel.accounts')} interaction-mode="navigation" list-style="segmented">
        {#each summaries as { account, transactionCount } (account.id)}
          <md-list-item
            type="link"
            href={withBase(route.account(account.id))}
            headline={account.nickname}
            lines="3"
            overline={`${$t(account.kindKey)} · ${account.currency}`}
            supporting-text={$t('banking.common.transactions', { count: transactionCount })}
            leading-icon={account.kind === 'vault' ? 'savings' : 'account_balance_wallet'}
          >
            <span slot="trailing" class="account-row__figures">
              <Money value={account.balance} currency={account.currency} />
              <!-- The EUR twin only when it differs — the same figure twice is
                   noise on the three EUR accounts. -->
              {#if account.currency !== BASE_CURRENCY}
                <span class="muted"><Money value={account.balanceEur} compact /></span>
              {/if}
            </span>
          </md-list-item>
        {/each}
      </md-list>

      <!-- The vault's progress, under the list it belongs to rather than as a
           sixth row — the same account, shown a second way. -->
      {#each vaults as { account } (account.id)}
        <div class="budget-row">
          <div class="budget-row__head">
            <span class="strong">{account.goalName}</span>
            <span class="muted">
              {$t('banking.hint.vault', {
                pct: $t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
                target: $t.formatCurrency(account.goalTarget ?? 0, { notation: 'compact' }),
              })}
            </span>
          </div>
          <VaultMeter fraction={account.goalFundedPct ?? 0} label={account.goalName ?? ''} />
        </div>
      {/each}
    </Panel>

    <Panel
      title={$t('banking.panel.balanceTrend')}
      subtitle={$t('banking.common.showing', { shown: curve.length, total: curve.length })}
    >
      <Chart
        tag="md-area-chart"
        class="chart-md"
        series={[{ id: 'balance', label: $t('banking.kpi.balance'), data: curve.map((p) => p.balanceEur) }]}
        xAxis={{ data: trendLabels, scale: 'category' }}
        valueFormatter={(v) => $t.formatCurrency(v ?? 0, { notation: 'compact' })}
        summary={$t('banking.panel.balanceTrend')}
        curve="monotone"
        grid="horizontal"
      />
    </Panel>
  </div>

  <div class="grid-2">
    <Panel title={$t('banking.panel.spending')} subtitle={$t('banking.common.thisMonth')}>
      <svelte:fragment slot="actions">
        <md-button variant="text" size="sm" href={withBase(route.analytics())}>
          {$t('banking.action.viewAll')}
        </md-button>
      </svelte:fragment>

      <dl class="dl">
        <div>
          <dt>{$t('banking.kpi.spentThisMonth')}</dt>
          <dd><Money value={totals.spentThisMonthEur} /></dd>
        </div>
        <div>
          <dt>{$t('banking.kpi.income')}</dt>
          <dd><Money value={totals.incomeThisMonthEur} /></dd>
        </div>
        <div>
          <dt>{$t('banking.kpi.netThisMonth')}</dt>
          <dd><Signed value={totals.netThisMonthEur} /></dd>
        </div>
      </dl>

      <div class="budget-row">
        <div class="budget-row__head">
          <span>{$t('banking.kpi.budgetUsed')}</span>
          <span class="strong"><Percent value={budget.usedPct} /></span>
        </div>
        <BudgetMeter fraction={budget.usedPct} status={budgetStatus} />
        <div class="budget-row__foot">
          <span><Money value={budget.spent} compact /> / <Money value={budget.limit} compact /></span>
          {#if totals.budgetOverCount > 0}<span>{$t('banking.budgetStatus.over')}</span>{/if}
        </div>
      </div>
    </Panel>

    <Panel title={$t('banking.panel.upcoming')} subtitle={$t('banking.kpi.subscriptions')}>
      <svelte:fragment slot="actions"><Count value={totals.activeSubscriptionCount} /></svelte:fragment>
      <md-list label={$t('banking.panel.upcoming')} interaction-mode="multi-action" list-style="segmented">
        {#each charges as charge (charge.subscriptionId)}
          <md-list-item headline={charge.name} overline={$t(charge.cadenceKey)} lines="2">
            <span slot="leading"><md-avatar initials={charge.initials} size="small"></md-avatar></span>
            <span slot="trailing" class="account-row__figures">
              <Money value={charge.amountEur} />
              <span class="muted"><DateText value={charge.nextChargeDate} /></span>
            </span>
          </md-list-item>
        {/each}
      </md-list>
    </Panel>
  </div>

  <div class="grid-2">
    <Panel title={$t('banking.panel.recent')}>
      <svelte:fragment slot="actions">
        <md-button variant="text" size="sm" href={withBase(route.transactions())}>
          {$t('banking.action.viewAll')}
        </md-button>
      </svelte:fragment>
      <md-list label={$t('banking.panel.recent')} interaction-mode="multi-action" list-style="segmented">
        {#each recent as txn (txn.id)}<StatementRow {txn} />{/each}
      </md-list>
    </Panel>

    <Panel title={$t('banking.panel.cards')}>
      <svelte:fragment slot="actions">
        <md-button variant="text" size="sm" href={withBase(route.cards())}>
          {$t('banking.action.viewAll')}
        </md-button>
      </svelte:fragment>
      <md-list label={$t('banking.panel.cards')} interaction-mode="navigation" list-style="segmented">
        {#each cards as card (card.id)}
          <md-list-item
            type="link"
            href={withBase(route.cards())}
            headline={card.label}
            overline={$t('banking.unit.endingIn', { last4: card.last4 })}
            supporting-text={`${$t(card.kindKey)} · ${$t(card.stateKey)}`}
            lines="3"
            leading-icon="credit_card"
          >
            <!-- No status dot: it anchors absolutely with nothing to anchor to,
                 and the chip beside it already says the same word. -->
            <span slot="trailing">
              <StateChip labelKey={card.stateKey} color={cardStateColor[card.state]} />
            </span>
          </md-list-item>
        {/each}
      </md-list>
    </Panel>
  </div>
</Screen>
