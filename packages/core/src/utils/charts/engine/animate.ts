/*
 * Chart engine — entry motion
 * ===========================================================
 * The intro animation played once on first render. Several
 * variants (see MdChartAnimation) all reduce to a pure
 * scene→scene transform plus an optional layer opacity, so both
 * renderer backends animate identically — the engine just draws
 * `stepAnimation(variant, scene, t)` per rAF frame. Honours
 * `prefers-reduced-motion` and a configurable duration.
 * ===========================================================
 */

import type { MdChartAnimation } from '../types';
import { withAlpha } from './color';
import type { Pt } from './geometry';
import type { RenderScene, SceneBar } from './scene';

/**
 * Shared intro duration in ms — MD3 `--md-sys-motion-duration-extra-long1`
 * (700ms), the length for a large, expressive entering transition. Every chart
 * type (line, area, bar, pie, sparkline) runs its entrance for exactly this long
 * so their intros play in lockstep.
 */
export const INTRO_MS = 700;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

// ── easings ────────────────────────────────────────────────

/**
 * Gentle critically-damped spring: 0 at t=0, settles at 1 with a
 * small (~2%) overshoot around the middle for an expressive feel.
 * May transiently exceed 1 (the overshoot) — callers that map it to
 * a bounded quantity (opacity, reveal fraction) must clamp.
 */
export function expressiveEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.exp(-7 * t) * Math.cos(6 * t);
}

/** MD3 decelerate — fast out, slow in, no overshoot. */
export function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

/** Symmetric accelerate→decelerate, for a deliberate "draw" sweep. */
export function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/**
 * Evaluate a CSS `cubic-bezier(x1, y1, x2, y2)` timing curve as a plain easing
 * function (the endpoints are fixed at P0 = (0,0) and P3 = (1,1), as in CSS).
 * For an input progress `x ∈ [0,1]` it solves the Bézier's x(t) = x for the
 * curve parameter t (Newton–Raphson, bisection fallback) and returns y(t).
 *
 * This is the bridge from the MD3 motion-easing TOKENS — which are authored as
 * `cubic-bezier(...)` — to the numeric per-frame eases the canvas engines need.
 * See `emphasizedDecelerate`.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return sampleY(t);
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    // Bisection fallback if Newton stalled or wandered out of the unit interval.
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) break;
      if (err > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

/**
 * MD3 `--md-sys-motion-easing-emphasized-decelerate`:
 * `cubic-bezier(0.05, 0.7, 0.1, 1)` — the curve for an element ENTERING the
 * frame (a fast start easing into a long, gentle settle, no overshoot). This is
 * the single shared easing behind every chart's entrance.
 */
export const emphasizedDecelerate = cubicBezier(0.05, 0.7, 0.1, 1);

/** The eased-progress function for a variant. */
export function easingFor(variant: MdChartAnimation): (t: number) => number {
  switch (variant) {
    case 'draw':
    case 'stagger':
      return easeInOutCubic;
    case 'expressive':
    case 'grow':
    case 'fade':
    default:
      // The unified MD3 entering-element curve — one easing for every chart's
      // grow-and-fade intro.
      return emphasizedDecelerate;
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── spatial transforms (scene → scene) ─────────────────────

/** Whether a bar animates along the horizontal (value-on-x) axis. Prefer the
 *  explicit layout flag; fall back to the aspect ratio for flagless bars (e.g.
 *  line-chart reference bands) — a short vertical DATA bar can be wider than
 *  tall, so the heuristic alone would misclassify it. */
function isHorizontalBar(b: SceneBar): boolean {
  return b.horizontal ?? b.w > b.h;
}

/**
 * A bar grows out of the value axis' zero line.
 *
 * Both of the bar's edges are scaled about `base`, not just its length, which is
 * what makes a STACK animate as one column: every segment's boundary moves in
 * proportion, so the segments stay joined and stretch apart as the column rises.
 * Scaling each segment about its own base instead leaves a row of zero-height
 * slivers stranded partway up the plot at t=0 — they read as stray horizontal
 * lines, and the segments arrive as separate slices rather than as one bar.
 *
 * With no `base` (a bar in a chart that never computed one) it falls back to the
 * bar's own baseline edge, which is the same thing for an unstacked bar.
 */
function growBar(b: SceneBar, e: number, base?: number): SceneBar {
  if (isHorizontalBar(b)) {
    const x0 = base ?? b.x;
    const a = x0 + (b.x - x0) * e;
    const z = x0 + (b.x + b.w - x0) * e;
    return { ...b, x: Math.min(a, z), w: Math.abs(z - a) };
  }
  const y0 = base ?? b.y + b.h;
  const a = y0 + (b.y - y0) * e;
  const z = y0 + (b.y + b.h - y0) * e;
  return { ...b, y: Math.min(a, z), h: Math.abs(z - a) };
}

/** The scene with its data geometry lifted from the axis baseline to
 *  progress `e` (0..1). */
/**
 * Animate the intro of the scene's slices.
 *
 * PIE: the whole ring GROWS from the centre — every wedge's radii scaled by `e`
 * with its angles already final — so the donut scales up as one and fades in
 * with the rest of the layer. This is the pie's take on the single shared
 * grow-and-fade entrance every chart type uses (no per-petal stagger or sweep).
 *
 * POLAR BAR: each concentric ring GROWS from its baseline — every segment scaled
 * in proportion about the ring's start angle by `e`, so the whole band opens as
 * one (its segments staying joined) exactly the way a stacked linear bar rises
 * from its baseline. Growing the RADIUS instead would collapse every ring to the
 * centre, which a wrapped value axis never does.
 */
function animateSlices(scene: RenderScene, e: number): RenderScene['slices'] {
  if (scene.polar) {
    // The angle each ring grows FROM — its start, the value baseline.
    const base = new Map<number, number>();
    for (const s of scene.slices) {
      const cur = base.get(s.dataIndex);
      if (cur === undefined || s.startAngle < cur) base.set(s.dataIndex, s.startAngle);
    }
    return scene.slices.map((s) => {
      const s0 = base.get(s.dataIndex)!;
      // Scale both edges about the ring's baseline, so the band grows as a whole
      // and the segments stay joined — the radial twin of growBar (which scales a
      // stack's edges about the value axis' zero line).
      return { ...s, startAngle: s0 + (s.startAngle - s0) * e, endAngle: s0 + (s.endAngle - s0) * e };
    });
  }
  // Uniform grow-from-centre: radii × e, angles unchanged. The layer fade
  // (see stepAnimation) carries the opacity.
  const g = clamp01(e);
  return scene.slices.map((s) => ({ ...s, innerR: s.innerR * g, outerR: s.outerR * g }));
}

export function easeScene(scene: RenderScene, e: number): RenderScene {
  const baseY = scene.plot.y + scene.plot.height;
  const lift = (y: number) => baseY + (y - baseY) * e;
  const liftPts = (pts: Pt[]) => pts.map((p) => ({ x: p.x, y: lift(p.y) }));
  return {
    ...scene,
    lines: scene.lines.map((l) => {
      if (!l.radial) return { ...l, points: liftPts(l.points) };
      // A radial separator must not be LIFTED (see ScenePolyline.radial), but it
      // does have to grow with the ring it divides, or it hangs at full length
      // over a pie that is still unfolding.
      const cx = scene.plot.x + scene.plot.width / 2;
      const cy = scene.plot.y + scene.plot.height / 2;
      const g = clamp01(e);
      return { ...l, points: l.points.map((pt) => ({ x: cx + (pt.x - cx) * g, y: cy + (pt.y - cy) * g })) };
    }),
    areas: scene.areas.map((a) => ({ ...a, points: liftPts(a.points), basePoints: a.basePoints ? liftPts(a.basePoints) : undefined })),
    markers: scene.markers.map((m) => ({ ...m, y: lift(m.y) })),
    glyphs: scene.glyphs?.map((g) => ({ ...g, y: lift(g.y) })),
    endLabels: scene.endLabels?.map((e) => ({ ...e, y: lift(e.y) })),
    bars: scene.bars.map((b) => growBar(b, e, scene.barBaseline)),
    slices: animateSlices(scene, e),
  };
}

/** How much of a drill is spent fading the arriving level in over the one it
 *  is opening out of. */
const DRILL_CROSSFADE = 0.5;

/** The real (non-hover-band) slices of a pie scene, in ring order. */
function ringSlices(scene: RenderScene) {
  return scene.slices.filter((s) => !s.pill && s.endAngle !== s.startAngle);
}

/**
 * A drill-down as the clicked wedge SPLITTING into its contents.
 *
 * At `p = 0` this is the outer level, untouched. As `p` rises the pivot wedge's
 * angular span opens out toward the whole ring while its siblings close into
 * what is left, and the inner level — laid inside that opening span, and fading
 * up — takes its place. At `p = 1` it is the inner level, exactly.
 *
 * Nothing scales, moves or blooms: radii are each level's own and only ANGLES
 * are interpolated, so at every frame the picture is a complete ring made of
 * correctly-shaped wedges. Growing the new level from a point instead reads as
 * a second chart arriving rather than as this one opening up.
 *
 * The opening span also rotates its leading edge back to the ring's start, or
 * the inner level would arrive turned by however far round the pivot sat.
 *
 * Returns the two layers to paint, the second over the first.
 */
export function splitScene(
  outer: RenderScene,
  inner: RenderScene,
  pivotIndex: number,
  pRaw: number,
): { base: RenderScene; over: RenderScene; overAlpha: number } | null {
  const p = clamp01(pRaw);
  const outs = ringSlices(outer);
  const ins = ringSlices(inner);
  if (!outs.length || !ins.length) return null;
  const pivot = outs.find((s) => s.dataIndex === pivotIndex) ?? outs[0];
  const ringStart = outs[0].startAngle;
  const total = outs.reduce((acc, s) => acc + (s.endAngle - s.startAngle), 0);
  const pivotSpan = pivot.endAngle - pivot.startAngle;
  const rest = total - pivotSpan;
  // The window the pivot has opened: its own span at p=0, the whole ring at 1.
  const w = pivotSpan + rest * p;
  const w0 = pivot.startAngle + (ringStart - pivot.startAngle) * p;
  // What the siblings have left to share.
  const k = Math.abs(rest) < 1e-9 ? 0 : (total - w) / rest;

  // Siblings follow the window in ring order, wrapping past the pivot.
  const order = [...outs.slice(outs.indexOf(pivot) + 1), ...outs.slice(0, outs.indexOf(pivot))];
  let cursor = w0 + w;
  const base = order.map((s) => {
    const span = (s.endAngle - s.startAngle) * k;
    const a0 = cursor;
    cursor += span;
    return { ...s, startAngle: a0, endAngle: cursor };
  });
  base.push({ ...pivot, startAngle: w0, endAngle: w0 + w });

  // The inner level, laid inside that window.
  const innerStart = ins[0].startAngle;
  const innerTotal = ins.reduce((acc, s) => acc + (s.endAngle - s.startAngle), 0) || 1;
  const map = (a: number) => w0 + ((a - innerStart) / innerTotal) * w;
  const over = ins.map((s) => ({ ...s, startAngle: map(s.startAngle), endAngle: map(s.endAngle) }));

  return {
    base: { ...outer, slices: base, lines: [], gridlines: [], texts: [] },
    over: { ...inner, slices: over, lines: [], gridlines: [], texts: [], background: undefined },
    overAlpha: clamp01(p / DRILL_CROSSFADE),
  };
}

/** Trim an x-monotonic polyline to x ≤ cutX, interpolating a boundary/** Trim an x-monotonic polyline to x ≤ cutX, interpolating a boundary
 *  point on the straddling segment so the reveal edge is smooth. */
function trimPolylineX(pts: Pt[], cutX: number): Pt[] {
  if (!pts.length) return pts;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x <= cutX) {
      out.push(p);
    } else {
      if (i > 0) {
        const a = pts[i - 1];
        const span = p.x - a.x || 1;
        const f = (cutX - a.x) / span;
        out.push({ x: cutX, y: a.y + (p.y - a.y) * f });
      }
      break;
    }
  }
  return out;
}

/** The scene revealed left-to-right (draw): lines/areas trimmed at the
 *  sweep, markers past the sweep hidden, bars stagger-grown as the sweep
 *  crosses them, pie slices swept angularly. Chrome stays static. */
/**
 * A drill transition for bars: the incoming level's columns RISE from the
 * baseline at their final slots — a cascade, not a slide.
 *
 * Down (`split = true`) grows the columns in a left-to-right CASCADE (each
 * category a beat after the last); up (`split = false`) grows them all together.
 * Either way a bar keeps its final position and full width and only its HEIGHT
 * grows in, so nothing ever appears as a small/compressed bar mid-transition.
 * `from`/`size` (the old pivot band) are retained in the signature but unused.
 */
/** Fraction of the timeline the LAST category waits before it begins to part, so
 *  the children CASCADE out of the parent in reading order rather than all at
 *  once — the choreography that makes the split feel expressive. */
const DRILL_STAGGER = 0.3;

export function drillScene(scene: RenderScene, from: number, size: number, t: number, split = false): RenderScene {
  // `from`/`size` (the clicked column's band) are no longer read: the drill grows
  // in place at each bar's FINAL slot rather than unfolding out of the column,
  // which is what removed the small/thin bar it used to flash mid-transition.
  const tc = clamp01(t);
  const maxDi = split ? Math.max(0, ...scene.bars.map((b) => b.dataIndex)) : 0;
  return {
    ...scene,
    bars: scene.bars.map((b) => {
      // Grow every bar from the baseline at its final slot — no horizontal motion,
      // so a child is a full-width bar rising in place, never a thin/small bar.
      // DOWN cascades left-to-right (each category begins a beat after the last —
      // the stagger); UP rises as one block (split=false → every lag is 0). The
      // rise uses the SAME MD3 emphasized-decelerate curve as the chart intro, so
      // a drilled level rises exactly like a freshly-entering one (and, being
      // monotonic to 1, never overshoots past a bar's own gridline).
      const lag = split && maxDi > 0 ? (b.dataIndex / maxDi) * DRILL_STAGGER : 0;
      const g = emphasizedDecelerate(clamp01((tc - lag) / (1 - lag || 1)));
      return growBar(b, g, scene.barBaseline);
    }),
  };
}

export function revealScene(scene: RenderScene, e: number): RenderScene {
  const p = scene.plot;
  const ec = clamp01(e);
  const cutX = p.x + ec * p.width;
  const cutY = p.y + ec * p.height;
  return {
    ...scene,
    lines: scene.lines.map((l) => (l.radial ? l : { ...l, points: trimPolylineX(l.points, cutX) })),
    areas: scene.areas.map((a) => ({
      ...a,
      points: trimPolylineX(a.points, cutX),
      basePoints: a.basePoints ? trimPolylineX(a.basePoints, cutX) : undefined,
    })),
    markers: scene.markers.filter((m) => m.x <= cutX),
    glyphs: scene.glyphs?.filter((g) => g.x <= cutX),
    bars: scene.bars.map((b) => {
      // Sweep along the category axis: x for vertical bars, y for horizontal.
      const localE = isHorizontalBar(b) ? clamp01((cutY - b.y) / Math.max(b.h, 1)) : clamp01((cutX - b.x) / Math.max(b.w, 1));
      return growBar(b, localE, scene.barBaseline);
    }),
    slices: scene.slices.map((s) => ({ ...s, endAngle: s.startAngle + (s.endAngle - s.startAngle) * ec })),
  };
}

/** Distinct series indices present in the scene's lines, ascending. */
function seriesOrder(scene: RenderScene): number[] {
  const set = new Set<number>();
  for (const l of scene.lines) set.add(l.seriesIndex ?? 0);
  return [...set].sort((a, b) => a - b);
}

/**
 * Sequential per-series reveal: each series draws left-to-right in its own
 * 1/N slice of the timeline, so line 1 finishes before line 2 begins. `tRaw`
 * is the whole-timeline progress (0..1); each series' local progress is
 * `tRaw*N - rank`, eased. Glyphs / end-labels carry no series index, so they
 * follow the global sweep.
 */
export function staggerReveal(scene: RenderScene, tRaw: number): RenderScene {
  const order = seriesOrder(scene);
  const n = order.length || 1;
  const rank = new Map(order.map((si, k) => [si, k]));
  const p = scene.plot;
  const cutXFor = (si: number | undefined): number => {
    const k = rank.get(si ?? 0) ?? 0;
    return p.x + easeInOutCubic(clamp01(tRaw * n - k)) * p.width;
  };
  const globalCut = p.x + easeInOutCubic(clamp01(tRaw)) * p.width;
  return {
    ...scene,
    lines: scene.lines.map((l) => (l.radial ? l : { ...l, points: trimPolylineX(l.points, cutXFor(l.seriesIndex)) })),
    areas: scene.areas.map((a) => ({
      ...a,
      points: trimPolylineX(a.points, cutXFor(a.seriesIndex)),
      basePoints: a.basePoints ? trimPolylineX(a.basePoints, cutXFor(a.seriesIndex)) : undefined,
    })),
    markers: scene.markers.filter((m) => m.x <= cutXFor(m.seriesIndex)),
    glyphs: scene.glyphs?.filter((g) => g.x <= globalCut),
    bars: scene.bars.map((b) => growBar(b, clamp01((globalCut - b.x) / Math.max(b.w, 1)), scene.barBaseline)),
    slices: scene.slices.map((s) => ({ ...s, endAngle: s.startAngle + (s.endAngle - s.startAngle) * clamp01(tRaw) })),
  };
}

// ── per-frame driver ───────────────────────────────────────

export interface AnimationSpec {
  /** Variant; falls back to `animate === false ? 'none' : 'expressive'`. */
  animation?: MdChartAnimation;
  /** Duration override in ms; ≤ 0 disables. Default INTRO_MS. */
  animationDuration?: number;
  /** Legacy on/off flag (pre-variant). `false` → `'none'`. */
  animate?: boolean;
}

/** Resolve the effective variant + duration from a spec (with back-compat). */
export function resolveIntro(spec: AnimationSpec): { variant: MdChartAnimation; duration: number } {
  let variant: MdChartAnimation = spec.animation ?? (spec.animate === false ? 'none' : 'expressive');
  const requested = spec.animationDuration != null ? spec.animationDuration : INTRO_MS;
  // A finite positive duration is required; 0, negative, NaN and Infinity all
  // disable the intro (an Infinity/NaN duration would make the rAF loop's
  // `tRaw >= 1` never fire → a non-terminating animation).
  const ok = Number.isFinite(requested) && requested > 0;
  if (!ok) variant = 'none';
  return { variant, duration: ok ? requested : INTRO_MS };
}

/** One animation frame: the scene to draw + the canvas-layer opacity to
 *  apply, for a raw timeline progress `tRaw` (0..1). */
/**
 * Fade the GRIDLINES in over the first half of the intro.
 *
 * At t=0 the data has no extent yet — a bar has no height, a line no length —
 * so a grid drawn at full strength is the only thing on the canvas: a set of
 * horizontal rules that flash up before the chart arrives. Ramping them in
 * ahead of the data (full strength by the halfway point) means the plot fills
 * rather than the grid appearing first and waiting to be used.
 *
 * The axis frame is deliberately NOT ramped: it is the edge of the plot, not a
 * reading, and it holds the shape of the chart steady while the rest arrives.
 */
function fadeGrid(scene: RenderScene, e: number): RenderScene['gridlines'] {
  const a = clamp01(e * 2);
  if (a >= 1) return scene.gridlines;
  return scene.gridlines.map((l) => ({ ...l, color: withAlpha(l.color, a) }));
}

export function stepAnimation(variant: MdChartAnimation, target: RenderScene, tRaw: number): { scene: RenderScene; alpha: number } {
  const e = easingFor(variant)(clamp01(tRaw));
  switch (variant) {
    case 'fade':
      return { scene: target, alpha: clamp01(e) };
    case 'draw':
      return { scene: { ...revealScene(target, e), gridlines: fadeGrid(target, e) }, alpha: 1 };
    case 'stagger': {
      // staggerReveal applies per-series easing internally, so it takes raw t.
      const t = clamp01(tRaw);
      return { scene: { ...staggerReveal(target, t), gridlines: fadeGrid(target, t) }, alpha: 1 };
    }
    case 'grow':
    case 'expressive':
    default:
      // The single shared entrance: the geometry GROWS from the baseline
      // (easeScene — bars/areas/lines rise, pie scales from its centre) while the
      // whole layer FADES in (alpha). Same curve, same look, for every chart type.
      return { scene: easeScene(target, e), alpha: clamp01(e) };
  }
}
