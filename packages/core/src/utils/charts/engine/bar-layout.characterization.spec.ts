/**
 * CHARACTERIZATION snapshots for `computeBarLayout`.
 *
 * `computeBarLayout` is a large, pure `(spec, theme, w, h) → RenderScene`
 * function that produces pixel-exact geometry every visual feature depends on.
 * Before restructuring it, we pin its ENTIRE output across a representative
 * matrix of configs. A behaviour-preserving refactor (extracting helpers
 * without reordering arithmetic) must reproduce these snapshots byte-for-byte;
 * any diff is a regression, not an intended change.
 *
 * These are intentionally exhaustive (whole-scene) rather than asserting single
 * properties — that is what makes them a safety net for the refactor. The
 * focused behavioural assertions live in `bar-layout.spec.ts`.
 */
import { computeBarLayout, type BarChartSpec, type BarSeriesSpec } from './bar-layout';
import type { EngineTheme } from './layout';

const theme: EngineTheme = {
  background: 'transparent',
  textColor: '#1C1B1F',
  textColorMuted: '#49454F',
  axisLineColor: '#79747E',
  gridLineColor: '#CAC4D0',
  surface: '#FFFBFE',
  fontFamily: 'Roboto',
  labelSize: 11,
  titleSize: 14,
};

const S = (over: Partial<BarSeriesSpec> = {}): BarSeriesSpec => ({
  label: 'A',
  color: '#6750A4',
  data: [10, 20, 30, 15],
  hidden: false,
  ...over,
});

const base = (over: Partial<BarChartSpec> = {}): BarChartSpec => ({
  series: [S({ label: 'A', color: '#6750A4', data: [10, 20, 30, 15] }), S({ label: 'B', color: '#B3261E', data: [5, 15, 25, 20] })],
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  categoryFormatter: (v) => String(v),
  valueScale: 'value',
  valueFormatter: (v) => String(v),
  stack: 'none',
  horizontal: false,
  categoryGapRatio: 0.3,
  barGapRatio: 0.2,
  cornerRadius: 6,
  showLabels: false,
  ...over,
});

/** The full matrix: name → the spec that exercises a distinct code path. */
const CASES: Record<string, BarChartSpec> = {
  'grouped-vertical': base(),
  'stacked-vertical': base({ stack: 'normal' }),
  'percentage-vertical': base({ stack: 'percentage' }),
  'grouped-horizontal': base({ horizontal: true }),
  'stacked-horizontal': base({ horizontal: true, stack: 'normal' }),
  'labels-and-totals': base({ stack: 'normal', showLabels: true, showTotals: true }),
  'chevron-force': base({ stack: 'normal', chevron: true, valueAxisLine: false, axisTicks: true }),
  'value-min-max': base({ valueMin: -10, valueMax: 40 }),
  'negative-values': base({ series: [S({ data: [10, -20, 30, -15] }), S({ label: 'B', color: '#B3261E', data: [-5, 15, -25, 20] })] }),
  'rotated-labels': base({ categoryLabelRotation: -45, categoryLabel: 'Quarter', valueLabel: 'Revenue' }),
  'hidden-series': base({ series: [S({ hidden: true }), S({ label: 'B', color: '#B3261E', data: [5, 15, 25, 20] })] }),
  'value-breaks-auto': base({ series: [S({ data: [10, 12, 1200, 14] })], valueBreaks: 'auto' }),
  'dual-axis': base({
    series: [S({ label: 'Vol', data: [100, 200, 150, 180] }), S({ label: 'Rate', color: '#B3261E', data: [2, 4, 3, 5], axisIndex: 1 })],
    valueAxis2: { min: 0, max: 6, label: 'Rate', formatter: (v) => `${v}%` },
  }),
  'range-bars': base({ series: [S({ label: 'Temp', data: [], range: [[5, 12], [8, 18], [3, 9], [10, 22]] })] }),
  'variwide': base({ series: [S({ data: [10, 20, 30, 15], pointWidths: { 0: 1, 1: 2, 2: 3, 3: 1 } })] }),
  'point-colors': base({ series: [S({ data: [30, 10, 25, 20], pointColors: { 0: '#1B5E20', 1: '#B71C1C', 2: '#0D47A1', 3: '#E65100' } })] }),
  'overlay-series': base({ series: [S({ label: 'Bar', data: [10, 20, 30, 15] }), S({ label: 'Target', color: '#000', data: [12, 18, 28, 22], overlay: true, widthRatio: 0.5 })] }),
  'mirrored-category-labels': base({ horizontal: true, categoryLabelsMirrored: true }),
  'log-scale': base({ series: [S({ data: [1, 10, 100, 1000] })], valueScale: 'log' }),
  'polar': base({ polar: true }),
  'polar-tuned': base({ polar: true, polarHole: 0.4, polarSweep: 0.6, cornerRadius: 10 }),
  'polar-stacked': base({ polar: true, stack: 'normal' }),
  'compact-sparkline': base({ series: [S()], compact: true }),
  'no-legend': base({ legend: 'none' }),
};

describe('chart engine — computeBarLayout characterization', () => {
  for (const [name, spec] of Object.entries(CASES)) {
    it(`is stable: ${name}`, () => {
      expect(computeBarLayout(spec, theme, 480, 320)).toMatchSnapshot();
    });
  }

  // A second size proves the geometry is a pure function of the box, not tied to
  // one dimension — a common way a layout refactor silently breaks.
  it('is stable: grouped-vertical at a second size', () => {
    expect(computeBarLayout(base(), theme, 800, 200)).toMatchSnapshot();
  });
});
