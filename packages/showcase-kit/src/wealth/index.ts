/**
 * `@awc-ui/showcase-kit/wealth`
 *
 * Everything the Kestrel Private Bank Wealth Management Console knows that is
 * not a view: the frozen fixture and its pure selectors, the derived series
 * behind every chart, the domain-value → component-vocabulary mapping, the
 * shared route table and the table column layouts.
 *
 * This exists so the framework builds are genuinely only view layers. A
 * roll-up or an allocation's colour computed once here cannot drift between
 * ports, which means a screenshot of the React build and a screenshot of the
 * Svelte build are comparable evidence: any difference is the framework, never
 * the arithmetic.
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
  HISTORY_MONTHS,
  PRICE_HISTORY_MONTHS,
  REPORTING_DATE,
  REPORTING_QUARTER,
} from './types';

export type {
  Activity,
  ActivityAction,
  ActivityCategory,
  ActivityFilter,
  Advisor,
  AllocationRow,
  AllocationStatus,
  AssetClass,
  BookTotals,
  Client,
  ClientFilter,
  ClientRole,
  CountryCode,
  Currency,
  EntityType,
  Goal,
  GoalFilter,
  GoalStatus,
  GoalType,
  Household,
  HouseholdFilter,
  HouseholdSortKey,
  Instrument,
  InstrumentFilter,
  InstrumentSector,
  InstrumentType,
  KycStatus,
  Mandate,
  Order,
  OrderFilter,
  OrderSide,
  OrderStatus,
  OrderType,
  PerformancePoint,
  PerformanceScope,
  Portfolio,
  Position,
  PositionFilter,
  PositionSortKey,
  Priority,
  Proposal,
  ProposalFilter,
  ProposalStatus,
  ProposalStep,
  ProposalStepId,
  ProposalType,
  Region,
  RiskProfile,
  RiskTolerance,
  Segment,
  StepState,
  Strategy,
  TimeInForce,
  WealthFixture,
} from './types';

/* -------------------------------------------------------------- selectors */

export {
  getActivity,
  getActivityFor,
  getAdvisor,
  getAdvisorById,
  getAdvisors,
  getAllocation,
  getAllocationFor,
  getBookAllocation,
  getBookTotals,
  getClientById,
  getClients,
  getClientsFor,
  getFixture,
  getFxRates,
  getGoalById,
  getGoals,
  getGoalsFor,
  getHouseholdById,
  getHouseholds,
  getInstrumentById,
  getInstrumentByTicker,
  getInstruments,
  getOrderById,
  getOrders,
  getPerformanceSeries,
  getPortfolioById,
  getPortfolioFor,
  getPortfolios,
  getPositionById,
  getPositions,
  getPositionsFor,
  getProposalById,
  getProposals,
  getProposalsFor,
  getWorkingOrders,
  PROPOSAL_AGEING_DAYS,
  PROPOSAL_HIGH_VALUE_EUR,
  toEur,
} from './selectors';

/* ------------------------------------------------------------------ derive */

export {
  assetClassTotals,
  bookHoldings,
  compound,
  concentration,
  currencyExposure,
  driftedMandates,
  goalProjection,
  goalSummary,
  growthOf100,
  orderEstimate,
  rebalanceSheet,
  regionTotals,
  returnWindow,
  returnWindows,
  tail,
  topMovers,
} from './derive';

export type {
  BookHolding,
  ClassTotal,
  Concentration,
  CurrencyExposure,
  DriftedMandate,
  GoalProjectionPoint,
  GoalSummary,
  GrowthPoint,
  Mover,
  OrderEstimate,
  RebalanceRow,
  RegionTotal,
  ReturnWindow,
} from './derive';

/* ------------------------------------------------------------------ status */

export {
  allocationColor,
  allocationDot,
  ASSET_CLASS_ORDER,
  ASSET_CLASS_PALETTE,
  assetClassColor,
  assetClassRole,
  driftColor,
  goalColor,
  goalDot,
  kycColor,
  kycDot,
  mandateColor,
  orderColor,
  orderDot,
  orderSideColor,
  plColor,
  plIcon,
  priorityColor,
  proposalColor,
  riskProfileColor,
  riskToleranceColor,
  segmentColor,
  stepState,
  strategyColor,
} from './status';

export type { MdColor, MdDotState, MdStepState } from './status';

/* ------------------------------------------------------------------ routes */

export {
  createRoutes,
  crumbsFor,
  DESTINATIONS,
  destinationFor,
  destinationIndex,
  FRAMEWORKS,
  route,
  SHOWCASE_BASE,
} from './routes';

export type { CrumbSpec, Destination, Framework, RouteName, WealthRoutes } from './routes';

/* ------------------------------------------------------------------ tables */

export { TABLES } from './tables';

export type { TableLayout } from './tables';
