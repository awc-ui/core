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
  resolveAxisBands,
  resolveSeriesColor,
  LineChartEngine,
  type EngineTheme,
  type LineChartSpec,
  type MdChartAnimation,
  type MdChartAxis,
  type MdChartAxisClickDetail,
  type MdChartAxisValue,
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
 * md-area-chart — Material Design 3 area / streamgraph chart,
 * rendered by the in-house engine (Canvas2D + a DOM text
 * overlay). No ECharts.
 *
 * Differences from `md-line-chart`:
 *   • the line is always filled with a gradient
 *   • stacking defaults to `'normal'` (areas stack additively)
 *   • supports the `silhouette` streamgraph baseline
 *   • markers are off by default
 */
@Component({
  tag: 'md-area-chart',
  styleUrl: 'md-area-chart.css',
  shadow: true,
})
export class MdAreaChart {
  @Element() el!: HTMLElement;

  @Prop() label: string = '';

  /** Sub-title, drawn under the title in the muted text colour. */
  @Prop() subtitle: string | undefined;
  /** Title alignment over the plot: `start` (left), `center`, or `end` (right). */
  @Prop({ attribute: 'title-align' }) titleAlign: MdChartTitleAlign = 'start';
  @Prop() series: MdChartSeries[] = [];
  @Prop() xAxis: MdChartAxis | undefined;
  @Prop() yAxis: MdChartAxis | undefined;
  @Prop() curve: 'linear' | 'smooth' | 'monotone' | 'step' | 'step-before' | 'step-middle' = 'smooth';

  /** Default stacking is `'normal'` (additive). */
  @Prop() stack: MdChartStackMode = 'normal';

  @Prop({ attribute: 'connect-nulls' }) connectNulls: boolean = false;
  @Prop({ attribute: 'show-marks' }) showMarks: boolean = false;
  /** Line stroke width in px, for every series. Per-series `series[].lineWidth` wins. */
  @Prop({ attribute: 'line-width' }) lineWidth?: number;
  /** Marker RADIUS in px, for every series. Per-series `series[].markSize` wins. */
  @Prop({ attribute: 'mark-size' }) markSize?: number;
  @Prop({ reflect: true }) legend: MdChartLegendPosition | 'none' = 'top-end';
  @Prop() tooltip: MdChartTooltipTrigger = 'axis';
  @Prop() zoom: 'none' | 'inside' | 'slider' | 'both' = 'none';
  /**
   * Format raw Y values for tooltips / a11y table. The tooltip also asks it
   * about series with NO value at the hovered x — `null` for a null datum,
   * `undefined` for no datum at all — and shows a row for one when it returns
   * a non-empty string.
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

  /** Fill opacity for the gradient (0..1). */
  @Prop({ attribute: 'fill-opacity' }) fillOpacity: number = 0.55;

  /**
   * Draw the line on top of each area's fill. Default `true`. Set `false` for a
   * fill-only area — useful when `fillOpacity` is high (a fully-opaque fill is the
   * same colour as the line, so the line reads as part of it). A per-series
   * `series[].stroke` still wins over this.
   */
  @Prop({ attribute: 'show-line' }) showLine: boolean = true;

  /** Gridlines: horizontal (y ticks), vertical (x ticks), both, or none. */
  @Prop() grid: 'none' | 'horizontal' | 'vertical' | 'both' = 'horizontal';

  /**
   * Transpose the axes: the category / time axis runs down the side and values
   * run across the bottom. Suits long category names (they read horizontally
   * instead of rotated) and quantities naturally read as depth — altitude,
   * ocean depth, a drill core. `stack` applies as usual, along the value axis.
   */
  @Prop() inverted: boolean = false;

  /** Label each series at its last point, so the name follows the end of the
   *  band — for racing / progression charts. */
  @Prop({ attribute: 'series-labels' }) seriesLabels: boolean = false;

  /**
   * Replaces the generated `aria-label` outright. The default summary is
   * assembled in English ("Traffic, Area chart, with 3 series, from Jan to
   * Dec."); rather than translate it piecewise, hand over the whole sentence
   * built in your own language.
   */
  @Prop() summary: string = '';

  /**
   * Translatable chrome for the screen-reader data table. `%shown%` and
   * `%total%` are substituted in `truncated`.
   */
  @Prop() tableLabels?: { x?: string; index?: string; series?: string; truncated?: string };

  /** Message shown when `series` is empty. The `empty` slot overrides it. */
  @Prop({ attribute: 'label-empty' }) labelEmpty: string = 'No data to display';

  /** Show the loading overlay instead of the plot. */
  @Prop() loading: boolean = false;

  /** Text (and the spinner's accessible name) for the loading overlay. */
  @Prop({ attribute: 'loading-label' }) loadingLabel: string = 'Loading chart…';

  /** Accessible name for the zoom slider's start thumb. */
  @Prop({ attribute: 'label-zoom-start' }) labelZoomStart: string = 'Zoom range start';
  /** Accessible name for the zoom slider's end thumb. */
  @Prop({ attribute: 'label-zoom-end' }) labelZoomEnd: string = 'Zoom range end';

  /** Draw small perpendicular tick marks on the axes. */
  @Prop({ attribute: 'axis-ticks' }) axisTicks: boolean = false;
  /** Print each point's value as a data label beside its marker. */
  @Prop({ attribute: 'show-labels' }) showLabels: boolean = false;

  @Event() mdMarkerClick!: EventEmitter<MdChartClickDetail<MdChartSeries>>;

  /** Fires when a series' drawn line is clicked *between* its data points (a
   *  click on a point emits `mdMarkerClick` instead). */
  @Event() mdLineClick!: EventEmitter<MdChartClickDetail<MdChartSeries>>;

  /** Fires when a series' filled area is clicked — the band between its line
   *  and its base (its own band when stacked), excluding its line and points. */
  @Event() mdAreaClick!: EventEmitter<MdChartClickDetail<MdChartSeries>>;

  /** Fires when the plot background is clicked (inside the plot, but not on a
   *  mark, line or area): the nearest x plus every visible series' value there. */
  @Event() mdAxisClick!: EventEmitter<MdChartAxisClickDetail>;

  @Event() mdLegendClick!: EventEmitter<{ seriesIndex: number; seriesId?: string; selected: boolean }>;
  @Event() mdHover!: EventEmitter<MdChartHoverDetail>;
  @Event() mdReady!: EventEmitter<void>;

  /** Fires when the zoom window changes (drag, slider or `setZoom`/`resetZoom`). */
  @Event() mdZoom!: EventEmitter<{ startIndex: number; endIndex: number; reset: boolean }>;

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

  /** Visible index window, or null for the full range. */
  @State() private zoomWin: { start: number; end: number } | null = null;

  /** Live drag rectangle (plot-relative px) while selecting a range to zoom. */
  @State() private dragBand: { x1: number; x2: number } | null = null;

  /**
   * Pointer id + origin of an in-progress gesture: `band` is a drag across the
   * plot, `pan` is a drag of the zoom window. (Resizing the window is the
   * slider's own gesture — see `renderZoomSlider`.)
   */
  private grab: { id: number; kind: 'band' | 'pan'; x: number; win: { start: number; end: number } } | null = null;


  private engine: LineChartEngine | null = null;
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

  @Watch('series') @Watch('xAxis') @Watch('yAxis')
  @Watch('curve') @Watch('stack') @Watch('legend')
  @Watch('tooltip') @Watch('zoom') @Watch('connectNulls')
  @Watch('showMarks') @Watch('lineWidth') @Watch('markSize') @Watch('label') @Watch('subtitle') @Watch('titleAlign') @Watch('fillOpacity') @Watch('showLine') @Watch('grid') @Watch('axisTicks') @Watch('showLabels') @Watch('inverted') @Watch('loading')
  @Watch('animation') @Watch('animationDuration') @Watch('tooltipRenderer') @Watch('valueFormatter')
  onAnyPropChange() {
    this.applyEngine();
    this.rebuildA11yTable();
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

  /** Replay the entry animation from the start (uses the current `animation`). */
  @Method()
  async replay(): Promise<void> {
    this.engine?.replay();
  }

  @Method()
  async toDataURL(): Promise<string> {
    return this.engine?.toDataURL('image/png') ?? '';
  }

  @Method()
  async getInstance(): Promise<LineChartEngine | null> {
    return this.engine;
  }

  private bindChartHost = (el?: HTMLDivElement) => {
    this.chartHost = el;
  };

  private bindA11yTableHost = (el?: HTMLDivElement) => {
    this.a11yTableHost = el;
  };

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
      this.engine = new LineChartEngine(this.chartHost);
    } catch {
      this.engine = null;
    }
    if (this.engine && typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.engine?.resize());
      this.ro.observe(this.chartHost);
    }
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

  private get zoomInside(): boolean {
    return this.zoom === 'inside' || this.zoom === 'both';
  }

  private get zoomSliderOn(): boolean {
    return this.zoom === 'slider' || this.zoom === 'both';
  }

  /** Number of datapoints along x — the longest series, or the axis if longer. */
  private dataLength(): number {
    const longest = this.series.reduce(
      (acc, s) => Math.max(acc, s.range?.length ?? s.data?.length ?? 0),
      0,
    );
    return Math.max(longest, this.xAxis?.data?.length ?? 0);
  }

  /** Current window, defaulted to the full range and clamped to the data. */
  private win(): { start: number; end: number } {
    const last = Math.max(0, this.dataLength() - 1);
    const w = this.zoomWin;
    if (!w) return { start: 0, end: last };
    // Keep at least two points visible, else there is no band to draw.
    const start = Math.min(Math.max(0, w.start), Math.max(0, last - 1));
    return { start, end: Math.min(Math.max(start + 1, w.end), last) };
  }

  private applyZoom(start: number, end: number, reset = false): void {
    const last = Math.max(0, this.dataLength() - 1);
    const s = Math.min(Math.max(0, Math.round(start)), Math.max(0, last - 1));
    const e = Math.min(Math.max(s + 1, Math.round(end)), last);
    this.zoomWin = reset ? null : { start: s, end: e };
    this.applyEngine();
    this.rebuildA11yTable();
    this.mdZoom.emit({ startIndex: reset ? 0 : s, endIndex: reset ? last : e, reset });
  }

  /** Zoom to an absolute index range. */
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
   * this space via `plotX`/`plotY`; only the drag band, positioned against the
   * host, converts back out. Reading these as host coordinates drew the band
   * ~16px above the x-axis and shifted the selected range by the same amount.
   */
  private plotRect(): { x: number; y: number; width: number; height: number } | null {
    const p = this.engine?.getScene()?.plot;
    return p ? { x: p.x, y: p.y, width: p.width, height: p.height } : null;
  }

  /**
   * Drag-band geometry, converted from canvas space back out to host space
   * (the band is `position: absolute` inside a `position: relative` :host).
   *
   * Physical `left`/`top`, not logical insets: both values are offsets from the
   * host's LEFT edge, which `inset-inline-start` would mirror to the right in
   * RTL. Same idiom as md-line-chart / md-bar-chart.
   */
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

  /** Offset of the canvas box inside the host box — canvas space → host space. */
  private canvasOffset(): { x: number; y: number } {
    const canvas = this.chartHost;
    if (!canvas) return { x: 0, y: 0 };
    const host = this.el.getBoundingClientRect();
    const box = canvas.getBoundingClientRect();
    return { x: box.left - host.left, y: box.top - host.top };
  }

  /** Map a canvas-relative x to the nearest ABSOLUTE data index. */
  private indexAtX(hostX: number): number {
    const scene = this.engine?.getScene();
    const w = this.win();
    if (!scene?.xPositions?.length) return w.start;
    let best = 0;
    let bestD = Infinity;
    scene.xPositions.forEach((px, i) => {
      const d = Math.abs(px - hostX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return w.start + best;
  }

  /** Pointer x in CANVAS coordinates — the space `plotRect`/`xPositions` use. */
  private hostX(e: MouseEvent): number {
    return e.clientX - (this.chartHost ?? this.el).getBoundingClientRect().left;
  }

  /** Is the event over the plot itself (as opposed to the header, slider, footer)? */
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
    // Capture on the element really under the pointer, NOT `e.target`: this
    // listener is on the host, so a shadow-internal target is retargeted to the
    // host, and capturing there would send the whole gesture — including the
    // closing click — to the host, where the plot canvas never sees it.
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
    // keeping its span. Fractions of the full range, so it tracks the thumbs.
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
    // A tiny drag is a click, not a zoom — leave the view alone so marker
    // clicks and tooltips keep working.
    if (Math.abs(band.x2 - band.x1) < 8) return;
    // In RTL the plot is mirrored, so the LEFT edge of the band is the LATER
    // index — order by index, not by pixel, or the window comes out reversed.
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
    const slider = this.el.shadowRoot?.querySelector('.md-area-chart__zoom-slider');
    if (!slider) return null;
    const r = slider.getBoundingClientRect();
    if (!r.width) return null;
    return { left: r.left, width: r.width, rtl: getComputedStyle(this.el).direction === 'rtl' };
  }

  /** Client x → fraction along the zoom track (RTL-aware, as md-slider is). */
  private trackFrac(clientX: number): number | null {
    const track = this.sliderTrackRect();
    if (!track) return null;
    const f = (clientX - track.left) / track.width;
    return track.rtl ? 1 - f : f;
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
      <div class="md-area-chart__zoom" part="zoom">
        <md-slider
          class="md-area-chart__zoom-slider"
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
          class="md-area-chart__zoom-pan"
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

  private buildSpec(t: ReturnType<typeof readMdChartTheme>): LineChartSpec {
    const percentage = this.stack === 'percentage';
    const yFmt = (v: number) => (this.valueFormatter ? this.valueFormatter(v) : v.toLocaleString(this.locale || undefined));
    // Zoom is a view: slice what the engine draws, leave `this.series` alone.
    // Index-addressed options (pointSymbols) are rebased into window
    // coordinates, and anything outside the window is dropped.
    const zw = this.zoomWin ? this.win() : null;
    const cut = <T,>(arr: T[] | undefined): T[] | undefined =>
      arr && zw ? arr.slice(zw.start, zw.end + 1) : arr;
    const rebaseMap = <T,>(rec: Record<number, T> | undefined): Record<number, T> | undefined => {
      if (!rec || !zw) return rec;
      const out: Record<number, T> = {};
      for (const [k, v] of Object.entries(rec)) {
        const i = Number(k) - zw.start;
        if (i >= 0 && i <= zw.end - zw.start) out[i] = v;
      }
      return out;
    };
    const keys = this.seriesKeys();
    return {
      series: this.series.map((s, i) => ({
        label: s.label ?? `Series ${i + 1}`,
        color: resolveSeriesColor(this.el, s.color, pickPaletteColor(t.palette, i)),
        // A range series draws from its band; `data` only keeps the row count
        // aligned so the shared x axis and hover index still line up.
        data: cut(s.range ? s.range.map(() => null) : s.data) ?? [],
        range: cut(s.range?.map(normalizeRange)),
        fill: s.fill,
        // A streamgraph rides a free baseline, so a layer's top edge is not a
        // value anyone can read — stroking it just adds noise. Explicit
        // per-series `stroke` still wins.
        stroke: s.stroke ?? (!this.showLine || this.stack === 'wiggle' || this.stack === 'silhouette' ? false : undefined),
        curve: s.curve ?? this.curve,
        connectNulls: s.connectNulls ?? this.connectNulls,
        showMarks: s.showMarks ?? this.showMarks,
        hidden: s.hidden ?? this.legendHidden.get(keys[i]) ?? false,
        dash: s.dash,
        symbol: s.symbol,
        pointSymbols: rebaseMap(s.pointSymbols),
        lineWidth: s.lineWidth ?? this.lineWidth,
        markSize: s.markSize ?? this.markSize,
      })),
      title: this.label || undefined,
      subtitle: this.subtitle || undefined,
      titleAlign: this.titleAlign,
      animation: this.noAnimation ? 'none' : this.animation,
      animationDuration: this.animationDuration,
      xValues: cut(this.xAxis?.data) ?? [],
      xScale: this.xAxis?.scale ?? 'category',
      xFormatter: this.xAxis?.valueFormatter ?? ((v: MdChartAxisValue) => defaultValueFormatter(v, this.locale)),
      xLabel: this.xAxis?.label,
      xHidden: this.xAxis?.hidden,
      xHideTicks: this.xAxis?.hideTicks,
      xDash: this.xAxis?.dash,
      xGridDash: this.xAxis?.gridDash,
      xBands: resolveAxisBands(this.el, this.xAxis?.bands),
      yBands: resolveAxisBands(this.el, this.yAxis?.bands),
      xBreaks: this.xAxis?.breaks,
      yBreaks: this.yAxis?.breaks,
      yScale: this.yAxis?.scale ?? 'value',
      yMin: percentage ? 0 : this.yAxis?.min,
      yMax: percentage ? 100 : this.yAxis?.max,
      yFormatter: percentage ? (v: number) => `${Math.round(v)}%` : yFmt,
      // The axis can format independently of the values (bare numbers on the
      // axis, units in the tooltip); unset → the axis follows `valueFormatter`.
      yTickFormatter:
        !percentage && this.yAxis?.valueFormatter ? (v: number) => this.yAxis!.valueFormatter!(v) : undefined,
      yLabel: this.yAxis?.label,
      yHidden: this.yAxis?.hidden,
      yHideTicks: this.yAxis?.hideTicks,
      yDash: this.yAxis?.dash,
      yGridDash: this.yAxis?.gridDash,
      stack: this.stack,
      inverted: this.inverted,
      area: true,
      fillOpacity: this.fillOpacity,
      legend: this.legend,
      gridY: this.grid === 'horizontal' || this.grid === 'both',
      gridX: this.grid === 'vertical' || this.grid === 'both',
      axisTicks: this.axisTicks,
      showLabels: this.showLabels,
      seriesLabels: this.seriesLabels,
    };
  }

  private applyEngine() {
    if (!this.engine) return;
    const t = readMdChartTheme(this.el);
    this.engine.setSpec(this.buildSpec(t), this.buildEngineTheme(t), {
      onHover: (idx) => {
        if (idx < 0) return;
        // The engine indexes the WINDOW; consumers index the data they gave us.
        const abs = idx + (this.zoomWin ? this.win().start : 0);
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
        const d = this.clickDetail(si, di, e);
        if (d) this.mdMarkerClick.emit(d);
      },
      onLineClick: (si, di, e) => {
        const d = this.clickDetail(si, di, e);
        if (d) this.mdLineClick.emit(d);
      },
      onAreaClick: (si, di, e) => {
        const d = this.clickDetail(si, di, e);
        if (d) this.mdAreaClick.emit(d);
      },
      onAxisClick: (di, values, e) => {
        const abs = di + (this.zoomWin ? this.win().start : 0);
        this.mdAxisClick.emit({
          dataIndex: abs,
          axisValue: this.xAxis?.data?.[abs],
          seriesValues: values.map((v) => ({
            seriesIndex: v.seriesIndex,
            seriesId: this.series[v.seriesIndex]?.id,
            label: v.label,
            dataIndex: v.value == null ? -1 : abs,
            value: v.value,
          })),
          nativeEvent: e,
        });
      },
    });
    this.engine.setHoverEnabled(this.tooltip !== 'none');
    this.engine.setTooltip({
      render: this.tooltipRenderer,
      missingFormatter: this.valueFormatter,
      // `item` reports only the band under the cursor; `axis` lists them all.
      trigger: this.tooltip === 'item' ? 'item' : 'axis',
    });
  }

  /** The payload shared by the three per-series click events (marker / line /
   *  area) — same shape, different gesture. */
  private clickDetail(si: number, di: number, e: PointerEvent): MdChartClickDetail<MdChartSeries> | null {
    const s = this.series[si];
    if (!s) return null;
    const abs = di + (this.zoomWin ? this.win().start : 0);
    return {
      seriesIndex: si,
      seriesId: s.id,
      dataIndex: abs,
      value: s.data[abs] ?? null,
      axisValue: this.xAxis?.data?.[abs],
      nativeEvent: e,
      series: s,
    };
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
      labels: this.tableLabels,
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
      default:
        return;
    }
    e.preventDefault();
    this.moveKeyboardCursor(next);
  };

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
    const summary =
      this.summary ||
      buildChartSummary({
        title: this.label,
        chartType: 'area',
        seriesCount: this.series.length,
        locale: this.locale,
        xMin: xValues[0] as MdChartAxisValue | undefined,
        xMax: xValues[xValues.length - 1] as MdChartAxisValue | undefined,
      });
    // While loading, the loader owns the box — an empty-state message under it
    // would just be the wrong answer to "where is my data?".
    const empty = this.series.length === 0 && !this.loading;

    return (
      <Host
        class={{
          'md-area-chart': true,
          'md-area-chart--empty': empty,
          'md-area-chart--mounted': this.mounted,
          'md-area-chart--zoom-slider': this.zoomSliderOn,
          'md-area-chart--zoom-drag': this.zoomInside,
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
        <header class="md-area-chart__header" part="header"><slot name="header"></slot></header>
        <div
          class="md-area-chart__canvas"
          part="canvas"
          ref={el => this.bindChartHost(el as HTMLDivElement)}
          tabindex={empty ? undefined : '0'}
          role={empty ? undefined : 'application'}
          aria-label={empty ? undefined : this.labelPlot}
          onKeyDown={this.onPlotKeyDown}
          onBlur={this.onPlotBlur}
        ></div>
        {empty && (
          <div class="md-area-chart__empty" part="empty">
            <slot name="empty">{this.labelEmpty}</slot>
          </div>
        )}

        {/* Loader — same opaque overlay as the empty state, so the phantom axis
            the engine draws for absent data can't show through. */}
        {this.loading && (
          <div class="md-area-chart__loading" part="loading" role="status">
            {/* `loader` is the library-wide name for "swap the loading affordance";
                `loading` is kept as the older alias. Nesting them means either
                works — the outer slot falls back to the inner one, which falls
                back to the default below — and `loader` wins if both are given. */}
            <slot name="loader">
              <slot name="loading">
              <md-progress-indicator
                class="md-area-chart__spinner"
                variant="circular"
                indeterminate
                label={this.loadingLabel}
              ></md-progress-indicator>
              <span class="md-area-chart__loading-text">{this.loadingLabel}</span>
            </slot>
            </slot>
          </div>
        )}
        {/* Live drag selection over the plot, while a zoom range is dragged. */}
        {this.dragBand && this.plotRect() && (
          <div
            class="md-area-chart__zoom-band"
            part="zoom-band"
            style={this.zoomBandStyle()}
          ></div>
        )}
        {this.zoomSliderOn && this.renderZoomSlider()}
        <footer class="md-area-chart__footer" part="footer"><slot name="footer"></slot></footer>
        <div class="md-area-chart__a11y-table" ref={el => this.bindA11yTableHost(el as HTMLDivElement)}></div>

        {/* Narrates the keyboard cursor, politely. */}
        <div class="md-area-chart__live" role="status" aria-live="polite" aria-atomic="true">
          {this.announcement}
        </div>
      </Host>
    );
  }
}
