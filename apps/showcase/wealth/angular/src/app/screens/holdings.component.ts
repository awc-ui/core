import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
  type CurrencyExposure,
  type Instrument,
  type InstrumentFilter,
  type Mover,
  type Position,
  type PositionFilter,
  type PositionSortKey,
  type RegionTotal,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import {
  ChipComponent,
  CountComponent,
  KpiTileComponent,
  MoneyComponent,
  NumComponent,
  PercentComponent,
  RatioMeterComponent,
  SignedComponent,
} from '../components/bits.component';
import {
  KpiSkeletonComponent,
  PanelSkeletonComponent,
  SkelBarComponent,
  TableSkeletonComponent,
} from '../components/skeletons.component';
import { crumbsFor, type CrumbSpec } from '../lib/routes';
import {
  HoldingsFiltersComponent,
  NO_FILTERS,
  type ExportTarget,
  type HoldingsFilterState,
  type SortSpec,
} from './holdings-filters.component';
import {
  instrumentColumns,
  InstrumentsTableComponent,
  positionColumns,
  PositionsTableComponent,
  type InstrumentSortKey,
  type SortState,
} from './holdings-tables.component';

/**
 * Screen 2 — every holding in the book.
 *
 * THE SCREEN IS THE ONLY PLACE THAT KNOWS WHAT IS ON SCREEN. It holds the
 * filters, the sort of each table and which view is showing, turns all of that
 * into ONE call per dataset through `@awc-ui/showcase-kit/wealth`, and hands
 * the resulting rows down. The filter bar reports intent, the tables page and
 * render — neither of them decides which rows exist.
 *
 * TWO VIEWS OF ONE BOOK, so `md-tabs` is legitimate here and only here:
 * holdings and the instrument universe are sibling views of the same data, not
 * destinations. The rail and the bar own destinations, and the shell owns
 * those.
 *
 * NOTHING IS COMPUTED HERE. Every figure comes from a selector or a derive
 * function: the roll-ups beside the table are `regionTotals`,
 * `currencyExposure` and `topMovers` over the FILTERED rows, so they answer
 * questions about what you are looking at, and `bookHoldings()` is
 * deliberately book-wide, because a concentration you have filtered out is
 * still a concentration.
 */

/** Where each table starts, and where a cleared sort returns to. */
const POSITION_SORT: SortState<PositionSortKey> = { column: 'marketValueEur', order: 'desc' };
const INSTRUMENT_SORT: SortState<InstrumentSortKey> = { column: 'ticker', order: 'asc' };

/** How many matches the search panel offers before you commit to the query. */
const SUGGESTION_COUNT = 6;

@Component({
  selector: 'awc-holdings-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    ChipComponent,
    CountComponent,
    KpiTileComponent,
    MoneyComponent,
    NumComponent,
    PercentComponent,
    RatioMeterComponent,
    SignedComponent,
    KpiSkeletonComponent,
    PanelSkeletonComponent,
    SkelBarComponent,
    TableSkeletonComponent,
    HoldingsFiltersComponent,
    PositionsTableComponent,
    InstrumentsTableComponent,
  ],
  template: `
    <awc-screen
      [title]="t('wealth.screen.holdings.title')"
      [subtitle]="
        t('wealth.screen.holdings.subtitle', {
          positions: totals.positionCount,
          instruments: totals.instrumentCount
        })
      "
      [crumbs]="crumbs"
      [customSkeleton]="true"
    >
      <!--
        The placeholder for THIS screen, rather than the generic one: it opens
        with six blocks — a KPI row, the filter bar, the tab strip, an 840px
        table, a three-up row and the concentration panel — and the generic
        "KPI row and two panels" got three of them wrong. Every block mirrors
        the real one (same wrapper, same class, same count); the heights are
        measured off the React reference, not invented. Exactly ONE shape
        announces — the first KPI tile, with the screen's name.
      -->
      <ng-container ngProjectAs="[skeleton]">
        <section class="kpi-grid">
          <!-- No spark: these four tiles carry a figure, a hint and a count —
               the sparkline belongs to the overview's tiles, not these. -->
          @for (i of [0, 1, 2, 3]; track i) {
            <awc-kpi-skeleton
              [announce]="i === 0"
              [label]="t('wealth.screen.holdings.title')"
              [spark]="false"
            />
          }
        </section>

        <!--
          THE FILTER BAR, AS FIVE FIELDS AND A CHIP ROW — not two solid slabs.
          The .stack is the real bar's own two rows: the field row reserves 56
          because md-search is 56 (a .row is as tall as its tallest child), and
          each bar keeps the flex basis and the measured corner of the control
          it stands for — search a 9999px pill, the two outlined fields 4px,
          the split button 20px, the overflow button a circle. The bars are
          drawn at 32px, SHORTER than their controls: the placeholder is
          painted over content that keeps its own box, so height here is only
          how heavy it looks, and full-height slabs press on the page.
        -->
        <div class="stack">
          <div class="row" style="min-block-size: 56px">
            <awc-skel-bar radius="9999px" height="32px" flex="1 1 260px" />
            <awc-skel-bar radius="4px" height="32px" flex="0 1 220px" />
            <awc-skel-bar radius="4px" height="32px" flex="1 1 240px" />
            <awc-skel-bar radius="16px" height="32px" width="143px" />
            <div class="skel skel--circle" style="inline-size: 32px; block-size: 32px"></div>
          </div>

          <!-- THE CHIP ROW IS A RESERVATION, and the pills say what it
               reserves: three short 24px pills read as "your filters will
               appear here" where a full-width slab read as content about to
               land. -->
          <div class="row">
            <awc-skel-bar radius="8px" height="24px" width="104px" />
            <awc-skel-bar radius="8px" height="24px" width="76px" />
            <awc-skel-bar radius="8px" height="24px" width="120px" />
          </div>
        </div>

        <!-- The tab bar: a single bar rather than two tab-shaped blocks — the
             real one is a continuous band with a divider under it, and two
             stubs would read as buttons. -->
        <div class="skel" style="inline-size: 100%; block-size: 28px"></div>

        <!-- 19 rows at 40px is the 760px the positions table opens at, inside
             the same panel chrome every other table skeleton draws. -->
        <awc-table-skeleton height="750px" />

        <section class="grid-3">
          @for (i of [0, 1, 2]; track i) {
            <awc-panel-skeleton height="178px" />
          }
        </section>

        <!-- Concentration: one block at the height of the ten cards it holds —
             a grid of uniform tiles is the same grey rectangle with more
             elements in the accessibility tree. -->
        <awc-panel-skeleton height="408px" />
      </ng-container>

      <section class="kpi-grid">
        <awc-kpi-tile [label]="t('wealth.kpi.securities')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <span awcMoney [value]="totals.securitiesValue" [compact]="true"></span>
          </ng-container>
          <ng-container ngProjectAs="[hint]">{{ t('wealth.kpi.positions') }}</ng-container>
          <ng-container ngProjectAs="[trailing]">
            <md-chip awcCount [value]="totals.positionCount"></md-chip>
          </ng-container>
        </awc-kpi-tile>
        <!--
          The "move today" tile the placeholder had summed dayChangeEur across
          the book in this file. That is arithmetic in a component, and the
          fixture exposes no book-level day change — so the tile is the book's
          unrealised P/L, which getBookTotals() carries with its own
          percentage. The day's moves have a panel of their own below, built
          by topMovers.
        -->
        <awc-kpi-tile [label]="t('wealth.kpi.unrealisedPl')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <bdi awcSigned [value]="totals.unrealisedPl" [compact]="true"></bdi>
          </ng-container>
          <ng-container ngProjectAs="[hint]">
            <span awcPercent [value]="totals.unrealisedPlPct" [digits]="1" [sign]="true"></span>
          </ng-container>
        </awc-kpi-tile>
        <awc-kpi-tile [label]="t('wealth.kpi.topHolding')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <span awcPercent [value]="risk.topHolding" [digits]="1"></span>
          </ng-container>
          <ng-container ngProjectAs="[hint]">
            {{ top ? top.ticker + ' · ' + top.instrumentName : t('wealth.common.na') }}
          </ng-container>
          <ng-container ngProjectAs="[trailing]">
            @if (top) {
              <md-chip awcCount [value]="top.portfolioCount"></md-chip>
            }
          </ng-container>
        </awc-kpi-tile>
        <awc-kpi-tile [label]="t('wealth.kpi.nonBaseCurrency')" [hasFoot]="true">
          <ng-container ngProjectAs="[value]">
            <span awcPercent [value]="risk.nonBaseCurrency" [digits]="1"></span>
          </ng-container>
          <ng-container ngProjectAs="[hint]">{{ currencyHint }}</ng-container>
        </awc-kpi-tile>
      </section>

      <!--
        The filter bar is NOT wrapped in a card. md-search's docked panel and
        both md-menus are popups, and a card is the surface most likely to
        clip one — the same overflow: hidden that slices a badge in half.
      -->
      <awc-holdings-filters
        [state]="filters"
        [classOptions]="classOptions"
        [regionOptions]="regionOptions"
        [currencyOptions]="currencyOptions"
        [instruments]="universe"
        [suggestions]="suggestions"
        [matchCount]="positions.length"
        [sortColumns]="sortColumns"
        [sortBy]="sortBy"
        [defaultTarget]="defaultTarget"
        (stateChange)="onFilters($event)"
        (sortPick)="onSortColumn($event)"
        (exportPick)="exportCsv($event)"
      />

      <!--
        Two views of one book. md-tabs renders no content of its own;
        md-tab-panels finds the strip, follows mdTabChange and wires the
        tab↔panel ARIA both ways, so the listener here is for the side effect
        only. sizing="active" because the two tables differ in height by
        hundreds of pixels and a region sized to the taller one would leave
        the shorter view sitting in a hole.
      -->
      <md-tabs
        [attr.aria-label]="t('wealth.screen.holdings.title')"
        [attr.active-tab-index]="tab"
        tab-width="auto"
        (mdTabChange)="onTabChange($event)"
      >
        <md-tab [attr.label]="t('wealth.panel.holdings')"></md-tab>
        <md-tab [attr.label]="t('wealth.panel.universe')"></md-tab>
      </md-tabs>

      <md-tab-panels sizing="active">
        <md-tab-panel>
          <!-- The query itself, so the rows can mark what it matched. The
               screen owns the search; the tables only show where it landed. -->
          <awc-positions-table
            [rows]="positions"
            [query]="filters.search"
            [sort]="positionSort"
            [defaultSort]="positionDefaultSort"
            (sortChange)="onPositionSort($event)"
          />
        </md-tab-panel>
        <md-tab-panel>
          <!--
            A SKELETON, NOT NOTHING, WHILE THE TABLE IS STILL UNMOUNTED.

            md-tab-panels sizing="active" takes its height from whichever
            panel is active, and md-tabs flips that on click, from its own
            state, in the same frame. The second table is deliberately built
            on first activation only — forty sparklines have no business
            rendering on a first paint of a screen you may never open — so
            until then the panel holds the table's SHAPE: the container always
            has something to size to, and there is no frame at zero height
            where the whole page below jumps up and back.
          -->
          @if (universeSeen) {
            <awc-instruments-table
              [rows]="instruments"
              [query]="filters.search"
              [sort]="instrumentSort"
              [defaultSort]="instrumentDefaultSort"
              (sortChange)="onInstrumentSort($event)"
            />
          } @else {
            <awc-table-skeleton [rows]="19" />
          }
        </md-tab-panel>
      </md-tab-panels>

      <!-- Everything below reads the FILTERED rows, so the breakdowns answer
           questions about what is on screen rather than about the whole book. -->
      <section class="grid-3">
        <awc-panel [title]="t('wealth.panel.regions')">
          @if (regionRows.length) {
            <div class="stack">
              @for (region of regionRows; track region.region) {
                <awc-ratio-meter
                  [label]="t(region.regionKey)"
                  [fraction]="region.weight"
                  color="primary"
                />
              }
            </div>
          } @else {
            <p class="muted">{{ t('wealth.empty.holdings') }}</p>
          }
        </awc-panel>

        <awc-panel [title]="t('wealth.panel.currency')">
          @if (currencyRows.length) {
            <div class="stack">
              @for (exposure of currencyRows; track exposure.currency) {
                <!-- The base currency carries no translation risk, so it is
                     not painted in the same colour as the exposures that do. -->
                <awc-ratio-meter
                  [label]="exposure.currency"
                  [fraction]="exposure.weight"
                  [color]="exposure.isBase ? 'secondary' : 'tertiary'"
                />
              }
            </div>
          } @else {
            <p class="muted">{{ t('wealth.empty.holdings') }}</p>
          }
        </awc-panel>

        <awc-panel [title]="t('wealth.panel.movers')">
          @if (movers.length) {
            <ul class="timeline">
              @for (mover of movers; track mover.position.id) {
                <li>
                  <span class="strong">{{ mover.position.ticker }}</span>
                  <span class="muted" style="flex: 1 1 auto; min-inline-size: 0">
                    {{ mover.position.instrumentName }}
                  </span>
                  <bdi awcSigned [value]="mover.changePct" kind="percent" [digits]="2"></bdi>
                  <bdi awcSigned [value]="mover.changeEur" [compact]="true"></bdi>
                </li>
              }
            </ul>
          } @else {
            <p class="muted">{{ t('wealth.empty.holdings') }}</p>
          }
        </awc-panel>
      </section>

      <!--
        Book-wide on purpose, and the subtitle says so: two households holding
        the same ETF are ONE concentration, which is exactly what bookHoldings
        aggregates and what a position table can never show.
      -->
      <awc-panel [title]="t('wealth.panel.concentration')" [subtitle]="t('wealth.table.bookWeight')">
        <div class="grid-2">
          @for (holding of concentrated; track holding.instrumentId) {
            <md-card variant="outlined" full-width class="alloc-row">
              <div class="alloc-row__head">
                <p class="alloc-row__name">
                  {{ holding.ticker }} · {{ holding.instrumentName }}
                </p>
                <md-chip awcChip kind="assetClass" [value]="holding.assetClass"></md-chip>
              </div>
              <!-- No percentage here: the meter below carries the weight, and
                   a second copy rounded to two digits beside its one would
                   read as two different numbers for the same fact. -->
              <div class="alloc-row__figures">
                <span>
                  <span awcMoney [value]="holding.marketValue" [compact]="true"></span>
                </span>
                <span>
                  <bdi awcSigned [value]="holding.unrealisedPl" [compact]="true"></bdi>
                </span>
                <span>
                  {{ t('wealth.kpi.portfolios') }} <span awcNum [value]="holding.portfolioCount"></span>
                </span>
              </div>
              <!-- The largest holding is a few per cent of the book, so a 0–1
                   meter would be an empty bar on every row. The cap is the
                   largest weight there is, which makes the rows comparable
                   with each other — the only comparison this panel is for. -->
              <awc-ratio-meter
                [label]="holding.ticker"
                [fraction]="holding.weight"
                color="primary"
                [max]="concentrated[0].weight || 1"
                [thickness]="6"
              />
            </md-card>
          }
        </div>
      </awc-panel>
    </awc-screen>
  `,
})
export class HoldingsScreen extends ShowcaseComponent {
  protected readonly crumbs: CrumbSpec[] = crumbsFor(this.route.holdings());

  protected readonly totals = getBookTotals();
  protected readonly risk = concentration();

  /* --------------------------------------------------------- option lists */

  // The whole book, unfiltered: these are the CHOICES, and a choice that
  // disappears because you already narrowed past it is a dead end. The fixture
  // is frozen, so they are computed once.
  private readonly bookPositions = getPositions();
  protected readonly classOptions = assetClassTotals(this.bookPositions);
  protected readonly regionOptions = regionTotals(this.bookPositions);
  protected readonly currencyOptions = currencyExposure(this.bookPositions);
  protected readonly universe = getInstruments();

  protected readonly concentrated = bookHoldings(10);
  protected readonly currencyHint = this.currencyOptions
    .map((exposure) => exposure.currency)
    .join(' · ');

  protected get top() {
    return this.concentrated[0];
  }

  /* ----------------------------------------------------------------- state */

  protected filters: HoldingsFilterState = NO_FILTERS;
  protected readonly positionDefaultSort = POSITION_SORT;
  protected readonly instrumentDefaultSort = INSTRUMENT_SORT;
  protected positionSort: SortState<PositionSortKey> = POSITION_SORT;
  protected instrumentSort: SortState<InstrumentSortKey> = INSTRUMENT_SORT;
  protected tab = 0;
  // md-tab-panels does not lazily render, so the second table would mount with
  // the screen. It is built on first activation instead, which is what the
  // manual asks for and what keeps forty sparklines off the first paint.
  protected universeSeen = false;

  protected onFilters(next: HoldingsFilterState): void {
    this.filters = next;
  }

  protected onPositionSort(next: SortState<PositionSortKey>): void {
    this.positionSort = next;
  }

  protected onInstrumentSort(next: SortState<InstrumentSortKey>): void {
    this.instrumentSort = next;
  }

  protected onTabChange(event: Event): void {
    const detail = (event as CustomEvent<{ index: number; previousIndex: number }>).detail;
    this.tab = detail.index;
    if (detail.index === 1) this.universeSeen = true;
  }

  protected get onHoldings(): boolean {
    return this.tab === 0;
  }

  /* ------------------------------------------------------------------ rows */

  // Getters recompute per change-detection pass, but the ROW SETS are cached
  // on the state that produced them: the filter state and the sort objects are
  // replaced wholesale on every change, so reference identity is the exact
  // equivalent of the React build's useMemo deps — and a stable array is what
  // keeps the tables' inputs from churning on unrelated passes.
  private positionsCache: {
    filters: HoldingsFilterState;
    sort: SortState<PositionSortKey>;
    rows: Position[];
  } | null = null;

  protected get positions(): Position[] {
    const cache = this.positionsCache;
    if (cache && cache.filters === this.filters && cache.sort === this.positionSort) {
      return cache.rows;
    }
    const base: PositionFilter = {
      search: this.filters.search || undefined,
      instrumentId: this.filters.instrumentId ?? undefined,
      region: this.filters.region ?? undefined,
      currency: this.filters.currency ?? undefined,
      sortBy: this.positionSort.column,
      sortDir: this.positionSort.order,
    };
    const ordered = getPositions(base);
    let rows = ordered;
    if (this.filters.assetClasses.length > 0) {
      /*
       * A UNION, AND THE KIT STILL DECIDES WHAT IS IN IT.
       *
       * `PositionFilter.assetClass` takes one class, and the multi-select
       * offers several. Rather than re-implementing "the position's class is
       * one of these" in a component — the exact drift the kit exists to
       * prevent — the selector is asked once per chosen class and the answers
       * are unioned by id. The ORDER still comes from the single ordered call
       * above, so the union cannot quietly re-sort the table either.
       */
      const keep = new Set(
        this.filters.assetClasses.flatMap((assetClass) =>
          getPositions({ ...base, assetClass }).map((position) => position.id),
        ),
      );
      rows = ordered.filter((position) => keep.has(position.id));
    }
    this.positionsCache = { filters: this.filters, sort: this.positionSort, rows };
    return rows;
  }

  private instrumentsCache: {
    filters: HoldingsFilterState;
    sort: SortState<InstrumentSortKey>;
    rows: Instrument[];
  } | null = null;

  protected get instruments(): Instrument[] {
    const cache = this.instrumentsCache;
    if (cache && cache.filters === this.filters && cache.sort === this.instrumentSort) {
      return cache.rows;
    }
    const rows = this.computeInstruments();
    this.instrumentsCache = { filters: this.filters, sort: this.instrumentSort, rows };
    return rows;
  }

  private computeInstruments(): Instrument[] {
    /*
     * Picking an instrument in the lookup is a question about ONE security,
     * and on this view the honest answer is that one row. `InstrumentFilter`
     * has no id field, so the answer comes from `getInstrumentById` — still a
     * selector, still the kit's own lookup, never a scan written here.
     */
    if (this.filters.instrumentId) {
      const picked = getInstrumentById(this.filters.instrumentId);
      if (picked) return [picked];
    }

    const base: InstrumentFilter = {
      search: this.filters.search || undefined,
      region: this.filters.region ?? undefined,
      currency: this.filters.currency ?? undefined,
      sortBy: this.instrumentSort.column,
      sortDir: this.instrumentSort.order,
    };
    const ordered = getInstruments(base);
    if (this.filters.assetClasses.length === 0) return ordered;

    const keep = new Set(
      this.filters.assetClasses.flatMap((assetClass) =>
        getInstruments({ ...base, assetClass }).map((instrument) => instrument.id),
      ),
    );
    return ordered.filter((instrument) => keep.has(instrument.id));
  }

  /* ----------------------------------------------------- roll-ups on view */

  private rollupsCache: {
    rows: Position[];
    regions: RegionTotal[];
    currencies: CurrencyExposure[];
    movers: Mover[];
    suggestions: Position[];
  } | null = null;

  private get rollups() {
    const rows = this.positions;
    if (this.rollupsCache?.rows !== rows) {
      this.rollupsCache = {
        rows,
        regions: regionTotals(rows),
        currencies: currencyExposure(rows),
        movers: topMovers(rows, 5),
        suggestions: rows.slice(0, SUGGESTION_COUNT),
      };
    }
    return this.rollupsCache;
  }

  protected get regionRows(): RegionTotal[] {
    return this.rollups.regions;
  }

  protected get currencyRows(): CurrencyExposure[] {
    return this.rollups.currencies;
  }

  protected get movers(): Mover[] {
    return this.rollups.movers;
  }

  protected get suggestions(): Position[] {
    return this.rollups.suggestions;
  }

  /* ------------------------------------------------------------------ sort */

  protected get sortColumns(): SortSpec[] {
    return (this.onHoldings ? positionColumns(this.t) : instrumentColumns(this.t))
      .filter((column) => column.key)
      .map((column) => ({ key: column.key as string, label: column.label }));
  }

  protected get sortBy(): string {
    return this.onHoldings ? this.positionSort.column : this.instrumentSort.column;
  }

  protected get defaultTarget(): ExportTarget {
    return this.onHoldings ? 'holdings' : 'instruments';
  }

  /*
   * The menu names a column, not a direction, so the direction comes from the
   * same rule the header uses: figures descend, names ascend. Re-picking the
   * column already sorted flips it, which is what the header does on its
   * second click.
   */
  protected onSortColumn(key: string): void {
    if (this.onHoldings) {
      const column = key as PositionSortKey;
      const numeric = positionColumns(this.t).find((entry) => entry.key === column)?.numeric;
      const current = this.positionSort;
      this.positionSort =
        current.column === column
          ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
          : { column, order: numeric ? 'desc' : 'asc' };
    } else {
      const column = key as InstrumentSortKey;
      const numeric = instrumentColumns(this.t).find((entry) => entry.key === column)?.numeric;
      const current = this.instrumentSort;
      this.instrumentSort =
        current.column === column
          ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
          : { column, order: numeric ? 'desc' : 'asc' };
    }
  }

  /* ---------------------------------------------------------------- export */

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
  protected exportCsv(target: ExportTarget): void {
    const t = this.t;
    const cell = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    let name: string = target;
    let header: string[] = [];
    let body: (string | number)[][] = [];

    if (target === 'instruments') {
      header = instrumentColumns(t)
        .filter((column) => column.label !== t('wealth.table.trend'))
        .map((column) => column.label);
      body = this.instruments.map((instrument) => [
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
      body = this.concentrated.map((holding) => [
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
      body = this.positions.map((position) => [
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
  }
}
