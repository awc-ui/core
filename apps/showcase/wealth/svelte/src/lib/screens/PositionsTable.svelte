<!--
  Every position in the book — the first of the holdings screen's two tables.

  WHAT THE TABLE DOES AND WHAT THIS FILE DOES. `md-table` sorts nothing and
  pages nothing: `sort-by` / `sort-order` are display state, `mdSortChange` is
  a REQUEST, and `md-table-pagination` reports intent. So the sort request is
  pushed into the screen's state and the rows are re-read through the kit's
  selector, whose filter takes the very same sort keys the headers offer — the
  ordering is done by the module that owns the data, never by a second
  comparator here that could disagree with it.

  THE COLUMN TEMPLATE IS THE KIT'S, VERBATIM. `TABLES.positions(true)` declares
  twelve tracks and a screen may not add a thirteenth: the layout has to be
  identical in every port for two screenshots to be comparable. That is why the
  expand toggle shares the ticker cell rather than taking a control column of
  its own — a bare toggle dropped into the row would eat a track the template
  does not have, and skew every cell after it.
-->
<script lang="ts">
  import {
    getHouseholdById,
    TABLES,
    type Position,
    type PositionSortKey,
  } from '@awc-ui/showcase-kit/wealth';
  import { route } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Drill from '$lib/components/Drill.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Highlight from '$lib/bits/Highlight.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import HoldingsHead from './HoldingsHead.svelte';
  import PositionDetail from './PositionDetail.svelte';
  import { paginationLabels, positionColumns, resolveSort, type SortState } from './holdings';

  /** Already filtered and ordered by the kit. This component only pages it. */
  export let rows: Position[];
  /**
   * The filter bar's search, for the `<mark>`s only.
   *
   * `getPositions` matches on ticker, instrument name and id — and the id is
   * not a column here, so the two name cells are the only ones that may be
   * marked. THE HOUSEHOLD CELL IS NOT ONE OF THEM: the position search never
   * looks at the household name (the blotter's does), and marking it would tell
   * the reader the query hit a field it was never compared against.
   */
  export let query: string | undefined = undefined;
  export let sort: SortState<PositionSortKey>;
  export let defaultSort: SortState<PositionSortKey>;
  export let onSort: (next: SortState<PositionSortKey>) => void;

  const layout = TABLES.positions(true);
  $: columns = positionColumns($t);

  let tableEl: HTMLElement | null = null;

  /* Page state plus the clamp a filter change needs: filtering to fewer rows
     can strand the reader past the last page, so the page that is actually
     rendered is always clamped to what exists. */
  let page = 0;
  let rowsPerPage = 25;
  $: lastPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
  $: safePage = Math.min(page, lastPage);
  $: offset = safePage * rowsPerPage;
  $: pageRows = rows.slice(offset, offset + rowsPerPage);

  function onSortChange(event: Event) {
    resolveSort(
      (event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>).detail,
      defaultSort,
      tableEl,
      onSort,
    );
  }

  function onPageChange(event: Event) {
    page = (event as CustomEvent<{ page: number }>).detail.page;
  }

  function onRowsPerPageChange(event: Event) {
    // No `page = 0`: the component has already reset the page and emitted
    // mdPageChange, which the handler above consumes.
    rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }
</script>

<md-table-container variant="outlined" max-height="70vh" class="table-host">
  <!--
    The toolbar goes in the container's `top` slot and the pagination in its
    `bottom` slot — outside the scroll region, so both stay put while the
    rows move (§7.1). The filters live above the whole tab strip: they drive
    both tables, and one copy is what keeps the two menus' anchor ids unique.
  -->
  <md-table-toolbar
    slot="top"
    headline={$t('wealth.panel.holdings')}
    supporting-text={$t('wealth.common.showing', {
      shown: pageRows.length,
      total: rows.length,
    })}
  ></md-table-toolbar>

  <md-table
    bind:this={tableEl}
    label={$t('wealth.panel.holdings')}
    column-template={layout.columns}
    min-width={layout.minWidth}
    sticky-header
    striped
    keep-height="false"
    sort-by={sort.column}
    sort-order={sort.order}
    row-offset={offset}
    row-count={rows.length}
    empty={rows.length === 0 || undefined}
    on:mdSortChange={onSortChange}
  >
    <!-- keep-height="false": the height ratchet is measured once and never
         recomputed, so a live density change from the dock strands the taller
         height as dead space. Pagination already holds the row count steady
         here.

         row-offset / row-count: without these, assistive tech announces
         "row 1 of 25" on every page instead of the row's place in the filtered
         book. `row-count` takes the BODY total; md-table adds the head rows
         itself.

         The empty state belongs INSIDE the table, not instead of it: the
         toolbar, the headers and the pagination readout all stay on screen,
         so the reader can see which filters emptied it. -->
    <div slot="empty">
      <EmptyState message={$t('wealth.empty.holdings')} hint />
    </div>

    <HoldingsHead {columns} />

    <md-table-body>
      {#each pageRows as position (position.id)}
        {@const household = getHouseholdById(position.householdId)}
        <md-table-row value={position.id} expandable>
          <md-table-cell>
            <span class="with-dot">
              <!--
                In the ticker cell, not in a cell of its own: the kit owns
                the twelve tracks and a thirteenth would skew the row.
                The label names the row, because twenty toggles all called
                "Expand row" tell a screen-reader user nothing.
              -->
              <md-table-expand-toggle
                button-label={`${$t('wealth.table.instrument')} ${position.ticker}`}
              ></md-table-expand-toggle>
              <span class="strong">
                <Highlight text={position.ticker} {query} />
              </span>
            </span>
          </md-table-cell>
          <md-table-cell>
            <Highlight text={position.instrumentName} {query} />
          </md-table-cell>
          <md-table-cell>
            {#if household}
              <Drill href={route.household(household.id)}>{household.name}</Drill>
            {:else}
              {$t('wealth.common.na')}
            {/if}
          </md-table-cell>
          <md-table-cell>
            <Chips kind="assetClass" value={position.assetClass} />
          </md-table-cell>
          <md-table-cell>{position.currency}</md-table-cell>
          <md-table-cell numeric>
            <Num value={position.quantity} />
          </md-table-cell>
          <md-table-cell numeric>
            <Money value={position.price} currency={position.currency} digits={2} />
          </md-table-cell>
          <md-table-cell numeric>
            <Money value={position.marketValueEur} />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed value={position.unrealisedPl} />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed value={position.unrealisedPlPct} kind="percent" />
          </md-table-cell>
          <md-table-cell numeric>
            <Percent value={position.weight} digits={1} />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed value={position.dayChangePct} kind="percent" />
          </md-table-cell>

          <!-- The detail belongs to the row, in its `expanded` slot: it
               follows its row in the reading order and goes inert with it,
               which a sibling detail row could not do. -->
          <div slot="expanded">
            <PositionDetail {position} />
          </div>
        </md-table-row>
      {/each}
    </md-table-body>
  </md-table>

  <md-table-pagination
    slot="bottom"
    count={rows.length}
    page={safePage}
    rows-per-page={rowsPerPage}
    rows-per-page-options="10,25,50,all"
    show-first-last
    {...paginationLabels($t)}
    on:mdPageChange={onPageChange}
    on:mdRowsPerPageChange={onRowsPerPageChange}
  ></md-table-pagination>
</md-table-container>
