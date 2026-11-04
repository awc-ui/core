package dev.awc.nativeui.charts

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

// Port of engine/animate.ts: entrance variants as pure transforms of the settled scene.

const val CHART_INTRO_MS = 700.0
private fun clamp01(n: Double) = if (n < 0) 0.0 else if (n > 1) 1.0 else n

fun chartExpressiveEase(t: Double) = if (t <= 0) 0.0 else if (t >= 1) 1.0 else 1 - exp(-7 * t) * cos(6 * t)
fun chartEaseOutCubic(t: Double) = 1 - (1 - clamp01(t)).pow(3)
fun chartEaseInOutCubic(t: Double): Double { val c = clamp01(t); return if (c < 0.5) 4 * c * c * c else 1 - (-2 * c + 2).pow(3) / 2 }

/** animate.ts `cubicBezier` (Newton then bisection, same iteration counts). */
fun chartCubicBezier(x1: Double, y1: Double, x2: Double, y2: Double): (Double) -> Double {
    val cx = 3 * x1; val bx = 3 * (x2 - x1) - cx; val ax = 1 - cx - bx
    val cy = 3 * y1; val by = 3 * (y2 - y1) - cy; val ay = 1 - cy - by
    fun sampleX(t: Double) = ((ax * t + bx) * t + cx) * t
    fun sampleY(t: Double) = ((ay * t + by) * t + cy) * t
    fun slopeX(t: Double) = (3 * ax * t + 2 * bx) * t + cx
    return fun(x: Double): Double {
        if (x <= 0) return 0.0
        if (x >= 1) return 1.0
        var t = x
        for (i in 0 until 8) { val err = sampleX(t) - x; if (abs(err) < 1e-6) return sampleY(t); val d = slopeX(t); if (abs(d) < 1e-6) break; t -= err / d }
        var lo = 0.0; var hi = 1.0; t = x
        for (i in 0 until 24) { val err = sampleX(t) - x; if (abs(err) < 1e-6) break; if (err > 0) hi = t else lo = t; t = (lo + hi) / 2 }
        return sampleY(t)
    }
}

val chartEmphasizedDecelerate = chartCubicBezier(0.05, 0.7, 0.1, 1.0)
fun chartEasingFor(variant: String): (Double) -> Double = if (variant == "draw" || variant == "stagger") ::chartEaseInOutCubic else chartEmphasizedDecelerate

private fun isHorizontalBar(b: ChartSceneBar) = b.horizontal ?: (b.w > b.h)

fun chartGrowBar(b: ChartSceneBar, e: Double, base: Double?): ChartSceneBar {
    if (isHorizontalBar(b)) { val x0 = base ?: b.x; val a = x0 + (b.x - x0) * e; val z = x0 + (b.x + b.w - x0) * e; return b.copy(x = min(a, z), w = abs(z - a)) }
    val y0 = base ?: (b.y + b.h); val a = y0 + (b.y - y0) * e; val z = y0 + (b.y + b.h - y0) * e
    return b.copy(y = min(a, z), h = abs(z - a))
}

private fun animateSlices(scene: ChartScene, e: Double): List<ChartSceneSlice> {
    if (scene.polar == true) {
        val base = HashMap<Int, Double>()
        for (s in scene.slices) { val cur = base[s.dataIndex]; if (cur == null || s.startAngle < cur) base[s.dataIndex] = s.startAngle }
        return scene.slices.map { s -> val s0 = base.getValue(s.dataIndex); s.copy(startAngle = s0 + (s.startAngle - s0) * e, endAngle = s0 + (s.endAngle - s0) * e) }
    }
    val g = clamp01(e)
    return scene.slices.map { it.copy(innerR = it.innerR * g, outerR = it.outerR * g) }
}

fun chartEaseScene(scene: ChartScene, e: Double): ChartScene {
    val baseY = scene.plot.y + scene.plot.height
    fun lift(y: Double) = baseY + (y - baseY) * e
    fun liftPts(p: List<ChartPt>) = p.map { ChartPt(it.x, lift(it.y)) }
    return scene.copy(
        lines = scene.lines.map { l ->
            if (l.radial != true) l.copy(points = liftPts(l.points)) else {
                val cx = scene.plot.x + scene.plot.width / 2; val cy = scene.plot.y + scene.plot.height / 2; val g = clamp01(e)
                l.copy(points = l.points.map { ChartPt(cx + (it.x - cx) * g, cy + (it.y - cy) * g) })
            }
        },
        areas = scene.areas.map { it.copy(points = liftPts(it.points), basePoints = it.basePoints?.let(::liftPts)) },
        markers = scene.markers.map { it.copy(y = lift(it.y)) },
        glyphs = scene.glyphs?.map { it.copy(y = lift(it.y)) },
        endLabels = scene.endLabels?.map { it.copy(y = lift(it.y)) },
        bars = scene.bars.map { chartGrowBar(it, e, scene.barBaseline) },
        slices = animateSlices(scene, e),
    )
}

private fun trimPolylineX(pts: List<ChartPt>, cutX: Double): List<ChartPt> {
    val out = mutableListOf<ChartPt>()
    for (i in pts.indices) {
        val p = pts[i]
        if (p.x <= cutX) out.add(p) else {
            if (i > 0) { val a = pts[i - 1]; val d = p.x - a.x; val span = if (d == 0.0 || d.isNaN()) 1.0 else d; val f = (cutX - a.x) / span; out.add(ChartPt(cutX, a.y + (p.y - a.y) * f)) }
            break
        }
    }
    return out
}

fun chartRevealScene(scene: ChartScene, e: Double): ChartScene {
    val p = scene.plot; val ec = clamp01(e)
    val cutX = p.x + ec * p.width; val cutY = p.y + ec * p.height
    return scene.copy(
        lines = scene.lines.map { if (it.radial == true) it else it.copy(points = trimPolylineX(it.points, cutX)) },
        areas = scene.areas.map { it.copy(points = trimPolylineX(it.points, cutX), basePoints = it.basePoints?.let { b -> trimPolylineX(b, cutX) }) },
        markers = scene.markers.filter { it.x <= cutX },
        glyphs = scene.glyphs?.filter { it.x <= cutX },
        bars = scene.bars.map { b -> chartGrowBar(b, if (isHorizontalBar(b)) clamp01((cutY - b.y) / max(b.h, 1.0)) else clamp01((cutX - b.x) / max(b.w, 1.0)), scene.barBaseline) },
        slices = scene.slices.map { it.copy(endAngle = it.startAngle + (it.endAngle - it.startAngle) * ec) },
    )
}

fun chartStaggerReveal(scene: ChartScene, tRaw: Double): ChartScene {
    val order = scene.lines.map { it.seriesIndex ?: 0 }.toSortedSet().toList()
    val n = if (order.isEmpty()) 1 else order.size
    val rank = order.withIndex().associate { it.value to it.index }
    val p = scene.plot
    fun cutXFor(si: Int?) = p.x + chartEaseInOutCubic(clamp01(tRaw * n - (rank[si ?: 0] ?: 0))) * p.width
    val globalCut = p.x + chartEaseInOutCubic(clamp01(tRaw)) * p.width
    return scene.copy(
        lines = scene.lines.map { if (it.radial == true) it else it.copy(points = trimPolylineX(it.points, cutXFor(it.seriesIndex))) },
        areas = scene.areas.map { val c = cutXFor(it.seriesIndex); it.copy(points = trimPolylineX(it.points, c), basePoints = it.basePoints?.let { b -> trimPolylineX(b, c) }) },
        markers = scene.markers.filter { it.x <= cutXFor(it.seriesIndex) },
        glyphs = scene.glyphs?.filter { it.x <= globalCut },
        bars = scene.bars.map { chartGrowBar(it, clamp01((globalCut - it.x) / max(it.w, 1.0)), scene.barBaseline) },
        slices = scene.slices.map { it.copy(endAngle = it.startAngle + (it.endAngle - it.startAngle) * clamp01(tRaw)) },
    )
}

fun chartResolveIntro(animation: String?, animationDuration: Double?, animate: Boolean?): Pair<String, Double> {
    var variant = animation ?: (if (animate == false) "none" else "expressive")
    val requested = animationDuration ?: CHART_INTRO_MS
    val ok = requested.isFinite() && requested > 0
    if (!ok) variant = "none"
    return variant to (if (ok) requested else CHART_INTRO_MS)
}

private fun fadeGrid(scene: ChartScene, e: Double): List<ChartSegment> {
    val a = clamp01(e * 2)
    return if (a >= 1) scene.gridlines else scene.gridlines.map { it.copy(color = chartWithAlpha(it.color, a)) }
}

/** animate.ts `stepAnimation`: the frame scene and the canvas/glyph layer opacity. */
fun chartStepAnimation(variant: String, target: ChartScene, tRaw: Double): Pair<ChartScene, Double> {
    val e = chartEasingFor(variant)(clamp01(tRaw))
    return when (variant) {
        "fade" -> target to clamp01(e)
        "draw" -> chartRevealScene(target, e).copy(gridlines = fadeGrid(target, e)) to 1.0
        "stagger" -> { val t = clamp01(tRaw); chartStaggerReveal(target, t).copy(gridlines = fadeGrid(target, t)) to 1.0 }
        else -> chartEaseScene(target, e) to clamp01(e)
    }
}
