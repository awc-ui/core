/**
 * Screen 2 — every holding in the book.
 *
 * THE SCREEN IS THE ONLY PLACE THAT KNOWS WHAT IS ON SCREEN. It holds the
 * filters, the sort of each table and which view is showing, turns all of that
 * into ONE call per dataset through `@awc-ui/showcase-kit/wealth`, and hands the
 * resulting rows down. The filter bar reports intent, the tables page and render
 * — neither of them decides which rows exist.
 *
 * TWO VIEWS OF ONE BOOK, so `md-tabs` is legitimate here and only here: holdings
 * and the instrument universe are sibling views of the same data, not
 * destinations (§7.3). The rail and the bar own destinations, and the shell owns
 * those.
 *
 * NOTHING IS COMPUTED HERE. Every figure comes from a selector or a derive
 * function: the roll-ups beside the table are `regionTotals`, `currencyExposure`
 * and `topMovers` over the FILTERED rows, so they answer questions about what
 * you are looking at, and `bookHoldings()` is deliberately book-wide, because a
 * concentration you have filtered out is still a concentration.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  assetClassTotals,
  bookHoldings,
  concentration,
  currencyExposure,
  getBookTotals,
  getHouseholdById,
  getInstrumentById,
  getInstruments,
  getPositions,
  regionTotals,
  REPORTING_DATE,
  topMovers,
  type Instrument,
  type InstrumentFilter,
  type Position,
  type PositionFilter,
  type PositionSortKey,
} from '@awc-ui/showcase-kit/wealth';
import { crumbsFor } from '@/lib/routes';
import { usePathname } from '@/lib/router';
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '../elements';
import { Panel, Screen } from '../Shell';
import { AssetClassChip, Count, KpiTile, Money, Num, Percent, RatioMeter, Signed } from '../bits';
import {
  HoldingsFilters,
  NO_FILTERS,
  type ExportTarget,
  type HoldingsFilterState,
} from './HoldingsFilters';
import {
  InstrumentsTable,
  PositionsTable,
  instrumentColumns,
  positionColumns,
  type InstrumentSortKey,
  type SortState,
} from './HoldingsTables';
import { Bar, KpiSkeleton, PanelSkeleton, TableSkeleton } from '../skeletons';

/** Where each table starts, and where a cleared sort returns to. */
const POSITION_SORT: SortState<PositionSortKey> = { column: 'marketValueEur', order: 'desc' };
const INSTRUMENT_SORT: SortState<InstrumentSortKey> = { column: 'ticker', order: 'asc' };

/** How many matches the search panel offers before you commit to the query. */
const SUGGESTION_COUNT = 6;

export function HoldingsScreen() {
  const t = useT();
  const pathname = usePathname();
  const totals = getBookTotals();
  const risk = concentration();

  const [filters, setFilters] = useState<HoldingsFilterState>(NO_FILTERS);
  const [positionSort, setPositionSort] = useState(POSITION_SORT);
  const [instrumentSort, setInstrumentSort] = useState(INSTRUMENT_SORT);
  const [tab, setTab] = useState(0);
  // md-tab-panels does not lazily render, so the second table would mount with
  // the screen. It is built on first activation instead, which is what the
  // manual asks for and what keeps forty sparklines off the first paint.
  const [universeSeen, setUniverseSeen] = useState(false);

  /* ------------------------------------------------------- option lists */

  // The whole book, unfiltered: these are the CHOICES, and a choice that
  // disappears because you already narrowed past it is a dead end.
  const bookPositions = useMemo(() => getPositions(), []);
  const classOptions = useMemo(() => assetClassTotals(bookPositions), [bookPositions]);
  const regionOptions = useMemo(() => regionTotals(bookPositions), [bookPositions]);
  const currencyOptions = useMemo(() => currencyExposure(bookPositions), [bookPositions]);
  const universe = useMemo(() => getInstruments(), []);

  /* ------------------------------------------------------------- rows */

  const positions = useMemo<Position[]>(() => {
    const base: PositionFilter = {
      search: filters.search || undefined,
      instrumentId: filters.instrumentId ?? undefined,
      region: filters.region ?? undefined,
      currency: filters.currency ?? undefined,
      sortBy: positionSort.column,
      sortDir: positionSort.order,
    };
    const ordered = getPositions(base);
    if (filters.assetClasses.length === 0) return ordered;

    /*
     * A UNION, AND THE KIT STILL DECIDES WHAT IS IN IT.
     *
     * `PositionFilter.assetClass` takes one class, and the multi-select offers
     * several. Rather than re-implementing "the position's class is one of
     * these" in a component — the exact drift the kit exists to prevent — the
     * selector is asked once per chosen class and the answers are unioned by
     * id. The ORDER still comes from the single ordered call above, so the
     * union cannot quietly re-sort the table either.
     */
    const keep = new Set(
      filters.assetClasses.flatMap((assetClass) =>
        getPositions({ ...base, assetClass }).map((position) => position.id),
      ),
    );
    return ordered.filter((position) => keep.has(position.id));
  }, [filters, positionSort]);

  const instruments = useMemo<Instrument[]>(() => {
    /*
     * Picking an instrument in the lookup is a question about ONE security, and
     * on this view the honest answer is that one row. `InstrumentFilter` has no
     * id field, so the answer comes from `getInstrumentById` — still a
     * selector, still the kit's own lookup, never a scan written here.
     */
    if (filters.instrumentId) {
      const picked = getInstrumentById(filters.instrumentId);
      if (picked) return [picked];
    }

    const base: InstrumentFilter = {
      search: filters.search || undefined,
      region: filters.region ?? undefined,
      currency: filters.currency ?? undefined,
      sortBy: instrumentSort.column,
      sortDir: instrumentSort.order,
    };
    const ordered = getInstruments(base);
    if (filters.assetClasses.length === 0) return ordered;

    const keep = new Set(
      filters.assetClasses.flatMap((assetClass) =>
        getInstruments({ ...base, assetClass }).map((instrument) => instrument.id),
      ),
    );
    return ordered.filter((instrument) => keep.has(instrument.id));
  }, [filters, instrumentSort]);

  /* --------------------------------------------------- roll-ups on view */

  const regionRows = useMemo(() => regionTotals(positions), [positions]);
  const currencyRows = useMemo(() => currencyExposure(positions), [positions]);
  const movers = useMemo(() => topMovers(positions, 5), [positions]);
  const concentrated = useMemo(() => bookHoldings(10), []);

  /* ------------------------------------------------------------- tabs */

  const tabsRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ index: number; previousIndex: number }>>(
    tabsRef,
    'mdTabChange',
    (event) => {
      setTab(event.detail.index);
      if (event.detail.index === 1) setUniverseSeen(true);
    },
  );

  const onHoldings = tab === 0;

  /* ----------------------------------------------------------- export */

  /*
   * A REAL FILE, of exactly what is on screen.
   *
   * The rows are the filtered set — not the visible page — because "export the
   * view" means the selection you made, not the twenty-five rows you happen to
   * be looking at. Values go out RAW: an ISO date and an unformatted number
   * survive a spreadsheet import in any locale, where a grouped, localised
   * figure does not. Headers are translated, because a human reads those.
   *
   * The filename is stamped with the fixture's frozen reporting date, so two
   * runs of this app produce two identical files — there is no clock here, as
   * there is nowhere else in this vertical.
   */
  const exportCsv = useCallback(
    (target: ExportTarget) => {
      const cell = (value: string | number) => {
        const text = String(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };

      let name = target;
      let header: string[] = [];
      let body: (string | number)[][] = [];

      if (target === 'instruments') {
        header = instrumentColumns(t)
          .filter((column) => column.label !== t('wealth.table.trend'))
          .map((column) => column.label);
        body = instruments.map((instrument) => [
          instrument.ticker,
          instrument.name,
          t(instrument.typeKey),
          t(instrument.assetClassKey),
          t(instrument.sectorKey),
          t(instrument.regionKey),
          instrument.currency,
          instrument.price,
          instrument.dayChangePct,
          instrument.twelveMonthReturn,
        ]);
      } else if (target === 'concentration') {
        header = [
          t('wealth.table.ticker'),
          t('wealth.table.instrument'),
          t('wealth.table.assetClass'),
          t('wealth.table.currency'),
          t('wealth.table.marketValue'),
          t('wealth.table.bookWeight'),
          t('wealth.table.unrealisedPl'),
          t('wealth.kpi.portfolios'),
        ];
        body = concentrated.map((holding) => [
          holding.ticker,
          holding.instrumentName,
          t(holding.assetClassKey),
          holding.currency,
          holding.marketValue,
          holding.weight,
          holding.unrealisedPl,
          holding.portfolioCount,
        ]);
      } else {
        name = 'holdings';
        header = positionColumns(t).map((column) => column.label);
        body = positions.map((position) => [
          position.ticker,
          position.instrumentName,
          getHouseholdById(position.householdId)?.name ?? '',
          t(position.assetClassKey),
          position.currency,
          position.quantity,
          position.price,
          position.marketValueEur,
          position.unrealisedPl,
          position.unrealisedPlPct,
          position.weight,
          position.dayChangePct,
        ]);
      }

      const csv = [header, ...body].map((row) => row.map(cell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}-${REPORTING_DATE}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [t, positions, instruments, concentrated],
  );

  /* ------------------------------------------------------------ render */

  const top = concentrated[0];

  return (
    <Screen
      crumbs={crumbsFor(pathname)}
      title={t('wealth.screen.holdings.title')}
      subtitle={t('wealth.screen.holdings.subtitle', {
        positions: totals.positionCount,
        instruments: totals.instrumentCount,
      })}
      skeleton={<HoldingsSkeleton label={t('wealth.screen.holdings.title')} />}
    >
      <section className="kpi-grid">
        <KpiTile
          label={t('wealth.kpi.securities')}
          value={<Money value={totals.securitiesValue} compact />}
          hint={t('wealth.kpi.positions')}
          trailing={<Count value={totals.positionCount} />}
        />
        {/*
          The placeholder's "move today" tile summed `dayChangeEur` across the
          book in this file. That is arithmetic in a component, and the fixture
          exposes no book-level day change — so the tile is now the book's
          unrealised P/L, which `getBookTotals()` carries with its own
          percentage. The day's moves have a panel of their own below, built by
          `topMovers`.
        */}
        <KpiTile
          label={t('wealth.kpi.unrealisedPl')}
          value={<Signed value={totals.unrealisedPl} compact />}
          hint={<Percent value={totals.unrealisedPlPct} digits={1} sign />}
        />
        <KpiTile
          label={t('wealth.kpi.topHolding')}
          value={<Percent value={risk.topHolding} digits={1} />}
          hint={top ? `${top.ticker} · ${top.instrumentName}` : t('wealth.common.na')}
          trailing={top ? <Count value={top.portfolioCount} /> : undefined}
        />
        <KpiTile
          label={t('wealth.kpi.nonBaseCurrency')}
          value={<Percent value={risk.nonBaseCurrency} digits={1} />}
          hint={currencyOptions.map((exposure) => exposure.currency).join(' · ')}
        />
      </section>

      {/*
        The filter bar is NOT wrapped in a card. `md-search`'s docked panel and
        both `md-menu`s are popups, and a card is the surface most likely to clip
        one — the same `overflow: hidden` that slices a badge in half.
      */}
      <HoldingsFilters
        state={filters}
        onChange={setFilters}
        classOptions={classOptions}
        regionOptions={regionOptions}
        currencyOptions={currencyOptions}
        instruments={universe}
        suggestions={positions.slice(0, SUGGESTION_COUNT)}
        matchCount={positions.length}
        sortColumns={(onHoldings ? positionColumns(t) : instrumentColumns(t))
          .filter((column) => column.key)
          .map((column) => ({ key: column.key as string, label: column.label }))}
        sortBy={onHoldings ? positionSort.column : instrumentSort.column}
        onSortColumn={(key) => {
          /*
            The menu names a column, not a direction, so the direction comes
            from the same rule the header uses: figures descend, names ascend.
            Re-picking the column already sorted flips it, which is what the
            header does on its second click.
          */
          if (onHoldings) {
            const column = key as PositionSortKey;
            const numeric = positionColumns(t).find((entry) => entry.key === column)?.numeric;
            setPositionSort((current) =>
              current.column === column
                ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
                : { column, order: numeric ? 'desc' : 'asc' },
            );
          } else {
            const column = key as InstrumentSortKey;
            const numeric = instrumentColumns(t).find((entry) => entry.key === column)?.numeric;
            setInstrumentSort((current) =>
              current.column === column
                ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
                : { column, order: numeric ? 'desc' : 'asc' },
            );
          }
        }}
        defaultTarget={onHoldings ? 'holdings' : 'instruments'}
        onExport={exportCsv}
      />

      {/*
        Two views of one book. `md-tabs` renders no content of its own;
        `md-tab-panels` finds the strip, follows `mdTabChange` and wires the
        tab↔panel ARIA both ways, so the listener above is for the side effect
        only. `sizing="active"` because the two tables differ in height by
        hundreds of pixels and a region sized to the taller one would leave the
        shorter view sitting in a hole.
      */}
      <md-tabs
        ref={tabsRef}
        aria-label={t('wealth.screen.holdings.title')}
        active-tab-index={tab}
        tab-width="auto"
      >
        <md-tab label={t('wealth.panel.holdings')} />
        <md-tab label={t('wealth.panel.universe')} />
      </md-tabs>

      <md-tab-panels sizing="active">
        <md-tab-panel>
          <PositionsTable
            rows={positions}
            // The query itself, so the rows can mark what it matched. The
            // screen owns the search; the tables only show where it landed.
            query={filters.search}
            sort={positionSort}
            defaultSort={POSITION_SORT}
            onSort={setPositionSort}
          />
        </md-tab-panel>
        <md-tab-panel>
          {/*
            A SKELETON, NOT `null`, WHILE THE TABLE IS STILL UNMOUNTED.

            `md-tab-panels sizing="active"` takes its height from whichever panel
            is active. `md-tabs` flips that on click, from its own state, in the
            same frame — but React only mounts this table on the NEXT commit,
            because `universeSeen` is set by the event handler. For exactly one
            frame the active panel was empty, so the container measured 0 and the
            whole page below it jumped up 840px and back. That was the "flicker".

            Keeping the lazy mount is still right — forty sparklines have no
            business rendering on a first paint of a screen you may never open —
            so the panel simply holds the table's SHAPE until the table exists.
            The container always has something to size to, and there is no frame
            at zero.
          */}
          {universeSeen ? (
            <InstrumentsTable
              rows={instruments}
              query={filters.search}
              sort={instrumentSort}
              defaultSort={INSTRUMENT_SORT}
              onSort={setInstrumentSort}
            />
          ) : (
            <TableSkeleton rows={19} />
          )}
        </md-tab-panel>
      </md-tab-panels>

      {/* Everything below reads the FILTERED rows, so the breakdowns answer
          questions about what is on screen rather than about the whole book. */}
      <section className="grid-3">
        <Panel title={t('wealth.panel.regions')}>
          {regionRows.length ? (
            <div className="stack">
              {regionRows.map((region) => (
                <RatioMeter
                  key={region.region}
                  label={t(region.regionKey)}
                  fraction={region.weight}
                  color="primary"
                />
              ))}
            </div>
          ) : (
            <p className="muted">{t('wealth.empty.holdings')}</p>
          )}
        </Panel>

        <Panel title={t('wealth.panel.currency')}>
          {currencyRows.length ? (
            <div className="stack">
              {currencyRows.map((exposure) => (
                <RatioMeter
                  key={exposure.currency}
                  label={exposure.currency}
                  fraction={exposure.weight}
                  // The base currency carries no translation risk, so it is not
                  // painted in the same colour as the exposures that do.
                  color={exposure.isBase ? 'secondary' : 'tertiary'}
                />
              ))}
            </div>
          ) : (
            <p className="muted">{t('wealth.empty.holdings')}</p>
          )}
        </Panel>

        <Panel title={t('wealth.panel.movers')}>
          {movers.length ? (
            <ul className="timeline">
              {movers.map((mover) => (
                <li key={mover.position.id}>
                  <span className="strong">{mover.position.ticker}</span>
                  <span className="muted" style={{ flex: '1 1 auto', minInlineSize: 0 }}>
                    {mover.position.instrumentName}
                  </span>
                  <Signed value={mover.changePct} kind="percent" digits={2} />
                  <Signed value={mover.changeEur} compact />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('wealth.empty.holdings')}</p>
          )}
        </Panel>
      </section>

      {/*
        Book-wide on purpose, and the subtitle says so: two households holding
        the same ETF are ONE concentration, which is exactly what `bookHoldings`
        aggregates and what a position table can never show.
      */}
      <Panel title={t('wealth.panel.concentration')} subtitle={t('wealth.table.bookWeight')}>
        <div className="grid-2">
          {concentrated.map((holding) => (
            <md-card variant="outlined" full-width class="alloc-row" key={holding.instrumentId}>
              <div className="alloc-row__head">
                <p className="alloc-row__name">
                  {holding.ticker} · {holding.instrumentName}
                </p>
                <AssetClassChip assetClass={holding.assetClass} />
              </div>
              {/* No percentage here: the meter below carries the weight, and a
                  second copy rounded to two digits beside its one would read as
                  two different numbers for the same fact. */}
              <div className="alloc-row__figures">
                <span>
                  <Money value={holding.marketValue} compact />
                </span>
                <span>
                  <Signed value={holding.unrealisedPl} compact />
                </span>
                <span>
                  {t('wealth.kpi.portfolios')} <Num value={holding.portfolioCount} />
                </span>
              </div>
              <RatioMeter
                label={holding.ticker}
                fraction={holding.weight}
                color="primary"
                // The largest holding is a few per cent of the book, so a 0–1
                // meter would be an empty bar on every row. The cap is the
                // largest weight there is, which makes the rows comparable with
                // each other — the only comparison this panel is for.
                max={concentrated[0]?.weight || 1}
                thickness={6}
              />
            </md-card>
          ))}
        </div>
      </Panel>
    </Screen>
  );
}

/* ---------------------------------------------------------------- skeleton */

/**
 * The placeholder for THIS screen, rather than the generic one.
 *
 * `<Screen>` falls back to `ScreenSkeleton` — a KPI row and two panels — which
 * is what five of the six screens open with. Holdings is the sixth. It opens
 * with six blocks, and the generic shape got three of them wrong: it drew a
 * two-panel grid where this screen has a filter bar, a tab bar and an 840px
 * table, and it stopped before the three-up row and the concentration panel
 * entirely. The swap therefore moved the whole page, which is precisely what a
 * skeleton exists to prevent.
 *
 * Every block below mirrors the real one — same wrapper, same class, same
 * count — so the only thing that changes when the data lands is the content of
 * the boxes:
 *
 *   .kpi-grid      four tiles          152px
 *   .stack         the filter bar      108px  (field row + filter-chip row)
 *   md-tabs        two tabs             48px
 *   the table                          840px
 *   .grid-3        three panels        268px
 *   the panel      concentration       498px
 *
 * ONE ANNOUNCEMENT. `md-skeleton` is a polite live region by default, so a
 * screenful of them is a dozen announcements for one event. Every shape here
 * takes `announce` off; the first KPI tile carries the screen's name and is the
 * only one that speaks.
 */
function HoldingsSkeleton({ label }: { label: string }) {
  return (
    <>
      <section className="kpi-grid">
        {/* No `spark`: these four tiles carry a figure, a hint and a count —
            the sparkline belongs to the overview's tiles, not these. */}
        {Array.from({ length: 4 }, (_, i) => (
          <KpiSkeleton key={i} announce={i === 0} label={label} spark={false} />
        ))}
      </section>

      {/*
        THE FILTER BAR, AS FIVE FIELDS AND A CHIP ROW — not two solid slabs.

        It was two full-bleed 48px bars, which came to the right 108px and read
        as twice the weight of what replaces them: a 662px block standing in for
        a row that is usually EMPTY is a heavier promise than the bar can keep.

        The height is unchanged and has to be, so the `.stack` is still 56 + 12 +
        40 = 108. Those are the real bar's own two rows, measured on it: the
        field row is 56 because `md-search` is 56 (the two outlined fields beside
        it are 48 and the two buttons 40, and a `.row` is as tall as its tallest
        child), and the chip row is the 40px `min-block-size` `HoldingsFilters`
        reserves so that picking a filter never pushes the table down.

        Every bar carries the flex basis and the corner of the control it stands
        for, both read off the rendered bar: search 1 1 260px at a 9999px pill,
        the asset-class select 0 1 220px and the instrument lookup 1 1 240px at
        an outlined field's 4px, the export split button 143×40 at 20px, and the
        overflow icon button as a 40px circle.
      */}
      {/*
        THE BARS ARE SHORTER THAN THE CONTROLS THEY STAND FOR, AND THAT IS NOW
        ALLOWED.

        They used to be 56 / 48 / 48 / 40 / 40 — each control's exact height —
        because the placeholder occupied layout and any pixel out moved the
        table. It does not occupy layout any more: it is painted over content
        that keeps its own box the whole time, so height here is purely how
        heavy the placeholder LOOKS. At full height these read as five solid
        slabs pressing on the page rather than as an outline of what is coming.

        So each bar keeps the flex basis and the corner of its control — the
        widths and positions are still exact — and is drawn at 32px, centred in
        the row by `.row`'s own `align-items: center`. The circle stays square
        because a squashed circle reads as a different control.
      */}
      <div className="stack">
        <div className="row" style={{ minBlockSize: '56px' }}>
          <Bar radius="9999px" height="32px" flex="1 1 260px" />
          <Bar radius="4px" height="32px" flex="0 1 220px" />
          <Bar radius="4px" height="32px" flex="1 1 240px" />
          <Bar radius="16px" height="32px" width="143px" />
          <div className="skel skel--circle" style={{ inlineSize: '32px', blockSize: '32px' }} />
        </div>

        {/*
          THE CHIP ROW IS A RESERVATION, and the pills say what it reserves.
          Three of them rather than a bar: the row holds `md-chip variant="input"`
          tokens at 32px with an 8px corner, so three short pills read as "your
          filters will appear here" where a 662px slab read as content about to
          land.

          NO `min-block-size`. It used to track the real row's 32px so the two
          were exactly the same height; the placeholder does not occupy layout
          any more, so the row is simply as tall as the pills in it.
        */}
        <div className="row">
          <Bar radius="8px" height="24px" width="104px" />
          <Bar radius="8px" height="24px" width="76px" />
          <Bar radius="8px" height="24px" width="120px" />
        </div>
      </div>

      {/*
        The tab bar. A single bar rather than two tab-shaped blocks: the real one
        is a continuous band with a divider under it, and two stubs would read as
        buttons.

        A 28px bar and nothing around it. It used to be that bar centred inside a
        48px band, because `md-tabs` occupies 48 and every block here had to
        match the real layout to the pixel or the table moved. The placeholder is
        painted over content that keeps its own box now, so the band was 20px of
        empty space buying nothing.
      */}
      <div className="skel" style={{ inlineSize: '100%', blockSize: '28px' }} />

      {/* 19 rows at 40px is the 760px the positions table opens at, inside the
          same panel chrome `TableSkeleton` draws for every other table. */}
      <TableSkeleton height="750px" />

      <section className="grid-3">
        {Array.from({ length: 3 }, (_, i) => (
          <PanelSkeleton key={i} height="178px" />
        ))}
      </section>

      {/* Concentration: one block at the height of the ten cards it holds,
          following the same rule `TableSkeleton` states — a grid of uniform
          tiles is the same grey rectangle with more elements in the
          accessibility tree. */}
      <PanelSkeleton height="408px" />
    </>
  );
}
