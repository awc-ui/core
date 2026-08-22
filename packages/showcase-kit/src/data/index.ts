/**
 * `@awc-ui/showcase-kit/data`
 *
 * The Aurelia Bank credit-risk fixture and its pure selectors.
 */
export { BASE_CURRENCY, REPORTING_DATE, REPORTING_QUARTER } from './types';

export type {
  Collateral,
  CollateralType,
  Counterparty,
  CounterpartyFilter,
  CounterpartySortKey,
  CountryCode,
  Covenant,
  CovenantDirection,
  CovenantName,
  CovenantStatus,
  CreditRiskFixture,
  Facility,
  FacilityCurrency,
  FacilityStatus,
  FacilityType,
  Group,
  GroupTree,
  GroupTreeNode,
  PortfolioTotals,
  RatingBand,
  RatingGrade,
  RatingLabel,
  RatingObservation,
  ScenarioId,
  Sector,
  SectorId,
  SignalSeverity,
  SignalType,
  StressScenario,
  StressSectorResult,
  WatchlistSignal,
} from './types';

export {
  getCollateralFor,
  getCounterparties,
  getCounterpartyById,
  getCovenants,
  getCovenantsFor,
  getFacilities,
  getFacilitiesFor,
  getFacilityById,
  getFixture,
  getFxRates,
  getGroups,
  getGroupTree,
  getPortfolioTotals,
  getRatingGrade,
  getRatingHistory,
  getRatingScale,
  getSectorById,
  getSectors,
  getStressScenarioById,
  getStressScenarios,
  getWatchlist,
  getWatchlistCounterparties,
} from './selectors';

/** Raw baked tables. Reach for the selectors first; these are the escape hatch. */
export {
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
