/**
 * Pure, synchronous selectors over the baked banking fixture.
 *
 * Every function here is referentially transparent: no clock, no randomness, no
 * I/O, no mutation of the fixture. Functions that return a LIST always return a
 * fresh array so callers can sort it in place; the objects inside are the shared
 * baked records — treat them as READ-ONLY. Functions that return a single record
 * return the shared object itself, and `undefined` when the id is unknown.
 *
 * This is the whole data surface the screens are allowed to use. If a screen
 * finds itself doing arithmetic over what comes back, that arithmetic belongs in
 * `derive.ts` next door, not in a component.
 */
import {
  ACCOUNTS,
  BUDGETS,
  CARDS,
  CATEGORY_SPEND,
  FIXTURE,
  FX_PAIRS,
  FX_RATES,
  HOLDINGS,
  INSTRUMENTS,
  MERCHANTS,
  MONTHLY_FLOW,
  PROFILE,
  RATE_HISTORY,
  SUBSCRIPTIONS,
  TOTALS,
  TRADES,
  TRANSACTIONS,
  WATCHLIST,
} from './generated';
import type {
  Account,
  BankTotals,
  BankingFixture,
  Budget,
  Card,
  CardState,
  CategorySpend,
  Category,
  Currency,
  FxPair,
  Holding,
  Instrument,
  InstrumentKind,
  Merchant,
  MonthlyFlow,
  Profile,
  RatePoint,
  Subscription,
  Trade,
  Transaction,
  TransactionStatus,
  TransactionType,
  WatchItem,
} from './types';
import { REPORTING_MONTH } from './types';

/* ------------------------------------------------------------------ shared */

const fold = (value: string) => value.toLocaleLowerCase('en');
const matches = (needle: string, ...haystack: string[]) =>
  !needle || fold(haystack.join(' ')).includes(needle);

/** Page an already-sorted list. `limit` undefined means "to the end". */
function page<T>(rows: T[], offset = 0, limit?: number): T[] {
  const start = Math.max(0, offset);
  return limit === undefined ? rows.slice(start) : rows.slice(start, start + Math.max(0, limit));
}

/**
 * Compare on one key, then on `id`.
 *
 * The id tie-break is not decoration: two transactions on the same day for the
 * same amount must come out in the same order in every framework build, or the
 * parity check is comparing two different tables.
 */
function by<T extends { id: string }>(key: keyof T, dir: 'asc' | 'desc'): (a: T, b: T) => number {
  const sign = dir === 'asc' ? 1 : -1;
  return (a, b) => {
    const av = a[key] as unknown;
    const bv = b[key] as unknown;
    if (typeof av === 'string' && typeof bv === 'string') {
      return sign * av.localeCompare(bv, 'en') || a.id.localeCompare(b.id, 'en');
    }
    return sign * ((av as number) - (bv as number)) || a.id.localeCompare(b.id, 'en');
  };
}

/** `YYYY-MM` of an ISO calendar date. */
const monthOf = (isoDate: string) => isoDate.slice(0, 7);

/* --------------------------------------------------------- the whole thing */

/** The entire fixture, in one object. Prefer the narrow selectors below. */
export function getFixture(): BankingFixture {
  return FIXTURE;
}

/** Units of EUR per one unit of the key currency. */
export function getFxRates(): Record<Currency, number> {
  return FX_RATES;
}

/** The headline figures. Never recompute one of these from the records. */
export function getTotals(): BankTotals {
  return TOTALS;
}

/** The account holder. */
export function getProfile(): Profile {
  return PROFILE;
}

/* ---------------------------------------------------------------- accounts */

export function getAccounts(): Account[] {
  return ACCOUNTS.slice() as Account[];
}

export function getAccountById(id: string): Account | undefined {
  return (ACCOUNTS as Account[]).find((a) => a.id === id);
}

/**
 * The account the home screen leads with.
 *
 * The generator asserts exactly one is primary, so the fallback is unreachable
 * — it is here because the return type would otherwise be optional and every
 * call site would carry a null check for a case that cannot happen.
 */
export function getPrimaryAccount(): Account {
  const accounts = ACCOUNTS as Account[];
  return accounts.find((a) => a.primary) ?? accounts[0];
}

/** Current accounts only — what the exchange desk can move between. */
export function getSpendingAccounts(): Account[] {
  return (ACCOUNTS as Account[]).filter((a) => a.kind === 'current');
}

/* ------------------------------------------------------------------- cards */

export interface CardFilter {
  accountId?: string;
  state?: CardState;
}

export function getCards(filter: CardFilter = {}): Card[] {
  return (CARDS as Card[]).filter(
    (c) =>
      (!filter.accountId || c.accountId === filter.accountId) &&
      (!filter.state || c.state === filter.state),
  );
}

export function getCardById(id: string): Card | undefined {
  return (CARDS as Card[]).find((c) => c.id === id);
}

/* --------------------------------------------------------------- merchants */

export function getMerchants(): Merchant[] {
  return MERCHANTS.slice() as Merchant[];
}

export function getMerchantById(id: string): Merchant | undefined {
  return (MERCHANTS as Merchant[]).find((m) => m.id === id);
}

/* ------------------------------------------------------------ transactions */

export type TransactionSortKey = 'date' | 'amountEur' | 'counterparty';

export interface TransactionFilter {
  accountId?: string;
  cardId?: string;
  category?: Category;
  type?: TransactionType;
  status?: TransactionStatus;
  /** `YYYY-MM`. */
  month?: string;
  /** Matched against counterparty, note and the transaction id. */
  search?: string;
  /** Spending only — drops income, transfers and investing. */
  spendingOnly?: boolean;
  sortBy?: TransactionSortKey;
  sortDir?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

/** The three categories that are movement rather than spending. */
const NON_SPEND = new Set<Category>(['income', 'transfers', 'investing']);

/** Whether a category counts towards "what I spent". */
export function isSpendCategory(category: Category): boolean {
  return !NON_SPEND.has(category);
}

/**
 * The statement, newest first by default.
 *
 * Sorting on `date` alone would scramble the order within a day, so the default
 * sort is on the full `timestamp` — which is exactly why the fixture carries
 * one. A caller that asks for `date` gets the same thing.
 */
export function getTransactions(filter: TransactionFilter = {}): Transaction[] {
  const needle = fold(filter.search ?? '').trim();
  const rows = (TRANSACTIONS as Transaction[]).filter(
    (t) =>
      (!filter.accountId || t.accountId === filter.accountId) &&
      (!filter.cardId || t.cardId === filter.cardId) &&
      (!filter.category || t.category === filter.category) &&
      (!filter.type || t.type === filter.type) &&
      (!filter.status || t.status === filter.status) &&
      (!filter.month || monthOf(t.date) === filter.month) &&
      (!filter.spendingOnly || (isSpendCategory(t.category) && t.amountEur < 0)) &&
      matches(needle, t.counterparty, t.note ?? '', t.id),
  );

  const dir = filter.sortDir ?? 'desc';
  const key = filter.sortBy ?? 'date';
  rows.sort(key === 'date' ? by<Transaction>('timestamp', dir) : by<Transaction>(key, dir));

  return page(rows, filter.offset, filter.limit);
}

export function getTransactionById(id: string): Transaction | undefined {
  return (TRANSACTIONS as Transaction[]).find((t) => t.id === id);
}

/** The reporting month's rows, newest first. */
export function getMonthTransactions(filter: TransactionFilter = {}): Transaction[] {
  return getTransactions({ ...filter, month: REPORTING_MONTH });
}

/* ------------------------------------------------- budgets and categories */

export function getBudgets(): Budget[] {
  return BUDGETS.slice() as Budget[];
}

export function getBudgetFor(category: Category): Budget | undefined {
  return (BUDGETS as Budget[]).find((b) => b.category === category);
}

/** The reporting month's spending, biggest category first. */
export function getCategorySpend(): CategorySpend[] {
  return CATEGORY_SPEND.slice() as CategorySpend[];
}

/** `STATEMENT_MONTHS` of money in and out, oldest first. */
export function getMonthlyFlow(): MonthlyFlow[] {
  return MONTHLY_FLOW.slice() as MonthlyFlow[];
}

/* -------------------------------------------------------------- the desk */

export function getFxPairs(): FxPair[] {
  return FX_PAIRS.slice() as FxPair[];
}

export function getFxPairById(id: string): FxPair | undefined {
  return (FX_PAIRS as FxPair[]).find((p) => p.id === id);
}

/**
 * The pair for two currencies, either way round.
 *
 * The desk quotes six pairs, not twelve — EUR/USD and USD/EUR are the same
 * market. `inverted` tells the caller which way the stored `rate` runs so the
 * ticket can divide rather than multiply, instead of the fixture carrying two
 * rows that could disagree.
 */
export function getFxPairFor(
  base: Currency,
  quote: Currency,
): { pair: FxPair; inverted: boolean } | undefined {
  const pairs = FX_PAIRS as FxPair[];
  const direct = pairs.find((p) => p.base === base && p.quote === quote);
  if (direct) return { pair: direct, inverted: false };
  const reverse = pairs.find((p) => p.base === quote && p.quote === base);
  return reverse ? { pair: reverse, inverted: true } : undefined;
}

/** A pair's rate history, oldest first. Empty for an unknown id. */
export function getRateHistory(pairId: string): RatePoint[] {
  return (RATE_HISTORY[pairId] ?? []).slice();
}

/* --------------------------------------------------------------- investing */

export interface InstrumentFilter {
  kind?: InstrumentKind;
  /** Matched against ticker and name. */
  search?: string;
  /** Only what is actually held. */
  heldOnly?: boolean;
  sortBy?: 'ticker' | 'name' | 'priceEur' | 'dayChangePct' | 'yearChangePct';
  sortDir?: 'asc' | 'desc';
  limit?: number;
}

export function getInstruments(filter: InstrumentFilter = {}): Instrument[] {
  const needle = fold(filter.search ?? '').trim();
  const held = new Set((HOLDINGS as Holding[]).map((h) => h.instrumentId));
  const rows = (INSTRUMENTS as Instrument[]).filter(
    (i) =>
      (!filter.kind || i.kind === filter.kind) &&
      (!filter.heldOnly || held.has(i.id)) &&
      matches(needle, i.ticker, i.name),
  );
  if (filter.sortBy) rows.sort(by<Instrument>(filter.sortBy, filter.sortDir ?? 'asc'));
  return page(rows, 0, filter.limit);
}

export function getInstrumentById(id: string): Instrument | undefined {
  return (INSTRUMENTS as Instrument[]).find((i) => i.id === id);
}

export function getHoldings(): Holding[] {
  return HOLDINGS.slice() as Holding[];
}

export function getHoldingFor(instrumentId: string): Holding | undefined {
  return (HOLDINGS as Holding[]).find((h) => h.instrumentId === instrumentId);
}

export function getWatchlist(): WatchItem[] {
  return WATCHLIST.slice() as WatchItem[];
}

export interface TradeFilter {
  instrumentId?: string;
  status?: Trade['status'];
  limit?: number;
}

/** Trades, newest first. */
export function getTrades(filter: TradeFilter = {}): Trade[] {
  const rows = (TRADES as Trade[]).filter(
    (t) =>
      (!filter.instrumentId || t.instrumentId === filter.instrumentId) &&
      (!filter.status || t.status === filter.status),
  );
  rows.sort(by<Trade>('timestamp', 'desc'));
  return page(rows, 0, filter.limit);
}

/* ----------------------------------------------------------- subscriptions */

export function getSubscriptions(filter: { active?: boolean } = {}): Subscription[] {
  const rows = (SUBSCRIPTIONS as Subscription[]).filter(
    (s) => filter.active === undefined || s.active === filter.active,
  );
  rows.sort(by<Subscription>('nextChargeDate', 'asc'));
  return rows;
}

export function getSubscriptionById(id: string): Subscription | undefined {
  return (SUBSCRIPTIONS as Subscription[]).find((s) => s.id === id);
}
