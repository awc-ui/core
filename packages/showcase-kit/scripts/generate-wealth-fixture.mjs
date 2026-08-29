/**
 * Deterministic fixture generator for the wealth-management showcase.
 *
 * Run: pnpm --filter @awc-ui/showcase-kit generate:wealth
 *
 * Output: src/wealth/generated.ts — a baked, literal fixture. Same contract as
 * `generate-fixture.mjs` next door: a seeded mulberry32 PRNG and a frozen
 * reporting date, so re-running it produces a byte-identical file. Nothing at
 * runtime ever calls Math.random or Date.now, and every date is a calendar date
 * built with Date.UTC — the ambient time zone of the machine that runs this
 * never reaches the output.
 *
 * CONVENTIONS, identical to the credit-risk fixture:
 *   - every ratio is a FRACTION (0.0135 means 1.35%)
 *   - every date is an ISO calendar date, `YYYY-MM-DD`
 *   - every enum-ish value carries a `…Key` twin resolving through the shared
 *     dictionary, so nothing in here is a pre-translated string
 *   - proper nouns (household names, instrument names, people) live in the
 *     fixture and are deliberately NOT translated
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'wealth', 'generated.ts');

const SEED = 0x5eed2c7f;
const REPORTING_DATE = '2026-06-30';
const REPORTING_QUARTER = '2026-Q2';
const REPORTING_MS = Date.UTC(2026, 5, 30);
/** Months of performance history, ending at the reporting month. */
const HISTORY_MONTHS = 24;
/** Months of price history baked onto each instrument. */
const PRICE_MONTHS = 12;

/* ------------------------------------------------------------------- prng */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
/** Uniform float in [min, max). */
const uf = (min, max) => min + rnd() * (max - min);
/** Uniform integer in [min, max] inclusive. */
const ui = (min, max) => Math.floor(uf(min, max + 1));
const pick = (arr) => arr[ui(0, arr.length - 1)];
const chance = (p) => rnd() < p;
/**
 * Approximately normal, via the mean of four uniforms (Bates). Bounded at
 * ±2 sigma, which is what keeps a 24-month return path from producing a single
 * absurd month that the eye reads as a data bug.
 */
const normal = (mean, sd) => mean + (uf(-1, 1) + uf(-1, 1) + uf(-1, 1) + uf(-1, 1)) * 0.5 * sd;

/* ---------------------------------------------------------------- helpers */

const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;
const r6 = (n) => Math.round(n * 1000000) / 1000000;
const sum = (arr, f) => r2(arr.reduce((a, x) => a + f(x), 0));

const pad = (n) => String(n).padStart(2, '0');
const iso = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
/** Shift the frozen reporting date by whole days. */
const dayOffset = (days) => iso(REPORTING_MS + days * 86400000);
/** Shift the frozen reporting date by whole months, clamping the day of month. */
function monthOffset(months, day) {
  const base = new Date(REPORTING_MS);
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + months;
  const targetDay = day ?? base.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(Date.UTC(y, m, Math.min(targetDay, lastDay)));
}
/** Month-end ISO date `n` whole months before the reporting month end. */
function monthEndBack(n) {
  const base = new Date(REPORTING_MS);
  return iso(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - n + 1, 0));
}
const daysBetween = (isoA, isoB) =>
  Math.round((Date.parse(`${isoB}T00:00:00Z`) - Date.parse(`${isoA}T00:00:00Z`)) / 86400000);
function monthsFromReporting(isoDate) {
  const d = new Date(Date.parse(`${isoDate}T00:00:00Z`));
  const base = new Date(REPORTING_MS);
  let months =
    (d.getUTCFullYear() - base.getUTCFullYear()) * 12 + (d.getUTCMonth() - base.getUTCMonth());
  if (d.getUTCDate() < base.getUTCDate()) months -= 1;
  return months;
}
/** `2026-Q2` for a month-end ISO date. */
function quarterOf(isoDate) {
  const [y, m] = isoDate.split('-').map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}
/** A UTC instant on a calendar date, for the audit trail. */
const stamp = (isoDate, hour, minute) => `${isoDate}T${pad(hour)}:${pad(minute)}:00Z`;

/* --------------------------------------------------------------- FX rates */

/** Units of EUR per one unit of the key currency. Frozen, never fetched. */
const FX = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.03 };

/* ---------------------------------------------------------- asset classes */

const ASSET_CLASSES = ['equity', 'fixed-income', 'real-assets', 'alternatives', 'cash'];

/**
 * Target weights per strategy, per asset class. Each row sums to exactly 1 —
 * asserted at the bottom of this file, because an allocation screen whose
 * targets do not add up is worse than no allocation screen.
 */
const STRATEGY_TARGETS = {
  conservative: { equity: 0.25, 'fixed-income': 0.55, 'real-assets': 0.05, alternatives: 0.05, cash: 0.1 },
  balanced: { equity: 0.45, 'fixed-income': 0.35, 'real-assets': 0.07, alternatives: 0.08, cash: 0.05 },
  growth: { equity: 0.62, 'fixed-income': 0.2, 'real-assets': 0.05, alternatives: 0.1, cash: 0.03 },
  aggressive: { equity: 0.75, 'fixed-income': 0.08, 'real-assets': 0.03, alternatives: 0.12, cash: 0.02 },
};

/** Monthly return mean and standard deviation, by strategy. Illustrative. */
const STRATEGY_RETURN = {
  conservative: { mu: 0.0031, sd: 0.011 },
  balanced: { mu: 0.0045, sd: 0.018 },
  growth: { mu: 0.0058, sd: 0.026 },
  aggressive: { mu: 0.0071, sd: 0.034 },
};

/** How many instruments a portfolio holds in each class it is exposed to. */
const CLASS_HOLDING_COUNT = {
  equity: [3, 4],
  'fixed-income': [2, 3],
  'real-assets': [1, 1],
  alternatives: [1, 2],
};

const BENCHMARKS = {
  conservative: { id: 'bm-cons', name: 'KPB Conservative 25/75' },
  balanced: { id: 'bm-bal', name: 'KPB Balanced 45/55' },
  growth: { id: 'bm-grw', name: 'KPB Growth 60/40' },
  aggressive: { id: 'bm-agg', name: 'KPB Aggressive 75/25' },
};

/* ----------------------------------------------------------------- people */

/** The signed-in advisor is always the first row. */
const ADVISORS = [
  { id: 'adv-01', name: 'Marta Kovacs', titleKey: 'wealth.advisor.title.senior', desk: 'Zürich' },
  { id: 'adv-02', name: 'Tomas Reiner', titleKey: 'wealth.advisor.title.advisor', desk: 'Frankfurt' },
  { id: 'adv-03', name: 'Priya Raman', titleKey: 'wealth.advisor.title.associate', desk: 'London' },
];

/* ------------------------------------------------------------ instruments */

/**
 * The instrument universe. Hand-authored so the tickers, sectors and
 * currencies are stable across regenerations; only prices and day moves come
 * from the PRNG.
 *
 * Row: [id, ticker, name, type, assetClass, sector, region, currency, price]
 */
const INSTRUMENT_SEEDS = [
  // --- listed equity -------------------------------------------------------
  ['ins-01', 'NRDK', 'Nordwerk Industrie AG', 'equity', 'equity', 'industrials', 'europe', 'EUR', 84.6],
  ['ins-02', 'LMNA', 'Lumen Analytics GmbH', 'equity', 'equity', 'technology', 'europe', 'EUR', 142.2],
  ['ins-03', 'CYGN', 'Cygnus Data Systems Inc', 'equity', 'equity', 'technology', 'north-america', 'USD', 318.4],
  ['ins-04', 'KSTR', 'Kestrel Aerospace plc', 'equity', 'equity', 'industrials', 'europe', 'GBP', 27.85],
  ['ins-05', 'HELV', 'Helvetia Alpine Pharma AG', 'equity', 'equity', 'healthcare', 'europe', 'CHF', 268.5],
  ['ins-06', 'ORBS', 'Orbis Software NV', 'equity', 'equity', 'technology', 'europe', 'EUR', 96.3],
  ['ins-07', 'MRDN', 'Meridian Energy Partners', 'equity', 'equity', 'energy', 'north-america', 'USD', 61.2],
  ['ins-08', 'SILV', 'Silvan Care Holdings SE', 'equity', 'equity', 'healthcare', 'europe', 'EUR', 53.4],
  ['ins-09', 'ADRC', 'Adriatic Freight Lines SpA', 'equity', 'equity', 'industrials', 'europe', 'EUR', 19.75],
  ['ins-10', 'PTRL', 'Petrel Renewables AB', 'equity', 'equity', 'utilities', 'europe', 'EUR', 41.9],
  ['ins-11', 'FRHV', 'Fairhaven Retail Group plc', 'equity', 'equity', 'consumer', 'europe', 'GBP', 12.4],
  ['ins-12', 'VNTR', 'Vantera Precision BV', 'equity', 'equity', 'industrials', 'europe', 'EUR', 73.1],
  ['ins-13', 'ALCY', 'Alcyon Shipping Ltd', 'equity', 'equity', 'industrials', 'emerging', 'USD', 34.6],
  ['ins-14', 'CORV', 'Corvina Pharma SA', 'equity', 'equity', 'healthcare', 'europe', 'EUR', 88.9],
  ['ins-15', 'TSHI', 'Tashiro Robotics KK', 'equity', 'equity', 'technology', 'asia-pacific', 'USD', 47.3],
  ['ins-16', 'BLMT', 'Belmont Tooling Ltd', 'equity', 'equity', 'industrials', 'europe', 'GBP', 8.92],
  // --- bonds ---------------------------------------------------------------
  ['ins-17', 'DE0232', 'Bund 2.30% 15 Feb 2032', 'bond', 'fixed-income', 'government', 'europe', 'EUR', 98.42],
  ['ins-18', 'FR0235', 'OAT 2.75% 25 May 2035', 'bond', 'fixed-income', 'government', 'europe', 'EUR', 96.15],
  ['ins-19', 'IT0231', 'BTP 3.85% 01 Sep 2031', 'bond', 'fixed-income', 'government', 'europe', 'EUR', 101.6],
  ['ins-20', 'US0433', 'Treasury 4.25% 15 Nov 2033', 'bond', 'fixed-income', 'government', 'north-america', 'USD', 99.35],
  ['ins-21', 'GB0430', 'Gilt 4.00% 07 Sep 2030', 'bond', 'fixed-income', 'government', 'europe', 'GBP', 100.8],
  ['ins-22', 'NRDK29', 'Nordwerk 3.60% 2029', 'bond', 'fixed-income', 'corporate', 'europe', 'EUR', 100.25],
  ['ins-23', 'CYGN31', 'Cygnus 5.10% 2031', 'bond', 'fixed-income', 'corporate', 'north-america', 'USD', 103.7],
  ['ins-24', 'AURL34', 'Auralis Power 4.40% 2034', 'bond', 'fixed-income', 'corporate', 'europe', 'EUR', 97.8],
  ['ins-25', 'HELV30', 'Helvetia Pharma 1.90% 2030', 'bond', 'fixed-income', 'corporate', 'europe', 'CHF', 94.6],
  ['ins-26', 'KSTE28', 'Kestrel Estates 3.95% 2028', 'bond', 'fixed-income', 'corporate', 'europe', 'EUR', 99.9],
  // --- exchange-traded funds ----------------------------------------------
  ['ins-27', 'EEQI', 'Europe Equity Index ETF', 'etf', 'equity', 'diversified', 'europe', 'EUR', 68.4],
  ['ins-28', 'GEQW', 'Global Equity World ETF', 'etf', 'equity', 'diversified', 'global', 'USD', 112.9],
  ['ins-29', 'EMEQ', 'Emerging Markets Equity ETF', 'etf', 'equity', 'diversified', 'emerging', 'USD', 44.15],
  ['ins-30', 'EGOV', 'Euro Government Bond ETF', 'etf', 'fixed-income', 'government', 'europe', 'EUR', 118.6],
  ['ins-31', 'GCRP', 'Global Corporate Bond ETF', 'etf', 'fixed-income', 'corporate', 'global', 'USD', 87.25],
  ['ins-32', 'APEQ', 'Asia Pacific Equity ETF', 'etf', 'equity', 'diversified', 'asia-pacific', 'USD', 39.8],
  ['ins-33', 'REPR', 'European Property REIT ETF', 'etf', 'real-assets', 'real-estate', 'europe', 'EUR', 26.7],
  // --- funds ---------------------------------------------------------------
  ['ins-34', 'KSEF', 'Kestrel Sustainable Equity Fund', 'fund', 'equity', 'diversified', 'global', 'EUR', 214.3],
  ['ins-35', 'KESD', 'Kestrel Euro Short Duration Fund', 'fund', 'fixed-income', 'corporate', 'europe', 'EUR', 106.4],
  ['ins-36', 'KGIF', 'Kestrel Global Infrastructure Fund', 'fund', 'real-assets', 'infrastructure', 'global', 'EUR', 158.9],
  ['ins-37', 'KPCF', 'Kestrel Private Credit Fund', 'fund', 'alternatives', 'private-credit', 'europe', 'EUR', 131.2],
  // --- alternatives --------------------------------------------------------
  ['ins-38', 'AURP4', 'Aurora Private Equity IV', 'alternative', 'alternatives', 'private-equity', 'europe', 'EUR', 1284.0],
  ['ins-39', 'MGMF', 'Meridian Global Macro Fund', 'alternative', 'alternatives', 'hedge-fund', 'global', 'USD', 176.5],
  ['ins-40', 'ALPG', 'Alpine Gold Bullion ETC', 'alternative', 'real-assets', 'commodities', 'global', 'CHF', 212.8],
];

/** Whole-unit lot size by instrument type. Bonds trade in 1,000 nominal. */
const LOT_SIZE = { equity: 1, bond: 1000, etf: 1, fund: 1, alternative: 1 };
/** Annualised price drift and volatility by instrument type, for the 12m series. */
const PRICE_PATH = {
  equity: { mu: 0.0072, sd: 0.048 },
  bond: { mu: 0.0011, sd: 0.009 },
  etf: { mu: 0.0059, sd: 0.032 },
  fund: { mu: 0.0055, sd: 0.028 },
  alternative: { mu: 0.0064, sd: 0.021 },
};
/** Daily move range by instrument type. */
const DAY_MOVE = { equity: 0.028, bond: 0.004, etf: 0.016, fund: 0.013, alternative: 0.011 };

/* ------------------------------------------------------------- households */

/**
 * Row: [id, name, domicile, riskProfile, mandate, strategy, segment, advisorId,
 *       aumTarget (EUR)]
 */
const HOUSEHOLD_SEEDS = [
  ['hh-01', 'The Ashworth Family Trust', 'GB', 'balanced', 'discretionary', 'balanced', 'private-wealth', 'adv-01', 18_400_000],
  ['hh-02', 'Rothbury Holdings SA', 'CH', 'growth', 'discretionary', 'growth', 'family-office', 'adv-01', 42_700_000],
  ['hh-03', 'The Lindqvist Household', 'SE', 'defensive', 'advisory', 'conservative', 'private-wealth', 'adv-02', 6_150_000],
  ['hh-04', 'Marchetti Family Office', 'IT', 'dynamic', 'discretionary', 'aggressive', 'family-office', 'adv-01', 31_900_000],
  ['hh-05', 'The Okafor Trust', 'GB', 'balanced', 'advisory', 'balanced', 'private-wealth', 'adv-03', 12_300_000],
  ['hh-06', 'Delacroix Patrimoine', 'FR', 'growth', 'discretionary', 'growth', 'private-wealth', 'adv-02', 9_750_000],
  ['hh-07', 'The Novak Household', 'DE', 'defensive', 'execution-only', 'conservative', 'affluent', 'adv-03', 3_420_000],
  ['hh-08', 'Haddad Investments Ltd', 'AE', 'dynamic', 'discretionary', 'aggressive', 'family-office', 'adv-01', 26_800_000],
];

/**
 * Row: [id, householdId, name, role, kycStatus, riskTolerance, domicile,
 *       dateOfBirth, emailLocal]
 */
const CLIENT_SEEDS = [
  ['cl-01', 'hh-01', 'Eleanor Ashworth', 'primary', 'verified', 'medium', 'GB', '1962-04-18', 'e.ashworth'],
  ['cl-02', 'hh-01', 'James Ashworth', 'spouse', 'verified', 'low', 'GB', '1959-11-02', 'j.ashworth'],
  ['cl-03', 'hh-02', 'Konrad Rothbury', 'primary', 'verified', 'high', 'CH', '1971-01-27', 'k.rothbury'],
  ['cl-04', 'hh-02', 'Marie Rothbury', 'trustee', 'review-due', 'medium', 'CH', '1974-08-09', 'm.rothbury'],
  ['cl-05', 'hh-03', 'Per Lindqvist', 'primary', 'verified', 'low', 'SE', '1955-06-30', 'p.lindqvist'],
  ['cl-06', 'hh-04', 'Giulia Marchetti', 'primary', 'verified', 'high', 'IT', '1968-03-14', 'g.marchetti'],
  ['cl-07', 'hh-04', 'Lorenzo Marchetti', 'beneficiary', 'pending', 'high', 'IT', '2004-09-21', 'l.marchetti'],
  ['cl-08', 'hh-05', 'Amara Okafor', 'primary', 'verified', 'medium', 'GB', '1979-12-05', 'a.okafor'],
  ['cl-09', 'hh-05', 'Daniel Okafor', 'spouse', 'verified', 'medium', 'GB', '1977-07-23', 'd.okafor'],
  ['cl-10', 'hh-06', 'Céline Delacroix', 'primary', 'verified', 'high', 'FR', '1973-02-11', 'c.delacroix'],
  ['cl-11', 'hh-06', 'Hugo Delacroix', 'beneficiary', 'review-due', 'medium', 'FR', '2001-05-16', 'h.delacroix'],
  ['cl-12', 'hh-07', 'Stefan Novak', 'primary', 'expired', 'low', 'DE', '1951-10-08', 's.novak'],
  ['cl-13', 'hh-08', 'Nadia Haddad', 'primary', 'verified', 'high', 'AE', '1980-01-19', 'n.haddad'],
  ['cl-14', 'hh-08', 'Yusuf Haddad', 'spouse', 'verified', 'high', 'AE', '1976-04-03', 'y.haddad'],
];

/* ------------------------------------------------------------------ goals */

/**
 * Row: [id, householdId, type, priority, beneficiaryClientId|null,
 *       targetAmount (EUR), targetMonthsAhead, fundedFraction, monthlyContribution]
 */
const GOAL_SEEDS = [
  ['goal-01', 'hh-01', 'retirement', 'high', 'cl-01', 9_500_000, 78, 0.71, 18_000],
  ['goal-02', 'hh-01', 'legacy', 'medium', null, 4_000_000, 210, 0.44, 6_500],
  ['goal-03', 'hh-02', 'legacy', 'high', null, 25_000_000, 162, 0.63, 42_000],
  ['goal-04', 'hh-02', 'property', 'medium', 'cl-04', 6_800_000, 30, 0.82, 55_000],
  ['goal-05', 'hh-03', 'retirement', 'high', 'cl-05', 4_200_000, 18, 0.94, 9_000],
  ['goal-06', 'hh-04', 'education', 'high', 'cl-07', 620_000, 42, 0.58, 7_200],
  ['goal-07', 'hh-04', 'property', 'low', null, 3_500_000, 66, 0.31, 21_000],
  ['goal-08', 'hh-05', 'education', 'medium', null, 480_000, 96, 0.36, 3_100],
  ['goal-09', 'hh-05', 'retirement', 'high', 'cl-08', 7_400_000, 168, 0.29, 12_400],
  ['goal-10', 'hh-06', 'property', 'high', 'cl-11', 1_900_000, 24, 0.67, 24_000],
  ['goal-11', 'hh-07', 'liquidity', 'medium', 'cl-12', 900_000, 12, 0.88, 5_000],
  ['goal-12', 'hh-08', 'legacy', 'high', 'cl-13', 15_000_000, 234, 0.38, 31_000],
];

/** Assumed annual growth used to project a goal, by household risk profile. */
const GOAL_GROWTH = { defensive: 0.031, balanced: 0.046, growth: 0.058, dynamic: 0.068 };

/* -------------------------------------------------------------- proposals */

const PROPOSAL_STEPS = ['drafting', 'suitability', 'compliance', 'client-review', 'execution'];

/**
 * Row: [id, householdId, type, status, currentStepIndex, estimatedValue (EUR),
 *       advisorId, createdMonthsBack]
 */
const PROPOSAL_SEEDS = [
  ['prp-01', 'hh-02', 'rebalance', 'compliance', 2, 4_180_000, 'adv-01', -1],
  ['prp-02', 'hh-04', 'tax-harvest', 'client-review', 3, 1_640_000, 'adv-01', -2],
  ['prp-03', 'hh-01', 'goal-funding', 'in-review', 1, 850_000, 'adv-01', -1],
  ['prp-04', 'hh-06', 'new-mandate', 'draft', 0, 9_750_000, 'adv-02', 0],
  ['prp-05', 'hh-08', 'rebalance', 'approved', 4, 3_260_000, 'adv-01', -3],
  ['prp-06', 'hh-05', 'cash-raise', 'in-review', 1, 620_000, 'adv-03', -1],
  ['prp-07', 'hh-03', 'rebalance', 'rejected', 2, 410_000, 'adv-02', -4],
];

/* ----------------------------------------------------------------- orders */

const ORDER_TYPES = ['market', 'limit', 'stop-limit'];
const TIME_IN_FORCE = ['day', 'gtc', 'ioc', 'fok'];
/**
 * Row: [id, portfolioIndex (0-based), instrumentId, side, orderType, tif,
 *       status, quantity, daysBack, proposalId|null]
 */
const ORDER_SEEDS = [
  ['ord-01', 1, 'ins-28', 'buy', 'limit', 'gtc', 'submitted', 3200, -1, 'prp-01'],
  ['ord-02', 1, 'ins-30', 'sell', 'market', 'day', 'filled', 12000, -2, 'prp-01'],
  ['ord-03', 3, 'ins-03', 'sell', 'limit', 'day', 'partially-filled', 900, -1, 'prp-02'],
  ['ord-04', 3, 'ins-34', 'buy', 'market', 'day', 'staged', 1400, 0, 'prp-02'],
  ['ord-05', 0, 'ins-27', 'buy', 'limit', 'gtc', 'submitted', 2600, -1, 'prp-03'],
  ['ord-06', 0, 'ins-17', 'sell', 'limit', 'day', 'cancelled', 8000, -5, null],
  ['ord-07', 7, 'ins-39', 'buy', 'market', 'day', 'filled', 1100, -3, 'prp-05'],
  ['ord-08', 7, 'ins-29', 'buy', 'limit', 'gtc', 'submitted', 5400, -2, 'prp-05'],
  ['ord-09', 4, 'ins-31', 'sell', 'market', 'day', 'filled', 4200, -4, null],
  ['ord-10', 4, 'ins-08', 'buy', 'stop-limit', 'gtc', 'draft', 3100, 0, 'prp-06'],
  ['ord-11', 5, 'ins-02', 'buy', 'limit', 'day', 'submitted', 1800, -1, null],
  ['ord-12', 2, 'ins-35', 'buy', 'market', 'day', 'filled', 900, -6, null],
  ['ord-13', 6, 'ins-30', 'buy', 'market', 'day', 'filled', 1500, -8, null],
  ['ord-14', 5, 'ins-40', 'sell', 'limit', 'fok', 'rejected', 400, -3, null],
];

/* --------------------------------------------------------------- activity */

const ACTIVITY_ACTIONS = [
  ['order-placed', 'trading'],
  ['order-filled', 'trading'],
  ['proposal-created', 'advice'],
  ['proposal-approved', 'advice'],
  ['rebalance-executed', 'trading'],
  ['kyc-updated', 'compliance'],
  ['goal-created', 'planning'],
  ['client-contacted', 'relationship'],
  ['document-signed', 'compliance'],
  ['review-completed', 'relationship'],
  ['cash-received', 'operations'],
  ['mandate-changed', 'advice'],
];

/* ------------------------------------------------------------------ build */

const instruments = INSTRUMENT_SEEDS.map(
  ([id, ticker, name, type, assetClass, sector, region, currency, basePrice]) => {
    const path = PRICE_PATH[type];
    // Walk a 12-point path forward from an implied start, then rescale so the
    // LAST point is exactly `price`. A series whose final point disagrees with
    // the price beside it reads as a bug — same calibration as the credit-risk
    // rating history.
    const steps = [];
    let v = basePrice / (1 + path.mu) ** PRICE_MONTHS;
    for (let i = 0; i < PRICE_MONTHS; i++) {
      v = v * (1 + normal(path.mu, path.sd));
      steps.push(v);
    }
    const factor = basePrice / steps[steps.length - 1];
    const series = steps.map((x) => r4(x * factor));
    series[series.length - 1] = r4(basePrice);

    const dayChangePct = r4(normal(0.0004, DAY_MOVE[type] / 2));
    return {
      id,
      ticker,
      name,
      type,
      typeKey: `wealth.instrumentType.${type}`,
      assetClass,
      assetClassKey: `wealth.assetClass.${assetClass}`,
      sector,
      sectorKey: `wealth.instrumentSector.${sector}`,
      region,
      regionKey: `wealth.region.${region}`,
      currency,
      price: r4(basePrice),
      dayChangePct,
      /** Twelve month-end closes, oldest first; the last is `price`. */
      priceSeries: series,
      priceSeriesDates: Array.from({ length: PRICE_MONTHS }, (_, i) => monthEndBack(PRICE_MONTHS - 1 - i)),
      lotSize: LOT_SIZE[type],
      /** Trailing twelve-month price return, as a fraction. */
      twelveMonthReturn: r4(series[series.length - 1] / series[0] - 1),
    };
  },
);

const instrumentById = new Map(instruments.map((i) => [i.id, i]));
const byAssetClass = (cls) => instruments.filter((i) => i.assetClass === cls);

/* --------------------------------------------------- portfolios + positions */

const households = [];
const portfolios = [];
const positions = [];
const allocations = [];

let posSeq = 0;

HOUSEHOLD_SEEDS.forEach(
  ([id, name, domicile, riskProfile, mandate, strategy, segment, advisorId, aumTarget], hhIndex) => {
    const targets = STRATEGY_TARGETS[strategy];
    const portfolioId = `pf-${pad(hhIndex + 1)}`;

    // Drift each class off its target by a bounded amount, then renormalise so
    // the actual weights still sum to 1 before any rounding happens.
    const drifted = {};
    let driftedTotal = 0;
    for (const cls of ASSET_CLASSES) {
      const target = targets[cls];
      const raw = Math.max(0.005, target + normal(0, target * 0.22 + 0.006));
      drifted[cls] = raw;
      driftedTotal += raw;
    }
    for (const cls of ASSET_CLASSES) drifted[cls] /= driftedTotal;

    const cashBalance = r2(aumTarget * drifted.cash);
    const own = [];

    for (const cls of ASSET_CLASSES) {
      if (cls === 'cash') continue;
      const classValue = aumTarget * drifted[cls];
      const pool = byAssetClass(cls);
      const [lo, hi] = CLASS_HOLDING_COUNT[cls];
      const count = Math.min(pool.length, ui(lo, hi));

      /*
       * Choose without replacement, deterministically, with a HOME BIAS.
       *
       * This is a euro book. Picking uniformly from a universe that is 40% USD
       * by count put more than half the book's securities value outside the
       * reporting currency, which is not a private bank in Zürich — it is a
       * currency fund. Roughly a quarter of the picks go abroad, which is
       * enough for every screen to exercise the local / EUR pair without the FX
       * becoming the whole story.
       *
       * The away branch EXCLUDES euro rather than merely not preferring it.
       * Left in, the euro names win the away draw too (there are more of them),
       * and the two smallest currencies — three GBP names and three CHF —
       * never get picked at all. A currency-exposure panel showing exactly two
       * currencies is not exercising anything.
       */
      const chosen = [];
      const remaining = pool.slice();
      for (let k = 0; k < count; k++) {
        const home = remaining.filter((i) => i.currency === 'EUR');
        const away = remaining.filter((i) => i.currency !== 'EUR');
        const preferHome = home.length > 0 && (away.length === 0 || chance(0.74));
        const candidates = preferHome ? home : away;
        const instrument = candidates[ui(0, candidates.length - 1)];
        remaining.splice(remaining.indexOf(instrument), 1);
        chosen.push(instrument);
      }

      // Split the class value with weights that are never degenerate — a 0.4%
      // position is noise on an allocation screen, not a holding.
      const raws = chosen.map(() => uf(0.6, 1.6));
      const rawTotal = raws.reduce((a, x) => a + x, 0);

      chosen.forEach((instrument, k) => {
        const shareEur = classValue * (raws[k] / rawTotal);
        const rate = FX[instrument.currency];
        const lot = instrument.lotSize;
        const rawUnits = shareEur / (instrument.price * rate);
        const quantity = Math.max(lot, Math.round(rawUnits / lot) * lot);

        // A holding is usually in profit, sometimes not. The cost basis is what
        // makes unrealised P/L a real number rather than a decoration.
        const gain = normal(0.11, 0.16);
        const costPerUnit = r4(instrument.price / (1 + gain));
        const marketValue = r2(quantity * instrument.price);
        const costBasis = r2(quantity * costPerUnit);
        const marketValueEur = r2(marketValue * rate);
        const costBasisEur = r2(costBasis * rate);

        posSeq += 1;
        own.push({
          id: `pos-${pad(posSeq)}`,
          portfolioId,
          householdId: id,
          instrumentId: instrument.id,
          ticker: instrument.ticker,
          instrumentName: instrument.name,
          type: instrument.type,
          typeKey: instrument.typeKey,
          assetClass: instrument.assetClass,
          assetClassKey: instrument.assetClassKey,
          sector: instrument.sector,
          sectorKey: instrument.sectorKey,
          region: instrument.region,
          regionKey: instrument.regionKey,
          currency: instrument.currency,
          quantity: r2(quantity),
          price: instrument.price,
          costPerUnit,
          marketValue,
          costBasis,
          marketValueEur,
          costBasisEur,
          unrealisedPl: r2(marketValueEur - costBasisEur),
          unrealisedPlPct: r4(marketValueEur / costBasisEur - 1),
          dayChangePct: instrument.dayChangePct,
          dayChangeEur: r2(marketValueEur * instrument.dayChangePct),
          // Weight is filled in once the portfolio total is known.
          weight: 0,
          openedDate: monthOffset(-ui(2, 54), ui(1, 28)),
        });
      });
    }

    const securitiesValue = sum(own, (p) => p.marketValueEur);
    const marketValue = r2(securitiesValue + cashBalance);
    const costBasis = r2(sum(own, (p) => p.costBasisEur) + cashBalance);

    for (const p of own) {
      p.weight = r4(p.marketValueEur / marketValue);
      positions.push(p);
    }

    const benchmark = BENCHMARKS[strategy];
    portfolios.push({
      id: portfolioId,
      householdId: id,
      /** Mandate reference. A proper noun — deliberately not translated. */
      reference: `KPB-${2200 + hhIndex + 1}-${strategy.slice(0, 3).toUpperCase()}`,
      strategy,
      strategyKey: `wealth.strategy.${strategy}`,
      benchmarkId: benchmark.id,
      benchmarkName: benchmark.name,
      currency: 'EUR',
      inceptionDate: monthOffset(-ui(30, 132), ui(1, 28)),
      cashBalance,
      securitiesValue,
      marketValue,
      costBasis,
      unrealisedPl: r2(marketValue - costBasis),
      unrealisedPlPct: r4(marketValue / costBasis - 1),
      positionCount: own.length,
      feeBps: Math.round(uf(48, 96) / 2) * 2,
      lastRebalanceDate: monthOffset(-ui(1, 9), ui(1, 28)),
      nextReviewDate: monthOffset(ui(1, 8), ui(1, 28)),
      // Filled in from the performance series below.
      ytdReturn: 0,
      benchmarkYtdReturn: 0,
      oneYearReturn: 0,
      benchmarkOneYearReturn: 0,
      twoYearReturn: 0,
      benchmarkTwoYearReturn: 0,
      maxDrawdown: 0,
    });

    households.push({
      id,
      name,
      domicile,
      riskProfile,
      riskProfileKey: `wealth.riskProfile.${riskProfile}`,
      mandate,
      mandateKey: `wealth.mandate.${mandate}`,
      segment,
      segmentKey: `wealth.segment.${segment}`,
      advisorId,
      advisorName: ADVISORS.find((a) => a.id === advisorId).name,
      portfolioId,
      strategy,
      strategyKey: `wealth.strategy.${strategy}`,
      totalAum: marketValue,
      cashBalance,
      // Filled in below, once every household is priced.
      aumShare: 0,
      memberIds: [],
      memberCount: 0,
      goalCount: 0,
      openProposalCount: 0,
      positionCount: own.length,
      unrealisedPl: r2(marketValue - costBasis),
      ytdReturn: 0,
      kycStatus: 'verified',
      kycStatusKey: 'wealth.kycStatus.verified',
      onboardedDate: monthOffset(-ui(20, 160), ui(1, 28)),
      lastReviewDate: monthOffset(-ui(1, 10), ui(1, 28)),
      nextReviewDate: monthOffset(ui(1, 11), ui(1, 28)),
      lastContactDate: dayOffset(-ui(3, 90)),
    });
  },
);

const householdById = new Map(households.map((h) => [h.id, h]));
const portfolioByHousehold = new Map(portfolios.map((p) => [p.householdId, p]));

const bookAum = sum(households, (h) => h.totalAum);
for (const h of households) h.aumShare = r4(h.totalAum / bookAum);

/* ---------------------------------------------------------------- clients */

const clients = CLIENT_SEEDS.map(
  ([id, householdId, name, role, kycStatus, riskTolerance, domicile, dateOfBirth, emailLocal]) => {
    const household = householdById.get(householdId);
    household.memberIds.push(id);
    return {
      id,
      householdId,
      householdName: household.name,
      name,
      role,
      roleKey: `wealth.clientRole.${role}`,
      kycStatus,
      kycStatusKey: `wealth.kycStatus.${kycStatus}`,
      riskTolerance,
      riskToleranceKey: `wealth.riskTolerance.${riskTolerance}`,
      domicile,
      dateOfBirth,
      /** Whole years at the reporting date. */
      age: Math.floor(daysBetween(dateOfBirth, REPORTING_DATE) / 365.2425),
      email: `${emailLocal}@example.invalid`,
      phone: `+00 0 0000 ${pad(ui(10, 99))}${pad(ui(10, 99))}`,
      isPrimary: role === 'primary',
      kycReviewDate: monthOffset(kycStatus === 'expired' ? -ui(2, 8) : ui(1, 18), ui(1, 28)),
    };
  },
);

/** A household's KYC standing is its weakest member's. */
const KYC_RANK = { expired: 0, pending: 1, 'review-due': 2, verified: 3 };
for (const h of households) {
  h.memberCount = h.memberIds.length;
  const worst = clients
    .filter((c) => c.householdId === h.id)
    .reduce((a, c) => (KYC_RANK[c.kycStatus] < KYC_RANK[a] ? c.kycStatus : a), 'verified');
  h.kycStatus = worst;
  h.kycStatusKey = `wealth.kycStatus.${worst}`;
}

/* ------------------------------------------------------------- allocation */

for (const portfolio of portfolios) {
  const targets = STRATEGY_TARGETS[portfolio.strategy];
  const own = positions.filter((p) => p.portfolioId === portfolio.id);
  for (const cls of ASSET_CLASSES) {
    const marketValue =
      cls === 'cash' ? portfolio.cashBalance : sum(own.filter((p) => p.assetClass === cls), (p) => p.marketValueEur);
    const actualWeight = r4(marketValue / portfolio.marketValue);
    const targetWeight = targets[cls];
    const drift = r4(actualWeight - targetWeight);
    const absDrift = Math.abs(drift);
    allocations.push({
      portfolioId: portfolio.id,
      householdId: portfolio.householdId,
      assetClass: cls,
      assetClassKey: `wealth.assetClass.${cls}`,
      targetWeight,
      actualWeight,
      /** Signed: positive is overweight. A fraction of the portfolio, not of the target. */
      drift,
      driftBps: Math.round(drift * 10000),
      /** EUR to trade to return to target. Negative means sell. */
      rebalanceAmount: r2(-drift * portfolio.marketValue),
      marketValue,
      status: absDrift < 0.02 ? 'in-band' : absDrift < 0.05 ? 'drifted' : 'breach',
    });
  }
}

/* ------------------------------------------------------------ performance */

const performance = [];
const historyDates = Array.from({ length: HISTORY_MONTHS }, (_, i) => monthEndBack(HISTORY_MONTHS - 1 - i));

for (const portfolio of portfolios) {
  const model = STRATEGY_RETURN[portfolio.strategy];
  /**
   * Manager skill for this mandate, in monthly terms.
   *
   * The mean is deliberately positive and the spread deliberately wide enough
   * to cross zero: a book where every mandate beats its benchmark is a fantasy,
   * and a book where the aggregate lands exactly ON the benchmark makes the
   * headline KPI read as a broken calculation. This produces four mandates
   * ahead and four behind, inside a book that is modestly ahead.
   */
  const alpha = normal(0.001, 0.0012);

  const monthly = [];
  const benchmarkMonthly = [];
  const flows = [];
  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const bench = normal(model.mu, model.sd);
    // The mandate tracks its benchmark with idiosyncratic residual on top.
    const port = bench + alpha + normal(0, model.sd * 0.28);
    benchmarkMonthly.push(bench);
    monthly.push(port);
    // Flows are occasional and lumpy — a contribution or a drawdown, not a drip.
    flows.push(chance(0.16) ? normal(0, 1) * 0.02 : 0);
  }

  // Walk forward from an implied start, then rescale so the final market value
  // is exactly the one the positions produced.
  let v = 1;
  const raw = [];
  const rawFlows = [];
  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const flow = v * flows[i];
    v = v * (1 + monthly[i]) + flow;
    raw.push(v);
    rawFlows.push(flow);
  }
  const factor = portfolio.marketValue / raw[raw.length - 1];

  let cumulative = 1;
  let cumulativeBenchmark = 1;
  let peak = 0;
  let maxDrawdown = 0;

  for (let i = 0; i < HISTORY_MONTHS; i++) {
    cumulative *= 1 + monthly[i];
    cumulativeBenchmark *= 1 + benchmarkMonthly[i];
    const marketValue = i === HISTORY_MONTHS - 1 ? portfolio.marketValue : r2(raw[i] * factor);
    peak = Math.max(peak, marketValue);
    maxDrawdown = Math.min(maxDrawdown, marketValue / peak - 1);
    performance.push({
      portfolioId: portfolio.id,
      householdId: portfolio.householdId,
      date: historyDates[i],
      quarter: quarterOf(historyDates[i]),
      marketValue,
      netFlow: r2(rawFlows[i] * factor),
      monthlyReturn: r6(monthly[i]),
      benchmarkMonthlyReturn: r6(benchmarkMonthly[i]),
      cumulativeReturn: r6(cumulative - 1),
      cumulativeBenchmarkReturn: r6(cumulativeBenchmark - 1),
      drawdown: r6(marketValue / peak - 1),
    });
  }

  const window = (n) => {
    const slice = monthly.slice(HISTORY_MONTHS - n);
    return r6(slice.reduce((a, r) => a * (1 + r), 1) - 1);
  };
  const benchWindow = (n) => {
    const slice = benchmarkMonthly.slice(HISTORY_MONTHS - n);
    return r6(slice.reduce((a, r) => a * (1 + r), 1) - 1);
  };
  // 2026-01 … 2026-06 are the last six points of a series ending 2026-06-30.
  portfolio.ytdReturn = window(6);
  portfolio.benchmarkYtdReturn = benchWindow(6);
  portfolio.oneYearReturn = window(12);
  portfolio.benchmarkOneYearReturn = benchWindow(12);
  portfolio.twoYearReturn = window(24);
  portfolio.benchmarkTwoYearReturn = benchWindow(24);
  portfolio.maxDrawdown = r6(maxDrawdown);

  householdById.get(portfolio.householdId).ytdReturn = portfolio.ytdReturn;
}

/**
 * The book series is the SUM of the mandates, month by month — not a separate
 * random walk. Any other construction lets the headline number disagree with
 * the eight rows underneath it.
 */
const bookPerformance = historyDates.map((date, i) => {
  const slice = performance.filter((p) => p.date === date);
  const marketValue = sum(slice, (p) => p.marketValue);
  const netFlow = sum(slice, (p) => p.netFlow);
  const previous = i === 0 ? null : historyDates[i - 1];
  const previousValue = previous
    ? sum(performance.filter((p) => p.date === previous), (p) => p.marketValue)
    : 0;
  // Return net of flows, so a contribution is not reported as performance.
  const monthlyReturn = previousValue ? r6((marketValue - netFlow) / previousValue - 1) : 0;
  const benchmarkMonthlyReturn = r6(
    slice.reduce((a, p) => a + p.benchmarkMonthlyReturn * p.marketValue, 0) / marketValue,
  );
  return { date, quarter: quarterOf(date), marketValue, netFlow, monthlyReturn, benchmarkMonthlyReturn };
});

{
  let cumulative = 1;
  let cumulativeBenchmark = 1;
  let peak = 0;
  for (const point of bookPerformance) {
    cumulative *= 1 + point.monthlyReturn;
    cumulativeBenchmark *= 1 + point.benchmarkMonthlyReturn;
    peak = Math.max(peak, point.marketValue);
    point.cumulativeReturn = r6(cumulative - 1);
    point.cumulativeBenchmarkReturn = r6(cumulativeBenchmark - 1);
    point.drawdown = r6(point.marketValue / peak - 1);
    point.portfolioId = null;
    point.householdId = null;
  }
}

const windowOf = (points, n, key) =>
  r6(points.slice(points.length - n).reduce((a, p) => a * (1 + p[key]), 1) - 1);

/* ------------------------------------------------------------------ goals */

const goals = GOAL_SEEDS.map(
  ([id, householdId, type, priority, beneficiaryClientId, targetAmount, targetMonthsAhead, fundedFraction, monthlyContribution]) => {
    const household = householdById.get(householdId);
    const beneficiary = beneficiaryClientId ? clients.find((c) => c.id === beneficiaryClientId) : null;
    const currentAmount = r2(targetAmount * fundedFraction);
    const targetDate = monthOffset(targetMonthsAhead, 28);
    const months = monthsFromReporting(targetDate);
    const annualGrowth = GOAL_GROWTH[household.riskProfile];
    const g = (1 + annualGrowth) ** (1 / 12) - 1;
    const grown = currentAmount * (1 + g) ** months;
    const contributed = monthlyContribution * (((1 + g) ** months - 1) / g);
    const projectedAmount = r2(grown + contributed);
    const projectedFundedPct = r4(projectedAmount / targetAmount);
    const fundedPct = r4(currentAmount / targetAmount);
    const status =
      fundedPct >= 1
        ? 'funded'
        : projectedFundedPct >= 1
          ? 'on-track'
          : projectedFundedPct >= 0.85
            ? 'at-risk'
            : 'behind';
    household.goalCount += 1;
    return {
      id,
      householdId,
      householdName: household.name,
      type,
      typeKey: `wealth.goalType.${type}`,
      priority,
      priorityKey: `wealth.priority.${priority}`,
      beneficiaryClientId: beneficiaryClientId ?? null,
      /** Proper noun, or `null` for a household-level objective. */
      beneficiaryName: beneficiary ? beneficiary.name : null,
      targetAmount: r2(targetAmount),
      targetDate,
      monthsRemaining: months,
      currentAmount,
      fundedPct,
      monthlyContribution: r2(monthlyContribution),
      assumedAnnualGrowth: r4(annualGrowth),
      projectedAmount,
      projectedFundedPct,
      /** Shortfall against the target at the target date. Zero when funded. */
      projectedShortfall: r2(Math.max(0, targetAmount - projectedAmount)),
      onTrack: status === 'on-track' || status === 'funded',
      status,
      statusKey: `wealth.goalStatus.${status}`,
      createdDate: monthOffset(-ui(6, 60), ui(1, 28)),
    };
  },
);

/* -------------------------------------------------------------- proposals */

/** The state of every step, given where the proposal has reached. */
function stepStates(status, currentStepIndex) {
  return PROPOSAL_STEPS.map((step, index) => {
    let state;
    if (status === 'rejected' && index === currentStepIndex) state = 'blocked';
    else if (index < currentStepIndex) state = 'complete';
    else if (index === currentStepIndex) state = status === 'approved' ? 'complete' : 'current';
    else state = 'pending';
    return { id: step, nameKey: `wealth.proposalStep.${step}`, state, stateKey: `wealth.stepState.${state}` };
  });
}

const proposals = PROPOSAL_SEEDS.map(
  ([id, householdId, type, status, currentStepIndex, estimatedValue, advisorId, createdMonthsBack]) => {
    const household = householdById.get(householdId);
    const advisor = ADVISORS.find((a) => a.id === advisorId);
    const open = status !== 'approved' && status !== 'rejected';
    if (open) household.openProposalCount += 1;
    const createdDate = monthOffset(createdMonthsBack, ui(1, 26));
    return {
      id,
      householdId,
      householdName: household.name,
      portfolioId: household.portfolioId,
      type,
      typeKey: `wealth.proposalType.${type}`,
      status,
      statusKey: `wealth.proposalStatus.${status}`,
      currentStepIndex,
      steps: stepStates(status, currentStepIndex),
      stepCount: PROPOSAL_STEPS.length,
      completedStepCount: stepStates(status, currentStepIndex).filter((s) => s.state === 'complete').length,
      estimatedValue: r2(estimatedValue),
      /** Estimated annual fee impact, EUR. */
      estimatedFeeImpact: r2((estimatedValue * household.aumShare * 0.0068) / 4),
      advisorId,
      advisorName: advisor.name,
      createdDate,
      updatedDate: dayOffset(-ui(1, 20)),
      daysOpen: daysBetween(createdDate, REPORTING_DATE),
      open,
    };
  },
);

/* ----------------------------------------------------------------- orders */

const ORDER_FILL = {
  draft: 0,
  staged: 0,
  submitted: 0,
  'partially-filled': 0.45,
  filled: 1,
  cancelled: 0,
  rejected: 0,
};

const orders = ORDER_SEEDS.map(
  ([id, portfolioIndex, instrumentId, side, orderType, timeInForce, status, quantity, daysBack, proposalId]) => {
    const portfolio = portfolios[portfolioIndex];
    const household = householdById.get(portfolio.householdId);
    const instrument = instrumentById.get(instrumentId);
    const rate = FX[instrument.currency];
    // A limit sits inside the spread on the side that helps the client.
    const limitPrice =
      orderType === 'market' ? null : r4(instrument.price * (side === 'buy' ? uf(0.985, 0.999) : uf(1.001, 1.016)));
    const referencePrice = limitPrice ?? instrument.price;
    const estimatedValue = r2(quantity * referencePrice);
    const filledQuantity = r2(quantity * ORDER_FILL[status]);
    const createdDate = dayOffset(daysBack);
    return {
      id,
      portfolioId: portfolio.id,
      portfolioReference: portfolio.reference,
      householdId: household.id,
      householdName: household.name,
      instrumentId,
      ticker: instrument.ticker,
      instrumentName: instrument.name,
      assetClass: instrument.assetClass,
      assetClassKey: instrument.assetClassKey,
      side,
      sideKey: `wealth.orderSide.${side}`,
      quantity: r2(quantity),
      orderType,
      orderTypeKey: `wealth.orderType.${orderType}`,
      limitPrice,
      referencePrice,
      timeInForce,
      timeInForceKey: `wealth.timeInForce.${timeInForce}`,
      currency: instrument.currency,
      estimatedValue,
      estimatedValueEur: r2(estimatedValue * rate),
      status,
      statusKey: `wealth.orderStatus.${status}`,
      filledQuantity,
      averageFillPrice: filledQuantity > 0 ? r4(referencePrice * uf(0.9975, 1.0025)) : null,
      createdDate,
      createdAt: stamp(createdDate, ui(8, 17), ui(0, 59)),
      advisorId: household.advisorId,
      advisorName: household.advisorName,
      proposalId: proposalId ?? null,
    };
  },
).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id.localeCompare(b.id, 'en')));

/* --------------------------------------------------------------- activity */

const activity = [];
let actSeq = 0;

/** One entry per day, walking back from the reporting date. */
for (let back = 0; back < 46; back++) {
  if (!chance(0.68)) continue;
  const date = dayOffset(-back);
  const [action, category] = pick(ACTIVITY_ACTIONS);
  const household = pick(households);
  let targetType = 'household';
  let targetId = household.id;
  let targetLabel = household.name;

  if (action === 'order-placed' || action === 'order-filled') {
    const order = pick(orders.filter((o) => o.householdId === household.id)) ?? pick(orders);
    targetType = 'order';
    targetId = order.id;
    targetLabel = `${order.ticker} ${order.id}`;
  } else if (action === 'proposal-created' || action === 'proposal-approved') {
    const proposal = pick(proposals.filter((p) => p.householdId === household.id)) ?? pick(proposals);
    targetType = 'proposal';
    targetId = proposal.id;
    targetLabel = proposal.id;
  } else if (action === 'goal-created') {
    const goal = pick(goals.filter((g) => g.householdId === household.id)) ?? pick(goals);
    targetType = 'goal';
    targetId = goal.id;
    targetLabel = goal.id;
  } else if (action === 'kyc-updated' || action === 'client-contacted' || action === 'document-signed') {
    const client = pick(clients.filter((c) => c.householdId === household.id));
    targetType = 'client';
    targetId = client.id;
    targetLabel = client.name;
  } else if (action === 'rebalance-executed') {
    targetType = 'portfolio';
    targetId = household.portfolioId;
    targetLabel = portfolioByHousehold.get(household.id).reference;
  }

  actSeq += 1;
  activity.push({
    id: `act-${pad(actSeq)}`,
    date,
    timestamp: stamp(date, ui(7, 19), ui(0, 59)),
    actorId: household.advisorId,
    actorName: household.advisorName,
    action,
    actionKey: `wealth.activity.${action}`,
    category,
    categoryKey: `wealth.activityCategory.${category}`,
    householdId: household.id,
    householdName: household.name,
    targetType,
    targetTypeKey: `wealth.entity.${targetType}`,
    targetId,
    targetLabel,
    daysAgo: back,
  });
}
activity.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : a.id.localeCompare(b.id, 'en')));

/* ------------------------------------------------------------ book totals */

const bookCostBasis = sum(portfolios, (p) => p.costBasis);
const bookCash = sum(portfolios, (p) => p.cashBalance);
const bookSecurities = sum(portfolios, (p) => p.securitiesValue);
const bookYtd = windowOf(bookPerformance, 6, 'monthlyReturn');
const bookBenchmarkYtd = windowOf(bookPerformance, 6, 'benchmarkMonthlyReturn');

const totals = {
  reportingDate: REPORTING_DATE,
  reportingQuarter: REPORTING_QUARTER,
  currency: 'EUR',
  advisorId: ADVISORS[0].id,
  advisorName: ADVISORS[0].name,
  householdCount: households.length,
  clientCount: clients.length,
  portfolioCount: portfolios.length,
  positionCount: positions.length,
  instrumentCount: instruments.length,
  goalCount: goals.length,
  proposalCount: proposals.length,
  openProposalCount: proposals.filter((p) => p.open).length,
  orderCount: orders.length,
  workingOrderCount: orders.filter((o) => o.status === 'submitted' || o.status === 'partially-filled').length,
  activityCount: activity.length,
  aum: bookAum,
  cash: bookCash,
  securitiesValue: bookSecurities,
  costBasis: bookCostBasis,
  unrealisedPl: r2(bookAum - bookCostBasis),
  unrealisedPlPct: r4(bookAum / bookCostBasis - 1),
  ytdReturn: bookYtd,
  benchmarkYtdReturn: bookBenchmarkYtd,
  /** Portfolio less benchmark, as a fraction. Can be negative. */
  ytdExcessReturn: r6(bookYtd - bookBenchmarkYtd),
  oneYearReturn: windowOf(bookPerformance, 12, 'monthlyReturn'),
  benchmarkOneYearReturn: windowOf(bookPerformance, 12, 'benchmarkMonthlyReturn'),
  netNewMoneyYtd: sum(bookPerformance.slice(HISTORY_MONTHS - 6), (p) => p.netFlow),
  netNewMoneyOneYear: sum(bookPerformance.slice(HISTORY_MONTHS - 12), (p) => p.netFlow),
  largestHouseholdShare: r4(Math.max(...households.map((h) => h.aumShare))),
  goalsOnTrack: goals.filter((g) => g.onTrack).length,
  goalsAtRisk: goals.filter((g) => g.status === 'at-risk' || g.status === 'behind').length,
  goalTargetTotal: sum(goals, (g) => g.targetAmount),
  goalFundedTotal: sum(goals, (g) => g.currentAmount),
  kycReviewDueCount: clients.filter((c) => c.kycStatus !== 'verified').length,
  driftBreachCount: allocations.filter((a) => a.status === 'breach').length,
  driftedCount: allocations.filter((a) => a.status === 'drifted').length,
  reviewsDueCount: households.filter((h) => monthsFromReporting(h.nextReviewDate) <= 2).length,
};

/** Book-level allocation: every mandate's asset class, rolled up. */
const bookAllocation = ASSET_CLASSES.map((cls) => {
  const rows = allocations.filter((a) => a.assetClass === cls);
  const marketValue = sum(rows, (a) => a.marketValue);
  const actualWeight = r4(marketValue / bookAum);
  // The book target is the AUM-weighted mean of the mandates' targets — there
  // is no book-level mandate, so anything else would be invented.
  const targetWeight = r4(
    rows.reduce((a, row) => a + row.targetWeight * portfolios.find((p) => p.id === row.portfolioId).marketValue, 0) /
      bookAum,
  );
  const drift = r4(actualWeight - targetWeight);
  const absDrift = Math.abs(drift);
  return {
    portfolioId: null,
    householdId: null,
    assetClass: cls,
    assetClassKey: `wealth.assetClass.${cls}`,
    targetWeight,
    actualWeight,
    drift,
    driftBps: Math.round(drift * 10000),
    rebalanceAmount: r2(-drift * bookAum),
    marketValue,
    status: absDrift < 0.02 ? 'in-band' : absDrift < 0.05 ? 'drifted' : 'breach',
  };
});

/* ------------------------------------------------------------ assertions */

/* These are cheap and they have all fired at least once during authoring. A
   fixture that silently stops reconciling is worse than one that refuses to
   emit. */
function assert(label, condition, detail = '') {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${label}${detail ? `  ${detail}` : ''}`);
    process.exit(1);
  }
}
for (const [strategy, row] of Object.entries(STRATEGY_TARGETS)) {
  const total = Object.values(row).reduce((a, x) => a + x, 0);
  assert(`${strategy} targets sum to 1`, Math.abs(total - 1) < 1e-9, String(total));
}
assert('aum === Σ portfolio market value', Math.abs(bookAum - sum(portfolios, (p) => p.marketValue)) < 1, '');
for (const portfolio of portfolios) {
  const own = positions.filter((p) => p.portfolioId === portfolio.id);
  const weights = own.reduce((a, p) => a + p.weight, 0) + portfolio.cashBalance / portfolio.marketValue;
  assert(`${portfolio.id} weights sum to 1`, Math.abs(weights - 1) < 0.005, String(weights));
  const alloc = allocations.filter((a) => a.portfolioId === portfolio.id);
  const allocWeights = alloc.reduce((a, x) => a + x.actualWeight, 0);
  assert(`${portfolio.id} allocation sums to 1`, Math.abs(allocWeights - 1) < 0.005, String(allocWeights));
  const last = performance.filter((p) => p.portfolioId === portfolio.id).at(-1);
  assert(`${portfolio.id} series ends at market value`, last.marketValue === portfolio.marketValue, '');
}
assert('every client belongs to a known household', clients.every((c) => householdById.has(c.householdId)));
assert('every position resolves an instrument', positions.every((p) => instrumentById.has(p.instrumentId)));
assert('every goal belongs to a known household', goals.every((g) => householdById.has(g.householdId)));
assert('every date is on or before the reporting date for history', activity.every((a) => a.date <= REPORTING_DATE));

/* ------------------------------------------------------------------ emit */

const j = (v) => JSON.stringify(v, null, 2);

const file = `/* eslint-disable */
/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by \`scripts/generate-wealth-fixture.mjs\` with seed 0x${SEED.toString(16)} and the
 * frozen reporting date ${REPORTING_DATE}. Re-running the generator reproduces this file
 * byte for byte.
 */
import type {
  Activity,
  Advisor,
  AllocationRow,
  Client,
  Currency,
  Goal,
  Household,
  Instrument,
  Order,
  PerformancePoint,
  Portfolio,
  Position,
  Proposal,
  BookTotals,
  WealthFixture,
} from './types';

export const FX_RATES: Record<Currency, number> = ${j(FX)};

export const ADVISORS: readonly Advisor[] = ${j(ADVISORS)};

export const INSTRUMENTS: readonly Instrument[] = ${j(instruments)};

export const HOUSEHOLDS: readonly Household[] = ${j(households)};

export const CLIENTS: readonly Client[] = ${j(clients)};

export const PORTFOLIOS: readonly Portfolio[] = ${j(portfolios)};

export const POSITIONS: readonly Position[] = ${j(positions)};

export const ALLOCATIONS: readonly AllocationRow[] = ${j(allocations)};

export const BOOK_ALLOCATION: readonly AllocationRow[] = ${j(bookAllocation)};

export const PERFORMANCE: readonly PerformancePoint[] = ${j(performance)};

export const BOOK_PERFORMANCE: readonly PerformancePoint[] = ${j(bookPerformance)};

export const GOALS: readonly Goal[] = ${j(goals)};

export const PROPOSALS: readonly Proposal[] = ${j(proposals)};

export const ORDERS: readonly Order[] = ${j(orders)};

export const ACTIVITY: readonly Activity[] = ${j(activity)};

export const TOTALS: BookTotals = ${j(totals)};

export const FIXTURE: WealthFixture = {
  reportingDate: '${REPORTING_DATE}',
  reportingQuarter: '${REPORTING_QUARTER}',
  baseCurrency: 'EUR',
  fxRates: FX_RATES,
  totals: TOTALS,
  advisors: ADVISORS as Advisor[],
  instruments: INSTRUMENTS as Instrument[],
  households: HOUSEHOLDS as Household[],
  clients: CLIENTS as Client[],
  portfolios: PORTFOLIOS as Portfolio[],
  positions: POSITIONS as Position[],
  allocations: ALLOCATIONS as AllocationRow[],
  bookAllocation: BOOK_ALLOCATION as AllocationRow[],
  performance: PERFORMANCE as PerformancePoint[],
  bookPerformance: BOOK_PERFORMANCE as PerformancePoint[],
  goals: GOALS as Goal[],
  proposals: PROPOSALS as Proposal[],
  orders: ORDERS as Order[],
  activity: ACTIVITY as Activity[],
};
`;

writeFileSync(OUT, file, 'utf8');

console.log(`wrote ${OUT}`);
console.log(
  `  households=${households.length} clients=${clients.length} portfolios=${portfolios.length} ` +
    `positions=${positions.length} instruments=${instruments.length} goals=${goals.length} ` +
    `proposals=${proposals.length} orders=${orders.length} activity=${activity.length}`,
);
console.log(
  `  AUM=${(totals.aum / 1e6).toFixed(1)}m cash=${(totals.cash / 1e6).toFixed(1)}m ` +
    `P/L=${(totals.unrealisedPl / 1e6).toFixed(2)}m YTD=${(totals.ytdReturn * 100).toFixed(2)}% ` +
    `bench=${(totals.benchmarkYtdReturn * 100).toFixed(2)}%`,
);
console.log(
  `  goals on track=${totals.goalsOnTrack}/${totals.goalCount} drift breaches=${totals.driftBreachCount} ` +
    `KYC not verified=${totals.kycReviewDueCount} working orders=${totals.workingOrderCount}`,
);
