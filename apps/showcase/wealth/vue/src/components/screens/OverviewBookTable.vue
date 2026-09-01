<!--
  The advisor's book, as a filtered, sortable table.

  Belongs to the overview screen and to nothing else: a household screen shows
  ONE household, so there is no second caller to generalise for.

  THE TABLE SORTS NOTHING. `md-table`'s `sort-by` / `sort-order` are display
  state and `mdSortChange` is a REQUEST — the handler pushes it into a ref and
  the rows are re-read through `getHouseholds()`, whose filter takes the same
  six sort keys the header offers. The comparator therefore lives in the kit,
  beside the data, and a second port cannot disagree with this one about what
  "sorted by next review" means. The same is true of the two filters: `search`
  and `segment` go into the selector, never into a `.filter()` over its result.

  COMPOSITION. `md-table-container` WRAPS `md-table` (§7.1) and carries the
  toolbar in its `top` slot, outside the scroll region, so the filters stay put
  while the rows scroll. There is no pagination: eight households fit, and a
  pagination bar reading "1–8 of 8" tells the reader nothing.

  DRILLING is the household name, which is a real anchor (`<Drill>`), not a
  `clickable` row: it is reachable by Tab, it has a URL you can copy, and it
  does not put a second activation target around the cells.

  EVERY `md*` EVENT GOES THROUGH `v-awc`: Vue's `@mdSortChange` compiles to a
  listener for `md-sort-change`, an event the library never emits, and fails
  silently — see `lib/awc.ts`.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  getHouseholds,
  TABLES,
  type Household,
  type HouseholdSortKey,
  type Segment,
} from '@awc-ui/showcase-kit/wealth';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import Drill from '~/components/Drill.vue';
import EmptyState from '~/components/EmptyState.vue';
import DateText from '~/components/bits/DateText.vue';
import Highlight from '~/components/bits/Highlight.vue';
import KycDot from '~/components/bits/KycDot.vue';
import MandateChip from '~/components/bits/MandateChip.vue';
import Money from '~/components/bits/Money.vue';
import NameCell from '~/components/bits/NameCell.vue';
import Num from '~/components/bits/Num.vue';
import SegmentChip from '~/components/bits/SegmentChip.vue';
import Signed from '~/components/bits/Signed.vue';
import StrategyChip from '~/components/bits/StrategyChip.vue';

interface SortState {
  column: HouseholdSortKey;
  order: 'asc' | 'desc';
}

/** Largest book first — the same default `getHouseholds()` applies with no filter. */
const DEFAULT_SORT: SortState = { column: 'totalAum', order: 'desc' };

/** Which columns want `desc` on their first click: the ones where big is the news. */
const NUMERIC_KEYS: HouseholdSortKey[] = ['totalAum', 'ytdReturn', 'unrealisedPl', 'memberCount'];

const t = useT();
const layout = TABLES.households(false);

const sort = ref<SortState>(DEFAULT_SORT);
const search = ref('');
const segment = ref<Segment | ''>('');

/*
 * The three-state cycle ends in `none`, where the table clears its own
 * `sort-by` and reports an empty column. That is "no sort chosen", not "no
 * order at all" — the selector always returns something — so it falls back to
 * the same default the unfiltered book has.
 */
const tableListeners = {
  mdSortChange(event: Event) {
    const { column, order } = (
      event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>
    ).detail;
    if (!column || order === 'none') {
      sort.value = DEFAULT_SORT;
      return;
    }
    sort.value = { column: column as HouseholdSortKey, order };
  },
};

// `mdInput` rather than `mdChange`: the field commits on blur, and a filter
// that only applies when you leave it feels broken. The field is left
// UNCONTROLLED — no `value` binding — so nothing ever writes back into an
// input the user is typing in; `clearable="internal"` gives it its own ✕,
// which empties the field and emits `mdInput` with an empty string, landing
// here like any other keystroke.
const searchListeners = {
  mdInput(event: Event) {
    search.value = (event as CustomEvent<string>).detail ?? '';
  },
};

const segmentListeners = {
  mdChange(event: Event) {
    segment.value = ((event as CustomEvent<string>).detail ?? '') as Segment | '';
  },
};

const rows = computed<Household[]>(() =>
  getHouseholds({
    sortBy: sort.value.column,
    sortDir: sort.value.order,
    search: search.value.trim() || undefined,
    segment: segment.value || undefined,
  }),
);

/*
 * The facets the book actually contains, not every value the type allows.
 *
 * Offering a segment no household is in gives the reader a filter that can
 * only ever empty the table. Sorted by the raw value so two framework builds
 * list them in the same order regardless of how the fixture happens to be
 * ordered. (The kit would be a better home for this list — see the note in
 * the hand-off.)
 */
const segments: Segment[] = [...new Set(getHouseholds().map((household) => household.segment))].sort();

const total = getHouseholds().length;
const filtered = computed(() => search.value.trim() !== '' || segment.value !== '');

const columns = computed<{ key: HouseholdSortKey | null; label: string; numeric?: boolean }[]>(
  () => [
    { key: 'name', label: t.value('wealth.table.household') },
    { key: null, label: t.value('wealth.table.segment') },
    { key: null, label: t.value('wealth.table.mandate') },
    { key: null, label: t.value('wealth.table.strategy') },
    { key: 'totalAum', label: t.value('wealth.table.aum'), numeric: true },
    { key: 'ytdReturn', label: t.value('wealth.table.ytd'), numeric: true },
    { key: 'unrealisedPl', label: t.value('wealth.table.unrealisedPl'), numeric: true },
    { key: 'memberCount', label: t.value('wealth.table.members'), numeric: true },
    { key: 'nextReviewDate', label: t.value('wealth.table.nextReview') },
  ],
);
</script>

<template>
  <div class="table-host">
    <md-table-container variant="outlined">
      <md-table-toolbar
        slot="top"
        :headline="t('wealth.panel.book')"
        :supporting-text="t('wealth.common.showing', { shown: rows.length, total })"
      ></md-table-toolbar>

      <!--
        THE FILTERS ARE A SECOND `top` CHILD, not the toolbar's `actions` slot,
        and that was measured rather than guessed.

        `md-table-toolbar` lays its band out as one non-wrapping row whose
        actions container is `flex: 0 0 auto` — sized for the icon buttons its
        manual shows. Two form fields are ~440px of intrinsic width, so at
        420px the band overflowed and the fields were drawn straight over the
        headline. The container's `top` part is a flex COLUMN, so a second
        child stacks under the toolbar, stays outside the scroll region with
        it, and wraps on its own at narrow widths.

        Both controls keep their own tab stop, which is what a form control
        should have — they never join a roving group.
      -->
      <div
        slot="top"
        class="row row--end"
        :style="{
          paddingInline: 'var(--md-sys-spacing-inset-xl, 24px)',
          paddingBlockEnd: 'var(--md-sys-spacing-inset-md, 12px)',
        }"
      >
        <!-- `clearable` is spelled out rather than bare. It is a three-way
             enum, and the bare form only reads as "internal" when it arrives
             as an ATTRIBUTE — which a framework binding does not guarantee
             after upgrade. -->
        <md-text-field
          v-awc="{ on: searchListeners }"
          variant="outlined"
          type="search"
          clearable="internal"
          :label="t('wealth.action.searchHouseholds')"
          density="-2"
          :style="{ flex: '1 1 200px', maxInlineSize: '300px' }"
        ></md-text-field>
        <md-select
          v-awc="{ on: segmentListeners }"
          variant="outlined"
          clearable
          full-width
          :label="t('wealth.table.segment')"
          :value="segment"
          density="-2"
          :clear-label="t('wealth.action.clearFilters')"
          :style="{ flex: '0 1 200px', maxInlineSize: '240px' }"
        >
          <md-select-option v-for="value in segments" :key="value" :value="value">
            {{ t(`wealth.segment.${value}`) }}
          </md-select-option>
        </md-select>
      </div>

      <!-- The ratchet is measured once and never recomputed, so filtering
           down to two rows would leave the height of eight behind it —
           `keep-height="false"`. -->
      <md-table
        v-awc="{ on: tableListeners }"
        :label="t('wealth.panel.book')"
        :column-template="layout.columns"
        :min-width="layout.minWidth"
        keep-height="false"
        striped
        :sort-by="sort.column"
        :sort-order="sort.order"
        :empty="rows.length === 0 || undefined"
        :row-count="rows.length"
      >
        <md-table-head>
          <!-- No `active` / `order` on the labels: `md-table` declares the sort
               above and pushes both down into every label itself, so anything
               written here could only ever disagree with it. -->
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
              >{{ column.label }}</md-table-sort-label>
              <template v-else>{{ column.label }}</template>
            </md-table-cell>
          </md-table-row>
        </md-table-head>

        <md-table-body>
          <md-table-row v-for="household in rows" :key="household.id" :value="household.id">
            <md-table-cell>
              <NameCell>
                <template #dot><KycDot :status="household.kycStatus" /></template>
                <!-- The name is the only searched field this table shows —
                     `getHouseholds` also matches on `id`, which no column
                     renders, so marking anything else would claim a hit on
                     something the reader cannot see. -->
                <Drill :to="route.household(household.id)">
                  <Highlight :text="household.name" :query="search" />
                </Drill>
              </NameCell>
            </md-table-cell>
            <md-table-cell>
              <SegmentChip :segment="household.segment" />
            </md-table-cell>
            <md-table-cell>
              <MandateChip :mandate="household.mandate" />
            </md-table-cell>
            <md-table-cell>
              <StrategyChip :strategy="household.strategy" />
            </md-table-cell>
            <md-table-cell numeric>
              <Money :value="household.totalAum" compact />
            </md-table-cell>
            <md-table-cell numeric>
              <Signed :value="household.ytdReturn" kind="percent" />
            </md-table-cell>
            <md-table-cell numeric>
              <Signed :value="household.unrealisedPl" compact />
            </md-table-cell>
            <md-table-cell numeric>
              <Num :value="household.memberCount" />
            </md-table-cell>
            <md-table-cell>
              <DateText :value="household.nextReviewDate" />
            </md-table-cell>
          </md-table-row>
        </md-table-body>

        <!--
          The empty state stays INSIDE the container rather than replacing it.
          Emptiness here is always the reader's own filter, and swapping the
          table out would take the search field and the segment select away
          with it — leaving no way to undo what caused it.
        -->
        <div v-if="rows.length === 0" slot="empty">
          <EmptyState
            :message="
              search.trim()
                ? t('wealth.empty.search', { query: search.trim() })
                : t('wealth.empty.households')
            "
            :hint="filtered"
          />
        </div>
      </md-table>
    </md-table-container>
  </div>
</template>
