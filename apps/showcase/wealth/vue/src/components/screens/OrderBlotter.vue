<!--
  The blotter: every order the book has raised, filtered and paged.

  FILTERING GOES THROUGH THE SELECTOR, NEVER THROUGH `.filter()` HERE.
  `getOrders()` already knows what "working" means (`submitted` plus
  `partially-filled`) and what a search matches (ticker, security name,
  household, id). Re-deciding either in this file is how two ports end up
  disagreeing about which rows a filter keeps. Paging is the one thing this
  component does own — `md-table-pagination` renders the readout and the
  controls and emits a REQUEST, exactly like a sort header, and taking the slice
  is ours.

  THERE ARE NO SORT HEADERS, and that is deliberate rather than unfinished.
  `OrderFilter` carries no `sortBy` / `sortDir`; the fixture stores orders newest
  first and the selector preserves that. A comparator here would be a second
  ordering the kit knows nothing about, so the headers stay plain and the
  missing filter fields are reported upward instead.

  §7.1's table rule: `md-table-container` WRAPS `md-table`, with the toolbar in
  its `top` slot and the pagination in its `bottom` slot. Neither goes inside
  the table, where they would become children of a grid whose columns belong to
  the rows.

  WHY THE TABLE IS INLINE HERE BUT ITS OWN COMPONENT IN THE REACT SOURCE.
  React's `useCustomEvent` binds in an effect keyed on the ref object, which
  does not change when the element behind it is unmounted and mounted again — so
  a table rendered conditionally would come back after an empty state with a
  DEAD pagination listener, and `BlotterTable` exists to make the effects re-run
  by unmounting as a unit. `v-awc` has no such trap: the directive's `mounted`
  hook runs every time the `v-else` branch re-creates the element, so the
  listeners re-bind by construction and the table can live in this template.
  The facet row still renders inside the container's `top` band while its state
  stays up here with every other filter — that is a line in the template now
  rather than a node passed as a prop.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getAdvisor,
  getBookTotals,
  getOrders,
  TABLES,
  type Order,
  type OrderSide,
  type OrderStatus,
} from '@awc-ui/showcase-kit/wealth';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import EmptyState from '~/components/EmptyState.vue';
import Panel from '~/components/Panel.vue';
import Drill from '~/components/Drill.vue';
import DateText from '~/components/bits/DateText.vue';
import Highlight from '~/components/bits/Highlight.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import OrderSideChip from '~/components/bits/OrderSideChip.vue';
import OrderStatusChip from '~/components/bits/OrderStatusChip.vue';
import { useTx } from './trade-strings';

const SIDES: OrderSide[] = ['buy', 'sell'];

const STATUSES: OrderStatus[] = [
  'draft',
  'staged',
  'submitted',
  'partially-filled',
  'filled',
  'cancelled',
  'rejected',
];

/**
 * The blotter's facets, as data — one list read by the chip row, the delegated
 * handler, the "any filter on" test and the clear action.
 *
 * NONE of them duplicates the two selects beside them. Side and Status are
 * already single-choice controls, so a chip on either axis would be a second
 * control fighting the first, and picking one of each would strand the reader
 * on a guaranteed-empty table. These three are the axes the selects do NOT
 * cover: lifecycle (working), ownership (mine), provenance (raised under advice
 * rather than as an ad-hoc ticket). Over the 14-order fixture they split it
 * 5 / 8 / 8, so each is worth pressing.
 */
const FACETS = [
  { id: 'working', labelKey: 'wealth.trade.workingOnly' },
  { id: 'mine', labelKey: 'wealth.trade.filter.mine' },
  { id: 'fromAdvice', labelKey: 'wealth.trade.filter.fromAdvice' },
] as const;

type FacetId = (typeof FACETS)[number]['id'];
type FacetState = Record<FacetId, boolean>;

const NO_FACETS: FacetState = { working: false, mine: false, fromAdvice: false };

const t = useT();
const tx = useTx();
const totals = getBookTotals();

const search = ref('');
const side = ref<OrderSide | ''>('');
const status = ref<OrderStatus | ''>('');
const facets = ref<FacetState>({ ...NO_FACETS });
const page = ref(0);
const rowsPerPage = ref(10);

const searchEl = ref<HTMLElement | null>(null);

/*
 * The search field is UNCONTROLLED — no `value` is ever bound into it. A
 * controlled text field rewrites the box on every keystroke, which is how a
 * caret ends up jumping to the end of a word being edited in the middle. The
 * consequence is that "clear filters" has to push the empty string back into
 * the element by hand; that is the whole reason `searchEl` exists.
 */
const searchListeners = {
  mdInput(event: Event) {
    search.value = (event as CustomEvent<string>).detail ?? '';
    page.value = 0;
  },
  mdClear() {
    search.value = '';
    page.value = 0;
  },
};

const sideListeners = {
  mdChange(event: Event) {
    side.value = ((event as CustomEvent<string>).detail || '') as OrderSide | '';
    page.value = 0;
  },
};

const statusListeners = {
  mdChange(event: Event) {
    status.value = ((event as CustomEvent<string>).detail || '') as OrderStatus | '';
    page.value = 0;
  },
};

/*
 * `mdSelect`, not a click handler.
 *
 * A filter chip toggles its own `selected` before it emits, and the event
 * carries the state it landed on — so the app never has to infer the new value
 * from the old one, and a press that did not activate the chip cannot
 * desynchronise the two.
 *
 * One listener for the whole set: `mdSelect` bubbles and is composed, so it
 * retargets to the `md-chip` host and its `data-facet` reads straight off
 * `event.target`.
 */
const facetListeners = {
  mdSelect(event: Event) {
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.facet as FacetId | undefined;
    if (!id) return;
    facets.value = {
      ...facets.value,
      [id]: Boolean((event as CustomEvent<{ selected: boolean }>).detail?.selected),
    };
    page.value = 0;
  },
};

const allRows = computed<Order[]>(() =>
  getOrders({
    // Every key is omitted when empty. `getOrders` treats a falsy value as
    // "not asked for" precisely so a screen can hand its state straight in
    // without deciding anything on the way.
    search: search.value || undefined,
    side: side.value || undefined,
    status: status.value || undefined,
    working: facets.value.working ? true : undefined,
    advisorId: facets.value.mine ? getAdvisor().id : undefined,
    fromProposal: facets.value.fromAdvice ? true : undefined,
  }),
);

// A filter change can leave the reader stranded past the last page.
const lastPage = computed(() =>
  Math.max(0, Math.ceil(allRows.value.length / rowsPerPage.value) - 1),
);
const safePage = computed(() => Math.min(page.value, lastPage.value));

const rows = computed<Order[]>(() =>
  allRows.value.slice(
    safePage.value * rowsPerPage.value,
    safePage.value * rowsPerPage.value + rowsPerPage.value,
  ),
);

const filtered = computed(
  () =>
    Boolean(search.value || side.value || status.value) || FACETS.some((f) => facets.value[f.id]),
);

function clearFilters(): void {
  search.value = '';
  side.value = '';
  status.value = '';
  facets.value = { ...NO_FACETS };
  page.value = 0;
  // The custom elements own their own visual state. The two selects and the
  // chips are controlled and will follow, but the search box is not — nothing
  // ever bound a `value` into it, so it has nothing to re-render.
  if (searchEl.value) (searchEl.value as unknown as { value: string }).value = '';
}

/*
 * `mdClick`, not a native `@click`.
 *
 * `md-icon-button`'s soft-disabled path calls `preventDefault()` and returns —
 * it does NOT stop propagation — so the native click still reaches a plain
 * handler and would "clear" filters that are already clear. `mdClick` is
 * emitted only when the control is genuinely live, which leaves the guard with
 * the component instead of duplicating it here where it could drift.
 */
const clearListeners = { mdClick: clearFilters };

const paginationListeners = {
  mdPageChange(event: Event) {
    page.value = (event as CustomEvent<{ page: number }>).detail.page;
  },
  mdRowsPerPageChange(event: Event) {
    // No `page = 0` here: `md-table-pagination` has already reset the page and
    // emitted `mdPageChange`, which the handler above consumes. Resetting
    // again is that component's documented anti-pattern.
    rowsPerPage.value = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  },
};

/*
 * The blotter search state, for the `<mark>`s only — the rows are already
 * filtered. `getOrders` matches on ticker, instrument name, household name and
 * id, so those are the four cells that can be marked and no others. Marking a
 * fifth would claim the query hit something it never looked at.
 */

const headers = computed<{ key: string; label: string; numeric?: boolean }[]>(() => [
  { key: 'id', label: t.value('wealth.table.id') },
  { key: 'side', label: t.value('wealth.table.side') },
  { key: 'ticker', label: t.value('wealth.table.ticker') },
  { key: 'instrument', label: t.value('wealth.table.instrument') },
  { key: 'household', label: t.value('wealth.table.household') },
  { key: 'quantity', label: t.value('wealth.table.quantity'), numeric: true },
  { key: 'filled', label: t.value('wealth.table.filled'), numeric: true },
  { key: 'orderType', label: t.value('wealth.table.orderType') },
  { key: 'limit', label: t.value('wealth.table.limitPrice'), numeric: true },
  { key: 'tif', label: t.value('wealth.table.timeInForce') },
  { key: 'value', label: t.value('wealth.table.estimatedValue'), numeric: true },
  { key: 'status', label: t.value('wealth.table.status') },
  { key: 'created', label: t.value('wealth.table.created') },
]);
</script>

<template>
  <Panel>
    <div class="stack">
      <div class="row trade-filters">
        <!--
          `md-text-field type="search"`, not `md-search`: `md-search` owns a
          results surface of its own, and this box filters a table that is
          already on screen (§5.2).
        -->
        <md-text-field
          ref="searchEl"
          v-awc="{ on: searchListeners }"
          variant="outlined"
          type="search"
          :label="tx('wealth.trade.searchOrders')"
          clearable="internal"
        ></md-text-field>

        <md-select
          v-awc="{ on: sideListeners }"
          variant="outlined"
          :label="t('wealth.table.side')"
          :placeholder="t('wealth.common.all')"
          :value="side"
          clearable
          :clear-label="t('wealth.action.clearFilters')"
        >
          <md-select-option
            v-for="value in SIDES"
            :key="value"
            :value="value"
            :label="t(`wealth.orderSide.${value}`)"
          >{{ t(`wealth.orderSide.${value}`) }}</md-select-option>
        </md-select>

        <md-select
          v-awc="{ on: statusListeners }"
          variant="outlined"
          :label="t('wealth.table.status')"
          :placeholder="t('wealth.common.all')"
          :value="status"
          clearable
          :clear-label="t('wealth.action.clearFilters')"
        >
          <md-select-option
            v-for="value in STATUSES"
            :key="value"
            :value="value"
            :label="t(`wealth.orderStatus.${value}`)"
          >{{ t(`wealth.orderStatus.${value}`) }}</md-select-option>
        </md-select>

        <!--
          §7.2: an icon-only control and the tooltip that supplies the meaning
          its glyph lacks. The `aria-label` is still required — a tooltip is a
          description, never a name. It sits with the filters rather than in
          the table's toolbar so it survives the empty state, which is exactly
          when a reader wants it.
        -->
        <md-tooltip :text="t('wealth.action.clearFilters')">
          <md-icon-button
            v-awc="{ on: clearListeners }"
            icon="filter_alt_off"
            :aria-label="t('wealth.action.clearFilters')"
            :soft-disabled="!filtered || undefined"
          ></md-icon-button>
        </md-tooltip>
      </div>

      <EmptyState v-if="rows.length === 0" :message="t('wealth.empty.orders')" :hint="filtered" />
      <div v-else class="table-host">
        <md-table-container variant="outlined">
          <!--
            The toolbar goes in the CONTAINER's `top` slot, outside the table's
            scroll port, so it stays put while thirteen columns scroll under it.
          -->
          <md-table-toolbar
            slot="top"
            :headline="t('wealth.panel.blotter')"
            :supporting-text="
              t('wealth.common.showing', { shown: allRows.length, total: totals.orderCount })
            "
          ></md-table-toolbar>

          <!--
            A SECOND `top` child, under the toolbar. The band is a flex column,
            so the chips stack beneath the headline and stay outside the scroll
            port with it — the sticky header sticks below them, so the two never
            meet.
          -->
          <div
            slot="top"
            v-awc="{ on: facetListeners }"
            class="row facet-row"
            role="group"
            :aria-label="tx('wealth.trade.filter.group')"
          >
            <md-chip
              v-for="facet in FACETS"
              :key="facet.id"
              :data-facet="facet.id"
              variant="filter"
              :label="tx(facet.labelKey)"
              :selected="facets[facet.id]"
            ></md-chip>
          </div>

          <!--
            `md-table` ratchets its height by default so paging cannot make the
            page jump, but that baseline is measured once and never recomputed —
            a density change then strands the taller height as dead space.
            Pagination already holds the row count steady here, so live density
            switching is worth more than the ratchet.

            Without `row-offset`/`row-count`, assistive tech announces "row 1 of
            10" on every page instead of the row's position in the whole
            blotter. `row-count` takes the BODY total; the table adds the head
            and foot rows itself.
          -->
          <md-table
            :label="t('wealth.panel.blotter')"
            :column-template="TABLES.orders.columns"
            :min-width="TABLES.orders.minWidth"
            keep-height="false"
            striped
            :row-offset="safePage * rowsPerPage"
            :row-count="allRows.length"
          >
            <md-table-head>
              <md-table-row rowgroup="head">
                <md-table-cell
                  v-for="header in headers"
                  :key="header.key"
                  head
                  scope="col"
                  :numeric="header.numeric || undefined"
                >{{ header.label }}</md-table-cell>
              </md-table-row>
            </md-table-head>

            <md-table-body>
              <md-table-row v-for="order in rows" :key="order.id" :value="order.id">
                <md-table-cell>
                  <Highlight :text="order.id" :query="search" />
                </md-table-cell>
                <md-table-cell>
                  <OrderSideChip :side="order.side" />
                </md-table-cell>
                <md-table-cell>
                  <Highlight :text="order.ticker" :query="search" />
                </md-table-cell>
                <md-table-cell>
                  <Highlight :text="order.instrumentName" :query="search" />
                </md-table-cell>
                <md-table-cell>
                  <Drill :to="route.household(order.householdId)">
                    <Highlight :text="order.householdName" :query="search" />
                  </Drill>
                </md-table-cell>
                <md-table-cell numeric>
                  <Num :value="order.quantity" />
                </md-table-cell>
                <md-table-cell numeric>
                  <Num :value="order.filledQuantity" />
                </md-table-cell>
                <md-table-cell>{{ t(order.orderTypeKey) }}</md-table-cell>
                <md-table-cell numeric>
                  <span v-if="order.limitPrice === null" class="muted">
                    {{ t('wealth.common.na') }}
                  </span>
                  <Money v-else :value="order.limitPrice" :currency="order.currency" :digits="2" />
                </md-table-cell>
                <md-table-cell>{{ t(order.timeInForceKey) }}</md-table-cell>
                <!--
                  THE CURRENCY TRAP. `estimatedValue` is in the security's own
                  currency and `estimatedValueEur` is the converted twin. This
                  column compares orders across the book, so the EUR figure leads
                  and the local one sits under it — the other way round would
                  quietly report a CHF ticket as if it were euros.
                -->
                <md-table-cell numeric>
                  <Money :value="order.estimatedValueEur" compact />
                  <template v-if="order.currency !== 'EUR'">
                    <br />
                    <span
                      class="muted num"
                      style="font: var(--md-sys-typescale-label-small-font)"
                    >{{
                      t.formatCurrency(order.estimatedValue, {
                        currency: order.currency,
                        notation: 'compact',
                      })
                    }}</span>
                  </template>
                </md-table-cell>
                <md-table-cell>
                  <OrderStatusChip :status="order.status" />
                </md-table-cell>
                <md-table-cell>
                  <DateText :value="order.createdDate" date-style="short" />
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
            :label-rows-per-page="t('wealth.table.rowsPerPage')"
            :label-displayed-rows="t('wealth.table.displayedRows')"
            :label-first-page="t('wealth.table.firstPage')"
            :label-previous-page="t('wealth.table.previousPage')"
            :label-next-page="t('wealth.table.nextPage')"
            :label-last-page="t('wealth.table.lastPage')"
            :label-all="t('wealth.table.all')"
          ></md-table-pagination>
        </md-table-container>
      </div>
    </div>
  </Panel>
</template>
