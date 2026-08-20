/*
 * Chart engine — BarChartEngine
 * ===========================================================
 * The bar-chart sibling of LineChartEngine. Same canvas +
 * DOM-overlay plumbing and the same render pipeline, but drives
 * computeBarLayout and adds bar-appropriate interaction: hover
 * resolves the nearest category along the main axis (x for vertical,
 * y for horizontal) and clicks hit-test the actual bar rectangles.
 * ===========================================================
 */

import { computeBarLayout, type BarChartSpec } from './bar-layout';
import type { EngineTheme } from './layout';
import { drawSceneCanvas } from './renderer-canvas';
import { syncOverlay, renderBarLabels } from './overlay';
import { clearHover, renderHover, type HoverOptions } from './hover';
import { watchDevicePixelRatio, type DprWatcher } from './dpr';
import { resolveIntro, stepAnimation, prefersReducedMotion, drillScene } from './animate';
import { mixColor } from './color';
import { nearestIndex } from './hit-test';
import { isRtl, mirrorScene, watchDirection, type DirectionWatcher } from './rtl';
import type { MdChartAnimation } from '../types';
import type { EngineCallbacks } from './chart';
import type { LegendItem, RenderScene, SceneBar, SceneSlice } from './scene';

/** A pointer's hit-test against one annular segment: inside its radius band AND
 *  its angular span (folded so a rotated / negative range still works). */
function pointInSlice(px: number, py: number, s: SceneSlice): boolean {
  const dx = px - s.cx;
  const dy = py - s.cy;
  const r = Math.hypot(dx, dy);
  if (r < s.innerR || r > s.outerR) return false;
  const lo = Math.min(s.startAngle, s.endAngle);
  const hi = Math.max(s.startAngle, s.endAngle);
  const twoPi = Math.PI * 2;
  let d = (Math.atan2(dy, dx) - lo) % twoPi;
  if (d < 0) d += twoPi;
  return d <= hi - lo;
}

/** The polar ring segment under the pointer, or null in the hole / gaps / outside
 *  the rings — which is what lets the tooltip appear ONLY over a segment. */
export function sliceAt(slices: SceneSlice[], px: number, py: number): SceneSlice | null {
  for (const s of slices) if (s.endAngle !== s.startAngle && pointInSlice(px, py, s)) return s;
  return null;
}

/** How far a faded-out ring segment recedes toward the surface at full dim. */
const POLAR_DIM = 0.62;
/** Fade in / out of the spotlight, ms. */
const POLAR_FADE_MS = 200;
/** Dwell before the tooltip appears on a freshly-hovered segment, ms. */
const POLAR_DWELL_MS = 220;

const sliceKey = (dataIndex: number, seriesIndex: number | undefined): string => `${dataIndex}:${seriesIndex ?? -1}`;

/** Apply the per-segment dim (0 = full colour, 1 = fully faded to the surface) so
 *  the spotlight can fade in and out rather than snapping. */
export function emphasizePolar(scene: RenderScene, dimByKey: Map<string, number>, surface: string): RenderScene {
  return {
    ...scene,
    slices: scene.slices.map((s) => {
      const d = dimByKey.get(sliceKey(s.dataIndex, s.seriesIndex)) ?? 0;
      return d > 0.002 ? { ...s, color: mixColor(s.color, surface, POLAR_DIM * d) } : s;
    }),
  };
}

const lerp = (a: number, b: number, e: number): number => a + (b - a) * e;

/** Time constant of the bar-race follow: a bar closes ~1 frame's worth of
 *  `dt/FOLLOW_MS` of its remaining gap each frame (an exponential ease-out). */
const FOLLOW_MS = 260;

/**
 * A stable-identity keyer for a scene's bars.
 *
 * When categories are UNIQUE, identity is the series + CATEGORY value: a bar race
 * reorders the categories every step, so the entity ("ATL") that was in slot 0
 * moves to slot 1 and stays the same bar sliding between ranks. When categories
 * REPEAT (a rolling window with labels like Q1,Q2,Q3,Q4,Q1), the category is not
 * an identity — the two "Q1" bars would collide onto one key and one would draw
 * on top of the other (flicker) — so identity falls back to the SLOT index.
 */
function keyerFor(scene: RenderScene): (b: SceneBar) => string {
  const cats = (scene.xValues ?? []).map((c) => (c == null ? '' : String(c)));
  const unique = cats.length > 0 && new Set(cats).size === cats.length;
  return unique ? (b) => `${b.seriesIndex}::${cats[b.dataIndex] ?? b.dataIndex}` : (b) => `${b.seriesIndex}#${b.dataIndex}`;
}

export function barKey(scene: RenderScene, b: SceneBar): string {
  return keyerFor(scene)(b);
}

/**
 * A key for EVERY bar in the scene, in order — occurrence-aware, so pieces that
 * would otherwise collide keep distinct identities.
 *
 * A value-axis BREAK splits one bar into several pieces that all carry the same
 * (series, category) — and so the same base key. Keyed only by that, they
 * collapse onto one entry in `displayed`, and the follow loop drops every piece
 * but the last: a broken-axis bar loses the piece past the break (its free end),
 * leaving the outlier stuck at the break line. The 2nd+ piece of a colliding key
 * gets a `~n` suffix so all pieces survive and each eases to its own target.
 */
function barKeys(scene: RenderScene): string[] {
  const base = keyerFor(scene);
  const seen = new Map<string, number>();
  return scene.bars.map((b) => {
    const k = base(b);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return n === 0 ? k : `${k}~${n}`;
  });
}

export function barsByKey(scene: RenderScene): Map<string, SceneBar> {
  const keys = barKeys(scene);
  const m = new Map<string, SceneBar>();
  scene.bars.forEach((b, i) => m.set(keys[i], b));
  return m;
}

/** A bar mid-slide between its old and new rank/length. */
export function lerpBar(from: SceneBar, to: SceneBar, e: number): SceneBar {
  return { ...to, x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), w: lerp(from.w, to.w, e), h: lerp(from.h, to.h, e) };
}

/** True if any bar moved / resized / entered / left between two scenes. */
export function barsDiffer(a: RenderScene, b: RenderScene): boolean {
  if (a.bars.length !== b.bars.length) return true;
  const am = barsByKey(a);
  for (const nb of b.bars) {
    const ob = am.get(barKey(b, nb));
    if (!ob) return true;
    if (Math.abs(ob.x - nb.x) > 0.5 || Math.abs(ob.y - nb.y) > 0.5 || Math.abs(ob.w - nb.w) > 0.5 || Math.abs(ob.h - nb.h) > 0.5) return true;
  }
  return false;
}

export class BarChartEngine {
  private canvas: HTMLCanvasElement;
  private overlay: HTMLDivElement;
  /** Legend lives here: same box, but NOT clipped, so a focus ring keeps its
   *  outer pixels where the legend hugs the plot edge. */
  private legendLayer: HTMLDivElement;
  /** Bar value labels get their own layer so they can be re-rendered from the
   *  bars' geometry each animation frame — the static overlay above is synced
   *  only once per render. */
  private barLabelLayer: HTMLDivElement;
  private hoverLayer: HTMLDivElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private spec: BarChartSpec | null = null;
  private theme: EngineTheme | null = null;
  private scene: RenderScene | null = null;
  private cb: EngineCallbacks = {};
  private hoverRaf = 0;
  private lastHoverIndex = -2;
  private hoverEnabled = true;
  /** When true, the pointer shows a `pointer` (hand) cursor over a bar, signalling
   *  the bar is actionable (e.g. drillable). Set by the component's `clickable`. */
  private clickable = false;
  private hoverOpts: HoverOptions = {};
  private hasRendered = false;
  private introRaf = 0;
  /** The DPR the last frame was drawn at, so a hover re-draw matches it. */
  private lastDpr = 1;
  /** The bar-race follow loop (eases bars toward the live target each frame). */
  private followRaf = 0;
  private followLast = 0;
  /** The polar segment currently spotlighted (category + series), or null. */
  private hoverSlice: { dataIndex: number; seriesIndex: number } | null = null;
  /** Per-segment dim strength (0..1), eased toward its target so the spotlight
   *  fades in and out. */
  private dimAnim = new Map<string, number>();
  private dimRaf = 0;
  private dimLast = 0;
  /** The pointer's last position, so a delayed tooltip opens where the mouse is. */
  private lastPointer = { x: 0, y: 0 };
  private tooltipTimer = 0;
  private tooltipShown = false;
  /** The bars currently ON SCREEN, keyed by identity — the start state a data
   *  update tweens FROM (mid-flight if one update interrupts another, so a race
   *  re-fed every frame follows smoothly). */
  private displayed: Map<string, SceneBar> | null = null;
  /** Armed by {@link drill}: the band along the category axis that the NEXT
   *  scene should unfold out of. Consumed by the first render after it. */
  private pendingDrill: { from: number; size: number; split: boolean } | null = null;
  private drillArmRaf = 0;
  private lastW = 0;
  private lastH = 0;
  private dprWatch: DprWatcher = watchDevicePixelRatio(() => this.render());
  /** Host is laid out right-to-left — the finished scene is mirrored. */
  private rtl = false;
  /** Re-render when the page (or an ancestor) flips direction, but only if THIS
   *  chart's own computed direction actually changed. */
  private dirWatch: DirectionWatcher = watchDirection(() => {
    if (isRtl(this.container) !== this.rtl) this.render();
  });

  constructor(private container: HTMLElement) {
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.canvas.setAttribute('part', 'plot-canvas');

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    this.legendLayer = document.createElement('div');
    this.legendLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible';

    this.barLabelLayer = document.createElement('div');
    this.barLabelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    this.hoverLayer = document.createElement('div');
    this.hoverLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    container.append(this.canvas, this.overlay, this.legendLayer, this.barLabelLayer, this.hoverLayer);
    this.ctx = this.canvas.getContext('2d');

    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('click', this.handleClick);
  }

  /** The current render scene — for diagnostics/tests. */
  getScene(): RenderScene | null {
    return this.scene;
  }

  /** Enable/disable the hover crosshair + tooltip. */
  setHoverEnabled(enabled: boolean): void {
    this.hoverEnabled = enabled;
    if (!enabled) clearHover(this.hoverLayer);
  }

  /** Show a hand cursor over bars to signal they're actionable (drillable). */
  setClickable(enabled: boolean): void {
    this.clickable = enabled;
    if (!enabled) this.canvas.style.cursor = '';
  }

  /** True when (cx, cy) — canvas-relative px — is inside any drawn bar rect. */
  private overBar(cx: number, cy: number): boolean {
    return !!this.scene?.bars.some((b) => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
  }

  /** Install the tooltip extras (custom content renderer / missing-value
   *  formatter). Presentation only — it never re-runs layout. */
  setTooltip(opts: HoverOptions): void {
    this.hoverOpts = opts;
  }



  /**
   * Feed the engine a new spec. `opts.animate === false` SNAPS to the new scene
   * instead of easing into it — for a zoom / pan, where the whole category layout
   * changes at once and easing the bars across it reads as them sliding together
   * (a view change is direct manipulation; it must track, not animate).
   */
  setSpec(spec: BarChartSpec, theme: EngineTheme, cb: EngineCallbacks = {}, opts: { animate?: boolean } = {}): void {
    this.spec = spec;
    this.theme = theme;
    this.cb = cb;
    this.render(opts);
  }

  resize(): void {
    // Skip the ResizeObserver's initial same-size callback so it can't cancel
    // the intro animation (see LineChartEngine.resize for the full rationale).
    const rect = this.container.getBoundingClientRect();
    if (Math.round(rect.width) === this.lastW && Math.round(rect.height) === this.lastH) return;
    this.render();
  }

  toDataURL(type = 'image/png'): string {
    // Guard for canvases that can't export (mock-doc / SSR): return '' rather
    // than throwing, so the host's toDataURL() degrades gracefully (matches the
    // line engine).
    return typeof this.canvas.toDataURL === 'function' ? this.canvas.toDataURL(type) : '';
  }

  dispose(): void {
    if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
    // stopIntro rather than a bare cancel. Nothing depends on the clear here —
    // dispose() removes the canvas a few lines down — but routing EVERY cancel
    // of introRaf through stopIntro is what makes the invariant hold: the
    // inline opacity is only ever non-empty while the entrance loop is live.
    // The bug this fixes was one cancel site that forgot the clear.
    this.stopIntro();
    cancelAnimationFrame(this.drillArmRaf);
    cancelAnimationFrame(this.dimRaf);
    cancelAnimationFrame(this.followRaf);
    clearTimeout(this.tooltipTimer);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('click', this.handleClick);
    this.dprWatch.dispose();
    this.dirWatch.dispose();
    this.canvas.remove();
    this.overlay.remove();
    this.barLabelLayer.remove();
    this.hoverLayer.remove();
    this.spec = null;
    this.scene = null;
  }

  private render(opts: { animate?: boolean } = {}): void {
    if (!this.spec || !this.theme) return;
    this.dprWatch.update();
    const rect = this.container.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 2 || h < 2) return;
    // Capture the previous scene + size BEFORE they are overwritten: a data
    // update at the SAME size tweens the bars to their new ranks; a resize / dpr
    // change snaps (sliding bars on a resize would be nonsense).
    const oldScene = this.scene;
    const sizeChanged = w !== this.lastW || h !== this.lastH;
    this.lastW = w;
    this.lastH = h;

    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    this.lastDpr = dpr;
    // A fresh scene invalidates any spotlight / pending tooltip, and a hover
    // callback queued against the OLD scene must not paint over the new one.
    this.hoverSlice = null;
    this.dimAnim.clear();
    cancelAnimationFrame(this.dimRaf);
    this.dimRaf = 0;
    if (this.hoverRaf) {
      cancelAnimationFrame(this.hoverRaf);
      this.hoverRaf = 0;
    }
    clearTimeout(this.tooltipTimer);
    this.tooltipShown = false;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;

    const hadCategories = this.scene?.xPositions.length ?? 0;
    // Layout runs left-to-right; an RTL host gets the finished frame mirrored, so
    // no part of the geometry / animation pipeline needs to know about direction.
    this.rtl = isRtl(this.container);
    const layout = (): RenderScene => {
      const s = computeBarLayout(this.spec!, this.theme!, w, h);
      return this.rtl ? mirrorScene(s) : s;
    };
    this.scene = layout();
    // A tooltip open over the OLD data must not survive a swap that replaced it:
    // after a drill it would name the level that just left. Re-resolving at the
    // same index keeps a live chart (a race re-feeding every frame) showing a
    // correct tooltip under a stationary pointer, and drops it when the index it
    // was on no longer exists.
    if (this.lastHoverIndex >= 0) {
      if (this.lastHoverIndex < this.scene.xPositions.length && hadCategories === this.scene.xPositions.length) {
        this.focusIndexInternal(this.lastHoverIndex);
      } else {
        clearHover(this.hoverLayer);
        this.lastHoverIndex = -1;
      }
    }
    syncOverlay(this.overlay, this.scene, this.theme.fontFamily, { onLegendClick: this.onLegendToggle }, this.rtl, this.legendLayer);
    // Two-pass legend: a wrapped legend's real extent isn't known until it's in
    // the DOM. Re-reserve the gutter to its measured height/width and re-lay-out
    // so a many-series legend never spills onto the plot.
    const legendEl = this.legendLayer.querySelector('[part="legend"]') as HTMLElement | null;
    if (legendEl && this.spec.legend && this.spec.legend !== 'none') {
      const side = this.spec.legend === 'left' || this.spec.legend === 'right';
      const extent = side ? legendEl.offsetWidth : legendEl.offsetHeight;
      if (extent > 0 && Math.abs((this.spec.legendExtent ?? -1) - extent) > 2) {
        this.spec.legendExtent = extent;
        this.scene = layout();
        syncOverlay(this.overlay, this.scene, this.theme.fontFamily, { onLegendClick: this.onLegendToggle }, this.rtl, this.legendLayer);
      }
    }
    const { variant, duration } = resolveIntro(this.spec);
    const drill = this.pendingDrill;
    const reduce = prefersReducedMotion();
    const motion = variant !== 'none' && !reduce;
    // An EMPTY scene is not a chart that has been shown. A host that hydrates
    // before its data lands (props assigned after upgrade — the docs/demo
    // pattern) renders once with no series at all; counting that as "rendered"
    // spent the entrance on nothing and left the real data to arrive
    // un-animated, on the FOLLOW path below. So the first render that actually
    // has geometry is the one that owns the entrance.
    const hasContent = this.scene.bars.length > 0 || this.scene.slices.length > 0;
    const animate = !this.hasRendered && motion;
    if (drill && motion) {
      this.hasRendered = true;
      this.playDrill(dpr, drill, duration);
      return;
    }
    if (animate) {
      this.hasRendered = hasContent;
      this.playIntro(dpr, variant, duration);
      return;
    }
    this.hasRendered = this.hasRendered || hasContent;
    // A data update at the same size → FOLLOW the new ranks/lengths (see
    // ensureFollow). Runs even with the ENTRY animation off (a race turns the
    // intro off but still wants ranks to slide) — gated on reduced-motion alone.
    // `|| this.followRaf` keeps the loop alive through a race's intermediate
    // no-change renders instead of the static branch resetting it.
    // `opts.animate === false` (a zoom / pan) skips the follow ease and snaps to
    // the windowed layout below — easing bars across a whole-layout change reads
    // as them sliding together.
    const changed = !!oldScene && barsDiffer(oldScene, this.scene);
    if (opts.animate !== false && !reduce && !sizeChanged && oldScene && (changed || this.followRaf)) {
      // Stop any intro/drill loop first — otherwise it keeps painting the same
      // canvas as the follow loop until it ends, and its terminal frame stomps
      // `displayed` mid-tween (flicker/jump). stopIntro (not a bare cancel):
      // the follow loop only paints geometry, so a cancel that left the
      // entrance's fade behind pinned this chart at opacity 0 forever.
      this.stopIntro();
      this.ensureFollow();
      return;
    }
    this.stopIntro();
    cancelAnimationFrame(this.followRaf);
    this.followRaf = 0;
    this.paint(this.scene, dpr);
    this.displayed = barsByKey(this.scene);
  }

  /**
   * Arm a drill transition for the NEXT scene: it will unfold out of the band
   * `index` occupies right now, rather than playing the ordinary entry
   * animation. Call this BEFORE swapping the data.
   *
   * `direction: 'up'` pivots on the whole plot instead of one column, which is
   * the visual inverse — the level being returned to opens out of everything
   * the level being left was filling.
   */
  drill(index: number, direction: 'down' | 'up' = 'down'): void {
    const scene = this.scene;
    if (!scene) return;
    const horizontal = !!this.spec?.horizontal;
    if (direction === 'up') {
      // Merge: the parent level opens out of the whole plot (grows from the axis).
      this.arm(horizontal ? { from: scene.plot.y, size: scene.plot.height, split: false } : { from: scene.plot.x, size: scene.plot.width, split: false });
      return;
    }
    const bars = scene.bars.filter((b) => b.dataIndex === index);
    if (!bars.length) {
      this.arm(null);
      return;
    }
    // Split: the children part out of the clicked column's band, at full height.
    const lo = Math.min(...bars.map((b) => (horizontal ? b.y : b.x)));
    const hi = Math.max(...bars.map((b) => (horizontal ? b.y + b.h : b.x + b.w)));
    this.arm({ from: lo, size: Math.max(1, hi - lo), split: true });
  }

  /**
   * Hold the drill until the NEXT FRAME rather than until the next render.
   *
   * A bar chart's level lives in two props — the series and the categories —
   * and each assignment re-renders synchronously. Consuming the arm on the
   * first render would animate the old data against the new categories and
   * leave the real swap un-animated, so it survives every render in the same
   * turn; the last one to run is the one that animates.
   */
  private arm(band: { from: number; size: number; split: boolean } | null): void {
    this.pendingDrill = band;
    cancelAnimationFrame(this.drillArmRaf);
    if (!band) return;
    this.drillArmRaf = requestAnimationFrame(() => {
      this.pendingDrill = null;
    });
  }

  /**
   * Clear the inline opacity the entrance fades the layers in with.
   *
   * The entrance is the ONLY thing that writes it, and the only thing that
   * clears it is the loop's own terminal frame — so every path that ends the
   * entrance early has to undo it here. Skipping this leaves a chart whose bars
   * are drawn into a canvas pinned at `opacity: 0`: fully rendered, invisible,
   * and with nothing left to write style again (it never self-heals).
   */
  private clearIntroOpacity(): void {
    this.canvas.style.opacity = '';
    this.barLabelLayer.style.opacity = '';
  }

  /** End the entrance/drill loop AND undo the fade it applied. Use this instead
   *  of a bare `cancelAnimationFrame(this.introRaf)` everywhere outside the loop
   *  itself. */
  private stopIntro(): void {
    cancelAnimationFrame(this.introRaf);
    this.introRaf = 0;
    this.clearIntroOpacity();
  }

  private playDrill(dpr: number, band: { from: number; size: number; split: boolean }, duration: number): void {
    const target = this.scene;
    if (!target) return;
    this.stopIntro();
    // drillScene takes the RAW timeline — it eases each child itself so the split
    // can cascade (stagger per category) with a spring.
    this.paint(drillScene(target, band.from, band.size, 0, band.split), dpr);
    let start = 0;
    const frame = (now: number): void => {
      if (!start) start = now;
      const t = (now - start) / duration;
      if (t >= 1) {
        this.displayed = barsByKey(target);
        this.paint(target, dpr);
        return;
      }
      this.paint(drillScene(target, band.from, band.size, t, band.split), dpr);
      this.introRaf = requestAnimationFrame(frame);
    };
    this.introRaf = requestAnimationFrame(frame);
  }

  /** Replay the entry animation from the start (uses the current spec's variant). */
  replay(): void {
    this.hasRendered = false;
    this.render();
  }

  private drawGeometry(scene: RenderScene, dpr: number): void {
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSceneCanvas(this.ctx, scene);
    }
  }

  /** Draw the plot geometry (canvas) + the bar value labels (their own layer)
   *  for a scene — both animate together, so the numbers ride out to the bar
   *  tips as the bars grow instead of snapping to the final position. */
  private paint(scene: RenderScene, dpr: number): void {
    this.drawGeometry(scene, dpr);
    renderBarLabels(this.barLabelLayer, scene, this.theme?.fontFamily);
  }

  private playIntro(dpr: number, variant: MdChartAnimation, duration: number): void {
    const target = this.scene;
    if (!target) return;
    this.stopIntro();
    // Grow + fade share one layer opacity: `alpha` < 1 fades the canvas (and its
    // bar-label overlay) in; an empty string restores the stylesheet default once
    // the entrance settles. draw/stagger report alpha 1, so their layer stays
    // fully opaque and only the geometry animates.
    const setOpacity = (a: number): void => {
      const v = a < 1 ? String(a) : '';
      this.canvas.style.opacity = v;
      this.barLabelLayer.style.opacity = v;
    };
    // Draw t=0 NOW rather than waiting for the first frame. Setting the canvas
    // size in render() cleared it, so deferring the first draw leaves one frame
    // of blank canvas under a DOM overlay that has already painted its labels —
    // the chart appears to blink before it starts.
    const first = stepAnimation(variant, target, 0);
    setOpacity(first.alpha);
    this.paint(first.scene, dpr);
    let start = 0;
    const frame = (now: number): void => {
      if (!start) start = now;
      const tRaw = (now - start) / duration;
      if (tRaw >= 1) {
        setOpacity(1);
        this.displayed = barsByKey(target);
        this.paint(target, dpr);
        return;
      }
      const { scene, alpha } = stepAnimation(variant, target, tRaw);
      setOpacity(alpha);
      this.paint(scene, dpr);
      this.introRaf = requestAnimationFrame(frame);
    };
    this.introRaf = requestAnimationFrame(frame);
  }

  /**
   * A persistent FOLLOW loop for data updates — the bar-race reorder. Every frame
   * it eases each bar a fraction of the way toward the LATEST target (`this.scene`),
   * matched by CATEGORY (so an entity slides between ranks, not slots).
   *
   * Why a follow and not a fixed tween: a race re-feeds every frame AND reassigns
   * several props per feed (xAxis, yAxis, series), so several renders land per
   * frame. A fixed tween restarted on each render — and reset by the static branch
   * of the intermediate no-change render — never accumulated, so the ranks
   * snapped. This loop reads the live target and survives those renders, so the
   * bars slide up and down smoothly. A one-off update just converges then stops.
   */
  private ensureFollow(): void {
    if (!this.scene) return;
    if (prefersReducedMotion()) {
      cancelAnimationFrame(this.followRaf);
      this.followRaf = 0;
      this.displayed = barsByKey(this.scene);
      this.paint(this.scene, this.lastDpr);
      return;
    }
    // render() just CLEARED the canvas by resizing it, so repaint the current
    // follow state NOW (rate 0 = no easing step) — otherwise the frame composites
    // blank, because the rAF step runs before the NEXT render's clear, not after
    // this one. The rAF loop then advances the easing once per frame.
    const moving = this.renderFollow(0);
    if (moving && !this.followRaf) {
      this.followLast = 0;
      this.followRaf = requestAnimationFrame(this.followStep);
    }
  }

  /** Ease each bar `rate` of the way toward the live target (matched by category),
   *  paint the frame, and report whether anything is still moving. */
  private renderFollow(rate: number): boolean {
    const target = this.scene;
    if (!target) return false;
    const keys = barKeys(target); // occurrence-aware: split-bar pieces stay distinct (see barKeys)
    const from = this.displayed ?? barsByKey(target);
    const displayed = new Map<string, SceneBar>();
    const bars: SceneBar[] = [];
    let moving = false;
    target.bars.forEach((b, i) => {
      const k = keys[i];
      const prev = from.get(k);
      const bar = prev ? lerpBar(prev, b, rate) : b; // a survivor eases in; a new entity lands at its slot
      displayed.set(k, bar);
      bars.push(bar);
      if (Math.abs(bar.x - b.x) > 0.3 || Math.abs(bar.y - b.y) > 0.3 || Math.abs(bar.w - b.w) > 0.3 || Math.abs(bar.h - b.h) > 0.3) moving = true;
    });
    this.displayed = displayed;
    this.paint({ ...target, bars }, this.lastDpr);
    return moving;
  }

  private followStep = (now: number): void => {
    if (!this.scene) {
      this.followRaf = 0;
      return;
    }
    const dt = this.followLast ? now - this.followLast : 16;
    this.followLast = now;
    const moving = this.renderFollow(Math.min(1, dt / FOLLOW_MS)); // exponential ease-out
    this.followRaf = moving ? requestAnimationFrame(this.followStep) : 0;
  };

  /**
   * Show the hover UI at a category index without a pointer — the keyboard
   * path, mirroring {@link LineChartEngine.focusIndex}. A sighted keyboard
   * user has to see the same tooltip a mouse user gets. `-1` clears.
   */
  focusIndex(index: number): void {
    this.lastHoverIndex = index;
    this.focusIndexInternal(index);
  }

  private focusIndexInternal(index: number): void {
    if (!this.scene || !this.spec || !this.theme) return;
    // Polar: spotlight the focused RING (seriesIndex -1 = the whole ring), so a
    // keyboard user sees the same emphasis a mouse hover gives, not just a card.
    if (this.spec.polar) {
      const next = index < 0 ? null : { dataIndex: index, seriesIndex: -1 };
      if (next?.dataIndex !== this.hoverSlice?.dataIndex || next?.seriesIndex !== this.hoverSlice?.seriesIndex) {
        this.hoverSlice = next;
        this.startDim();
      }
    }
    if (index < 0) {
      clearHover(this.hoverLayer);
      return;
    }
    const horizontal = !!this.spec.horizontal;
    const pt = this.scene.hoverPoints.map((hp) => hp.byIndex[index]).find(Boolean);
    const pos = this.scene.xPositions[index] ?? 0;
    const cursor = pt
      ? { x: pt.x, y: pt.y }
      : { x: horizontal ? this.scene.plot.x : pos, y: horizontal ? pos : this.scene.plot.y };
    renderHover(
      this.hoverLayer,
      this.scene,
      index,
      this.spec.valueFormatter,
      this.theme.fontFamily,
      cursor,
      this.spec.polar ? 'none' : horizontal ? 'horizontal' : 'vertical',
      -1,
      this.hoverOpts,
    );
  }

  /** The dim a segment heads toward: 0 for the hovered one, 1 for the rest while
   *  something is hovered, 0 for everything when nothing is. */
  private dimTarget(s: SceneSlice): number {
    const h = this.hoverSlice;
    if (!h) return 0;
    // seriesIndex < 0 spotlights the WHOLE ring (keyboard focus); otherwise the
    // single segment under the pointer.
    if (h.seriesIndex < 0) return s.dataIndex === h.dataIndex ? 0 : 1;
    return s.dataIndex === h.dataIndex && s.seriesIndex === h.seriesIndex ? 0 : 1;
  }

  /** Kick the spotlight fade toward the current `hoverSlice` (reduced-motion snaps). */
  private startDim(): void {
    if (!this.scene || !this.theme) return;
    if (prefersReducedMotion()) {
      cancelAnimationFrame(this.dimRaf);
      this.dimRaf = 0;
      for (const s of this.scene.slices) this.dimAnim.set(sliceKey(s.dataIndex, s.seriesIndex), this.dimTarget(s));
      this.drawGeometry(emphasizePolar(this.scene, this.dimAnim, this.theme.surface), this.lastDpr);
      return;
    }
    // A running loop already re-reads the new targets each frame — just start one
    // if idle (resetting dimLast only then, so the dt stays continuous).
    if (!this.dimRaf) {
      this.dimLast = 0;
      this.dimRaf = requestAnimationFrame(this.stepDim);
    }
  }

  private stepDim = (now: number): void => {
    if (!this.scene || !this.theme) {
      this.dimRaf = 0;
      return;
    }
    const dt = this.dimLast ? now - this.dimLast : 16;
    this.dimLast = now;
    let moving = false;
    for (const s of this.scene.slices) {
      const key = sliceKey(s.dataIndex, s.seriesIndex);
      const target = this.dimTarget(s);
      const cur = this.dimAnim.get(key) ?? 0;
      let next = cur + Math.sign(target - cur) * (dt / POLAR_FADE_MS);
      if ((target - cur) * (target - next) <= 0) next = target; // reached / crossed
      this.dimAnim.set(key, next);
      if (next !== target) moving = true;
    }
    this.drawGeometry(emphasizePolar(this.scene, this.dimAnim, this.theme.surface), this.lastDpr);
    this.dimRaf = moving ? requestAnimationFrame(this.stepDim) : 0;
  };

  /** (Re)arm the dwell before a segment's tooltip appears; a miss / switch hides
   *  the current card and restarts the wait. */
  private armTooltip(hovered: { dataIndex: number; seriesIndex: number } | null): void {
    clearTimeout(this.tooltipTimer);
    clearHover(this.hoverLayer);
    this.tooltipShown = false;
    if (!hovered) return;
    this.tooltipTimer = window.setTimeout(() => {
      const h = this.hoverSlice;
      if (h && h.dataIndex === hovered.dataIndex && h.seriesIndex === hovered.seriesIndex) {
        this.showPolarTooltip(hovered);
        this.tooltipShown = true;
      }
    }, POLAR_DWELL_MS);
  }

  private showPolarTooltip(hovered: { dataIndex: number; seriesIndex: number }): void {
    if (!this.scene || !this.spec || !this.theme) return;
    renderHover(this.hoverLayer, this.scene, hovered.dataIndex, this.spec.valueFormatter, this.theme.fontFamily, this.lastPointer, 'none', hovered.seriesIndex, { ...this.hoverOpts, trigger: 'item' });
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.scene || !this.spec || !this.hoverEnabled) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Polar: hit-test the exact ring SEGMENT (like the pie), so the tooltip +
    // spotlight appear only when the pointer is actually on a band — the hole,
    // the angular gaps and the space beyond the rings all miss and clear.
    if (this.spec.polar) {
      const slice = sliceAt(this.scene.slices, px, py);
      const hovered = slice ? { dataIndex: slice.dataIndex, seriesIndex: slice.seriesIndex ?? -1 } : null;
      this.lastPointer = { x: px, y: py };
      if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
      this.hoverRaf = requestAnimationFrame(() => {
        this.hoverRaf = 0;
        if (!this.scene || !this.spec || !this.theme) return;
        this.canvas.style.cursor = hovered ? 'pointer' : '';
        const changed = hovered?.dataIndex !== this.hoverSlice?.dataIndex || hovered?.seriesIndex !== this.hoverSlice?.seriesIndex;
        if (changed) {
          this.hoverSlice = hovered;
          this.startDim(); // fade the spotlight toward the new segment
          this.armTooltip(hovered); // restart the dwell before the tooltip shows
        } else if (this.tooltipShown && hovered) {
          this.showPolarTooltip(hovered); // same segment, card up → follow the cursor
        }
        const idx = hovered ? hovered.dataIndex : -1;
        if (idx !== this.lastHoverIndex) {
          this.lastHoverIndex = idx;
          this.cb.onHover?.(idx);
        }
      });
      return;
    }
    const idx = nearestIndex(this.scene.xPositions, this.spec.horizontal ? py : px);
    if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0;
      if (!this.scene || !this.spec || !this.theme) return;
      // A hand cursor over a bar (hit-tested exactly as a click is) signals it's
      // actionable — only inside the bar itself, not the empty column above it.
      this.canvas.style.cursor = this.clickable && this.overBar(px, py) ? 'pointer' : '';
      renderHover(this.hoverLayer, this.scene, idx, this.spec.valueFormatter, this.theme.fontFamily, { x: px, y: py }, this.spec.horizontal ? 'horizontal' : 'vertical', -1, this.hoverOpts);
      if (idx !== this.lastHoverIndex) {
        this.lastHoverIndex = idx;
        this.cb.onHover?.(idx);
      }
    });
  };

  private handlePointerLeave = (): void => {
    if (this.hoverRaf) {
      cancelAnimationFrame(this.hoverRaf);
      this.hoverRaf = 0;
    }
    this.canvas.style.cursor = ''; // drop the hand when the pointer leaves the plot
    clearHover(this.hoverLayer);
    // Drop the polar spotlight — fade the rings back to full colour.
    if (this.spec?.polar && this.scene) {
      clearTimeout(this.tooltipTimer);
      this.tooltipShown = false;
      this.canvas.style.cursor = '';
      if (this.hoverSlice) {
        this.hoverSlice = null;
        this.startDim();
      }
    }
    if (this.lastHoverIndex !== -1) {
      this.lastHoverIndex = -1;
      this.cb.onHover?.(-1);
    }
  };

  private handleClick = (e: MouseEvent): void => {
    if (!this.scene || !this.cb.onPointClick) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Only fire when the click actually lands inside a bar — a click on empty
    // plot whitespace should not emit a bar click.
    for (const b of this.scene.bars) {
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        this.cb.onPointClick(b.seriesIndex, b.dataIndex, e as PointerEvent);
        return;
      }
    }
  };

  private onLegendToggle = (item: LegendItem): void => {
    if (this.spec) {
      this.spec.series[item.seriesIndex].hidden = !this.spec.series[item.seriesIndex].hidden;
      // Re-play the entry motion so the chart animates into its new
      // configuration (respects the variant + reduced-motion / 'none').
      this.hasRendered = false;
      this.render();
      this.cb.onLegendClick?.({ ...item, hidden: this.spec.series[item.seriesIndex].hidden });
    } else {
      this.cb.onLegendClick?.(item);
    }
  };
}

