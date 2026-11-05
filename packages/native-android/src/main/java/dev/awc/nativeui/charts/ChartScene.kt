package dev.awc.nativeui.charts

import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.sin

// Port of engine/scene.ts (the RenderScene) and engine/geometry.ts. Colour fields stay CSS strings
// exactly as the Web engine produces them so scenes can be diffed with the Web oracle.

data class ChartPt(val x: Double, val y: Double)
data class ChartRect(val x: Double, val y: Double, val width: Double, val height: Double)

/** A series cell: a number, `null` (gap) or `undefined` (hole). */
sealed class ChartCell {
    data class Num(val v: Double) : ChartCell()
    object Null : ChartCell()
    object Hole : ChartCell()
    val finite: Double? get() = (this as? Num)?.v?.takeIf { it.isFinite() }
    val raw: Double? get() = (this as? Num)?.v
}

/** A stacked band per row: [lo, hi], null or undefined. */
sealed class ChartBandCell {
    data class Band(val lo: Double, val hi: Double) : ChartBandCell()
    object Null : ChartBandCell()
    object Hole : ChartBandCell()
    val band: Band? get() = this as? Band
}

data class ChartPolyline(val points: List<ChartPt>, val color: String, val width: Double, val dash: List<Double>? = null, val seriesIndex: Int? = null, val radial: Boolean? = null, val cap: String? = null)
data class ChartSceneBand(val x: Double, val y: Double, val w: Double, val h: Double, val color: String)
data class ChartSceneArea(val points: List<ChartPt>, val baselineY: Double, val colorTop: String, val colorBottom: String, val basePoints: List<ChartPt>? = null, val horizontal: Boolean? = null, val seriesIndex: Int? = null)
data class ChartEndLabel(val key: String, val x: Double, val y: Double, val text: String, val color: String, val size: Double, var visible: Boolean, val side: String? = null)
data class ChartSceneMarker(val x: Double, val y: Double, val r: Double, val color: String, val symbol: String? = null, val seriesIndex: Int? = null, val hollow: Boolean? = null, val fill: String? = null)
data class ChartGlyphLabel(val color: String, val weight: Double, val dx: Double, val dy: Double, val anchorX: String, val anchorY: String)
data class ChartGlyph(val x: Double, val y: Double, val text: String, val size: Double, val label: ChartGlyphLabel? = null)
data class ChartSceneBar(val x: Double, val y: Double, val w: Double, val h: Double, val color: String, val radius: List<Double>, val seriesIndex: Int, val dataIndex: Int, val horizontal: Boolean? = null, val arrow: Int? = null, val notch: Boolean? = null)
data class ChartSceneSlice(
    val cx: Double, val cy: Double, val innerR: Double, val outerR: Double, val startAngle: Double, val endAngle: Double, val color: String, val dataIndex: Int,
    val seriesIndex: Int? = null, val cornerRadius: Double? = null, val gap: Double? = null, val gapColor: String? = null, val gradient: Pair<String, String>? = null,
    val pill: Boolean? = null, val capStart: Boolean? = null, val capEnd: Boolean? = null,
)
data class ChartSceneRipple(val dataIndex: Int, val x: Double, val y: Double, val radius: Double, val color: String, val alpha: Double)
data class ChartSegment(val x1: Double, val y1: Double, val x2: Double, val y2: Double, val color: String, val width: Double, val dash: List<Double>? = null)
data class ChartBarLabel(val seriesIndex: Int, val dataIndex: Int, val text: String, val color: String, val size: Double, val fontWeight: Double? = null, val inside: Boolean? = null, val atLowEnd: Boolean? = null)
data class ChartTextItem(val x: Double, val y: Double, val text: String, val color: String, val fontSize: Double, val fontWeight: Double? = null, val align: String, val baseline: String, val rotate: Double? = null, val key: String)
data class ChartHoverPoint(val x: Double, val y: Double, val value: Double, val low: Double? = null, val high: Double? = null, val symbol: String? = null, val color: String? = null)
data class ChartHoverSeries(val seriesIndex: Int, val color: String, val label: String, val unanchored: Boolean? = null, val byIndex: Map<Int, ChartHoverPoint>, val values: List<ChartCell>? = null, val valueFormat: ((Double) -> String)? = null)
data class ChartLegendItem(val label: String, val color: String, val seriesIndex: Int, val hidden: Boolean, val x: Double, val y: Double)

data class ChartScene(
    val barBaseline: Double? = null,
    val width: Double,
    val height: Double,
    val plot: ChartRect,
    val background: String? = null,
    val bands: List<ChartSceneBand>? = emptyList(),
    val gridlines: List<ChartSegment> = emptyList(),
    val axisLines: List<ChartSegment> = emptyList(),
    val areas: List<ChartSceneArea> = emptyList(),
    val bars: List<ChartSceneBar> = emptyList(),
    val slices: List<ChartSceneSlice> = emptyList(),
    val lines: List<ChartPolyline> = emptyList(),
    val markers: List<ChartSceneMarker> = emptyList(),
    val glyphs: List<ChartGlyph>? = null,
    val endLabels: List<ChartEndLabel>? = null,
    val texts: List<ChartTextItem> = emptyList(),
    val barLabels: List<ChartBarLabel>? = null,
    val legend: List<ChartLegendItem> = emptyList(),
    val legendPosition: String? = null,
    val pieCenterSlot: ChartPt? = null,
    val pieCenter: ChartPt? = null,
    val pieHoleSize: Double? = null,
    val pieHoleHeight: Double? = null,
    val inverted: Boolean? = null,
    val polar: Boolean? = null,
    val xPositions: List<Double> = emptyList(),
    val xValues: List<ChartAxisValue> = emptyList(),
    val xLabels: List<String> = emptyList(),
    val hoverPoints: List<ChartHoverSeries> = emptyList(),
    val ripple: ChartSceneRipple? = null,
)

const val LEGEND_SIDE_MAX_FRACTION = 0.3

// geometry.ts

private val markerAngles = mapOf("square" to listOf(45.0, 135.0, 225.0, 315.0), "diamond" to listOf(0.0, 90.0, 180.0, 270.0), "triangle" to listOf(-90.0, 150.0, 30.0), "triangle-down" to listOf(90.0, -30.0, 210.0))

fun chartMarkerPolygon(symbol: String?, cx: Double, cy: Double, r: Double): List<ChartPt>? {
    val angles = markerAngles[symbol ?: return null] ?: return null
    return angles.map { deg -> val a = (deg * Math.PI) / 180; ChartPt(cx + r * cos(a), cy + r * sin(a)) }
}

private const val CURVE_SAMPLES = 20
private const val DECIMATE_PER_PX = 4

fun chartDecimateMinMax(points: List<ChartPt>, plotWidth: Double): List<ChartPt> {
    val width = max(1, floor(plotWidth).toInt())
    if (points.size <= width * DECIMATE_PER_PX) return points
    val out = mutableListOf<ChartPt>()
    var col = jsRound(points[0].x)
    var firstI = 0; var lastI = 0; var minI = 0; var maxI = 0
    fun flush() {
        val picked = listOf(firstI, if (minI < maxI) minI else maxI, if (minI < maxI) maxI else minI, lastI)
        var prev = -1
        for (i in picked) { if (i != prev) out.add(points[i]); prev = i }
    }
    for (i in 1 until points.size) {
        val c = jsRound(points[i].x)
        if (c != col) { flush(); col = c; firstI = i; minI = i; maxI = i }
        else { if (points[i].y < points[minI].y) minI = i; if (points[i].y > points[maxI].y) maxI = i }
        lastI = i
    }
    flush()
    return out
}

fun chartClampToRect(points: List<ChartPt>, x: Double, y: Double, w: Double, h: Double): List<ChartPt> {
    val x2 = x + w; val y2 = y + h
    if (points.none { it.x < x || it.x > x2 || it.y < y || it.y > y2 }) return points
    return points.map { ChartPt(if (it.x < x) x else if (it.x > x2) x2 else it.x, if (it.y < y) y else if (it.y > y2) y2 else it.y) }
}

fun chartInterpolate(points: List<ChartPt>, curve: String): List<ChartPt> {
    if (points.size < 2) return points
    return when (curve) {
        "linear" -> points
        "step", "step-before", "step-middle" -> stepPoints(points, curve)
        "monotone" -> monotone(points)
        else -> catmullRom(points)
    }
}

private fun stepPoints(pts: List<ChartPt>, mode: String): List<ChartPt> {
    val out = mutableListOf(pts[0])
    for (i in 1 until pts.size) {
        val a = pts[i - 1]; val b = pts[i]
        when (mode) {
            "step" -> { out.add(ChartPt(b.x, a.y)); out.add(b) }
            "step-before" -> { out.add(ChartPt(a.x, b.y)); out.add(b) }
            else -> { val mx = (a.x + b.x) / 2; out.add(ChartPt(mx, a.y)); out.add(ChartPt(mx, b.y)); out.add(b) }
        }
    }
    return out
}

private fun catmullRom(pts: List<ChartPt>): List<ChartPt> {
    val out = mutableListOf(pts[0])
    for (i in 0 until pts.size - 1) {
        val p0 = if (i > 0) pts[i - 1] else pts[i]; val p1 = pts[i]; val p2 = pts[i + 1]; val p3 = if (i + 2 < pts.size) pts[i + 2] else p2
        for (s in 1..CURVE_SAMPLES) {
            val t = s.toDouble() / CURVE_SAMPLES; val t2 = t * t; val t3 = t2 * t
            val x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3)
            val y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
            out.add(ChartPt(x, y))
        }
    }
    return out
}

private fun monotone(pts: List<ChartPt>): List<ChartPt> {
    val n = pts.size
    val dx = mutableListOf<Double>(); val slope = mutableListOf<Double>()
    for (i in 0 until n - 1) {
        val d = pts[i + 1].x - pts[i].x
        val h = if (d == 0.0 || d.isNaN()) 1e-6 else d
        dx.add(h); slope.add((pts[i + 1].y - pts[i].y) / h)
    }
    val m = mutableListOf(slope[0])
    for (i in 1 until n - 1) {
        if (slope[i - 1] * slope[i] <= 0) m.add(0.0)
        else { val w1 = 2 * dx[i] + dx[i - 1]; val w2 = dx[i] + 2 * dx[i - 1]; m.add((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i])) }
    }
    m.add(slope[n - 2])
    val out = mutableListOf(pts[0])
    for (i in 0 until n - 1) {
        val p0 = pts[i]; val p1 = pts[i + 1]; val h = dx[i]
        for (s in 1..CURVE_SAMPLES) {
            val t = s.toDouble() / CURVE_SAMPLES; val t2 = t * t; val t3 = t2 * t
            val h00 = 2 * t3 - 3 * t2 + 1; val h10 = t3 - 2 * t2 + t; val h01 = -2 * t3 + 3 * t2; val h11 = t3 - t2
            out.add(ChartPt(p0.x + t * h, h00 * p0.y + h10 * h * m[i] + h01 * p1.y + h11 * h * m[i + 1]))
        }
    }
    return out
}

data class ChartRunPoint(val index: Int, val value: Double)

fun chartSplitRuns(data: List<ChartCell>, connectNulls: Boolean): List<List<ChartRunPoint>> {
    val runs = mutableListOf<List<ChartRunPoint>>(); var current = mutableListOf<ChartRunPoint>()
    data.forEachIndexed { i, v ->
        if (v is ChartCell.Hole) return@forEachIndexed
        val f = v.finite
        if (f == null) {
            if (connectNulls) return@forEachIndexed
            if (current.isNotEmpty()) { runs.add(current); current = mutableListOf() }
            return@forEachIndexed
        }
        current.add(ChartRunPoint(i, f))
    }
    if (current.isNotEmpty()) runs.add(current)
    return runs
}

fun chartStackSeries(seriesData: List<List<ChartCell>>, mode: String, stackKeys: List<String?>): List<MutableList<ChartBandCell>> {
    val rows = seriesData.maxOfOrNull { it.size } ?: 0
    val out = seriesData.map { mutableListOf<ChartBandCell>() }
    val centred = mode == "silhouette" || mode == "wiggle"
    for (r in 0 until rows) {
        val signed = HashMap<String, Double>(); val pos = HashMap<String, Double>(); val neg = HashMap<String, Double>()
        for (si in seriesData.indices) {
            val v = seriesData[si].getOrElse(r) { ChartCell.Hole }
            val k = stackKeys[si] ?: "stacked"
            val f = v.finite
            if (k == "__unstacked__" || f == null) continue
            signed[k] = (signed[k] ?: 0.0) + f
            if (f >= 0) pos[k] = (pos[k] ?: 0.0) + f else neg[k] = (neg[k] ?: 0.0) - f
        }
        val posCursor = HashMap<String, Double>(); val negCursor = HashMap<String, Double>()
        for (si in seriesData.indices) {
            val raw = seriesData[si].getOrElse(r) { ChartCell.Hole }
            if (raw is ChartCell.Hole) { out[si].add(ChartBandCell.Hole); continue }
            val rv = raw.finite
            if (rv == null) { out[si].add(ChartBandCell.Null); continue }
            val key = stackKeys[si] ?: "stacked"
            if (mode == "none" || key == "__unstacked__") { out[si].add(ChartBandCell.Band(0.0, rv)); continue }
            val base = if (centred) -(signed[key] ?: 0.0) / 2 else 0.0
            if (!posCursor.containsKey(key)) posCursor[key] = base
            if (!negCursor.containsKey(key)) negCursor[key] = base
            val p = pos[key] ?: 0.0; val n = neg[key] ?: 0.0
            var v = rv
            if (mode == "percentage") v = if (rv >= 0) (if (p > 0) (rv / p) * 100 else 0.0) else (if (n > 0) (rv / n) * 100 else 0.0)
            if (v >= 0) { val c = posCursor[key]!!; out[si].add(ChartBandCell.Band(c, c + v)); posCursor[key] = c + v }
            else { val c = negCursor[key]!!; out[si].add(ChartBandCell.Band(c + v, c)); negCursor[key] = c + v }
        }
    }
    return out
}
