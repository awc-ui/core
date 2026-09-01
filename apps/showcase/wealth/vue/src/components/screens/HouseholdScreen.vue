<!--
  Screen 3 — one household, and the only screen that takes a parameter.

  THE GUARD IS THE FIRST BRANCH OF THE TEMPLATE, and it stays there.
  `householdId` arrives from the URL, so it may be anything at all;
  `getHouseholdById` returns `undefined` for an id the fixture does not know,
  and this renders the empty state rather than reading fields off nothing.

  WHAT THE SCREEN IS. Five figures, then the mandate's performance, then how
  far it has drifted from its target allocation, then what it actually holds,
  then what the money is FOR — and last, four sibling views of the household
  itself behind a tab strip. That is the reading order of a review meeting:
  how big, how it did, how far off, what is in it, who it is for.

  NOTHING HERE COMPUTES ANYTHING. Every number on this screen is a field on a
  kit record or the return value of a kit function: `returnWindows` for the
  windows, `growthOf100` for the chart, `getAllocationFor` and `rebalanceSheet`
  for the drift, `getOrders` for the tickets under it, `driftedMandates` for the
  breach counts, `goalSummary` for the objectives roll-up. The only thing this
  file decides is what is on screen — which is also the only thing the settings
  sheet changes.

  WHAT THE ALLOCATION PANEL IS MISSING, and deliberately does not invent. The
  cards prescribe a trade per class; the obvious next figures are what those
  trades SUM to, what they do to the cash balance, and where the drift lands
  once they settle. None of the three is a kit selector — `rebalanceSheet`
  returns the rows and stops — so none of them is on the screen. Adding them
  means a `rebalanceTotals(portfolioId)` in `packages/showcase-kit/src/wealth/
  derive.ts`, not a `reduce()` in this file.

  THREE PIECES OF LOCAL STATE, and all three are view state rather than data:
  which parts of the screen are shown, whether the settings sheet is open, and
  the transient snackbar message. Everything else is read from the fixture
  through `computed`s, because the fixture is immutable and the selectors are
  pure.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  driftedMandates,
  getActivityFor,
  getAllocationFor,
  getClientsFor,
  getGoalsFor,
  getHouseholdById,
  getOrders,
  getPerformanceSeries,
  getPortfolioFor,
  getProposalsFor,
  goalSummary,
  growthOf100,
  kycDot,
  plColor,
  rebalanceSheet,
  returnWindows,
  type AllocationRow,
} from '@awc-ui/showcase-kit/wealth';
import { usePathname, useRouter } from '~/lib/router';
import { crumbsFor, route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import type { ChartSeries } from '~/lib/types';
import Chart from '~/components/Chart.vue';
import EmptyState from '~/components/EmptyState.vue';
import Panel from '~/components/Panel.vue';
import Screen from '~/components/Screen.vue';
import AllocationChip from '~/components/bits/AllocationChip.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import DriftMeter from '~/components/bits/DriftMeter.vue';
import Fact from '~/components/bits/Fact.vue';
import FundedMeter from '~/components/bits/FundedMeter.vue';
import GoalStatusChip from '~/components/bits/GoalStatusChip.vue';
import KpiTile from '~/components/bits/KpiTile.vue';
import KycChip from '~/components/bits/KycChip.vue';
import MandateChip from '~/components/bits/MandateChip.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import OrderSideChip from '~/components/bits/OrderSideChip.vue';
import OrderStatusChip from '~/components/bits/OrderStatusChip.vue';
import Percent from '~/components/bits/Percent.vue';
import PriorityChip from '~/components/bits/PriorityChip.vue';
import SegmentChip from '~/components/bits/SegmentChip.vue';
import Signed from '~/components/bits/Signed.vue';
import StrategyChip from '~/components/bits/StrategyChip.vue';
import ActionButton from './HouseholdActionButton.vue';
import HouseholdHoldings from './HouseholdHoldings.vue';
import HouseholdSettings from './HouseholdSettings.vue';
import HouseholdSkeleton from './HouseholdSkeleton.vue';
import HouseholdTabs from './HouseholdTabs.vue';
import { DEFAULT_VIEW, type HouseholdView } from './household-view';
import './snackbar.css';

const props = defineProps<{ householdId: string }>();

const t = useT();
const router = useRouter();
const pathname = usePathname();

const view = ref<HouseholdView>(DEFAULT_VIEW);
const settingsOpen = ref(false);
const message = ref<string | null>(null);

/*
 * The snackbar is CONTROLLED, and this listener is what keeps it that way.
 *
 * Auto-hide, the close button and `hide()` all emit `mdClose`; assigning
 * `open = false` from script does not. Clearing the message here means the
 * element's own dismissal and this component's state land in the same frame.
 * Skip it and `open` stays `true` in this component while the element has
 * closed itself — and then the next message never reopens it, because the
 * renderer sees no change to write.
 */
const snackbarListeners = {
  mdClose: () => {
    message.value = null;
  },
};

const household = computed(() => getHouseholdById(props.householdId));

const portfolio = computed(() =>
  household.value ? getPortfolioFor(household.value.id) : undefined,
);
const members = computed(() => (household.value ? getClientsFor(household.value.id) : []));
const goals = computed(() => (household.value ? getGoalsFor(household.value.id) : []));
const proposals = computed(() => (household.value ? getProposalsFor(household.value.id) : []));
const activity = computed(() => (household.value ? getActivityFor(household.value.id, 12) : []));
const allocation = computed(() => (household.value ? getAllocationFor(household.value.id) : []));
const sheet = computed(() => (portfolio.value ? rebalanceSheet(portfolio.value.id) : []));
/*
 * Every ticket ever raised for this mandate, newest first — the selector's
 * own order, not a sort here.
 *
 * `getOrders({ working: true })` would keep only the live ones, and the
 * settled and cancelled tickets are exactly the ones that explain the drift
 * the panel is reporting: a cancelled fixed-income sell is the last attempt at
 * this same rebalance. Filtering to "working" would hide the history and leave
 * an empty list for a mandate whose last trade filled yesterday.
 */
const orders = computed(() =>
  portfolio.value ? getOrders({ portfolioId: portfolio.value.id }) : [],
);
const performance = computed(() =>
  household.value ? getPerformanceSeries({ householdId: household.value.id }) : [],
);
const growth = computed(() =>
  household.value ? growthOf100({ householdId: household.value.id }) : [],
);
// 3, 6 (year to date), 12 and 24 months, in that order — the kit's contract.
const windows = computed(() =>
  household.value ? returnWindows({ householdId: household.value.id }) : [],
);
const ytd = computed(() => windows.value[1]);
const objectives = computed(() => goalSummary(goals.value));

/*
 * Breach and drift counts come from the kit, not from a `.filter()` here.
 *
 * `driftedMandates()` returns only the mandates with something out of band,
 * so a household that is entirely in band is simply absent from it — which is
 * the zero, and `?? 0` is how that reads without a special case.
 */
const drifted = computed(() => {
  const h = household.value;
  return h ? driftedMandates().find((row) => row.household.id === h.id) : undefined;
});

/**
 * The settings sheet's two allocation switches.
 *
 * Both test a field the KIT classified — the asset class and the in-band /
 * drifted / breach status — so this hides rows without deciding anything
 * about them. Generic so a `RebalanceRow` keeps its `side` and `absDrift` on
 * the way through.
 */
function visible<T extends AllocationRow>(rows: T[]): T[] {
  return rows.filter(
    (row) =>
      (view.value.cash || row.assetClass !== 'cash') &&
      (view.value.inBand || row.status !== 'in-band'),
  );
}

const allocationRows = computed(() => visible(allocation.value));
const rebalanceRows = computed(() => visible(sheet.value));

const title = computed(() =>
  household.value
    ? t.value('wealth.screen.household.title', { name: household.value.name })
    : t.value('wealth.screen.notFound.title'),
);
const subtitle = computed(() => {
  const h = household.value;
  return h
    ? t.value('wealth.screen.household.subtitle', {
        segment: t.value(h.segmentKey),
        mandate: t.value(h.mandateKey),
        members: members.value.length,
      })
    : t.value('wealth.screen.household.missing');
});
const crumbs = computed(() => crumbsFor(pathname.value, household.value ?? null));

/* ------------------------------------------------------------------ charts */

// Stable references for the axis bounds: `v-awc` re-assigns object props on
// every update and Stencil's setter skips identical references, so a module
// constant is what keeps an unrelated re-render (the snackbar opening) from
// poking the chart.
const GROWTH_Y_AXIS = { min: 90 };
const WEIGHT_Y_AXIS = { min: 0 };

/*
 * Growth of 100, not two cumulative percentages: two crossing lines are
 * readable and two crossing percentage figures are not.
 *
 * The benchmark is dropped from the DATA when the reader turns it off, rather
 * than hidden through the chart's own legend — the chart remembers legend
 * toggles across a data re-feed, so the two would fight over which of them
 * owns "is the benchmark showing".
 */
const performanceSeries = computed<ChartSeries[]>(() => {
  const p = portfolio.value;
  if (!p) return [];
  return [
    {
      id: 'portfolio',
      label: p.reference,
      data: growth.value.map((point) => point.portfolio),
    },
    ...(view.value.benchmark
      ? [
          {
            id: 'benchmark',
            label: p.benchmarkName,
            data: growth.value.map((point) => point.benchmark),
          },
        ]
      : []),
  ];
});
const performanceXAxis = computed(() => ({
  data: growth.value.map((point) => t.value.formatDate(point.date, 'monthYear')),
  scale: 'category',
}));
const numberFormatter = computed(
  () => (value: number | null) => t.value.formatNumber(value ?? 0, { maximumFractionDigits: 1 }),
);

/*
 * Target against actual, one pair of bars per class. A donut cannot show a
 * target beside an actual, which is the only comparison the allocation panel
 * exists to make. The weights stay FRACTIONS all the way to the axis —
 * `valueFormatter` is what turns 0.62 into 62%, so nothing is multiplied by
 * 100 on the way in and the tooltip, the axis and the figures beside them
 * cannot disagree.
 */
const allocationSeries = computed<ChartSeries[]>(() => [
  {
    id: 'target',
    label: t.value('wealth.table.target'),
    data: allocationRows.value.map((row) => row.targetWeight),
  },
  {
    id: 'actual',
    label: t.value('wealth.table.actual'),
    data: allocationRows.value.map((row) => row.actualWeight),
  },
]);
const allocationXAxis = computed(() => ({
  data: allocationRows.value.map((row) => t.value(row.assetClassKey)),
}));
const percentFormatter = computed(
  () => (value: number | null) => t.value.formatPercent(value ?? 0, { maximumFractionDigits: 1 }),
);

/* ------------------------------------------------------------------- tiles */

const aumTrend = computed(() =>
  view.value.trend ? performance.value.map((point) => point.marketValue) : undefined,
);
const returnTrend = computed(() =>
  view.value.trend ? performance.value.map((point) => point.cumulativeReturn) : undefined,
);
const trendLabels = computed(() =>
  performance.value.map((point) => t.value.formatDate(point.date, 'monthYear')),
);
const formatCurrencyTrend = computed(
  () => (value: number | null) => t.value.formatCurrency(value ?? 0, { notation: 'compact' }),
);
const formatPercentTrend = computed(
  () => (value: number | null) => t.value.formatPercent(value ?? 0, { maximumFractionDigits: 1 }),
);
</script>

<template>
  <Screen v-if="!household" :crumbs="crumbs" :title="title" :subtitle="subtitle">
    <EmptyState :message="t('wealth.screen.household.missing')" />
  </Screen>

  <Screen v-else :crumbs="crumbs" :title="title" :subtitle="subtitle">
    <template #skeleton>
      <HouseholdSkeleton
        :label="title"
        :positions="household.positionCount"
        :orders="orders.length"
        :members="members.length"
        :drifted="Boolean(drifted)"
      />
    </template>

    <template #aside>
      <!--
        Avatar, member-count badge and KYC dot as ONE object.

        `md-badge` and `md-status-dot` both position themselves absolutely
        against the nearest POSITIONED ancestor, which is what
        `.badge-anchor` is for — dropped in bare they anchor to whatever box
        happens to be positioned above them and get clipped by it. The badge
        takes the top corner and the dot the bottom, and the dot is
        deliberately unlabelled: the KYC chip beside it already says the
        same word, and naming both announces the state twice.
      -->
      <span class="badge-anchor">
        <md-avatar :name="household.name" :label="household.name" size="medium"></md-avatar>
        <md-badge shape="circle" :value="String(household.memberCount)"></md-badge>
        <md-status-dot
          shape="circle"
          :state="kycDot[household.kycStatus]"
          size="small"
        ></md-status-dot>
      </span>
      <SegmentChip :segment="household.segment" />
      <MandateChip :mandate="household.mandate" />
      <StrategyChip :strategy="household.strategy" />
      <KycChip :status="household.kycStatus" />
    </template>

    <template #actions>
      <!-- An `md-toolbar` is ONE tab stop with arrow-key movement between its
           DIRECT children, so these are bare `md-button`s — a wrapper around
           any of them would drop it out of the roving group. None is
           emphasised: the rail's FAB is already the loudest control here. -->
      <ActionButton icon="balance" @activate="router.push(route.trade())">
        {{ t('wealth.action.rebalance') }}
      </ActionButton>
      <ActionButton icon="mail" @activate="message = t('wealth.activity.client-contacted')">
        {{ t('wealth.action.contact') }}
      </ActionButton>
      <ActionButton icon="tune" @activate="settingsOpen = true">
        {{ t('wealth.action.filter') }}
      </ActionButton>
    </template>

    <section class="kpi-grid">
      <KpiTile
        :label="t('wealth.kpi.aum')"
        :hint="portfolio ? portfolio.reference : t('wealth.common.na')"
        :trend="aumTrend"
        :trend-labels="trendLabels"
        :format-trend="formatCurrencyTrend"
      >
        <template #value><Money :value="household.totalAum" compact /></template>
      </KpiTile>
      <KpiTile
        :label="t('wealth.kpi.ytdReturn')"
        :color="plColor(ytd.excess)"
        :trend="returnTrend"
        :trend-labels="trendLabels"
        :format-trend="formatPercentTrend"
      >
        <template #value><Percent :value="household.ytdReturn" /></template>
        <!-- The sparkline takes the same colour the excess return is printed
             in, from the kit's own dead-banded mapping — never a ternary here. -->
        <template #hint>
          {{ t('wealth.common.vsBenchmark') }} <Signed :value="ytd.excess" kind="percent" />
        </template>
      </KpiTile>
      <KpiTile :label="t('wealth.kpi.unrealisedPl')">
        <template #value><Signed :value="household.unrealisedPl" compact /></template>
        <template v-if="portfolio" #hint>
          <Percent :value="portfolio.unrealisedPlPct" />
        </template>
      </KpiTile>
      <KpiTile :label="t('wealth.kpi.driftBreaches')" :hint="t('wealth.allocationStatus.drifted')">
        <template #value><Num :value="drifted?.breachCount ?? 0" /></template>
        <template #trailing><Count :value="drifted?.driftedCount ?? 0" color="warning" /></template>
      </KpiTile>
      <KpiTile :label="t('wealth.kpi.goals')" :hint="t('wealth.kpi.goalsOnTrack')">
        <template #value><Num :value="objectives.count" /></template>
        <template #trailing><Count :value="objectives.onTrack" color="success" /></template>
      </KpiTile>
    </section>

    <!-- -------------------------------------------------------- performance -->

    <Panel
      v-if="portfolio"
      :title="t('wealth.panel.performance')"
      :subtitle="
        t('wealth.panel.performanceHint', {
          base: t.formatNumber(100),
          months: t.formatNumber(growth.length),
        })
      "
    >
      <div class="grid-wide">
        <!--
          `summary` replaces the generated `aria-label`, whose default
          sentence is assembled in English. There is no visible `label`,
          because the panel's own heading already names the chart.
        -->
        <Chart
          tag="md-line-chart"
          class="chart-md"
          :series="performanceSeries"
          :x-axis="performanceXAxis"
          :y-axis="GROWTH_Y_AXIS"
          :value-formatter="numberFormatter"
          :summary="t('wealth.panel.performance')"
          curve="monotone"
          grid="horizontal"
          legend="top-end"
        />

        <!--
          THE SAME SURFACE THE CHART SITS ON, and read off the chart rather
          than picked by eye: `md-line-chart`'s host paints
          `--md-sys-color-surface-container-low` at a 16px corner, which is
          exactly what `md-card variant="outlined"` is. The two blocks
          answer one question between them — how did this mandate do — so
          putting them on the same surface says so, where a bare `dl`
          floating under the chart read as an afterthought.
        -->
        <md-card variant="outlined" full-width class="surface-card fact-card">
          <dl class="dl">
            <Fact
              v-for="window in windows"
              :key="window.months"
              :label="t('wealth.unit.months', { value: t.formatNumber(window.months) })"
            >
              <Percent :value="window.portfolio" />
              <br />
              <Signed :value="window.excess" kind="percent" />
            </Fact>
            <Fact :label="t('wealth.kpi.maxDrawdown')">
              <Signed :value="portfolio.maxDrawdown" kind="percent" />
            </Fact>
            <Fact :label="t('wealth.table.benchmark')">{{ portfolio.benchmarkName }}</Fact>
          </dl>
        </md-card>
      </div>
    </Panel>

    <!-- --------------------------------------------------------- allocation -->

    <Panel :title="t('wealth.panel.allocation')" :subtitle="t('wealth.panel.allocationHint')">
      <template #actions>
        <AllocationChip v-if="drifted" :status="drifted.worst.status" />
      </template>

      <EmptyState v-if="allocationRows.length === 0" :message="t('wealth.empty.rebalance')" />
      <!--
        NOT `.grid-wide`, and that is the fix rather than a preference.

        The two halves of this panel are the SAME five rows twice — the
        chart is a picture of the cards. Side by side they cannot agree on a
        height: `.chart-md` pins the chart at 260px while five stacked
        `.alloc-row`s run to ~800px, so two thirds of the panel's width sat
        under the bars holding nothing at all — 538px of it at 1440 — while
        the detail rows that actually carry the drift, the basis points and
        the trade were stacked one per line in the 1fr column beside it.
        Filling that hole with a second body of content would have been the
        wrong repair: the household facts that would fit are the holdings
        table below or one of the four tabs at the foot of this screen, and
        printing either of them twice is worse than the gap.

        So the picture goes full width, where ten bars have room to be read,
        and the cards flow into `.grid-2` — the auto-fit track with a 340px
        floor, which is what the column they came out of was actually
        measuring, so each card keeps the width and the height it has today
        and only the number of them per row changes: three then two at
        1440, two-two-one at 1100 and at the 900px breakpoint.
      -->
      <div v-else class="stack">
        <!-- `md-bar-chart` has no `summary` prop, so `label` is both the
             visible title and the seed of the accessible name; it names what
             the bars MEASURE rather than repeating the panel heading above. -->
        <Chart
          tag="md-bar-chart"
          class="chart-md"
          :series="allocationSeries"
          :x-axis="allocationXAxis"
          :y-axis="WEIGHT_Y_AXIS"
          :value-formatter="percentFormatter"
          :label="t('wealth.table.weight')"
          legend="top-end"
        />

        <div class="grid-2">
          <md-card
            v-for="row in rebalanceRows"
            :key="row.assetClass"
            variant="outlined"
            full-width
            class="alloc-row"
          >
            <div class="alloc-row__head">
              <h3 class="alloc-row__name">{{ t(row.assetClassKey) }}</h3>
              <AllocationChip :status="row.status" />
            </div>
            <!-- The meter shows the DISTANCE from target and its colour how
                 far; the direction is in the signed value beside it and in
                 the trade side below, because a bar has no negative half
                 to carry a sign. -->
            <DriftMeter :drift="row.drift" />
            <div class="alloc-row__figures">
              <span>
                {{ t('wealth.table.target') }} <Percent :value="row.targetWeight" :digits="1" />
              </span>
              <span>
                {{ t('wealth.table.actual') }} <Percent :value="row.actualWeight" :digits="1" />
              </span>
              <span>
                {{ t('wealth.table.driftBps') }}
                {{ t('wealth.unit.bps', { value: t.formatNumber(row.driftBps) }) }}
              </span>
            </div>
            <div class="row">
              <!-- `side` is the kit's own `'buy' | 'sell'`, and the signed
                   amount agrees with it: a sell is a negative trade. -->
              <OrderSideChip :side="row.side" />
              <span class="muted">{{ t('wealth.table.rebalance') }}</span>
              <Signed :value="row.rebalanceAmount" compact />
            </div>
          </md-card>
        </div>

        <!--
          WHAT IS ALREADY IN THE MARKET FOR THIS MANDATE.

          Every card above ends in an instruction — sell €506.7k of fixed
          income, buy €490.1k of equity — and the one thing that changes
          whether an advisor acts on it is whether some of it is already
          done. This mandate has a submitted equity buy against an equity
          card that asks for a buy, and a cancelled fixed-income sell dated
          five days before the reporting date, which is the last attempt at
          the very trade the fixed-income card is prescribing. A rebalance
          sheet read without them is read twice.

          Nothing else on this screen carries it: the four tabs at the foot
          are members, mandate, documents and activity, and the holdings
          table below is what is HELD, not what is in flight. It is a list
          rather than a table (§5.5) because a mandate has one or two
          tickets, and `list-style="segmented"` keeps each one a tile rather
          than a hairline row inside a card that is already outlined.
        -->
        <md-divider></md-divider>

        <div class="row row--between">
          <h3 class="panel__title" id="household-tickets">
            {{ t('wealth.panel.blotter') }}
          </h3>
          <Count :value="orders.length" />
        </div>

        <EmptyState v-if="orders.length === 0" :message="t('wealth.empty.orders')" />
        <!-- `labelledby` rather than `label`: the heading above already
             names the list, and a `label` prop would announce that same
             name a second time.

             `interaction-mode="multi-action"` even though no row is
             clickable — the two state chips in each trailing slot are
             `md-chip variant="assist"`, which is a focusable control, and
             the default `single-action` treats a row as one target. -->
        <md-list
          v-else
          labelledby="household-tickets"
          list-style="segmented"
          interaction-mode="multi-action"
        >
          <!--
            One order raised against this mandate, as a list row.

            EVERY FIELD IS READ, NONE IS COMPUTED. `estimatedValueEur` is the
            ticket's own converted figure, `filledQuantity` and `quantity` are
            its own counts, and the three `*Key` fields are the kit's own
            dictionary keys — so the row says "Limit" and "Partially filled"
            in every locale without a lookup table here.

            ONE trailing element holding three, not three trailing elements:
            the slot lays its children out as a column, so siblings stack and
            triple the row height. The same `.row` wrapper the members and
            documents lists use.

            THE DATE IS IN THE SUPPORTING LINE, not in
            `trailing-supporting-text`, and that is the manual's rule rather
            than a preference: filling the `trailing` SLOT replaces
            `trailing-icon` and `trailing-supporting-text` outright, so a
            date slotted there is in the DOM at 0×0 — announced by a screen
            reader, invisible to everyone else. `slot="supporting-text"`
            keeps `DateText`'s real `<time dateTime>` instead of flattening
            the date into the string prop.
          -->
          <md-list-item
            v-for="order in orders"
            :key="order.id"
            :headline="order.instrumentName"
            :overline="`${order.ticker} · ${t(order.assetClassKey)}`"
            leading-icon="receipt_long"
            lines="3"
          >
            <span slot="supporting-text">
              {{ t(order.orderTypeKey) }} · {{ t('wealth.table.filled') }}
              {{
                t('wealth.common.of', {
                  count: t.formatNumber(order.filledQuantity),
                  total: t.formatNumber(order.quantity),
                })
              }}
              · <DateText :value="order.createdDate" date-style="short" />
            </span>
            <span slot="trailing" class="row">
              <OrderSideChip :side="order.side" />
              <OrderStatusChip :status="order.status" />
              <Money :value="order.estimatedValueEur" compact />
            </span>
          </md-list-item>
        </md-list>
      </div>
    </Panel>

    <!-- ----------------------------------------------------------- holdings -->

    <Panel :title="t('wealth.panel.holdings')" :subtitle="portfolio ? portfolio.reference : undefined">
      <template #actions>
        <Count :value="household.positionCount" />
      </template>
      <HouseholdHoldings :household="household" :portfolio="portfolio" />
    </Panel>

    <!-- --------------------------------------------------------- objectives -->

    <Panel
      :title="t('wealth.panel.objectives')"
      :subtitle="
        t('wealth.goal.projectedAt', {
          value: t.formatCurrency(objectives.projectedTotal, { notation: 'compact' }),
        })
      "
    >
      <template #actions>
        <Count :value="objectives.count" />
      </template>

      <EmptyState v-if="goals.length === 0" :message="t('wealth.empty.goals')" />
      <div v-else class="grid-3">
        <div v-for="goal in goals" :key="goal.id" class="goal-row">
          <div class="row row--between">
            <span class="strong">{{ t(goal.typeKey) }}</span>
            <GoalStatusChip :status="goal.status" />
          </div>
          <!-- The bar is clamped at 100% but the TEXT is not, so an
               over-funded objective reads "119%" beside a full bar. -->
          <FundedMeter :fraction="goal.fundedPct" :status="goal.status" />
          <div class="row">
            <PriorityChip :priority="goal.priority" />
            <span class="muted">
              {{ goal.beneficiaryName ?? t('wealth.common.household') }}
            </span>
          </div>
          <div class="alloc-row__figures">
            <span>
              {{
                t('wealth.goal.fundedOf', {
                  current: t.formatCurrency(goal.currentAmount, { notation: 'compact' }),
                  target: t.formatCurrency(goal.targetAmount, { notation: 'compact' }),
                })
              }}
            </span>
            <span>
              {{ t('wealth.table.targetDate') }} <DateText :value="goal.targetDate" />
            </span>
            <span>
              {{
                t('wealth.goal.monthsRemaining', {
                  count: t.formatNumber(goal.monthsRemaining),
                })
              }}
            </span>
          </div>
        </div>
      </div>
    </Panel>

    <!-- -------------------------------------------------------------- tabs -->

    <!-- No panel title: the tab strip is the heading of what is under it, and
         a card heading above a tab strip reads as a second, competing one. -->
    <Panel>
      <HouseholdTabs
        :household="household"
        :portfolio="portfolio"
        :members="members"
        :goals="goals"
        :proposals="proposals"
        :activity="activity"
        :allocation="allocation"
        :breach-count="drifted?.breachCount ?? 0"
        @notify="message = $event"
      />
    </Panel>

    <HouseholdSettings
      :open="settingsOpen"
      :view="view"
      @change="view = $event"
      @close="settingsOpen = false"
    />

    <!--
      One snackbar, one message. The component has no queue by design and M3
      forbids two at once, so every notification on this screen goes through
      this single element.

      `position="bottom"` is the component default and M3's placement: the
      surface is centred on the bottom edge, over content the reader is not
      working in. The offset that keeps it clear of the dock and — below 900px
      — the navigation bar is `.wealth-snackbar`, shared with the other two
      screens that toast so all three land in the same place.
    -->
    <md-snackbar
      v-awc="{ on: snackbarListeners }"
      class="wealth-snackbar"
      :open="message !== null"
      :message="message ?? ''"
      position="bottom"
      closeable
      auto-hide
      :dismiss-label="t('wealth.action.close')"
    ></md-snackbar>
  </Screen>
</template>
