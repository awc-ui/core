import { computeLayout, type EngineTheme, type LineChartSpec } from './layout';

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

const baseSpec = (over: Partial<LineChartSpec> = {}): LineChartSpec => ({
  series: [{ label: 'A', color: '#6750A4', data: [0, 50, 100], curve: 'linear', connectNulls: false, showMarks: true, hidden: false }],
  xValues: ['Jan', 'Feb', 'Mar'],
  xScale: 'category',
  xFormatter: (v) => String(v),
  yScale: 'value',
  yFormatter: (v) => String(v),
  stack: 'none',
  area: false,
  ...over,
});

describe('chart engine — layout', () => {
  it('produces a plot rect inset for the y-axis gutter', () => {
    const s = computeLayout(baseSpec(), theme, 400, 300);
    expect(s.plot.x).toBeGreaterThan(0); // left gutter for y labels
    expect(s.plot.width).toBeLessThan(400);
    expect(s.plot.height).toBeLessThan(300);
  });

  it('maps a linear series to a polyline spanning the plot, low value at bottom', () => {
    const s = computeLayout(baseSpec(), theme, 400, 300);
    expect(s.lines.length).toBe(1);
    const pts = s.lines[0].points;
    expect(pts.length).toBe(3); // linear: 3 data points
    // value 0 (min) → bottom of plot; value 100 (max) → top
    const bottom = s.plot.y + s.plot.height;
    expect(pts[0].y).toBeCloseTo(bottom, 0); // first point value 0 at baseline
    expect(pts[2].y).toBeCloseTo(s.plot.y, 0); // last point value 100 at top
    // x increases across the category band
    expect(pts[0].x).toBeLessThan(pts[1].x);
    expect(pts[1].x).toBeLessThan(pts[2].x);
  });

  it('honours per-series lineWidth + markSize (default 2.5 / per-symbol)', () => {
    const def = computeLayout(baseSpec(), theme, 400, 300);
    expect(def.lines[0].width).toBeCloseTo(2.5, 6); // default stroke
    expect(def.markers[0].r).toBeCloseTo(3.5, 6); // default circle radius

    const custom = computeLayout(
      baseSpec({ series: [{ label: 'A', color: '#6750A4', data: [0, 50, 100], curve: 'linear', connectNulls: false, showMarks: true, hidden: false, lineWidth: 5, markSize: 9 }] }),
      theme,
      400,
      300,
    );
    expect(custom.lines[0].width).toBe(5); // configured stroke
    expect(custom.markers.every((m) => m.r === 9)).toBe(true); // configured marker radius
  });

  it('emits horizontal gridlines at the nice y ticks', () => {
    const s = computeLayout(baseSpec(), theme, 400, 300);
    expect(s.gridlines.length).toBeGreaterThanOrEqual(3);
    // gridlines are horizontal (y1 === y2), full plot width
    for (const g of s.gridlines) {
      expect(g.y1).toBeCloseTo(g.y2, 6);
      expect(g.x1).toBeCloseTo(s.plot.x, 6);
      expect(g.x2).toBeCloseTo(s.plot.x + s.plot.width, 6);
    }
  });

  it('emits x tick labels for the categories and a marker per point', () => {
    const s = computeLayout(baseSpec(), theme, 400, 300);
    const xLabels = s.texts.filter((t) => t.key.startsWith('xt-')).map((t) => t.text);
    expect(xLabels).toEqual(['Jan', 'Feb', 'Mar']);
    expect(s.markers.length).toBe(3);
  });

  it('adds an area fill when area is enabled', () => {
    const noArea = computeLayout(baseSpec(), theme, 400, 300);
    const withArea = computeLayout(baseSpec({ area: true }), theme, 400, 300);
    expect(noArea.areas.length).toBe(0);
    expect(withArea.areas.length).toBe(1);
    expect(withArea.areas[0].points.length).toBe(3);
  });

  it('breaks the line at null gaps into multiple polylines', () => {
    const s = computeLayout(
      baseSpec({ series: [{ label: 'A', color: '#6750A4', data: [1, null, 3], curve: 'linear', connectNulls: false, showMarks: false, hidden: false }] }),
      theme,
      400,
      300,
    );
    expect(s.lines.length).toBe(2); // two runs
  });

  it('reports one xPosition per category for hit-testing', () => {
    const s = computeLayout(baseSpec(), theme, 400, 300);
    expect(s.xPositions.length).toBe(3);
    expect(s.xPositions[0]).toBeLessThan(s.xPositions[2]);
  });

  it('draws a y-axis break as a tear ACROSS the whole plot, not just on the axis', () => {
    const outlier = [{ label: 'A', color: '#6750A4', data: [4, 8, 5000], curve: 'linear' as const, connectNulls: false, showMarks: true, hidden: false }];
    const zig = (s: ReturnType<typeof computeLayout>) => s.axisLines.filter((l) => l.width === 1.5);
    const plain = computeLayout(baseSpec({ series: outlier }), theme, 500, 320);
    const broken = computeLayout(baseSpec({ series: outlier, yBreaks: 'auto' }), theme, 500, 320);
    expect(zig(plain).length).toBe(0);
    const z = zig(broken);
    expect(z.length).toBeGreaterThan(0);
    // Horizontal tear: spans most of the plot WIDTH, confined to the thin gap in y.
    const xs = z.flatMap((l) => [l.x1, l.x2]);
    const ys = z.flatMap((l) => [l.y1, l.y2]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(broken.plot.width * 0.8);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(40);
  });

  it('compact mode drops all chrome but keeps geometry + hit-testing', () => {
    const s = computeLayout(baseSpec({ compact: true }), theme, 240, 40);
    expect(s.gridlines.length).toBe(0);
    expect(s.axisLines.length).toBe(0);
    expect(s.texts.length).toBe(0);
    expect(s.legend.length).toBe(0);
    // Edge-to-edge, but baseSpec SHOWS marks — a marker at an edge point needs its
    // radius reserved or it clips, so the inset is the marker radius (a few px).
    expect(s.plot.x).toBeGreaterThan(2);
    expect(s.plot.x).toBeLessThan(8);
    // With NO markers it stays the tight 2px.
    const bare = computeLayout(
      baseSpec({ compact: true, series: [{ label: 'A', color: '#6750A4', data: [0, 50, 100], curve: 'linear', connectNulls: false, showMarks: false, hidden: false }] }),
      theme,
      240,
      40,
    );
    expect(bare.plot.x).toBeLessThanOrEqual(2);
    expect(s.lines.length).toBe(1); // series still drawn
    expect(s.xPositions.length).toBe(3); // hover/click still work
  });

  it('draws markers only at markIndices when provided', () => {
    const s = computeLayout(
      baseSpec({ series: [{ label: 'A', color: '#6750A4', data: [10, 5, 30, 8], curve: 'linear', connectNulls: false, showMarks: true, hidden: false, markIndices: [1, 3] }] }),
      theme,
      400,
      300,
    );
    // markIndices overrides showMarks-all → exactly the two named points
    expect(s.markers.length).toBe(2);
  });

  it('renders reference bands as full-height rects', () => {
    const s = computeLayout(baseSpec({ compact: true, refBands: [{ from: 0, to: 2, color: 'rgba(0,0,0,0.1)' }] }), theme, 240, 40);
    expect(s.bars.length).toBe(1);
    expect(s.bars[0].h).toBeCloseTo(s.plot.height, 0);
    expect(s.bars[0].seriesIndex).toBe(-1); // not a data bar
  });
});

describe('chart engine — axis bands', () => {
  const bandSpec = (over: Partial<LineChartSpec> = {}) =>
    computeLayout(baseSpec({ yMin: 0, yMax: 100, ...over }), theme, 400, 300);

  it('draws a y band across the plot width at the right height', () => {
    const s = bandSpec({ yBands: [{ from: 20, to: 40 }] });
    expect(s.bands).toHaveLength(1);
    const b = s.bands![0];
    expect(b.x).toBe(s.plot.x);
    expect(b.w).toBe(s.plot.width);
    // 20..40 of a 0..100 domain = the band 60-80% down the plot.
    expect(b.y).toBeCloseTo(s.plot.y + s.plot.height * 0.6, 1);
    expect(b.h).toBeCloseTo(s.plot.height * 0.2, 1);
  });

  it('draws an x band down the plot height', () => {
    const s = bandSpec({ xBands: [{ from: 0, to: 1 }] });
    const b = s.bands![0];
    expect(b.y).toBe(s.plot.y);
    expect(b.h).toBe(s.plot.height);
    expect(b.w).toBeGreaterThan(0);
  });

  it('clips a band that runs past the domain instead of painting outside the plot', () => {
    const s = bandSpec({ yBands: [{ from: -500, to: 500 }] });
    const b = s.bands![0];
    expect(b.y).toBeCloseTo(s.plot.y, 1);
    expect(b.h).toBeCloseTo(s.plot.height, 1);
  });

  it('drops a band that falls entirely outside the domain', () => {
    const s = bandSpec({ yBands: [{ from: 200, to: 300 }] });
    expect(s.bands ?? []).toHaveLength(0);
  });

  it('labels a band inside it, using the muted text colour by default', () => {
    const s = bandSpec({ yBands: [{ from: 20, to: 40, label: 'Fresh breeze' }] });
    const label = s.texts.find((t) => t.text === 'Fresh breeze');
    expect(label).toBeTruthy();
    expect(label!.color).toBe(theme.textColorMuted);
    const b = s.bands![0];
    expect(label!.x).toBeGreaterThan(s.plot.x); // inset from the near edge
    expect(label!.y).toBeGreaterThanOrEqual(b.y);
    expect(label!.y).toBeLessThan(b.y + b.h);
  });

  it('honours labelAlign and explicit colours', () => {
    const s = bandSpec({
      yBands: [{ from: 0, to: 50, label: 'Zone', labelAlign: 'end', color: '#123456', labelColor: '#abcdef' }],
    });
    expect(s.bands![0].color).toBe('#123456');
    const label = s.texts.find((t) => t.text === 'Zone')!;
    expect(label.color).toBe('#abcdef');
    expect(label.align).toBe('end');
    expect(label.x).toBeLessThan(s.plot.x + s.plot.width);
  });

  it('keeps sparklines clean — no bands in compact mode', () => {
    const s = computeLayout(baseSpec({ compact: true, yBands: [{ from: 0, to: 50, label: 'Zone' }] }), theme, 200, 60);
    expect(s.bands ?? []).toHaveLength(0);
    expect(s.texts.find((t) => t.text === 'Zone')).toBeUndefined();
  });
});

describe('chart engine — y tick formatting', () => {
  it('formats axis ticks with yTickFormatter, leaving values to yFormatter', () => {
    const s = computeLayout(
      baseSpec({ yFormatter: (v) => `${v} m/s`, yTickFormatter: (v) => String(v), showLabels: true }),
      theme,
      400,
      300,
    );
    const ticks = s.texts.filter((t) => t.key?.startsWith('yt-')).map((t) => t.text);
    expect(ticks.every((t) => !t.includes('m/s'))).toBe(true);
    // Data labels still carry the unit — they are values, not axis chrome.
    expect(s.glyphs?.some((g) => g.text.includes('m/s'))).toBe(true);
  });

  it('falls back to yFormatter when no tick formatter is given', () => {
    const s = computeLayout(baseSpec({ yFormatter: (v) => `${v} m/s` }), theme, 400, 300);
    const ticks = s.texts.filter((t) => t.key?.startsWith('yt-')).map((t) => t.text);
    expect(ticks.every((t) => t.includes('m/s'))).toBe(true);
  });
});

describe('chart engine — dashed axis lines and gridlines', () => {
  /** The plot-spanning grid segments (the axis frame lives in axisLines). */
  const horizontal = (s: ReturnType<typeof computeLayout>) => s.gridlines.filter((g) => g.y1 === g.y2);
  const vertical = (s: ReturnType<typeof computeLayout>) => s.gridlines.filter((g) => g.x1 === g.x2);

  it('leaves every line solid by default', () => {
    const s = computeLayout(baseSpec({ gridX: true, gridY: true }), theme, 400, 300);
    expect(s.gridlines.every((g) => g.dash === undefined)).toBe(true);
    expect(s.axisLines.every((a) => a.dash === undefined)).toBe(true);
  });

  it('dashes the horizontal grid from the y axis, leaving the vertical one alone', () => {
    const s = computeLayout(baseSpec({ gridX: true, gridY: true, yGridDash: 'dashed' }), theme, 400, 300);
    expect(horizontal(s).length).toBeGreaterThan(0);
    expect(horizontal(s).every((g) => Array.isArray(g.dash))).toBe(true);
    expect(vertical(s).every((g) => g.dash === undefined)).toBe(true);
  });

  it('dashes the vertical grid from the x axis', () => {
    const s = computeLayout(baseSpec({ gridX: true, gridY: true, xGridDash: 'dotted' }), theme, 400, 300);
    expect(vertical(s).length).toBeGreaterThan(0);
    expect(vertical(s).every((g) => Array.isArray(g.dash))).toBe(true);
    expect(horizontal(s).every((g) => g.dash === undefined)).toBe(true);
  });

  it('dashes each axis line independently of the grid', () => {
    const s = computeLayout(baseSpec({ xDash: 'dashed', axisTicks: true }), theme, 400, 300);
    const bottom = s.plot.y + s.plot.height;
    // The axis LINES span the plot; the tick marks are the short stubs (and the
    // y tick at value 0 sits on the bottom edge too, so length matters).
    const xAxis = s.axisLines.filter((a) => a.y1 === bottom && a.y2 === bottom && a.x2 - a.x1 > 10);
    const yAxis = s.axisLines.filter((a) => a.x1 === s.plot.x && a.x2 === s.plot.x && a.y1 !== a.y2);
    expect(xAxis.length).toBeGreaterThan(0);
    expect(xAxis.every((a) => Array.isArray(a.dash))).toBe(true);
    expect(yAxis.every((a) => a.dash === undefined)).toBe(true);
    expect(s.gridlines.every((g) => g.dash === undefined)).toBe(true);
  });

  it('gives dotted a tighter pattern than dashed', () => {
    const dashed = computeLayout(baseSpec({ gridY: true, yGridDash: 'dashed' }), theme, 400, 300).gridlines[0].dash!;
    const dotted = computeLayout(baseSpec({ gridY: true, yGridDash: 'dotted' }), theme, 400, 300).gridlines[0].dash!;
    expect(dotted[0]).toBeLessThan(dashed[0]);
  });
});
