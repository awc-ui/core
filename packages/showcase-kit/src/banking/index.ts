/**
 * `@awc-ui/showcase-kit/banking`
 *
 * Everything the Vela Money & Investing app knows that is not a view: the
 * frozen fixture and its pure selectors, the derived series behind every chart,
 * the domain-value → component-vocabulary mapping, the shared route table and
 * the table column layouts.
 *
 * This exists so the framework builds are genuinely only view layers. A roll-up
 * or a category's colour computed once here cannot drift between ports, which
 * means a screenshot of the React build and a screenshot of the Svelte build
 * are comparable evidence: any difference is the framework, never the
 * arithmetic.
 *
 * Framework-free by construction — no DOM, no component imports.
 *
 * IF YOU ARE WRITING A SCREEN: everything you need is exported from this one
 * module. Import nothing from `./generated` and write no arithmetic in a
 * component — if the number you want is not here, it belongs in `derive.ts`.
 */

/* ------------------------------------------------------------- the fixture */

export {
  BASE_CURRENCY,
  PRICE_HISTORY_DAYS,
  RATE_HISTORY_DAYS,
  REPORTING_DATE,
  REPORTING_MONTH,
  STATEMENT_MONTHS,
} from './types';

export type {
  Account,
  AccountKind,
  BankTotals,
  BankingFixture,
  Budget,
  BudgetStatus,
  Cadence,
  Card,
  CardKind,
  CardNetwork,
  CardState,
  Category,
  CategorySpend,
  CountryCode,
  Currency,
  FxPair,
  Holding,
  Instrument,
  InstrumentKind,
  Merchant,
  MonthlyFlow,
  PlanTier,
  PricePoint,
  Profile,
  RatePoint,
  Subscription,
  Trade,
  TradeSide,
  TradeStatus,
  Transaction,
  TransactionStatus,
  TransactionType,
  WatchItem,
} from './types';

/* -------------------------------------------------------------- selectors */

export {
  getAccountById,
  getAccounts,
  getBudgetFor,
  getBudgets,
  getCardById,
  getCards,
  getCategorySpend,
  getFixture,
  getFxPairById,
  getFxPairFor,
  getFxPairs,
  getFxRates,
  getHoldingFor,
  getHoldings,
  getInstrumentById,
  getInstruments,
  getMerchantById,
  getMerchants,
  getMonthTransactions,
  getMonthlyFlow,
  getPrimaryAccount,
  getProfile,
  getRateHistory,
  getSpendingAccounts,
  getSubscriptionById,
  getSubscriptions,
  getTotals,
  getTrades,
  getTransactionById,
  getTransactions,
  getWatchlist,
  isSpendCategory,
} from './selectors';

export type {
  CardFilter,
  InstrumentFilter,
  TradeFilter,
  TransactionFilter,
  TransactionSortKey,
} from './selectors';

/* ------------------------------------------------------------ derivations */

export {
  accountSummaries,
  balanceSeries,
  budgetOverall,
  budgetRows,
  categoryRing,
  categoryTrend,
  convert,
  flowSeries,
  headlines,
  holdingRows,
  portfolioRing,
  portfolioSeries,
  priceSeries,
  quote,
  rateSeries,
  spendSeries,
  statementDays,
  topMerchants,
  tradeEstimate,
  uncappedCategories,
  upcomingCharges,
  watchlistRows,
} from './derive';

export type {
  AccountSummary,
  BalancePoint,
  FlowPoint,
  Headline,
  HoldingRow,
  MerchantSpend,
  Quote,
  RingSlice,
  StatementDay,
  UpcomingCharge,
} from './derive';

/* --------------------------------------------------- component vocabulary */

export {
  budgetColor,
  budgetDot,
  cardStateColor,
  cardStateDot,
  categoryColor,
  categoryIcon,
  flowColor,
  instrumentKindColor,
  plColor,
  tradeSideColor,
  tradeStatusColor,
  txnStatusColor,
  txnStatusDot,
  txnTypeIcon,
} from './status';

export type { MdColor, MdDotState } from './status';

/* ------------------------------------------------------ routes and tables */

export {
  DESTINATIONS,
  FRAMEWORKS,
  SHOWCASE_BASE,
  crumbsFor,
  destinationFor,
  destinationIndex,
  route,
} from './routes';

export type { CrumbSpec, Destination, Framework, RouteName } from './routes';

export { TABLES } from './tables';
export type { TableLayout } from './tables';
