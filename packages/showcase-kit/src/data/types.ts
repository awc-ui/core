/**
 * Domain model for the "Aurelia Bank — Credit Risk Console" showcase vertical.
 *
 * Everything here is a plain, serialisable value. There is no runtime clock and
 * no randomness: the fixture is generated once at authoring time from a seeded
 * PRNG and baked into `generated.ts`, so all six framework builds render byte
 * identical numbers.
 */

/** Frozen reporting date. Every relative date in the fixture derives from this. */
export const REPORTING_DATE = '2026-03-31';

/** Reporting quarter label used in headers. */
export const REPORTING_QUARTER = '2026-Q1';

/** Base reporting currency for every aggregate value in the fixture. */
export const BASE_CURRENCY = 'EUR';

/* ------------------------------------------------------------------ sectors */

export type SectorId =
  | 'real-estate'
  | 'manufacturing'
  | 'energy'
  | 'retail-trade'
  | 'technology'
  | 'transport'
  | 'healthcare';

export interface Sector {
  id: SectorId;
  /** i18n key, e.g. `sector.real-estate`. Never a pre-translated string. */
  nameKey: string;
  /** Number of counterparties booked to the sector. */
  counterpartyCount: number;
  facilityCount: number;
  /** Sum of member counterparty limits, in EUR. */
  limit: number;
  drawn: number;
  undrawn: number;
  /** Exposure at default, EUR. */
  ead: number;
  /** Expected loss, EUR. */
  expectedLoss: number;
  /** Risk-weighted assets, EUR. */
  rwa: number;
  /** EAD-weighted probability of default, as a fraction (0.0135 = 1.35%). */
  weightedAvgPd: number;
  /** EAD-weighted loss given default, as a fraction. */
  weightedAvgLgd: number;
  /** drawn / limit, as a fraction. */
  utilisation: number;
  /** Share of portfolio EAD, as a fraction. */
  portfolioShare: number;
}

/* ------------------------------------------------------------- rating scale */

export type RatingLabel =
  | 'AAA'
  | 'AA'
  | 'A'
  | 'BBB'
  | 'BB'
  | 'B'
  | 'CCC'
  | 'CC'
  | 'C'
  | 'D';

export type RatingBand = 'investment' | 'speculative' | 'default';

export interface RatingGrade {
  /** Internal grade, 1 (best) .. 10 (default). */
  grade: number;
  label: RatingLabel;
  /** i18n key for the band name, e.g. `ratingBand.investment`. */
  bandKey: string;
  band: RatingBand;
  /** Through-the-cycle probability of default for the grade, as a fraction. */
  pd: number;
}

/* ------------------------------------------------------------ counterparty */

/** ISO 3166-1 alpha-2 code. Resolve the display name via `country.<code>`. */
export type CountryCode =
  | 'AE'
  | 'DE'
  | 'ES'
  | 'FR'
  | 'GB'
  | 'IT'
  | 'NL'
  | 'RO'
  | 'SE'
  | 'US';

export interface Counterparty {
  id: string;
  /** Legal entity name. A proper noun — deliberately not translated. */
  legalName: string;
  sectorId: SectorId;
  country: CountryCode;
  /** Internal grade 1..10. */
  grade: number;
  ratingLabel: RatingLabel;
  ratingBand: RatingBand;
  /** Obligor PD, as a fraction. Anchored on the grade with an idiosyncratic tilt. */
  pd: number;
  /** Loss given default, as a fraction. */
  lgd: number;
  /** Exposure at default, EUR. */
  ead: number;
  /** Total committed limit, EUR. */
  limit: number;
  drawn: number;
  undrawn: number;
  /** drawn / limit, as a fraction. */
  utilisation: number;
  /** ead * pd * lgd, EUR. */
  expectedLoss: number;
  /** Risk-weighted assets, EUR. */
  rwa: number;
  /** rwa / ead, as a fraction. */
  rwaDensity: number;
  watchlist: boolean;
  /** Corporate group this entity belongs to, or `null` for a standalone name. */
  groupId: string | null;
  /** True when this entity is the head of its corporate group. */
  isGroupParent: boolean;
  /** Immediate parent counterparty id inside the group, or `null` for the head. */
  parentId: string | null;
  facilityCount: number;
  /** Open early-warning signals against this obligor. */
  signalCount: number;
  /** Relationship manager. Fictional. */
  relationshipManager: string;
  /** Date the obligor was onboarded, ISO `YYYY-MM-DD`. */
  onboardedDate: string;
  /** Date of the most recent credit review, ISO `YYYY-MM-DD`. */
  lastReviewDate: string;
  /** Date the next credit review falls due, ISO `YYYY-MM-DD`. */
  nextReviewDate: string;
}

export type CounterpartySortKey =
  | 'legalName'
  | 'ead'
  | 'pd'
  | 'expectedLoss'
  | 'rwa'
  | 'utilisation'
  | 'grade';

export interface CounterpartyFilter {
  sectorId?: SectorId;
  country?: CountryCode;
  /** `true` returns only watchlisted names, `false` only non-watchlisted. */
  watchlist?: boolean;
  groupId?: string;
  /** Inclusive internal-grade bounds. */
  minGrade?: number;
  maxGrade?: number;
  /** Case-insensitive substring match against `legalName` and `id`. */
  search?: string;
  /** Default `'ead'`. */
  sortBy?: CounterpartySortKey;
  /** Default `'desc'` for numeric keys, `'asc'` for `legalName`. */
  sortDir?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

/* -------------------------------------------------------------- facilities */

export type FacilityType =
  | 'term-loan'
  | 'revolving-credit'
  | 'trade-finance'
  | 'guarantee';

export type FacilityCurrency = 'EUR' | 'USD' | 'GBP' | 'RON' | 'AED';

export type FacilityStatus = 'performing' | 'watch' | 'impaired';

export interface Facility {
  id: string;
  counterpartyId: string;
  /** Denormalised for table rendering; still a proper noun. */
  counterpartyName: string;
  type: FacilityType;
  /** i18n key, e.g. `facilityType.term-loan`. */
  typeKey: string;
  currency: FacilityCurrency;
  /** Commitment in `currency`. */
  commitment: number;
  /** Drawn balance in `currency`. */
  drawn: number;
  /** Undrawn balance in `currency`. */
  undrawn: number;
  /** Commitment converted to EUR at the frozen fixture FX rate. */
  commitmentEur: number;
  drawnEur: number;
  undrawnEur: number;
  /** Exposure at default in EUR: drawn + CCF x undrawn. */
  ead: number;
  /** Credit conversion factor applied to the undrawn balance, as a fraction. */
  ccf: number;
  /** drawn / commitment, as a fraction. */
  utilisation: number;
  /** ISO `YYYY-MM-DD`. */
  maturityDate: string;
  /** Whole months from `REPORTING_DATE` to `maturityDate`. */
  monthsToMaturity: number;
  /** Interest margin over the reference rate, in basis points. */
  marginBps: number;
  secured: boolean;
  status: FacilityStatus;
  /** ISO `YYYY-MM-DD`. */
  originationDate: string;
  covenantCount: number;
  collateralCount: number;
}

/* --------------------------------------------------------------- covenants */

export type CovenantName = 'dscr' | 'net-leverage' | 'interest-cover';

export type CovenantDirection = 'min' | 'max';

export type CovenantStatus = 'compliant' | 'watch' | 'breach';

export interface Covenant {
  id: string;
  facilityId: string;
  counterpartyId: string;
  name: CovenantName;
  /** i18n key, e.g. `covenant.dscr`. */
  nameKey: string;
  /** `'min'` — the value must stay at or above the threshold. */
  direction: CovenantDirection;
  threshold: number;
  currentValue: number;
  /**
   * Signed headroom as a fraction of the threshold. Negative means breached.
   * `min`: (current - threshold) / threshold. `max`: (threshold - current) / threshold.
   */
  headroomPct: number;
  status: CovenantStatus;
  /** ISO `YYYY-MM-DD`, the quarter the covenant was last tested. */
  testDate: string;
  /** ISO `YYYY-MM-DD`, the next test date. */
  nextTestDate: string;
  /** Test frequency i18n key, e.g. `frequency.quarterly`. */
  frequencyKey: string;
}

/* -------------------------------------------------------------- collateral */

export type CollateralType =
  | 'real-estate'
  | 'receivables'
  | 'inventory'
  | 'cash-deposit'
  | 'equipment'
  | 'securities';

export interface Collateral {
  id: string;
  facilityId: string;
  counterpartyId: string;
  type: CollateralType;
  /** i18n key, e.g. `collateralType.receivables`. */
  typeKey: string;
  currency: FacilityCurrency;
  /** Gross valuation in `currency`. */
  valuation: number;
  /** Gross valuation converted to EUR. */
  valuationEur: number;
  /** Supervisory haircut, as a fraction. */
  haircutPct: number;
  /** valuationEur * (1 - haircutPct). */
  netValue: number;
  /** ISO `YYYY-MM-DD`. */
  lastValuationDate: string;
  /** i18n key for how the value was established, e.g. `valuationBasis.appraisal`. */
  valuationBasisKey: string;
}

/* ---------------------------------------------------------- rating history */

export interface RatingObservation {
  counterpartyId: string;
  /** e.g. `2025-Q3`. */
  quarter: string;
  /** Quarter-end date, ISO `YYYY-MM-DD`. */
  date: string;
  grade: number;
  label: RatingLabel;
  pd: number;
}

/* ---------------------------------------------------- early-warning signals */

export type SignalType =
  | 'covenant-breach'
  | 'rating-downgrade'
  | 'payment-delay'
  | 'utilisation-spike'
  | 'market-spread'
  | 'adverse-news'
  | 'audit-qualification';

export type SignalSeverity = 'high' | 'medium' | 'low';

export interface WatchlistSignal {
  id: string;
  counterpartyId: string;
  /** Denormalised for table rendering. */
  counterpartyName: string;
  sectorId: SectorId;
  grade: number;
  ratingLabel: RatingLabel;
  /** Counterparty EAD in EUR, denormalised so a watchlist table needs no join. */
  ead: number;
  type: SignalType;
  /** i18n key, e.g. `signal.payment-delay`. */
  typeKey: string;
  severity: SignalSeverity;
  /** i18n key, e.g. `severity.high`. */
  severityKey: string;
  /** ISO `YYYY-MM-DD`. */
  openedDate: string;
  /** Whole days between `openedDate` and `REPORTING_DATE`. */
  daysOpen: number;
  owner: string;
}

/* ------------------------------------------------------------------ groups */

export interface Group {
  id: string;
  /** Group name. A proper noun — deliberately not translated. */
  name: string;
  /** Counterparty id of the group head. */
  parentCounterpartyId: string;
  /** Every member counterparty id, head first. */
  memberIds: string[];
}

export interface GroupTreeNode {
  counterparty: Counterparty;
  children: GroupTreeNode[];
}

export interface GroupTree {
  id: string;
  name: string;
  root: GroupTreeNode;
  memberCount: number;
  totals: {
    limit: number;
    drawn: number;
    undrawn: number;
    ead: number;
    expectedLoss: number;
    rwa: number;
    weightedAvgPd: number;
  };
}

/* -------------------------------------------------------- stress scenarios */

export type ScenarioId = 'baseline' | 'adverse' | 'severe';

export interface StressSectorResult {
  sectorId: SectorId;
  ead: number;
  /** Stressed EAD-weighted PD, as a fraction. */
  weightedAvgPd: number;
  /** Stressed EAD-weighted LGD, as a fraction. */
  weightedAvgLgd: number;
  expectedLoss: number;
  rwa: number;
  /** Stressed EL less baseline EL, EUR. */
  expectedLossDelta: number;
  /** Stressed RWA less baseline RWA, EUR. */
  rwaDelta: number;
}

export interface StressScenario {
  id: ScenarioId;
  /** i18n key, e.g. `scenario.adverse`. */
  nameKey: string;
  /** i18n key for the one-line scenario narrative. */
  descriptionKey: string;
  /** Multiplier applied to every obligor PD (capped at 1). */
  pdMultiplier: number;
  /** Additive uplift applied to every obligor LGD (capped at 1). */
  lgdUplift: number;
  totals: {
    ead: number;
    expectedLoss: number;
    rwa: number;
    weightedAvgPd: number;
    weightedAvgLgd: number;
    expectedLossDelta: number;
    rwaDelta: number;
    /** rwa / ead, as a fraction. */
    rwaDensity: number;
  };
  bySector: StressSectorResult[];
}

/* -------------------------------------------------------- portfolio totals */

export interface PortfolioTotals {
  /** Always `REPORTING_DATE`. */
  reportingDate: string;
  reportingQuarter: string;
  currency: string;
  counterpartyCount: number;
  facilityCount: number;
  covenantCount: number;
  collateralCount: number;
  groupCount: number;
  limit: number;
  drawn: number;
  undrawn: number;
  ead: number;
  expectedLoss: number;
  rwa: number;
  /** EAD-weighted PD, as a fraction. */
  weightedAvgPd: number;
  /** EAD-weighted LGD, as a fraction. */
  weightedAvgLgd: number;
  /** drawn / limit, as a fraction. */
  utilisation: number;
  /** rwa / ead, as a fraction. */
  rwaDensity: number;
  /** expectedLoss / ead, as a fraction. */
  expectedLossRatio: number;
  /** Total net collateral value, EUR. */
  collateralNetValue: number;
  /** collateralNetValue / ead, as a fraction. */
  secureCoverage: number;
  watchlistCount: number;
  watchlistEad: number;
  signalCount: number;
  covenantBreachCount: number;
  covenantWatchCount: number;
  /** EAD booked to grades 8..10, EUR. */
  impairedEad: number;
}

/* ------------------------------------------------------------- the fixture */

export interface CreditRiskFixture {
  reportingDate: string;
  reportingQuarter: string;
  baseCurrency: string;
  /** Frozen FX rates: units of EUR per one unit of the key currency. */
  fxRates: Record<FacilityCurrency, number>;
  totals: PortfolioTotals;
  ratingScale: RatingGrade[];
  sectors: Sector[];
  counterparties: Counterparty[];
  facilities: Facility[];
  covenants: Covenant[];
  collateral: Collateral[];
  ratingHistory: RatingObservation[];
  watchlist: WatchlistSignal[];
  groups: Group[];
  scenarios: StressScenario[];
}
