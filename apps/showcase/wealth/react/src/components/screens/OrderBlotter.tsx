/**
 * The blotter: every order the book has raised, filtered and paged.
 *
 * FILTERING GOES THROUGH THE SELECTOR, NEVER THROUGH `.filter()` HERE.
 * `getOrders()` already knows what "working" means (`submitted` plus
 * `partially-filled`) and what a search matches (ticker, security name,
 * household, id). Re-deciding either in this file is how two ports end up
 * disagreeing about which rows a filter keeps. Paging is the one thing this
 * component does own — `md-table-pagination` renders the readout and the
 * controls and emits a REQUEST, exactly like a sort header, and taking the slice
 * is ours.
 *
 * THERE ARE NO SORT HEADERS, and that is deliberate rather than unfinished.
 * `OrderFilter` carries no `sortBy` / `sortDir`; the fixture stores orders newest
 * first and the selector preserves that. A comparator here would be a second
 * ordering the kit knows nothing about, so the headers stay plain and the
 * missing filter fields are reported upward instead.
 *
 * §7.1's table rule: `md-table-container` WRAPS `md-table`, with the toolbar in
 * its `top` slot and the pagination in its `bottom` slot. Neither goes inside
 * the table, where they would become children of a grid whose columns belong to
 * the rows.
 *
 * WHY THE TABLE IS ITS OWN COMPONENT. `useCustomEvent` binds in an effect keyed
 * on the ref object and the event name, neither of which changes when the
 * element behind the ref is unmounted and mounted again. A table rendered
 * conditionally in this component's own tree would therefore come back after an
 * empty state with a live ref and a DEAD pagination listener. A child component
 * unmounts as a unit, so its effects re-run and re-bind when it returns.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  getAdvisor,
  getBookTotals,
  getOrders,
  TABLES,
  type Order,
  type OrderSide,
  type OrderStatus,
} from '@awc-ui/showcase-kit/wealth';
import { route } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { EmptyState, Panel } from '../Shell';
import { DateText, Drill, Highlight, Money, Num, OrderSideChip, OrderStatusChip } from '../bits';
import { useCustomEvent } from '../elements';
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

export function OrderBlotter() {
  const t = useT();
  const tx = useTx();
  const totals = getBookTotals();

  const [search, setSearch] = useState('');
  const [side, setSide] = useState<OrderSide | ''>('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [facets, setFacets] = useState<FacetState>(NO_FACETS);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const searchRef = useRef<HTMLElement | null>(null);
  const sideRef = useRef<HTMLElement | null>(null);
  const statusRef = useRef<HTMLElement | null>(null);
  const facetsRef = useRef<HTMLDivElement | null>(null);
  const clearRef = useRef<HTMLElement | null>(null);

  /*
   * The search field is UNCONTROLLED — no `value` prop is rendered back into it.
   * A controlled text field rewrites the box on every keystroke, which is how a
   * caret ends up jumping to the end of a word being edited in the middle. The
   * consequence is that "clear filters" has to push the empty string back into
   * the element by hand; that is the whole reason `searchRef` exists.
   */
  useCustomEvent<CustomEvent<string>>(searchRef, 'mdInput', (event) => {
    setSearch(event.detail ?? '');
    setPage(0);
  });
  useCustomEvent<CustomEvent<void>>(searchRef, 'mdClear', () => {
    setSearch('');
    setPage(0);
  });

  useCustomEvent<CustomEvent<string>>(sideRef, 'mdChange', (event) => {
    setSide((event.detail || '') as OrderSide | '');
    setPage(0);
  });
  useCustomEvent<CustomEvent<string>>(statusRef, 'mdChange', (event) => {
    setStatus((event.detail || '') as OrderStatus | '');
    setPage(0);
  });

  /*
   * `mdSelect`, not a click handler.
   *
   * A filter chip toggles its own `selected` before it emits, and the event
   * carries the state it landed on — so the app never has to infer the new value
   * from the old one, and a press that did not activate the chip cannot
   * desynchronise the two.
   */
  useCustomEvent<CustomEvent<{ selected: boolean }>>(facetsRef, 'mdSelect', (event) => {
    // One listener for the whole set: `mdSelect` bubbles and is composed, so it
    // retargets to the `md-chip` host and its `data-facet` reads straight off
    // `event.target`.
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset.facet as FacetId | undefined;
    if (!id) return;
    setFacets((current) => ({ ...current, [id]: Boolean(event.detail?.selected) }));
    setPage(0);
  });

  const allRows = useMemo<Order[]>(
    () =>
      getOrders({
        // Every key is omitted when empty. `getOrders` treats a falsy value as
        // "not asked for" precisely so a screen can hand its state straight in
        // without deciding anything on the way.
        search: search || undefined,
        side: side || undefined,
        status: status || undefined,
        working: facets.working ? true : undefined,
        advisorId: facets.mine ? getAdvisor().id : undefined,
        fromProposal: facets.fromAdvice ? true : undefined,
      }),
    [search, side, status, facets],
  );

  // A filter change can leave the reader stranded past the last page.
  const lastPage = Math.max(0, Math.ceil(allRows.length / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);

  const rows = useMemo<Order[]>(
    () => allRows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [allRows, safePage, rowsPerPage],
  );

  const filtered = Boolean(search || side || status) || FACETS.some((f) => facets[f.id]);

  const clearFilters = () => {
    setSearch('');
    setSide('');
    setStatus('');
    setFacets(NO_FACETS);
    setPage(0);
    // The custom elements own their own visual state. The two selects and the
    // chip are controlled and will follow, but the search box is not — React
    // never wrote a `value` into it, so it has nothing to re-render.
    if (searchRef.current) (searchRef.current as unknown as { value: string }).value = '';
  };

  /*
   * `mdClick`, not React's `onClick`.
   *
   * `md-icon-button`'s soft-disabled path calls `preventDefault()` and returns —
   * it does NOT stop propagation — so the native click still reaches a React
   * handler and would "clear" filters that are already clear. `mdClick` is
   * emitted only when the control is genuinely live, which leaves the guard with
   * the component instead of duplicating it here where it could drift.
   */
  useCustomEvent<CustomEvent>(clearRef, 'mdClick', clearFilters);

  return (
    <Panel>
      <div className="stack">
        <div className="row trade-filters">
          {/*
            `md-text-field type="search"`, not `md-search`: `md-search` owns a
            results surface of its own, and this box filters a table that is
            already on screen (§5.2).
          */}
          <md-text-field
            ref={searchRef}
            variant="outlined"
            type="search"
            label={tx('wealth.trade.searchOrders')}
            clearable="internal"
          />

          <md-select
            ref={sideRef}
            variant="outlined"
            label={t('wealth.table.side')}
            placeholder={t('wealth.common.all')}
            value={side}
            clearable
            clear-label={t('wealth.action.clearFilters')}
          >
            {SIDES.map((value) => (
              <md-select-option key={value} value={value} label={t(`wealth.orderSide.${value}`)}>
                {t(`wealth.orderSide.${value}`)}
              </md-select-option>
            ))}
          </md-select>

          <md-select
            ref={statusRef}
            variant="outlined"
            label={t('wealth.table.status')}
            placeholder={t('wealth.common.all')}
            value={status}
            clearable
            clear-label={t('wealth.action.clearFilters')}
          >
            {STATUSES.map((value) => (
              <md-select-option key={value} value={value} label={t(`wealth.orderStatus.${value}`)}>
                {t(`wealth.orderStatus.${value}`)}
              </md-select-option>
            ))}
          </md-select>

          {/*
            §7.2: an icon-only control and the tooltip that supplies the meaning
            its glyph lacks. The `aria-label` is still required — a tooltip is a
            description, never a name. It sits with the filters rather than in
            the table's toolbar so it survives the empty state, which is exactly
            when a reader wants it.
          */}
          <md-tooltip text={t('wealth.action.clearFilters')}>
            <md-icon-button
              ref={clearRef}
              icon="filter_alt_off"
              aria-label={t('wealth.action.clearFilters')}
              soft-disabled={!filtered || undefined}
            />
          </md-tooltip>
        </div>

        {rows.length === 0 ? (
          <EmptyState message={t('wealth.empty.orders')} hint={filtered} />
        ) : (
          <BlotterTable
            /*
             * The facet row travels as a NODE rather than as state.
             *
             * It has to render inside `md-table-container`'s `top` band, under
             * the toolbar and outside the scroll port — but the state it drives
             * belongs up here with every other filter. Passing the finished row
             * keeps both where they belong instead of threading three booleans
             * and a setter through the table.
             */
            facets={
              <div
                slot="top"
                ref={facetsRef}
                className="row facet-row"
                role="group"
                aria-label={tx('wealth.trade.filter.group')}
              >
                {FACETS.map((facet) => (
                  <md-chip
                    key={facet.id}
                    data-facet={facet.id}
                    variant="filter"
                    label={tx(facet.labelKey)}
                    selected={facets[facet.id]}
                  />
                ))}
              </div>
            }
            rows={rows}
            // The live query, so the rows can mark what it hit. The state, not
            // the element's value: this is the string the selector was given.
            query={search}
            total={allRows.length}
            bookTotal={totals.orderCount}
            page={safePage}
            rowsPerPage={rowsPerPage}
            onPage={setPage}
            onRowsPerPage={setRowsPerPage}
          />
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------- table */

function BlotterTable({
  facets,
  rows,
  query,
  total,
  bookTotal,
  page,
  rowsPerPage,
  onPage,
  onRowsPerPage,
}: {
  /** The filter-chip row, rendered into the container's `top` band. */
  facets: ReactNode;
  rows: Order[];
  /**
   * The blotter search, for the `<mark>`s only — the rows are already filtered.
   *
   * `getOrders` matches on ticker, instrument name, household name and id, so
   * those are the four cells that can be marked and no others. Marking a fifth
   * would claim the query hit something it never looked at.
   */
  query: string;
  /** Rows the filters kept, across every page. */
  total: number;
  /** Rows on the book, unfiltered. */
  bookTotal: number;
  page: number;
  rowsPerPage: number;
  onPage: (page: number) => void;
  onRowsPerPage: (rowsPerPage: number) => void;
}) {
  const t = useT();
  const paginationRef = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<{ page: number }>>(paginationRef, 'mdPageChange', (event) => {
    onPage(event.detail.page);
  });
  useCustomEvent<CustomEvent<{ rowsPerPage: number }>>(
    paginationRef,
    'mdRowsPerPageChange',
    (event) => {
      // No `onPage(0)` here: `md-table-pagination` has already reset the page and
      // emitted `mdPageChange`, which the handler above consumes. Resetting
      // again is that component's documented anti-pattern.
      onRowsPerPage(event.detail.rowsPerPage);
    },
  );

  const headers: { key: string; label: string; numeric?: boolean }[] = [
    { key: 'id', label: t('wealth.table.id') },
    { key: 'side', label: t('wealth.table.side') },
    { key: 'ticker', label: t('wealth.table.ticker') },
    { key: 'instrument', label: t('wealth.table.instrument') },
    { key: 'household', label: t('wealth.table.household') },
    { key: 'quantity', label: t('wealth.table.quantity'), numeric: true },
    { key: 'filled', label: t('wealth.table.filled'), numeric: true },
    { key: 'orderType', label: t('wealth.table.orderType') },
    { key: 'limit', label: t('wealth.table.limitPrice'), numeric: true },
    { key: 'tif', label: t('wealth.table.timeInForce') },
    { key: 'value', label: t('wealth.table.estimatedValue'), numeric: true },
    { key: 'status', label: t('wealth.table.status') },
    { key: 'created', label: t('wealth.table.created') },
  ];

  return (
    <div className="table-host">
      <md-table-container variant="outlined">
        {/*
          The toolbar goes in the CONTAINER's `top` slot, outside the table's
          scroll port, so it stays put while thirteen columns scroll under it.
        */}
        <md-table-toolbar
          slot="top"
          headline={t('wealth.panel.blotter')}
          supporting-text={t('wealth.common.showing', { shown: total, total: bookTotal })}
        />

        {/*
          A SECOND `top` child, under the toolbar. The band is a flex column, so
          the chips stack beneath the headline and stay outside the scroll port
          with it — the sticky header sticks below them, so the two never meet.
        */}
        {facets}

        <md-table
          label={t('wealth.panel.blotter')}
          column-template={TABLES.orders.columns}
          min-width={TABLES.orders.minWidth}
          // `md-table` ratchets its height by default so paging cannot make the
          // page jump, but that baseline is measured once and never recomputed —
          // a density change then strands the taller height as dead space.
          // Pagination already holds the row count steady here, so live density
          // switching is worth more than the ratchet.
          keep-height="false"
          striped
          // Without these, assistive tech announces "row 1 of 10" on every page
          // instead of the row's position in the whole blotter. `row-count`
          // takes the BODY total; the table adds the head and foot rows itself.
          row-offset={page * rowsPerPage}
          row-count={total}
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              {headers.map((header) => (
                <md-table-cell
                  key={header.key}
                  head
                  scope="col"
                  numeric={header.numeric || undefined}
                >
                  {header.label}
                </md-table-cell>
              ))}
            </md-table-row>
          </md-table-head>

          <md-table-body>
            {rows.map((order) => (
              <md-table-row key={order.id} value={order.id}>
                <md-table-cell>
                  <Highlight text={order.id} query={query} />
                </md-table-cell>
                <md-table-cell>
                  <OrderSideChip side={order.side} />
                </md-table-cell>
                <md-table-cell>
                  <Highlight text={order.ticker} query={query} />
                </md-table-cell>
                <md-table-cell>
                  <Highlight text={order.instrumentName} query={query} />
                </md-table-cell>
                <md-table-cell>
                  <Drill href={route.household(order.householdId)}>
                    <Highlight text={order.householdName} query={query} />
                  </Drill>
                </md-table-cell>
                <md-table-cell numeric>
                  <Num value={order.quantity} />
                </md-table-cell>
                <md-table-cell numeric>
                  <Num value={order.filledQuantity} />
                </md-table-cell>
                <md-table-cell>{t(order.orderTypeKey)}</md-table-cell>
                <md-table-cell numeric>
                  {order.limitPrice === null ? (
                    <span className="muted">{t('wealth.common.na')}</span>
                  ) : (
                    <Money value={order.limitPrice} currency={order.currency} digits={2} />
                  )}
                </md-table-cell>
                <md-table-cell>{t(order.timeInForceKey)}</md-table-cell>
                {/*
                  THE CURRENCY TRAP. `estimatedValue` is in the security's own
                  currency and `estimatedValueEur` is the converted twin. This
                  column compares orders across the book, so the EUR figure leads
                  and the local one sits under it — the other way round would
                  quietly report a CHF ticket as if it were euros.
                */}
                <md-table-cell numeric>
                  <Money value={order.estimatedValueEur} compact />
                  {order.currency === 'EUR' ? null : (
                    <>
                      <br />
                      <span
                        className="muted num"
                        style={{ font: 'var(--md-sys-typescale-label-small-font)' }}
                      >
                        {t.formatCurrency(order.estimatedValue, {
                          currency: order.currency,
                          notation: 'compact',
                        })}
                      </span>
                    </>
                  )}
                </md-table-cell>
                <md-table-cell>
                  <OrderStatusChip status={order.status} />
                </md-table-cell>
                <md-table-cell>
                  <DateText value={order.createdDate} style="short" />
                </md-table-cell>
              </md-table-row>
            ))}
          </md-table-body>
        </md-table>

        <md-table-pagination
          ref={paginationRef}
          slot="bottom"
          count={total}
          page={page}
          rows-per-page={rowsPerPage}
          rows-per-page-options="10,25,all"
          show-first-last
          label-rows-per-page={t('wealth.table.rowsPerPage')}
          label-displayed-rows={t('wealth.table.displayedRows')}
          label-first-page={t('wealth.table.firstPage')}
          label-previous-page={t('wealth.table.previousPage')}
          label-next-page={t('wealth.table.nextPage')}
          label-last-page={t('wealth.table.lastPage')}
          label-all={t('wealth.table.all')}
        />
      </md-table-container>
    </div>
  );
}
