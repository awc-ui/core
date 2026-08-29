/**
 * Pure, synchronous selectors over the baked wealth fixture.
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
  ACTIVITY,
  ADVISORS,
  ALLOCATIONS,
  BOOK_ALLOCATION,
  BOOK_PERFORMANCE,
  CLIENTS,
  FIXTURE,
  FX_RATES,
  GOALS,
  HOUSEHOLDS,
  INSTRUMENTS,
  ORDERS,
  PERFORMANCE,
  PORTFOLIOS,
  POSITIONS,
  PROPOSALS,
  TOTALS,
} from './generated';
import type {
  Activity,
  ActivityFilter,
  Advisor,
  AllocationRow,
  BookTotals,
  Client,
  ClientFilter,
  Currency,
  Goal,
  GoalFilter,
  Household,
  HouseholdFilter,
  Instrument,
  InstrumentFilter,
  Order,
  OrderFilter,
  PerformancePoint,
  PerformanceScope,
  Portfolio,
  Position,
  PositionFilter,
  Priority,
  Proposal,
  ProposalFilter,
  WealthFixture,
} from './types';

/* ------------------------------------------------------------------ shared */

const fold = (value: string) => value.toLocaleLowerCase('en');
const matches = (needle: string, ...haystack: string[]) =>
  !needle || fold(haystack.join(' ')).includes(needle);

/** Page a already-sorted list. `limit` undefined means "to the end". */
function page<T>(rows: T[], offset = 0, limit?: number): T[] {
  const start = Math.max(0, offset);
  return limit === undefined ? rows.slice(start) : rows.slice(start, start + Math.max(0, limit));
}

/**
 * Compare on one key, then on `id`.
 *
 * The id tie-break is not decoration: two households with the same AUM must
 * come out in the same order in every framework build, or the parity check is
 * comparing two different tables.
 */
function by<T extends { id: string }>(
  key: keyof T,
  dir: 'asc' | 'desc',
): (a: T, b: T) => number {
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

/* --------------------------------------------------------- the whole thing */

/** The entire fixture, in one object. Prefer the narrow selectors below. */
export function getFixture(): WealthFixture {
  return FIXTURE;
}

/** Frozen FX rates: units of EUR per one unit of the key currency. */
export function getFxRates(): Record<Currency, number> {
  return FX_RATES;
}

/** Convert a local amount to EUR at the frozen fixture rate. */
export function toEur(amount: number, currency: Currency): number {
  return Math.round(amount * FX_RATES[currency] * 100) / 100;
}

/* ------------------------------------------------------------------ totals */

/** Book-level aggregates. Equal to the sum of the household rows. */
export function getBookTotals(): BookTotals {
  return TOTALS;
}

/* ---------------------------------------------------------------- advisors */

/** The signed-in advisor — always the first row. */
export function getAdvisor(): Advisor {
  return ADVISORS[0];
}

export function getAdvisors(): Advisor[] {
  return ADVISORS.slice();
}

export function getAdvisorById(id: string): Advisor | undefined {
  return ADVISORS.find((a) => a.id === id);
}

/* -------------------------------------------------------------- households */

const HOUSEHOLD_NUMERIC = new Set(['totalAum', 'ytdReturn', 'unrealisedPl', 'memberCount']);

/**
 * The advisor's book, optionally filtered, sorted and paged.
 * Defaults: no filter, largest AUM first, no paging.
 */
export function getHouseholds(filter: HouseholdFilter = {}): Household[] {
  const {
    segment,
    mandate,
    riskProfile,
    strategy,
    advisorId,
    kycStatus,
    search,
    sortBy = 'totalAum',
    sortDir,
    offset,
    limit,
  } = filter;
  const needle = search ? fold(search.trim()) : '';

  const rows = HOUSEHOLDS.filter((h) => {
    if (segment && h.segment !== segment) return false;
    if (mandate && h.mandate !== mandate) return false;
    if (riskProfile && h.riskProfile !== riskProfile) return false;
    if (strategy && h.strategy !== strategy) return false;
    if (advisorId && h.advisorId !== advisorId) return false;
    if (kycStatus && h.kycStatus !== kycStatus) return false;
    return matches(needle, h.name, h.id);
  });

  const dir = sortDir ?? (HOUSEHOLD_NUMERIC.has(sortBy) ? 'desc' : 'asc');
  return page(rows.slice().sort(by<Household>(sortBy, dir)), offset, limit);
}

export function getHouseholdById(id: string): Household | undefined {
  return HOUSEHOLDS.find((h) => h.id === id);
}

/* ----------------------------------------------------------------- clients */

const ROLE_ORDER = { primary: 0, spouse: 1, trustee: 2, beneficiary: 3 } as const;

/** Clients, primary member first within each household. */
export function getClients(filter: ClientFilter = {}): Client[] {
  const { householdId, role, kycStatus, riskTolerance, search, offset, limit } = filter;
  const needle = search ? fold(search.trim()) : '';

  const rows = CLIENTS.filter((c) => {
    if (householdId && c.householdId !== householdId) return false;
    if (role && c.role !== role) return false;
    if (kycStatus && c.kycStatus !== kycStatus) return false;
    if (riskTolerance && c.riskTolerance !== riskTolerance) return false;
    return matches(needle, c.name, c.householdName, c.id);
  });

  return page(
    rows
      .slice()
      .sort(
        (a, b) =>
          a.householdId.localeCompare(b.householdId, 'en') ||
          ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
          a.id.localeCompare(b.id, 'en'),
      ),
    offset,
    limit,
  );
}

/** Every member of one household, primary first. */
export function getClientsFor(householdId: string): Client[] {
  return getClients({ householdId });
}

export function getClientById(id: string): Client | undefined {
  return CLIENTS.find((c) => c.id === id);
}

/* -------------------------------------------------------------- portfolios */

export function getPortfolios(): Portfolio[] {
  return PORTFOLIOS.slice().sort((a, b) => b.marketValue - a.marketValue || a.id.localeCompare(b.id, 'en'));
}

/**
 * The household's mandate.
 *
 * Every household in this fixture has exactly one, so this never returns
 * `undefined` for a real household id — but the type says it might, because a
 * screen handed an id from the URL must not assume the id is real.
 */
export function getPortfolioFor(householdId: string): Portfolio | undefined {
  return PORTFOLIOS.find((p) => p.householdId === householdId);
}

export function getPortfolioById(id: string): Portfolio | undefined {
  return PORTFOLIOS.find((p) => p.id === id);
}

/* ------------------------------------------------------------- instruments */

const INSTRUMENT_NUMERIC = new Set(['price', 'dayChangePct', 'twelveMonthReturn']);

export function getInstruments(filter: InstrumentFilter = {}): Instrument[] {
  const {
    assetClass,
    type,
    sector,
    region,
    currency,
    search,
    sortBy = 'ticker',
    sortDir,
    offset,
    limit,
  } = filter;
  const needle = search ? fold(search.trim()) : '';

  const rows = INSTRUMENTS.filter((i) => {
    if (assetClass && i.assetClass !== assetClass) return false;
    if (type && i.type !== type) return false;
    if (sector && i.sector !== sector) return false;
    if (region && i.region !== region) return false;
    if (currency && i.currency !== currency) return false;
    return matches(needle, i.ticker, i.name, i.id);
  });

  const dir = sortDir ?? (INSTRUMENT_NUMERIC.has(sortBy) ? 'desc' : 'asc');
  return page(rows.slice().sort(by<Instrument>(sortBy, dir)), offset, limit);
}

export function getInstrumentById(id: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

/** Look one up by exchange ticker. Tickers are unique in this universe. */
export function getInstrumentByTicker(ticker: string): Instrument | undefined {
  const needle = fold(ticker);
  return INSTRUMENTS.find((i) => fold(i.ticker) === needle);
}

/* --------------------------------------------------------------- positions */

const POSITION_NUMERIC = new Set([
  'marketValueEur',
  'unrealisedPl',
  'unrealisedPlPct',
  'weight',
  'dayChangePct',
]);

/**
 * Holdings, optionally filtered, sorted and paged.
 * Defaults: the whole book, largest EUR market value first, no paging.
 */
export function getPositions(filter: PositionFilter = {}): Position[] {
  const {
    portfolioId,
    householdId,
    instrumentId,
    assetClass,
    type,
    sector,
    region,
    currency,
    minMarketValue,
    inProfit,
    search,
    sortBy = 'marketValueEur',
    sortDir,
    offset,
    limit,
  } = filter;
  const needle = search ? fold(search.trim()) : '';

  const rows = POSITIONS.filter((p) => {
    if (portfolioId && p.portfolioId !== portfolioId) return false;
    if (householdId && p.householdId !== householdId) return false;
    if (instrumentId && p.instrumentId !== instrumentId) return false;
    if (assetClass && p.assetClass !== assetClass) return false;
    if (type && p.type !== type) return false;
    if (sector && p.sector !== sector) return false;
    if (region && p.region !== region) return false;
    if (currency && p.currency !== currency) return false;
    if (minMarketValue !== undefined && p.marketValueEur < minMarketValue) return false;
    if (inProfit !== undefined && p.unrealisedPl >= 0 !== inProfit) return false;
    return matches(needle, p.ticker, p.instrumentName, p.id);
  });

  const dir = sortDir ?? (POSITION_NUMERIC.has(sortBy) ? 'desc' : 'asc');
  return page(rows.slice().sort(by<Position>(sortBy, dir)), offset, limit);
}

export function getPositionById(id: string): Position | undefined {
  return POSITIONS.find((p) => p.id === id);
}

/** Every position in one mandate, largest first. */
export function getPositionsFor(portfolioId: string): Position[] {
  return getPositions({ portfolioId });
}

/* -------------------------------------------------------------- allocation */

/**
 * Target versus actual weight per asset class, in the fixed order
 * equity → fixed income → real assets → alternatives → cash.
 *
 * Pass a portfolio id for one mandate; omit it for the book, whose target is
 * the AUM-weighted mean of the mandates' targets.
 */
export function getAllocation(portfolioId?: string): AllocationRow[] {
  if (!portfolioId) return BOOK_ALLOCATION.slice();
  return ALLOCATIONS.filter((a) => a.portfolioId === portfolioId);
}

/** The same rows for the household's mandate. Empty for an unknown household. */
export function getAllocationFor(householdId: string): AllocationRow[] {
  return ALLOCATIONS.filter((a) => a.householdId === householdId);
}

/** Book-level allocation. Sugar for `getAllocation()` with no argument. */
export function getBookAllocation(): AllocationRow[] {
  return BOOK_ALLOCATION.slice();
}

/* ------------------------------------------------------------ performance */

/**
 * Twenty-four month-end observations, oldest first, ending at the reporting
 * month.
 *
 * With no scope you get the BOOK series, which is the sum of the mandates month
 * by month — not a separate random walk, so the headline can never disagree with
 * the rows beneath it. With `{ portfolioId }` or `{ householdId }` you get that
 * one mandate; its final `marketValue` is exactly `portfolio.marketValue`.
 */
export function getPerformanceSeries(scope: PerformanceScope = {}): PerformancePoint[] {
  const { portfolioId, householdId } = scope;
  if (!portfolioId && !householdId) return BOOK_PERFORMANCE.slice();
  return PERFORMANCE.filter(
    (p) =>
      (portfolioId === undefined || p.portfolioId === portfolioId) &&
      (householdId === undefined || p.householdId === householdId),
  );
}

/* ------------------------------------------------------------------- goals */

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Objectives, soonest target date first by default. */
export function getGoals(filter: GoalFilter = {}): Goal[] {
  const {
    householdId,
    type,
    priority,
    status,
    onTrack,
    sortBy = 'targetDate',
    sortDir,
    offset,
    limit,
  } = filter;

  const rows = GOALS.filter((g) => {
    if (householdId && g.householdId !== householdId) return false;
    if (type && g.type !== type) return false;
    if (priority && g.priority !== priority) return false;
    if (status && g.status !== status) return false;
    if (onTrack !== undefined && g.onTrack !== onTrack) return false;
    return true;
  });

  const dir = sortDir ?? (sortBy === 'targetDate' || sortBy === 'priority' ? 'asc' : 'desc');
  const sign = dir === 'asc' ? 1 : -1;
  const sorted = rows.slice().sort((a, b) => {
    if (sortBy === 'priority') {
      return (
        sign * (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) ||
        a.id.localeCompare(b.id, 'en')
      );
    }
    return by<Goal>(sortBy, dir)(a, b);
  });

  return page(sorted, offset, limit);
}

/** Every objective of one household, soonest target date first. */
export function getGoalsFor(householdId: string): Goal[] {
  return getGoals({ householdId });
}

export function getGoalById(id: string): Goal | undefined {
  return GOALS.find((g) => g.id === id);
}

/* --------------------------------------------------------------- proposals */

const PROPOSAL_STATUS_ORDER = {
  'client-review': 0,
  compliance: 1,
  'in-review': 2,
  draft: 3,
  approved: 4,
  rejected: 5,
} as const;

/**
 * Where "ageing" and "high value" begin, for the proposal facets.
 *
 * Thresholds are the book's opinion, not a view's, so they live here rather
 * than as literals in a screen. Both are chosen against the actual spread
 * rather than picked round. `daysOpen` runs 25, 39, 41, 57, 87, 105, 144 — the
 * only real gap is between 41 and 57, so 45 sits inside it and splits the book
 * 4 of 7, where 30 would take 6 of 7 and mean nothing. `estimatedValue` runs
 * 410k, 620k, 850k, 1.64M, 3.26M, 4.18M, 9.75M, and every threshold in
 * (1.64M, 3.26M] selects the same three rows — 2M is the round number that
 * lands inside that gap rather than a number that merely happens to work.
 */
export const PROPOSAL_AGEING_DAYS = 45;
export const PROPOSAL_HIGH_VALUE_EUR = 2_000_000;

/**
 * Advice documents, the ones needing attention first: client review, then
 * compliance, then in review, then drafts, then everything settled.
 */
export function getProposals(filter: ProposalFilter = {}): Proposal[] {
  const { householdId, type, status, advisorId, open, minDaysOpen, minEstimatedValue, offset, limit } =
    filter;

  const rows = PROPOSALS.filter((p) => {
    if (householdId && p.householdId !== householdId) return false;
    if (type && p.type !== type) return false;
    if (status && p.status !== status) return false;
    if (advisorId && p.advisorId !== advisorId) return false;
    if (open !== undefined && p.open !== open) return false;
    // `!= null` rather than truthiness: 0 is a legitimate floor for both of
    // these, and `if (minDaysOpen)` would silently drop it.
    if (minDaysOpen != null && p.daysOpen < minDaysOpen) return false;
    if (minEstimatedValue != null && p.estimatedValue < minEstimatedValue) return false;
    return true;
  });

  return page(
    rows
      .slice()
      .sort(
        (a, b) =>
          PROPOSAL_STATUS_ORDER[a.status] - PROPOSAL_STATUS_ORDER[b.status] ||
          b.estimatedValue - a.estimatedValue ||
          a.id.localeCompare(b.id, 'en'),
      ),
    offset,
    limit,
  );
}

/** Every proposal raised for one household. */
export function getProposalsFor(householdId: string): Proposal[] {
  return getProposals({ householdId });
}

export function getProposalById(id: string): Proposal | undefined {
  return PROPOSALS.find((p) => p.id === id);
}

/* ------------------------------------------------------------------ orders */

const WORKING_STATUSES = new Set(['submitted', 'partially-filled']);

/** The blotter, newest ticket first. */
export function getOrders(filter: OrderFilter = {}): Order[] {
  const {
    portfolioId,
    householdId,
    instrumentId,
    side,
    status,
    proposalId,
    working,
    advisorId,
    fromProposal,
    search,
    offset,
    limit,
  } = filter;
  const needle = search ? fold(search.trim()) : '';

  const rows = ORDERS.filter((o) => {
    if (portfolioId && o.portfolioId !== portfolioId) return false;
    if (householdId && o.householdId !== householdId) return false;
    if (instrumentId && o.instrumentId !== instrumentId) return false;
    if (side && o.side !== side) return false;
    if (status && o.status !== status) return false;
    if (proposalId && o.proposalId !== proposalId) return false;
    if (working !== undefined && WORKING_STATUSES.has(o.status) !== working) return false;
    if (advisorId && o.advisorId !== advisorId) return false;
    // `proposalId` above narrows to ONE proposal; this asks only whether there
    // is one at all — the difference between "this order's advice" and "orders
    // that came from advice rather than an ad-hoc ticket".
    if (fromProposal !== undefined && (o.proposalId !== null) !== fromProposal) return false;
    return matches(needle, o.ticker, o.instrumentName, o.householdName, o.id);
  });

  // ORDERS is already newest first; `slice()` preserves that and hands back a
  // fresh array the caller may re-sort.
  return page(rows.slice(), offset, limit);
}

/** Tickets still live in the market: submitted or partially filled. */
export function getWorkingOrders(): Order[] {
  return getOrders({ working: true });
}

export function getOrderById(id: string): Order | undefined {
  return ORDERS.find((o) => o.id === id);
}

/* ---------------------------------------------------------------- activity */

/** The audit trail, newest first. */
export function getActivity(filter: ActivityFilter = {}): Activity[] {
  const { householdId, category, action, targetType, actorId, sinceDays, offset, limit } = filter;

  const rows = ACTIVITY.filter((a) => {
    if (householdId && a.householdId !== householdId) return false;
    if (category && a.category !== category) return false;
    if (action && a.action !== action) return false;
    if (targetType && a.targetType !== targetType) return false;
    if (actorId && a.actorId !== actorId) return false;
    if (sinceDays !== undefined && a.daysAgo > sinceDays) return false;
    return true;
  });

  // ACTIVITY is already newest first.
  return page(rows.slice(), offset, limit);
}

/** The trail for one household, newest first. */
export function getActivityFor(householdId: string, limit?: number): Activity[] {
  return getActivity({ householdId, limit });
}
