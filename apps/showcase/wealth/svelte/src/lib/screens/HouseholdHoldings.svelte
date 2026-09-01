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
  this component's state did not change — so nothing would write the property
  back and the chip would sit deselected, lying about the filter. Toggling the
  selected class off IS "all classes", and every click there does change the
  state.

  NO PAGINATION. A household holds seven to nine positions. Pagination on nine
  rows is a control that never has a second page to go to.
-->
<script lang="ts">
  import {
    assetClassTotals,
    getPositions,
    TABLES,
    type AssetClass,
    type Household,
    type Portfolio,
    type PositionSortKey,
  } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import Signed from '$lib/bits/Signed.svelte';

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

  export let household: Household;
  export let portfolio: Portfolio | undefined;

  const layout = TABLES.positions(false);

  let assetClass: AssetClass | null = null;
  let sort: SortState = INITIAL_SORT;

  function onSortChange(event: Event) {
    const { column, order } = (
      event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>
    ).detail;
    if (!column || order === 'none') {
      sort = INITIAL_SORT;
      return;
    }
    sort = { column: column as PositionSortKey, order };
  }

  function onFacetSelect(event: Event) {
    const value = (event.target as HTMLElement | null)?.dataset?.class as AssetClass | undefined;
    if (!value) return;
    assetClass = (event as CustomEvent<{ selected: boolean }>).detail.selected ? value : null;
  }

  // Every position in the mandate, unfiltered — the facet row is built from
  // this, so the chips do not disappear as soon as one of them is chosen.
  $: all = getPositions({ householdId: household.id });
  $: facets = assetClassTotals(all);

  $: rows = getPositions({
    householdId: household.id,
    assetClass: assetClass ?? undefined,
    sortBy: sort.column,
    sortDir: sort.order,
  });

  /*
   * The foot totals come from the kit in both branches.
   *
   * Filtered, they are the chosen class's own roll-up; unfiltered, they are the
   * mandate's securities value and unrealised P/L, which the generator asserts
   * are exactly the sum of the positions. Adding the rendered rows up here
   * would be the same number computed a second way, and the second way is the
   * one that drifts.
   */
  $: totals = assetClass
    ? facets.find((row) => row.assetClass === assetClass)
    : portfolio
      ? { marketValue: portfolio.securitiesValue, unrealisedPl: portfolio.unrealisedPl }
      : undefined;

  $: columns = [
    { key: 'ticker', label: $t('wealth.table.ticker') },
    { key: 'instrumentName', label: $t('wealth.table.instrument') },
    { key: null, label: $t('wealth.table.assetClass') },
    { key: null, label: $t('wealth.table.currency') },
    { key: null, label: $t('wealth.table.quantity'), numeric: true },
    { key: null, label: $t('wealth.table.price'), numeric: true },
    { key: 'marketValueEur', label: $t('wealth.table.marketValue'), numeric: true },
    { key: 'unrealisedPl', label: $t('wealth.table.unrealisedPl'), numeric: true },
    { key: 'unrealisedPlPct', label: $t('wealth.table.plPct'), numeric: true },
    { key: 'weight', label: $t('wealth.table.weight'), numeric: true },
    { key: 'dayChangePct', label: $t('wealth.table.dayChange'), numeric: true },
  ] as { key: PositionSortKey | null; label: string; numeric?: boolean }[];
</script>

<div class="stack">
  <div class="row" on:mdSelect={onFacetSelect}>
    {#each facets as facet (facet.assetClass)}
      <md-chip
        data-class={facet.assetClass}
        variant="filter"
        appearance="outlined"
        label={$t(facet.assetClassKey)}
        selected={assetClass === facet.assetClass}
      ></md-chip>
    {/each}
    <span class="muted">
      {$t('wealth.common.showing', { shown: rows.length, total: all.length })}
    </span>
  </div>

  {#if rows.length === 0}
    <EmptyState message={$t('wealth.empty.holdings')} hint />
  {:else}
    <md-table-container variant="outlined" class="table-host">
      <!-- The height ratchet is measured once and never recomputed, so it
           strands dead space under the rows when the dock changes density.
           Nothing here pages, so there is no jump for it to prevent — hence
           `keep-height="false"`. -->
      <md-table
        label={$t('wealth.panel.holdings')}
        column-template={layout.columns}
        min-width={layout.minWidth}
        keep-height="false"
        striped
        sort-by={sort.column}
        sort-order={sort.order}
        on:mdSortChange={onSortChange}
      >
        <md-table-head>
          <!-- No `active` / `order` on the labels: md-table declares the sort
               above and pushes both down into every label on sync, so a value
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
          {#each rows as position (position.id)}
            <md-table-row value={position.id}>
              <md-table-cell>
                <span class="strong">{position.ticker}</span>
              </md-table-cell>
              <md-table-cell>{position.instrumentName}</md-table-cell>
              <md-table-cell>
                <Chips kind="assetClass" value={position.assetClass} />
              </md-table-cell>
              <md-table-cell>{position.currency}</md-table-cell>
              <md-table-cell numeric>
                <Num value={position.quantity} />
              </md-table-cell>
              <!-- The LOCAL price, in the instrument's own currency — the EUR
                   twin is the market-value column beside it. -->
              <md-table-cell numeric>
                <Money value={position.price} currency={position.currency} digits={2} />
              </md-table-cell>
              <md-table-cell numeric>
                <Money value={position.marketValueEur} compact />
              </md-table-cell>
              <md-table-cell numeric>
                <Signed value={position.unrealisedPl} compact />
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
            </md-table-row>
          {/each}
        </md-table-body>

        {#if totals}
          <md-table-foot>
            <md-table-row rowgroup="foot">
              <md-table-cell head scope="row" colspan="6">{$t('wealth.common.total')}</md-table-cell>
              <md-table-cell numeric>
                <Money value={totals.marketValue} compact />
              </md-table-cell>
              <md-table-cell numeric>
                <Signed value={totals.unrealisedPl} compact />
              </md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
              <md-table-cell></md-table-cell>
            </md-table-row>
          </md-table-foot>
        {/if}
      </md-table>
    </md-table-container>
  {/if}
</div>
