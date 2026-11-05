package dev.awc.nativeui.charts

import kotlin.math.abs
import kotlin.math.min

// emphasis.ts

const val CHART_EMPHASIS_MS = 260.0
const val CHART_FOCUS_STICK = 4.0
const val CHART_FOCUS_DWELL_MS = 140.0

fun chartEmphasizeScene(scene: ChartScene, focusIndex: Int, t: Double): ChartScene {
    if (focusIndex < 0 || t <= 0) return scene
    val factor = 1 - (1 - 0.22) * min(1.0, t)
    fun dim(si: Int?) = si != null && si != focusIndex
    return scene.copy(
        lines = scene.lines.map { if (dim(it.seriesIndex)) it.copy(color = chartWithAlpha(it.color, factor)) else it },
        areas = scene.areas.map { if (dim(it.seriesIndex)) it.copy(colorTop = chartWithAlpha(it.colorTop, factor), colorBottom = chartWithAlpha(it.colorBottom, factor)) else it },
        markers = scene.markers.map { if (dim(it.seriesIndex)) it.copy(color = chartWithAlpha(it.color, factor)) else it },
    )
}

fun chartDistanceToLine(points: List<Pair<Double, Double>>, cursorMain: Double, cursorValue: Double): Double {
    val n = points.size
    if (n == 0) return Double.POSITIVE_INFINITY
    val first = points[0]; val last = points[n - 1]
    if (cursorMain <= first.first) return kotlin.math.hypot(first.first - cursorMain, first.second - cursorValue)
    if (cursorMain >= last.first) return kotlin.math.hypot(last.first - cursorMain, last.second - cursorValue)
    var lo = 0; var hi = n - 1
    while (hi - lo > 1) { val mid = (lo + hi) shr 1; if (points[mid].first <= cursorMain) lo = mid else hi = mid }
    val a = points[lo]; val b = points[hi]
    val t = if (b.first == a.first) 0.0 else (cursorMain - a.first) / (b.first - a.first)
    return abs(a.second + (b.second - a.second) * t - cursorValue)
}

fun chartPickFocusSeries(candidates: List<Pair<Int, Double>>, held: Int, stick: Double = CHART_FOCUS_STICK): Int {
    var best = -1; var bestD = Double.POSITIVE_INFINITY; var heldD = Double.POSITIVE_INFINITY
    for ((si, d) in candidates) { if (si == held) heldD = d; if (d < bestD) { bestD = d; best = si } }
    return if (held >= 0 && bestD > heldD - stick) held else best
}

class ChartHoverFocus {
    private var held = -1; private var candidate = -1; private var since = 0.0
    fun pick(candidates: List<Pair<Int, Double>>, now: Double): Int {
        val wanted = chartPickFocusSeries(candidates, held)
        if (wanted != candidate) { candidate = wanted; since = now }
        if (held < 0) held = wanted else if (wanted != held && now - since >= CHART_FOCUS_DWELL_MS) held = wanted
        return held
    }
    fun reset() { held = -1; candidate = -1; since = 0.0 }
}
