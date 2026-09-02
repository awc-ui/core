<!--
  One instrument: its price, the position in it, and the trades behind that.

  THE HOLDING BLOCK IS CONDITIONAL, and that is the shape of the screen: a
  watched instrument has a price and a chart and nothing else. Rendering an
  empty position block would say the reader holds zero of it, which is a
  different claim from not holding it at all.
-->
<script lang="ts">
  import {
    crumbsFor,
    getHoldingFor,
    getInstrumentById,
    getTrades,
    instrumentKindColor,
    tradeSideColor,
    tradeStatusColor,
  } from '@awc-ui/showcase-kit/banking';
  import { t } from '$lib/showcase';
  import { pathname } from '$lib/router';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import StateChip from '$lib/bits/StateChip.svelte';

  export let instrumentId: string;

  $: instrument = getInstrumentById(instrumentId);
  $: holding = getHoldingFor(instrumentId);
  $: trades = getTrades({ instrumentId });
  $: crumbs = crumbsFor($pathname, instrument?.name ?? null);
  /* Hoisted so the formatter closes over a resolved currency rather than
     reaching into a possibly-undefined record inside the template. */
  $: priceCurrency = instrument?.currency ?? 'EUR';
</script>

{#if !instrument}
  <Screen {crumbs} title={$t('banking.screen.notFound.title')} subtitle={$t('banking.screen.notFound.body')}>
    <EmptyState message={$t('banking.screen.notFound.body')} />
  </Screen>
{:else}
  <Screen {crumbs} title={instrument.name} subtitle={$t('banking.screen.instrument.subtitle')}>
    <svelte:fragment slot="aside">
      <StateChip labelKey={instrument.kindKey} color={instrumentKindColor[instrument.kind]} />
    </svelte:fragment>

    <Panel>
      <div class="instrument-head">
        <md-avatar initials={instrument.initials} size="large"></md-avatar>
        <div class="stack">
          <span class="strong">{instrument.ticker}</span>
          <span class="muted">
            {instrument.sectorKey ? $t(instrument.sectorKey) : $t(instrument.kindKey)}
          </span>
        </div>
        <div class="instrument-head__figures">
          <span class="kpi__value"><Money value={instrument.price} currency={instrument.currency} /></span>
          <Signed value={instrument.dayChangePct} kind="percent" />
        </div>
      </div>

      <dl class="dl">
        <div>
          <dt>{$t('banking.table.day')}</dt>
          <dd><Signed value={instrument.dayChangePct} kind="percent" /></dd>
        </div>
        <div>
          <dt>{$t('banking.table.week')}</dt>
          <dd><Signed value={instrument.weekChangePct} kind="percent" /></dd>
        </div>
        <div>
          <dt>{$t('banking.table.year')}</dt>
          <dd><Signed value={instrument.yearChangePct} kind="percent" /></dd>
        </div>
        <div>
          <dt>{$t('banking.table.currency')}</dt>
          <dd>{instrument.currency}</dd>
        </div>
      </dl>
    </Panel>

    <Panel title={$t('banking.panel.performance')}>
      <Chart
        tag="md-area-chart"
        class="chart-lg"
        series={[{ id: instrument.id, label: instrument.ticker, data: instrument.history.map((p) => p.price) }]}
        xAxis={{ data: instrument.history.map((p) => $t.formatDate(p.date, 'short')), scale: 'category' }}
        valueFormatter={(v) => $t.formatCurrency(v ?? 0, { currency: priceCurrency, maximumFractionDigits: 2 })}
        summary={$t('banking.panel.performance')}
        curve="monotone"
        grid="horizontal"
      />
    </Panel>

    {#if holding}
      <Panel title={$t('banking.panel.holdings')}>
        <dl class="dl">
          <div>
            <dt>{$t('banking.table.quantity')}</dt>
            <dd><Num value={holding.quantity} digits={instrument.kind === 'crypto' ? 4 : 2} /></dd>
          </div>
          <div>
            <dt>{$t('banking.table.value')}</dt>
            <dd><Money value={holding.marketValueEur} /></dd>
          </div>
          <div>
            <dt>{$t('banking.table.costBasis')}</dt>
            <dd><Money value={holding.costBasisEur} /></dd>
          </div>
          <div>
            <dt>{$t('banking.table.pl')}</dt>
            <dd><Signed value={holding.unrealisedPlEur} /></dd>
          </div>
          <div>
            <dt>{$t('banking.table.plPct')}</dt>
            <dd><Signed value={holding.unrealisedPlPct} kind="percent" /></dd>
          </div>
          <div>
            <dt>{$t('banking.table.allocation')}</dt>
            <dd><Percent value={holding.allocation} digits={1} /></dd>
          </div>
        </dl>
      </Panel>
    {/if}

    <Panel title={$t('banking.panel.tradeHistory')}>
      <svelte:fragment slot="actions"><Count value={trades.length} /></svelte:fragment>
      {#if trades.length === 0}
        <EmptyState message={$t('banking.empty.trades')} />
      {:else}
        <md-list label={$t('banking.panel.tradeHistory')} interaction-mode="multi-action" list-style="segmented">
          {#each trades as trade (trade.id)}
            <md-list-item
              headline={$t.formatDate(trade.date, 'medium')}
              overline={trade.id}
              supporting-text={`${$t('banking.table.price')} ${$t.formatCurrency(trade.priceEur)}`}
              lines="3"
            >
              <span slot="trailing" class="row">
                <StateChip labelKey={trade.sideKey} color={tradeSideColor[trade.side]} />
                <StateChip labelKey={trade.statusKey} color={tradeStatusColor[trade.status]} />
                <Money value={trade.amountEur} />
              </span>
            </md-list-item>
          {/each}
        </md-list>
      {/if}
    </Panel>
  </Screen>
{/if}
