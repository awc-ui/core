/*
 * Chart tooltips — custom content, partial data, and the default card
 * ===================================================================
 * Three things are pinned here:
 *   1. partial / staggered series still draw and hover correctly
 *   2. the BUILT-IN tooltip is byte-for-byte what it always was when
 *      no renderer and no missing-value formatter are supplied
 *   3. `tooltipRenderer` gets a complete payload, and its return value
 *      is inserted safely (a string is text, HTML is opt-in)
 */
import { computeLayout, type EngineTheme, type LineChartSpec } from './layout';
import { computeBarLayout, type BarChartSpec } from './bar-layout';
import { renderHover } from './hover';
import type { MdChartTooltipContext } from '../tooltip';

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

const S = (label: string, data: (number | null)[], color = '#6750A4') => ({
  label,
  color,
  data,
  curve: 'linear' as const,
  connectNulls: false,
  showMarks: false,
  hidden: false,
});

const lineSpec = (over: Partial<LineChartSpec> = {}): LineChartSpec => ({
  series: [S('A', [10, 20, 30])],
  xValues: ['Jan', 'Feb', 'Mar'],
  xScale: 'category',
  xFormatter: (v) => String(v),
  yScale: 'value',
  yFormatter: (v) => String(v),
  stack: 'none',
  area: false,
  ...over,
});

/** Render the hover UI for `index` into a fresh layer and hand back the parts. */
function hover(
  spec: LineChartSpec,
  index: number,
  opts: Parameters<typeof renderHover>[8] = {},
  focus = -1,
): { layer: HTMLElement; tip: HTMLElement | null; markers: number } {
  const scene = computeLayout(spec, theme, 400, 300);
  const layer = document.createElement('div');
  renderHover(layer, scene, index, spec.yFormatter, 'Roboto', { x: 200, y: 150 }, 'vertical', focus, opts);
  const tip = layer.querySelector('[part="tooltip"]') as HTMLElement | null;
  // children = crosshair + one highlight marker per series WITH a point + tooltip
  return { layer, tip, markers: layer.children.length - 1 - (tip ? 1 : 0) };
}

/** The tooltip's own box, with the computed position stripped. */
const boxOf = (tip: HTMLElement) => (tip.getAttribute('style') ?? '').replace(/\s*left: [^;]+; top: [^;]+;\s*$/, '');

describe('partial data', () => {
  it('draws a series SHORTER than the x axis over just its own span', () => {
    const scene = computeLayout(
      lineSpec({ xValues: ['Jan', 'Feb', 'Mar', 'Apr', 'May'], series: [S('A', [10, 20, 30, 40, 50]), S('B', [5, 6])] }),
      theme,
      400,
      300,
    );
    // one polyline each; B has only its two real vertices, not five
    expect(scene.lines.map((l) => [l.seriesIndex, l.points.length])).toEqual([
      [0, 5],
      [1, 2],
    ]);
    // and it is hoverable only where it has data
    expect(Object.keys(scene.hoverPoints[1].byIndex)).toEqual(['0', '1']);
  });

  it('starts a series with LEADING nulls at its first real reading', () => {
    const scene = computeLayout(
      lineSpec({
        xValues: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        series: [S('A', [10, 20, 30, 40, 50]), S('B', [null, null, 6, 7, 8])],
      }),
      theme,
      400,
      300,
    );
    expect(scene.lines.map((l) => [l.seriesIndex, l.points.length])).toEqual([
      [0, 5],
      [1, 3],
    ]);
    expect(Object.keys(scene.hoverPoints[1].byIndex)).toEqual(['2', '3', '4']);
  });

  it('keeps an ISOLATED reading (a run of one, fenced by nulls) as a drawable point', () => {
    const scene = computeLayout(
      lineSpec({
        xValues: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        series: [S('A', [10, 20, 30, 40, 50]), S('B', [null, 6, null, null, null])],
      }),
      theme,
      400,
      300,
    );
    // A 1-vertex polyline strokes nothing, so both renderers special-case it
    // into a dot — the vertex has to survive layout for that to be possible.
    const lone = scene.lines.find((l) => l.seriesIndex === 1)!;
    expect(lone.points).toHaveLength(1);
    expect(Object.keys(scene.hoverPoints[1].byIndex)).toEqual(['1']);
  });

  it('exposes each series values alongside byIndex so absences are legible', () => {
    const scene = computeLayout(lineSpec({ series: [S('A', [10, null, 30]), S('B', [1])] }), theme, 400, 300);
    expect(scene.hoverPoints[0].values).toEqual([10, null, 30]);
    // B simply stops after index 0 — nothing at 1 / 2, not even a null
    expect(scene.hoverPoints[1].values?.[1]).toBeUndefined();
  });
});

describe('default tooltip (no renderer, no missing formatter)', () => {
  // Frozen copy of the card as it shipped. Any drift here is a visual change to
  // every chart's tooltip and must be deliberate.
  const CARD =
    'position: absolute; pointer-events: none; ' +
    'background: var(--md-sys-color-surface-container-high, #ECE6F0); ' +
    'color: var(--md-sys-color-on-surface, #1C1B1F); border-radius: 8px; padding: 8px 10px; ' +
    'box-shadow: 0 2px 6px rgba(0,0,0,0.15),0 1px 2px rgba(0,0,0,0.2); font: 400 11px Roboto; ' +
    'min-width: 96px; z-index: 2; white-space: nowrap;';
  const BODY =
    '<div style="font-weight: 600; margin-bottom: 4px;">Feb</div>' +
    '<div style="display: flex; align-items: center; gap: 8px; line-height: 1.5;">' +
    '<span style="width: 10px; height: 10px; border-radius: 3px; background: #6750A4; flex: none;"></span>' +
    '<span style="flex: 1;">A</span><strong>20</strong></div>';

  it('is unchanged — same box, same header, same rows', () => {
    const { tip } = hover(lineSpec({ series: [S('A', [10, 20, 30]), S('B', [1, null, 3], '#B3261E')] }), 1);
    expect(boxOf(tip!)).toBe(CARD);
    // series B is null at Feb, so it is absent — exactly one row
    expect(tip!.innerHTML).toBe(BODY);
  });

  it('omits a series with no value at the hovered x, and draws no marker for it', () => {
    // A has a reading at Feb, B is null there, C stops before it.
    const { tip, markers } = hover(
      lineSpec({ series: [S('A', [10, 20, 30]), S('B', [1, null, 3]), S('C', [7])] }),
      1,
    );
    expect(tip!.querySelectorAll('div').length - 1).toBe(1); // header + 1 row
    expect(markers).toBe(1);
  });

  it('renders nothing at all when no series has a value at the hovered x', () => {
    const { tip } = hover(lineSpec({ series: [S('A', [10, null, 30])] }), 1);
    expect(tip).toBeNull();
  });
});

describe('missing values — opt in via valueFormatter', () => {
  const spec = lineSpec({
    series: [S('A', [10, 20, 30]), S('B', [1, null, 3], '#B3261E'), S('C', [7], '#7D5260')],
  });

  it('tells an authored null apart from no datum at all', () => {
    const seen: (number | null | undefined)[] = [];
    hover(spec, 1, {
      missingFormatter: (v) => {
        seen.push(v);
        return v === null ? 'no reading' : '—';
      },
    });
    // B has a datum here and it is null; C has no datum here at all
    expect(seen).toEqual([null, undefined]);
  });

  it('adds a row per named absence, in series order', () => {
    const { tip } = hover(spec, 1, {
      missingFormatter: (v) => (v === null ? 'no reading' : '—'),
    });
    const rows = [...tip!.querySelectorAll('div')].slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['A20', 'Bno reading', 'C—']);
  });

  it('renders a missing row as an absence: dimmed, no swatch colour, value not bolded', () => {
    const { tip, markers } = hover(spec, 1, { missingFormatter: () => 'n/a' });
    const [present, missing] = [...tip!.querySelectorAll('div')].slice(1);
    expect(present.getAttribute('style')).not.toContain('opacity');
    expect(missing.getAttribute('style')).toContain('opacity: 0.62');
    // the swatch keeps its box (column alignment) but never a background
    expect(missing.querySelector('span')!.getAttribute('style')).not.toContain('background');
    expect(present.querySelector('strong')).not.toBeNull();
    expect(missing.querySelector('strong')).toBeNull();
    // and no highlight marker is drawn on the plot for a point that isn't there
    expect(markers).toBe(1);
  });

  it('keeps omitting the series when the formatter returns an empty string', () => {
    const { tip } = hover(spec, 1, { missingFormatter: () => '' });
    expect([...tip!.querySelectorAll('div')].slice(1)).toHaveLength(1);
  });

  it('leaves a formatter that only handles numbers behaving exactly as before', () => {
    const numbersOnly = (v: number | null | undefined) => `${v} m`;
    const plain = hover(spec, 1);
    const withFmt = hover(spec, 1, { missingFormatter: () => '' });
    expect(withFmt.tip!.innerHTML).toBe(plain.tip!.innerHTML);
    // (a formatter that DOES name them opts in — that is the whole contract)
    expect(hover(spec, 1, { missingFormatter: numbersOnly }).tip!.textContent).toContain('null m');
  });

  it('works the same on a bar chart', () => {
    const barSpec: BarChartSpec = {
      series: [
        { label: 'A', color: '#6750A4', data: [10, 20], hidden: false },
        { label: 'B', color: '#B3261E', data: [5, null], hidden: false },
      ],
      categories: ['Q1', 'Q2'],
      categoryFormatter: (v) => String(v),
      valueScale: 'value',
      valueFormatter: (v) => String(v),
      stack: 'none',
      horizontal: false,
      categoryGapRatio: 0.3,
      barGapRatio: 0.1,
      cornerRadius: 6,
      showLabels: false,
    };
    const scene = computeBarLayout(barSpec, theme, 400, 300);
    expect(scene.hoverPoints[1].values).toEqual([5, null]);
    const layer = document.createElement('div');
    renderHover(layer, scene, 1, barSpec.valueFormatter, 'Roboto', { x: 200, y: 150 }, 'vertical', -1, {
      missingFormatter: () => 'no data',
    });
    expect(layer.querySelector('[part="tooltip"]')!.textContent).toContain('no data');
  });
});

describe('tooltipRenderer — payload', () => {
  const spec = lineSpec({
    series: [S('A', [10, 20, 30]), S('B', [1, null, 3], '#B3261E'), S('C', [7], '#7D5260')],
  });

  const contextAt = (index: number, focus = -1): MdChartTooltipContext => {
    let ctx!: MdChartTooltipContext;
    hover(spec, index, { render: (c) => ((ctx = c), null) }, focus);
    return ctx;
  };

  it('carries the hovered x value and its formatted label', () => {
    const ctx = contextAt(1);
    expect(ctx.dataIndex).toBe(1);
    expect(ctx.axisValue).toBe('Feb');
    expect(ctx.axisLabel).toBe('Feb');
  });

  it('lists only the series that HAVE a value there, with everything about them', () => {
    const ctx = contextAt(1);
    expect(ctx.series).toEqual([
      { seriesIndex: 0, label: 'A', color: '#6750A4', value: 20, formattedValue: '20', focused: false, missing: false },
    ]);
  });

  it('reports the absent series separately, null vs undefined intact', () => {
    const ctx = contextAt(1);
    expect(ctx.missing.map((m) => [m.seriesIndex, m.value, m.missing])).toEqual([
      [1, null, true],
      [2, undefined, true],
    ]);
    // with no missing formatter installed there is nothing to show for them
    expect(ctx.missing.every((m) => m.formattedValue === '')).toBe(true);
  });

  it('flags the emphasised series', () => {
    const ctx = contextAt(0, 1);
    expect(ctx.focusedSeriesIndex).toBe(1);
    expect(ctx.series.map((s) => [s.seriesIndex, s.focused])).toEqual([
      [0, false],
      [1, true],
      [2, false],
    ]);
    // nothing is focused when the chart is not emphasising
    expect(contextAt(0).series.every((s) => !s.focused)).toBe(true);
  });

  it('uses the per-series axis formatter on a multi-axis chart', () => {
    const multi = lineSpec({
      series: [{ ...S('A', [10, 20, 30]), yAxisIndex: 0 }, { ...S('B', [1, 2, 3]), yAxisIndex: 1 }],
      yAxes: [
        { scale: 'value', formatter: (v: number) => `${v} m` },
        { scale: 'value', formatter: (v: number) => `${v} kg` },
      ],
    });
    let ctx!: MdChartTooltipContext;
    hover(multi, 1, { render: (c) => ((ctx = c), null) });
    expect(ctx.series.map((s) => s.formattedValue)).toEqual(['20 m', '2 kg']);
  });

  it('is still called when no series has a reading, so "no data here" is possible', () => {
    let calls = 0;
    const { tip } = hover(lineSpec({ series: [S('A', [10, null, 30])] }), 1, {
      render: (c) => (calls++, `nothing at ${c.axisLabel}`),
    });
    expect(calls).toBe(1);
    expect(tip!.textContent).toBe('nothing at Feb');
  });
});

describe('tooltipRenderer — return values and safety', () => {
  const spec = lineSpec({ series: [S('A', [10, 20, 30])] });

  it('inserts a returned Node as-is', () => {
    const { tip } = hover(spec, 1, {
      render: () => {
        const el = document.createElement('section');
        el.className = 'mine';
        el.textContent = 'custom';
        return el;
      },
    });
    expect(tip!.querySelector('section.mine')!.textContent).toBe('custom');
  });

  it('treats a returned STRING as text — markup in it is shown, never parsed', () => {
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const { tip } = hover(spec, 1, { render: () => evil });
    expect(tip!.textContent).toBe(evil);
    expect(tip!.querySelector('img')).toBeNull();
    expect(tip!.querySelector('script')).toBeNull();
    expect(tip!.children).toHaveLength(0);
  });

  it('parses HTML only through the explicit unsafeHtml opt-in', () => {
    const { tip } = hover(spec, 1, { render: () => ({ unsafeHtml: '<b class="x">bold</b>' }) });
    expect(tip!.querySelector('b.x')!.textContent).toBe('bold');
  });

  it('falls back to the built-in tooltip when the renderer returns undefined', () => {
    const custom = hover(spec, 1, { render: () => undefined });
    const plain = hover(spec, 1);
    expect(custom.tip!.outerHTML).toBe(plain.tip!.outerHTML);
  });

  it('renders no tooltip when the renderer returns null — crosshair and marker stay', () => {
    const { tip, markers, layer } = hover(spec, 1, { render: () => null });
    expect(tip).toBeNull();
    expect(markers).toBe(1);
    expect(layer.children).toHaveLength(2); // crosshair + marker
  });

  it('survives a throwing renderer by falling back to the built-in tooltip', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const custom = hover(spec, 1, {
      render: () => {
        throw new Error('boom');
      },
    });
    expect(custom.tip!.outerHTML).toBe(hover(spec, 1).tip!.outerHTML);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('tooltipRenderer — positioning', () => {
  const spec = lineSpec({ series: [S('A', [10, 20, 30])] });

  it('is still the tooltip CSS part, and is positioned by the engine', () => {
    const { tip } = hover(spec, 1, { render: () => 'x' });
    expect(tip!.getAttribute('part')).toBe('tooltip');
    expect(tip!.style.position).toBe('absolute');
    expect(tip!.style.left).toMatch(/px$/);
    expect(tip!.style.top).toMatch(/px$/);
  });

  it('caps custom content at the chart box so a huge card still has room to flip', () => {
    const { tip } = hover(spec, 1, { render: () => 'x' });
    // chart is 400 wide → 4px of breathing room on each side
    expect(tip!.style.maxWidth).toBe('392px');
    expect(tip!.style.boxSizing).toBe('border-box');
  });

  it('does not put min-width / nowrap on custom content (they fight custom layouts)', () => {
    const { tip } = hover(spec, 1, { render: () => 'x' });
    expect(tip!.style.minWidth).toBe('');
    expect(tip!.style.whiteSpace).toBe('');
  });

  it('flips a custom card left of the crosshair near the right edge', () => {
    const scene = computeLayout(spec, theme, 400, 300);
    const layer = document.createElement('div');
    const wide = () => {
      const el = document.createElement('div');
      el.style.cssText = 'width:200px';
      return el;
    };
    renderHover(layer, scene, 2, spec.yFormatter, 'Roboto', { x: 380, y: 150 }, 'vertical', -1, { render: wide });
    const tip = layer.querySelector('[part="tooltip"]') as HTMLElement;
    // offsetWidth is 0 under mock-doc, so the fallback width (120) drives the
    // flip: at the last x the card must sit left of it, never off the canvas.
    const left = parseFloat(tip.style.left);
    expect(left).toBeLessThan(scene.xPositions[2]);
    expect(left).toBeGreaterThanOrEqual(4);
  });
});
