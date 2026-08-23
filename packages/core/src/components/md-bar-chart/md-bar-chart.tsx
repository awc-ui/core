import {
  Component,
  Host,
  h,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Method,
  Watch,
} from '@stencil/core';
import {
  buildChartSummary,
  buildDataTableHtml,
  defaultValueFormatter,
  normalizeRange,
  pickPaletteColor,
  readMdChartTheme,
  resolveSeriesColor,
  BarChartEngine,
  type BarChartSpec,
  type EngineTheme,
  type MdChartAnimation,
  type MdChartAxis,
  type MdChartAxisValue,
  type MdChartBarLayout,
  type MdChartClickDetail,
  type MdChartHoverDetail,
  type MdChartLegendPosition,
  type MdChartSeries,
  type MdChartStackMode,
  type MdChartTitleAlign,
  type MdChartTooltipRenderer,
  type MdChartTooltipTrigger,
  watchMdChartTheme,
} from '../../utils/charts';

/**
 * md-bar-chart — Material Design 3 Expressive bar chart, rendered
 * by the in-house engine (Canvas2D + a DOM text overlay). No
 * ECharts.
 *
 *   • vertical (default) and horizontal layouts
 *   • grouped / stacked / percentage modes
 *   • category + bar gap configuration
 *   • rounded outer corners (top for vertical, end for horizontal)
 *   • legend toggle, hover tooltip, click events
 *   • role="figure" + screen-reader-only data table
 */
@Component({
  tag: 'md-bar-chart',
  styleUrl: 'md-bar-chart.css',
  shadow: true,
})
export class MdBarChart {
  @Element() el!: HTMLElement;

  @Prop() label: string = '';
  /**
   * A quieter line under the title — a source, a unit, the caveat a title
   * should not have to carry.
   */
  @Prop() subtitle: string | undefined;
  /** Title alignment over the plot: `start` (left), `center`, or `end` (right). */
  @Prop({ attribute: 'title-align' }) titleAlign: MdChartTitleAlign = 'start';
  @Prop() series: MdChartSeries[] = [];

  /** Category axis configuration. */
  @Prop() xAxis: MdChartAxis | undefined;
  /** Value axis configuration. */
  @Prop() yAxis: MdChartAxis | undefined;
  /**
   * A SECOND value axis, drawn in the opposite gutter and used by any series
   * whose `yAxisIndex` is 1 — two quantities on one category axis that share no
   * scale, like a count and a rate. Vertical charts.
   *
   * It draws no gridlines of its own: two sets at two spacings turn the plot
   * into a mesh nobody can read a value off.
   */
  @Prop() yAxis2: MdChartAxis | undefined;

  /** Bar layout — `'horizontal'` swaps categories onto the y axis. */
  @Prop({ reflect: true }) layout: MdChartBarLayout = 'vertical';

  /** Stacking strategy: none (grouped) / normal / percentage. */
  @Prop() stack: MdChartStackMode = 'none';

  /** Category gap as a percentage of the band width (`"30%"` or `30`). */
  @Prop({ attribute: 'category-gap' }) categoryGap: string | number = '30%';

  /** Bar gap between sibling grouped bars (`"20%"` or `20`). */
  @Prop({ attribute: 'bar-gap' }) barGap: string | number = '20%';

  /** Fixed bar WIDTH in px, centred in each slot. Default: auto — the bar fills
   *  its slot (the band minus the category/bar gaps). Clamped to the slot so it
   *  can't overrun a neighbour. */
  @Prop({ attribute: 'bar-width' }) barWidth?: number;

  /** Bar corner radius in pixels. */
  @Prop({ attribute: 'corner-radius' }) cornerRadius: number = 6;

  @Prop({ reflect: true }) legend: MdChartLegendPosition | 'none' = 'top-end';
  @Prop() tooltip: MdChartTooltipTrigger = 'axis';
  /**
   * Interactive zoom over the CATEGORY range — the same "zoom is a view" model
   * as `md-line-chart`:
   *   • `inside` — drag horizontally across the plot to zoom into that span of
   *     bars; double-click the plot to reset.
   *   • `slider` — a range slider under the plot; drag its thumbs to resize the
   *     window, or the grip between them to pan it.
   *   • `both` — both gestures.
   *
   * `series` / `xAxis` are never mutated: the engine is simply fed the sliced
   * window, and hover / click / keyboard indices are rebased so consumers still
   * see ABSOLUTE data indices. Ignored on a `polar` chart (a ring has no span to
   * zoom). For a *value*-range zoom, set `yAxis.min` / `yAxis.max`.
   */
  @Prop() zoom: 'none' | 'inside' | 'slider' | 'both' = 'none';
  /**
   * Format raw values for tooltips / a11y table. The tooltip also asks it about
   * series with NO value at the hovered category — `null` for a null datum,
   * `undefined` for no datum at all — and shows a row for one when it returns a
   * non-empty string.
   */
  /**
   * BCP-47 locale for the DEFAULT number / date formatting (axis ticks,
   * tooltip values, screen-reader table). Empty follows the browser; an
   * explicit `valueFormatter` always wins.
   */
  @Prop() locale: string = '';

  @Prop() valueFormatter?: (value: number | null | undefined) => string;

  /** Replace the tooltip's content. See `md-line-chart`'s `tooltipRenderer`. */
  @Prop() tooltipRenderer?: MdChartTooltipRenderer;
  @Prop({ attribute: 'height' }) heightProp?: string;
  /** Disable all animation (shorthand for `animation="none"`). */
  @Prop({ attribute: 'no-animation' }) noAnimation: boolean = false;
  /** Entry-animation variant: `expressive` (default), `grow`, `fade`, `draw`, or `none`. */
  @Prop() animation: MdChartAnimation = 'expressive';
  /** Entry-animation duration override in ms (≤ 0 disables). */
  @Prop({ attribute: 'animation-duration' }) animationDuration?: number;

  /** Show numeric data labels on each bar. */
  @Prop({ attribute: 'show-labels' }) showLabels: boolean = false;
  /**
   * Print each stack's TOTAL past the end of the column, alongside the
   * per-segment values `show-labels` prints inside it. Stacked charts only —
   * an unstacked bar already IS its total.
   */
  @Prop({ attribute: 'show-totals' }) showTotals: boolean = false;
  /**
   * Draw the bars as CHEVRONS pointing away from the baseline instead of as
   * rectangles. Along a stack they interlock, each segment's point sitting in
   * the next one's notch — a force diagram, where the contributions are handed
   * along in a direction rather than merely piled up.
   */
  @Prop({ attribute: 'chevron' }) chevron: boolean = false;
  /**
   * Wrap the bars around a circle: one concentric RING per category, with the
   * value axis running as an ANGLE instead of a length. A radial (polar) bar
   * chart.
   *
   * Stacking, legend hiding and percentage normalisation all work unchanged —
   * only the step from a value to geometry differs, and the value axis
   * deliberately spans less than the full circle, since a ring that closes on
   * itself has no readable start or end. The quarter it gives up is where the
   * category names go; `polar-sweep` changes how much that is.
   */
  @Prop({ reflect: true }) polar: boolean = false;
  /** Radius of the hole at the centre of a polar chart, 0..0.9. Default 0.22. */
  @Prop({ attribute: 'polar-hole' }) polarHole?: number;
  /** Fraction of the circle the value axis spans on a polar chart. Default 0.75. */
  @Prop({ attribute: 'polar-sweep' }) polarSweep?: number;

  /** Draw small perpendicular tick marks on the axes. */
  @Prop({ attribute: 'axis-ticks' }) axisTicks: boolean = false;

  /**
   * Show a hand (`pointer`) cursor over the bars, signalling they're actionable —
   * e.g. clickable to drill into. The chart can't know an interaction is wired,
   * so set this when a `mdBarClick` handler does something (like `drill`). The
   * cursor tracks the bar itself (hit-tested like a click), not the empty column
   * above a short bar.
   */
  @Prop({ attribute: 'clickable' }) clickable: boolean = false;

  @Event() mdBarClick!: EventEmitter<MdChartClickDetail<MdChartSeries>>;
  @Event() mdLegendClick!: EventEmitter<{ seriesIndex: number; seriesId?: string; selected: boolean }>;
  @Event() mdHover!: EventEmitter<MdChartHoverDetail>;
  @Event() mdReady!: EventEmitter<void>;
  /** Fires when the zoom window changes (drag, slider, or `setZoom`/`resetZoom`). */
  @Event() mdZoom!: EventEmitter<{ startIndex: number; endIndex: number; reset: boolean }>;

  /** Accessible label for the zoom slider's start thumb. */
  @Prop({ attribute: 'label-zoom-start' }) labelZoomStart: string = 'Zoom range start';
  /** Accessible label for the zoom slider's end thumb. */
  @Prop({ attribute: 'label-zoom-end' }) labelZoomEnd: string = 'Zoom range end';

  /**
   * Instructions announced when the plot receives keyboard focus. The plot is
   * focusable so a keyboard user can walk the data with the arrow keys; this
   * is what tells them so.
   */
  @Prop({ attribute: 'label-plot' }) labelPlot: string =
    'Chart data. Use the arrow keys to move between points, Home and End for the first and last, Escape to leave.';

  /** Template for the live announcement as keyboard focus moves. `%x%` is the
   *  axis value, `%values%` the series readings at it. */
  @Prop({ attribute: 'label-point' }) labelPoint: string = '%x%: %values%';

  /**
   * Data is still on its way — the chart covers the plot with a loader instead
   * of drawing an empty (or stale) axis, and marks itself `aria-busy`.
   *
   * Set it while the fetch is in flight and clear it when `series` arrives; the
   * entry animation replays on the way out, so the bars draw themselves in
   * rather than appearing fully formed. Slot `loading` to replace the default
   * indicator with your own skeleton.
   */
  @Prop({ reflect: true }) loading: boolean = false;

  /** Accessible + visible text under the loader. */
  @Prop({ attribute: 'loading-label' }) loadingLabel: string = 'Loading chart…';

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  @State() private mounted = false;
  /** Index the keyboard cursor sits on, or -1 when the plot isn't focused. */
  @State() private kbIndex = -1;
  /** Text for the aria-live region — what a screen reader speaks on move. */
  @State() private announcement = '';

  /** Visible category window, or null for the full range. */
  @State() private zoomWin: { start: number; end: number } | null = null;

  /** Live drag rectangle (host-relative px) while selecting a range to zoom. */
  @State() private dragBand: { x1: number; x2: number } | null = null;

  /**
   * Pointer id + origin of an in-progress gesture: `band` is a drag across the
   * plot, `pan` is a drag of the zoom window. (Resizing the window is the
   * slider's own gesture — see `renderZoomSlider`.)
   */
  private grab: { id: number; kind: 'band' | 'pan'; x: number; win: { start: number; end: number } } | null = null;

  private engine: BarChartEngine | null = null;
  /** True while a prop-change rebuild is queued for the next microtask (batches
   *  a burst of prop assignments into one render — see onAnyPropChange). */
  private applyQueued = false;
  private ro: ResizeObserver | null = null;
  private chartHost?: HTMLDivElement;
  private a11yTableHost?: HTMLDivElement;
  /** Tears down the theme watch (media query + ancestor attribute observer). */
  private disposeThemeWatch?: () => void;

  /**
   * Legend toggles the USER made, kept across data updates.
   *
   * The engine self-toggles a series on legend click, but that lives on the
   * spec — and the next `series` assignment rebuilds the spec from the prop and
   * takes the toggle with it. A chart re-fed live (a race, a poll) would
   * un-hide whatever the reader had just hidden. Remembered here and re-applied
   * in `buildSpec`, keyed by series identity, so the toggle survives the refeed
   * while an explicit `series[i].hidden` still wins.
   */
  private legendHidden = new Map<string, boolean>();

  /** A stable key per series — id, else label, else position. Suffixed on
   *  collision so two series sharing a label do not share a toggle. */
  private seriesKeys(): string[] {
    const seen = new Map<string, number>();
    return this.series.map((s, i) => {
      const base = s.id != null ? `id:${s.id}` : s.label != null ? `label:${s.label}` : `pos:${i}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return n === 0 ? base : `${base}#${n}`;
    });
  }

  /** Record a legend toggle so `buildSpec` re-applies it across series re-feeds. */
  private rememberLegendToggle(seriesIndex: number, hidden: boolean): void {
    const key = this.seriesKeys()[seriesIndex];
    if (key == null) return;
    this.legendHidden.set(key, hidden);
    // Backstop against unbounded growth (only legend clicks add entries, so this
    // realistically never trips): evict the oldest toggle.
    if (this.legendHidden.size > 256) {
      const oldest = this.legendHidden.keys().next().value as string;
      this.legendHidden.delete(oldest);
    }
  }

  componentDidLoad() {
    this.initChart();
    // Repaint whenever the resolved tokens change — an OS dark-mode flip, a
    // data-theme toggle, or a seed/accent palette written as --md-sys-color-*
    // overrides at runtime. A canvas is pixels: nothing retints it for us.
    this.disposeThemeWatch = watchMdChartTheme(this.el, () => this.applyEngine());
  }
  disconnectedCallback() {
    this.ro?.disconnect();
    this.ro = null;
    this.engine?.dispose();
    this.engine = null;
    this.disposeThemeWatch?.();
    this.disposeThemeWatch = undefined;
  }

  @Watch('series') @Watch('xAxis') @Watch('yAxis') @Watch('yAxis2') @Watch('layout')
  @Watch('stack') @Watch('categoryGap') @Watch('barGap') @Watch('barWidth') @Watch('cornerRadius')
  @Watch('legend') @Watch('tooltip') @Watch('zoom') @Watch('label') @Watch('subtitle') @Watch('titleAlign') @Watch('showLabels') @Watch('showTotals') @Watch('chevron') @Watch('polar') @Watch('polarHole') @Watch('polarSweep') @Watch('axisTicks')
  @Watch('animation') @Watch('animationDuration') @Watch('tooltipRenderer') @Watch('valueFormatter') @Watch('locale') @Watch('noAnimation') @Watch('clickable')
  onAnyPropChange() {
    // Coalesce a burst of prop assignments (a data swap sets series + xAxis +
    // yAxis, a race re-feeds several per frame) into ONE rebuild + render per
    // microtask, instead of a full computeBarLayout + canvas clear + repaint per
    // property.
    if (this.applyQueued) return;
    this.applyQueued = true;
    queueMicrotask(() => {
      this.applyQueued = false;
      this.applyEngine();
      this.rebuildA11yTable();
    });
  }

  /**
   * Re-read the MD3 tokens from the host's computed style and repaint.
   *
   * The chart does this automatically when the tokens actually change, so
   * reach for this only when a theme is applied in a way the watcher cannot
   * observe — tokens injected into a stylesheet rather than onto an element,
   * for instance. Cheaper and more direct than reassigning `series` to force
   * a rebuild.
   */
  @Method()
  async refreshTheme(): Promise<void> {
    this.applyEngine();
  }

  @Method()
  async resize(): Promise<void> {
    this.engine?.resize();
  }

  /**
   * Coming OUT of the loading state, replay the entry motion so the data that
   * just arrived draws itself in instead of appearing fully formed behind the
   * fading loader. (Going in needs nothing — the loader covers the plot.)
   */
  @Watch('loading')
  onLoadingChange(now: boolean, before: boolean) {
    if (before && !now) this.engine?.replay();
  }

  /** Replay the entry animation from the start (uses the current `animation`). */
  @Method()
  async replay(): Promise<void> {
    this.engine?.replay();
  }

  /**
   * Animate the next data change as a drill through one column, so the levels
   * of a hierarchy read as connected rather than as unrelated charts.
   *
   * AWAIT it, then assign the new `series` / `xAxis`. Like every Stencil
   * `@Method` this one resolves through a microtask, so a bare call lands AFTER
   * an assignment on the next line — the swap renders un-animated and the drill
   * arms itself for whatever change comes after.
   *
   * ```ts
   * await chart.drill(e.detail.dataIndex);   // descend into the clicked column
   * chart.series = childrenOf(clicked);
   *
   * await chart.drill(0, 'up');              // …and back out
   * chart.series = parentLevel;
   * ```
   *
   * Descending, the incoming columns unfold out of the band the named column
   * occupies right now. `'up'` pivots on the whole plot instead, which is the
   * same motion run inside out — the level being returned to opens out of
   * everything the level being left was filling. Falls back to a plain swap
   * when the index doesn't resolve, or under `prefers-reduced-motion`.
   */
  @Method()
  async drill(index: number, direction: 'down' | 'up' = 'down'): Promise<void> {
    this.engine?.drill(index, direction);
  }

  @Method()
  async toDataURL(): Promise<string> {
    return this.engine?.toDataURL('image/png') ?? '';
  }

  @Method()
  async getInstance(): Promise<BarChartEngine | null> {
    return this.engine;
  }

  private bindChartHost = (el?: HTMLDivElement) => { this.chartHost = el; };
  private bindA11yTableHost = (el?: HTMLDivElement) => { this.a11yTableHost = el; };

  private initChart() {
    this.makeEngine();
    this.applyEngine();
    this.rebuildA11yTable();
    this.mounted = true;
    this.mdReady.emit();
  }

  /** (Re)create the engine on the selected backend + wire its ResizeObserver. */
  private makeEngine() {
    if (!this.chartHost) return;
    this.ro?.disconnect();
    this.ro = null;
    this.engine?.dispose();
    try {
      this.engine = new BarChartEngine(this.chartHost);
    } catch {
      this.engine = null;
    }
    if (this.engine && typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.engine?.resize());
      this.ro.observe(this.chartHost);
    }
  }


  /** `"30%"` / `30` / `0.3` → `0.3`. */
  private parseRatio(v: string | number, fallback: number): number {
    if (typeof v === 'number') return Number.isFinite(v) ? (v > 1 ? v / 100 : v) : fallback;
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return fallback;
    return v.trim().endsWith('%') || n > 1 ? n / 100 : n;
  }

  private buildEngineTheme(t: ReturnType<typeof readMdChartTheme>): EngineTheme {
    return {
      background: t.background,
      textColor: t.textColor,
      textColorMuted: t.textColorMuted,
      axisLineColor: t.axisLineColor,
      gridLineColor: t.gridColor,
      surface: t.surface,
      fontFamily: t.fontFamily,
      labelSize: t.labelSize,
      titleSize: t.titleSize,
    };
  }

  // ─────────────────── zoom ───────────────────
  // Zoom is a *view* over the categories: the engine is fed a sliced window,
  // `series`/`xAxis` are untouched, and every index the engine reports (hover,
  // click, keyboard) is rebased by `winStart()` so consumers see absolute
  // indices. A polar chart has no linear span, so gestures are disabled on it.

  private get zoomInside(): boolean {
    return !this.polar && (this.zoom === 'inside' || this.zoom === 'both');
  }

  private get zoomSliderOn(): boolean {
    return !this.polar && (this.zoom === 'slider' || this.zoom === 'both');
  }

  /** Number of categories — the longest series, or the category axis if longer. */
  private dataLength(): number {
    const s = (this.series ?? []).reduce((acc, d) => Math.max(acc, d?.data?.length ?? 0), 0);
    return Math.max(s, this.xAxis?.data?.length ?? 0);
  }

  /** Absolute index of the window's first visible category (0 when unzoomed). */
  private winStart(): number {
    return this.zoomWin && !this.polar ? this.win().start : 0;
  }

  /** Current window, defaulted to the full range and clamped to the data. */
  private win(): { start: number; end: number } {
    const last = Math.max(0, this.dataLength() - 1);
    const w = this.zoomWin;
    if (!w) return { start: 0, end: last };
    // Keep at least two categories visible, else the slider range collapses.
    const start = Math.min(Math.max(0, w.start), Math.max(0, last - 1));
    return { start, end: Math.min(Math.max(start + 1, w.end), last) };
  }

  private applyZoom(start: number, end: number, reset = false): void {
    const last = Math.max(0, this.dataLength() - 1);
    const s = Math.min(Math.max(0, Math.round(start)), Math.max(0, last - 1));
    const e = Math.min(Math.max(s + 1, Math.round(end)), last);
    this.zoomWin = reset ? null : { start: s, end: e };
    // Snap to the new window: a zoom is direct manipulation, so easing the bars
    // across the changed layout (the follow loop) would read as them sliding
    // together instead of tracking the gesture.
    this.applyEngine(true);
    this.rebuildA11yTable();
    this.mdZoom.emit({ startIndex: reset ? 0 : s, endIndex: reset ? last : e, reset });
  }

  /** Zoom to an absolute category range. */
  @Method()
  async setZoom(startIndex: number, endIndex: number): Promise<void> {
    this.applyZoom(startIndex, endIndex);
  }

  /** Drop the zoom window and show the full range. */
  @Method()
  async resetZoom(): Promise<void> {
    this.applyZoom(0, 0, true);
  }

  /**
   * Plot rect in CANVAS coordinates, from the live scene.
   *
   * The engine lays the scene out relative to the canvas box, which the host's
   * padding insets from the host box — so canvas and host space differ by that
   * padding. Everything that compares against the scene (`indexAtX` reads
   * `scene.xPositions`, which is canvas-space too) converts the pointer INTO
   * this space via `hostX`; only the drag band, positioned against the host,
   * converts back out.
   */
  private plotRect(): { x: number; y: number; width: number; height: number } | null {
    const p = this.engine?.getScene()?.plot;
    return p ? { x: p.x, y: p.y, width: p.width, height: p.height } : null;
  }

  /** Offset of the canvas box inside the host box — canvas space → host space. */
  private canvasOffset(): { x: number; y: number } {
    const canvas = this.chartHost;
    if (!canvas) return { x: 0, y: 0 };
    const host = this.el.getBoundingClientRect();
    const box = canvas.getBoundingClientRect();
    return { x: box.left - host.left, y: box.top - host.top };
  }

  /** Drag-band geometry, converted from canvas space back out to host space. */
  private zoomBandStyle(): { [key: string]: string } | undefined {
    const plot = this.plotRect();
    if (!this.dragBand || !plot) return undefined;
    const off = this.canvasOffset();
    const { x1, x2 } = this.dragBand;
    return {
      left: `${off.x + Math.min(x1, x2)}px`,
      width: `${Math.abs(x2 - x1)}px`,
      top: `${off.y + plot.y}px`,
      height: `${plot.height}px`,
    };
  }

  /** Pointer x in CANVAS coordinates — the space `plotRect`/`xPositions` use. */
  private hostX(e: MouseEvent): number {
    return e.clientX - (this.chartHost ?? this.el).getBoundingClientRect().left;
  }

  /** Map a canvas-relative x to the nearest ABSOLUTE category index. */
  private indexAtX(hostX: number): number {
    const scene = this.engine?.getScene();
    const w = this.win();
    const xs = scene?.xPositions;
    if (!xs?.length) return w.start;
    let best = 0;
    let bestD = Infinity;
    xs.forEach((px, i) => {
      const d = Math.abs(px - hostX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return w.start + best;
  }

  /** Is the event over the plot itself (not the header, zoom slider, footer)? */
  private insidePlot(e: MouseEvent): boolean {
    const plot = this.plotRect();
    if (!plot) return false;
    const box = (this.chartHost ?? this.el).getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    return x >= plot.x && x <= plot.x + plot.width && y >= plot.y && y <= plot.y + plot.height;
  }

  private onPlotPointerDown = (e: PointerEvent) => {
    if (!this.zoomInside || e.button !== 0 || this.grab) return;
    if (!this.insidePlot(e)) return;
    const x = this.hostX(e);
    this.grab = { id: e.pointerId, kind: 'band', x, win: this.win() };
    this.dragBand = { x1: x, x2: x };
    // Capture on the element really under the pointer (the shadow canvas), NOT
    // `e.target` — a host-level listener retargets to the host, and capturing
    // there would route the closing `click` to the host where the engine's
    // canvas never sees it, silently killing every bar click while zoom is on.
    const target = (e.composedPath?.()[0] as HTMLElement | undefined) ?? (e.target as HTMLElement);
    target.setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    const g = this.grab;
    if (!g || g.id !== e.pointerId) return;
    if (g.kind === 'band') {
      const plot = this.plotRect();
      if (!plot) return;
      this.dragBand = { x1: g.x, x2: Math.min(Math.max(this.hostX(e), plot.x), plot.x + plot.width) };
      return;
    }
    // Pan: shift the window by the pointer's travel along the slider track,
    // keeping its span (fractions of the full range, so it tracks the thumbs).
    const frac = this.trackFrac(e.clientX);
    const originFrac = this.trackFrac(g.x);
    if (frac == null || originFrac == null) return;
    const last = Math.max(1, this.dataLength() - 1);
    const span = g.win.end - g.win.start;
    const delta = Math.round((frac - originFrac) * last);
    const s = Math.min(Math.max(0, g.win.start + delta), last - span);
    this.applyZoom(s, s + span);
  };

  private onPointerUp = (e: PointerEvent) => {
    const g = this.grab;
    if (!g || g.id !== e.pointerId) return;
    this.grab = null;
    const band = this.dragBand;
    this.dragBand = null;
    if (g.kind !== 'band' || !band) return;
    // A tiny drag is a click, not a zoom — leave the view alone so bar clicks
    // and tooltips keep working.
    if (Math.abs(band.x2 - band.x1) < 8) return;
    // In RTL the plot is mirrored, so order by index, not by pixel, or the
    // window comes out reversed.
    const [a, b] = [this.indexAtX(band.x1), this.indexAtX(band.x2)].sort((m, n) => m - n);
    if (b - a >= 1) this.applyZoom(a, b);
  };

  private onPlotDblClick = (e: MouseEvent) => {
    // Plot only: a double-click on the zoom slider is two track clicks, not a
    // request to throw the window away.
    if (this.zoomInside && this.zoomWin && this.insidePlot(e)) this.resetZoom();
  };

  /**
   * The zoom slider's track box. `md-slider` maps 0→100% across its own host
   * box, so the host rect *is* the track — measuring it keeps the pan gesture
   * in step with the thumbs.
   */
  private sliderTrackRect(): { left: number; width: number; rtl: boolean } | null {
    const slider = this.el.shadowRoot?.querySelector('.md-bar-chart__zoom-slider');
    if (!slider) return null;
    const r = slider.getBoundingClientRect();
    if (!r.width) return null;
    return { left: r.left, width: r.width, rtl: getComputedStyle(this.el).direction === 'rtl' };
  }

  /** Client x → fraction along the zoom track (RTL-aware, as md-slider is). */
  private trackFrac(clientX: number): number | null {
    const track = this.sliderTrackRect();
    if (!track) return null;
    const raw = (clientX - track.left) / track.width;
    return Math.min(Math.max(track.rtl ? 1 - raw : raw, 0), 1);
  }

  private onZoomPanDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // Keep it away from the plot-drag handler on the host, and from the
    // slider's own rail (which would resize instead of pan).
    e.stopPropagation();
    e.preventDefault();
    this.grab = { id: e.pointerId, kind: 'pan', x: e.clientX, win: this.win() };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  /** md-slider drives the window while a thumb moves (continuous). */
  private onZoomSliderInput = (e: CustomEvent<{ valueStart?: number; valueEnd?: number }>) => {
    // md-slider's events are composed, so they would surface on the chart's own
    // host and look like chart events to a consumer. Stop them here.
    e.stopPropagation();
    const { valueStart, valueEnd } = e.detail ?? {};
    if (valueStart == null || valueEnd == null) return;
    this.applyZoom(valueStart, valueEnd);
  };

  /** Swallow the slider's remaining composed events (see above). mdInput has
   *  already applied the window, so the commit needs no second applyZoom. */
  private onZoomSliderEvent = (e: Event) => e.stopPropagation();

  private renderZoomSlider() {
    const last = Math.max(1, this.dataLength() - 1);
    const w = this.win();
    const pct = (i: number) => (i / last) * 100;
    const fmt = (i: number) => String(this.xAxis?.data?.[i] ?? i);
    return (
      <div class="md-bar-chart__zoom" part="zoom">
        <md-slider
          class="md-bar-chart__zoom-slider"
          part="zoom-slider"
          exportparts="track: zoom-track, track-active: zoom-window, thumb-knob: zoom-handle"
          range
          controlled
          min={0}
          max={last}
          step={1}
          valueStart={w.start}
          valueEnd={w.end}
          ariaLabelStart={this.labelZoomStart}
          ariaLabelEnd={this.labelZoomEnd}
          valueStartText={fmt(w.start)}
          valueEndText={fmt(w.end)}
          onMdInput={this.onZoomSliderInput}
          onMdChange={this.onZoomSliderEvent}
          onMdDragStart={this.onZoomSliderEvent}
          onMdDragEnd={this.onZoomSliderEvent}
          onMdFocus={this.onZoomSliderEvent}
          onMdBlur={this.onZoomSliderEvent}
        ></md-slider>

        {/* Pan grip over the selected window. Inset at both ends so the thumbs
            stay grabbable, and it collapses to nothing on a narrow window. */}
        <div
          class="md-bar-chart__zoom-pan"
          part="zoom-pan"
          style={{
            insetInlineStart: `calc(${pct(w.start)}% + var(--_zoom-pan-inset))`,
            inlineSize: `max(0px, calc(${pct(w.end) - pct(w.start)}% - 2 * var(--_zoom-pan-inset)))`,
          }}
          onPointerDown={this.onZoomPanDown}
        ></div>
      </div>
    );
  }

  private buildSpec(t: ReturnType<typeof readMdChartTheme>): BarChartSpec {
    const percentage = this.stack === 'percentage';
    const vFmt = (v: number) => (this.valueFormatter ? this.valueFormatter(v) : v.toLocaleString(this.locale || undefined));
    const keys = this.seriesKeys();
    // Zoom is a view: slice what the engine draws, leave `this.series` alone.
    // Per-category options (`data`, `range`) are sliced; index-keyed maps
    // (`pointWidths`, `pointColors`) are rebased into window coordinates and
    // anything outside the window is dropped.
    const zw = this.zoomWin && !this.polar ? this.win() : null;
    const cut = <T,>(arr: readonly T[] | undefined): T[] | undefined =>
      arr ? (zw ? arr.slice(zw.start, zw.end + 1) : arr.slice()) : undefined;
    const rebaseMap = <T,>(rec: Record<number, T> | undefined): Record<number, T> | undefined => {
      if (!rec || !zw) return rec;
      const out: Record<number, T> = {};
      for (const [k, v] of Object.entries(rec)) {
        const i = Number(k) - zw.start;
        if (i >= 0 && i <= zw.end - zw.start) out[i] = v;
      }
      return out;
    };
    return {
      series: this.series.map((s, i) => {
        let pointColors: Record<number, string> | undefined;
        if (s.pointColors) {
          const resolved: Record<number, string> = {};
          for (const [k, c] of Object.entries(s.pointColors)) resolved[Number(k)] = resolveSeriesColor(this.el, c, pickPaletteColor(t.palette, i));
          pointColors = rebaseMap(resolved);
        }
        return {
          label: s.label ?? `Series ${i + 1}`,
          color: resolveSeriesColor(this.el, s.color, pickPaletteColor(t.palette, i)),
          data: cut(s.data) ?? [],
          hidden: s.hidden ?? this.legendHidden.get(keys[i]) ?? false,
          stack: s.stack,
          axisIndex: s.yAxisIndex,
          overlay: s.overlay,
          widthRatio: s.widthRatio,
          pointWidths: rebaseMap(s.pointWidths),
          range: cut(s.range)?.map(normalizeRange),
          pointColors,
        };
      }),
      title: this.label || undefined,
      subtitle: this.subtitle || undefined,
      titleAlign: this.titleAlign,
      categories: cut(this.xAxis?.data) ?? [],
      categoryFormatter: this.xAxis?.valueFormatter ?? defaultValueFormatter,
      categoryLabelRotation: this.xAxis?.labelRotation,
      categoryLabelsMirrored: this.xAxis?.mirrorLabels,
      // `yAxis` IS the value axis whichever way the bars run, so its formatter
      // is the one that shapes the value ticks. It was declared on the type and
      // read for the category axis but never for this one, so a chart asking
      // for `300k` on the axis silently got `300,000`.
      valueAxis2: this.yAxis2
        ? {
            min: this.yAxis2.min,
            max: this.yAxis2.max,
            label: this.yAxis2.label,
            formatter: this.yAxis2.valueFormatter ? (v: number) => String(this.yAxis2!.valueFormatter!(v)) : undefined,
            hidden: this.yAxis2.hidden,
          }
        : undefined,
      valueTickFormatter: this.yAxis?.valueFormatter
        ? (v: number) => String(this.yAxis!.valueFormatter!(v))
        : undefined,
      categoryLabel: this.xAxis?.label,
      categoryHidden: this.xAxis?.hidden,
      categoryHideTicks: this.xAxis?.hideTicks,
      categoryAxisLine: this.xAxis?.axisLine,
      categoryDash: this.xAxis?.dash,
      valueScale: this.yAxis?.scale ?? 'value',
      // The value axis is y for vertical bars and x for horizontal ones, so
      // read breaks from whichever axis config carries the values.
      valueBreaks: (this.layout === 'horizontal' ? this.xAxis : this.yAxis)?.breaks,
      valueMin: percentage ? 0 : this.yAxis?.min,
      valueMax: percentage ? 100 : this.yAxis?.max,
      valueFormatter: percentage ? (v: number) => `${Math.round(v)}%` : vFmt,
      valueLabel: this.yAxis?.label,
      valueHidden: this.yAxis?.hidden,
      valueHideTicks: this.yAxis?.hideTicks,
      valueAxisLine: this.yAxis?.axisLine,
      valueDash: this.yAxis?.dash,
      valueGridDash: this.yAxis?.gridDash,
      stack: this.stack,
      horizontal: this.layout === 'horizontal',
      categoryGapRatio: this.parseRatio(this.categoryGap, 0.3),
      barGapRatio: this.parseRatio(this.barGap, 0.2),
      barWidth: this.barWidth,
      cornerRadius: this.cornerRadius,
      showLabels: this.showLabels,
      showTotals: this.showTotals,
      chevron: this.chevron,
      polar: this.polar,
      polarHole: this.polarHole,
      polarSweep: this.polarSweep,
      legend: this.legend,
      axisTicks: this.axisTicks,
      animation: this.noAnimation ? 'none' : this.animation,
      animationDuration: this.animationDuration,
    };
  }

  private applyEngine(snap = false) {
    if (!this.engine) return;
    const t = readMdChartTheme(this.el);
    this.engine.setSpec(this.buildSpec(t), this.buildEngineTheme(t), {
      onHover: (idx) => {
        if (idx < 0) return;
        // The engine reports indices into what it DREW (the zoom window), so
        // rebase to an absolute index before reporting / indexing full arrays.
        const abs = idx + this.winStart();
        this.mdHover.emit({
          dataIndex: abs,
          axisValue: this.xAxis?.data?.[abs],
          seriesIndices: this.visibleSeriesIndices(),
        });
      },
      onLegendClick: (item) => {
        this.rememberLegendToggle(item.seriesIndex, !!item.hidden);
        this.mdLegendClick.emit({
          seriesIndex: item.seriesIndex,
          seriesId: this.series[item.seriesIndex]?.id,
          selected: !item.hidden,
        });
      },
      onPointClick: (si, di, e) => {
        const s = this.series[si];
        if (!s) return;
        const abs = di + this.winStart(); // windowed → absolute (see onHover)
        this.mdBarClick.emit({
          seriesIndex: si,
          seriesId: s.id,
          dataIndex: abs,
          value: s.data?.[abs] ?? null,
          axisValue: this.xAxis?.data?.[abs],
          nativeEvent: e,
          series: s,
        });
      },
    }, { animate: !snap });
    this.engine.setHoverEnabled(this.tooltip !== 'none');
    this.engine.setClickable(this.clickable);
    this.engine.setTooltip({ render: this.tooltipRenderer, missingFormatter: this.valueFormatter });
  }

  private visibleSeriesIndices(): number[] {
    const hp = this.engine?.getScene()?.hoverPoints;
    if (hp) return hp.map((h) => h.seriesIndex);
    return this.series.map((_, i) => i).filter((i) => !this.series[i].hidden);
  }

  private rebuildA11yTable() {
    if (!this.a11yTableHost) return;
    this.a11yTableHost.innerHTML = buildDataTableHtml({
      title: this.label,
      xAxisLabel: this.xAxis?.label,
      xAxisData: this.xAxis?.data,
      xValueFormatter: this.xAxis?.valueFormatter ?? ((v: MdChartAxisValue) => defaultValueFormatter(v, this.locale)),
      locale: this.locale,
      series: this.series,
      valueFormatter: this.valueFormatter,
    });
  }


  /**
   * Walk the data with the keyboard. Without this the readings are reachable
   * only by hovering, which no keyboard or screen-reader user can do.
   * Arrows follow the READING direction, so in RTL, Left advances.
   */
  private onPlotKeyDown = (e: KeyboardEvent) => {
    const scene = this.engine?.getScene();
    const last = Math.max(0, (scene?.xPositions.length ?? 0) - 1);
    if (!scene || last < 0) return;
    const rtl = typeof getComputedStyle === 'function' && getComputedStyle(this.el).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = this.kbIndex;
    switch (e.key) {
      case forward:
        next = this.kbIndex < 0 ? 0 : Math.min(last, this.kbIndex + 1);
        break;
      case back:
        next = this.kbIndex < 0 ? last : Math.max(0, this.kbIndex - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      case 'Escape':
        if (this.kbIndex < 0) return;
        next = -1;
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar': // legacy key name
        if (this.kbIndex < 0) return;
        e.preventDefault();
        this.emitBarClickForCategory(this.kbIndex, e);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.moveKeyboardCursor(next);
  };

  /** Fire `mdBarClick` for the focused category so a keyboard user can activate a
   *  bar (e.g. to drill), matching the pointer click. Picks the first visible
   *  series present at that category. */
  private emitBarClickForCategory(dataIndex: number, nativeEvent: KeyboardEvent): void {
    const si = this.visibleSeriesIndices()[0] ?? 0;
    const s = this.series[si];
    if (!s) return;
    // `dataIndex` is the keyboard cursor, which walks the windowed scene —
    // rebase to absolute before reporting / indexing the full series.
    const abs = dataIndex + this.winStart();
    this.mdBarClick.emit({
      seriesIndex: si,
      seriesId: s.id,
      dataIndex: abs,
      value: s.data?.[abs] ?? null,
      axisValue: this.xAxis?.data?.[abs],
      nativeEvent,
      series: s,
    });
  }

  private onPlotBlur = () => {
    if (this.kbIndex >= 0) this.moveKeyboardCursor(-1);
  };

  /** Move the keyboard cursor, mirroring it into the hover UI and live region. */
  private moveKeyboardCursor(next: number) {
    this.kbIndex = next;
    this.engine?.focusIndex(next);
    if (next < 0) {
      this.announcement = '';
      return;
    }
    const scene = this.engine?.getScene();
    const xText = scene?.xLabels?.[next] ?? String(next + 1);
    const yFmt = (v: number) =>
      this.valueFormatter ? this.valueFormatter(v) : v.toLocaleString(this.locale || undefined);
    const values = (scene?.hoverPoints ?? [])
      .map((hp) => {
        const pt = hp.byIndex[next];
        return pt ? `${hp.label} ${yFmt(pt.value)}` : null;
      })
      .filter(Boolean)
      .join(', ');
    this.announcement = this.labelPoint.replace('%x%', xText).replace('%values%', values);
  }

  render() {
    const xValues = this.xAxis?.data ?? [];
    const summary = buildChartSummary({
      title: this.label, chartType: 'bar', seriesCount: this.series.length,
      xMin: xValues[0] as MdChartAxisValue | undefined,
      xMax: xValues[xValues.length - 1] as MdChartAxisValue | undefined,
    });
    // While loading, the loader owns the box — an empty-state message under it
    // answers "no data" to a question nobody asked yet.
    const empty = this.series.length === 0 && !this.loading;
    return (
      <Host
        class={{
          'md-bar-chart': true,
          'md-bar-chart--empty': empty,
          'md-bar-chart--loading': this.loading,
          'md-bar-chart--mounted': this.mounted,
          'md-bar-chart--zoom-slider': this.zoomSliderOn,
          'md-bar-chart--zoom-drag': this.zoomInside,
          [`md-bar-chart--${this.layout}`]: true,
        }}
        role="figure"
        aria-label={summary}
        aria-busy={this.loading ? 'true' : null}
        style={this.heightProp ? { blockSize: this.heightProp } : undefined}
        onPointerDown={this.onPlotPointerDown}
        onPointerMove={this.onPointerMove}
        onPointerUp={this.onPointerUp}
        onPointerCancel={this.onPointerUp}
        onDblClick={this.onPlotDblClick}
      >
        <header class="md-bar-chart__header" part="header"><slot name="header"></slot></header>
        <div
          class="md-bar-chart__canvas"
          part="canvas"
          ref={el => this.bindChartHost(el as HTMLDivElement)}
          tabindex={empty ? undefined : '0'}
          role={empty ? undefined : 'application'}
          aria-label={empty ? undefined : this.labelPlot}
          onKeyDown={this.onPlotKeyDown}
          onBlur={this.onPlotBlur}
        ></div>
        {empty && (
          <div class="md-bar-chart__empty" part="empty">
            <slot name="empty">No data to display</slot>
          </div>
        )}

        {this.loading && (
          <div class="md-bar-chart__loading" part="loading" role="status">
            {/* `loader` is the library-wide name for "swap the loading affordance";
                `loading` is kept as the older alias. Nesting them means either
                works — the outer slot falls back to the inner one, which falls
                back to the default below — and `loader` wins if both are given. */}
            <slot name="loader">
              <slot name="loading">
              <md-progress-indicator
                class="md-bar-chart__spinner"
                variant="circular"
                indeterminate
                label={this.loadingLabel}
              ></md-progress-indicator>
              <span class="md-bar-chart__loading-text">{this.loadingLabel}</span>
            </slot>
            </slot>
          </div>
        )}

        {/* Drag-to-zoom band — purely visual, so it never eats pointer events. */}
        {this.dragBand && Math.abs(this.dragBand.x2 - this.dragBand.x1) > 1 && (
          <div
            class="md-bar-chart__zoom-band"
            part="zoom-band"
            style={this.zoomBandStyle()}
          ></div>
        )}

        {this.zoomSliderOn && this.renderZoomSlider()}

        <footer class="md-bar-chart__footer" part="footer"><slot name="footer"></slot></footer>
        <div class="md-bar-chart__a11y-table" ref={el => this.bindA11yTableHost(el as HTMLDivElement)}></div>

        {/* Narrates the keyboard cursor, politely. */}
        <div class="md-bar-chart__live" role="status" aria-live="polite" aria-atomic="true">
          {this.announcement}
        </div>
      </Host>
    );
  }
}
