<!--
  The instrument universe behind the book — the holdings screen's second table.

  Same division of labour as `PositionsTable`: the screen owns the sort state
  and re-reads the rows through `getInstruments`; this component only pages and
  renders. The column template is `TABLES.instruments`, verbatim, eleven tracks.
-->
<script lang="ts">
  import { TABLES, plColor, type Instrument } from '@awc-ui/showcase-kit/wealth';
  import { t, type T } from '$lib/showcase';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Highlight from '$lib/bits/Highlight.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import HoldingsHead from './HoldingsHead.svelte';
  import {
    instrumentColumns,
    paginationLabels,
    resolveSort,
    type InstrumentSortKey,
    type SortState,
  } from './holdings';

  export let rows: Instrument[];
  /**
   * The same search box narrows this tab too, so it marks its matches too —
   * one filter bar that highlighted one of its two tables would read as a bug.
   * `getInstruments` matches ticker, name and id; id is not a column.
   */
  export let query: string | undefined = undefined;
  export let sort: SortState<InstrumentSortKey>;
  export let defaultSort: SortState<InstrumentSortKey>;
  export let onSort: (next: SortState<InstrumentSortKey>) => void;

  const layout = TABLES.instruments;
  $: columns = instrumentColumns($t);

  let tableEl: HTMLElement | null = null;

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
    rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }

  /* Rebuilt whenever the locale changes, so the tooltip follows the page's
     language — the `$t` argument is what keys the re-assignment. */
  function priceLabels(instrument: Instrument, translator: T): string[] {
    return instrument.priceSeriesDates.map((date) => translator.formatDate(date, 'monthYear'));
  }

  function priceFormatter(instrument: Instrument, translator: T): (value: number | null) => string {
    return (value) =>
      value === null
        ? translator('wealth.common.na')
        : translator.formatCurrency(value, {
            currency: instrument.currency,
            maximumFractionDigits: 2,
          });
  }
</script>

<md-table-container variant="outlined" max-height="70vh" class="table-host">
  <md-table-toolbar
    slot="top"
    headline={$t('wealth.panel.universe')}
    supporting-text={$t('wealth.common.showing', {
      shown: pageRows.length,
      total: rows.length,
    })}
  ></md-table-toolbar>

  <md-table
    bind:this={tableEl}
    label={$t('wealth.panel.universe')}
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
    <div slot="empty">
      <EmptyState message={$t('wealth.empty.generic')} hint />
    </div>

    <HoldingsHead {columns} />

    <md-table-body>
      {#each pageRows as instrument (instrument.id)}
        <md-table-row value={instrument.id}>
          <md-table-cell>
            <span class="strong">
              <Highlight text={instrument.ticker} {query} />
            </span>
          </md-table-cell>
          <md-table-cell>
            <Highlight text={instrument.name} {query} />
          </md-table-cell>
          <md-table-cell>
            <Chips kind="instrumentType" value={instrument.type} />
          </md-table-cell>
          <md-table-cell>
            <Chips kind="assetClass" value={instrument.assetClass} />
          </md-table-cell>
          <md-table-cell>{$t(instrument.sectorKey)}</md-table-cell>
          <md-table-cell>{$t(instrument.regionKey)}</md-table-cell>
          <md-table-cell>{instrument.currency}</md-table-cell>
          <md-table-cell numeric>
            <Money value={instrument.price} currency={instrument.currency} digits={2} />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed value={instrument.dayChangePct} kind="percent" />
          </md-table-cell>
          <md-table-cell numeric>
            <Signed value={instrument.twelveMonthReturn} kind="percent" />
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
                data={instrument.priceSeries}
                labels={priceLabels(instrument, $t)}
                valueFormatter={priceFormatter(instrument, $t)}
                variant="line"
                curve="monotone"
                color={plColor(instrument.twelveMonthReturn)}
                show-marks="extremes"
                height="28px"
              />
            </div>
          </md-table-cell>
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
