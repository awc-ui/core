import { computeBarLayout, type BarChartSpec } from './bar-layout';
import { mirrorScene } from './rtl';
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

const baseSpec = (over: Partial<BarChartSpec> = {}): BarChartSpec => ({
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

describe('chart engine — bar layout', () => {
  it('emits one bar per visible series per category (grouped)', () => {
    const s = computeBarLayout(baseSpec(), theme, 400, 300);
    expect(s.bars.length).toBe(2 * 3); // 2 series × 3 categories
    // every bar carries its series + data index for hit-testing
    expect(s.bars.every((b) => b.seriesIndex >= 0 && b.dataIndex >= 0)).toBe(true);
  });

  it('sizes bar height proportionally to value (vertical)', () => {
    const s = computeBarLayout(baseSpec(), theme, 400, 300);
    const seriesA = s.bars.filter((b) => b.seriesIndex === 0);
    // data [10,20,30] → strictly increasing heights
    expect(seriesA[0].h).toBeLessThan(seriesA[1].h);
    expect(seriesA[1].h).toBeLessThan(seriesA[2].h);
    // vertical bars round only the top corners
    expect(seriesA[0].radius).toEqual([6, 6, 0, 0]);
  });

  it('places grouped sibling bars side by side within a category band', () => {
    const s = computeBarLayout(baseSpec(), theme, 400, 300);
    const a0 = s.bars.find((b) => b.seriesIndex === 0 && b.dataIndex === 0)!;
    const b0 = s.bars.find((b) => b.seriesIndex === 1 && b.dataIndex === 0)!;
    // second series sits to the right of the first, no overlap
    expect(b0.x).toBeGreaterThanOrEqual(a0.x + a0.w);
  });

  it('does not truncate a THINNED category axis to its bare band width', () => {
    // 30 "Day N" columns: the axis thins to every few, and each SHOWN label may
    // spread into the skipped bands beside it — so it reads "Day 4", not "D…".
    const cats = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    const s = computeBarLayout(
      baseSpec({ categories: cats, series: [{ label: 'v', color: '#6750A4', data: cats.map((_, i) => 10 + i), hidden: false }] }),
      theme,
      680,
      400,
    );
    const shown = s.texts.filter((t) => t.key?.startsWith('ct-')).map((t) => t.text);
    expect(shown.length).toBeGreaterThan(1); // some labels...
    expect(shown.length).toBeLessThan(cats.length); // ...but thinned, not all 30
    expect(shown.every((l) => !l.includes('…'))).toBe(true); // and none truncated
    expect(shown).toContain('Day 1');
  });

  it('honours a fixed barWidth, centred in its slot (auto fills the band)', () => {
    const single = { series: [{ label: 'A', color: '#6750A4', data: [10, 20, 30], hidden: false }] };
    const auto = computeBarLayout(baseSpec(single), theme, 400, 300);
    const fixed = computeBarLayout(baseSpec({ ...single, barWidth: 10 }), theme, 400, 300);
    const a = auto.bars.find((b) => b.dataIndex === 0)!;
    const f = fixed.bars.find((b) => b.dataIndex === 0)!;
    expect(a.w).toBeGreaterThan(10); // auto fills the band
    expect(f.w).toBe(10); // fixed to 10px
    expect(f.x + f.w / 2).toBeCloseTo(a.x + a.w / 2, 6); // centred on the SAME slot centre
    // Clamped to the slot — a barWidth wider than the band can't overrun it.
    const huge = computeBarLayout(baseSpec({ ...single, barWidth: 9999 }), theme, 400, 300);
    expect(huge.bars[0].w).toBeCloseTo(a.w, 6);
  });

  it('stacks segments and rounds only the topmost per category', () => {
    const s = computeBarLayout(baseSpec({ stack: 'normal' }), theme, 400, 300);
    // stacked → both series share one column per category (same x + width)
    const a0 = s.bars.find((b) => b.seriesIndex === 0 && b.dataIndex === 0)!;
    const b0 = s.bars.find((b) => b.seriesIndex === 1 && b.dataIndex === 0)!;
    expect(b0.x).toBeCloseTo(a0.x, 6);
    expect(b0.w).toBeCloseTo(a0.w, 6);
    // exactly one of the two carries a rounded top (the taller cumulative one)
    const rounded = [a0, b0].filter((bar) => bar.radius[0] > 0);
    expect(rounded.length).toBe(1);
  });

  it('grows bars along x for horizontal layout, rounding the end corners', () => {
    const s = computeBarLayout(baseSpec({ horizontal: true }), theme, 400, 300);
    const seriesA = s.bars.filter((b) => b.seriesIndex === 0);
    expect(seriesA[0].w).toBeLessThan(seriesA[2].w); // wider = larger value
    expect(seriesA[0].radius).toEqual([0, 6, 6, 0]); // right corners
  });

  it('clamps the value axis to 0..100 for percentage stacking', () => {
    const s = computeBarLayout(baseSpec({ stack: 'percentage' }), theme, 400, 300);
    // per-category segments sum to the full plot height (100%)
    const cat0 = s.bars.filter((b) => b.dataIndex === 0);
    const totalH = cat0.reduce((sum, b) => sum + b.h, 0);
    expect(totalH).toBeCloseTo(s.plot.height, 0);
  });

  it('drops the legend when legend is "none"', () => {
    expect(computeBarLayout(baseSpec(), theme, 400, 300).legend.length).toBe(2);
    expect(computeBarLayout(baseSpec({ legend: 'none' }), theme, 400, 300).legend.length).toBe(0);
  });

  it('skips hidden series but keeps their legend entry', () => {
    const s = computeBarLayout(
      baseSpec({ series: [
        { label: 'A', color: '#6750A4', data: [10, 20, 30], hidden: false },
        { label: 'B', color: '#B3261E', data: [5, 15, 25], hidden: true },
      ] }),
      theme,
      400,
      300,
    );
    expect(s.bars.every((b) => b.seriesIndex === 0)).toBe(true); // only series A drawn
    expect(s.legend.length).toBe(2); // both still in the legend (B toggled off)
  });
});

describe('chart engine — bar value-axis breaks', () => {
  const barSpec = (over: Record<string, unknown> = {}) => ({
    series: [{ label: 'A', color: '#6750A4', data: [4, 18, 1.1e12], hidden: false }],
    categories: ['a', 'b', 'c'],
    categoryFormatter: (v: unknown) => String(v),
    valueScale: 'value' as const,
    valueFormatter: (v: number) => String(v),
    stack: 'none' as const,
    horizontal: false,
    cornerRadius: 4,
    ...over,
  });

  it('splits a bar that crosses a cut, so the discontinuity stays visible', () => {
    // Without splitting every bar would run straight through the gap — they all
    // grow from the baseline, so they all cross it.
    const plain = computeBarLayout(barSpec() as never, theme, 500, 320);
    const broken = computeBarLayout(barSpec({ valueBreaks: 'auto' }) as never, theme, 500, 320);
    expect(broken.bars.length).toBeGreaterThan(plain.bars.length);
  });

  it('rescues the small bars instead of leaving them a sliver', () => {
    const plain = computeBarLayout(barSpec() as never, theme, 500, 320);
    const broken = computeBarLayout(barSpec({ valueBreaks: 'auto' }) as never, theme, 500, 320);
    const tallest = (s: typeof plain, cat: number) =>
      s.bars.filter((b) => b.dataIndex === cat).reduce((sum, b) => sum + b.h, 0);
    expect(tallest(plain, 1)).toBeLessThan(1); // 18 out of 1.1e12 — invisible
    expect(tallest(broken, 1)).toBeGreaterThan(20);
  });

  it('draws the break as a zigzag tear ACROSS the whole plot, not just on the axis', () => {
    // The tear is the run of 1.5px-wide diagonal segments; the axis line itself
    // is also split around the cut.
    const zig = (s: ReturnType<typeof computeBarLayout>) => s.axisLines.filter((l) => l.width === 1.5);
    const plainV = computeBarLayout(barSpec() as never, theme, 500, 320);
    const brokenV = computeBarLayout(barSpec({ valueBreaks: 'auto' }) as never, theme, 500, 320);
    expect(zig(plainV).length).toBe(0);
    const zv = zig(brokenV);
    expect(zv.length).toBeGreaterThan(0);
    // Vertical chart: the tear runs HORIZONTALLY across most of the plot width,
    // confined to the thin break gap in y.
    const vx = zv.flatMap((l) => [l.x1, l.x2]);
    const vy = zv.flatMap((l) => [l.y1, l.y2]);
    expect(Math.max(...vx) - Math.min(...vx)).toBeGreaterThan(brokenV.plot.width * 0.8);
    expect(Math.max(...vy) - Math.min(...vy)).toBeLessThan(40);

    // Horizontal chart: the value axis is the bottom line, so the tear runs
    // VERTICALLY up most of the plot height.
    const brokenH = computeBarLayout(barSpec({ valueBreaks: 'auto', horizontal: true }) as never, theme, 500, 320);
    const zh = zig(brokenH);
    expect(zh.length).toBeGreaterThan(0);
    const hx = zh.flatMap((l) => [l.x1, l.x2]);
    const hy = zh.flatMap((l) => [l.y1, l.y2]);
    expect(Math.max(...hy) - Math.min(...hy)).toBeGreaterThan(brokenH.plot.height * 0.8);
    expect(Math.max(...hx) - Math.min(...hx)).toBeLessThan(40);
  });

  it('opens the outlier into its own gridded section, keeping the cut empty', () => {
    const broken = computeBarLayout(barSpec({ valueBreaks: 'auto' }) as never, theme, 500, 320);
    const ticks = broken.texts.filter((t) => t.key?.startsWith('vt-')).map((t) => Number(t.text));
    // No tick sits INSIDE the cut (the big emptiness the break removed).
    expect(ticks.some((v) => v > 1000 && v < 1e11)).toBe(false);
    // ...but the outlier is no longer pinned bare to the axis top: its section now
    // carries more than one tick to read it against.
    expect(ticks.filter((v) => v > 1e11).length).toBeGreaterThan(1);
  });

  it('draws gridlines in the top (outlier) section, not only below the break', () => {
    const broken = computeBarLayout(barSpec({ valueBreaks: 'auto' }) as never, theme, 500, 320);
    const midY = broken.plot.y + broken.plot.height / 2;
    const gridYs = broken.gridlines.map((g) => g.y1);
    // The opened outlier section (top half) is ruled like the small-values section
    // below the break (bottom half) — gridlines in BOTH, not a blank band up top.
    expect(gridYs.filter((y) => y < midY).length).toBeGreaterThan(1);
    expect(gridYs.filter((y) => y > midY).length).toBeGreaterThan(1);
  });

  it('sizes an overlay bar as a fraction of the FULL band (widthRatio no longer compounds with the gap)', () => {
    const s = computeBarLayout(
      baseSpec({
        categoryGapRatio: 0.4,
        series: [
          { label: 'Back', color: '#6750A4', data: [10, 20, 30], hidden: false },
          { label: 'Front', color: '#B3261E', data: [5, 5, 5], hidden: false, overlay: true, widthRatio: 0.5 },
        ],
      }),
      theme,
      400,
      300,
    );
    const back = s.bars.find((b) => b.seriesIndex === 0 && b.dataIndex === 0)!;
    const front = s.bars.find((b) => b.seriesIndex === 1 && b.dataIndex === 0)!;
    const band = s.plot.width / 3; // 3 equal category bands (vertical)
    expect(front.w).toBeCloseTo(band * 0.5, 3); // 50% of the FULL band...
    expect(front.w).toBeGreaterThan(band * 0.4); // ...not the old ~0.3 (0.6 inner × 0.5)
    expect(front.x + front.w / 2).toBeCloseTo(back.x + back.w / 2, 3); // centered in front
  });

  it('opens a gap between chevron force segments (they abut without chevron)', () => {
    const chevSpec = (chevron: boolean) =>
      baseSpec({
        horizontal: true,
        stack: 'normal',
        chevron,
        categories: ['F'],
        series: [
          { label: 'A', color: '#1668ff', data: [-5], hidden: false },
          { label: 'B', color: '#f4245e', data: [10], hidden: false },
        ],
      });
    const boundaryGap = (s: ReturnType<typeof computeBarLayout>): number => {
      const a = s.bars.find((b) => b.seriesIndex === 0)!;
      const b = s.bars.find((b) => b.seriesIndex === 1)!;
      // A (−5) sits left of zero, B (10) right; they share the zero boundary.
      return Math.min(Math.abs(a.x + a.w - b.x), Math.abs(b.x + b.w - a.x));
    };
    const plain = boundaryGap(computeBarLayout(chevSpec(false), theme, 500, 220));
    const chev = boundaryGap(computeBarLayout(chevSpec(true), theme, 500, 220));
    expect(plain).toBeLessThan(1); // abut
    expect(chev).toBeGreaterThan(plain + 3); // real gap opens
  });

  it('reserves the legend gutter from the MEASURED extent (two-pass)', () => {
    const base = baseSpec({ legend: 'bottom' });
    const est = computeBarLayout(base, theme, 400, 300);
    const measured = computeBarLayout({ ...base, legendExtent: 80 }, theme, 400, 300);
    // A big measured legend band eats more plot height than the row estimate.
    expect(measured.plot.height).toBeLessThan(est.plot.height);
  });

  it('mirrors bar x AND the horizontal value baseline for an RTL host', () => {
    const s = computeBarLayout(baseSpec({ horizontal: true }), theme, 400, 300);
    const m = mirrorScene(s);
    const b = s.bars[0];
    const mb = m.bars.find((x) => x.seriesIndex === b.seriesIndex && x.dataIndex === b.dataIndex)!;
    expect(mb.x).toBeCloseTo(s.width - (b.x + b.w), 3);
    // The value baseline is an x for a horizontal chart → it mirrors too, so the
    // intro still grows the bars from the (now right-hand) zero.
    expect(m.barBaseline).toBeCloseTo(s.width - s.barBaseline!, 3);
  });

  it('leaves the vertical value baseline (a y) unmirrored in RTL', () => {
    const s = computeBarLayout(baseSpec({ horizontal: false }), theme, 400, 300);
    const m = mirrorScene(s);
    expect(m.barBaseline).toBeCloseTo(s.barBaseline!, 3);
  });

  it('drops an axis frame line when its axisLine flag is false (grid + ticks stay)', () => {
    // Horizontal: the value axis runs along the BOTTOM edge.
    const bottom = (s: ReturnType<typeof computeBarLayout>) =>
      s.axisLines.find(
        (l) => Math.abs(l.y1 - (s.plot.y + s.plot.height)) < 0.5 && Math.abs(l.y2 - (s.plot.y + s.plot.height)) < 0.5 && Math.abs(l.x2 - l.x1 - s.plot.width) < 1,
      );
    const withLine = computeBarLayout(baseSpec({ horizontal: true }), theme, 400, 300);
    const noLine = computeBarLayout(baseSpec({ horizontal: true, valueAxisLine: false }), theme, 400, 300);
    expect(bottom(withLine)).toBeDefined();
    expect(bottom(noLine)).toBeUndefined();
    // Gridlines are untouched — the value axis still reads off the grid.
    expect(noLine.gridlines.length).toBe(withLine.gridlines.length);
    expect(noLine.gridlines.length).toBeGreaterThan(0);
  });
});
