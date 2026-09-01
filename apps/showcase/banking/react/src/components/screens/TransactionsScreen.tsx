/**
 * The statement — every movement across every account.
 *
 * GROUPED BY DAY, NOT PAGED. A bank statement is read by day: the day header is
 * what lets someone find "that Tuesday", and it carries the day's net so the
 * reader does not have to add six rows up by eye. Paging would cut a day in
 * half across a page boundary, which is the one place a statement must not
 * break.
 *
 * FOUR FILTERS, ALL FROM THE KIT. Account, category, status and a search. Every
 * one is passed straight into `getTransactions()` — this screen holds the
 * chosen values and nothing else, so the filtering rule is the kit's and the
 * five ports cannot each implement it slightly differently.
 */

import { useMemo, useRef, useState } from 'react';
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
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '../elements';
import { EmptyState, Panel, Screen } from '../Shell';
import { Count, Money } from '../bits';
import { StatementDayHeading, TransactionRow } from './StatementParts';

/** The statuses worth filtering to. `reverted` is too rare to earn a chip. */
const STATUSES: TransactionStatus[] = ['completed', 'pending', 'declined'];

/**
 * A STATEMENT HAS A PERIOD, and this screen defaults to one.
 *
 * Rendering the whole twelve months put 652 rows and ~990 custom elements on
 * the page at once — measured. That is not a statement, it is a data dump: no
 * bank shows you a year by default, and every one of those rows is an element
 * the runtime has to upgrade before the screen settles. The month is a filter
 * like the other three, so widening it back out to everything is one chip
 * away and the reader is told how many rows that is.
 */
const ALL_MONTHS = 'all';

export function TransactionsScreen() {
  const t = useT();

  const [month, setMonth] = useState<string>(REPORTING_MONTH);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [status, setStatus] = useState<TransactionStatus | null>(null);
  const [search, setSearch] = useState('');

  const accounts = getAccounts();
  /* The facet row is built from the WHOLE month's categories, not the filtered
     set, so the chips do not disappear as soon as one of them is chosen. */
  const categories = getCategorySpend();

  /* Newest first — the six months a reader might plausibly scroll back to,
     not all twelve, and the flow series already knows which months exist. */
  const months = useMemo(() => getMonthlyFlow().map((m) => m.month).reverse().slice(0, 6), []);

  const rows = useMemo(
    () =>
      getTransactions({
        month: month === ALL_MONTHS ? undefined : month,
        accountId: accountId ?? undefined,
        category: category ?? undefined,
        status: status ?? undefined,
        search,
      }),
    [month, accountId, category, status, search],
  );

  const days = useMemo(() => statementDays(rows), [rows]);
  const total = getTransactions().length;
  const filtered =
    month !== REPORTING_MONTH ||
    accountId !== null ||
    category !== null ||
    status !== null ||
    search !== '';

  const searchRef = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent<{ value: string }>>(searchRef, 'mdSearch', (event) =>
    setSearch(event.detail?.value ?? ''),
  );

  const monthRef = useRef<HTMLDivElement | null>(null);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(monthRef, 'mdSelect', (event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.month;
    // No deselect branch: a statement is always OF something, so pressing the
    // month that is already chosen leaves it chosen.
    if (value) setMonth(value);
  });

  const accountRef = useRef<HTMLDivElement | null>(null);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(accountRef, 'mdSelect', (event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.account;
    if (!value) return;
    setAccountId(event.detail.selected ? value : null);
  });

  const categoryRef = useRef<HTMLDivElement | null>(null);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(categoryRef, 'mdSelect', (event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.category as Category | undefined;
    if (!value) return;
    setCategory(event.detail.selected ? value : null);
  });

  const statusRef = useRef<HTMLDivElement | null>(null);
  useCustomEvent<CustomEvent<{ selected: boolean }>>(statusRef, 'mdSelect', (event) => {
    const value = (event.target as HTMLElement | null)?.dataset?.status as
      | TransactionStatus
      | undefined;
    if (!value) return;
    setStatus(event.detail.selected ? value : null);
  });

  const clear = () => {
    setMonth(REPORTING_MONTH);
    setAccountId(null);
    setCategory(null);
    setStatus(null);
    setSearch('');
  };

  return (
    <Screen
      title={t('banking.screen.transactions.title')}
      subtitle={t('banking.screen.transactions.subtitle')}
      aside={<Count value={rows.length} />}
    >
      <Panel title={t('banking.action.filter')}>
        <div className="stack">
          <md-search
            ref={searchRef}
            label={t('banking.action.search')}
            placeholder={t('banking.table.merchant')}
            value={search}
          />

          {/* Four facet rows. The three below are single-select and a chip
              that is already on deselects when pressed again — `mdSelect`
              reports the new state, so the null branch is the deselect. The
              month row is different: it is a CHOICE, not a filter, so one is
              always on and pressing the current one does nothing. */}
          <div className="facet-row" ref={monthRef}>
            {months.map((value) => (
              <md-chip
                key={value}
                data-month={value}
                variant="filter"
                appearance="outlined"
                selected={month === value}
                label={t.formatDate(`${value}-01`, 'monthYear')}
              />
            ))}
            <md-chip
              data-month={ALL_MONTHS}
              variant="filter"
              appearance="outlined"
              selected={month === ALL_MONTHS}
              label={t('banking.common.all')}
            />
          </div>

          <div className="facet-row" ref={accountRef}>
            {accounts.map((account) => (
              <md-chip
                key={account.id}
                data-account={account.id}
                variant="filter"
                appearance="outlined"
                selected={accountId === account.id}
                label={account.nickname}
              />
            ))}
          </div>

          <div className="facet-row" ref={categoryRef}>
            {categories.map((row) => (
              <md-chip
                key={row.category}
                data-category={row.category}
                variant="filter"
                appearance="outlined"
                selected={category === row.category}
                label={t(row.categoryKey)}
              />
            ))}
          </div>

          <div className="facet-row" ref={statusRef}>
            {STATUSES.map((value) => (
              <md-chip
                key={value}
                data-status={value}
                variant="filter"
                appearance="outlined"
                selected={status === value}
                label={t(`banking.txnStatus.${value}`)}
              />
            ))}
            <span className="muted">
              {t('banking.common.showing', { shown: rows.length, total })}
            </span>
            {/* The clear button exists only while there is something to clear;
                a permanently-inert control in a filter bar is furniture. */}
            {filtered ? (
              <md-button variant="text" size="sm" icon="restart_alt" onClick={clear}>
                {t('banking.action.clearFilters')}
              </md-button>
            ) : null}
          </div>
        </div>
      </Panel>

      {days.length === 0 ? (
        <EmptyState message={t('banking.empty.transactions')} hint />
      ) : (
        <Panel>
          {days.map((day) => (
            <div key={day.date} className="stack">
              <StatementDayHeading date={day.date} netEur={day.netEur} />
              <md-list
                label={t.formatDate(day.date, 'long')}
                interaction-mode="multi-action"
                list-style="segmented"
              >
                {day.rows.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} showAccount />
                ))}
              </md-list>
            </div>
          ))}
        </Panel>
      )}
    </Screen>
  );
}
