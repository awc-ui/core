package dev.awc.nativeui.charts

import dev.awc.nativeui.AWCValue
import dev.awc.nativeui.awcList
import dev.awc.nativeui.awcMap
import kotlin.math.abs

// md-bar-chart `buildSpec` and the bar engine's render pass (measured legend via the legend layer,
// value-tick widths measured in the chart font, RTL mirror).

/** md-bar-chart `parseRatio`: a number (>1 means percent) or a "30%" / "0.3" string. */
fun chartParseRatio(v: AWCValue, fallback: Double): Double {
    if (v is Number) { val d = v.toDouble(); return if (d.isFinite()) (if (d > 1) d / 100 else d) else fallback }
    val s = chartJsString(v)
    val n = jsParseFloat(s)
    if (!n.isFinite()) return fallback
    return if (s.trim().endsWith("%") || n > 1) n / 100 else n
}

fun chartNumberMap(v: AWCValue): Map<Int, Double>? {
    if (v == null) return null
    return awcMap(v).entries.mapNotNull { (k, value) -> val i = k.toIntOrNull(); val d = (value as? Number)?.toDouble(); if (i != null && d != null) i to d else null }.toMap()
}

fun chartBuildBarSpec(input: ChartCartesianInput, t: ChartTheme): ChartBarSpec {
    val pr = input.props
    val stack = pr.str("stack", "none")
    val percentage = stack == "percentage"
    val locale = pr.str("locale", "")
    val vf = input.formatters.valueFormatter
    val vFmt: (Double) -> String = { v -> vf?.invoke(v) ?: ChartIntl.number(v, locale) }
    val polar = pr.bool("polar")
    val zw = if (polar) null else input.zoomWindow
    fun <T> cut(a: List<T>): List<T> = if (zw == null) a else a.subList(minOf(zw.first, a.size), maxOf(minOf(zw.first, a.size), minOf(zw.second + 1, a.size)))
    fun <T> rebase(rec: Map<Int, T>?): Map<Int, T>? = if (rec == null || zw == null) rec else rec.entries.mapNotNull { (k, v) -> val i = k - zw.first; if (i >= 0 && i <= zw.second - zw.first) i to v else null }.toMap()
    val seriesValues = awcList(pr.obj("series")).map { awcMap(it) }
    val keys = chartSeriesKeys(seriesValues)
    val xAxis = pr.obj("xAxis")?.let { awcMap(it) }; val yAxis = pr.obj("yAxis")?.let { awcMap(it) }; val yAxis2 = pr.obj("yAxis2")?.let { awcMap(it) }
    val layout = pr.str("layout", "vertical")
    val xf = input.formatters.xAxisFormatter
    val series = seriesValues.mapIndexed { i, s ->
        val pointColors = s["pointColors"]?.let { pc -> rebase(awcMap(pc).entries.mapNotNull { (k, c) -> k.toIntOrNull()?.let { it to chartResolveSeriesColor(input.tokens, chartJsString(c), chartPickPaletteColor(t.palette, i)) } }.toMap()) }
        ChartBarSeriesSpec(
            label = s.chartStr("label") ?: "Series ${i + 1}", color = chartResolveSeriesColor(input.tokens, s.chartStr("color"), chartPickPaletteColor(t.palette, i)),
            data = cut(awcList(s["data"]).map { if (it is Number) ChartCell.Num(it.toDouble()) else ChartCell.Null }),
            hidden = input.hiddenOverride[i] ?: s.chartBool("hidden") ?: input.legendHidden[keys[i]] ?: false, stack = s.chartStr("stack"), axisIndex = s.chartNum("yAxisIndex")?.toInt(),
            overlay = s.chartBool("overlay"), widthRatio = s.chartNum("widthRatio"), pointWidths = rebase(chartNumberMap(s["pointWidths"])),
            range = s["range"]?.let { r -> cut(awcList(r)).map { chartNormalizeRange(it) } }, pointColors = pointColors,
        )
    }
    val label = pr.str("label", ""); val subtitle = pr.str("subtitle", "")
    return ChartBarSpec(
        series = series, title = label.ifEmpty { null }, subtitle = subtitle.ifEmpty { null }, titleAlign = pr.str("titleAlign", "start"),
        categories = cut(xAxis?.get("data")?.let { awcList(it).mapNotNull { v -> chartAxisValue(v) } } ?: emptyList()),
        // md-bar-chart passes defaultValueFormatter without the component locale.
        categoryFormatter = { v -> xf?.invoke(v) ?: chartDefaultValueFormatter(v, "") },
        categoryLabelRotation = xAxis?.chartNum("labelRotation"), categoryLabelsMirrored = xAxis?.chartBool("mirrorLabels"),
        valueAxis2 = yAxis2?.let { a -> ChartValueAxis2(a.chartNum("min"), a.chartNum("max"), a.chartStr("label"), input.formatters.yAxesFormatters[1], a.chartBool("hidden")) },
        valueTickFormatter = input.formatters.yAxisFormatter,
        categoryLabel = xAxis?.chartStr("label"), categoryHidden = xAxis?.chartBool("hidden"), categoryHideTicks = xAxis?.chartBool("hideTicks"),
        categoryAxisLine = xAxis?.chartBool("axisLine"), categoryDash = xAxis?.chartStr("dash"),
        valueScale = ChartScaleType.of(yAxis?.chartStr("scale")) ?: ChartScaleType.VALUE,
        valueBreaks = chartBreaks((if (layout == "horizontal") xAxis else yAxis)?.get("breaks")),
        valueMin = if (percentage) 0.0 else yAxis?.chartNum("min"), valueMax = if (percentage) 100.0 else yAxis?.chartNum("max"),
        valueFormatter = if (percentage) { v -> "${jsRound(v).toLong()}%" } else vFmt,
        valueLabel = yAxis?.chartStr("label"), valueHidden = yAxis?.chartBool("hidden"), valueHideTicks = yAxis?.chartBool("hideTicks"),
        valueAxisLine = yAxis?.chartBool("axisLine"), valueDash = yAxis?.chartStr("dash"), valueGridDash = yAxis?.chartStr("gridDash"),
        stack = stack, horizontal = layout == "horizontal",
        categoryGapRatio = chartParseRatio(input.props.p["categoryGap"] ?: "30%", 0.3), barGapRatio = chartParseRatio(input.props.p["barGap"] ?: "20%", 0.2),
        barWidth = pr.num("barWidth"), cornerRadius = pr.num("cornerRadius", 6.0), showLabels = pr.bool("showLabels"), showTotals = pr.bool("showTotals"),
        chevron = pr.bool("chevron"), polar = polar, polarHole = pr.num("polarHole"), polarSweep = pr.num("polarSweep"),
        legend = pr.str("legend", "top-end"), axisTicks = pr.bool("axisTicks"),
        animation = if (pr.bool("noAnimation")) "none" else pr.str("animation", "expressive"), animationDuration = pr.num("animationDuration"),
    )
}

/** bar-chart.ts render(): layout (value ticks measured in `400 labelSize` of the chart font), RTL mirror, measured-legend pass. */
fun chartRenderBarScene(spec: ChartBarSpec, theme: ChartEngineTheme, width: Double, height: Double, rtl: Boolean, measure: ChartTextMeasurer): ChartScene {
    fun layout(): ChartScene { val s = chartComputeBarLayout(spec, theme, width, height) { measure.width(it, theme.labelSize) }; return if (rtl) chartMirrorScene(s) else s }
    var scene = layout()
    val legend = spec.legend
    if (legend != null && legend != "none") {
        val extent = chartLegendExtent(scene, measure)
        if (extent != null && extent > 0 && abs((spec.legendExtent ?: -1.0) - extent) > 2) { spec.legendExtent = extent; scene = layout() }
    }
    return scene
}
