/*
 * Chart engine — LineChartEngine
 * ===========================================================
 * The instance that replaces the ECharts object. Owns a plot
 * <canvas> + a DOM overlay layer inside the host's canvas box,
 * and runs the render pipeline: spec + theme + size →
 * computeLayout → draw geometry + sync the text/legend overlay. Exposes
 * setSpec / resize / dispose and a legend-toggle + hover callback,
 * mirroring the surface md-line-chart needs.
 * ===========================================================
 */

import { computeLayout, type EngineTheme, type LineChartSpec } from './layout';
import { drawSceneCanvas } from './renderer-canvas';
import { syncOverlay, renderGlyphs, renderEndLabels } from './overlay';
import { clearHover, renderHover, type HoverOptions } from './hover';
import { watchDevicePixelRatio, type DprWatcher } from './dpr';
import { resolveIntro, stepAnimation, prefersReducedMotion } from './animate';

/** Monotonic ms, for the hover-focus dwell. */
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
import { distanceToLine, emphasizeScene, HoverFocus, EMPHASIS_MS } from './emphasis';
import { axisSeriesValues, hitTestScene, nearestIndex, seriesSampleLines, type AxisSeriesValue, areaSeriesAt } from './hit-test';
import { isRtl, mirrorScene, watchDirection, type DirectionWatcher } from './rtl';
import type { MdChartAnimation } from '../types';
import type { LegendItem, RenderScene } from './scene';

export interface EngineCallbacks {
  onLegendClick?: (item: LegendItem) => void;
  /** Fires with the nearest category index as the pointer moves (or -1 on leave). */
  onHover?: (dataIndex: number) => void;
  /** Fires when a data point is clicked (nearest series + index). */
  onPointClick?: (seriesIndex: number, dataIndex: number, e: PointerEvent) => void;
  /** Fires when a series' drawn LINE is clicked away from its data points. */
  onLineClick?: (seriesIndex: number, dataIndex: number, e: PointerEvent) => void;
  /** Fires when a series' filled AREA is clicked (not its line or its points). */
  onAreaClick?: (seriesIndex: number, dataIndex: number, e: PointerEvent) => void;
  /** Fires when the plot background is clicked: the nearest x index plus every
   *  visible series' value there. */
  onAxisClick?: (dataIndex: number, values: AxisSeriesValue[], e: PointerEvent) => void;
}

/**
 * How far (px) the pointer may travel between press and release for the release
 * to still count as a click on the plot. Anything further is a gesture (the
 * drag-to-zoom band, a slider pan), and the background / line / area clicks stay
 * quiet. Matches the same threshold md-line-chart uses to tell a stray drag from
 * a click. A MARK click is exempt — that behaviour predates this and is public.
 */
const DRAG_SLOP = 8;

export class LineChartEngine {
  private canvas: HTMLCanvasElement;
  private overlay: HTMLDivElement;
  /** Legend lives here: same box, but NOT clipped, so a focus ring keeps its
   *  outer pixels where the legend hugs the plot edge. */
  private legendLayer: HTMLDivElement;
  private glyphLayer: HTMLDivElement;
  private endLabelLayer: HTMLDivElement;
  private hoverLayer: HTMLDivElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private spec: LineChartSpec | null = null;
  private theme: EngineTheme | null = null;
  private scene: RenderScene | null = null;
  private cb: EngineCallbacks = {};
  private hoverRaf = 0;
  private lastHoverIndex = -2;
  private hoverEnabled = true;
  private hoverOpts: HoverOptions = {};
  private hasRendered = false;
  private introRaf = 0;
  private lastW = 0;
  private lastH = 0;
  private lastDpr = 1;
  // Hover emphasis: the series kept vivid (persists through the fade-out so the
  // others un-dim gradually) + the animated dim factor (0 none → 1 full).
  private emphasisSeries = -1;
  private emphasisT = 0;
  private emphasisTarget = 0;
  private emphasisRaf = 0;
  /** Per-scene cache for {@link seriesLines}. */
  private focusLines: { scene: RenderScene; points: [number, number][][] } | null = null;
  /** Picks which series the hover emphasises, and keeps that choice steady. */
  private focus = new HoverFocus();
  /** Where the pointer went down, and whether it has since travelled far enough
   *  to make the coming click the end of a drag rather than a click. */
  private downAt: { x: number; y: number } | null = null;
  private dragged = false;
  /** Host is laid out right-to-left — the finished scene is mirrored. */
  private rtl = false;
  /** The scene BEFORE mirroring, for the +x-sweeping intro animations. */
  private sceneLtr: RenderScene | null = null;
  private dprWatch: DprWatcher = watchDevicePixelRatio(() => this.render());
  /** Re-render when the page (or an ancestor) flips direction — but only if
   *  THIS chart's own computed direction actually changed. */
  private dirWatch: DirectionWatcher = watchDirection(() => {
    if (isRtl(this.container) !== this.rtl) this.render();
  });

  constructor(private container: HTMLElement) {
    // Host provides a positioned box; layer the canvas + overlay in it.
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this.canvas.setAttribute('part', 'plot-canvas');

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    this.legendLayer = document.createElement('div');
    this.legendLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible';

    // Emoji / text markers get their own layer so they can rise / reveal / fade
    // with the data geometry each animation frame (the static overlay above is
    // only synced once per render).
    this.glyphLayer = document.createElement('div');
    this.glyphLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    // End-of-line series labels live in their own PERSISTENT layer (not cleared
    // each frame) so they can fade in/out on collision via a CSS transition.
    this.endLabelLayer = document.createElement('div');
    this.endLabelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    // Hover UI (crosshair + tooltip) sits above the static overlay so it
    // updates on pointermove without re-syncing the labels/legend.
    this.hoverLayer = document.createElement('div');
    this.hoverLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';

    container.append(this.canvas, this.overlay, this.legendLayer, this.glyphLayer, this.endLabelLayer, this.hoverLayer);

    this.ctx = this.canvas.getContext('2d');

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('click', this.handleClick);
  }

  /** The current render scene — for diagnostics/tests. */
  getScene(): RenderScene | null {
    return this.scene;
  }

  /** Enable/disable the hover crosshair + tooltip (sparkline `show-tooltip`). */
  setHoverEnabled(enabled: boolean): void {
    this.hoverEnabled = enabled;
    if (!enabled) clearHover(this.hoverLayer);
  }

  /**
   * Install the tooltip extras: a developer's content renderer and/or the
   * formatter consulted for a series with no value at the hovered x. Presentation
   * only — it deliberately does NOT go through `setSpec`, so swapping the
   * renderer never re-runs layout.
   */
  setTooltip(opts: HoverOptions): void {
    this.hoverOpts = opts;
  }



  setSpec(spec: LineChartSpec, theme: EngineTheme, cb: EngineCallbacks = {}): void {
    this.spec = spec;
    this.theme = theme;
    this.cb = cb;
    // The series set may have changed — drop any stale hover focus.
    cancelAnimationFrame(this.emphasisRaf);
    this.focus.reset();
    this.emphasisSeries = -1;
    this.emphasisT = 0;
    this.emphasisTarget = 0;
    this.render();
  }

  resize(): void {
    // A ResizeObserver fires an initial callback right after observe() with the
    // same size the first render already used. Re-rendering there would draw the
    // static final geometry and cancel the just-scheduled intro animation (RO
    // delivery runs before rAF in the frame), so skip when size is unchanged.
    const rect = this.container.getBoundingClientRect();
    if (Math.round(rect.width) === this.lastW && Math.round(rect.height) === this.lastH) return;
    this.render();
  }

  /** Current frame as a data URL (for toDataURL export). */
  toDataURL(type = 'image/png'): string {
    // Guard for canvases that can't export (mock-doc / SSR): return '' rather
    // than throwing, so the host's toDataURL() degrades gracefully.
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
    cancelAnimationFrame(this.emphasisRaf);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('click', this.handleClick);
    this.dprWatch.dispose();
    this.dirWatch.dispose();
    this.canvas.remove();
    this.overlay.remove();
    this.glyphLayer.remove();
    this.endLabelLayer.remove();
    this.hoverLayer.remove();
    this.spec = null;
    this.scene = null;
    this.sceneLtr = null;
  }

  private render(): void {
    if (!this.spec || !this.theme) return;
    this.dprWatch.update();
    const rect = this.container.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 2 || h < 2) return; // not laid out yet — ResizeObserver retries
    this.lastW = w;
    this.lastH = h;

    // Cap the backing-store scale for perf; 4 keeps lines crisp through ~200%
    // browser zoom on a 2x display (the dpr watcher re-renders on zoom).
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    this.lastDpr = dpr;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;

    // Layout always runs left-to-right; an RTL host gets the finished frame
    // mirrored (see rtl.ts), so no part of the geometry pipeline needs to know.
    // The un-mirrored scene is kept because the intro animations sweep along +x
    // (`draw` reveals by a moving cutX) — they run in that space and each frame
    // is mirrored on its way to the canvas, so the reveal follows the reading
    // direction instead of running backwards.
    this.rtl = isRtl(this.container);
    const layout = (): RenderScene => {
      this.sceneLtr = computeLayout(this.spec!, this.theme!, w, h);
      return this.mirrored(this.sceneLtr);
    };

    this.scene = layout();
    // Chrome (axes, gridlines, labels, legend) is static — sync it once; only
    // the data geometry animates on the first render.
    syncOverlay(this.overlay, this.scene, this.theme.fontFamily, { onLegendClick: this.onLegendToggle }, this.rtl, this.legendLayer);
    // Two-pass legend: a wrapped legend's real extent isn't known until it's in
    // the DOM. Re-reserve the gutter to its measured height/width and re-lay-out
    // so a many-series legend never spills onto the plot.
    const legendEl = this.overlay.querySelector('[part="legend"]') as HTMLElement | null;
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
    const animate = !this.hasRendered && variant !== 'none' && !prefersReducedMotion();
    // An EMPTY scene is not a chart that has been shown: a host that hydrates
    // before its data lands renders once with no series, and treating that as
    // the first render spent the entrance on nothing — the real data then
    // arrived un-animated. The first render with geometry owns the entrance.
    const hasContent = this.sceneLtr
      ? this.sceneLtr.lines.length > 0 || this.sceneLtr.areas.length > 0 || this.sceneLtr.markers.length > 0
      : false;
    if (animate) {
      this.hasRendered = hasContent;
      this.playIntro(dpr, variant, duration);
      return;
    }
    this.hasRendered = this.hasRendered || hasContent;
    this.stopIntro();
    // Preserve any active hover emphasis across non-hover re-renders.
    this.paintGeometry(emphasizeScene(this.scene, this.emphasisSeries, this.emphasisT), dpr);
  }

  /**
   * Clear the inline opacity the entrance fades the layers in with.
   *
   * The entrance is the ONLY writer of it, and the loop's terminal frame the
   * only thing that clears it — so any path that ends the entrance early must
   * undo it here, or the chart is left drawn into a canvas pinned at
   * `opacity: 0` with nothing left to write style again.
   */
  private clearIntroOpacity(): void {
    this.canvas.style.opacity = '';
    this.glyphLayer.style.opacity = '';
  }

  /** End the entrance loop AND undo the fade it applied. Use this instead of a
   *  bare `cancelAnimationFrame(this.introRaf)` outside the loop itself. */
  private stopIntro(): void {
    cancelAnimationFrame(this.introRaf);
    this.introRaf = 0;
    this.clearIntroOpacity();
  }

  /** A scene as it should reach the canvas: mirrored on an RTL host. */
  private mirrored(scene: RenderScene): RenderScene {
    return this.rtl ? mirrorScene(scene) : scene;
  }

  /** Draw the plot geometry (canvas) + the emoji/text markers (their own layer)
   *  for a scene — both animate together frame to frame. */
  private paintGeometry(scene: RenderScene, dpr: number): void {
    this.drawGeometry(scene, dpr);
    renderGlyphs(this.glyphLayer, scene.glyphs ?? [], this.theme?.fontFamily);
    renderEndLabels(this.endLabelLayer, scene.endLabels ?? [], this.theme?.fontFamily);
  }

  /** Redraw the plot geometry at the current emphasis (hover-focus dimming).
   *  Glyphs are unaffected by emphasis, so only the canvas is repainted. */
  private paintEmphasis(): void {
    if (this.scene) this.drawGeometry(emphasizeScene(this.scene, this.emphasisSeries, this.emphasisT), this.lastDpr);
  }

  /** Focus a series (dim the rest) with a short MD3 fade; -1 fades everything
   *  back. The emphasised series is kept while fading OUT so the others un-dim
   *  gradually instead of snapping. */
  private setFocus(idx: number): void {
    const target = idx >= 0 ? 1 : 0;
    const series = idx >= 0 ? idx : this.emphasisSeries; // keep the last series while fading out
    if (target === this.emphasisTarget && series === this.emphasisSeries) return;
    this.emphasisSeries = series;
    this.emphasisTarget = target;
    if (prefersReducedMotion()) {
      cancelAnimationFrame(this.emphasisRaf);
      this.emphasisT = target;
      if (target === 0) this.emphasisSeries = -1;
      this.paintEmphasis();
      return;
    }
    cancelAnimationFrame(this.emphasisRaf);
    let last = 0;
    const step = (now: number): void => {
      if (!last) last = now;
      const dt = now - last;
      last = now;
      const dir = this.emphasisTarget > this.emphasisT ? 1 : -1;
      this.emphasisT += dir * (dt / EMPHASIS_MS);
      if ((dir > 0 && this.emphasisT >= this.emphasisTarget) || (dir < 0 && this.emphasisT <= this.emphasisTarget)) {
        this.emphasisT = this.emphasisTarget;
        if (this.emphasisTarget === 0) this.emphasisSeries = -1; // fully restored → clear
        this.paintEmphasis();
        return;
      }
      this.paintEmphasis();
      this.emphasisRaf = requestAnimationFrame(step);
    };
    this.emphasisRaf = requestAnimationFrame(step);
  }

  /** Replay the entry animation from the start (uses the current spec's variant). */
  replay(): void {
    this.hasRendered = false;
    this.render();
  }

  private drawGeometry(scene: RenderScene, dpr: number): void {
    if (!this.ctx) return;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSceneCanvas(this.ctx, scene);
  }

  private playIntro(dpr: number, variant: MdChartAnimation, duration: number): void {
    // Animate in LTR space (the reveals sweep along +x) and mirror each frame.
    const target = this.sceneLtr;
    if (!target) return;
    // A staggered reveal draws each series in turn, so the whole timeline scales
    // with the series count (`duration` is the per-series draw time) — capped so
    // a many-series chart doesn't crawl.
    let dur = duration;
    if (variant === 'stagger') {
      const n = new Set(target.lines.map((l) => l.seriesIndex ?? 0)).size || 1;
      dur = Math.min(duration * n, 5200);
    }
    this.stopIntro();
    // Grow + fade share one layer opacity: `alpha` < 1 fades the canvas (and its
    // glyph overlay) in; an empty string restores the stylesheet default once the
    // entrance settles. draw/stagger report alpha 1, so their layer stays fully
    // opaque and only the geometry animates.
    const setOpacity = (a: number): void => {
      const v = a < 1 ? String(a) : '';
      this.canvas.style.opacity = v;
      this.glyphLayer.style.opacity = v;
    };
    // Draw t=0 NOW rather than waiting for the first frame. Setting the
    // canvas size above cleared it, so deferring the first draw leaves one
    // frame of blank canvas under a DOM overlay that has already painted its
    // labels — the chart appears to blink before it starts.
    const first = stepAnimation(variant, target, 0);
    setOpacity(first.alpha);
    this.drawGeometry(first.scene, dpr);
    let start = 0;
    const frame = (now: number): void => {
      if (!start) start = now;
      const tRaw = (now - start) / dur;
      if (tRaw >= 1) {
        setOpacity(1);
        this.paintGeometry(this.mirrored(target), dpr);
        return;
      }
      const { scene, alpha } = stepAnimation(variant, target, tRaw);
      setOpacity(alpha);
      this.paintGeometry(this.mirrored(scene), dpr);
      this.introRaf = requestAnimationFrame(frame);
    };
    this.introRaf = requestAnimationFrame(frame);
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.downAt = { x: e.clientX, y: e.clientY };
    this.dragged = false;
  };

  /**
   * Show the hover UI at a data index without a pointer — the keyboard path.
   *
   * A sighted keyboard user has to see the same crosshair and tooltip a mouse
   * user gets, so this reuses the pointer's own rendering rather than a second
   * presentation. The cursor is taken from the point itself, which is what the
   * tooltip positions against. `-1` clears.
   */
  focusIndex(index: number): void {
    if (!this.scene || !this.spec || !this.theme) return;
    if (index < 0) {
      clearHover(this.hoverLayer);
      this.focus.reset();
      this.setFocus(-1);
      return;
    }
    const inverted = !!this.scene.inverted;
    // Anchor on the topmost series that actually has a point here.
    const pt = this.scene.hoverPoints.map((hp) => hp.byIndex[index]).find(Boolean);
    const pos = this.scene.xPositions[index] ?? 0;
    const cursor = pt ? { x: pt.x, y: pt.y } : { x: inverted ? this.scene.plot.x : pos, y: inverted ? pos : this.scene.plot.y };
    renderHover(
      this.hoverLayer,
      this.scene,
      index,
      this.spec.yFormatter,
      this.theme.fontFamily,
      cursor,
      inverted ? 'horizontal' : 'vertical',
      -1,
      { ...this.hoverOpts, rtl: this.rtl },
    );
  }

  private handlePointerMove = (e: PointerEvent): void => {
    // Before the hover guard: a drag has to be recognised even with the hover UI
    // switched off (sparklines), and while the zoom band is being dragged.
    if (this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > DRAG_SLOP) {
      this.dragged = true;
    }
    if (!this.scene || !this.hoverEnabled) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // For an inverted chart the main axis is vertical, so hit-test along y.
    const inverted = !!this.scene.inverted;
    const idx = nearestIndex(this.scene.xPositions, inverted ? py : px);
    if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0;
      if (!this.scene || !this.spec || !this.theme) return;
      // Emphasise the series nearest the cursor and fade the others (only worth
      // it with more than one series); the hover highlights fade to match.
      const focus = this.scene.hoverPoints.length > 1 ? this.nearestSeries(px, py) : -1;
      renderHover(this.hoverLayer, this.scene, idx, this.spec.yFormatter, this.theme.fontFamily, { x: px, y: py }, inverted ? 'horizontal' : 'vertical', focus, { ...this.hoverOpts, rtl: this.rtl });
      this.setFocus(focus);
      if (idx !== this.lastHoverIndex) {
        this.lastHoverIndex = idx;
        this.cb.onHover?.(idx);
      }
    });
  };

  /**
   * Each visible series' samples as `[main, value]` pixel pairs ordered along
   * the main axis, for the hover-focus distance test. Built once per scene and
   * only when a multi-series chart is actually hovered, so the single-series
   * and never-hovered cases cost nothing. (Integer-keyed records enumerate in
   * ascending numeric order, so `byIndex` is already in main-axis order.)
   */
  private seriesLines(scene: RenderScene): [number, number][][] {
    if (this.focusLines?.scene === scene) return this.focusLines.points;
    const points = seriesSampleLines(scene);
    this.focusLines = { scene, points };
    return points;
  }

  /**
   * Series whose drawn line is nearest the cursor, or -1.
   *
   * Distance is to the LINE, not to the sample at the hovered index: series
   * measured at different x (irregular data) mostly have no sample there, and
   * comparing exact samples handed the emphasis to whichever series owned that
   * slot — so it strobed as the pointer moved. The currently emphasised series
   * then holds on unless a rival is clearly nearer ({@link pickFocusSeries}),
   * which is what settles lines running close together.
   */
  private nearestSeries(px: number, py: number): number {
    if (!this.scene) return -1;
    // Emphasis exists to pick one LINE out of several running close together.
    // On a FILLED chart it does something else entirely: it recolours large
    // areas, and with an axis-triggered tooltip — which already lists every
    // series — singling one band out contradicts the card and washes the figure
    // out. So a filled chart on axis trigger emphasises nothing; the crosshair
    // and the card carry the reading. Item trigger is the opposite case: the
    // card names exactly ONE series, and without the highlight there would be
    // nothing to say which band it meant, so there the emphasis is essential.
    if (this.scene.areas.length > 0 && this.hoverOpts.trigger !== 'item') {
      this.focus.reset();
      return -1;
    }
    // The cursor is inside a band, and that band owns it. Distance-to-line is
    // the wrong test there: on a thick stacked band the nearest line is usually
    // the NEIGHBOURING series' edge, so the tooltip named a series the pointer
    // was never over.
    const inArea = areaSeriesAt(this.scene, px, py);
    if (inArea >= 0) {
      // Containment doesn't strobe the way a distance tie does, so it is
      // adopted immediately — but the dwell state still has to follow, or the
      // next move outside the bands inherits a stale focus.
      this.focus.reset();
      return inArea;
    }
    const inverted = !!this.scene.inverted;
    const cursorMain = inverted ? py : px;
    const cursorValue = inverted ? px : py;
    const lines = this.seriesLines(this.scene);
    const candidates = this.scene.hoverPoints.map((hp, i) => ({
      seriesIndex: hp.seriesIndex,
      distance: distanceToLine(lines[i], cursorMain, cursorValue),
    }));
    return this.focus.pick(candidates, now());
  }

  private handlePointerLeave = (): void => {
    if (this.hoverRaf) {
      cancelAnimationFrame(this.hoverRaf);
      this.hoverRaf = 0;
    }
    clearHover(this.hoverLayer);
    this.focus.reset(); // next hover adopts a series immediately
    this.setFocus(-1); // restore all series to full emphasis
    if (this.lastHoverIndex !== -1) {
      this.lastHoverIndex = -1;
      this.cb.onHover?.(-1);
    }
  };

  /**
   * Resolve a click to the most specific thing under it — mark, then line, then
   * area, then the plot background — and fire that one callback only
   * ({@link hitTestScene} owns the geometry).
   */
  private handleClick = (e: MouseEvent): void => {
    const dragged = this.dragged;
    this.dragged = false;
    this.downAt = null;
    if (!this.scene) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const hit = hitTestScene(this.scene, px, py, this.seriesLines(this.scene));
    if (!hit) return;
    const pe = e as PointerEvent;
    if (hit.kind === 'mark') {
      this.cb.onPointClick?.(hit.seriesIndex, hit.dataIndex, pe);
      return;
    }
    // The plot-wide clicks are the ones a stray drag would spam, so they take
    // the drag guard (a mark click never has — see DRAG_SLOP).
    if (dragged) return;
    if (hit.kind === 'line') this.cb.onLineClick?.(hit.seriesIndex, hit.dataIndex, pe);
    else if (hit.kind === 'area') this.cb.onAreaClick?.(hit.seriesIndex, hit.dataIndex, pe);
    else this.cb.onAxisClick?.(hit.dataIndex, axisSeriesValues(this.scene, hit.dataIndex), pe);
  };

  /** Toggle the series' visibility on legend click (ECharts-style built-in
   *  behaviour) and forward the resulting state to the consumer. */
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
