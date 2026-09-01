<!--
  The instrument universe behind the book — the holdings screen's second table.

  Same architecture as `PositionsTable.vue`: `md-table` displays, the kit
  sorts, this file only pages. The column template is `TABLES.instruments`,
  eleven tracks, verbatim.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { plColor, TABLES, type Instrument } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import Sparkline from '~/components/Sparkline.vue';
import EmptyState from '~/components/EmptyState.vue';
import AssetClassChip from '~/components/bits/AssetClassChip.vue';
import Highlight from '~/components/bits/Highlight.vue';
import InstrumentTypeChip from '~/components/bits/InstrumentTypeChip.vue';
import Money from '~/components/bits/Money.vue';
import Signed from '~/components/bits/Signed.vue';
import HoldingsTableHead from './HoldingsTableHead.vue';
import {
  instrumentColumns,
  paginationLabels,
  resolveSort,
  usePaging,
  type InstrumentSortKey,
  type SortState,
} from './holdings';

const props = defineProps<{
  rows: Instrument[];
  /**
   * The same search box narrows this tab too, so it marks its matches too —
   * one filter bar that highlighted one of its two tables would read as a bug.
   * `getInstruments` matches ticker, name and id; id is not a column.
   */
  query?: string;
  sort: SortState<InstrumentSortKey>;
  defaultSort: SortState<InstrumentSortKey>;
}>();

const emit = defineEmits<{
  (e: 'sort', next: SortState<InstrumentSortKey>): void;
}>();

const t = useT();
const layout = TABLES.instruments;
const columns = computed(() => instrumentColumns(t.value));

const tableEl = ref<HTMLElement | null>(null);
const { page, rowsPerPage, safePage, offset, pageRows } = usePaging(
  computed(() => props.rows),
  25,
);

const tableListeners = {
  mdSortChange(event: Event) {
    resolveSort(
      (event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>).detail,
      props.defaultSort,
      tableEl.value,
      (next) => emit('sort', next),
    );
  },
};

const pagerListeners = {
  mdPageChange(event: Event) {
    page.value = (event as CustomEvent<{ page: number }>).detail.page;
  },
  mdRowsPerPageChange(event: Event) {
    rowsPerPage.value = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  },
};

// The formatters close over the translator; `v-awc` re-assigns object props on
// every update, so a locale switch re-labels the tooltips without extra wiring.
function priceLabelsFor(instrument: Instrument): string[] {
  return instrument.priceSeriesDates.map((date) => t.value.formatDate(date, 'monthYear'));
}

function priceFormatterFor(instrument: Instrument): (value: number | null) => string {
  return (value) =>
    value === null
      ? t.value('wealth.common.na')
      : t.value.formatCurrency(value, { currency: instrument.currency, maximumFractionDigits: 2 });
}
</script>

<template>
  <md-table-container variant="outlined" max-height="70vh" class="table-host">
    <md-table-toolbar
      slot="top"
      :headline="t('wealth.panel.universe')"
      :supporting-text="t('wealth.common.showing', { shown: pageRows.length, total: rows.length })"
    ></md-table-toolbar>

    <md-table
      ref="tableEl"
      v-awc="{ on: tableListeners }"
      :label="t('wealth.panel.universe')"
      :column-template="layout.columns"
      :min-width="layout.minWidth"
      sticky-header
      striped
      keep-height="false"
      :sort-by="sort.column"
      :sort-order="sort.order"
      :row-offset="offset"
      :row-count="rows.length"
      :empty="rows.length === 0 || undefined"
    >
      <div slot="empty">
        <EmptyState :message="t('wealth.empty.generic')" hint />
      </div>

      <HoldingsTableHead :columns="columns" />

      <md-table-body>
        <md-table-row v-for="instrument in pageRows" :key="instrument.id" :value="instrument.id">
          <md-table-cell>
            <span class="strong">
              <Highlight :text="instrument.ticker" :query="query" />
            </span>
          </md-table-cell>
          <md-table-cell>
            <Highlight :text="instrument.name" :query="query" />
          </md-table-cell>
          <md-table-cell>
            <InstrumentTypeChip :type="instrument.type" />
          </md-table-cell>
          <md-table-cell>
            <AssetClassChip :asset-class="instrument.assetClass" />
          </md-table-cell>
          <md-table-cell>{{ t(instrument.sectorKey) }}</md-table-cell>
          <md-table-cell>{{ t(instrument.regionKey) }}</md-table-cell>
          <md-table-cell>{{ instrument.currency }}</md-table-cell>
          <md-table-cell numeric>
            <Money :value="instrument.price" :currency="instrument.currency" :digits="2" />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed :value="instrument.dayChangePct" kind="percent" />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed :value="instrument.twelveMonthReturn" kind="percent" />
          </md-table-cell>
          <md-table-cell>
            <!--
              `aria-hidden`, and deliberately. md-sparkline names itself with
              a generated English sentence, and twenty-five of those would be
              read out in a table whose previous three columns already carry
              the price, the day's move and the twelve-month return in
              figures. The chart is the same fact drawn; hiding the duplicate
              is the accessible choice, not the lazy one.
            -->
            <div style="min-inline-size: 80px">
              <Sparkline
                aria-hidden="true"
                :data="instrument.priceSeries"
                :labels="priceLabelsFor(instrument)"
                :value-formatter="priceFormatterFor(instrument)"
                variant="line"
                curve="monotone"
                :color="plColor(instrument.twelveMonthReturn)"
                show-marks="extremes"
                height="28px"
              />
            </div>
          </md-table-cell>
        </md-table-row>
      </md-table-body>
    </md-table>

    <md-table-pagination
      v-awc="{ on: pagerListeners }"
      slot="bottom"
      :count="rows.length"
      :page="safePage"
      :rows-per-page="rowsPerPage"
      rows-per-page-options="10,25,50,all"
      show-first-last
      v-bind="paginationLabels(t)"
    ></md-table-pagination>
  </md-table-container>
</template>
