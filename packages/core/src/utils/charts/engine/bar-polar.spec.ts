/*
 * Chart engine — polar (radial) bar chart
 * =======================================
 * Each ring's stacked segments blend into one band (flat internal joins), only
 * the ring's head + tail are round-capped, and the intro DRAWS each ring from
 * nothing to its end along a fixed radius (rather than blooming a pie's wedges
 * out from the centre).
 */
import { computeBarLayout, type BarChartSpec } from './bar-layout';
import { easeScene } from './animate';
import { renderHover } from './hover';
import { sliceAt, emphasizePolar } from './bar-chart';
import type { EngineTheme } from './layout';
import type { RenderScene } from './scene';

const theme: EngineTheme = { background: 'transparent', textColor: '#1C1B1F', textColorMuted: '#49454F', axisLineColor: '#79747E', gridLineColor: '#CAC4D0', surface: '#FFFBFE', fontFamily: 'Roboto', labelSize: 11, titleSize: 14 };

const polarSpec = (): BarChartSpec => ({
  series: [
    { label: 'Gold', color: '#E5C100', data: [10, 8], hidden: false },
    { label: 'Silver', color: '#B0B0B0', data: [8, 6], hidden: false },
    { label: 'Bronze', color: '#B08040', data: [6, 4], hidden: false },
  ],
  categories: ['USA', 'China'],
  categoryFormatter: (v) => String(v),
  valueScale: 'value',
  valueFormatter: (v) => String(v),
  stack: 'normal',
  horizontal: false,
  polar: true,
  categoryGapRatio: 0.3,
  barGapRatio: 0.2,
  cornerRadius: 6,
  showLabels: false,
});

const sweptLen = (scene: RenderScene): number => scene.slices.reduce((n, sl) => n + Math.abs(sl.endAngle - sl.startAngle), 0);

describe('polar (radial) bar chart', () => {
  it('draws each segment as a pill band and round-caps only the ring ends', () => {
    const s = computeBarLayout(polarSpec(), theme, 400, 400);
    expect(s.polar).toBe(true);
    expect(s.slices.length).toBe(6); // 3 series × 2 rings
    expect(s.slices.every((sl) => sl.pill)).toBe(true);
    for (const ring of [0, 1]) {
      const rs = s.slices.filter((sl) => sl.dataIndex === ring);
      // Exactly one head + one tail cap; every internal join stays flat.
      expect(rs.filter((sl) => sl.capStart).length).toBe(1);
      expect(rs.filter((sl) => sl.capEnd).length).toBe(1);
      const head = rs.reduce((a, b) => (b.startAngle < a.startAngle ? b : a));
      const tail = rs.reduce((a, b) => (b.endAngle > a.endAngle ? b : a));
      expect(head.capStart).toBe(true);
      expect(tail.capEnd).toBe(true);
    }
  });

  it('MEASUREMENT: sweeps each ring from nothing to its end at a fixed radius', () => {
    const s = computeBarLayout(polarSpec(), theme, 400, 400);
    const full = sweptLen(s);
    expect(sweptLen(easeScene(s, 0))).toBeLessThan(1e-6); // nothing at t=0
    expect(sweptLen(easeScene(s, 1))).toBeCloseTo(full, 4); // whole ring at t=1
    const mid = sweptLen(easeScene(s, 0.5));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(full);
    // Radius never changes — it draws along the line, not bloomed from the centre.
    const at = easeScene(s, 0.5).slices[0];
    expect(at.outerR).toBeCloseTo(s.slices[0].outerR, 6);
    expect(at.innerR).toBeCloseTo(s.slices[0].innerR, 6);
  });

  it('wraps the value scale around the outside of the rings', () => {
    const s = computeBarLayout(polarSpec(), theme, 500, 500);
    const ticks = s.texts.filter((t) => t.key?.startsWith('vt-'));
    expect(ticks.length).toBeGreaterThan(2);
    // The 0 tick sits at 12 o'clock — centred on x, above the centre.
    const zero = ticks.find((t) => parseFloat(t.text) === 0)!;
    expect(zero).toBeTruthy();
    const cx = s.plot.x + s.plot.width / 2;
    const cy = s.plot.y + s.plot.height / 2;
    expect(Math.abs(zero.x - cx)).toBeLessThan(2);
    expect(zero.y).toBeLessThan(cy);
  });

  it('hit-tests the exact segment and misses the hole / gaps (tooltip gating)', () => {
    const s = computeBarLayout(polarSpec(), theme, 500, 500);
    const cx = s.plot.x + s.plot.width / 2;
    const cy = s.plot.y + s.plot.height / 2;
    const seg = s.slices[0];
    // A point at the segment's own mid-radius / mid-angle lands ON it.
    const midR = (seg.innerR + seg.outerR) / 2;
    const midA = (seg.startAngle + seg.endAngle) / 2;
    const hit = sliceAt(s.slices, cx + midR * Math.cos(midA), cy + midR * Math.sin(midA));
    expect(hit).toBe(seg);
    // The centre (hole) hits nothing — so no tooltip there.
    expect(sliceAt(s.slices, cx, cy)).toBeNull();
    // Far outside the rings hits nothing.
    expect(sliceAt(s.slices, cx + 10000, cy)).toBeNull();
  });

  it('spotlights the hovered segment by fading the others toward the surface', () => {
    const s = computeBarLayout(polarSpec(), theme, 500, 500);
    const seg = s.slices[2];
    // Full dim on every OTHER segment, none on the hovered one.
    const dim = new Map<string, number>();
    for (const sl of s.slices) dim.set(`${sl.dataIndex}:${sl.seriesIndex}`, sl.dataIndex === seg.dataIndex && sl.seriesIndex === seg.seriesIndex ? 0 : 1);
    const em = emphasizePolar(s, dim, '#FFFFFF');
    const hovered = em.slices.find((sl) => sl.dataIndex === seg.dataIndex && sl.seriesIndex === seg.seriesIndex)!;
    expect(hovered.color).toBe(seg.color); // hovered keeps full colour
    // Every other segment is dimmed (colour changed toward the surface).
    for (const sl of em.slices) {
      if (sl === hovered) continue;
      const orig = s.slices.find((o) => o.dataIndex === sl.dataIndex && o.seriesIndex === sl.seriesIndex)!;
      expect(sl.color).not.toBe(orig.color);
    }
  });

  it('hover shows no dot markers and anchors the tooltip to the cursor', () => {
    const s = computeBarLayout(polarSpec(), theme, 400, 400);
    const layer = document.createElement('div');
    const cursor = { x: 60, y: 60 };
    renderHover(layer, s, 0, (v) => String(v), 'Roboto', cursor, 'none');
    const tip = layer.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tip).toBeTruthy();
    // No crosshair (radial) and no dot markers — the card is the ONLY child.
    expect(layer.children.length).toBe(1);
    expect(layer.firstElementChild).toBe(tip);
    // The card sits right by the pointer, not out at a ring radius.
    expect(parseFloat(tip.style.left)).toBeGreaterThan(cursor.x);
    expect(parseFloat(tip.style.left)).toBeLessThan(cursor.x + 30);
    expect(parseFloat(tip.style.top)).toBeGreaterThan(cursor.y);
    expect(parseFloat(tip.style.top)).toBeLessThan(cursor.y + 30);
  });
});
