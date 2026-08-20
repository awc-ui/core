/*
 * Chart engine — bar drill transition (split vs merge)
 * ====================================================
 * Drilling DOWN should read as the clicked column SPLITTING into its children:
 * each child keeps its own value-height and only slides + scales along the
 * category axis out of the parent's band. It must NOT grow from the axis (that
 * reads as a fresh chart arriving, not this one opening up — cf. the pie's
 * splitScene). Drilling UP (merge) keeps the grow-from-baseline motion.
 */
import { computeBarLayout, type BarChartSpec } from './bar-layout';
import type { EngineTheme } from './layout';
import { drillScene, emphasizedDecelerate } from './animate';

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

const spec = (over: Partial<BarChartSpec> = {}): BarChartSpec => ({
  series: [{ label: 'Pop', color: '#6750A4', data: [1425, 1417, 340, 275], hidden: false }],
  categories: ['China', 'India', 'Indonesia', 'Pakistan'],
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

describe('bar drill — down rises a fresh level from the baseline, cascading left-to-right', () => {
  it('never moves a bar sideways or shrinks its width — no thin/small bar at any frame', () => {
    const s = computeBarLayout(spec(), theme, 400, 300);
    for (const b of s.bars) {
      for (const t of [0, 0.3, 0.7, 1]) {
        const at = drillScene(s, 0, 0, t, true).bars.find((x) => x.dataIndex === b.dataIndex)!;
        expect(at.x).toBeCloseTo(b.x, 6); // x is the final slot the whole time
        expect(at.w).toBeCloseTo(b.w, 6); // full width the whole time
      }
    }
  });

  it('grows each bar from the baseline: flat at the start, full value-height at the end', () => {
    const s = computeBarLayout(spec(), theme, 400, 300);
    const first = s.bars.find((b) => b.dataIndex === 0)!; // no stagger lag → clean 0→full
    const a0 = drillScene(s, 0, 0, 0, true).bars.find((b) => b.dataIndex === 0)!;
    const a1 = drillScene(s, 0, 0, 1, true).bars.find((b) => b.dataIndex === 0)!;
    expect(a0.h).toBeCloseTo(0, 6); // starts flat at the baseline
    expect(a1.h).toBeCloseTo(first.h, 6); // ends at its value height
    expect(a1.h).toBeLessThanOrEqual(first.h + 0.001); // clamped: never overshoots past its value
  });

  it('cascades left-to-right — mid-drill an earlier category has grown MORE than a later one', () => {
    const s = computeBarLayout(spec(), theme, 400, 300);
    const mid = drillScene(s, 0, 0, 0.4, true);
    const grown = (di: number): number => {
      const now = mid.bars.find((b) => b.dataIndex === di)!;
      const fin = s.bars.find((b) => b.dataIndex === di)!;
      return fin.h > 0 ? now.h / fin.h : 0; // fraction of final height reached
    };
    expect(grown(0)).toBeGreaterThan(grown(3)); // first category leads the last
  });

  it('MERGE (up) grows from the baseline as ONE block — height 0 at t=0, no stagger', () => {
    const s = computeBarLayout(spec(), theme, 400, 300);
    const m0 = drillScene(s, s.plot.x, s.plot.width, 0, false).bars.find((b) => b.dataIndex === 0)!;
    expect(m0.h).toBeCloseTo(0, 6);
    const m1 = drillScene(s, s.plot.x, s.plot.width, 1, false).bars.find((b) => b.dataIndex === 0)!;
    expect(m1.h).toBeCloseTo(s.bars.find((b) => b.dataIndex === 0)!.h, 6);
    // Up has no stagger: every category is at the same growth fraction at a given t.
    const mid = drillScene(s, s.plot.x, s.plot.width, 0.5, false);
    const frac = (di: number) => mid.bars.find((b) => b.dataIndex === di)!.h / s.bars.find((b) => b.dataIndex === di)!.h;
    expect(frac(0)).toBeCloseTo(frac(3), 6);
  });

  it('rises on the SAME emphasized-decelerate curve as the chart intro', () => {
    const s = computeBarLayout(spec(), theme, 400, 300);
    const fin = s.bars.find((b) => b.dataIndex === 0)!;
    // UP has no stagger, so a bar's growth fraction at t is the raw intro ease —
    // the drilled level rises exactly like a freshly-entering chart.
    for (const t of [0.2, 0.5, 0.8]) {
      const b = drillScene(s, s.plot.x, s.plot.width, t, false).bars.find((x) => x.dataIndex === 0)!;
      expect(b.h / fin.h).toBeCloseTo(emphasizedDecelerate(t), 5);
    }
  });
});
