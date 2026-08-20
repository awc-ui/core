export * from './components';
export { flipRows, captureFlip } from './utils/flip';

// Form controller — conditional / cross-field / chained / async validation on
// top of the native constraint API. Exported like flip: a utility a consumer
// must be able to import by name, not a component.
export { createFormController, FormController } from './utils/form-controller';
export type {
  FormValues,
  ValidateResult,
  FieldRule,
  FormControllerConfig,
  FormValidationResult,
} from './utils/form-controller';
export type { FlipOptions } from './utils/flip';

/*
 * Chart types a consumer needs to NAME, not just pass.
 *
 * Stencil's generated `components.d.ts` re-exports only the types written
 * directly in a @Prop / @Event signature. Anything reachable just THROUGH one
 * of those — the shape of `xAxis.bands`, the argument a `tooltipRenderer`
 * receives, the members of a datum — never reaches the entry, so
 * `import type { MdChartAxisBand } from '@awc-ui/core'` failed even though
 * the prop accepting it was fully typed. These make them nameable.
 */
export type {
  MdChartAlignedValue,
  MdChartAxisBand,
  MdChartAxisBreak,
  MdChartAxisBreakOptions,
  MdChartAxisBreaks,
  MdChartAxisSeriesValue,
  MdChartAxisValue,
  MdChartDatum,
  MdChartLineStyle,
  MdChartMissingFormatter,
  MdChartRangeDatum,
  MdChartScaleType,
  MdChartSummaryLabels,
  MdChartSymbol,
  MdChartTheme,
  MdChartTooltipContent,
  MdChartTooltipContext,
  MdChartTooltipSeries,
  MdChartXYPoint,
  MdChartXYTuple,
} from './utils/charts';
