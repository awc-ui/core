import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import {
  assetClassTotals,
  getPositions,
  TABLES,
  type AssetClass,
  type ClassTotal,
  type Household,
  type Portfolio,
  type Position,
  type PositionSortKey,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  MoneyComponent,
  NumComponent,
  PercentComponent,
  SignedComponent,
} from '../components/bits.component';

/**
 * The household's holdings: a facet row of asset-class chips over a sortable
 * table. Ported from the React build's `HouseholdHoldings.tsx`.
 *
 * THE FILTER AND THE SORT BOTH GO THROUGH THE SELECTOR. `getPositions()` takes
 * `assetClass`, `sortBy` and `sortDir`, so neither the facet nor the header
 * comparator is written here — this component holds the REQUEST (which class,
 * which column, which direction) and re-reads the rows. Two ports that sort
 * their own arrays disagree the first time one of them forgets the id
 * tie-break; two ports that call the same selector cannot.
 *
 * `md-table` SORTS NOTHING BY ITSELF. `sort-by` / `sort-order` are display
 * state and `mdSortChange` is a request — the three-state cycle
 * (asc → desc → off) reports `order: 'none'` with an empty column, which is
 * what the reset branch below is for.
 *
 * THE FACETS ARE NOT `.filter()`ed OUT OF THE ROWS. Which classes exist in this
 * mandate comes from the kit's `assetClassTotals()`, which returns them in
 * `ASSET_CLASS_ORDER` and drops the ones with no position — so the chip row and
 * the allocation panel agree about what the household actually holds, and a
 * class with nothing in it never offers a facet that leads to an empty table.
 *
 * THERE IS NO "ALL" CHIP, and that is deliberate rather than an omission. A
 * chip that is already selected and stays selected when you click it would flip
 * its own `selected` (M3 filter chips toggle themselves and then emit) while
 * this component's state did not change — Angular would rebind an unchanged
 * attribute, write nothing, and the chip would sit deselected, lying about the
 * filter. Toggling the selected class off IS "all classes", and every click
 * there does change the state.
 *
 * NO PAGINATION. A household holds seven to nine positions. Pagination on nine
 * rows is a control that never has a second page to go to.
 *
 * The chip row's listener is DELEGATED: `mdSelect` bubbles and is composed, and
 * the retargeted `event.target` is the `md-chip` host carrying the `data-class`
 * attribute — so one listener on the row replaces one per chip.
 */

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

/** One column: its sort key when it has one, its header, its alignment. */
interface Column {
  key: PositionSortKey | null;
  label: string;
  numeric?: boolean;
}

/** The foot's two figures, whichever branch supplied them. */
interface FootTotals {
  marketValue: number;
  unrealisedPl: number;
}

@Component({
  selector: 'awc-household-holdings',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ChipComponent,
    EmptyStateComponent,
    MoneyComponent,
    NumComponent,
    PercentComponent,
    SignedComponent,
  ],
  template: `
    <div class="stack">
      <!-- variant="filter": these toggle. Every other chip in this console is
           an assist chip reporting a state, which is why they come from
           bits.component.ts and these do not. -->
      <div class="row" (mdSelect)="onFacet($event)">
        @for (facet of facets; track facet.assetClass) {
          <md-chip
            [attr.data-class]="facet.assetClass"
            variant="filter"
            appearance="outlined"
            [attr.label]="t(facet.assetClassKey)"
            [attr.selected]="assetClass === facet.assetClass ? '' : null"
          ></md-chip>
        }
        <span class="muted">
          {{ t('wealth.common.showing', { shown: rows.length, total: all.length }) }}
        </span>
      </div>

      @if (rows.length === 0) {
        <awc-empty-state [message]="t('wealth.empty.holdings')" [hint]="true" />
      } @else {
        <md-table-container variant="outlined" class="table-host">
          <md-table
            [attr.label]="t('wealth.panel.holdings')"
            [attr.column-template]="layout.columns"
            [attr.min-width]="layout.minWidth"
            keep-height="false"
            striped
            [attr.sort-by]="sort.column"
            [attr.sort-order]="sort.order"
            (mdSortChange)="onSortChange($event)"
          >
            <md-table-head>
              <!-- No active / order on the labels: md-table declares the
                   sort above and pushes both down into every label on sync, so
                   a value written here could only ever disagree with it. -->
              <md-table-row rowgroup="head">
                @for (column of columns; track column.label) {
                  <md-table-cell head scope="col" [attr.numeric]="column.numeric ? '' : null">
                    @if (column.key) {
                      <md-table-sort-label
                        [attr.column]="column.key"
                        [attr.default-order]="isNumericKey(column.key) ? 'desc' : 'asc'"
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
              @for (position of rows; track position.id) {
                <md-table-row [attr.value]="position.id">
                  <md-table-cell>
                    <span class="strong">{{ position.ticker }}</span>
                  </md-table-cell>
                  <md-table-cell>{{ position.instrumentName }}</md-table-cell>
                  <md-table-cell>
                    <md-chip awcChip kind="assetClass" [value]="position.assetClass"></md-chip>
                  </md-table-cell>
                  <md-table-cell>{{ position.currency }}</md-table-cell>
                  <md-table-cell numeric>
                    <span awcNum [value]="position.quantity"></span>
                  </md-table-cell>
                  <!-- The LOCAL price, in the instrument's own currency — the
                       EUR twin is the market-value column beside it. -->
                  <md-table-cell numeric>
                    <span
                      awcMoney
                      [value]="position.price"
                      [currency]="position.currency"
                      [digits]="2"
                    ></span>
                  </md-table-cell>
                  <md-table-cell numeric>
                    <span awcMoney [value]="position.marketValueEur" [compact]="true"></span>
                  </md-table-cell>
                  <md-table-cell numeric>
                    <bdi awcSigned [value]="position.unrealisedPl" [compact]="true"></bdi>
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
                </md-table-row>
              }
            </md-table-body>

            @if (totals; as totals) {
              <md-table-foot>
                <md-table-row rowgroup="foot">
                  <md-table-cell head scope="row" colspan="6">{{ t('wealth.common.total') }}</md-table-cell>
                  <md-table-cell numeric>
                    <span awcMoney [value]="totals.marketValue" [compact]="true"></span>
                  </md-table-cell>
                  <md-table-cell numeric>
                    <bdi awcSigned [value]="totals.unrealisedPl" [compact]="true"></bdi>
                  </md-table-cell>
                  <md-table-cell></md-table-cell>
                  <md-table-cell></md-table-cell>
                  <md-table-cell></md-table-cell>
                </md-table-row>
              </md-table-foot>
            }
          </md-table>
        </md-table-container>
      }
    </div>
  `,
})
export class HouseholdHoldingsComponent extends ShowcaseComponent {
  @Input({ required: true }) household!: Household;
  @Input({ required: true }) portfolio!: Portfolio | undefined;

  /** `TABLES.positions(false)` — eleven tracks; the household column is dropped. */
  protected readonly layout = TABLES.positions(false);

  protected assetClass: AssetClass | null = null;
  protected sort: SortState = INITIAL_SORT;

  /*
   * Getters recompute per change-detection pass, so every row set is cached on
   * the request that produced it — the household, the facet and the sort. That
   * is the exact equivalent of the React build's `useMemo` deps, and a stable
   * array is what keeps `@for` from re-keying and the chips from churning.
   */
  private allCache: { id: string; rows: Position[]; facets: ClassTotal[] } | null = null;
  private rowsCache: { key: string; rows: Position[] } | null = null;

  /**
   * Every position in the mandate, unfiltered — the facet row is built from
   * this, so the chips do not disappear as soon as one of them is chosen.
   */
  protected get all(): Position[] {
    return this.base.rows;
  }

  protected get facets(): ClassTotal[] {
    return this.base.facets;
  }

  private get base(): { id: string; rows: Position[]; facets: ClassTotal[] } {
    const id = this.household.id;
    if (this.allCache?.id !== id) {
      const rows = getPositions({ householdId: id });
      this.allCache = { id, rows, facets: assetClassTotals(rows) };
    }
    return this.allCache;
  }

  protected get rows(): Position[] {
    const key = `${this.household.id}|${this.assetClass ?? ''}|${this.sort.column}|${this.sort.order}`;
    if (this.rowsCache?.key !== key) {
      this.rowsCache = {
        key,
        rows: getPositions({
          householdId: this.household.id,
          assetClass: this.assetClass ?? undefined,
          sortBy: this.sort.column,
          sortDir: this.sort.order,
        }),
      };
    }
    return this.rowsCache.rows;
  }

  /**
   * The foot totals come from the kit in both branches.
   *
   * Filtered, they are the chosen class's own roll-up; unfiltered, they are the
   * mandate's securities value and unrealised P/L, which the generator asserts
   * are exactly the sum of the positions. Adding the rendered rows up here
   * would be the same number computed a second way, and the second way is the
   * one that drifts.
   */
  protected get totals(): FootTotals | undefined {
    if (this.assetClass) {
      return this.facets.find((row) => row.assetClass === this.assetClass);
    }
    return this.portfolio
      ? {
          marketValue: this.portfolio.securitiesValue,
          unrealisedPl: this.portfolio.unrealisedPl,
        }
      : undefined;
  }

  protected get columns(): Column[] {
    return [
      { key: 'ticker', label: this.t('wealth.table.ticker') },
      { key: 'instrumentName', label: this.t('wealth.table.instrument') },
      { key: null, label: this.t('wealth.table.assetClass') },
      { key: null, label: this.t('wealth.table.currency') },
      { key: null, label: this.t('wealth.table.quantity'), numeric: true },
      { key: null, label: this.t('wealth.table.price'), numeric: true },
      { key: 'marketValueEur', label: this.t('wealth.table.marketValue'), numeric: true },
      { key: 'unrealisedPl', label: this.t('wealth.table.unrealisedPl'), numeric: true },
      { key: 'unrealisedPlPct', label: this.t('wealth.table.plPct'), numeric: true },
      { key: 'weight', label: this.t('wealth.table.weight'), numeric: true },
      { key: 'dayChangePct', label: this.t('wealth.table.dayChange'), numeric: true },
    ];
  }

  protected isNumericKey(key: PositionSortKey): boolean {
    return NUMERIC_KEYS.includes(key);
  }

  /**
   * Turn a sort REQUEST into this component's sort state.
   *
   * The third click of a column's cycle clears the sort and the rows still have
   * to come back in some order, so it returns to `INITIAL_SORT` — which is what
   * the React reference does, and this file matches it deliberately. Note the
   * one edge it leaves: clearing the sort on `marketValueEur`, the column the
   * default already names, leaves the state unchanged, so nothing rebinds
   * `sort-by` and the table keeps the blank it gave itself. The holdings
   * screen's much larger tables push the display state back with `setSort()`
   * for exactly that case (`holdings-tables.component.ts`); a nine-row table
   * inside a panel is not worth diverging from the reference for.
   */
  protected onSortChange(event: Event): void {
    const { column, order } = (
      event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>
    ).detail;
    if (!column || order === 'none') {
      this.sort = INITIAL_SORT;
      return;
    }
    this.sort = { column: column as PositionSortKey, order };
  }

  protected onFacet(event: Event): void {
    const value = (event.target as HTMLElement | null)?.dataset?.['class'] as
      | AssetClass
      | undefined;
    if (!value) return;
    // Deselecting IS "all classes" — there is no chip for it, so the falsy
    // branch is the only way back to the unfiltered table.
    this.assetClass = (event as CustomEvent<{ selected: boolean }>).detail.selected ? value : null;
  }
}
