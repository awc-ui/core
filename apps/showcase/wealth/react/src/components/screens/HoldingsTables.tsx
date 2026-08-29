/**
 * The two tables of the holdings screen: every position in the book, and the
 * instrument universe behind them.
 *
 * WHAT THE TABLE DOES AND WHAT THIS FILE DOES. `md-table` sorts nothing and
 * pages nothing: `sort-by` / `sort-order` are display state, `mdSortChange` is
 * a REQUEST, and `md-table-pagination` reports intent. So the sort request is
 * pushed into the screen's state and the rows are re-read through the kit's
 * selector, whose filter takes the very same sort keys the headers offer — the
 * ordering is done by the module that owns the data, never by a second
 * comparator here that could disagree with it.
 *
 * THE COLUMN TEMPLATE IS THE KIT'S, VERBATIM. `TABLES.positions(true)` declares
 * twelve tracks and `TABLES.instruments` eleven, and a screen may not add a
 * thirteenth: the layout has to be identical in every port for two screenshots
 * to be comparable. That is why the expand toggle shares the ticker cell rather
 * than taking a control column of its own — a bare toggle dropped into the row
 * would eat a track the template does not have, and skew every cell after it.
 */

import { useMemo, useRef, useState } from 'react';
import {
  getHouseholdById,
  getInstrumentById,
  getPortfolioById,
  plColor,
  TABLES,
  type Instrument,
  type InstrumentFilter,
  type Position,
  type PositionSortKey,
} from '@awc-ui/showcase-kit/wealth';
import { route } from '@/lib/routes';
import { useShowcase, useT, type T } from '@/lib/showcase';
import { Sparkline, useCustomEvent } from '../elements';
import {
  AssetClassChip,
  DateText,
  Drill,
  Fact,
  Highlight,
  InstrumentTypeChip,
  Money,
  Num,
  Percent,
  Signed,
} from '../bits';
import { EmptyState } from '../Shell';

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

/* ------------------------------------------------------------- shared bits */

export interface SortState<K extends string> {
  column: K;
  order: 'asc' | 'desc';
}

/**
 * The header row, shared by both tables.
 *
 * The sort labels carry no `active` / `order`: `md-table` already declares
 * `sort-by` / `sort-order` and pushes both down into every label on sync, so
 * anything written here could only ever disagree with it.
 */
function Head<K extends string>({ columns }: { columns: Column<K>[] }) {
  return (
    <md-table-head>
      <md-table-row rowgroup="head">
        {columns.map((column) => (
          <md-table-cell key={column.label} head scope="col" numeric={column.numeric || undefined}>
            {column.key ? (
              <md-table-sort-label
                column={column.key}
                default-order={column.numeric ? 'desc' : 'asc'}
                icon-position={column.numeric ? 'start' : 'end'}
              >
                {column.label}
              </md-table-sort-label>
            ) : (
              column.label
            )}
          </md-table-cell>
        ))}
      </md-table-row>
    </md-table-head>
  );
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
 * column just cleared, React re-renders with an unchanged `sort-by` prop and
 * never writes the attribute back: the arrow would vanish while the rows stayed
 * sorted. `setSort` puts the display state back where the data actually is.
 */
function resolveSort<K extends string>(
  detail: { column: string; order: 'asc' | 'desc' | 'none' },
  defaultSort: SortState<K>,
  table: HTMLElement | null,
  onSort: (next: SortState<K>) => void,
) {
  if (detail.column && detail.order !== 'none') {
    onSort({ column: detail.column as K, order: detail.order });
    return;
  }
  onSort(defaultSort);
  // Re-emits `mdSortChange` with the restored column, which lands in the branch
  // above and settles on the state it is already in.
  void (table as SortableTable | null)?.setSort?.(defaultSort.column, defaultSort.order);
}

/** Page state plus the clamp a filter change needs. */
function usePaging<Row>(rows: Row[], initialRowsPerPage: number) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  // Filtering to fewer rows can strand the reader past the last page, so the
  // page that is actually rendered is always clamped to what exists.
  const lastPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);
  const offset = safePage * rowsPerPage;
  const pageRows = useMemo(
    () => rows.slice(offset, offset + rowsPerPage),
    [rows, offset, rowsPerPage],
  );

  return { safePage, rowsPerPage, offset, pageRows, setPage, setRowsPerPage };
}

/** The seven translated labels `md-table-pagination` would otherwise ship in English. */
function paginationLabels(t: T) {
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

/* ---------------------------------------------------------------- holdings */

export function PositionsTable({
  rows,
  query,
  sort,
  defaultSort,
  onSort,
}: {
  /** Already filtered and ordered by the kit. This component only pages it. */
  rows: Position[];
  /**
   * The filter bar's search, for the `<mark>`s only.
   *
   * `getPositions` matches on ticker, instrument name and id — and the id is
   * not a column here, so the two name cells are the only ones that may be
   * marked. THE HOUSEHOLD CELL IS NOT ONE OF THEM: the position search never
   * looks at the household name (the blotter's does), and marking it would tell
   * the reader the query hit a field it was never compared against.
   */
  query?: string;
  sort: SortState<PositionSortKey>;
  defaultSort: SortState<PositionSortKey>;
  onSort: (next: SortState<PositionSortKey>) => void;
}) {
  const t = useT();
  const layout = TABLES.positions(true);
  const columns = positionColumns(t);
  const tableRef = useRef<HTMLElement | null>(null);
  const pagerRef = useRef<HTMLElement | null>(null);
  const paging = usePaging(rows, 25);

  useCustomEvent<CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>>(
    tableRef,
    'mdSortChange',
    (event) => resolveSort(event.detail, defaultSort, tableRef.current, onSort),
  );

  useCustomEvent<CustomEvent<{ page: number }>>(pagerRef, 'mdPageChange', (event) =>
    paging.setPage(event.detail.page),
  );
  useCustomEvent<CustomEvent<{ rowsPerPage: number }>>(pagerRef, 'mdRowsPerPageChange', (event) => {
    // No setPage(0): the component has already reset the page and emitted
    // mdPageChange, which the handler above consumes.
    paging.setRowsPerPage(event.detail.rowsPerPage);
  });

  return (
    <md-table-container variant="outlined" max-height="70vh" class="table-host">
      {/*
        The toolbar goes in the container's `top` slot and the pagination in its
        `bottom` slot — outside the scroll region, so both stay put while the
        rows move (§7.1). The filters live above the whole tab strip: they drive
        both tables, and one copy is what keeps the two menus' anchor ids unique.
      */}
      <md-table-toolbar
        slot="top"
        headline={t('wealth.panel.holdings')}
        supporting-text={t('wealth.common.showing', {
          shown: paging.pageRows.length,
          total: rows.length,
        })}
      />

      <md-table
        ref={tableRef}
        label={t('wealth.panel.holdings')}
        column-template={layout.columns}
        min-width={layout.minWidth}
        sticky-header
        striped
        // The height ratchet is measured once and never recomputed, so a live
        // density change from the dock strands the taller height as dead space.
        // Pagination already holds the row count steady here.
        keep-height="false"
        sort-by={sort.column}
        sort-order={sort.order}
        // Without these, assistive tech announces "row 1 of 25" on every page
        // instead of the row's place in the filtered book. `row-count` takes the
        // BODY total; md-table adds the head rows itself.
        row-offset={paging.offset}
        row-count={rows.length}
        // The empty state belongs INSIDE the table, not instead of it: the
        // toolbar, the headers and the pagination readout all stay on screen,
        // so the reader can see which filters emptied it.
        empty={rows.length === 0 || undefined}
      >
        <div slot="empty">
          <EmptyState message={t('wealth.empty.holdings')} hint />
        </div>

        <Head columns={columns} />

        <md-table-body>
          {paging.pageRows.map((position) => {
            const household = getHouseholdById(position.householdId);
            return (
              <md-table-row key={position.id} value={position.id} expandable>
                <md-table-cell>
                  <span className="with-dot">
                    {/*
                      In the ticker cell, not in a cell of its own: the kit owns
                      the twelve tracks and a thirteenth would skew the row.
                      The label names the row, because twenty toggles all called
                      "Expand row" tell a screen-reader user nothing.
                    */}
                    <md-table-expand-toggle
                      button-label={`${t('wealth.table.instrument')} ${position.ticker}`}
                    />
                    <span className="strong">
                      <Highlight text={position.ticker} query={query} />
                    </span>
                  </span>
                </md-table-cell>
                <md-table-cell>
                  <Highlight text={position.instrumentName} query={query} />
                </md-table-cell>
                <md-table-cell>
                  {household ? (
                    <Drill href={route.household(household.id)}>{household.name}</Drill>
                  ) : (
                    t('wealth.common.na')
                  )}
                </md-table-cell>
                <md-table-cell>
                  <AssetClassChip assetClass={position.assetClass} />
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

                {/* The detail belongs to the row, in its `expanded` slot: it
                    follows its row in the reading order and goes inert with it,
                    which a sibling detail row could not do. */}
                <div slot="expanded">
                  <PositionDetail position={position} />
                </div>
              </md-table-row>
            );
          })}
        </md-table-body>
      </md-table>

      <md-table-pagination
        ref={pagerRef}
        slot="bottom"
        count={rows.length}
        page={paging.safePage}
        rows-per-page={paging.rowsPerPage}
        rows-per-page-options="10,25,50,all"
        show-first-last
        {...paginationLabels(t)}
      />
    </md-table-container>
  );
}

/**
 * What sits behind one holding.
 *
 * The fixture books a position as a single lot, so this is that lot: what was
 * paid, what it is worth in its own currency before the FX, when it was opened,
 * and where the instrument has been over twelve months. The household name is a
 * drill, because the next question after "what is this?" is "whose is it?".
 */
function PositionDetail({ position }: { position: Position }) {
  const t = useT();
  const { state } = useShowcase();
  const instrument = getInstrumentById(position.instrumentId);
  const mandate = getPortfolioById(position.portfolioId);

  /*
   * The panel runs the full width of the row.
   *
   * The facts sit in `.dl`, an auto-fit grid that spreads them across whatever
   * width it is given, and the twelve-month series spans the whole panel
   * beneath them. A twelve-point series stretched this wide is a flatter line
   * than a narrow one would be — that is the trade the full width buys, and it
   * is deliberate.
   */
  return (
    <div
      style={{
        /* Facts across the top, the twelve-month series across the full width
           beneath them. No cap: the panel is as wide as the row it belongs to,
           and the chart is meant to use all of it. */
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--md-sys-spacing-gap-lg, 24px)',
        inlineSize: '100%',
      }}
    >
      <dl className="dl">
        <Fact label={t('wealth.table.quantity')}>
          <Num value={position.quantity} />
        </Fact>
        <Fact label={t('wealth.table.costPerUnit')}>
          <Money value={position.costPerUnit} currency={position.currency} digits={2} />
        </Fact>
        <Fact label={t('wealth.table.costBasis')}>
          <Money value={position.costBasisEur} />
        </Fact>
        <Fact label={t('wealth.table.marketValue')}>
          {/* The LOCAL amount here, beside the EUR one in the row above it —
              this is the pair a currency question is actually asked of. */}
          <Money value={position.marketValue} currency={position.currency} />
        </Fact>
        <Fact label={t('wealth.table.opened')}>
          <DateText value={position.openedDate} />
        </Fact>
        <Fact label={t('wealth.table.sector')}>{t(position.sectorKey)}</Fact>
        <Fact label={t('wealth.table.region')}>{t(position.regionKey)}</Fact>
        {instrument ? (
          <Fact label={t('wealth.table.twelveMonth')}>
            <Signed value={instrument.twelveMonthReturn} kind="percent" />
          </Fact>
        ) : null}
        {mandate ? (
          // The mandate reference is a proper noun, and it is the thing an
          // operations question is asked with — "which book is this in?".
          <Fact label={t('wealth.panel.mandate')}>{mandate.reference}</Fact>
        ) : null}
      </dl>

      {instrument && instrument.priceSeries.length > 1 ? (
        <div style={{ inlineSize: '100%' }}>
          <Sparkline
            data={instrument.priceSeries}
            labels={instrument.priceSeriesDates.map((date) => t.formatDate(date, 'monthYear'))}
            valueFormatter={(value: number | null) =>
              value === null
                ? t('wealth.common.na')
                : t.formatCurrency(value, {
                    currency: instrument.currency,
                    maximumFractionDigits: 2,
                  })
            }
            locale={state.locale}
            variant="area"
            curve="monotone"
            color={plColor(instrument.twelveMonthReturn)}
            show-marks="extremes"
            height="56px"
          />
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- universe */

export function InstrumentsTable({
  rows,
  query,
  sort,
  defaultSort,
  onSort,
}: {
  rows: Instrument[];
  /**
   * The same search box narrows this tab too, so it marks its matches too —
   * one filter bar that highlighted one of its two tables would read as a bug.
   * `getInstruments` matches ticker, name and id; id is not a column.
   */
  query?: string;
  sort: SortState<InstrumentSortKey>;
  defaultSort: SortState<InstrumentSortKey>;
  onSort: (next: SortState<InstrumentSortKey>) => void;
}) {
  const t = useT();
  const { state } = useShowcase();
  const layout = TABLES.instruments;
  const columns = instrumentColumns(t);
  const tableRef = useRef<HTMLElement | null>(null);
  const pagerRef = useRef<HTMLElement | null>(null);
  const paging = usePaging(rows, 25);

  useCustomEvent<CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>>(
    tableRef,
    'mdSortChange',
    (event) => resolveSort(event.detail, defaultSort, tableRef.current, onSort),
  );

  useCustomEvent<CustomEvent<{ page: number }>>(pagerRef, 'mdPageChange', (event) =>
    paging.setPage(event.detail.page),
  );
  useCustomEvent<CustomEvent<{ rowsPerPage: number }>>(pagerRef, 'mdRowsPerPageChange', (event) =>
    paging.setRowsPerPage(event.detail.rowsPerPage),
  );

  return (
    <md-table-container variant="outlined" max-height="70vh" class="table-host">
      <md-table-toolbar
        slot="top"
        headline={t('wealth.panel.universe')}
        supporting-text={t('wealth.common.showing', {
          shown: paging.pageRows.length,
          total: rows.length,
        })}
      />

      <md-table
        ref={tableRef}
        label={t('wealth.panel.universe')}
        column-template={layout.columns}
        min-width={layout.minWidth}
        sticky-header
        striped
        keep-height="false"
        sort-by={sort.column}
        sort-order={sort.order}
        row-offset={paging.offset}
        row-count={rows.length}
        empty={rows.length === 0 || undefined}
      >
        <div slot="empty">
          <EmptyState message={t('wealth.empty.generic')} hint />
        </div>

        <Head columns={columns} />

        <md-table-body>
          {paging.pageRows.map((instrument) => (
            <md-table-row key={instrument.id} value={instrument.id}>
              <md-table-cell>
                <span className="strong">
                  <Highlight text={instrument.ticker} query={query} />
                </span>
              </md-table-cell>
              <md-table-cell>
                <Highlight text={instrument.name} query={query} />
              </md-table-cell>
              <md-table-cell>
                <InstrumentTypeChip type={instrument.type} />
              </md-table-cell>
              <md-table-cell>
                <AssetClassChip assetClass={instrument.assetClass} />
              </md-table-cell>
              <md-table-cell>{t(instrument.sectorKey)}</md-table-cell>
              <md-table-cell>{t(instrument.regionKey)}</md-table-cell>
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
                {/*
                  `aria-hidden`, and deliberately. md-sparkline names itself with
                  a generated English sentence, and twenty-five of those would be
                  read out in a table whose previous three columns already carry
                  the price, the day's move and the twelve-month return in
                  figures. The chart is the same fact drawn; hiding the duplicate
                  is the accessible choice, not the lazy one.
                */}
                <div style={{ minInlineSize: '80px' }}>
                  <Sparkline
                    aria-hidden="true"
                    data={instrument.priceSeries}
                    labels={instrument.priceSeriesDates.map((date) => t.formatDate(date, 'monthYear'))}
                    valueFormatter={(value: number | null) =>
                      value === null
                        ? t('wealth.common.na')
                        : t.formatCurrency(value, {
                            currency: instrument.currency,
                            maximumFractionDigits: 2,
                          })
                    }
                    locale={state.locale}
                    variant="line"
                    curve="monotone"
                    color={plColor(instrument.twelveMonthReturn)}
                    show-marks="extremes"
                    height="28px"
                  />
                </div>
              </md-table-cell>
            </md-table-row>
          ))}
        </md-table-body>
      </md-table>

      <md-table-pagination
        ref={pagerRef}
        slot="bottom"
        count={rows.length}
        page={paging.safePage}
        rows-per-page={paging.rowsPerPage}
        rows-per-page-options="10,25,50,all"
        show-first-last
        {...paginationLabels(t)}
      />
    </md-table-container>
  );
}
