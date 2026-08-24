<!--
  Screen 1 — portfolio overview, and the head of the drill path.

  Four KPI tiles, each with its own eight-quarter sparkline; exposure by sector;
  the rating distribution; the exposure trend split by rating band; and the whole
  counterparty book, paged. Both the sector bars and the table rows are doors:
  sector bars drill on click, counterparty names are anchors.

  Every trend on this screen is computed by `@awc-ui/showcase-kit/credit-risk`
  from the fixture's rating history, calibrated so the last point of a series
  equals the KPI above it.
-->
<script setup lang="ts">
import { computed } from 'vue';
import {
  getCounterparties,
  getPortfolioTotals,
  getRatingScale,
  getSectors,
  REPORTING_DATE,
  REPORTING_QUARTER,
} from '@awc-ui/showcase-kit/data';
import { monthlyEadSeries, quarterlySeries } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';
import { route, withBase } from '~/lib/routes';
import Shell from '../Shell.vue';
import Panel from '../Panel.vue';
import Chart from '../Chart.vue';
import Drill from '../Drill.vue';
import CounterpartyTable from '../CounterpartyTable.vue';
import KpiTile from '../bits/KpiTile.vue';

const t = useT();
const router = useRouter();

const totals = getPortfolioTotals();
const sectors = getSectors();
const scale = getRatingScale();
const quarters = quarterlySeries();
const months = monthlyEadSeries();
const quarterLabels = quarters.map((q) => q.quarter);

/** EAD by rating grade — the concentration a credit committee reads first. */
const counterparties = getCounterparties();
const byGrade = scale.map((grade) =>
  counterparties.filter((cp) => cp.grade === grade.grade).reduce((sum, cp) => sum + cp.ead, 0),
);

const money = computed(() => (v: number | null) => t.value.formatCurrency(v ?? 0, { notation: 'compact' }));
const percent = computed(
  () => (v: number | null) => t.value.formatPercent(v ?? 0, { maximumFractionDigits: 2 }),
);

function onBarClick(event: Event) {
  const index = (event as CustomEvent<{ dataIndex: number }>).detail?.dataIndex ?? -1;
  const sector = sectors[index];
  if (sector) router.push(route.sector(sector.id));
}
</script>

<template>
  <Shell
    :title="t('screen.overview.title')"
    :subtitle="t('screen.overview.subtitle', { date: t.formatDate(REPORTING_DATE, 'long') })"
  >
    <template #aside>
      <md-chip
        variant="assist"
        appearance="outlined"
        icon="account_balance"
        :label="t('common.of', { count: totals.counterpartyCount, total: totals.facilityCount })"
        :title="`${t('kpi.counterparties')} / ${t('kpi.facilities')}`"
      ></md-chip>
      <!--
        The badge is a SIBLING of the button, not slotted into it. md-badge
        anchors absolutely and translates itself past its host's corner;
        md-button sets `overflow: hidden` with no accommodation for that, so a
        slotted badge is sliced in half. With the badge outside, the button no
        longer contains the count, so it needs an explicit accessible name that
        does.
      -->
      <span class="badge-anchor">
        <md-button
          variant="tonal"
          size="sm"
          icon="warning"
          :href="withBase(route.watchlist())"
          :aria-label="`${t('kpi.watchlist')}, ${totals.watchlistCount}`"
        >
          {{ t('kpi.watchlist') }}
        </md-button>
        <md-badge :value="String(totals.watchlistCount)"></md-badge>
      </span>
    </template>

    <section class="kpi-grid">
      <KpiTile
        :label="t('kpi.ead')"
        :value="t.formatCurrency(totals.ead, { notation: 'compact' })"
        :hint="t('kpi.ead.help')"
        :trend="months.map((m) => m.ead)"
        :trend-labels="months.map((m) => t.formatDate(m.date, 'monthYear'))"
        :format-trend="money"
        color="primary"
      />
      <KpiTile
        :label="t('kpi.expectedLoss')"
        :value="t.formatCurrency(totals.expectedLoss, { notation: 'compact' })"
        :hint="`${t('kpi.expectedLossRatio')} ${t.formatPercent(totals.expectedLossRatio, { maximumFractionDigits: 2 })}`"
        :trend="quarters.map((q) => q.expectedLoss)"
        :trend-labels="quarterLabels"
        :format-trend="money"
        color="error"
      />
      <KpiTile
        :label="t('kpi.rwa')"
        :value="t.formatCurrency(totals.rwa, { notation: 'compact' })"
        :hint="`${t('kpi.rwaDensity')} ${t.formatPercent(totals.rwaDensity, { maximumFractionDigits: 1 })}`"
        :trend="quarters.map((q) => q.rwa)"
        :trend-labels="quarterLabels"
        :format-trend="money"
        color="tertiary"
      />
      <KpiTile
        :label="t('kpi.weightedAvgPd')"
        :value="t.formatPercent(totals.weightedAvgPd, { maximumFractionDigits: 2 })"
        :hint="`${t('kpi.weightedAvgLgd')} ${t.formatPercent(totals.weightedAvgLgd, { maximumFractionDigits: 1 })}`"
        :trend="quarters.map((q) => q.weightedAvgPd)"
        :trend-labels="quarterLabels"
        :format-trend="percent"
        color="warning"
      />
    </section>

    <!-- The chart components render their own label/subtitle header, which is
         also their accessible name — so these panels deliberately carry no title
         of their own. Two headings saying the same thing is worse than one, and
         dropping the chart's would cost the a11y name. -->
    <section class="grid-2">
      <Panel>
        <Chart
          tag="md-bar-chart"
          :series="[{ label: t('kpi.ead'), data: sectors.map((s) => s.ead) }]"
          :x-axis="{ data: sectors.map((s) => t(s.nameKey)) }"
          :y-axis="{ label: t('kpi.ead') }"
          :value-formatter="money"
          :on-bar-click="onBarClick"
          layout="horizontal"
          legend="none"
          clickable
          corner-radius="8"
          axis-ticks
          height="320px"
          :label="t('kpi.ead')"
          :subtitle="t('table.sector')"
        />
      </Panel>

      <Panel>
        <Chart
          tag="md-bar-chart"
          :series="[{ label: t('kpi.ead'), data: byGrade }]"
          :x-axis="{ data: scale.map((g) => t(`rating.${g.label}`)) }"
          :y-axis="{ label: t('kpi.ead') }"
          :value-formatter="money"
          legend="none"
          axis-ticks
          height="320px"
          :label="t('screen.ratings.title')"
          :subtitle="t('screen.ratings.subtitle')"
        />
      </Panel>
    </section>

    <Panel>
      <Chart
        tag="md-area-chart"
        :series="[
          { label: t('ratingBand.investment'), data: quarters.map((q) => q.byBand.investment) },
          { label: t('ratingBand.speculative'), data: quarters.map((q) => q.byBand.speculative) },
          { label: t('ratingBand.default'), data: quarters.map((q) => q.byBand.default) },
        ]"
        :x-axis="{ data: quarterLabels, scale: 'category' }"
        :y-axis="{ label: t('kpi.ead'), min: 0 }"
        :value-formatter="money"
        stack="normal"
        curve="monotone"
        legend="top-end"
        axis-ticks
        height="300px"
        :label="`${t('kpi.ead')} · ${t('table.band')}`"
        :subtitle="t('rating.historyHint', { quarter: REPORTING_QUARTER })"
        :summary="t('chart.summary.area', { label: `${t('kpi.ead')} · ${t('table.band')}`, count: 3 })"
      />
    </Panel>

    <!-- The whole book, paged — not a top-10 cap. A truncated list with a
         pagination bar underneath would read "1-10 of 10", which tells the
         reader nothing and hides the other 14 counterparties. Sorting by EAD
         desc still puts the largest exposures first, which is what the panel is
         for. -->
    <Panel :title="t('screen.counterparties.title')">
      <template #actions>
        <Drill :to="route.watchlist()">{{ t('nav.watchlist') }}</Drill>
      </template>
      <CounterpartyTable />
    </Panel>
  </Shell>
</template>
