package dev.awc.nativeui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.util.Xml
import org.xmlpull.v1.XmlPullParser
import kotlin.math.*

/**
 * SVG images (`image/svg+xml`, which BitmapFactory does not decode), rasterised at 4× their intrinsic size: the static
 * shape subset avatars use — rect (rx/ry), circle, ellipse, line, polyline, polygon and path (every command, arcs
 * included), nested <g> with inherited fill/stroke/opacity and translate/scale transforms, viewBox, hex/rgb()/named
 * colours. Anything it cannot parse fails the image like a broken one.
 */
internal object AWCSvgRaster {
    private const val SCALE = 4f
    fun decode(bytes: ByteArray): Bitmap? = runCatching { render(String(bytes, Charsets.UTF_8)) }.getOrNull()

    private class Style(val fill: Int?, val stroke: Int?, val strokeWidth: Float, val opacity: Float)
    private fun render(text: String): Bitmap? {
        if(!text.contains("<svg")) return null
        val p = Xml.newPullParser(); p.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false); p.setInput(text.reader())
        var bmp: Bitmap? = null; var canvas: Canvas? = null
        val styles = ArrayDeque<Style>(); val saves = ArrayDeque<Int>()
        while(true) {
            val ev = p.next(); if(ev == XmlPullParser.END_DOCUMENT) break
            if(ev == XmlPullParser.START_TAG) {
                fun a(n: String) = p.getAttributeValue(null, n)
                val inherited = styles.lastOrNull() ?: Style(0xFF000000.toInt(), null, 1f, 1f)
                val css = (a("style") ?: "").split(';').mapNotNull { d -> d.split(':', limit = 2).takeIf { it.size == 2 }?.let { it[0].trim() to it[1].trim() } }.toMap()
                fun prop(n: String) = css[n] ?: a(n)
                val opacity = (prop("opacity")?.toFloatOrNull() ?: 1f).coerceIn(0f, 1f)
                fun paint(n: String, base: Int?) = when(val v = prop(n)) { null -> base; "none", "transparent" -> null; else -> color(v) ?: base }
                var fill = paint("fill", inherited.fill); var stroke = paint("stroke", inherited.stroke)
                prop("fill-opacity")?.toFloatOrNull()?.let { o -> fill = fill?.let { withAlpha(it, o) } }
                prop("stroke-opacity")?.toFloatOrNull()?.let { o -> stroke = stroke?.let { withAlpha(it, o) } }
                val style = Style(fill, stroke, prop("stroke-width")?.let(::len) ?: inherited.strokeWidth, inherited.opacity * opacity)
                when(p.name) {
                    "svg" -> if(bmp == null) {
                        val vb = a("viewBox")?.split(Regex("[\\s,]+"))?.mapNotNull { it.toFloatOrNull() }?.takeIf { it.size == 4 }
                        val w = a("width")?.let(::len) ?: vb?.get(2) ?: 150f; val h = a("height")?.let(::len) ?: vb?.get(3) ?: 150f
                        if(w <= 0f || h <= 0f || w * h * SCALE * SCALE > 64e6) return null
                        bmp = Bitmap.createBitmap((w * SCALE).roundToInt().coerceAtLeast(1), (h * SCALE).roundToInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
                        canvas = Canvas(bmp!!).apply { scale(SCALE, SCALE); if(vb != null) { scale(w / vb[2], h / vb[3]); translate(-vb[0], -vb[1]) } }
                    }
                    else -> {}
                }
                val c = canvas ?: return null
                saves.addLast(c.save()); transform(c, a("transform"))
                styles.addLast(style)
                val path: Path? = when(p.name) {
                    "rect" -> { val x = a("x")?.let(::len) ?: 0f; val y = a("y")?.let(::len) ?: 0f; val w = a("width")?.let(::len) ?: 0f; val h = a("height")?.let(::len) ?: 0f
                        var rx = a("rx")?.let(::len); var ry = a("ry")?.let(::len); if(rx == null) rx = ry; if(ry == null) ry = rx
                        Path().apply { addRoundRect(RectF(x, y, x + w, y + h), min(rx ?: 0f, w / 2), min(ry ?: 0f, h / 2), Path.Direction.CW) } }
                    "circle" -> Path().apply { addCircle(a("cx")?.let(::len) ?: 0f, a("cy")?.let(::len) ?: 0f, a("r")?.let(::len) ?: 0f, Path.Direction.CW) }
                    "ellipse" -> { val cx = a("cx")?.let(::len) ?: 0f; val cy = a("cy")?.let(::len) ?: 0f; val rx = a("rx")?.let(::len) ?: 0f; val ry = a("ry")?.let(::len) ?: 0f
                        Path().apply { addOval(RectF(cx - rx, cy - ry, cx + rx, cy + ry), Path.Direction.CW) } }
                    "line" -> Path().apply { moveTo(a("x1")?.let(::len) ?: 0f, a("y1")?.let(::len) ?: 0f); lineTo(a("x2")?.let(::len) ?: 0f, a("y2")?.let(::len) ?: 0f) }
                    "polyline", "polygon" -> { val n = (a("points") ?: "").split(Regex("[\\s,]+")).mapNotNull { it.toFloatOrNull() }
                        Path().apply { for(i in 0 until n.size / 2) if(i == 0) moveTo(n[0], n[1]) else lineTo(n[2 * i], n[2 * i + 1]); if(p.name == "polygon") close() } }
                    "path" -> pathData(a("d") ?: "")
                    else -> null
                }
                if(path != null) {
                    if(p.name != "line") style.fill?.let { c.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = withAlpha(it, style.opacity); this.style = Paint.Style.FILL }) }
                    style.stroke?.let { c.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = withAlpha(it, style.opacity); this.style = Paint.Style.STROKE; strokeWidth = style.strokeWidth }) }
                }
            } else if(ev == XmlPullParser.END_TAG) {
                styles.removeLastOrNull(); saves.removeLastOrNull()?.let { canvas?.restoreToCount(it) }
            }
        }
        return bmp
    }
    private fun len(v: String) = v.trim().removeSuffix("px").toFloatOrNull()
    private fun withAlpha(c: Int, o: Float) = (((c ushr 24) * o).roundToInt().coerceIn(0, 255) shl 24) or (c and 0xFFFFFF)
    private val named = mapOf("black" to 0x000000, "white" to 0xFFFFFF, "red" to 0xFF0000, "green" to 0x008000, "blue" to 0x0000FF, "gray" to 0x808080, "grey" to 0x808080,
        "yellow" to 0xFFFF00, "orange" to 0xFFA500, "purple" to 0x800080, "teal" to 0x008080, "navy" to 0x000080, "silver" to 0xC0C0C0, "maroon" to 0x800000)
    private fun color(v: String): Int? {
        val s = v.trim().lowercase()
        if(s.startsWith("#")) { val h = s.drop(1); val full = when(h.length) { 3 -> h.map { "$it$it" }.joinToString(""); 4 -> h.map { "$it$it" }.joinToString(""); else -> h }
            return when(full.length) { 6 -> (0xFF shl 24) or full.toInt(16); 8 -> ((full.substring(6).toInt(16)) shl 24) or full.substring(0, 6).toInt(16); else -> null } }
        if(s.startsWith("rgb")) { val n = s.substringAfter('(').substringBefore(')').split(Regex("[\\s,/]+")).filter { it.isNotEmpty() }
            fun ch(x: String) = if(x.endsWith("%")) (x.dropLast(1).toFloat() * 2.55f).roundToInt() else x.toFloat().roundToInt()
            val a = n.getOrNull(3)?.let { if(it.endsWith("%")) it.dropLast(1).toFloat() / 100 else it.toFloat() } ?: 1f
            return ((a * 255).roundToInt().coerceIn(0, 255) shl 24) or (ch(n[0]).coerceIn(0, 255) shl 16) or (ch(n[1]).coerceIn(0, 255) shl 8) or ch(n[2]).coerceIn(0, 255) }
        return named[s]?.let { (0xFF shl 24) or it }
    }
    private fun transform(c: Canvas, t: String?) {
        if(t == null) return
        for(m in Regex("(translate|scale|rotate|matrix)\\(([^)]*)\\)").findAll(t)) {
            val n = m.groupValues[2].split(Regex("[\\s,]+")).mapNotNull { it.toFloatOrNull() }
            when(m.groupValues[1]) {
                "translate" -> c.translate(n.getOrElse(0) { 0f }, n.getOrElse(1) { 0f })
                "scale" -> c.scale(n.getOrElse(0) { 1f }, n.getOrElse(1) { n.getOrElse(0) { 1f } })
                "rotate" -> c.rotate(n.getOrElse(0) { 0f }, n.getOrElse(1) { 0f }, n.getOrElse(2) { 0f })
                "matrix" -> if(n.size == 6) c.concat(android.graphics.Matrix().apply { setValues(floatArrayOf(n[0], n[2], n[4], n[1], n[3], n[5], 0f, 0f, 1f)) })
            }
        }
    }
    /** SVG path data: M L H V C S Q T A Z, absolute and relative. */
    private fun pathData(d: String): Path {
        val path = Path(); val tokens = Regex("[MmLlHhVvCcSsQqTtAaZz]|-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?").findAll(d).map { it.value }.toList()
        var i = 0; var cmd = 'M'; var x = 0f; var y = 0f; var sx = 0f; var sy = 0f; var cx = 0f; var cy = 0f; var prev = ' '
        fun num() = tokens[i++].toFloat()
        while(i < tokens.size) {
            if(tokens[i][0].isLetter()) { cmd = tokens[i][0]; i++ }
            val rel = cmd.isLowerCase(); val ox = if(rel) x else 0f; val oy = if(rel) y else 0f
            when(cmd.uppercaseChar()) {
                'M' -> { x = ox + num(); y = oy + num(); path.moveTo(x, y); sx = x; sy = y; cmd = if(rel) 'l' else 'L' }
                'L' -> { x = ox + num(); y = oy + num(); path.lineTo(x, y) }
                'H' -> { x = ox + num(); path.lineTo(x, y) }
                'V' -> { y = oy + num(); path.lineTo(x, y) }
                'C' -> { val x1 = ox + num(); val y1 = oy + num(); cx = ox + num(); cy = oy + num(); x = ox + num(); y = oy + num(); path.cubicTo(x1, y1, cx, cy, x, y) }
                'S' -> { val x1 = if(prev in "CcSs") 2 * x - cx else x; val y1 = if(prev in "CcSs") 2 * y - cy else y; cx = ox + num(); cy = oy + num(); x = ox + num(); y = oy + num(); path.cubicTo(x1, y1, cx, cy, x, y) }
                'Q' -> { cx = ox + num(); cy = oy + num(); x = ox + num(); y = oy + num(); path.quadTo(cx, cy, x, y) }
                'T' -> { cx = if(prev in "QqTt") 2 * x - cx else x; cy = if(prev in "QqTt") 2 * y - cy else y; x = ox + num(); y = oy + num(); path.quadTo(cx, cy, x, y) }
                'A' -> { val rx0 = abs(num()); val ry0 = abs(num()); val rot = num(); val large = num() != 0f; val sweep = num() != 0f; val x2 = ox + num(); val y2 = oy + num()
                    arc(path, x, y, x2, y2, rx0, ry0, rot, large, sweep); x = x2; y = y2 }
                'Z' -> { path.close(); x = sx; y = sy }
                else -> i++
            }
            prev = cmd
        }
        return path
    }
    /** Endpoint → centre parameterisation (SVG implementation notes F.6.5). */
    private fun arc(path: Path, x1: Float, y1: Float, x2: Float, y2: Float, rx0: Float, ry0: Float, deg: Float, large: Boolean, sweep: Boolean) {
        if(rx0 == 0f || ry0 == 0f) { path.lineTo(x2, y2); return }
        val phi = Math.toRadians(deg.toDouble()); val cp = cos(phi); val sp = sin(phi)
        val dx = (x1 - x2) / 2.0; val dy = (y1 - y2) / 2.0; val x1p = cp * dx + sp * dy; val y1p = -sp * dx + cp * dy
        var rx = rx0.toDouble(); var ry = ry0.toDouble(); val lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if(lam > 1) { rx *= sqrt(lam); ry *= sqrt(lam) }
        val num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p; val den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
        val coef = (if(large == sweep) -1 else 1) * sqrt(max(0.0, num / den)); val cxp = coef * rx * y1p / ry; val cyp = -coef * ry * x1p / rx
        val cx = cp * cxp - sp * cyp + (x1 + x2) / 2.0; val cy = sp * cxp + cp * cyp + (y1 + y2) / 2.0
        fun ang(ux: Double, uy: Double, vx: Double, vy: Double): Double { val a = atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a }
        val t1 = ang(1.0, 0.0, (x1p - cxp) / rx, (y1p - cyp) / ry); var dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
        if(!sweep && dt > 0) dt -= 2 * PI else if(sweep && dt < 0) dt += 2 * PI
        val oval = RectF((cx - rx).toFloat(), (cy - ry).toFloat(), (cx + rx).toFloat(), (cy + ry).toFloat())
        if(deg == 0f) { path.arcTo(oval, Math.toDegrees(t1).toFloat(), Math.toDegrees(dt).toFloat(), false); return }
        // A rotated ellipse: the arc about the un-rotated ellipse, rotated about the centre (a separate contour).
        val arc = Path().apply { arcTo(oval, Math.toDegrees(t1).toFloat(), Math.toDegrees(dt).toFloat(), true) }
        arc.transform(android.graphics.Matrix().apply { setRotate(deg, cx.toFloat(), cy.toFloat()) })
        path.addPath(arc); path.lineTo(x2, y2)
    }
}
