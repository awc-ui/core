package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.*
import androidx.compose.ui.unit.*
import java.math.BigDecimal
import java.math.BigInteger
import java.math.MathContext
import java.math.RoundingMode
import kotlin.math.*

internal object NativeBadgeValue {
    private val whitespace = "\u0009\u000A\u000B\u000C\u000D \u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF"
    /** CSS nowrap collapses segment whitespace while preserving nonbreaking spaces. */
    fun visual(value: String): String = value.replace(Regex("[ \t\r\n\u000C]+"), " ").trim(' ')
    fun number(value: String): Double? {
        val text = value.trim { it in whitespace }
        if (text.isEmpty()) return 0.0
        for ((prefix, radix) in listOf("0x" to 16, "0b" to 2, "0o" to 8)) {
            if (text.startsWith(prefix, ignoreCase = true)) {
                val digits = text.drop(2)
                if (digits.isEmpty() || digits.any { it.digitToIntOrNull(radix) == null }) return null
                return BigInteger(digits, radix).toDouble().takeIf { it.isFinite() }
            }
        }
        if (!text.matches(Regex("[+-]?(?:[0-9]+\\.?[0-9]*|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?"))) return null
        return text.toDoubleOrNull()?.takeIf { it.isFinite() }
    }
    fun formatted(value: Double): String {
        if (value.isNaN()) return "NaN"
        if (value == Double.POSITIVE_INFINITY) return "Infinity"
        if (value == Double.NEGATIVE_INFINITY) return "-Infinity"
        if (value == 0.0) return "0"
        // Choose the shortest decimal that round-trips to this IEEE-754 value.
        // Java's older Double formatter differs from Number#toString at 1e23
        // and subnormal values, so do not forward its exponent spelling.
        val exact = BigDecimal(value)
        val shortest = (1..17).asSequence().map {
            exact.round(MathContext(it, RoundingMode.HALF_EVEN))
        }.first { it.toDouble() == value }.stripTrailingZeros()
        if (abs(value) >= 1e-6 && abs(value) < 1e21) return shortest.toPlainString()
        val digits = shortest.unscaledValue().abs().toString()
        val exponent = digits.length - shortest.scale() - 1
        val mantissa = digits.take(1) + if (digits.length > 1) "." + digits.drop(1) else ""
        return (if (value < 0) "-" else "") + mantissa + "e" + (if (exponent >= 0) "+" else "") + exponent
    }
    fun display(properties: Map<String, AWCValue>): String {
        val value = properties.str("value")
        if (properties.str("variant") == "small" || value.isEmpty()) return ""
        val maximum = (properties["max"] as? Number)?.toDouble() ?: 999.0
        if (number(value)?.let { it > maximum } == true) return formatted(maximum) + "+"
        val units = value.take(4)
        return buildString {
            var i = 0
            while (i < units.length) {
                val character = units[i++]
                if (character.isHighSurrogate() && i < units.length && units[i].isLowSurrogate()) {
                    append(character); append(units[i++])
                } else append(if (character.isSurrogate()) '\uFFFD' else character)
            }
        }
    }
}

internal data class NativeBadgeMetrics(val small: Boolean, val height: Double, val iconSize: Double, val fontSize: Double, val density: Double) {
    companion object {
        fun from(properties: Props, appearance: AWCBadgeAppearance, inheritedDensity: Double = 0.0): NativeBadgeMetrics {
            // Source density=0 has no overriding CSS rule, so it inherits the
            // containing control's density just like an omitted attribute.
            val density = resolveAWCDensity(properties["density"], inheritedDensity)
            val small = properties.str("variant") == "small"
            return NativeBadgeMetrics(small,
                if (small) appearance.smallSize ?: max(4.0, 6 + density * .5) else appearance.largeHeight ?: max(12.0, 16 + density),
                appearance.iconSize ?: max(8.0, 10 + density * .5), max(9.0, 11 + density * .5), density)
        }
    }
}

/** Layout metadata belongs to each badge, so siblings may use different anchors. */
internal data class NativeBadgePlacement(val circle: Boolean, val x: AWCBadgeOffset, val y: AWCBadgeOffset) {
    companion object {
        fun from(p: Props, appearance: AWCBadgeAppearance) = NativeBadgePlacement(p.str("shape") == "circle",
            appearance.offsetX ?: AWCBadgeOffset(fraction = .5), appearance.offsetY ?: AWCBadgeOffset(fraction = -.5))
    }
    fun position(parentWidth: Int, parentHeight: Int, width: Int, height: Int, density: Float): IntOffset {
        val inset = if (circle) .146447 else 0.0
        fun safe(value: Double) = value.coerceIn(-32766.0, 32766.0).roundToInt()
        return IntOffset(safe(parentWidth * (1 - inset) - width + x.points * density + x.fraction * width),
            safe(parentHeight * inset + y.points * density + y.fraction * height))
    }
}
internal val LocalAWCBadgeHost = staticCompositionLocalOf { false }

/** Keep the parent's intrinsic size and overlay noninteractive, physically anchored badges. */
@Composable
fun AWCBadgeHost(modifier: Modifier = Modifier, badge: @Composable () -> Unit, content: @Composable () -> Unit) {
    SubcomposeLayout(modifier) { constraints ->
        val parent = subcompose("parent", content).map { it.measure(constraints) }
        val width = constraints.constrainWidth(parent.maxOfOrNull { it.width } ?: 0)
        val height = constraints.constrainHeight(parent.maxOfOrNull { it.height } ?: 0)
        val decorations = subcompose("badges") {
            CompositionLocalProvider(LocalAWCBadgeHost provides true, content = badge)
        }.map { it.layoutId to it.measure(Constraints()) }
        layout(width, height) {
            parent.forEach { it.place(0, 0) }
            decorations.forEach { (metadata, child) ->
                val placement = metadata as? NativeBadgePlacement ?: NativeBadgePlacement(false, AWCBadgeOffset(fraction = .5), AWCBadgeOffset(fraction = -.5))
                val offset = placement.position(width, height, child.width, child.height, density)
                child.place(offset.x, offset.y)
            }
        }
    }
}

private val BadgeFont = FontFamily(Font(R.font.awc_roboto_medium, FontWeight.Medium))

@Composable internal fun NativeBadge(p: Props, slot: Slot?) {
    if (p.bool("hidden")) return
    val a = LocalAWCBadgeAppearance.current.normalized()
    val m = NativeBadgeMetrics.from(p, a, LocalAWCNativeDensity.current)
    val display = NativeBadgeValue.display(p)
    val visualLabel = NativeBadgeValue.visual(display)
    val accessibleLabel = if (m.small) "notification" else display.ifEmpty { p.str("icon") }
    val inspection = LocalAWCInspection.current
    val registry = LocalAWCSlots.current
    val rtl = when (p.str("dir")) { "rtl" -> true; "ltr" -> false; else -> LocalLayoutDirection.current == LayoutDirection.Rtl }
    val direction = if (rtl) "rtl" else "ltr"
    val colors = MaterialTheme.colorScheme
    fun color(value: String?, fallback: Color) = value?.let { Color(0xff000000L or it.drop(1).toLong(16)) } ?: fallback
    val labelInk = color(a.labelColor, colors.onError)
    val iconInk = color(a.iconColor, labelInk)
    val container = color(a.containerColor, colors.error)
    val density = LocalDensity.current
    val font = m.fontSize.toFloat().sp
    val typography = AWCInspectionTypography(m.fontSize, m.fontSize, 500, .5, "Roboto Medium (bundled)")
    val style = TextStyle(fontFamily = BadgeFont, fontWeight = FontWeight.Medium, fontSize = font, lineHeight = font,
        letterSpacing = .5.sp, textMotion = TextMotion.Animated, platformStyle = PlatformTextStyle(includeFontPadding = false),
        lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None))
    val semantic = if (accessibleLabel.isNotEmpty()) Modifier.clearAndSetSemantics {
        liveRegion = LiveRegionMode.Polite; contentDescription = accessibleLabel
    } else Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }
    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        SubcomposeLayout(Modifier
            .background(container, RoundedCornerShape((a.cornerRadius ?: 9999.0).toFloat().dp))
            .then(semantic)
        ) { _ ->
            fun px(value: Double) = (value * density.density).coerceIn(0.0, 32766.0).roundToInt()
            val iconPx = px(m.iconSize)
            val authored = if (m.small) emptyList() else subcompose("authored-icon") {
                CompositionLocalProvider(LocalAWCButtonSlotSize provides m.iconSize.toFloat().dp,
                    LocalContentColor provides iconInk, LocalAWCButtonSlotPart provides "slot-icon",
                    LocalAWCSlots provides null, LocalAWCInspection provides null) {
                    ProvideTextStyle(style.copy(fontSize = m.iconSize.toFloat().sp, lineHeight = m.iconSize.toFloat().sp)) {
                        if (registry?.contains("icon") == true) registry.Render("icon") else slot?.invoke("icon")
                    }
                }
            }
            val hasAuthored = authored.isNotEmpty() || registry?.contains("icon") == true
            val fallback = if (!m.small && !hasAuthored && p.str("icon").isNotEmpty()) subcompose("fallback-icon") {
                CompositionLocalProvider(LocalContentColor provides iconInk, LocalAWCButtonSlotSize provides m.iconSize.toFloat().dp,
                    LocalAWCButtonSlotPart provides "icon") { AWCMaterialSymbol(p.str("icon")) }
            } else emptyList()
            val blank = if (!m.small && hasAuthored && authored.isEmpty()) subcompose("empty-authored-icon") { Box(Modifier) } else emptyList()
            val icons = (authored + fallback + blank).map { it.measure(Constraints.fixed(iconPx, iconPx)) }
            val label = if (!m.small && visualLabel.isNotEmpty()) subcompose("label") {
                Text(visualLabel, color = labelInk, style = style, softWrap = false, maxLines = 1,
                    modifier = Modifier.inspectAWCNode(inspection, "label", "md-badge ::part(label)",
                        AWCInspectionMetrics(typography = typography, display = "Text", direction = direction)))
            }.map { it.measure(Constraints.fixedHeight(with(density) { font.toPx() }.roundToInt().coerceIn(0, 32766))) } else emptyList()
            val hasContent = !m.small && (display.isNotEmpty() || p.str("icon").isNotEmpty() || hasAuthored)
            val inset = max(2.0, 4 + m.density * .5)
            val padding = if (!hasContent) AWCBadgePadding() else a.largePadding ?: AWCBadgePadding(right = inset, left = inset)
            val left = px(padding.left); val right = px(padding.right); val top = px(padding.top); val bottom = px(padding.bottom)
            val children = icons + label
            val contentWidth = children.sumOf { it.width }
            val width = max(px(m.height), left + right + contentWidth).coerceAtMost(32766)
            val height = max(px(m.height), top + bottom).coerceAtMost(32766)
            // Publish final box measurements in the same layout pass as the
            // captured pixels; a later state update can invalidate frame evidence.
            val rootMarker = subcompose("root-inspection") {
                Box(Modifier.inspectAWCNode(inspection, "", "md-badge", AWCInspectionMetrics(
                    padding = AWCInspectionInsets(top / density.density.toDouble(), right / density.density.toDouble(),
                        bottom / density.density.toDouble(), left / density.density.toDouble()),
                    margin = AWCInspectionInsets(), border = AWCInspectionInsets(), typography = if(m.small) null else typography,
                    display = "Compose Layout", direction = direction)))
            }.map { it.measure(Constraints.fixed(width, height)) }
            val part = if (hasAuthored) "slot-icon" else "icon"
            val markers = if (icons.isEmpty()) emptyList() else subcompose("icon-inspection-$part") {
                repeat(icons.size) { index ->
                    Box(Modifier.inspectAWCNode(inspection, if (icons.size == 1) part else "$part-$index",
                        if (hasAuthored) "Authored badge icon" else "md-badge ::part(icon)",
                        AWCInspectionMetrics(display = "Slot", direction = direction)))
                }
            }.map { it.measure(Constraints.fixed(iconPx, iconPx)) }
            layout(width, height) {
                rootMarker.forEach { it.place(0, 0) }
                var x = left + (width - left - right - contentWidth) / 2
                children.forEachIndexed { index, child ->
                    val actualX = if (rtl) width - x - child.width + left - right else x
                    val y = top + (height - top - bottom - child.height) / 2
                    if (index < markers.size) markers[index].place(actualX, y)
                    child.place(actualX, y)
                    x += child.width
                }
            }
        }
    }
}
