<!--
  The counterparty table, used by the overview and by every sector screen.

  SORTING. `md-table` sorts nothing by itself — `sort-by`/`sort-order` are
  display state and `mdSortChange` is a REQUEST. The handler pushes the request
  into component state, and the rows are re-read through `getCounterparties()`,
  whose filter takes the same sort keys the header offers. So the sort is done by
  the selector that owns the data, not by a second comparator here that could
  disagree with it.

  PAGING. `md-table-pagination` is display state plus a REQUEST too: it renders
  the readout and the controls, and this component owns which slice is rendered.

  DRILLING. The legal name is a real anchor, not a row click: reachable by
  keyboard, has a URL you can copy, survives JavaScript being slow to arrive.
  Legal names are proper nouns and are never translated.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getCounterparties,
  type Counterparty,
  type CounterpartySortKey,
  type SectorId,
} from '@awc-ui/showcase-kit/data';
import { TABLES, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';
import { route } from '~/lib/routes';
import Drill from './Drill.vue';
import EmptyState from './EmptyState.vue';
import Chip from './bits/Chip.vue';
import Dot from './bits/Dot.vue';

const props = withDefaults(
  defineProps<{
    sectorId?: SectorId;
    showSector?: boolean;
    initialSort?: { column: CounterpartySortKey; order: 'asc' | 'desc' };
  }>(),
  { showSector: true },
);

const NUMERIC_KEYS: CounterpartySortKey[] = [
  'ead',
  'pd',
  'expectedLoss',
  'rwa',
  'utilisation',
  'grade',
];

const t = useT();
const initial = computed(
  () => props.initialSort ?? { column: 'ead' as CounterpartySortKey, order: 'desc' as const },
);
const sort = ref(initial.value);
const page = ref(0);
const rowsPerPage = ref(10);

const layout = computed(() => TABLES.counterparties(props.showSector));
const allRows = computed<Counterparty[]>(() =>
  getCounterparties({
    sectorId: props.sectorId,
    sortBy: sort.value.column,
    sortDir: sort.value.order,
  }),
);

// A sort or filter change can leave the reader stranded past the last page.
const lastPage = computed(() => Math.max(0, Math.ceil(allRows.value.length / rowsPerPage.value) - 1));
const safePage = computed(() => Math.min(page.value, lastPage.value));
const rows = computed(() =>
  allRows.value.slice(
    safePage.value * rowsPerPage.value,
    safePage.value * rowsPerPage.value + rowsPerPage.value,
  ),
);

const columns = computed(() => [
  { key: 'legalName' as CounterpartySortKey, label: t.value('table.counterparty') },
  ...(props.showSector ? [{ key: null, label: t.value('table.sector') }] : []),
  { key: null, label: t.value('table.country') },
  { key: 'grade' as CounterpartySortKey, label: t.value('table.rating') },
  { key: 'pd' as CounterpartySortKey, label: t.value('table.pd'), numeric: true },
  { key: null, label: t.value('table.lgd'), numeric: true },
  { key: 'ead' as CounterpartySortKey, label: t.value('table.ead'), numeric: true },
  { key: 'expectedLoss' as CounterpartySortKey, label: t.value('table.expectedLoss'), numeric: true },
  { key: 'rwa' as CounterpartySortKey, label: t.value('table.rwa'), numeric: true },
  { key: 'utilisation' as CounterpartySortKey, label: t.value('table.utilisation'), numeric: true },
]);

const tableListeners = {
  mdSortChange(event: Event) {
    const { column, order } = (event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>)
      .detail;
    if (!column || order === 'none') {
      sort.value = initial.value;
      return;
    }
    sort.value = { column: column as CounterpartySortKey, order };
  },
};

const paginationListeners = {
  mdPageChange(event: Event) {
    page.value = (event as CustomEvent<{ page: number }>).detail.page;
  },
  mdRowsPerPageChange(event: Event) {
    // No `page = 0` here: md-table-pagination has already reset the page and
    // emitted mdPageChange, which the handler above consumes. Resetting again is
    // the component's documented anti-pattern.
    rowsPerPage.value = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  },
};
</script>

<template>
  <EmptyState v-if="rows.length === 0" :message="t('empty.counterparties')" hint />
  <md-table-container v-else variant="outlined">
    <!--
      keep-height: md-table ratchets its height by default so paging cannot make
      the page jump. That baseline is measured once and never recomputed, so a
      density change strands the taller height and leaves dead space below the
      rows — 176px at rung -4. Pagination already holds the row count steady
      here, so the ratchet earns little; live density switching matters more.

      row-offset / row-count: without them assistive tech announces "row 1 of 10"
      on every page instead of the row's position in the whole book. row-count
      takes the BODY total; md-table adds the head and foot rows itself.
    -->
    <md-table
      v-awc="{ on: tableListeners }"
      :label="t('screen.counterparties.title')"
      :column-template="layout.columns"
      :min-width="layout.minWidth"
      keep-height="false"
      striped
      :sort-by="sort.column"
      :sort-order="sort.order"
      :row-offset="safePage * rowsPerPage"
      :row-count="allRows.length"
    >
      <md-table-head>
        <!-- The sort labels carry no active/order: md-table already declares
             sort-by / sort-order above and pushes both down into every label on
             sync, so anything written here could only ever disagree with it. -->
        <md-table-row rowgroup="head">
          <md-table-cell
            v-for="column in columns"
            :key="column.label"
            head
            scope="col"
            :numeric="column.numeric || undefined"
          >
            <md-table-sort-label
              v-if="column.key"
              :column="column.key"
              :default-order="NUMERIC_KEYS.includes(column.key) ? 'desc' : 'asc'"
              :icon-position="column.numeric ? 'start' : 'end'"
            >
              {{ column.label }}
            </md-table-sort-label>
            <template v-else>{{ column.label }}</template>
          </md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        <md-table-row v-for="cp in rows" :key="cp.id" :value="cp.id">
          <md-table-cell>
            <span class="row" style="gap: var(--md-sys-spacing-gap-xs, 4px)">
              <Dot kind="watch" :value="cp.watchlist" />
              <Drill :to="route.counterparty(cp.id)">{{ cp.legalName }}</Drill>
            </span>
          </md-table-cell>
          <md-table-cell v-if="showSector">
            <Drill :to="route.sector(cp.sectorId)">{{ t(`sector.${cp.sectorId}`) }}</Drill>
          </md-table-cell>
          <md-table-cell>{{ t(`country.${cp.country}`) }}</md-table-cell>
          <md-table-cell>
            <Chip kind="rating" :value="cp.ratingLabel" :band="cp.ratingBand" :grade="cp.grade" />
          </md-table-cell>
          <md-table-cell numeric>{{ t.formatPercent(cp.pd, { maximumFractionDigits: 2 }) }}</md-table-cell>
          <md-table-cell numeric>{{ t.formatPercent(cp.lgd, { maximumFractionDigits: 0 }) }}</md-table-cell>
          <md-table-cell numeric>{{ t.formatCurrency(cp.ead, { notation: 'compact' }) }}</md-table-cell>
          <md-table-cell numeric>
            {{ t.formatCurrency(cp.expectedLoss, { notation: 'compact' }) }}
          </md-table-cell>
          <md-table-cell numeric>{{ t.formatCurrency(cp.rwa, { notation: 'compact' }) }}</md-table-cell>
          <md-table-cell numeric>
            <span :style="`color: var(--md-sys-color-${utilisationColor(cp.utilisation)})`">
              {{ t.formatPercent(cp.utilisation, { maximumFractionDigits: 0 }) }}
            </span>
          </md-table-cell>
        </md-table-row>
      </md-table-body>
    </md-table>
    <md-table-pagination
      v-awc="{ on: paginationListeners }"
      slot="bottom"
      :count="allRows.length"
      :page="safePage"
      :rows-per-page="rowsPerPage"
      rows-per-page-options="10,25,all"
      show-first-last
      :label-rows-per-page="t('table.rowsPerPage')"
      :label-displayed-rows="t('table.displayedRows')"
      :label-first-page="t('table.firstPage')"
      :label-previous-page="t('table.previousPage')"
      :label-next-page="t('table.nextPage')"
      :label-last-page="t('table.lastPage')"
      :label-all="t('table.all')"
    ></md-table-pagination>
  </md-table-container>
</template>
