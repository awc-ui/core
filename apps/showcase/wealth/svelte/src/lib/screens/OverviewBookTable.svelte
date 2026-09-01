<!--
  The advisor's book, as a filtered, sortable table.

  Belongs to the overview screen and to nothing else: a household screen shows
  ONE household, so there is no second caller to generalise for.

  THE TABLE SORTS NOTHING. `md-table`'s `sort-by` / `sort-order` are display
  state and `mdSortChange` is a REQUEST — the handler pushes it into component
  state and the rows are re-read through `getHouseholds()`, whose filter takes
  the same six sort keys the header offers. The comparator therefore lives in
  the kit, beside the data, and a second port cannot disagree with this one
  about what "sorted by next review" means. The same is true of the two
  filters: `search` and `segment` go into the selector, never into a
  `.filter()` over its result.

  COMPOSITION. `md-table-container` WRAPS `md-table` and carries the toolbar
  in its `top` slot, outside the scroll region, so the filters stay put while
  the rows scroll. There is no pagination: eight households fit, and a
  pagination bar reading "1–8 of 8" tells the reader nothing.

  DRILLING is the household name, which is a real anchor (`<Drill>`), not a
  `clickable` row: it is reachable by Tab, it has a URL you can copy, and it
  does not put a second activation target around the cells.
-->
<script lang="ts">
  import {
    getHouseholds,
    TABLES,
    type HouseholdSortKey,
    type Segment,
  } from '@awc-ui/showcase-kit/wealth';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Drill from '$lib/components/Drill.svelte';
  import Chip from '$lib/bits/Chips.svelte';
  import Dot from '$lib/bits/Dots.svelte';
  import Highlight from '$lib/bits/Highlight.svelte';
  import NameCell from '$lib/bits/NameCell.svelte';
  import Num from '$lib/bits/Num.svelte';
  import DateText from '$lib/bits/DateText.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Signed from '$lib/bits/Signed.svelte';

  interface SortState {
    column: HouseholdSortKey;
    order: 'asc' | 'desc';
  }

  /** Largest book first — the same default `getHouseholds()` applies with no filter. */
  const DEFAULT_SORT: SortState = { column: 'totalAum', order: 'desc' };

  /** Which columns want `desc` on their first click: the ones where big is the news. */
  const NUMERIC_KEYS: HouseholdSortKey[] = ['totalAum', 'ytdReturn', 'unrealisedPl', 'memberCount'];

  const layout = TABLES.households(false);

  let sort: SortState = DEFAULT_SORT;
  let search = '';
  let segment: Segment | '' = '';

  /*
   * The three-state cycle ends in `none`, where the table clears its own
   * `sort-by` and reports an empty column. That is "no sort chosen", not "no
   * order at all" — the selector always returns something — so it falls back
   * to the same default the unfiltered book has.
   */
  function onSortChange(event: Event) {
    const { column, order } = (
      event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>
    ).detail;
    if (!column || order === 'none') {
      sort = DEFAULT_SORT;
      return;
    }
    sort = { column: column as HouseholdSortKey, order };
  }

  // `mdInput` rather than `mdChange`: the field commits on blur, and a filter
  // that only applies when you leave it feels broken. The field is left
  // UNCONTROLLED — no `value` attribute is ever written back into an input
  // the user is typing in; `clearable="internal"` gives it its own ✕, which
  // empties the field and emits `mdInput` with an empty string, landing here
  // like any other keystroke.
  function onSearchInput(event: Event) {
    search = (event as CustomEvent<string>).detail ?? '';
  }

  function onSegmentChange(event: Event) {
    segment = ((event as CustomEvent<string>).detail ?? '') as Segment | '';
  }

  $: rows = getHouseholds({
    sortBy: sort.column,
    sortDir: sort.order,
    search: search.trim() || undefined,
    segment: segment || undefined,
  });

  /*
   * The facets the book actually contains, not every value the type allows.
   * Offering a segment no household is in gives the reader a filter that can
   * only ever empty the table. Sorted by the raw value so two framework
   * builds list them in the same order regardless of how the fixture happens
   * to be ordered. (The kit would be a better home for this list — see the
   * note in the hand-off.)
   */
  const segments: Segment[] = [...new Set(getHouseholds().map((household) => household.segment))].sort();

  const total = getHouseholds().length;
  $: filtered = search.trim() !== '' || segment !== '';

  $: columns = [
    { key: 'name', label: $t('wealth.table.household') },
    { key: null, label: $t('wealth.table.segment') },
    { key: null, label: $t('wealth.table.mandate') },
    { key: null, label: $t('wealth.table.strategy') },
    { key: 'totalAum', label: $t('wealth.table.aum'), numeric: true },
    { key: 'ytdReturn', label: $t('wealth.table.ytd'), numeric: true },
    { key: 'unrealisedPl', label: $t('wealth.table.unrealisedPl'), numeric: true },
    { key: 'memberCount', label: $t('wealth.table.members'), numeric: true },
    { key: 'nextReviewDate', label: $t('wealth.table.nextReview') },
  ] as { key: HouseholdSortKey | null; label: string; numeric?: boolean }[];
</script>

<div class="table-host">
  <md-table-container variant="outlined">
    <md-table-toolbar
      slot="top"
      headline={$t('wealth.panel.book')}
      supporting-text={$t('wealth.common.showing', { shown: rows.length, total })}
    ></md-table-toolbar>

    <!--
      THE FILTERS ARE A SECOND `top` CHILD, not the toolbar's `actions` slot,
      and that was measured rather than guessed: `md-table-toolbar` lays its
      band out as one non-wrapping row whose actions container is
      `flex: 0 0 auto` — sized for icon buttons. Two form fields are ~440px of
      intrinsic width, so at 420px the band overflowed and the fields were
      drawn straight over the headline. The container's `top` part is a flex
      COLUMN, so a second child stacks under the toolbar, stays outside the
      scroll region with it, and wraps on its own at narrow widths.

      Both controls keep their own tab stop, which is what a form control
      should have — they never join a roving group.
    -->
    <div
      slot="top"
      class="row row--end"
      style="padding-inline: var(--md-sys-spacing-inset-xl, 24px); padding-block-end: var(--md-sys-spacing-inset-md, 12px)"
    >
      <!-- `clearable` spelled out rather than bare: it is a three-way enum,
           and the bare form only reads as "internal" when it arrives as an
           ATTRIBUTE — which it never does from a framework binding. -->
      <md-text-field
        on:mdInput={onSearchInput}
        variant="outlined"
        type="search"
        clearable="internal"
        label={$t('wealth.action.searchHouseholds')}
        density="-2"
        style="flex: 1 1 200px; max-inline-size: 300px"
      ></md-text-field>
      <md-select
        on:mdChange={onSegmentChange}
        variant="outlined"
        clearable
        full-width
        label={$t('wealth.table.segment')}
        value={segment}
        density="-2"
        clear-label={$t('wealth.action.clearFilters')}
        style="flex: 0 1 200px; max-inline-size: 240px"
      >
        {#each segments as value (value)}
          <md-select-option {value}>
            {$t(`wealth.segment.${value}`)}
          </md-select-option>
        {/each}
      </md-select>
    </div>

    <!-- `keep-height="false"`: the ratchet is measured once and never
         recomputed, so filtering down to two rows would leave the height of
         eight behind it. -->
    <md-table
      on:mdSortChange={onSortChange}
      label={$t('wealth.panel.book')}
      column-template={layout.columns}
      min-width={layout.minWidth}
      keep-height="false"
      striped
      sort-by={sort.column}
      sort-order={sort.order}
      empty={rows.length === 0 || undefined}
      row-count={rows.length}
    >
      <md-table-head>
        <!-- No `active` / `order` on the labels: `md-table` declares the sort
             above and pushes both down into every label itself, so anything
             written here could only ever disagree with it. -->
        <md-table-row rowgroup="head">
          {#each columns as column (column.label)}
            <md-table-cell head scope="col" numeric={column.numeric || undefined}>
              {#if column.key}
                <md-table-sort-label
                  column={column.key}
                  default-order={NUMERIC_KEYS.includes(column.key) ? 'desc' : 'asc'}
                  icon-position={column.numeric ? 'start' : 'end'}
                >
                  {column.label}
                </md-table-sort-label>
              {:else}
                {column.label}
              {/if}
            </md-table-cell>
          {/each}
        </md-table-row>
      </md-table-head>

      <md-table-body>
        {#each rows as household (household.id)}
          <md-table-row value={household.id}>
            <md-table-cell>
              <NameCell>
                <Dot slot="dot" kind="kyc" value={household.kycStatus} />
                <!-- The name is the only searched field this table shows —
                     `getHouseholds` also matches on `id`, which no column
                     renders, so marking anything else would claim a hit on
                     something the reader cannot see. -->
                <Drill href={route.household(household.id)}>
                  <Highlight text={household.name} query={search} />
                </Drill>
              </NameCell>
            </md-table-cell>
            <md-table-cell>
              <Chip kind="segment" value={household.segment} />
            </md-table-cell>
            <md-table-cell>
              <Chip kind="mandate" value={household.mandate} />
            </md-table-cell>
            <md-table-cell>
              <Chip kind="strategy" value={household.strategy} />
            </md-table-cell>
            <md-table-cell numeric>
              <Money value={household.totalAum} compact />
            </md-table-cell>
            <md-table-cell numeric>
              <Signed value={household.ytdReturn} kind="percent" />
            </md-table-cell>
            <md-table-cell numeric>
              <Signed value={household.unrealisedPl} compact />
            </md-table-cell>
            <md-table-cell numeric>
              <Num value={household.memberCount} />
            </md-table-cell>
            <md-table-cell>
              <DateText value={household.nextReviewDate} />
            </md-table-cell>
          </md-table-row>
        {/each}
      </md-table-body>

      <!--
        The empty state stays INSIDE the container rather than replacing it.
        Emptiness here is always the reader's own filter, and swapping the
        table out would take the search field and the segment select away
        with it — leaving no way to undo what caused it.
      -->
      {#if rows.length === 0}
        <div slot="empty">
          <EmptyState
            message={search.trim()
              ? $t('wealth.empty.search', { query: search.trim() })
              : $t('wealth.empty.households')}
            hint={filtered}
          />
        </div>
      {/if}
    </md-table>
  </md-table-container>
</div>
