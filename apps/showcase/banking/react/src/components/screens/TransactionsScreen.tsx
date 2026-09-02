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
import { PHONE, useMediaQuery } from '@/lib/media';
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
  const phone = useMediaQuery(PHONE);

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
  /*
   * `md-search` carries `{ value }` on every one of its events — unlike
   * `md-text-field`, whose `mdInput` detail IS the bare string. The two are
   * different components and the shapes do not match; assuming one from the
   * other set the query to an object here and to `undefined` on the amount
   * field, and neither failed loudly.
   *
   * `mdSearch` rather than `mdInput`: it is debounced and
   * distinct-until-changed, which is what a filter over 652 rows wants, and
   * clearing the field flushes it immediately so the list comes straight back.
   */
  useCustomEvent<CustomEvent<{ value: string }>>(searchRef, 'mdSearch', (event) =>
    setSearch(event.detail.value ?? ''),
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

  /* What the collapsed phone header says, so a reader knows the list is
     filtered without opening the panel. */
  const activeCount =
    (month === REPORTING_MONTH ? 0 : 1) +
    (accountId ? 1 : 0) +
    (category ? 1 : 0) +
    (status ? 1 : 0) +
    (search ? 1 : 0);

  const clear = () => {
    setMonth(REPORTING_MONTH);
    setAccountId(null);
    setCategory(null);
    setStatus(null);
    setSearch('');
  };

  /**
   * One labelled facet: a caption, then its chips.
   *
   * THE CAPTION IS THE FIX FOR "WHICH ROW IS WHICH". Four rows of outlined
   * chips with nothing above them are four identical grey bands — a reader
   * cannot tell the months from the accounts from the categories without
   * reading every chip. The caption costs one line of label-medium and makes
   * the panel scannable.
   *
   * A PLAIN FUNCTION CALLED AS `{facet(...)}`, NOT A COMPONENT RENDERED AS
   * `<Facet/>`, and the distinction is the whole reason the filters worked and
   * then stopped.
   *
   * A component declared inside another component is a NEW FUNCTION IDENTITY on
   * every render, so React sees a different element type each time and unmounts
   * the entire subtree rather than updating it. The chips were rebuilt from
   * scratch on every keystroke, and the `mdSelect` / `mdSearch` listeners this
   * screen attaches through refs were left holding nodes that had been thrown
   * away — every facet silently stopped filtering. Calling the function inlines
   * the JSX into this component's own tree, where it belongs.
   */
  const facet = (label: string, rowRef: React.RefObject<HTMLDivElement>, children: React.ReactNode) => (
    <div className="facet" key={label}>
      <p className="facet__label">{label}</p>
      <div className="facet-row" ref={rowRef}>
        {children}
      </div>
    </div>
  );

  const filterBody = () => {
    return (
      <div className="stack">
        {/* `trigger="bar"` and `full-width`: the default trigger is an icon
            that opens the field, which in a filter panel renders as a lone
            magnifying glass and reads as broken. */}
        <md-search
          ref={searchRef}
          layout="docked"
          trigger="bar"
          variant="contained"
          full-width
          debounce="250"
          label={t('banking.action.search')}
          placeholder={t('banking.table.merchant')}
          value={search}
        />

        {/* The three facets below the month are single-select, and a chip that
            is already on deselects when pressed again — `mdSelect` reports the
            new state, so the null branch is the deselect. The month is
            different: it is a CHOICE, not a filter, so one is always on and
            pressing the current one does nothing. */}
        {facet(t('banking.facet.month'), monthRef, (<>
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
        </>))}

        {facet(t('banking.facet.account'), accountRef, (<>
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
        </>))}

        {facet(t('banking.facet.category'), categoryRef, (<>
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
        </>))}

        {facet(t('banking.facet.status'), statusRef, (<>
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
        </>))}

        {/*
          THE COUNT AND THE RESET GET THEIR OWN ROW.
          They used to sit inside the status facet, which put a sentence and a
          button in a scrolling chip row — the sentence collided with the last
          chip and both scrolled out of reach together. They belong to the
          panel, not to one facet.
        */}
        <div className="row row--between facet-foot">
          <span className="muted">
            {t('banking.common.showing', { shown: rows.length, total })}
          </span>
          {/* The reset exists only while there is something to reset; a
              permanently-inert control in a filter bar is furniture. */}
          {filtered ? (
            <md-button variant="text" size="sm" icon="restart_alt" onClick={clear}>
              {t('banking.action.clearFilters')}
            </md-button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Screen
      title={t('banking.screen.transactions.title')}
      subtitle={t('banking.screen.transactions.subtitle')}
      aside={<Count value={rows.length} />}
    >
      {/*
        THE FILTERS COLLAPSE ON A PHONE.
        Open, they are four chip rows and a search bar — the whole first screen,
        with no transaction visible until the reader scrolls past the controls
        for a list they have not seen yet. Behind a disclosure, the statement is
        what the screen opens on, and the header carries the count so a filtered
        list never looks like the whole one.
      */}
      {phone ? (
        <md-accordion variant="outlined" heading-level="2">
          <md-accordion-item
            headline={t('banking.action.filter')}
            icon="filter_list"
            supporting-text={
              activeCount > 0
                ? t('banking.common.showing', { shown: rows.length, total })
                : undefined
            }
          >
            {filterBody()}
          </md-accordion-item>
        </md-accordion>
      ) : (
        <Panel title={t('banking.action.filter')}>
          {filterBody()}
        </Panel>
      )}

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
                  <TransactionRow key={txn.id} txn={txn} showDate={false} />
                ))}
              </md-list>
            </div>
          ))}
        </Panel>
      )}
    </Screen>
  );
}
