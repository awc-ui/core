import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  getCounterparties,
  type Counterparty,
  type CounterpartySortKey,
  type SectorId,
} from '@awc-ui/showcase-kit/data';
import { TABLES, utilisationColor } from '@awc-ui/showcase-kit/credit-risk';
import { ShowcaseComponent } from '../lib/screen.base';
import { ChipComponent, DotComponent } from './bits.component';
import { EmptyStateComponent } from './empty-state.component';

const NUMERIC_KEYS: CounterpartySortKey[] = [
  'ead',
  'pd',
  'expectedLoss',
  'rwa',
  'utilisation',
  'grade',
];

/**
 * The counterparty table, used by the overview and by every sector screen.
 *
 * SORTING. `md-table` sorts nothing by itself — `sort-by`/`sort-order` are
 * display state and `mdSortChange` is a REQUEST. The handler pushes the request
 * into component state, and the rows are re-read through `getCounterparties()`,
 * whose filter takes the same sort keys the header offers. So the sort is done
 * by the selector that owns the data, not by a second comparator here that could
 * disagree with it.
 *
 * PAGING. `md-table-pagination` is display state plus a REQUEST too: it renders
 * the readout and the controls, and this component owns which slice is rendered.
 *
 * DRILLING. The legal name is a real anchor, not a row click: reachable by
 * keyboard, has a URL you can copy, survives JavaScript being slow to arrive.
 * Legal names are proper nouns and are never translated.
 */
@Component({
  selector: 'awc-counterparty-table',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  imports: [RouterLink, ChipComponent, DotComponent, EmptyStateComponent],
  template: `
    @if (rows.length === 0) {
      <awc-empty-state [message]="t('empty.counterparties')" [hint]="true" />
    } @else {
      <md-table-container variant="outlined">
        <!--
          keep-height: md-table ratchets its height by default so paging cannot
          make the page jump. That baseline is measured once and never
          recomputed, so a density change strands the taller height and leaves
          dead space below the rows — 176px at rung -4. Pagination already holds
          the row count steady here, so the ratchet earns little; live density
          switching matters more.

          row-offset / row-count: without them assistive tech announces "row 1 of
          10" on every page instead of the row's position in the whole book.
          row-count takes the BODY total; md-table adds the head and foot rows.
        -->
        <md-table
          [attr.label]="t('screen.counterparties.title')"
          [attr.column-template]="layout.columns"
          [attr.min-width]="layout.minWidth"
          keep-height="false"
          striped
          [attr.sort-by]="sortColumn"
          [attr.sort-order]="sortOrder"
          [attr.row-offset]="safePage * rowsPerPage"
          [attr.row-count]="allRows.length"
          (mdSortChange)="onSortChange($event)"
        >
          <md-table-head>
            <!-- The sort labels carry no active/order: md-table already declares
                 sort-by / sort-order above and pushes both down into every label
                 on sync, so anything written here could only ever disagree. -->
            <md-table-row rowgroup="head">
              @for (column of columns; track column.label) {
                <md-table-cell head scope="col" [attr.numeric]="column.numeric ? '' : null">
                  @if (column.key) {
                    <md-table-sort-label
                      [attr.column]="column.key"
                      [attr.default-order]="defaultOrder(column.key)"
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
            @for (cp of rows; track cp.id) {
              <md-table-row [attr.value]="cp.id">
                <md-table-cell>
                  <span class="row" style="gap: var(--md-sys-spacing-gap-xs, 4px)">
                    <md-status-dot awcDot kind="watch" [value]="cp.watchlist"></md-status-dot>
                    <a class="drill" [routerLink]="appPath(route.counterparty(cp.id))">
                      {{ cp.legalName }}
                    </a>
                  </span>
                </md-table-cell>
                @if (showSector) {
                  <md-table-cell>
                    <a class="drill" [routerLink]="appPath(route.sector(cp.sectorId))">
                      {{ t('sector.' + cp.sectorId) }}
                    </a>
                  </md-table-cell>
                }
                <md-table-cell>{{ t('country.' + cp.country) }}</md-table-cell>
                <md-table-cell>
                  <md-chip awcChip
                    kind="rating"
                    [value]="cp.ratingLabel"
                    [band]="cp.ratingBand"
                    [grade]="cp.grade"></md-chip>
                </md-table-cell>
                <md-table-cell numeric>
                  {{ t.formatPercent(cp.pd, { maximumFractionDigits: 2 }) }}
                </md-table-cell>
                <md-table-cell numeric>
                  {{ t.formatPercent(cp.lgd, { maximumFractionDigits: 0 }) }}
                </md-table-cell>
                <md-table-cell numeric>
                  {{ t.formatCurrency(cp.ead, { notation: 'compact' }) }}
                </md-table-cell>
                <md-table-cell numeric>
                  {{ t.formatCurrency(cp.expectedLoss, { notation: 'compact' }) }}
                </md-table-cell>
                <md-table-cell numeric>
                  {{ t.formatCurrency(cp.rwa, { notation: 'compact' }) }}
                </md-table-cell>
                <md-table-cell numeric>
                  <span [style.color]="'var(--md-sys-color-' + utilisationColor(cp.utilisation) + ')'">
                    {{ t.formatPercent(cp.utilisation, { maximumFractionDigits: 0 }) }}
                  </span>
                </md-table-cell>
              </md-table-row>
            }
          </md-table-body>
        </md-table>
        <md-table-pagination
          slot="bottom"
          [attr.count]="allRows.length"
          [attr.page]="safePage"
          [attr.rows-per-page]="rowsPerPage"
          rows-per-page-options="10,25,all"
          show-first-last
          [attr.label-rows-per-page]="t('table.rowsPerPage')"
          [attr.label-displayed-rows]="t('table.displayedRows')"
          [attr.label-first-page]="t('table.firstPage')"
          [attr.label-previous-page]="t('table.previousPage')"
          [attr.label-next-page]="t('table.nextPage')"
          [attr.label-last-page]="t('table.lastPage')"
          [attr.label-all]="t('table.all')"
          (mdPageChange)="onPageChange($event)"
          (mdRowsPerPageChange)="onRowsPerPageChange($event)"
        ></md-table-pagination>
      </md-table-container>
    }
  `,
})
export class CounterpartyTableComponent extends ShowcaseComponent {
  @Input() sectorId?: SectorId;
  @Input() showSector = true;

  protected readonly utilisationColor = utilisationColor;

  private readonly initialSort = { column: 'ead' as CounterpartySortKey, order: 'desc' as const };
  protected sortColumn: CounterpartySortKey = this.initialSort.column;
  protected sortOrder: 'asc' | 'desc' = this.initialSort.order;
  protected page = 0;
  protected rowsPerPage = 10;

  protected get layout() {
    return TABLES.counterparties(this.showSector);
  }

  protected get allRows(): Counterparty[] {
    return getCounterparties({
      sectorId: this.sectorId,
      sortBy: this.sortColumn,
      sortDir: this.sortOrder,
    });
  }

  // A sort or filter change can leave the reader stranded past the last page.
  protected get safePage(): number {
    const last = Math.max(0, Math.ceil(this.allRows.length / this.rowsPerPage) - 1);
    return Math.min(this.page, last);
  }

  protected get rows(): Counterparty[] {
    const start = this.safePage * this.rowsPerPage;
    return this.allRows.slice(start, start + this.rowsPerPage);
  }

  protected get columns(): { key: CounterpartySortKey | null; label: string; numeric?: boolean }[] {
    return [
      { key: 'legalName', label: this.t('table.counterparty') },
      ...(this.showSector ? [{ key: null, label: this.t('table.sector') }] : []),
      { key: null, label: this.t('table.country') },
      { key: 'grade', label: this.t('table.rating') },
      { key: 'pd', label: this.t('table.pd'), numeric: true },
      { key: null, label: this.t('table.lgd'), numeric: true },
      { key: 'ead', label: this.t('table.ead'), numeric: true },
      { key: 'expectedLoss', label: this.t('table.expectedLoss'), numeric: true },
      { key: 'rwa', label: this.t('table.rwa'), numeric: true },
      { key: 'utilisation', label: this.t('table.utilisation'), numeric: true },
    ];
  }

  protected defaultOrder(key: CounterpartySortKey): 'asc' | 'desc' {
    return NUMERIC_KEYS.includes(key) ? 'desc' : 'asc';
  }

  protected onSortChange(event: Event): void {
    const { column, order } = (
      event as CustomEvent<{ column: string; order: 'asc' | 'desc' | 'none' }>
    ).detail;
    if (!column || order === 'none') {
      this.sortColumn = this.initialSort.column;
      this.sortOrder = this.initialSort.order;
      return;
    }
    this.sortColumn = column as CounterpartySortKey;
    this.sortOrder = order;
  }

  protected onPageChange(event: Event): void {
    this.page = (event as CustomEvent<{ page: number }>).detail.page;
  }

  protected onRowsPerPageChange(event: Event): void {
    // No `page = 0` here: md-table-pagination has already reset the page and
    // emitted mdPageChange, which the handler above consumes. Resetting again is
    // the component's documented anti-pattern.
    this.rowsPerPage = (event as CustomEvent<{ rowsPerPage: number }>).detail.rowsPerPage;
  }
}
