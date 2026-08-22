/**
 * Pure, synchronous selectors over the baked credit-risk fixture.
 *
 * Every function here is referentially transparent: no clock, no randomness, no
 * I/O, no mutation of the fixture. Functions that return a list always return a
 * fresh array so callers can sort it in place; the objects inside are the shared
 * frozen fixture records — treat them as read-only.
 */
import {
  COLLATERAL,
  COUNTERPARTIES,
  COVENANTS,
  FACILITIES,
  FIXTURE,
  FX_RATES,
  GROUPS,
  RATING_HISTORY,
  RATING_SCALE,
  SCENARIOS,
  SECTORS,
  TOTALS,
  WATCHLIST,
} from './generated';
import type {
  Collateral,
  Counterparty,
  CounterpartyFilter,
  Covenant,
  CreditRiskFixture,
  Facility,
  FacilityCurrency,
  Group,
  GroupTree,
  GroupTreeNode,
  PortfolioTotals,
  RatingGrade,
  RatingObservation,
  ScenarioId,
  Sector,
  SectorId,
  StressScenario,
  WatchlistSignal,
} from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const round6 = (n: number) => Math.round(n * 1000000) / 1000000;

/* ------------------------------------------------------------- the whole thing */

/** The entire fixture, in one object. Prefer the narrow selectors below. */
export function getFixture(): CreditRiskFixture {
  return FIXTURE;
}

/** Frozen FX rates used to express facility amounts in EUR. */
export function getFxRates(): Record<FacilityCurrency, number> {
  return FX_RATES;
}

/* ---------------------------------------------------------------------- totals */

/** Portfolio-level aggregates. Equal to the sum of the counterparty rows. */
export function getPortfolioTotals(): PortfolioTotals {
  return TOTALS;
}

/* --------------------------------------------------------------------- sectors */

export function getSectors(): Sector[] {
  return SECTORS.slice();
}

export function getSectorById(id: SectorId | string): Sector | undefined {
  return SECTORS.find((s) => s.id === id);
}

/* ---------------------------------------------------------------- rating scale */

export function getRatingScale(): RatingGrade[] {
  return RATING_SCALE.slice();
}

/** Look up one rung of the internal scale by grade (1..10). */
export function getRatingGrade(grade: number): RatingGrade | undefined {
  return RATING_SCALE.find((g) => g.grade === grade);
}

/* -------------------------------------------------------------- counterparties */

const NUMERIC_SORT_KEYS = new Set(['ead', 'pd', 'expectedLoss', 'rwa', 'utilisation', 'grade']);

/**
 * Counterparties, optionally filtered, sorted and paged.
 * Defaults: no filter, sorted by EAD descending, no paging.
 */
export function getCounterparties(filter: CounterpartyFilter = {}): Counterparty[] {
  const {
    sectorId,
    country,
    watchlist,
    groupId,
    minGrade,
    maxGrade,
    search,
    sortBy = 'ead',
    sortDir,
    offset = 0,
    limit,
  } = filter;

  const needle = search ? search.trim().toLocaleLowerCase('en') : '';

  let rows = COUNTERPARTIES.filter((c) => {
    if (sectorId && c.sectorId !== sectorId) return false;
    if (country && c.country !== country) return false;
    if (watchlist !== undefined && c.watchlist !== watchlist) return false;
    if (groupId && c.groupId !== groupId) return false;
    if (minGrade !== undefined && c.grade < minGrade) return false;
    if (maxGrade !== undefined && c.grade > maxGrade) return false;
    if (needle) {
      const hay = `${c.legalName} ${c.id}`.toLocaleLowerCase('en');
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const dir = sortDir ?? (NUMERIC_SORT_KEYS.has(sortBy) ? 'desc' : 'asc');
  const sign = dir === 'asc' ? 1 : -1;
  rows = rows.slice().sort((a, b) => {
    if (sortBy === 'legalName') return sign * a.legalName.localeCompare(b.legalName, 'en');
    const av = a[sortBy] as number;
    const bv = b[sortBy] as number;
    // Stable tie-break on id keeps every framework's table in the same order.
    return sign * (av - bv) || a.id.localeCompare(b.id, 'en');
  });

  const start = Math.max(0, offset);
  return limit === undefined ? rows.slice(start) : rows.slice(start, start + Math.max(0, limit));
}

export function getCounterpartyById(id: string): Counterparty | undefined {
  return COUNTERPARTIES.find((c) => c.id === id);
}

/* ------------------------------------------------------------------ facilities */

/** All facilities booked to one counterparty, largest EAD first. */
export function getFacilitiesFor(counterpartyId: string): Facility[] {
  return FACILITIES.filter((f) => f.counterpartyId === counterpartyId).sort(
    (a, b) => b.ead - a.ead || a.id.localeCompare(b.id, 'en'),
  );
}

export function getFacilityById(id: string): Facility | undefined {
  return FACILITIES.find((f) => f.id === id);
}

/** Every facility in the book, largest EAD first. */
export function getFacilities(): Facility[] {
  return FACILITIES.slice().sort((a, b) => b.ead - a.ead || a.id.localeCompare(b.id, 'en'));
}

/* ------------------------------------------------------------------- covenants */

/** Covenants attached to one facility, worst headroom first. */
export function getCovenantsFor(facilityId: string): Covenant[] {
  return COVENANTS.filter((c) => c.facilityId === facilityId).sort(
    (a, b) => a.headroomPct - b.headroomPct || a.id.localeCompare(b.id, 'en'),
  );
}

/** Every covenant in the book, worst headroom first. Useful for a breach screen. */
export function getCovenants(): Covenant[] {
  return COVENANTS.slice().sort(
    (a, b) => a.headroomPct - b.headroomPct || a.id.localeCompare(b.id, 'en'),
  );
}

/* ------------------------------------------------------------------ collateral */

/** Collateral pledged against one facility, highest net value first. */
export function getCollateralFor(facilityId: string): Collateral[] {
  return COLLATERAL.filter((c) => c.facilityId === facilityId).sort(
    (a, b) => b.netValue - a.netValue || a.id.localeCompare(b.id, 'en'),
  );
}

/* -------------------------------------------------------------- rating history */

/** Eight quarterly grade observations, oldest first, ending at the reporting quarter. */
export function getRatingHistory(counterpartyId: string): RatingObservation[] {
  return RATING_HISTORY.filter((r) => r.counterpartyId === counterpartyId).slice();
}

/* ------------------------------------------------------------------- watchlist */

/**
 * Open early-warning signals, highest severity first then largest exposure.
 * Each row carries the counterparty name, sector, grade and EAD, so a watchlist
 * table needs no join.
 */
export function getWatchlist(): WatchlistSignal[] {
  return WATCHLIST.slice();
}

/** The distinct counterparties carrying at least one open signal. */
export function getWatchlistCounterparties(): Counterparty[] {
  return getCounterparties({ watchlist: true });
}

/* ---------------------------------------------------------------------- groups */

export function getGroups(): Group[] {
  return GROUPS.slice();
}

/**
 * The ownership tree for a corporate group, plus rolled-up exposure.
 * Returns `null` for an unknown group id.
 */
export function getGroupTree(groupId: string): GroupTree | null {
  const group = GROUPS.find((g) => g.id === groupId);
  if (!group) return null;

  const members = COUNTERPARTIES.filter((c) => c.groupId === groupId);
  const byParent = new Map<string | null, Counterparty[]>();
  for (const m of members) {
    const key = m.id === group.parentCounterpartyId ? null : (m.parentId ?? group.parentCounterpartyId);
    const bucket = byParent.get(key);
    if (bucket) bucket.push(m);
    else byParent.set(key, [m]);
  }

  const build = (cp: Counterparty): GroupTreeNode => ({
    counterparty: cp,
    children: (byParent.get(cp.id) ?? [])
      .slice()
      .sort((a, b) => b.ead - a.ead || a.id.localeCompare(b.id, 'en'))
      .map(build),
  });

  const head = members.find((c) => c.id === group.parentCounterpartyId);
  if (!head) return null;

  const ead = round2(members.reduce((a, c) => a + c.ead, 0));
  return {
    id: group.id,
    name: group.name,
    root: build(head),
    memberCount: members.length,
    totals: {
      limit: round2(members.reduce((a, c) => a + c.limit, 0)),
      drawn: round2(members.reduce((a, c) => a + c.drawn, 0)),
      undrawn: round2(members.reduce((a, c) => a + c.undrawn, 0)),
      ead,
      expectedLoss: round2(members.reduce((a, c) => a + c.expectedLoss, 0)),
      rwa: round2(members.reduce((a, c) => a + c.rwa, 0)),
      weightedAvgPd: round6(members.reduce((a, c) => a + c.ead * c.pd, 0) / ead),
    },
  };
}

/* ------------------------------------------------------------------- scenarios */

/** Baseline, adverse and severe, in that order. */
export function getStressScenarios(): StressScenario[] {
  return SCENARIOS.slice();
}

export function getStressScenarioById(id: ScenarioId | string): StressScenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
