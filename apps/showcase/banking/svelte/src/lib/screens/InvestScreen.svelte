<!--
  The investing account: what is held, what is watched, what has been traded.

  CONSUMER-GRADE ON PURPOSE. The wealth console next door has an institutional
  order ticket. This is the other thing: a quantity, an estimate, and a button.

  THE PORTFOLIO CURVE IS LABELLED FOR WHAT IT IS. `portfolioSeries()` holds
  today's quantities constant and re-prices them down the history — how the
  CURRENT portfolio would have moved, not what it was worth on each day.
-->
<script lang="ts">
  import {
    TABLES,
    getTotals,
    getTrades,
    holdingRows,
    instrumentKindColor,
    portfolioRing,
    portfolioSeries,
    tradeEstimate,
    tradeSideColor,
    tradeStatusColor,
    watchlistRows,
  } from '@awc-ui/showcase-kit/banking';
  import { state, t } from '$lib/showcase';
  import { phone } from '$lib/media';
  import { route, withBase } from '$lib/routes';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Count from '$lib/bits/Count.svelte';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import StateChip from '$lib/bits/StateChip.svelte';

  const totals = getTotals();
  const holdings = holdingRows();
  const watchlist = watchlistRows();
  const trades = getTrades({ limit: 10 });
  const ring = portfolioRing();
  const curve = portfolioSeries();
  const layout = TABLES.holdings();

  /* Defaults to the largest holding — never an empty select. */
  let instrumentId = holdings[0]?.instrument.id ?? '';
  let quantity: number | null = 1;
  let placed = false;

  $: estimate = quantity === null ? null : tradeEstimate(instrumentId, quantity);
  $: reason = estimate === null ? $t('banking.hint.quantityNeeded') : null;

  const onQuantityInput = (e: CustomEvent<{ value: number | null }>) => {
    quantity = e.detail.value;
    placed = false;
  };
  const onQuantityChange = (e: CustomEvent<{ value: number | null }>) => {
    quantity = e.detail.value;
  };
  const onPick = (e: CustomEvent<string | string[]>) => {
    const d = e.detail;
    const v = Array.isArray(d) ? d[0] : d;
    if (v) instrumentId = v;
    placed = false;
  };
</script>

<Screen title={$t('banking.screen.invest.title')} subtitle={$t('banking.screen.invest.subtitle')}>
  <svelte:fragment slot="aside"><Count value={totals.holdingCount} /></svelte:fragment>

  <section class="kpi-grid">
    <KpiTile label={$t('banking.kpi.portfolio')}>
      <svelte:fragment slot="value"><Money value={totals.portfolioValueEur} compact /></svelte:fragment>
      <svelte:fragment slot="hint"><Signed value={totals.portfolioReturnPct} kind="percent" /></svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('banking.kpi.unrealisedPl')}>
      <svelte:fragment slot="value"><Signed value={totals.portfolioUnrealisedPlEur} compact /></svelte:fragment>
      <svelte:fragment slot="hint"><Money value={totals.portfolioCostBasisEur} compact /></svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('banking.kpi.dayChange')}>
      <svelte:fragment slot="value"><Signed value={totals.portfolioDayChangeEur} /></svelte:fragment>
    </KpiTile>
    <KpiTile label={$t('banking.panel.holdings')}>
      <svelte:fragment slot="value"><Num value={holdings.length} /></svelte:fragment>
      <svelte:fragment slot="hint">{$t('banking.kpi.watchlist')}</svelte:fragment>
      <svelte:fragment slot="trailing"><Count value={totals.watchlistCount} /></svelte:fragment>
    </KpiTile>
  </section>

  <div class="grid-2">
    <Panel title={$t('banking.panel.performance')} subtitle={$t('banking.hint.portfolioSeries')}>
      {#if curve.length > 0}
        <Chart
          tag="md-area-chart"
          class="chart-md"
          series={[{ id: 'value', label: $t('banking.kpi.portfolio'), data: curve.map((p) => p.valueEur) }]}
          xAxis={{ data: curve.map((p) => $t.formatDate(p.date, 'short')), scale: 'category' }}
          valueFormatter={(v) => $t.formatCurrency(v ?? 0, { notation: 'compact' })}
          summary={$t('banking.panel.performance')}
          curve="monotone"
          grid="horizontal"
        />
      {/if}
    </Panel>

    <Panel title={$t('banking.panel.allocation')}>
      <Chart
        tag="md-pie-chart"
        class="chart-md"
        data={ring.map((slice) => ({ id: slice.id, label: slice.labelKey, value: slice.value }))}
        valueFormatter={(v) => $t.formatCurrency(v ?? 0, { notation: 'compact' })}
        summary={$t('banking.panel.allocation')}
        inner-radius="62%"
        show-labels="false"
        legend="bottom"
      >
        <svelte:fragment slot="center">
          <span class="ring-centre__value"><Money value={totals.portfolioValueEur} compact /></span>
          <span class="ring-centre__label">{$t('banking.kpi.portfolio')}</span>
        </svelte:fragment>
      </Chart>
    </Panel>
  </div>

  <Panel title={$t('banking.panel.tradeTicket')}>
    <div class="stack form-stack">
      <md-select label={$t('banking.table.name')} value={instrumentId} on:mdChange={onPick}>
        {#each holdings as h (h.instrument.id)}
          <md-select-option
            value={h.instrument.id}
            label={`${h.instrument.ticker} — ${h.instrument.name}`}
          ></md-select-option>
        {/each}
      </md-select>

      <!-- No `format-options`: a quantity is a bare count of units, and a
           crypto holding is fractional to four places. -->
      <md-number-field
        label={$t('banking.table.quantity')}
        value={quantity}
        min={0}
        step={1}
        small-step="0.1"
        large-step="10"
        locale={$state.locale}
        on:mdInput={onQuantityInput}
        on:mdChange={onQuantityChange}
      ></md-number-field>

      {#if estimate}
        <div class="stack">
          <div class="quote-line">
            <span>{$t('banking.table.price')}</span>
            <span class="num"><Money value={estimate.priceEur} /></span>
          </div>
          <div class="quote-line">
            <span>{$t('banking.table.fee')}</span>
            <span class="num"><Money value={estimate.feeEur} /></span>
          </div>
          <div class="quote-line quote-line--total">
            <span>{$t('banking.table.total')}</span>
            <span class="num"><Money value={estimate.totalEur} /></span>
          </div>
        </div>
      {/if}

      <div class="row">
        <md-tooltip text={reason ?? ''} disabled={reason === null || undefined}>
          <md-button
            variant="filled"
            icon="trending_up"
            soft-disabled={reason !== null || placed || undefined}
            on:click={() => (placed = true)}
          >
            {$t('banking.action.buy')}
          </md-button>
        </md-tooltip>
        <md-button
          variant="tonal"
          icon="trending_down"
          soft-disabled={reason !== null || placed || undefined}
          on:click={() => (placed = true)}
        >
          {$t('banking.action.sell')}
        </md-button>
        {#if placed}<span class="muted">{$t('banking.msg.tradePlaced')}</span>{/if}
      </div>
    </div>
  </Panel>

  <Panel title={$t('banking.panel.holdings')}>
    <svelte:fragment slot="actions"><Count value={holdings.length} /></svelte:fragment>
    {#if holdings.length === 0}
      <EmptyState message={$t('banking.empty.holdings')} />
    {:else if $phone}
      <!--
        A LIST ON A PHONE, NOT THE TABLE. The table needs 1040px for nine
        columns and scrolls honestly below that, but scrolling a nine-column
        grid sideways on a 390px screen is not reading a portfolio — and value,
        P/L and weight are exactly the columns that end up off-screen.
      -->
      <md-list label={$t('banking.panel.holdings')} interaction-mode="navigation" list-style="segmented">
        {#each holdings as h (h.instrument.id)}
          <md-list-item
            type="link"
            href={withBase(route.instrument(h.instrument.id))}
            headline={h.instrument.name}
            overline={h.instrument.ticker}
            supporting-text={`${$t(h.instrument.kindKey)} · ${$t.formatPercent(h.allocation, { maximumFractionDigits: 1 })}`}
            lines="3"
          >
            <span slot="leading"><md-avatar initials={h.instrument.initials} size="small"></md-avatar></span>
            <span slot="trailing" class="account-row__figures">
              <Money value={h.marketValueEur} />
              <Signed value={h.unrealisedPlPct} kind="percent" />
            </span>
          </md-list-item>
        {/each}
      </md-list>
    {:else}
      <md-table-container variant="outlined" class="table-host">
        <md-table
          label={$t('banking.panel.holdings')}
          column-template={layout.columns}
          min-width={layout.minWidth}
          keep-height="false"
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              <md-table-cell head scope="col">{$t('banking.table.ticker')}</md-table-cell>
              <md-table-cell head scope="col">{$t('banking.table.name')}</md-table-cell>
              <md-table-cell head scope="col">{$t('banking.table.kind')}</md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('banking.table.quantity')}</md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('banking.table.price')}</md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('banking.table.value')}</md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('banking.table.pl')}</md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('banking.table.plPct')}</md-table-cell>
              <md-table-cell head scope="col" numeric>{$t('banking.table.allocation')}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            {#each holdings as h (h.instrument.id)}
              <md-table-row value={h.instrument.id}>
                <md-table-cell>
                  <Drill href={withBase(route.instrument(h.instrument.id))}>
                    <span class="strong">{h.instrument.ticker}</span>
                  </Drill>
                </md-table-cell>
                <md-table-cell>{h.instrument.name}</md-table-cell>
                <md-table-cell>
                  <StateChip labelKey={h.instrument.kindKey} color={instrumentKindColor[h.instrument.kind]} />
                </md-table-cell>
                <md-table-cell numeric>
                  <Num value={h.quantity} digits={h.instrument.kind === 'crypto' ? 4 : 2} />
                </md-table-cell>
                <md-table-cell numeric><Money value={h.instrument.priceEur} /></md-table-cell>
                <md-table-cell numeric><Money value={h.marketValueEur} compact /></md-table-cell>
                <md-table-cell numeric><Signed value={h.unrealisedPlEur} compact /></md-table-cell>
                <md-table-cell numeric><Signed value={h.unrealisedPlPct} kind="percent" /></md-table-cell>
                <md-table-cell numeric><Percent value={h.allocation} digits={1} /></md-table-cell>
              </md-table-row>
            {/each}
          </md-table-body>
        </md-table>
      </md-table-container>
    {/if}
  </Panel>

  <div class="grid-2">
    <Panel title={$t('banking.panel.watchlist')}>
      <svelte:fragment slot="actions"><Count value={watchlist.length} /></svelte:fragment>
      {#if watchlist.length === 0}
        <EmptyState message={$t('banking.empty.watchlist')} />
      {:else}
        <md-list label={$t('banking.panel.watchlist')} interaction-mode="navigation" list-style="segmented">
          {#each watchlist as instrument (instrument.id)}
            <md-list-item
              type="link"
              href={withBase(route.instrument(instrument.id))}
              headline={instrument.name}
              overline={instrument.ticker}
              supporting-text={$t(instrument.kindKey)}
              lines="3"
            >
              <span slot="leading"><md-avatar initials={instrument.initials} size="small"></md-avatar></span>
              <span slot="trailing" class="account-row__figures">
                <Money value={instrument.priceEur} />
                <Signed value={instrument.dayChangePct} kind="percent" />
              </span>
            </md-list-item>
          {/each}
        </md-list>
      {/if}
    </Panel>

    <Panel title={$t('banking.panel.tradeHistory')}>
      <svelte:fragment slot="actions"><Count value={trades.length} /></svelte:fragment>
      {#if trades.length === 0}
        <EmptyState message={$t('banking.empty.trades')} />
      {:else}
        <md-list label={$t('banking.panel.tradeHistory')} interaction-mode="multi-action" list-style="segmented">
          {#each trades as trade (trade.id)}
            <md-list-item
              headline={trade.instrumentId}
              overline={$t.formatDate(trade.date, 'medium')}
              supporting-text={`${$t(trade.sideKey)} · ${$t(trade.statusKey)}`}
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
  </div>
</Screen>
