/**
 * `@awc-ui/showcase-kit/credit-risk`
 *
 * Everything the Credit Risk Console knows that is not a view: the derived
 * series behind every chart, the domain-value → component-vocabulary mapping,
 * and the shared route table.
 *
 * This exists so the six framework builds are genuinely only view layers. A
 * quarterly aggregate or a covenant's colour computed once here cannot drift
 * between ports, which means a screenshot of the React build and a screenshot
 * of the Svelte build are comparable evidence: any difference is the framework,
 * never the arithmetic.
 *
 * Framework-free by construction — no DOM, no component imports.
 */

export {
  drawdownSchedule,
  monthlyEadSeries,
  quarterlySeries,
  riskWeight,
  sectorCounterparties,
} from './derive';

export type { QuarterPoint, ScheduleRow } from './derive';

export {
  bandColor,
  covenantColor,
  covenantDot,
  facilityColor,
  facilityDot,
  severityColor,
  severityDot,
  utilisationColor,
  watchlistDot,
} from './status';

export type { MdColor, MdDotState } from './status';

export { createRoutes, FRAMEWORKS, route, SHOWCASE_BASE } from './routes';

export type { CreditRiskRoutes, Framework, RouteName } from './routes';

export { TABLES } from './tables';

export type { TableLayout } from './tables';
