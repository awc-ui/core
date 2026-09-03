import { Component, CUSTOM_ELEMENTS_SCHEMA, signal, computed } from '@angular/core';
import {
  REPORTING_MONTH,
  getAccounts,
  getCategorySpend,
  getMonthlyFlow,
  getTransactions,
  statementDays,
  type Category,
  type TransactionStatus,
} from '@awc-ui/showcase-kit/banking';
import { ShowcaseComponent } from '../lib/screen.base';
import { PHONE, mediaQuery } from '../lib/media';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import {
  CountComponent,
  DateTextComponent,
  FlowComponent,
  StatementRowComponent,
} from '../components/bits.component';
import { TransactionsFiltersComponent } from './transactions-filters.component';

/**
 * The statement — every movement across every account.
 *
 * GROUPED BY DAY, NOT PAGED. A statement is read by day, and paging would cut a
 * day across a boundary.
 *
 * A STATEMENT HAS A PERIOD. The default is the reporting month; the whole
 * twelve months is 652 rows and ~990 custom elements, a data dump rather than a
 * statement. The period is a facet, so the year is one chip away.
 *
 * ON A PHONE THE FILTERS COLLAPSE — open, they are the entire first screen.
 */
@Component({
  selector: 'awc-transactions-screen',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    CountComponent,
    DateTextComponent,
    FlowComponent,
    StatementRowComponent,
    TransactionsFiltersComponent,
  ],
  template: `
    <awc-screen
      [title]="t('banking.screen.transactions.title')"
      [subtitle]="t('banking.screen.transactions.subtitle')"
    >
      <md-chip aside awcCount [value]="rows().length"></md-chip>

      @if (phone()) {
        <md-accordion variant="outlined" heading-level="2">
          <md-accordion-item
            [attr.headline]="t('banking.action.filter')"
            icon="filter_list"
            [attr.supporting-text]="
              activeCount() > 0
                ? t('banking.common.showing', { shown: rows().length, total })
                : null
            "
          >
            <awc-transactions-filters
              [accounts]="accounts"
              [categories]="categories"
              [months]="months"
              [allMonths]="ALL_MONTHS"
              [statuses]="STATUSES"
              [shown]="rows().length"
              [total]="total"
              [filtered]="filtered()"
              [month]="month()"
              [accountId]="accountId()"
              [category]="category()"
              [status]="status()"
              [search]="search()"
              (monthChange)="month.set($event)"
              (accountIdChange)="accountId.set($event)"
              (categoryChange)="category.set($event)"
              (statusChange)="status.set($event)"
              (searchChange)="search.set($event)"
              (cleared)="clear()"
            />
          </md-accordion-item>
        </md-accordion>
      } @else {
        <awc-panel [title]="t('banking.action.filter')">
          <awc-transactions-filters
            [accounts]="accounts"
            [categories]="categories"
            [months]="months"
            [allMonths]="ALL_MONTHS"
            [statuses]="STATUSES"
            [shown]="rows().length"
            [total]="total"
            [filtered]="filtered()"
            [month]="month()"
            [accountId]="accountId()"
            [category]="category()"
            [status]="status()"
            [search]="search()"
            (monthChange)="month.set($event)"
            (accountIdChange)="accountId.set($event)"
            (categoryChange)="category.set($event)"
            (statusChange)="status.set($event)"
            (searchChange)="search.set($event)"
            (cleared)="clear()"
          />
        </awc-panel>
      }

      @if (days().length === 0) {
        <awc-empty-state [message]="t('banking.empty.transactions')" [hint]="true" />
      } @else {
        <awc-panel>
          @for (day of days(); track day.date) {
            <div class="stack">
              <div class="statement-day">
                <span><time awcDate [value]="day.date" format="long"></time></span>
                <bdi awcFlow [value]="day.netEur"></bdi>
              </div>
              <md-list
                [attr.label]="t.formatDate(day.date, 'long')"
                interaction-mode="multi-action"
                list-style="segmented"
              >
                @for (txn of day.rows; track txn.id) {
                  <md-list-item awcStatementRow [txn]="txn" [showDate]="false"></md-list-item>
                }
              </md-list>
            </div>
          }
        </awc-panel>
      }
    </awc-screen>
  `,
})
export class TransactionsScreen extends ShowcaseComponent {
  /** `reverted` is too rare to earn a chip. */
  protected readonly STATUSES: TransactionStatus[] = ['completed', 'pending', 'declined'];
  protected readonly ALL_MONTHS = 'all';

  protected readonly phone = mediaQuery(PHONE);

  protected readonly accounts = getAccounts();
  /* Built from the whole month's categories, not the filtered set, so the chips
     do not disappear as soon as one is chosen. */
  protected readonly categories = getCategorySpend();
  /* Newest first — the six months a reader might plausibly scroll back to. */
  protected readonly months = getMonthlyFlow().map((m) => m.month).reverse().slice(0, 6);
  protected readonly total = getTransactions().length;

  protected readonly month = signal<string>(REPORTING_MONTH);
  protected readonly accountId = signal<string | null>(null);
  protected readonly category = signal<Category | null>(null);
  protected readonly status = signal<TransactionStatus | null>(null);
  protected readonly search = signal('');

  protected readonly rows = computed(() =>
    getTransactions({
      month: this.month() === this.ALL_MONTHS ? undefined : this.month(),
      accountId: this.accountId() ?? undefined,
      category: this.category() ?? undefined,
      status: this.status() ?? undefined,
      search: this.search(),
    }),
  );

  protected readonly days = computed(() => statementDays(this.rows()));

  protected readonly filtered = computed(
    () =>
      this.month() !== REPORTING_MONTH ||
      this.accountId() !== null ||
      this.category() !== null ||
      this.status() !== null ||
      this.search() !== '',
  );

  protected readonly activeCount = computed(
    () =>
      (this.month() === REPORTING_MONTH ? 0 : 1) +
      (this.accountId() ? 1 : 0) +
      (this.category() ? 1 : 0) +
      (this.status() ? 1 : 0) +
      (this.search() ? 1 : 0),
  );

  protected clear(): void {
    this.month.set(REPORTING_MONTH);
    this.accountId.set(null);
    this.category.set(null);
    this.status.set(null);
    this.search.set('');
  }
}
