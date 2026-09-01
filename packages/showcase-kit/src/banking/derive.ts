/**
 * Everything the screens would otherwise compute for themselves.
 *
 * A chart series, a roll-up, an exchange quote — computed once here so a figure
 * cannot differ between the React build and the Svelte build. Pure and
 * synchronous, like the selectors: no clock, no randomness, no mutation.
 *
 * THE RULE FOR WHAT BELONGS HERE: if a screen needs a number the fixture does
 * not carry, it goes here rather than into a component. A `.reduce()` in a
 * `.tsx` file is the thing this module exists to prevent — five ports would
 * each write their own and the fifth would round differently.
 */
import {
  getAccounts,
  getBudgets,
  getCategorySpend,
  getFxPairFor,
  getHoldings,
  getInstrumentById,
  getInstruments,
  getMerchantById,
  getFxRates,
  getMonthlyFlow,
  getRateHistory,
  getSubscriptions,
  getTotals,
  getTransactions,
  getWatchlist,
  isSpendCategory,
} from './selectors';
import type {
  Account,
  Budget,
  CategorySpend,
  Currency,
  Instrument,
  Transaction,
} from './types';
import { REPORTING_MONTH } from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r6 = (n: number) => Math.round(n * 1000000) / 1000000;

/* ------------------------------------------------------------------ money */

/**
 * Convert between currencies through the frozen EUR rates.
 *
 * Two hops rather than a direct rate on purpose: the fixture stores one rate
 * per currency against EUR, so every cross rate is derived the same way and
 * EUR→GBP→EUR round-trips to the number it started at. A table of direct cross
 * rates would have to be kept consistent with itself, and would not be.
 */
export function convert(amount: number, from: Currency, to: Currency): number {
  if (from === to) return r2(amount);
  const rates = getFxRates();
  return r2((amount * rates[from]) / rates[to]);
}

/* --------------------------------------------------------- home and flow */

export interface BalancePoint {
  month: string;
  balanceEur: number;
}

/** The closing-balance curve, oldest first — the home screen's headline chart. */
export function balanceSeries(): BalancePoint[] {
  return getMonthlyFlow().map((m) => ({ month: m.month, balanceEur: m.closingBalanceEur }));
}

export interface FlowPoint {
  month: string;
  inEur: number;
  /** POSITIVE magnitude — the chart plots two bars, not one signed one. */
  outEur: number;
  netEur: number;
}

/** Money in against money out, per month, oldest first. */
export function flowSeries(): FlowPoint[] {
  return getMonthlyFlow().map((m) => ({
    month: m.month,
    inEur: m.inEur,
    outEur: m.outEur,
    netEur: m.netEur,
  }));
}

/**
 * Spending per month, oldest first.
 *
 * NOT `flowSeries().outEur`, and the difference matters: money out includes
 * standing transfers into savings and the cash leg of every trade, neither of
 * which is spending. Saving €400 is not an expense, and a screen that says so
 * tells the reader they spent money they still have.
 */
export function spendSeries(): { month: string; spentEur: number }[] {
  const months = getMonthlyFlow().map((m) => m.month);
  return months.map((month) => {
    const rows = getTransactions({ month, spendingOnly: true });
    return { month, spentEur: r2(rows.reduce((a, t) => a - t.amountEur, 0)) };
  });
}

/* -------------------------------------------------------------- analytics */

export interface RingSlice {
  id: string;
  labelKey: string;
  value: number;
  share: number;
}

/**
 * The category ring for the reporting month.
 *
 * Already sorted biggest-first by the fixture. `value` is a POSITIVE magnitude
 * because a ring cannot draw a negative slice — this is the one place the sign
 * convention is deliberately dropped, and it is dropped by taking the fixture's
 * own positive `amountEur` rather than by negating anything.
 */
export function categoryRing(): RingSlice[] {
  return getCategorySpend().map((c) => ({
    id: c.category,
    labelKey: c.categoryKey,
    value: c.amountEur,
    share: c.share,
  }));
}

export interface MerchantSpend {
  merchantId: string;
  name: string;
  categoryKey: string;
  initials: string;
  amountEur: number;
  transactionCount: number;
}

/**
 * Where the money actually went this month, biggest first.
 *
 * By merchant rather than by category, because "groceries €456" does not tell
 * anyone anything they can act on and "Nordmarkt €212 over 6 visits" does.
 */
export function topMerchants(limit = 6): MerchantSpend[] {
  const rows = new Map<string, MerchantSpend>();
  for (const t of getTransactions({ month: REPORTING_MONTH, spendingOnly: true })) {
    if (!t.merchantId) continue;
    const merchant = getMerchantById(t.merchantId);
    if (!merchant) continue;
    const cur = rows.get(t.merchantId) ?? {
      merchantId: t.merchantId,
      name: merchant.name,
      categoryKey: merchant.categoryKey,
      initials: merchant.initials,
      amountEur: 0,
      transactionCount: 0,
    };
    cur.amountEur = r2(cur.amountEur - t.amountEur);
    cur.transactionCount += 1;
    rows.set(t.merchantId, cur);
  }
  return [...rows.values()]
    .sort((a, b) => b.amountEur - a.amountEur || a.merchantId.localeCompare(b.merchantId, 'en'))
    .slice(0, limit);
}

/**
 * A category's spending across the statement, oldest first.
 *
 * Drives the sparkline beside each budget: a category that is over its cap for
 * the first time in a year reads very differently from one that is over every
 * month, and the number alone cannot say which.
 */
export function categoryTrend(category: CategorySpend['category']): { month: string; amountEur: number }[] {
  return getMonthlyFlow().map((m) => {
    const rows = getTransactions({ month: m.month, category, spendingOnly: true });
    return { month: m.month, amountEur: r2(rows.reduce((a, t) => a - t.amountEur, 0)) };
  });
}

/** Budgets with their trend attached, worst-tracking first. */
export function budgetRows(): (Budget & { trend: number[] })[] {
  return getBudgets()
    .map((b) => ({ ...b, trend: categoryTrend(b.category).map((p) => p.amountEur) }))
    .sort((a, b) => b.usedPct - a.usedPct || a.category.localeCompare(b.category, 'en'));
}

/* ------------------------------------------------------------- statement */

export interface StatementDay {
  date: string;
  rows: Transaction[];
  /** Signed net for the day, in EUR. */
  netEur: number;
}

/**
 * The statement grouped by calendar day, newest day first.
 *
 * A bank statement is read by day, not as a flat list — the day header is what
 * lets someone find "that Tuesday". Rows inside a day keep the selector's
 * order, which is newest-first by timestamp.
 */
export function statementDays(rows: Transaction[]): StatementDay[] {
  const days = new Map<string, Transaction[]>();
  for (const t of rows) {
    const list = days.get(t.date);
    if (list) list.push(t);
    else days.set(t.date, [t]);
  }
  return [...days.entries()]
    .sort((a, b) => b[0].localeCompare(a[0], 'en'))
    .map(([date, list]) => ({
      date,
      rows: list,
      netEur: r2(list.reduce((a, t) => a + (t.status === 'declined' ? 0 : t.amountEur), 0)),
    }));
}

/* -------------------------------------------------------------- accounts */

export interface AccountSummary {
  account: Account;
  /** This month, in the account's own currency. */
  inThisMonth: number;
  outThisMonth: number;
  transactionCount: number;
}

/** Per-account movement for the reporting month. */
export function accountSummaries(): AccountSummary[] {
  return getAccounts().map((account) => {
    const rows = getTransactions({ accountId: account.id, month: REPORTING_MONTH }).filter(
      (t) => t.status !== 'declined',
    );
    return {
      account,
      inThisMonth: r2(rows.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0)),
      outThisMonth: r2(rows.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0)),
      transactionCount: rows.length,
    };
  });
}

/* -------------------------------------------------------------- exchange */

export interface Quote {
  /** What the desk will pay, per one unit of `from`. */
  rate: number;
  /** Gross, before the fee, in `to`. */
  gross: number;
  /** Fee in the SOURCE currency — that is what leaves the account. */
  feeFrom: number;
  /** Net received, in `to`. */
  net: number;
  /** The desk's spread, in basis points. */
  spreadBps: number;
  /** Whether the stored pair runs the other way. */
  inverted: boolean;
}

/**
 * Price an exchange.
 *
 * The fee comes off the SOURCE side, which is how a real desk quotes it: you
 * are told what leaves your account and what lands. Taking it off the
 * destination instead would produce a slightly different net for the same
 * trade, and the two conventions differ by the fee times the rate — small, and
 * exactly the kind of small that makes a reader think the app cannot add up.
 *
 * Returns `null` for a pair the desk does not quote, rather than inventing a
 * cross rate the fixture never priced.
 */
export function quote(from: Currency, to: Currency, amount: number): Quote | null {
  if (from === to) return null;
  const found = getFxPairFor(from, to);
  if (!found) return null;

  const { pair, inverted } = found;
  const mid = inverted ? 1 / pair.rate : pair.rate;
  // The spread is what the desk keeps; the customer is always on the wrong side.
  const rate = r6(mid * (1 - pair.spreadBps / 10000));
  const feeFrom = r2(amount * pair.feePct);
  const gross = r2(amount * rate);
  const net = r2((amount - feeFrom) * rate);

  return { rate, gross, feeFrom, net, spreadBps: pair.spreadBps, inverted };
}

/** A pair's rate history as a plain series, oldest first. */
export function rateSeries(pairId: string): { date: string; rate: number }[] {
  return getRateHistory(pairId).map((p) => ({ date: p.date, rate: p.rate }));
}

/* -------------------------------------------------------------- investing */

export interface HoldingRow {
  instrument: Instrument;
  instrumentId: string;
  quantity: number;
  costBasisEur: number;
  marketValueEur: number;
  unrealisedPlEur: number;
  unrealisedPlPct: number;
  allocation: number;
  dayChangeEur: number;
}

/**
 * Holdings joined to their instruments, biggest position first.
 *
 * The join lives here rather than in each screen because five ports would each
 * write it and one of them would use `find` inside a render and re-run it per
 * row per frame.
 */
export function holdingRows(): HoldingRow[] {
  const rows: HoldingRow[] = [];
  for (const h of getHoldings()) {
    const instrument = getInstrumentById(h.instrumentId);
    // A holding whose instrument is missing is a broken fixture, not a runtime
    // condition — the generator asserts against it. Skipping is the safe read.
    if (instrument) rows.push({ ...h, instrument });
  }
  return rows.sort(
    (a, b) => b.marketValueEur - a.marketValueEur || a.instrumentId.localeCompare(b.instrumentId, 'en'),
  );
}

/** The portfolio ring: one slice per holding, by market value. */
export function portfolioRing(): RingSlice[] {
  return holdingRows().map((h) => ({
    id: h.instrument.id,
    labelKey: h.instrument.ticker,
    value: h.marketValueEur,
    share: h.allocation,
  }));
}

/**
 * Portfolio value over the price history, oldest first.
 *
 * Holds today's QUANTITIES constant and re-prices them down the history. That
 * is a deliberate simplification and worth stating: it shows how the current
 * portfolio would have moved, not what it was actually worth on each day, which
 * would need a position history the fixture does not carry. The invest screen
 * labels the chart accordingly.
 */
export function portfolioSeries(): { date: string; valueEur: number }[] {
  const rows = holdingRows();
  if (rows.length === 0) return [];
  const rates = getFxRates();
  const length = Math.min(...rows.map((r) => r.instrument.history.length));

  return Array.from({ length }, (_, i) => {
    const date = rows[0].instrument.history[rows[0].instrument.history.length - length + i].date;
    const valueEur = rows.reduce((total, row) => {
      const point = row.instrument.history[row.instrument.history.length - length + i];
      return total + row.quantity * point.price * rates[row.instrument.currency];
    }, 0);
    return { date, valueEur: r2(valueEur) };
  });
}

/** An instrument's price history as a bare series, for a sparkline. */
export function priceSeries(instrumentId: string): number[] {
  return getInstrumentById(instrumentId)?.history.map((p) => p.price) ?? [];
}

/**
 * Watchlist instruments, in the order they were added.
 *
 * Read from the fixture's own watchlist rather than inferred as "every
 * instrument that is not held". The two agree today and would stop agreeing the
 * moment something on the watchlist was bought — at which point the inferred
 * version would silently drop the row the reader was watching.
 */
export function watchlistRows(): Instrument[] {
  const all = getInstruments();
  return getWatchlist()
    .map((w) => all.find((i) => i.id === w.instrumentId))
    .filter((i): i is Instrument => i !== undefined);
}

/**
 * What a buy or sell would cost, before it is placed.
 *
 * The fee mirrors the fixture's own rule — 15 basis points, capped at €2.50 —
 * so an estimate on the ticket and the fee on a filled trade in the blotter
 * cannot disagree.
 */
export function tradeEstimate(
  instrumentId: string,
  quantity: number,
): { priceEur: number; amountEur: number; feeEur: number; totalEur: number } | null {
  const instrument = getInstrumentById(instrumentId);
  if (!instrument || !Number.isFinite(quantity) || quantity <= 0) return null;
  const priceEur = instrument.priceEur;
  const amountEur = r2(quantity * priceEur);
  const feeEur = r2(Math.min(2.5, amountEur * 0.0015));
  return { priceEur, amountEur, feeEur, totalEur: r2(amountEur + feeEur) };
}

/* ---------------------------------------------------------- subscriptions */

export interface UpcomingCharge {
  subscriptionId: string;
  name: string;
  initials: string;
  amountEur: number;
  cadenceKey: string;
  nextChargeDate: string;
}

/** The next charges due, soonest first. Active subscriptions only. */
export function upcomingCharges(limit = 4): UpcomingCharge[] {
  return getSubscriptions({ active: true })
    .slice(0, limit)
    .map((s) => {
      const merchant = getMerchantById(s.merchantId);
      return {
        subscriptionId: s.id,
        name: merchant?.name ?? s.merchantId,
        initials: merchant?.initials ?? '—',
        amountEur: s.amountEur,
        cadenceKey: s.cadenceKey,
        nextChargeDate: s.nextChargeDate,
      };
    });
}

/* ------------------------------------------------------------- headlines */

export interface Headline {
  /** Dictionary key for the label. */
  labelKey: string;
  valueEur: number;
  /** Signed fraction against the comparison period, or `null` when there is none. */
  changePct: number | null;
}

/**
 * The four figures across the top of the home screen.
 *
 * Assembled here rather than in each port so the four are the same four
 * everywhere, in the same order, with the same comparison attached.
 */
export function headlines(): Headline[] {
  const totals = getTotals();
  return [
    { labelKey: 'banking.kpi.netWorth', valueEur: totals.netWorthEur, changePct: null },
    { labelKey: 'banking.kpi.balance', valueEur: totals.totalBalanceEur, changePct: null },
    {
      labelKey: 'banking.kpi.spentThisMonth',
      valueEur: totals.spentThisMonthEur,
      changePct: totals.spendChangePct,
    },
    {
      labelKey: 'banking.kpi.portfolio',
      valueEur: totals.portfolioValueEur,
      changePct: totals.portfolioReturnPct,
    },
  ];
}

/**
 * How much of every budget is used, as one figure.
 *
 * The home screen shows a single meter rather than five, and this is what it
 * plots. Capped at 1 for the meter's sake — the number beside it is not capped,
 * because a reader who is 14% over should be told 114%, not 100%.
 */
export function budgetOverall(): { spent: number; limit: number; usedPct: number } {
  const totals = getTotals();
  return {
    spent: totals.budgetSpentEur,
    limit: totals.budgetTotalEur,
    usedPct: r4(totals.budgetSpentEur / totals.budgetTotalEur),
  };
}

/** Categories with no budget set — the analytics screen offers to add one. */
export function uncappedCategories(): CategorySpend[] {
  const capped = new Set(getBudgets().map((b) => b.category));
  return getCategorySpend().filter((c) => isSpendCategory(c.category) && !capped.has(c.category));
}
