package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import androidx.compose.material3.MaterialTheme
import dev.awc.nativeui.generated.AWCGeneratedTokens
import kotlin.math.*

internal data class NativeStatusDotMetrics(
    val diameter: Double, val outlineWidth: Double, val inline: Boolean,
    val insetEnd: AWCStatusDotInset, val insetBlockEnd: AWCStatusDotInset,
    val state: String, val live: Boolean, val label: String, val pulseDuration: Double, val direction: String,
) {
    companion object {
        fun from(p: Props, appearance: AWCStatusDotAppearance, inheritedDensity: Double = 0.0,
                 displayScale: Double = 1.0): NativeStatusDotMetrics {
            val a = appearance.normalized()
            val density = resolveAWCDensity(p["density"], inheritedDensity)
            val small = p.str("size") == "small"; val large = p.str("size") == "large"
            val inline = p.bool("inline")
            val size = a.size ?: if (small) max(4.0, 8 + density)
                else if (large) max(8.0, 16 + density * 2) else max(6.0, 12 + density * 1.5)
            val width = a.outlineWidth ?: if (inline) 0.0 else if (small) max(1.0, 1.5 + density * .125)
                else if (large) max(1.5, 3 + density * .375) else max(1.0, 2 + density * .25)
            val scale = displayScale.takeIf { it.isFinite() && it > 0 } ?: 1.0
            val appliedOutline = if (width == 0.0) 0.0 else max(1.0, floor(width * scale)) / scale
            val inset = if (p.str("shape") == "circle") AWCStatusDotInset(-size / 2, .146447)
                else AWCStatusDotInset(if (large) -3.0 else -2.0)
            val whitespace = "\u0009\u000A\u000B\u000C\u000D \u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF"
            val source = p.str("label")
            return NativeStatusDotMetrics(size, appliedOutline, inline, a.insetEnd ?: inset,
                a.insetBlockEnd ?: inset, p.str("state", "neutral"), p.bool("live"),
                if (source.trim { it in whitespace }.isEmpty()) "" else source, a.pulseDuration ?: 1.6, p.str("dir"))
        }
    }
    fun position(parentWidth: Double, parentHeight: Double, rtl: Boolean): Pair<Double, Double> {
        val end = insetEnd.resolved(parentWidth); val bottom = insetBlockEnd.resolved(parentHeight)
        return Pair(if (rtl) end else parentWidth - end - diameter, parentHeight - bottom - diameter)
    }
}

internal data class NativeStatusDotPulse(val spread: Double, val opacity: Double) {
    companion object {
        fun at(value: Double): NativeStatusDotPulse {
            val p = value.coerceIn(0.0, 1.0); val first = p < .7
            val x = if (first) p / .7 else (p - .7) / .3
            var low = 0.0; var high = 1.0
            repeat(24) {
                val t = (low + high) / 2
                if (3 * (1 - t) * t * t * .58 + t * t * t < x) low = t else high = t
            }
            val t = (low + high) / 2; val eased = 3 * (1 - t) * t * t + t * t * t
            return NativeStatusDotPulse(if (first) 8 * eased else 8 * (1 - eased), if (first) 1 - eased else 0.0)
        }
    }
}

internal val LocalAWCStatusDotHost = staticCompositionLocalOf { false }

/** An anchored dot overlays this measured parent without affecting its intrinsic size. */
@Composable
fun AWCStatusDotHost(modifier: Modifier = Modifier, dot: @Composable () -> Unit, content: @Composable () -> Unit) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    SubcomposeLayout(modifier) { constraints ->
        val parent = subcompose("parent", content).map { it.measure(constraints) }
        val width = constraints.constrainWidth(parent.maxOfOrNull { it.width } ?: 0)
        val height = constraints.constrainHeight(parent.maxOfOrNull { it.height } ?: 0)
        val dots = subcompose("dot") {
            CompositionLocalProvider(LocalAWCStatusDotHost provides true, content = dot)
        }.map { it.layoutId to it.measure(Constraints()) }
        layout(width, height) {
            parent.forEach { it.place(0, 0) }
            dots.forEach { (metadata, child) ->
                val m = metadata as? NativeStatusDotMetrics
                if (m == null || m.inline) child.place(0, 0) else {
                    val effectiveRTL = when(m.direction) { "rtl" -> true; "ltr" -> false; else -> rtl }
                    val (x, y) = m.position(width / density.toDouble(), height / density.toDouble(), effectiveRTL)
                    child.place((x * density).coerceIn(-32766.0, 32766.0).roundToInt(),
                        (y * density).coerceIn(-32766.0, 32766.0).roundToInt())
                }
            }
        }
    }
}

internal fun statusDotColor(hex: String): Color {
    val value = hex.drop(1).toLong(16)
    return if (hex.length == 9) Color(((value and 255) shl 24) or (value shr 8))
        else Color(0xff000000L or value)
}

@Composable internal fun NativeStatusDot(p: Props) {
    if (p.bool("hidden")) return
    val a = LocalAWCStatusDotAppearance.current.normalized()
    val density = LocalDensity.current.density.toDouble()
    val m = NativeStatusDotMetrics.from(p, a, LocalAWCNativeDensity.current, density)
    val colors = MaterialTheme.colorScheme
    val semantic = when (m.state) {
        "online" -> Color(0xff2dc653); "away" -> Color(0xfff4b400); "busy" -> Color(0xffdb4437)
        else -> null
    }
    val color = a.color?.let(::statusDotColor) ?: semantic ?: when (m.state) {
        "invisible" -> colors.surface; "offline" -> colors.outline; else -> colors.onSurfaceVariant
    }
    val outline = a.outlineColor?.let(::statusDotColor) ?: colors.surface
    val pulseColor = a.pulseColor?.let(::statusDotColor) ?: semantic?.copy(alpha = .55f) ?: Color.Transparent
    val enabled = m.live && m.pulseDuration > 0 && ValueAnimator.areAnimatorsEnabled()
    val phase = if (enabled) {
        val transition = rememberInfiniteTransition(label = "status dot pulse")
        transition.animateFloat(0f, 1f,
            infiniteRepeatable(tween((m.pulseDuration * 1000).coerceIn(1.0, Int.MAX_VALUE.toDouble()).roundToInt(),
                easing = LinearEasing)), label = "status dot phase").value.toDouble()
    } else 0.0
    val durationToken = AWCGeneratedTokens.light["--md-sys-motion-duration-short2"] ?: "200ms"
    val duration = if (durationToken.endsWith("ms")) durationToken.dropLast(2).toDoubleOrNull()
        else durationToken.removeSuffix("s").toDoubleOrNull()?.times(1000)
    val timing = tween<Color>((duration ?: 200.0).roundToInt(), easing = CubicBezierEasing(.2f, 0f, 0f, 1f))
    val fill by animateColorAsState(color, timing, label = "status dot fill")
    val halo by animateColorAsState(outline, timing, label = "status dot outline")
    val inspection = LocalAWCInspection.current
    val rtl = when (p.str("dir")) { "rtl" -> true; "ltr" -> false; else -> LocalLayoutDirection.current == LayoutDirection.Rtl }
    val semantics = if (m.label.isEmpty()) Modifier.clearAndSetSemantics { }
        else Modifier.clearAndSetSemantics {
            contentDescription = m.label
            if (m.live) liveRegion = LiveRegionMode.Polite else role = Role.Image
        }
    Layout(content = {}, modifier = semantics
        .inspectAWCNode(inspection, "", "md-status-dot", AWCInspectionMetrics(
            padding = AWCInspectionInsets(), margin = AWCInspectionInsets(), border = AWCInspectionInsets(),
            display = "Compose Circle", direction = if (rtl) "rtl" else "ltr"), allowZeroSize = true)
        .drawBehind {
            val radius = size.width / 2; val center = Offset(radius, radius)
            if (enabled) {
                val pulse = NativeStatusDotPulse.at(phase)
                val spread = (pulse.spread * density).toFloat()
                val path = Path().apply {
                    fillType = PathFillType.EvenOdd
                    addOval(Rect(center.x - radius - spread, center.y - radius - spread,
                        center.x + radius + spread, center.y + radius + spread))
                    addOval(Rect(0f, 0f, size.width, size.height))
                }
                drawPath(path, pulseColor.copy(alpha = pulseColor.alpha * pulse.opacity.toFloat()))
            }
            drawCircle(fill, radius, center)
            if (m.state == "invisible" && !enabled) {
                val stroke = min(2f * density.toFloat(), size.width)
                drawCircle(colors.outline, (radius - stroke / 2).coerceAtLeast(0f), center, style = Stroke(stroke))
            }
            val stroke = (m.outlineWidth * density).toFloat()
            if (stroke > 0) drawCircle(halo, radius + stroke / 2, center, style = Stroke(stroke))
        }
    ) { _, _ ->
        val pixels = (m.diameter * density).coerceIn(0.0, 32766.0).roundToInt()
        layout(pixels, pixels) {}
    }
}
