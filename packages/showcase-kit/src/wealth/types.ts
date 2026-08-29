/**
 * Domain model for the "Kestrel Private Bank — Wealth Management Console"
 * showcase vertical.
 *
 * Everything here is a plain, serialisable value. There is no runtime clock and
 * no randomness: the fixture is generated once at authoring time from a seeded
 * PRNG (`scripts/generate-wealth-fixture.mjs`) and baked into `generated.ts`,
 * so every framework build renders byte-identical numbers.
 *
 * THREE CONVENTIONS, the same three the credit-risk fixture uses, and the
 * screens depend on all of them:
 *
 *   1. Every ratio is a FRACTION. `0.0135` means 1.35%; `ytdReturn: -0.021`
 *      means the mandate is down 2.1%. Pass them straight to
 *      `t.formatPercent()`, which multiplies by 100 itself.
 *   2. Every date is an ISO calendar date, `YYYY-MM-DD`, with no time zone.
 *      Format them through `t.formatDate()`, which is pinned to UTC. The audit
 *      trail additionally carries a `timestamp` that is a full UTC instant.
 *   3. Every enum-ish value carries a `…Key` twin (`strategy` /
 *      `strategyKey`) that resolves through the shared dictionary. Render the
 *      key, never the raw value — the raw value is for logic and for
 *      `status.ts`.
 *
 * Money: EUR is the reporting currency and every `*Eur` field, every aggregate
 * and every goal amount is in it. A `Position`, `Instrument` and `Order` also
 * carry a local `currency` with local `price` / `marketValue` / `estimatedValue`
 * amounts beside the EUR ones, so currency handling is genuinely exercised.
 */

/** Frozen reporting date. Every relative date in the fixture derives from this. */
export const REPORTING_DATE = '2026-06-30';

/** Reporting quarter label used in headers. */
export const REPORTING_QUARTER = '2026-Q2';

/** Base reporting currency for every aggregate value in the fixture. */
export const BASE_CURRENCY = 'EUR';

/** Months of performance history the fixture carries, ending at the reporting month. */
export const HISTORY_MONTHS = 24;

/** Months of price history baked onto every instrument. */
export const PRICE_HISTORY_MONTHS = 12;

/** The four currencies the book is exposed to. EUR is the base. */
export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';

/** ISO 3166-1 alpha-2. Resolve the display name via `country.<code>`. */
export type CountryCode = 'AE' | 'CH' | 'DE' | 'FR' | 'GB' | 'IT' | 'SE';

/* ---------------------------------------------------------------- advisor */

export interface Advisor {
  id: string;
  /** A proper noun — deliberately not translated. */
  name: string;
  /** i18n key, e.g. `advisor.title.senior`. */
  titleKey: string;
  /** Booking centre. A proper noun. */
  desk: string;
}

/* -------------------------------------------------------------- household */

/** How much discretion the bank holds over the mandate. */
export type Mandate = 'discretionary' | 'advisory' | 'execution-only';

/** The household's agreed appetite. Drives which strategy its portfolio runs. */
export type RiskProfile = 'defensive' | 'balanced' | 'growth' | 'dynamic';

/** Service tier. */
export type Segment = 'affluent' | 'private-wealth' | 'family-office';

/** Portfolio strategy. Each one has a fixed target allocation and a benchmark. */
export type Strategy = 'conservative' | 'balanced' | 'growth' | 'aggressive';

/** A household's standing is its weakest member's. */
export type KycStatus = 'verified' | 'review-due' | 'pending' | 'expired';

export interface Household {
  id: string;
  /** Family / entity group name. A proper noun — deliberately not translated. */
  name: string;
  domicile: CountryCode;
  riskProfile: RiskProfile;
  /** i18n key, e.g. `riskProfile.balanced`. */
  riskProfileKey: string;
  mandate: Mandate;
  mandateKey: string;
  segment: Segment;
  segmentKey: string;
  advisorId: string;
  /** Denormalised for table rendering; still a proper noun. */
  advisorName: string;
  /** The household's single portfolio. Every household in this book has one. */
  portfolioId: string;
  strategy: Strategy;
  strategyKey: string;
  /** Total assets under management, EUR. Equals the portfolio's market value. */
  totalAum: number;
  /** Uninvested cash inside the portfolio, EUR. */
  cashBalance: number;
  /** Share of the advisor's book, as a fraction. */
  aumShare: number;
  /** Member client ids, primary first. */
  memberIds: string[];
  memberCount: number;
  goalCount: number;
  /** Proposals not yet approved or rejected. */
  openProposalCount: number;
  positionCount: number;
  /** Unrealised profit and loss, EUR. */
  unrealisedPl: number;
  /** Year-to-date return of the household's portfolio, as a fraction. */
  ytdReturn: number;
  kycStatus: KycStatus;
  kycStatusKey: string;
  /** ISO `YYYY-MM-DD`. */
  onboardedDate: string;
  lastReviewDate: string;
  nextReviewDate: string;
  lastContactDate: string;
}

export type HouseholdSortKey =
  | 'name'
  | 'totalAum'
  | 'ytdReturn'
  | 'unrealisedPl'
  | 'memberCount'
  | 'nextReviewDate';

export interface HouseholdFilter {
  segment?: Segment;
  mandate?: Mandate;
  riskProfile?: RiskProfile;
  strategy?: Strategy;
  advisorId?: string;
  kycStatus?: KycStatus;
  /** Case-insensitive substring match against `name` and `id`. */
  search?: string;
  /** Default `'totalAum'`. */
  sortBy?: HouseholdSortKey;
  /** Default `'desc'` for numeric keys, `'asc'` for `name` and dates. */
  sortDir?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

/* ----------------------------------------------------------------- client */

export type ClientRole = 'primary' | 'spouse' | 'beneficiary' | 'trustee';

export type RiskTolerance = 'low' | 'medium' | 'high';

export interface Client {
  id: string;
  householdId: string;
  /** Denormalised for table rendering. */
  householdName: string;
  /** A proper noun — deliberately not translated. */
  name: string;
  role: ClientRole;
  roleKey: string;
  kycStatus: KycStatus;
  kycStatusKey: string;
  riskTolerance: RiskTolerance;
  riskToleranceKey: string;
  domicile: CountryCode;
  /** ISO `YYYY-MM-DD`. */
  dateOfBirth: string;
  /** Whole years at `REPORTING_DATE`. */
  age: number;
  /** Always an `example.invalid` address — this is a fixture. */
  email: string;
  /** Deliberately non-routable. */
  phone: string;
  isPrimary: boolean;
  /** ISO `YYYY-MM-DD`. In the past when `kycStatus` is `expired`. */
  kycReviewDate: string;
}

export interface ClientFilter {
  householdId?: string;
  role?: ClientRole;
  kycStatus?: KycStatus;
  riskTolerance?: RiskTolerance;
  search?: string;
  offset?: number;
  limit?: number;
}

/* -------------------------------------------------------------- portfolio */

export interface Portfolio {
  id: string;
  householdId: string;
  /** Mandate reference, e.g. `KPB-2201-BAL`. A proper noun. */
  reference: string;
  strategy: Strategy;
  strategyKey: string;
  benchmarkId: string;
  /** Benchmark name. A proper noun. */
  benchmarkName: string;
  /** Always `'EUR'` — the mandate's reporting currency. */
  currency: Currency;
  /** ISO `YYYY-MM-DD`. */
  inceptionDate: string;
  /** Uninvested cash, EUR. */
  cashBalance: number;
  /** Market value of the positions, EUR, excluding cash. */
  securitiesValue: number;
  /** `securitiesValue + cashBalance`, EUR. The number the client is quoted. */
  marketValue: number;
  /** Cost of the positions plus cash, EUR. */
  costBasis: number;
  /** `marketValue - costBasis`, EUR. */
  unrealisedPl: number;
  /** `marketValue / costBasis - 1`, as a fraction. */
  unrealisedPlPct: number;
  positionCount: number;
  /** Annual management fee, in basis points. */
  feeBps: number;
  lastRebalanceDate: string;
  nextReviewDate: string;
  /** Six months to the reporting date, as a fraction. Compounded, not summed. */
  ytdReturn: number;
  benchmarkYtdReturn: number;
  oneYearReturn: number;
  benchmarkOneYearReturn: number;
  /** The full 24 months the fixture carries. */
  twoYearReturn: number;
  benchmarkTwoYearReturn: number;
  /** Worst peak-to-trough over the history, as a NEGATIVE fraction. */
  maxDrawdown: number;
}

/* ------------------------------------------------------------- instrument */

export type InstrumentType = 'equity' | 'bond' | 'fund' | 'etf' | 'alternative';

/**
 * The five buckets an allocation is measured in. `cash` has no instrument —
 * it comes from `Portfolio.cashBalance`, which is why an allocation row exists
 * for it but no position ever carries it.
 */
export type AssetClass = 'equity' | 'fixed-income' | 'real-assets' | 'alternatives' | 'cash';

export type InstrumentSector =
  | 'technology'
  | 'healthcare'
  | 'industrials'
  | 'consumer'
  | 'energy'
  | 'utilities'
  | 'real-estate'
  | 'government'
  | 'corporate'
  | 'diversified'
  | 'infrastructure'
  | 'private-credit'
  | 'private-equity'
  | 'hedge-fund'
  | 'commodities';

export type Region = 'europe' | 'north-america' | 'asia-pacific' | 'emerging' | 'global';

export interface Instrument {
  id: string;
  /** Exchange ticker or short code. A proper noun. */
  ticker: string;
  /** Security name. A proper noun. */
  name: string;
  type: InstrumentType;
  typeKey: string;
  assetClass: AssetClass;
  assetClassKey: string;
  sector: InstrumentSector;
  sectorKey: string;
  region: Region;
  regionKey: string;
  currency: Currency;
  /** Last price in `currency`. */
  price: number;
  /** Move since the previous close, as a fraction. Can be negative. */
  dayChangePct: number;
  /** Twelve month-end closes in `currency`, oldest first. The last IS `price`. */
  priceSeries: number[];
  /** The month-end ISO dates `priceSeries` is observed on, oldest first. */
  priceSeriesDates: string[];
  /** Minimum tradeable increment. Bonds trade in 1,000 nominal. */
  lotSize: number;
  /** `priceSeries` last / first - 1, as a fraction. */
  twelveMonthReturn: number;
}

export interface InstrumentFilter {
  assetClass?: AssetClass;
  type?: InstrumentType;
  sector?: InstrumentSector;
  region?: Region;
  currency?: Currency;
  /** Case-insensitive substring match against `ticker`, `name` and `id`. */
  search?: string;
  /** Default `'ticker'`. */
  sortBy?: 'ticker' | 'name' | 'price' | 'dayChangePct' | 'twelveMonthReturn';
  sortDir?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

/* --------------------------------------------------------------- position */

export interface Position {
  id: string;
  portfolioId: string;
  /** Denormalised, so a book-wide holdings table needs no join. */
  householdId: string;
  instrumentId: string;
  /** Denormalised from the instrument. Proper nouns. */
  ticker: string;
  instrumentName: string;
  type: InstrumentType;
  typeKey: string;
  assetClass: AssetClass;
  assetClassKey: string;
  sector: InstrumentSector;
  sectorKey: string;
  region: Region;
  regionKey: string;
  /** The instrument's trading currency, not the mandate's. */
  currency: Currency;
  quantity: number;
  /** Last price in `currency`. */
  price: number;
  /** Average cost in `currency`. */
  costPerUnit: number;
  /** `quantity * price`, in `currency`. */
  marketValue: number;
  /** `quantity * costPerUnit`, in `currency`. */
  costBasis: number;
  /** `marketValue` converted at the frozen fixture FX rate. */
  marketValueEur: number;
  costBasisEur: number;
  /** `marketValueEur - costBasisEur`, EUR. Can be negative. */
  unrealisedPl: number;
  /** `marketValueEur / costBasisEur - 1`, as a fraction. */
  unrealisedPlPct: number;
  dayChangePct: number;
  /** `marketValueEur * dayChangePct`, EUR. */
  dayChangeEur: number;
  /** Share of the portfolio's market value, as a fraction. */
  weight: number;
  /** ISO `YYYY-MM-DD`. */
  openedDate: string;
}

export type PositionSortKey =
  | 'ticker'
  | 'instrumentName'
  | 'marketValueEur'
  | 'unrealisedPl'
  | 'unrealisedPlPct'
  | 'weight'
  | 'dayChangePct';

export interface PositionFilter {
  portfolioId?: string;
  householdId?: string;
  instrumentId?: string;
  assetClass?: AssetClass;
  type?: InstrumentType;
  sector?: InstrumentSector;
  region?: Region;
  currency?: Currency;
  /** Keep only positions at or above this EUR market value. */
  minMarketValue?: number;
  /** `true` keeps only positions in profit, `false` only those under water. */
  inProfit?: boolean;
  /** Case-insensitive substring match against `ticker`, `instrumentName` and `id`. */
  search?: string;
  /** Default `'marketValueEur'`. */
  sortBy?: PositionSortKey;
  /** Default `'desc'` for numeric keys, `'asc'` for the two name keys. */
  sortDir?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

/* ------------------------------------------------------------- allocation */

/** How far an asset class has drifted from its mandate target. */
export type AllocationStatus = 'in-band' | 'drifted' | 'breach';

export interface AllocationRow {
  /** `null` on a book-level row. */
  portfolioId: string | null;
  /** `null` on a book-level row. */
  householdId: string | null;
  assetClass: AssetClass;
  assetClassKey: string;
  /** The mandate's target, as a fraction of the portfolio. */
  targetWeight: number;
  /** What it actually is, as a fraction of the portfolio. */
  actualWeight: number;
  /** `actualWeight - targetWeight`. Positive is overweight. */
  drift: number;
  /** The same drift in basis points, rounded — the unit a rebalance desk uses. */
  driftBps: number;
  /** EUR to trade to return to target. NEGATIVE means sell. */
  rebalanceAmount: number;
  /** EUR held in this class. */
  marketValue: number;
  /** `in-band` under 2%, `drifted` under 5%, `breach` beyond it. */
  status: AllocationStatus;
}

/* ------------------------------------------------------------ performance */

export interface PerformancePoint {
  /** `null` on a book-level point. */
  portfolioId: string | null;
  /** `null` on a book-level point. */
  householdId: string | null;
  /** Month-end ISO date, `YYYY-MM-DD`. */
  date: string;
  /** e.g. `2026-Q2`. */
  quarter: string;
  /** Market value at the month end, EUR. */
  marketValue: number;
  /** Net contribution (positive) or withdrawal (negative) in the month, EUR. */
  netFlow: number;
  /** The month's return, as a fraction. Net of flows. */
  monthlyReturn: number;
  benchmarkMonthlyReturn: number;
  /** Compounded from the first point, as a fraction. */
  cumulativeReturn: number;
  cumulativeBenchmarkReturn: number;
  /** Peak-to-current, as a NEGATIVE fraction. Zero at a new high. */
  drawdown: number;
}

/** What `getPerformanceSeries` should measure. Omit everything for the book. */
export interface PerformanceScope {
  portfolioId?: string;
  householdId?: string;
}

/* ------------------------------------------------------------------ goals */

export type GoalType = 'retirement' | 'education' | 'property' | 'legacy' | 'liquidity';

export type Priority = 'high' | 'medium' | 'low';

/** `funded` is already there; the other three are projections at the target date. */
export type GoalStatus = 'funded' | 'on-track' | 'at-risk' | 'behind';

export interface Goal {
  id: string;
  householdId: string;
  /** Denormalised for table rendering. */
  householdName: string;
  type: GoalType;
  typeKey: string;
  priority: Priority;
  priorityKey: string;
  /** The member this objective is for, or `null` for a household-level one. */
  beneficiaryClientId: string | null;
  /** A proper noun, or `null`. */
  beneficiaryName: string | null;
  /** EUR. */
  targetAmount: number;
  /** ISO `YYYY-MM-DD`. */
  targetDate: string;
  /** Whole months from `REPORTING_DATE` to `targetDate`. */
  monthsRemaining: number;
  /** EUR already earmarked. */
  currentAmount: number;
  /** `currentAmount / targetAmount`, as a fraction. May exceed 1. */
  fundedPct: number;
  /** EUR added each month. */
  monthlyContribution: number;
  /** Annual growth used for the projection, as a fraction. From the risk profile. */
  assumedAnnualGrowth: number;
  /** EUR at `targetDate`: current amount grown, plus contributions compounded. */
  projectedAmount: number;
  /** `projectedAmount / targetAmount`, as a fraction. */
  projectedFundedPct: number;
  /** `max(0, targetAmount - projectedAmount)`, EUR. */
  projectedShortfall: number;
  /** `true` when `status` is `on-track` or `funded`. */
  onTrack: boolean;
  status: GoalStatus;
  statusKey: string;
  createdDate: string;
}

export interface GoalFilter {
  householdId?: string;
  type?: GoalType;
  priority?: Priority;
  status?: GoalStatus;
  /** `true` keeps only goals on track or funded. */
  onTrack?: boolean;
  /** Default `'targetDate'`. */
  sortBy?: 'targetDate' | 'targetAmount' | 'fundedPct' | 'priority';
  sortDir?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

/* -------------------------------------------------------------- proposals */

export type ProposalType = 'rebalance' | 'new-mandate' | 'cash-raise' | 'tax-harvest' | 'goal-funding';

export type ProposalStatus =
  | 'draft'
  | 'in-review'
  | 'compliance'
  | 'client-review'
  | 'approved'
  | 'rejected';

export type ProposalStepId =
  | 'drafting'
  | 'suitability'
  | 'compliance'
  | 'client-review'
  | 'execution';

/** Maps onto `md-step`'s own vocabulary through `status.ts`. */
export type StepState = 'complete' | 'current' | 'pending' | 'blocked';

export interface ProposalStep {
  id: ProposalStepId;
  /** i18n key, e.g. `proposalStep.compliance`. */
  nameKey: string;
  state: StepState;
  stateKey: string;
}

export interface Proposal {
  id: string;
  householdId: string;
  /** Denormalised for table rendering. */
  householdName: string;
  portfolioId: string;
  type: ProposalType;
  typeKey: string;
  status: ProposalStatus;
  statusKey: string;
  /** Index into `steps`. */
  currentStepIndex: number;
  /** Always the same five steps, in order; only their `state` differs. */
  steps: ProposalStep[];
  stepCount: number;
  completedStepCount: number;
  /** EUR the proposal moves. */
  estimatedValue: number;
  /** Estimated quarterly fee impact, EUR. */
  estimatedFeeImpact: number;
  advisorId: string;
  advisorName: string;
  createdDate: string;
  updatedDate: string;
  /** Whole days between `createdDate` and `REPORTING_DATE`. */
  daysOpen: number;
  /** `false` once approved or rejected. */
  open: boolean;
}

export interface ProposalFilter {
  householdId?: string;
  type?: ProposalType;
  status?: ProposalStatus;
  advisorId?: string;
  /** `true` keeps only proposals still in flight. */
  open?: boolean;
  /**
   * Keeps proposals raised at least this many days ago, by `daysOpen`.
   *
   * `daysOpen` counts from `createdDate` to `REPORTING_DATE` for EVERY row,
   * including ones already approved or rejected — so this is age since raised,
   * not time still open. Combine it with `open: true` for the other reading.
   */
  minDaysOpen?: number;
  /** Keeps proposals whose `estimatedValue` is at least this, in EUR. */
  minEstimatedValue?: number;
  offset?: number;
  limit?: number;
}

/* ----------------------------------------------------------------- orders */

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'stop-limit';

export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

export type OrderStatus =
  | 'draft'
  | 'staged'
  | 'submitted'
  | 'partially-filled'
  | 'filled'
  | 'cancelled'
  | 'rejected';

export interface Order {
  id: string;
  portfolioId: string;
  /** Denormalised. A proper noun. */
  portfolioReference: string;
  householdId: string;
  householdName: string;
  instrumentId: string;
  ticker: string;
  instrumentName: string;
  assetClass: AssetClass;
  assetClassKey: string;
  side: OrderSide;
  sideKey: string;
  quantity: number;
  orderType: OrderType;
  orderTypeKey: string;
  /** In `currency`. `null` on a market order. */
  limitPrice: number | null;
  /** The price the estimate was struck at: the limit, or the last price. */
  referencePrice: number;
  timeInForce: TimeInForce;
  timeInForceKey: string;
  /** The instrument's trading currency. */
  currency: Currency;
  /** `quantity * referencePrice`, in `currency`. */
  estimatedValue: number;
  /** The same amount converted at the frozen fixture FX rate. */
  estimatedValueEur: number;
  status: OrderStatus;
  statusKey: string;
  filledQuantity: number;
  /** In `currency`, or `null` when nothing has filled. */
  averageFillPrice: number | null;
  /** ISO `YYYY-MM-DD`. */
  createdDate: string;
  /** Full UTC instant, `YYYY-MM-DDTHH:MM:SSZ`. */
  createdAt: string;
  advisorId: string;
  advisorName: string;
  /** The proposal this order was raised under, or `null` for an ad-hoc ticket. */
  proposalId: string | null;
}

export interface OrderFilter {
  portfolioId?: string;
  householdId?: string;
  instrumentId?: string;
  side?: OrderSide;
  status?: OrderStatus;
  proposalId?: string;
  /** `true` keeps only `submitted` and `partially-filled`. */
  working?: boolean;
  /** The advisor who raised the order. */
  advisorId?: string;
  /**
   * `true` keeps only orders raised under a proposal, `false` only ad-hoc
   * tickets. Matches on whether `proposalId` is set, not on which one.
   */
  fromProposal?: boolean;
  search?: string;
  offset?: number;
  limit?: number;
}

/* --------------------------------------------------------------- activity */

export type ActivityAction =
  | 'order-placed'
  | 'order-filled'
  | 'proposal-created'
  | 'proposal-approved'
  | 'rebalance-executed'
  | 'kyc-updated'
  | 'goal-created'
  | 'client-contacted'
  | 'document-signed'
  | 'review-completed'
  | 'cash-received'
  | 'mandate-changed';

export type ActivityCategory =
  | 'trading'
  | 'advice'
  | 'compliance'
  | 'planning'
  | 'relationship'
  | 'operations';

export type EntityType = 'household' | 'client' | 'portfolio' | 'order' | 'proposal' | 'goal';

export interface Activity {
  id: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Full UTC instant, `YYYY-MM-DDTHH:MM:SSZ`. */
  timestamp: string;
  actorId: string;
  /** A proper noun. */
  actorName: string;
  action: ActivityAction;
  actionKey: string;
  category: ActivityCategory;
  categoryKey: string;
  householdId: string;
  householdName: string;
  targetType: EntityType;
  targetTypeKey: string;
  targetId: string;
  /** What to render for the target. A proper noun or an id. */
  targetLabel: string;
  /** Whole days before `REPORTING_DATE`. */
  daysAgo: number;
}

export interface ActivityFilter {
  householdId?: string;
  category?: ActivityCategory;
  action?: ActivityAction;
  targetType?: EntityType;
  actorId?: string;
  /** Keep only entries within this many days of the reporting date. */
  sinceDays?: number;
  offset?: number;
  limit?: number;
}

/* ---------------------------------------------------------- book  totals */

export interface BookTotals {
  /** Always `REPORTING_DATE`. */
  reportingDate: string;
  reportingQuarter: string;
  currency: string;
  /** The signed-in advisor. */
  advisorId: string;
  advisorName: string;
  householdCount: number;
  clientCount: number;
  portfolioCount: number;
  positionCount: number;
  instrumentCount: number;
  goalCount: number;
  proposalCount: number;
  openProposalCount: number;
  orderCount: number;
  /** `submitted` plus `partially-filled`. */
  workingOrderCount: number;
  activityCount: number;
  /** Total assets under management, EUR. */
  aum: number;
  cash: number;
  securitiesValue: number;
  costBasis: number;
  unrealisedPl: number;
  unrealisedPlPct: number;
  /** Six months to the reporting date, as a fraction. */
  ytdReturn: number;
  benchmarkYtdReturn: number;
  /** `ytdReturn - benchmarkYtdReturn`. Can be negative. */
  ytdExcessReturn: number;
  oneYearReturn: number;
  benchmarkOneYearReturn: number;
  /** Net contributions less withdrawals, EUR. */
  netNewMoneyYtd: number;
  netNewMoneyOneYear: number;
  /** The largest single household's share of the book, as a fraction. */
  largestHouseholdShare: number;
  goalsOnTrack: number;
  goalsAtRisk: number;
  goalTargetTotal: number;
  goalFundedTotal: number;
  /** Clients whose KYC is not `verified`. */
  kycReviewDueCount: number;
  driftBreachCount: number;
  driftedCount: number;
  /** Households whose next review falls within two months. */
  reviewsDueCount: number;
}

/* ------------------------------------------------------------- the fixture */

export interface WealthFixture {
  reportingDate: string;
  reportingQuarter: string;
  baseCurrency: string;
  /** Frozen FX rates: units of EUR per one unit of the key currency. */
  fxRates: Record<Currency, number>;
  totals: BookTotals;
  advisors: Advisor[];
  instruments: Instrument[];
  households: Household[];
  clients: Client[];
  portfolios: Portfolio[];
  positions: Position[];
  allocations: AllocationRow[];
  bookAllocation: AllocationRow[];
  performance: PerformancePoint[];
  bookPerformance: PerformancePoint[];
  goals: Goal[];
  proposals: Proposal[];
  orders: Order[];
  activity: Activity[];
}
