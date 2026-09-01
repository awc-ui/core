import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  getHouseholds,
  TABLES,
  type Household,
  type HouseholdSortKey,
  type Segment,
} from '@awc-ui/showcase-kit/wealth';
import { ShowcaseComponent } from '../lib/screen.base';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  ChipComponent,
  DateTextComponent,
  DotComponent,
  HighlightComponent,
  MoneyComponent,
  NameCellComponent,
  NumComponent,
  SignedComponent,
} from '../components/bits.component';

/**
 * The advisor's book, as a filtered, sortable table.
 *
 * Ported from the React build's `OverviewBookTable.tsx` — belongs to the
 * overview screen and to nothing else: a household screen shows ONE household,
 * so there is no second caller to generalise for.
 *
 * THE TABLE SORTS NOTHING. `md-table`'s `sort-by` / `sort-order` are display
 * state and `mdSortChange` is a REQUEST — the handler pushes it into component
 * state and the rows are re-read through `getHouseholds()`, whose filter takes
 * the same six sort keys the header offers. The comparator therefore lives in
 * the kit, beside the data, and a second port cannot disagree with this one
 * about what "sorted by next review" means. The same is true of the two
 * filters: `search` and `segment` go into the selector, never into a
 * `.filter()` over its result.
 *
 * COMPOSITION. `md-table-container` WRAPS `md-table` (§7.1) and carries the
 * toolbar in its `top` slot, outside the scroll region, so the filters stay put
 * while the rows scroll. There is no pagination: eight households fit, and a
 * pagination bar reading "1–8 of 8" tells the reader nothing.
 *
 * DRILLING is the household name, which is a real anchor (`a.drill` with
 * `routerLink`), not a `clickable` row: it is reachable by Tab, it has a URL
 * you can copy, and it does not put a second activation target around the
 * cells.
 *
 * THE SEARCH FIELD IS UNCONTROLLED — no value binding, ever. `md-text-field`
 * owns its value, and writing it back each change-detection pass would
 * reformat under the caret. `mdInput` rather than `mdChange`: the field
 * commits on blur, and a filter that only applies when you leave it feels
 * broken. `clearable="internal"` gives it its own ✕, which empties the field
 * and emits `mdInput` with an empty string, landing here like any other
 * keystroke — so this component never has to write into the element at all.
 */

interface SortState {
  column: HouseholdSortKey;
  order: 'asc' | 'desc';
}

/** Largest book first — the same default `getHouseholds()` applies with no filter. */
const DEFAULT_SORT: SortState = { column: 'totalAum', order: 'desc' };

/** Which columns want `desc` on their first click: the ones where big is the news. */
const NUMERIC_KEYS: HouseholdSortKey[] = ['totalAum', 'ytdReturn', 'unrealisedPl', 'memberCount'];

@Component({
  selector: 'awc-overview-book-table',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    EmptyStateComponent,
    ChipComponent,
    DateTextComponent,
    DotComponent,
    HighlightComponent,
    MoneyComponent,
    NameCellComponent,
    NumComponent,
    SignedComponent,
  ],
  template: `
    <div class="table-host">
      <md-table-container variant="outlined">
        <md-table-toolbar
          slot="top"
          [attr.headline]="t('wealth.panel.book')"
          [attr.supporting-text]="t('wealth.common.showing', { shown: rows.length, total: total })"
        ></md-table-toolbar>

        <!--
          THE FILTERS ARE A SECOND top CHILD, not the toolbar's actions slot,
          and that was measured rather than guessed (see the React source).

          md-table-toolbar lays its band out as one non-wrapping row whose
          actions container is flex: 0 0 auto — sized for the icon buttons its
          manual shows. Two form fields are ~440px of intrinsic width, so at
          420px the band overflowed and the fields were drawn straight over the
          headline. The container's top part is a flex COLUMN, so a second
          child stacks under the toolbar, stays outside the scroll region with
          it, and wraps on its own at narrow widths.

          Both controls keep their own tab stop, which is what a form control
          should have — they never join a roving group.
        -->
        <div
          slot="top"
          class="row row--end"
          style="padding-inline: var(--md-sys-spacing-inset-xl, 24px); padding-block-end: var(--md-sys-spacing-inset-md, 12px)"
        >
          <md-text-field
            variant="outlined"
            type="search"
            clearable="internal"
            [attr.label]="t('wealth.action.searchHouseholds')"
            density="-2"
            style="flex: 1 1 200px; max-inline-size: 300px"
            (mdInput)="onSearch($event)"
          ></md-text-field>
          <md-select
            variant="outlined"
            clearable
            full-width
            [attr.label]="t('wealth.table.segment')"
            [attr.value]="segment"
            density="-2"
            [attr.clear-label]="t('wealth.action.clearFilters')"
            style="flex: 0 1 200px; max-inline-size: 240px"
            (mdChange)="onSegment($event)"
          >
            @for (value of segments; track value) {
              <md-select-option [attr.value]="value">{{ t('wealth.segment.' + value) }}</md-select-option>
            }
          </md-select>
        </div>

        <md-table
          [attr.label]="t('wealth.panel.book')"
          [attr.column-template]="layout.columns"
          [attr.min-width]="layout.minWidth"
          keep-height="false"
          striped
          [attr.sort-by]="sort.column"
          [attr.sort-order]="sort.order"
          [attr.empty]="rows.length === 0 ? '' : null"
          [attr.row-count]="rows.length"
          (mdSortChange)="onSort($event)"
        >
          <md-table-head>
            <!-- No active / order on the labels: md-table declares the sort
                 above and pushes both down into every label itself, so anything
                 written here could only ever disagree with it. -->
            <md-table-row rowgroup="head">
              @for (column of columns; track column.label) {
                <md-table-cell head scope="col" [attr.numeric]="column.numeric ? '' : null">
                  @if (column.key; as key) {
                    <md-table-sort-label
                      [attr.column]="key"
                      [attr.default-order]="defaultOrder(key)"
                      [attr.icon-position]="column.numeric ? 'start' : 'end'"
                    >{{ column.label }}</md-table-sort-label>
                  } @else {
                    {{ column.label }}
                  }
                </md-table-cell>
              }
            </md-table-row>
          </md-table-head>

          <md-table-body>
            @for (household of rows; track household.id) {
              <md-table-row [attr.value]="household.id">
                <md-table-cell>
                  <span awcNameCell>
                    <md-status-dot
                      awcDot
                      kind="kyc"
                      [value]="household.kycStatus"
                      ngProjectAs="[dot]"
                    ></md-status-dot>
                    <!-- The name is the only searched field this table shows —
                         getHouseholds also matches on id, which no column
                         renders, so marking anything else would claim a hit on
                         something the reader cannot see. -->
                    <a class="drill" [routerLink]="appPath(route.household(household.id))">
                      <awc-highlight [text]="household.name" [query]="search" />
                    </a>
                  </span>
                </md-table-cell>
                <md-table-cell>
                  <md-chip awcChip kind="segment" [value]="household.segment"></md-chip>
                </md-table-cell>
                <md-table-cell>
                  <md-chip awcChip kind="mandate" [value]="household.mandate"></md-chip>
                </md-table-cell>
                <md-table-cell>
                  <md-chip awcChip kind="strategy" [value]="household.strategy"></md-chip>
                </md-table-cell>
                <md-table-cell numeric>
                  <span awcMoney [value]="household.totalAum" [compact]="true"></span>
                </md-table-cell>
                <md-table-cell numeric>
                  <bdi awcSigned [value]="household.ytdReturn" kind="percent"></bdi>
                </md-table-cell>
                <md-table-cell numeric>
                  <bdi awcSigned [value]="household.unrealisedPl" [compact]="true"></bdi>
                </md-table-cell>
                <md-table-cell numeric>
                  <span awcNum [value]="household.memberCount"></span>
                </md-table-cell>
                <md-table-cell>
                  <time awcDate [value]="household.nextReviewDate"></time>
                </md-table-cell>
              </md-table-row>
            }
          </md-table-body>

          <!--
            The empty state stays INSIDE the container rather than replacing it.
            Emptiness here is always the reader's own filter, and swapping the
            table out would take the search field and the segment select away
            with it — leaving no way to undo what caused it.
          -->
          @if (rows.length === 0) {
            <div slot="empty">
              <awc-empty-state
                [message]="
                  search.trim()
                    ? t('wealth.empty.search', { query: search.trim() })
                    : t('wealth.empty.households')
                "
                [hint]="filtered"
              />
            </div>
          }
        </md-table>
      </md-table-container>
    </div>
  `,
})
export class OverviewBookTable extends ShowcaseComponent {
  protected readonly layout = TABLES.households(false);

  protected sort: SortState = DEFAULT_SORT;
  protected search = '';
  protected segment: Segment | '' = '';

  /*
   * The facets the book actually contains, not every value the type allows.
   *
   * Offering a segment no household is in gives the reader a filter that can
   * only ever empty the table. Sorted by the raw value so two framework builds
   * list them in the same order regardless of how the fixture happens to be
   * ordered. (The kit would be a better home for this list — flagged in the
   * React source too.)
   */
  protected readonly segments: Segment[] = [
    ...new Set(getHouseholds().map((household) => household.segment)),
  ].sort();

  protected readonly total = getHouseholds().length;

  protected get rows(): Household[] {
    return getHouseholds({
      sortBy: this.sort.column,
      sortDir: this.sort.order,
      search: this.search.trim() || undefined,
      segment: this.segment || undefined,
    });
  }

  protected get filtered(): boolean {
    return this.search.trim() !== '' || this.segment !== '';
  }

  protected get columns(): { key: HouseholdSortKey | null; label: string; numeric?: boolean }[] {
    return [
      { key: 'name', label: this.t('wealth.table.household') },
      { key: null, label: this.t('wealth.table.segment') },
      { key: null, label: this.t('wealth.table.mandate') },
      { key: null, label: this.t('wealth.table.strategy') },
      { key: 'totalAum', label: this.t('wealth.table.aum'), numeric: true },
      { key: 'ytdReturn', label: this.t('wealth.table.ytd'), numeric: true },
      { key: 'unrealisedPl', label: this.t('wealth.table.unrealisedPl'), numeric: true },
      { key: 'memberCount', label: this.t('wealth.table.members'), numeric: true },
      { key: 'nextReviewDate', label: this.t('wealth.table.nextReview') },
    ];
  }

  protected defaultOrder(key: HouseholdSortKey): 'asc' | 'desc' {
    return NUMERIC_KEYS.includes(key) ? 'desc' : 'asc';
  }

  /*
   * The three-state cycle ends in `none`, where the table clears its own
   * `sort-by` and reports an empty column. That is "no sort chosen", not "no
   * order at all" — the selector always returns something — so it falls back
   * to the same default the unfiltered book has.
   */
  protected onSort(event: Event): void {
    const { column, order } = (
      event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>
    ).detail;
    this.sort =
      !column || order === 'none'
        ? DEFAULT_SORT
        : { column: column as HouseholdSortKey, order };
  }

  protected onSearch(event: Event): void {
    this.search = (event as CustomEvent<string>).detail ?? '';
  }

  protected onSegment(event: Event): void {
    this.segment = ((event as CustomEvent<string>).detail ?? '') as Segment | '';
  }
}
