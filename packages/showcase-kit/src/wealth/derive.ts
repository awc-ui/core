/**
 * Series and roll-ups derived from the fixture — never invented, never random,
 * never clocked.
 *
 * The fixture is frozen at 2026-06-30 and carries two time dimensions: 24
 * month-end performance points per mandate, and 12 month-end closes per
 * instrument. Everything with a shape on any screen is computed from those plus
 * the static position and goal fields, so every framework build draws identical
 * lines.
 *
 * WHY THIS IS NOT IN THE APP. Six ports will eventually render these screens.
 * A roll-up written in a React component has to be written five more times, and
 * the first divergence — one build summing `marketValue` where another sums
 * `marketValueEur` — turns two screenshots into two different reports rather
 * than one comparison. Anything that is arithmetic lives here.
 *
 * Everything is memoised by argument, because these are called inside render.
 * The caches are correct precisely because the fixture is immutable.
 */

import {
  getAllocation,
  getFxRates,
  getGoals,
  getHouseholds,
  getInstrumentById,
  getPerformanceSeries,
  getPortfolioById,
  getPortfolioFor,
  getPositions,
} from './selectors';
import { ASSET_CLASS_ORDER } from './status';
import { HISTORY_MONTHS, REPORTING_DATE } from './types';
import type {
  AllocationRow,
  AssetClass,
  Currency,
  Goal,
  Household,
  PerformancePoint,
  PerformanceScope,
  Position,
  Region,
} from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r6 = (n: number) => Math.round(n * 1000000) / 1000000;

/* ---------------------------------------------------------------- returns */

/**
 * Compound a run of monthly returns into one figure.
 *
 * COMPOUNDED, NOT SUMMED. Six months of +1% is 6.15%, not 6.00%, and a console
 * that adds them is wrong by more than the difference it is being used to spot.
 */
export function compound(returns: number[]): number {
  return r6(returns.reduce((acc, r) => acc * (1 + r), 1) - 1);
}

/** The last `months` points of a series, oldest first. */
export function tail<T>(points: T[], months: number): T[] {
  return points.slice(Math.max(0, points.length - months));
}

export interface ReturnWindow {
  /** Whole months the window covers. */
  months: number;
  /** The mandate (or book) return over the window, as a fraction. */
  portfolio: number;
  /** The benchmark's, as a fraction. */
  benchmark: number;
  /** `portfolio - benchmark`. Negative means the mandate lagged. */
  excess: number;
}

/**
 * A return window over any performance series: 3, 6 (year to date), 12 or 24
 * months. Reads the series it is given, so it works for the book and for one
 * mandate without a second code path.
 */
export function returnWindow(points: PerformancePoint[], months: number): ReturnWindow {
  const slice = tail(points, months);
  const portfolio = compound(slice.map((p) => p.monthlyReturn));
  const benchmark = compound(slice.map((p) => p.benchmarkMonthlyReturn));
  return { months: slice.length, portfolio, benchmark, excess: r6(portfolio - benchmark) };
}

/** The four windows every performance panel shows, in display order. */
export function returnWindows(scope: PerformanceScope = {}): ReturnWindow[] {
  const points = getPerformanceSeries(scope);
  return [3, 6, 12, HISTORY_MONTHS].map((months) => returnWindow(points, months));
}

/**
 * Cumulative growth of 100 units, mandate against benchmark — the chart a
 * client actually reads, because two cumulative-return percentages crossing are
 * much harder to see than two lines.
 */
export interface GrowthPoint {
  date: string;
  quarter: string;
  portfolio: number;
  benchmark: number;
}

const growthCache = new Map<string, GrowthPoint[]>();

export function growthOf100(scope: PerformanceScope = {}, base = 100): GrowthPoint[] {
  const key = `${scope.portfolioId ?? ''}|${scope.householdId ?? ''}|${base}`;
  const cached = growthCache.get(key);
  if (cached) return cached;

  let portfolio = base;
  let benchmark = base;
  const points = getPerformanceSeries(scope).map((p) => {
    portfolio *= 1 + p.monthlyReturn;
    benchmark *= 1 + p.benchmarkMonthlyReturn;
    return { date: p.date, quarter: p.quarter, portfolio: r2(portfolio), benchmark: r2(benchmark) };
  });

  growthCache.set(key, points);
  return points;
}

/* --------------------------------------------------------------- roll-ups */

export interface ClassTotal {
  assetClass: AssetClass;
  assetClassKey: string;
  /** EUR. */
  marketValue: number;
  /** Share of the total the rows were drawn from, as a fraction. */
  weight: number;
  positionCount: number;
  /** EUR. Can be negative. */
  unrealisedPl: number;
}

/**
 * Positions rolled up by asset class, in `ASSET_CLASS_ORDER`.
 *
 * `cash` is never present: positions are securities, and the cash line comes
 * from `portfolio.cashBalance` through `getAllocation()`. A caller that wants
 * the full five-way split wants the allocation, not this.
 */
export function assetClassTotals(positions: Position[]): ClassTotal[] {
  const total = positions.reduce((a, p) => a + p.marketValueEur, 0);
  return ASSET_CLASS_ORDER.filter((cls) => cls !== 'cash')
    .map((assetClass) => {
      const rows = positions.filter((p) => p.assetClass === assetClass);
      const marketValue = r2(rows.reduce((a, p) => a + p.marketValueEur, 0));
      return {
        assetClass,
        assetClassKey: `wealth.assetClass.${assetClass}`,
        marketValue,
        weight: total ? r4(marketValue / total) : 0,
        positionCount: rows.length,
        unrealisedPl: r2(rows.reduce((a, p) => a + p.unrealisedPl, 0)),
      };
    })
    .filter((row) => row.positionCount > 0);
}

export interface RegionTotal {
  region: Region;
  regionKey: string;
  marketValue: number;
  weight: number;
  positionCount: number;
}

/** Positions rolled up by region, largest first. */
export function regionTotals(positions: Position[]): RegionTotal[] {
  const total = positions.reduce((a, p) => a + p.marketValueEur, 0);
  const seen = new Map<Region, Position[]>();
  for (const p of positions) {
    const bucket = seen.get(p.region);
    if (bucket) bucket.push(p);
    else seen.set(p.region, [p]);
  }
  return [...seen.entries()]
    .map(([region, rows]) => {
      const marketValue = r2(rows.reduce((a, p) => a + p.marketValueEur, 0));
      return {
        region,
        regionKey: `wealth.region.${region}`,
        marketValue,
        weight: total ? r4(marketValue / total) : 0,
        positionCount: rows.length,
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue || a.region.localeCompare(b.region, 'en'));
}

export interface CurrencyExposure {
  currency: Currency;
  /** EUR value of the holdings denominated in this currency. */
  marketValue: number;
  weight: number;
  positionCount: number;
  /** `false` for everything but EUR — the ones carrying translation risk. */
  isBase: boolean;
}

/**
 * Where the book's currency risk actually sits.
 *
 * Only securities are counted: portfolio cash is held in EUR in this fixture,
 * so including it would dilute every non-EUR weight with a number that carries
 * no translation risk at all.
 */
export function currencyExposure(positions: Position[]): CurrencyExposure[] {
  const total = positions.reduce((a, p) => a + p.marketValueEur, 0);
  const seen = new Map<Currency, Position[]>();
  for (const p of positions) {
    const bucket = seen.get(p.currency);
    if (bucket) bucket.push(p);
    else seen.set(p.currency, [p]);
  }
  return [...seen.entries()]
    .map(([currency, rows]) => {
      const marketValue = r2(rows.reduce((a, p) => a + p.marketValueEur, 0));
      return {
        currency,
        marketValue,
        weight: total ? r4(marketValue / total) : 0,
        positionCount: rows.length,
        isBase: currency === 'EUR',
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue || a.currency.localeCompare(b.currency, 'en'));
}

/* ----------------------------------------------------------------- movers */

export interface Mover {
  position: Position;
  /** `position.dayChangeEur`, lifted out so a table can sort on one field. */
  changeEur: number;
  changePct: number;
}

/**
 * The day's biggest moves across whatever positions are passed in, largest
 * ABSOLUTE move first — a €40k loss is as much news as a €40k gain, and a
 * gains-only list is the one that hides the problem.
 */
export function topMovers(positions: Position[], limit = 5): Mover[] {
  return positions
    .map((position) => ({
      position,
      changeEur: position.dayChangeEur,
      changePct: position.dayChangePct,
    }))
    .sort(
      (a, b) =>
        Math.abs(b.changeEur) - Math.abs(a.changeEur) ||
        a.position.id.localeCompare(b.position.id, 'en'),
    )
    .slice(0, Math.max(0, limit));
}

/**
 * The book's largest single holdings, aggregated ACROSS mandates.
 *
 * Two households holding the same ETF is one concentration, not two, and this
 * is the view that says so.
 */
export interface BookHolding {
  instrumentId: string;
  ticker: string;
  instrumentName: string;
  assetClass: AssetClass;
  assetClassKey: string;
  currency: Currency;
  /** EUR across every mandate. */
  marketValue: number;
  /** Share of the book's securities value, as a fraction. */
  weight: number;
  unrealisedPl: number;
  /** How many mandates hold it. */
  portfolioCount: number;
  positionIds: string[];
}

const bookHoldingsCache = new Map<string, BookHolding[]>();

export function bookHoldings(limit?: number): BookHolding[] {
  const key = String(limit ?? 'all');
  const cached = bookHoldingsCache.get(key);
  if (cached) return cached;

  const positions = getPositions();
  const total = positions.reduce((a, p) => a + p.marketValueEur, 0);
  const seen = new Map<string, Position[]>();
  for (const p of positions) {
    const bucket = seen.get(p.instrumentId);
    if (bucket) bucket.push(p);
    else seen.set(p.instrumentId, [p]);
  }

  const rows = [...seen.entries()]
    .map(([instrumentId, group]) => {
      const marketValue = r2(group.reduce((a, p) => a + p.marketValueEur, 0));
      const first = group[0];
      return {
        instrumentId,
        ticker: first.ticker,
        instrumentName: first.instrumentName,
        assetClass: first.assetClass,
        assetClassKey: first.assetClassKey,
        currency: first.currency,
        marketValue,
        weight: total ? r4(marketValue / total) : 0,
        unrealisedPl: r2(group.reduce((a, p) => a + p.unrealisedPl, 0)),
        portfolioCount: new Set(group.map((p) => p.portfolioId)).size,
        positionIds: group.map((p) => p.id).sort((a, b) => a.localeCompare(b, 'en')),
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue || a.instrumentId.localeCompare(b.instrumentId, 'en'));

  const out = limit === undefined ? rows : rows.slice(0, Math.max(0, limit));
  bookHoldingsCache.set(key, out);
  return out;
}

/* ------------------------------------------------------------- rebalancing */

export interface RebalanceRow extends AllocationRow {
  /** `|drift|`, so a table can sort by how far out it is regardless of sign. */
  absDrift: number;
  /** `'buy'` when the class is underweight, `'sell'` when it is over. */
  side: 'buy' | 'sell';
}

/**
 * One mandate's allocation, worst drift first, with the trade direction spelled
 * out. Rows already in band are kept — a rebalance sheet that hides them cannot
 * be read as a complete picture of the mandate.
 */
export function rebalanceSheet(portfolioId: string): RebalanceRow[] {
  return getAllocation(portfolioId)
    .map((row) => ({
      ...row,
      absDrift: r4(Math.abs(row.drift)),
      side: (row.drift < 0 ? 'buy' : 'sell') as 'buy' | 'sell',
    }))
    .sort((a, b) => b.absDrift - a.absDrift || a.assetClass.localeCompare(b.assetClass, 'en'));
}

/** Mandates with at least one class out of band, worst first. */
export interface DriftedMandate {
  household: Household;
  /** The single worst row. */
  worst: RebalanceRow;
  breachCount: number;
  driftedCount: number;
}

export function driftedMandates(): DriftedMandate[] {
  return getHouseholds()
    .map((household) => {
      const portfolio = getPortfolioFor(household.id);
      if (!portfolio) return null;
      const sheet = rebalanceSheet(portfolio.id);
      return {
        household,
        worst: sheet[0],
        breachCount: sheet.filter((r) => r.status === 'breach').length,
        driftedCount: sheet.filter((r) => r.status === 'drifted').length,
      };
    })
    .filter((row): row is DriftedMandate => row !== null && row.worst.status !== 'in-band')
    .sort((a, b) => b.worst.absDrift - a.worst.absDrift || a.household.id.localeCompare(b.household.id, 'en'));
}

/* ------------------------------------------------------------------ goals */

export interface GoalProjectionPoint {
  /** Year-end ISO date, except the last point which is the target date. */
  date: string;
  /** Whole months from the reporting date. */
  month: number;
  /** Projected balance at that date, EUR. */
  projected: number;
  /** The target, repeated at every point, so a chart can draw the line. */
  target: number;
}

const projectionCache = new Map<string, GoalProjectionPoint[]>();

/**
 * The funding path from today to the goal's target date, sampled yearly.
 *
 * Same formula the fixture used to compute `projectedAmount`, so the last point
 * of this series is exactly that number — a projection chart whose endpoint
 * disagrees with the figure beside it reads as a bug, and it is the same
 * calibration discipline the credit-risk rating history uses.
 *
 * SAMPLED, not monthly. The reader is deciding whether the goal lands, not
 * watching a balance tick over; twelve points is a readable line and 234 is a
 * smear. The step is chosen from the horizon rather than fixed at a year, so a
 * twelve-month liquidity reserve gets seven points instead of two — a
 * two-point "projection" is a straight line that shows nothing.
 */
export function goalProjection(goal: Goal, maxPoints = 12): GoalProjectionPoint[] {
  const cached = projectionCache.get(`${goal.id}|${maxPoints}`);
  if (cached) return cached;

  const months = Math.max(1, goal.monthsRemaining);
  const g = (1 + goal.assumedAnnualGrowth) ** (1 / 12) - 1;
  const at = (m: number) =>
    r2(goal.currentAmount * (1 + g) ** m + goal.monthlyContribution * (((1 + g) ** m - 1) / g));

  const step = Math.max(1, Math.ceil(months / Math.max(1, maxPoints - 1)));
  const marks: number[] = [];
  for (let m = 0; m < months; m += step) marks.push(m);
  marks.push(months);

  const [y, mo] = REPORTING_DATE.split('-').map(Number);
  const points = marks.map((month) => {
    // Day 0 of the following month is the last day of the month we want, in UTC.
    const end = new Date(Date.UTC(y, mo + month, 0));
    return {
      date: month === months ? goal.targetDate : end.toISOString().slice(0, 10),
      month,
      projected: at(month),
      target: goal.targetAmount,
    };
  });

  projectionCache.set(`${goal.id}|${maxPoints}`, points);
  return points;
}

export interface GoalSummary {
  targetTotal: number;
  fundedTotal: number;
  /** `fundedTotal / targetTotal`, as a fraction. */
  fundedPct: number;
  projectedTotal: number;
  /** EUR still short at the target dates, summed over the goals that fall short. */
  shortfallTotal: number;
  /** EUR of monthly contributions the goals depend on. */
  monthlyContributionTotal: number;
  onTrack: number;
  atRisk: number;
  behind: number;
  funded: number;
  count: number;
}

/** Everything a planning header needs, over whatever goals it is given. */
export function goalSummary(goals: Goal[] = getGoals()): GoalSummary {
  const targetTotal = r2(goals.reduce((a, g) => a + g.targetAmount, 0));
  const fundedTotal = r2(goals.reduce((a, g) => a + g.currentAmount, 0));
  return {
    targetTotal,
    fundedTotal,
    fundedPct: targetTotal ? r4(fundedTotal / targetTotal) : 0,
    projectedTotal: r2(goals.reduce((a, g) => a + g.projectedAmount, 0)),
    shortfallTotal: r2(goals.reduce((a, g) => a + g.projectedShortfall, 0)),
    monthlyContributionTotal: r2(goals.reduce((a, g) => a + g.monthlyContribution, 0)),
    onTrack: goals.filter((g) => g.status === 'on-track').length,
    atRisk: goals.filter((g) => g.status === 'at-risk').length,
    behind: goals.filter((g) => g.status === 'behind').length,
    funded: goals.filter((g) => g.status === 'funded').length,
    count: goals.length,
  };
}

/* ------------------------------------------------------------------ trade */

export interface OrderEstimate {
  /** In the instrument's own currency. */
  estimatedValue: number;
  /** The same amount at the frozen fixture FX rate. */
  estimatedValueEur: number;
  /** The price the estimate was struck at: the limit, or the last price. */
  referencePrice: number;
  currency: Currency;
  /** Quantity rounded down to a whole number of lots. Bonds trade in 1,000. */
  lots: number;
  /** `quantity` snapped to the lot size. */
  effectiveQuantity: number;
  /** Portfolio weight this ticket would add or remove, as a fraction. */
  weightImpact: number;
  /** `true` when a buy needs more cash than the mandate is holding. */
  exceedsCash: boolean;
}

/**
 * What a trade ticket is worth before it is placed.
 *
 * This is the one piece of arithmetic a trade screen genuinely has to do live —
 * the user is typing a quantity — which is exactly why it is here and not in
 * the input's change handler. Five ports, one formula.
 */
export function orderEstimate(input: {
  instrumentId: string;
  quantity: number;
  side: 'buy' | 'sell';
  limitPrice?: number | null;
  portfolioId?: string;
}): OrderEstimate | null {
  const instrument = getInstrumentById(input.instrumentId);
  if (!instrument) return null;

  const lots = Math.max(0, Math.floor(input.quantity / instrument.lotSize));
  const effectiveQuantity = lots * instrument.lotSize;
  const referencePrice = input.limitPrice ?? instrument.price;
  const estimatedValue = r2(effectiveQuantity * referencePrice);
  // The rate comes from the fixture, never from a literal here — a second copy
  // of the FX table is a second thing to forget to change.
  const estimatedValueEur = r2(estimatedValue * getFxRates()[instrument.currency]);

  const portfolio = input.portfolioId ? getPortfolioById(input.portfolioId) : undefined;

  return {
    estimatedValue,
    estimatedValueEur,
    referencePrice,
    currency: instrument.currency,
    lots,
    effectiveQuantity,
    weightImpact: portfolio
      ? r4((estimatedValueEur / portfolio.marketValue) * (input.side === 'buy' ? 1 : -1))
      : 0,
    // Only meaningful when a mandate was named: with no portfolio there is no
    // cash balance to exceed, and reporting `true` would be an invented failure.
    exceedsCash: input.side === 'buy' && portfolio !== undefined && estimatedValueEur > portfolio.cashBalance,
  };
}

/* ----------------------------------------------------------- concentration */

export interface Concentration {
  /** Share of the book held by the single largest household, as a fraction. */
  topHousehold: number;
  /** Share held by the largest three, as a fraction. */
  topThreeHouseholds: number;
  /** Share of securities in the single largest instrument, as a fraction. */
  topHolding: number;
  /** Share of securities NOT denominated in EUR, as a fraction. */
  nonBaseCurrency: number;
}

let concentrationCache: Concentration | null = null;

/** The four numbers a risk committee asks about a private-bank book. */
export function concentration(): Concentration {
  if (concentrationCache) return concentrationCache;

  const households = getHouseholds({ sortBy: 'totalAum', sortDir: 'desc' });
  const bookAum = households.reduce((a, h) => a + h.totalAum, 0);
  const holdings = bookHoldings();
  const positions = getPositions();
  const securities = positions.reduce((a, p) => a + p.marketValueEur, 0);
  const nonBase = positions
    .filter((p) => p.currency !== 'EUR')
    .reduce((a, p) => a + p.marketValueEur, 0);

  concentrationCache = {
    topHousehold: bookAum ? r4(households[0].totalAum / bookAum) : 0,
    topThreeHouseholds: bookAum ? r4(households.slice(0, 3).reduce((a, h) => a + h.totalAum, 0) / bookAum) : 0,
    topHolding: holdings.length ? holdings[0].weight : 0,
    nonBaseCurrency: securities ? r4(nonBase / securities) : 0,
  };
  return concentrationCache;
}
