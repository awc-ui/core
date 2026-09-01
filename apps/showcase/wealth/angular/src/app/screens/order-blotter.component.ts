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
  getAdvisor,
  getBookTotals,
  getOrders,
  TABLES,
  type Order,
  type OrderSide,
  type OrderStatus,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  DateTextComponent,
  HighlightComponent,
  MoneyComponent,
  NumComponent,
} from '../components/bits.component';

/**
 * The blotter: every order the book has raised, filtered and paged. Ported
 * from the React build's `OrderBlotter.tsx`.
 *
 * FILTERING GOES THROUGH THE SELECTOR, NEVER THROUGH `.filter()` HERE.
 * `getOrders()` already knows what "working" means (`submitted` plus
 * `partially-filled`) and what a search matches (ticker, security name,
 * household, id). Re-deciding either in this file is how two ports end up
 * disagreeing about which rows a filter keeps. Paging is the one thing this
 * component does own — `md-table-pagination` renders the readout and the
 * controls and emits a REQUEST, exactly like a sort header, and taking the
 * slice is ours.
 *
 * THERE ARE NO SORT HEADERS, and that is deliberate rather than unfinished.
 * `OrderFilter` carries no `sortBy` / `sortDir`; the fixture stores orders
 * newest first and the selector preserves that. A comparator here would be a
 * second ordering the kit knows nothing about, so the headers stay plain and
 * the missing filter fields are reported upward instead.
 *
 * §7.1's table rule: `md-table-container` WRAPS `md-table`, with the toolbar
 * in its `top` slot and the pagination in its `bottom` slot. Neither goes
 * inside the table, where they would become children of a grid whose columns
 * belong to the rows.
 *
 * THE TABLE IS ITS OWN COMPONENT, as in React. There the split exists so the
 * pagination listeners re-bind after a trip through the empty state; Angular's
 * template bindings re-bind on re-mount by themselves, but the split is kept —
 * it is where the facet row is projected into the container's `top` band while
 * its STATE stays up here with every other filter, and it keeps the two builds
 * structurally line-for-line.
 */

const SIDES: readonly OrderSide[] = ['buy', 'sell'];

const STATUSES: readonly OrderStatus[] = [
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
 * cover: lifecycle (working), ownership (mine), provenance (raised under
 * advice rather than as an ad-hoc ticket). Over the 14-order fixture they
 * split it 5 / 8 / 8, so each is worth pressing.
 */
const FACETS = [
  { id: 'working', labelKey: 'wealth.trade.workingOnly' },
  { id: 'mine', labelKey: 'wealth.trade.filter.mine' },
  { id: 'fromAdvice', labelKey: 'wealth.trade.filter.fromAdvice' },
] as const;

type FacetId = (typeof FACETS)[number]['id'];
type FacetState = Record<FacetId, boolean>;

const NO_FACETS: FacetState = { working: false, mine: false, fromAdvice: false };

/* ------------------------------------------------------------------- table */

@Component({
  selector: 'awc-blotter-table',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    ChipComponent,
    DateTextComponent,
    HighlightComponent,
    MoneyComponent,
    NumComponent,
  ],
  template: `
    <div class="table-host">
      <md-table-container variant="outlined">
        <!--
          The toolbar goes in the CONTAINER's top slot, outside the table's
          scroll port, so it stays put while thirteen columns scroll under it.
        -->
        <md-table-toolbar
          slot="top"
          [attr.headline]="t('wealth.panel.blotter')"
          [attr.supporting-text]="t('wealth.common.showing', { shown: total, total: bookTotal })"
        ></md-table-toolbar>

        <!--
          A SECOND top child, under the toolbar — the projected facet row. The
          band is a flex column, so the chips stack beneath the headline and
          stay outside the scroll port with it — the sticky header sticks
          below them, so the two never meet.
        -->
        <ng-content select="[facetRow]" />

        <!--
          keep-height="false": md-table ratchets its height by default so
          paging cannot make the page jump, but that baseline is measured once
          and never recomputed — a density change then strands the taller
          height as dead space. Pagination already holds the row count steady
          here, so live density switching is worth more than the ratchet.

          row-offset / row-count: without these, assistive tech announces
          "row 1 of 10" on every page instead of the row's position in the
          whole blotter. row-count takes the BODY total; the table adds the
          head and foot rows itself.
        -->
        <md-table
          [attr.label]="t('wealth.panel.blotter')"
          [attr.column-template]="layout.columns"
          [attr.min-width]="layout.minWidth"
          keep-height="false"
          striped
          [attr.row-offset]="page * rowsPerPage"
          [attr.row-count]="total"
        >
          <md-table-head>
            <md-table-row rowgroup="head">
              @for (header of headers; track header.key) {
                <md-table-cell head scope="col" [attr.numeric]="header.numeric ? '' : null">
                  {{ header.label }}
                </md-table-cell>
              }
            </md-table-row>
          </md-table-head>

          <md-table-body>
            @for (order of rows; track order.id) {
              <md-table-row [attr.value]="order.id">
                <!--
                  The query marks only what getOrders actually matched on —
                  ticker, instrument name, household name and id — so those
                  are the four cells that can carry a <mark> and no others.
                  Marking a fifth would claim the query hit something it never
                  looked at.
                -->
                <md-table-cell>
                  <awc-highlight [text]="order.id" [query]="query" />
                </md-table-cell>
                <md-table-cell>
                  <md-chip awcChip kind="orderSide" [value]="order.side"></md-chip>
                </md-table-cell>
                <md-table-cell>
                  <awc-highlight [text]="order.ticker" [query]="query" />
                </md-table-cell>
                <md-table-cell>
                  <awc-highlight [text]="order.instrumentName" [query]="query" />
                </md-table-cell>
                <md-table-cell>
                  <a class="drill" [routerLink]="appPath(route.household(order.householdId))">
                    <awc-highlight [text]="order.householdName" [query]="query" />
                  </a>
                </md-table-cell>
                <md-table-cell numeric>
                  <span awcNum [value]="order.quantity"></span>
                </md-table-cell>
                <md-table-cell numeric>
                  <span awcNum [value]="order.filledQuantity"></span>
                </md-table-cell>
                <md-table-cell>{{ t(order.orderTypeKey) }}</md-table-cell>
                <md-table-cell numeric>
                  @if (order.limitPrice === null) {
                    <span class="muted">{{ t('wealth.common.na') }}</span>
                  } @else {
                    <span
                      awcMoney
                      [value]="order.limitPrice"
                      [currency]="order.currency"
                      [digits]="2"
                    ></span>
                  }
                </md-table-cell>
                <md-table-cell>{{ t(order.timeInForceKey) }}</md-table-cell>
                <!--
                  THE CURRENCY TRAP. estimatedValue is in the security's own
                  currency and estimatedValueEur is the converted twin. This
                  column compares orders across the book, so the EUR figure
                  leads and the local one sits under it — the other way round
                  would quietly report a CHF ticket as if it were euros.
                -->
                <md-table-cell numeric>
                  <span awcMoney [value]="order.estimatedValueEur" [compact]="true"></span>
                  @if (order.currency !== 'EUR') {
                    <br />
                    <span class="muted num" style="font: var(--md-sys-typescale-label-small-font)">{{
                      t.formatCurrency(order.estimatedValue, {
                        currency: order.currency,
                        notation: 'compact'
                      })
                    }}</span>
                  }
                </md-table-cell>
                <md-table-cell>
                  <md-chip awcChip kind="orderStatus" [value]="order.status"></md-chip>
                </md-table-cell>
                <md-table-cell>
                  <time awcDate [value]="order.createdDate" dateStyle="short"></time>
                </md-table-cell>
              </md-table-row>
            }
          </md-table-body>
        </md-table>

        <md-table-pagination
          slot="bottom"
          [attr.count]="total"
          [attr.page]="page"
          [attr.rows-per-page]="rowsPerPage"
          rows-per-page-options="10,25,all"
          show-first-last
          [attr.label-rows-per-page]="t('wealth.table.rowsPerPage')"
          [attr.label-displayed-rows]="t('wealth.table.displayedRows')"
          [attr.label-first-page]="t('wealth.table.firstPage')"
          [attr.label-previous-page]="t('wealth.table.previousPage')"
          [attr.label-next-page]="t('wealth.table.nextPage')"
          [attr.label-last-page]="t('wealth.table.lastPage')"
          [attr.label-all]="t('wealth.table.all')"
          (mdPageChange)="onPage($event)"
          (mdRowsPerPageChange)="onRowsPerPage($event)"
        ></md-table-pagination>
      </md-table-container>
    </div>
  `,
})
export class BlotterTableComponent extends ShowcaseComponent {
  /** Rows the filters kept, on this page. */
  @Input({ required: true }) rows!: Order[];
  /**
   * The blotter search, for the `<mark>`s only — the rows are already
   * filtered. The state, not the element's value: this is the string the
   * selector was given.
   */
  @Input({ required: true }) query!: string;
  /** Rows the filters kept, across every page. */
  @Input({ required: true }) total!: number;
  /** Rows on the book, unfiltered. */
  @Input({ required: true }) bookTotal!: number;
  @Input({ required: true }) page!: number;
  @Input({ required: true }) rowsPerPage!: number;

  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly rowsPerPageChange = new EventEmitter<number>();

  protected readonly layout = TABLES.orders;

  protected onPage(event: Event): void {
    this.pageChange.emit((event as CustomEvent<{ page: number }>).detail.page);
  }

  protected onRowsPerPage(event: Event): void {
    // No pageChange.emit(0) here: md-table-pagination has already reset the
    // page and emitted mdPageChange, which the handler above consumes.
    // Resetting again is that component's documented anti-pattern.
    this.rowsPerPageChange.emit(
      (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage,
    );
  }

  protected get headers(): { key: string; label: string; numeric?: boolean }[] {
    return [
      { key: 'id', label: this.t('wealth.table.id') },
      { key: 'side', label: this.t('wealth.table.side') },
      { key: 'ticker', label: this.t('wealth.table.ticker') },
      { key: 'instrument', label: this.t('wealth.table.instrument') },
      { key: 'household', label: this.t('wealth.table.household') },
      { key: 'quantity', label: this.t('wealth.table.quantity'), numeric: true },
      { key: 'filled', label: this.t('wealth.table.filled'), numeric: true },
      { key: 'orderType', label: this.t('wealth.table.orderType') },
      { key: 'limit', label: this.t('wealth.table.limitPrice'), numeric: true },
      { key: 'tif', label: this.t('wealth.table.timeInForce') },
      { key: 'value', label: this.t('wealth.table.estimatedValue'), numeric: true },
      { key: 'status', label: this.t('wealth.table.status') },
      { key: 'created', label: this.t('wealth.table.created') },
    ];
  }
}

/* ----------------------------------------------------------------- blotter */

@Component({
  selector: 'awc-order-blotter',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [PanelComponent, EmptyStateComponent, BlotterTableComponent],
  template: `
    <awc-panel>
      <div class="stack">
        <div class="row trade-filters">
          <!--
            md-text-field type="search", not md-search: md-search owns a
            results surface of its own, and this box filters a table that is
            already on screen (§5.2).

            UNCONTROLLED — no value binding, ever. A bound text field rewrites
            the box on every pass, which is how a caret ends up jumping to the
            end of a word being edited in the middle. The consequence is that
            "clear filters" has to push the empty string back into the element
            by hand; that is the whole reason the #searchField ref exists.
          -->
          <md-text-field
            #searchField
            variant="outlined"
            type="search"
            [attr.label]="t('wealth.trade.searchOrders')"
            clearable="internal"
            (mdInput)="onSearch($event)"
            (mdClear)="onSearchClear()"
          ></md-text-field>

          <md-select
            variant="outlined"
            [attr.label]="t('wealth.table.side')"
            [attr.placeholder]="t('wealth.common.all')"
            [attr.value]="side"
            clearable
            [attr.clear-label]="t('wealth.action.clearFilters')"
            (mdChange)="onSide($event)"
          >
            @for (value of sideOptions; track value) {
              <md-select-option
                [attr.value]="value"
                [attr.label]="t('wealth.orderSide.' + value)"
              >{{ t('wealth.orderSide.' + value) }}</md-select-option>
            }
          </md-select>

          <md-select
            variant="outlined"
            [attr.label]="t('wealth.table.status')"
            [attr.placeholder]="t('wealth.common.all')"
            [attr.value]="status"
            clearable
            [attr.clear-label]="t('wealth.action.clearFilters')"
            (mdChange)="onStatus($event)"
          >
            @for (value of statusOptions; track value) {
              <md-select-option
                [attr.value]="value"
                [attr.label]="t('wealth.orderStatus.' + value)"
              >{{ t('wealth.orderStatus.' + value) }}</md-select-option>
            }
          </md-select>

          <!--
            §7.2: an icon-only control and the tooltip that supplies the
            meaning its glyph lacks. The aria-label is still required — a
            tooltip is a description, never a name. It sits with the filters
            rather than in the table's toolbar so it survives the empty state,
            which is exactly when a reader wants it.

            (mdClick), not (click): md-icon-button's soft-disabled path calls
            preventDefault() and returns — it does NOT stop propagation — so a
            native click listener would still "clear" filters that are already
            clear. mdClick is emitted only when the control is genuinely live,
            which leaves the guard with the component instead of duplicating
            it here where it could drift.
          -->
          <md-tooltip [attr.text]="t('wealth.action.clearFilters')">
            <md-icon-button
              icon="filter_alt_off"
              [attr.aria-label]="t('wealth.action.clearFilters')"
              [attr.soft-disabled]="filtered ? null : ''"
              (mdClick)="clearFilters()"
            ></md-icon-button>
          </md-tooltip>
        </div>

        @if (rows.length === 0) {
          <awc-empty-state [message]="t('wealth.empty.orders')" [hint]="filtered" />
        } @else {
          <awc-blotter-table
            [rows]="rows"
            [query]="search"
            [total]="allRows.length"
            [bookTotal]="bookTotal"
            [page]="safePage"
            [rowsPerPage]="rowsPerPage"
            (pageChange)="page = $event"
            (rowsPerPageChange)="rowsPerPage = $event"
          >
            <!--
              The facet row travels as projected CONTENT rather than as state:
              it has to render inside md-table-container's top band, under the
              toolbar and outside the scroll port — but the state it drives
              belongs up here with every other filter.

              (mdSelect), not a click handler. A filter chip toggles its own
              selected before it emits, and the event carries the state it
              landed on — so the app never has to infer the new value from the
              old one, and a press that did not activate the chip cannot
              desynchronise the two. One listener for the whole set: mdSelect
              bubbles and is composed, so it retargets to the md-chip host and
              its data-facet reads straight off event.target.
            -->
            <div
              facetRow
              slot="top"
              class="row facet-row"
              role="group"
              [attr.aria-label]="t('wealth.trade.filter.group')"
              (mdSelect)="onFacet($event)"
            >
              @for (facet of facetList; track facet.id) {
                <md-chip
                  [attr.data-facet]="facet.id"
                  variant="filter"
                  [attr.label]="t(facet.labelKey)"
                  [attr.selected]="facets[facet.id] ? '' : null"
                ></md-chip>
              }
            </div>
          </awc-blotter-table>
        }
      </div>
    </awc-panel>
  `,
})
export class OrderBlotterComponent extends ShowcaseComponent {
  protected readonly sideOptions = SIDES;
  protected readonly statusOptions = STATUSES;
  protected readonly facetList = FACETS;
  protected readonly bookTotal = getBookTotals().orderCount;

  protected search = '';
  protected side: OrderSide | '' = '';
  protected status: OrderStatus | '' = '';
  protected facets: FacetState = NO_FACETS;
  protected page = 0;
  protected rowsPerPage = 10;

  @ViewChild('searchField') private searchEl?: ElementRef<HTMLElement & { value: string }>;

  /* -------------------------------------------------------------- filters */

  protected onSearch(event: Event): void {
    this.search = (event as CustomEvent<string>).detail ?? '';
    this.page = 0;
  }

  protected onSearchClear(): void {
    this.search = '';
    this.page = 0;
  }

  protected onSide(event: Event): void {
    this.side = ((event as CustomEvent<string>).detail || '') as OrderSide | '';
    this.page = 0;
  }

  protected onStatus(event: Event): void {
    this.status = ((event as CustomEvent<string>).detail || '') as OrderStatus | '';
    this.page = 0;
  }

  protected onFacet(event: Event): void {
    const chip = (event.target as HTMLElement | null)?.closest?.('md-chip') as HTMLElement | null;
    const id = chip?.dataset['facet'] as FacetId | undefined;
    if (!id) return;
    this.facets = {
      ...this.facets,
      [id]: Boolean((event as CustomEvent<{ selected: boolean }>).detail?.selected),
    };
    this.page = 0;
  }

  protected get filtered(): boolean {
    return (
      Boolean(this.search || this.side || this.status) ||
      FACETS.some((facet) => this.facets[facet.id])
    );
  }

  protected clearFilters(): void {
    this.search = '';
    this.side = '';
    this.status = '';
    this.facets = NO_FACETS;
    this.page = 0;
    // The custom elements own their own visual state. The two selects and the
    // chips follow their attribute bindings, but the search box is not bound —
    // nothing ever wrote a value into it, so nothing re-renders it — and the
    // empty string goes in by hand.
    const el = this.searchEl?.nativeElement;
    if (el) el.value = '';
  }

  /* ----------------------------------------------------------------- rows */

  // Every key is omitted when empty. getOrders treats a falsy value as "not
  // asked for" precisely so a screen can hand its state straight in without
  // deciding anything on the way. Cached on the filter fields so the array
  // handed to the table keeps its identity between change-detection passes.
  private rowsKey = '';
  private rowsCache: Order[] = [];

  protected get allRows(): Order[] {
    const key = JSON.stringify([
      this.search,
      this.side,
      this.status,
      this.facets.working,
      this.facets.mine,
      this.facets.fromAdvice,
    ]);
    if (key !== this.rowsKey) {
      this.rowsKey = key;
      this.rowsCache = getOrders({
        search: this.search || undefined,
        side: this.side || undefined,
        status: this.status || undefined,
        working: this.facets.working ? true : undefined,
        advisorId: this.facets.mine ? getAdvisor().id : undefined,
        fromProposal: this.facets.fromAdvice ? true : undefined,
      });
    }
    return this.rowsCache;
  }

  // A filter change can leave the reader stranded past the last page.
  protected get safePage(): number {
    const lastPage = Math.max(0, Math.ceil(this.allRows.length / this.rowsPerPage) - 1);
    return Math.min(this.page, lastPage);
  }

  private pageKey = '';
  private pageCache: Order[] = [];

  protected get rows(): Order[] {
    const all = this.allRows; // refreshes rowsKey first
    const key = `${this.rowsKey}|${this.safePage}|${this.rowsPerPage}`;
    if (key !== this.pageKey) {
      this.pageKey = key;
      const start = this.safePage * this.rowsPerPage;
      this.pageCache = all.slice(start, start + this.rowsPerPage);
    }
    return this.pageCache;
  }
}
