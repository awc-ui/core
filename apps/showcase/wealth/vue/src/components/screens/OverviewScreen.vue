<!--
  Screen 1 — the advisor's book, and the head of the drill path.

  WHAT IS ON IT, and why it is in this order. An advisor opens this screen to
  answer four questions before anything else: how big is the book, is it
  beating its benchmark, is money arriving or leaving, and what needs attention
  today. So: a KPI row that answers all four at a glance, then the two shapes
  those numbers came from (the performance curve and the allocation ring), then
  the two attention lists, then the book itself as a table you can sort and
  filter, and the audit trail underneath it.

  NOTHING HERE IS ARITHMETIC. Every figure, series, colour and column layout
  comes from `@awc-ui/showcase-kit/wealth`; this file decides layout and
  nothing else. `.map()` over a kit series to lift one field out is a
  projection, not a calculation.

  THREE DECISIONS WORTH KNOWING, all of them forced by a component manual:

    1. THE SCREEN HAS NO `md-toolbar`. `md-fab-menu`'s manual (and M3) say not
       to pair a FAB menu with a toolbar or a navigation rail. The screen's
       actions therefore live where they belong anyway — the table's filters in
       `md-table-toolbar`, the period picker in the chart panel's head — and the
       quick-actions FAB is rendered ONLY below the rail breakpoint, where
       `app.css` takes the rail out of the DOM and `md-navigation-bar` (a FAB's
       proper companion) takes its place. Exactly one prominent action exists at
       each width: the rail's FAB at desktop, this one on compact.

    2. THE DONUT'S SLICE COLOURS ARE TOKEN REFERENCES, PASSED AS-IS. The kit's
       palette is `var(--md-sys-color-*)` strings, and the library's
       `resolveSeriesColor` resolves those against the chart host before they
       reach a Canvas2D `fillStyle` — the same path axis bands always took.

    3. THE DONUT IS NOT the shared `<Chart>` wrapper. `md-pie-chart`'s data prop
       is `data`, not `series` — it is the one chart in the library that differs
       — and this donut also localises `tableLabels`, an object prop the shared
       wrapper does not carry. So the element is wired by hand with `v-awc`,
       the same primitive the wrapper is built on. (The React source hand-wires
       it with `useElementProps` for the same reason.)

  THE SKELETON BEAT is `<Screen>`'s (see `useScreenReady`); what stays here is
  this screen's own SHAPE in the `skeleton` slot, because it is the one screen
  whose opening is not a KPI row and two panels. The placeholder is the REAL
  layout — four KPI tiles in the same grid, two panels in the same `grid-wide`,
  two more in the same `grid-2`, the table and the trail — and nothing moves
  when the data lands.

  WHAT CHANGED FROM THE REACT SOURCE, mechanism only, never behaviour:
  `useCustomEvent` becomes `v-awc="{ on }"` (Vue's `@mdChange` would silently
  listen for `md-change`); `useElementProps` becomes `v-awc="{ props }"`;
  `useDomEvent(list, 'click')` becomes a plain `@click` (a native, composed,
  bubbling event needs no directive); and the compact-only FAB cluster is a
  `v-if` — the directive binds listeners on mount, so a cluster that mounts
  late still gets them, which is the same guarantee React needed the separate
  gate component for.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import {
  assetClassColor,
  driftedMandates,
  getActivity,
  getBookAllocation,
  getBookTotals,
  getPerformanceSeries,
  growthOf100,
  HISTORY_MONTHS,
  plColor,
  REPORTING_DATE,
  returnWindow,
  tail,
} from '@awc-ui/showcase-kit/wealth';
import { crumbsFor, route, withBase } from '~/lib/routes';
import { isPlainActivation, usePathname, useRouter } from '~/lib/router';
import { useShowcaseState, useT } from '~/composables/useShowcase';
import type { ChartSeries } from '~/lib/types';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import Chart from '~/components/Chart.vue';
import Drill from '~/components/Drill.vue';
import KpiSkeleton from '~/components/skeletons/KpiSkeleton.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import AllocationChip from '~/components/bits/AllocationChip.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import DriftMeter from '~/components/bits/DriftMeter.vue';
import Fact from '~/components/bits/Fact.vue';
import KpiTile from '~/components/bits/KpiTile.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';
import OverviewBookTable from './OverviewBookTable.vue';

/* --------------------------------------------------------------- constants */

/** The index the kit rebases the performance series to. `growthOf100()`'s own base. */
const GROWTH_BASE = 100;

/**
 * The performance chart's y-axis floor.
 *
 * TWO REASONS IT IS SET AT ALL. A value axis anchors itself to ZERO unless a
 * `min` is given — correct for a quantity, useless for an index, where both
 * lines start at 100 and the whole story happens in the top sixth of a 0–120
 * plot. And with the floor fixed, the axis is IDENTICAL at all four periods
 * (every window ends at the same last point, so the data-derived top is the
 * same too), which means the picker changes the horizontal range and nothing
 * else — switching from 24 months to 3 cannot make a flat stretch look steep.
 *
 * 95 sits below the whole 24-month series, whose low is 98.6, so nothing is
 * ever cropped. The top is left data-derived on purpose: `includeZero` only
 * ever extends a bound TOWARD zero, and this one is already positive.
 */
const GROWTH_FLOOR = 95;

/** The four windows the period picker offers, in months. The last is the whole history. */
const PERIODS: readonly number[] = [3, 6, 12, HISTORY_MONTHS];

/**
 * The chart heights `app.css` names as `.chart-sm` / `.chart-md`.
 *
 * Repeated as constants rather than as classes because a chart takes its height
 * through its own `height` prop — a wrapper class would size a box the canvas
 * does not fill. Same numbers, so two charts meant to be compared still match.
 */
const CHART_MD = '260px';
const CHART_LG = '340px';

/* The activity feed is one disclosure, not a short list with a "view all"
   toggle, so there is a single length rather than a collapsed and an expanded
   one. Twelve is what the panel's own header offers to open. */
const ACTIVITY_ROWS = 12;

const FAB_ID = 'wealth-overview-quick-actions';

/* ------------------------------------------------------------------- hooks */

/**
 * A media query as a ref.
 *
 * Starts `false` and settles in `onMounted`, so the first frame is the same on
 * every machine and nothing is read during render. The breakpoint mirrors the
 * one `app.css` uses to swap the rail for the bar — it is quoted here rather
 * than imported because it is a CSS fact, and the two are checked together in
 * the browser.
 */
function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false);
  let stop: (() => void) | undefined;

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => {
      matches.value = mq.matches;
    };
    update();
    mq.addEventListener('change', update);
    stop = () => mq.removeEventListener('change', update);
  });
  onBeforeUnmount(() => stop?.());

  return matches;
}

/* ------------------------------------------------------------------ screen */

const t = useT();
const state = useShowcaseState();
const pathname = usePathname();
const router = useRouter();

const crumbs = computed(() => crumbsFor(pathname.value));

const totals = getBookTotals();
const points = getPerformanceSeries();

/* ---------------------------------------------------------------- KPI  row */

// Bound to the translator, so a locale change re-formats the hover readout.
const money = computed(
  () => (value: number | null) => t.value.formatCurrency(value ?? 0, { notation: 'compact' }),
);
const percent = computed(
  () => (value: number | null) => t.value.formatPercent(value ?? 0, { maximumFractionDigits: 2 }),
);

const monthLabels = computed(() => points.map((point) => t.value.formatDate(point.date, 'monthYear')));

const aumTrend = points.map((point) => point.marketValue);
const returnTrend = points.map((point) => point.cumulativeReturn);
// Monthly NET FLOW, not the balance: the flows tile is about money arriving
// and leaving, and the balance's own line is already on the AUM tile.
const flowTrend = points.map((point) => point.netFlow);

/* ------------------------------------------------------------- performance */

/**
 * Growth of 100, book against benchmark, with the period picker driving the
 * range (§7.2 pairs exactly these two).
 *
 * THE PICKER IS REAL. It re-slices the series through the kit's `tail()` and
 * re-reads the window's returns through `returnWindow()` — the figures under
 * the chart change with it, and neither number is computed here. `base` in the
 * subtitle is the first value actually on screen, read off the kit's series, so
 * the sentence stays true at every window rather than claiming a rebase that
 * only holds over the full history.
 */
const months = ref<number>(HISTORY_MONTHS);

const pickerListeners = {
  mdChange(event: Event) {
    const [value] = (event as CustomEvent<string[]>).detail ?? [];
    if (value) months.value = Number(value);
  },
};

const growth = growthOf100();
const visible = computed(() => tail(growth, months.value));
const windowReturn = computed(() => returnWindow(points, months.value));

const index = computed(
  () => (value: number | null) => t.value.formatNumber(value ?? 0, { maximumFractionDigits: 1 }),
);

const perfTitle = computed(() => t.value('wealth.panel.performance'));

/*
 * THE BENCHMARK IS DASHED, and that is not decoration. The palette's first
 * two roles are a violet and a rose that sit close together in dark mode, and
 * a reference line the reader cannot separate from the mandate is worse than
 * no reference line at all. The stroke style is a second carrier beside the
 * legend, which is exactly what the chart's manual asks for.
 *
 * Typed locally because `ChartSeries` in `lib/types.ts` models only the four
 * fields the wrapper needed on day one — `dash`, `color` and `symbol` are
 * real per-series options of `md-line-chart` that it does not carry yet.
 * Widening it HERE rather than there keeps the shared file out of this
 * screen's diff.
 */
const perfSeries = computed<(ChartSeries & { dash?: 'solid' | 'dashed' | 'dotted' })[]>(() => [
  {
    id: 'book',
    label: t.value('wealth.panel.book'),
    data: visible.value.map((p) => p.portfolio),
  },
  {
    id: 'benchmark',
    label: t.value('wealth.kpi.benchmark'),
    data: visible.value.map((p) => p.benchmark),
    dash: 'dashed',
  },
]);

const perfXAxis = computed(() => ({
  data: visible.value.map((p) => t.value.formatDate(p.date, 'monthYear')),
  scale: 'category',
}));
const perfYAxis = computed(() => ({ label: perfTitle.value, min: GROWTH_FLOOR }));

/* ------------------------------------------------------------------- donut */

const allocRows = getBookAllocation();

/*
 * The palette is the kit's, looked up PER ROW rather than taken as
 * `ASSET_CLASS_PALETTE` positionally: the array is ordered by
 * `ASSET_CLASS_ORDER` and so is the allocation today, but a lookup by class
 * cannot drift if either ever changes, and equity must be the same violet in
 * the ring, the chip and the meter or the three stop being readable together.
 *
 * Token REFERENCES go straight to the chart: `resolveSeriesColor` in the
 * library resolves `var()` / `color-mix()` against the chart host, and because
 * the chart re-resolves on its own `watchMdChartTheme` tick, a theme or accent
 * flip repaints with the new token values without this screen listening for
 * anything.
 */
const donutColors = allocRows.map((row) => assetClassColor[row.assetClass]);

const donutMoney = computed(
  () => (value: number) => t.value.formatCurrency(value, { notation: 'compact' }),
);

// `data`, `valueFormatter` and `tableLabels` are object/function props with no
// attribute form — `v-awc` assigns them to the instance and re-assigns on
// every update, so a locale switch re-labels the accessible table too.
const donutProps = computed(() => ({
  data: allocRows.map((row, i) => ({
    label: t.value(row.assetClassKey),
    value: row.marketValue,
    color: donutColors[i],
  })),
  valueFormatter: donutMoney.value,
  tableLabels: {
    category: t.value('wealth.table.assetClass'),
    value: t.value('wealth.table.marketValue'),
    share: t.value('wealth.table.weight'),
  },
}));

/* ---------------------------------------------------------------- rebalance */

/*
 * EVERY DRIFTED MANDATE, not the first five.
 *
 * This panel used to cap at five and print "2 more" underneath — which spent a
 * row telling the reader something was hidden while leaving enough empty space
 * beneath to have shown it. Seven is the whole set here, and a rebalancing
 * queue is exactly the list you want in full: "2 more" gives no name, no drift
 * and nothing to act on.
 */
const drifted = driftedMandates();

/* ----------------------------------------------------------------- activity */

const activity = getActivity({ limit: ACTIVITY_ROWS });

/*
 * A custom element's `href` is the BROWSER's link, not the router's.
 *
 * `md-list-item type="link"` renders a real anchor inside its shadow root,
 * which is right — it gives the row a URL to copy and a ⌘-click that opens a
 * tab. But a plain click on it would walk the whole document out of the SPA.
 * The rail and the breadcrumbs each carry the same interception for the same
 * reason; this finds the row through `composedPath()`, which is the only way
 * across a shadow boundary, and defers to the browser for every non-plain
 * click. A native `click` is composed and bubbles, so a plain `@click` on the
 * list is a real listener — no directive needed.
 */
function onActivityClick(event: MouseEvent) {
  if (!isPlainActivation(event)) return;
  const item = event
    .composedPath()
    .find(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.tagName === 'MD-LIST-ITEM',
    );
  const href = item?.getAttribute('href');
  if (!href) return;
  event.preventDefault();
  router.push(href.replace(withBase(''), '') || '/');
}

/* ------------------------------------------------------------ quick actions */

/**
 * The compact-width primary action: one FAB that fans out into three.
 *
 * WHY IT IS COMPACT-ONLY. `md-fab-menu`'s manual is explicit — do not pair a
 * FAB menu with a toolbar or a navigation rail, and M3 says the same. Above
 * 900px this app HAS a rail, and that rail already carries the one FAB M3
 * allows there. Below 900px `app.css` takes the rail out of the DOM entirely
 * and docks `md-navigation-bar` instead, which is the surface a FAB is
 * specified to sit beside. So the menu appears exactly where it is legal, and
 * the screen never shows two prominent actions at once.
 *
 * The FAB is icon-only, so it carries its own `aria-label`; the popup is named
 * separately by `menu-label`, which is the only thing naming the `role="menu"`.
 * The menu wires itself to the FAB by `id` and manages `aria-expanded`,
 * `aria-haspopup` and the icon morph — none of which are set here.
 *
 * Positioning is logical (`inset-inline-end`, `inset-block-end`) so the
 * cluster lands in the correct corner under `dir="rtl"`, and it clears both
 * the docked navigation bar and `<awc-showcase-dock>`, whose measured height
 * the kit publishes as `--awc-dock-height`.
 */
const compact = useMediaQuery('(max-width: 899px)');

const QUICK_ACTIONS: readonly { icon: string; labelKey: string; path: string }[] = [
  { icon: 'description', labelKey: 'wealth.action.newProposal', path: route.proposals() },
  { icon: 'swap_horiz', labelKey: 'wealth.action.newOrder', path: route.trade() },
  { icon: 'flag', labelKey: 'wealth.action.newGoal', path: route.planning() },
];

/*
 * `mdClick` from an item carries NO detail — the pressed row is `event.target`
 * even from a listener on the menu, because the event bubbles and is composed.
 * The route rides on a data attribute rather than a prop: `md-fab-menu-item`
 * has no `value`, and `dataset` reads it back without coupling to the
 * component.
 *
 * The menu closes itself and returns focus to the FAB; calling `close()` from
 * here is the documented anti-pattern. And `router.push` takes an UNPREFIXED
 * path and adds the mount itself, so these stay client-side.
 */
const fabMenuListeners = {
  mdClick(event: Event) {
    const item = event.target as HTMLElement | null;
    const path = item?.dataset?.path;
    if (path) router.push(path);
  },
};

const fabStyle = {
  position: 'fixed',
  insetInlineEnd: 'var(--md-sys-spacing-inset-lg, 16px)',
  insetBlockEnd:
    'calc(var(--awc-dock-height, 0px) + 80px + var(--md-sys-spacing-inset-lg, 16px))',
  zIndex: 'var(--md-sys-z-index-navigation, 200)',
};
</script>

<template>
  <Screen
    :title="t('wealth.screen.overview.title')"
    :subtitle="
      t('wealth.screen.overview.subtitle', { date: t.formatDate(REPORTING_DATE, 'long') })
    "
    :crumbs="crumbs"
  >
    <template #aside>
      <md-chip
        variant="assist"
        appearance="outlined"
        icon="groups"
        :label="
          t('wealth.common.of', { count: totals.householdCount, total: totals.clientCount })
        "
        :title="`${t('wealth.kpi.households')} / ${t('wealth.kpi.clients')}`"
      ></md-chip>
    </template>

    <!-- Mounted from the first render, never merely revealed: `<Screen>` keeps
         the body in the tree behind the placeholder, so the panels' listeners
         and the components' lazy chunks are live before the swap. -->
    <section class="kpi-grid">
      <KpiTile
        :label="t('wealth.kpi.aum')"
        :hint="t('wealth.kpi.aum.help')"
        :trend="aumTrend"
        :trend-labels="monthLabels"
        :format-trend="money"
        color="primary"
      >
        <template #value><Money :value="totals.aum" compact /></template>
      </KpiTile>

      <!-- The sparkline's colour is the excess return's colour, from the kit's
           own map — so the line agrees with the sign underneath it instead of
           being a decorative accent that happens to be green. -->
      <KpiTile
        :label="t('wealth.kpi.ytdReturn')"
        :trend="returnTrend"
        :trend-labels="monthLabels"
        :format-trend="percent"
        :color="plColor(totals.ytdExcessReturn)"
      >
        <template #value><Percent :value="totals.ytdReturn" /></template>
        <template #hint>{{ t('wealth.common.vsBenchmark') }} <Signed :value="totals.ytdExcessReturn" kind="percent" /></template>
      </KpiTile>

      <KpiTile
        :label="t('wealth.kpi.netNewMoney')"
        :trend="flowTrend"
        :trend-labels="monthLabels"
        :format-trend="money"
        color="tertiary"
      >
        <template #value><Signed :value="totals.netNewMoneyYtd" compact /></template>
        <template #hint>{{ t('wealth.unit.months', { value: 12 }) }} <Signed :value="totals.netNewMoneyOneYear" compact /></template>
      </KpiTile>

      <!-- No sparkline: there is no history behind these two counts in the
           fixture, and drawing a flat line would invent one. `trailing` is a
           `Count` chip rather than an `md-badge`, which would anchor to the
           card's corner and be clipped in half — see the KpiTile notes. -->
      <KpiTile
        :label="t('wealth.kpi.driftBreaches')"
        :hint="t('wealth.kpi.kycReviewDue')"
        color="error"
      >
        <template #value><Num :value="totals.driftBreachCount" /></template>
        <template #trailing><Count :value="totals.kycReviewDueCount" color="warning" /></template>
      </KpiTile>
    </section>

    <section class="grid-wide">
      <Panel
        :title="perfTitle"
        :subtitle="
          t('wealth.panel.performanceHint', {
            base: t.formatNumber(visible[0]?.portfolio ?? GROWTH_BASE, {
              maximumFractionDigits: 0,
            }),
            months: windowReturn.months,
          })
        "
      >
        <template #actions>
          <md-segmented-button-set v-awc="{ on: pickerListeners }" :aria-label="perfTitle">
            <md-segmented-button
              v-for="period in PERIODS"
              :key="period"
              :value="String(period)"
              :label="t('wealth.unit.months', { value: period })"
              :selected="period === months || undefined"
            ></md-segmented-button>
            <!-- `label`, never slotted text: slotted label content is read once
                 before the first render, so a translated string arriving later
                 would never make it into the segment. -->
          </md-segmented-button-set>
        </template>

        <!-- The chart carries no `label` of its own — the panel above already
             says it, and two headings for one figure is worse than one.
             `summary` replaces the generated English aria-label so the figure
             is still named, in the reader's language. -->
        <Chart
          tag="md-line-chart"
          :series="perfSeries"
          :x-axis="perfXAxis"
          :y-axis="perfYAxis"
          :value-formatter="index"
          :locale="state.locale"
          curve="monotone"
          legend="top-end"
          axis-ticks
          :height="CHART_MD"
          :summary="t('chart.summary.line', { label: perfTitle, count: 2 })"
        />

        <md-divider></md-divider>

        <!-- The numbers the curve is being read for, and the reason the picker
             is not decoration: all three come from `returnWindow()` for the
             selected window. -->
        <dl class="dl">
          <Fact :label="t('wealth.unit.months', { value: windowReturn.months })">
            <Signed :value="windowReturn.portfolio" kind="percent" />
          </Fact>
          <Fact :label="t('wealth.kpi.benchmark')">
            <Percent :value="windowReturn.benchmark" />
          </Fact>
          <Fact :label="t('wealth.kpi.excessReturn')">
            <Signed :value="windowReturn.excess" kind="percent" />
          </Fact>
        </dl>
      </Panel>

      <Panel :title="t('wealth.panel.allocation')" :subtitle="t('wealth.panel.allocationHint')">
        <!-- `inner-radius` first, then the centre slot: content in the middle
             of a SOLID pie sits on top of the slices. The centre overlay is
             presentational here because the same figure is the first KPI tile
             on the screen.

             `show-labels="false"` because a legend is already naming the
             slices, and the label the chart would draw inside them is a
             nine-digit euro amount that does not fit in a 4% wedge. -->
        <md-pie-chart
          v-awc="{ props: donutProps }"
          :locale="state.locale"
          :label-plot="t('wealth.chart.plotHint')"
          inner-radius="62%"
          padding-angle="1"
          show-labels="false"
          legend="bottom"
          :height="CHART_LG"
        >
          <div slot="center">
            <strong><Money :value="totals.aum" compact /></strong>
            <br />
            {{ t('wealth.kpi.aum.short') }}
          </div>
        </md-pie-chart>
        <!-- Taller than the line chart beside it: a ring plus a five-item
             legend needs the height the curve does not, and `.grid-wide`
             stretches both cards to the taller one anyway — so the choice is
             between filling that height with chart or with empty card. -->
      </Panel>
    </section>

    <!--
      Two columns, not three. `app.css` stretches cards in a row to the
      tallest of them on purpose, so panels sharing a row want similar
      content: five allocation blocks and five drifted mandates are within a
      row of each other, while a six-line timeline in the same row would have
      left a third of a card empty. The trail goes full width at the bottom
      instead, where its rows have room for the actor as well.
    -->
    <section class="grid-2">
      <!-- No subtitle: the donut panel beside it already carries "target
           against actual, by asset class", and saying it twice on one screen
           is noise. -->
      <Panel :title="t('wealth.table.drift')">
        <div class="stack">
          <!-- One asset class, target against actual, with the drift as a
               meter. `md-card`, not a `<div>` with a border: `variant="outlined"`
               is the component's own 1px outline-variant, medium corner and
               surface-container-low, with its density scale, RTL-safe logical
               padding and state layer — `.alloc-row` carries nothing but the
               internal stack.

               `md-meter`, not `md-progress-indicator`: drift is a STATE (how
               far from target), not an activity. The bar carries the distance
               and the colour carries the band, while the signed text beside
               the label carries the direction — colour is never the only
               signal. -->
          <md-card
            v-for="row in allocRows"
            :key="row.assetClass"
            variant="outlined"
            full-width
            class="alloc-row"
          >
            <div class="alloc-row__head">
              <h3 class="alloc-row__name">{{ t(row.assetClassKey) }}</h3>
              <AllocationChip :status="row.status" />
            </div>

            <DriftMeter :drift="row.drift" />

            <div class="alloc-row__figures">
              <span>{{ t('wealth.table.target') }} <Percent :value="row.targetWeight" :digits="1" /></span>
              <span>{{ t('wealth.table.actual') }} <Percent :value="row.actualWeight" :digits="1" /></span>
              <span>{{ t('wealth.table.rebalance') }} <Signed :value="row.rebalanceAmount" compact /></span>
            </div>
          </md-card>
        </div>
      </Panel>

      <Panel
        :title="t('wealth.panel.rebalance')"
        :subtitle="t('wealth.panel.rebalanceHint')"
      >
        <template #actions><Count :value="drifted.length" color="warning" /></template>

        <!-- No `hint`: this is a fact about the book, not a filter result, and
             telling the reader to widen a filter they never set would be
             nonsense. -->
        <div v-if="drifted.length === 0" class="empty">
          <p>{{ t('wealth.empty.rebalance') }}</p>
        </div>
        <div v-else class="stack">
          <!-- One mandate that has drifted, with the household's initials
               beside it. `label` names the avatar for assistive tech; `name`
               only supplies the initials. A household is not a control and
               opens nothing, so the avatar is presentational beside the link
               that does. -->
          <md-card
            v-for="entry in drifted"
            :key="entry.household.id"
            variant="outlined"
            full-width
            class="alloc-row"
          >
            <div class="alloc-row__head">
              <span class="with-dot">
                <md-avatar
                  :name="entry.household.name"
                  :label="entry.household.name"
                  size="small"
                ></md-avatar>
                <Drill :to="route.household(entry.household.id)">{{ entry.household.name }}</Drill>
              </span>
              <AllocationChip :status="entry.worst.status" />
            </div>

            <div class="alloc-row__figures">
              <span>{{ t(entry.worst.assetClassKey) }} <Signed :value="entry.worst.drift" kind="percent" /></span>
              <span>{{ t('wealth.kpi.driftBreaches') }} <Num :value="entry.breachCount" /></span>
              <span>{{ t('wealth.allocationStatus.drifted') }} <Num :value="entry.driftedCount" /></span>
            </div>
          </md-card>
        </div>
      </Panel>
    </section>

    <OverviewBookTable />

    <!--
      NO PANEL HEAD on the trail. The title, the "newest first" hint and the
      expand control all moved into the list's own disclosure row, so a titled
      `panel__head` above it would have said the same thing twice with the
      affordance split across both. `Panel`'s `title` is optional precisely for
      this.

      The caret is the component's, not ours. An `expandable` row renders its
      own trailing `md-icon-button` carrying `aria-expanded` and
      `aria-controls`, gets the icon-button shape morph while expanded, and
      rotates its glyph — the persistent "this is open" state a hand-rolled
      toggle never had.
    -->
    <Panel>
      <div v-if="activity.length === 0" class="empty">
        <p>{{ t('wealth.empty.activity') }}</p>
      </div>
      <!--
        `md-list`, not a hand-rolled `<ul>`: the household screen's own
        activity panel renders this same feed as a list, and two views of one
        entity should not disagree about what an activity row looks like.
        `type="link"` rather than an anchor inside a cell: the household was
        the only destination the row had, so the whole row carries it, and the
        row gets the ripple, focus ring and roving focus a bare `<li>` had
        none of.
      -->
      <md-list
        v-else
        :label="t('wealth.panel.activity')"
        @click="onActivityClick"
      >
        <md-list-item
          expandable
          expanded
          leading-icon="history"
          :headline="t('wealth.panel.activity')"
          :supporting-text="`${t('wealth.common.entries', { count: activity.length })} · ${t('wealth.panel.activityHint')}`"
        >
          <!-- The count is the point of a disclosure header: it tells you what
               is behind the caret before you open it. Hairlines are interleaved
               `md-divider`s — `md-list` has no `dividers` prop, and the list
               hides them from assistive tech itself, because a `list` role may
               not own a separator. Everything in here is slotted:
               `expanded-content` takes a FLAT run of rows, never a nested
               `md-list` chassis. -->
          <template v-for="(entry, entryIndex) in activity" :key="entry.id">
            <md-divider v-if="entryIndex > 0" slot="expanded-content" inset></md-divider>
            <!-- One line, and the household is IN it. Three lines each — an
                 overline, a headline and a supporting line — spent a third of
                 the panel's height per entry and left the right half of every
                 row empty. The log reads as a sentence, so it is written as
                 one, and the date and actor sit in the trailing metadata where
                 the eye can scan a column of them. `href` is base-prefixed,
                 because this one IS the browser's URL: the click handler above
                 strips the base back off before routing. -->
            <md-list-item
              slot="expanded-content"
              type="link"
              :href="withBase(route.household(entry.householdId))"
              leading-icon="history"
              :headline="`${t(entry.actionKey)} · ${entry.householdName}`"
              lines="1"
            >
              <span slot="trailing-supporting-text"><DateText :value="entry.date" date-style="short" /> · {{ entry.actorName }}</span>
            </md-list-item>
          </template>
        </md-list-item>
      </md-list>
    </Panel>

    <!-- The gate MOUNTS the cluster rather than hiding it, exactly as the
         React source does — at desktop widths the FAB and its menu are not in
         the DOM at all, so the parity census never sees a hidden extra
         prominent action. `v-awc` attaches its listeners in `mounted`, so a
         cluster that appears on a later resize still gets them. -->
    <template v-if="compact">
      <md-fab
        :id="FAB_ID"
        icon="add"
        :aria-label="t('wealth.nav.toolbar')"
        :style="fabStyle"
      ></md-fab>
      <md-fab-menu
        v-awc="{ on: fabMenuListeners }"
        :anchor="FAB_ID"
        placement="up"
        :menu-label="t('wealth.nav.toolbar')"
      >
        <md-fab-menu-item
          v-for="action in QUICK_ACTIONS"
          :key="action.labelKey"
          :icon="action.icon"
          :label="t(action.labelKey)"
          :data-path="action.path"
        ></md-fab-menu-item>
      </md-fab-menu>
    </template>

    <!--
      The screen's layout with nothing in it yet.

      Every wrapper here is the SAME element and the same class as the real
      body — `.kpi-grid`, `.grid-wide`, `.grid-2` — so the swap moves nothing
      on the page. That is the whole point of a skeleton over a spinner.

      Exactly ONE of these announces: the placeholder is a polite live region,
      and fourteen of them saying "loading" is fourteen announcements for one
      event.
    -->
    <template #skeleton>
      <section class="kpi-grid">
        <KpiSkeleton announce />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </section>

      <section class="grid-wide">
        <PanelSkeleton :height="CHART_MD" />
        <PanelSkeleton :height="CHART_LG" />
      </section>

      <section class="grid-2">
        <PanelSkeleton :lines="10" />
        <PanelSkeleton :lines="10" />
      </section>

      <div class="table-host">
        <md-card variant="outlined" class="panel" full-width>
          <div class="panel__inner">
            <div class="panel__head">
              <div class="skel" style="inline-size: 120px; block-size: 16px"></div>
              <div class="skel" style="inline-size: 220px; block-size: 16px"></div>
            </div>
            <div class="skel" style="inline-size: 100%; block-size: 320px"></div>
          </div>
        </md-card>
      </div>

      <PanelSkeleton :lines="8" />
    </template>
  </Screen>
</template>
