<!--
  The household's holdings: a facet row of asset-class chips over a sortable
  table.

  THE FILTER AND THE SORT BOTH GO THROUGH THE SELECTOR. `getPositions()` takes
  `assetClass`, `sortBy` and `sortDir`, so neither the facet nor the header
  comparator is written here — this component holds the REQUEST (which class,
  which column, which direction) and re-reads the rows. Two ports that sort
  their own arrays disagree the first time one of them forgets the id
  tie-break; two ports that call the same selector cannot.

  `md-table` SORTS NOTHING BY ITSELF. `sort-by` / `sort-order` are display
  state and `mdSortChange` is a request — the manual is explicit, and the
  three-state cycle (asc → desc → off) reports `order: 'none'` with an empty
  column, which is what the reset branch below is for.

  THE FACETS ARE NOT `.filter()`ed OUT OF THE ROWS. Which classes exist in this
  mandate comes from the kit's `assetClassTotals()`, which returns them in
  `ASSET_CLASS_ORDER` and drops the ones with no position — so the chip row and
  the allocation panel agree about what the household actually holds, and a
  class with nothing in it never offers a facet that leads to an empty table.

  THERE IS NO "ALL" CHIP, and that is deliberate rather than an omission. A
  chip that is already selected and stays selected when you click it would flip
  its own `selected` (M3 filter chips toggle themselves and then emit) while
  this component's state did not change — Vue would have nothing to re-render
  and the chip would sit deselected, lying about the filter. Toggling the
  selected class off IS "all classes", and every click there does change the
  state.

  NO PAGINATION. A household holds seven to nine positions. Pagination on nine
  rows is a control that never has a second page to go to.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  assetClassTotals,
  getPositions,
  TABLES,
  type AssetClass,
  type Household,
  type Portfolio,
  type Position,
  type PositionSortKey,
} from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import EmptyState from '~/components/EmptyState.vue';
import AssetClassChip from '~/components/bits/AssetClassChip.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import Percent from '~/components/bits/Percent.vue';
import Signed from '~/components/bits/Signed.vue';

interface SortState {
  column: PositionSortKey;
  order: 'asc' | 'desc';
}

const INITIAL_SORT: SortState = { column: 'marketValueEur', order: 'desc' };

/** Columns whose first click should sort biggest-first rather than A–Z. */
const NUMERIC_KEYS: PositionSortKey[] = [
  'marketValueEur',
  'unrealisedPl',
  'unrealisedPlPct',
  'weight',
  'dayChangePct',
];

const props = defineProps<{
  household: Household;
  portfolio?: Portfolio;
}>();

const t = useT();
const layout = TABLES.positions(false);
const assetClass = ref<AssetClass | null>(null);
const sort = ref<SortState>(INITIAL_SORT);

const tableListeners = {
  mdSortChange(event: Event) {
    const { column, order } = (
      event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>
    ).detail;
    if (!column || order === 'none') {
      sort.value = INITIAL_SORT;
      return;
    }
    sort.value = { column: column as PositionSortKey, order };
  },
};

// Delegated to the row rather than attached per chip: `mdSelect` bubbles and is
// composed, and the retargeted `event.target` is the `md-chip` host carrying
// the `data-class` key.
const facetListeners = {
  mdSelect(event: Event) {
    const value = (event.target as HTMLElement | null)?.dataset?.class as AssetClass | undefined;
    if (!value) return;
    assetClass.value = (event as CustomEvent<{ selected: boolean }>).detail.selected ? value : null;
  },
};

// Every position in the mandate, unfiltered — the facet row is built from
// this, so the chips do not disappear as soon as one of them is chosen.
const all = computed<Position[]>(() => getPositions({ householdId: props.household.id }));
const facets = computed(() => assetClassTotals(all.value));

const rows = computed<Position[]>(() =>
  getPositions({
    householdId: props.household.id,
    assetClass: assetClass.value ?? undefined,
    sortBy: sort.value.column,
    sortDir: sort.value.order,
  }),
);

/*
 * The foot totals come from the kit in both branches.
 *
 * Filtered, they are the chosen class's own roll-up; unfiltered, they are the
 * mandate's securities value and unrealised P/L, which the generator asserts
 * are exactly the sum of the positions. Adding the rendered rows up here
 * would be the same number computed a second way, and the second way is the
 * one that drifts.
 */
const totals = computed(() =>
  assetClass.value
    ? facets.value.find((row) => row.assetClass === assetClass.value)
    : props.portfolio
      ? { marketValue: props.portfolio.securitiesValue, unrealisedPl: props.portfolio.unrealisedPl }
      : undefined,
);

const columns = computed<{ key: PositionSortKey | null; label: string; numeric?: boolean }[]>(() => [
  { key: 'ticker', label: t.value('wealth.table.ticker') },
  { key: 'instrumentName', label: t.value('wealth.table.instrument') },
  { key: null, label: t.value('wealth.table.assetClass') },
  { key: null, label: t.value('wealth.table.currency') },
  { key: null, label: t.value('wealth.table.quantity'), numeric: true },
  { key: null, label: t.value('wealth.table.price'), numeric: true },
  { key: 'marketValueEur', label: t.value('wealth.table.marketValue'), numeric: true },
  { key: 'unrealisedPl', label: t.value('wealth.table.unrealisedPl'), numeric: true },
  { key: 'unrealisedPlPct', label: t.value('wealth.table.plPct'), numeric: true },
  { key: 'weight', label: t.value('wealth.table.weight'), numeric: true },
  { key: 'dayChangePct', label: t.value('wealth.table.dayChange'), numeric: true },
]);
</script>

<template>
  <div class="stack">
    <div v-awc="{ on: facetListeners }" class="row">
      <md-chip
        v-for="facet in facets"
        :key="facet.assetClass"
        :data-class="facet.assetClass"
        variant="filter"
        appearance="outlined"
        :label="t(facet.assetClassKey)"
        :selected="assetClass === facet.assetClass"
      ></md-chip>
      <span class="muted">
        {{ t('wealth.common.showing', { shown: rows.length, total: all.length }) }}
      </span>
    </div>

    <EmptyState v-if="rows.length === 0" :message="t('wealth.empty.holdings')" hint />
    <md-table-container v-else variant="outlined" class="table-host">
      <!-- The height ratchet is measured once and never recomputed, so it
           strands dead space under the rows when the dock changes density.
           Nothing here pages, so there is no jump for it to prevent. -->
      <md-table
        v-awc="{ on: tableListeners }"
        :label="t('wealth.panel.holdings')"
        :column-template="layout.columns"
        :min-width="layout.minWidth"
        keep-height="false"
        striped
        :sort-by="sort.column"
        :sort-order="sort.order"
      >
        <md-table-head>
          <!-- No `active` / `order` on the labels: md-table declares the sort
               above and pushes both down into every label on sync, so a
               value written here could only ever disagree with it. -->
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
          <md-table-row v-for="position in rows" :key="position.id" :value="position.id">
            <md-table-cell>
              <span class="strong">{{ position.ticker }}</span>
            </md-table-cell>
            <md-table-cell>{{ position.instrumentName }}</md-table-cell>
            <md-table-cell>
              <AssetClassChip :asset-class="position.assetClass" />
            </md-table-cell>
            <md-table-cell>{{ position.currency }}</md-table-cell>
            <md-table-cell numeric>
              <Num :value="position.quantity" />
            </md-table-cell>
            <!-- The LOCAL price, in the instrument's own currency — the
                 EUR twin is the market-value column beside it. -->
            <md-table-cell numeric>
              <Money :value="position.price" :currency="position.currency" :digits="2" />
            </md-table-cell>
            <md-table-cell numeric>
              <Money :value="position.marketValueEur" compact />
            </md-table-cell>
            <md-table-cell numeric>
              <Signed :value="position.unrealisedPl" compact />
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
          </md-table-row>
        </md-table-body>

        <md-table-foot v-if="totals">
          <md-table-row rowgroup="foot">
            <md-table-cell head scope="row" colspan="6">{{ t('wealth.common.total') }}</md-table-cell>
            <md-table-cell numeric>
              <Money :value="totals.marketValue" compact />
            </md-table-cell>
            <md-table-cell numeric>
              <Signed :value="totals.unrealisedPl" compact />
            </md-table-cell>
            <md-table-cell></md-table-cell>
            <md-table-cell></md-table-cell>
            <md-table-cell></md-table-cell>
          </md-table-row>
        </md-table-foot>
      </md-table>
    </md-table-container>
  </div>
</template>
