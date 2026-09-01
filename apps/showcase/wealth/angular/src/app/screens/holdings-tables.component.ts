import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  getHouseholdById,
  getInstrumentById,
  getPortfolioById,
  plColor,
  TABLES,
  type Household,
  type Instrument,
  type InstrumentFilter,
  type Portfolio,
  type Position,
  type PositionSortKey,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import type { T } from '../lib/showcase.service';
import {
  ChipComponent,
  DateTextComponent,
  FactComponent,
  HighlightComponent,
  MoneyComponent,
  NumComponent,
  PercentComponent,
  SignedComponent,
} from '../components/bits.component';
import { EmptyStateComponent } from '../components/empty-state.component';

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

/** The one `md-table` method used here. Async, like every `@Method`. */
type SortableTable = HTMLElement & {
  setSort?: (column: string, order: 'asc' | 'desc' | 'none') => Promise<void>;
};

/** What a sparkline needs assigned as JS properties, built once per locale. */
interface SparkProps {
  data: (number | null)[];
  labels: string[];
  valueFormatter: (value: number | null) => string;
}

/**
 * The header row markup is repeated verbatim in both tables below rather than
 * extracted: an Angular component always renders a host element, and an
 * `awc-*` node between `md-table` and `md-table-head` is a child the table's
 * slot layout does not expect — the React build's `<Head>` is a function that
 * leaves no trace in the DOM, and the DOM is the contract.
 *
 * The sort labels carry no `active` / `order`: `md-table` already declares
 * `sort-by` / `sort-order` and pushes both down into every label on sync, so
 * anything written here could only ever disagree with it.
 */

/* ---------------------------------------------------------------- holdings */

@Component({
  selector: 'awc-positions-table',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    ChipComponent,
    DateTextComponent,
    FactComponent,
    HighlightComponent,
    MoneyComponent,
    NumComponent,
    PercentComponent,
    SignedComponent,
    EmptyStateComponent,
  ],
  template: `
    <md-table-container variant="outlined" max-height="70vh" class="table-host">
      <!--
        The toolbar goes in the container's top slot and the pagination in its
        bottom slot — outside the scroll region, so both stay put while the
        rows move. The filters live above the whole tab strip: they drive both
        tables, and one copy is what keeps the two menus' anchor ids unique.
      -->
      <md-table-toolbar
        slot="top"
        [attr.headline]="t('wealth.panel.holdings')"
        [attr.supporting-text]="
          t('wealth.common.showing', { shown: pageRows.length, total: rows.length })
        "
      ></md-table-toolbar>

      <!--
        keep-height="false": the height ratchet is measured once and never
        recomputed, so a live density change from the dock strands the taller
        height as dead space. Pagination already holds the row count steady.

        row-offset / row-count: without these, assistive tech announces
        "row 1 of 25" on every page instead of the row's place in the filtered
        book. row-count takes the BODY total; md-table adds the head rows.

        The empty state belongs INSIDE the table, not instead of it: the
        toolbar, the headers and the pagination readout all stay on screen, so
        the reader can see which filters emptied it.
      -->
      <md-table
        #table
        [attr.label]="t('wealth.panel.holdings')"
        [attr.column-template]="layout.columns"
        [attr.min-width]="layout.minWidth"
        sticky-header
        striped
        keep-height="false"
        [attr.sort-by]="sort.column"
        [attr.sort-order]="sort.order"
        [attr.row-offset]="offset"
        [attr.row-count]="rows.length"
        [attr.empty]="rows.length === 0 ? '' : null"
        (mdSortChange)="onSortChange($event)"
      >
        <div slot="empty">
          <awc-empty-state [message]="t('wealth.empty.holdings')" [hint]="true" />
        </div>

        <md-table-head>
          <md-table-row rowgroup="head">
            @for (column of columns; track column.label) {
              <md-table-cell head scope="col" [attr.numeric]="column.numeric ? '' : null">
                @if (column.key) {
                  <md-table-sort-label
                    [attr.column]="column.key"
                    [attr.default-order]="column.numeric ? 'desc' : 'asc'"
                    [attr.icon-position]="column.numeric ? 'start' : 'end'"
                  >
                    {{ column.label }}
                  </md-table-sort-label>
                } @else {
                  {{ column.label }}
                }
              </md-table-cell>
            }
          </md-table-row>
        </md-table-head>

        <md-table-body>
          @for (position of pageRows; track position.id) {
            <md-table-row [attr.value]="position.id" expandable>
              <md-table-cell>
                <span class="with-dot">
                  <!--
                    In the ticker cell, not in a cell of its own: the kit owns
                    the twelve tracks and a thirteenth would skew the row. The
                    label names the row, because twenty toggles all called
                    "Expand row" tell a screen-reader user nothing.
                  -->
                  <md-table-expand-toggle
                    [attr.button-label]="t('wealth.table.instrument') + ' ' + position.ticker"
                  ></md-table-expand-toggle>
                  <span class="strong">
                    <awc-highlight [text]="position.ticker" [query]="query" />
                  </span>
                </span>
              </md-table-cell>
              <md-table-cell>
                <awc-highlight [text]="position.instrumentName" [query]="query" />
              </md-table-cell>
              <md-table-cell>
                <!--
                  The filter bar's search marks the two name cells only, and
                  THE HOUSEHOLD CELL IS NOT ONE OF THEM: getPositions never
                  compares the query against the household name, and marking
                  it would tell the reader the query hit a field it was never
                  compared against.
                -->
                @if (householdOf(position); as household) {
                  <a class="drill" [routerLink]="appPath(route.household(household.id))">
                    {{ household.name }}
                  </a>
                } @else {
                  {{ t('wealth.common.na') }}
                }
              </md-table-cell>
              <md-table-cell>
                <md-chip awcChip kind="assetClass" [value]="position.assetClass"></md-chip>
              </md-table-cell>
              <md-table-cell>{{ position.currency }}</md-table-cell>
              <md-table-cell numeric>
                <span awcNum [value]="position.quantity"></span>
              </md-table-cell>
              <md-table-cell numeric>
                <span
                  awcMoney
                  [value]="position.price"
                  [currency]="position.currency"
                  [digits]="2"
                ></span>
              </md-table-cell>
              <md-table-cell numeric>
                <span awcMoney [value]="position.marketValueEur"></span>
              </md-table-cell>
              <md-table-cell numeric>
                <bdi awcSigned [value]="position.unrealisedPl"></bdi>
              </md-table-cell>
              <md-table-cell numeric>
                <bdi awcSigned [value]="position.unrealisedPlPct" kind="percent"></bdi>
              </md-table-cell>
              <md-table-cell numeric>
                <span awcPercent [value]="position.weight" [digits]="1"></span>
              </md-table-cell>
              <md-table-cell numeric>
                <bdi awcSigned [value]="position.dayChangePct" kind="percent"></bdi>
              </md-table-cell>

              <!-- The detail belongs to the row, in its expanded slot: it
                   follows its row in the reading order and goes inert with it,
                   which a sibling detail row could not do. -->
              <div slot="expanded">
                <!--
                  What sits behind one holding. The fixture books a position as
                  a single lot, so this is that lot: what was paid, what it is
                  worth in its own currency before the FX, when it was opened,
                  and where the instrument has been over twelve months. The
                  household name is a drill, because the next question after
                  "what is this?" is "whose is it?" — asked of the household
                  cell in the row itself.

                  The facts sit in .dl, an auto-fit grid that spreads them
                  across whatever width it is given, and the twelve-month
                  series spans the whole panel beneath them — a flatter line
                  than a narrow one would draw, and deliberately so.
                -->
                <div
                  style="display: flex; flex-direction: column; gap: var(--md-sys-spacing-gap-lg, 24px); inline-size: 100%"
                >
                  <dl class="dl">
                    <div awcFact [label]="t('wealth.table.quantity')">
                      <span awcNum [value]="position.quantity"></span>
                    </div>
                    <div awcFact [label]="t('wealth.table.costPerUnit')">
                      <span
                        awcMoney
                        [value]="position.costPerUnit"
                        [currency]="position.currency"
                        [digits]="2"
                      ></span>
                    </div>
                    <div awcFact [label]="t('wealth.table.costBasis')">
                      <span awcMoney [value]="position.costBasisEur"></span>
                    </div>
                    <div awcFact [label]="t('wealth.table.marketValue')">
                      <!-- The LOCAL amount here, beside the EUR one in the row
                           above it — this is the pair a currency question is
                           actually asked of. -->
                      <span
                        awcMoney
                        [value]="position.marketValue"
                        [currency]="position.currency"
                      ></span>
                    </div>
                    <div awcFact [label]="t('wealth.table.opened')">
                      <time awcDate [value]="position.openedDate"></time>
                    </div>
                    <div awcFact [label]="t('wealth.table.sector')">
                      {{ t(position.sectorKey) }}
                    </div>
                    <div awcFact [label]="t('wealth.table.region')">
                      {{ t(position.regionKey) }}
                    </div>
                    @if (instrumentOf(position); as instrument) {
                      <div awcFact [label]="t('wealth.table.twelveMonth')">
                        <bdi awcSigned [value]="instrument.twelveMonthReturn" kind="percent"></bdi>
                      </div>
                    }
                    @if (mandateOf(position); as mandate) {
                      <!-- The mandate reference is a proper noun, and it is the
                           thing an operations question is asked with — "which
                           book is this in?". -->
                      <div awcFact [label]="t('wealth.panel.mandate')">
                        {{ mandate.reference }}
                      </div>
                    }
                  </dl>

                  @if (instrumentOf(position); as instrument) {
                    @if (instrument.priceSeries.length > 1) {
                      <div style="inline-size: 100%">
                        <md-sparkline
                          [data]="spark(instrument).data"
                          [labels]="spark(instrument).labels"
                          [valueFormatter]="spark(instrument).valueFormatter"
                          variant="area"
                          curve="monotone"
                          [attr.color]="plColor(instrument.twelveMonthReturn)"
                          show-marks="extremes"
                          height="56px"
                        ></md-sparkline>
                      </div>
                    }
                  }
                </div>
              </div>
            </md-table-row>
          }
        </md-table-body>
      </md-table>

      <md-table-pagination
        slot="bottom"
        [attr.count]="rows.length"
        [attr.page]="safePage"
        [attr.rows-per-page]="rowsPerPage"
        rows-per-page-options="10,25,50,all"
        show-first-last
        [attr.label-rows-per-page]="t('wealth.table.rowsPerPage')"
        [attr.label-displayed-rows]="t('wealth.table.displayedRows')"
        [attr.label-first-page]="t('wealth.table.firstPage')"
        [attr.label-previous-page]="t('wealth.table.previousPage')"
        [attr.label-next-page]="t('wealth.table.nextPage')"
        [attr.label-last-page]="t('wealth.table.lastPage')"
        [attr.label-all]="t('wealth.table.all')"
        (mdPageChange)="onPageChange($event)"
        (mdRowsPerPageChange)="onRowsPerPageChange($event)"
      ></md-table-pagination>
    </md-table-container>
  `,
})
export class PositionsTableComponent extends ShowcaseComponent {
  /** Already filtered and ordered by the kit. This component only pages it. */
  @Input({ required: true }) rows!: Position[];
  /** The filter bar's search, for the highlight marks only. */
  @Input() query?: string;
  @Input({ required: true }) sort!: SortState<PositionSortKey>;
  @Input({ required: true }) defaultSort!: SortState<PositionSortKey>;
  @Output() readonly sortChange = new EventEmitter<SortState<PositionSortKey>>();

  @ViewChild('table') private tableEl?: ElementRef<HTMLElement>;

  protected readonly plColor = plColor;

  protected page = 0;
  protected rowsPerPage = 25;

  protected get layout() {
    return TABLES.positions(true);
  }

  protected get columns(): Column<PositionSortKey>[] {
    return positionColumns(this.t);
  }

  // Filtering to fewer rows can strand the reader past the last page, so the
  // page that is actually rendered is always clamped to what exists.
  protected get safePage(): number {
    const last = Math.max(0, Math.ceil(this.rows.length / this.rowsPerPage) - 1);
    return Math.min(this.page, last);
  }

  protected get offset(): number {
    return this.safePage * this.rowsPerPage;
  }

  protected get pageRows(): Position[] {
    return this.rows.slice(this.offset, this.offset + this.rowsPerPage);
  }

  protected householdOf(position: Position): Household | undefined {
    return getHouseholdById(position.householdId);
  }

  protected instrumentOf(position: Position): Instrument | undefined {
    return getInstrumentById(position.instrumentId);
  }

  protected mandateOf(position: Position): Portfolio | undefined {
    return getPortfolioById(position.portfolioId);
  }

  /** Labels and formatter close over the translator — memo keyed per locale. */
  protected spark(instrument: Instrument): SparkProps {
    return this.memo(`spark:${instrument.id}`, () => ({
      data: instrument.priceSeries,
      labels: instrument.priceSeriesDates.map((date) => this.t.formatDate(date, 'monthYear')),
      valueFormatter: (value: number | null) =>
        value === null
          ? this.t('wealth.common.na')
          : this.t.formatCurrency(value, {
              currency: instrument.currency,
              maximumFractionDigits: 2,
            }),
    }));
  }

  /**
   * Turn a sort REQUEST into the screen's sort state.
   *
   * The third click of a column's cycle clears the sort, and the rows still
   * have to come back in some order — so it returns to the table's default.
   * The table has already blanked its own `sort-by` by then, and if the
   * default IS the column just cleared, the re-render binds an unchanged
   * `sort-by` and never writes the attribute back: the arrow would vanish
   * while the rows stayed sorted. `setSort` puts the display state back where
   * the data actually is; it re-emits `mdSortChange` with the restored column,
   * which lands in the branch above and settles on the state it is already in.
   */
  protected onSortChange(event: Event): void {
    const detail = (event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>)
      .detail;
    if (detail.column && detail.order !== 'none') {
      this.sortChange.emit({ column: detail.column as PositionSortKey, order: detail.order });
      return;
    }
    this.sortChange.emit(this.defaultSort);
    void (this.tableEl?.nativeElement as SortableTable | undefined)?.setSort?.(
      this.defaultSort.column,
      this.defaultSort.order,
    );
  }

  protected onPageChange(event: Event): void {
    this.page = (event as CustomEvent<{ page: number }>).detail.page;
  }

  protected onRowsPerPageChange(event: Event): void {
    // No `page = 0` here: md-table-pagination has already reset the page and
    // emitted mdPageChange, which the handler above consumes.
    this.rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }
}

/* ---------------------------------------------------------------- universe */

@Component({
  selector: 'awc-instruments-table',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ChipComponent, HighlightComponent, MoneyComponent, SignedComponent, EmptyStateComponent],
  template: `
    <md-table-container variant="outlined" max-height="70vh" class="table-host">
      <md-table-toolbar
        slot="top"
        [attr.headline]="t('wealth.panel.universe')"
        [attr.supporting-text]="
          t('wealth.common.showing', { shown: pageRows.length, total: rows.length })
        "
      ></md-table-toolbar>

      <md-table
        #table
        [attr.label]="t('wealth.panel.universe')"
        [attr.column-template]="layout.columns"
        [attr.min-width]="layout.minWidth"
        sticky-header
        striped
        keep-height="false"
        [attr.sort-by]="sort.column"
        [attr.sort-order]="sort.order"
        [attr.row-offset]="offset"
        [attr.row-count]="rows.length"
        [attr.empty]="rows.length === 0 ? '' : null"
        (mdSortChange)="onSortChange($event)"
      >
        <div slot="empty">
          <awc-empty-state [message]="t('wealth.empty.generic')" [hint]="true" />
        </div>

        <md-table-head>
          <md-table-row rowgroup="head">
            @for (column of columns; track column.label) {
              <md-table-cell head scope="col" [attr.numeric]="column.numeric ? '' : null">
                @if (column.key) {
                  <md-table-sort-label
                    [attr.column]="column.key"
                    [attr.default-order]="column.numeric ? 'desc' : 'asc'"
                    [attr.icon-position]="column.numeric ? 'start' : 'end'"
                  >
                    {{ column.label }}
                  </md-table-sort-label>
                } @else {
                  {{ column.label }}
                }
              </md-table-cell>
            }
          </md-table-row>
        </md-table-head>

        <md-table-body>
          <!-- The same search box narrows this tab too, so it marks its
               matches too — one filter bar that highlighted one of its two
               tables would read as a bug. getInstruments matches ticker, name
               and id; id is not a column. -->
          @for (instrument of pageRows; track instrument.id) {
            <md-table-row [attr.value]="instrument.id">
              <md-table-cell>
                <span class="strong">
                  <awc-highlight [text]="instrument.ticker" [query]="query" />
                </span>
              </md-table-cell>
              <md-table-cell>
                <awc-highlight [text]="instrument.name" [query]="query" />
              </md-table-cell>
              <md-table-cell>
                <md-chip awcChip kind="instrumentType" [value]="instrument.type"></md-chip>
              </md-table-cell>
              <md-table-cell>
                <md-chip awcChip kind="assetClass" [value]="instrument.assetClass"></md-chip>
              </md-table-cell>
              <md-table-cell>{{ t(instrument.sectorKey) }}</md-table-cell>
              <md-table-cell>{{ t(instrument.regionKey) }}</md-table-cell>
              <md-table-cell>{{ instrument.currency }}</md-table-cell>
              <md-table-cell numeric>
                <span
                  awcMoney
                  [value]="instrument.price"
                  [currency]="instrument.currency"
                  [digits]="2"
                ></span>
              </md-table-cell>
              <md-table-cell numeric>
                <bdi awcSigned [value]="instrument.dayChangePct" kind="percent"></bdi>
              </md-table-cell>
              <md-table-cell numeric>
                <bdi awcSigned [value]="instrument.twelveMonthReturn" kind="percent"></bdi>
              </md-table-cell>
              <md-table-cell>
                <!--
                  aria-hidden, and deliberately. md-sparkline names itself with
                  a generated English sentence, and twenty-five of those would
                  be read out in a table whose previous three columns already
                  carry the price, the day's move and the twelve-month return
                  in figures. The chart is the same fact drawn; hiding the
                  duplicate is the accessible choice, not the lazy one.
                -->
                <div style="min-inline-size: 80px">
                  <md-sparkline
                    aria-hidden="true"
                    [data]="spark(instrument).data"
                    [labels]="spark(instrument).labels"
                    [valueFormatter]="spark(instrument).valueFormatter"
                    variant="line"
                    curve="monotone"
                    [attr.color]="plColor(instrument.twelveMonthReturn)"
                    show-marks="extremes"
                    height="28px"
                  ></md-sparkline>
                </div>
              </md-table-cell>
            </md-table-row>
          }
        </md-table-body>
      </md-table>

      <md-table-pagination
        slot="bottom"
        [attr.count]="rows.length"
        [attr.page]="safePage"
        [attr.rows-per-page]="rowsPerPage"
        rows-per-page-options="10,25,50,all"
        show-first-last
        [attr.label-rows-per-page]="t('wealth.table.rowsPerPage')"
        [attr.label-displayed-rows]="t('wealth.table.displayedRows')"
        [attr.label-first-page]="t('wealth.table.firstPage')"
        [attr.label-previous-page]="t('wealth.table.previousPage')"
        [attr.label-next-page]="t('wealth.table.nextPage')"
        [attr.label-last-page]="t('wealth.table.lastPage')"
        [attr.label-all]="t('wealth.table.all')"
        (mdPageChange)="onPageChange($event)"
        (mdRowsPerPageChange)="onRowsPerPageChange($event)"
      ></md-table-pagination>
    </md-table-container>
  `,
})
export class InstrumentsTableComponent extends ShowcaseComponent {
  @Input({ required: true }) rows!: Instrument[];
  @Input() query?: string;
  @Input({ required: true }) sort!: SortState<InstrumentSortKey>;
  @Input({ required: true }) defaultSort!: SortState<InstrumentSortKey>;
  @Output() readonly sortChange = new EventEmitter<SortState<InstrumentSortKey>>();

  @ViewChild('table') private tableEl?: ElementRef<HTMLElement>;

  protected readonly plColor = plColor;

  protected page = 0;
  protected rowsPerPage = 25;

  protected get layout() {
    return TABLES.instruments;
  }

  protected get columns(): Column<InstrumentSortKey>[] {
    return instrumentColumns(this.t);
  }

  protected get safePage(): number {
    const last = Math.max(0, Math.ceil(this.rows.length / this.rowsPerPage) - 1);
    return Math.min(this.page, last);
  }

  protected get offset(): number {
    return this.safePage * this.rowsPerPage;
  }

  protected get pageRows(): Instrument[] {
    return this.rows.slice(this.offset, this.offset + this.rowsPerPage);
  }

  protected spark(instrument: Instrument): SparkProps {
    return this.memo(`spark:${instrument.id}`, () => ({
      data: instrument.priceSeries,
      labels: instrument.priceSeriesDates.map((date) => this.t.formatDate(date, 'monthYear')),
      valueFormatter: (value: number | null) =>
        value === null
          ? this.t('wealth.common.na')
          : this.t.formatCurrency(value, {
              currency: instrument.currency,
              maximumFractionDigits: 2,
            }),
    }));
  }

  protected onSortChange(event: Event): void {
    const detail = (event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>)
      .detail;
    if (detail.column && detail.order !== 'none') {
      this.sortChange.emit({ column: detail.column as InstrumentSortKey, order: detail.order });
      return;
    }
    this.sortChange.emit(this.defaultSort);
    void (this.tableEl?.nativeElement as SortableTable | undefined)?.setSort?.(
      this.defaultSort.column,
      this.defaultSort.order,
    );
  }

  protected onPageChange(event: Event): void {
    this.page = (event as CustomEvent<{ page: number }>).detail.page;
  }

  protected onRowsPerPageChange(event: Event): void {
    this.rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }
}
