/*
 * Chart engine — bar value labels + per-point hover colour
 * ========================================================
 * Two regressions are pinned here:
 *
 *   1. `showLabels` value numbers must TRACK the bar as it grows in, not sit at
 *      the final tip while the bar animates into them. They are bound to their
 *      bar (`scene.barLabels`) and re-derived from its live geometry each frame,
 *      so easing the scene to t=0 (bars collapsed to the baseline) collapses the
 *      labels onto the baseline too.
 *
 *   2. The hover dot + tooltip swatch must use the colour of the BAR under the
 *      cursor (a per-category / bar-race palette via `pointColors`), not the
 *      series default.
 */
import { computeBarLayout, type BarChartSpec } from './bar-layout';
import type { EngineTheme } from './layout';
import { renderBarLabels } from './overlay';
import { renderHover } from './hover';
import { easeScene } from './animate';

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

const baseSpec = (over: Partial<BarChartSpec> = {}): BarChartSpec => ({
  series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30], hidden: false }],
  categories: ['Q1', 'Q2', 'Q3'],
  categoryFormatter: (v) => String(v),
  valueScale: 'value',
  valueFormatter: (v) => String(v),
  stack: 'none',
  horizontal: false,
  categoryGapRatio: 0.3,
  barGapRatio: 0.2,
  cornerRadius: 6,
  showLabels: true,
  ...over,
});

/** Pull a numeric px off an inline style, robust to the style-object impl. */
const px = (el: Element, prop: 'left' | 'top'): number => {
  const m = new RegExp(`${prop}:\\s*(-?[\\d.]+)px`).exec(el.getAttribute('style') ?? '');
  return m ? parseFloat(m[1]) : NaN;
};

describe('bar value labels — bound to bars, not to texts', () => {
  it('emits a barLabel per numeric bar and keeps them OUT of scene.texts', () => {
    const s = computeBarLayout(baseSpec({ horizontal: true }), theme, 400, 300);
    expect(s.barLabels?.length).toBe(3);
    // The static-text array must no longer carry the value labels (that is what
    // stranded them at the final tip during the intro).
    expect(s.texts.some((t) => t.key?.startsWith('bl-'))).toBe(false);
    // Each label references a real bar.
    for (const bl of s.barLabels ?? []) {
      expect(s.bars.some((b) => b.seriesIndex === bl.seriesIndex && b.dataIndex === bl.dataIndex)).toBe(true);
    }
  });

  it('positions a horizontal label just past the bar tip', () => {
    const s = computeBarLayout(baseSpec({ horizontal: true }), theme, 400, 300);
    const layer = document.createElement('div');
    renderBarLabels(layer, s, 'Roboto');
    const spans = Array.from(layer.children);
    expect(spans.length).toBe(3);
    // Longest bar (value 30) → rightmost tip → its label has the greatest left.
    const bar30 = s.bars.find((b) => b.dataIndex === 2)!;
    const lefts = spans.map((el) => px(el, 'left')).sort((a, b) => a - b);
    expect(Math.max(...lefts)).toBeCloseTo(bar30.x + bar30.w + 4, 0);
  });

  it('MEASUREMENT: horizontal labels ride out with the bar as it grows', () => {
    const s = computeBarLayout(baseSpec({ horizontal: true }), theme, 400, 300);
    const at = (e: number): number => {
      const layer = document.createElement('div');
      renderBarLabels(layer, easeScene(s, e), 'Roboto');
      // The label for the longest bar (dataIndex 2).
      const bar = easeScene(s, e).bars.find((b) => b.dataIndex === 2)!;
      const target = bar.x + bar.w + 4;
      const el = Array.from(layer.children).find((c) => Math.abs(px(c, 'left') - target) < 0.5)!;
      return px(el, 'left');
    };
    const start = at(0); // t=0 — bar collapsed onto the value baseline (plot left)
    const end = at(1); // t=1 — bar at full length
    // The label is near the baseline at the start and out at the tip at the end,
    // i.e. it MOVED with the bar rather than staying put.
    expect(start).toBeLessThan(end - 100);
    expect(end).toBeCloseTo(s.plot.x + s.bars.find((b) => b.dataIndex === 2)!.w + 4, 0);
    expect(start).toBeCloseTo((s.barBaseline ?? s.plot.x) + 4, 0);
  });

  it('MEASUREMENT: vertical labels ride up with the bar as it grows', () => {
    const s = computeBarLayout(baseSpec({ horizontal: false }), theme, 400, 300);
    const at = (e: number): number => {
      const eased = easeScene(s, e);
      const layer = document.createElement('div');
      renderBarLabels(layer, eased, 'Roboto');
      const bar = eased.bars.find((b) => b.dataIndex === 2)!;
      const target = bar.y - 4; // positive bar → label sits above the top
      const el = Array.from(layer.children).find((c) => Math.abs(px(c, 'top') - target) < 0.5)!;
      return px(el, 'top');
    };
    // A vertical positive bar grows UP, so its top (and label) moves to a SMALLER
    // y as it grows: the label starts low (near the baseline) and ends high.
    expect(at(0)).toBeGreaterThan(at(1) + 100);
  });

  it('centres a stacked-segment label inside the bar', () => {
    const s = computeBarLayout(baseSpec({ stack: 'normal', series: [
      { label: 'A', color: '#6750A4', data: [40, 40, 40], hidden: false },
      { label: 'B', color: '#B3261E', data: [40, 40, 40], hidden: false },
    ] }), theme, 400, 300);
    expect((s.barLabels ?? []).some((bl) => bl.inside)).toBe(true);
  });

  it('binds BOTH range edges to their bar so they open out from the baseline', () => {
    const s = computeBarLayout(
      baseSpec({ horizontal: true, series: [{ label: 'Temp', color: '#6750A4', data: [], range: [[-9.7, 9.4], [-3.5, 9.4]], hidden: false }] }),
      theme,
      400,
      300,
    );
    // Two labels per range bar (low + high), none left in texts.
    expect(s.barLabels?.length).toBe(4);
    expect(s.texts.some((t) => t.key?.startsWith('bl-'))).toBe(false);
    const forBar0 = (s.barLabels ?? []).filter((bl) => bl.dataIndex === 0);
    expect(forBar0.map((bl) => bl.atLowEnd).sort()).toEqual([false, true]);

    // MEASUREMENT: at t=0 both labels collapse onto the baseline (zero line);
    // at t=1 they sit at the bar's two ends — i.e. they rode out with it.
    const barAt = (e: number) => easeScene(s, e).bars.find((b) => b.dataIndex === 0)!;
    const labelLefts = (e: number): number[] => {
      const layer = document.createElement('div');
      renderBarLabels(layer, easeScene(s, e), 'Roboto');
      // Only bar 0's two labels (dataIndex 0); bar 1 is elsewhere.
      const b = barAt(e);
      return Array.from(layer.children)
        .map((el) => px(el, 'left'))
        .filter((l) => l >= b.x - 20 && l <= b.x + b.w + 20)
        .sort((a, z) => a - z);
    };
    const spread0 = labelLefts(0);
    const spread1 = labelLefts(1);
    // Collapsed at the start (both near the zero line), spread apart at the end.
    expect(spread1[spread1.length - 1] - spread1[0]).toBeGreaterThan(spread0[spread0.length - 1] - spread0[0] + 100);
  });

  it('binds a stack total to the outermost segment (bold, tracks the column top)', () => {
    const s = computeBarLayout(
      baseSpec({
        stack: 'normal',
        showLabels: false,
        showTotals: true,
        series: [
          { label: 'A', color: '#E5C100', data: [10, 10, 10], hidden: false },
          { label: 'B', color: '#B0B0B0', data: [30, 30, 30], hidden: false },
        ],
      }),
      theme,
      400,
      300,
    );
    const totals = (s.barLabels ?? []).filter((bl) => bl.fontWeight === 600);
    expect(totals.length).toBe(3); // one per category
    // Bound to series B (index 1) — the top segment (band tops at 40).
    expect(totals.every((bl) => bl.seriesIndex === 1)).toBe(true);
    expect(totals.every((bl) => bl.text === '40')).toBe(true);
    // Not left as a static `tot-` text.
    expect(s.texts.some((t) => t.key?.startsWith('tot-'))).toBe(false);

    // MEASUREMENT: the total rides UP with the growing column (smaller y at t=1).
    const topAt = (e: number): number => {
      const eased = easeScene(s, e);
      const layer = document.createElement('div');
      renderBarLabels(layer, eased, 'Roboto');
      const topSeg = eased.bars.find((b) => b.seriesIndex === 1 && b.dataIndex === 0)!;
      const target = topSeg.y - 4;
      const el = Array.from(layer.children).find((c) => Math.abs(px(c, 'top') - target) < 0.5)!;
      return px(el, 'top');
    };
    expect(topAt(0)).toBeGreaterThan(topAt(1) + 100);
  });
});

describe('per-point colour flows to the hover dot + tooltip swatch', () => {
  const coloredSpec = () =>
    baseSpec({
      horizontal: true,
      series: [{ label: 'Passengers', color: '#6750A4', data: [89, 72, 67], hidden: false, pointColors: { 0: '#4A90D9' } }],
    });

  it('carries the resolved bar colour on the hover point', () => {
    const s = computeBarLayout(coloredSpec(), theme, 400, 300);
    const byIndex = s.hoverPoints[0].byIndex;
    expect(byIndex[0].color).toBe('#4A90D9'); // overridden bar
    expect(byIndex[1].color).toBe('#6750A4'); // falls back to the series colour
  });

  it('paints the hover dot + swatch in the bar colour, not the series default', () => {
    const s = computeBarLayout(coloredSpec(), theme, 400, 300);
    const layer = document.createElement('div');
    renderHover(layer, s, 0, (v) => String(v), 'Roboto', { x: 300, y: 60 }, 'horizontal');
    const style = layer.innerHTML;
    // The per-bar colour appears (dot background + swatch background); the series
    // default must not be what the swatch/dot use.
    expect(style).toContain('#4A90D9');
    const tip = layer.querySelector('[part="tooltip"]')!;
    const swatch = tip.querySelector('span')!; // first row's colour swatch
    expect(swatch.getAttribute('style')).toContain('#4A90D9');
  });
});
