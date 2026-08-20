import { drawSceneCanvas } from './renderer-canvas';
import type { RenderScene, SceneSegment, SceneArea } from './scene';

/*
 * What the Canvas2D backend actually PAINTS, as opposed to what the scene says.
 * The dash on an axis line survived the whole pipeline into the scene and was
 * then dropped here — the gridline loop set it, the axis-line loop did not — so
 * `dash: 'dashed'` on an axis looked like a no-op on screen. These pin the
 * stroke calls, which a layout spec can't see.
 */

type Call = { op: string; args: unknown[] };

/** Minimal 2D context that records the calls the renderer makes. */
function recordingCtx() {
  const calls: Call[] = [];
  const push = (op: string) => (...args: unknown[]) => void calls.push({ op, args });
  const ctx = {
    calls,
    canvas: { width: 400, height: 300 },
    setTransform: push('setTransform'),
    clearRect: push('clearRect'),
    fillRect: push('fillRect'),
    beginPath: push('beginPath'),
    closePath: push('closePath'),
    moveTo: push('moveTo'),
    lineTo: push('lineTo'),
    arc: push('arc'),
    stroke: push('stroke'),
    fill: push('fill'),
    save: push('save'),
    restore: push('restore'),
    clip: push('clip'),
    rect: push('rect'),
    setLineDash: push('setLineDash'),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
  } as unknown as CanvasRenderingContext2D & { calls: Call[] };
  return ctx;
}

const seg = (over: Partial<SceneSegment> = {}): SceneSegment => ({
  x1: 10,
  y1: 100,
  x2: 300,
  y2: 100,
  color: '#79747E',
  width: 1,
  ...over,
});

const scene = (over: Partial<RenderScene> = {}): RenderScene => ({
  width: 400,
  height: 300,
  plot: { x: 10, y: 10, width: 380, height: 280 },
  gridlines: [],
  axisLines: [],
  areas: [],
  bars: [],
  slices: [],
  lines: [],
  markers: [],
  texts: [],
  legend: [],
  xPositions: [],
  xValues: [],
  xLabels: [],
  hoverPoints: [],
  ...over,
});

/** The dash patterns handed to setLineDash, in call order. */
const dashesSet = (ctx: { calls: Call[] }) =>
  ctx.calls.filter((c) => c.op === 'setLineDash').map((c) => c.args[0] as number[]);

describe('renderer-canvas — dashed chrome', () => {
  it('strokes an axis line with its dash pattern', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, scene({ axisLines: [seg({ dash: [3.5, 3] })] }));
    expect(dashesSet(ctx)).toContainEqual([3.5, 3]);
  });

  it('strokes a gridline with its dash pattern', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, scene({ gridlines: [seg({ dash: [1, 2.6] })] }));
    expect(dashesSet(ctx)).toContainEqual([1, 2.6]);
  });

  it('resets the dash after each dashed segment, so the next one is solid', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, scene({ axisLines: [seg({ dash: [3.5, 3] }), seg({ y1: 200, y2: 200 })] }));
    const set = dashesSet(ctx);
    // …[3.5,3] then [] — the plain segment must not inherit the pattern.
    expect(set[0]).toEqual([3.5, 3]);
    expect(set[1]).toEqual([]);
  });

  it('never sets a pattern for undashed chrome', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, scene({ axisLines: [seg()], gridlines: [seg({ y1: 50, y2: 50 })] }));
    // The series-line pass always resets to solid; what matters is that no
    // PATTERN was ever set.
    expect(dashesSet(ctx).every((d) => d.length === 0)).toBe(true);
  });
});

/**
 * A context that records gradient geometry and stops, so the fade a fill
 * actually paints can be asserted rather than eyeballed.
 */
function gradientCtx() {
  const grads: { from: number[]; to: number[]; stops: [number, string][] }[] = [];
  const noop = () => undefined;
  const ctx = {
    canvas: { width: 400, height: 300 },
    setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop,
    closePath: noop, moveTo: noop, lineTo: noop, arc: noop, stroke: noop,
    fill: noop, save: noop, restore: noop, clip: noop, rect: noop, setLineDash: noop,
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      const g = { from: [x0, y0], to: [x1, y1], stops: [] as [number, string][] };
      grads.push(g);
      return { addColorStop: (o: number, c: string) => void g.stops.push([o, c]) };
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, grads };
}

describe('area fill gradient', () => {
  const area = (over: Partial<SceneArea>): SceneArea => ({
    points: [
      { x: 0, y: 20 },
      { x: 100, y: 20 },
    ],
    baselineY: 100,
    colorTop: 'rgba(1,1,1,0.5)',
    colorBottom: 'rgba(1,1,1,0.02)',
    ...over,
  });
  const draw = (a: SceneArea) => {
    const { ctx, grads } = gradientCtx();
    drawSceneCanvas(ctx, scene({ areas: [a] }));
    return grads[0];
  };

  it('spans the whole painted extent when a series crosses the baseline', () => {
    // Line runs from y=20 (above zero) to y=160 (below it); baseline is y=100.
    const g = draw(area({ points: [{ x: 0, y: 20 }, { x: 100, y: 160 }] }));
    expect(g.from[1]).toBe(20);
    expect(g.to[1]).toBe(160);
    // The faint stop lands ON the baseline, solid at both ends — so the fill
    // fades toward zero from above AND below instead of the negative half
    // being clamped to the transparent end stop.
    expect(g.stops.map(([o]) => Number(o.toFixed(3)))).toEqual([0, 0.571, 1]);
    expect(g.stops[0][1]).toBe('rgba(1,1,1,0.5)');
    expect(g.stops[1][1]).toBe('rgba(1,1,1,0.02)');
    expect(g.stops[2][1]).toBe('rgba(1,1,1,0.5)');
  });

  it('stays a plain two-stop fade for an all-positive series', () => {
    const g = draw(area({}));
    expect(g.stops).toEqual([
      [0, 'rgba(1,1,1,0.5)'],
      [1, 'rgba(1,1,1,0.02)'],
    ]);
  });

  it('fades outward from the baseline for an all-negative series', () => {
    const g = draw(area({ points: [{ x: 0, y: 150 }, { x: 100, y: 180 }] }));
    // Baseline is the top of the painted extent here, so the faint stop leads.
    expect(g.stops).toEqual([
      [0, 'rgba(1,1,1,0.02)'],
      [1, 'rgba(1,1,1,0.5)'],
    ]);
  });

  it('runs along x for an inverted fill', () => {
    const g = draw(
      area({
        horizontal: true,
        baselineY: 10,
        points: [{ x: 200, y: 0 }, { x: 260, y: 50 }],
        basePoints: [{ x: 10, y: 0 }, { x: 10, y: 50 }],
      }),
    );
    expect(g.from).toEqual([10, 0]);
    expect(g.to).toEqual([260, 0]);
  });
});

describe('Canvas2D backend — a slice’s gap is its own geometry', () => {
  const pieScene = (over: Partial<RenderScene> = {}): RenderScene => ({
    width: 400,
    height: 300,
    plot: { x: 0, y: 0, width: 400, height: 300 },
    gridlines: [],
    axisLines: [],
    areas: [],
    bars: [],
    slices: [
      { cx: 200, cy: 150, innerR: 0, outerR: 100, startAngle: 0, endAngle: Math.PI, color: '#6750A4', dataIndex: 0, gap: 3, gapColor: '#fff' },
      { cx: 200, cy: 150, innerR: 0, outerR: 100, startAngle: Math.PI, endAngle: Math.PI * 2, color: '#B3261E', dataIndex: 1, gap: 3, gapColor: '#fff' },
    ],
    lines: [],
    markers: [],
    texts: [],
    legend: [],
    xPositions: [],
    xValues: [],
    xLabels: [],
    hoverPoints: [],
    ...over,
  });

  /** Every point the path visits, in order. */
  const path = (ctx: ReturnType<typeof recordingCtx>) =>
    ctx.calls.filter((c) => c.op === 'moveTo' || c.op === 'lineTo').map((c) => c.args as number[]);

  it('paints what shows through the gaps as ONE shape under the slices', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, pieScene());
    // Two abutting shapes each land half-covered pixels on their shared edge and
    // source-over does not add those back to full, so a fill per slice would
    // leave a faint seam down the middle of every gap.
    const firstFill = ctx.calls.findIndex((c) => c.op === 'fill');
    const begins = ctx.calls.slice(0, firstFill).filter((c) => c.op === 'beginPath');
    expect(begins).toHaveLength(1);
  });

  it('keeps the gap the same width at the hub as at the rim', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, pieScene({
      slices: [
        { cx: 200, cy: 150, innerR: 4, outerR: 100, startAngle: 0, endAngle: Math.PI, color: '#6750A4', dataIndex: 0, gap: 3 },
        { cx: 200, cy: 150, innerR: 4, outerR: 100, startAngle: Math.PI, endAngle: Math.PI * 2, color: '#B3261E', dataIndex: 1, gap: 3 },
      ],
    }));
    // Both wedges share the horizontal diameter, so their edges near it are the
    // two sides of one gap. A constant offset means the same clearance at each
    // end of it — the taper it replaces pinched shut toward the middle.
    const near = path(ctx).filter(([x, y]) => x > 200 && Math.abs(y - 150) < 4);
    const at = (x: number) => near.filter((p) => Math.abs(p[0] - x) < 6).map(([, y]) => Math.abs(y - 150));
    expect(Math.max(...at(204))).toBeCloseTo(1.5, 1);
    expect(Math.max(...at(300))).toBeCloseTo(1.5, 1);
  });

  it('leaves a lone full-circle slice whole', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, pieScene({
      slices: [{ cx: 200, cy: 150, innerR: 0, outerR: 100, startAngle: 0, endAngle: Math.PI * 2, color: '#6750A4', dataIndex: 0, gap: 3 }],
    }));
    // Nothing to stand clear of, so no bite taken out of it: the edge stays on
    // the true radial ray rather than being inset off it.
    for (const [, y] of path(ctx)) expect(y).toBeCloseTo(150, 6);
  });
});

describe('Canvas2D backend — corner rounding', () => {
  const ring = (over: Record<string, unknown> = {}): RenderScene => ({
    width: 400,
    height: 300,
    plot: { x: 0, y: 0, width: 400, height: 300 },
    gridlines: [],
    axisLines: [],
    areas: [],
    bars: [],
    slices: [
      {
        cx: 200, cy: 150, innerR: 60, outerR: 100,
        startAngle: 0, endAngle: Math.PI / 2,
        color: '#6750A4', dataIndex: 0, cornerRadius: 6, ...over,
      } as never,
    ],
    lines: [],
    markers: [],
    texts: [],
    legend: [],
    xPositions: [],
    xValues: [],
    xLabels: [],
    hoverPoints: [],
  });

  const arcs = (ctx: ReturnType<typeof recordingCtx>) =>
    ctx.calls.filter((c) => c.op === 'arc').map((c) => c.args as number[]);

  it('rounds a donut segment at BOTH ends, not just the rim', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, ring());
    // Two corners at each end plus the two band arcs.
    const corners = arcs(ctx).filter((a) => a[2] === 6);
    expect(corners).toHaveLength(4);
    // The inner pair's circles sit OUTSIDE the hole, at innerR + r; the outer
    // pair's inside the rim, at outerR - r.
    const radii = corners.map((a) => Math.hypot(a[0] - 200, a[1] - 150)).sort((x, y) => x - y);
    expect(radii[0]).toBeCloseTo(66, 4);
    expect(radii[1]).toBeCloseTo(66, 4);
    expect(radii[2]).toBeCloseTo(94, 4);
    expect(radii[3]).toBeCloseTo(94, 4);
  });

  it('leaves a solid pie’s apex alone — there is no corner there to round', () => {
    const ctx = recordingCtx();
    drawSceneCanvas(ctx, ring({ innerR: 0 }));
    expect(arcs(ctx).filter((a) => a[2] === 6)).toHaveLength(2);
  });

  it('clamps the radius by the INNER pair, which has the least room', () => {
    const ctx = recordingCtx();
    // A narrow band: at innerR the two corners have far less between them than
    // the outer pair does, so an unclamped radius would make them overlap.
    drawSceneCanvas(ctx, ring({ innerR: 20, startAngle: 0, endAngle: 0.2, cornerRadius: 12 }));
    const r = arcs(ctx).filter((a) => Math.abs(a[2] - 100) > 1 && Math.abs(a[2] - 20) > 1)[0]?.[2] ?? 0;
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(20 * Math.tan(0.2 / 4) + 1e-6);
  });
});
