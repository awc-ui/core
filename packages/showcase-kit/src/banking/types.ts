/**
 * Domain model for the "Vela — Money & Investing" showcase vertical.
 *
 * A consumer neobank: several currency accounts, cards you can freeze, a
 * statement, budgets, an exchange desk and a small investing account. Where the
 * other two verticals model an institution looking at its clients, this one
 * models a person looking at their own money — which is why almost every figure
 * here is signed, and why the base currency is a preference rather than a
 * reporting standard.
 *
 * Everything is a plain, serialisable value. There is no runtime clock and no
 * randomness: the fixture is generated once at authoring time from a seeded
 * PRNG (`scripts/generate-banking-fixture.mjs`) and baked into `generated.ts`,
 * so every framework build renders byte-identical numbers.
 *
 * THE SAME THREE CONVENTIONS the credit-risk and wealth fixtures use:
 *
 *   1. Every ratio is a FRACTION. `0.0135` means 1.35%. Pass them straight to
 *      `t.formatPercent()`, which multiplies by 100 itself.
 *   2. Every date is an ISO calendar date, `YYYY-MM-DD`, with no time zone.
 *      Format them through `t.formatDate()`, which is pinned to UTC. A
 *      transaction additionally carries a `timestamp` that is a full UTC
 *      instant, because a statement orders within a day.
 *   3. Every enum-ish value carries a `…Key` twin (`status` / `statusKey`) that
 *      resolves through the shared dictionary. Render the key, never the raw
 *      value — the raw value is for logic and for `status.ts`.
 *
 * ONE CONVENTION THIS VERTICAL ADDS, and the screens depend on it:
 *
 *   4. MONEY OUT IS NEGATIVE. A card purchase is `-42.5`, salary is `+3200`.
 *      Nothing in a screen may flip a sign to make a figure "read better" — a
 *      spend total is the sum of the negatives and is itself negative, and the
 *      places that want it as a positive magnitude (a budget bar, a category
 *      ring) say so by calling `Math.abs` on the kit's own aggregate rather
 *      than by the fixture lying about direction.
 *
 * Money: a `Transaction` is denominated in its ACCOUNT's currency and carries
 * an `amountEur` twin. Every aggregate, every budget and every portfolio figure
 * is in EUR. That split is the point of the exchange screen: an account in GBP
 * holds GBP, and only the roll-up converts.
 */

/* --------------------------------------------------------------- constants */

/**
 * Frozen reporting date — the last day of the statement month.
 *
 * A month END rather than a mid-month date, because this vertical's headline
 * figures are "spent this month" and "income this month". Mid-month they would
 * be partial, and a reader comparing them against the previous month would be
 * comparing three weeks against four without being told.
 */
export const REPORTING_DATE = '2026-08-31';

/** The statement month every "this month" figure covers. */
export const REPORTING_MONTH = '2026-08';

/** The account whose currency headline figures roll up into. */
export const BASE_CURRENCY = 'EUR';

/** Months of statement history the fixture carries, ending at the reporting month. */
export const STATEMENT_MONTHS = 12;

/** Daily price points baked onto every instrument, ending at the reporting date. */
export const PRICE_HISTORY_DAYS = 90;

/** Daily rate points baked onto every exchange pair. */
export const RATE_HISTORY_DAYS = 90;

/* ------------------------------------------------------------------ unions */

/**
 * The four currencies the account set covers. EUR is the base.
 *
 * RON is in the list deliberately: the showcase ships a Romanian locale, and a
 * currency whose symbol follows the amount and whose group separator differs
 * from the decimal one is the case a formatter gets wrong. It is not decoration
 * — the exchange screen quotes it.
 */
export type Currency = 'EUR' | 'USD' | 'GBP' | 'RON';

/** ISO 3166-1 alpha-2. Resolve the display name via `country.<code>`. */
export type CountryCode = 'AE' | 'DE' | 'ES' | 'FR' | 'GB' | 'NL' | 'RO' | 'US';

/** Subscription tier. Drives one badge and nothing else — no feature gating. */
export type PlanTier = 'standard' | 'plus' | 'metal';

/**
 * What an account is for.
 *
 * `vault` is a savings pot with a goal attached; `savings` is an interest
 * account without one. The distinction earns its place because the home screen
 * renders a vault with progress and a savings account with a rate.
 */
export type AccountKind = 'current' | 'savings' | 'vault';

export type CardKind = 'physical' | 'virtual' | 'disposable';

/**
 * A card's lifecycle state.
 *
 * `frozen` is REVERSIBLE and is the one the card screen toggles; `blocked` is
 * terminal (reported lost). Keeping them apart is what lets the freeze control
 * be a switch rather than a dialog, and stops a blocked card offering a thaw.
 */
export type CardState = 'active' | 'frozen' | 'blocked';

export type CardNetwork = 'visa' | 'mastercard';

/** How money moved. Drives the icon and the row's leading glyph. */
export type TransactionType =
  | 'card'
  | 'transfer'
  | 'exchange'
  | 'topup'
  | 'atm'
  | 'fee'
  | 'refund'
  | 'dividend'
  | 'trade';

/**
 * Where a transaction is in its life.
 *
 * `pending` matters to the arithmetic, not just the badge: a pending card
 * authorisation is already deducted from the available balance and is NOT in
 * the settled statement total, which is why the home screen shows two numbers.
 */
export type TransactionStatus = 'completed' | 'pending' | 'reverted' | 'declined';

/**
 * Spending categories, the fixed set the analytics screen buckets into.
 *
 * `income`, `transfers` and `investing` are in the same union as `groceries`
 * because a statement row needs exactly one category and these three are what
 * the non-spending rows are. Every aggregate that means "spending" filters them
 * out through `isSpendCategory()` rather than by listing the others.
 */
export type Category =
  | 'groceries'
  | 'transport'
  | 'eatingOut'
  | 'shopping'
  | 'entertainment'
  | 'travel'
  | 'bills'
  | 'health'
  | 'cash'
  | 'transfers'
  | 'investing'
  | 'income';

/** How a budget is tracking. `near` is the amber band, not a rounding of `over`. */
export type BudgetStatus = 'under' | 'near' | 'over';

export type InstrumentKind = 'stock' | 'etf' | 'crypto';

export type TradeSide = 'buy' | 'sell';

export type TradeStatus = 'filled' | 'pending' | 'cancelled';

/** How often a recurring payment charges. */
export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/* ----------------------------------------------------------------- records */

/** The account holder. One per fixture — this is a personal app. */
export interface Profile {
  id: string;
  name: string;
  /** Two letters for `md-avatar`'s `initials`, derived at generation time. */
  initials: string;
  plan: PlanTier;
  planKey: string;
  memberSince: string;
  country: CountryCode;
  /** The currency headline roll-ups are shown in. Always `BASE_CURRENCY` here. */
  baseCurrency: Currency;
}

/** One currency account. */
export interface Account {
  id: string;
  kind: AccountKind;
  kindKey: string;
  currency: Currency;
  /** SETTLED balance, in the account's own currency. */
  balance: number;
  /** Settled less pending authorisations — what is actually spendable. */
  available: number;
  balanceEur: number;
  /** Proper noun. Lives in the fixture, never in a dictionary. */
  nickname: string;
  iban: string;
  /** Exactly one account is primary; the home screen leads with it. */
  primary: boolean;
  /** Savings only, as a fraction. `null` on a current account. */
  interestRate: number | null;
  /** Vault only: what it is being saved for, and how far along. */
  goalName: string | null;
  goalTarget: number | null;
  goalFundedPct: number | null;
}

/** A card, physical or otherwise. */
export interface Card {
  id: string;
  accountId: string;
  kind: CardKind;
  kindKey: string;
  network: CardNetwork;
  /** Four digits as a string — leading zeros are real. */
  last4: string;
  state: CardState;
  stateKey: string;
  /** Proper noun, chosen by the holder ("Everyday", "Travel"). */
  label: string;
  expiry: string;
  /** Monthly spend cap in the account's currency. `null` = uncapped. */
  monthlyLimit: number | null;
  spentThisMonth: number;
  /** The three per-card switches the card screen renders. */
  contactless: boolean;
  onlinePayments: boolean;
  atmWithdrawals: boolean;
  /** Disposable cards only: regenerated after each use. */
  regeneratesAfterUse: boolean;
}

/** A place money was spent. Proper nouns, invented. */
export interface Merchant {
  id: string;
  name: string;
  category: Category;
  categoryKey: string;
  country: CountryCode;
  initials: string;
}

/** One line of the statement. */
export interface Transaction {
  id: string;
  accountId: string;
  /** `null` for anything that did not touch a card. */
  cardId: string | null;
  date: string;
  /** Full UTC instant — a statement orders within a day. */
  timestamp: string;
  merchantId: string | null;
  /** Whoever the money moved to or from, already a display string. */
  counterparty: string;
  type: TransactionType;
  typeKey: string;
  status: TransactionStatus;
  statusKey: string;
  category: Category;
  categoryKey: string;
  /** SIGNED, in the account's currency. Negative is money out. */
  amount: number;
  currency: Currency;
  /** The same movement in EUR, signed the same way. */
  amountEur: number;
  /** Set only on an `exchange` row: what the pair traded at. */
  fxRate: number | null;
  /** Free text the holder attached. Proper noun; usually `null`. */
  note: string | null;
}

/** A monthly cap on one category, and how it is tracking. */
export interface Budget {
  category: Category;
  categoryKey: string;
  /** POSITIVE magnitude in EUR — a cap is not a negative number. */
  monthlyLimit: number;
  /** Positive magnitude of what has gone out against it. */
  spent: number;
  remaining: number;
  /** `spent / monthlyLimit`, as a fraction. May exceed 1. */
  usedPct: number;
  status: BudgetStatus;
  statusKey: string;
}

/** One category's share of a month's spending. */
export interface CategorySpend {
  category: Category;
  categoryKey: string;
  /** Positive magnitude in EUR. */
  amountEur: number;
  /** Share of the month's total spending, as a fraction. */
  share: number;
  transactionCount: number;
  /** The same category last month, for the change column. */
  previousAmountEur: number;
  /** Signed fraction. `null` when there was no spend last month to compare. */
  changePct: number | null;
}

/** Money in and out for one month. */
export interface MonthlyFlow {
  /** `YYYY-MM`. */
  month: string;
  /** Positive magnitude of everything that came in. */
  inEur: number;
  /** Positive magnitude of everything that went out. */
  outEur: number;
  /** `inEur - outEur`, signed. */
  netEur: number;
  /** Closing balance across all accounts at month end. */
  closingBalanceEur: number;
}

/** A quotable currency pair on the exchange desk. */
export interface FxPair {
  id: string;
  base: Currency;
  quote: Currency;
  /** Units of `quote` per one unit of `base`. */
  rate: number;
  /** The spread the desk takes, in basis points. */
  spreadBps: number;
  /** Fee as a fraction of the traded amount. Zero on the plan's free pairs. */
  feePct: number;
  /** Signed fraction, rate today against thirty days ago. */
  thirtyDayChangePct: number;
}

/** One point on a pair's rate history. */
export interface RatePoint {
  date: string;
  rate: number;
}

/** One point on an instrument's price history, in the instrument's currency. */
export interface PricePoint {
  date: string;
  price: number;
}

/** Something that can be held. Stocks, ETFs and crypto share one shape. */
export interface Instrument {
  id: string;
  ticker: string;
  name: string;
  kind: InstrumentKind;
  kindKey: string;
  currency: Currency;
  /** Latest price, in the instrument's own currency. */
  price: number;
  priceEur: number;
  /** Signed fractions. */
  dayChangePct: number;
  weekChangePct: number;
  yearChangePct: number;
  /** `null` on crypto, which the fixture does not assign a sector. */
  sector: string | null;
  sectorKey: string | null;
  initials: string;
  /** Oldest first, `PRICE_HISTORY_DAYS` long. */
  history: PricePoint[];
}

/** A position in the investing account. */
export interface Holding {
  instrumentId: string;
  /** Fractional units are normal for both crypto and fractional shares. */
  quantity: number;
  /** What it cost, in EUR, all-in. */
  costBasisEur: number;
  marketValueEur: number;
  unrealisedPlEur: number;
  /** Signed fraction against cost. */
  unrealisedPlPct: number;
  /** Share of the portfolio's market value, as a fraction. */
  allocation: number;
  /** Signed EUR movement since the previous close. */
  dayChangeEur: number;
}

/** An instrument being watched but not held. */
export interface WatchItem {
  instrumentId: string;
  addedDate: string;
}

/** A buy or a sell in the investing account. */
export interface Trade {
  id: string;
  instrumentId: string;
  side: TradeSide;
  sideKey: string;
  quantity: number;
  /** Execution price in EUR. */
  priceEur: number;
  /** POSITIVE magnitude of the trade's value — the side carries direction. */
  amountEur: number;
  feeEur: number;
  status: TradeStatus;
  statusKey: string;
  date: string;
  timestamp: string;
}

/** A recurring charge the app has recognised. */
export interface Subscription {
  id: string;
  merchantId: string;
  /** Positive magnitude, in its own currency. */
  amount: number;
  currency: Currency;
  amountEur: number;
  cadence: Cadence;
  cadenceKey: string;
  nextChargeDate: string;
  /** A cancelled subscription stays in the list, greyed, until its term ends. */
  active: boolean;
  cardId: string | null;
}

/* ------------------------------------------------------------------ totals */

/**
 * The headline figures, computed once by the generator.
 *
 * Everything here is asserted consistent with the records it summarises — the
 * balances sum to `totalBalanceEur`, the holdings to `portfolioValueEur`, the
 * month's rows to `spentThisMonthEur`. A screen that recomputes one of these
 * from the records is computing the same number a second way, and the second
 * way is the one that drifts.
 */
export interface BankTotals {
  /** Settled, across every account. */
  totalBalanceEur: number;
  /** Settled less pending. */
  availableEur: number;
  savingsBalanceEur: number;
  portfolioValueEur: number;
  /** Accounts plus portfolio. */
  netWorthEur: number;
  /** POSITIVE magnitude of the reporting month's spending. */
  spentThisMonthEur: number;
  incomeThisMonthEur: number;
  /** Income less spending, signed. */
  netThisMonthEur: number;
  /** Spending against the previous month, signed fraction. */
  spendChangePct: number;
  previousMonthSpendEur: number;
  portfolioCostBasisEur: number;
  portfolioUnrealisedPlEur: number;
  /** Signed fraction against cost. */
  portfolioReturnPct: number;
  /** Signed EUR movement of the portfolio since the previous close. */
  portfolioDayChangeEur: number;
  budgetTotalEur: number;
  budgetSpentEur: number;
  budgetOverCount: number;
  budgetNearCount: number;
  /** Monthly cost of every active subscription, normalised to a month. */
  subscriptionMonthlyEur: number;
  activeSubscriptionCount: number;
  accountCount: number;
  cardCount: number;
  activeCardCount: number;
  frozenCardCount: number;
  transactionCount: number;
  /** Rows in the reporting month only. */
  monthTransactionCount: number;
  pendingCount: number;
  holdingCount: number;
  watchlistCount: number;
}

/* ------------------------------------------------------------- the fixture */

export interface BankingFixture {
  reportingDate: string;
  reportingMonth: string;
  baseCurrency: string;
  /** Frozen FX rates: units of EUR per one unit of the key currency. */
  fxRates: Record<Currency, number>;
  totals: BankTotals;
  profile: Profile;
  accounts: Account[];
  cards: Card[];
  merchants: Merchant[];
  transactions: Transaction[];
  budgets: Budget[];
  /** The reporting month, bucketed. */
  categorySpend: CategorySpend[];
  /** `STATEMENT_MONTHS` long, oldest first. */
  monthlyFlow: MonthlyFlow[];
  fxPairs: FxPair[];
  /** Keyed by `FxPair.id`, oldest first. */
  rateHistory: Record<string, RatePoint[]>;
  instruments: Instrument[];
  holdings: Holding[];
  watchlist: WatchItem[];
  trades: Trade[];
  subscriptions: Subscription[];
}
