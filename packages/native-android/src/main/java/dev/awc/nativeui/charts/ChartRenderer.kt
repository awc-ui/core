package dev.awc.nativeui.charts

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

// Port of engine/renderer-canvas.ts (drawSceneCanvas) onto a Compose DrawScope, plus emphasis.ts.
// Scene units are CSS px; `px` scales them to device pixels.

fun chartCssColor(css: String): Color { val c = chartParseColor(css); return Color(c.r.toFloat().coerceIn(0f, 1f), c.g.toFloat().coerceIn(0f, 1f), c.b.toFloat().coerceIn(0f, 1f), c.a.toFloat().coerceIn(0f, 1f)) }

/** A path builder in scene units that mirrors the canvas 2D path API. */
class ChartPathBuilder(private val px: Float) {
    val path = Path()
    private var hasCurrent = false
    private var cur = Offset.Zero
    fun moveTo(x: Double, y: Double) { cur = Offset((x * px).toFloat(), (y * px).toFloat()); path.moveTo(cur.x, cur.y); hasCurrent = true }
    fun lineTo(x: Double, y: Double) { if (!hasCurrent) { moveTo(x, y); return }; cur = Offset((x * px).toFloat(), (y * px).toFloat()); path.lineTo(cur.x, cur.y) }
    fun close() { path.close() }
    /** Canvas `arc(cx, cy, r, a0, a1, anticlockwise)`: a line to the arc start, then the arc with canvas sweep rules. */
    fun arc(cx: Double, cy: Double, r: Double, a0: Double, a1: Double, ccw: Boolean) {
        if (!(r >= 0) || !a0.isFinite() || !a1.isFinite()) return
        val twoPi = Math.PI * 2
        var sweep = a1 - a0
        sweep = if (!ccw) { if (sweep >= twoPi) twoPi else { var s = sweep % twoPi; if (s < 0) s += twoPi; s } }
        else { if (-sweep >= twoPi) -twoPi else { var s = sweep % twoPi; if (s > 0) s -= twoPi; s } }
        val sx = cx + cos(a0) * r; val sy = cy + sin(a0) * r
        if (hasCurrent) lineTo(sx, sy) else moveTo(sx, sy)
        if (r == 0.0 || sweep == 0.0) return
        // Split into ≤ 90° cubic segments (canvas arcs are exact circles; cubic error < 0.03 %).
        val n = max(1, kotlin.math.ceil(abs(sweep) / (Math.PI / 2)).toInt())
        val step = sweep / n
        var a = a0
        for (i in 0 until n) {
            val b = a + step
            val k = 4.0 / 3.0 * tan((b - a) / 4)
            val x1 = cx + r * (cos(a) - k * sin(a)); val y1 = cy + r * (sin(a) + k * cos(a))
            val x2 = cx + r * (cos(b) + k * sin(b)); val y2 = cy + r * (sin(b) - k * cos(b))
            val x3 = cx + r * cos(b); val y3 = cy + r * sin(b)
            path.cubicTo((x1 * px).toFloat(), (y1 * px).toFloat(), (x2 * px).toFloat(), (y2 * px).toFloat(), (x3 * px).toFloat(), (y3 * px).toFloat())
            cur = Offset((x3 * px).toFloat(), (y3 * px).toFloat())
            a = b
        }
    }
}

private fun traceChevron(p: ChartPathBuilder, b: ChartSceneBar) {
    val along = b.horizontal ?: (b.w > b.h)
    val t = chartChevronTipDepth(if (along) b.h else b.w)
    val cut = if (b.notch == false) 0.0 else t
    if (along) {
        val my = b.y + b.h / 2
        if (b.arrow == 1) { p.moveTo(b.x, b.y); p.lineTo(b.x + b.w, b.y); p.lineTo(b.x + b.w + t, my); p.lineTo(b.x + b.w, b.y + b.h); p.lineTo(b.x, b.y + b.h); if (cut != 0.0) p.lineTo(b.x + cut, my) }
        else { p.moveTo(b.x + b.w, b.y); p.lineTo(b.x, b.y); p.lineTo(b.x - t, my); p.lineTo(b.x, b.y + b.h); p.lineTo(b.x + b.w, b.y + b.h); if (cut != 0.0) p.lineTo(b.x + b.w - cut, my) }
    } else {
        val mx = b.x + b.w / 2
        if (b.arrow == 1) { p.moveTo(b.x, b.y + b.h); p.lineTo(b.x, b.y); p.lineTo(mx, b.y - t); p.lineTo(b.x + b.w, b.y); p.lineTo(b.x + b.w, b.y + b.h); if (cut != 0.0) p.lineTo(mx, b.y + b.h - cut) }
        else { p.moveTo(b.x, b.y); p.lineTo(b.x, b.y + b.h); p.lineTo(mx, b.y + b.h + t); p.lineTo(b.x + b.w, b.y + b.h); p.lineTo(b.x + b.w, b.y); if (cut != 0.0) p.lineTo(mx, b.y + cut) }
    }
    p.close()
}

/** renderer-canvas.ts `traceSlice`. */
fun chartTraceSlice(p: ChartPathBuilder, cx: Double, cy: Double, innerR: Double, outerR: Double, a0: Double, a1: Double, cornerRadius: Double?, gap: Double?) {
    val ccw = a1 < a0
    val towards = if (ccw) -1.0 else 1.0
    val sweep = abs(a1 - a0)
    fun atX(r: Double, a: Double) = cx + cos(a) * r
    fun atY(r: Double, a: Double) = cy + sin(a) * r
    val lone = sweep >= Math.PI * 2 - 0.01
    val g = if (lone) 0.0 else min((gap ?: 0.0) / 2, outerR * sin(sweep / 2) * 0.4)
    fun insetAt(r: Double) = if (g > 0 && r > g) asin(min(1.0, g / r)) else 0.0
    val b0 = a0 + towards * insetAt(outerR); val b1 = a1 - towards * insetAt(outerR)
    if (towards * (b1 - b0) <= 0) return
    fun edgeAt(base: Double, dir: Double, r: Double): Double {
        val mid = (a0 + a1) / 2; val a = base + dir * insetAt(r)
        return if (dir * towards > 0) min(a * towards, mid * towards) * towards else max(a * towards, mid * towards) * towards
    }
    val span = min(abs(b1 - b0), Math.PI / 2) / 4
    val maxBySweepInner = if (innerR > 0) innerR * tan(span) else Double.POSITIVE_INFINITY
    val r = max(0.0, minOf(cornerRadius ?: 0.0, (outerR - innerR) / 2, outerR * tan(span), maxBySweepInner))
    val n0 = edgeAt(a0, towards, max(innerR, 0.01)); val n1 = edgeAt(a1, -towards, max(innerR, 0.01))
    if (r < 0.5) {
        p.moveTo(atX(innerR, n0), atY(innerR, n0)); p.lineTo(atX(outerR, b0), atY(outerR, b0))
        p.arc(cx, cy, outerR, b0, b1, ccw)
        p.lineTo(atX(innerR, n1), atY(innerR, n1))
        if (innerR > 0 && towards * (n1 - n0) > 0) p.arc(cx, cy, innerR, n1, n0, !ccw)
        p.close(); return
    }
    val rhoO = outerR - r
    val dO = asin(min(1.0, r / rhoO)) * towards
    val footO = sqrt(max(0.0, rhoO * rhoO - r * r))
    val c0 = b0 + dO; val c1 = b1 - dO
    val donut = innerR > 0
    val rhoI = innerR + r
    val dI = asin(min(1.0, r / rhoI)) * towards
    val footI = sqrt(max(0.0, rhoI * rhoI - r * r))
    val i0 = edgeAt(a0, towards, rhoI); val i1 = edgeAt(a1, -towards, rhoI)
    val e0 = i0 + dI; val e1 = i1 - dI
    val off0 = b0 + (if (ccw) Math.PI / 2 else -Math.PI / 2); val off1 = b1 + (if (ccw) -Math.PI / 2 else Math.PI / 2)
    p.moveTo(atX(if (donut) footI else 0.0, i0), atY(if (donut) footI else 0.0, i0))
    p.lineTo(atX(footO, b0), atY(footO, b0))
    p.arc(atX(rhoO, c0), atY(rhoO, c0), r, off0, c0, ccw)
    p.arc(cx, cy, outerR, c0, c1, ccw)
    p.arc(atX(rhoO, c1), atY(rhoO, c1), r, c1, off1, ccw)
    p.lineTo(atX(footO, b1), atY(footO, b1))
    if (donut) {
        p.lineTo(atX(footI, i1), atY(footI, i1))
        p.arc(atX(rhoI, e1), atY(rhoI, e1), r, off1, e1 + Math.PI, ccw)
        if (towards * (e1 - e0) > 0) p.arc(cx, cy, innerR, e1, e0, !ccw)
        p.arc(atX(rhoI, e0), atY(rhoI, e0), r, e0 + Math.PI, off0, ccw)
    } else p.lineTo(atX(0.0, i1), atY(0.0, i1))
    p.close()
}

/** Canvas `roundRect(x, y, w, h, [tl, tr, br, bl])`. */
fun chartRoundRect(p: ChartPathBuilder, x: Double, y: Double, w: Double, h: Double, r: List<Double>) {
    val (tl, tr, br, bl) = r
    p.moveTo(x + tl, y); p.lineTo(x + w - tr, y)
    if (tr > 0) p.arc(x + w - tr, y + tr, tr, -Math.PI / 2, 0.0, false)
    p.lineTo(x + w, y + h - br)
    if (br > 0) p.arc(x + w - br, y + h - br, br, 0.0, Math.PI / 2, false)
    p.lineTo(x + bl, y + h)
    if (bl > 0) p.arc(x + bl, y + h - bl, bl, Math.PI / 2, Math.PI, false)
    p.lineTo(x, y + tl)
    if (tl > 0) p.arc(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5, false)
    p.close()
}

private fun areaBrush(a: ChartSceneArea, hasBase: Boolean, px: Float): Brush {
    val horiz = a.horizontal == true
    val coords = a.points.map { if (horiz) it.x else it.y }.toMutableList()
    if (hasBase) coords += a.basePoints!!.map { if (horiz) it.x else it.y }
    coords += a.baselineY
    val lo = coords.min(); val hi = coords.max()
    val start = if (horiz) Offset((lo * px).toFloat(), 0f) else Offset(0f, (lo * px).toFloat())
    val end = if (horiz) Offset((hi * px).toFloat(), 0f) else Offset(0f, (hi * px).toFloat())
    val top = chartCssColor(a.colorTop); val bottom = chartCssColor(a.colorBottom)
    val span = hi - lo
    if (span < 1e-6) return Brush.linearGradient(0f to top, 1f to bottom, start = start, end = end)
    val t = ((a.baselineY - lo) / span).toFloat()
    return when {
        t <= 1e-4f -> Brush.linearGradient(0f to bottom, 1f to top, start = start, end = end)
        t >= 1 - 1e-4f -> Brush.linearGradient(0f to top, 1f to bottom, start = start, end = end)
        else -> Brush.linearGradient(0f to top, t to bottom, 1f to top, start = start, end = end)
    }
}

private fun DrawScope.strokeSeg(g: ChartSegment, px: Float, cap: StrokeCap = StrokeCap.Butt) {
    val p = Path().apply { moveTo((g.x1 * px).toFloat(), (g.y1 * px).toFloat()); lineTo((g.x2 * px).toFloat(), (g.y2 * px).toFloat()) }
    drawPath(p, chartCssColor(g.color), style = Stroke((g.width * px).toFloat(), cap = cap, pathEffect = g.dash?.let { d -> PathEffect.dashPathEffect(d.map { (it * px).toFloat() }.toFloatArray()) }))
}

/** renderer-canvas.ts `drawSceneCanvas`; `px` = device pixels per CSS px. */
fun DrawScope.chartDrawScene(scene: ChartScene, px: Float) {
    scene.background?.let { drawRect(chartCssColor(it), Offset.Zero, Size((scene.width * px).toFloat(), (scene.height * px).toFloat())) }
    for (b in scene.bands ?: emptyList()) if (chartIsCssColor(b.color)) drawRect(chartCssColor(b.color), Offset((b.x * px).toFloat(), (b.y * px).toFloat()), Size((b.w * px).toFloat(), (b.h * px).toFloat()))
    for (g in scene.gridlines) strokeSeg(g, px)
    for (a in scene.areas) {
        if (a.points.size < 2) continue
        val hasBase = !a.basePoints.isNullOrEmpty()
        val p = ChartPathBuilder(px)
        p.moveTo(a.points[0].x, a.points[0].y)
        for (pt in a.points.drop(1)) p.lineTo(pt.x, pt.y)
        if (hasBase) for (pt in a.basePoints!!.asReversed()) p.lineTo(pt.x, pt.y)
        else { p.lineTo(a.points.last().x, a.baselineY); p.lineTo(a.points[0].x, a.baselineY) }
        p.close()
        drawPath(p.path, areaBrush(a, hasBase, px), style = Fill)
    }
    for (a in scene.axisLines) strokeSeg(a, px)
    for (b in scene.bars) {
        if (b.w <= 0 || b.h <= 0) continue
        val p = ChartPathBuilder(px)
        if (b.arrow != null && b.arrow != 0) traceChevron(p, b)
        else { val maxR = min(b.w, b.h) / 2; chartRoundRect(p, b.x, b.y, b.w, b.h, b.radius.map { max(0.0, min(it, maxR)) }) }
        drawPath(p.path, chartCssColor(b.color))
    }
    val backed = scene.slices.filter { it.pill != true && (it.gap ?: 0.0) != 0.0 && it.gapColor != null && it.endAngle != it.startAngle }
    if (backed.isNotEmpty()) {
        val p = ChartPathBuilder(px)
        for (s in backed) chartTraceSlice(p, s.cx, s.cy, s.innerR, s.outerR, s.startAngle, s.endAngle, s.cornerRadius, 0.0)
        drawPath(p.path, chartCssColor(backed[0].gapColor!!))
    }
    for (s in scene.slices) {
        if (s.endAngle == s.startAngle) continue
        if (s.pill == true) {
            val mid = (s.innerR + s.outerR) / 2; val thickness = abs(s.outerR - s.innerR)
            if (thickness <= 0 || mid <= 0) continue
            val perEnd = s.capStart != null || s.capEnd != null
            val color = chartCssColor(s.color)
            val p = ChartPathBuilder(px); p.arc(s.cx, s.cy, mid, s.startAngle, s.endAngle, s.endAngle < s.startAngle)
            drawPath(p.path, color, style = Stroke((thickness * px).toFloat(), cap = if (perEnd) StrokeCap.Butt else StrokeCap.Round))
            fun cap(angle: Double) { val c = ChartPathBuilder(px); c.arc(s.cx + mid * cos(angle), s.cy + mid * sin(angle), thickness / 2, 0.0, Math.PI * 2, false); drawPath(c.path, color) }
            if (perEnd) { if (s.capStart == true) cap(s.startAngle); if (s.capEnd == true) cap(s.endAngle) }
            continue
        }
        val p = ChartPathBuilder(px)
        chartTraceSlice(p, s.cx, s.cy, s.innerR, s.outerR, s.startAngle, s.endAngle, s.cornerRadius, s.gap)
        val gr = s.gradient
        if (gr != null) {
            val mid = (s.startAngle + s.endAngle) / 2
            drawPath(p.path, Brush.linearGradient(listOf(chartCssColor(gr.first), chartCssColor(gr.second)),
                start = Offset(((s.cx + cos(mid) * s.innerR) * px).toFloat(), ((s.cy + sin(mid) * s.innerR) * px).toFloat()),
                end = Offset(((s.cx + cos(mid) * s.outerR) * px).toFloat(), ((s.cy + sin(mid) * s.outerR) * px).toFloat())))
        } else drawPath(p.path, chartCssColor(s.color))
    }
    val rip = scene.ripple
    if (rip != null && rip.alpha > 0 && rip.radius > 0) {
        scene.slices.firstOrNull { it.pill != true && it.dataIndex == rip.dataIndex }?.let { host ->
            val clip = ChartPathBuilder(px); chartTraceSlice(clip, host.cx, host.cy, host.innerR, host.outerR, host.startAngle, host.endAngle, host.cornerRadius, host.gap)
            clipPath(clip.path) { val c = ChartPathBuilder(px); c.arc(rip.x, rip.y, rip.radius, 0.0, Math.PI * 2, false); drawPath(c.path, chartCssColor(rip.color), alpha = rip.alpha.toFloat()) }
        }
    }
    for (line in scene.lines) {
        val color = chartCssColor(line.color)
        if (line.points.size < 2) {
            if (line.points.size == 1) drawCircle(color, (line.width * px).toFloat(), Offset((line.points[0].x * px).toFloat(), (line.points[0].y * px).toFloat()))
            continue
        }
        val p = ChartPathBuilder(px)
        p.moveTo(line.points[0].x, line.points[0].y)
        for (pt in line.points.drop(1)) p.lineTo(pt.x, pt.y)
        val cap = when (line.cap) { "butt" -> StrokeCap.Butt; "square" -> StrokeCap.Square; else -> StrokeCap.Round }
        drawPath(p.path, color, style = Stroke((line.width * px).toFloat(), cap = cap, join = StrokeJoin.Round, pathEffect = line.dash?.takeIf { it.isNotEmpty() }?.let { d -> PathEffect.dashPathEffect(d.map { (it * px).toFloat() }.toFloatArray()) }))
    }
    for (m in scene.markers) {
        val p = ChartPathBuilder(px)
        val poly = chartMarkerPolygon(m.symbol, m.x, m.y, m.r)
        if (poly != null) { p.moveTo(poly[0].x, poly[0].y); for (pt in poly.drop(1)) p.lineTo(pt.x, pt.y); p.close() } else p.arc(m.x, m.y, m.r, 0.0, Math.PI * 2, false)
        if (m.hollow == true) {
            drawPath(p.path, chartCssColor(m.fill ?: "rgba(0,0,0,0)"))
            drawPath(p.path, chartCssColor(m.color), style = Stroke(2 * px, cap = StrokeCap.Round, join = StrokeJoin.Round))
        } else {
            drawPath(p.path, chartCssColor(m.color))
            drawPath(p.path, chartCssColor("rgba(255,255,255,0.9)"), style = Stroke(1.5f * px, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

