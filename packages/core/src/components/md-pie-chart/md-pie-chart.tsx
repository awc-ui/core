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
  harmonicPalette,
  mixColor,
  pickPaletteColor,
  readMdChartTheme,
  resolveSeriesColor,
  PieChartEngine,
  type EngineTheme,
  type PieChartSpec,
  type MdChartAnimation,
  type MdChartClickDetail,
  type MdChartLegendPosition,
  type MdChartTitleAlign,
  type MdChartTooltipRenderer,
  type MdChartTooltipTrigger,
  watchMdChartTheme,
} from '../../utils/charts';
import { mirrorLegend } from '../../utils/charts/engine/rtl';
import type { MdPieDatum } from './md-pie-chart.types';

/**
 * md-pie-chart — Material Design 3 pie / donut / semi-circle chart,
 * rendered by the in-house engine (Canvas2D + a DOM text overlay).
 * No ECharts.
 *
 *   • `innerRadius` for donuts, `outerRadius` for footprint
 *   • `startAngle` / `endAngle` for half-pies and arcs
 *   • `paddingAngle` inter-slice gaps
 *   • hover highlight (slice / series / none) + slice explode
 *   • centred label slot (donut centre)
 *   • role="figure" + screen-reader-only data table
 */
/** The list `d` belongs to, anywhere in the tree — its level, in other words. */
function findSiblings(items: MdPieDatum[], d: MdPieDatum): MdPieDatum[] | null {
  if (items.includes(d)) return items;
  for (const item of items) {
    if (item.children?.length) {
      const found = findSiblings(item.children, d);
      if (found) return found;
    }
  }
  return null;
}

@Component({
  tag: 'md-pie-chart',
  styleUrl: 'md-pie-chart.css',
  shadow: true,
})
export class MdPieChart {
  @Element() el!: HTMLElement;

  @Prop() label: string = '';
  /** Title alignment over the chart: `start` (left), `center`, or `end` (right). */
  @Prop({ attribute: 'title-align' }) titleAlign: MdChartTitleAlign = 'start';
  @Prop() data: MdPieDatum[] = [];

  /** Inner radius (`"0%"` = pie, `"60%"` = donut, or px number). */
  @Prop({ attribute: 'inner-radius' }) innerRadius: string | number = '0%';

  /** Outer radius. Defaults to `"75%"`. */
  @Prop({ attribute: 'outer-radius' }) outerRadius: string | number = '75%';

  /** Start angle in degrees (90 = 12-o'clock). */
  @Prop({ attribute: 'start-angle' }) startAngle: number = 90;

  /** End angle in degrees. */
  @Prop({ attribute: 'end-angle' }) endAngle: number = -270;

  /** Padding angle (degrees) between adjacent slices. */
  @Prop({ attribute: 'padding-angle' }) paddingAngle: number = 0;

  /** Border radius applied to each slice (reserved). */
  @Prop({ attribute: 'corner-radius' }) cornerRadius: number = 4;

  /** Show slice labels around the ring. */
  @Prop({ attribute: 'show-labels' }) showLabels: boolean = true;

  /**
   * What each slice's label says: its `value`, its `name`, or `both`. Defaults
   * to the value when a legend is present (it already names the slices) and to
   * both when there isn't one.
   */
  @Prop({ attribute: 'label-mode' }) labelMode?: 'value' | 'name' | 'both';

  /**
   * Render every slice as a shade of ONE colour instead of the categorical
   * palette — darkest first, lightening around the ring.
   *
   * Worth reaching for when the slices are ordered (a ranking, a funnel) rather
   * than merely different: a single hue stops the reader hunting for meaning in
   * colour that isn't there, and it survives most colour-vision deficiencies,
   * which a five-hue palette does not.
   *
   * Takes an MD3 role or any CSS colour. Present with no value (`monochrome`)
   * uses `primary`; absent means off — so an explicit empty string is the
   * "on, with the default" case rather than an accident.
   */
  @Prop({ attribute: 'monochrome' }) monochrome?: string;

  /**
   * Fill each slice with a gradient running outward from the centre, for depth.
   * Purely decorative — it changes nothing about what a slice means, which is
   * why it is off by default.
   */
  @Prop() gradient: boolean = false;

  /** Hover highlight scope: slice / series / none. */
  @Prop() highlight: 'slice' | 'series' | 'none' = 'slice';

  @Prop({ reflect: true }) legend: MdChartLegendPosition | 'none' = 'right';
  @Prop() tooltip: MdChartTooltipTrigger = 'item';
  /**
   * BCP-47 locale for the DEFAULT number formatting (tooltip values, the
   * screen-reader table). Empty follows the browser, which is the right default
   * only until the page has said otherwise; an explicit `valueFormatter` always
   * wins over it.
   */
  @Prop() locale: string = '';

  /** Sub-title, drawn under the title in the muted text colour. */
  @Prop() subtitle: string | undefined;

  /**
   * Replaces the generated `aria-label` outright. The default summary is
   * assembled in English; rather than translate it piecewise, hand over the
   * whole sentence built in your own language.
   */
  @Prop() summary: string = '';

  /** Translatable chrome for the screen-reader data table. */
  @Prop() tableLabels?: { category?: string; value?: string; share?: string };

  /** Message shown when `data` is empty. The `empty` slot overrides it. */
  @Prop({ attribute: 'label-empty' }) labelEmpty: string = 'No data to display';

  /** Show the loading overlay instead of the chart. */
  @Prop() loading: boolean = false;

  /** Text (and the spinner's accessible name) for the loading overlay. */
  @Prop({ attribute: 'loading-label' }) loadingLabel: string = 'Loading chart…';

  /**
   * Instructions announced when the plot receives keyboard focus. The plot is
   * focusable so a keyboard user can walk the slices; this is what tells them.
   */
  @Prop({ attribute: 'label-plot' }) labelPlot: string =
    'Chart data. Use the arrow keys to move between slices, Home and End for the first and last, Escape to leave.';

  /** Template for the live announcement as focus moves. `%label%` is the slice
   *  name, `%value%` its formatted value and `%percent%` its share. */
  @Prop({ attribute: 'label-point' }) labelPoint: string = '%label%: %value% (%percent%)';

  /** Replace the tooltip's content. See `md-line-chart`'s `tooltipRenderer`. */
  @Prop() tooltipRenderer?: MdChartTooltipRenderer;

  @Prop() valueFormatter?: (value: number) => string;

  /**
   * How the radial band is divided between the rings of a nested chart —
   * relative weights, innermost first. `[2, 1]` gives the inner ring twice the
   * width of the outer one.
   *
   * The default is not an even split: every ring but the outermost puts its
   * labels INSIDE its own band, so it has to be wide enough to hold a word,
   * while the outermost labels on leaders and needs no more than its arc.
   */
  @Prop() ringWidths?: number[];
  @Prop({ attribute: 'height' }) heightProp?: string;
  /** Disable all animation (shorthand for `animation="none"`). */
  @Prop({ attribute: 'no-animation' }) noAnimation: boolean = false;
  /** Entry-animation variant: `expressive` (default), `grow`, `fade`, `draw`, or `none`. */
  @Prop() animation: MdChartAnimation = 'expressive';
  /** Entry-animation duration override in ms (≤ 0 disables). */
  @Prop({ attribute: 'animation-duration' }) animationDuration?: number;

  /**
   * Local density rung. Drives the same `--md-sys-density-scale` signal that a
   * global `data-density` ancestor sets, so a local value simply overrides the
   * inherited one. 0 = default, -4 = ultra-compact.
   */
  @Prop({ reflect: true }) density: 0 | -1 | -2 | -3 | -4 = 0;

  @Event() mdSliceClick!: EventEmitter<MdChartClickDetail<MdPieDatum>>;
  @Event() mdLegendClick!: EventEmitter<{ dataIndex: number; selected: boolean }>;
  @Event() mdReady!: EventEmitter<void>;

  @State() private mounted = false;

  /** Index the keyboard cursor sits on, or -1 when the plot isn't focused. */
  @State() private kbIndex = -1;

  /** Text for the aria-live region — what a screen reader speaks on move. */
  @State() private announcement = '';

  private engine: PieChartEngine | null = null;
  private ro: ResizeObserver | null = null;
  private chartHost?: HTMLDivElement;
  private a11yTableHost?: HTMLDivElement;
  /** Tears down the theme watch (media query + ancestor attribute observer). */
  private disposeThemeWatch?: () => void;

  /**
   * Legend toggles the USER made, kept across data updates.
   *
   * The engine self-toggles a slice on legend click, but that lives on the spec
   * — and the next `data` assignment rebuilds it from the prop and takes the
   * toggle with it. A chart re-fed live (a race, a poll) would un-hide whatever
   * the reader had just hidden. Keyed by the datum's identity so it survives the
   * refeed, while an explicit `data[i].hidden` still wins.
   */
  private legendHidden = new Map<string, boolean>();

  /** A stable key per datum — id, else label, else position. */
  private datumKeys(): string[] {
    const seen = new Map<string, number>();
    return this.flatDatums().map((d, i) => {
      const base = d.id != null ? `id:${d.id}` : d.label != null ? `label:${d.label}` : `pos:${i}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return n === 0 ? base : `${base}#${n}`;
    });
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

  @Watch('data') @Watch('innerRadius') @Watch('outerRadius')
  @Watch('startAngle') @Watch('endAngle') @Watch('paddingAngle')
  @Watch('cornerRadius') @Watch('showLabels') @Watch('labelMode') @Watch('monochrome') @Watch('gradient') @Watch('highlight')
  @Watch('legend') @Watch('tooltip') @Watch('label') @Watch('titleAlign')
  @Watch('animation') @Watch('animationDuration')
  @Watch('ringWidths') @Watch('locale') @Watch('subtitle') @Watch('loading') @Watch('valueFormatter')
  onAnyPropChange() { this.applyEngine(); this.rebuildA11yTable(); }

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

  /**
   * Animate the next `data` change as a drill through one slice, so the levels
   * of a hierarchy read as connected rather than as unrelated charts.
   *
   * AWAIT it, then assign the new `data`. Like every Stencil `@Method` this one
   * resolves through a microtask, so a bare call lands AFTER a `data` assignment
   * on the next line — the swap renders un-animated and the drill arms itself
   * for whatever change comes after.
   *
   * ```ts
   * await chart.drill(e.detail.dataIndex);          // descend into the clicked slice
   * chart.data = childrenOf(clicked);
   *
   * await chart.drill(indexOfChildInParent, 'up');  // …and back out of it
   * chart.data = parentLevel;
   * ```
   *
   * `down` names a slice of the data currently shown; `up` names a slice of the
   * data about to be shown — in both cases, the wedge that connects the two
   * levels. The new ring unfurls out of it, which run in reverse is what makes
   * coming back up read as zooming out of that same wedge. Falls back to a plain
   * swap when the index doesn't resolve, or under `prefers-reduced-motion`.
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
  async getInstance(): Promise<PieChartEngine | null> {
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
      this.engine = new PieChartEngine(this.chartHost);
    } catch {
      this.engine = null;
    }
    if (this.engine && typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => { this.engine?.resize(); this.updateCenterVars(); });
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
   * Flatten the (possibly nested) data into the plain indexable list the engine
   * and every consumer-facing index address: tooltips, legend toggles, click
   * events and the screen-reader table all say "slice N", so the tree is
   * carried as `level` + `parent` rather than as nesting.
   *
   * A child with no colour of its own takes a lighter shade of its parent's, so
   * a family reads as one block of colour with its members as gradations —
   * cycling the palette again per child would make Chrome's versions look like
   * unrelated categories.
   */
  private flatten(t: ReturnType<typeof readMdChartTheme>, palette: string[]) {
    const keys = this.datumKeys();
    const out: {
      label: string;
      value: number;
      color: string;
      selected?: boolean;
      radius?: number;
      hidden: boolean;
      level: number;
      parent?: number;
    }[] = [];
    // One hue, stepped toward the surface. It stops short of the surface itself
    // so the palest slice is still a slice and not a hole in the chart.
    const monoBase =
      this.monochrome != null ? resolveSeriesColor(this.el, this.monochrome || 'primary', t.palette[0]) : null;
    const walk = (items: MdPieDatum[], level: number, parent: number | undefined, parentColor?: string) => {
      items.forEach((d, i) => {
        const base =
          parentColor != null
            ? mixColor(parentColor, t.surface, 0.18 + (i / Math.max(1, items.length)) * 0.42)
            : monoBase != null
              ? mixColor(monoBase, t.surface, (i / Math.max(1, items.length)) * 0.7)
              : palette[i] ?? pickPaletteColor(t.palette, i);
        const color = resolveSeriesColor(this.el, d.color, base);
        const at = out.length;
        out.push({
          label: d.label,
          value: d.value,
          color,
          selected: d.selected,
          radius: d.radius,
          hidden: d.hidden ?? this.legendHidden.get(keys[at]) ?? false,
          level,
          parent,
        });
        if (d.children?.length) walk(d.children, level + 1, at, color);
      });
    };
    walk(this.data ?? [], 0, undefined);
    return out;
  }

  /**
   * Every datum the chart draws, in the order the engine indexes them.
   *
   * `data` is a TREE — a nested chart's rings come from `children` — so walking
   * `data` alone reaches only the first level, and everything the keyboard did
   * with an index (move, announce, report) stopped at the inner ring while the
   * chart went on drawing the rest. Same depth-first walk as `flatten`, so the
   * positions line up with the engine's `dataIndex`.
   */
  private flatDatums(): MdPieDatum[] {
    const out: MdPieDatum[] = [];
    const walk = (items: MdPieDatum[]) => {
      for (const d of items) {
        out.push(d);
        if (d.children?.length) walk(d.children);
      }
    };
    walk(this.data ?? []);
    return out;
  }

  private buildSpec(t: ReturnType<typeof readMdChartTheme>): PieChartSpec {
    const rtl = typeof getComputedStyle === 'function' && getComputedStyle(this.el).direction === 'rtl';
    // `t.palette` is the role cycle: primary, tertiary, secondary, error, then
    // the containers. Take the three non-semantic accents off the front as the
    // ramp's anchors.
    const palette = harmonicPalette(t.palette.slice(0, 3), this.data.length, {
      light: t.surface,
      dark: t.textColor,
    });
    return {
      data: this.flatten(t, palette),
      title: this.label || undefined,
      subtitle: this.subtitle || undefined,
      titleAlign: this.titleAlign,
      innerRadius: this.innerRadius,
      outerRadius: this.outerRadius,
      startAngleDeg: this.startAngle,
      endAngleDeg: this.endAngle,
      paddingAngleDeg: this.paddingAngle,
      cornerRadius: this.cornerRadius,
      showLabels: this.showLabels,
      labelMode: this.labelMode,
      gradient: this.gradient,
      highlight: this.highlight,
      // Mirrored for an RTL chart: everything else about the layout already
      // turns round — the title anchors from the right, the chips run
      // right-to-left — so a legend that stayed on the same side would be the
      // one piece that did not. Applied to the SPEC so the gutter reserved for
      // it and the chips placed into it agree.
      legend: (rtl ? mirrorLegend(this.legend) : this.legend) as typeof this.legend,
      ringWidths: this.ringWidths,
      valueFormatter: (v: number) => this.formatValue(v),
      animation: this.noAnimation ? 'none' : this.animation,
      animationDuration: this.animationDuration,
    };
  }

  private applyEngine() {
    if (!this.engine) return;
    const t = readMdChartTheme(this.el);
    this.engine.setSpec(this.buildSpec(t), this.buildEngineTheme(t), {
      onLegendClick: (item) => {
        const key = this.datumKeys()[item.seriesIndex];
        if (key != null) this.legendHidden.set(key, !!item.hidden);
        this.mdLegendClick.emit({ dataIndex: item.seriesIndex, selected: !item.hidden });
      },
      onPointClick: (_si, di, e) => this.emitSliceClick(di, e),
    });
    this.engine.setTooltip({ render: this.tooltipRenderer });
    this.updateCenterVars();
  }

  /**
   * Align the donut centre slot with the engine's computed ring centre.
   *
   * `getCenter()` is CANVAS-relative, but the slot is positioned against the
   * HOST — so the chart's own padding has to be added back, or the centred
   * content sits exactly one padding up and to the left of the ring it is
   * supposed to be inside.
   */
  private updateCenterVars() {
    const c = this.engine?.getCenter();
    if (!c || !this.chartHost) return;
    const host = this.el.getBoundingClientRect();
    const canvas = this.chartHost.getBoundingClientRect();
    const dx = canvas.left - host.left;
    const dy = canvas.top - host.top;
    this.el.style.setProperty('--_pie-center-x', `${c.x + dx}px`);
    this.el.style.setProperty('--_pie-center-y', `${c.y + dy}px`);
    // Centre-slot content that is wider than the hole spills over the ring and
    // sits on top of the slices. Publishing the hole's size lets the slot cap
    // itself, so a long caption wraps inside the donut instead.
    const hole = this.engine?.getHoleBox();
    this.el.style.setProperty('--_pie-hole', hole && hole.width > 0 ? `${hole.width}px` : 'none');
    this.el.style.setProperty('--_pie-hole-h', hole && hole.height > 0 ? `${hole.height}px` : 'none');
  }

  /** Shared with the other charts, so the table's shape and its truncation
   *  behaviour can't drift from theirs the way the hand-rolled one did. */
  private rebuildA11yTable() {
    if (!this.a11yTableHost) return;
    const total = this.data.reduce((acc, d) => acc + d.value, 0);
    const lb = this.tableLabels ?? {};
    this.a11yTableHost.innerHTML = buildDataTableHtml({
      title: this.label,
      xAxisLabel: lb.category ?? 'Category',
      xAxisData: this.data.map(d => d.label),
      locale: this.locale,
      // A pie's rows are its slices, so each "series" here is one column of the
      // table: the value, and the share it represents.
      series: [
        { label: lb.value ?? 'Value', data: this.data.map(d => d.value) },
        {
          label: lb.share ?? 'Share',
          data: this.data.map(d => (total > 0 ? (d.value / total) * 100 : 0)),
        },
      ],
      valueFormatter: v => (v == null ? '—' : this.formatValue(v)),
    });
  }

  /** A datum's value, through the consumer's formatter or the locale default. */
  private formatValue(v: number): string {
    return this.valueFormatter ? this.valueFormatter(v) : v.toLocaleString(this.locale || undefined);
  }

  /** Walk the slices with the keyboard. Without this the values are reachable
   *  only by hovering, which no keyboard or screen-reader user can do. */
  private onPlotKeyDown = (e: KeyboardEvent) => {
    const last = this.flatDatums().length - 1;
    if (last < 0) return;
    const rtl = typeof getComputedStyle === 'function' && getComputedStyle(this.el).direction === 'rtl';
    // Slices run clockwise from `startAngle`, so "next" is the same key in both
    // directions on screen — but the READING direction still decides which
    // arrow means forward.
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = this.kbIndex;
    switch (e.key) {
      case forward:
      case 'ArrowDown':
        next = this.kbIndex < 0 ? 0 : Math.min(last, this.kbIndex + 1);
        break;
      case back:
      case 'ArrowUp':
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
        // Same outcome as clicking the slice: it reports, and it picks itself
        // out of the ring. Without this the keyboard could reach every slice
        // and do nothing with any of them.
        if (this.kbIndex < 0) return;
        e.preventDefault();
        this.emitSliceClick(this.kbIndex, e);
        this.engine?.activate(this.kbIndex);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.moveKeyboardCursor(next);
  };

  /** One place both the pointer and the keyboard report a slice from, so the
   *  two cannot describe the same event differently. */
  private emitSliceClick(index: number, nativeEvent: Event) {
    const datum = this.flatDatums()[index];
    if (!datum) return;
    this.mdSliceClick.emit({
      seriesIndex: 0,
      seriesId: datum.id,
      dataIndex: index,
      value: datum.value,
      nativeEvent: nativeEvent as PointerEvent,
      series: datum,
    });
  }

  private onPlotBlur = () => {
    if (this.kbIndex >= 0) this.moveKeyboardCursor(-1);
  };

  private moveKeyboardCursor(next: number) {
    this.kbIndex = next;
    this.engine?.focusIndex(next);
    if (next < 0) {
      this.announcement = '';
      return;
    }
    const flat = this.flatDatums();
    const d = flat[next];
    if (!d) return;
    // Against its OWN level, not the whole tree: a version is a share of its
    // browser, and reading it as a share of every slice on the chart — parents
    // and children together — would be a percentage of nothing.
    const siblings = this.data?.some((x) => x.children?.length)
      ? (findSiblings(this.data ?? [], d) ?? flat)
      : flat;
    const total = siblings.reduce((acc, x) => acc + x.value, 0);
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    this.announcement = this.labelPoint
      .replace('%label%', d.label)
      .replace('%value%', this.formatValue(d.value))
      .replace('%percent%', `${pct.toLocaleString(this.locale || undefined, { maximumFractionDigits: 1 })}%`);
  }

  render() {
    // While loading, the loader owns the box — an empty-state message under it
    // would just be the wrong answer to "where is my data?".
    const empty = this.data.length === 0 && !this.loading;
    const summary =
      this.summary ||
      buildChartSummary({
        title: this.label,
        chartType: 'pie',
        seriesCount: this.data.length,
        locale: this.locale,
      });
    return (
      <Host
        class={{
          'md-pie-chart': true,
          'md-pie-chart--empty': empty,
          'md-pie-chart--mounted': this.mounted,
          'md-pie-chart--donut': this.innerRadius !== '0%' && this.innerRadius !== 0,
        }}
        role="figure"
        aria-label={summary}
        aria-busy={this.loading ? 'true' : null}
        style={this.heightProp ? { blockSize: this.heightProp } : undefined}
      >
        <header class="md-pie-chart__header" part="header"><slot name="header"></slot></header>
        <div
          class="md-pie-chart__canvas"
          part="canvas"
          ref={el => this.bindChartHost(el as HTMLDivElement)}
          tabindex={empty ? undefined : '0'}
          role={empty ? undefined : 'application'}
          aria-label={empty ? undefined : this.labelPlot}
          onKeyDown={this.onPlotKeyDown}
          onBlur={this.onPlotBlur}
        ></div>
        <div class="md-pie-chart__center" part="center" aria-hidden="true">
          <slot name="center"></slot>
        </div>
        {empty && (
          <div class="md-pie-chart__empty" part="empty">
            <slot name="empty">{this.labelEmpty}</slot>
          </div>
        )}

        {/* Loader — an opaque overlay, because the engine still draws a
            placeholder ring when there is no data. */}
        {this.loading && (
          <div class="md-pie-chart__loading" part="loading" role="status">
            {/* `loader` is the library-wide name for "swap the loading affordance";
                `loading` is kept as the older alias. Nesting them means either
                works — the outer slot falls back to the inner one, which falls
                back to the default below — and `loader` wins if both are given. */}
            <slot name="loader">
              <slot name="loading">
              <md-progress-indicator
                class="md-pie-chart__spinner"
                variant="circular"
                indeterminate
                label={this.loadingLabel}
              ></md-progress-indicator>
              <span class="md-pie-chart__loading-text">{this.loadingLabel}</span>
            </slot>
            </slot>
          </div>
        )}
        <footer class="md-pie-chart__footer" part="footer"><slot name="footer"></slot></footer>
        <div class="md-pie-chart__a11y-table" ref={el => this.bindA11yTableHost(el as HTMLDivElement)}></div>

        {/* Narrates the keyboard cursor, politely. */}
        <div class="md-pie-chart__live" role="status" aria-live="polite" aria-atomic="true">
          {this.announcement}
        </div>
      </Host>
    );
  }
}
