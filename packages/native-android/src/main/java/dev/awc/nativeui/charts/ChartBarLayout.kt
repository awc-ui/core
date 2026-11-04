package dev.awc.nativeui.charts

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// Port of engine/bar-layout.ts: bar / column / polar spec → RenderScene.

data class ChartBarSeriesSpec(
    val label: String, val color: String, val data: List<ChartCell>, val hidden: Boolean,
    val range: List<Pair<Double, Double>?>? = null, val pointWidths: Map<Int, Double>? = null, val axisIndex: Int? = null,
    val overlay: Boolean? = null, val widthRatio: Double? = null, val stack: String? = null, val pointColors: Map<Int, String>? = null,
)

data class ChartValueAxis2(val min: Double? = null, val max: Double? = null, val label: String? = null, val formatter: ((Double) -> String)? = null, val hidden: Boolean? = null)

data class ChartBarSpec(
    val series: List<ChartBarSeriesSpec>, val title: String? = null, val titleAlign: String? = null,
    val categories: List<ChartAxisValue>, val categoryFormatter: (ChartAxisValue) -> String,
    val categoryLabel: String? = null, val categoryHidden: Boolean? = null, val categoryHideTicks: Boolean? = null, val categoryDash: String? = null,
    val categoryLabelRotation: Double? = null, val categoryLabelsMirrored: Boolean? = null,
    val valueScale: ChartScaleType = ChartScaleType.VALUE, val valueBreaks: ChartAxisBreaks? = null, val valueMin: Double? = null, val valueMax: Double? = null,
    val valueFormatter: (Double) -> String, val valueTickFormatter: ((Double) -> String)? = null, val valueLabel: String? = null,
    val valueAxis2: ChartValueAxis2? = null, val valueHidden: Boolean? = null, val valueHideTicks: Boolean? = null,
    val categoryAxisLine: Boolean? = null, val valueAxisLine: Boolean? = null, val valueDash: String? = null, val valueGridDash: String? = null,
    val stack: String, val horizontal: Boolean, val categoryGapRatio: Double, val barGapRatio: Double, val barWidth: Double? = null, val cornerRadius: Double,
    val polar: Boolean? = null, val polarHole: Double? = null, val polarSweep: Double? = null, val chevron: Boolean? = null,
    val showLabels: Boolean, val showTotals: Boolean? = null, val subtitle: String? = null, val legend: String? = null, var legendExtent: Double? = null,
    val compact: Boolean? = null, val axisTicks: Boolean? = null, val animation: String? = null, val animationDuration: Double? = null,
)

const val CHEVRON_MAX_TIP = 32.0
fun chartChevronTipDepth(thickness: Double) = min(thickness * 0.3, CHEVRON_MAX_TIP)

private fun visibleValueTicks(values: List<Double>, labels: List<String>, toPx: (Double) -> Double, measure: (String) -> Double): List<Int> {
    data class T(val value: Double, val index: Int, val x: Double, val width: Double)
    val ticks = values.mapIndexed { i, v -> T(v, i, toPx(v), measure(labels[i])) }.sortedBy { it.x }
    if (ticks.size < 2) return ticks.map { it.index }
    fun fits(a: T, b: T) = b.x - a.x >= (a.width + b.width) / 2 + 8
    val first = ticks.first(); val last = ticks.last()
    if (!fits(first, last)) return listOf((ticks.firstOrNull { it.value == 0.0 } ?: first).index)
    val visible = mutableListOf(first)
    for (t in ticks.subList(1, ticks.size - 1)) if (fits(visible.last(), t) && fits(t, last)) visible.add(t)
    visible.add(last)
    return visible.map { it.index }
}

private fun alignZeroAxes(a: ChartDomain, b: ChartDomain): Pair<ChartDomain, ChartDomain> {
    val topA = a.hi; val topB = b.hi
    if (!(topA > 0) || !(topB > 0)) return a to b
    val rA = if (a.lo < 0) -a.lo / topA else 0.0; val rB = if (b.lo < 0) -b.lo / topB else 0.0
    val share = max(rA, rB)
    if (share <= 0) return a to b
    return ChartDomain(-share * topA, topA) to ChartDomain(-share * topB, topB)
}

private fun ellipsize(text: String, maxW: Double, fontSize: Double): String {
    if (maxW <= 0 || chartApproxWidth(text, fontSize) <= maxW) return text
    val n = floor(maxW / (fontSize * 0.58)).toInt() - 1
    return if (n >= 1) text.substring(0, min(n, text.length)) + "…" else ""
}

fun chartComputeBarLayout(spec: ChartBarSpec, theme: ChartEngineTheme, width: Double, height: Double, measureLabel: (String) -> Double = { chartApproxWidth(it, theme.labelSize) }): ChartScene {
    val horizontal = spec.horizontal
    val C = if (spec.categories.isNotEmpty()) spec.categories.size else jsMax(0.0, spec.series.map { (it.range?.size ?: it.data.size).toDouble() }).toInt()
    val stacked = spec.stack != "none"
    val stackKeys = spec.series.map { if (stacked && it.range == null) (it.stack?.ifEmpty { null } ?: "stacked") else "__unstacked__" }
    val bands = chartStackSeries(spec.series.map { if (it.hidden || it.range != null) emptyList() else it.data }, spec.stack, stackKeys).map { it.toMutableList() }.toMutableList()
    spec.series.forEachIndexed { si, s -> if (s.range != null && !s.hidden) bands[si] = s.range.map { d -> if (d != null) ChartBandCell.Band(min(d.first, d.second), max(d.first, d.second)) else ChartBandCell.Null }.toMutableList() }
    val vVals = mutableListOf<Double>()
    spec.series.forEachIndexed { si, s -> if (!s.hidden) bands[si].forEach { b -> b.band?.let { vVals.add(it.lo); vVals.add(it.hi) } } }
    fun onAxis2(si: Int) = (spec.series[si].axisIndex ?: 0) == 1
    val hasAxis2 = spec.valueAxis2 != null && spec.series.indices.any { !spec.series[it].hidden && onAxis2(it) }
    val vVals2 = mutableListOf<Double>()
    if (hasAxis2) {
        vVals.clear()
        spec.series.forEachIndexed { si, s -> if (!s.hidden) bands[si].forEach { b -> b.band?.let { (if (onAxis2(si)) vVals2 else vVals).apply { add(it.lo); add(it.hi) } } } }
    }
    var vDomain = computeDomain(vVals, spec.valueMin, spec.valueMax, spec.valueScale, true)
    var vDomain2 = if (hasAxis2) computeDomain(vVals2, spec.valueAxis2!!.min, spec.valueAxis2.max, spec.valueScale, true) else vDomain
    if (hasAxis2 && spec.valueScale == ChartScaleType.VALUE && spec.valueMin == null && spec.valueMax == null && spec.valueAxis2!!.min == null && spec.valueAxis2.max == null) {
        val (a, b) = alignZeroAxes(vDomain, vDomain2); vDomain = a; vDomain2 = b
    }
    val vFound = resolveAxisBreaks(spec.valueBreaks, vVals, spec.valueScale)
    val vBreakRanges = openTopSection(normalizeBreaks(vFound.first, vDomain), vDomain, spec.valueScale)
    val vTickVals = sectionedTicks(vDomain, vBreakRanges, spec.valueScale, 6).filter { !inBreak(vBreakRanges, it) }
    val vTickLabels = vTickVals.map { (spec.valueTickFormatter ?: spec.valueFormatter)(it) }
    val v2Fmt = spec.valueAxis2?.formatter ?: spec.valueTickFormatter ?: spec.valueFormatter
    val v2TickVals = if (hasAxis2 && spec.valueAxis2!!.hidden != true) sectionedTicks(vDomain2, emptyList(), spec.valueScale, 6) else emptyList()
    val v2TickLabels = v2TickVals.map { v2Fmt(it) }
    val maxV2LabelW = jsMax(0.0, v2TickLabels.map { chartApproxWidth(it, theme.labelSize) })
    val catLabels = (0 until C).map { spec.categoryFormatter(spec.categories.getOrNull(it) ?: ChartAxisValue.Num(it.toDouble())) }

    if (spec.polar == true) return radialScene(spec, theme, width, height, bands, vDomain, catLabels, C, stacked, stackKeys)

    // computeGutters
    val subtitleH = if (!spec.subtitle.isNullOrEmpty()) theme.labelSize + 4 else 0.0
    val titleH = if (!spec.title.isNullOrEmpty()) theme.titleSize + 10 + subtitleH else 0.0
    val maxVLabelW = if (spec.valueHidden == true || spec.valueHideTicks == true) 0.0 else jsMax(0.0, vTickLabels.map { chartApproxWidth(it, theme.labelSize) })
    val maxCatLabelW = if (spec.categoryHidden == true || spec.categoryHideTicks == true) 0.0 else jsMax(0.0, catLabels.map { chartApproxWidth(it, theme.labelSize) })
    val maxDataLabelW = if (spec.showLabels) jsMax(0.0, spec.series.flatMap { sr ->
        sr.range?.flatMap { d -> if (d != null) listOf(chartApproxWidth(spec.valueFormatter(d.first), theme.labelSize), chartApproxWidth(spec.valueFormatter(d.second), theme.labelSize)) else emptyList() }
            ?: sr.data.map { v -> if (v is ChartCell.Num) chartApproxWidth(spec.valueFormatter(v.v), theme.labelSize) else 0.0 }
    }) else 0.0
    val axisTitleV = if (!spec.valueLabel.isNullOrEmpty()) theme.labelSize + 6 else 0.0
    val axisTitleC = if (!spec.categoryLabel.isNullOrEmpty()) theme.labelSize + 6 else 0.0
    val labelRowH = theme.labelSize + 8
    val catRot = if (!horizontal) (spec.categoryLabelRotation ?: 0.0) else 0.0
    val catRotRad = (abs(catRot) * Math.PI) / 180
    val catLabelRowH = if (catRot != 0.0) maxCatLabelW * sin(catRotRad) + theme.labelSize * cos(catRotRad) + 8 else labelRowH
    val legendActive = !spec.legend.isNullOrEmpty() && spec.legend != "none" && spec.series.size > 1
    val legendSide = legendActive && (spec.legend == "left" || spec.legend == "right")
    val legendAtBottom = legendActive && !legendSide && spec.legend!!.startsWith("bottom")
    val legendTopRow = legendActive && !legendSide && !legendAtBottom
    val legendRows = if (legendTopRow || legendAtBottom) chartEstimateLegendRows(spec.series.map { it.label }, theme.labelSize, width * 0.86) else 1
    val legendBandH = if (spec.legendExtent != null && (legendTopRow || legendAtBottom)) spec.legendExtent!! + 8 else legendRows * (theme.labelSize + 8) + 6
    val legendBandTop = if (legendTopRow) legendBandH else 0.0
    val legendBandBottom = if (legendAtBottom) legendBandH else 0.0
    val legendSideW = if (legendSide) (if (spec.legendExtent != null) spec.legendExtent!! + 16 else jsMax(0.0, spec.series.map { chartApproxWidth(it.label, theme.labelSize) }) + 34) else 0.0
    val legendLeftW = if (spec.legend == "left") legendSideW else 0.0
    val legendRightW = if (spec.legend == "right") legendSideW else 0.0
    val labelsAtLowEnd = (spec.showLabels || spec.showTotals == true) && spec.series.any { sr -> !sr.hidden && (sr.range != null || sr.data.any { it is ChartCell.Num && it.v < 0 }) }
    val mirrorCats = spec.categoryLabelsMirrored == true && horizontal && spec.categoryHidden != true && spec.categoryHideTicks != true
    val compact = spec.compact == true
    val lowEndRoom = if (labelsAtLowEnd) (if (horizontal) maxDataLabelW + 8 else theme.labelSize + 4) else 0.0
    var padTop: Double; var padRight: Double; var padBottom: Double; var padLeft: Double
    if (compact) { padTop = 2.0; padRight = 2.0; padBottom = 2.0; padLeft = 2.0 }
    else if (horizontal) {
        padTop = titleH + 8 + legendBandTop
        padLeft = maxCatLabelW + 12 + axisTitleC + legendLeftW + (if (labelsAtLowEnd) maxDataLabelW + 8 else 0.0)
        padBottom = (if (spec.valueHidden == true || spec.valueHideTicks == true) 0.0 else labelRowH) + axisTitleV + 6 + legendBandBottom
        padRight = 12 + (if (spec.showLabels) maxDataLabelW + 8 else 0.0) + legendRightW + (if (mirrorCats) maxCatLabelW + 12 else 0.0)
        val tickOverhang = if (spec.valueHidden == true || spec.valueHideTicks == true) 0.0 else jsMax(0.0, vTickLabels.map(measureLabel)) / 2 + 4
        padLeft = max(padLeft, legendLeftW + tickOverhang)
        padRight = max(padRight, legendRightW + tickOverhang)
    } else {
        padTop = titleH + 8 + legendBandTop + (if (spec.showLabels) theme.labelSize + 4 else 0.0)
        padRight = 12 + legendRightW + (if (spec.showLabels) maxDataLabelW / 2 else 0.0) + (if (hasAxis2) maxV2LabelW + 10 + (if (!spec.valueAxis2!!.label.isNullOrEmpty()) theme.labelSize + 6 else 0.0) else 0.0)
        padLeft = maxVLabelW + 10 + axisTitleV + legendLeftW
        padBottom = (if (spec.categoryHidden == true || spec.categoryHideTicks == true) 0.0 else catLabelRowH) + axisTitleC + 6 + legendBandBottom + (if (labelsAtLowEnd) theme.labelSize + 4 else 0.0)
    }
    val plot = ChartRect(padLeft, padTop, max(1.0, width - padLeft - padRight), max(1.0, height - padTop - padBottom))

    val crossLen = if (horizontal) plot.width else plot.height
    val vScale = makeBrokenScale(vDomain, crossLen, spec.valueScale, vBreakRanges, vFound.second)
    val baselineVal = min(vDomain.hi, max(vDomain.lo, 0.0))
    val vScale2 = if (hasAxis2) makeBrokenScale(vDomain2, crossLen, spec.valueScale, emptyList(), vFound.second) else vScale
    fun valPx(v: Double) = if (horizontal) plot.x + vScale.scale(v) else plot.y + plot.height - vScale.scale(v)
    fun valPx2(v: Double) = if (horizontal) plot.x + vScale2.scale(v) else plot.y + plot.height - vScale2.scale(v)
    fun valPxFor(si: Int, v: Double) = if (hasAxis2 && onAxis2(si)) valPx2(v) else valPx(v)
    val basePx = valPx(baselineVal)
    val valueTicks = if (horizontal && spec.valueHideTicks != true && spec.valueHidden != true) visibleValueTicks(vTickVals, vTickLabels, ::valPx, measureLabel) else vTickVals.indices.toList()
    val breakStrips = vScale.breaks.map { b -> if (horizontal) (plot.x + b.px) to (plot.x + b.px + b.gap) else (plot.y + plot.height - b.px - b.gap) to (plot.y + plot.height - b.px) }
    fun splitBar(bar: ChartSceneBar): List<ChartSceneBar> {
        if (breakStrips.isEmpty()) return listOf(bar)
        val lo = if (horizontal) bar.x else bar.y
        val hi = lo + (if (horizontal) bar.w else bar.h)
        var pieces = listOf(lo to hi)
        for ((sLo, sHi) in breakStrips) {
            val next = mutableListOf<Pair<Double, Double>>()
            for (p in pieces) {
                if (sHi <= p.first || sLo >= p.second) { next.add(p); continue }
                if (sLo > p.first) next.add(p.first to sLo)
                if (sHi < p.second) next.add(sHi to p.second)
            }
            pieces = next
        }
        if (pieces.size == 1 && pieces[0].first == lo && pieces[0].second == hi) return listOf(bar)
        val kept = pieces.filter { it.second - it.first > 0.5 }
        return kept.mapIndexed { idx, p ->
            val radius = if (idx == (if (horizontal) kept.size - 1 else 0)) bar.radius else listOf(0.0, 0.0, 0.0, 0.0)
            if (horizontal) bar.copy(radius = radius, x = p.first, w = p.second - p.first) else bar.copy(radius = radius, y = p.first, h = p.second - p.first)
        }
    }
    // computeBandGeometry
    val mainStart = if (horizontal) plot.y else plot.x
    val mainLen = if (horizontal) plot.height else plot.width
    val widthWeights = spec.series.firstOrNull { !it.hidden && it.pointWidths != null }?.pointWidths
    fun weightAt(i: Int): Double { val w = widthWeights?.get(i); return if (w != null && w.isFinite() && w > 0) w else 1.0 }
    var weightSum = 0.0
    val bandStarts = DoubleArray(C)
    for (i in 0 until C) { bandStarts[i] = weightSum; weightSum += weightAt(i) }
    if (weightSum <= 0) weightSum = max(1, C).toDouble()
    fun sizeAt(i: Int) = if (C > 0) (mainLen * weightAt(i)) / weightSum else mainLen
    fun startAt(i: Int) = mainStart + (mainLen * bandStarts[i]) / weightSum
    fun bandCenter(i: Int) = startAt(i) + sizeAt(i) / 2
    fun groupInnerAt(i: Int) = sizeAt(i) * (1 - spec.categoryGapRatio)
    val visibleIdx = spec.series.indices.filter { !spec.series[it].hidden && spec.series[it].overlay != true }
    val groupNames = mutableListOf<String>()
    for (i in visibleIdx) if (stackKeys[i] !in groupNames) groupNames.add(stackKeys[i])
    val groupCount = if (stacked) max(1, groupNames.size) else max(1, visibleIdx.size)
    fun barWAt(i: Int) = groupInnerAt(i) / (groupCount + (groupCount - 1) * spec.barGapRatio)
    val topSeriesFor = HashMap<String, Int>(); val botSeriesFor = HashMap<String, Int>()
    if (stacked) for (r in 0 until C) {
        val topV = HashMap<String, Double>(); val botV = HashMap<String, Double>()
        spec.series.forEachIndexed { si, s ->
            if (s.hidden) return@forEachIndexed
            val b = bands[si].getOrNull(r)?.band ?: return@forEachIndexed
            val k = "${stackKeys[si]}|$r"
            if (b.hi > (topV[k] ?: Double.NEGATIVE_INFINITY)) { topV[k] = b.hi; topSeriesFor[k] = si }
            if (b.lo < (botV[k] ?: Double.POSITIVE_INFINITY)) { botV[k] = b.lo; botSeriesFor[k] = si }
        }
    }
    val bars = mutableListOf<ChartSceneBar>(); val hoverPoints = mutableListOf<ChartHoverSeries>(); val texts = mutableListOf<ChartTextItem>(); val barLabels = mutableListOf<ChartBarLabel>()
    val r = spec.cornerRadius
    spec.series.forEachIndexed { si, s ->
        if (s.hidden) return@forEachIndexed
        val groupPos = if (stacked) max(0, groupNames.indexOf(stackKeys[si])) else max(0, visibleIdx.indexOf(si))
        val byIndex = LinkedHashMap<Int, ChartHoverPoint>()
        for (i in 0 until C) {
            val band = bands[si].getOrNull(i)?.band ?: continue
            val isRange = s.range != null
            val raw = if (isRange) null else s.data.getOrNull(i)
            val rawNum = (raw as? ChartCell.Num)?.v ?: band.hi
            val p0 = valPxFor(si, band.lo); val p1 = valPxFor(si, band.hi)
            val autoW = if (s.overlay == true) sizeAt(i) * (s.widthRatio ?: 0.45) else barWAt(i)
            val barGap = autoW * spec.barGapRatio
            val barW = if (spec.barWidth != null && s.overlay != true) min(max(1.0, spec.barWidth), autoW) else autoW
            val slotStart = if (s.overlay == true) bandCenter(i) - autoW / 2 else bandCenter(i) - groupInnerAt(i) / 2 + groupPos * (autoW + barGap)
            val barStart = slotStart + (autoW - barW) / 2
            val positive = rawNum >= 0
            val stackCell = "${stackKeys[si]}|$i"
            val atBaseline = if (positive) band.lo == 0.0 else band.hi == 0.0
            val isTop = isRange || !stacked || (if (positive) topSeriesFor[stackCell] == si else botSeriesFor[stackCell] == si)
            val chev = spec.chevron == true
            val chevInset = if (chev) minOf(barW * 0.03, 5.0, abs(p1 - p0) * 0.35) else 0.0
            val chevLead = if (chev) chartChevronTipDepth(barW) - chevInset / 2 else 0.0
            val color = s.pointColors?.get(i) ?: s.color
            val bar: ChartSceneBar
            if (horizontal) {
                val radius = if (isRange) listOf(r, r, r, r) else if (isTop) (if (positive) listOf(0.0, r, r, 0.0) else listOf(r, 0.0, 0.0, r)) else listOf(0.0, 0.0, 0.0, 0.0)
                bar = ChartSceneBar(min(p0, p1) + chevInset / 2, barStart, abs(p1 - p0) - chevInset, barW, color, radius, si, i, true, if (chev) (if (positive) 1 else -1) else null, if (chev) !atBaseline else null)
                byIndex[i] = ChartHoverPoint(if (positive) max(p0, p1) + chevLead else min(p0, p1) - chevLead, barStart + barW / 2, rawNum, if (isRange) band.lo else null, if (isRange) band.hi else null, color = color)
            } else {
                val radius = if (isRange) listOf(r, r, r, r) else if (isTop) (if (positive) listOf(r, r, 0.0, 0.0) else listOf(0.0, 0.0, r, r)) else listOf(0.0, 0.0, 0.0, 0.0)
                bar = ChartSceneBar(barStart, min(p0, p1) + chevInset / 2, barW, abs(p1 - p0) - chevInset, color, radius, si, i, false, if (chev) (if (positive) 1 else -1) else null, if (chev) !atBaseline else null)
                byIndex[i] = ChartHoverPoint(barStart + barW / 2, if (positive) min(p0, p1) - chevLead else max(p0, p1) + chevLead, rawNum, if (isRange) band.lo else null, if (isRange) band.hi else null, color = color)
            }
            bars.addAll(splitBar(bar))
            if (spec.showLabels && isRange) {
                barLabels.add(ChartBarLabel(si, i, spec.valueFormatter(band.lo), theme.textColor, theme.labelSize, atLowEnd = true))
                barLabels.add(ChartBarLabel(si, i, spec.valueFormatter(band.hi), theme.textColor, theme.labelSize, atLowEnd = false))
            } else if (spec.showLabels && stacked && raw is ChartCell.Num) {
                val shown = if (spec.stack == "percentage") abs(band.hi - band.lo) * (if (raw.v < 0) -1 else 1) else raw.v
                val txt = spec.valueFormatter(shown)
                val fits = if (horizontal) bar.w > chartApproxWidth(txt, theme.labelSize) + 8 && bar.h > theme.labelSize else bar.h > theme.labelSize + 6 && bar.w > chartApproxWidth(txt, theme.labelSize) + 4
                if (fits) barLabels.add(ChartBarLabel(si, i, txt, chartOnColor(bar.color), theme.labelSize, 600.0, inside = true))
            } else if (spec.showLabels && raw is ChartCell.Num) {
                barLabels.add(ChartBarLabel(si, i, spec.valueFormatter(raw.v), theme.textColor, theme.labelSize, atLowEnd = !positive))
            }
        }
        hoverPoints.add(ChartHoverSeries(si, s.color, s.label, null, byIndex, if (s.range != null) bands[si].map { b -> b.band?.let { ChartCell.Num(it.hi) } ?: ChartCell.Null } else s.data))
    }
    if (spec.showTotals == true && stacked && spec.stack != "percentage") {
        for (i in 0 until C) for (g in groupNames) {
            var top = Double.NEGATIVE_INFINITY; var bottom = Double.POSITIVE_INFINITY; var sum = 0.0; var any = false
            spec.series.forEachIndexed { si, s ->
                if (s.hidden || stackKeys[si] != g) return@forEachIndexed
                val b = bands[si].getOrNull(i)?.band ?: return@forEachIndexed
                any = true; top = max(top, b.hi); bottom = min(bottom, b.lo)
                (s.data.getOrNull(i) as? ChartCell.Num)?.let { sum += it.v }
            }
            if (!any) continue
            val txt = spec.valueFormatter(sum)
            val positive = top > 0 || bottom >= 0
            val outerSeg = (if (positive) topSeriesFor["$g|$i"] else botSeriesFor["$g|$i"]) ?: continue
            barLabels.add(ChartBarLabel(outerSeg, i, txt, theme.textColor, theme.labelSize, 600.0, atLowEnd = !positive))
        }
    }
    val gridlines = mutableListOf<ChartSegment>(); val axisLines = mutableListOf<ChartSegment>()
    val TICK = 5.0
    val yb = plot.y + plot.height
    val valueDash = chartDashPattern(spec.valueDash); val gridDash = chartDashPattern(spec.valueGridDash); val categoryDash = chartDashPattern(spec.categoryDash)
    if (spec.valueHidden != true && !compact) for (index in valueTicks) {
        val pv = valPx(vTickVals[index])
        if (horizontal) {
            gridlines.add(ChartSegment(pv, plot.y, pv, yb, theme.gridLineColor, 1.0, gridDash))
            if (spec.axisTicks == true) axisLines.add(ChartSegment(pv, yb, pv, yb + TICK, theme.axisLineColor, 1.0, valueDash))
        } else {
            gridlines.add(ChartSegment(plot.x, pv, plot.x + plot.width, pv, theme.gridLineColor, 1.0, gridDash))
            if (spec.axisTicks == true) axisLines.add(ChartSegment(plot.x - TICK, pv, plot.x, pv, theme.axisLineColor, 1.0, valueDash))
        }
    }
    if (!compact) {
        if (spec.categoryAxisLine != false) axisLines.add(if (horizontal) ChartSegment(plot.x, plot.y, plot.x, plot.y + plot.height, theme.axisLineColor, 1.0, categoryDash) else ChartSegment(plot.x, plot.y + plot.height, plot.x + plot.width, plot.y + plot.height, theme.axisLineColor, 1.0, categoryDash))
        if (spec.valueAxisLine != false) {
            if (horizontal) {
                val cuts = vScale.breaks.map { it.px to it.gap }
                axisLines += chartAxisLineWithBreaks("x", plot.x, plot.x + plot.width, plot.y + plot.height, cuts, theme.axisLineColor, valueDash)
                for ((px, gap) in cuts) axisLines += chartBreakBandSegments("x", plot.x + px, plot.x + px + gap, plot.y, plot.y + plot.height, theme.axisLineColor)
            } else {
                val cuts = vScale.breaks.map { (plot.height - it.px - it.gap) to it.gap }
                axisLines += chartAxisLineWithBreaks("y", plot.y, plot.y + plot.height, plot.x, cuts, theme.axisLineColor, valueDash)
                for ((px, gap) in cuts) axisLines += chartBreakBandSegments("y", plot.y + px, plot.y + px + gap, plot.x, plot.x + plot.width, theme.axisLineColor)
            }
        }
    }
    if (!spec.title.isNullOrEmpty() && !compact) {
        val (tx, ta) = chartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.add(ChartTextItem(tx, legendBandTop + 6, spec.title, theme.textColor, theme.titleSize, 600.0, ta, "top", null, "title"))
        if (!spec.subtitle.isNullOrEmpty()) texts.add(ChartTextItem(tx, legendBandTop + 6 + theme.titleSize + 4, spec.subtitle, theme.textColorMuted, theme.labelSize, null, ta, "top", null, "subtitle"))
    }
    if (hasAxis2 && spec.valueAxis2!!.hidden != true && !compact && !horizontal) {
        val rx = plot.x + plot.width
        axisLines.add(ChartSegment(rx, plot.y, rx, plot.y + plot.height, theme.axisLineColor, 1.0, valueDash))
        v2TickVals.forEachIndexed { i, t ->
            val pv = valPx2(t)
            if (spec.axisTicks == true) axisLines.add(ChartSegment(rx, pv, rx + TICK, pv, theme.axisLineColor, 1.0, valueDash))
            texts.add(ChartTextItem(rx + 8, pv, v2TickLabels[i], theme.textColorMuted, theme.labelSize, null, "start", "middle", null, "v2t-$i"))
        }
        if (!spec.valueAxis2.label.isNullOrEmpty()) texts.add(ChartTextItem(width - 4, plot.y + plot.height / 2, spec.valueAxis2.label, theme.textColor, theme.labelSize, null, "center", "bottom", -90.0, "val2-axis-title"))
    }
    if (spec.valueHidden != true && spec.valueHideTicks != true && !compact) for (i in valueTicks) {
        val pv = valPx(vTickVals[i])
        texts.add(if (horizontal) ChartTextItem(pv, plot.y + plot.height + 6, vTickLabels[i], theme.textColorMuted, theme.labelSize, null, "center", "top", null, "vt-$i")
        else ChartTextItem(plot.x - 8, pv, vTickLabels[i], theme.textColorMuted, theme.labelSize, null, "end", "middle", null, "vt-$i"))
    }
    val mainPositions = mutableListOf<Double>()
    val minSpacing = if (horizontal) theme.labelSize + 6 else 48.0
    val step = max(1, ceil(C.toDouble() / max(1, floor(mainLen / minSpacing).toInt())).toInt())
    for (i in 0 until C) {
        val bc = bandCenter(i)
        mainPositions.add(bc)
        val atTick = i % step == 0
        if (spec.axisTicks == true && !compact && atTick && spec.categoryHidden != true)
            axisLines.add(if (horizontal) ChartSegment(plot.x - TICK, bc, plot.x, bc, theme.axisLineColor, 1.0) else ChartSegment(bc, yb, bc, yb + TICK, theme.axisLineColor, 1.0))
        if (spec.categoryHidden == true || spec.categoryHideTicks == true || compact || !atTick) continue
        if (horizontal) {
            texts.add(ChartTextItem(plot.x - 8 - lowEndRoom, bc, catLabels[i], theme.textColorMuted, theme.labelSize, null, "end", "middle", null, "ct-$i"))
            if (mirrorCats) texts.add(ChartTextItem(plot.x + plot.width + 8 + (if (spec.showLabels) maxDataLabelW + 4 else 0.0), bc, catLabels[i], theme.textColorMuted, theme.labelSize, null, "start", "middle", null, "ctm-$i"))
        } else if (catRot != 0.0) {
            val w = chartApproxWidth(catLabels[i], theme.labelSize)
            val dir = if (catRot < 0) -1 else 1
            texts.add(ChartTextItem(bc + (dir * w * cos(catRotRad)) / 2, plot.y + plot.height + 6 + lowEndRoom + (w * sin(catRotRad)) / 2, catLabels[i], theme.textColorMuted, theme.labelSize, null, "center", "middle", catRot, "ct-$i"))
        } else {
            val nextC = if (i + step < C) bandCenter(i + step) else bc + step * sizeAt(i)
            val prevC = if (i - step >= 0) bandCenter(i - step) else bc - step * sizeAt(i)
            val room = min(nextC - bc, bc - prevC) - 6
            texts.add(ChartTextItem(bc, plot.y + plot.height + 6 + lowEndRoom, ellipsize(catLabels[i], room, theme.labelSize), theme.textColorMuted, theme.labelSize, null, "center", "top", null, "ct-$i"))
        }
    }
    if (!compact) {
        val catTitle = spec.categoryLabel; val valTitle = spec.valueLabel
        if (horizontal) {
            if (!catTitle.isNullOrEmpty()) texts.add(ChartTextItem(4.0, plot.y + plot.height / 2, catTitle, theme.textColor, theme.labelSize, null, "center", "top", -90.0, "cat-axis-title"))
            if (!valTitle.isNullOrEmpty()) texts.add(ChartTextItem(plot.x + plot.width / 2, height - 2 - legendBandBottom, valTitle, theme.textColor, theme.labelSize, null, "center", "bottom", null, "val-axis-title"))
        } else {
            if (!valTitle.isNullOrEmpty()) texts.add(ChartTextItem(4.0, plot.y + plot.height / 2, valTitle, theme.textColor, theme.labelSize, null, "center", "top", -90.0, "val-axis-title"))
            if (!catTitle.isNullOrEmpty()) texts.add(ChartTextItem(plot.x + plot.width / 2, height - 2 - legendBandBottom, catTitle, theme.textColor, theme.labelSize, null, "center", "bottom", null, "cat-axis-title"))
        }
    }
    val legend = if (spec.legend == "none" || compact) emptyList() else spec.series.mapIndexed { si, s -> ChartLegendItem(s.label, s.color, si, s.hidden, 0.0, 0.0) }
    return ChartScene(basePx, width, height, plot, if (theme.background == "transparent") null else theme.background, null, gridlines, axisLines, emptyList(), bars, emptyList(), emptyList(), emptyList(),
        null, null, texts, barLabels, legend, spec.legend, xPositions = mainPositions, xValues = spec.categories, xLabels = catLabels, hoverPoints = hoverPoints)
}

private fun radialScene(spec: ChartBarSpec, theme: ChartEngineTheme, width: Double, height: Double, bands: List<List<ChartBandCell>>, vDomain: ChartDomain, catLabels: List<String>, C: Int, stacked: Boolean, stackKeys: List<String>): ChartScene {
    val texts = mutableListOf<ChartTextItem>()
    val subtitleH = if (!spec.subtitle.isNullOrEmpty()) theme.labelSize + 4 else 0.0
    val titleH = if (!spec.title.isNullOrEmpty()) theme.titleSize + 10 + subtitleH else 0.0
    val legendActive = !spec.legend.isNullOrEmpty() && spec.legend != "none" && spec.series.size > 1
    val legendAtBottom = legendActive && spec.legend!!.startsWith("bottom")
    val legendTopRow = legendActive && !legendAtBottom && !(spec.legend == "left" || spec.legend == "right")
    val legendRows = if (legendActive) chartEstimateLegendRows(spec.series.map { it.label }, theme.labelSize, width * 0.86) else 1
    val legendBandH = if (spec.legendExtent != null && (legendTopRow || legendAtBottom)) spec.legendExtent!! + 8 else legendRows * (theme.labelSize + 8) + 6
    val legendBandTop = if (legendTopRow) legendBandH else 0.0
    val legendBandBottom = if (legendAtBottom) legendBandH else 0.0
    val nameGutter = if (spec.categoryHidden == true || spec.categoryHideTicks == true) 0.0 else jsMax(0.0, catLabels.map { chartApproxWidth(it, theme.labelSize) }) + 12
    val plot = ChartRect(nameGutter, titleH + legendBandTop, max(1.0, width - nameGutter), max(1.0, height - titleH - legendBandTop - legendBandBottom))
    val cx = plot.x + plot.width / 2; val cy = plot.y + plot.height / 2
    val vFmt = spec.valueTickFormatter ?: spec.valueFormatter
    val vTicks = if (spec.valueHidden == true || spec.valueHideTicks == true) emptyList() else sectionedTicks(vDomain, emptyList(), spec.valueScale, 8).filter { it >= vDomain.lo - 1e-9 && it <= vDomain.hi + 1e-9 }
    val vTickMaxW = jsMax(0.0, vTicks.map { chartApproxWidth(vFmt(it), theme.labelSize) })
    val valueGutter = if (vTicks.isNotEmpty()) vTickMaxW + 18 else 0.0
    val R = max(8.0, min(plot.width, plot.height) / 2 - 8 - valueGutter)
    val hole = R * max(0.0, min(0.9, spec.polarHole ?: 0.22))
    val ring = if (C > 0) (R - hole) / C else R - hole
    val thickness = max(1.0, ring * (1 - spec.categoryGapRatio))
    val visibleIdx = spec.series.indices.filter { !spec.series[it].hidden && spec.series[it].overlay != true }
    val groupNames = mutableListOf<String>(); for (i in visibleIdx) if (stackKeys[i] !in groupNames) groupNames.add(stackKeys[i])
    val slotCount = if (stacked) max(1, groupNames.size) else max(1, visibleIdx.size)
    val subThickness = thickness / (slotCount + (slotCount - 1) * spec.barGapRatio)
    fun slotOf(si: Int) = if (spec.series[si].overlay == true) -1 else if (stacked) max(0, groupNames.indexOf(stackKeys[si])) else max(0, visibleIdx.indexOf(si))
    val START = -Math.PI / 2
    val sweep = 2 * Math.PI * max(0.1, min(1.0, spec.polarSweep ?: 0.75))
    val lo = vDomain.lo; val hi = vDomain.hi
    val span = (hi - lo).let { if (it == 0.0 || it.isNaN()) 1.0 else it }
    fun angleOf(v: Double) = START + ((v - lo) / span) * sweep
    val slices = mutableListOf<ChartSceneSlice>(); val hoverPoints = mutableListOf<ChartHoverSeries>()
    val midRadii = (0 until C).map { R - it * ring - thickness / 2 }
    spec.series.forEachIndexed { si, s ->
        if (s.hidden) return@forEachIndexed
        val byIndex = LinkedHashMap<Int, ChartHoverPoint>()
        for (i in 0 until C) {
            val band = bands[si].getOrNull(i)?.band ?: continue
            val slot = slotOf(si)
            val outerR = R - i * ring - (if (slot < 0) 0.0 else slot * subThickness * (1 + spec.barGapRatio))
            val innerR = outerR - (if (slot < 0) thickness else subThickness)
            val a0 = angleOf(band.lo); val a1 = angleOf(band.hi)
            if (abs(a1 - a0) < 1e-6) continue
            slices.add(ChartSceneSlice(cx, cy, innerR, outerR, min(a0, a1), max(a0, a1), s.pointColors?.get(i) ?: s.color, i, si, pill = true, capStart = false, capEnd = false))
            val mid = (a0 + a1) / 2; val midR = (innerR + outerR) / 2
            byIndex[i] = ChartHoverPoint(cx + midR * cos(mid), cy + midR * sin(mid), (s.data.getOrNull(i) as? ChartCell.Num)?.v ?: band.hi)
        }
        hoverPoints.add(ChartHoverSeries(si, s.color, s.label, null, byIndex, s.data))
    }
    val ringKeys = LinkedHashSet(slices.map { "${it.dataIndex}|${slotOf(it.seriesIndex ?: 0)}" })
    for (key in ringKeys) {
        val ringIdx = slices.indices.filter { "${slices[it].dataIndex}|${slotOf(slices[it].seriesIndex ?: 0)}" == key }
        if (ringIdx.isEmpty()) continue
        var first = ringIdx[0]; var last = ringIdx[0]
        for (k in ringIdx) { if (slices[k].startAngle < slices[first].startAngle) first = k; if (slices[k].endAngle > slices[last].endAngle) last = k }
        slices[first] = slices[first].copy(capStart = true)
        slices[last] = slices[last].copy(capEnd = true)
    }
    val labelR = R + 16
    for (t in vTicks) {
        val a = angleOf(t); val c = cos(a); val s = sin(a)
        texts.add(ChartTextItem(cx + labelR * c, cy + labelR * s, vFmt(t), theme.textColorMuted, theme.labelSize, null, if (c > 0.35) "start" else if (c < -0.35) "end" else "center", if (s > 0.35) "top" else if (s < -0.35) "bottom" else "middle", null, "vt-${jsNumberString(t)}"))
    }
    if (spec.categoryHidden != true && spec.categoryHideTicks != true) for (i in 0 until C)
        texts.add(ChartTextItem(cx - thickness / 2 - 12, cy - midRadii[i], catLabels[i], theme.textColorMuted, theme.labelSize, null, "end", "middle", null, "ct-$i"))
    if (!spec.title.isNullOrEmpty()) {
        val (tx, ta) = chartTitlePlacement(spec.titleAlign, plot.x, plot.width)
        texts.add(ChartTextItem(tx, legendBandTop + 6, spec.title, theme.textColor, theme.titleSize, 600.0, ta, "top", null, "title"))
        if (!spec.subtitle.isNullOrEmpty()) texts.add(ChartTextItem(tx, legendBandTop + 6 + theme.titleSize + 6, spec.subtitle, theme.textColorMuted, theme.labelSize, null, ta, "top", null, "subtitle"))
    }
    val legend = if (spec.legend == "none") emptyList() else spec.series.mapIndexed { si, s -> ChartLegendItem(s.label, s.color, si, s.hidden, 0.0, 0.0) }
    return ChartScene(null, width, height, plot, if (theme.background == "transparent") null else theme.background, null, emptyList(), emptyList(), emptyList(), emptyList(), slices, emptyList(), emptyList(),
        null, null, texts, null, legend, spec.legend, polar = true, xPositions = midRadii, xValues = spec.categories, xLabels = catLabels, hoverPoints = hoverPoints)
}
