<!--
  Screen 2 — every holding in the book.

  THE SCREEN IS THE ONLY PLACE THAT KNOWS WHAT IS ON SCREEN. It holds the
  filters, the sort of each table and which view is showing, turns all of that
  into ONE call per dataset through `@awc-ui/showcase-kit/wealth`, and hands the
  resulting rows down. The filter bar reports intent, the tables page and render
  — neither of them decides which rows exist.

  TWO VIEWS OF ONE BOOK, so `md-tabs` is legitimate here and only here: holdings
  and the instrument universe are sibling views of the same data, not
  destinations (§7.3). The rail and the bar own destinations, and the shell owns
  those.

  NOTHING IS COMPUTED HERE. Every figure comes from a selector or a derive
  function: the roll-ups beside the table are `regionTotals`, `currencyExposure`
  and `topMovers` over the FILTERED rows, so they answer questions about what
  you are looking at, and `bookHoldings()` is deliberately book-wide, because a
  concentration you have filtered out is still a concentration.
-->
<script lang="ts">
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
  import { pathname } from '$lib/router';
  import { crumbsFor } from '$lib/routes';
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Chips from '$lib/bits/Chips.svelte';
  import Count from '$lib/bits/Count.svelte';
  import KpiTile from '$lib/bits/KpiTile.svelte';
  import Money from '$lib/bits/Money.svelte';
  import Num from '$lib/bits/Num.svelte';
  import Percent from '$lib/bits/Percent.svelte';
  import RatioMeter from '$lib/bits/RatioMeter.svelte';
  import Signed from '$lib/bits/Signed.svelte';
  import { KpiSkeleton, PanelSkeleton, SkelBar, TableSkeleton } from '$lib/skeletons';
  import HoldingsFilters from './HoldingsFilters.svelte';
  import PositionsTable from './PositionsTable.svelte';
  import InstrumentsTable from './InstrumentsTable.svelte';
  import {
    instrumentColumns,
    NO_FILTERS,
    positionColumns,
    type ExportTarget,
    type HoldingsFilterState,
    type InstrumentSortKey,
    type SortState,
  } from './holdings';

  /** Where each table starts, and where a cleared sort returns to. */
  const POSITION_SORT: SortState<PositionSortKey> = { column: 'marketValueEur', order: 'desc' };
  const INSTRUMENT_SORT: SortState<InstrumentSortKey> = { column: 'ticker', order: 'asc' };

  /** How many matches the search panel offers before you commit to the query. */
  const SUGGESTION_COUNT = 6;

  const totals = getBookTotals();
  const risk = concentration();

  let filters: HoldingsFilterState = NO_FILTERS;
  let positionSort = POSITION_SORT;
  let instrumentSort = INSTRUMENT_SORT;
  let tab = 0;
  // md-tab-panels does not lazily render, so the second table would mount with
  // the screen. It is built on first activation instead, which is what the
  // manual asks for and what keeps forty sparklines off the first paint.
  let universeSeen = false;

  /* ------------------------------------------------------- option lists */

  // The whole book, unfiltered: these are the CHOICES, and a choice that
  // disappears because you already narrowed past it is a dead end.
  const bookPositions = getPositions();
  const classOptions = assetClassTotals(bookPositions);
  const regionOptions = regionTotals(bookPositions);
  const currencyOptions = currencyExposure(bookPositions);
  const universe = getInstruments();

  /* ------------------------------------------------------------- rows */

  function filterPositions(
    current: HoldingsFilterState,
    sort: SortState<PositionSortKey>,
  ): Position[] {
    const base: PositionFilter = {
      search: current.search || undefined,
      instrumentId: current.instrumentId ?? undefined,
      region: current.region ?? undefined,
      currency: current.currency ?? undefined,
      sortBy: sort.column,
      sortDir: sort.order,
    };
    const ordered = getPositions(base);
    if (current.assetClasses.length === 0) return ordered;

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
      current.assetClasses.flatMap((assetClass) =>
        getPositions({ ...base, assetClass }).map((position) => position.id),
      ),
    );
    return ordered.filter((position) => keep.has(position.id));
  }

  function filterInstruments(
    current: HoldingsFilterState,
    sort: SortState<InstrumentSortKey>,
  ): Instrument[] {
    /*
     * Picking an instrument in the lookup is a question about ONE security, and
     * on this view the honest answer is that one row. `InstrumentFilter` has no
     * id field, so the answer comes from `getInstrumentById` — still a
     * selector, still the kit's own lookup, never a scan written here.
     */
    if (current.instrumentId) {
      const picked = getInstrumentById(current.instrumentId);
      if (picked) return [picked];
    }

    const base: InstrumentFilter = {
      search: current.search || undefined,
      region: current.region ?? undefined,
      currency: current.currency ?? undefined,
      sortBy: sort.column,
      sortDir: sort.order,
    };
    const ordered = getInstruments(base);
    if (current.assetClasses.length === 0) return ordered;

    const keep = new Set(
      current.assetClasses.flatMap((assetClass) =>
        getInstruments({ ...base, assetClass }).map((instrument) => instrument.id),
      ),
    );
    return ordered.filter((instrument) => keep.has(instrument.id));
  }

  $: positions = filterPositions(filters, positionSort);
  $: instruments = filterInstruments(filters, instrumentSort);

  /* --------------------------------------------------- roll-ups on view */

  $: regionRows = regionTotals(positions);
  $: currencyRows = currencyExposure(positions);
  $: movers = topMovers(positions, 5);
  const concentrated = bookHoldings(10);

  /* ------------------------------------------------------------- tabs */

  function onTabChange(event: Event) {
    const detail = (event as CustomEvent<{ index: number; previousIndex: number }>).detail;
    tab = detail.index;
    if (detail.index === 1) universeSeen = true;
  }

  $: onHoldings = tab === 0;

  $: sortColumns = (onHoldings ? positionColumns($t) : instrumentColumns($t))
    .filter((column) => column.key)
    .map((column) => ({ key: column.key as string, label: column.label }));

  function onSortColumn(key: string) {
    /*
      The menu names a column, not a direction, so the direction comes
      from the same rule the header uses: figures descend, names ascend.
      Re-picking the column already sorted flips it, which is what the
      header does on its second click.
    */
    if (onHoldings) {
      const column = key as PositionSortKey;
      const numeric = positionColumns($t).find((entry) => entry.key === column)?.numeric;
      positionSort =
        positionSort.column === column
          ? { column, order: positionSort.order === 'asc' ? 'desc' : 'asc' }
          : { column, order: numeric ? 'desc' : 'asc' };
    } else {
      const column = key as InstrumentSortKey;
      const numeric = instrumentColumns($t).find((entry) => entry.key === column)?.numeric;
      instrumentSort =
        instrumentSort.column === column
          ? { column, order: instrumentSort.order === 'asc' ? 'desc' : 'asc' }
          : { column, order: numeric ? 'desc' : 'asc' };
    }
  }

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
  function exportCsv(target: ExportTarget) {
    const cell = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    let name: string = target;
    let header: string[] = [];
    let body: (string | number)[][] = [];

    if (target === 'instruments') {
      header = instrumentColumns($t)
        .filter((column) => column.label !== $t('wealth.table.trend'))
        .map((column) => column.label);
      body = instruments.map((instrument) => [
        instrument.ticker,
        instrument.name,
        $t(instrument.typeKey),
        $t(instrument.assetClassKey),
        $t(instrument.sectorKey),
        $t(instrument.regionKey),
        instrument.currency,
        instrument.price,
        instrument.dayChangePct,
        instrument.twelveMonthReturn,
      ]);
    } else if (target === 'concentration') {
      header = [
        $t('wealth.table.ticker'),
        $t('wealth.table.instrument'),
        $t('wealth.table.assetClass'),
        $t('wealth.table.currency'),
        $t('wealth.table.marketValue'),
        $t('wealth.table.bookWeight'),
        $t('wealth.table.unrealisedPl'),
        $t('wealth.kpi.portfolios'),
      ];
      body = concentrated.map((holding) => [
        holding.ticker,
        holding.instrumentName,
        $t(holding.assetClassKey),
        holding.currency,
        holding.marketValue,
        holding.weight,
        holding.unrealisedPl,
        holding.portfolioCount,
      ]);
    } else {
      name = 'holdings';
      header = positionColumns($t).map((column) => column.label);
      body = positions.map((position) => [
        position.ticker,
        position.instrumentName,
        getHouseholdById(position.householdId)?.name ?? '',
        $t(position.assetClassKey),
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
  }

  /* ------------------------------------------------------------ render */

  $: top = concentrated[0];
</script>

<Screen
  crumbs={crumbsFor($pathname)}
  title={$t('wealth.screen.holdings.title')}
  subtitle={$t('wealth.screen.holdings.subtitle', {
    positions: totals.positionCount,
    instruments: totals.instrumentCount,
  })}
>
  <section class="kpi-grid">
    <KpiTile label={$t('wealth.kpi.securities')} hint={$t('wealth.kpi.positions')}>
      <svelte:fragment slot="value"><Money value={totals.securitiesValue} compact /></svelte:fragment>
      <svelte:fragment slot="trailing"><Count value={totals.positionCount} /></svelte:fragment>
    </KpiTile>
    <!--
      The placeholder's "move today" tile summed `dayChangeEur` across the
      book in this file. That is arithmetic in a component, and the fixture
      exposes no book-level day change — so the tile is now the book's
      unrealised P/L, which `getBookTotals()` carries with its own
      percentage. The day's moves have a panel of their own below, built by
      `topMovers`.
    -->
    <KpiTile label={$t('wealth.kpi.unrealisedPl')}>
      <svelte:fragment slot="value"><Signed value={totals.unrealisedPl} compact /></svelte:fragment>
      <svelte:fragment slot="hint">
        <Percent value={totals.unrealisedPlPct} digits={1} sign />
      </svelte:fragment>
    </KpiTile>
    <KpiTile
      label={$t('wealth.kpi.topHolding')}
      hint={top ? `${top.ticker} · ${top.instrumentName}` : $t('wealth.common.na')}
    >
      <svelte:fragment slot="value"><Percent value={risk.topHolding} digits={1} /></svelte:fragment>
      <svelte:fragment slot="trailing">
        {#if top}<Count value={top.portfolioCount} />{/if}
      </svelte:fragment>
    </KpiTile>
    <KpiTile
      label={$t('wealth.kpi.nonBaseCurrency')}
      hint={currencyOptions.map((exposure) => exposure.currency).join(' · ')}
    >
      <svelte:fragment slot="value">
        <Percent value={risk.nonBaseCurrency} digits={1} />
      </svelte:fragment>
    </KpiTile>
  </section>

  <!--
    The filter bar is NOT wrapped in a card. `md-search`'s docked panel and
    both `md-menu`s are popups, and a card is the surface most likely to clip
    one — the same `overflow: hidden` that slices a badge in half.
  -->
  <HoldingsFilters
    state={filters}
    onChange={(next) => (filters = next)}
    {classOptions}
    {regionOptions}
    {currencyOptions}
    instruments={universe}
    suggestions={positions.slice(0, SUGGESTION_COUNT)}
    matchCount={positions.length}
    {sortColumns}
    sortBy={onHoldings ? positionSort.column : instrumentSort.column}
    {onSortColumn}
    defaultTarget={onHoldings ? 'holdings' : 'instruments'}
    onExport={exportCsv}
  />

  <!--
    Two views of one book. `md-tabs` renders no content of its own;
    `md-tab-panels` finds the strip, follows `mdTabChange` and wires the
    tab↔panel ARIA both ways, so the listener here is for the side effect
    only. `sizing="active"` because the two tables differ in height by
    hundreds of pixels and a region sized to the taller one would leave the
    shorter view sitting in a hole.
  -->
  <md-tabs
    aria-label={$t('wealth.screen.holdings.title')}
    active-tab-index={tab}
    tab-width="auto"
    on:mdTabChange={onTabChange}
  >
    <md-tab label={$t('wealth.panel.holdings')}></md-tab>
    <md-tab label={$t('wealth.panel.universe')}></md-tab>
  </md-tabs>

  <md-tab-panels sizing="active">
    <md-tab-panel>
      <PositionsTable
        rows={positions}
        query={filters.search}
        sort={positionSort}
        defaultSort={POSITION_SORT}
        onSort={(next) => (positionSort = next)}
      />
      <!-- `query` is the search itself, so the rows can mark what it matched.
           The screen owns the search; the tables only show where it landed. -->
    </md-tab-panel>
    <md-tab-panel>
      <!--
        A SKELETON, NOT NOTHING, WHILE THE TABLE IS STILL UNMOUNTED.

        `md-tab-panels sizing="active"` takes its height from whichever panel
        is active. `md-tabs` flips that on click, from its own state, in the
        same frame — but this table only mounts on the NEXT update, because
        `universeSeen` is set by the event handler. For exactly one frame the
        active panel was empty, so the container measured 0 and the whole page
        below it jumped up 840px and back. That was the "flicker".

        Keeping the lazy mount is still right — forty sparklines have no
        business rendering on a first paint of a screen you may never open —
        so the panel simply holds the table's SHAPE until the table exists.
        The container always has something to size to, and there is no frame
        at zero.
      -->
      {#if universeSeen}
        <InstrumentsTable
          rows={instruments}
          query={filters.search}
          sort={instrumentSort}
          defaultSort={INSTRUMENT_SORT}
          onSort={(next) => (instrumentSort = next)}
        />
      {:else}
        <TableSkeleton rows={19} />
      {/if}
    </md-tab-panel>
  </md-tab-panels>

  <!-- Everything below reads the FILTERED rows, so the breakdowns answer
       questions about what is on screen rather than about the whole book. -->
  <section class="grid-3">
    <Panel title={$t('wealth.panel.regions')}>
      {#if regionRows.length}
        <div class="stack">
          {#each regionRows as region (region.region)}
            <RatioMeter label={$t(region.regionKey)} fraction={region.weight} color="primary" />
          {/each}
        </div>
      {:else}
        <p class="muted">{$t('wealth.empty.holdings')}</p>
      {/if}
    </Panel>

    <Panel title={$t('wealth.panel.currency')}>
      {#if currencyRows.length}
        <div class="stack">
          {#each currencyRows as exposure (exposure.currency)}
            <!-- The base currency carries no translation risk, so it is not
                 painted in the same colour as the exposures that do. -->
            <RatioMeter
              label={exposure.currency}
              fraction={exposure.weight}
              color={exposure.isBase ? 'secondary' : 'tertiary'}
            />
          {/each}
        </div>
      {:else}
        <p class="muted">{$t('wealth.empty.holdings')}</p>
      {/if}
    </Panel>

    <Panel title={$t('wealth.panel.movers')}>
      {#if movers.length}
        <ul class="timeline">
          {#each movers as mover (mover.position.id)}
            <li>
              <span class="strong">{mover.position.ticker}</span>
              <span class="muted" style="flex: 1 1 auto; min-inline-size: 0">
                {mover.position.instrumentName}
              </span>
              <Signed value={mover.changePct} kind="percent" digits={2} />
              <Signed value={mover.changeEur} compact />
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">{$t('wealth.empty.holdings')}</p>
      {/if}
    </Panel>
  </section>

  <!--
    Book-wide on purpose, and the subtitle says so: two households holding
    the same ETF are ONE concentration, which is exactly what `bookHoldings`
    aggregates and what a position table can never show.
  -->
  <Panel title={$t('wealth.panel.concentration')} subtitle={$t('wealth.table.bookWeight')}>
    <div class="grid-2">
      {#each concentrated as holding (holding.instrumentId)}
        <md-card variant="outlined" full-width class="alloc-row">
          <div class="alloc-row__head">
            <p class="alloc-row__name">
              {holding.ticker} · {holding.instrumentName}
            </p>
            <Chips kind="assetClass" value={holding.assetClass} />
          </div>
          <!-- No percentage here: the meter below carries the weight, and a
               second copy rounded to two digits beside its one would read as
               two different numbers for the same fact. -->
          <div class="alloc-row__figures">
            <span>
              <Money value={holding.marketValue} compact />
            </span>
            <span>
              <Signed value={holding.unrealisedPl} compact />
            </span>
            <span>
              {$t('wealth.kpi.portfolios')} <Num value={holding.portfolioCount} />
            </span>
          </div>
          <!-- The largest holding is a few per cent of the book, so a 0–1
               meter would be an empty bar on every row. The cap is the
               largest weight there is, which makes the rows comparable with
               each other — the only comparison this panel is for. -->
          <RatioMeter
            label={holding.ticker}
            fraction={holding.weight}
            color="primary"
            max={concentrated[0]?.weight || 1}
            thickness={6}
          />
        </md-card>
      {/each}
    </div>
  </Panel>

  <!--
    The placeholder for THIS screen, rather than the generic one.

    `<Screen>` falls back to `ScreenSkeleton` — a KPI row and two panels —
    which is what five of the six screens open with. Holdings is the sixth. It
    opens with six blocks, and the generic shape got three of them wrong: it
    drew a two-panel grid where this screen has a filter bar, a tab bar and an
    840px table, and it stopped before the three-up row and the concentration
    panel entirely.

    Every block below mirrors the real one — same wrapper, same class, same
    count — so the only thing that changes when the data lands is the content
    of the boxes:

      .kpi-grid      four tiles          152px
      .stack         the filter bar      108px  (field row + filter-chip row)
      md-tabs        two tabs             48px
      the table                          840px
      .grid-3        three panels        268px
      the panel      concentration       498px

    ONE ANNOUNCEMENT: every shape here is silent except the first KPI tile,
    which carries the screen's name.
  -->
  <svelte:fragment slot="skeleton">
    <section class="kpi-grid">
      <!-- No `spark`: these four tiles carry a figure, a hint and a count —
           the sparkline belongs to the overview's tiles, not these. -->
      {#each Array.from({ length: 4 }) as _, i (i)}
        <KpiSkeleton
          announce={i === 0}
          label={$t('wealth.screen.holdings.title')}
          spark={false}
        />
      {/each}
    </section>

    <!--
      THE FILTER BAR, AS FIVE FIELDS AND A CHIP ROW — not two solid slabs.

      The `.stack` is 56 + 12 + 40 = 108, the real bar's own two rows,
      measured on it: the field row is 56 because `md-search` is 56 (the two
      outlined fields beside it are 48 and the two buttons 40, and a `.row` is
      as tall as its tallest child), and the chip row is the reservation
      `HoldingsFilters` keeps so that picking a filter never pushes the table
      down.

      Every bar carries the flex basis and the corner of the control it stands
      for, both read off the rendered bar: search 1 1 260px at a 9999px pill,
      the asset-class select 0 1 220px and the instrument lookup 1 1 240px at
      an outlined field's 4px, the export split button 143×40 at 20px, and the
      overflow icon button as a circle.

      THE BARS ARE SHORTER THAN THE CONTROLS THEY STAND FOR, AND THAT IS
      ALLOWED: the placeholder does not occupy layout — it is painted over
      content that keeps its own box — so height here is purely how heavy the
      placeholder LOOKS. Each bar keeps its control's flex and corner (widths
      and positions stay exact) and is drawn at 32px, centred in the row by
      `.row`'s own `align-items: center`. The circle stays square because a
      squashed circle reads as a different control.
    -->
    <div class="stack">
      <div class="row" style="min-block-size: 56px">
        <SkelBar radius="9999px" height="32px" flex="1 1 260px" />
        <SkelBar radius="4px" height="32px" flex="0 1 220px" />
        <SkelBar radius="4px" height="32px" flex="1 1 240px" />
        <SkelBar radius="16px" height="32px" width="143px" />
        <div class="skel skel--circle" style="inline-size: 32px; block-size: 32px" />
      </div>

      <!--
        THE CHIP ROW IS A RESERVATION, and the pills say what it reserves.
        Three of them rather than a bar: the row holds `md-chip variant="input"`
        tokens with an 8px corner, so three short pills read as "your filters
        will appear here" where a 662px slab read as content about to land.
        No `min-block-size`: the placeholder does not occupy layout, so the
        row is simply as tall as the pills in it.
      -->
      <div class="row">
        <SkelBar radius="8px" height="24px" width="104px" />
        <SkelBar radius="8px" height="24px" width="76px" />
        <SkelBar radius="8px" height="24px" width="120px" />
      </div>
    </div>

    <!--
      The tab bar. A single bar rather than two tab-shaped blocks: the real one
      is a continuous band with a divider under it, and two stubs would read as
      buttons. 28px and nothing around it — the 48px band the real `md-tabs`
      occupies is already held by the content underneath.
    -->
    <div class="skel" style="inline-size: 100%; block-size: 28px" />

    <!-- 19 rows at 40px is the height the positions table opens at, inside the
         same panel chrome `TableSkeleton` draws for every other table. -->
    <TableSkeleton height="750px" />

    <section class="grid-3">
      {#each Array.from({ length: 3 }) as _, i (i)}
        <PanelSkeleton height="178px" />
      {/each}
    </section>

    <!-- Concentration: one block at the height of the ten cards it holds,
         following the same rule `TableSkeleton` states — a grid of uniform
         tiles is the same grey rectangle with more elements in the
         accessibility tree. -->
    <PanelSkeleton height="408px" />
  </svelte:fragment>
</Screen>
