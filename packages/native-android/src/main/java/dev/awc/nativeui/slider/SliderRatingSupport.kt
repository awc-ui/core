package dev.awc.nativeui.slider

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.ui.graphics.Color
import java.math.BigDecimal
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// md-slider / md-rating support: CSS colour parsing with the canvas `fillStyle` normalisation (named colours, hsl()/hwb(),
// modern rgb() syntax → 8-bit sRGB), JS number formatting / parseFloat / Math.round, the stylesheet cubic-bezier easing and
// the Roboto text measurer. Copied from the chart port (n5: charts/ChartColor.kt, ChartAnimate.kt, ChartModel.kt,
// ChartScale.kt, ChartIntlAndroid.kt, ChartRenderer.kt) under slider/rating names so that the two renderer families install
// and evolve independently.

/** JS `Math.round`. */
fun srJsRound(v: Double): Double { val r = floor(v); return if (v - r >= 0.5) r + 1 else r }

data class SrRgba(val r: Double, val g: Double, val b: Double, val a: Double)

/** JS `Number.prototype.toString()`: shortest round-trip digits with JS exponent rules. */
fun srJsNumberString(v: Double): String {
    if (v.isNaN()) return "NaN"
    if (v.isInfinite()) return if (v < 0) "-Infinity" else "Infinity"
    if (v == 0.0) return "0"
    if (v == Math.rint(v) && kotlin.math.abs(v) < 1e21) return BigDecimal(v).toPlainString()
    // Shortest representation that round-trips (Java's Double.toString is not shortest before JDK 19).
    var digits = ""; var exp = 0
    for (p in 1..17) {
        val s = String.format(java.util.Locale.ROOT, "%.${p - 1}e", v)
        if (s.toDouble() == v) {
            val mant = s.substringBefore('e'); exp = s.substringAfter('e').toInt()
            digits = mant.replace("-", "").replace(".", "").trimEnd('0').ifEmpty { "0" }
            break
        }
    }
    val neg = v < 0
    val k = digits.length; val n = exp + 1
    val body = when {
        n in k..21 -> digits + "0".repeat(n - k)
        n in 1..21 -> digits.substring(0, n) + "." + digits.substring(n)
        n in -5..0 -> "0." + "0".repeat(-n) + digits
        else -> { val e = n - 1; (if (k == 1) digits else digits[0] + "." + digits.substring(1)) + "e" + (if (e < 0) "-" else "+") + kotlin.math.abs(e) }
    }
    return (if (neg) "-" else "") + body
}

private val namedColors: Map<String, Int> by lazy {
    val t = "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32".split(" ")
    (t.indices step 2).associate { t[it] to t[it + 1].toInt(16) }
}

/** JS parseInt(s, 16) on a slice: NaN when it starts with a non-hex character. */
private fun hexByte(s: String): Double {
    var v = 0; var any = false
    for (c in s) { val d = Character.digit(c, 16); if (d < 0) break; v = v * 16 + d; any = true }
    return if (any) v.toDouble() else Double.NaN
}

/** JS parseFloat. */
fun srJsParseFloat(raw: String): Double {
    val s = raw.trim()
    val m = Regex("""^[+-]?(Infinity|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)""").find(s) ?: return Double.NaN
    val t = m.value
    if (t.endsWith("Infinity")) return if (t.startsWith("-")) Double.NEGATIVE_INFINITY else Double.POSITIVE_INFINITY
    return t.toDoubleOrNull() ?: Double.NaN
}

private fun parseHexOrRgb(s: String): SrRgba? {
    if (s.startsWith("#")) {
        var h = s.substring(1)
        if (h.length == 3 || h.length == 4) h = h.map { "$it$it" }.joinToString("")
        if (h.length < 6) return null
        val r = hexByte(h.substring(0, 2)) / 255; val g = hexByte(h.substring(2, 4)) / 255; val b = hexByte(h.substring(4, 6)) / 255
        val a = if (h.length >= 8) hexByte(h.substring(6, 8)) / 255 else 1.0
        if (r.isNaN() || g.isNaN() || b.isNaN()) return null
        return SrRgba(r, g, b, a)
    }
    val m = Regex("""^rgba?\(([^)]+)\)$""").find(s) ?: return null
    val parts = m.groupValues[1].split(Regex("""[\s,/]+""")).filter { it.isNotEmpty() }
    if (parts.size < 3) return null
    fun chan(v: String) = if (v.endsWith("%")) (srJsParseFloat(v) / 100) * 255 else srJsParseFloat(v)
    val a = if (parts.size > 3) (if (parts[3].endsWith("%")) srJsParseFloat(parts[3]) / 100 else srJsParseFloat(parts[3])) else 1.0
    return SrRgba(chan(parts[0]) / 255, chan(parts[1]) / 255, chan(parts[2]) / 255, if (a.isNaN()) 1.0 else a)
}

/** Canvas fillStyle normalisation: "#rrggbb" when opaque, "rgba(r, g, b, a)" otherwise. */
private fun normalizeColor(css: String): String? {
    val s = css.trim().lowercase()
    if (s == "transparent") return "rgba(0, 0, 0, 0)"
    namedColors[s]?.let { return "#%06x".format(it) }
    fun serialize(r: Double, g: Double, b: Double, a: Double): String {
        val R = min(255.0, max(0.0, srJsRound(r))).toInt(); val G = min(255.0, max(0.0, srJsRound(g))).toInt(); val B = min(255.0, max(0.0, srJsRound(b))).toInt()
        val A = min(1.0, max(0.0, a))
        if (A >= 1) return "#%02x%02x%02x".format(R, G, B)
        val a8 = srJsRound(A * 255)
        var text = srJsNumberString(srJsRound(a8 / 255 * 100) / 100)
        if (srJsRound((text.toDoubleOrNull() ?: 0.0) * 255) != a8) text = srJsNumberString(srJsRound(a8 / 255 * 1000) / 1000)
        return "rgba($R, $G, $B, $text)"
    }
    fun args(vararg prefixes: String): List<String>? {
        for (p in prefixes) if (s.startsWith("$p(") && s.endsWith(")")) return s.substring(p.length + 1, s.length - 1).split(Regex("[\\s,/]+")).filter { it.isNotEmpty() }
        return null
    }
    fun alpha(p: List<String>) = if (p.size > 3) (if (p[3].endsWith("%")) srJsParseFloat(p[3]) / 100 else srJsParseFloat(p[3])) else 1.0
    fun hue(v: String) = when {
        v.endsWith("deg") -> srJsParseFloat(v.dropLast(3)); v.endsWith("turn") -> srJsParseFloat(v.dropLast(4)) * 360
        v.endsWith("grad") -> srJsParseFloat(v.dropLast(4)) * 0.9; v.endsWith("rad") -> srJsParseFloat(v.dropLast(3)) * 180 / Math.PI
        else -> srJsParseFloat(v)
    }
    args("hsl", "hsla")?.takeIf { it.size >= 3 }?.let { p ->
        var h = hue(p[0]) % 360; if (h < 0) h += 360
        val sat = min(1.0, max(0.0, srJsParseFloat(p[1]) / 100)); val l = min(1.0, max(0.0, srJsParseFloat(p[2]) / 100))
        fun f(n: Double): Double { val k = (n + h / 30) % 12; val a = sat * min(l, 1 - l); return l - a * max(-1.0, minOf(k - 3, 9 - k, 1.0)) }
        return serialize(f(0.0) * 255, f(8.0) * 255, f(4.0) * 255, alpha(p))
    }
    args("hwb")?.takeIf { it.size >= 3 }?.let { p ->
        var h = hue(p[0]) % 360; if (h < 0) h += 360
        var w = srJsParseFloat(p[1]) / 100; var bl = srJsParseFloat(p[2]) / 100
        if (w + bl >= 1) { val g = w / (w + bl); return serialize(g * 255, g * 255, g * 255, alpha(p)) }
        w = max(0.0, w); bl = max(0.0, bl)
        fun f(n: Double): Double { val k = (n + h / 30) % 12; return 0.5 - 0.5 * max(-1.0, minOf(k - 3, 9 - k, 1.0)) }
        return serialize((f(0.0) * (1 - w - bl) + w) * 255, (f(8.0) * (1 - w - bl) + w) * 255, (f(4.0) * (1 - w - bl) + w) * 255, alpha(p))
    }
    args("rgb", "rgba")?.takeIf { it.size >= 3 }?.let { p ->
        fun chan(v: String) = if (v.endsWith("%")) srJsParseFloat(v) / 100 * 255 else srJsParseFloat(v)
        val r = chan(p[0]); val g = chan(p[1]); val b = chan(p[2])
        if (r.isNaN() || g.isNaN() || b.isNaN()) return null
        return serialize(r, g, b, alpha(p))
    }
    if (s.startsWith("#")) {
        val h = s.substring(1)
        if (h.length !in listOf(3, 4, 6, 8) || !h.all { Character.digit(it, 16) >= 0 }) return null
        parseHexOrRgb(s)?.let { return serialize(it.r * 255, it.g * 255, it.b * 255, it.a) }
    }
    return null
}

val SR_GREY_FALLBACK = SrRgba(0.5, 0.5, 0.5, 1.0)

fun srParseColor(css: String): SrRgba {
    val s = css.trim()
    parseHexOrRgb(s)?.let { return it }
    normalizeColor(s)?.let { n -> parseHexOrRgb(n)?.let { return it } }
    return SR_GREY_FALLBACK
}

/** animate.ts `cubicBezier` (Newton then bisection, same iteration counts). */
fun srCubicBezier(x1: Double, y1: Double, x2: Double, y2: Double): (Double) -> Double {
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

/** Text measurement for the legend chips (Android: Paint with the bundled Roboto). */
interface SrTextMeasurer {
    fun width(text: String, size: Double, weight: Double = 400.0): Double
    fun normalLineHeight(size: Double, weight: Double = 400.0): Double
}

/**
 * Legend chips, value ticks and labels measured with the bundled Roboto (weights 400 / 500 / 700; 600 draws as bold, as
 * the Web falls back). Measured at 2048 px — Roboto's units per em — and scaled: at that size FreeType's hinted advances
 * are whole font units, i.e. the unhinted advances Chrome lays out with (at the real size Paint returns whole pixels).
 */
class SrPaintMeasurer(private val regular: Typeface, private val medium: Typeface, private val bold: Typeface) : SrTextMeasurer {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { isSubpixelText = true; isLinearText = true; textSize = EM }

    private fun face(weight: Double) = if (weight > 500) bold else if (weight > 400) medium else regular

    override fun width(text: String, size: Double, weight: Double): Double = synchronized(paint) {
        paint.typeface = face(weight)
        paint.measureText(text).toDouble() * size / EM
    }

    /** CSS `line-height: normal` for Roboto: (ascender + |descender|) / unitsPerEm = 2400 / 2048. */
    override fun normalLineHeight(size: Double, weight: Double) = size * 2400.0 / 2048.0

    private companion object { const val EM = 2048f }
}

fun srCssColor(css: String): Color { val c = srParseColor(css); return Color(c.r.toFloat().coerceIn(0f, 1f), c.g.toFloat().coerceIn(0f, 1f), c.b.toFloat().coerceIn(0f, 1f), c.a.toFloat().coerceIn(0f, 1f)) }
