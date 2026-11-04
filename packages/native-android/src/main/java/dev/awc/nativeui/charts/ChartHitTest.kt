package dev.awc.nativeui.charts

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

// Port of engine/hit-test.ts.

const val CHART_MARK_HIT_RADIUS = 26.0
const val CHART_LINE_HIT_TOLERANCE = 8.0

sealed class ChartHit {
    data class Mark(val series: Int, val index: Int) : ChartHit()
    data class Line(val series: Int, val index: Int) : ChartHit()
    data class Area(val series: Int, val index: Int) : ChartHit()
    data class Axis(val index: Int) : ChartHit()
}

fun chartNearestIndex(positions: List<Double>, px: Double): Int {
    if (positions.isEmpty()) return -1
    var best = 0; var bestD = Double.POSITIVE_INFINITY
    positions.forEachIndexed { i, p -> val d = abs(p - px); if (d < bestD) { bestD = d; best = i } }
    return best
}

fun chartSeriesSampleLines(scene: ChartScene): List<List<Pair<Double, Double>>> {
    val inverted = scene.inverted == true
    return scene.hoverPoints.map { hp ->
        val pts = hp.byIndex.keys.sorted().map { k -> val p = hp.byIndex.getValue(k); if (inverted) p.y to p.x else p.x to p.y }
        if (pts.size >= 2 && pts[0].first > pts.last().first) pts.reversed() else pts
    }
}

data class ChartAxisSeriesValue(val seriesIndex: Int, val label: String, val value: Double?)
fun chartAxisSeriesValues(scene: ChartScene, index: Int) = scene.hoverPoints.map { ChartAxisSeriesValue(it.seriesIndex, it.label, it.byIndex[index]?.value) }

fun chartInsidePlot(plot: ChartRect, px: Double, py: Double) = px >= plot.x && px <= plot.x + plot.width && py >= plot.y && py <= plot.y + plot.height

private fun polylineY(input: List<ChartPt>, x: Double): Double? {
    val n = input.size
    if (n == 0) return null
    val points = if (n > 1 && input[0].x > input[n - 1].x) input.reversed() else input
    if (x < points[0].x || x > points[n - 1].x) return null
    if (n == 1) return points[0].y
    var lo = 0; var hi = n - 1
    while (hi - lo > 1) { val mid = (lo + hi) shr 1; if (points[mid].x <= x) lo = mid else hi = mid }
    val a = points[lo]; val b = points[hi]
    return if (b.x == a.x) a.y else a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
}

private fun areaContains(area: ChartSceneArea, px: Double, py: Double): Boolean {
    val top = polylineY(area.points, px) ?: return false
    val base = area.basePoints?.let { polylineY(it, px) } ?: area.baselineY
    return py >= min(top, base) && py <= max(top, base)
}

fun chartAreaSeriesAt(scene: ChartScene, px: Double, py: Double): Int {
    if (!chartInsidePlot(scene.plot, px, py)) return -1
    var best = -1; var bestD = Double.POSITIVE_INFINITY
    for (a in scene.areas) {
        val si = a.seriesIndex ?: continue
        if (!areaContains(a, px, py)) continue
        val d = polylineY(a.points, px)?.let { abs(py - it) } ?: Double.POSITIVE_INFINITY
        if (d < bestD) { bestD = d; best = si }
    }
    return best
}

fun chartHitTestScene(scene: ChartScene, px: Double, py: Double, lines: List<List<Pair<Double, Double>>> = chartSeriesSampleLines(scene)): ChartHit? {
    val inverted = scene.inverted == true
    val cursorMain = if (inverted) py else px; val cursorValue = if (inverted) px else py
    val dataIndex = chartNearestIndex(scene.xPositions, cursorMain)
    if (dataIndex < 0) return null
    var markSeries = -1; var markD = Double.POSITIVE_INFINITY
    for (hp in scene.hoverPoints) { val p = hp.byIndex[dataIndex] ?: continue; val d = hypot(p.x - px, p.y - py); if (d < markD) { markD = d; markSeries = hp.seriesIndex } }
    if (markSeries >= 0 && markD <= CHART_MARK_HIT_RADIUS) return ChartHit.Mark(markSeries, dataIndex)
    if (!chartInsidePlot(scene.plot, px, py)) return null
    var lineSeries = -1; var lineD = Double.POSITIVE_INFINITY
    scene.hoverPoints.forEachIndexed { i, hp -> val d = chartDistanceToLine(lines.getOrElse(i) { emptyList() }, cursorMain, cursorValue); if (d < lineD) { lineD = d; lineSeries = hp.seriesIndex } }
    if (lineSeries >= 0 && lineD <= CHART_LINE_HIT_TOLERANCE) return ChartHit.Line(lineSeries, dataIndex)
    var areaSeries = -1; var areaD = Double.POSITIVE_INFINITY
    for (a in scene.areas) {
        val si = a.seriesIndex ?: continue
        if (!areaContains(a, px, py)) continue
        val d = abs(py - (polylineY(a.points, px) ?: Double.NaN))
        if (d < areaD) { areaD = d; areaSeries = si }
    }
    if (areaSeries >= 0) return ChartHit.Area(areaSeries, dataIndex)
    return ChartHit.Axis(dataIndex)
}
