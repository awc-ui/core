/*
 * Regression tests for the chart-engine review fixes.
 * Each block pins a bug the adversarial review surfaced so it can't recur.
 */
import { computeDomain, niceLinearTicks, makeLogScale } from './scale';
import { stackSeries, splitRuns, markerPolygon } from './geometry';
import { computeBarLayout, type BarChartSpec } from './bar-layout';
import { computePieLayout, type PieChartSpec } from './pie-layout';
import { computeLayout, titlePlacement, type LineChartSpec, type EngineTheme } from './layout';
import { parseColor, withAlpha } from './color';
import { emphasizeScene } from './emphasis';
import { fontFamilyOf } from '../theme';
import { easeScene, expressiveEase, easeOutCubic, easeInOutCubic, revealScene, staggerReveal, stepAnimation, resolveIntro, INTRO_MS, cubicBezier, emphasizedDecelerate } from './animate';

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

describe('computeDomain', () => {
  it('preserves an explicit min/max through includeZero (does not clamp to 0)', () => {
    expect(computeDomain([60, 70, 80, 90], { min: 50, scale: 'value', includeZero: true })).toEqual([50, 90]);
    expect(computeDomain([-40, -20, -10], { max: -5, scale: 'value', includeZero: true })).toEqual([-40, -5]);
  });

  it('still zero-anchors a DATA-derived bound when includeZero is set', () => {
    expect(computeDomain([60, 70, 80, 90], { scale: 'value', includeZero: true })).toEqual([0, 90]);
  });

  it('log domain ignores non-positive values (stacked 0 baseline) and snaps to decades', () => {
    // a 0 from the band baseline must not drag the log floor down to ~0.001
    expect(computeDomain([0, 16, 0, 5300], { scale: 'log' })).toEqual([10, 10000]);
    expect(computeDomain([120, 900], { scale: 'log' })).toEqual([100, 1000]);
    // explicit bounds still win
    expect(computeDomain([16, 5300], { scale: 'log', min: 1, max: 100000 })).toEqual([1, 100000]);
  });

  it('ignores non-finite values instead of collapsing the domain to [0,1]', () => {
    expect(computeDomain([10, NaN, 20], { scale: 'value', includeZero: true })).toEqual([0, 20]);
    expect(computeDomain([10, Infinity, 20], { scale: 'value' })).toEqual([10, 20]);
  });

  it('does not overflow the call stack on a very large series', () => {
    const big = new Array(300_000).fill(0).map((_, i) => i);
    expect(() => computeDomain(big, { scale: 'value' })).not.toThrow();
    expect(computeDomain(big, { scale: 'value' })).toEqual([0, 299_999]);
  });
});

describe('niceLinearTicks', () => {
  it('returns populated ticks for a reversed domain (max < min)', () => {
    const ticks = niceLinearTicks(100, 0, 6);
    expect(ticks.length).toBeGreaterThan(0);
    expect(Math.min(...ticks)).toBeLessThanOrEqual(0);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(100);
  });
});

describe('makeLogScale', () => {
  it('does not collapse to a denormal axis for an all-non-positive domain', () => {
    const s = makeLogScale([-100, -1], 200);
    expect(s.domain[1]).toBeGreaterThanOrEqual(1);
  });
});

describe('stackSeries percentage', () => {
  it('keeps an all-negative column negative (does not flip to positive bars)', () => {
    const bands = stackSeries([[-4], [-6]], 'percentage', ['stacked', 'stacked']);
    // both segments sit below zero, filling 0..-100%
    expect(bands[0][0]![1]).toBeLessThanOrEqual(0);
    expect(bands[1][0]![0]).toBeCloseTo(-100, 5);
  });

  it('normalises a mixed column into a ±100 envelope', () => {
    const bands = stackSeries([[30], [-10]], 'percentage', ['stacked', 'stacked']);
    expect(bands[0][0]).toEqual([0, 100]); // the lone positive → full +100%
    expect(bands[1][0]).toEqual([-100, 0]); // the lone negative → full -100%
  });
});

describe('stackSeries wiggle', () => {
  it('produces a centred baseline distinct from normal stacking', () => {
    const normal = stackSeries([[2, 4], [3, 1]], 'normal', ['stacked', 'stacked']);
    const wiggle = stackSeries([[2, 4], [3, 1]], 'wiggle', ['stacked', 'stacked']);
    expect(wiggle).not.toEqual(normal);
    // column 0 total = 5, centred baseline starts at -2.5
    expect(wiggle[0][0]![0]).toBeCloseTo(-2.5, 5);
  });
});

describe('splitRuns', () => {
  it('treats NaN / Infinity as a gap, not a vertex', () => {
    const runs = splitRuns([1, NaN, 3], false);
    expect(runs.length).toBe(2);
    expect(runs.flat().every((p) => Number.isFinite(p.value))).toBe(true);
  });
});

describe('fontFamilyOf', () => {
  it('extracts the family list from a CSS `font` shorthand (typescale token)', () => {
    expect(fontFamilyOf('400 14px/20px Roboto, sans-serif')).toBe('Roboto, sans-serif');
    expect(fontFamilyOf('italic 700 22px "Helvetica Neue", Arial')).toBe('"Helvetica Neue", Arial');
  });
  it('passes a bare family list through unchanged', () => {
    expect(fontFamilyOf('"Roboto", system-ui, sans-serif')).toBe('"Roboto", system-ui, sans-serif');
  });
});

describe('entry animation', () => {
  it('expressiveEase pins the endpoints (0→0, 1→1) and moves in between', () => {
    expect(expressiveEase(0)).toBe(0);
    expect(expressiveEase(1)).toBe(1);
    expect(expressiveEase(0.5)).toBeGreaterThan(0);
  });

  it('easeScene collapses geometry to the baseline at e=0 and restores it at e=1', () => {
    const scene = computeLayout(lineSpec(), theme, 400, 300);
    const baseY = scene.plot.y + scene.plot.height;
    const at0 = easeScene(scene, 0);
    expect(at0.lines[0].points.every((p) => Math.abs(p.y - baseY) < 1e-6)).toBe(true);
    const at1 = easeScene(scene, 1);
    expect(at1.lines[0].points).toEqual(scene.lines[0].points);
    // chrome is untouched by the ease
    expect(at0.gridlines).toBe(scene.gridlines);
    expect(at0.texts).toBe(scene.texts);
  });

  it('grows a stacked bar from its baseline (shorter at e=0.5, full at e=1)', () => {
    const s = computeBarLayout(barSpec(), theme, 400, 300);
    const bar = s.bars[0];
    const half = easeScene(s, 0.5).bars[0];
    const full = easeScene(s, 1).bars[0];
    expect(half.h).toBeCloseTo(bar.h * 0.5, 5);
    expect(full.h).toBeCloseTo(bar.h, 5);
    expect(half.y + half.h).toBeCloseTo(bar.y + bar.h, 5); // bottom edge pinned
  });

  it('cubic easings pin endpoints and stay bounded (no overshoot)', () => {
    for (const ease of [easeOutCubic, easeInOutCubic]) {
      expect(ease(0)).toBeCloseTo(0, 6);
      expect(ease(1)).toBeCloseTo(1, 6);
      expect(ease(0.5)).toBeGreaterThan(0);
      expect(ease(0.5)).toBeLessThan(1);
    }
    // decelerate is ahead of its input early on; expressive overshoots past 1
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
    expect(Math.max(expressiveEase(0.3), expressiveEase(0.45))).toBeGreaterThan(1);
  });

  it('revealScene draws left-to-right: trims the line at the sweep and grows bars in order', () => {
    const line = computeLayout(
      lineSpec({
        series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30, 25, 40, 35, 50, 45], curve: 'linear', connectNulls: false, showMarks: false, hidden: false }],
        xValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      }),
      theme,
      400,
      300,
    );
    const full = line.lines[0].points.length;
    // nothing revealed before the plot, everything after
    expect(revealScene(line, 0).lines[0].points.length).toBeLessThanOrEqual(1);
    expect(revealScene(line, 1).lines[0].points.length).toBe(full);
    const mid = revealScene(line, 0.5).lines[0].points;
    expect(mid.length).toBeGreaterThan(0);
    expect(mid.length).toBeLessThan(full);
    // the trimmed edge never exceeds the sweep x
    const cutX = line.plot.x + 0.5 * line.plot.width;
    expect(Math.max(...mid.map((p) => p.x))).toBeLessThanOrEqual(cutX + 1e-6);

    // bars: leftmost bar is fuller than the rightmost at a partial sweep
    const bars = computeBarLayout(barSpec(), theme, 400, 300);
    const rev = revealScene(bars, 0.5).bars;
    const orig = bars.bars;
    const leftIdx = orig.reduce((m, b, i) => (b.x < orig[m].x ? i : m), 0);
    const rightIdx = orig.reduce((m, b, i) => (b.x > orig[m].x ? i : m), 0);
    const frac = (i: number) => rev[i].h / Math.max(orig[i].h, 1e-6);
    expect(frac(leftIdx)).toBeGreaterThan(frac(rightIdx));
  });

  it('staggerReveal draws series sequentially: line 1 completes before line 2 begins', () => {
    const mk = (label: string, data: number[]) => ({ label, color: '#6750A4', data, curve: 'linear' as const, connectNulls: false, showMarks: false, hidden: false });
    const scene = computeLayout(
      lineSpec({
        series: [mk('A', [10, 20, 30, 25, 40]), mk('B', [5, 15, 25, 35, 20]), mk('C', [40, 30, 20, 10, 15])],
        xValues: ['a', 'b', 'c', 'd', 'e'],
      }),
      theme,
      400,
      300,
    );
    const full = scene.lines.map((l) => l.points.length);
    const lenAt = (tRaw: number) => staggerReveal(scene, tRaw).lines.map((l) => l.points.length);

    // Just past series 0's 1/3 window: line 0 fully drawn, lines 1 & 2 barely started.
    const early = lenAt(0.34);
    expect(early[0]).toBe(full[0]);
    expect(early[1]).toBeLessThanOrEqual(1);
    expect(early[2]).toBeLessThanOrEqual(1);
    // Two-thirds: lines 0 & 1 done, line 2 barely started.
    const mid = lenAt(0.67);
    expect(mid[0]).toBe(full[0]);
    expect(mid[1]).toBe(full[1]);
    expect(mid[2]).toBeLessThan(full[2]);
    // Completion restores every series.
    expect(lenAt(1)).toEqual(full);
    // Chrome is untouched.
    expect(staggerReveal(scene, 0.5).texts).toBe(scene.texts);
  });

  it('stepAnimation: fade + the grow/expressive entrance ramp alpha; draw/stagger keep alpha 1', () => {
    const scene = computeLayout(lineSpec(), theme, 400, 300);
    const fadeMid = stepAnimation('fade', scene, 0.5);
    expect(fadeMid.scene.lines[0].points).toBe(scene.lines[0].points); // fade holds geometry
    expect(fadeMid.alpha).toBeGreaterThan(0);
    expect(fadeMid.alpha).toBeLessThan(1);
    expect(stepAnimation('fade', scene, 1).alpha).toBeCloseTo(1, 6);

    // The unified entrance BOTH grows the geometry AND fades the layer in.
    for (const v of ['expressive', 'grow'] as const) {
      const mid = stepAnimation(v, scene, 0.5);
      expect(mid.alpha).toBeGreaterThan(0);
      expect(mid.alpha).toBeLessThan(1); // layer fades in
      expect(mid.scene.lines[0].points).not.toEqual(scene.lines[0].points); // geometry mid-grow
      expect(stepAnimation(v, scene, 1).alpha).toBeCloseTo(1, 6);
      expect(stepAnimation(v, scene, 1).scene.lines[0].points).toEqual(scene.lines[0].points); // lands on target
    }
    // Deliberate-sweep variants animate geometry only; their layer stays opaque.
    for (const v of ['draw', 'stagger'] as const) {
      expect(stepAnimation(v, scene, 0.5).alpha).toBe(1);
    }
  });

  it('resolveIntro: variant back-compat, duration override, and ≤0 → none', () => {
    expect(resolveIntro({})).toEqual({ variant: 'expressive', duration: INTRO_MS });
    expect(resolveIntro({ animate: false })).toEqual({ variant: 'none', duration: INTRO_MS });
    expect(resolveIntro({ animation: 'fade' }).variant).toBe('fade');
    expect(resolveIntro({ animation: 'draw', animationDuration: 1200 })).toEqual({ variant: 'draw', duration: 1200 });
    expect(resolveIntro({ animation: 'expressive', animationDuration: 0 }).variant).toBe('none');
    expect(resolveIntro({ animation: 'grow', animationDuration: -5 }).variant).toBe('none');
    // non-finite durations disable (else the rAF loop's tRaw>=1 never fires)
    expect(resolveIntro({ animation: 'grow', animationDuration: NaN }).variant).toBe('none');
    expect(resolveIntro({ animation: 'grow', animationDuration: Infinity }).variant).toBe('none');
    expect(resolveIntro({ animation: 'grow', animationDuration: NaN }).duration).toBe(INTRO_MS);
    // explicit variant wins over the legacy flag
    expect(resolveIntro({ animation: 'fade', animate: false }).variant).toBe('fade');
  });

  it('grows a SHORT vertical bar by height, not width (orientation flag, not aspect ratio)', () => {
    // a wide-but-short vertical bar: w > h, yet it must still rise from the baseline
    const bar = { x: 100, y: 310, w: 30, h: 10, color: '#000', radius: [0, 0, 0, 0] as [number, number, number, number], seriesIndex: 0, dataIndex: 0, horizontal: false };
    const scene = { ...computeLayout(lineSpec(), theme, 400, 300), bars: [bar] };
    const half = easeScene(scene, 0.5).bars[0];
    expect(half.w).toBe(bar.w); // width unchanged
    expect(half.h).toBeCloseTo(bar.h * 0.5, 5); // height halved
    expect(half.y + half.h).toBeCloseTo(bar.y + bar.h, 5); // bottom pinned
    // and a horizontal bar of the same box grows its width instead
    const hbar = { ...bar, horizontal: true };
    const hhalf = easeScene({ ...scene, bars: [hbar] }, 0.5).bars[0];
    expect(hhalf.w).toBeCloseTo(bar.w * 0.5, 5);
    expect(hhalf.h).toBe(bar.h);
  });
});

describe('markerPolygon', () => {
  it('returns null for circle/none and a correct convex polygon per shape', () => {
    expect(markerPolygon('circle', 0, 0, 5)).toBeNull();
    expect(markerPolygon('none', 0, 0, 5)).toBeNull();
    expect(markerPolygon(undefined, 0, 0, 5)).toBeNull();
    expect(markerPolygon('square', 0, 0, 5)).toHaveLength(4);
    expect(markerPolygon('diamond', 0, 0, 5)).toHaveLength(4);
    expect(markerPolygon('triangle', 0, 0, 5)).toHaveLength(3);
    expect(markerPolygon('triangle-down', 0, 0, 5)).toHaveLength(3);
    // every vertex sits on the circumradius r about the centre
    for (const s of ['square', 'diamond', 'triangle', 'triangle-down'] as const) {
      for (const p of markerPolygon(s, 10, 20, 5)!) {
        expect(Math.hypot(p.x - 10, p.y - 20)).toBeCloseTo(5, 5);
      }
    }
    // triangle apex points up (screen y-down → smallest y), triangle-down points down
    const up = markerPolygon('triangle', 0, 0, 5)!;
    const down = markerPolygon('triangle-down', 0, 0, 5)!;
    expect(Math.min(...up.map((p) => p.y))).toBeCloseTo(-5, 5);
    expect(Math.max(...down.map((p) => p.y))).toBeCloseTo(5, 5);
  });

  it('computeLayout tags markers with the series symbol and suppresses symbol="none"', () => {
    const sq = computeLayout(lineSpec({ series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30], curve: 'linear', connectNulls: false, showMarks: true, hidden: false, symbol: 'square' }] }), theme, 400, 300);
    expect(sq.markers.length).toBe(3);
    expect(sq.markers.every((m) => m.symbol === 'square')).toBe(true);
    const none = computeLayout(lineSpec({ series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30], curve: 'linear', connectNulls: false, showMarks: true, hidden: false, symbol: 'none' }] }), theme, 400, 300);
    expect(none.markers.length).toBe(0);
  });
});

describe('data labels', () => {
  it('showLabels adds a bold value glyph-label per point (animates with the point)', () => {
    const base = { label: 'A', color: '#000', data: [10, 20, 30], curve: 'linear' as const, connectNulls: false, showMarks: false, hidden: false };
    const normal = computeLayout(lineSpec({ showLabels: true, series: [base] }), theme, 400, 300);
    // labels live in the animated glyph layer, not the static text overlay
    expect(normal.texts.some((t) => t.key.startsWith('dl-'))).toBe(false);
    const dl = (normal.glyphs ?? []).filter((g) => g.label);
    expect(dl.map((g) => g.text).sort()).toEqual(['10', '20', '30']);
    expect(dl.every((g) => g.label!.weight === 600)).toBe(true);
    // Above the point — EXCEPT the topmost one, which has no room there and
    // flips below rather than overflowing the plot into the title.
    const top = dl.reduce((a, g) => (g.y < a.y ? g : a));
    expect(dl.filter((g) => g !== top).every((g) => g.label!.dy === -9)).toBe(true);
    expect(top.label!.dy).toBe(9);
    expect(top.label!.anchorY).toBe('0');
    // none when the flag is off
    expect((computeLayout(lineSpec({ series: [base] }), theme, 400, 300).glyphs ?? []).filter((g) => g.label).length).toBe(0);
    // inverted places them to the right
    const inv = computeLayout(lineSpec({ showLabels: true, inverted: true, xScale: 'value', xValues: [0, 1, 2], series: [base] }), theme, 400, 300);
    const invDl = (inv.glyphs ?? []).filter((g) => g.label);
    expect(invDl.length).toBe(3);
    expect(invDl.every((g) => g.label!.dx === 9)).toBe(true);
  });
});

describe('series labels (end-of-line)', () => {
  it('adds an end label + marker at each series last point', () => {
    const s = computeLayout(
      lineSpec({
        seriesLabels: true,
        series: [
          { label: 'Alpha', color: '#111', data: [10, 20, 30], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
          { label: 'Beta', color: '#222', data: [5, 15, 25], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
        ],
      }),
      theme,
      400,
      300,
    );
    const names = (s.endLabels ?? []).map((e) => e.text).sort();
    expect(names).toEqual(['Alpha', 'Beta']);
    expect(s.markers.length).toBe(2); // one end marker per series
    // the label anchors at the series' last point (rightmost index)
    const alpha = (s.endLabels ?? []).find((e) => e.text === 'Alpha')!;
    expect(alpha.x).toBeCloseTo(s.hoverPoints[0].byIndex[2].x, 5);
    // Alpha (30) and Beta (25) are far enough apart → both visible
    expect((s.endLabels ?? []).every((e) => e.visible)).toBe(true);
    // none without the flag
    expect((computeLayout(lineSpec(), theme, 400, 300).endLabels ?? []).length).toBe(0);
  });

  it('hides an end label that would overlap a higher one (collision)', () => {
    const s = computeLayout(
      lineSpec({
        seriesLabels: true,
        series: [
          { label: 'A', color: '#111', data: [10, 20, 50], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
          { label: 'B', color: '#222', data: [10, 20, 50], curve: 'linear', connectNulls: false, showMarks: false, hidden: false }, // identical end → same y
        ],
      }),
      theme,
      400,
      300,
    );
    // the two coincident labels can't both show — exactly one stays visible
    expect((s.endLabels ?? []).filter((e) => e.visible).length).toBe(1);
    expect((s.endLabels ?? []).length).toBe(2); // both still present (one faded out)
  });
});

describe('inverted (transposed) layout', () => {
  it('runs xValues down the vertical axis and values across the horizontal', () => {
    const s = computeLayout(
      lineSpec({
        inverted: true,
        xScale: 'value',
        xValues: [0, 40, 80], // altitude
        series: [{ label: 'T', color: '#4da3ff', data: [15, -20, -70], curve: 'smooth', connectNulls: false, showMarks: true, hidden: false }],
      }),
      theme,
      400,
      300,
    );
    expect(s.inverted).toBe(true);
    expect(s.areas.length).toBe(0); // no area fill when inverted
    const hp = s.hoverPoints[0].byIndex;
    // altitude 0 sits lower on screen (larger y) than altitude 80
    expect(hp[0].y).toBeGreaterThan(hp[2].y);
    // the warmest reading (15°) sits to the right of the coldest (−70°)
    expect(hp[0].x).toBeGreaterThan(hp[2].x);
    // xPositions are the vertical (main-axis) pixels used for hover hit-testing
    expect(s.xPositions[0]).toBeCloseTo(hp[0].y, 5);
    expect(s.xPositions[2]).toBeCloseTo(hp[2].y, 5);
    expect(s.markers.length).toBe(3);
  });
});

describe('hover emphasis', () => {
  it('withAlpha scales a colour\'s alpha into an rgba() string', () => {
    expect(withAlpha('#6750A4', 0.5)).toBe('rgba(103, 80, 164, 0.5)');
    expect(withAlpha('rgba(16, 32, 48, 0.8)', 0.25)).toBe('rgba(16, 32, 48, 0.2)');
  });

  const twoSeries = () =>
    computeLayout(
      lineSpec({
        series: [
          { label: 'A', color: '#6750A4', data: [10, 20, 30], curve: 'linear', connectNulls: false, showMarks: true, hidden: false },
          { label: 'B', color: '#B3261E', data: [30, 20, 10], curve: 'linear', connectNulls: false, showMarks: true, hidden: false },
        ],
      }),
      theme,
      400,
      300,
    );

  it('dims every series except the focused one; -1 / t=0 are no-ops', () => {
    const scene = twoSeries();
    expect(scene.lines.map((l) => l.seriesIndex)).toEqual([0, 1]);
    // no focus → identical scene object graph (lines untouched)
    expect(emphasizeScene(scene, -1, 1).lines[0]).toBe(scene.lines[0]);
    expect(emphasizeScene(scene, 0, 0).lines[1]).toBe(scene.lines[1]);

    const emph = emphasizeScene(scene, 0, 1);
    const line0 = emph.lines.find((l) => l.seriesIndex === 0)!;
    const line1 = emph.lines.find((l) => l.seriesIndex === 1)!;
    expect(line0.color).toBe('#6750A4'); // focused: unchanged
    expect(line1.color).toBe('rgba(179, 38, 30, 0.22)'); // other: dimmed
    // markers of the non-focused series are dimmed too
    expect(emph.markers.filter((m) => m.seriesIndex === 1).every((m) => m.color.startsWith('rgba('))).toBe(true);
    expect(emph.markers.filter((m) => m.seriesIndex === 0).every((m) => m.color === '#6750A4')).toBe(true);
  });

  it('partial t dims less than full t', () => {
    const scene = twoSeries();
    const alphaOf = (t: number) => {
      const c = emphasizeScene(scene, 0, t).lines.find((l) => l.seriesIndex === 1)!.color;
      return parseFloat(c.slice(c.lastIndexOf(',') + 1));
    };
    expect(alphaOf(0.5)).toBeGreaterThan(alphaOf(1)); // half-faded is more opaque than fully faded
  });
});

describe('emoji / glyph markers', () => {
  const withMarks = (over: Partial<LineChartSpec['series'][number]>) =>
    computeLayout(lineSpec({ series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30, 40], curve: 'linear', connectNulls: false, showMarks: false, hidden: false, ...over }] }), theme, 400, 300);

  it('routes an emoji series symbol to DOM glyphs, not canvas markers', () => {
    const s = withMarks({ showMarks: true, symbol: '⭐' });
    expect(s.markers.length).toBe(0);
    expect(s.glyphs?.length).toBe(4);
    expect(s.glyphs?.every((g) => g.text === '⭐')).toBe(true);
  });

  it('per-point pointSymbols override a single point (shape stays elsewhere)', () => {
    const s = withMarks({ showMarks: true, symbol: 'square', pointSymbols: { 2: '☀️' } });
    expect(s.markers.length).toBe(3); // three squares
    expect(s.markers.every((m) => m.symbol === 'square')).toBe(true);
    expect(s.glyphs?.length).toBe(1); // one emoji at the overridden point
    expect(s.glyphs?.[0].text).toBe('☀️');
  });

  it('a pointSymbols accent shows even when marks are off (no markers elsewhere)', () => {
    const s = withMarks({ showMarks: false, pointSymbols: { 1: '❄️' } });
    expect(s.markers.length).toBe(0);
    expect(s.glyphs?.length).toBe(1);
    expect(s.glyphs?.[0].text).toBe('❄️');
  });
});

describe('computeLayout gridlines', () => {
  it('emits vertical gridlines for gridX and drops horizontal ones for gridY:false', () => {
    const both = computeLayout(lineSpec({ gridX: true, gridY: true }), theme, 400, 300);
    const vertical = both.gridlines.filter((g) => Math.abs(g.x1 - g.x2) < 0.5 && Math.abs(g.y1 - g.y2) > 1);
    expect(vertical.length).toBeGreaterThan(0);
    const noY = computeLayout(lineSpec({ gridX: true, gridY: false }), theme, 400, 300);
    const horizontal = noY.gridlines.filter((g) => Math.abs(g.y1 - g.y2) < 0.5 && Math.abs(g.x1 - g.x2) > 1);
    expect(horizontal.length).toBe(0);
  });
});

describe('parseColor', () => {
  it('parses #hex and rgb()/rgba() without a DOM', () => {
    expect(parseColor('#43a047')).toEqual([67 / 255, 160 / 255, 71 / 255, 1]);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10 / 255, 20 / 255, 30 / 255, 1]);
    expect(parseColor('rgba(1, 2, 3, 0.5)')[3]).toBe(0.5);
  });
});

const barSpec = (over: Partial<BarChartSpec> = {}): BarChartSpec => ({
  series: [
    { label: 'A', color: '#6750A4', data: [10, 20, 30], hidden: false },
    { label: 'B', color: '#B3261E', data: [5, 15, 25], hidden: false },
  ],
  categories: ['Q1', 'Q2', 'Q3'],
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

describe('computeBarLayout', () => {
  it('rounds the BOTTOM corners of a downward negative stacked bar', () => {
    const s = computeBarLayout(
      barSpec({ stack: 'normal', categories: ['Q1'], series: [
        { label: 'A', color: '#6750A4', data: [-4], hidden: false },
        { label: 'B', color: '#B3261E', data: [-6], hidden: false },
      ] }),
      theme,
      400,
      300,
    );
    // the outermost (lowest) negative segment gets its bottom corners rounded
    const rounded = s.bars.filter((b) => b.radius[2] > 0 || b.radius[3] > 0);
    expect(rounded.length).toBe(1);
    expect(rounded[0].radius[0]).toBe(0); // top corners square
  });

  it('does not reserve stack space for a hidden series', () => {
    const withHidden = computeBarLayout(
      barSpec({ stack: 'normal', categories: ['Q1'], series: [
        { label: 'A', color: '#6750A4', data: [10], hidden: false },
        { label: 'B', color: '#B3261E', data: [10], hidden: true },
        { label: 'C', color: '#625B71', data: [10], hidden: false },
      ] }),
      theme,
      400,
      300,
    );
    // C should sit directly on A (stack top = 20), not leave B's gap (top = 30)
    const bars = withHidden.bars;
    expect(bars.length).toBe(2);
    const topY = Math.min(...bars.map((b) => b.y));
    // value 20 over a [0,20] domain in a ~260px plot → top near plot top; value
    // 30 would place it above the plot. Assert the two bars stack contiguously.
    const aBar = bars.find((b) => b.seriesIndex === 0)!;
    const cBar = bars.find((b) => b.seriesIndex === 2)!;
    expect(Math.abs((aBar.y) - (cBar.y + cBar.h))).toBeLessThan(1); // C sits on A
    expect(topY).toBeGreaterThan(0);
  });
});

const pieSpec = (over: Partial<PieChartSpec> = {}): PieChartSpec => ({
  data: [
    { label: 'A', value: 50, color: '#6750A4' },
    { label: 'B', value: 30, color: '#B3261E' },
    { label: 'C', value: 20, color: '#7D5260' },
  ],
  innerRadius: '0%',
  outerRadius: '80%',
  startAngleDeg: 90,
  endAngleDeg: -270,
  paddingAngleDeg: 0,
  cornerRadius: 0,
  showLabels: false,
  highlight: 'none',
  legend: 'none',
  valueFormatter: (v) => String(v),
  ...over,
});

describe('unified token-driven chart entrance', () => {
  it('cubicBezier reproduces a CSS timing curve: pinned endpoints, monotonic, bounded', () => {
    const ease = cubicBezier(0.05, 0.7, 0.1, 1); // emphasized-decelerate control points
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // monotonic non-decreasing and always inside [0,1] (a decelerate curve never overshoots)
    let prev = -1;
    for (let x = 0; x <= 1.0001; x += 0.05) {
      const y = ease(Math.min(1, x));
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(y).toBeGreaterThanOrEqual(-1e-9);
      expect(y).toBeLessThanOrEqual(1 + 1e-9);
      prev = y;
    }
    // linear identity curve: cubic-bezier(0,0,1,1) === x
    const linear = cubicBezier(0, 0, 1, 1);
    for (const x of [0.1, 0.37, 0.5, 0.83]) expect(linear(x)).toBeCloseTo(x, 4);
  });

  it('emphasizedDecelerate is the entering-element curve: fast start, front-loaded', () => {
    // A decelerate curve is AHEAD of its input for most of the timeline (it covers
    // ground early then eases into the settle).
    expect(emphasizedDecelerate(0.25)).toBeGreaterThan(0.25);
    expect(emphasizedDecelerate(0.5)).toBeGreaterThan(0.5);
    // and never past 1 (no overshoot, unlike the old expressive spring)
    expect(emphasizedDecelerate(0.5)).toBeLessThanOrEqual(1);
  });

  it('INTRO_MS is the extra-long1 motion token (700ms), shared by every chart', () => {
    expect(INTRO_MS).toBe(700);
    expect(resolveIntro({}).duration).toBe(700);
  });

  it('plays ONE identical entrance for line, bar and pie — same eased alpha and grow fraction', () => {
    const line = computeLayout(lineSpec(), theme, 400, 300);
    const bar = computeBarLayout(barSpec(), theme, 400, 300);
    const pie = computePieLayout(pieSpec(), theme, 400, 400);
    const t = 0.5;
    const e = emphasizedDecelerate(t);
    const la = stepAnimation('expressive', line, t);
    const ba = stepAnimation('expressive', bar, t);
    const pa = stepAnimation('expressive', pie, t);
    // one shared layer fade, identical across chart types
    expect(la.alpha).toBeCloseTo(e, 6);
    expect(ba.alpha).toBeCloseTo(e, 6);
    expect(pa.alpha).toBeCloseTo(e, 6);
    // and each geometry grown from its baseline by the SAME eased fraction
    const barFrac = ba.scene.bars[0].h / bar.bars[0].h;
    const pieFrac = pa.scene.slices[0].outerR / pie.slices[0].outerR;
    // line: pick the target point furthest from the baseline to avoid a
    // near-zero denominator, then read back its lift fraction
    const baseY = line.plot.y + line.plot.height;
    const pts = line.lines[0].points;
    let far = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].y - baseY) > Math.abs(pts[far].y - baseY)) far = i;
    const lineFrac = (la.scene.lines[0].points[far].y - baseY) / (pts[far].y - baseY);
    expect(barFrac).toBeCloseTo(e, 5);
    expect(pieFrac).toBeCloseTo(e, 5);
    expect(lineFrac).toBeCloseTo(e, 5);
  });
});

describe('computePieLayout', () => {
  it('does not invert slices when paddingAngle exceeds the ring sweep', () => {
    const s = computePieLayout(pieSpec({ paddingAngleDeg: 90, data: [
      { label: 'A', value: 1, color: '#000' },
      { label: 'B', value: 1, color: '#111' },
      { label: 'C', value: 1, color: '#222' },
      { label: 'D', value: 1, color: '#333' },
    ] }), theme, 400, 400);
    // every slice keeps a non-negative sweep in the ring's direction
    const dir = Math.sign(s.slices.reduce((a, sl) => a + (sl.endAngle - sl.startAngle), 0)) || 1;
    for (const sl of s.slices) expect(Math.sign(sl.endAngle - sl.startAngle) === dir || sl.endAngle === sl.startAngle).toBe(true);
  });

  it('sanitises an invalid radius rather than producing NaN / zero rings', () => {
    const nan = computePieLayout(pieSpec({ outerRadius: NaN }), theme, 400, 400);
    expect(nan.slices.every((sl) => Number.isFinite(sl.outerR) && sl.outerR >= 1)).toBe(true);
    const bad = computePieLayout(pieSpec({ outerRadius: 'abc' }), theme, 400, 400);
    expect(bad.slices.every((sl) => sl.outerR >= 1)).toBe(true);
  });

  it('does not reserve a legend gutter for a single-slice pie', () => {
    const solo = computePieLayout(pieSpec({ legend: 'right', data: [{ label: 'Only', value: 100, color: '#000' }] }), theme, 400, 400);
    // ring stays centred (no reserved right gutter shifting it left)
    expect(solo.plot.x + solo.plot.width / 2).toBeCloseTo(200, 0);
    expect(solo.legend.length).toBe(0);
  });
});

const lineSpec = (over: Partial<LineChartSpec> = {}): LineChartSpec => ({
  series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30], curve: 'linear', connectNulls: false, showMarks: false, hidden: false }],
  xValues: ['Jan', 'Feb', 'Mar'],
  xScale: 'category',
  xFormatter: (v) => String(v),
  yScale: 'value',
  yFormatter: (v) => String(v),
  stack: 'none',
  area: false,
  ...over,
});

describe('computeLayout', () => {
  it('renders the x/y axis titles it reserves gutter space for', () => {
    const s = computeLayout(lineSpec({ xLabel: 'Month', yLabel: 'Revenue' }), theme, 400, 300);
    const titles = s.texts.filter((t) => t.key === 'x-axis-title' || t.key === 'y-axis-title').map((t) => t.text);
    expect(titles).toContain('Month');
    expect(titles).toContain('Revenue');
  });

  it('aligns the title left / centre / right of the plot per titleAlign', () => {
    const titleOf = (align: LineChartSpec['titleAlign']) => {
      const s = computeLayout(lineSpec({ title: 'Revenue', titleAlign: align }), theme, 400, 300);
      return s.texts.find((t) => t.key === 'title')!;
    };
    const start = titleOf('start');
    const center = titleOf('center');
    const end = titleOf('end');
    // start anchors to the plot's left edge; center/end move progressively right
    // and carry the matching text-align so the DOM overlay offsets correctly.
    expect(start.align).toBe('start');
    expect(center.align).toBe('center');
    expect(end.align).toBe('end');
    expect(center.x).toBeGreaterThan(start.x);
    expect(end.x).toBeGreaterThan(center.x);
    // default (undefined) matches 'start'
    expect(titleOf(undefined).align).toBe('start');
    expect(titleOf(undefined).x).toBe(start.x);
  });

  it('applies a dash pattern to a dotted series and leaves solid series undashed', () => {
    const dotted = computeLayout(
      lineSpec({ series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30], curve: 'linear', connectNulls: false, showMarks: false, hidden: false, dash: 'dotted' }] }),
      theme,
      400,
      300,
    );
    expect(dotted.lines[0].dash?.length).toBeGreaterThanOrEqual(2);
    expect(computeLayout(lineSpec(), theme, 400, 300).lines[0].dash).toBeUndefined();
  });

  it('gives each stacked-area layer its own base polyline', () => {
    const s = computeLayout(
      lineSpec({ area: true, stack: 'normal', series: [
        { label: 'A', color: '#6750A4', data: [10, 10, 10], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
        { label: 'B', color: '#B3261E', data: [10, 10, 10], curve: 'linear', connectNulls: false, showMarks: false, hidden: false },
      ] }),
      theme,
      400,
      300,
    );
    expect(s.areas.length).toBe(2);
    // the upper layer closes to a non-zero base polyline, not the global baseline
    const upper = s.areas[1];
    expect(upper.basePoints && upper.basePoints.length).toBeTruthy();
    expect(Math.max(...upper.basePoints!.map((p) => p.y))).toBeLessThan(upper.baselineY);
  });
});

describe('titlePlacement', () => {
  it('maps alignment to the correct anchor x + text-align within the plot box', () => {
    // plot spans x = 40 .. 340 (width 300)
    expect(titlePlacement('start', 40, 300)).toEqual({ x: 40, align: 'start' });
    expect(titlePlacement('center', 40, 300)).toEqual({ x: 190, align: 'center' });
    expect(titlePlacement('end', 40, 300)).toEqual({ x: 340, align: 'end' });
    // undefined defaults to start
    expect(titlePlacement(undefined, 40, 300)).toEqual({ x: 40, align: 'start' });
  });
});

describe('computeMultiAxisLayout', () => {
  const mkSeries = (label: string, color: string, data: number[], yAxisIndex: number) => ({
    label,
    color,
    data,
    curve: 'linear' as const,
    connectNulls: false,
    showMarks: false,
    hidden: false,
    yAxisIndex,
  });
  const fmt = (v: number) => String(v);
  const multi = (over: Partial<LineChartSpec> = {}): LineChartSpec =>
    lineSpec({
      xValues: [1960, 1980, 2000, 2020],
      xScale: 'value',
      xFormatter: (v) => String(v),
      series: [
        mkSeries('Claims', '#43c463', [40, 55, 30, 35], 0),
        mkSeries('Inflation', '#4a90e2', [15, 5, -5, 8], 1),
        mkSeries('Foreign', '#f5d90a', [-1e11, 0, 1e11, 2e11], 2),
        mkSeries('Domestic', '#ff7043', [0, 3e12, 6e12, 1e13], 3),
      ],
      yAxes: [
        { scale: 'value', min: 0, max: 80, formatter: fmt, position: 'left', label: 'Claims' },
        { scale: 'value', min: -5, max: 15, formatter: fmt, position: 'left', label: 'Inflation' },
        { scale: 'value', formatter: (v) => `${Math.round(v / 1e9)}G`, position: 'right', label: 'Foreign' },
        { scale: 'value', min: 0, formatter: (v) => `${Math.round(v / 1e12)}T`, position: 'right', label: 'Domestic' },
      ],
      ...over,
    });

  const vAxisXs = (scene: ReturnType<typeof computeLayout>) =>
    scene.axisLines
      .filter((l) => Math.abs(l.x1 - l.x2) < 0.5 && Math.abs(l.y2 - l.y1 - scene.plot.height) < 2)
      .map((l) => l.x1)
      .sort((a, b) => a - b);

  it('stacks axes outward: two left of the plot, two right, all with tick labels', () => {
    const s = computeLayout(multi(), theme, 600, 320);
    const xs = vAxisXs(s);
    expect(xs.length).toBe(4);
    expect(xs.filter((x) => x <= s.plot.x + 0.5).length).toBe(2);
    expect(xs.filter((x) => x >= s.plot.x + s.plot.width - 0.5).length).toBe(2);
    // every axis prints its own tick labels + rotated title
    const tickAxes = new Set(s.texts.filter((t) => /^yt-\d+-/.test(t.key ?? '')).map((t) => t.key!.split('-')[1]));
    expect([...tickAxes].sort()).toEqual(['0', '1', '2', '3']);
    expect(s.texts.filter((t) => /^yaxis-title-/.test(t.key ?? '')).map((t) => t.text)).toEqual(['Claims', 'Inflation', 'Foreign', 'Domestic']);
  });

  it('maps each series against its OWN axis domain', () => {
    const s = computeLayout(multi(), theme, 600, 320);
    const top = s.plot.y;
    const bottom = s.plot.y + s.plot.height;
    // Inflation (axis 1, domain -5..15): first datum 15 → plot top, third -5 → plot bottom.
    const infl = s.lines[1].points;
    expect(infl[0].y).toBeCloseTo(top, 0);
    expect(infl[2].y).toBeCloseTo(bottom, 0);
    // every series stays inside the plot band (each on its own scale)
    for (const l of s.lines) {
      for (const p of l.points) {
        expect(p.y).toBeGreaterThanOrEqual(top - 1);
        expect(p.y).toBeLessThanOrEqual(bottom + 1);
      }
    }
  });

  it('gives each series its own axis value formatter for the tooltip', () => {
    const s = computeLayout(multi(), theme, 600, 320);
    expect(s.hoverPoints[2].valueFormat!(1e11)).toBe('100G');
    expect(s.hoverPoints[3].valueFormat!(1e13)).toBe('10T');
  });

  it('defaults axis 0 to the left and the rest to the right when position is omitted', () => {
    const s = computeLayout(
      multi({
        yAxes: [
          { scale: 'value', formatter: fmt },
          { scale: 'value', formatter: fmt },
          { scale: 'value', formatter: fmt },
        ],
      }),
      theme,
      600,
      320,
    );
    const xs = vAxisXs(s);
    expect(xs.filter((x) => x <= s.plot.x + 0.5).length).toBe(1);
    expect(xs.filter((x) => x >= s.plot.x + s.plot.width - 0.5).length).toBe(2);
  });

  it('falls back to axis 0 for an out-of-range yAxisIndex', () => {
    const s = computeLayout(
      multi({
        series: [mkSeries('A', '#43c463', [40, 55, 30, 35], 0), mkSeries('Stray', '#4a90e2', [40, 55, 30, 35], 9)],
      }),
      theme,
      600,
      320,
    );
    // Both series read the same (axis-0) scale, so identical data → identical y.
    expect(s.lines[1].points.map((p) => Math.round(p.y))).toEqual(s.lines[0].points.map((p) => Math.round(p.y)));
  });

  it('labels a dense value x-axis at nice round values, not one label per point', () => {
    const years = Array.from({ length: 61 }, (_, i) => 1960 + i);
    const s = computeLayout(
      multi({ xValues: years, series: [mkSeries('A', '#43c463', years.map((_, i) => i), 0)] }),
      theme,
      600,
      320,
    );
    const xTicks = s.texts.filter((t) => /^xt-/.test(t.key ?? ''));
    expect(xTicks.length).toBeLessThan(years.length); // thinned, not 61 labels
    expect(xTicks.map((t) => t.text)).toContain('2000');
  });

  it('formats a time x-axis with Dates, never raw epoch numbers', () => {
    const dates = [new Date('2020-01-01'), new Date('2020-04-01'), new Date('2020-07-01'), new Date('2020-10-01')];
    let sawNonDate = false;
    const s = computeLayout(
      multi({
        xValues: dates,
        xScale: 'time',
        xFormatter: (v) => {
          if (!(v instanceof Date)) {
            sawNonDate = true;
            return 'ERR';
          }
          return `M${v.getUTCMonth() + 1}`;
        },
        series: [mkSeries('A', '#43c463', [40, 55, 30, 35], 0)],
      }),
      theme,
      600,
      320,
    );
    const xt = s.texts.filter((t) => /^xt-/.test(t.key ?? ''));
    expect(sawNonDate).toBe(false); // the formatter only ever received Dates
    expect(xt.length).toBeGreaterThan(0);
    expect(xt.every((t) => t.text !== 'ERR')).toBe(true);
  });

  it('anchors horizontal gridlines to a data-bearing axis when axis 0 is empty', () => {
    const s = computeLayout(
      multi({
        series: [mkSeries('Only', '#43c463', [-5, 0, 10, 15], 1)], // all data on axis 1
        yAxes: [
          { scale: 'value', formatter: fmt, position: 'left' }, // axis 0: no data, no min/max → phantom [0,1]
          { scale: 'value', min: -5, max: 15, formatter: fmt, position: 'left' }, // axis 1: the data axis
        ],
      }),
      theme,
      600,
      320,
    );
    const hgrid = s.gridlines.filter((g) => Math.abs(g.y1 - g.y2) < 0.5);
    // grid follows axis 1's ticks (-5..15), not the phantom [0,1] of axis 0
    expect(hgrid.length).toBe(niceLinearTicks(-5, 15, 6).length);
  });

  it('draws vertical gridlines (gridX) for a category x-axis, even with hidden tick labels', () => {
    const cat = computeLayout(multi({ xScale: 'category', xValues: ['a', 'b', 'c', 'd'], gridX: true }), theme, 600, 320);
    expect(cat.gridlines.filter((g) => Math.abs(g.x1 - g.x2) < 0.5).length).toBeGreaterThan(0);
    // gridX survives hidden x-labels
    const hidden = computeLayout(multi({ gridX: true, xHideTicks: true }), theme, 600, 320);
    expect(hidden.gridlines.filter((g) => Math.abs(g.x1 - g.x2) < 0.5).length).toBeGreaterThan(0);
    expect(hidden.texts.filter((t) => /^xt-/.test(t.key ?? '')).length).toBe(0);
  });

  it('renders perpendicular tick marks on the axes when axisTicks is set', () => {
    const s = computeLayout(multi({ axisTicks: true }), theme, 600, 320);
    const yTicks = s.axisLines.filter((l) => Math.abs(l.y1 - l.y2) < 0.5 && Math.abs(l.x2 - l.x1) > 0 && Math.abs(l.x2 - l.x1) <= 6);
    expect(yTicks.length).toBeGreaterThan(0);
  });

  it('reserves room so the last x-tick label is not clipped when there is no right axis', () => {
    const s = computeLayout(
      multi({
        yAxes: [{ scale: 'value', min: 0, max: 80, formatter: fmt, position: 'left' }],
        series: [mkSeries('A', '#43c463', [40, 55, 30, 35], 0)],
      }),
      theme,
      600,
      320,
    );
    const xt = s.texts.filter((t) => /^xt-/.test(t.key ?? ''));
    const last = xt.reduce((m, t) => (t.x > m.x ? t : m), xt[0]);
    const halfW = (last.text.length * theme.labelSize * 0.58) / 2;
    expect(last.x + halfW).toBeLessThanOrEqual(600);
  });
});

describe('forecast / mark-line features', () => {
  const mk = (over: Record<string, unknown>) => ({ label: 'T', color: '#EA47E0', data: [10, 12, 11, 9, 8, 7], curve: 'linear' as const, connectNulls: false, showMarks: false, hidden: false, ...over });

  it('dashAfter splits the line into a solid then a dotted segment sharing the boundary', () => {
    const s = computeLayout(lineSpec({ series: [mk({ dashAfter: 2 })], xValues: ['a', 'b', 'c', 'd', 'e', 'f'] }), theme, 400, 300);
    const solid = s.lines.filter((l) => !l.dash);
    const dotted = s.lines.filter((l) => l.dash && l.dash.length);
    expect(solid.length).toBe(1);
    expect(dotted.length).toBe(1);
    const lastSolid = solid[0].points[solid[0].points.length - 1];
    const firstDotted = dotted[0].points[0];
    expect(lastSolid.x).toBeCloseTo(firstDotted.x, 1);
    expect(lastSolid.y).toBeCloseTo(firstDotted.y, 1);
  });

  it('hollow renders open markers filled with the surface colour', () => {
    const s = computeLayout(lineSpec({ series: [mk({ showMarks: true, hollow: true, data: [10, 12, 11] })], xValues: ['a', 'b', 'c'] }), theme, 400, 300);
    expect(s.markers.length).toBeGreaterThan(0);
    expect(s.markers.every((m) => m.hollow === true && m.fill === theme.surface)).toBe(true);
  });

  it('markLines draw a dashed vertical segment across the plot plus a label', () => {
    const s = computeLayout(lineSpec({ markLines: [{ value: 1, label: 'Now', color: '#33f', dash: 'dashed' }] }), theme, 400, 300);
    const v = s.gridlines.filter((g) => Math.abs(g.x1 - g.x2) < 0.5 && g.dash && g.color === '#33f');
    expect(v.length).toBe(1);
    expect(v[0].y1).toBeCloseTo(s.plot.y, 0);
    expect(v[0].y2).toBeCloseTo(s.plot.y + s.plot.height, 0);
    expect(s.texts.some((t) => t.text === 'Now' && /^markline-/.test(t.key ?? ''))).toBe(true);
  });

  it('renders a subtitle under the title', () => {
    const s = computeLayout(lineSpec({ title: 'Weather', subtitle: 'forecast' }), theme, 400, 300);
    const title = s.texts.find((t) => t.key === 'title')!;
    const sub = s.texts.find((t) => t.key === 'subtitle');
    expect(sub?.text).toBe('forecast');
    expect(sub!.y).toBeGreaterThan(title.y);
  });

  // The mechanism behind the `show-line` toggle on md-area-chart / md-line-chart:
  // a false stroke drops the line but keeps the area fill. Lets a fill-only area
  // stay readable at fillOpacity:1, where the same-coloured line merges into it.
  it('stroke:false keeps the area fill but drops the line (show-line off)', () => {
    const mk = (stroke: boolean | undefined) =>
      computeLayout(
        lineSpec({
          area: true,
          fillOpacity: 1,
          series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30], curve: 'linear', connectNulls: false, showMarks: false, hidden: false, stroke }],
        }),
        theme,
        400,
        300,
      );
    const withLine = mk(undefined); // show-line default → line drawn
    const noLine = mk(false); // show-line off → fill only
    expect(withLine.areas.length).toBeGreaterThan(0);
    expect(noLine.areas.length).toBe(withLine.areas.length); // fill unaffected
    expect(withLine.lines.length).toBeGreaterThan(0);
    expect(noLine.lines.length).toBe(0); // the line is gone
  });
});
