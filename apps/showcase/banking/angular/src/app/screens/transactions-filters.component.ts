import { Component, CUSTOM_ELEMENTS_SCHEMA, EventEmitter, Input, Output } from '@angular/core';
import type {
  Account,
  Category,
  CategorySpend,
  TransactionStatus,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';

/**
 * The statement's filter body: a search and four labelled facets.
 *
 * EVERY FACET IS LABELLED. Four rows of outlined chips with nothing above them
 * are four identical grey bands; a reader cannot tell the months from the
 * accounts without reading every chip.
 *
 * INPUTS DOWN, EVENTS UP. The screen owns the state and this owns the
 * presentation, so the two placements — a panel on desktop, a disclosure on a
 * phone — render the same component against the same state.
 *
 * `md-search` carries `{ value }` on EVERY one of its events, unlike
 * `md-text-field`, whose detail is the bare string. `mdSearch` rather than
 * `mdInput`: debounced and distinct-until-changed, which is what a filter over
 * hundreds of rows wants.
 */
@Component({
  selector: 'awc-transactions-filters',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="stack">
      <!-- `trigger="bar"` and `full-width`: the default trigger is an icon that
           opens the field, which in a filter panel reads as broken. -->
      <md-search
        layout="docked"
        trigger="bar"
        variant="contained"
        full-width
        debounce="250"
        [attr.label]="t('banking.action.search')"
        [attr.placeholder]="t('banking.table.merchant')"
        [attr.value]="search"
        (mdSearch)="onSearch($event)"
      ></md-search>

      <div class="facet">
        <p class="facet__label">{{ t('banking.facet.month') }}</p>
        <div class="facet-row" (mdSelect)="onMonth($event)">
          @for (value of months; track value) {
            <md-chip
              [attr.data-month]="value"
              variant="filter"
              appearance="outlined"
              [attr.selected]="month === value ? '' : null"
              [attr.label]="t.formatDate(value + '-01', 'monthYear')"
            ></md-chip>
          }
          <md-chip
            [attr.data-month]="allMonths"
            variant="filter"
            appearance="outlined"
            [attr.selected]="month === allMonths ? '' : null"
            [attr.label]="t('banking.common.all')"
          ></md-chip>
        </div>
      </div>

      <div class="facet">
        <p class="facet__label">{{ t('banking.facet.account') }}</p>
        <div class="facet-row" (mdSelect)="onAccount($event)">
          @for (account of accounts; track account.id) {
            <md-chip
              [attr.data-account]="account.id"
              variant="filter"
              appearance="outlined"
              [attr.selected]="accountId === account.id ? '' : null"
              [attr.label]="account.nickname"
            ></md-chip>
          }
        </div>
      </div>

      <div class="facet">
        <p class="facet__label">{{ t('banking.facet.category') }}</p>
        <div class="facet-row" (mdSelect)="onCategory($event)">
          @for (row of categories; track row.category) {
            <md-chip
              [attr.data-category]="row.category"
              variant="filter"
              appearance="outlined"
              [attr.selected]="category === row.category ? '' : null"
              [attr.label]="t(row.categoryKey)"
            ></md-chip>
          }
        </div>
      </div>

      <div class="facet">
        <p class="facet__label">{{ t('banking.facet.status') }}</p>
        <div class="facet-row" (mdSelect)="onStatus($event)">
          @for (value of statuses; track value) {
            <md-chip
              [attr.data-status]="value"
              variant="filter"
              appearance="outlined"
              [attr.selected]="status === value ? '' : null"
              [attr.label]="t('banking.txnStatus.' + value)"
            ></md-chip>
          }
        </div>
      </div>

      <!-- The count and the reset belong to the panel, not to one facet: inside
           a scrolling chip row they collided with the last chip and scrolled
           out of reach together. -->
      <div class="row row--between facet-foot">
        <span class="muted">{{ t('banking.common.showing', { shown, total }) }}</span>
        @if (filtered) {
          <md-button variant="text" size="sm" icon="restart_alt" (click)="cleared.emit()">
            {{ t('banking.action.clearFilters') }}
          </md-button>
        }
      </div>
    </div>
  `,
})
export class TransactionsFiltersComponent extends ShowcaseComponent {
  @Input({ required: true }) accounts!: Account[];
  @Input({ required: true }) categories!: CategorySpend[];
  @Input({ required: true }) months!: string[];
  @Input({ required: true }) allMonths!: string;
  @Input({ required: true }) statuses!: TransactionStatus[];
  @Input({ required: true }) shown!: number;
  @Input({ required: true }) total!: number;
  @Input({ required: true }) filtered!: boolean;

  @Input({ required: true }) month!: string;
  @Input({ required: true }) accountId!: string | null;
  @Input({ required: true }) category!: Category | null;
  @Input({ required: true }) status!: TransactionStatus | null;
  @Input({ required: true }) search!: string;

  @Output() readonly monthChange = new EventEmitter<string>();
  @Output() readonly accountIdChange = new EventEmitter<string | null>();
  @Output() readonly categoryChange = new EventEmitter<Category | null>();
  @Output() readonly statusChange = new EventEmitter<TransactionStatus | null>();
  @Output() readonly searchChange = new EventEmitter<string>();
  @Output() readonly cleared = new EventEmitter<void>();

  protected onSearch(event: Event): void {
    this.searchChange.emit((event as CustomEvent<{ value: string }>).detail.value ?? '');
  }

  /* A month is a CHOICE: one is always on, and pressing the current one does
     nothing. The other three deselect when pressed again. */
  protected onMonth(event: Event): void {
    const value = (event.target as HTMLElement | null)?.dataset?.['month'];
    if (value) this.monthChange.emit(value);
  }

  protected onAccount(event: Event): void {
    const value = (event.target as HTMLElement | null)?.dataset?.['account'];
    if (value) this.accountIdChange.emit(this.selectedOf(event) ? value : null);
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLElement | null)?.dataset?.['category'] as Category | undefined;
    if (value) this.categoryChange.emit(this.selectedOf(event) ? value : null);
  }

  protected onStatus(event: Event): void {
    const value = (event.target as HTMLElement | null)?.dataset?.['status'] as
      | TransactionStatus
      | undefined;
    if (value) this.statusChange.emit(this.selectedOf(event) ? value : null);
  }

  private selectedOf(event: Event): boolean {
    return (event as CustomEvent<{ selected: boolean }>).detail.selected;
  }
}
