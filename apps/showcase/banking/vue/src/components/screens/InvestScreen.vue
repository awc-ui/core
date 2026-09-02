<!--
  The investing account: what is held, what is watched, what has been traded.

  CONSUMER-GRADE ON PURPOSE. The wealth console next door has an institutional
  order ticket — limit prices, a blotter, working orders. This is the other
  thing: a quantity, an estimate, and a button.

  THE PORTFOLIO CURVE IS LABELLED FOR WHAT IT IS. `portfolioSeries()` holds
  today's quantities constant and re-prices them down the history, so it shows
  how the CURRENT portfolio would have moved rather than what it was worth on
  each day — which would need a position history the fixture does not carry.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
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
import { useShowcaseState, useT } from '~/composables/useShowcase';
import { PHONE, useMediaQuery } from '~/lib/media';
import { route, withBase } from '~/lib/routes';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Chart from '~/components/Chart.vue';
import Drill from '~/components/Drill.vue';
import EmptyState from '~/components/EmptyState.vue';
import Count from '~/components/bits/Count.vue';
import KpiTile from '~/components/bits/KpiTile.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';
import StateChip from '~/components/bits/StateChip.vue';

const t = useT();
const state = useShowcaseState();
const phone = useMediaQuery(PHONE);

const totals = getTotals();
const holdings = holdingRows();
const watchlist = watchlistRows();
const trades = getTrades({ limit: 10 });
const ring = portfolioRing();
const curve = portfolioSeries();
const layout = TABLES.holdings();

/* Defaults to the largest holding — the one a reader is most likely to act on,
   and never an empty select. */
const instrumentId = ref(holdings[0]?.instrument.id ?? '');
const quantity = ref<number | null>(1);
const placed = ref(false);

const estimate = computed(() =>
  quantity.value === null ? null : tradeEstimate(instrumentId.value, quantity.value),
);
const reason = computed(() => (estimate.value === null ? t.value('banking.hint.quantityNeeded') : null));

const quantityListeners = {
  mdInput: (event: Event) => {
    quantity.value = (event as CustomEvent<{ value: number | null }>).detail.value;
    placed.value = false;
  },
  mdChange: (event: Event) => {
    quantity.value = (event as CustomEvent<{ value: number | null }>).detail.value;
  },
};

const pickerListeners = {
  mdChange: (event: Event) => {
    const detail = (event as CustomEvent<string | string[]>).detail;
    const value = Array.isArray(detail) ? detail[0] : detail;
    if (value) instrumentId.value = value;
    placed.value = false;
  },
};
</script>

<template>
  <Screen :title="t('banking.screen.invest.title')" :subtitle="t('banking.screen.invest.subtitle')">
    <template #aside><Count :value="totals.holdingCount" /></template>

    <section class="kpi-grid">
      <KpiTile :label="t('banking.kpi.portfolio')">
        <template #value><Money :value="totals.portfolioValueEur" compact /></template>
        <template #hint><Signed :value="totals.portfolioReturnPct" kind="percent" /></template>
      </KpiTile>
      <KpiTile :label="t('banking.kpi.unrealisedPl')">
        <template #value><Signed :value="totals.portfolioUnrealisedPlEur" compact /></template>
        <template #hint><Money :value="totals.portfolioCostBasisEur" compact /></template>
      </KpiTile>
      <KpiTile :label="t('banking.kpi.dayChange')">
        <template #value><Signed :value="totals.portfolioDayChangeEur" /></template>
      </KpiTile>
      <KpiTile :label="t('banking.panel.holdings')">
        <template #value><Num :value="holdings.length" /></template>
        <template #hint>{{ t('banking.kpi.watchlist') }}</template>
        <template #trailing><Count :value="totals.watchlistCount" /></template>
      </KpiTile>
    </section>

    <div class="grid-2">
      <Panel :title="t('banking.panel.performance')" :subtitle="t('banking.hint.portfolioSeries')">
        <Chart
          v-if="curve.length > 0"
          tag="md-area-chart"
          class="chart-md"
          :series="[{ id: 'value', label: t('banking.kpi.portfolio'), data: curve.map((p) => p.valueEur) }]"
          :x-axis="{ data: curve.map((p) => t.formatDate(p.date, 'short')), scale: 'category' }"
          :value-formatter="(v) => t.formatCurrency(v ?? 0, { notation: 'compact' })"
          :summary="t('banking.panel.performance')"
          curve="monotone"
          grid="horizontal"
        />
      </Panel>

      <Panel :title="t('banking.panel.allocation')">
        <Chart
          tag="md-pie-chart"
          class="chart-md"
          :data-prop="ring.map((slice) => ({ id: slice.id, label: slice.labelKey, value: slice.value }))"
          :value-formatter="(v) => t.formatCurrency(v ?? 0, { notation: 'compact' })"
          :summary="t('banking.panel.allocation')"
          inner-radius="62%"
          show-labels="false"
          legend="bottom"
        >
          <div slot="center" class="ring-centre">
            <span class="ring-centre__value"><Money :value="totals.portfolioValueEur" compact /></span>
            <span class="ring-centre__label">{{ t('banking.kpi.portfolio') }}</span>
          </div>
        </Chart>
      </Panel>
    </div>

    <Panel :title="t('banking.panel.tradeTicket')">
      <div class="stack form-stack">
        <md-select
          v-awc="{ on: pickerListeners }"
          :label="t('banking.table.name')"
          :value="instrumentId"
        >
          <md-select-option
            v-for="h in holdings"
            :key="h.instrument.id"
            :value="h.instrument.id"
            :label="`${h.instrument.ticker} — ${h.instrument.name}`"
          />
        </md-select>

        <!-- No `format-options`: a quantity is a bare count of units, and a
             crypto holding is fractional to four places. -->
        <md-number-field
          v-awc="{ on: quantityListeners }"
          :label="t('banking.table.quantity')"
          :value="quantity"
          :min="0"
          :step="1"
          small-step="0.1"
          large-step="10"
          :locale="state.locale"
        ></md-number-field>

        <div v-if="estimate" class="stack">
          <div class="quote-line">
            <span>{{ t('banking.table.price') }}</span>
            <span class="num"><Money :value="estimate.priceEur" /></span>
          </div>
          <div class="quote-line">
            <span>{{ t('banking.table.fee') }}</span>
            <span class="num"><Money :value="estimate.feeEur" /></span>
          </div>
          <div class="quote-line quote-line--total">
            <span>{{ t('banking.table.total') }}</span>
            <span class="num"><Money :value="estimate.totalEur" /></span>
          </div>
        </div>

        <div class="row">
          <md-tooltip :text="reason ?? ''" :disabled="reason === null || undefined">
            <md-button
              variant="filled"
              icon="trending_up"
              :soft-disabled="reason !== null || placed || undefined"
              @click="placed = true"
            >
              {{ t('banking.action.buy') }}
            </md-button>
          </md-tooltip>
          <md-button
            variant="tonal"
            icon="trending_down"
            :soft-disabled="reason !== null || placed || undefined"
            @click="placed = true"
          >
            {{ t('banking.action.sell') }}
          </md-button>
          <span v-if="placed" class="muted">{{ t('banking.msg.tradePlaced') }}</span>
        </div>
      </div>
    </Panel>

    <Panel :title="t('banking.panel.holdings')">
      <template #actions><Count :value="holdings.length" /></template>
      <EmptyState v-if="holdings.length === 0" :message="t('banking.empty.holdings')" />

      <!--
        A LIST ON A PHONE, NOT THE TABLE. The table needs 1040px for nine
        columns and scrolls honestly below that, but scrolling a nine-column
        grid sideways on a 390px screen is not reading a portfolio — and value,
        P/L and weight are exactly the columns that end up off-screen.
      -->
      <md-list
        v-else-if="phone"
        :label="t('banking.panel.holdings')"
        interaction-mode="navigation"
        list-style="segmented"
      >
        <md-list-item
          v-for="h in holdings"
          :key="h.instrument.id"
          type="link"
          :href="withBase(route.instrument(h.instrument.id))"
          :headline="h.instrument.name"
          :overline="h.instrument.ticker"
          :supporting-text="`${t(h.instrument.kindKey)} · ${t.formatPercent(h.allocation, { maximumFractionDigits: 1 })}`"
          lines="3"
        >
          <span slot="leading"><md-avatar :initials="h.instrument.initials" size="small"></md-avatar></span>
          <span slot="trailing" class="account-row__figures">
            <Money :value="h.marketValueEur" />
            <Signed :value="h.unrealisedPlPct" kind="percent" />
          </span>
        </md-list-item>
      </md-list>

      <md-table-container v-else variant="outlined" class="table-host">
        <md-table
          :label="t('banking.panel.holdings')"
          :column-template="layout.columns"
          :min-width="layout.minWidth"
          keep-height="false"
          striped
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              <md-table-cell head scope="col">{{ t('banking.table.ticker') }}</md-table-cell>
              <md-table-cell head scope="col">{{ t('banking.table.name') }}</md-table-cell>
              <md-table-cell head scope="col">{{ t('banking.table.kind') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('banking.table.quantity') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('banking.table.price') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('banking.table.value') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('banking.table.pl') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('banking.table.plPct') }}</md-table-cell>
              <md-table-cell head scope="col" numeric>{{ t('banking.table.allocation') }}</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            <md-table-row v-for="h in holdings" :key="h.instrument.id" :value="h.instrument.id">
              <md-table-cell>
                <!-- `Drill` takes the UNPREFIXED path and prefixes it itself;
                     passing a base-prefixed one would double the mount. -->
                <Drill :to="route.instrument(h.instrument.id)">
                  <span class="strong">{{ h.instrument.ticker }}</span>
                </Drill>
              </md-table-cell>
              <md-table-cell>{{ h.instrument.name }}</md-table-cell>
              <md-table-cell>
                <StateChip :label-key="h.instrument.kindKey" :color="instrumentKindColor[h.instrument.kind]" />
              </md-table-cell>
              <md-table-cell numeric>
                <Num :value="h.quantity" :digits="h.instrument.kind === 'crypto' ? 4 : 2" />
              </md-table-cell>
              <md-table-cell numeric><Money :value="h.instrument.priceEur" /></md-table-cell>
              <md-table-cell numeric><Money :value="h.marketValueEur" compact /></md-table-cell>
              <md-table-cell numeric><Signed :value="h.unrealisedPlEur" compact /></md-table-cell>
              <md-table-cell numeric><Signed :value="h.unrealisedPlPct" kind="percent" /></md-table-cell>
              <md-table-cell numeric><Percent :value="h.allocation" :digits="1" /></md-table-cell>
            </md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>
    </Panel>

    <div class="grid-2">
      <Panel :title="t('banking.panel.watchlist')">
        <template #actions><Count :value="watchlist.length" /></template>
        <EmptyState v-if="watchlist.length === 0" :message="t('banking.empty.watchlist')" />
        <md-list v-else :label="t('banking.panel.watchlist')" interaction-mode="navigation" list-style="segmented">
          <md-list-item
            v-for="instrument in watchlist"
            :key="instrument.id"
            type="link"
            :href="withBase(route.instrument(instrument.id))"
            :headline="instrument.name"
            :overline="instrument.ticker"
            :supporting-text="t(instrument.kindKey)"
            lines="3"
          >
            <span slot="leading"><md-avatar :initials="instrument.initials" size="small"></md-avatar></span>
            <span slot="trailing" class="account-row__figures">
              <Money :value="instrument.priceEur" />
              <Signed :value="instrument.dayChangePct" kind="percent" />
            </span>
          </md-list-item>
        </md-list>
      </Panel>

      <Panel :title="t('banking.panel.tradeHistory')">
        <template #actions><Count :value="trades.length" /></template>
        <EmptyState v-if="trades.length === 0" :message="t('banking.empty.trades')" />
        <md-list v-else :label="t('banking.panel.tradeHistory')" interaction-mode="multi-action" list-style="segmented">
          <md-list-item
            v-for="trade in trades"
            :key="trade.id"
            :headline="trade.instrumentId"
            :overline="t.formatDate(trade.date, 'medium')"
            :supporting-text="`${t(trade.sideKey)} · ${t(trade.statusKey)}`"
            lines="3"
          >
            <span slot="trailing" class="row">
              <StateChip :label-key="trade.sideKey" :color="tradeSideColor[trade.side]" />
              <StateChip :label-key="trade.statusKey" :color="tradeStatusColor[trade.status]" />
              <Money :value="trade.amountEur" />
            </span>
          </md-list-item>
        </md-list>
      </Panel>
    </div>
  </Screen>
</template>
