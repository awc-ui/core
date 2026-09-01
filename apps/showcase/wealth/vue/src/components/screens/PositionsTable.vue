<!--
  Every position in the book — the first of the holdings screen's two tables.

  WHAT THE TABLE DOES AND WHAT THIS FILE DOES. `md-table` sorts nothing and
  pages nothing: `sort-by` / `sort-order` are display state, `mdSortChange` is
  a REQUEST, and `md-table-pagination` reports intent. So the sort request goes
  up through the `sort` emit into the screen's state and the rows are re-read
  through the kit's selector, whose filter takes the very same sort keys the
  headers offer — the ordering is done by the module that owns the data, never
  by a second comparator here that could disagree with it.

  THE COLUMN TEMPLATE IS THE KIT'S, VERBATIM. `TABLES.positions(true)` declares
  twelve tracks and a screen may not add a thirteenth: the layout has to be
  identical in every port for two screenshots to be comparable. That is why the
  expand toggle shares the ticker cell rather than taking a control column of
  its own — a bare toggle dropped into the row would eat a track the template
  does not have, and skew every cell after it.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getHouseholdById,
  TABLES,
  type Position,
  type PositionSortKey,
} from '@awc-ui/showcase-kit/wealth';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import Drill from '~/components/Drill.vue';
import EmptyState from '~/components/EmptyState.vue';
import AssetClassChip from '~/components/bits/AssetClassChip.vue';
import Highlight from '~/components/bits/Highlight.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';
import HoldingsTableHead from './HoldingsTableHead.vue';
import PositionDetail from './PositionDetail.vue';
import { paginationLabels, positionColumns, resolveSort, usePaging, type SortState } from './holdings';

const props = defineProps<{
  /** Already filtered and ordered by the kit. This component only pages it. */
  rows: Position[];
  /**
   * The filter bar's search, for the `<mark>`s only.
   *
   * `getPositions` matches on ticker, instrument name and id — and the id is
   * not a column here, so the two name cells are the only ones that may be
   * marked. THE HOUSEHOLD CELL IS NOT ONE OF THEM: the position search never
   * looks at the household name (the blotter's does), and marking it would tell
   * the reader the query hit a field it was never compared against.
   */
  query?: string;
  sort: SortState<PositionSortKey>;
  defaultSort: SortState<PositionSortKey>;
}>();

const emit = defineEmits<{
  (e: 'sort', next: SortState<PositionSortKey>): void;
}>();

const t = useT();
const layout = TABLES.positions(true);
const columns = computed(() => positionColumns(t.value));

const tableEl = ref<HTMLElement | null>(null);
const { page, rowsPerPage, safePage, offset, pageRows } = usePaging(
  computed(() => props.rows),
  25,
);

// The household beside each row, resolved once per page rather than three
// times per cell in the template.
const entries = computed(() =>
  pageRows.value.map((position) => ({ position, household: getHouseholdById(position.householdId) })),
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
    // No page reset here: the component has already reset the page and emitted
    // mdPageChange, which the handler above consumes.
    rowsPerPage.value = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  },
};
</script>

<template>
  <md-table-container variant="outlined" max-height="70vh" class="table-host">
    <!--
      The toolbar goes in the container's `top` slot and the pagination in its
      `bottom` slot — outside the scroll region, so both stay put while the
      rows move (§7.1). The filters live above the whole tab strip: they drive
      both tables, and one copy is what keeps the two menus' anchor ids unique.
    -->
    <md-table-toolbar
      slot="top"
      :headline="t('wealth.panel.holdings')"
      :supporting-text="t('wealth.common.showing', { shown: pageRows.length, total: rows.length })"
    ></md-table-toolbar>

    <!--
      `keep-height="false"`: the height ratchet is measured once and never
      recomputed, so a live density change from the dock strands the taller
      height as dead space. Pagination already holds the row count steady here.
      `row-offset` / `row-count`: without these, assistive tech announces
      "row 1 of 25" on every page instead of the row's place in the filtered
      book; `row-count` takes the BODY total, md-table adds the head rows
      itself. The empty state belongs INSIDE the table, not instead of it: the
      toolbar, the headers and the pagination readout all stay on screen, so
      the reader can see which filters emptied it.
    -->
    <md-table
      ref="tableEl"
      v-awc="{ on: tableListeners }"
      :label="t('wealth.panel.holdings')"
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
        <EmptyState :message="t('wealth.empty.holdings')" hint />
      </div>

      <HoldingsTableHead :columns="columns" />

      <md-table-body>
        <md-table-row
          v-for="{ position, household } in entries"
          :key="position.id"
          :value="position.id"
          expandable
        >
          <md-table-cell>
            <span class="with-dot">
              <!--
                In the ticker cell, not in a cell of its own: the kit owns the
                twelve tracks and a thirteenth would skew the row. The label
                names the row, because twenty toggles all called "Expand row"
                tell a screen-reader user nothing.
              -->
              <md-table-expand-toggle
                :button-label="`${t('wealth.table.instrument')} ${position.ticker}`"
              ></md-table-expand-toggle>
              <span class="strong">
                <Highlight :text="position.ticker" :query="query" />
              </span>
            </span>
          </md-table-cell>
          <md-table-cell>
            <Highlight :text="position.instrumentName" :query="query" />
          </md-table-cell>
          <md-table-cell>
            <Drill v-if="household" :to="route.household(household.id)">{{ household.name }}</Drill>
            <template v-else>{{ t('wealth.common.na') }}</template>
          </md-table-cell>
          <md-table-cell>
            <AssetClassChip :asset-class="position.assetClass" />
          </md-table-cell>
          <md-table-cell>{{ position.currency }}</md-table-cell>
          <md-table-cell numeric>
            <Num :value="position.quantity" />
          </md-table-cell>
          <md-table-cell numeric>
            <Money :value="position.price" :currency="position.currency" :digits="2" />
          </md-table-cell>
          <md-table-cell numeric>
            <Money :value="position.marketValueEur" />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed :value="position.unrealisedPl" />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed :value="position.unrealisedPlPct" kind="percent" />
          </md-table-cell>
          <md-table-cell numeric>
            <Percent :value="position.weight" :digits="1" />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed :value="position.dayChangePct" kind="percent" />
          </md-table-cell>

          <!-- The detail belongs to the row, in its `expanded` slot: it
               follows its row in the reading order and goes inert with it,
               which a sibling detail row could not do. -->
          <div slot="expanded">
            <PositionDetail :position="position" />
          </div>
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
