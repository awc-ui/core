package dev.awc.nativeui.charts

import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.awcList
import dev.awc.nativeui.awcMap
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

// Component-side model for md-line-chart / md-area-chart: properties → engine spec, the theme read
// (theme.ts), xy.ts normalisation, the measured-legend pass and the RTL mirror (chart.ts render()).

/** Author callbacks the Web component takes as function-valued properties. */
class ChartFormatters(
    var valueFormatter: ((Double?) -> String)? = null,
    var xAxisFormatter: ((ChartAxisValue) -> String)? = null,
    var yAxisFormatter: ((Double) -> String)? = null,
    var yAxesFormatters: Map<Int, (Double) -> String> = emptyMap(),
    /** `tooltipRenderer`: replaces the tooltip card's content (line / area / bar / pie). */
    var tooltipRenderer: ((ChartTooltipContext) -> ChartTooltipContent)? = null,
)

/** Text measurement for the legend chips (Android: Paint with the bundled Roboto). */
interface ChartTextMeasurer {
    fun width(text: String, size: Double, weight: Double = 400.0): Double
    fun normalLineHeight(size: Double, weight: Double = 400.0): Double
}

data class ChartTheme(
    val background: String = "transparent", val textColor: String, val textColorMuted: String, val gridColor: String, val axisLineColor: String,
    val surface: String, val tooltipSurface: String, val tooltipTextColor: String, val tooltipRadius: Double, val palette: List<String>,
    val fontFamily: String, val labelSize: Double, val titleSize: Double,
) {
    val engine get() = ChartEngineTheme(background, textColor, textColorMuted, axisLineColor, gridColor, surface, fontFamily, labelSize, titleSize)
}

val chartRoleTokens = mapOf(
    "primary" to "--md-sys-color-primary", "secondary" to "--md-sys-color-secondary", "tertiary" to "--md-sys-color-tertiary", "error" to "--md-sys-color-error",
    "primary-container" to "--md-sys-color-primary-container", "secondary-container" to "--md-sys-color-secondary-container",
    "tertiary-container" to "--md-sys-color-tertiary-container", "error-container" to "--md-sys-color-error-container",
    "surface-variant" to "--md-sys-color-surface-variant", "success" to "--md-sys-color-success", "warning" to "--md-sys-color-warning", "info" to "--md-sys-color-info",
    "success-container" to "--md-sys-color-success-container", "warning-container" to "--md-sys-color-warning-container", "info-container" to "--md-sys-color-info-container",
)
val chartRoleFallbacks = mapOf(
    "primary" to "#6750A4", "secondary" to "#625B71", "tertiary" to "#7D5260", "error" to "#B3261E", "primary-container" to "#EADDFF", "secondary-container" to "#E8DEF8",
    "tertiary-container" to "#FFD8E4", "error-container" to "#F9DEDC", "surface-variant" to "#E7E0EC", "success" to "#2E6B4F", "warning" to "#7A5900", "info" to "#38608F",
    "success-container" to "#B8F0CE", "warning-container" to "#FFDF9B", "info-container" to "#D3E4FF",
)
private val roleCycle = listOf("primary", "tertiary", "secondary", "error", "primary-container", "tertiary-container", "secondary-container", "error-container")

fun chartToken(tokens: Map<String, String>, name: String, fallback: String): String = tokens[name]?.trim().orEmpty().ifEmpty { fallback }
fun chartNumberToken(tokens: Map<String, String>, name: String, fallback: Double): Double {
    val raw = tokens[name]?.trim().orEmpty(); if (raw.isEmpty()) return fallback
    val n = jsParseFloat(raw); return if (n.isFinite()) n else fallback
}
fun chartResolveRole(tokens: Map<String, String>, role: String) = chartToken(tokens, chartRoleTokens.getValue(role), chartRoleFallbacks.getValue(role))

fun chartFontFamilyOf(font: String): String =
    Regex("""\d*\.?\d+(?:px|rem|em|pt|%)(?:\s*/\s*\S+)?\s+(.+)$""").find(font)?.groupValues?.get(1)?.trim() ?: font.trim()

fun chartReadTheme(tokens: Map<String, String>, density: Double): ChartTheme {
    val outlineVariant = chartToken(tokens, "--md-sys-color-outline-variant", "#CAC4D0")
    val gridOverride = chartToken(tokens, "--md-chart-grid-color", "")
    val labelBase = chartNumberToken(tokens, "--md-sys-typescale-label-small-size", chartNumberToken(tokens, "--md-sys-typescale-label-small-font-size", 11.0))
    val titleBase = chartNumberToken(tokens, "--md-sys-typescale-title-small-size", chartNumberToken(tokens, "--md-sys-typescale-title-small-font-size", 14.0))
    return ChartTheme(
        textColor = chartToken(tokens, "--md-sys-color-on-surface", "#1C1B1F"),
        textColorMuted = chartToken(tokens, "--md-sys-color-on-surface-variant", "#49454F"),
        gridColor = gridOverride.ifEmpty { chartWithAlpha(outlineVariant, 0.5) },
        axisLineColor = chartToken(tokens, "--md-chart-axis-color", outlineVariant),
        surface = chartToken(tokens, "--md-sys-color-surface", "#FFFBFE"),
        tooltipSurface = chartToken(tokens, "--md-sys-color-inverse-surface", chartToken(tokens, "--md-sys-color-on-surface", "#322F35")),
        tooltipTextColor = chartToken(tokens, "--md-sys-color-inverse-on-surface", chartToken(tokens, "--md-sys-color-surface", "#F5EFF7")),
        tooltipRadius = chartNumberToken(tokens, "--md-sys-shape-corner-small", 8.0),
        palette = roleCycle.map { chartResolveRole(tokens, it) },
        fontFamily = chartFontFamilyOf(chartToken(tokens, "--md-sys-typescale-label-medium-font", "\"Roboto\", system-ui, sans-serif")),
        labelSize = max(9.0, labelBase + density * 0.5),
        titleSize = max(11.0, titleBase + density * 0.5),
    )
}

fun chartIsCssColor(value: String): Boolean {
    val s = value.trim().lowercase()
    if (s.startsWith("var(") || s.startsWith("color-mix(")) return true
    if (chartParseColor(s) != GREY_FALLBACK) return true
    return s == "gray" || s == "grey" || s == "#808080" || s.replace(" ", "") == "rgb(128,128,128)"
}

fun chartResolveSeriesColor(tokens: Map<String, String>, color: String?, fallback: String): String {
    if (color.isNullOrEmpty()) return fallback
    if (color in chartRoleTokens) return chartResolveRole(tokens, color)
    return if (chartIsCssColor(color)) color else fallback
}

fun chartPickPaletteColor(palette: List<String>, i: Int) = palette[i % palette.size]

// Values

fun chartJsString(v: AWCValue): String = when (v) {
    null -> ""; is String -> v; is Boolean -> v.toString(); is Number -> jsNumberString(v.toDouble()); else -> v.toString()
}
fun chartAxisValue(v: AWCValue): ChartAxisValue? = when (v) {
    is Number -> ChartAxisValue.Num(v.toDouble()); is String -> ChartAxisValue.Str(v); is Boolean -> ChartAxisValue.Str(v.toString()); else -> null
}
private fun isPointDatum(d: AWCValue) = d is Map<*, *> || d is List<*> || (d != null && d.javaClass.name.startsWith("org.json"))
private fun datumY(d: AWCValue): ChartCell = when {
    d is Number -> ChartCell.Num(d.toDouble())
    d is Map<*, *> || (d != null && d.javaClass.name == "org.json.JSONObject") -> (awcMap(d)["y"] as? Number)?.let { ChartCell.Num(it.toDouble()) } ?: ChartCell.Null
    d is List<*> || (d != null && d.javaClass.name == "org.json.JSONArray") -> (awcList(d).getOrNull(1) as? Number)?.let { ChartCell.Num(it.toDouble()) } ?: ChartCell.Null
    else -> ChartCell.Null
}
private fun datumX(d: AWCValue): ChartAxisValue? = when {
    d is Map<*, *> || (d != null && d.javaClass.name == "org.json.JSONObject") -> chartAxisValue(awcMap(d)["x"])
    d is List<*> || (d != null && d.javaClass.name == "org.json.JSONArray") -> chartAxisValue(awcList(d).getOrNull(0))
    else -> null
}

class ChartNormalizedX(val xValues: List<ChartAxisValue>, val data: List<List<ChartCell>>, val toMerged: List<List<Int>?>, val toOwn: List<List<Int>?>, val hasPointX: Boolean)

fun chartNormalizeSeriesX(series: List<List<AWCValue>>, axisData: List<ChartAxisValue>?, scale: ChartScaleType): ChartNormalizedX {
    fun hasPointX(data: List<AWCValue>) = data.firstOrNull { it != null }?.let { isPointDatum(it) } ?: false
    if (series.none { hasPointX(it) })
        return ChartNormalizedX(axisData ?: emptyList(), series.map { s -> s.map { if (it is Number) ChartCell.Num(it.toDouble()) else ChartCell.Null } }, series.map { null }, series.map { null }, false)
    val category = scale == ChartScaleType.CATEGORY
    fun keyOf(v: ChartAxisValue) = if (category) "c" + chartDefaultAxisString(v) else "n" + jsNumberString(chartToNumeric(v, scale))
    val slots = LinkedHashMap<String, Pair<Double, ChartAxisValue>>()
    fun add(v: ChartAxisValue) { val k = keyOf(v); if (k !in slots) slots[k] = (if (category) slots.size.toDouble() else chartToNumeric(v, scale)) to v }
    axisData?.forEach { add(it) }
    for (s in series) if (hasPointX(s)) for (d in s) datumX(d)?.let { add(it) }
    val xValues = slots.values.sortedBy { it.first }.map { it.second }
    val indexOf = HashMap<String, Int>(); xValues.forEachIndexed { i, v -> indexOf[keyOf(v)] = i }
    val n = xValues.size
    val data = mutableListOf<List<ChartCell>>(); val toMerged = mutableListOf<List<Int>?>(); val toOwn = mutableListOf<List<Int>?>()
    for (own in series) {
        val row = MutableList<ChartCell>(n) { ChartCell.Hole }
        if (!hasPointX(own)) {
            if (axisData.isNullOrEmpty()) { for (j in 0 until min(own.size, n)) row[j] = datumY(own[j]); data.add(row); toMerged.add(null); toOwn.add(null); continue }
            val fwd = MutableList(own.size) { -1 }; val back = MutableList(n) { -1 }
            for (j in own.indices) { val at = (if (j < axisData.size) indexOf[keyOf(axisData[j])] else null) ?: continue; row[at] = datumY(own[j]); fwd[j] = at; back[at] = j }
            data.add(row); toMerged.add(fwd); toOwn.add(back); continue
        }
        val fwd = MutableList(own.size) { -1 }; val back = MutableList(n) { -1 }
        for (j in own.indices) { val x = datumX(own[j]) ?: continue; val at = indexOf[keyOf(x)] ?: continue; row[at] = datumY(own[j]); fwd[j] = at; back[at] = j }
        data.add(row); toMerged.add(fwd); toOwn.add(back)
    }
    return ChartNormalizedX(xValues, data, toMerged, toOwn, true)
}

fun chartNormalizeRange(d: AWCValue): Pair<Double, Double>? {
    val (lo, hi) = when {
        d is List<*> || (d != null && d.javaClass.name == "org.json.JSONArray") -> awcList(d).let { (it.getOrNull(0) as? Number)?.toDouble() to (it.getOrNull(1) as? Number)?.toDouble() }
        d is Map<*, *> || (d != null && d.javaClass.name == "org.json.JSONObject") -> awcMap(d).let { (it["low"] as? Number)?.toDouble() to (it["high"] as? Number)?.toDouble() }
        else -> return null
    }
    if (lo == null || hi == null || !lo.isFinite() || !hi.isFinite()) return null
    return min(lo, hi) to max(lo, hi)
}

/** Typed property access with the Web defaults (attribute strings coerce like Stencil props). */
class ChartProps(val p: Map<String, AWCValue>) {
    fun has(k: String) = p[k] != null
    fun str(k: String, d: String) = p[k]?.let { chartJsString(it) } ?: d
    fun bool(k: String, d: Boolean = false): Boolean = when (val v = p[k]) { null -> d; is Boolean -> v; is String -> v != "false"; is Number -> v.toDouble() != 0.0; else -> d }
    fun num(k: String): Double? = when (val v = p[k]) { is Number -> v.toDouble(); is String -> jsNumber(v).takeIf { !it.isNaN() }; else -> null }
    fun num(k: String, d: Double) = num(k) ?: d
    fun obj(k: String): AWCValue = when (val v = p[k]) { is String -> runCatching { chartParseJson(v) }.getOrNull(); else -> v }
}

fun Map<String, AWCValue>.chartStr(k: String): String? = this[k]?.let { chartJsString(it) }
fun Map<String, AWCValue>.chartNum(k: String): Double? = (this[k] as? Number)?.toDouble()
fun Map<String, AWCValue>.chartBool(k: String): Boolean? = this[k] as? Boolean

fun chartIndexRecord(v: AWCValue): Map<Int, String>? {
    if (v == null) return null
    val m = awcMap(v); if (m.isEmpty() && v !is Map<*, *>) return null
    return m.entries.mapNotNull { (k, value) -> k.toIntOrNull()?.let { it to chartJsString(value) } }.toMap()
}

fun chartAxisBands(tokens: Map<String, String>, v: AWCValue): List<ChartAxisBandSpec>? {
    val arr = awcList(v); if (arr.isEmpty()) return null
    return arr.map { raw -> val b = awcMap(raw)
        ChartAxisBandSpec(chartAxisValue(b["from"]) ?: ChartAxisValue.Num(Double.NaN), chartAxisValue(b["to"]) ?: ChartAxisValue.Num(Double.NaN),
            b.chartStr("color")?.let { chartResolveSeriesColor(tokens, it, it) }, b.chartStr("label"), b.chartStr("labelAlign"), b.chartStr("labelColor")?.let { chartResolveSeriesColor(tokens, it, it) })
    }
}

fun chartBreaks(v: AWCValue): ChartAxisBreaks? {
    fun ranges(a: List<AWCValue>) = a.map { awcMap(it).let { m -> Triple(chartAxisValue(m["from"]) ?: ChartAxisValue.Num(Double.NaN), chartAxisValue(m["to"]) ?: ChartAxisValue.Num(Double.NaN), m.chartNum("gap")) } }
    return when {
        v == "auto" -> ChartAxisBreaks(auto = true)
        v is List<*> || (v != null && v.javaClass.name == "org.json.JSONArray") -> ChartAxisBreaks(ranges(awcList(v)))
        v is Map<*, *> || (v != null && v.javaClass.name == "org.json.JSONObject") -> awcMap(v).let { o ->
            ChartAxisBreaks(ranges(awcList(o["ranges"])), o.chartBool("auto") ?: false, o.chartNum("minGap"), o.chartNum("maxBreaks")?.toInt(), o.chartNum("gap"), o.chartStr("sizing"))
        }
        else -> null
    }
}

fun chartSeriesKeys(series: List<Map<String, AWCValue>>): List<String> {
    val seen = HashMap<String, Int>()
    return series.mapIndexed { i, s ->
        val base = if (s["id"] != null) "id:${chartJsString(s["id"])}" else if (s["label"] != null) "label:${chartJsString(s["label"])}" else "pos:$i"
        val n = seen[base] ?: 0; seen[base] = n + 1
        if (n == 0) base else "$base#$n"
    }
}

class ChartCartesianInput(
    val tag: String, val props: ChartProps, val tokens: Map<String, String>, val density: Double,
    val formatters: ChartFormatters = ChartFormatters(), val zoomWindow: Pair<Int, Int>? = null, val legendHidden: Map<String, Boolean> = emptyMap(),
    /** The engine's own legend self-toggle (chart.ts onLegendToggle), which outranks the `hidden` property until the next spec rebuild. */
    val hiddenOverride: Map<Int, Boolean> = emptyMap(),
)

fun chartBuildCartesianSpec(input: ChartCartesianInput, t: ChartTheme): ChartLineSpec {
    val pr = input.props
    val isArea = input.tag == "md-area-chart"
    val stack = pr.str("stack", if (isArea) "normal" else "none")
    val percentage = stack == "percentage"
    val locale = pr.str("locale", "")
    val vf = input.formatters.valueFormatter
    val yFmt: (Double) -> String = { v -> vf?.invoke(v) ?: ChartIntl.number(v, locale) }
    val seriesValues = awcList(pr.obj("series")).map { awcMap(it) }
    val xAxis = pr.obj("xAxis")?.let { awcMap(it) }; val yAxis = pr.obj("yAxis")?.let { awcMap(it) }
    val scale = ChartScaleType.of(xAxis?.chartStr("scale")) ?: ChartScaleType.CATEGORY
    val axisData = xAxis?.get("data")?.let { awcList(it).mapNotNull { v -> chartAxisValue(v) } }
    val keys = chartSeriesKeys(seriesValues)
    val zw = input.zoomWindow
    fun <T> cut(a: List<T>): List<T> = if (zw == null) a else a.subList(min(zw.first, a.size), min(zw.second + 1, a.size).coerceAtLeast(min(zw.first, a.size)))
    fun rebase(rec: Map<Int, String>?): Map<Int, String>? = if (rec == null || zw == null) rec else rec.entries.mapNotNull { (k, v) -> val i = k - zw.first; if (i >= 0 && i <= zw.second - zw.first) i to v else null }.toMap()
    val showLine = pr.bool("showLine", true)
    val series: List<ChartLineSeriesSpec>
    val xValues: List<ChartAxisValue>
    if (isArea) {
        xValues = cut(axisData ?: emptyList())
        series = seriesValues.mapIndexed { i, s ->
            val rangeRaw = s["range"]?.let { awcList(it) }
            val data = rangeRaw?.map { ChartCell.Null } ?: awcList(s["data"]).map { if (it is Number) ChartCell.Num(it.toDouble()) else ChartCell.Null }
            ChartLineSeriesSpec(
                label = s.chartStr("label") ?: "Series ${i + 1}", color = chartResolveSeriesColor(input.tokens, s.chartStr("color"), chartPickPaletteColor(t.palette, i)), data = cut(data),
                range = rangeRaw?.let { cut(it.map { r -> chartNormalizeRange(r) }) }, fill = s.chartBool("fill"),
                stroke = s.chartBool("stroke") ?: (if (!showLine || stack == "wiggle" || stack == "silhouette") false else null),
                curve = s.chartStr("curve") ?: pr.str("curve", "smooth"), connectNulls = s.chartBool("connectNulls") ?: pr.bool("connectNulls"),
                showMarks = s.chartBool("showMarks") ?: pr.bool("showMarks"), hidden = input.hiddenOverride[i] ?: s.chartBool("hidden") ?: input.legendHidden[keys[i]] ?: false,
                dash = s.chartStr("dash"), symbol = s.chartStr("symbol"), pointSymbols = rebase(chartIndexRecord(s["pointSymbols"])),
                lineWidth = s.chartNum("lineWidth") ?: pr.num("lineWidth"), markSize = s.chartNum("markSize") ?: pr.num("markSize"),
            )
        }
    } else {
        val m = chartNormalizeSeriesX(seriesValues.map { awcList(it["data"]) }, axisData, scale)
        xValues = cut(m.xValues)
        series = seriesValues.mapIndexed { i, s ->
            val toMerged = m.toMerged[i]
            val dashAfterRaw = s.chartNum("dashAfter")?.toInt()
            val dashAt = if (dashAfterRaw != null && toMerged != null) toMerged.getOrNull(dashAfterRaw) else dashAfterRaw
            var pointSymbols = chartIndexRecord(s["pointSymbols"])
            if (pointSymbols != null && toMerged != null) pointSymbols = pointSymbols.entries.mapNotNull { (k, v) -> toMerged.getOrNull(k)?.takeIf { it >= 0 }?.let { it to v } }.toMap()
            ChartLineSeriesSpec(
                label = s.chartStr("label") ?: "Series ${i + 1}", color = chartResolveSeriesColor(input.tokens, s.chartStr("color"), chartPickPaletteColor(t.palette, i)),
                data = if (zw != null) cut(m.data[i]) else m.data[i],
                curve = s.chartStr("curve") ?: pr.str("curve", "smooth"), connectNulls = s.chartBool("connectNulls") ?: pr.bool("connectNulls"),
                showMarks = s.chartBool("showMarks") ?: pr.bool("showMarks"), hidden = input.hiddenOverride[i] ?: s.chartBool("hidden") ?: input.legendHidden[keys[i]] ?: false,
                dash = s.chartStr("dash"), symbol = s.chartStr("symbol"), pointSymbols = rebase(pointSymbols), yAxisIndex = s.chartNum("yAxisIndex")?.toInt(),
                dashAfter = if (dashAt != null && dashAt >= 0 && zw != null) dashAt - zw.first else dashAt, hollow = s.chartBool("hollow"),
                stroke = s.chartBool("stroke") ?: (if (showLine) null else false),
                lineWidth = s.chartNum("lineWidth") ?: pr.num("lineWidth"), markSize = s.chartNum("markSize") ?: pr.num("markSize"),
            )
        }
    }
    val grid = pr.str("grid", "horizontal")
    val label = pr.str("label", ""); val subtitle = pr.str("subtitle", "")
    val xf = input.formatters.xAxisFormatter
    val yAxes = if (isArea) emptyList() else awcList(pr.obj("yAxes")).map { awcMap(it) }
    val markLines = if (isArea) null else pr.obj("markLines")?.let { awcList(it).map { m -> awcMap(m) } }
    return ChartLineSpec(
        series = series, title = label.ifEmpty { null }, subtitle = subtitle.ifEmpty { null }, titleAlign = pr.str("titleAlign", "start"),
        markLines = markLines?.mapNotNull { ml ->
            var value = chartAxisValue(ml["value"]) ?: return@mapNotNull null
            if (zw != null && scale == ChartScaleType.CATEGORY && value is ChartAxisValue.Num) {
                val nv = value.v - zw.first; value = ChartAxisValue.Num(nv)
                if (nv < 0 || nv > (zw.second - zw.first)) return@mapNotNull null
            }
            ChartMarkLineSpec(value, ml.chartStr("label"), ml.chartStr("color")?.let { chartResolveSeriesColor(input.tokens, it, it) }, ml.chartStr("dash"))
        },
        xValues = xValues, xScale = scale, xFormatter = { v -> xf?.invoke(v) ?: chartDefaultValueFormatter(v, locale) },
        xLabel = xAxis?.chartStr("label"), xHidden = xAxis?.chartBool("hidden"), xHideTicks = xAxis?.chartBool("hideTicks"), xDash = xAxis?.chartStr("dash"), xGridDash = xAxis?.chartStr("gridDash"),
        xBands = chartAxisBands(input.tokens, xAxis?.get("bands")), yBands = chartAxisBands(input.tokens, yAxis?.get("bands")),
        xBreaks = chartBreaks(xAxis?.get("breaks")), yBreaks = chartBreaks(yAxis?.get("breaks")),
        yScale = ChartScaleType.of(yAxis?.chartStr("scale")) ?: ChartScaleType.VALUE,
        yMin = if (percentage) 0.0 else yAxis?.chartNum("min"), yMax = if (percentage) 100.0 else yAxis?.chartNum("max"),
        yFormatter = if (percentage) { v -> "${jsRound(v).toLong()}%" } else yFmt,
        yTickFormatter = if (!percentage) input.formatters.yAxisFormatter else null,
        yLabel = yAxis?.chartStr("label"), yHidden = yAxis?.chartBool("hidden"), yHideTicks = yAxis?.chartBool("hideTicks"), yDash = yAxis?.chartStr("dash"), yGridDash = yAxis?.chartStr("gridDash"),
        yAxes = if (yAxes.isEmpty()) null else yAxes.mapIndexed { ai, a ->
            val f = input.formatters.yAxesFormatters[ai]
            ChartValueAxisSpec(ChartScaleType.of(a.chartStr("scale")) ?: ChartScaleType.VALUE, a.chartNum("min"), a.chartNum("max"), { v -> f?.invoke(v) ?: ChartIntl.number(v, locale) },
                a.chartStr("label"), a.chartStr("position"), a.chartBool("hidden"), a.chartBool("hideTicks"), a.chartStr("color")?.let { chartResolveSeriesColor(input.tokens, it, it) },
                chartAxisBands(input.tokens, a["bands"]), a.chartStr("dash"), a.chartStr("gridDash"))
        },
        stack = stack, area = isArea || pr.bool("area"), fillOpacity = if (isArea) pr.num("fillOpacity", 0.55) else null, legend = pr.str("legend", "top-end"),
        gridY = grid == "horizontal" || grid == "both", gridX = grid == "vertical" || grid == "both", axisTicks = pr.bool("axisTicks"), inverted = pr.bool("inverted"),
        showLabels = pr.bool("showLabels"), seriesLabels = pr.bool("seriesLabels"),
        animation = if (pr.bool("noAnimation")) "none" else pr.str("animation", "expressive"), animationDuration = pr.num("animationDuration"),
    )
}

fun chartDefaultValueFormatter(v: ChartAxisValue?, locale: String): String = when (v) {
    null -> ""; is ChartAxisValue.DateMs -> ChartIntl.date(v.ms, locale); is ChartAxisValue.Num -> ChartIntl.number(v.v, locale); is ChartAxisValue.Str -> v.v
}

/** The legend nav's measured extent (overlay.ts chips): offsetHeight of wrapped rows, or offsetWidth of the side column. */
fun chartLegendExtent(scene: ChartScene, measure: ChartTextMeasurer): Double? {
    val items = scene.legend
    if (items.size <= 1) return null
    val pos = scene.legendPosition ?: "top-end"
    val fontSize = scene.texts.firstOrNull()?.fontSize ?: 11.0
    val chipH = max(10.0, measure.normalLineHeight(fontSize)) + 4
    val widths = items.map { 4 + 10 + 6 + measure.width(it.label, fontSize) + 4 }
    if (pos == "left" || pos == "right") return jsRound(min(LEGEND_SIDE_MAX_FRACTION * scene.width, (widths.maxOrNull() ?: 0.0) + 12))
    val avail = if (pos.contains("-")) scene.width * 0.88 else scene.width - 24
    var rows = 1; var rowW = 0.0
    for (w in widths) { val cw = min(w, avail); if (rowW > 0 && rowW + 12 + cw > avail + 0.001) { rows++; rowW = cw } else rowW += (if (rowW > 0) 12.0 else 0.0) + cw }
    return jsRound(rows * chipH + (rows - 1) * 4)
}

/** rtl.ts `mirrorScene`. */
fun chartMirrorScene(s: ChartScene): ChartScene {
    val w = s.width
    fun mx(x: Double) = w - x
    fun pts(p: List<ChartPt>) = p.map { ChartPt(mx(it.x), it.y) }
    fun seg(g: ChartSegment) = g.copy(x1 = mx(g.x1), x2 = mx(g.x2))
    return s.copy(
        plot = s.plot.copy(x = mx(s.plot.x + s.plot.width)),
        bands = s.bands?.map { it.copy(x = mx(it.x + it.w)) },
        gridlines = s.gridlines.map(::seg), axisLines = s.axisLines.map(::seg),
        areas = s.areas.map { it.copy(points = pts(it.points), basePoints = it.basePoints?.let(::pts)) },
        bars = s.bars.map { it.copy(x = mx(it.x + it.w), radius = listOf(it.radius[1], it.radius[0], it.radius[3], it.radius[2])) },
        barBaseline = if (s.barBaseline != null && s.bars.firstOrNull()?.horizontal == true) mx(s.barBaseline) else s.barBaseline,
        slices = s.slices.map { it.copy(cx = mx(it.cx), startAngle = Math.PI - it.endAngle, endAngle = Math.PI - it.startAngle) },
        lines = s.lines.map { it.copy(points = pts(it.points)) },
        markers = s.markers.map { it.copy(x = mx(it.x)) },
        glyphs = s.glyphs?.map { it.copy(x = mx(it.x)) },
        endLabels = s.endLabels?.map { it.copy(x = mx(it.x), side = if (it.side == "end") "start" else "end") },
        texts = s.texts.map { it.copy(x = mx(it.x), align = when (it.align) { "start" -> "end"; "end" -> "start"; else -> "center" }, rotate = if (it.rotate != null && it.rotate != 0.0) -it.rotate else it.rotate) },
        legend = s.legend.map { it.copy(x = mx(it.x)) },
        xPositions = s.xPositions.map(::mx),
        hoverPoints = s.hoverPoints.map { h -> h.copy(byIndex = h.byIndex.mapValues { it.value.copy(x = mx(it.value.x)) }) },
    )
}

/**
 * chart.ts `render()`: layout, then the RTL mirror. The line/area engine's measured-legend second pass
 * looks for the legend inside the text overlay, but the legend lives in its own layer, so on the Web it
 * never runs and layout keeps the estimated legend band; `measuredLegend` is only true for the bar
 * engine, whose pass queries the legend layer and does apply.
 */
fun chartRenderScene(spec: ChartLineSpec, theme: ChartEngineTheme, width: Double, height: Double, rtl: Boolean, measure: ChartTextMeasurer, measuredLegend: Boolean = false): ChartScene {
    fun layout(): ChartScene { val s = chartComputeLayout(spec, theme, width, height); return if (rtl) chartMirrorScene(s) else s }
    var scene = layout()
    val legend = spec.legend
    if (measuredLegend && legend != null && legend != "none") {
        val extent = chartLegendExtent(scene, measure)
        if (extent != null && extent > 0 && abs((spec.legendExtent ?: -1.0) - extent) > 2) { spec.legendExtent = extent; scene = layout() }
    }
    return scene
}

/** Minimal JSON reader for string-valued object/array properties (attribute form). */
fun chartParseJson(text: String): AWCValue {
    var i = 0
    fun ws() { while (i < text.length && text[i].isWhitespace()) i++ }
    fun value(): AWCValue {
        ws()
        return when (val c = text[i]) {
            '{' -> { i++; val m = LinkedHashMap<String, AWCValue>(); ws(); if (text[i] == '}') { i++; m } else { while (true) { ws(); val k = value() as String; ws(); i++; m[k] = value(); ws(); if (text[i++] == '}') break }; m } }
            '[' -> { i++; val l = mutableListOf<AWCValue>(); ws(); if (text[i] == ']') { i++; l } else { while (true) { l.add(value()); ws(); if (text[i++] == ']') break }; l } }
            '"' -> { i++; val sb = StringBuilder(); while (text[i] != '"') { if (text[i] == '\\') { i++; when (text[i]) { 'n' -> sb.append('\n'); 't' -> sb.append('\t'); 'r' -> sb.append('\r'); 'b' -> sb.append('\b'); 'f' -> sb.append('\u000c'); 'u' -> { sb.append(text.substring(i + 1, i + 5).toInt(16).toChar()); i += 4 }; else -> sb.append(text[i]) } } else sb.append(text[i]); i++ }; i++; sb.toString() }
            't' -> { i += 4; true }
            'f' -> { i += 5; false }
            'n' -> { i += 4; null }
            else -> { val start = i; while (i < text.length && (text[i].isDigit() || text[i] in "+-.eE")) i++; text.substring(start, i).toDouble().also { if (c == ' ') Unit } }
        }
    }
    return value()
}
