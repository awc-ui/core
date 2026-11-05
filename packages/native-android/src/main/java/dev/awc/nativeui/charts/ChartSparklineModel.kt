package dev.awc.nativeui.charts

import dev.awc.nativeui.awcList
import dev.awc.nativeui.awcMap

// md-sparkline: the compact line/area spec (LineChartEngine) or the compact bar spec (BarChartEngine).

/** md-sparkline `bandFill`: a reference band's fill at `alpha` whatever colour syntax it came in. */
fun chartSparkBandFill(color: String, alpha: Double, explicit: Boolean): String {
    val c = chartParseColor(color)
    fun ch(v: Double) = jsRound(v * 255).toInt()
    val out = if (explicit) (if (c.a < 1) c.a else alpha) else c.a * alpha
    return "rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${jsNumberString(jsRound(out * 1000) / 1000)})"
}

class ChartSparkInput(val props: ChartProps, val tokens: Map<String, String>, val formatters: ChartFormatters = ChartFormatters())

private fun sparkData(pr: ChartProps): List<ChartCell> = awcList(pr.obj("data")).map { if (it is Number) ChartCell.Num(it.toDouble()) else ChartCell.Null }

/** md-sparkline `markIndices`. */
fun chartSparkMarkIndices(data: List<ChartCell>, showMarks: String): List<Int> {
    val nums = data.mapIndexedNotNull { i, d -> (d as? ChartCell.Num)?.let { i to it.v } }
    if (nums.isEmpty() || showMarks == "none") return emptyList()
    if (showMarks == "all") return nums.map { it.first }
    val set = LinkedHashSet<Int>()
    if (showMarks == "extremes") {
        var mx = nums[0]; var mn = nums[0]
        for (n in nums) { if (n.second > mx.second) mx = n; if (n.second < mn.second) mn = n }
        set.add(mx.first); set.add(mn.first)
    }
    if (showMarks == "edges") { set.add(nums.first().first); set.add(nums.last().first) }
    return set.toList()
}

fun chartSparkColor(input: ChartSparkInput, t: ChartTheme) = chartResolveSeriesColor(input.tokens, input.props.str("color", "primary"), chartPickPaletteColor(t.palette, 0))

fun chartSparkTheme(t: ChartTheme) = t.engine.copy(background = "transparent")

private fun sparkLabels(pr: ChartProps, n: Int): List<ChartAxisValue> = pr.obj("labels")?.let { awcList(it).mapNotNull { v -> chartAxisValue(v) } } ?: (0 until n).map { ChartAxisValue.Num(it.toDouble()) }

fun chartBuildSparkLineSpec(input: ChartSparkInput, color: String): ChartLineSpec {
    val pr = input.props
    val data = sparkData(pr)
    val vf = input.formatters.valueFormatter
    val refBands = pr.obj("referenceAreas")?.let { r -> awcList(r).map { awcMap(it) }.map { a ->
        val c = a.chartStr("color")
        ChartRefBand((a["from"] as? Number)?.toDouble() ?: Double.NaN, (a["to"] as? Number)?.toDouble() ?: Double.NaN, if (c != null) chartSparkBandFill(c, 0.18, true) else chartSparkBandFill(color, 0.12, false))
    } }
    return ChartLineSpec(
        series = listOf(ChartLineSeriesSpec("", color, data, curve = pr.str("curve", "smooth"), connectNulls = true, showMarks = false, hidden = false,
            markIndices = chartSparkMarkIndices(data, pr.str("showMarks", "extremes")), lineWidth = pr.num("lineWidth"), markSize = pr.num("markSize"))),
        xValues = sparkLabels(pr, data.size), xScale = ChartScaleType.CATEGORY, xFormatter = { chartDefaultAxisString(it) }, xHidden = true,
        yScale = ChartScaleType.VALUE, yMin = pr.num("min"), yMax = pr.num("max"), yFormatter = { v -> vf?.invoke(v) ?: ChartIntl.number(v, "") }, yHidden = true,
        stack = "none", area = pr.str("variant", "line") == "area", fillOpacity = 0.45, legend = "none", compact = true, refBands = refBands, animate = !pr.bool("noAnimation"),
    )
}

fun chartBuildSparkBarSpec(input: ChartSparkInput, color: String): ChartBarSpec {
    val pr = input.props
    val data = sparkData(pr)
    val vf = input.formatters.valueFormatter
    return ChartBarSpec(
        series = listOf(ChartBarSeriesSpec("", color, data, false)), categories = sparkLabels(pr, data.size), categoryFormatter = { chartDefaultAxisString(it) }, categoryHidden = true,
        valueScale = ChartScaleType.VALUE, valueMin = pr.num("min"), valueMax = pr.num("max"), valueFormatter = { v -> vf?.invoke(v) ?: ChartIntl.number(v, "") }, valueHidden = true,
        stack = "none", horizontal = false, categoryGapRatio = 0.2, barGapRatio = 0.0, barWidth = pr.num("barWidth"), cornerRadius = pr.num("cornerRadius", 2.0),
        showLabels = false, legend = "none", compact = true,
    )
}

/** The sparkline scene through the same engine render passes as the Web component. */
fun chartRenderSparkScene(input: ChartSparkInput, t: ChartTheme, width: Double, height: Double, rtl: Boolean, measure: ChartTextMeasurer): ChartScene {
    val color = chartSparkColor(input, t)
    val theme = chartSparkTheme(t)
    return if (input.props.str("variant", "line") == "bar") chartRenderBarScene(chartBuildSparkBarSpec(input, color), theme, width, height, rtl, measure)
    else chartRenderScene(chartBuildSparkLineSpec(input, color), theme, width, height, rtl, measure)
}

/** md-sparkline's aria-label: latest value and range (plus any labelled reference windows). */
fun chartSparkSummary(props: ChartProps, formatters: ChartFormatters): String {
    val finite = awcList(props.obj("data")).mapNotNull { (it as? Number)?.toDouble() }
    fun fmt(v: Double?): String = formatters.valueFormatter?.invoke(v) ?: (v?.let { ChartIntl.number(it, "") } ?: "—")
    val refs = awcList(props.obj("referenceAreas")).mapNotNull { (it as? Map<*, *>)?.get("label")?.let { l -> chartJsString(l) }?.takeIf { l -> l.isNotEmpty() } }
    val note = if (refs.isEmpty()) "" else " Highlighted: ${refs.joinToString(", ")}."
    return if (finite.isEmpty()) "Sparkline, no data.$note" else "Sparkline, latest ${fmt(finite.last())}, range ${fmt(finite.minOrNull())} to ${fmt(finite.maxOrNull())}.$note"
}
