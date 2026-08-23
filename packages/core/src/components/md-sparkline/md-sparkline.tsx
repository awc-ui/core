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
  pickPaletteColor,
  readMdChartTheme,
  resolveSeriesColor,
  BarChartEngine,
  LineChartEngine,
  type BarChartSpec,
  type EngineTheme,
  type LineChartSpec,
  type RefBand,
  type MdChartAxisValue,
  type MdChartColorRole,
  type MdChartCurve,
  type MdChartDataPoint,
  watchMdChartTheme,
} from '../../utils/charts';

export interface MdSparklineReferenceArea {
  /** Range start (index into the data array). */
  from: number;
  /** Range end. */
  to: number;
  /** Highlight colour. Defaults to a tinted version of the line. */
  color?: string;
  /** Optional accessible label (announced in screen-reader summary). */
  label?: string;
}

/**
 * md-sparkline — compact inline chart, rendered by the in-house
 * engine (Canvas2D). No ECharts.
 *
 * Sparklines are presentational: no axes, no legend, no title, no
 * tooltip by default (opt in with `show-tooltip`). Line / area drive
 * LineChartEngine in `compact` mode; the bar variant drives
 * BarChartEngine. `show-marks` maps to selective extremes/edges dots.
 */
@Component({
  tag: 'md-sparkline',
  styleUrl: 'md-sparkline.css',
  shadow: true,
})
export class MdSparkline {
  @Element() el!: HTMLElement;

  /** Numeric data series. Pass `null` for gaps. */
  @Prop() data: MdChartDataPoint[] = [];

  /** Optional category labels for tooltips / a11y. */
  @Prop() labels: (string | number | Date)[] | undefined;

  /** Visual variant. */
  @Prop({ reflect: true }) variant: 'line' | 'bar' | 'area' = 'line';

  /** Sparkline tint (MD3 role or raw colour). */
  @Prop() color: MdChartColorRole | string = 'primary';

  /** Curve type — only meaningful for line / area variants. */
  @Prop() curve: MdChartCurve = 'smooth';

  /** Show tooltip + crosshair on hover. Defaults to true. */
  @Prop({ attribute: 'show-tooltip' }) showTooltip: boolean = true;

  /** Show min / max / first / last markers. */
  @Prop({ attribute: 'show-marks' }) showMarks: 'none' | 'extremes' | 'edges' | 'all' = 'extremes';

  /** Highlight a vertical range (e.g. weekend, anomaly window). */
  @Prop() referenceAreas: MdSparklineReferenceArea[] | undefined;

  /** Format raw values for tooltips / a11y. */
  @Prop() valueFormatter?: (value: number | null) => string;

  /** Block-size override (defaults to 28px — table-cell friendly). */
  @Prop({ attribute: 'height' }) heightProp?: string;

  /** Disable all animation. */
  @Prop({ attribute: 'no-animation' }) noAnimation: boolean = false;

  /** Bar corner radius (bar variant only). */
  @Prop({ attribute: 'corner-radius' }) cornerRadius: number = 2;

  /**
   * Pin the value scale's LOWER bound instead of auto-scaling to the data. Give
   * several sparklines the same `min` + `max` and they share a comparable scale —
   * a 0–40% metric no longer fills the whole height and reads as maxed out.
   */
  @Prop() min?: number;
  /** Pin the value scale's UPPER bound instead of auto-scaling to the data. */
  @Prop() max?: number;

  /** Line stroke width in px (line / area variants). Default 2.5. */
  @Prop({ attribute: 'line-width' }) lineWidth?: number;
  /** Marker RADIUS in px (line / area variants). Overrides the per-symbol default. */
  @Prop({ attribute: 'mark-size' }) markSize?: number;

  /** Fixed bar WIDTH in px (bar variant), centred in each slot. Default: auto. */
  @Prop({ attribute: 'bar-width' }) barWidth?: number;

  @Event() mdSparkClick!: EventEmitter<{ dataIndex: number; value: number | null }>;
  @Event() mdReady!: EventEmitter<void>;

  @State() private mounted = false;

  private engine: LineChartEngine | BarChartEngine | null = null;
  private engineKind: 'line' | 'bar' | null = null;
  private ro: ResizeObserver | null = null;
  private chartHost?: HTMLDivElement;
  /** Tears down the theme watch (media query + ancestor attribute observer). */
  private disposeThemeWatch?: () => void;

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

  @Watch('data') @Watch('labels') @Watch('variant') @Watch('color')
  @Watch('curve') @Watch('showTooltip') @Watch('showMarks')
  @Watch('referenceAreas') @Watch('cornerRadius') @Watch('min') @Watch('max')
  @Watch('lineWidth') @Watch('markSize') @Watch('barWidth')
  onAnyPropChange() { this.applyEngine(); }

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

  @Method()
  async getInstance(): Promise<LineChartEngine | BarChartEngine | null> {
    return this.engine;
  }

  private bindChartHost = (el?: HTMLDivElement) => { this.chartHost = el; };

  private initChart() {
    if (!this.chartHost) return;
    this.applyEngine();
    if (this.engine && !this.ro && typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.engine?.resize());
      this.ro.observe(this.chartHost);
    }
    this.mounted = true;
    this.mdReady.emit();
  }

  /** Create/replace the engine so it matches the current variant. */
  private ensureEngine(): boolean {
    if (!this.chartHost) return false;
    const kind: 'line' | 'bar' = this.variant === 'bar' ? 'bar' : 'line';
    if (this.engine && this.engineKind === kind) return true;
    try {
      this.engine?.dispose();
      this.engine = kind === 'bar' ? new BarChartEngine(this.chartHost) : new LineChartEngine(this.chartHost);
      this.engineKind = kind;
    } catch {
      this.engine = null;
      this.engineKind = null;
      return false;
    }
    return true;
  }

  private markIndices(): number[] {
    const nums: { d: number; i: number }[] = [];
    this.data.forEach((d, i) => { if (typeof d === 'number') nums.push({ d, i }); });
    if (!nums.length || this.showMarks === 'none') return [];
    // `all` marks EVERY point (on a monotonic line the extremes ARE the edges, so
    // `extremes`+`edges` collapsed to just the two ends — which read as "nothing").
    if (this.showMarks === 'all') return nums.map((n) => n.i);
    const set = new Set<number>();
    if (this.showMarks === 'extremes') {
      let max = nums[0]; let min = nums[0];
      for (const n of nums) { if (n.d > max.d) max = n; if (n.d < min.d) min = n; }
      set.add(max.i); set.add(min.i);
    }
    if (this.showMarks === 'edges') {
      set.add(nums[0].i);
      set.add(nums[nums.length - 1].i);
    }
    return [...set];
  }

  private buildEngineTheme(t: ReturnType<typeof readMdChartTheme>): EngineTheme {
    return {
      background: 'transparent',
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

  private buildLineSpec(color: string): LineChartSpec {
    const fmt = (v: number) => (this.valueFormatter ? this.valueFormatter(v) : v.toLocaleString());
    const refBands: RefBand[] | undefined = this.referenceAreas?.map((r) => ({
      from: r.from,
      to: r.to,
      color: toRgba(r.color ?? color, r.color ? 0.18 : 0.12),
    }));
    return {
      series: [{
        label: '',
        color,
        data: this.data,
        curve: this.curve,
        connectNulls: true,
        showMarks: false,
        hidden: false,
        markIndices: this.markIndices(),
        lineWidth: this.lineWidth,
        markSize: this.markSize,
      }],
      xValues: this.labels ?? this.data.map((_, i) => i),
      xScale: 'category',
      xFormatter: (v) => String(v),
      xHidden: true,
      yScale: 'value',
      yMin: this.min,
      yMax: this.max,
      yFormatter: fmt,
      yHidden: true,
      stack: 'none',
      area: this.variant === 'area',
      fillOpacity: 0.45,
      legend: 'none',
      compact: true,
      refBands,
      // Same grow-and-fade entrance as the full charts (once, on first mount);
      // honours no-animation and prefers-reduced-motion.
      animate: !this.noAnimation,
    };
  }

  private buildBarSpec(color: string): BarChartSpec {
    const fmt = (v: number) => (this.valueFormatter ? this.valueFormatter(v) : v.toLocaleString());
    return {
      series: [{ label: '', color, data: this.data, hidden: false }],
      categories: (this.labels ?? this.data.map((_, i) => i)) as MdChartAxisValue[],
      categoryFormatter: (v) => String(v),
      categoryHidden: true,
      valueScale: 'value',
      valueMin: this.min,
      valueMax: this.max,
      valueFormatter: fmt,
      valueHidden: true,
      stack: 'none',
      horizontal: false,
      categoryGapRatio: 0.2,
      barGapRatio: 0,
      barWidth: this.barWidth,
      cornerRadius: this.cornerRadius,
      showLabels: false,
      legend: 'none',
      compact: true,
      // Same grow-and-fade entrance as the full charts (once, on first mount);
      // honours no-animation and prefers-reduced-motion.
      animate: !this.noAnimation,
    };
  }

  private applyEngine() {
    if (!this.ensureEngine() || !this.engine) return;
    const t = readMdChartTheme(this.el);
    const color = resolveSeriesColor(this.el, this.color, pickPaletteColor(t.palette, 0));
    const theme = this.buildEngineTheme(t);
    const onPointClick = (_si: number, di: number) => {
      const v = this.data[di];
      this.mdSparkClick.emit({ dataIndex: di, value: typeof v === 'number' ? v : null });
    };
    if (this.engine instanceof BarChartEngine) {
      this.engine.setSpec(this.buildBarSpec(color), theme, { onPointClick });
    } else {
      this.engine.setSpec(this.buildLineSpec(color), theme, { onPointClick });
    }
    this.engine.setHoverEnabled(this.showTooltip);
  }

  render() {
    const finiteValues = this.data.filter((d): d is number => typeof d === 'number');
    const last = finiteValues.length ? finiteValues[finiteValues.length - 1] : null;
    const max = finiteValues.length ? Math.max(...finiteValues) : null;
    const min = finiteValues.length ? Math.min(...finiteValues) : null;
    const fmt = this.valueFormatter ?? ((v: number | null) => (v == null ? '—' : v.toLocaleString()));
    // Announce any labelled reference windows — sparklines have no SR data table,
    // so aria-label is the only surface a screen-reader user has for them.
    const refLabels = (this.referenceAreas ?? []).map((r) => r.label).filter((l): l is string => !!l);
    const refNote = refLabels.length ? ` Highlighted: ${refLabels.join(', ')}.` : '';
    const summary = finiteValues.length
      ? `Sparkline, latest ${fmt(last)}, range ${fmt(min)} to ${fmt(max)}.${refNote}`
      : `Sparkline, no data.${refNote}`;

    return (
      <Host
        class={{
          'md-sparkline': true,
          'md-sparkline--mounted': this.mounted,
          [`md-sparkline--${this.variant}`]: true,
        }}
        role="img"
        aria-label={summary}
        style={this.heightProp ? { blockSize: this.heightProp } : undefined}
      >
        <div class="md-sparkline__canvas" part="canvas" ref={el => this.bindChartHost(el as HTMLDivElement)}></div>
      </Host>
    );
  }
}

function toRgba(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb(')) return color.replace(/^rgb\(/, 'rgba(').replace(/\)$/, `, ${alpha})`);
  return color;
}
