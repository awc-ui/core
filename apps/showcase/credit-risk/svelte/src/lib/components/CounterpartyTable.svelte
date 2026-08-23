<!--
  The counterparty table, used by the overview and by every sector screen.

  SORTING. `md-table` sorts nothing by itself — `sort-by`/`sort-order` are
  display state and `mdSortChange` is a REQUEST. The handler pushes the request
  into component state, and the rows are re-read through `getCounterparties()`,
  whose filter takes the same sort keys the header offers. So the sort is done
  by the selector that owns the data, not by a second comparator here that could
  disagree with it.

  PAGING. `md-table-pagination` is display state plus a REQUEST too: it renders
  the readout and the controls, and this component owns which slice is actually
  rendered.

  DRILLING. The legal name is a real anchor, not a row click: it is reachable by
  keyboard, it has a URL you can copy, and it survives JavaScript being slow to
  arrive. Legal names are proper nouns and are never translated.
-->
<script lang="ts">
  import {
    getCounterparties,
    type Counterparty,
    type CounterpartySortKey,
    type SectorId,
  } from '@awc-ui/showcase-kit/data';
  import { TABLES, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
  import { t } from '$lib/showcase';
  import { route } from '$lib/routes';
  import Drill from './Drill.svelte';
  import EmptyState from './EmptyState.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Dots from '$lib/bits/Dots.svelte';

  export let sectorId: SectorId | undefined = undefined;
  export let showSector = true;
  export let initialSort: { column: CounterpartySortKey; order: 'asc' | 'desc' } = {
    column: 'ead',
    order: 'desc',
  };

  const NUMERIC_KEYS: CounterpartySortKey[] = [
    'ead',
    'pd',
    'expectedLoss',
    'rwa',
    'utilisation',
    'grade',
  ];

  let sort = initialSort;
  let page = 0;
  let rowsPerPage = 10;

  $: layout = TABLES.counterparties(showSector);
  $: allRows = getCounterparties({
    sectorId,
    sortBy: sort.column,
    sortDir: sort.order,
  }) as Counterparty[];

  // A sort or filter change can leave the reader stranded past the last page.
  $: lastPage = Math.max(0, Math.ceil(allRows.length / rowsPerPage) - 1);
  $: safePage = Math.min(page, lastPage);
  $: rows = allRows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  $: columns = [
    { key: 'legalName' as const, label: $t('table.counterparty') },
    ...(showSector ? [{ key: null, label: $t('table.sector') }] : []),
    { key: null, label: $t('table.country') },
    { key: 'grade' as const, label: $t('table.rating') },
    { key: 'pd' as const, label: $t('table.pd'), numeric: true },
    { key: null, label: $t('table.lgd'), numeric: true },
    { key: 'ead' as const, label: $t('table.ead'), numeric: true },
    { key: 'expectedLoss' as const, label: $t('table.expectedLoss'), numeric: true },
    { key: 'rwa' as const, label: $t('table.rwa'), numeric: true },
    { key: 'utilisation' as const, label: $t('table.utilisation'), numeric: true },
  ];

  function onSortChange(event: Event) {
    const { column, order } = (event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>)
      .detail;
    if (!column || order === 'none') {
      sort = initialSort;
      return;
    }
    sort = { column: column as CounterpartySortKey, order };
  }

  function onPageChange(event: Event) {
    page = (event as CustomEvent<{ page: number }>).detail.page;
  }

  function onRowsPerPageChange(event: Event) {
    // No `page = 0` here: md-table-pagination has already reset the page and
    // emitted mdPageChange, which the handler above consumes. Resetting again
    // is the component's documented anti-pattern.
    rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }
</script>

{#if rows.length === 0}
  <EmptyState message={$t('empty.counterparties')} hint />
{:else}
  <md-table-container variant="outlined">
    <!--
      keep-height: md-table ratchets its height by default so paging cannot make
      the page jump. That baseline is measured once and never recomputed, so a
      density change strands the taller height and leaves dead space below the
      rows — 176px at rung -4. Pagination already holds the row count steady
      here, so the ratchet earns little; live density switching matters more.

      row-offset / row-count: without them assistive tech announces "row 1 of
      10" on every page instead of the row's position in the whole book.
      row-count takes the BODY total; md-table adds the head and foot rows.
    -->
    <md-table
      label={$t('screen.counterparties.title')}
      column-template={layout.columns}
      min-width={layout.minWidth}
      on:mdSortChange={onSortChange}
      keep-height="false"
      striped
      sort-by={sort.column}
      sort-order={sort.order}
      row-offset={safePage * rowsPerPage}
      row-count={allRows.length}
    >
      <md-table-head>
        <!-- The sort labels carry no active/order: md-table already declares
             sort-by / sort-order above and pushes both down into every label on
             sync, so anything written here could only ever disagree with it. -->
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
        {#each rows as cp (cp.id)}
          <md-table-row value={cp.id}>
            <md-table-cell>
              <span class="row" style="gap: var(--md-sys-spacing-gap-xs, 4px)">
                <Dots kind="watch" value={cp.watchlist} />
                <Drill href={route.counterparty(cp.id)}>{cp.legalName}</Drill>
              </span>
            </md-table-cell>
            {#if showSector}
              <md-table-cell>
                <Drill href={route.sector(cp.sectorId)}>{$t(`sector.${cp.sectorId}`)}</Drill>
              </md-table-cell>
            {/if}
            <md-table-cell>{$t(`country.${cp.country}`)}</md-table-cell>
            <md-table-cell>
              <Chips kind="rating" value={cp.ratingLabel} band={cp.ratingBand} grade={cp.grade} />
            </md-table-cell>
            <md-table-cell numeric>{$t.formatPercent(cp.pd, { maximumFractionDigits: 2 })}</md-table-cell>
            <md-table-cell numeric>{$t.formatPercent(cp.lgd, { maximumFractionDigits: 0 })}</md-table-cell>
            <md-table-cell numeric>{$t.formatCurrency(cp.ead, { notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>
              {$t.formatCurrency(cp.expectedLoss, { notation: 'compact' })}
            </md-table-cell>
            <md-table-cell numeric>{$t.formatCurrency(cp.rwa, { notation: 'compact' })}</md-table-cell>
            <md-table-cell numeric>
              <span style="color: var(--md-sys-color-{utilisationColor(cp.utilisation)})">
                {$t.formatPercent(cp.utilisation, { maximumFractionDigits: 0 })}
              </span>
            </md-table-cell>
          </md-table-row>
        {/each}
      </md-table-body>
    </md-table>
    <md-table-pagination
      slot="bottom"
      count={allRows.length}
      page={safePage}
      rows-per-page={rowsPerPage}
      rows-per-page-options="10,25,all"
      show-first-last
      on:mdPageChange={onPageChange}
      on:mdRowsPerPageChange={onRowsPerPageChange}
      label-rows-per-page={$t('table.rowsPerPage')}
      label-displayed-rows={$t('table.displayedRows')}
      label-first-page={$t('table.firstPage')}
      label-previous-page={$t('table.previousPage')}
      label-next-page={$t('table.nextPage')}
      label-last-page={$t('table.lastPage')}
      label-all={$t('table.all')}
    ></md-table-pagination>
  </md-table-container>
{/if}
