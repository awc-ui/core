<!--
  Screen 2 — every holding in the book.

  THE SCREEN IS THE ONLY PLACE THAT KNOWS WHAT IS ON SCREEN. It holds the
  filters, the sort of each table and which view is showing, turns all of that
  into ONE call per dataset through `@awc-ui/showcase-kit/wealth`, and hands the
  resulting rows down. The filter bar reports intent, the tables page and render
  — neither of them decides which rows exist.

  TWO VIEWS OF ONE BOOK, so `md-tabs` is legitimate here and only here: holdings
  and the instrument universe are sibling views of the same data, not
  destinations (§7.3). The rail and the bar own destinations, and the shell owns
  those.

  NOTHING IS COMPUTED HERE. Every figure comes from a selector or a derive
  function: the roll-ups beside the table are `regionTotals`, `currencyExposure`
  and `topMovers` over the FILTERED rows, so they answer questions about what
  you are looking at, and `bookHoldings()` is deliberately book-wide, because a
  concentration you have filtered out is still a concentration.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  assetClassTotals,
  bookHoldings,
  concentration,
  currencyExposure,
  getBookTotals,
  getHouseholdById,
  getInstrumentById,
  getInstruments,
  getPositions,
  regionTotals,
  REPORTING_DATE,
  topMovers,
  type Instrument,
  type InstrumentFilter,
  type Position,
  type PositionFilter,
  type PositionSortKey,
} from '@awc-ui/showcase-kit/wealth';
import { crumbsFor, route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import Panel from '~/components/Panel.vue';
import Screen from '~/components/Screen.vue';
import AssetClassChip from '~/components/bits/AssetClassChip.vue';
import Count from '~/components/bits/Count.vue';
import KpiTile from '~/components/bits/KpiTile.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import Percent from '~/components/bits/Percent.vue';
import RatioMeter from '~/components/bits/RatioMeter.vue';
import Signed from '~/components/bits/Signed.vue';
import TableSkeleton from '~/components/skeletons/TableSkeleton.vue';
import HoldingsFilters from './HoldingsFilters.vue';
import HoldingsSkeleton from './HoldingsSkeleton.vue';
import InstrumentsTable from './InstrumentsTable.vue';
import PositionsTable from './PositionsTable.vue';
import {
  instrumentColumns,
  NO_FILTERS,
  positionColumns,
  type ExportTarget,
  type HoldingsFilterState,
  type InstrumentSortKey,
  type SortState,
} from './holdings';

/** Where each table starts, and where a cleared sort returns to. */
const POSITION_SORT: SortState<PositionSortKey> = { column: 'marketValueEur', order: 'desc' };
const INSTRUMENT_SORT: SortState<InstrumentSortKey> = { column: 'ticker', order: 'asc' };

/** How many matches the search panel offers before you commit to the query. */
const SUGGESTION_COUNT = 6;

const t = useT();
const crumbs = computed(() => crumbsFor(route.holdings()));
const totals = getBookTotals();
const risk = concentration();

const filters = ref<HoldingsFilterState>(NO_FILTERS);
const positionSort = ref<SortState<PositionSortKey>>(POSITION_SORT);
const instrumentSort = ref<SortState<InstrumentSortKey>>(INSTRUMENT_SORT);
const tab = ref(0);
// md-tab-panels does not lazily render, so the second table would mount with
// the screen. It is built on first activation instead, which is what the
// manual asks for and what keeps forty sparklines off the first paint.
const universeSeen = ref(false);

/* --------------------------------------------------------- option lists */

// The whole book, unfiltered: these are the CHOICES, and a choice that
// disappears because you already narrowed past it is a dead end. The fixture
// is frozen, so plain consts — nothing here can change under them.
const bookPositions = getPositions();
const classOptions = assetClassTotals(bookPositions);
const regionOptions = regionTotals(bookPositions);
const currencyOptions = currencyExposure(bookPositions);
const universe = getInstruments();

/* --------------------------------------------------------------- rows */

const positions = computed<Position[]>(() => {
  const state = filters.value;
  const base: PositionFilter = {
    search: state.search || undefined,
    instrumentId: state.instrumentId ?? undefined,
    region: state.region ?? undefined,
    currency: state.currency ?? undefined,
    sortBy: positionSort.value.column,
    sortDir: positionSort.value.order,
  };
  const ordered = getPositions(base);
  if (state.assetClasses.length === 0) return ordered;

  /*
   * A UNION, AND THE KIT STILL DECIDES WHAT IS IN IT.
   *
   * `PositionFilter.assetClass` takes one class, and the multi-select offers
   * several. Rather than re-implementing "the position's class is one of
   * these" in a component — the exact drift the kit exists to prevent — the
   * selector is asked once per chosen class and the answers are unioned by
   * id. The ORDER still comes from the single ordered call above, so the
   * union cannot quietly re-sort the table either.
   */
  const keep = new Set(
    state.assetClasses.flatMap((assetClass) =>
      getPositions({ ...base, assetClass }).map((position) => position.id),
    ),
  );
  return ordered.filter((position) => keep.has(position.id));
});

const instruments = computed<Instrument[]>(() => {
  const state = filters.value;
  /*
   * Picking an instrument in the lookup is a question about ONE security, and
   * on this view the honest answer is that one row. `InstrumentFilter` has no
   * id field, so the answer comes from `getInstrumentById` — still a
   * selector, still the kit's own lookup, never a scan written here.
   */
  if (state.instrumentId) {
    const picked = getInstrumentById(state.instrumentId);
    if (picked) return [picked];
  }

  const base: InstrumentFilter = {
    search: state.search || undefined,
    region: state.region ?? undefined,
    currency: state.currency ?? undefined,
    sortBy: instrumentSort.value.column,
    sortDir: instrumentSort.value.order,
  };
  const ordered = getInstruments(base);
  if (state.assetClasses.length === 0) return ordered;

  const keep = new Set(
    state.assetClasses.flatMap((assetClass) =>
      getInstruments({ ...base, assetClass }).map((instrument) => instrument.id),
    ),
  );
  return ordered.filter((instrument) => keep.has(instrument.id));
});

/* ----------------------------------------------- roll-ups on view */

const regionRows = computed(() => regionTotals(positions.value));
const currencyRows = computed(() => currencyExposure(positions.value));
const movers = computed(() => topMovers(positions.value, 5));
const concentrated = bookHoldings(10);
const top = concentrated[0];

const suggestions = computed(() => positions.value.slice(0, SUGGESTION_COUNT));

/* --------------------------------------------------------------- tabs */

const tabsListeners = {
  mdTabChange(event: Event) {
    const detail = (event as CustomEvent<{ index: number; previousIndex: number }>).detail;
    tab.value = detail.index;
    if (detail.index === 1) universeSeen.value = true;
  },
};

const onHoldings = computed(() => tab.value === 0);

const sortColumns = computed(() =>
  (onHoldings.value ? positionColumns(t.value) : instrumentColumns(t.value))
    .filter((column) => column.key)
    .map((column) => ({ key: column.key as string, label: column.label })),
);

/*
 * The menu names a column, not a direction, so the direction comes from the
 * same rule the header uses: figures descend, names ascend. Re-picking the
 * column already sorted flips it, which is what the header does on its second
 * click.
 */
function onSortColumn(key: string): void {
  if (onHoldings.value) {
    const column = key as PositionSortKey;
    const numeric = positionColumns(t.value).find((entry) => entry.key === column)?.numeric;
    const current = positionSort.value;
    positionSort.value =
      current.column === column
        ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { column, order: numeric ? 'desc' : 'asc' };
  } else {
    const column = key as InstrumentSortKey;
    const numeric = instrumentColumns(t.value).find((entry) => entry.key === column)?.numeric;
    const current = instrumentSort.value;
    instrumentSort.value =
      current.column === column
        ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { column, order: numeric ? 'desc' : 'asc' };
  }
}

/* ------------------------------------------------------------- export */

/*
 * A REAL FILE, of exactly what is on screen.
 *
 * The rows are the filtered set — not the visible page — because "export the
 * view" means the selection you made, not the twenty-five rows you happen to
 * be looking at. Values go out RAW: an ISO date and an unformatted number
 * survive a spreadsheet import in any locale, where a grouped, localised
 * figure does not. Headers are translated, because a human reads those.
 *
 * The filename is stamped with the fixture's frozen reporting date, so two
 * runs of this app produce two identical files — there is no clock here, as
 * there is nowhere else in this vertical.
 */
function exportCsv(target: ExportTarget): void {
  const translate = t.value;
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  let name: string = target;
  let header: string[] = [];
  let body: (string | number)[][] = [];

  if (target === 'instruments') {
    header = instrumentColumns(translate)
      .filter((column) => column.label !== translate('wealth.table.trend'))
      .map((column) => column.label);
    body = instruments.value.map((instrument) => [
      instrument.ticker,
      instrument.name,
      translate(instrument.typeKey),
      translate(instrument.assetClassKey),
      translate(instrument.sectorKey),
      translate(instrument.regionKey),
      instrument.currency,
      instrument.price,
      instrument.dayChangePct,
      instrument.twelveMonthReturn,
    ]);
  } else if (target === 'concentration') {
    header = [
      translate('wealth.table.ticker'),
      translate('wealth.table.instrument'),
      translate('wealth.table.assetClass'),
      translate('wealth.table.currency'),
      translate('wealth.table.marketValue'),
      translate('wealth.table.bookWeight'),
      translate('wealth.table.unrealisedPl'),
      translate('wealth.kpi.portfolios'),
    ];
    body = concentrated.map((holding) => [
      holding.ticker,
      holding.instrumentName,
      translate(holding.assetClassKey),
      holding.currency,
      holding.marketValue,
      holding.weight,
      holding.unrealisedPl,
      holding.portfolioCount,
    ]);
  } else {
    name = 'holdings';
    header = positionColumns(translate).map((column) => column.label);
    body = positions.value.map((position) => [
      position.ticker,
      position.instrumentName,
      getHouseholdById(position.householdId)?.name ?? '',
      translate(position.assetClassKey),
      position.currency,
      position.quantity,
      position.price,
      position.marketValueEur,
      position.unrealisedPl,
      position.unrealisedPlPct,
      position.weight,
      position.dayChangePct,
    ]);
  }

  const csv = [header, ...body].map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${REPORTING_DATE}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------- render */

/*
 * The placeholder's "move today" tile summed `dayChangeEur` across the book in
 * this file. That is arithmetic in a component, and the fixture exposes no
 * book-level day change — so the tile is the book's unrealised P/L, which
 * `getBookTotals()` carries with its own percentage. The day's moves have a
 * panel of their own below, built by `topMovers`.
 *
 * The hint is a STRING here where the React source renders a `<Percent sign>`
 * node — `KpiTile`'s `hint` is a string prop — so the same kit formatter call
 * produces the same text (`signDisplay: 'exceptZero'`, one fraction digit).
 */
const unrealisedHint = computed(() =>
  t.value.formatPercent(totals.unrealisedPlPct, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }),
);

const topHint = computed(() =>
  top ? `${top.ticker} · ${top.instrumentName}` : t.value('wealth.common.na'),
);

const currencyHint = currencyOptions.map((exposure) => exposure.currency).join(' · ');
</script>

<template>
  <Screen
    :crumbs="crumbs"
    :title="t('wealth.screen.holdings.title')"
    :subtitle="
      t('wealth.screen.holdings.subtitle', {
        positions: totals.positionCount,
        instruments: totals.instrumentCount,
      })
    "
  >
    <template #skeleton>
      <HoldingsSkeleton :label="t('wealth.screen.holdings.title')" />
    </template>

    <section class="kpi-grid">
      <KpiTile :label="t('wealth.kpi.securities')" value="" :hint="t('wealth.kpi.positions')">
        <template #value><Money :value="totals.securitiesValue" compact /></template>
        <template #trailing><Count :value="totals.positionCount" /></template>
      </KpiTile>
      <KpiTile :label="t('wealth.kpi.unrealisedPl')" value="" :hint="unrealisedHint">
        <template #value><Signed :value="totals.unrealisedPl" compact /></template>
      </KpiTile>
      <KpiTile :label="t('wealth.kpi.topHolding')" value="" :hint="topHint">
        <template #value><Percent :value="risk.topHolding" :digits="1" /></template>
        <template v-if="top" #trailing><Count :value="top.portfolioCount" /></template>
      </KpiTile>
      <KpiTile :label="t('wealth.kpi.nonBaseCurrency')" value="" :hint="currencyHint">
        <template #value><Percent :value="risk.nonBaseCurrency" :digits="1" /></template>
      </KpiTile>
    </section>

    <!--
      The filter bar is NOT wrapped in a card. `md-search`'s docked panel and
      both `md-menu`s are popups, and a card is the surface most likely to clip
      one — the same `overflow: hidden` that slices a badge in half.
    -->
    <HoldingsFilters
      :state="filters"
      :class-options="classOptions"
      :region-options="regionOptions"
      :currency-options="currencyOptions"
      :instruments="universe"
      :suggestions="suggestions"
      :match-count="positions.length"
      :sort-columns="sortColumns"
      :sort-by="onHoldings ? positionSort.column : instrumentSort.column"
      :default-target="onHoldings ? 'holdings' : 'instruments'"
      @change="filters = $event"
      @sort-column="onSortColumn"
      @export="exportCsv"
    />

    <!--
      Two views of one book. `md-tabs` renders no content of its own;
      `md-tab-panels` finds the strip, follows `mdTabChange` and wires the
      tab↔panel ARIA both ways, so the listener here is for the side effect
      only. `sizing="active"` because the two tables differ in height by
      hundreds of pixels and a region sized to the taller one would leave the
      shorter view sitting in a hole.
    -->
    <md-tabs
      v-awc="{ on: tabsListeners }"
      :aria-label="t('wealth.screen.holdings.title')"
      :active-tab-index="tab"
      tab-width="auto"
    >
      <md-tab :label="t('wealth.panel.holdings')"></md-tab>
      <md-tab :label="t('wealth.panel.universe')"></md-tab>
    </md-tabs>

    <md-tab-panels sizing="active">
      <md-tab-panel>
        <!-- The query itself, so the rows can mark what it matched. The
             screen owns the search; the tables only show where it landed. -->
        <PositionsTable
          :rows="positions"
          :query="filters.search"
          :sort="positionSort"
          :default-sort="POSITION_SORT"
          @sort="positionSort = $event"
        />
      </md-tab-panel>
      <md-tab-panel>
        <!--
          A SKELETON, NOT NOTHING, WHILE THE TABLE IS STILL UNMOUNTED.

          `md-tab-panels sizing="active"` takes its height from whichever panel
          is active. `md-tabs` flips that on click, from its own state, in the
          same frame — but this table only mounts on the NEXT patch, because
          `universeSeen` is set by the event handler. For exactly one frame the
          active panel would be empty, the container would measure 0 and the
          whole page below it would jump up 840px and back. Keeping the lazy
          mount is still right — forty sparklines have no business rendering on
          a first paint of a screen you may never open — so the panel simply
          holds the table's SHAPE until the table exists.
        -->
        <InstrumentsTable
          v-if="universeSeen"
          :rows="instruments"
          :query="filters.search"
          :sort="instrumentSort"
          :default-sort="INSTRUMENT_SORT"
          @sort="instrumentSort = $event"
        />
        <TableSkeleton v-else :rows="19" />
      </md-tab-panel>
    </md-tab-panels>

    <!-- Everything below reads the FILTERED rows, so the breakdowns answer
         questions about what is on screen rather than about the whole book. -->
    <section class="grid-3">
      <Panel :title="t('wealth.panel.regions')">
        <div v-if="regionRows.length" class="stack">
          <RatioMeter
            v-for="region in regionRows"
            :key="region.region"
            :label="t(region.regionKey)"
            :fraction="region.weight"
            color="primary"
          />
        </div>
        <p v-else class="muted">{{ t('wealth.empty.holdings') }}</p>
      </Panel>

      <Panel :title="t('wealth.panel.currency')">
        <div v-if="currencyRows.length" class="stack">
          <!-- The base currency carries no translation risk, so it is not
               painted in the same colour as the exposures that do. -->
          <RatioMeter
            v-for="exposure in currencyRows"
            :key="exposure.currency"
            :label="exposure.currency"
            :fraction="exposure.weight"
            :color="exposure.isBase ? 'secondary' : 'tertiary'"
          />
        </div>
        <p v-else class="muted">{{ t('wealth.empty.holdings') }}</p>
      </Panel>

      <Panel :title="t('wealth.panel.movers')">
        <ul v-if="movers.length" class="timeline">
          <li v-for="mover in movers" :key="mover.position.id">
            <span class="strong">{{ mover.position.ticker }}</span>
            <span class="muted" style="flex: 1 1 auto; min-inline-size: 0">
              {{ mover.position.instrumentName }}
            </span>
            <Signed :value="mover.changePct" kind="percent" :digits="2" />
            <Signed :value="mover.changeEur" compact />
          </li>
        </ul>
        <p v-else class="muted">{{ t('wealth.empty.holdings') }}</p>
      </Panel>
    </section>

    <!--
      Book-wide on purpose, and the subtitle says so: two households holding
      the same ETF are ONE concentration, which is exactly what `bookHoldings`
      aggregates and what a position table can never show.
    -->
    <Panel :title="t('wealth.panel.concentration')" :subtitle="t('wealth.table.bookWeight')">
      <div class="grid-2">
        <md-card
          v-for="holding in concentrated"
          :key="holding.instrumentId"
          variant="outlined"
          full-width
          class="alloc-row"
        >
          <div class="alloc-row__head">
            <p class="alloc-row__name">{{ holding.ticker }} · {{ holding.instrumentName }}</p>
            <AssetClassChip :asset-class="holding.assetClass" />
          </div>
          <!-- No percentage here: the meter below carries the weight, and a
               second copy rounded to two digits beside its one would read as
               two different numbers for the same fact. -->
          <div class="alloc-row__figures">
            <span>
              <Money :value="holding.marketValue" compact />
            </span>
            <span>
              <Signed :value="holding.unrealisedPl" compact />
            </span>
            <span>
              {{ t('wealth.kpi.portfolios') }} <Num :value="holding.portfolioCount" />
            </span>
          </div>
          <!-- The largest holding is a few per cent of the book, so a 0–1
               meter would be an empty bar on every row. The cap is the
               largest weight there is, which makes the rows comparable with
               each other — the only comparison this panel is for. -->
          <RatioMeter
            :label="holding.ticker"
            :fraction="holding.weight"
            color="primary"
            :max="concentrated[0]?.weight || 1"
            :thickness="6"
          />
        </md-card>
      </div>
    </Panel>
  </Screen>
</template>
