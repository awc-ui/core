/*
 * Chart engine — PieChartEngine
 * ===========================================================
 * The polar sibling of LineChartEngine / BarChartEngine. Same canvas
 * + DOM-overlay plumbing, but drives computePieLayout and
 * interacts in polar space: hover hit-tests the slice under the
 * pointer (radius + angle), explodes it, and shows a name/value/%
 * tooltip; clicks + the legend map to slice data indices.
 * ===========================================================
 */

import { computePieLayout, type PieChartSpec } from './pie-layout';
import type { EngineTheme } from './layout';
import { drawSceneCanvas } from './renderer-canvas';
import { syncOverlay } from './overlay';
import { watchDevicePixelRatio, type DprWatcher } from './dpr';
import { onColorFor } from './color';
import { resolveIntro, stepAnimation, prefersReducedMotion, expressiveEase, splitScene, easeInOutCubic, easeOutCubic } from './animate';
import type { MdChartAnimation } from '../types';
import { appendTooltipContent, clearHover } from './hover';
import type { MdChartTooltipContext, MdChartTooltipRenderer } from '../tooltip';
import type { EngineCallbacks } from './chart';
import type { LegendItem, RenderScene, SceneSlice } from './scene';

/** Hover state-change duration. Short: it tracks a pointer, not a page load. */
const HOVER_TWEEN_MS = 260;

/**
 * How long one drill step takes.
 *
 * Longer than the hover tween, because the whole ring is being replaced and the
 * viewer has to track a wedge becoming a chart; shorter than the intro, which
 * introduces a chart that was not there at all.
 */
const DRILL_MS = 520;

/** How long a press ripple takes to reach the far edge of its slice and fade. */
const RIPPLE_MS = 450;

/** Peak opacity of the ripple, matching the MD3 pressed state layer. */
const RIPPLE_ALPHA = 0.16;

/** How long a slice takes to slide out (or back) when it is picked. */
const SELECT_MS = 300;

/**
 * How far into a transition the slice labels arrive, as a fraction of it.
 *
 * They are placed for the SETTLED ring and live in the DOM overlay, so they
 * cannot be carried along with the wedges: shown from the start they sit off
 * their own slices — printed on the background during the intro, where the
 * wedge has not reached them yet, and off by a whole ring during a drill.
 * Waiting costs nothing, since there is no reading to take mid-flight.
 */
const LABEL_ARRIVES_AT = 0.8;


export class PieChartEngine {
  private canvas: HTMLCanvasElement;
  private overlay: HTMLDivElement;
  /** Legend lives here: same box, but NOT clipped, so a focus ring keeps its
   *  outer pixels where the legend hugs the plot edge. */
  private legendLayer: HTMLDivElement;
  private hoverLayer: HTMLDivElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private spec: PieChartSpec | null = null;
  private theme: EngineTheme | null = null;
  private scene: RenderScene | null = null;
  private cb: EngineCallbacks = {};
  private hoverRaf = 0;
  private hoverIndex = -1;
  private hasRendered = false;
  private introRaf = 0;
  /**
   * A drill queued for the NEXT render. Both levels have to be on screen at
   * once for the pivot wedge to be seen opening into its contents, so this
   * holds the scene being LEFT — after the data lands, the engine only has the
   * one being entered.
   */
  private pendingDrill: { index: number; up: boolean; leaving: RenderScene | null } | null = null;
  /**
   * A drill currently playing. Anything else that re-renders mid-flight — the
   * hover tween runs one every frame for 260ms, and the pointer is still on the
   * slice that was just clicked — would otherwise cancel the drill's rAF and
   * paint the settled ring. Keeping the window AND the start time lets a render
   * hand the transition back rather than end it, so the move continues against
   * whatever the new frame's colours are.
   */
  private drillRun: { index: number; up: boolean; frozen: RenderScene; start: number } | null = null;
  /** A press ripple in flight, and the device ratio to redraw it at. */
  private ripple: { dataIndex: number; x: number; y: number; max: number; color: string; start: number } | null = null;
  private rippleRaf = 0;
  private dpr = 1;
  private selectRaf = 0;
  private lastW = 0;
  private lastH = 0;
  private dprWatch: DprWatcher = watchDevicePixelRatio(() => this.render());
  private tooltipRender?: MdChartTooltipRenderer;
  /** Current strength of the hover treatment, tweened toward 0 or 1. */
  private hoverT = 0;
  private hoverTweenRaf = 0;

  constructor(private container: HTMLElement) {
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.canvas.setAttribute('part', 'plot-canvas');

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    this.legendLayer = document.createElement('div');
    this.legendLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible';

    this.hoverLayer = document.createElement('div');
    this.hoverLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    container.append(this.canvas, this.overlay, this.legendLayer, this.hoverLayer);
    this.ctx = this.canvas.getContext('2d');

    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
  }

  getScene(): RenderScene | null {
    return this.scene;
  }

  /** Pixel centre of the ring (for aligning a donut centre slot). */
  /** The largest rectangle that fits inside the donut hole, in CSS px
   *  (zero-sized for a solid pie). */
  getHoleBox(): { width: number; height: number } {
    return { width: this.scene?.pieHoleSize ?? 0, height: this.scene?.pieHoleHeight ?? 0 };
  }

  getCenter(): { x: number; y: number } | null {
    if (!this.scene) return null;
    const slot = this.scene.pieCenterSlot;
    if (slot) return { x: slot.x, y: slot.y };
    return { x: this.scene.plot.x + this.scene.plot.width / 2, y: this.scene.plot.y + this.scene.plot.height / 2 };
  }



  /**
   * Replace the tooltip's CONTENT. The card chrome (surface, radius, shadow,
   * placement) stays, so a consumer who only wants different rows doesn't have
   * to rebuild the box — the same bargain the line/area tooltips offer.
   */
  setTooltip(opts: { render?: MdChartTooltipRenderer }): void {
    this.tooltipRender = opts.render;
  }

  setSpec(spec: PieChartSpec, theme: EngineTheme, cb: EngineCallbacks = {}): void {
    // A hover reading belongs to the data it was taken from. Swap the data —
    // a drill-down hands over a whole new level — and the card is still naming
    // the slice the pointer WAS over, so the chart shows the child level while
    // the tooltip reports the parent, with the old highlight arc drawn over
    // slices it no longer describes. Drop the hover state whenever the slices
    // change; a genuine hover re-arrives on the next pointermove.
    const before = this.spec?.data;
    const changed =
      !before ||
      before.length !== spec.data.length ||
      before.some((d, i) => d.label !== spec.data[i]?.label || d.value !== spec.data[i]?.value);

    this.spec = spec;
    this.theme = theme;
    this.cb = cb;

    if (changed && this.hoverIndex !== -1) {
      this.hoverIndex = -1;
      this.spec.highlightIndex = -1;
      clearHover(this.hoverLayer);
    }

    this.render();
  }

  resize(): void {
    // Skip the ResizeObserver's initial same-size callback so it can't cancel
    // the intro animation (see LineChartEngine.resize for the full rationale).
    const rect = this.container.getBoundingClientRect();
    if (Math.round(rect.width) === this.lastW && Math.round(rect.height) === this.lastH) return;
    this.render();
  }

  toDataURL(type = 'image/png'): string {
    return this.canvas.toDataURL(type);
  }

  dispose(): void {
    if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
    // stopIntro rather than a bare cancel. Nothing depends on the clear here —
    // dispose() removes the canvas a few lines down — but routing EVERY cancel
    // of introRaf through stopIntro is what makes the invariant hold: the
    // inline opacity is only ever non-empty while the entrance loop is live.
    // The bug this fixes was one cancel site that forgot the clear.
    this.stopIntro();
    cancelAnimationFrame(this.hoverTweenRaf);
    cancelAnimationFrame(this.rippleRaf);
    cancelAnimationFrame(this.selectRaf);
    cancelAnimationFrame(this.selectRaf);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.dprWatch.dispose();
    this.canvas.remove();
    this.overlay.remove();
    this.hoverLayer.remove();
    this.spec = null;
    this.scene = null;
    this.drillRun = null;
  }

  private render(): void {
    if (!this.spec || !this.theme) return;
    this.dprWatch.update();
    const rect = this.container.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 2 || h < 2) return;
    this.lastW = w;
    this.lastH = h;

    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    this.dpr = dpr;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.spec.highlightIndex = this.hoverIndex;
    this.spec.highlightT = this.hoverT;

    // Settle the layout + overlay first (the legend-reflow pass measures the DOM
    // legend), THEN draw/animate the geometry once so there's no double-paint.
    this.layoutAndOverlay(w, h);
    const legendEl = this.overlay.querySelector('[part="legend"]') as HTMLElement | null;
    if (legendEl && this.spec.legend && this.spec.legend !== 'none') {
      const side = this.spec.legend === 'left' || this.spec.legend === 'right';
      const extent = side ? legendEl.offsetWidth : legendEl.offsetHeight;
      if (extent > 0 && Math.abs((this.spec.legendExtent ?? -1) - extent) > 2) {
        this.spec.legendExtent = extent;
        this.layoutAndOverlay(w, h);
      }
    }

    if (!this.scene) return;
    const { variant, duration } = resolveIntro(this.spec);
    const drill = this.pendingDrill;
    this.pendingDrill = null;
    if (drill?.leaving && variant !== 'none' && !prefersReducedMotion()) {
      this.hasRendered = true;
      this.playDrill(dpr, drill.index, drill.up, drill.leaving);
      return;
    }
    if (this.drillRun) {
      // Draw this render's frame of the move directly. Re-entering playDrill
      // would cancel and re-schedule its rAF, and with the hover tween
      // rendering on every tick the frame would be cancelled before it ever
      // ran — leaving a canvas that render() had just resized (and so cleared).
      // Clear (don't stop) the entrance fade: the drill loop's rAF lives in
      // `introRaf` too, so cancelling here would kill the move — but a drill
      // that interrupted the entrance must still undo its `opacity: 0`.
      this.hasRendered = true;
      this.clearIntroOpacity();
      this.drillFrame(dpr);
      return;
    }
    const animate = !this.hasRendered && variant !== 'none' && !prefersReducedMotion();
    // An EMPTY scene is not a chart that has been shown: a host that hydrates
    // before its data lands renders once with no slices, and treating that as
    // the first render spent the entrance on nothing. The first render with
    // geometry owns the entrance.
    const hasContent = this.scene.slices.length > 0;
    if (animate) {
      this.hasRendered = hasContent;
      this.playIntro(dpr, variant, duration);
      return;
    }
    this.hasRendered = this.hasRendered || hasContent;
    this.stopIntro();
    this.drawGeometry(this.scene, dpr);
  }

  /**
   * Clear what the entrance faded: the canvas' inline opacity and the slice
   * labels held back by {@link paceLabels}.
   *
   * The entrance is their only writer and its terminal frame their only
   * restorer, so every path that ends it early has to undo it here — otherwise
   * the ring is drawn into a canvas pinned at `opacity: 0` and never repainted.
   */
  private clearIntroOpacity(): void {
    this.canvas.style.opacity = '';
    // Clear the label props directly rather than via paceLabels(1). This runs
    // on every static render, and paceLabels stamps `transition: opacity 180ms`
    // on every slice label — inert while opacity is '', but it would silently
    // animate any later opacity change that used to be instant. The entrance's
    // own fade is unaffected: its completing frame calls paceLabels(1) itself.
    for (const el of Array.from(
      this.overlay.querySelectorAll<HTMLElement>('[data-key^="pl-"]'),
    )) {
      el.style.transition = '';
      el.style.opacity = '';
    }
  }

  /** End the entrance loop AND undo the fade it applied. Use this instead of a
   *  bare `cancelAnimationFrame(this.introRaf)` outside the loop itself — but
   *  NOT while a drill owns `introRaf` (see render). */
  private stopIntro(): void {
    cancelAnimationFrame(this.introRaf);
    this.introRaf = 0;
    this.clearIntroOpacity();
  }

  /**
   * Animate the next data change as a drill through slice `index`.
   *
   * `down` captures that wedge from what is on screen NOW, so it must be called
   * before the new data lands; `up` names the wedge in the level being returned
   * TO, which only exists once that level has been laid out. Either way the new
   * ring unfurls out of the wedge that connects the two levels, so descending
   * and coming back are mirror images of one motion.
   */
  drill(index: number, direction: 'down' | 'up' = 'down'): void {
    this.pendingDrill = this.scene ? { index, up: direction === 'up', leaving: this.scene } : null;
  }

  /** Replay the entry animation from the start (uses the current spec's variant). */
  replay(): void {
    this.hasRendered = false;
    this.render();
  }

  private layoutAndOverlay(w: number, h: number): void {
    if (!this.spec || !this.theme) return;
    this.scene = computePieLayout(this.spec, this.theme, w, h);
    syncOverlay(this.overlay, this.scene, this.theme.fontFamily, { onLegendClick: this.onLegendToggle }, false, this.legendLayer);
  }

  private drawGeometry(scene: RenderScene, dpr: number): void {
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSceneCanvas(this.ctx, scene);
    }
  }

  /**
   * Hold the slice labels back until `t` reaches `LABEL_ARRIVES_AT`, then fade
   * them in. Re-read every frame: a render rebuilds the overlay, so the spans
   * hidden on the last pass are gone and their replacements are visible.
   */
  private paceLabels(t: number): void {
    for (const el of Array.from(this.overlay.querySelectorAll<HTMLElement>('[data-key^="pl-"]'))) {
      el.style.transition = 'opacity 180ms ease';
      el.style.opacity = t >= LABEL_ARRIVES_AT ? '' : '0';
    }
  }

  private playIntro(dpr: number, variant: MdChartAnimation, duration: number): void {
    const target = this.scene;
    if (!target) return;
    this.stopIntro();
    // Grow + fade share one layer opacity: `alpha` < 1 fades the canvas in; an
    // empty string restores the stylesheet default once the entrance settles.
    // (Labels fade in on their own timeline via paceLabels.)
    const setOpacity = (a: number): void => {
      this.canvas.style.opacity = a < 1 ? String(a) : '';
    };
    setOpacity(stepAnimation(variant, target, 0).alpha);
    this.paceLabels(0);
    let start = 0;
    const frame = (now: number): void => {
      if (!start) start = now;
      const tRaw = (now - start) / duration;
      if (tRaw >= 1) {
        setOpacity(1);
        this.paceLabels(1);
        this.drawGeometry(target, dpr);
        return;
      }
      this.paceLabels(tRaw);
      const { scene, alpha } = stepAnimation(variant, target, tRaw);
      setOpacity(alpha);
      this.drawGeometry(scene, dpr);
      this.introRaf = requestAnimationFrame(frame);
    };
    this.introRaf = requestAnimationFrame(frame);
  }

  /** Start a drill between `frozen` (the level being left) and the current one. */
  private playDrill(dpr: number, index: number, up: boolean, frozen: RenderScene): void {
    if (!this.scene) return;
    // stopIntro, not a bare cancel: a drill armed while the entrance was still
    // fading in would otherwise inherit its `opacity: 0` and never clear it.
    this.stopIntro();
    this.drillRun = { index, up, frozen, start: performance.now() };
    const step = (): void => {
      if (!this.drillRun) return;
      if (this.drillFrame(dpr)) return; // settled
      this.introRaf = requestAnimationFrame(step);
    };
    // ONE loop. `step()` paints the opening frame and schedules its own
    // successor, so scheduling another here started a SECOND loop against the
    // same `drillRun`: two callbacks per frame, each advancing and painting the
    // transition, and only the later handle recorded in `introRaf` — so a
    // cancel stopped one and left the other running. The wedges were drawn
    // twice per frame from two different clocks, which is what made the two
    // levels look overlaid and jittery mid-drill.
    step();
  }

  /**
   * Paint one frame of the drill in flight. Returns true once it has settled.
   *
   * Reads `this.scene` rather than a captured target, so a render that lands
   * mid-move (a hover tween, a resize) is drawn at the move's current progress
   * instead of ending it — the transition carries on against the new frame's
   * colours.
   */
  private drillFrame(dpr: number): boolean {
    const run = this.drillRun;
    const target = this.scene;
    if (!run || !target) return true;
    const t = (performance.now() - run.start) / DRILL_MS;
    if (t >= 1) {
      this.drillRun = null;
      this.paceLabels(1);
      this.drawGeometry(target, dpr);
      return true;
    }
    this.paceLabels(t);
    // `outer` is the level that HAS the pivot's siblings — the parent, whichever
    // direction we are going. Only one of the two is live: the other was frozen
    // when the drill was armed, so the live one is read fresh each frame and
    // keeps up with whatever else re-rendered (a hover tween, a resize).
    // Re-centre the frozen level onto the live one before compositing. The two
    // levels rarely have the same number of legend entries — a drill swaps four
    // slices for two — so the legend gutter differs, the plot differs, and the
    // ring centre lands somewhere else. Drawn at their own centres the entering
    // ring sits visibly offset from the one it is supposed to be growing out of
    // (measured: 16px to the right on this demo). Aligning to the LIVE centre
    // means the move also settles exactly where it finishes, with no jump.
    const centreOf = (sc: RenderScene): { x: number; y: number } | null => {
      const sl = sc.slices?.find((x) => x.dataIndex >= 0) ?? sc.slices?.[0];
      return sl ? { x: sl.cx, y: sl.cy } : null;
    };
    const shiftScene = (sc: RenderScene, dx: number, dy: number): RenderScene =>
      !dx && !dy ? sc : { ...sc, slices: (sc.slices ?? []).map((sl) => ({ ...sl, cx: sl.cx + dx, cy: sl.cy + dy })) };

    const liveC = centreOf(target);
    const frozenC = centreOf(run.frozen);
    const frozen = liveC && frozenC ? shiftScene(run.frozen, liveC.x - frozenC.x, liveC.y - frozenC.y) : run.frozen;

    const outer = run.up ? target : frozen;
    const inner = run.up ? frozen : target;
    // Symmetric ease: a drill is a deliberate move between two states, not an
    // entrance, so it should not overshoot past the ring it is settling into.
    const eased = easeInOutCubic(t);
    const split = splitScene(outer, inner, run.index, run.up ? 1 - eased : eased);
    if (!split) return true;
    if (!this.ctx) return false;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSceneCanvas(this.ctx, this.withRipple(split.base));
    this.ctx.globalAlpha = split.overAlpha;
    drawSceneCanvas(this.ctx, split.over, false);
    this.ctx.globalAlpha = 1;
    return false;
  }

  private sliceAt(px: number, py: number): SceneSlice | null {
    if (!this.scene) return null;
    // Each slice is tested against ITS OWN centre, so a picked slice — which
    // sits out of the ring — is clickable where it is drawn rather than where
    // it used to be. (This once used one shared centre for everything, because
    // hover displaced the slice under the cursor and the moving hit region
    // flickered at its edges. Hover no longer moves anything: it raises a rim.
    // Being out of the ring is now a deliberate, held state, and a shape you
    // can see but not press is worse than any flicker.)
    //
    // Sharing a centre would also have to be the RING's, not the plot's: a
    // chart sweeping less than a full turn is fitted to the sector it paints,
    // which puts the centre on that sector's flat side. A half-donut's is at
    // the bottom of its box, so testing from the middle of the box put every
    // slice half a radius out and the tooltip only appeared where the two
    // regions happened to overlap.
    for (const s of this.scene.slices) {
      if (pointInSlice(px, py, s, s.cx, s.cy)) return s;
    }
    return null;
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.scene) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0;
      const slice = this.sliceAt(px, py);
      const idx = slice ? slice.dataIndex : -1;
      // A slice does something when you click it — it picks, and it may drill —
      // so it should say so before the click, not after.
      this.canvas.style.cursor = slice ? 'pointer' : '';
      if (idx !== this.hoverIndex) {
        this.hoverIndex = idx;
        this.tweenHover();
        this.cb.onHover?.(idx);
      }
      this.renderTooltip(idx, px, py);
    });
  };

  /**
   * Move the highlight to a slice by index, as the pointer would — for keyboard
   * navigation. The tooltip is anchored at the slice's own mid-angle rather
   * than a cursor position, so it appears where the slice is instead of
   * wherever the mouse happens to have been left.
   *
   * `-1` clears, which is what leaving the plot does.
   */
  focusIndex(index: number): void {
    if (!this.scene) return;
    if (index < 0) {
      this.hoverLayer.textContent = '';
      if (this.hoverIndex !== -1) {
        this.hoverIndex = -1;
        this.tweenHover();
      }
      return;
    }
    const slice = this.scene.slices.find((s) => s.dataIndex === index);
    if (!slice) return;
    if (this.hoverIndex !== index) {
      this.hoverIndex = index;
      this.tweenHover();
    }
    // Anchor midway along the slice's arc, at the middle of its radial band.
    const mid = (slice.startAngle + slice.endAngle) / 2;
    const r = (slice.innerR + slice.outerR) / 2;
    this.renderTooltip(index, slice.cx + Math.cos(mid) * r, slice.cy + Math.sin(mid) * r);
  }

  /**
   * Ease the hover treatment toward its target instead of snapping.
   *
   * Only the highlight is tweened, never the layout: re-running the intro would
   * re-sweep the whole ring on every pointer move. Moving BETWEEN slices keeps
   * the strength where it is and just swaps which slice is lit, so the emphasis
   * travels rather than blinking off and on.
   */
  private tweenHover(): void {
    const target = this.hoverIndex >= 0 ? 1 : 0;
    if (prefersReducedMotion()) {
      this.hoverT = target;
      this.render();
      return;
    }
    cancelAnimationFrame(this.hoverTweenRaf);
    const from = this.hoverT;
    if (from === target) {
      this.render();
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / HOVER_TWEEN_MS);
      // Expressive rather than a plain decelerate: it overshoots ~2% mid-way,
      // which is what gives the widening slice its slight push past the mark.
      this.hoverT = from + (target - from) * expressiveEase(p);
      this.render();
      if (p < 1) this.hoverTweenRaf = requestAnimationFrame(step);
    };
    this.hoverTweenRaf = requestAnimationFrame(step);
  }

  private handlePointerLeave = (): void => {
    if (this.hoverRaf) {
      cancelAnimationFrame(this.hoverRaf);
      this.hoverRaf = 0;
    }
    this.hoverLayer.textContent = '';
    if (this.hoverIndex !== -1) {
      this.hoverIndex = -1;
      this.canvas.style.cursor = '';
      this.tweenHover();
      this.cb.onHover?.(-1);
    }
  };

  /**
   * Start a ripple on the pressed slice.
   *
   * On POINTERDOWN, not click: the ripple is feedback that the press landed, so
   * it has to be there before whatever the click does. On a chart that drills,
   * a click-triggered one would be a few frames old by the time the level
   * changed out from under it.
   */
  private handlePointerDown = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const slice = this.sliceAt(x, y);
    if (slice) this.startRipple(x, y, slice);
  };

  /**
   * Activate a slice from the keyboard, as a click would.
   *
   * The ripple starts at the middle of the wedge's band rather than at a
   * pointer position, which is the closest thing to "where the press landed"
   * when there was no press.
   */
  activate(index: number): void {
    const slice = this.scene?.slices.find((s) => !s.pill && s.dataIndex === index);
    if (!slice) return;
    const mid = (slice.startAngle + slice.endAngle) / 2;
    const r = (slice.innerR + slice.outerR) / 2;
    this.startRipple(slice.cx + Math.cos(mid) * r, slice.cy + Math.sin(mid) * r, slice);
    this.toggleSelected(index);
  }

  private startRipple(x: number, y: number, slice: SceneSlice): void {
    if (prefersReducedMotion()) return;
    // Reach the FARTHEST corner of the wedge, so the ripple covers it however
    // off-centre the press was — a fixed radius leaves a slice half-lit.
    const corners = [slice.startAngle, slice.endAngle].flatMap((a) =>
      [slice.innerR, slice.outerR].map((r) => Math.hypot(slice.cx + Math.cos(a) * r - x, slice.cy + Math.sin(a) * r - y)),
    );
    this.ripple = {
      dataIndex: slice.dataIndex,
      x,
      y,
      max: Math.max(...corners, 1),
      color: onColorFor(slice.color),
      start: performance.now(),
    };
    cancelAnimationFrame(this.rippleRaf);
    const step = (): void => {
      if (!this.ripple) return;
      if ((performance.now() - this.ripple.start) / RIPPLE_MS >= 1) {
        this.ripple = null;
        // A drill paints every frame anyway; outside one, the last frame still
        // has the ripple on it and has to be replaced.
        if (!this.drillRun && this.scene) this.drawGeometry(this.scene, this.dpr);
        return;
      }
      // While a drill runs it owns the canvas and stamps the ripple itself;
      // driving a second redraw from here would fight it for the frame.
      if (!this.drillRun && this.scene) this.drawGeometry(this.withRipple(this.scene), this.dpr);
      this.rippleRaf = requestAnimationFrame(step);
    };
    this.rippleRaf = requestAnimationFrame(step);
  }

  /** The scene with the ripple's current frame on it, if one is in flight. */
  private withRipple(scene: RenderScene): RenderScene {
    const r = this.ripple;
    if (!r) return scene;
    const t = Math.min(1, (performance.now() - r.start) / RIPPLE_MS);
    return {
      ...scene,
      ripple: {
        dataIndex: r.dataIndex,
        x: r.x,
        y: r.y,
        // Decelerating outward, fading only over the tail — expanding and
        // fading at the same rate reads as a wash rather than as a touch.
        radius: r.max * easeOutCubic(t),
        color: r.color,
        alpha: RIPPLE_ALPHA * (1 - Math.max(0, (t - 0.35) / 0.65)),
      },
    };
  }

  private handleClick = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const slice = this.sliceAt(e.clientX - rect.left, e.clientY - rect.top);
    if (!slice) return;
    this.cb.onPointClick?.(0, slice.dataIndex, e as PointerEvent);
    this.toggleSelected(slice.dataIndex);
  };

  /**
   * Pick a slice, sliding it out of the ring — and put back whichever one was
   * out before.
   *
   * One at a time: the point of moving a slice is to say "this one", which two
   * of them cannot both do. Clicking the slice that is already out puts it back
   * and leaves none picked.
   *
   * A click that DRILLS replaces the data outright, which builds a fresh spec
   * and takes this with it, so a chart that navigates on click never ends up
   * with a slice stranded outside its ring.
   */
  private toggleSelected(index: number): void {
    const data = this.spec?.data;
    if (!data?.[index]) return;
    // Read the current offsets BEFORE the flags move, so the one going back in
    // starts from wherever it had got to rather than from fully out.
    const from = data.map((d) => d.selectT ?? (d.selected ? 1 : 0));
    const wasOut = !!data[index].selected;
    data.forEach((d, i) => {
      d.selected = i === index && !wasOut;
    });
    const to = data.map((d) => (d.selected ? 1 : 0));
    if (from.every((v, i) => v === to[i])) return;
    if (prefersReducedMotion()) {
      data.forEach((d, i) => (d.selectT = to[i]));
      this.render();
      return;
    }
    cancelAnimationFrame(this.selectRaf);
    const t0 = performance.now();
    const step = (now: number): void => {
      const p = Math.min(1, (now - t0) / SELECT_MS);
      // The same spring the hover rim uses, so a slice that is both hovered and
      // picked moves as one thing rather than on two different curves.
      const e = expressiveEase(p);
      data.forEach((d, i) => {
        d.selectT = from[i] + (to[i] - from[i]) * e;
      });
      this.render();
      if (p < 1) this.selectRaf = requestAnimationFrame(step);
    };
    this.selectRaf = requestAnimationFrame(step);
  }

  private renderTooltip(idx: number, px: number, py: number): void {
    this.hoverLayer.textContent = '';
    if (idx < 0 || !this.spec || !this.theme || !this.scene) return;
    const datum = this.spec.data[idx];
    if (!datum) return;
    // Against its OWN level. A nested chart's `data` holds every ring at once,
    // so summing all of it counts each parent and then its children again —
    // and a version came out as a share of roughly twice the chart.
    const total = this.spec.data.reduce(
      (sum, d) => (d.hidden || d.level !== datum.level || d.parent !== datum.parent ? sum : sum + d.value),
      0,
    );
    const percent = total > 0 ? (datum.value / total) * 100 : 0;

    const tip = document.createElement('div');
    tip.setAttribute('part', 'tooltip');
    tip.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'background:var(--md-sys-color-surface-container-high, #ECE6F0)',
      'color:var(--md-sys-color-on-surface, #1C1B1F)',
      'border-radius:8px',
      'padding:8px 10px',
      'box-shadow:0 2px 6px rgba(0,0,0,0.15),0 1px 2px rgba(0,0,0,0.2)',
      `font:400 ${this.theme.labelSize}px ${this.theme.fontFamily}`,
      'white-space:nowrap',
      'z-index:2',
    ].join(';');
    if (this.tooltipRender) {
      const total2 = total;
      const content = this.tooltipRender({
        dataIndex: idx,
        axisValue: datum.label,
        axisLabel: datum.label,
        focusedSeriesIndex: idx,
        missing: [],
        series: this.spec.data.map((d, i) => ({
          seriesIndex: i,
          label: d.label,
          color: d.color,
          value: d.value,
          formattedValue: this.spec!.valueFormatter(d.value),
          // A pie's "share" is the reading most tooltips actually want.
          percent: total2 > 0 ? (d.value / total2) * 100 : 0,
          focused: i === idx,
          missing: false,
        })) as MdChartTooltipContext['series'],
      });
      if (content != null) {
        appendTooltipContent(tip, content);
        this.hoverLayer.appendChild(tip);
        this.placeTooltip(tip, px, py);
      }
      return;
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;line-height:1.5';
    const sw = document.createElement('span');
    sw.style.cssText = `width:10px;height:10px;border-radius:3px;background:${datum.color};flex:none`;
    const lbl = document.createElement('span');
    lbl.textContent = datum.label;
    lbl.style.cssText = 'flex:1';
    const val = document.createElement('strong');
    val.textContent = `${this.spec.valueFormatter(datum.value)} (${percent.toFixed(1)}%)`;
    row.append(sw, lbl, val);
    tip.appendChild(row);

    this.hoverLayer.appendChild(tip);
    this.placeTooltip(tip, px, py);
  }

  /** Keep the card on-screen: flip to the anchor's other side when it would
   *  overflow, and clamp vertically. */
  private placeTooltip(tip: HTMLElement, px: number, py: number): void {
    if (!this.scene) return;
    const tw = tip.offsetWidth || 120;
    const th = tip.offsetHeight || 40;
    let left = px + 14;
    if (left + tw > this.scene.width - 4) left = px - tw - 14;
    const top = Math.max(4, Math.min(py - th / 2, this.scene.height - th - 4));
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${top}px`;
  }

  private onLegendToggle = (item: LegendItem): void => {
    if (this.spec) {
      const datum = this.spec.data[item.seriesIndex];
      if (datum) {
        datum.hidden = !datum.hidden;
        // Re-play the entry motion so the ring animates into its new
        // configuration (respects the variant + reduced-motion / 'none').
        this.hasRendered = false;
        this.render();
        this.cb.onLegendClick?.({ ...item, hidden: !!datum.hidden });
        return;
      }
    }
    this.cb.onLegendClick?.(item);
  };
}

/** Point-in-annular-sector test (radius band + angular span) about (cx, cy). */
function pointInSlice(px: number, py: number, s: SceneSlice, cx: number, cy: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const r = Math.hypot(dx, dy);
  if (r < s.innerR || r > s.outerR) return false;
  const lo = Math.min(s.startAngle, s.endAngle);
  const hi = Math.max(s.startAngle, s.endAngle);
  const twoPi = Math.PI * 2;
  // Reduce the offset from `lo` into [0, 2π) so the test works for ANY range —
  // including slices whose [lo,hi] lies entirely below −π (rotated pies/arcs),
  // which a one-directional `while (ang < lo)` fold would miss.
  let d = (Math.atan2(dy, dx) - lo) % twoPi;
  if (d < 0) d += twoPi;
  return d <= hi - lo;
}
