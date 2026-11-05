/*
 * Chart engine — polar (radial) bar chart, UNSTACKED series
 * =========================================================
 * Unstacked, the cartesian bar chart gives every visible series its own slot of
 * the category band (grouped bars). The polar form must do the same with radii:
 * each series gets its own sub-ring inside the category's ring. Drawn on one
 * shared radius instead, every series starts at 12 o'clock on the same band, so
 * a series is hidden under any longer series drawn after it, and the hit test
 * (first slice in the list wins) spotlights a segment the reader cannot see.
 */
import { computeBarLayout, type BarChartSpec } from './bar-layout';
import { sliceAt } from './bar-chart';
import type { EngineTheme } from './layout';
import type { SceneSlice } from './scene';

const theme: EngineTheme = { background: 'transparent', textColor: '#1C1B1F', textColorMuted: '#49454F', axisLineColor: '#79747E', gridLineColor: '#CAC4D0', surface: '#FFFBFE', fontFamily: 'Roboto', labelSize: 11, titleSize: 14 };

const spec = (over: Partial<BarChartSpec> = {}): BarChartSpec => ({
  series: [
    { label: 'Revenue', color: '#6750A4', data: [12, 19, 15], hidden: false },
    { label: 'Costs', color: '#7D5260', data: [8, 25, 13], hidden: false },
  ],
  categories: ['Jan', 'Feb', 'Mar'],
  categoryFormatter: (v) => String(v),
  valueScale: 'value',
  valueFormatter: (v) => String(v),
  stack: 'none',
  horizontal: false,
  polar: true,
  categoryGapRatio: 0.3,
  barGapRatio: 0.2,
  cornerRadius: 6,
  showLabels: false,
  ...over,
});

const mid = (sl: SceneSlice) => {
  const a = (sl.startAngle + sl.endAngle) / 2;
  const r = (sl.innerR + sl.outerR) / 2;
  return [sl.cx + r * Math.cos(a), sl.cy + r * Math.sin(a)] as const;
};

describe('polar bar chart, unstacked series', () => {
  it('gives each visible series its own sub-ring inside the category ring, series 0 outermost', () => {
    const s = computeBarLayout(spec(), theme, 480, 480);
    const stacked = computeBarLayout(spec({ stack: 'normal' }), theme, 480, 480);
    for (const i of [0, 1, 2]) {
      const [a, b] = [0, 1].map((si) => s.slices.find((sl) => sl.dataIndex === i && sl.seriesIndex === si)!);
      // Disjoint radial bands: no series paints over another.
      expect(a.innerR).toBeGreaterThan(b.outerR);
      // Both inside the ring the category owns (the stacked chart's band).
      const ring = stacked.slices.find((sl) => sl.dataIndex === i)!;
      expect(a.outerR).toBeCloseTo(ring.outerR, 6);
      expect(b.innerR).toBeCloseTo(ring.innerR, 6);
      // The gap between sibling sub-rings is barGapRatio of a sub-ring.
      const sub = a.outerR - a.innerR;
      expect(b.outerR - b.innerR).toBeCloseTo(sub, 6);
      expect(a.innerR - b.outerR).toBeCloseTo(sub * 0.2, 6);
    }
  });

  it('hit-tests the segment actually drawn under the pointer', () => {
    const s = computeBarLayout(spec(), theme, 480, 480);
    for (const sl of s.slices) {
      const [x, y] = mid(sl);
      const hit = sliceAt(s.slices, x, y)!;
      expect([hit.dataIndex, hit.seriesIndex]).toEqual([sl.dataIndex, sl.seriesIndex]);
    }
  });

  it('round-caps the head and tail of every sub-ring', () => {
    const s = computeBarLayout(spec(), theme, 480, 480);
    for (const sl of s.slices) {
      expect(sl.capStart).toBe(true);
      expect(sl.capEnd).toBe(true);
    }
  });

  it('keeps the full ring for one visible series, and a hidden series reserves no sub-ring', () => {
    const one = computeBarLayout(spec({ series: [spec().series[0]] }), theme, 480, 480);
    const stacked = computeBarLayout(spec({ stack: 'normal' }), theme, 480, 480);
    const hidden = computeBarLayout(spec({ series: [spec().series[0], { ...spec().series[1], hidden: true }] }), theme, 480, 480);
    for (const i of [0, 1, 2]) {
      const ring = stacked.slices.find((sl) => sl.dataIndex === i)!;
      for (const s of [one, hidden]) {
        const sl = s.slices.find((x) => x.dataIndex === i)!;
        expect(sl.outerR).toBeCloseTo(ring.outerR, 6);
        expect(sl.innerR).toBeCloseTo(ring.innerR, 6);
      }
    }
  });

  it('leaves stacked rings unchanged: one band per category shared by its segments', () => {
    const s = computeBarLayout(spec({ stack: 'normal' }), theme, 480, 480);
    for (const i of [0, 1, 2]) {
      const rs = s.slices.filter((sl) => sl.dataIndex === i);
      expect(new Set(rs.map((sl) => sl.outerR)).size).toBe(1);
      expect(rs.filter((sl) => sl.capStart).length).toBe(1);
      expect(rs.filter((sl) => sl.capEnd).length).toBe(1);
    }
  });
});
