<!--
  Screen 4 — advice documents moving through review.

  Three panels, in the order an advisor works in them:

    1. THE BUILDER — `md-stepper` driving a four-step advice document. It lives
       in `ProposalBuilder.vue` / `ProposalForm.vue`, which carry the reasoning
       for every control choice and for why the stepper is NOT inside a dialog.
    2. THE BOOK — every proposal the fixture holds, filtered through the kit's
       selector, sorted and paged here, in `md-table-container` wrapping
       `md-table` with the toolbar in `top` and the pagination in `bottom`
       (§7.1). Clicking a row picks it up in panel 3.
    3. THE TRAIL — the five stages that proposal has moved through, as a
       read-only `md-stepper` whose step states come from the kit's `stepState`
       map, never from a ternary here (`ProposalReviewTrail.vue`).

  WHERE THE SORTING LIVES, AND WHY IT IS HERE. Every other list selector takes
  a `sortBy` / `sortDir`; `ProposalFilter` does not, so the ordering cannot be
  pushed into the kit and two framework ports would have to agree by hand. It
  is isolated in `compareProposals` below and flagged in the hand-off notes.
  The FILTERING goes through `getProposals` exactly as the contract requires —
  no `.filter()` on a selector's result anywhere in this file.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getAdvisor,
  getBookTotals,
  getProposals,
  PROPOSAL_AGEING_DAYS,
  PROPOSAL_HIGH_VALUE_EUR,
  TABLES,
  type Proposal,
  type ProposalStatus,
} from '@awc-ui/showcase-kit/wealth';
import { crumbsFor } from '~/lib/routes';
import { usePathname } from '~/lib/router';
import { useCopy } from './proposal-copy';
import ProposalBuilder from './ProposalBuilder.vue';
import ProposalReviewTrail from './ProposalReviewTrail.vue';
import ProposalsSkeleton from './ProposalsSkeleton.vue';
import EmptyState from '~/components/EmptyState.vue';
import Panel from '~/components/Panel.vue';
import Screen from '~/components/Screen.vue';
import Count from '~/components/bits/Count.vue';
import DateText from '~/components/bits/DateText.vue';
import KpiTile from '~/components/bits/KpiTile.vue';
import Money from '~/components/bits/Money.vue';
import Num from '~/components/bits/Num.vue';
import ProposalStatusChip from '~/components/bits/ProposalStatusChip.vue';
import ProposalTypeChip from '~/components/bits/ProposalTypeChip.vue';

/* --------------------------------------------------------------- ordering */

/** The four columns this table can be ordered by. */
type SortKey = 'householdName' | 'estimatedValue' | 'createdDate' | 'daysOpen';
type SortOrder = 'asc' | 'desc' | 'none';

const SORTABLE: Record<SortKey, true> = {
  householdName: true,
  estimatedValue: true,
  createdDate: true,
  daysOpen: true,
};

/**
 * The comparator the kit does not have.
 *
 * `localeCompare` is pinned to `'en'` on purpose — the same thing the kit's
 * own selectors do. An ambient locale would make the row order depend on the
 * machine, and the whole point of this fixture is that two runs agree.
 */
function compareProposals(a: Proposal, b: Proposal, key: SortKey): number {
  switch (key) {
    case 'householdName':
      return a.householdName.localeCompare(b.householdName, 'en');
    case 'estimatedValue':
      return a.estimatedValue - b.estimatedValue;
    case 'daysOpen':
      return a.daysOpen - b.daysOpen;
    case 'createdDate':
    default:
      return a.createdDate.localeCompare(b.createdDate, 'en');
  }
}

const STATUS_FILTERS: ProposalStatus[] = [
  'draft',
  'in-review',
  'compliance',
  'client-review',
  'approved',
  'rejected',
];

/**
 * The facets, as data — one list read by four consumers.
 *
 * The chip row, the delegated handler, `filtersActive` and the clear action
 * all derive from this, so a facet cannot be added to the row and forgotten in
 * the reset. Each `id` is also the chip's `data-facet`, which is how one
 * listener serves the whole set.
 *
 * WHY THESE FOUR. Each sits on a DIFFERENT axis — lifecycle, ownership, age,
 * size — and each splits a seven-row book into a useful subset. The obvious
 * fifth candidate, a "needs review" status group, is deliberately absent: it
 * would compete with the Status select for the same axis, and picking one
 * status plus a conflicting group is a guaranteed empty table that reads as a
 * bug.
 */
const FACETS = [
  { id: 'open', labelKey: 'wealth.proposal.filter.openOnly' },
  { id: 'mine', labelKey: 'wealth.proposal.filter.mine' },
  { id: 'ageing', labelKey: 'wealth.proposal.filter.ageing' },
  { id: 'highValue', labelKey: 'wealth.proposal.filter.highValue' },
] as const;

type FacetId = (typeof FACETS)[number]['id'];
type FacetState = Record<FacetId, boolean>;

const NO_FACETS: FacetState = { open: false, mine: false, ageing: false, highValue: false };

const ROWS_PER_PAGE_OPTIONS = '5,10,25';
const DEFAULT_ROWS_PER_PAGE = 5;

/* ----------------------------------------------------------------- screen */

const c = useCopy();
const pathname = usePathname();
const crumbs = computed(() => crumbsFor(pathname.value));

const totals = getBookTotals();
const everyProposal = getProposals();
const open = getProposals({ open: true });
// Pre-existing shape of the KPI row: the fixture has no book-level proposal
// aggregate, so these three are summed here. Listed in the hand-off notes.
const openValue = open.reduce((sum, proposal) => sum + proposal.estimatedValue, 0);
const oldest = open.reduce((max, proposal) => Math.max(max, proposal.daysOpen), 0);
const openHouseholds = new Set(open.map((proposal) => proposal.householdId)).size;

/* --------------------------------------------------------- table state */

const status = ref<ProposalStatus | ''>('');
const facets = ref<FacetState>({ ...NO_FACETS });
const sortBy = ref<SortKey | ''>('');
const sortOrder = ref<SortOrder>('asc');
const page = ref(0);
const rowsPerPage = ref(DEFAULT_ROWS_PER_PAGE);
const selectedId = ref('');

const filtersActive = computed(
  () => status.value !== '' || FACETS.some((facet) => facets.value[facet.id]),
);

/*
 * FILTER through the selector, then order, then slice.
 *
 * `getProposals` returns a fresh array, so sorting it in place is safe and no
 * copy is needed. Its default order is the one the kit calls attention-first,
 * which is what an unsorted table should show — so `sortBy === ''` leaves it
 * exactly as the selector handed it over.
 */
const rows = computed(() => {
  const filtered = getProposals({
    status: status.value === '' ? undefined : status.value,
    // Every facet is a FIELD ON THE FILTER, never a `.filter()` on the result —
    // the contract at the top of this file. The two that had no field
    // (`minDaysOpen`, `minEstimatedValue`) grew one in the kit rather than
    // being applied here; a threshold is the book's opinion, not a view's.
    open: facets.value.open ? true : undefined,
    advisorId: facets.value.mine ? getAdvisor().id : undefined,
    minDaysOpen: facets.value.ageing ? PROPOSAL_AGEING_DAYS : undefined,
    minEstimatedValue: facets.value.highValue ? PROPOSAL_HIGH_VALUE_EUR : undefined,
  });
  if (sortBy.value === '' || sortOrder.value === 'none') return filtered;
  const direction = sortOrder.value === 'desc' ? -1 : 1;
  const key = sortBy.value;
  return filtered.sort((a, b) => direction * compareProposals(a, b, key));
});

const offset = computed(() => page.value * rowsPerPage.value);
const pageRows = computed(() => rows.value.slice(offset.value, offset.value + rowsPerPage.value));

const selected = computed(() =>
  selectedId.value ? everyProposal.find((p) => p.id === selectedId.value) : undefined,
);

/* ------------------------------------------------------- table events */

/*
 * `md-table` sorts nothing by itself — `mdSortChange` is a REQUEST and the
 * rows are ours to reorder. The table has already cycled its own three-state
 * `sort-by` / `sort-order` and pushed them into every sort label by the time
 * this fires, so all that is left is to mirror them into state.
 *
 * The readme asks for a SYNCHRONOUS reorder so its FLIP animation has
 * something to measure; Vue commits on the next microtask, so the reorder
 * motion is a no-op here — the same trade the React source records. The sort
 * itself is unaffected.
 */
const tableListeners = {
  mdSortChange(event: Event) {
    const detail = (event as CustomEvent<{ column: string; order: SortOrder }>).detail;
    const column = detail.column as SortKey | '';
    if (column === '' || detail.order === 'none' || !(column in SORTABLE)) {
      sortBy.value = '';
      sortOrder.value = 'asc';
    } else {
      sortBy.value = column;
      sortOrder.value = detail.order;
    }
    page.value = 0;
  },
  mdRowClick(event: Event) {
    selectedId.value = (event as CustomEvent<{ value: string }>).detail.value;
  },
};

const paginationListeners = {
  mdPageChange(event: Event) {
    page.value = (event as CustomEvent<{ page: number }>).detail.page;
  },
  // The component resets `page` to 0 itself and emits both events in order, so
  // this handler must not reset it a second time.
  mdRowsPerPageChange(event: Event) {
    rowsPerPage.value = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  },
};

/* ------------------------------------------------------ toolbar events */

const statusListeners = {
  mdChange(event: Event) {
    status.value = (event as CustomEvent<string>).detail as ProposalStatus | '';
    page.value = 0;
  },
};

/*
 * ONE listener for the whole set, not one per chip.
 *
 * `mdSelect` bubbles and is composed, and a composed event retargets to the
 * shadow HOST — so `event.target` is the `md-chip` and its `data-facet` can be
 * read straight off it. The chip has already flipped its own `selected` by the
 * time this runs; all that is left is to mirror it into state.
 */
const facetListeners = {
  mdSelect(event: Event) {
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.facet as FacetId | undefined;
    if (!id) return;
    facets.value = {
      ...facets.value,
      [id]: (event as CustomEvent<{ selected: boolean }>).detail.selected,
    };
    page.value = 0;
  },
};

const clearListeners = {
  mdClick() {
    if (!filtersActive.value) return;
    status.value = '';
    facets.value = { ...NO_FACETS };
    page.value = 0;
  },
};

const layout = TABLES.proposals;
</script>

<template>
  <Screen
    :crumbs="crumbs"
    :title="c('wealth.screen.proposals.title')"
    :subtitle="
      c('wealth.screen.proposals.subtitle', {
        open: totals.openProposalCount,
        total: totals.proposalCount,
      })
    "
  >
    <template #skeleton>
      <ProposalsSkeleton :label="c('wealth.screen.proposals.title')" />
    </template>

    <!--
      One screen-level action, and it is a real one.

      §9.2's exact recommendation for a contextually-unavailable control:
      `soft-disabled` keeps it focusable and announced — so a keyboard user can
      find out WHY it is off — and the tooltip supplies the why. `disabled`
      would drop it out of the tab order and take the explanation with it. The
      tooltip wraps its trigger; it never points at one by id (§7.1).
    -->
    <template #actions>
      <md-tooltip
        :text="
          filtersActive
            ? c('wealth.proposal.filter.clearHint')
            : c('wealth.proposal.filter.noneActive')
        "
        position="bottom"
      >
        <md-button
          v-awc="{ on: clearListeners }"
          variant="text"
          size="sm"
          icon="filter_alt_off"
          :soft-disabled="!filtersActive"
        >
          {{ c('wealth.action.clearFilters') }}
        </md-button>
      </md-tooltip>
    </template>

    <section class="kpi-grid">
      <KpiTile
        :label="c('wealth.kpi.openProposals')"
        :value="String(open.length)"
        :hint="c('wealth.kpi.proposals')"
      >
        <template #trailing>
          <Count :value="everyProposal.length" />
        </template>
      </KpiTile>
      <KpiTile :label="c('wealth.table.estimatedValue')" value="" :hint="c('wealth.common.total')">
        <template #value>
          <Money :value="openValue" compact />
        </template>
      </KpiTile>
      <KpiTile
        :label="c('wealth.table.daysOpen')"
        value=""
        :hint="c('wealth.common.more', { count: open.length })"
      >
        <template #value>
          <Num :value="oldest" />
        </template>
      </KpiTile>
      <KpiTile
        :label="c('wealth.kpi.households')"
        :value="String(openHouseholds)"
        :hint="c('wealth.kpi.openProposals')"
      />
    </section>

    <ProposalBuilder />

    <Panel :title="c('wealth.proposal.table.title')" :subtitle="c('wealth.proposal.table.hint')">
      <template #actions>
        <Count :value="rows.length" />
      </template>

      <div class="table-host">
        <!--
          `md-table-container` WRAPS `md-table` — the toolbar goes in its `top`
          slot and the pagination in its `bottom` slot, both OUTSIDE the scroll
          region, and neither ever goes inside the table (§7.1). The container
          is also what arms the table's row motion for a page change, which is
          why the pagination is slotted here rather than placed beside the
          container.
        -->
        <md-table-container variant="outlined" max-height="60vh">
          <md-table-toolbar
            slot="top"
            :headline="c('wealth.proposal.table.title')"
            :supporting-text="c('wealth.proposal.table.hint')"
          >
            <md-select
              v-awc="{ on: statusListeners }"
              slot="actions"
              variant="outlined"
              density="-2"
              :label="c('wealth.proposal.filter.status')"
              :value="status"
              :placeholder="c('wealth.proposal.filter.anyStatus')"
              clearable
              :clear-label="c('wealth.proposal.filter.anyStatus')"
              :no-options-text="c('wealth.empty.proposals')"
            >
              <md-select-option
                v-for="option in STATUS_FILTERS"
                :key="option"
                :value="option"
                :label="c(`wealth.proposalStatus.${option}`)"
              ></md-select-option>
            </md-select>
          </md-table-toolbar>

          <!--
            THE FACET SET IS A SECOND `top` CHILD, not one more thing in the
            toolbar's `actions` slot. `md-table-toolbar` is a single
            non-wrapping flex row; the container's `top` part is a flex COLUMN,
            so this stacks under the toolbar, stays outside the scroll viewport
            with it, and wraps on its own line when the panel is narrow.

            `role="group"` + `aria-label` is md-chip's own Filter-sets
            contract: four chips are a set, and a set needs a name. The chips
            stay non-removable so each host keeps `role="button"` +
            `aria-pressed` — a remove button would step the host down to its
            own nested `group` and lose the selection state a filter set is
            entirely about.
          -->
          <div
            v-awc="{ on: facetListeners }"
            slot="top"
            class="row facet-row"
            role="group"
            :aria-label="c('wealth.proposal.filter.group')"
          >
            <md-chip
              v-for="facet in FACETS"
              :key="facet.id"
              :data-facet="facet.id"
              variant="filter"
              appearance="outlined"
              :label="c(facet.labelKey)"
              :selected="facets[facet.id]"
            ></md-chip>
          </div>

          <md-table
            v-awc="{ on: tableListeners }"
            :column-template="layout.columns"
            :min-width="layout.minWidth"
            :label="c('wealth.proposal.table.label')"
            sticky-header
            hoverable
            :sort-by="sortBy"
            :sort-order="sortOrder"
            :empty="pageRows.length === 0"
            :row-offset="offset"
            :row-count="rows.length"
          >
            <md-table-head>
              <md-table-row rowgroup="head">
                <md-table-cell head scope="col">
                  {{ c('wealth.table.id') }}
                </md-table-cell>
                <md-table-cell head scope="col">
                  <md-table-sort-label column="householdName">
                    {{ c('wealth.table.household') }}
                  </md-table-sort-label>
                </md-table-cell>
                <md-table-cell head scope="col">
                  {{ c('wealth.table.type') }}
                </md-table-cell>
                <md-table-cell head scope="col">
                  {{ c('wealth.table.status') }}
                </md-table-cell>
                <md-table-cell head scope="col">
                  {{ c('wealth.table.progress') }}
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  <md-table-sort-label column="estimatedValue" default-order="desc">
                    {{ c('wealth.table.estimatedValue') }}
                  </md-table-sort-label>
                </md-table-cell>
                <md-table-cell head scope="col">
                  <md-table-sort-label column="createdDate" default-order="desc">
                    {{ c('wealth.table.created') }}
                  </md-table-sort-label>
                </md-table-cell>
                <md-table-cell head scope="col" numeric>
                  <md-table-sort-label column="daysOpen" default-order="desc">
                    {{ c('wealth.table.daysOpen') }}
                  </md-table-sort-label>
                </md-table-cell>
                <md-table-cell head scope="col">
                  {{ c('wealth.table.advisor') }}
                </md-table-cell>
              </md-table-row>
            </md-table-head>

            <md-table-body>
              <md-table-row
                v-for="proposal in pageRows"
                :key="proposal.id"
                :value="proposal.id"
                clickable
                :highlight="proposal.id === selectedId"
              >
                <md-table-cell>{{ proposal.id }}</md-table-cell>
                <md-table-cell ellipsis>{{ proposal.householdName }}</md-table-cell>
                <md-table-cell>
                  <ProposalTypeChip :type="proposal.type" />
                </md-table-cell>
                <md-table-cell>
                  <ProposalStatusChip :status="proposal.status" />
                </md-table-cell>
                <md-table-cell>
                  <!-- Two facts, no arithmetic: how many stages are done, and
                       the name of the one it is sitting in. -->
                  <span class="with-dot">
                    <span>
                      {{
                        c('wealth.common.of', {
                          count: proposal.completedStepCount,
                          total: proposal.stepCount,
                        })
                      }}
                    </span>
                    <span class="muted">
                      {{
                        c('wealth.proposal.currentStep', {
                          name: c(proposal.steps[proposal.currentStepIndex].nameKey),
                        })
                      }}
                    </span>
                  </span>
                </md-table-cell>
                <md-table-cell numeric>
                  <Money :value="proposal.estimatedValue" />
                </md-table-cell>
                <md-table-cell>
                  <DateText :value="proposal.createdDate" />
                </md-table-cell>
                <md-table-cell numeric>
                  <Num :value="proposal.daysOpen" />
                </md-table-cell>
                <md-table-cell ellipsis>{{ proposal.advisorName }}</md-table-cell>
              </md-table-row>
            </md-table-body>

            <div slot="empty">
              <EmptyState :message="c('wealth.empty.proposals')" :hint="filtersActive" />
            </div>
          </md-table>

          <md-table-pagination
            v-awc="{ on: paginationListeners }"
            slot="bottom"
            :count="rows.length"
            :page="page"
            :rows-per-page="rowsPerPage"
            :rows-per-page-options="ROWS_PER_PAGE_OPTIONS"
            show-first-last
            :label-rows-per-page="c('wealth.table.rowsPerPage')"
            :label-displayed-rows="c('wealth.table.displayedRows')"
            :label-first-page="c('wealth.table.firstPage')"
            :label-previous-page="c('wealth.table.previousPage')"
            :label-next-page="c('wealth.table.nextPage')"
            :label-last-page="c('wealth.table.lastPage')"
            :label-all="c('wealth.table.all')"
          ></md-table-pagination>
        </md-table-container>
      </div>
    </Panel>

    <ProposalReviewTrail :proposal="selected" />
  </Screen>
</template>
