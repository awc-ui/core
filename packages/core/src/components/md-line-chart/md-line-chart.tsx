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
  datumY,
  defaultValueFormatter,
  normalizeSeriesX,
  pickPaletteColor,
  readMdChartTheme,
  remapIndexRecord,
  resolveAxisBands,
  resolveSeriesColor,
  LineChartEngine,
  type AxisSeriesValue,
  type EngineTheme,
  type LineChartSpec,
  type MdChartAnimation,
  type MdChartAxis,
  type MdChartAxisClickDetail,
  type MdChartAxisSeriesValue,
  type MdChartAxisValue,
  type MdChartClickDetail,
  type MdChartHoverDetail,
  type MdChartLegendPosition,
  type MdChartMarkLine,
  type MdChartStackMode,
  type MdChartTitleAlign,
  type MdChartTooltipRenderer,
  type MdChartTooltipTrigger,
  type MdChartXYSeries,
  type NormalizedSeriesX,
  watchMdChartTheme,
} from '../../utils/charts';

/**
 * md-line-chart — Material Design 3 line chart rendered by the
 * in-house chart engine (Canvas2D + a DOM text overlay). No
 * ECharts.
 *
 * Pattern parity with MUI X Charts:
 *   • multi-series with per-series colour / label / curve
 *   • category, time, value, log scales
 *   • curve types: linear / smooth / monotone / step variants
 *   • stacking: normal / percentage
 *   • markers, area fills, gap bridging (`connectNulls`)
 *   • legend with toggle + custom position
 *   • hover crosshair + tooltip
 *   • emits `mdMarkerClick`, `mdLineClick`, `mdAreaClick`, `mdAxisClick`,
 *     `mdLegendClick`, `mdHover`
 *
 * MD3 expressive layer on top:
 *   • palette resolves to `--md-sys-color-*` tokens
 *   • dark theme + brand re-themes via CSS variables only
 *   • a11y: role="figure" + screen-reader-only data table
 *   • fully responsive via ResizeObserver
 */
@Component({
  tag: 'md-line-chart',
  styleUrl: 'md-line-chart.css',
  shadow: true,
})
export class MdLineChart {
  @Element() el!: HTMLElement;

  /** Optional chart title rendered above the plot. */
  @Prop() label: string = '';

  /** Optional sub-title rendered under the title in the muted text colour. */
  @Prop() subtitle: string | undefined;

  /** Vertical reference lines across the plot (e.g. a "current time" divider). */
  @Prop() markLines: MdChartMarkLine[] | undefined;

  /** Title alignment over the plot: `start` (left), `center`, or `end` (right). */
  @Prop({ attribute: 'title-align' }) titleAlign: MdChartTitleAlign = 'start';

  /**
   * Series array. Each entry is one line. Empty → empty state.
   *
   * `data` is either a bare list of y values, positioned by index against
   * `xAxis.data`, or a list of points carrying their own x —
   * `{ x: '2021-11-13', y: 0.12 }` / `['2021-11-13', 0.12]`. Points are what
   * irregular data needs: uneven sampling, or several series measured on
   * completely different dates. Set `xAxis.scale = 'time'` (or `'value'`) so
   * the gaps render proportionally; series carrying their own x need no
   * `xAxis.data` at all.
   */
  @Prop() series: MdChartXYSeries[] = [];

  /** X-axis configuration. */
  @Prop() xAxis: MdChartAxis | undefined;

  /** Y-axis configuration. */
  @Prop() yAxis: MdChartAxis | undefined;

  /**
   * Multiple independent value (y) axes. When set (non-empty), each series is
   * measured against `yAxes[series.yAxisIndex ?? 0]`, and the axes stack outward
   * from the plot (first → left, rest → right, or per each axis' `position`).
   * Supersedes the single `yAxis`. Each axis keeps its own `min`/`max`/`scale`/
   * `valueFormatter`/`label`.
   */
  @Prop() yAxes: MdChartAxis[] | undefined;

  /** Default curve interpolation. Overridable per-series. */
  @Prop() curve: 'linear' | 'smooth' | 'monotone' | 'step' | 'step-before' | 'step-middle' = 'smooth';

  /** Stacking strategy. */
  @Prop() stack: MdChartStackMode = 'none';

  /** Whether `null` values are bridged with a straight line. */
  @Prop({ attribute: 'connect-nulls' }) connectNulls: boolean = false;

  /** Show data-point markers on every series by default. */
  @Prop({ attribute: 'show-marks' }) showMarks: boolean = false;

  /** Line stroke width in px, for every series. Default 2.5; a per-series
   *  `series[].lineWidth` overrides it. */
  @Prop({ attribute: 'line-width' }) lineWidth?: number;
  /** Marker RADIUS in px, for every series. Overrides the per-symbol default; a
   *  per-series `series[].markSize` wins. */
  @Prop({ attribute: 'mark-size' }) markSize?: number;

  /** Render the line area as a filled gradient below the line. */
  @Prop() area: boolean = false;

  /**
   * Draw the line for each series. Default `true`. Set `false` for a fill-only
   * chart (with `area`) or a marks-only chart — handy when a high `fillOpacity`
   * makes the same-coloured line vanish into the fill. A per-series
   * `series[].stroke` still wins over this.
   */
  @Prop({ attribute: 'show-line' }) showLine: boolean = true;

  /** Legend position. `'none'` hides the legend. */
  @Prop({ reflect: true }) legend: MdChartLegendPosition | 'none' = 'top-end';

  /** Tooltip interaction model. */
  @Prop() tooltip: MdChartTooltipTrigger = 'axis';

  /** Gridlines: horizontal (y ticks), vertical (x ticks), both, or none. */
  @Prop() grid: 'none' | 'horizontal' | 'vertical' | 'both' = 'horizontal';

  /** Draw small perpendicular tick marks on the axes. */
  @Prop({ attribute: 'axis-ticks' }) axisTicks: boolean = false;

  /** Transpose the axes — the x-axis data runs vertically and the values run
   *  horizontally (e.g. a temperature-by-altitude spline). Best with `curve="smooth"`. */
  @Prop() inverted: boolean = false;

  /** Print each point's value as a data label beside its marker. */
  @Prop({ attribute: 'show-labels' }) showLabels: boolean = false;

  /** Label each series at its last point with its name (follows the line end). */
  @Prop({ attribute: 'series-labels' }) seriesLabels: boolean = false;

  /**
   * Interactive zoom over the x range.
   *   • `inside` — drag horizontally across the plot to zoom into that span;
   *     double-click anywhere in the plot to reset.
   *   • `slider` — an `md-slider` in range mode under the plot: drag either
   *     thumb to resize the window, click the track to jump the nearest thumb,
   *     drag the window itself to pan. Thumbs are focusable and take
   *     Arrow/Home/End/PageUp/PageDown.
   *   • `both` — both of the above.
   *
   * Zoom is a *view* over the data: `series`/`xAxis` are untouched, and
   * `mdHover`/`mdMarkerClick` keep reporting absolute indices into your data.
   */
  @Prop() zoom: 'none' | 'inside' | 'slider' | 'both' = 'none';

  /**
   * BCP-47 locale for the DEFAULT number / date formatting — axis ticks,
   * tooltip values and the screen-reader table. Empty follows the browser.
   * An explicit `valueFormatter` / `xAxis.valueFormatter` always wins, so a
   * consumer that formats its own values is unaffected.
   */
  @Prop() locale: string = '';

  /**
   * Text shown when there is no data. The `empty` slot still overrides it —
   * this is the prop form, for handing a string straight from a dictionary.
   */
  @Prop({ attribute: 'label-empty' }) labelEmpty: string = 'No data to display';

  /**
   * Instructions announced when the plot receives keyboard focus. The plot is
   * focusable so a keyboard user can walk the data with the arrow keys; this
   * is what tells them so.
   */
  @Prop({ attribute: 'label-plot' }) labelPlot: string =
    'Chart data. Use the arrow keys to move between points, Home and End for the first and last, Escape to leave.';

  /**
   * Template for the live announcement made as keyboard focus moves. `%x%` is
   * the axis value and `%values%` the series readings at it.
   */
  @Prop({ attribute: 'label-point' }) labelPoint: string = '%x%: %values%';

  /** Accessible label for the zoom slider's start thumb. */
  @Prop({ attribute: 'label-zoom-start' }) labelZoomStart: string = 'Zoom range start';

  /** Accessible label for the zoom slider's end thumb. */
  @Prop({ attribute: 'label-zoom-end' }) labelZoomEnd: string = 'Zoom range end';

  /**
   * Replaces the generated `aria-label` outright. The default summary is
   * assembled in English ("Revenue, Line chart, with 2 series, from Jan to
   * Dec."); rather than translate it piecewise, hand over the whole sentence
   * built in your own language.
   */
  @Prop() summary: string = '';

  /**
   * Translatable chrome for the screen-reader data table. `%shown%` and
   * `%total%` are substituted in `truncated`.
   */
  @Prop() tableLabels?: { x?: string; index?: string; series?: string; truncated?: string };

  /**
   * Format raw Y values for tooltips / a11y table.
   *
   * The tooltip also asks it about series with NO value at the hovered x —
   * `null` when the series has a null datum there, `undefined` when it has no
   * datum at all. Return `''` (or leave those cases unhandled) to keep the
   * default behaviour of omitting the series; return a string to show a row
   * for it — e.g. `(v) => (v === null ? 'no reading' : v === undefined ? '—' : v + ' m')`.
   */
  @Prop() valueFormatter?: (value: number | null | undefined) => string;

  /**
   * Replace the tooltip's content with your own. Receives everything the chart
   * knows about the hovered x — the axis value + its formatted label, and per
   * visible series the index, label, colour, raw and formatted value, and
   * whether it is the emphasised one — split into `series` (has a reading here)
   * and `missing` (does not).
   *
   * Return a DOM `Node` (what React / Vue / Angular renderers produce), a
   * string (inserted as TEXT, never parsed as markup), `{ unsafeHtml }` to opt
   * into raw HTML, `undefined` to fall back to the built-in tooltip, or `null`
   * for no tooltip at this x. The engine keeps positioning it, and it is still
   * the `tooltip` CSS part.
   */
  @Prop() tooltipRenderer?: MdChartTooltipRenderer;

  /** Force a specific height (CSS length). */
  @Prop({ attribute: 'height' }) heightProp?: string;

  /** Disable all animation (shorthand for `animation="none"`). */
  @Prop({ attribute: 'no-animation' }) noAnimation: boolean = false;

  /** Entry-animation variant: `expressive` (default), `grow`, `fade`, `draw`, or `none`. */
  @Prop() animation: MdChartAnimation = 'expressive';

  /** Entry-animation duration override in ms (≤ 0 disables). */
  @Prop({ attribute: 'animation-duration' }) animationDuration?: number;


  /**
   * Data is still on its way — the chart covers the plot with a loader instead
   * of drawing an empty (or stale) axis, and marks itself `aria-busy`.
   *
   * Set it while the fetch is in flight and clear it when `series` arrives; the
   * entry animation replays on the way out, so the data draws itself in rather
   * than appearing fully formed. Slot `loading` to replace the default
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

  /** Fires on marker click. `dataIndex` addresses the clicked series' own
   *  `data` array (its point index, for series that carry their own x). */
  @Event() mdMarkerClick!: EventEmitter<MdChartClickDetail<MdChartXYSeries>>;

  /** Fires when a series' drawn line is clicked *between* its data points (a
   *  click on a point emits `mdMarkerClick` instead). `dataIndex` is the point
   *  the click is nearest along x. */
  @Event() mdLineClick!: EventEmitter<MdChartClickDetail<MdChartXYSeries>>;

  /** Fires when a series' filled area is clicked (`area` charts only) — the
   *  region between that series' line and its baseline, excluding its line and
   *  points. `dataIndex` is the point the click is nearest along x. */
  @Event() mdAreaClick!: EventEmitter<MdChartClickDetail<MdChartXYSeries>>;

  /** Fires when the plot background is clicked (inside the plot, but not on a
   *  mark, line or area): the nearest x position plus every visible series'
   *  value there. */
  @Event() mdAxisClick!: EventEmitter<MdChartAxisClickDetail>;

  /** Fires when a legend entry is clicked. */
  @Event() mdLegendClick!: EventEmitter<{ seriesIndex: number; seriesId?: string; selected: boolean }>;

  /** Fires (throttled to rAF) as the pointer crosses the plot. */
  @Event() mdHover!: EventEmitter<MdChartHoverDetail>;

  /** Fires after the chart finishes its initial render. */
  @Event() mdReady!: EventEmitter<void>;

  /** Fires when the zoom window changes (drag, slider or `setZoom`/`resetZoom`). */
  @Event() mdZoom!: EventEmitter<{ startIndex: number; endIndex: number; reset: boolean }>;

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
   * Legend-toggle memory, keyed by series identity (id → label → position).
   * A legend click self-toggles the engine, but a live-updating consumer that
   * re-feeds `series` every frame (e.g. a line-race) would otherwise rebuild the
   * spec with the prop's `hidden` and lose the toggle. We remember the toggle
   * here and re-apply it in `buildSpec`, so visibility survives data updates
   * (ECharts-style), while an explicit `series[i].hidden` prop still wins.
   */
  private legendHidden = new Map<string, boolean>();

  /** Memo for {@link merged}, keyed on the identity of what it was built from. */
  private mergeCache: {
    series: unknown;
    axis: unknown;
    scale: string;
    out: NormalizedSeriesX;
  } | null = null;

  // ─────────────────── lifecycle ───────────────────

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

  @Watch('series')
  @Watch('xAxis')
  @Watch('yAxis')
  @Watch('yAxes')
  @Watch('curve')
  @Watch('stack')
  @Watch('area')
  @Watch('showLine')
  @Watch('legend')
  @Watch('tooltip')
  @Watch('grid')
  @Watch('axisTicks')
  @Watch('inverted')
  @Watch('showLabels')
  @Watch('seriesLabels')
  @Watch('connectNulls')
  @Watch('showMarks')
  @Watch('lineWidth')
  @Watch('markSize')
  @Watch('label')
  @Watch('subtitle')
  @Watch('markLines')
  @Watch('titleAlign')
  @Watch('animation')
  @Watch('animationDuration')
  @Watch('tooltipRenderer')
  @Watch('valueFormatter')
  onAnyPropChange() {
    this.applyEngine();
    this.rebuildA11yTable();
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

  // ─────────────────── public API ───────────────────

  /** Force a resize — useful after the chart was hidden then shown. */
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

  /** Render the current frame to a PNG data URL. */
  @Method()
  async toDataURL(): Promise<string> {
    return this.engine?.toDataURL('image/png') ?? '';
  }

  /** Return the underlying chart engine for advanced cases. */
  @Method()
  async getInstance(): Promise<LineChartEngine | null> {
    return this.engine;
  }

  // ─────────────────── internals ───────────────────

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
      // No usable DOM (mock-doc / SSR / no canvas). Stay mounted;
      // ResizeObserver / a prop change will retry in a real browser.
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

  /**
   * Collision-free identity per series for the legend-toggle memory. Prefers a
   * consumer `id`, else `label`, else positional index; duplicates of the same
   * base are disambiguated by occurrence (`#1`, `#2`, …) so two same-labelled
   * series never share one memory slot (a click on one would otherwise hide
   * both). A unique id/label stays stable across a re-fed reorder.
   */
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

  // ─────────────────── zoom ───────────────────

  private get zoomInside(): boolean {
    return this.zoom === 'inside' || this.zoom === 'both';
  }

  private get zoomSliderOn(): boolean {
    return this.zoom === 'slider' || this.zoom === 'both';
  }

  /**
   * Series merged onto one x axis (see `utils/charts/xy.ts`). Pass-through
   * unless a series carries its own x, and memoised on the identity of the
   * inputs so a render / hover / zoom trio doesn't re-merge the same feed.
   */
  private get merged(): NormalizedSeriesX {
    const scale = this.xAxis?.scale ?? 'category';
    const axis = this.xAxis?.data;
    const c = this.mergeCache;
    if (c && c.series === this.series && c.axis === axis && c.scale === scale) return c.out;
    const out = normalizeSeriesX(this.series ?? [], axis, scale);
    this.mergeCache = { series: this.series, axis, scale, out };
    return out;
  }

  /** Number of datapoints along x — the longest series, or the axis if longer. */
  private dataLength(): number {
    const m = this.merged;
    const s = m.data.reduce((acc, d) => Math.max(acc, d?.length ?? 0), 0);
    return Math.max(s, m.xValues.length);
  }

  /** Current window, defaulted to the full range and clamped to the data. */
  private win(): { start: number; end: number } {
    const last = Math.max(0, this.dataLength() - 1);
    const w = this.zoomWin;
    if (!w) return { start: 0, end: last };
    // Keep at least two points visible, else there is no line to draw.
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

  /** Is the event over the plot itself (as opposed to the header, zoom slider, footer)? */
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
    // Capture so the gesture survives the pointer leaving the plot — on the
    // element really under the pointer, NOT on `e.target`. This listener sits on
    // the host, so the shadow-internal target is retargeted to the host itself,
    // and capturing there sends the whole gesture — including the `click` that
    // closes it — to the host, where the engine's plot canvas never sees it. That
    // silently killed every chart click event whenever zoom was on.
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

  /**
   * Walk the data with the keyboard. The chart's information was previously
   * reachable only by hovering, which no keyboard or screen-reader user can
   * do; this gives them the same crosshair, tooltip and values.
   *
   * Arrow keys follow the READING direction, so in RTL, Left advances — the
   * plot is mirrored and an arrow that moved "back" visually would be wrong.
   */
  private onPlotKeyDown = (e: KeyboardEvent) => {
    const last = Math.max(0, this.dataLength() - 1);
    if (last < 0) return;
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
        if (this.kbIndex < 0) return;
        // Keyboard parity with clicking the plot background: the focus is on an
        // x position, not one series, which is exactly what mdAxisClick reports.
        this.mdAxisClick.emit(this.axisDetail(this.kbIndex, this.seriesValuesAt(this.kbIndex), e));
        e.preventDefault();
        return;
      default:
        return;
    }
    e.preventDefault();
    this.moveKeyboardCursor(next);
  };

  private onPlotBlur = () => {
    if (this.kbIndex >= 0) this.moveKeyboardCursor(-1);
  };

  /** Move the keyboard cursor, mirroring it into the hover UI and the live region. */
  private moveKeyboardCursor(next: number) {
    this.kbIndex = next;
    this.engine?.focusIndex(next);
    if (next < 0) {
      this.announcement = '';
      return;
    }
    const m = this.merged;
    const xRaw = m.xValues[next];
    const xText = this.xAxis?.valueFormatter
      ? this.xAxis.valueFormatter(xRaw)
      : defaultValueFormatter(xRaw ?? next + 1, this.locale);
    const yFmt = (v: number) =>
      this.valueFormatter ? this.valueFormatter(v) : v.toLocaleString(this.locale || undefined);
    const values = this.seriesValuesAt(next)
      .filter((sv: AxisSeriesValue) => sv.value != null)
      .map((sv: AxisSeriesValue) => `${sv.label} ${yFmt(sv.value as number)}`)
      .join(', ');
    this.announcement = this.labelPoint.replace('%x%', xText).replace('%values%', values);
    this.mdHover.emit({ dataIndex: next, axisValue: xRaw, seriesIndices: this.visibleSeriesIndices() });
  }

  private onPlotDblClick = (e: MouseEvent) => {
    // Plot only: a double-click on the zoom slider is two track clicks, not a
    // request to throw the window away.
    if (this.zoomInside && this.zoomWin && this.insidePlot(e)) this.resetZoom();
  };

  /**
   * The zoom slider's track box. `md-slider` maps 0→100% across its own host
   * box (surface and rail both flex to fill it), so the host rect *is* the
   * track — measuring it keeps the pan gesture in step with the thumbs.
   */
  private sliderTrackRect(): { left: number; width: number; rtl: boolean } | null {
    const slider = this.el.shadowRoot?.querySelector('.md-line-chart__zoom-slider');
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

  private buildSpec(t: ReturnType<typeof readMdChartTheme>): LineChartSpec {
    const percentage = this.stack === 'percentage';
    const yFmt = (v: number) =>
      this.valueFormatter ? this.valueFormatter(v) : v.toLocaleString(this.locale || undefined);
    // Re-apply remembered legend toggles by identity. We do NOT prune here: a
    // series that blips out of the feed for a frame must keep its toggle when it
    // returns. Growth is bounded in rememberLegendToggle instead.
    const keys = this.seriesKeys();
    // Zoom is a view: slice what the engine draws, leave `this.series` alone.
    // Anything index-addressed (dashAfter, pointSymbols, markIndices, markLines
    // on a category axis) is rebased into window coordinates, and anything that
    // falls outside the window is dropped.
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
    // Series that carry their own x are merged onto one axis first; index-
    // addressed options (pointSymbols, dashAfter) are rebased onto it before
    // the zoom window rebases them again.
    const m = this.merged;
    const series = this.series.map((s, i) => {
      const key = keys[i];
      const remembered = this.legendHidden.get(key);
      const toMerged = m.toMerged[i];
      const dashAt = s.dashAfter != null && toMerged ? toMerged[s.dashAfter] : s.dashAfter;
      // An explicit `hidden` prop takes control: it wins AND clears the legend
      // memory, so the consumer's value sticks across later omitted-hidden frames
      // (a 'show all' reset isn't silently re-hidden on the next frame).
      if (s.hidden !== undefined) this.legendHidden.delete(key);
      return {
        label: s.label ?? `Series ${i + 1}`,
        color: resolveSeriesColor(this.el, s.color, pickPaletteColor(t.palette, i)),
        data: cut(m.data[i]) ?? m.data[i] ?? [],
        curve: s.curve ?? this.curve,
        connectNulls: s.connectNulls ?? this.connectNulls,
        showMarks: s.showMarks ?? this.showMarks,
        hidden: s.hidden ?? remembered ?? false,
        dash: s.dash,
        symbol: s.symbol,
        pointSymbols: rebaseMap(remapIndexRecord(s.pointSymbols, toMerged)),
        yAxisIndex: s.yAxisIndex,
        dashAfter: dashAt != null && dashAt >= 0 && zw ? dashAt - zw.start : dashAt,
        hollow: s.hollow,
        stroke: s.stroke ?? (this.showLine ? undefined : false),
        lineWidth: s.lineWidth ?? this.lineWidth,
        markSize: s.markSize ?? this.markSize,
      };
    });
    return {
      series,
      title: this.label || undefined,
      subtitle: this.subtitle || undefined,
      markLines: this.markLines
        ?.map((ml) => {
          // On a category axis the value IS an index, so it rebases with the
          // window; on a value axis it is a real x value and must not move.
          const indexed = zw != null && (this.xAxis?.scale ?? 'category') === 'category' && typeof ml.value === 'number';
          const value = indexed ? (ml.value as number) - zw!.start : ml.value;
          return {
            value,
            label: ml.label,
            color: ml.color != null ? resolveSeriesColor(this.el, ml.color, ml.color) : undefined,
            dash: ml.dash,
            // Rebased out of view — dropped below rather than drawn at the edge.
            offscreen: indexed && (Number(value) < 0 || Number(value) > zw!.end - zw!.start),
          };
        })
        .filter((ml) => !ml.offscreen)
        .map(({ offscreen: _drop, ...ml }) => ml),
      titleAlign: this.titleAlign,
      xValues: cut(m.xValues) ?? [],
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
      yAxes: this.yAxes?.length
        ? this.yAxes.map((a) => ({
            scale: a.scale ?? 'value',
            min: a.min,
            max: a.max,
            formatter: a.valueFormatter
              ? (v: number) => a.valueFormatter!(v)
              : (v: number) => v.toLocaleString(this.locale || undefined),
            label: a.label,
            position: a.position,
            hidden: a.hidden,
            hideTicks: a.hideTicks,
            color: a.color != null ? resolveSeriesColor(this.el, a.color, a.color) : undefined,
            bands: resolveAxisBands(this.el, a.bands),
            dash: a.dash,
            gridDash: a.gridDash,
          }))
        : undefined,
      stack: this.stack,
      area: this.area,
      legend: this.legend,
      gridY: this.grid === 'horizontal' || this.grid === 'both',
      gridX: this.grid === 'vertical' || this.grid === 'both',
      axisTicks: this.axisTicks,
      inverted: this.inverted,
      showLabels: this.showLabels,
      seriesLabels: this.seriesLabels,
      animation: this.noAnimation ? 'none' : this.animation,
      animationDuration: this.animationDuration,
    };
  }

  private applyEngine() {
    if (!this.engine) return;
    const t = readMdChartTheme(this.el);
    this.engine.setSpec(this.buildSpec(t), this.buildEngineTheme(t), {
      onHover: (idx) => {
        if (idx < 0) return;
        // The engine indexes the sliced view; consumers get absolute indices.
        const abs = idx + (this.zoomWin ? this.win().start : 0);
        this.mdHover.emit({
          dataIndex: abs,
          axisValue: this.merged.xValues[abs],
          seriesIndices: this.visibleSeriesIndices(),
        });
      },
      onLegendClick: (item) => {
        // Remember the toggle so it survives a live consumer re-feeding `series`
        // every frame (the engine self-toggles; buildSpec re-applies this).
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
      onAxisClick: (di, values, e) => this.mdAxisClick.emit(this.axisDetail(di, values, e)),
    });
    // Honour the tooltip prop — the engine only exposes a hover on/off toggle.
    this.engine.setHoverEnabled(this.tooltip !== 'none');
    this.engine.setTooltip({
      render: this.tooltipRenderer,
      missingFormatter: this.valueFormatter,
      // `item` reports only the series under the cursor; `axis` lists them all.
      trigger: this.tooltip === 'item' ? 'item' : 'axis',
    });
  }

  /**
   * The payload shared by the three per-series click events (marker / line /
   * area). The engine reports indices into what it drew, so both the zoom
   * window and the merge onto one x axis are undone here: `dataIndex` addresses
   * the consumer's OWN array (for a series carrying its own x, that's its point
   * index, not the merged one).
   */
  private clickDetail(si: number, di: number, e: PointerEvent): MdChartClickDetail<MdChartXYSeries> | null {
    const s = this.series[si];
    if (!s) return null;
    const abs = di + (this.zoomWin ? this.win().start : 0);
    const own = this.ownIndex(si, abs);
    return {
      seriesIndex: si,
      seriesId: s.id,
      dataIndex: own >= 0 ? own : abs,
      value: own >= 0 ? datumY(s.data[own]) : null,
      axisValue: this.merged.xValues[abs],
      nativeEvent: e,
      series: s,
    };
  }

  /** Index into series `si`'s own `data` for an absolute (merged) x index, or
   *  -1 when that series has no point there. */
  private ownIndex(si: number, abs: number): number {
    const toOwn = this.merged.toOwn[si];
    return toOwn ? toOwn[abs] ?? -1 : abs;
  }

  /** `mdAxisClick`'s payload: the x the click is nearest, plus the reading of
   *  every visible series there (the rows the tooltip would show). */
  /**
   * Every visible series' reading at a data index, in the shape the axis-click
   * detail and the keyboard announcement both want. Read from the live scene,
   * so a legend-toggled series is excluded exactly as it is on screen.
   */
  private seriesValuesAt(di: number): AxisSeriesValue[] {
    const hp = this.engine?.getScene()?.hoverPoints ?? [];
    return hp.map((h) => ({
      seriesIndex: h.seriesIndex,
      label: h.label,
      value: h.byIndex[di]?.value ?? null,
    }));
  }

  private axisDetail(di: number, values: AxisSeriesValue[], e: PointerEvent | KeyboardEvent): MdChartAxisClickDetail {
    const abs = di + (this.zoomWin ? this.win().start : 0);
    const seriesValues: MdChartAxisSeriesValue[] = values.map((v) => {
      const own = this.ownIndex(v.seriesIndex, abs);
      return {
        seriesIndex: v.seriesIndex,
        seriesId: this.series[v.seriesIndex]?.id,
        label: v.label,
        dataIndex: v.value == null ? -1 : own,
        value: v.value,
      };
    });
    return { dataIndex: abs, axisValue: this.merged.xValues[abs], seriesValues, nativeEvent: e };
  }

  /** Visible (non-toggled-off) series indices — reads the engine's live state so
   *  an uncontrolled legend toggle is reflected, falling back to the prop. */
  private visibleSeriesIndices(): number[] {
    const hp = this.engine?.getScene()?.hoverPoints;
    if (hp) return hp.map((h) => h.seriesIndex);
    const keys = this.seriesKeys();
    return this.series
      .map((_, i) => i)
      .filter((i) => !(this.series[i].hidden ?? this.legendHidden.get(keys[i]) ?? false));
  }

  private rebuildA11yTable() {
    if (!this.a11yTableHost) return;
    // The table mirrors what's drawn, so it reads the merged axis: one row per
    // x, and a series with no sample at that x gets an empty cell.
    const m = this.merged;
    this.a11yTableHost.innerHTML = buildDataTableHtml({
      title: this.label,
      xAxisLabel: this.xAxis?.label,
      xAxisData: m.xValues,
      xValueFormatter: this.xAxis?.valueFormatter ?? ((v: MdChartAxisValue) => defaultValueFormatter(v, this.locale)),
      locale: this.locale,
      labels: this.tableLabels,
      series: this.series.map((s, i) => ({ label: s.label, data: m.data[i] ?? [] })),
      valueFormatter: this.valueFormatter,
    });
  }

  // ─────────────────── render ───────────────────

  /**
   * Range slider under the plot — the house `md-slider` in range mode, so the
   * thumbs, track, keyboard support and theming all come from the design
   * system. The chart stays the source of truth (`controlled`) because it
   * clamps the window to at least two points; on top of it sits a pan grip,
   * which is the one gesture a plain slider has no notion of.
   */
  private renderZoomSlider() {
    const last = Math.max(1, this.dataLength() - 1);
    const w = this.win();
    const pct = (i: number) => (i / last) * 100;
    const fmt = (i: number) => String(this.xAxis?.data?.[i] ?? i);
    return (
      <div class="md-line-chart__zoom" part="zoom">
        <md-slider
          class="md-line-chart__zoom-slider"
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
          class="md-line-chart__zoom-pan"
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

  render() {
    // Merged, so the announced range covers series that carry their own x.
    const xValues = this.merged.xValues;
    const summary =
      this.summary ||
      buildChartSummary({
        title: this.label,
        chartType: this.area ? 'area' : 'line',
        seriesCount: this.series.length,
        xMin: xValues[0] as MdChartAxisValue | undefined,
        xMax: xValues[xValues.length - 1] as MdChartAxisValue | undefined,
        locale: this.locale,
      });

    // While loading, the loader owns the box — an empty-state message under it
    // would just be the wrong answer to "where is my data?".
    const empty = this.series.length === 0 && !this.loading;

    return (
      <Host
        class={{
          'md-line-chart': true,
          'md-line-chart--empty': empty,
          'md-line-chart--loading': this.loading,
          'md-line-chart--mounted': this.mounted,
          'md-line-chart--zoom-slider': this.zoomSliderOn,
          'md-line-chart--zoom-drag': this.zoomInside,
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
        <header class="md-line-chart__header" part="header">
          <slot name="header"></slot>
        </header>

        {/* The plot is focusable so the data is reachable without a pointer:
            arrow keys walk the points, and each move is mirrored into the
            hover UI (for sighted keyboard users) and the live region (for
            screen readers). role=application stops a screen reader's browse
            mode from swallowing the arrow keys. */}
        <div
          class="md-line-chart__canvas"
          part="canvas"
          ref={el => this.bindChartHost(el as HTMLDivElement)}
          tabindex={empty ? undefined : '0'}
          role={empty ? undefined : 'application'}
          aria-label={empty ? undefined : this.labelPlot}
          onKeyDown={this.onPlotKeyDown}
          onBlur={this.onPlotBlur}
        ></div>

        {empty && (
          <div class="md-line-chart__empty" part="empty">
            <slot name="empty">{this.labelEmpty}</slot>
          </div>
        )}

        {/* Loader — same opaque overlay as the empty state, so the phantom axis
            the engine draws for absent data can't show through. */}
        {this.loading && (
          <div class="md-line-chart__loading" part="loading" role="status">
            {/* `loader` is the library-wide name for "swap the loading affordance";
                `loading` is kept as the older alias. Nesting them means either
                works — the outer slot falls back to the inner one, which falls
                back to the default below — and `loader` wins if both are given. */}
            <slot name="loader">
              <slot name="loading">
              <md-progress-indicator
                class="md-line-chart__spinner"
                variant="circular"
                indeterminate
                label={this.loadingLabel}
              ></md-progress-indicator>
              <span class="md-line-chart__loading-text">{this.loadingLabel}</span>
            </slot>
            </slot>
          </div>
        )}

        {/* Drag-to-zoom band — purely visual, so it never eats pointer events. */}
        {this.dragBand && Math.abs(this.dragBand.x2 - this.dragBand.x1) > 1 && (
          <div
            class="md-line-chart__zoom-band"
            part="zoom-band"
            style={this.zoomBandStyle()}
          ></div>
        )}

        {this.zoomSliderOn && this.renderZoomSlider()}

        <footer class="md-line-chart__footer" part="footer">
          <slot name="footer"></slot>
        </footer>

        {/* Screen-reader-only data table — the readable equivalent of
            the canvas plot (role=figure hides descendants from AT). */}
        <div
          class="md-line-chart__a11y-table"
          ref={el => this.bindA11yTableHost(el as HTMLDivElement)}
        ></div>

        {/* Narrates the keyboard cursor. Polite so it waits for the reader to
            finish rather than interrupting every arrow press. */}
        <div class="md-line-chart__live" role="status" aria-live="polite" aria-atomic="true">
          {this.announcement}
        </div>
      </Host>
    );
  }
}
