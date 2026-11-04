package dev.awc.nativeui.charts

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// Port of engine/layout.ts: spec + theme + size → RenderScene (line / area / sparkline).

data class ChartEngineTheme(
    val background: String, val textColor: String, val textColorMuted: String, val axisLineColor: String, val gridLineColor: String,
    val surface: String, val fontFamily: String, val labelSize: Double, val titleSize: Double,
)

data class ChartLineSeriesSpec(
    val label: String, val color: String, val data: List<ChartCell>,
    val fill: Boolean? = null, val stroke: Boolean? = null, val range: List<Pair<Double, Double>?>? = null,
    val curve: String = "smooth", val connectNulls: Boolean = false, val showMarks: Boolean = false, val hidden: Boolean = false,
    val symbol: String? = null, val pointSymbols: Map<Int, String>? = null, val markIndices: List<Int>? = null, val dash: String? = null,
    val yAxisIndex: Int? = null, val dashAfter: Int? = null, val hollow: Boolean? = null, val lineWidth: Double? = null, val markSize: Double? = null,
)

data class ChartMarkLineSpec(val value: ChartAxisValue, val label: String? = null, val color: String? = null, val dash: String? = null)
data class ChartAxisBandSpec(val from: ChartAxisValue, val to: ChartAxisValue, val color: String? = null, val label: String? = null, val labelAlign: String? = null, val labelColor: String? = null)
data class ChartValueAxisSpec(
    val scale: ChartScaleType = ChartScaleType.VALUE, val min: Double? = null, val max: Double? = null, val formatter: (Double) -> String,
    val label: String? = null, val position: String? = null, val hidden: Boolean? = null, val hideTicks: Boolean? = null, val color: String? = null,
    val bands: List<ChartAxisBandSpec>? = null, val dash: String? = null, val gridDash: String? = null,
)
data class ChartRefBand(val from: Double, val to: Double, val color: String)

data class ChartLineSpec(
    val series: List<ChartLineSeriesSpec>,
    val title: String? = null, val subtitle: String? = null, val titleAlign: String? = null, val markLines: List<ChartMarkLineSpec>? = null,
    val xValues: List<ChartAxisValue> = emptyList(), val xScale: ChartScaleType = ChartScaleType.CATEGORY,
    val xFormatter: (ChartAxisValue) -> String = { chartDefaultAxisString(it) },
    val xLabel: String? = null, val xHidden: Boolean? = null, val xHideTicks: Boolean? = null, val xDash: String? = null, val xGridDash: String? = null,
    val yScale: ChartScaleType = ChartScaleType.VALUE, val yMin: Double? = null, val yMax: Double? = null,
    val yFormatter: (Double) -> String = { jsNumberString(it) }, val yTickFormatter: ((Double) -> String)? = null,
    val yLabel: String? = null, val yHidden: Boolean? = null, val yHideTicks: Boolean? = null, val yDash: String? = null, val yGridDash: String? = null,
    val yReverse: Boolean? = null, val yAxes: List<ChartValueAxisSpec>? = null,
    val stack: String = "none", val area: Boolean = false, val fillOpacity: Double? = null, val legend: String? = null, var legendExtent: Double? = null,
    val compact: Boolean? = null, val refBands: List<ChartRefBand>? = null, val xBands: List<ChartAxisBandSpec>? = null,
    val xBreaks: ChartAxisBreaks? = null, val yBreaks: ChartAxisBreaks? = null, val yBands: List<ChartAxisBandSpec>? = null,
    val gridY: Boolean? = null, val gridX: Boolean? = null, val axisTicks: Boolean? = null, val showLabels: Boolean? = null, val seriesLabels: Boolean? = null,
    val inverted: Boolean? = null, val animation: String? = null, val animationDuration: Double? = null, val animate: Boolean? = null,
)

fun chartDefaultAxisString(v: ChartAxisValue): String = when (v) {
    is ChartAxisValue.Num -> jsNumberString(v.v)
    is ChartAxisValue.Str -> v.v
    is ChartAxisValue.DateMs -> java.text.SimpleDateFormat("EEE MMM dd yyyy HH:mm:ss 'GMT'Z (zzzz)", java.util.Locale.US).format(java.util.Date(v.ms.toLong()))
}

/** JS `Number(value)` of an axis value. */
fun chartNumberOf(v: ChartAxisValue): Double = when (v) { is ChartAxisValue.Num -> v.v; is ChartAxisValue.DateMs -> v.ms; is ChartAxisValue.Str -> jsNumber(v.v) }

fun chartHasAnchor(s: ChartLineSeriesSpec): Boolean {
    val strokes = s.range == null && s.stroke != false
    val marks = s.showMarks || !s.markIndices.isNullOrEmpty() || s.pointSymbols != null
    return strokes || marks
}

const val AXIS_TICK_LEN = 5.0

/** layout.ts `approxWidth`: UTF-16 length × size × 0.58. */
fun chartApproxWidth(text: String, fontSize: Double) = text.length * fontSize * 0.58

fun chartEstimateLegendRows(labels: List<String>, fontSize: Double, availW: Double): Int {
    var rows = 1; var rowW = 0.0
    for (label in labels) { val iw = chartApproxWidth(label, fontSize) + 28; if (rowW > 0 && rowW + iw > availW) { rows++; rowW = iw } else rowW += iw }
    return rows
}

fun chartDashPattern(dash: String?, width: Double = 1.0): List<Double>? = when (dash) {
    "dashed" -> listOf(width * 3.5, width * 3)
    "dotted" -> listOf(max(1.0, width * 0.4), width * 2.6)
    else -> null
}

fun chartBreakBandSegments(axis: String, gapLo: Double, gapHi: Double, spanFrom: Double, spanTo: Double, color: String): List<ChartSegment> {
    val segs = mutableListOf<ChartSegment>()
    val len = spanTo - spanFrom
    if (len <= 0) return segs
    val mid = (gapLo + gapHi) / 2
    val amp = min(4.0, (gapHi - gapLo) / 2)
    val n = max(4, jsRound(len / 3.0).toInt())
    fun at(i: Int): Pair<Double, Double> { val p = spanFrom + (len * i) / n; return p to mid + amp * sin((p / 30.0) * Math.PI * 2) }
    var prev = at(0)
    for (i in 1..n) {
        val cur = at(i)
        segs.add(if (axis == "y") ChartSegment(prev.first, prev.second, cur.first, cur.second, color, 1.5) else ChartSegment(prev.second, prev.first, cur.second, cur.first, color, 1.5))
        prev = cur
    }
    return segs
}

fun chartAxisLineWithBreaks(axis: String, from: Double, to: Double, along: Double, breaks: List<Pair<Double, Double>>, color: String, dash: List<Double>?): List<ChartSegment> {
    val segs = mutableListOf<ChartSegment>()
    var cursor = from
    fun seg(a: Double, b: Double) = if (axis == "y") ChartSegment(along, a, along, b, color, 1.0, dash) else ChartSegment(a, along, b, along, color, 1.0, dash)
    for ((px, gap) in breaks) { val start = from + px; if (start > cursor) segs.add(seg(cursor, start)); cursor = start + gap }
    if (to > cursor) segs.add(seg(cursor, to))
    return segs
}

fun chartBuildAxisBands(bands: List<ChartAxisBandSpec>?, axis: String, toPx: (ChartAxisValue) -> Double, plot: ChartRect, theme: ChartEngineTheme, keyPrefix: String): Pair<List<ChartSceneBand>, List<ChartTextItem>> {
    val rects = mutableListOf<ChartSceneBand>(); val labels = mutableListOf<ChartTextItem>()
    if (bands.isNullOrEmpty()) return rects to labels
    val horizontal = axis == "y"
    val lo = if (horizontal) plot.y else plot.x
    val hi = if (horizontal) plot.y + plot.height else plot.x + plot.width
    val pad = 8.0
    bands.forEachIndexed { i, b ->
        val a = toPx(b.from); val z = toPx(b.to)
        if (!a.isFinite() || !z.isFinite()) return@forEachIndexed
        val start = max(lo, min(a, z)); val end = min(hi, max(a, z))
        if (end <= start) return@forEachIndexed
        val color = b.color ?: chartHexToRgba(theme.axisLineColor, 0.07)
        rects.add(if (horizontal) ChartSceneBand(plot.x, start, plot.width, end - start, color) else ChartSceneBand(start, plot.y, end - start, plot.height, color))
        if (b.label.isNullOrEmpty()) return@forEachIndexed
        val align = b.labelAlign ?: "start"
        val along = when (align) {
            "center" -> if (horizontal) plot.x + plot.width / 2 else plot.y + plot.height / 2
            "end" -> if (horizontal) plot.x + plot.width - pad else plot.y + plot.height - pad
            else -> if (horizontal) plot.x + pad else plot.y + pad
        }
        labels.add(ChartTextItem(if (horizontal) along else start + pad, if (horizontal) start + pad else along, b.label, b.labelColor ?: theme.textColorMuted, theme.labelSize, null,
            if (horizontal) (if (align == "center") "center" else align) else "start",
            if (horizontal) "top" else when (align) { "center" -> "middle"; "end" -> "bottom"; else -> "top" }, null, "$keyPrefix-$i"))
    }
    return rects to labels
}

const val GLYPH_SIZE = 18.0
private val shapeSymbols = setOf("circle", "square", "diamond", "triangle", "triangle-down")
fun chartIsShapeSymbol(s: String) = s in shapeSymbols
fun chartMarkerRadius(symbol: String?, override: Double?): Double {
    if (override != null && override > 0) return override
    return when (symbol) { "square", "diamond" -> 4.2; "triangle", "triangle-down" -> 4.6; else -> 3.5 }
}
fun chartTitlePlacement(align: String?, plotX: Double, plotWidth: Double): Pair<Double, String> = when (align) {
    "center" -> (plotX + plotWidth / 2) to "center"; "end" -> (plotX + plotWidth) to "end"; else -> plotX to "start"
}

/** JS `Math.max(base, ...xs)`. */
fun jsMax(base: Double, xs: List<Double>) = xs.fold(base) { a, b -> max(a, b) }

internal class LegendBands(spec: ChartLineSpec, theme: ChartEngineTheme, width: Double) {
    private val active = !spec.legend.isNullOrEmpty() && spec.legend != "none" && spec.series.size > 1
    val side = active && (spec.legend == "left" || spec.legend == "right")
    val atBottom = active && !side && spec.legend!!.startsWith("bottom")
    val topRow = active && !side && !atBottom
    private val rows = if (topRow || atBottom) chartEstimateLegendRows(spec.series.map { it.label }, theme.labelSize, width * 0.86) else 1
    private val bandH = if (spec.legendExtent != null && (topRow || atBottom)) spec.legendExtent!! + 8 else rows * (theme.labelSize + 8) + 6
    val top = if (topRow) bandH else 0.0
    val bottom = if (atBottom) bandH else 0.0
    val sideW = if (side) (if (spec.legendExtent != null) spec.legendExtent!! + 16 else jsMax(0.0, spec.series.map { chartApproxWidth(it.label, theme.labelSize) }) + 34) else 0.0
}

private fun tops(b: List<ChartBandCell>): List<ChartCell> = b.map { when (it) { is ChartBandCell.Hole -> ChartCell.Hole; is ChartBandCell.Null -> ChartCell.Null; is ChartBandCell.Band -> ChartCell.Num(it.hi) } }

fun chartComputeLayout(spec: ChartLineSpec, theme: ChartEngineTheme, width: Double, height: Double): ChartScene {
    if (spec.inverted == true) return chartComputeInvertedLayout(spec, theme, width, height)
    if (!spec.yAxes.isNullOrEmpty()) return chartComputeMultiAxisLayout(spec, theme, width, height)
    val rows = if (spec.xValues.isNotEmpty()) spec.xValues.size else jsMax(0.0, spec.series.map { it.data.size.toDouble() }).toInt()
    val stackKeys = spec.series.map { if (spec.stack != "none" && it.range == null) "stacked" else "__unstacked__" }
    val bands = chartStackSeries(spec.series.map { if (it.hidden) emptyList() else it.data }, spec.stack, stackKeys).map { it.toMutableList() }.toMutableList()
    spec.series.forEachIndexed { si, s -> if (s.range != null && !s.hidden) bands[si] = s.range.map { r -> if (r != null) ChartBandCell.Band(min(r.first, r.second), max(r.first, r.second)) else ChartBandCell.Null }.toMutableList() }
    val yVals = mutableListOf<Double>()
    spec.series.forEachIndexed { si, s -> if (!s.hidden) bands[si].forEach { b -> b.band?.let { yVals.add(it.lo); yVals.add(it.hi) } } }
    val yDomain = computeDomain(yVals, spec.yMin, spec.yMax, spec.yScale, spec.stack != "none" || spec.yScale == ChartScaleType.VALUE)
    val xNums = spec.xValues.map { chartToNumeric(it, spec.xScale) }
    val xDomain = computeDomain(xNums, scale = spec.xScale)
    val compact = spec.compact == true
    val yFound = if (compact) emptyList<ChartBreakRange>() to "equal" else resolveAxisBreaks(spec.yBreaks, yVals, spec.yScale)
    val xFound = if (compact || spec.xScale == ChartScaleType.CATEGORY) emptyList<ChartBreakRange>() to "equal" else resolveAxisBreaks(spec.xBreaks, xNums, spec.xScale)
    val yBreakRanges = normalizeBreaks(yFound.first, yDomain)
    val xBreakRanges = normalizeBreaks(xFound.first, xDomain)
    val yTickVals = sectionedTicks(yDomain, yBreakRanges, spec.yScale, 6).filter { !inBreak(yBreakRanges, it) }
    val yTickLabels = yTickVals.map { (spec.yTickFormatter ?: spec.yFormatter)(it) }
    val maxYLabelW = if (spec.yHidden == true || spec.yHideTicks == true) 0.0 else jsMax(0.0, yTickLabels.map { chartApproxWidth(it, theme.labelSize) })
    val subtitleH = if (!spec.subtitle.isNullOrEmpty()) theme.labelSize + 4 else 0.0
    val titleH = if (!spec.title.isNullOrEmpty()) theme.titleSize + 10 + subtitleH else 0.0
    val xLabelH = if (spec.xHidden == true || spec.xHideTicks == true) 0.0 else theme.labelSize + 8
    val yAxisLabelW = if (!spec.yLabel.isNullOrEmpty()) theme.labelSize + 6 else 0.0
    val xAxisLabelH = if (!spec.xLabel.isNullOrEmpty()) theme.labelSize + 6 else 0.0
    val lb = LegendBands(spec, theme, width)
    val seriesLabelW = if (spec.seriesLabels == true) jsMax(0.0, spec.series.filter { !it.hidden }.map { chartApproxWidth(it.label, theme.labelSize) }) + 20 else 0.0
    val markPad = if (compact) jsMax(2.0, spec.series.filter { !it.hidden && (it.showMarks || (it.markIndices?.size ?: 0) > 0 || it.pointSymbols != null) }.map { chartMarkerRadius(it.symbol, it.markSize) + 2 }) else 0.0
    val padTop = if (compact) markPad else titleH + 8 + lb.top
    val padRight = if (compact) markPad else 12 + chartApproxWidth(yTickLabels.lastOrNull() ?: "", theme.labelSize) / 2 + (if (spec.legend == "right") lb.sideW else 0.0) + seriesLabelW
    val padBottom = if (compact) markPad else xLabelH + xAxisLabelH + 6 + lb.bottom
    val padLeft = if (compact) markPad else maxYLabelW + 10 + yAxisLabelW + (if (spec.legend == "left") lb.sideW else 0.0)
    val plot = ChartRect(padLeft, padTop, max(1.0, width - padLeft - padRight), max(1.0, height - padTop - padBottom))
    val x = if (spec.xScale == ChartScaleType.CATEGORY) makeCategoryScale(rows, plot.width, true) else makeBrokenScale(xDomain, plot.width, spec.xScale, xBreakRanges, xFound.second)
    val y = makeBrokenScale(yDomain, plot.height, spec.yScale, yBreakRanges, yFound.second)
    fun toPxY(v: Double) = plot.y + plot.height - y.scale(v)
    fun toPxX(i: Int) = plot.x + if (spec.xScale == ChartScaleType.CATEGORY) x.scale(i.toDouble()) else x.scale(if (i >= 0 && i < xNums.size) xNums[i] else 0.0)
    fun toPxXf(i: Double): Double {
        if (spec.xScale == ChartScaleType.CATEGORY) return plot.x + x.scale(i)
        return plot.x + x.scale(if (i == floor(i) && i >= 0 && i < xNums.size) xNums[i.toInt()] else 0.0)
    }
    val bandLabels = mutableListOf<ChartTextItem>(); val axisBands = mutableListOf<ChartSceneBand>()
    if (!compact) {
        val onY = chartBuildAxisBands(spec.yBands, "y", { toPxY(chartToNumeric(it, spec.yScale)) }, plot, theme, "yband")
        val onX = chartBuildAxisBands(spec.xBands, "x", { plot.x + x.scale(if (spec.xScale == ChartScaleType.CATEGORY) chartNumberOf(it) else chartToNumeric(it, spec.xScale)) }, plot, theme, "xband")
        axisBands += onY.first + onX.first; bandLabels += onY.second + onX.second
    }
    val gridlines = mutableListOf<ChartSegment>(); val axisLines = mutableListOf<ChartSegment>()
    val yGridDash = chartDashPattern(spec.yGridDash); val xGridDash = chartDashPattern(spec.xGridDash)
    val yAxisDash = chartDashPattern(spec.yDash); val xAxisDash = chartDashPattern(spec.xDash)
    if (spec.yHidden != true && !compact) {
        for (t in yTickVals) {
            val py = toPxY(t)
            if (spec.gridY != false) gridlines.add(ChartSegment(plot.x, py, plot.x + plot.width, py, theme.gridLineColor, 1.0, yGridDash))
            if (spec.axisTicks == true) axisLines.add(ChartSegment(plot.x - AXIS_TICK_LEN, py, plot.x, py, theme.axisLineColor, 1.0, yAxisDash))
        }
        val yCuts = y.breaks.map { (plot.height - it.px - it.gap) to it.gap }
        axisLines += chartAxisLineWithBreaks("y", plot.y, plot.y + plot.height, plot.x, yCuts, theme.axisLineColor, yAxisDash)
        for ((px, gap) in yCuts) axisLines += chartBreakBandSegments("y", plot.y + px, plot.y + px + gap, plot.x, plot.x + plot.width, theme.axisLineColor)
    }
    if (spec.xHidden != true && !compact) {
        val yb = plot.y + plot.height
        val xCuts = x.breaks.map { it.px to it.gap }
        axisLines += chartAxisLineWithBreaks("x", plot.x, plot.x + plot.width, yb, xCuts, theme.axisLineColor, xAxisDash)
        for ((px, gap) in xCuts) axisLines += chartBreakBandSegments("x", plot.x + px, plot.x + px + gap, plot.y, plot.y + plot.height, theme.axisLineColor)
    }
    val lines = mutableListOf<ChartPolyline>(); val areas = mutableListOf<ChartSceneArea>(); val markers = mutableListOf<ChartSceneMarker>(); val glyphs = mutableListOf<ChartGlyph>()
    val endLabelCands = mutableListOf<ChartEndLabel>(); val hoverPoints = mutableListOf<ChartHoverSeries>()
    val baselineY = toPxY(max(yDomain.lo, 0.0))
    fun splitAtBreaks(run: List<ChartRunPoint>): List<List<ChartRunPoint>> {
        if (yBreakRanges.isEmpty() && xBreakRanges.isEmpty()) return listOf(run)
        val out = mutableListOf<List<ChartRunPoint>>(); var current = mutableListOf<ChartRunPoint>(); var prevSection = ""
        for (pt in run) {
            val xv = xNums.getOrNull(pt.index)
            if (inBreak(yBreakRanges, pt.value) || (xv != null && inBreak(xBreakRanges, xv))) { if (current.isNotEmpty()) out.add(current); current = mutableListOf(); prevSection = ""; continue }
            val section = "${yBreakRanges.count { pt.value >= it.to }}:${xBreakRanges.count { xv != null && xv >= it.to }}"
            if (prevSection.isNotEmpty() && section != prevSection && current.isNotEmpty()) { out.add(current); current = mutableListOf() }
            prevSection = section; current.add(pt)
        }
        if (current.isNotEmpty()) out.add(current)
        return out
    }
    spec.series.forEachIndexed { si, s ->
        if (s.hidden) return@forEachIndexed
        val runs = chartSplitRuns(tops(bands[si]), s.connectNulls).flatMap { splitAtBreaks(it) }
        val byIndex = LinkedHashMap<Int, ChartHoverPoint>()
        var endPt: ChartPt? = null
        for (run in runs) {
            if (run.isEmpty()) continue
            val raw = run.map { ChartPt(toPxX(it.index), toPxY(it.value)) }
            endPt = raw.last()
            run.forEachIndexed { k, r ->
                val hoverSym = s.pointSymbols?.get(r.index) ?: (if (!s.symbol.isNullOrEmpty() && s.symbol != "none") s.symbol else "circle")
                val band = if (s.range != null) bands[si].getOrNull(r.index)?.band else null
                byIndex[r.index] = ChartHoverPoint(raw[k].x, raw[k].y, s.data.getOrNull(r.index)?.raw ?: r.value, band?.lo, band?.hi, hoverSym)
            }
            val poly = chartClampToRect(chartInterpolate(chartDecimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height)
            val splitAt = if (s.dashAfter != null) run.indexOfFirst { it.index >= s.dashAfter } else -1
            val lw = s.lineWidth ?: 2.5
            if (s.range != null || s.stroke == false) {
            } else if (splitAt > 0 && splitAt < run.size) {
                lines.add(ChartPolyline(chartClampToRect(chartInterpolate(chartDecimateMinMax(raw.subList(0, splitAt + 1), plot.width), s.curve), plot.x, plot.y, plot.width, plot.height), s.color, lw, chartDashPattern(s.dash, lw), si))
                lines.add(ChartPolyline(chartClampToRect(chartInterpolate(chartDecimateMinMax(raw.subList(splitAt, raw.size), plot.width), s.curve), plot.x, plot.y, plot.width, plot.height), s.color, lw, chartDashPattern("dotted", lw), si))
            } else if (splitAt == 0) {
                lines.add(ChartPolyline(poly, s.color, lw, chartDashPattern("dotted", lw), si))
            } else lines.add(ChartPolyline(poly, s.color, lw, chartDashPattern(s.dash, lw), si))
            if (spec.area && s.fill != false) {
                val fo = spec.fillOpacity ?: 0.35
                val basePoints = if (spec.stack != "none" || s.range != null) chartClampToRect(chartInterpolate(run.map { ChartPt(toPxX(it.index), toPxY(bands[si][it.index].band?.lo ?: Double.NaN)) }, s.curve), plot.x, plot.y, plot.width, plot.height) else null
                areas.add(ChartSceneArea(poly, baselineY, chartHexToRgba(s.color, fo), if (basePoints != null) chartHexToRgba(s.color, fo) else chartHexToRgba(s.color, max(0.02, fo * 0.06)), basePoints, null, si))
            }
            val markSet = s.markIndices?.toSet()
            run.forEachIndexed { k, r ->
                val sym = s.pointSymbols?.get(r.index) ?: (if (markSet?.contains(r.index) ?: s.showMarks) (s.symbol ?: "circle") else null)
                if (sym.isNullOrEmpty() || sym == "none") return@forEachIndexed
                val pt = raw[k]
                if (chartIsShapeSymbol(sym)) markers.add(ChartSceneMarker(pt.x, pt.y, chartMarkerRadius(sym, s.markSize), s.color, sym, si, s.hollow, if (s.hollow == true) theme.surface else null))
                else glyphs.add(ChartGlyph(pt.x, pt.y, sym, GLYPH_SIZE))
            }
            if (spec.showLabels == true && !compact) run.forEachIndexed { k, r ->
                val above = raw[k].y - 9 - theme.labelSize >= plot.y
                glyphs.add(ChartGlyph(raw[k].x, raw[k].y, spec.yFormatter(s.data.getOrNull(r.index)?.raw ?: r.value), theme.labelSize, ChartGlyphLabel(theme.textColor, 600.0, 0.0, if (above) -9.0 else 9.0, "-50%", if (above) "-100%" else "0")))
            }
        }
        val e = endPt
        if (spec.seriesLabels == true && e != null && !compact) {
            markers.add(ChartSceneMarker(e.x, e.y, 4.0, s.color, "circle", si))
            endLabelCands.add(ChartEndLabel("sl-$si", e.x, e.y, s.label, theme.textColor, theme.labelSize + 1, true))
        }
        hoverPoints.add(ChartHoverSeries(si, s.color, s.label, !chartHasAnchor(s), byIndex, s.data))
    }
    chartResolveEndLabelCollisions(endLabelCands, theme.labelSize + 5)
    val bars = mutableListOf<ChartSceneBar>()
    spec.refBands?.forEach { b ->
        val bx1 = toPxXf(b.from); val bx2 = toPxXf(b.to)
        val bw = abs(bx2 - bx1)
        if (bw <= 0) return@forEach
        bars.add(ChartSceneBar(min(bx1, bx2), plot.y, bw, plot.height, b.color, listOf(0.0, 0.0, 0.0, 0.0), -1, -1))
    }
    val texts = bandLabels.toMutableList()
    if (!spec.title.isNullOrEmpty() && !compact) {
        val (tx, ta) = chartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.add(ChartTextItem(tx, lb.top + 6, spec.title, theme.textColor, theme.titleSize, 600.0, ta, "top", null, "title"))
        if (!spec.subtitle.isNullOrEmpty()) texts.add(ChartTextItem(tx, lb.top + 6 + theme.titleSize + 4, spec.subtitle, theme.textColorMuted, theme.labelSize, null, ta, "top", null, "subtitle"))
    }
    if (spec.markLines != null && !compact) for (ml in spec.markLines) {
        val mv = if (spec.xScale == ChartScaleType.CATEGORY) chartNumberOf(ml.value) else chartToNumeric(ml.value, spec.xScale)
        val px = plot.x + x.scale(mv)
        if (!px.isFinite() || px < plot.x - 1 || px > plot.x + plot.width + 1) continue
        gridlines.add(ChartSegment(px, plot.y, px, plot.y + plot.height, ml.color ?: theme.axisLineColor, 1.5, chartDashPattern(ml.dash ?: "dashed", 1.5)))
        if (!ml.label.isNullOrEmpty()) texts.add(ChartTextItem(px + 4, plot.y + 2, ml.label, theme.textColorMuted, theme.labelSize, null, "start", "top", null, "markline-${jsNumberString(jsRound(px))}"))
    }
    if (spec.yHidden != true && spec.yHideTicks != true && !compact) yTickVals.forEachIndexed { i, t ->
        texts.add(ChartTextItem(plot.x - 8, toPxY(t), yTickLabels[i], theme.textColorMuted, theme.labelSize, null, "end", "middle", null, "yt-$i"))
    }
    val xPositions = (0 until rows).map { toPxX(it) }
    val xAnchors = mutableListOf<Triple<Double, String, String>>()
    if (spec.xScale == ChartScaleType.CATEGORY) {
        val step = max(1, ceil(rows.toDouble() / max(1, floor(plot.width / 60).toInt())).toInt())
        var i = 0
        while (i < rows) { xAnchors.add(Triple(xPositions[i], spec.xFormatter(spec.xValues.getOrNull(i) ?: ChartAxisValue.Num(i.toDouble())), "xt-$i")); i += step }
    } else if (rows > 0) {
        val xd = computeDomain(xNums, scale = spec.xScale)
        val target = max(2, floor(plot.width / 90).toInt())
        for (tv in sectionedTicks(xd, xBreakRanges, spec.xScale, target).filter { !inBreak(xBreakRanges, it) }) {
            val px = plot.x + x.scale(tv)
            if (px < plot.x - 1 || px > plot.x + plot.width + 1) continue
            xAnchors.add(Triple(px, spec.xFormatter(if (spec.xScale == ChartScaleType.TIME) ChartAxisValue.DateMs(tv) else ChartAxisValue.Num(tv)), "xt-${jsNumberString(tv)}"))
        }
    }
    if (!compact) for ((px, text, key) in xAnchors) {
        if (spec.gridX == true && px > plot.x + 0.5) gridlines.add(ChartSegment(px, plot.y, px, plot.y + plot.height, theme.gridLineColor, 1.0, xGridDash))
        if (spec.axisTicks == true && spec.xHidden != true) { val yb = plot.y + plot.height; axisLines.add(ChartSegment(px, yb, px, yb + AXIS_TICK_LEN, theme.axisLineColor, 1.0, xAxisDash)) }
        if (spec.xHidden == true || spec.xHideTicks == true) continue
        texts.add(ChartTextItem(px, plot.y + plot.height + 6, text, theme.textColorMuted, theme.labelSize, null, "center", "top", null, key))
    }
    if (!spec.xLabel.isNullOrEmpty() && !compact) texts.add(ChartTextItem(plot.x + plot.width / 2, height - lb.bottom - 2, spec.xLabel, theme.textColor, theme.labelSize, null, "center", "bottom", null, "x-axis-title"))
    if (!spec.yLabel.isNullOrEmpty() && !compact) texts.add(ChartTextItem(4.0, plot.y + plot.height / 2, spec.yLabel, theme.textColor, theme.labelSize, null, "center", "top", -90.0, "y-axis-title"))
    val legend = if (spec.legend == "none" || compact) emptyList() else spec.series.mapIndexed { si, s -> ChartLegendItem(s.label, s.color, si, s.hidden, 0.0, 0.0) }
    val xLabels = (0 until rows).map { spec.xFormatter(spec.xValues.getOrNull(it) ?: ChartAxisValue.Num(it.toDouble())) }
    return ChartScene(null, width, height, plot, if (theme.background == "transparent") null else theme.background, axisBands, gridlines, axisLines, areas, bars, emptyList(), lines, markers,
        glyphs, endLabelCands, texts, null, legend, spec.legend, xPositions = xPositions, xValues = spec.xValues, xLabels = xLabels, hoverPoints = hoverPoints)
}

fun chartResolveEndLabelCollisions(cands: MutableList<ChartEndLabel>, minGap: Double) {
    if (cands.size <= 1) return
    var lastY = Double.NEGATIVE_INFINITY
    for (c in cands.sortedBy { it.y }) { c.visible = c.y - lastY >= minGap; if (c.visible) lastY = c.y }
}

fun chartComputeMultiAxisLayout(spec: ChartLineSpec, theme: ChartEngineTheme, width: Double, height: Double): ChartScene {
    val axesSpec = spec.yAxes ?: emptyList()
    val rows = if (spec.xValues.isNotEmpty()) spec.xValues.size else jsMax(0.0, spec.series.map { it.data.size.toDouble() }).toInt()
    fun axisIndexOf(s: ChartLineSeriesSpec): Int { val i = s.yAxisIndex ?: 0; return if (i >= 0 && i < axesSpec.size) i else 0 }
    class AxisInfo(val spec: ChartValueAxisSpec, val domain: ChartDomain, val tickVals: List<Double>, val tickLabels: List<String>, val side: String, val gutterW: Double, val tint: String?, val hasData: Boolean) {
        var axisX = 0.0; lateinit var toPxY: (Double) -> Double
    }
    val axes = axesSpec.mapIndexed { ai, a ->
        val seriesOn = spec.series.filter { !it.hidden && axisIndexOf(it) == ai }
        val vals = seriesOn.flatMap { s -> s.data.mapNotNull { (it as? ChartCell.Num)?.v?.takeIf { v -> v.isFinite() } } }
        val domain = computeDomain(vals, a.min, a.max, a.scale, a.scale == ChartScaleType.VALUE)
        val tickVals = if (a.scale == ChartScaleType.LOG) logTicks(domain.lo, domain.hi) else niceLinearTicks(domain.lo, domain.hi, 6)
        val tickLabels = tickVals.map { a.formatter(it) }
        val side = a.position ?: (if (ai == 0) "left" else "right")
        val labelW = if (a.hidden == true || a.hideTicks == true) 0.0 else jsMax(0.0, tickLabels.map { chartApproxWidth(it, theme.labelSize) })
        val titleW = if (!a.label.isNullOrEmpty()) theme.labelSize + 6 else 0.0
        AxisInfo(a, domain, tickVals, tickLabels, side, if (a.hidden == true) 4.0 else labelW + 12 + titleW, a.color, seriesOn.isNotEmpty())
    }
    val leftAxes = axes.filter { it.side == "left" }; val rightAxes = axes.filter { it.side == "right" }
    val titleH = if (!spec.title.isNullOrEmpty()) theme.titleSize + 10 + (if (!spec.subtitle.isNullOrEmpty()) theme.labelSize + 4 else 0.0) else 0.0
    val xLabelH = if (spec.xHidden == true || spec.xHideTicks == true) 0.0 else theme.labelSize + 8
    val xAxisLabelH = if (!spec.xLabel.isNullOrEmpty()) theme.labelSize + 6 else 0.0
    val lb = LegendBands(spec, theme, width)
    val lastXText = if (spec.xHidden == true || spec.xHideTicks == true) "" else spec.xFormatter(spec.xValues.getOrNull(rows - 1) ?: ChartAxisValue.Num((rows - 1).toDouble()))
    val xOverhang = if (rightAxes.isEmpty()) chartApproxWidth(lastXText, theme.labelSize) / 2 else 0.0
    val padTop = titleH + 8 + lb.top
    val padBottom = xLabelH + xAxisLabelH + 6 + lb.bottom
    val padLeft = leftAxes.sumOf { it.gutterW } + 8 + (if (spec.legend == "left") lb.sideW else 0.0)
    val padRight = rightAxes.sumOf { it.gutterW } + 8 + xOverhang + (if (spec.legend == "right") lb.sideW else 0.0)
    val plot = ChartRect(padLeft, padTop, max(1.0, width - padLeft - padRight), max(1.0, height - padTop - padBottom))
    val xNums = spec.xValues.map { chartToNumeric(it, spec.xScale) }
    val x = when (spec.xScale) {
        ChartScaleType.CATEGORY -> makeCategoryScale(rows, plot.width, true)
        ChartScaleType.LOG -> makeLogScale(computeDomain(xNums, scale = ChartScaleType.LOG), plot.width)
        else -> makeLinearScale(computeDomain(xNums, scale = spec.xScale), plot.width, spec.xScale)
    }
    fun toPxX(i: Int) = plot.x + if (spec.xScale == ChartScaleType.CATEGORY) x.scale(i.toDouble()) else x.scale(if (i >= 0 && i < xNums.size) xNums[i] else 0.0)
    fun makeAxisScale(a: AxisInfo) { val sc = if (a.spec.scale == ChartScaleType.LOG) makeLogScale(a.domain, plot.height) else makeLinearScale(a.domain, plot.height, a.spec.scale); a.toPxY = { v -> plot.y + plot.height - sc.scale(v) } }
    var offL = 0.0; for (a in leftAxes) { a.axisX = plot.x - offL; makeAxisScale(a); offL += a.gutterW }
    var offR = 0.0; for (a in rightAxes) { a.axisX = plot.x + plot.width + offR; makeAxisScale(a); offR += a.gutterW }
    val bands = mutableListOf<ChartSceneBand>(); val bandLabels = mutableListOf<ChartTextItem>()
    axes.forEachIndexed { ai, a -> val b = chartBuildAxisBands(a.spec.bands, "y", { v -> a.toPxY(chartToNumeric(v, a.spec.scale)) }, plot, theme, "yband-$ai"); bands += b.first; bandLabels += b.second }
    val onX = chartBuildAxisBands(spec.xBands, "x", { plot.x + x.scale(if (spec.xScale == ChartScaleType.CATEGORY) chartNumberOf(it) else chartToNumeric(it, spec.xScale)) }, plot, theme, "xband")
    bands += onX.first; bandLabels += onX.second
    val gridlines = mutableListOf<ChartSegment>(); val axisLines = mutableListOf<ChartSegment>()
    val primary = axes.firstOrNull { it.spec.hidden != true && it.hasData } ?: axes.firstOrNull { it.hasData }
    val xAxisDash = chartDashPattern(spec.xDash); val xGridDash = chartDashPattern(spec.xGridDash)
    if (primary != null && spec.gridY != false) {
        val gridDash = chartDashPattern(primary.spec.gridDash)
        for (t in primary.tickVals) {
            val py = primary.toPxY(t)
            gridlines.add(ChartSegment(plot.x, py, plot.x + plot.width, py, theme.gridLineColor, 1.0, gridDash))
            if (spec.axisTicks == true) axisLines.add(ChartSegment(plot.x - AXIS_TICK_LEN, py, plot.x, py, theme.axisLineColor, 1.0, chartDashPattern(primary.spec.dash)))
        }
    }
    for (a in axes) {
        if (a.spec.hidden == true) continue
        val col = a.tint ?: theme.axisLineColor; val dash = chartDashPattern(a.spec.dash)
        axisLines.add(ChartSegment(a.axisX, plot.y, a.axisX, plot.y + plot.height, col, 1.0, dash))
        if (spec.axisTicks == true && a.spec.hideTicks != true) { val dir = if (a.side == "left") -1 else 1; for (t in a.tickVals) { val py = a.toPxY(t); axisLines.add(ChartSegment(a.axisX, py, a.axisX + dir * AXIS_TICK_LEN, py, col, 1.0, dash)) } }
    }
    if (spec.xHidden != true) axisLines.add(ChartSegment(plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height, theme.axisLineColor, 1.0, xAxisDash))
    val lines = mutableListOf<ChartPolyline>(); val areas = mutableListOf<ChartSceneArea>(); val markers = mutableListOf<ChartSceneMarker>(); val glyphs = mutableListOf<ChartGlyph>(); val hoverPoints = mutableListOf<ChartHoverSeries>()
    spec.series.forEachIndexed { si, s ->
        if (s.hidden) return@forEachIndexed
        val ax = axes[axisIndexOf(s)]
        val zeroIn = ax.domain.lo <= 0 && ax.domain.hi >= 0
        val baselineY = ax.toPxY(if (zeroIn) 0.0 else ax.domain.lo)
        val byIndex = LinkedHashMap<Int, ChartHoverPoint>()
        for (run in chartSplitRuns(s.data, s.connectNulls)) {
            if (run.isEmpty()) continue
            val raw = run.map { ChartPt(toPxX(it.index), ax.toPxY(it.value)) }
            run.forEachIndexed { k, r -> byIndex[r.index] = ChartHoverPoint(raw[k].x, raw[k].y, s.data[r.index].raw ?: r.value, symbol = s.pointSymbols?.get(r.index) ?: (if (!s.symbol.isNullOrEmpty() && s.symbol != "none") s.symbol else "circle")) }
            val poly = chartClampToRect(chartInterpolate(chartDecimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height)
            lines.add(ChartPolyline(poly, s.color, 2.5, chartDashPattern(s.dash, 2.5), si))
            if (spec.area && s.fill != false) { val fo = spec.fillOpacity ?: 0.35; areas.add(ChartSceneArea(poly, baselineY, chartHexToRgba(s.color, fo), chartHexToRgba(s.color, max(0.02, fo * 0.06)), seriesIndex = si)) }
            val markSet = s.markIndices?.toSet()
            run.forEachIndexed { k, r ->
                val sym = s.pointSymbols?.get(r.index) ?: (if (markSet?.contains(r.index) ?: s.showMarks) (s.symbol ?: "circle") else null)
                if (sym.isNullOrEmpty() || sym == "none") return@forEachIndexed
                if (chartIsShapeSymbol(sym)) markers.add(ChartSceneMarker(raw[k].x, raw[k].y, chartMarkerRadius(sym, s.markSize), s.color, sym, si)) else glyphs.add(ChartGlyph(raw[k].x, raw[k].y, sym, GLYPH_SIZE))
            }
            if (spec.showLabels == true) run.forEachIndexed { k, r ->
                val above = raw[k].y - 9 - theme.labelSize >= plot.y
                glyphs.add(ChartGlyph(raw[k].x, raw[k].y, ax.spec.formatter(s.data[r.index].raw ?: r.value), theme.labelSize, ChartGlyphLabel(theme.textColor, 600.0, 0.0, if (above) -9.0 else 9.0, "-50%", if (above) "-100%" else "0")))
            }
        }
        hoverPoints.add(ChartHoverSeries(si, s.color, s.label, !chartHasAnchor(s), byIndex, s.data, ax.spec.formatter))
    }
    val texts = bandLabels.toMutableList()
    if (!spec.title.isNullOrEmpty()) {
        val (tx, ta) = chartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.add(ChartTextItem(tx, lb.top + 6, spec.title, theme.textColor, theme.titleSize, 600.0, ta, "top", null, "title"))
        if (!spec.subtitle.isNullOrEmpty()) texts.add(ChartTextItem(tx, lb.top + 6 + theme.titleSize + 4, spec.subtitle, theme.textColorMuted, theme.labelSize, null, ta, "top", null, "subtitle"))
    }
    axes.forEachIndexed { ai, a ->
        if (a.spec.hidden == true) return@forEachIndexed
        val labelColor = a.tint ?: theme.textColorMuted
        if (a.spec.hideTicks != true) a.tickVals.forEachIndexed { i, t -> texts.add(ChartTextItem(if (a.side == "left") a.axisX - 8 else a.axisX + 8, a.toPxY(t), a.tickLabels[i], labelColor, theme.labelSize, null, if (a.side == "left") "end" else "start", "middle", null, "yt-$ai-$i")) }
        if (!a.spec.label.isNullOrEmpty()) {
            val outerX = if (a.side == "left") a.axisX - a.gutterW + theme.labelSize else a.axisX + a.gutterW - theme.labelSize
            texts.add(ChartTextItem(outerX, plot.y + plot.height / 2, a.spec.label, a.tint ?: theme.textColor, theme.labelSize, null, "center", "top", -90.0, "yaxis-title-$ai"))
        }
    }
    val xPositions = (0 until rows).map { toPxX(it) }
    val yb = plot.y + plot.height
    val xAnchors = mutableListOf<Triple<Double, String, String>>()
    if (spec.xScale == ChartScaleType.CATEGORY) {
        val step = max(1, ceil(rows.toDouble() / max(1, floor(plot.width / 60).toInt())).toInt())
        for (i in 0 until rows) if (i % step == 0) xAnchors.add(Triple(xPositions[i], spec.xFormatter(spec.xValues.getOrNull(i) ?: ChartAxisValue.Num(i.toDouble())), "xt-$i"))
    } else {
        val xd = computeDomain(xNums, scale = spec.xScale)
        val n = max(2, floor(plot.width / 90).toInt())
        val xTicks = when (spec.xScale) { ChartScaleType.LOG -> logTicks(xd.lo, xd.hi); ChartScaleType.TIME -> timeTicks(xd.lo, xd.hi, n); else -> niceLinearTicks(xd.lo, xd.hi, n) }
        for (tv in xTicks) {
            val px = plot.x + x.scale(tv)
            if (px < plot.x - 1 || px > plot.x + plot.width + 1) continue
            xAnchors.add(Triple(px, spec.xFormatter(if (spec.xScale == ChartScaleType.TIME) ChartAxisValue.DateMs(tv) else ChartAxisValue.Num(tv)), "xt-${jsNumberString(tv)}"))
        }
    }
    if (spec.gridX == true) for (a in xAnchors) gridlines.add(ChartSegment(a.first, plot.y, a.first, yb, theme.gridLineColor, 1.0, xGridDash))
    if (spec.xHidden != true && spec.xHideTicks != true) for ((px, text, key) in xAnchors) {
        if (spec.axisTicks == true) axisLines.add(ChartSegment(px, yb, px, yb + AXIS_TICK_LEN, theme.axisLineColor, 1.0, xAxisDash))
        texts.add(ChartTextItem(px, yb + 6, text, theme.textColorMuted, theme.labelSize, null, "center", "top", null, key))
    }
    if (!spec.xLabel.isNullOrEmpty()) texts.add(ChartTextItem(plot.x + plot.width / 2, height - lb.bottom - 2, spec.xLabel, theme.textColor, theme.labelSize, null, "center", "bottom", null, "x-axis-title"))
    for (ml in spec.markLines ?: emptyList()) {
        val mv = if (spec.xScale == ChartScaleType.CATEGORY) chartNumberOf(ml.value) else chartToNumeric(ml.value, spec.xScale)
        val px = plot.x + x.scale(mv)
        if (!px.isFinite() || px < plot.x - 1 || px > plot.x + plot.width + 1) continue
        gridlines.add(ChartSegment(px, plot.y, px, plot.y + plot.height, ml.color ?: theme.axisLineColor, 1.5, chartDashPattern(ml.dash ?: "dashed", 1.5)))
        if (!ml.label.isNullOrEmpty()) texts.add(ChartTextItem(px + 4, plot.y + 2, ml.label, theme.textColorMuted, theme.labelSize, null, "start", "top", null, "markline-${jsNumberString(jsRound(px))}"))
    }
    val legend = if (spec.legend == "none") emptyList() else spec.series.mapIndexed { si, s -> ChartLegendItem(s.label, s.color, si, s.hidden, 0.0, 0.0) }
    val xLabels = (0 until rows).map { spec.xFormatter(spec.xValues.getOrNull(it) ?: ChartAxisValue.Num(it.toDouble())) }
    return ChartScene(null, width, height, plot, if (theme.background == "transparent") null else theme.background, bands, gridlines, axisLines, areas, emptyList(), emptyList(), lines, markers,
        glyphs, emptyList(), texts, null, legend, spec.legend, xPositions = xPositions, xValues = spec.xValues, xLabels = xLabels, hoverPoints = hoverPoints)
}

fun chartComputeInvertedLayout(spec: ChartLineSpec, theme: ChartEngineTheme, width: Double, height: Double): ChartScene {
    val rows = if (spec.xValues.isNotEmpty()) spec.xValues.size else jsMax(0.0, spec.series.map { it.data.size.toDouble() }).toInt()
    val compact = spec.compact == true
    val category = spec.xScale == ChartScaleType.CATEGORY
    val stackKeys = spec.series.map { if (spec.stack != "none" && it.range == null) "stacked" else "__unstacked__" }
    val bands = chartStackSeries(spec.series.map { if (it.hidden) emptyList() else it.data }, spec.stack, stackKeys).map { it.toMutableList() }.toMutableList()
    spec.series.forEachIndexed { si, s -> if (s.range != null && !s.hidden) bands[si] = s.range.map { r -> if (r != null) ChartBandCell.Band(min(r.first, r.second), max(r.first, r.second)) else ChartBandCell.Null }.toMutableList() }
    val valVals = mutableListOf<Double>()
    spec.series.forEachIndexed { si, s -> if (!s.hidden) bands[si].forEach { b -> b.band?.let { valVals.add(it.lo); valVals.add(it.hi) } } }
    val valDomain = computeDomain(valVals, spec.yMin, spec.yMax, spec.yScale, false)
    val valTicks = if (spec.yScale == ChartScaleType.LOG) logTicks(valDomain.lo, valDomain.hi) else niceLinearTicks(valDomain.lo, valDomain.hi, 8)
    val valTickLabels = valTicks.map { (spec.yTickFormatter ?: spec.yFormatter)(it) }
    val xNums = spec.xValues.map { chartToNumeric(it, spec.xScale) }
    val mainDomain = if (category) ChartDomain(0.0, max(1, rows - 1).toDouble()) else computeDomain(xNums, scale = spec.xScale)
    val mainTickIdx = if (category) (0 until max(0, rows)).map { it.toDouble() } else niceLinearTicks(mainDomain.lo, mainDomain.hi, 6)
    val mainTickLabels = mainTickIdx.map { v -> if (category) spec.xFormatter(spec.xValues.getOrNull(v.toInt()) ?: ChartAxisValue.Num(v)) else spec.xFormatter(ChartAxisValue.Num(v)) }
    val lb = LegendBands(spec, theme, width)
    val titleH = if (!spec.title.isNullOrEmpty()) theme.titleSize + 10 + (if (!spec.subtitle.isNullOrEmpty()) theme.labelSize + 4 else 0.0) else 0.0
    val maxMainLabelW = if (spec.xHidden == true || spec.xHideTicks == true) 0.0 else jsMax(0.0, mainTickLabels.map { chartApproxWidth(it, theme.labelSize) })
    val valLabelH = if (spec.yHidden == true || spec.yHideTicks == true) 0.0 else theme.labelSize + 8
    val mainAxisTitleW = if (!spec.xLabel.isNullOrEmpty()) theme.labelSize + 6 else 0.0
    val valAxisTitleH = if (!spec.yLabel.isNullOrEmpty()) theme.labelSize + 6 else 0.0
    val padTop = if (compact) 2.0 else titleH + 8 + lb.top
    val padRight = if (compact) 2.0 else 12 + chartApproxWidth(valTickLabels.lastOrNull() ?: "", theme.labelSize) / 2 + (if (spec.legend == "right") lb.sideW else 0.0)
    val padBottom = if (compact) 2.0 else valLabelH + valAxisTitleH + 6 + lb.bottom
    val padLeft = if (compact) 2.0 else maxMainLabelW + 10 + mainAxisTitleW + (if (spec.legend == "left") lb.sideW else 0.0)
    val plot = ChartRect(padLeft, padTop, max(1.0, width - padLeft - padRight), max(1.0, height - padTop - padBottom))
    val valScale = if (spec.yScale == ChartScaleType.LOG) makeLogScale(valDomain, plot.width) else makeLinearScale(valDomain, plot.width, spec.yScale)
    val mainScale = if (category) makeCategoryScale(rows, plot.height, true) else if (spec.xScale == ChartScaleType.LOG) makeLogScale(mainDomain, plot.height) else makeLinearScale(mainDomain, plot.height, spec.xScale)
    fun toPxX(v: Double) = plot.x + valScale.scale(v)
    fun toPxYval(c: Double) = plot.y + plot.height - mainScale.scale(c)
    fun toPxYidx(i: Int) = toPxYval(if (category) i.toDouble() else (if (i >= 0 && i < xNums.size) xNums[i] else 0.0))
    val gridlines = mutableListOf<ChartSegment>(); val axisLines = mutableListOf<ChartSegment>()
    val yb = plot.y + plot.height
    val yAxisDash = chartDashPattern(spec.yDash); val yGridDash = chartDashPattern(spec.yGridDash); val xAxisDash = chartDashPattern(spec.xDash); val xGridDash = chartDashPattern(spec.xGridDash)
    if (spec.yHidden != true && !compact) {
        for (t in valTicks) {
            val px = toPxX(t)
            if (spec.gridY != false) gridlines.add(ChartSegment(px, plot.y, px, yb, theme.gridLineColor, 1.0, yGridDash))
            if (spec.axisTicks == true) axisLines.add(ChartSegment(px, yb, px, yb + AXIS_TICK_LEN, theme.axisLineColor, 1.0, yAxisDash))
        }
        axisLines.add(ChartSegment(plot.x, yb, plot.x + plot.width, yb, theme.axisLineColor, 1.0, yAxisDash))
    }
    if (spec.xHidden != true && !compact) {
        for (t in mainTickIdx) {
            val py = toPxYval(t)
            if (spec.gridX == true) gridlines.add(ChartSegment(plot.x, py, plot.x + plot.width, py, theme.gridLineColor, 1.0, xGridDash))
            if (spec.axisTicks == true) axisLines.add(ChartSegment(plot.x - AXIS_TICK_LEN, py, plot.x, py, theme.axisLineColor, 1.0, xAxisDash))
        }
        axisLines.add(ChartSegment(plot.x, plot.y, plot.x, plot.y + plot.height, theme.axisLineColor, 1.0, xAxisDash))
    }
    val lines = mutableListOf<ChartPolyline>(); val areas = mutableListOf<ChartSceneArea>(); val markers = mutableListOf<ChartSceneMarker>(); val glyphs = mutableListOf<ChartGlyph>(); val hoverPoints = mutableListOf<ChartHoverSeries>()
    val baselineX = toPxX(max(valDomain.lo, min(valDomain.hi, 0.0)))
    spec.series.forEachIndexed { si, s ->
        if (s.hidden) return@forEachIndexed
        val byIndex = LinkedHashMap<Int, ChartHoverPoint>()
        for (run in chartSplitRuns(tops(bands[si]), s.connectNulls)) {
            if (run.isEmpty()) continue
            val raw = run.map { ChartPt(toPxX(it.value), toPxYidx(it.index)) }
            run.forEachIndexed { k, r -> byIndex[r.index] = ChartHoverPoint(raw[k].x, raw[k].y, s.data.getOrNull(r.index)?.raw ?: r.value, symbol = s.pointSymbols?.get(r.index) ?: (if (!s.symbol.isNullOrEmpty() && s.symbol != "none") s.symbol else "circle")) }
            val poly = chartClampToRect(chartInterpolate(chartDecimateMinMax(raw, plot.width), s.curve), plot.x, plot.y, plot.width, plot.height)
            if (s.range == null && s.stroke != false) lines.add(ChartPolyline(poly, s.color, 2.5, chartDashPattern(s.dash, 2.5), si))
            if (spec.area && s.fill != false) {
                val fo = spec.fillOpacity ?: 0.35
                val banded = spec.stack != "none" || s.range != null
                val basePoints = if (banded) chartClampToRect(chartInterpolate(run.map { ChartPt(toPxX(bands[si][it.index].band?.lo ?: Double.NaN), toPxYidx(it.index)) }, s.curve), plot.x, plot.y, plot.width, plot.height) else poly.map { ChartPt(baselineX, it.y) }
                areas.add(ChartSceneArea(poly, baselineX, chartHexToRgba(s.color, fo), if (banded) chartHexToRgba(s.color, fo) else chartHexToRgba(s.color, max(0.02, fo * 0.06)), basePoints, true, si))
            }
            val markSet = s.markIndices?.toSet()
            run.forEachIndexed { k, r ->
                val sym = s.pointSymbols?.get(r.index) ?: (if (markSet?.contains(r.index) ?: s.showMarks) (s.symbol ?: "circle") else null)
                if (sym.isNullOrEmpty() || sym == "none") return@forEachIndexed
                if (chartIsShapeSymbol(sym)) markers.add(ChartSceneMarker(raw[k].x, raw[k].y, chartMarkerRadius(sym, s.markSize), s.color, sym, si)) else glyphs.add(ChartGlyph(raw[k].x, raw[k].y, sym, GLYPH_SIZE))
            }
            if (spec.showLabels == true && !compact) run.forEachIndexed { k, r -> glyphs.add(ChartGlyph(raw[k].x, raw[k].y, spec.yFormatter(s.data.getOrNull(r.index)?.raw ?: r.value), theme.labelSize, ChartGlyphLabel(theme.textColor, 600.0, 9.0, 0.0, "0", "-50%"))) }
        }
        hoverPoints.add(ChartHoverSeries(si, s.color, s.label, !chartHasAnchor(s), byIndex, s.data))
    }
    val texts = mutableListOf<ChartTextItem>()
    if (!spec.title.isNullOrEmpty() && !compact) {
        val (tx, ta) = chartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.add(ChartTextItem(tx, lb.top + 6, spec.title, theme.textColor, theme.titleSize, 600.0, ta, "top", null, "title"))
        if (!spec.subtitle.isNullOrEmpty()) texts.add(ChartTextItem(tx, lb.top + 6 + theme.titleSize + 4, spec.subtitle, theme.textColorMuted, theme.labelSize, null, ta, "top", null, "subtitle"))
    }
    if (spec.xHidden != true && spec.xHideTicks != true && !compact) mainTickIdx.forEachIndexed { i, t -> texts.add(ChartTextItem(plot.x - 8, toPxYval(t), mainTickLabels[i], theme.textColorMuted, theme.labelSize, null, "end", "middle", null, "mt-$i")) }
    if (spec.yHidden != true && spec.yHideTicks != true && !compact) valTicks.forEachIndexed { i, t -> texts.add(ChartTextItem(toPxX(t), yb + 6, valTickLabels[i], theme.textColorMuted, theme.labelSize, null, "center", "top", null, "vt-$i")) }
    if (!spec.xLabel.isNullOrEmpty() && !compact) texts.add(ChartTextItem(4.0, plot.y + plot.height / 2, spec.xLabel, theme.textColor, theme.labelSize, null, "center", "top", -90.0, "x-axis-title"))
    if (!spec.yLabel.isNullOrEmpty() && !compact) texts.add(ChartTextItem(plot.x + plot.width / 2, height - lb.bottom - 2, spec.yLabel, theme.textColor, theme.labelSize, null, "center", "bottom", null, "y-axis-title"))
    val legend = if (spec.legend == "none" || compact) emptyList() else spec.series.mapIndexed { si, s -> ChartLegendItem(s.label, s.color, si, s.hidden, 0.0, 0.0) }
    return ChartScene(null, width, height, plot, if (theme.background == "transparent") null else theme.background, null, gridlines, axisLines, areas, emptyList(), emptyList(), lines, markers,
        glyphs, null, texts, null, legend, spec.legend, inverted = true, xPositions = (0 until rows).map { toPxYidx(it) }, xValues = spec.xValues,
        xLabels = (0 until rows).map { spec.xFormatter(spec.xValues.getOrNull(it) ?: ChartAxisValue.Num(it.toDouble())) }, hoverPoints = hoverPoints)
}
