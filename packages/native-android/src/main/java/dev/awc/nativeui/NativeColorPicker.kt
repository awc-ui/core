@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// md-color-picker: dedicated Compose renderer (inline panel and popover variant) of the Web component
// (packages/core/src/components/md-color-picker): HSV plate, hue and alpha tracks, preview, hex and channel fields, presets;
// pointer drags with clamping, keyboard steps, events (mdInput / mdChange / mdOpenChange), hooks
// (AWCColorPickerAppearance), density, RTL, reduced motion. A port of the SwiftUI renderer (NativeColorPicker.swift),
// which follows md-color-picker.css / .tsx statement by statement.

/** HSVA: h 0–360, s / v 0–100 (percent), a 0–1. */
@Immutable data class AWCHsva(val h: Double, val s: Double, val v: Double, val a: Double)

/** color-utils.ts with JavaScript's rounding (Math.round), parsing (parseFloat, regular expressions) and number formatting. */
internal object AWCColorMath {
    fun jsRound(x: Double) = floor(x + 0.5)
    fun clamp(n: Double, lo: Double, hi: Double) = if (n.isNaN()) n else max(lo, min(hi, n))
    /** JavaScript `parseFloat` (leading decimal number; NaN when none). */
    fun parseFloat(s: String): Double {
        val out = StringBuilder(); var dot = false; var digit = false
        for ((i, c) in s.trim().withIndex()) {
            if (c in '0'..'9') { out.append(c); digit = true }
            else if (c == '.' && !dot) { out.append(c); dot = true }
            else if ((c == '-' || c == '+') && i == 0) out.append(c)
            else break
        }
        return if (digit) out.toString().toDoubleOrNull() ?: Double.NaN else Double.NaN
    }
    /** JavaScript `parseInt(raw, 10)`. */
    fun parseInt(s: String): Double? {
        val out = StringBuilder()
        for ((i, c) in s.trim().withIndex()) { if (c in '0'..'9') out.append(c) else if ((c == '-' || c == '+') && i == 0) out.append(c) else break }
        return out.toString().toDoubleOrNull()
    }
    /** JavaScript `String(+x.toFixed(2))`. */
    fun fixed2(x: Double): String {
        val v = String.format(java.util.Locale.ROOT, "%.2f", x).toDouble()
        if (v == Math.rint(v) && abs(v) < 1e15) return v.toLong().toString()
        var t = String.format(java.util.Locale.ROOT, "%.2f", v); while (t.endsWith("0")) t = t.dropLast(1); if (t.endsWith(".")) t = t.dropLast(1)
        return t
    }
    fun rgbToHsv(r: Double, g: Double, b: Double): Triple<Double, Double, Double> {
        val rn = r / 255; val gn = g / 255; val bn = b / 255; val mx = maxOf(rn, gn, bn); val mn = minOf(rn, gn, bn); val d = mx - mn
        var h = 0.0
        if (d != 0.0) {
            h = if (mx == rn) ((gn - bn) / d).rem(6.0) else if (mx == gn) (bn - rn) / d + 2 else (rn - gn) / d + 4
            h *= 60; if (h < 0) h += 360
        }
        return Triple(h, if (mx == 0.0) 0.0 else d / mx * 100, mx * 100)
    }
    fun hsvToRgb(h: Double, s: Double, v: Double): Triple<Double, Double, Double> {
        val sn = s / 100; val vn = v / 100; val c = vn * sn; val hp = h / 60
        val x = c * (1 - abs(hp.rem(2.0) - 1))
        var r = 0.0; var g = 0.0; var b = 0.0
        if (hp >= 0 && hp < 1) { r = c; g = x } else if (hp < 2) { r = x; g = c } else if (hp < 3) { g = c; b = x }
        else if (hp < 4) { g = x; b = c } else if (hp < 5) { r = x; b = c } else { r = c; b = x }
        val m = vn - c
        return Triple(jsRound((r + m) * 255), jsRound((g + m) * 255), jsRound((b + m) * 255))
    }
    fun rgbToHsl(r: Double, g: Double, b: Double): Triple<Double, Double, Double> {
        val rn = r / 255; val gn = g / 255; val bn = b / 255; val mx = maxOf(rn, gn, bn); val mn = minOf(rn, gn, bn); val l = (mx + mn) / 2
        var h = 0.0; var s = 0.0
        if (mx != mn) {
            val d = mx - mn
            s = if (l > 0.5) d / (2 - mx - mn) else d / (mx + mn)
            h = if (mx == rn) (gn - bn) / d + (if (gn < bn) 6 else 0) else if (mx == gn) (bn - rn) / d + 2 else (rn - gn) / d + 4
            h *= 60
        }
        return Triple(h, s * 100, l * 100)
    }
    fun hslToRgb(h: Double, s: Double, l: Double): Triple<Double, Double, Double> {
        val hn = (h.rem(360.0) + 360).rem(360.0)
        val sn = clamp(s, 0.0, 100.0) / 100; val ln = clamp(l, 0.0, 100.0) / 100
        val c = (1 - abs(2 * ln - 1)) * sn; val x = c * (1 - abs((hn / 60).rem(2.0) - 1)); val m = ln - c / 2
        var r = 0.0; var g = 0.0; var b = 0.0
        if (hn < 60) { r = c; g = x } else if (hn < 120) { r = x; g = c } else if (hn < 180) { g = c; b = x }
        else if (hn < 240) { g = x; b = c } else if (hn < 300) { r = x; b = c } else { r = c; b = x }
        return Triple(jsRound((r + m) * 255), jsRound((g + m) * 255), jsRound((b + m) * 255))
    }
    fun rgba(c: AWCHsva): List<Double> { val v = hsvToRgb(c.h, c.s, c.v); return listOf(v.first, v.second, v.third, c.a) }
    fun hexByte(n: Double) = String.format(java.util.Locale.ROOT, "%02x", clamp(jsRound(n), 0.0, 255.0).toInt())
    fun rgbaToHex(r: Double, g: Double, b: Double, a: Double, withAlpha: Boolean): String {
        val base = "#" + hexByte(r) + hexByte(g) + hexByte(b)
        if (!withAlpha && a >= 1) return base.uppercase(java.util.Locale.ROOT)
        return (base + hexByte(a * 255)).uppercase(java.util.Locale.ROOT)
    }
    fun hex(c: AWCHsva, withAlpha: Boolean = false): String { val v = rgba(c); return rgbaToHex(v[0], v[1], v[2], v[3], withAlpha || c.a < 1) }
    fun hsl(c: AWCHsva): Triple<Double, Double, Double> { val v = hsvToRgb(c.h, c.s, c.v); return rgbToHsl(v.first, v.second, v.third) }
    fun parseHex(input: String): List<Double>? {
        var s = input.trim(); if (s.startsWith("#")) s = s.drop(1)
        if (s.isEmpty() || !s.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) return null
        val d = s.map { it.digitToInt(16).toDouble() }
        return when (d.size) {
            3 -> listOf(d[0] * 17, d[1] * 17, d[2] * 17, 1.0)
            4 -> listOf(d[0] * 17, d[1] * 17, d[2] * 17, d[3] * 17 / 255)
            6 -> listOf(d[0] * 16 + d[1], d[2] * 16 + d[3], d[4] * 16 + d[5], 1.0)
            8 -> listOf(d[0] * 16 + d[1], d[2] * 16 + d[3], d[4] * 16 + d[5], (d[6] * 16 + d[7]) / 255)
            else -> null
        }
    }
    private val rgbRE = Regex("""^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$""", RegexOption.IGNORE_CASE)
    private val hslRE = Regex("""^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?(?:[\s,/]+([\d.%]+))?\s*\)$""", RegexOption.IGNORE_CASE)
    private fun alpha(v: String?): Double {
        if (v.isNullOrEmpty()) return 1.0
        return if (v.endsWith("%")) clamp(parseFloat(v) / 100, 0.0, 1.0) else clamp(parseFloat(v), 0.0, 1.0)
    }
    fun parseRgb(input: String): List<Double>? {
        val g = rgbRE.find(input.trim())?.groupValues ?: return null
        fun comp(v: String) = if (v.endsWith("%")) clamp(parseFloat(v) / 100 * 255, 0.0, 255.0) else clamp(parseFloat(v), 0.0, 255.0)
        return listOf(jsRound(comp(g[1])), jsRound(comp(g[2])), jsRound(comp(g[3])), alpha(g[4]))
    }
    fun parseHsl(input: String): List<Double>? {
        val g = hslRE.find(input.trim())?.groupValues ?: return null
        val v = hslToRgb(clamp(parseFloat(g[1]), 0.0, 360.0), clamp(parseFloat(g[2]), 0.0, 100.0), clamp(parseFloat(g[3]), 0.0, 100.0))
        return listOf(v.first, v.second, v.third, alpha(g[4]))
    }
    /** `parseColor`: hex (3/4/6/8, with or without #), rgb[a](), hsl[a](); null when invalid. */
    fun parse(input: String): AWCHsva? {
        val t = input.trim()
        if (t.isEmpty()) return null
        val hexish = t.length in 3..8 && t.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }
        val rgba = when {
            t.startsWith("#") || hexish -> parseHex(t)
            t.lowercase(java.util.Locale.ROOT).startsWith("rgb") -> parseRgb(t)
            t.lowercase(java.util.Locale.ROOT).startsWith("hsl") -> parseHsl(t)
            else -> null
        } ?: return null
        val hsv = rgbToHsv(rgba[0], rgba[1], rgba[2])
        return AWCHsva(hsv.first, hsv.second, hsv.third, rgba[3])
    }
    /** `formatColor`. */
    fun format(c: AWCHsva, format: String): String {
        val v = rgba(c)
        fun i(x: Double) = x.toLong().toString()
        if (format == "rgb") return if (c.a < 1) "rgba(${i(v[0])}, ${i(v[1])}, ${i(v[2])}, ${fixed2(c.a)})" else "rgb(${i(v[0])}, ${i(v[1])}, ${i(v[2])})"
        if (format == "hsl") {
            val h = rgbToHsl(v[0], v[1], v[2])
            return if (c.a < 1) "hsla(${i(jsRound(h.first))}, ${i(jsRound(h.second))}%, ${i(jsRound(h.third))}%, ${fixed2(c.a)})"
            else "hsl(${i(jsRound(h.first))}, ${i(jsRound(h.second))}%, ${i(jsRound(h.third))}%)"
        }
        return hex(c, c.a < 1)
    }
    fun color(c: AWCHsva, alpha: Boolean): Color { val v = rgba(c); return Color((v[0] / 255).toFloat(), (v[1] / 255).toFloat(), (v[2] / 255).toFloat(), if (alpha) c.a.toFloat() else 1f) }
}

/** Built-in accessible labels (color-picker-labels.ts): English, Arabic, Romanian. */
internal object AWCColorPickerLabels {
    private val english = mapOf("saturation" to "Saturation and brightness", "hue" to "Hue", "opacity" to "Opacity", "presets" to "Color presets", "current" to "Current colour")
    private val translations = mapOf(
        "ar" to mapOf("saturation" to "التشبّع والسطوع", "hue" to "درجة اللون", "opacity" to "العتامة", "presets" to "ألوان جاهزة", "current" to "اللون الحالي"),
        "ro" to mapOf("saturation" to "Saturație și luminozitate", "hue" to "Nuanță", "opacity" to "Opacitate", "presets" to "Culori predefinite", "current" to "Culoarea curentă"))
    fun label(locale: String, key: String): String {
        val language = locale.ifEmpty { "en" }.trim().lowercase(java.util.Locale.ROOT).split("-").firstOrNull() ?: "en"
        return translations[language]?.get(key) ?: english[key] ?: key
    }
}

/**
 * md-color-picker's public CSS custom properties (`--md-color-picker-*`). Lengths are dp; colours `#RRGGBB(AA)`;
 * [popoverElevation] is CSS box-shadow text (`none` removes the shadow).
 */
@Immutable data class AWCColorPickerAppearance(
    val width: Double? = null, val plateHeight: Double? = null, val radius: Double? = null, val surfaceColor: String? = null, val onSurface: String? = null,
    val outlineColor: String? = null, val outlineStrong: String? = null, val thumbSize: Double? = null, val thumbBorder: String? = null,
    val presetSize: Double? = null, val popoverElevation: String? = null,
) {
    private fun len(v: Double?) = v?.takeIf { it.isFinite() && it >= 0 }
    internal fun normalized() = AWCColorPickerAppearance(len(width), len(plateHeight), len(radius), chipColorHex(surfaceColor), chipColorHex(onSurface),
        chipColorHex(outlineColor), chipColorHex(outlineStrong), len(thumbSize), chipColorHex(thumbBorder), len(presetSize), popoverElevation)
    fun merge(o: AWCColorPickerAppearance) = AWCColorPickerAppearance(o.width ?: width, o.plateHeight ?: plateHeight, o.radius ?: radius, o.surfaceColor ?: surfaceColor,
        o.onSurface ?: onSurface, o.outlineColor ?: outlineColor, o.outlineStrong ?: outlineStrong, o.thumbSize ?: thumbSize, o.thumbBorder ?: thumbBorder,
        o.presetSize ?: presetSize, o.popoverElevation ?: popoverElevation)
    companion object {
        /** Typed hooks from plain data (Laboratory transport); invalid fields are ignored. */
        fun fromValues(values: Map<String, AWCValue>): AWCColorPickerAppearance {
            fun n(k: String) = (values[k] as? Number)?.toDouble()
            fun s(k: String) = values[k] as? String
            return AWCColorPickerAppearance(n("width"), n("plateHeight"), n("radius"), s("surfaceColor"), s("onSurface"), s("outlineColor"), s("outlineStrong"),
                n("thumbSize"), s("thumbBorder"), n("presetSize"), s("popoverElevation")).normalized()
        }
    }
}
internal val LocalAWCColorPickerAppearance = staticCompositionLocalOf { AWCColorPickerAppearance() }
internal val LocalAWCColorPickerReducedMotion = staticCompositionLocalOf<Boolean?> { null }
internal val LocalAWCColorPickerInspector = staticCompositionLocalOf<((AWCColorPickerRuntime) -> Unit)?> { null }
@Composable fun AWCColorPickerAppearanceScope(appearance: AWCColorPickerAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCColorPickerAppearance provides LocalAWCColorPickerAppearance.current.merge(appearance.normalized()), content = content)
/** Forces reduced (or full) motion for descendant pickers, overriding the animator setting. */
@Composable fun AWCColorPickerReducedMotionScope(reduced: Boolean?, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCColorPickerReducedMotion provides reduced, content = content)
/** Receives each mounted picker's runtime (tests, Laboratory inspector). */
@Composable fun AWCColorPickerInspectionScope(onPicker: (AWCColorPickerRuntime) -> Unit, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCColorPickerInspector provides onPicker, content = content)

/** Outside-press registry: a popover closes on a press outside its host and panel (the source's document listener). */
internal class AWCColorPickerOutsideRegistry {
    class Entry(val inside: (Offset) -> Boolean, val dismiss: () -> Unit)
    val entries = mutableListOf<Entry>()
    var origin = Offset.Zero
}
internal val LocalAWCColorPickerOutside = staticCompositionLocalOf<AWCColorPickerOutsideRegistry?> { null }
/**
 * Place at the window content root (like AWCFabMenuScope): presses anywhere inside it reach open popover pickers, which close
 * on a press outside their host and panel when `dismissOnOutsideClick` is set. The press itself is not consumed.
 */
@Composable fun AWCColorPickerScope(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val registry = remember { AWCColorPickerOutsideRegistry() }
    CompositionLocalProvider(LocalAWCColorPickerOutside provides registry) {
        Box(modifier.onGloballyPositioned { registry.origin = it.boundsInRoot().topLeft }.pointerInput(registry) {
            awaitPointerEventScope {
                while (true) {
                    val e = awaitPointerEvent(PointerEventPass.Initial)
                    if (e.type != PointerEventType.Press) continue
                    val p = (e.changes.firstOrNull() ?: continue).position + registry.origin
                    registry.entries.toList().forEach { if (!it.inside(p)) it.dismiss() }
                }
            }
        }) { content() }
    }
}

/** Mutable state of one picker (the Web component's @State and private fields) and its presented motion, for inspection. */
class AWCColorPickerRuntime internal constructor() {
    var hsva by mutableStateOf(AWCHsva(268.0, 53.0, 64.0, 1.0))
        internal set
    var hexInput by mutableStateOf("")
        internal set
    var hexInvalid by mutableStateOf(false)
        internal set
    internal var lastEmitted = ""
    /** Part held by the primary pointer (`:active`): plate, hue, alpha, preset-N. */
    var active by mutableStateOf<String?>(null)
        internal set
    /** Part under the mouse (`:hover`). */
    var hovered by mutableStateOf<String?>(null)
        internal set
    var focused by mutableStateOf<String?>(null)
        internal set
    var focusVisible by mutableStateOf(false)
        internal set
    /** Channel field text while it is being edited (a number input keeps the typed text until `change`). */
    val editing = mutableStateMapOf<String, String>()
    internal val editStart = mutableMapOf<String, String>()
    var openSerial by mutableIntStateOf(0)
        internal set
    internal var dismissingOutside = false
    internal var pointerFocus = false
    internal var refocusTrigger by mutableStateOf(false)
    internal var closingFrom: String? = null
    internal val requesters = mutableMapOf<String, FocusRequester>()
    internal fun requester(id: String) = requesters.getOrPut(id) { FocusRequester() }
    internal val boxes = mutableMapOf<String, Rect>()
    // What the host sees after the last composition: tests and the Laboratory probe.
    var value = ""
        internal set
    var open = false
        internal set
    var selectedPresets: List<String> = emptyList()
        internal set
    var channels: List<String> = emptyList()
        internal set
    /** Presented motion: pop-in progress (opacity; scale 0.8 + 0.2p; translateY s·−8·(1−p)), preset (scale, angle°), thumb press 0…1. */
    var popIn = 1f
        internal set
    val presetMotion = mutableMapOf<Int, Pair<Float, Float>>()
    val thumbPress = mutableMapOf<String, Float>()
    /** Keyboard (programmatic) focus of a part: `:focus-visible`. */
    fun focus(part: String): Boolean { pointerFocus = false; return runCatching { requester(part).requestFocus() }.isSuccess }
    /** The current colour as sRGB 0–255 channels and alpha. */
    val rgba: List<Double> get() = AWCColorMath.rgba(hsva)
    /** Part bounds in root dp (pointer targets for tests). */
    fun box(part: String) = boxes[part]
}

private data class CPMetrics(val width: Double, val plateHeight: Double, val radius: Double, val thumb: Double, val preset: Double,
                             val padding: Double, val gap: Double, val insetSm: Double, val gapXs: Double, val gapSm: Double, val gapMd: Double) {
    /** Input box: inset padding, 1px border, a 15px line box (13px text, `line-height: normal`). */
    val inputHeight get() = insetSm * 2 + 2 + 15
    val fieldHeight get() = 16 + gapXs + inputHeight
    companion object {
        fun of(a: AWCColorPickerAppearance, scale: Double, rung: Double) = CPMetrics(a.width ?: 296.0, a.plateHeight ?: 176.0, a.radius ?: 28.0, a.thumbSize ?: 18.0,
            a.presetSize ?: 32.0, max(4.0, 20 + scale * 2), max(4.0, 14 + scale * 2), if (rung <= -3) 4.0 else 8.0, if (rung <= -4) 2.0 else 4.0,
            if (rung <= -3) 4.0 else 8.0, if (rung <= -4) 4.0 else if (rung <= -2) 8.0 else 12.0)
    }
}
private val CPStateEasing = CubicBezierEasing(0.34f, 0.80f, 0.34f, 1.00f)
private val CPSpringEasing = CubicBezierEasing(0.42f, 1.67f, 0.21f, 0.90f)
private val CPPopEasing = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)
private val CPCircle = AWCCornerShape.uniform(fraction = .5)
private val CPHue = listOf(0f to Color(1f, 0f, 0f), .17f to Color(1f, 1f, 0f), .33f to Color(0f, 1f, 0f), .5f to Color(0f, 1f, 1f),
    .67f to Color(0f, 0f, 1f), .83f to Color(1f, 0f, 1f), 1f to Color(1f, 0f, 0f))
private val CPChecker = Color(0xFFCCCCCC)
/** CSS line box: the glyphs centred in the full line height, nothing trimmed. */
private val CPLineBox = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)

/**
 * Group opacity whose offscreen layer extends [extent] dp beyond the node on every side, so overflowing content (thumbs,
 * shadows, rings) is faded with it instead of clipped: CSS `opacity` composites the whole subtree.
 */
@Composable private fun CPFaded(alpha: Float, extent: Float, modifier: Modifier = Modifier, layer: androidx.compose.ui.graphics.GraphicsLayerScope.() -> Unit = {},
                                content: @Composable BoxScope.() -> Unit) {
    Box(modifier.layout { m, c -> val e = (extent * density).roundToInt(); val pl = m.measure(Constraints.fixed(c.maxWidth + 2 * e, c.maxHeight + 2 * e))
            layout(c.maxWidth, c.maxHeight) { pl.place(-e, -e) } }
        .graphicsLayer { this.alpha = alpha; layer() }
        .padding(extent.dp), content = content)
}
/** Places [content] at an absolute position (dp) inside the parent's box, regardless of layout direction. */
@Composable private fun CPAt(x: Double, y: Double, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Layout(content, modifier) { ms, c ->
        val ps = ms.map { it.measure(Constraints()) }
        layout(c.maxWidth, c.maxHeight) { ps.forEach { it.place((x * density).roundToInt(), (y * density).roundToInt()) } }
    }
}
/** The 8px CSS checkerboard (#ccc in the top-right and bottom-left quadrants of each tile), tile origin at ([ox], [oy]) dp. */
private fun DrawScope.cpChecker(ox: Float, oy: Float) {
    val q = 4.dp.toPx(); val x0 = floor(-ox.dp.toPx() / q).toInt() - 1; val y0 = floor(-oy.dp.toPx() / q).toInt() - 1
    for (j in y0..(size.height / q).toInt() + 2) for (i in x0..(size.width / q).toInt() + 2) if ((i + j) and 1 == 1)
        drawRect(CPChecker, Offset(ox.dp.toPx() + i * q, oy.dp.toPx() + j * q), Size(q, q))
}

/** md-color-picker. */
@Composable
internal fun NativeColorPicker(p: Props, onEvent: EventSink, slot: Slot?) {
    val emitLatest by rememberUpdatedState(onEvent)
    val tokens = LocalAWCThemeTokens.current; val dens = LocalDensity.current.density
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val appearance = LocalAWCColorPickerAppearance.current
    val reduced = LocalAWCColorPickerReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val inherited = LocalAWCNativeDensity.current
    val localDensity = (p["density"] as? Number)?.toDouble()
    val scale = resolveAWCDensity(p["density"], inherited)
    val rung = localDensity?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) } ?: inherited
    val m = CPMetrics.of(appearance, scale, rung)
    val format = p.str("format").takeIf { it in setOf("hex", "rgb", "hsl") } ?: "hex"
    val withAlpha = p.bool("alpha"); val disabled = p.bool("disabled"); val popover = p.str("variant") == "popover"
    val locale = p.str("locale", "en-US")
    val ariaLabel = listOf(p.str("ariaLabelProp"), p.str("aria-label"), p.str("ariaLabel")).firstOrNull { it.isNotEmpty() } ?: "Color picker"
    val presets = when (val v = p["presets"]) { is String -> v.split(","); else -> p.list("presets").map { it.toString() } }.map { it.trim() }.filter { it.isNotEmpty() }
    var value by awcState(p["value"]) { p.str("value", "#6750A4") }
    var open by awcState(p["open"]) { p.bool("open") }
    val rt = remember { AWCColorPickerRuntime().also { r -> AWCColorMath.parse(p.str("value", "#6750A4"))?.let { r.hsva = it; r.hexInput = AWCColorMath.hex(it, p.bool("alpha") && it.a < 1) } ?: run { r.hexInvalid = true } } }
    // A picker that leaves the composition (its md-dialog closed) holds no focus.
    DisposableEffect(rt) { onDispose { rt.focused = null } }
    fun role(name: String, fallback: String) = awcColor(tokens["--md-sys-color-$name"] ?: fallback, Color.Black)
    fun hook(v: String?) = v?.let { awcColor(it, Color.Black) }
    val surface = hook(appearance.surfaceColor) ?: role("surface-container-high", "#ECE6F0")
    val onSurface = hook(appearance.onSurface) ?: role("on-surface", "#1C1B1F")
    val outline = hook(appearance.outlineColor) ?: role("outline-variant", "#CAC4D0")
    val outlineStrong = hook(appearance.outlineStrong) ?: role("outline", "#79747E")
    val primary = role("primary", "#6750A4"); val secondary = role("secondary", "#625B71"); val error = role("error", "#B3261E")
    val thumbBorder = hook(appearance.thumbBorder) ?: Color.White
    fun elevation(level: Int) = NativeShadowLayer.parse(tokens["--md-sys-elevation-$level"] ?: "none")
    val inspection = LocalAWCInspection.current
    val focusManager = LocalFocusManager.current
    val actions = LocalAWCAction.current; val target = LocalAWCActionTarget.current; val targetID = remember { java.util.UUID.randomUUID().toString() }
    fun emit(name: String, detail: Map<String, AWCValue>) {
        dispatchNativeAction(AWCActionEvent(name, "md-color-picker", detail, targetID = target?.id ?: targetID), actions, target?.listeners?.invoke().orEmpty())
        emitLatest(name, detail)
    }

    // MARK: Behaviour (md-color-picker.tsx)
    fun syncHex(alphaAlways: Boolean = false) { rt.hexInput = AWCColorMath.hex(rt.hsva, alphaAlways || (withAlpha && rt.hsva.a < 1)); rt.hexInvalid = false }
    fun emitValue(commit: Boolean = false) {
        val out = AWCColorMath.format(rt.hsva, format)
        if (out != value) {
            rt.lastEmitted = out; value = out
            emit("mdInput", mapOf("value" to out))
            if (commit) emit("mdChange", mapOf("value" to out))
        } else if (commit) emit("mdChange", mapOf("value" to out))
    }
    fun applyValue(input: String, doEmit: Boolean) {
        val parsed = AWCColorMath.parse(input)
        if (parsed != null) { rt.hsva = parsed; rt.hexInput = AWCColorMath.hex(parsed, withAlpha && parsed.a < 1); rt.hexInvalid = false; if (doEmit) emitValue() }
        else rt.hexInvalid = true
    }
    fun ratio(x: Double, w: Double) = if (w <= 0) 0.0 else if (rtl) (w - x) / w else x / w
    fun updatePlate(x: Double, y: Double, w: Double, h: Double) {
        rt.hsva = rt.hsva.copy(s = max(0.0, min(100.0, ratio(x, w) * 100)), v = max(0.0, min(100.0, 100 - y / h * 100))); syncHex(); emitValue()
    }
    fun updateTrack(part: String, x: Double, w: Double) {
        val r = max(0.0, min(1.0, ratio(x, w)))
        if (part == "hue") { rt.hsva = rt.hsva.copy(h = r * 360); syncHex() } else { rt.hsva = rt.hsva.copy(a = r); syncHex(true) }
        emitValue()
    }
    fun setOpen(v: Boolean) { if (v != open) { if (!v) rt.closingFrom = rt.focused; open = v } }
    fun escape(): Boolean { if (!(popover && open)) return false; setOpen(false); return true }
    fun stepKey(part: String, key: Key, shift: Boolean): Boolean {
        if (disabled) return false
        if (key == Key.Escape) return escape()
        val left = key == Key.DirectionLeft; val right = key == Key.DirectionRight
        when (part) {
            "plate" -> { val step = if (shift) 10.0 else 1.0; var s = rt.hsva.s; var v = rt.hsva.v
                when {
                    left -> s += if (rtl) step else -step
                    right -> s += if (rtl) -step else step
                    key == Key.DirectionDown -> v -= step
                    key == Key.DirectionUp -> v += step
                    key == Key.MoveHome -> s = 0.0
                    key == Key.MoveEnd -> s = 100.0
                    key == Key.PageDown -> v = 0.0
                    key == Key.PageUp -> v = 100.0
                    else -> return false
                }
                rt.hsva = rt.hsva.copy(s = max(0.0, min(100.0, s)), v = max(0.0, min(100.0, v))); syncHex(); emitValue(true); return true }
            "hue" -> { val step = if (shift) 15.0 else 1.0; var h = rt.hsva.h
                when { left -> h += if (rtl) step else -step; right -> h += if (rtl) -step else step; key == Key.MoveHome -> h = 0.0; key == Key.MoveEnd -> h = 360.0
                    // Vertical arrows do nothing on a horizontal slider (Chrome keeps focus; Compose would move it).
                    key == Key.DirectionUp || key == Key.DirectionDown -> return true; else -> return false }
                rt.hsva = rt.hsva.copy(h = (h.rem(360.0) + 360).rem(360.0)); syncHex(); emitValue(true); return true }
            else -> { val step = if (shift) 0.1 else 0.01; var a = rt.hsva.a
                when { left -> a += if (rtl) step else -step; right -> a += if (rtl) -step else step; key == Key.MoveHome -> a = 0.0; key == Key.MoveEnd -> a = 1.0
                    key == Key.DirectionUp || key == Key.DirectionDown -> return true; else -> return false }
                rt.hsva = rt.hsva.copy(a = max(0.0, min(1.0, a))); syncHex(true); emitValue(true); return true }
        }
    }
    fun hexEdited(text: String) {
        rt.hexInput = text
        val parsed = AWCColorMath.parse(if (text.startsWith("#")) text else "#$text")
        if (parsed != null) { rt.hsva = parsed; rt.hexInvalid = false; emitValue() } else rt.hexInvalid = true
    }
    fun hexBlurred() { if (rt.hexInvalid) syncHex(); emitValue(true) }
    fun channelValue(ch: String): String {
        val rgb = AWCColorMath.rgba(rt.hsva); val hsl = AWCColorMath.hsl(rt.hsva)
        return when (ch) {
            "r" -> rgb[0].toLong().toString(); "g" -> rgb[1].toLong().toString(); "b" -> rgb[2].toLong().toString()
            "h" -> AWCColorMath.jsRound(hsl.first).toLong().toString(); "s" -> AWCColorMath.jsRound(hsl.second).toLong().toString(); "l" -> AWCColorMath.jsRound(hsl.third).toLong().toString()
            else -> AWCColorMath.fixed2(rt.hsva.a)
        }
    }
    fun fromChannels(r: Double, g: Double, b: Double) {
        val hex = "#" + listOf(r, g, b).joinToString("") { String.format(java.util.Locale.ROOT, "%02x", it.toInt()) }
        AWCColorMath.parse(hex)?.let { rt.hsva = AWCHsva(it.h, it.s, it.v, rt.hsva.a); syncHex(); emitValue(true) }
    }
    /** Number input `change`: the value differs from the one it had when focus entered (or Enter after an edit). */
    fun channelCommit(ch: String) {
        val text = rt.editing[ch] ?: return
        val start = rt.editStart[ch] ?: channelValue(ch)
        rt.editing.remove(ch)
        if (text == start) return
        if (ch == "a") { val n = AWCColorMath.parseFloat(text); rt.hsva = rt.hsva.copy(a = max(0.0, min(1.0, if (n.isNaN()) 0.0 else n))); rt.hexInput = AWCColorMath.hex(rt.hsva, true); emitValue(true); return }
        val raw = AWCColorMath.parseInt(text) ?: 0.0
        if (ch in setOf("r", "g", "b")) {
            val num = max(0.0, min(255.0, raw)); val rgb = AWCColorMath.rgba(rt.hsva)
            fromChannels(if (ch == "r") num else rgb[0], if (ch == "g") num else rgb[1], if (ch == "b") num else rgb[2])
        } else {
            val hsl = AWCColorMath.hsl(rt.hsva)
            val v = AWCColorMath.hslToRgb(if (ch == "h") max(0.0, min(360.0, raw)) else hsl.first, if (ch == "s") max(0.0, min(100.0, raw)) else hsl.second,
                if (ch == "l") max(0.0, min(100.0, raw)) else hsl.third)
            fromChannels(v.first, v.second, v.third)
        }
    }
    /** Arrow keys in a number input step its value (an `input` event; `change` follows on blur or Enter). */
    fun stepChannel(ch: String, up: Boolean) {
        val current = rt.editing[ch] ?: channelValue(ch)
        if (rt.editing[ch] == null) rt.editStart[ch] = channelValue(ch)
        val (lo, hi, unit) = when (ch) { "a" -> Triple(0.0, 1.0, .01); "h" -> Triple(0.0, 360.0, 1.0); "s", "l" -> Triple(0.0, 100.0, 1.0); else -> Triple(0.0, 255.0, 1.0) }
        val n = AWCColorMath.parseFloat(current); val base = if (n.isNaN()) lo else n
        val next = max(lo, min(hi, base + if (up) unit else -unit))
        rt.editing[ch] = if (ch == "a") AWCColorMath.fixed2(next) else next.toLong().toString()
        // A keyboard spin of a number input fires `input` and `change` (Chrome): the stepped value commits at once.
        channelCommit(ch)
    }
    fun isSelected(preset: String): Boolean { val parsed = AWCColorMath.parse(preset) ?: return false; return AWCColorMath.hex(parsed, true) == AWCColorMath.hex(rt.hsva, true) }
    fun presetActivated(preset: String) { if (disabled) return; applyValue(preset, true); emitValue(true) }
    /** A press focuses its part without `:focus-visible` (an already focused part keeps its state, as in Chrome). */
    fun pointerFocusOn(part: String) { if (rt.focused != part) { rt.pointerFocus = true; runCatching { rt.requester(part).requestFocus() } } }
    fun focused(f: Boolean, part: String, visible: Boolean? = null) {
        if (f) { rt.focused = part; rt.focusVisible = visible ?: !rt.pointerFocus; rt.pointerFocus = false } else if (rt.focused == part) rt.focused = null
    }

    // External value / open (the source's @Watch): a change the picker did not emit re-parses; open changes emit mdOpenChange.
    val external = p["value"]?.toString()
    var seenExternal by remember { mutableStateOf(external) }
    if (external != seenExternal) {
        val ext = external; seenExternal = ext
        SideEffect { if (ext != null) { if (ext == rt.lastEmitted) rt.lastEmitted = "" else applyValue(ext, false) } }
    }
    var seenOpen by remember { mutableStateOf(open) }
    if (open != seenOpen) {
        val v = open; seenOpen = v
        SideEffect {
            if (popover) {
                val inside = rt.closingFrom ?: rt.focused; rt.closingFrom = null
                if (!v && !rt.dismissingOutside && inside != null && inside != "trigger") rt.refocusTrigger = true
                rt.dismissingOutside = false
                if (!v && rt.focused != "trigger") rt.focused = null
                rt.openSerial++
                emit("mdOpenChange", mapOf("open" to v))
            }
        }
    }
    val channelIDs = if (!p.bool("showInputs", true)) emptyList() else (if (format == "hsl") listOf("h", "s", "l") else listOf("r", "g", "b")) + (if (withAlpha) listOf("a") else emptyList())
    rt.value = value; rt.open = open; rt.selectedPresets = if (popover && !open) emptyList() else presets.filter { isSelected(it) }; rt.channels = channelIDs.map { rt.editing[it] ?: channelValue(it) }
    LocalAWCColorPickerInspector.current?.let { f -> SideEffect { f(rt) } }

    // Pointer coroutines outlive compositions, and awcState replaces its state object whenever the host echoes `value` / `open`:
    // handlers they call are read through rememberUpdatedState so they always act on the current composition.
    val onPlate by rememberUpdatedState<(Double, Double, Double, Double) -> Unit> { x, y, w, h -> updatePlate(x, y, w, h) }
    val onTrack by rememberUpdatedState<(String, Double, Double) -> Unit> { part, x, w -> updateTrack(part, x, w) }
    val onCommit by rememberUpdatedState<() -> Unit> { emitValue(true) }
    val onPreset by rememberUpdatedState<(String) -> Unit> { presetActivated(it) }
    val onDismiss by rememberUpdatedState<() -> Unit> { rt.dismissingOutside = true; setOpen(false) }

    // MARK: Parts
    fun Modifier.part(part: String) = this.onGloballyPositioned { c -> rt.boxes[part] = c.boundsInRoot().let { Rect(it.left / dens, it.top / dens, it.right / dens, it.bottom / dens) } }
    fun Modifier.hover(part: String) = pointerInput(part, disabled) {
        awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Final); val c = e.changes.firstOrNull() ?: continue
            if (c.type != PointerType.Mouse) continue
            val inside = c.position.x >= 0 && c.position.y >= 0 && c.position.x < size.width && c.position.y < size.height
            when (e.type) { PointerEventType.Exit -> if (rt.hovered == part) rt.hovered = null
                PointerEventType.Enter, PointerEventType.Move -> if (inside) rt.hovered = part else if (rt.hovered == part) rt.hovered = null; else -> {} } } }
    }
    fun Modifier.control(part: String, label: String, role: Role?, valueText: String?, selectedOption: Boolean? = null,
                         key: (Key, Boolean) -> Boolean): Modifier = this
        .focusRequester(rt.requester(part))
        .onFocusChanged { f -> focused(f.isFocused, part) }
        .then(if (disabled) Modifier.focusProperties { canFocus = false } else Modifier.focusable())
        .onKeyEvent { e -> if (e.type != KeyEventType.KeyDown || rt.focused != part) false else key(e.key, e.isShiftPressed) }
        .semantics(mergeDescendants = true) {
            contentDescription = label; if (role != null) this.role = role; if (valueText != null) stateDescription = valueText
            if (selectedOption != null) selected = selectedOption
            if (disabled) disabled()
        }
    @Composable fun ThumbFill(diameter: Double, fill: Color, pressed: Boolean, key: String) {
        val t by animateFloatAsState(if (pressed) 1f else 0f, if (reduced) snap() else tween(200, easing = CPStateEasing), label = "cp-thumb")
        val pc = primary
        val rest = listOf(NativeShadowLayer(0.0, 0.0, 0.0, 1.0, Color(0f, 0f, 0f, 0x66 / 255f), false)) + elevation(1)
        val pressedLayers = listOf(NativeShadowLayer(0.0, 0.0, 0.0, 6.0, pc.copy(alpha = 0x29 / 255f), false)) + elevation(2)
        // The presented press fraction is recorded where it is applied (the layer runs each frame of the transition).
        Box(Modifier.size(diameter.dp).graphicsLayer { rt.thumbPress[key] = t; scaleX = 1 + .15f * t; scaleY = 1 + .15f * t }
            .accordionShadow(CPCircle, { cardShadowLerp(rest, pressedLayers, t.toDouble()) }, false)
            .drawBehind { val r = size.minDimension / 2
                drawCircle(fill, r - 2.dp.toPx())
                drawCircle(thumbBorder, r - 1.dp.toPx(), style = Stroke(2.dp.toPx())) })
    }
    fun DrawScope.ring(part: String, inflate: Float, radius: Float?) {
        if (rt.focused != part || !rt.focusVisible) return
        val o = inflate.dp.toPx(); val w = 3.dp.toPx()
        val rect = Rect(-o - w / 2, -o - w / 2, size.width + o + w / 2, size.height + o + w / 2)
        val rr = radius?.let { (it.dp.toPx() - w / 2).coerceAtLeast(0f) } ?: (rect.height / 2)
        drawPath(Path().apply { addRoundRect(RoundRect(rect, CornerRadius(rr, rr))) }, secondary, style = Stroke(w))
    }

    @Composable fun Plate() {
        var plateSize by remember { mutableStateOf(Size.Zero) }
        val shape = RoundedCornerShape(16.dp)
        val hueColor = AWCColorMath.color(AWCHsva(rt.hsva.h, 100.0, 100.0, 1.0), false)
        Box(Modifier.fillMaxWidth().height(m.plateHeight.dp).inspectAWCNode(inspection, "plate", "plate").part("plate")
            .drawWithContent { drawContent(); ring("plate", 2f, 21f) }
            .control("plate", AWCColorPickerLabels.label(locale, "saturation"), null, null) { k, s -> stepKey("plate", k, s) }
            .hover("plate")
            .graphicsLayer { alpha = if (disabled) .5f else 1f }
            .clip(shape)
            .onGloballyPositioned { plateSize = Size(it.size.width / dens, it.size.height / dens) }
            .drawBehind {
                drawRect(hueColor)
                drawRect(Brush.horizontalGradient(if (rtl) listOf(Color.White.copy(alpha = 0f), Color.White) else listOf(Color.White, Color.White.copy(alpha = 0f))))
                drawRect(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0f), Color.Black)))
            }
            .pointerInput(disabled, rtl) {
                awaitEachGesture {
                    val down = awaitFirstDown(false)
                    if (disabled) return@awaitEachGesture
                    rt.active = "plate"; pointerFocusOn("plate")
                    val w = plateSize.width.toDouble(); val h = plateSize.height.toDouble()
                    onPlate(down.position.x / dens.toDouble(), down.position.y / dens.toDouble(), w, h)
                    while (true) {
                        val e = awaitPointerEvent(); val c = e.changes.firstOrNull { it.id == down.id } ?: break
                        if (!c.pressed) break
                        if (c.positionChanged()) onPlate(c.position.x / dens.toDouble(), c.position.y / dens.toDouble(), w, h)
                    }
                    if (rt.active == "plate") { rt.active = null; onCommit() }
                }
            }) {
            val t = m.thumb; val w = plateSize.width.toDouble(); val h = plateSize.height.toDouble()
            val x = if (rtl) w - w * rt.hsva.s / 100 + t / 2 - (t + 4) else w * rt.hsva.s / 100 - t / 2
            val y = h * (100 - rt.hsva.v) / 100 - t / 2
            CPAt(x, y, Modifier.matchParentSize()) {
                Box(Modifier.inspectAWCNode(inspection, "thumb", "thumb")) { ThumbFill(t + 4, AWCColorMath.color(rt.hsva, true), rt.active == "plate", "plate") }
            }
        }
    }

    @Composable fun Track(part: String) {
        var width by remember { mutableStateOf(0.0) }
        val t = m.thumb
        val hovered = rt.hovered == part && !disabled
        val layer by animateFloatAsState(if (hovered) .08f else 0f, if (reduced) snap() else tween(200, easing = CPStateEasing), label = "cp-track-hover")
        val ratioNow = if (part == "hue") rt.hsva.h / 360 else rt.hsva.a
        val valueText = if (part == "hue") AWCColorMath.jsRound(rt.hsva.h).toLong().toString() else AWCColorMath.fixed2(rt.hsva.a)
        val base = AWCColorMath.color(AWCHsva(rt.hsva.h, rt.hsva.s, rt.hsva.v, 1.0), false)
        val fill = if (part == "hue") AWCColorMath.color(AWCHsva(rt.hsva.h, 100.0, 100.0, 1.0), false) else AWCColorMath.color(rt.hsva, true)
        Box(Modifier.fillMaxWidth().height(14.dp).inspectAWCNode(inspection, part, part).part(part)
            .onGloballyPositioned { width = it.size.width / dens.toDouble() }
            .drawWithContent { drawContent(); ring(part, 4f, null) }
            .control(part, AWCColorPickerLabels.label(locale, if (part == "hue") "hue" else "opacity"), null, valueText) { k, s -> stepKey(part, k, s) }
            .semantics { progressBarRangeInfo = if (part == "hue") ProgressBarRangeInfo(rt.hsva.h.toFloat(), 0f..360f) else ProgressBarRangeInfo(rt.hsva.a.toFloat(), 0f..1f) }
            .hover(part)) {
            CPFaded(if (disabled) .5f else 1f, 16f, Modifier.matchParentSize()) { Box(Modifier.matchParentSize().drawBehind {
                val e = 4.dp.toPx()
                if (layer > 0f) drawRoundRect(onSurface.copy(alpha = layer), Offset(-e, -e), Size(size.width + 2 * e, size.height + 2 * e), CornerRadius(size.height / 2 + e))
                val capsule = Path().apply { addRoundRect(RoundRect(Rect(Offset.Zero, size), CornerRadius(size.height / 2))) }
                clipPath(capsule) {
                    if (part == "hue") drawRect(Brush.horizontalGradient(*(if (rtl) CPHue.map { (1f - it.first) to it.second }.reversed() else CPHue).toTypedArray()))
                    else {
                        cpChecker(0f, 0f)
                        drawRect(Brush.horizontalGradient(if (rtl) listOf(base, base.copy(alpha = 0f)) else listOf(base.copy(alpha = 0f), base)))
                    }
                }
            }) {
                val x = if (rtl) width - ratioNow * width + t / 2 - (t + 4) else ratioNow * width - t / 2
                CPAt(x, (14 - t - 4) / 2, Modifier.matchParentSize()) {
                    Box(Modifier.inspectAWCNode(inspection, "$part-thumb", "$part-thumb")) { ThumbFill(t + 4, fill, rt.active == part, part) }
                }
            } }
            // Hit area: the track plus the thumb's overflow above and below it.
            Box(Modifier.matchParentSize().layout { ms, c -> val e = (4 * density).roundToInt(); val pl = ms.measure(Constraints.fixed(c.maxWidth, c.maxHeight + 2 * e))
                layout(c.maxWidth, c.maxHeight) { pl.place(0, -e) } }
                .pointerInput(part, disabled, rtl) {
                    awaitEachGesture {
                        val down = awaitFirstDown(false)
                        if (disabled) return@awaitEachGesture
                        rt.active = part; pointerFocusOn(part)
                        onTrack(part, down.position.x / dens.toDouble(), width)
                        while (true) {
                            val e = awaitPointerEvent(); val c = e.changes.firstOrNull { it.id == down.id } ?: break
                            if (!c.pressed) break
                            if (c.positionChanged()) onTrack(part, c.position.x / dens.toDouble(), width)
                        }
                        if (rt.active == part) { rt.active = null; onCommit() }
                    }
                })
        }
    }

    @Composable fun Preview() {
        Box(Modifier.size(42.dp).inspectAWCNode(inspection, "preview", "preview")
            .semantics { contentDescription = "${AWCColorPickerLabels.label(locale, "current")} ${AWCColorMath.format(rt.hsva, format)}" }
            .drawBehind {
                val one = 1.dp.toPx(); val inner = Path().apply { addOval(Rect(one, one, size.width - one, size.height - one)) }
                clipPath(inner) { cpChecker(1f, 1f); drawRect(AWCColorMath.color(rt.hsva, true)) }
                drawCircle(outline, size.minDimension / 2 - one / 2, style = Stroke(one))
            })
    }

    val inputInk = hook(appearance.onSurface) ?: role("on-surface", "#1C1B1F")
    @Composable fun FieldLabel(text: String) {
        Text(text.uppercase(java.util.Locale.ROOT), Modifier.fillMaxWidth().height(16.dp).clearAndSetSemantics { }, maxLines = 1,
            style = TextStyle(fontFamily = AccordionRoboto, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp, letterSpacing = .5.sp,
                color = role("on-surface-variant", "#49454F"), platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false), lineHeightStyle = CPLineBox))
    }
    @Composable fun InputBox(id: String, text: String, label: String, mono: Boolean, centered: Boolean, invalid: Boolean,
                             edited: (String) -> Unit, focusChanged: (Boolean) -> Unit, command: (Key) -> Boolean) {
        val focusedHere = rt.focused == id; val hovered = rt.hovered == id && !disabled
        val border = if (invalid) error else if (focusedHere) primary else if (hovered) outlineStrong else outline
        var field by remember(id) { mutableStateOf(TextFieldValue(text)) }
        if (field.text != text) field = TextFieldValue(text, TextRange(text.length))
        val shape = RoundedCornerShape(4.dp)
        Box(Modifier.fillMaxWidth().height(m.inputHeight.dp).inspectAWCNode(inspection, "input-$id", "input-$id").part("input-$id")
            .graphicsLayer { alpha = if (disabled) .5f else 1f }
            .drawWithContent { drawContent()
                if (focusedHere) { val o = 1.dp.toPx(); drawRoundRect(if (invalid) error else primary, Offset(-o / 2, -o / 2), Size(size.width + o, size.height + o), CornerRadius(5.dp.toPx() - o / 2), style = Stroke(o)) } }
            .background(role("surface-container-lowest", "#FFFFFF"), shape)
            .drawBehind { val o = 1.dp.toPx(); drawRoundRect(border, Offset(o / 2, o / 2), Size(size.width - o, size.height - o), CornerRadius(4.dp.toPx() - o / 2), style = Stroke(o)) }
            .hover(id), contentAlignment = Alignment.CenterStart) {
            BasicTextField(field, { v -> val changed = v.text != field.text; field = v; if (changed) edited(v.text) },
                Modifier.fillMaxWidth().padding(horizontal = 6.dp).height(15.dp).focusRequester(rt.requester(id))
                    // Compose reports the initial unfocused state on attach: only a real focus change is a focus / blur.
                    .onFocusChanged { f -> if (f.isFocused || rt.focused == id) { focused(f.isFocused, id, true); if (f.isFocused) rt.pointerFocus = false; focusChanged(f.isFocused) } }
                    .onPreviewKeyEvent { e -> if (e.type != KeyEventType.KeyDown) false else command(e.key) }
                    .semantics { contentDescription = label },
                enabled = !disabled, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = if (mono) KeyboardType.Ascii else KeyboardType.Number),
                textStyle = TextStyle(fontFamily = if (mono) FontFamily.Monospace else AccordionRoboto, fontSize = 13.sp, lineHeight = 15.sp,
                    letterSpacing = if (mono) .65.sp else 0.sp, color = inputInk, textAlign = if (centered) TextAlign.Center else TextAlign.Start,
                    platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false), lineHeightStyle = CPLineBox),
                cursorBrush = SolidColor(inputInk))
        }
    }

    @Composable fun Presets() {
        FlowRow(Modifier.fillMaxWidth().inspectAWCNode(inspection, "presets", "presets").semantics { contentDescription = AWCColorPickerLabels.label(locale, "presets") },
            horizontalArrangement = Arrangement.spacedBy(m.gapSm.dp), verticalArrangement = Arrangement.spacedBy(m.gapSm.dp)) {
            presets.forEachIndexed { i, preset ->
                val id = "preset-$i"; val selected = isSelected(preset); val hovered = rt.hovered == id && !disabled; val pressed = rt.active == id && !disabled
                val targetScale = if (pressed) 1.05f else if (hovered) (if (selected) 1.18f else if (reduced) 1.06f else 1.15f) else if (selected) 1.1f else 1f
                // The hover tilt is for an unselected swatch (a selected one grows to 1.18 upright).
                val targetAngle = if (pressed) 0f else if (hovered && !selected && !reduced) -4f else 0f
                val spec = if (reduced) snap<Float>() else tween(350, easing = CPSpringEasing)
                val sc by animateFloatAsState(targetScale, spec, label = "cp-preset-scale"); val an by animateFloatAsState(targetAngle, spec, label = "cp-preset-angle")
                val swatch = AWCColorMath.parse(preset)?.let { AWCColorMath.color(it, true) } ?: Color.Transparent
                val rings = if (selected) listOf(NativeShadowLayer(0.0, 0.0, 0.0, 2.0, surface, false), NativeShadowLayer(0.0, 0.0, 0.0, 4.0, primary, false)) + elevation(1)
                    else if (hovered) elevation(1) else emptyList()
                val d = m.preset
                Box(Modifier.size(d.dp).part(id)
                    .control(id, preset, Role.RadioButton, null, selected) { k, _ ->
                        when (k) { Key.Enter, Key.NumPadEnter, Key.Spacebar -> { presetActivated(preset); true }; Key.Escape -> escape()
                            // Presets are separate tab stops without arrow navigation: arrows do nothing (Compose would move focus).
                            Key.DirectionLeft, Key.DirectionRight, Key.DirectionUp, Key.DirectionDown -> true; else -> false } }
                    .hover(id)
                    .pointerInput(i, preset, disabled) {
                        awaitEachGesture {
                            val down = awaitFirstDown(false)
                            if (disabled) return@awaitEachGesture
                            rt.active = id; pointerFocusOn(id)
                            var last = down
                            while (true) { val e = awaitPointerEvent(); val c = e.changes.firstOrNull { it.id == down.id } ?: break; last = c; if (!c.pressed) break }
                            if (rt.active == id) { rt.active = null
                                val q = last.position; if (q.x >= 0 && q.y >= 0 && q.x < size.width && q.y < size.height) onPreset(preset) }
                        }
                    }) {
                    // CSS: transform (scale, rotate) and opacity on the swatch, box-shadow rings and the focus outline transformed with it.
                    CPFaded(if (disabled) .5f else 1f, 16f, Modifier.matchParentSize(), { rt.presetMotion[i] = sc to an; scaleX = sc; scaleY = sc; rotationZ = an }) {
                        Box(Modifier.matchParentSize().inspectAWCNode(inspection, id, id)
                            .accordionShadow(CPCircle, rings, false)
                            .drawWithContent { drawContent(); ring(id, 3f, null) }
                            .drawBehind { drawCircle(swatch); drawCircle(outline, size.minDimension / 2 - .5.dp.toPx(), style = Stroke(1.dp.toPx())) })
                    }
                }
            }
        }
    }

    @Composable fun Panel(inPopover: Boolean) {
        Column((if (inPopover) Modifier.fillMaxWidth().inspectAWCNode(inspection, "panel", "panel") else Modifier.widthIn(max = m.width.dp).fillMaxWidth()
            .inspectAWCNode(inspection, "panel", "panel").background(surface, RoundedCornerShape(m.radius.dp)).padding(m.padding.dp)),
            verticalArrangement = Arrangement.spacedBy(m.gap.dp)) {
            Plate()
            Row(Modifier.fillMaxWidth().height(42.dp).inspectAWCNode(inspection, "sliders", "sliders"), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(m.gap.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(m.gapMd.dp)) { Track("hue"); if (withAlpha) Track("alpha") }
                Preview()
            }
            if (p.bool("showHex", true)) Column(Modifier.fillMaxWidth().height(m.fieldHeight.dp).inspectAWCNode(inspection, "field-hex", "field-hex"),
                verticalArrangement = Arrangement.spacedBy(m.gapXs.dp)) {
                FieldLabel("Hex")
                InputBox("hex", rt.hexInput, "Hex", true, false, rt.hexInvalid, { hexEdited(it) }, { f -> if (!f) hexBlurred() }) { k ->
                    when (k) { Key.Enter, Key.NumPadEnter -> { focusManager.clearFocus(); true }; Key.Escape -> escape(); else -> false } }
            }
            if (channelIDs.isNotEmpty()) Row(Modifier.fillMaxWidth().height(m.fieldHeight.dp).inspectAWCNode(inspection, "inputs", "inputs"),
                horizontalArrangement = Arrangement.spacedBy(m.gapSm.dp)) {
                for (ch in channelIDs) Column(Modifier.weight(1f).inspectAWCNode(inspection, "field-$ch", "field-$ch"), verticalArrangement = Arrangement.spacedBy(m.gapXs.dp)) {
                    FieldLabel(ch)
                    InputBox(ch, rt.editing[ch] ?: channelValue(ch), ch.uppercase(java.util.Locale.ROOT), false, true, false,
                        { t -> if (rt.editing[ch] == null) rt.editStart[ch] = channelValue(ch); rt.editing[ch] = t },
                        { f -> if (f) rt.editStart[ch] = channelValue(ch) else channelCommit(ch) }) { k ->
                        when (k) { Key.Enter, Key.NumPadEnter -> { channelCommit(ch); true }; Key.Escape -> escape()
                            Key.DirectionUp -> { stepChannel(ch, true); true }; Key.DirectionDown -> { stepChannel(ch, false); true }; else -> false } }
                }
            }
            if (presets.isNotEmpty()) Presets()
        }
    }

    if (!popover) {
        Box(Modifier.semantics { contentDescription = ariaLabel }) { Panel(false) }
        return
    }
    // Popover: the trigger slot is the host; the panel opens below it (bottom + 8), aligned to the inline start, above the content.
    val outsideRegistry = LocalAWCColorPickerOutside.current
    val pop = remember(open) { Animatable(if (reduced || !open) 1f else 0f) }
    LaunchedEffect(open) { if (open && !reduced) pop.animateTo(1f, tween(300, easing = CPPopEasing)) }
    var hostBox by remember { mutableStateOf(Rect.Zero) }; var panelBox by remember { mutableStateOf(Rect.Zero) }
    if (outsideRegistry != null && open && p.bool("dismissOnOutsideClick") && !disabled) {
        val entry = remember(outsideRegistry) { AWCColorPickerOutsideRegistry.Entry({ pt -> hostBox.contains(pt) || panelBox.contains(pt) }) { onDismiss() } }
        DisposableEffect(entry) { outsideRegistry.entries += entry; onDispose { outsideRegistry.entries -= entry } }
    }
    // Focus returns to the trigger once the closed panel has left the composition (a request in the same frame is lost).
    LaunchedEffect(rt.refocusTrigger) { if (rt.refocusTrigger) { withFrameNanos { }; runCatching { rt.requester("trigger").requestFocus() }; rt.refocusTrigger = false } }
    Layout(content = {
        Box(Modifier.focusRequester(rt.requester("trigger")).focusGroup().onFocusChanged { f -> if (f.hasFocus) rt.focused = "trigger" else if (rt.focused == "trigger") rt.focused = null }
            .onKeyEvent { e -> e.type == KeyEventType.KeyDown && e.key == Key.Escape && escape() }
            .onGloballyPositioned { hostBox = it.boundsInRoot() }) {
            AWCActionScope(onAction = { e -> if (e.name == "mdClick" && !disabled) setOpen(!open) }) { slot?.invoke("trigger") }
        }
        if (open) {
            val shape = AWCCornerShape.uniform(m.radius)
            val shadows = appearance.popoverElevation?.let { NativeShadowLayer.parse(it) } ?: elevation(3)
            Box(Modifier.width(m.width.dp).onGloballyPositioned { panelBox = it.boundsInRoot() }
                .graphicsLayer {
                    val pr = pop.value; val s = .8f + .2f * pr
                    rt.popIn = pr
                    scaleX = s; scaleY = s; alpha = pr; translationY = s * -8f * (1 - pr) * density
                    transformOrigin = TransformOrigin(if (rtl) 1f else 0f, 0f)
                }
                .inspectAWCNode(inspection, "popover", "popover")
                .accordionShadow(shape, shadows, false)
                .background(surface, RoundedCornerShape(m.radius.dp))
                .padding(m.padding.dp)
                .semantics { contentDescription = ariaLabel; paneTitle = ariaLabel }) { Panel(true) }
        }
    }, modifier = Modifier.zIndex(if (open) 1f else 0f)) { ms, c ->
        val trigger = ms[0].measure(c.copy(minWidth = 0, minHeight = 0))
        val panel = ms.getOrNull(1)?.measure(Constraints())
        layout(trigger.width, trigger.height) {
            trigger.placeRelative(0, 0)
            panel?.placeRelative(0, trigger.height + (8 * density).roundToInt(), 1f)
        }
    }
}
