/**
 * The holdings screen's shared vocabulary — filter state, column lists, sort
 * plumbing and pagination labels.
 *
 * The React build keeps these exports inside `HoldingsFilters.tsx` and
 * `HoldingsTables.tsx`; a Svelte component is one file with one component, so
 * the plain-TypeScript surface the three components share lives here instead.
 * Same contracts, same names, one module.
 */

import type {
  AssetClass,
  Currency,
  InstrumentFilter,
  PositionSortKey,
  Region,
} from '@awc-ui/showcase-kit/wealth';
import type { T } from '$lib/showcase';

/* ------------------------------------------------------------------- state */

/**
 * Everything the bar can narrow the book by.
 *
 * Every field maps 1:1 onto a field of the kit's `PositionFilter`, so the
 * screen hands the whole object to the selector rather than translating it.
 * `null` and `''` mean "not filtered" — never `undefined`, so a spread patch
 * can always clear a field.
 */
export interface HoldingsFilterState {
  /** Substring over ticker, instrument name and id. */
  search: string;
  /** Empty means every class. More than one is a union — see the screen. */
  assetClasses: AssetClass[];
  instrumentId: string | null;
  region: Region | null;
  currency: Currency | null;
}

export const NO_FILTERS: HoldingsFilterState = {
  search: '',
  assetClasses: [],
  instrumentId: null,
  region: null,
  currency: null,
};

/** `true` when anything is narrowing the book. Used to offer "clear filters". */
export function isFiltered(state: HoldingsFilterState): boolean {
  return Boolean(
    state.search || state.assetClasses.length || state.instrumentId || state.region || state.currency,
  );
}

/** One sortable column of whichever table is on screen, for the sort menu. */
export interface SortSpec {
  /** The `column` a sort label emits — a key of the active table's filter. */
  key: string;
  label: string;
}

/** Which dataset the export acts on. */
export type ExportTarget = 'holdings' | 'instruments' | 'concentration';

/* ----------------------------------------------------------------- columns */

/** One column: its sort key when it has one, its header, its alignment. */
export interface Column<K extends string> {
  /** The key `mdSortChange` reports, or `null` for a column you cannot sort. */
  key: K | null;
  label: string;
  numeric?: boolean;
}

export type InstrumentSortKey = NonNullable<InstrumentFilter['sortBy']>;

/**
 * The holdings columns, in `TABLES.positions(true)` order.
 *
 * WEIGHT IS THE MANDATE'S, NOT THE BOOK'S, and the header says so.
 * `Position.weight` is the position's share of its own portfolio — the fixture
 * carries no book-level weight per position, and computing one here would be
 * arithmetic in a component. The book share of an instrument is a real number
 * and it lives on the concentration panel, where `bookHoldings()` supplies it
 * and the header is `table.bookWeight`.
 */
export function positionColumns(t: T): Column<PositionSortKey>[] {
  return [
    { key: 'ticker', label: t('wealth.table.ticker') },
    { key: 'instrumentName', label: t('wealth.table.instrument') },
    { key: null, label: t('wealth.table.household') },
    { key: null, label: t('wealth.table.assetClass') },
    { key: null, label: t('wealth.table.currency') },
    { key: null, label: t('wealth.table.quantity'), numeric: true },
    { key: null, label: t('wealth.table.price'), numeric: true },
    { key: 'marketValueEur', label: t('wealth.table.marketValue'), numeric: true },
    { key: 'unrealisedPl', label: t('wealth.table.unrealisedPl'), numeric: true },
    { key: 'unrealisedPlPct', label: t('wealth.table.plPct'), numeric: true },
    { key: 'weight', label: t('wealth.table.weight'), numeric: true },
    { key: 'dayChangePct', label: t('wealth.table.dayChange'), numeric: true },
  ];
}

/** The universe columns, in `TABLES.instruments` order. */
export function instrumentColumns(t: T): Column<InstrumentSortKey>[] {
  return [
    { key: 'ticker', label: t('wealth.table.ticker') },
    { key: 'name', label: t('wealth.table.instrument') },
    { key: null, label: t('wealth.table.type') },
    { key: null, label: t('wealth.table.assetClass') },
    { key: null, label: t('wealth.table.sector') },
    { key: null, label: t('wealth.table.region') },
    { key: null, label: t('wealth.table.currency') },
    { key: 'price', label: t('wealth.table.price'), numeric: true },
    { key: 'dayChangePct', label: t('wealth.table.dayChange'), numeric: true },
    { key: 'twelveMonthReturn', label: t('wealth.table.twelveMonth'), numeric: true },
    { key: null, label: t('wealth.table.trend') },
  ];
}

/* -------------------------------------------------------------------- sort */

export interface SortState<K extends string> {
  column: K;
  order: 'asc' | 'desc';
}

/** The one `md-table` method used here. Async, like every `@Method`. */
type SortableTable = HTMLElement & {
  setSort?: (column: string, order: 'asc' | 'desc' | 'none') => Promise<void>;
};

/**
 * Turn a sort REQUEST into the screen's sort state.
 *
 * The third click of a column's cycle clears the sort, and the rows still have
 * to come back in some order — so it returns to the table's default. The table
 * has already blanked its own `sort-by` by then, and if the default IS the
 * column just cleared, Svelte re-renders with an unchanged `sort-by` value and
 * never writes the attribute back: the arrow would vanish while the rows stayed
 * sorted. `setSort` puts the display state back where the data actually is.
 */
export function resolveSort<K extends string>(
  detail: { column: string; order: 'asc' | 'desc' | 'none' },
  defaultSort: SortState<K>,
  table: HTMLElement | null,
  onSort: (next: SortState<K>) => void,
): void {
  if (detail.column && detail.order !== 'none') {
    onSort({ column: detail.column as K, order: detail.order });
    return;
  }
  onSort(defaultSort);
  // Re-emits `mdSortChange` with the restored column, which lands in the branch
  // above and settles on the state it is already in.
  void (table as SortableTable | null)?.setSort?.(defaultSort.column, defaultSort.order);
}

/* -------------------------------------------------------------- pagination */

/** The seven translated labels `md-table-pagination` would otherwise ship in English. */
export function paginationLabels(t: T): Record<string, string> {
  return {
    'label-rows-per-page': t('wealth.table.rowsPerPage'),
    'label-displayed-rows': t('wealth.table.displayedRows'),
    'label-first-page': t('wealth.table.firstPage'),
    'label-previous-page': t('wealth.table.previousPage'),
    'label-next-page': t('wealth.table.nextPage'),
    'label-last-page': t('wealth.table.lastPage'),
    'label-all': t('wealth.table.all'),
  };
}
