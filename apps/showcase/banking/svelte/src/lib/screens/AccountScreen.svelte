<!--
  One account: its details, its month, and its statement.

  A DRILL, NOT A DESTINATION — only reachable from the home screen's account
  list, and it renders breadcrumbs because it is one level down.

  THE GUARD IS HERE, NOT IN THE ROUTER. A component taking a plain string from
  a URL must not trust its caller.
-->
<script lang="ts">
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
  import { t } from '$lib/showcase';
  import { pathname } from '$lib/router';
  import { route, withBase } from '$lib/routes';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Flow from '$lib/bits/Flow.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import StateChip from '$lib/bits/StateChip.svelte';
  import VaultMeter from '$lib/bits/VaultMeter.svelte';
  import StatementRow from '$lib/bits/StatementRow.svelte';

  export let accountId: string;

  $: account = getAccountById(accountId);
  $: summary = accountSummaries().find((s) => s.account.id === accountId);
  $: cards = account ? getCards({ accountId: account.id }) : [];
  $: rows = account ? getTransactions({ accountId: account.id, limit: 40 }) : [];
  $: days = statementDays(rows);
  $: crumbs = crumbsFor($pathname, account?.nickname ?? null);
  $: net = (summary?.inThisMonth ?? 0) - (summary?.outThisMonth ?? 0);
</script>

{#if !account}
  <Screen {crumbs} title={$t('banking.screen.notFound.title')} subtitle={$t('banking.screen.notFound.body')}>
    <EmptyState message={$t('banking.screen.notFound.body')} />
  </Screen>
{:else}
  <Screen {crumbs} title={account.nickname} subtitle={$t('banking.screen.account.subtitle')}>
    <svelte:fragment slot="aside">
      <StateChip labelKey={account.kindKey} color="info" />
      <md-chip variant="assist" appearance="outlined" color="secondary" label={account.currency}></md-chip>
    </svelte:fragment>

    <div class="grid-2">
      <Panel title={$t('banking.panel.details')}>
        <dl class="dl">
          <div>
            <dt>{$t('banking.table.balance')}</dt>
            <dd><Money value={account.balance} currency={account.currency} /></dd>
          </div>
          <div>
            <dt>{$t('banking.table.available')}</dt>
            <dd><Money value={account.available} currency={account.currency} /></dd>
          </div>
          {#if account.currency !== BASE_CURRENCY}
            <div>
              <dt>{BASE_CURRENCY}</dt>
              <dd><Money value={account.balanceEur} /></dd>
            </div>
          {/if}
          <div>
            <dt>{$t('banking.table.iban')}</dt>
            <!-- `bdi`: an IBAN is a neutral-direction string that must not be
                 re-ordered inside the Arabic layout. -->
            <dd><bdi class="num">{account.iban}</bdi></dd>
          </div>
          {#if account.interestRate !== null}
            <div>
              <dt>{$t('banking.table.interest')}</dt>
              <dd><Percent value={account.interestRate} /></dd>
            </div>
          {/if}
        </dl>

        {#if account.goalTarget !== null}
          <div class="budget-row">
            <div class="budget-row__head">
              <span class="strong">{account.goalName}</span>
              <span class="muted">
                {$t('banking.hint.vault', {
                  pct: $t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
                  target: $t.formatCurrency(account.goalTarget, { notation: 'compact' }),
                })}
              </span>
            </div>
            <VaultMeter fraction={account.goalFundedPct ?? 0} label={account.goalName ?? ''} />
          </div>
        {/if}
      </Panel>

      <Panel title={$t('banking.common.thisMonth')}>
        <dl class="dl">
          <div>
            <dt>{$t('banking.kpi.income')}</dt>
            <dd><Money value={summary?.inThisMonth ?? 0} currency={account.currency} /></dd>
          </div>
          <div>
            <dt>{$t('banking.panel.spending')}</dt>
            <dd><Money value={summary?.outThisMonth ?? 0} currency={account.currency} /></dd>
          </div>
          <div>
            <dt>{$t('banking.kpi.netThisMonth')}</dt>
            <dd><Signed value={net} currency={account.currency} /></dd>
          </div>
        </dl>

        {#if cards.length === 0}
          <EmptyState message={$t('banking.empty.cards')} />
        {:else}
          <md-list label={$t('banking.panel.cards')} interaction-mode="navigation" list-style="segmented">
            {#each cards as card (card.id)}
              <md-list-item
                type="link"
                href={withBase(route.cards())}
                headline={card.label}
                overline={$t('banking.unit.endingIn', { last4: card.last4 })}
                lines="2"
                leading-icon="credit_card"
              >
                <span slot="trailing">
                  <StateChip labelKey={card.stateKey} color={cardStateColor[card.state]} />
                </span>
              </md-list-item>
            {/each}
          </md-list>
        {/if}
      </Panel>
    </div>

    <Panel title={$t('banking.action.statement')}>
      <svelte:fragment slot="actions"><Count value={rows.length} /></svelte:fragment>
      {#if days.length === 0}
        <EmptyState message={$t('banking.empty.transactions')} />
      {:else}
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
      {/if}
    </Panel>
  </Screen>
{/if}
