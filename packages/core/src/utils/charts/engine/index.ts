/* Public surface of the from-scratch chart engine (replacing ECharts). */
export { LineChartEngine, type EngineCallbacks } from './chart';
export { BarChartEngine } from './bar-chart';
export { computeBarLayout, type BarChartSpec, type BarSeriesSpec } from './bar-layout';
export { PieChartEngine } from './pie-chart';
export { computePieLayout, type PieChartSpec, type PieDatum } from './pie-layout';
export { hitTestScene, LINE_HIT_TOLERANCE, MARK_HIT_RADIUS, type AxisSeriesValue, type SceneHit } from './hit-test';
export { computeLayout } from './layout';
export type { LineChartSpec, LineSeriesSpec, EngineTheme, RefBand } from './layout';
export type { LegendItem, RenderScene, SceneBar, SceneSlice } from './scene';
export type { HoverOptions } from './hover';
// Colour maths the components need too (deriving a child slice's shade from
// its parent, for instance).
export { mixColor, withAlpha, parseColor } from './color';
