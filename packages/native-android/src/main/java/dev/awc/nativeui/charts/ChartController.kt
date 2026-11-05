package dev.awc.nativeui.charts

import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.awcList
import dev.awc.nativeui.awcMap
import kotlin.math.max
import kotlin.math.min

// The interaction + motion state of one chart node (lockstep with AWCChartController in NativeChartView.swift),
// platform-neutral so the Compose view and the JVM checks share it: property changes re-apply the engine, size /
// direction changes re-lay it out, scene builds feed the entrance / drill / bar-follow clocks, `frame(t)` returns
// what to draw at time t. Also the host box metrics, the legend chip layout and the a11y summary of the five charts.

enum class ChartKind(val tag: String) {
    LINE("md-line-chart"), AREA("md-area-chart"), BAR("md-bar-chart"), PIE("md-pie-chart"), SPARKLINE("md-sparkline");
    val prefix get() = tag
    companion object { fun of(tag: String) = values().firstOrNull { it.tag == tag } ?: LINE }
}

/** CSS `<length>` in px (px, plain numbers); null for anything else. */
fun chartCssPixels(raw: String?): Double? { val s = raw?.trim()?.removeSuffix("px") ?: return null; if (s.isEmpty()) return null; val n = jsParseFloat(s); return if (n.isFinite()) n else null }

/** The host box per component CSS (padding, corner, minimum / aspect sizing) at a density. */
data class ChartHostMetrics(val padding: Double, val shape: Double, val minHeight: Double, val aspect: Double,
                            val background: String, val emptyColor: String, val emptyBackground: String) {
    companion object {
        fun of(kind: ChartKind, tokens: Map<String, String>, d: Double): ChartHostMetrics {
            val p = kind.prefix
            fun tok(k: String) = tokens["--$p-$k"]?.trim()?.takeIf { it.isNotEmpty() }
            val bg = tok("background") ?: chartToken(tokens, "--md-sys-color-surface-container-low", "#F7F2FA")
            val pad = chartCssPixels(tok("padding")) ?: max(8.0, 16 + d * 2)
            val shape = chartCssPixels(tok("shape")) ?: max(8.0, 16 + d * 2)
            val minH = chartCssPixels(tok("min-block-size")) ?: if (kind == ChartKind.PIE) max(140.0, 200 + d * 12) else max(120.0, 160 + d * 8)
            val aspect = tok("aspect-ratio")?.let { a ->
                val parts = a.split('/').map { jsParseFloat(it.trim()) }
                if (parts.size == 2 && parts[1] > 0) parts[0] / parts[1] else parts.firstOrNull()?.takeIf { it > 0 }
            } ?: if (kind == ChartKind.PIE) 1.0 else 16.0 / 9.0
            val spark = kind == ChartKind.SPARKLINE
            return ChartHostMetrics(if (spark) 0.0 else pad, if (spark) 0.0 else shape, if (spark) 0.0 else minH, aspect, if (spark) "transparent" else bg,
                tok("empty-color") ?: chartToken(tokens, "--md-sys-color-on-surface-variant", "#49454F"), tok("empty-background") ?: bg)
        }
    }
}

class ChartLegendChip(val item: ChartLegendItem, val x: Double, val y: Double, val w: Double, val h: Double)

/** The legend nav's chip frames in plot-host coordinates (flex rows / side column, LTR or RTL). */
fun chartLegendLayout(scene: ChartScene, rtl: Boolean, measure: ChartTextMeasurer): Pair<List<ChartLegendChip>, Double> {
    val items = scene.legend
    val fontSize = scene.texts.firstOrNull()?.fontSize ?: 11.0
    if (items.size <= 1) return emptyList<ChartLegendChip>() to fontSize
    val pos = scene.legendPosition ?: "top-end"
    val isSide = pos == "left" || pos == "right"
    val atBottom = pos.startsWith("bottom")
    val logicalStart = if (pos.endsWith("start") || pos.endsWith("end")) pos.endsWith("start") != rtl else pos == "left"
    val chipH = max(10.0, measure.normalLineHeight(fontSize)) + 4
    val widths = items.map { 4 + 10 + 6 + measure.width(it.label, fontSize) + 4 }
    val out = ArrayList<ChartLegendChip>()
    if (isSide) {
        val navW = min(LEGEND_SIDE_MAX_FRACTION * scene.width, (widths.maxOrNull() ?: 0.0) + 12)
        val navH = min(scene.height * 0.92, items.size * chipH + (items.size - 1) * 6 + 12)
        val navX = if (pos == "left") 12.0 else scene.width - 12 - navW
        var y = scene.height / 2 - navH / 2 + 6
        for ((i, item) in items.withIndex()) {
            val w = min(widths[i], navW - 12)
            out += ChartLegendChip(item, if (rtl) navX + navW - 6 - w else navX + 6, y, w, chipH)
            y += chipH + 6
        }
        return out to fontSize
    }
    val corner = pos.contains("-")
    val avail = if (corner) scene.width * 0.88 else scene.width - 24
    val rows = mutableListOf(mutableListOf<Int>()); val rowW = mutableListOf(0.0)
    for ((i, w) in widths.withIndex()) {
        val cw = min(w, avail)
        if (rowW.last() > 0 && rowW.last() + 12 + cw > avail + 0.001) { rows += mutableListOf(i); rowW += cw }
        else { rowW[rowW.size - 1] = rowW.last() + (if (rowW.last() > 0) 12 else 0) + cw; rows.last() += i }
    }
    val navW = if (corner) min(avail, rowW.maxOrNull() ?: 0.0) else scene.width - 24
    val navH = rows.size * chipH + (rows.size - 1) * 4
    val navX = if (corner) (if (logicalStart) 12.0 else scene.width - 12 - navW) else 12.0
    val navY = if (atBottom) scene.height - 2 - navH else 2.0
    for ((r, row) in rows.withIndex()) {
        val y = navY + r * (chipH + 4)
        // justify-content: start / end / center along the row's inline direction (RTL flips the row).
        val justify = if (corner) (if (logicalStart) 0.0 else 1.0) else 0.5
        val free = navW - rowW[r]
        var x = if (rtl) navX + navW - free * (1 - justify) else navX + free * justify
        for (i in row) {
            val w = min(widths[i], avail)
            if (rtl) { x -= w; out += ChartLegendChip(items[i], x, y, w, chipH); x -= 12 }
            else { out += ChartLegendChip(items[i], x, y, w, chipH); x += w + 12 }
        }
    }
    return out to fontSize
}

/** a11y.ts `buildChartSummary`. */
fun chartBuildSummary(title: String, chartType: String, seriesCount: Int, xMin: ChartAxisValue?, xMax: ChartAxisValue?, locale: String): String {
    val verb = mapOf("pie" to "Pie chart", "bar" to "Bar chart", "area" to "Area chart", "sparkline" to "Sparkline")[chartType] ?: "Line chart"
    val parts = ArrayList<String>()
    if (title.isNotEmpty()) parts += title
    parts += verb
    if (chartType == "pie") { if (seriesCount > 0) parts += (if (seriesCount == 1) "with %count% slice" else "with %count% slices").replace("%count%", seriesCount.toString()) }
    else if (seriesCount > 1) parts += "with %count% series".replace("%count%", seriesCount.toString())
    if (xMin != null && xMax != null && chartType != "pie")
        parts += "from %min% to %max%".replace("%min%", chartDefaultValueFormatter(xMin, locale)).replace("%max%", chartDefaultValueFormatter(xMax, locale))
    return parts.joinToString(", ") + "."
}

/** The host's aria-label (the authored `summary`, else the generated one). */
fun chartSummary(kind: ChartKind, pr: ChartProps, formatters: ChartFormatters): String {
    val authored = pr.str("summary", "")
    if (authored.isNotEmpty() && kind != ChartKind.SPARKLINE) return authored
    val locale = pr.str("locale", "")
    return when (kind) {
        ChartKind.PIE -> chartBuildSummary(pr.str("label", ""), "pie", awcList(pr.obj("data")).size, null, null, locale)
        ChartKind.SPARKLINE -> chartSparkSummary(pr, formatters)
        else -> {
            val series = awcList(pr.obj("series"))
            val xAxis = awcMap(pr.obj("xAxis"))
            val axisData = (xAxis["data"] as? List<*>)?.mapNotNull { chartAxisValue(it) }
            val xs = if (kind == ChartKind.LINE) chartNormalizeSeriesX(series.map { awcList(awcMap(it)["data"]) }, axisData,
                ChartScaleType.of(xAxis["scale"] as? String) ?: ChartScaleType.CATEGORY).xValues else axisData ?: emptyList()
            val type = if (kind == ChartKind.BAR) "bar" else if (kind == ChartKind.AREA || pr.bool("area")) "area" else "line"
            // md-bar-chart builds its summary without the locale.
            chartBuildSummary(pr.str("label", ""), type, series.size, xs.firstOrNull(), xs.lastOrNull(), if (kind == ChartKind.BAR) "" else locale)
        }
    }
}

class ChartController(val measure: ChartTextMeasurer) {
    var version = 0; private set
    fun bump() { version++ }

    var kind = ChartKind.LINE; private set
    private var properties: Map<String, AWCValue> = emptyMap()
    private var tokens: Map<String, String> = emptyMap()
    private var density = 0.0
    var formatters = ChartFormatters(); private set
    var width = 0.0; private set
    var height = 0.0; private set
    var rtl = false; private set
    var reducedMotion = false
    var nodeID = ""
    var dispatch: (String, String, AWCValue) -> Unit = { _, _, _ -> }
    var now: () -> Double = { System.nanoTime() / 1e6 }

    var plot: ChartPlotInteraction? = null; private set
    var pie: ChartPieInteraction? = null; private set
    var spark: ChartSparkInteraction? = null; private set
    var sceneLtr: ChartScene? = null; private set
    val intro = ChartIntro()
    val follow = ChartBarFollow()
    private var lastIntroToken = 0
    private var barDrill: Triple<Boolean, Double?, Double>? = null
    var barDrillStart: Double? = null; private set
    var barDrillSplit = false; private set
    private var started = false
    private var lastAnnouncement = ""
    private var loading = false
    /** Called with each new live-region text (the view posts it as an accessibility announcement). */
    var announce: (String) -> Unit = {}

    val props get() = ChartProps(properties)
    val theme get() = chartReadTheme(tokens, density)

    /** Feeds the current inputs in: a property / theme change re-applies the engine, a size / direction change re-lays it out. */
    fun sync(kind: ChartKind, properties: Map<String, AWCValue>, tokens: Map<String, String>, density: Double, formatters: ChartFormatters,
             width: Double, height: Double, rtl: Boolean, reducedMotion: Boolean) {
        this.formatters = formatters
        this.reducedMotion = reducedMotion
        val first = !started
        if (first || kind != this.kind) { this.kind = kind; makeControllers() }
        val propsChanged = properties != this.properties || tokens != this.tokens || density != this.density || first
        val sizeChanged = width != this.width || height != this.height || rtl != this.rtl
        this.properties = properties; this.tokens = tokens; this.density = density
        this.width = width; this.height = height; this.rtl = rtl
        if (width < 2 || height < 2) return
        val nowLoading = props.bool("loading")
        val wasLoading = loading
        loading = nowLoading
        if (propsChanged || !started) {
            configure()
            applyEngine()
            if (wasLoading && !nowLoading) loadingDone()
            if (!started) { started = true; emit("mdReady", null) }
        } else if (sizeChanged) {
            plot?.rtl = rtl; pie?.rtl = rtl
            plot?.resize(); pie?.resize(); spark?.let { if (it.hasPlot) it.plot.resize() }
        }
    }

    private fun makeControllers() {
        plot = null; pie = null; spark = null
        intro.start = null; intro.hasRendered = false; follow.reset()
        when (kind) {
            ChartKind.LINE, ChartKind.AREA -> plot = ChartCartesianInteraction(kind == ChartKind.AREA).also { c ->
                c.rebuild = { rebuildPlot() }; c.onEvent = { e -> emit(e.name, e.detail) }; c.now = { now() } }
            ChartKind.BAR -> plot = ChartBarInteraction().also { c -> c.rebuild = { rebuildPlot() }; c.onEvent = { e -> emit(e.name, e.detail) }; c.now = { now() } }
            ChartKind.PIE -> pie = ChartPieInteraction().also { c ->
                c.buildSpec = { buildPieSpec() }; c.layout = { spec -> layoutPie(spec) }; c.onRender = { afterPieRender() }
                c.onEvent = { e -> emit(e.name, e.detail) }; c.now = { now() } }
            ChartKind.SPARKLINE -> spark = ChartSparkInteraction().also { c -> c.rebuild = { p -> rebuildSpark(p) }; c.onEvent = { e -> emit(e.name, e.detail) }; c.now = { now() } }
        }
    }

    private fun emit(name: String, detail: Map<String, Any?>?) = dispatch(nodeID, name, detail)

    private fun input(zoom: Pair<Int, Int>? = null, hidden: Map<String, Boolean> = emptyMap(), override: Map<Int, Boolean> = emptyMap()) =
        ChartCartesianInput(kind.tag, props, tokens, density, formatters, zoom, hidden, override)

    /** Host property → controller configuration (what each component's applyEngine hands its engine). */
    private fun configure() {
        val pr = props
        val xAxis = awcMap(pr.obj("xAxis"))
        val xData = (xAxis["data"] as? List<*>)?.toList()
        val series = awcList(pr.obj("series")).map { awcMap(it) }
        (plot as? ChartCartesianInteraction)?.let { c ->
            c.series = series; c.xAxisData = xData
            c.merged = chartNormalizeSeriesX(series.map { awcList(it["data"]) }, xData?.mapNotNull { chartAxisValue(it) }, ChartScaleType.of(xAxis["scale"] as? String) ?: ChartScaleType.CATEGORY)
            c.tooltip = pr.str("tooltip", "axis"); c.zoom = pr.str("zoom", "none"); c.locale = pr.str("locale", "")
            c.labelPoint = pr.str("labelPoint", "%x%: %values%"); c.formatters = formatters
            c.missingFormatter = formatters.valueFormatter; c.renderer = formatters.tooltipRenderer
            c.rtl = rtl; c.reducedMotion = reducedMotion
        }
        (plot as? ChartBarInteraction)?.let { b ->
            b.series = series; b.xAxisData = xData
            b.tooltip = pr.str("tooltip", "axis"); b.zoom = pr.str("zoom", "none"); b.locale = pr.str("locale", "")
            b.labelPoint = pr.str("labelPoint", "%x%: %values%"); b.formatters = formatters
            b.missingFormatter = formatters.valueFormatter; b.renderer = formatters.tooltipRenderer
            b.polar = pr.bool("polar"); b.horizontal = pr.str("layout", "vertical") == "horizontal"; b.clickable = pr.bool("clickable")
            b.rtl = rtl; b.reducedMotion = reducedMotion
        }
        pie?.let { p ->
            p.data = awcList(pr.obj("data")).map { awcMap(it) }
            p.locale = pr.str("locale", ""); p.labelPoint = pr.str("labelPoint", "%label%: %value% (%percent%)")
            p.valueFormatter = formatters.valueFormatter?.let { f -> { v: Double -> f(v) } }
            p.renderer = formatters.tooltipRenderer
            p.rtl = rtl; p.reducedMotion = reducedMotion
        }
        spark?.let { s -> s.data = awcList(pr.obj("data")); s.showTooltip = pr.bool("showTooltip", true); s.rtl = rtl; s.reducedMotion = reducedMotion }
    }

    private fun applyEngine() {
        plot?.applyEngine(); pie?.applyEngine(); spark?.applyEngine(props.str("variant", "line"))
    }

    private fun loadingDone() {
        val p = plot
        if (p is ChartCartesianInteraction) { p.loadingChanged(false, true); rebuildPlot() } else p?.loadingChanged(false, true)
        pie?.loadingChanged()
    }

    // ── scene builds (the engines' render) ──

    private fun rebuildPlot() {
        val p = plot ?: return
        val t = theme
        val w = jsRound(width); val h = jsRound(height)
        val old = p.scene
        val ltr: ChartScene
        var intro = "none" to CHART_INTRO_MS
        when (p) {
            is ChartCartesianInteraction -> {
                val spec = chartBuildCartesianSpec(input(p.zoomWindow(), p.legendHidden, p.hiddenOverride), t)
                p.yFormatter = spec.yFormatter
                intro = chartResolveIntro(spec.animation, spec.animationDuration, null)
                ltr = chartRenderScene(spec, t.engine, w, h, false, measure)
            }
            is ChartBarInteraction -> {
                val spec = chartBuildBarSpec(input(p.zoomWindow(), p.legendHidden, p.hiddenOverride), t)
                p.valueFormatter = spec.valueFormatter; p.surface = t.engine.surface
                intro = chartResolveIntro(spec.animation, spec.animationDuration, null)
                ltr = chartRenderBarScene(spec, t.engine, w, h, false, measure)
            }
            else -> return
        }
        sceneLtr = ltr
        p.scene = if (rtl) chartMirrorScene(ltr) else ltr
        afterRender(p, old, intro.first, intro.second)
    }

    private fun afterRender(p: ChartPlotInteraction, old: ChartScene?, variant: String, duration: Double) {
        val s = sceneLtr ?: return
        if (p.introToken != lastIntroToken) { lastIntroToken = p.introToken; intro.replay() }
        val isBar = p is ChartBarInteraction
        val hasContent = if (isBar) s.bars.isNotEmpty() || s.slices.isNotEmpty() else s.lines.isNotEmpty() || s.areas.isNotEmpty() || s.markers.isNotEmpty()
        val t = now()
        val d = barDrill
        if (isBar && d != null && t - d.third < 50 && variant != "none" && !reducedMotion) {
            barDrill = null; barDrillStart = t; intro.hasRendered = true; intro.start = null; barDrillSplit = d.first
            return
        }
        intro.render(hasContent, variant, duration, reducedMotion, t, s.lines.map { it.seriesIndex ?: 0 }.toSet().size)
        if (intro.start != null) { follow.settle(p.scene ?: s); return }
        if (isBar) {
            val cur = p.scene ?: return
            val zoomed = (p as ChartBarInteraction).consumeZoomRender()
            if (!zoomed && !reducedMotion && old != null && old.width == cur.width && old.height == cur.height && (chartBarsDiffer(old, cur) || follow.active)) {
                follow.active = true; return
            }
            follow.settle(cur)
        }
    }

    /** md-bar-chart / md-pie-chart drill(): the next data swap grows out of its slots (cascading on the way down). */
    fun drill(index: Int, direction: String) {
        if (kind == ChartKind.PIE) { pie?.drill(index, direction); return }
        barDrill = Triple(direction != "up", null, now())
    }

    private fun buildPieSpec(): ChartPieSpec {
        val p = pie!!
        return chartBuildPieSpec(input(hidden = p.legendHidden), theme, rtl)
    }

    private fun layoutPie(spec: ChartPieSpec): ChartScene {
        val s = chartComputePieLayout(spec, theme.engine, jsRound(width), jsRound(height))
        sceneLtr = s
        return s
    }

    private fun afterPieRender() {
        val p = pie ?: return; val s = p.scene ?: return; val spec = p.spec ?: return
        if (p.introToken != lastIntroToken) { lastIntroToken = p.introToken; intro.replay() }
        val (variant, duration) = chartResolveIntro(spec.animation, spec.animationDuration, null)
        intro.render(s.slices.isNotEmpty(), variant, duration, reducedMotion, now(), 1)
    }

    private fun rebuildSpark(p: ChartPlotInteraction) {
        val old = p.scene
        val ltr = chartRenderSparkScene(ChartSparkInput(props, tokens, formatters), theme, jsRound(width), jsRound(height), false, measure)
        val fmt: (Double) -> String = { v -> formatters.valueFormatter?.invoke(v) ?: ChartIntl.number(v, "") }
        (p as? ChartCartesianInteraction)?.yFormatter = fmt
        (p as? ChartBarInteraction)?.valueFormatter = fmt
        sceneLtr = ltr
        p.scene = if (rtl) chartMirrorScene(ltr) else ltr
        afterRender(p, old, if (props.bool("noAnimation")) "none" else "expressive", CHART_INTRO_MS)
    }

    // ── per frame ──

    val activePlot: ChartPlotInteraction? get() = plot ?: spark?.takeIf { it.hasPlot }?.plot

    val animating get() = intro.start != null || barDrillStart != null || follow.active || (activePlot?.animating ?: false) || (pie?.animating ?: false)

    class Frame(val scene: ChartScene, val alpha: Double, val labelAlpha: Double, val over: Pair<ChartScene, Double>?)

    /** The geometry to draw at `t` (the entrance, a drill or a follow step in flight, else the settled scene). */
    fun frame(t: Double): Frame? {
        activePlot?.tick(t)
        pie?.let { p ->
            p.tick(t)
            p.drillFrame(t)?.let { d -> return Frame(d.base, 1.0, if (d.labelProgress >= CHART_PIE_LABEL_ARRIVES_AT) 1.0 else 0.0, d.over to d.overAlpha) }
            val settled = p.drawnScene(t) ?: return null
            val tr = intro.progress(t); val target = sceneLtr
            if (tr != null && target != null) {
                val (scene, alpha) = chartStepAnimation(intro.variant, target, tr)
                return Frame(scene, alpha, if (tr >= CHART_PIE_LABEL_ARRIVES_AT) 1.0 else 0.0, null)
            }
            return Frame(settled, 1.0, 1.0, null)
        }
        val p = activePlot ?: return null
        val drawn = p.drawnScene() ?: return null
        val target = sceneLtr
        barDrillStart?.let { start ->
            if (target != null) {
                val tt = (t - start) / intro.duration
                if (tt >= 1) { barDrillStart = null; follow.settle(drawn) }
                else { val s = chartDrillScene(target, tt, barDrillSplit); return Frame(if (rtl) chartMirrorScene(s) else s, 1.0, 1.0, null) }
            }
        }
        val tr = intro.progress(t)
        if (tr != null && target != null) {
            // md-bar-chart steps its finished (mirrored) scene (bar-chart.ts playIntro); the line/area engine sweeps in
            // LTR space and mirrors each frame, except the first, drawn before the loop from the un-mirrored scene (chart.ts).
            val first = intro.firstPaint
            intro.firstPaint = false
            if (kind == ChartKind.BAR) {
                val (scene, alpha) = chartStepAnimation(intro.variant, if (rtl) chartMirrorScene(target) else target, tr)
                return Frame(scene, alpha, 1.0, null)
            }
            val (scene, alpha) = chartStepAnimation(intro.variant, target, tr)
            return Frame(if (first || !rtl) scene else chartMirrorScene(scene), alpha, 1.0, null)
        }
        if (follow.active) return Frame(drawn.copy(bars = follow.frame(drawn, t)), 1.0, 1.0, null)
        return Frame(drawn, 1.0, 1.0, null)
    }

    // ── input forwarding (each call may change what is drawn) ──

    fun perform(body: () -> Unit) { body(); announceIfNeeded(); bump() }

    private fun announceIfNeeded() {
        val text = pie?.announcement ?: activePlot?.announcement ?: ""
        if (text == lastAnnouncement) return
        lastAnnouncement = text
        if (text.isNotEmpty()) announce(text)
    }

    val announcement get() = pie?.announcement ?: activePlot?.announcement ?: ""
}
