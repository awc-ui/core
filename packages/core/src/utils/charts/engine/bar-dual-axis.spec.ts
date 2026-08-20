/*
 * Chart engine — dual-axis zero alignment
 * =======================================
 * A dual-axis bar chart must share ONE zero baseline: bars from either axis grow
 * from the same line, and a negative on either axis opens the same below-zero
 * band (kept inside the plot, not dangling off the bottom). The all-positive
 * axis is extended down to match, but still labels only its own range (no
 * nonsensical negative rainfall tick).
 */
import { computeBarLayout, type BarChartSpec } from './bar-layout';
import type { EngineTheme } from './layout';

const theme: EngineTheme = { background: 'transparent', textColor: '#1C1B1F', textColorMuted: '#49454F', axisLineColor: '#79747E', gridLineColor: '#CAC4D0', surface: '#FFFBFE', fontFamily: 'Roboto', labelSize: 11, titleSize: 14 };

const climate = (temp: number[]): BarChartSpec => ({
  series: [
    { label: 'Rain', color: '#5fa8f5', data: [49, 36, 47, 41, 53, 65, 81, 89, 90, 84, 73, 55], hidden: false },
    { label: 'Temp', color: '#f0a05a', axisIndex: 1, overlay: true, widthRatio: 0.34, data: temp, hidden: false },
  ],
  categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  categoryFormatter: (v) => String(v),
  valueScale: 'value',
  valueFormatter: (v) => String(v),
  stack: 'none',
  horizontal: false,
  categoryGapRatio: 0.34,
  barGapRatio: 0.2,
  cornerRadius: 4,
  showLabels: false,
  valueAxis2: { label: 'Temp', formatter: (v) => `${v}°` },
});

describe('dual-axis zero alignment', () => {
  const OSLO = [-4.3, -4.0, -0.2, 4.5, 10.8, 15.2, 16.4, 15.2, 10.8, 6.3, 0.7, -3.0];

  it('shares one zero baseline across both axes when the second axis has negatives', () => {
    const s = computeBarLayout(climate(OSLO), theme, 700, 460);
    const base = s.barBaseline!;
    const rain = s.bars.find((b) => b.seriesIndex === 0 && b.dataIndex === 6)!; // Jul rain (positive)
    const tPos = s.bars.find((b) => b.seriesIndex === 1 && b.dataIndex === 6)!; // Jul temp (positive)
    const tNeg = s.bars.find((b) => b.seriesIndex === 1 && b.dataIndex === 0)!; // Jan temp (negative)

    // Rain bottom, positive-temp bottom and negative-temp TOP all meet the one baseline.
    expect(rain.y + rain.h).toBeCloseTo(base, 1);
    expect(tPos.y + tPos.h).toBeCloseTo(base, 1);
    expect(tNeg.y).toBeCloseTo(base, 1);

    // The shared zero sits ABOVE the plot bottom — there is a below-zero band.
    expect(base).toBeLessThan(s.plot.y + s.plot.height - 1);
    // The negative temp bar stays inside the plot (does not dangle off the bottom).
    expect(tNeg.y + tNeg.h).toBeLessThanOrEqual(s.plot.y + s.plot.height + 0.5);
  });

  it('labels the below-zero band on the primary axis so it reads as a scale, not empty space', () => {
    const s = computeBarLayout(climate(OSLO), theme, 700, 460);
    const negRainTick = s.texts.find((t) => t.key?.startsWith('vt-') && parseFloat(t.text) < 0);
    expect(negRainTick).toBeDefined();
    // A gridline is emitted for that below-zero tick too.
    expect(s.gridlines.length).toBeGreaterThan(0);
    const tempTicks = s.texts.filter((t) => t.key?.startsWith('v2t-'));
    expect(tempTicks.length).toBeGreaterThan(0);
  });

  it('leaves an all-positive dual axis untouched (both zeros at the bottom)', () => {
    const s = computeBarLayout(climate([5, 6, 9, 14, 18, 21, 25, 26, 23, 18, 12, 8]), theme, 700, 460);
    // No negatives anywhere → zero is the plot bottom for both.
    expect(s.barBaseline!).toBeCloseTo(s.plot.y + s.plot.height, 1);
  });
});
