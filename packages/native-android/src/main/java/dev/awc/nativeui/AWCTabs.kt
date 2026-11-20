@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextMotion
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// MARK: hooks

/** md-tab's nine public hooks (`--md-tab-*`): colours `#RRGGBB(AA)`, the indicator height in dp, the indicator glide duration in
 *  ms (400 by default; `--md-tab-glide-x` / `-scale` are written inline by md-tabs, not hooks). Nearer values win. */
data class AWCTabAppearance(
    val containerColor: String? = null, val activeLabelColor: String? = null, val inactiveLabelColor: String? = null,
    val activeIconColor: String? = null, val inactiveIconColor: String? = null, val activeIndicatorColor: String? = null,
    val activeIndicatorHeight: Double? = null, val dividerColor: String? = null, val glideDuration: Double? = null,
) {
    fun merging(o: AWCTabAppearance) = AWCTabAppearance(o.containerColor ?: containerColor, o.activeLabelColor ?: activeLabelColor,
        o.inactiveLabelColor ?: inactiveLabelColor, o.activeIconColor ?: activeIconColor, o.inactiveIconColor ?: inactiveIconColor,
        o.activeIndicatorColor ?: activeIndicatorColor, o.activeIndicatorHeight ?: activeIndicatorHeight, o.dividerColor ?: dividerColor, o.glideDuration ?: glideDuration)
    companion object {
        internal fun len(v: Any?): Double? = (v as? Number)?.toDouble() ?: v?.toString()?.trim()?.removeSuffix("px")?.toDoubleOrNull()
        internal fun col(v: Any?): String? = v?.toString()?.trim()?.takeIf { awcRippleHex(it) != null }
        /** Laboratory names (the CSS hook without `--md-tab-`, camel-cased). */
        fun fromValues(v: Map<String, Any?>) = AWCTabAppearance(col(v["containerColor"]), col(v["activeLabelColor"]), col(v["inactiveLabelColor"]),
            col(v["activeIconColor"]), col(v["inactiveIconColor"]), col(v["activeIndicatorColor"]), len(v["activeIndicatorHeight"])?.takeIf { it >= 0 }, col(v["dividerColor"]),
            (v["glideDuration"] as? Number)?.toDouble() ?: v["glideDuration"]?.toString()?.trim()?.removeSuffix("ms")?.toDoubleOrNull()?.takeIf { it >= 0 })
    }
}

/** md-tabs' two hooks plus the nine md-tab hooks set on the tablist (inherited by every tab, as custom properties are);
 *  the inherited md-tab container and divider hooks are tabContainerColor / tabDividerColor (the Laboratory names). */
data class AWCTabsAppearance(
    val containerColor: String? = null, val dividerColor: String? = null, val tabContainerColor: String? = null,
    val activeLabelColor: String? = null, val inactiveLabelColor: String? = null, val activeIconColor: String? = null,
    val inactiveIconColor: String? = null, val activeIndicatorColor: String? = null, val activeIndicatorHeight: Double? = null,
    val tabDividerColor: String? = null, val glideDuration: Double? = null,
) {
    constructor(containerColor: String?, dividerColor: String?, tab: AWCTabAppearance) : this(containerColor, dividerColor, tab.containerColor,
        tab.activeLabelColor, tab.inactiveLabelColor, tab.activeIconColor, tab.inactiveIconColor, tab.activeIndicatorColor, tab.activeIndicatorHeight,
        tab.dividerColor, tab.glideDuration)
    val tab: AWCTabAppearance get() = AWCTabAppearance(tabContainerColor, activeLabelColor, inactiveLabelColor, activeIconColor, inactiveIconColor,
        activeIndicatorColor, activeIndicatorHeight, tabDividerColor, glideDuration)
    fun merging(o: AWCTabsAppearance) = AWCTabsAppearance(o.containerColor ?: containerColor, o.dividerColor ?: dividerColor, tab.merging(o.tab))
    companion object {
        /** containerColor, dividerColor (md-tabs); tabContainerColor, activeLabelColor, inactiveLabelColor, activeIconColor,
         *  inactiveIconColor, activeIndicatorColor, activeIndicatorHeight, tabDividerColor, glideDuration (md-tab, inherited). */
        fun fromValues(v: Map<String, Any?>) = AWCTabsAppearance(AWCTabAppearance.col(v["containerColor"]), AWCTabAppearance.col(v["dividerColor"]),
            AWCTabAppearance.fromValues(v + mapOf("containerColor" to v["tabContainerColor"], "dividerColor" to v["tabDividerColor"])))
    }
}

/**
 * `::part()` styling of md-tab: state-layer (background-color, opacity), icon / label (color), indicator / divider
 * (background-color). Part rules come from the outer tree, so they win over the hooks and every internal state rule (a fixed
 * state-layer opacity shows in every state, as in Chrome). `content` — the wrapper of icon, label and badge — takes a box
 * ([AWCPartBox]: background, border, radius, padding with the layout shift; gate-7 R6-17).
 */
@Immutable data class AWCTabPartAppearance(val stateLayerColor: String? = null, val stateLayerOpacity: Double? = null, val iconColor: String? = null,
    val labelColor: String? = null, val indicatorColor: String? = null, val dividerColor: String? = null, val content: AWCPartBox? = null) {
    fun merging(o: AWCTabPartAppearance) = AWCTabPartAppearance(o.stateLayerColor ?: stateLayerColor, o.stateLayerOpacity ?: stateLayerOpacity, o.iconColor ?: iconColor,
        o.labelColor ?: labelColor, o.indicatorColor ?: indicatorColor, o.dividerColor ?: dividerColor, AWCPartBox.merge(content, o.content))
    internal val layerColor get() = stateLayerColor?.let { awcRippleHex(it) }
    internal val layerOpacity get() = stateLayerOpacity?.takeIf { it.isFinite() }?.coerceIn(0.0, 1.0)
    internal val icon get() = iconColor?.let { awcRippleHex(it) }
    internal val label get() = labelColor?.let { awcRippleHex(it) }
    internal val indicator get() = indicatorColor?.let { awcRippleHex(it) }
    internal val divider get() = dividerColor?.let { awcRippleHex(it) }
    companion object {
        /** Laboratory names (the fields above; `content` as an [AWCPartBox] map). */
        fun fromValues(v: Map<String, Any?>) = AWCTabPartAppearance(v["stateLayerColor"]?.toString(), (v["stateLayerOpacity"] as? Number)?.toDouble(),
            v["iconColor"]?.toString(), v["labelColor"]?.toString(), v["indicatorColor"]?.toString(), v["dividerColor"]?.toString(), AWCPartBox.fromValue(v["content"]))
    }
}
/** `::part(container)` of md-tabs: the scrolling strip's background-color (painted over the host background). */
@Immutable data class AWCTabsPartAppearance(val containerColor: String? = null) {
    fun merging(o: AWCTabsPartAppearance) = AWCTabsPartAppearance(o.containerColor ?: containerColor)
    companion object { fun fromValues(v: Map<String, Any?>) = AWCTabsPartAppearance(v["containerColor"]?.toString()) }
}
internal val LocalAWCTabPartAppearance = staticCompositionLocalOf { AWCTabPartAppearance() }
internal val LocalAWCTabsPartAppearance = staticCompositionLocalOf { AWCTabsPartAppearance() }
/** Applies md-tab `::part()` styling to descendant tabs. */
@Composable
fun AWCTabPartAppearanceScope(appearance: AWCTabPartAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTabPartAppearance provides LocalAWCTabPartAppearance.current.merging(appearance), content = content)
/** Applies md-tabs `::part(container)` styling to descendant tab strips. */
@Composable
fun AWCTabsPartAppearanceScope(appearance: AWCTabsPartAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTabsPartAppearance provides LocalAWCTabsPartAppearance.current.merging(appearance), content = content)

/** md-tabs.selectTab(index): ignores an out-of-range index, then activates and emits like a click. */
class AWCTabsController { internal var select: ((Int) -> Unit)? = null; fun selectTab(index: Int) { select?.invoke(index) } }

internal val LocalAWCTabsAppearance = staticCompositionLocalOf { AWCTabsAppearance() }
internal val LocalAWCTabAppearance = staticCompositionLocalOf { AWCTabAppearance() }
internal val LocalAWCTabsController = staticCompositionLocalOf<AWCTabsController?> { null }
/** Overrides the system animator scale for tabs (null follows the system: "remove animations" is reduced motion). */
val LocalAWCTabsReducedMotion = staticCompositionLocalOf<Boolean?> { null }
@Composable
fun AWCTabsAppearanceScope(appearance: AWCTabsAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCTabsAppearance.current
    CompositionLocalProvider(LocalAWCTabsAppearance provides inherited.merging(appearance), content = content)
}
@Composable
fun AWCTabAppearanceScope(appearance: AWCTabAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCTabAppearance.current
    CompositionLocalProvider(LocalAWCTabAppearance provides inherited.merging(appearance), content = content)
}
@Composable
fun AWCTabsControllerScope(controller: AWCTabsController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTabsController provides controller, content = content)

/** Shares each md-tabs' selection (and its tabs' names) with md-tab-panels; `last` is the md-tabs composed most recently
 *  (the nearest preceding md-tabs in document order when a region has no `for`). */
class AWCTabsRegistry {
    val indices = mutableStateMapOf<String, Int>()
    val labels = mutableStateMapOf<String, List<String>>()
    internal var last: String? = null
}
val LocalAWCTabsRegistry = staticCompositionLocalOf { AWCTabsRegistry() }

// MARK: model

internal class TabMetrics(val d: Double) {
    val minWidth get() = max(48.0, 90 + 8 * d)
    val padX get() = max(8.0, 16 + 2 * d)
    val icon get() = max(18.0, 24 + d)
    val labelSize get() = max(11.0, 14 + 0.5 * d)
    val lineHeight get() = max(16.0, 20 + d)
    fun height(stackedPrimary: Boolean) = (if (stackedPrimary) 64.0 else 48.0) + 4 * d
}

/** A tab child of a strip: its props and slot facts (reported by the tab), interaction state and transitions. */
internal class TabChild {
    var props by mutableStateOf<Props>(emptyMap())
    var slotIcon by mutableStateOf(false)
    var slotBadgeWidth by mutableStateOf<Double?>(null)
    /** The tab's `::part(content)` box (gate-7 R6-17), reported by the tab: it takes part in the strip's layout. */
    var contentBox by mutableStateOf<AWCPartBox?>(null)
    val slotBadgeText = AWCSlotTextRegistry()
    val focus = FocusRequester()
    var focused by mutableStateOf(false)
    var pointerFocus = false
    var hover by mutableStateOf(false)
    var pressed by mutableStateOf(false)
    val motion = TabMotion()
    val ripple = AWCRippleController()
    val id get() = props.str("id")
    val label get() = props.str("label")
    val icon get() = props.str("icon")
    val badge: String? get() = props["badge"]?.let { if (it is Number) (if (it.toDouble() == Math.rint(it.toDouble())) it.toLong().toString() else it.toString()) else it.toString() }
    val disabled get() = props.bool("disabled")
    val hasIcon get() = icon.isNotEmpty() || slotIcon
    val hasLabel get() = label.isNotEmpty()
    val inline get() = props.bool("inlineIcon") && hasIcon && hasLabel
    val stacked get() = hasIcon && hasLabel && !inline
    val ariaLabel get() = props.str("ariaLabelProp").ifEmpty { props.str("aria-label") }.ifEmpty { props.str("ariaLabel") }
    /** The accessible name: aria-label, else the content in tree order (badge on the icon, label, inline badge). */
    val name: String get() {
        if (ariaLabel.isNotEmpty()) return ariaLabel
        val badgeName = if (slotBadgeWidth != null) slotBadgeText.text.trim() else badge?.let { it.ifEmpty { "notification" } }
        return listOfNotNull(if (hasIcon) badgeName else null, if (hasLabel) label else null, if (!hasIcon) badgeName else null).filter { it.isNotEmpty() }.joinToString(" ")
    }
    fun density(inherited: Double) = resolveAWCDensity(props["density"], inherited)
}
internal fun tabsSanitize(v: Any?): Int {
    val n = when (v) { is Number -> v.toDouble(); is Boolean -> if (v) 1.0 else 0.0; null -> 0.0; else -> v.toString().trim().let { if (it.isEmpty()) 0.0 else it.toDoubleOrNull() ?: Double.NaN } }
    val r = Math.floor(n + 0.5)
    return if (r.isFinite() && abs(r) < 1e9) r.toInt() else 0
}
internal fun tabsNext(disabled: List<Boolean>, from: Int, dir: Int): Int? {
    val n = disabled.size; if (n == 0) return null
    var i = from
    repeat(n) { i = ((i + dir) % n + n) % n; if (!disabled[i]) return i }
    return null
}
internal fun tabsClamp(index: Int, disabled: List<Boolean>): Int {
    if (disabled.isEmpty()) return 0
    var i = index.coerceIn(0, disabled.size - 1)
    if (disabled[i]) (tabsNext(disabled, i, 1) ?: disabled.indexOf(false).takeIf { it >= 0 })?.let { i = it }
    return i
}

// MARK: geometry (dp, physical x)

internal class TabGeometry {
    var x = 0.0; var width = 0.0; var height = 0.0
    var content = TabRect(); var icon: TabRect? = null; var label: TabRect? = null; var labelText = TabRect(); var badge: TabRect? = null
    var inlineBadge = false; var indicator = TabRect(); var divider = TabRect(); var kind = "label"
}
internal data class TabRect(val x: Double = 0.0, val y: Double = 0.0, val w: Double = 0.0, val h: Double = 0.0) { val midX get() = x + w / 2; val maxX get() = x + w }

/** Exact (subpixel, unhinted) advance in px of a single-line run, as Chrome lays it out (letter spacing in em). */
internal fun tabsAdvance(context: android.content.Context, text: String, sizePx: Float, weight: Int, spacingEm: Float): Float {
    if (text.isEmpty()) return 0f
    val paint = android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG).apply {
        typeface = context.resources.getFont(when { weight >= 600 -> R.font.awc_roboto_bold; weight >= 500 -> R.font.awc_roboto_medium; else -> R.font.awc_roboto_regular })
        textSize = sizePx; letterSpacing = spacingEm; isLinearText = true
    }
    val bidi = java.text.Bidi(text, java.text.Bidi.DIRECTION_DEFAULT_LEFT_TO_RIGHT)
    var width = 0f
    for (i in 0 until bidi.runCount) { val a = bidi.getRunStart(i); val b = bidi.getRunLimit(i); width += paint.getRunAdvance(text, a, b, a, b, bidi.getRunLevel(i) % 2 == 1, b) }
    return width
}

/** Text measurement in dp (font size in dp: the fixtures use DPR-independent CSS px). */
internal class TabsText(private val context: android.content.Context, private val density: Float) {
    private val cache = HashMap<Triple<String, Double, Int>, Double>()
    fun width(text: String, size: Double, weight: Int = 500, tracking: Double = 0.1): Double = cache.getOrPut(Triple(text, size * 1000 + tracking, weight)) {
        tabsAdvance(context, text, (size * density).toFloat(), weight, (tracking / size).toFloat()).toDouble() / density
    }
}

internal object TabsLayout {
    fun badgeSize(b: String, text: TabsText) = if (b.isEmpty()) 6.0 to 6.0 else max(6.0, text.width(b, 10.0, 500, 0.0)) + 6 to 14.0
    fun labelWidth(c: TabChild, m: TabMetrics, text: TabsText): Pair<Double, Double> {
        val t = if (c.hasLabel) text.width(c.label, m.labelSize) else 0.0
        var total = t
        if (!c.hasIcon) { c.slotBadgeWidth?.let { total += 4 + it } ?: c.badge?.let { total += 4 + badgeSize(it, text).first } }
        return t to total
    }
    fun contentSize(c: TabChild, m: TabMetrics, text: TabsText): Pair<Double, Double> {
        val label = labelWidth(c, m, text).second
        return when {
            c.inline -> m.icon + 8 + label to max(m.icon, m.lineHeight)
            c.stacked -> max(m.icon, label) to m.icon + 2 + m.lineHeight
            c.hasIcon -> m.icon to m.icon
            else -> label to (if (c.hasLabel) m.lineHeight else 0.0)
        }
    }
    fun intrinsic(c: TabChild, m: TabMetrics, primary: Boolean, text: TabsText): Double {
        val content = contentSize(c, m, text).first
        return max(m.minWidth, 2 * m.padX + (if (primary) max(content, 24.0) else content) + (c.contentBox?.horizontal ?: 0.0))
    }
    /** `equal`: flex 1 1 0 with each tab's minimum (frozen on violation); `auto`: content; a length: exactly. */
    fun widths(kids: List<TabChild>, inherited: Double, primary: Boolean, mode: String, fixed: Double?, viewport: Double, text: TabsText): List<Double> {
        val metrics = kids.map { TabMetrics(it.density(inherited)) }
        if (fixed != null) return kids.map { fixed }
        if (mode == "auto") return kids.mapIndexed { i, c -> intrinsic(c, metrics[i], primary, text) }
        val result = MutableList<Double?>(kids.size) { null }
        while (true) {
            val open = result.indices.filter { result[it] == null }
            if (open.isEmpty()) break
            val share = (viewport - result.filterNotNull().sum()) / open.size
            val violators = open.filter { share < metrics[it].minWidth }
            if (violators.isEmpty()) { open.forEach { result[it] = max(0.0, share) }; break }
            violators.forEach { result[it] = metrics[it].minWidth }
        }
        return result.map { it ?: 0.0 }
    }
    fun geometry(c: TabChild, w: Double, primary: Boolean, rtl: Boolean, inherited: Double, indicatorHeight: Double?, text: TabsText): TabGeometry {
        val m = TabMetrics(c.density(inherited)); val g = TabGeometry(); g.width = w
        g.kind = when { c.inline -> "inline"; c.stacked -> "stacked"; c.hasIcon -> "icon"; else -> "label" }
        val h = m.height(primary && c.stacked); g.height = h
        val indH = indicatorHeight ?: if (primary) 3.0 else 2.0
        val avail = max(0.0, w - 2 * m.padX); val size = contentSize(c, m, text); val lw = labelWidth(c, m, text)
        // ::part(content) box (gate-7 R6-17): border + padding widen the content's border box (the primary indicator spans it); a
        // primary content fills the tab's height and centres its children in the padded area, a secondary one grows around them.
        val ins = c.contentBox.boxInsets; val insH = ins[1] + ins[3]; val insV = ins[0] + ins[2]
        val outer: TabRect
        if (primary) {
            val inner = min(max(size.first, 24.0) + insH, avail); val innerX = m.padX + (avail - inner) / 2
            outer = TabRect(innerX, 0.0, inner, max(0.0, h - indH - 2)); g.indicator = TabRect(innerX, h - indH, inner, indH)
        } else {
            val cw = min(size.first + insH, avail); val ch = size.second + insV
            outer = TabRect(m.padX + (avail - cw) / 2, (h - ch) / 2, cw, ch); g.indicator = TabRect(0.0, h - indH, w, indH)
        }
        g.content = outer
        // The content area: the border box less border and padding (physical edges).
        val box = TabRect(outer.x + ins[3], outer.y + ins[0], max(0.0, outer.w - insH), max(0.0, outer.h - insV))
        val stackW = min(size.first, box.w); val stackH = size.second; val stackY = box.y + (box.h - stackH) / 2
        val labelRoom = if (c.inline) stackW - m.icon - 8 else stackW
        val labelW = min(lw.second, max(0.0, labelRoom)); val textW = max(0.0, labelW - (lw.second - lw.first))
        when {
            c.inline -> {
                val rowH = max(m.icon, m.lineHeight); val iconX = if (rtl) box.x + stackW - m.icon else box.x
                g.icon = TabRect(iconX, stackY + (rowH - m.icon) / 2, m.icon, m.icon)
                g.label = TabRect(if (rtl) iconX - 8 - labelW else iconX + m.icon + 8, stackY + (rowH - m.lineHeight) / 2, labelW, m.lineHeight)
            }
            c.stacked -> { g.icon = TabRect(box.midX - m.icon / 2, stackY, m.icon, m.icon); g.label = TabRect(box.midX - labelW / 2, stackY + m.icon + 2, labelW, m.lineHeight) }
            c.hasIcon -> g.icon = TabRect(box.midX - m.icon / 2, stackY, m.icon, m.icon)
            c.hasLabel || c.badge != null || c.slotBadgeWidth != null -> g.label = TabRect(box.midX - labelW / 2, stackY, labelW, m.lineHeight)
        }
        g.label?.let { l -> g.labelText = TabRect(if (rtl) l.maxX - textW else l.x, l.y, textW, m.lineHeight) }
        val b = c.badge
        if (c.slotBadgeWidth == null && b != null) {
            val (bw, bh) = badgeSize(b, text)
            val icon = g.icon; val l = g.label
            if (icon != null) g.badge = TabRect((if (rtl) icon.x else icon.maxX - bw) + bw / 2, icon.y - bh / 4, bw, bh)
            else if (l != null) { g.inlineBadge = true; g.badge = TabRect(if (rtl) l.x else l.maxX - bw, l.y + (m.lineHeight - bh) / 2, bw, bh) }
        }
        g.divider = TabRect(0.0, h - 1, w, 1.0)
        return g
    }
    fun length(raw: String?): Double? {
        val r = raw?.trim()?.lowercase()?.takeIf { it.isNotEmpty() } ?: return null
        for ((unit, scale) in listOf("px" to 1.0, "rem" to 16.0, "em" to 16.0)) if (r.endsWith(unit)) return r.removeSuffix(unit).toDoubleOrNull()?.times(scale)
        return r.toDoubleOrNull()
    }
}

// MARK: motion

private val TABS_STANDARD = listOf(0.2, 0.0, 0.0, 1.0)
private val TABS_EMPHASIZED_DECELERATE = listOf(0.05, 0.7, 0.1, 1.0)
private val listLerp: (List<Double>, List<Double>, Double) -> List<Double> = { a, b, t -> a.zip(b) { x, y -> x + (y - x) * t } }

/** One tab's transitions: indicator opacity and transform [translateX, scaleX], host and icon colour, state layer. */
internal class TabMotion {
    val color = AWCCSSValueTrack(Color.Transparent, accordionColorLerp)
    val icon = AWCCSSValueTrack(Color.Transparent, accordionColorLerp)
    val layer = AWCCSSValueTrack(0.0, accordionLerp)
    val opacity = AWCCSSValueTrack(0.0, accordionLerp)
    val transform = AWCCSSValueTrack(listOf(0.0, 1.0), listLerp)
    var initialized = false
    /** The FLIP release: the held start transform transitions home from this time. */
    var release: Double? = null
    var pending: TabTargets? = null
    private var last: TabTargets? = null
    fun running(now: Double) = pending != null || release != null || color.isRunning(now) || icon.isRunning(now) || layer.isRunning(now) || opacity.isRunning(now) || transform.isRunning(now)
    /** Composition requests targets; the first request snaps (no transition on first render), later ones start on the next frame. */
    fun request(t: TabTargets): Boolean {
        if (t == last) return false
        last = t
        if (!initialized) { color.snap(t.color); icon.snap(t.icon); layer.snap(t.layer); opacity.snap(t.opacity); transform.snap(t.transform); initialized = true; return false }
        pending = t; return true
    }
    fun apply(now: Double) {
        release?.let { r -> if (now >= r) { release = null; transform.set(listOf(0.0, 1.0), r, last?.glide ?: 400.0, TABS_EMPHASIZED_DECELERATE) } }
        val t = pending ?: return; pending = null
        color.set(t.color, now, 200.0, TABS_STANDARD); icon.set(t.icon, now, 200.0, TABS_STANDARD)
        layer.set(t.layer, now, if (t.reduced) 0.0 else 50.0, TABS_STANDARD)
        opacity.set(t.opacity, now, if (t.reduced) 0.0 else if (t.primary) 200.0 else 150.0, TABS_STANDARD)
        if (release == null && !(t.opacity == 1.0 && transform.value == listOf(0.0, 1.0) && transform.running != null)) transform.set(t.transform, now, if (t.reduced) 0.0 else t.glide, TABS_EMPHASIZED_DECELERATE)
    }
}
internal data class TabTargets(val color: Color, val icon: Color, val layer: Double, val opacity: Double, val transform: List<Double>, val primary: Boolean, val reduced: Boolean, val glide: Double = 400.0)

internal class TabsPalette(private val tokens: Map<String, String>, private val tabs: AWCTabsAppearance, private val tab: AWCTabAppearance, val primary: Boolean, val full: Boolean) {
    private fun t(k: String, d: Long) = awcRippleHex(tokens["--md-sys-color-$k"]) ?: Color(d)
    private fun h(v: String?) = v?.let { awcRippleHex(it) }
    val host get() = h(tabs.containerColor) ?: t("surface", 0xFFFFFBFE)
    val stripDivider get() = h(tabs.dividerColor) ?: t("outline-variant", 0xFFCAC4D0)
    val container get() = h(tab.containerColor) ?: Color.Transparent
    val activeLabel get() = h(tab.activeLabelColor) ?: if (primary) t("primary", 0xFF6750A4) else t("on-surface", 0xFF1C1B1F)
    val inactiveLabel get() = h(tab.inactiveLabelColor) ?: t("on-surface-variant", 0xFF49454F)
    val activeIcon get() = h(tab.activeIconColor) ?: t("primary", 0xFF6750A4)
    val inactiveIcon get() = h(tab.inactiveIconColor) ?: t("on-surface-variant", 0xFF49454F)
    val indicator get() = h(tab.activeIndicatorColor) ?: t("primary", 0xFF6750A4)
    val disabled get() = t("on-surface", 0xFF1C1B1F).copy(alpha = 0.38f)
    /** `full` suppresses the per-tab segments (transparent); an explicit tab divider hook still wins. */
    val tabDivider get() = h(tab.dividerColor) ?: if (full) Color.Transparent else h(tabs.dividerColor) ?: t("outline-variant", 0xFFCAC4D0)
    val focusRing get() = t("secondary", 0xFF625B71)
    val badge get() = t("error", 0xFFB3261E)
    val onBadge get() = t("on-error", 0xFFFFFFFF)
    /** --md-tab-glide-duration (ms). */
    val glide get() = tab.glideDuration ?: 400.0
}

// MARK: strip

/** Test/Laboratory probe: live per-tab values and the strip state (dp, physical coordinates in the root). */
class AWCTabsProbe {
    val tabs = HashMap<String, Map<String, Any?>>()
    var strip: Map<String, Any?> = emptyMap()
    val panels = HashMap<String, Map<String, Any?>>()
}
val LocalAWCTabsProbe = staticCompositionLocalOf<AWCTabsProbe?> { null }

internal class TabsStripState {
    var order by mutableStateOf<List<TabChild>>(emptyList())
    var active by mutableStateOf<TabChild?>(null)
    var index by mutableIntStateOf(0)
    var pending: Int? = null
    var lastProperty: Any? = null
    var reconciled: List<TabChild>? = null
    var frame by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var placed: Map<TabChild, TabGeometry> = emptyMap()
    var pendingGlide: Pair<TabChild, TabChild>? = null
    var height by mutableDoubleStateOf(0.0)
    var content = 0.0; var viewport = 0.0
    var scrollMax = 0.0; var initialScroll = false
    var revealTarget: TabChild? = null; var revealAnimated = false
    var revealToken by mutableIntStateOf(0)
    fun running(now: Double) = pendingGlide != null || order.any { it.motion.running(now) }
}

internal class TabsContext(val state: TabsStripState, val primary: Boolean, val palette: TabsPalette, val reduced: Boolean, val rtl: Boolean,
                           val inherited: Double, val standalone: Boolean, val holder: () -> TabChild?, val activate: (TabChild) -> Unit,
                           val key: (TabChild, String) -> Boolean, val probe: AWCTabsProbe?, val stripID: String)
internal val LocalTabsStrip = staticCompositionLocalOf<TabsContext?> { null }

private fun animatorsOff() = !android.animation.ValueAnimator.areAnimatorsEnabled()

/**
 * md-tabs: the tablist. Selection (clamp, skip disabled, append-and-select, identity across mutations; emits for user
 * activation, selectTab() and reconciliation, never for an activeTabIndex write), the roving tab stop, arrows in visual
 * order with Home/End and automatic activation, `equal`/`auto`/length widths, horizontal scroll with the nearest-edge
 * reveal and edge fades, the full or per-tab divider, the indicator glide (FLIP, held one frame, 400 ms emphasized
 * decelerate) with the outgoing fade, colour (200 ms) and state-layer (50 ms) transitions. Children are md-tab nodes.
 */
@Composable
internal fun NativeTabs(p: Props, emit: EventSink, slot: Slot?) {
    if (p.bool("hidden")) return
    val state = remember { TabsStripState() }
    val registry = LocalAWCTabsRegistry.current
    val tokens = LocalAWCThemeTokens.current
    val appearance = LocalAWCTabsAppearance.current; val tabLook = appearance.tab.merging(LocalAWCTabAppearance.current)
    val standalone = p.bool("_standalone")
    val primary = p.str("variant", "primary") != "secondary"; val full = p.str("divider", "full") != "auto"
    val palette = TabsPalette(tokens, appearance, tabLook, primary, full)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val reduced = LocalAWCTabsReducedMotion.current ?: animatorsOff()
    val inherited = LocalAWCNativeDensity.current
    val ctxAndroid = LocalContext.current; val density = LocalDensity.current.density
    val text = remember(ctxAndroid, density) { TabsText(ctxAndroid, density) }
    val probe = LocalAWCTabsProbe.current
    val stripID = p.str("id").ifEmpty { "tabs" }
    val label = p.str("ariaLabelProp").ifEmpty { p.str("aria-label") }.ifEmpty { p.str("ariaLabel") }.ifEmpty { "tabs" }
    val rawWidth = p.str("tabWidth", "equal").trim()
    val fixed = if (rawWidth == "auto" || rawWidth.isEmpty() || rawWidth == "equal") null else TabsLayout.length(rawWidth)
    val mode = if (rawWidth == "auto") "auto" else if (fixed != null) "fixed" else "equal"
    val stripWidth = TabsLayout.length(p.str("width").ifEmpty { null })
    val scroll = rememberScrollState()
    val scope = rememberCoroutineScope()
    if (!standalone) registry.last = stripID
    if (!standalone) DisposableEffect(registry, stripID) { onDispose { if (registry.last == stripID) registry.last = null; registry.indices.remove(stripID); registry.labels.remove(stripID) } }
    fun disabled() = state.order.map { it.disabled }
    fun holder(): TabChild? {
        val o = state.order; if (o.isEmpty()) return null
        if (standalone) return o[0].takeUnless { it.disabled }
        o.getOrNull(state.index)?.takeUnless { it.disabled }?.let { return it }
        return o.firstOrNull { !it.disabled }
    }
    fun publish() {
        if (standalone) return
        val v = if (state.active == null) -1 else state.index
        if (registry.indices[stripID] != v) registry.indices[stripID] = v
        val names = state.order.map { it.name }; if (registry.labels[stripID] != names) registry.labels[stripID] = names
    }
    fun reveal(c: TabChild, animated: Boolean) { state.revealTarget = c; state.revealAnimated = animated; state.revealToken++ }
    fun apply(index: Int, scrollIntoView: Boolean = true) {
        val previous = state.active; val next = state.order.getOrNull(index)
        state.active = next
        if (scrollIntoView && next != null) reveal(next, !reduced)
        if (previous != null && next != null && previous !== next && !reduced) { state.pendingGlide = previous to next; state.version++ }
        publish()
    }
    fun activate(index: Int) {
        state.pending = null
        val o = state.order; if (index !in o.indices) return
        if (index == state.index && state.active === o[index]) return
        val previous = state.index; state.index = index; apply(index)
        emit("mdTabChange", mapOf("index" to index, "previousIndex" to previous))
    }
    fun programmatic(raw: Any?) {
        val s = tabsSanitize(raw); state.pending = if (s > state.order.size - 1) s else null
        val c = tabsClamp(s, disabled()); state.index = c; apply(c)
    }
    fun reconcile() {
        val o = state.order
        if (o.isEmpty()) { state.active = null; publish(); return }
        val d = disabled()
        state.pending?.let { pend -> state.pending = null; if (pend <= o.size - 1) { val i = tabsClamp(pend, d); state.index = i; apply(i); return } }
        if (d.none { !it }) {
            val had = state.active != null; val previous = state.index
            state.active = null; publish()
            if (had) emit("mdTabChange", mapOf("index" to -1, "previousIndex" to previous)); return
        }
        val previousElement = state.active
        val index = previousElement?.let { pe -> o.indexOf(pe).takeIf { it >= 0 } } ?: tabsClamp(state.index, d)
        val previous = state.index; state.index = index
        apply(index, scrollIntoView = false)
        if (previousElement != null && state.active !== previousElement) emit("mdTabChange", mapOf("index" to index, "previousIndex" to previous))
    }
    fun key(c: TabChild, k: String): Boolean {
        if (standalone) return false
        val o = state.order; val current = o.indexOf(c); if (current < 0) return false
        val d = disabled(); val dir = if (rtl) -1 else 1
        val target = when (k) { "ArrowRight" -> tabsNext(d, current, dir); "ArrowLeft" -> tabsNext(d, current, -dir)
            "Home" -> d.indexOf(false).takeIf { it >= 0 }; "End" -> d.lastIndexOf(false).takeIf { it >= 0 }; else -> return false }
        if (target != null && target != current) { activate(target); o[target].pointerFocus = false; runCatching { o[target].focus.requestFocus() } }
        return true
    }
    LocalAWCTabsController.current?.let { ctl -> SideEffect { ctl.select = { i -> if (!standalone && i in state.order.indices) activate(i) } } }
    // Children changed (slotchange): reconcile once the new order is known; an initial order selects without emitting.
    SideEffect {
        val o = state.order
        if (state.reconciled == null && o.isNotEmpty()) {
            state.reconciled = o; state.lastProperty = p["activeTabIndex"]
            if (standalone) { state.active = o[0].takeIf { it.props.bool("active") } } else {
                val d = disabled(); state.index = tabsClamp(tabsSanitize(p["activeTabIndex"]), d)
                state.active = if (d.none { !it }) null else o[state.index]; publish()
            }
        } else if (state.reconciled != null && state.reconciled != o) { state.reconciled = o; if (!standalone) reconcile() }
        if (standalone) { val a = o.firstOrNull()?.takeIf { it.props.bool("active") }; if (state.active !== a) state.active = a }
        else if (state.reconciled != null && p["activeTabIndex"] != state.lastProperty) { state.lastProperty = p["activeTabIndex"]; programmatic(p["activeTabIndex"]) }
        if (state.reconciled != null) publish()
    }
    // The frame clock: pending glides and transition targets apply on frames; the loop sleeps when nothing runs.
    LaunchedEffect(state) {
        while (isActive) {
            withFrameNanos { t ->
                val ms = t / 1e6
                state.pendingGlide?.let { (a, b) ->
                    state.pendingGlide = null
                    val pa = state.placed[a]; val pb = state.placed[b]
                    if (pa != null && pb != null && a.motion.initialized && b.motion.initialized) {
                        val va = a.motion.transform.presented(ms); val vb = b.motion.transform.presented(ms)
                        val ca = pa.x + pa.indicator.midX + va[0]; val wa = pa.indicator.w * va[1]
                        val cb = pb.x + pb.indicator.midX + vb[0]; val wb = pb.indicator.w * vb[1]
                        if (wa > 0 && wb > 0) { b.motion.transform.snap(listOf(ca - cb, wa / wb)); b.motion.release = ms + 1000.0 / 60 }
                    }
                }
                state.order.forEach { it.motion.apply(ms) }
                state.frame = ms
            }
            if (!state.running(state.frame)) { val v = state.version; snapshotFlow { state.version }.first { it != v } }
        }
    }
    // Nearest-edge reveal (smooth; instant under reduced motion), in physical px of the scroll container.
    LaunchedEffect(state.revealToken) {
        val c = state.revealTarget ?: return@LaunchedEffect; val g = state.placed[c] ?: return@LaunchedEffect
        val w = state.viewport; val left = scroll.value / density.toDouble()
        val before = g.x - left; val after = g.x + g.width - left - w
        if (before >= -0.5 && after <= 0.5) return@LaunchedEffect
        if (before < 0 && after > 0) return@LaunchedEffect
        val distance = if (abs(before) < abs(after)) before else after
        if (abs(distance) <= 0.5) return@LaunchedEffect
        val target = ((left + distance) * density).roundToInt().coerceIn(0, scroll.maxValue)
        if (state.revealAnimated) scroll.animateScrollTo(target) else scroll.scrollTo(target)
    }
    fun writeProbe() { if (probe == null) return
        val left = scroll.value / density.toDouble(); val max = scroll.maxValue / density.toDouble()
        probe.strip = mapOf("activeTabIndex" to state.index, "active" to state.active?.id, "count" to state.order.size, "label" to label,
            "scrollLeft" to (if (rtl) -(max - left) else left), "scrollWidth" to state.content, "clientWidth" to state.viewport, "height" to state.height,
            "host" to palette.host, "divider" to if (full) palette.stripDivider else null, "reduced" to reduced)
    }
    val context = TabsContext(state, primary, palette, reduced, rtl, inherited, standalone, ::holder, { c -> activate(state.order.indexOf(c)) }, ::key, probe, stripID)
    CompositionLocalProvider(LocalTabsStrip provides context, LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(Modifier.then(if (stripWidth != null) Modifier.width(stripWidth.dp) else if (standalone) Modifier else Modifier.fillMaxWidth())
            .background(if (standalone) Color.Transparent else palette.host)
            // ::part(container): the scrolling strip's own background over the host's.
            .background(LocalAWCTabsPartAppearance.current.containerColor?.let { awcRippleHex(it) } ?: Color.Transparent)
            .then(if (probe != null) Modifier.onGloballyPositioned { writeProbe() } else Modifier)
            .then(if (standalone) Modifier else Modifier.semantics { isTraversalGroup = true; contentDescription = label; collectionInfo = CollectionInfo(1, state.order.size) })) {
            val viewport = stripWidth ?: if (standalone) 0.0 else maxWidth.value.toDouble()
            if (full && !standalone) Box(Modifier.fillMaxWidth().height(1.dp).align(Alignment.BottomStart).background(palette.stripDivider))
            // Edge fades (40 dp) on the clipped sides, from tab geometry (physical, so RTL-correct by construction).
            val left = scroll.value / density.toDouble()
            val first = state.order.firstOrNull()?.let { state.placed[it] }; val last = state.order.lastOrNull()?.let { state.placed[it] }
            val clipLeft = first != null && last != null && min(first.x, last.x) - left < -1
            val clipRight = first != null && last != null && max(first.x + first.width, last.x + last.width) - left > viewport + 1
            Layout(content = { slot?.invoke("") }, modifier = Modifier.width(if (standalone) Dp.Unspecified else viewport.dp).horizontalScroll(scroll, enabled = !standalone)
                .graphicsLayer { compositingStrategy = if (clipLeft || clipRight) CompositingStrategy.Offscreen else CompositingStrategy.Auto }
                .drawWithContent {
                    drawContent()
                    if (clipLeft || clipRight) {
                        val sx = scroll.value.toFloat(); val w = size.width.coerceAtMost((viewport * density).toFloat()); val e = (40 * density) / w
                        drawRect(Brush.horizontalGradient(0f to (if (clipLeft) Color.Transparent else Color.Black), e to Color.Black, (1 - e) to Color.Black, 1f to (if (clipRight) Color.Transparent else Color.Black),
                            startX = sx, endX = sx + w), topLeft = Offset(sx, 0f), size = Size(w, size.height), blendMode = BlendMode.DstIn)
                    }
                }) { measurables, constraints ->
                val kids = measurables.map { it.layoutId as? TabChild }
                val order = kids.filterNotNull()
                if (order != state.order) state.order = order
                val widths = TabsLayout.widths(order, inherited, primary, mode, fixed, viewport, text)
                val total = widths.sum(); val content = if (standalone) total else max(total, viewport)
                val geos = HashMap<TabChild, TabGeometry>(); var x = 0.0
                order.forEachIndexed { i, c ->
                    val g = TabsLayout.geometry(c, widths[i], primary, rtl, inherited, tabLook.activeIndicatorHeight, text)
                    g.x = if (rtl) content - x - widths[i] else x; x += widths[i]; geos[c] = g
                }
                state.placed = geos; state.content = content; state.viewport = if (standalone) total else viewport
                val h = geos.values.maxOfOrNull { it.height } ?: 0.0
                if (state.height != h) state.height = h
                val hPx = (h * density).roundToInt()
                val placeables = measurables.map { m -> (m.layoutId as? TabChild)?.let { c -> geos[c] }?.let { g ->
                    val l = (g.x * density).roundToInt(); val r = ((g.x + g.width) * density).roundToInt()
                    m.measure(Constraints.fixed(r - l, (g.height * density).roundToInt())) to l } ?: (m.measure(Constraints()) to 0) }
                layout((content * density).roundToInt(), hPx) { placeables.forEach { (pl, l) -> pl.place(l, 0) } }
            }
        }
    }
    // An RTL strip starts scrolled to its inline start (the right edge).
    LaunchedEffect(scroll.maxValue, rtl) { if (rtl && !state.initialScroll && scroll.maxValue > 0) { state.initialScroll = true; scroll.scrollTo(scroll.maxValue) } }
    if (probe != null) SideEffect { writeProbe() }
    if (probe != null) LaunchedEffect(scroll) { snapshotFlow { scroll.value }.collect { writeProbe() } }
}

// MARK: tab

private val TabsSymbols = HashMap<Int, FontFamily>()
private fun tabsSymbolFamily(weight: Int = 400) = TabsSymbols.getOrPut(weight) {
    FontFamily(Font(R.font.awc_material_symbols, FontWeight(weight), variationSettings = FontVariation.Settings(
        FontVariation.Setting("FILL", 0f), FontVariation.weight(weight), FontVariation.Setting("opsz", 24f), FontVariation.grade(0))))
}
private fun tabsText(size: Double, lineHeight: Double, weight: Int, tracking: Double, color: Color) = TextStyle(color = color, fontFamily = AccordionRoboto,
    fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = lineHeight.sp, letterSpacing = tracking.sp,
    platformStyle = PlatformTextStyle(includeFontPadding = false), lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None),
    textMotion = TextMotion.Animated)

/** md-tab: a strip child (its strip lays it out and owns selection), or a standalone tab with its own `active`. */
@Composable
internal fun NativeTab(p: Props, emit: EventSink, slot: Slot?, child: TabChild?) {
    if (p.bool("hidden")) return
    if (child == null) {
        // A tab outside a tablist: its own active state and tab stop, its own divider segment; activation emits mdTabClick only.
        NativeTabs(mapOf("variant" to p.str("variant", "primary"), "_standalone" to true, "divider" to "auto", "tabWidth" to "auto", "id" to p.str("id") + "-tablist"), emit) { s ->
            if (s == "") { val c = remember { TabChild() }; Box(Modifier.layoutId(c)) { NativeTab(p, emit, slot, c) } }
        }
        return
    }
    val ctx = LocalTabsStrip.current ?: return
    SideEffect { if (child.props != p) child.props = p }
    val st = ctx.state; val now = st.frame; val pal = ctx.palette
    val active = st.active === child; val disabled = child.disabled
    val focusVisible = child.focused && !child.pointerFocus
    val hover = !disabled && child.hover; val pressed = !disabled && child.pressed
    val parts = LocalAWCTabPartAppearance.current
    SideEffect { if (child.contentBox != parts.content) child.contentBox = parts.content }
    val targets = TabTargets(if (disabled) pal.disabled else if (active) pal.activeLabel else pal.inactiveLabel, parts.icon ?: if (active) pal.activeIcon else pal.inactiveIcon,
        parts.layerOpacity ?: if (disabled) 0.0 else if (pressed || focusVisible) 0.12 else if (hover) 0.08 else 0.0, if (active) 1.0 else 0.0,
        if (active) listOf(0.0, 1.0) else listOf(0.0, if (ctx.primary) 0.88 else 1.0), ctx.primary, ctx.reduced, pal.glide)
    if (!child.motion.initialized) child.motion.request(targets)
    SideEffect { if (child.motion.request(targets)) st.version++ }
    val g = st.placed[child]
    val density = LocalDensity.current.density
    val androidContext = LocalContext.current
    val text = remember(androidContext, density) { TabsText(androidContext, density) }
    val inspection = LocalAWCInspection.current
    val color = child.motion.color.presented(now); val iconColor = child.motion.icon.presented(now); val layer = child.motion.layer.presented(now)
    val opacity = child.motion.opacity.presented(now); val tr = child.motion.transform.presented(now)
    val m = TabMetrics(child.density(ctx.inherited))
    val tabStop = ctx.holder() === child
    fun click(keyboard: Boolean) {
        if (child.disabled) return
        if (keyboard) child.ripple.trigger()
        emit("mdTabClick", null)
        if (!ctx.standalone) ctx.activate(child)
    }
    var coords by remember { mutableStateOf<androidx.compose.ui.layout.LayoutCoordinates?>(null) }
    Box(Modifier.fillMaxSize()
        .background(pal.container)
        .drawBehind {
            val layerInk = parts.layerColor ?: color
            drawRect(layerInk.copy(alpha = (layerInk.alpha * layer).toFloat()))
            if (g != null) drawRect(parts.divider ?: pal.tabDivider, topLeft = Offset(0f, ((g.height - 1) * density).toFloat()), size = Size(size.width, density))
        }
        .awcRipple(disabled = disabled, contentColor = color, controller = child.ripple)
        .onGloballyPositioned { coords = it }
        .pointerInput(child, disabled) {
            awaitPointerEventScope {
                while (true) {
                    val e = awaitPointerEvent(PointerEventPass.Main)
                    val c = e.changes.firstOrNull() ?: continue
                    val inside = c.position.x >= 0 && c.position.y >= 0 && c.position.x < size.width && c.position.y < size.height
                    when (e.type) {
                        PointerEventType.Enter, PointerEventType.Move -> if (c.type == PointerType.Mouse || child.pressed) child.hover = !child.disabled && inside
                        PointerEventType.Exit -> child.hover = false
                        PointerEventType.Press -> if (!child.disabled) { child.pressed = true; child.hover = inside || child.hover; child.pointerFocus = true; runCatching { child.focus.requestFocus() } }
                        PointerEventType.Release -> { val was = child.pressed; child.pressed = false
                            if (c.type != PointerType.Mouse) child.hover = false
                            if (was && inside && e.motionEvent?.actionMasked != android.view.MotionEvent.ACTION_CANCEL) click(false) }
                        else -> {}
                    }
                }
            }
        }
        .focusRequester(child.focus)
        .onFocusChanged { child.focused = it.isFocused; if (!it.isFocused) child.pointerFocus = false }
        // Exactly one tab is a Tab stop (the roving holder); a pressed or focused tab can still hold focus.
        .focusProperties { canFocus = !child.disabled && (ctx.holder() === child || child.pressed || child.focused) }
        .focusable(enabled = !disabled)
        .onPreviewKeyEvent { e ->
            if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
            when (e.key) {
                Key.Enter, Key.NumPadEnter, Key.Spacebar -> { child.pointerFocus = false; click(true); true }
                Key.DirectionRight -> ctx.key(child, "ArrowRight"); Key.DirectionLeft -> ctx.key(child, "ArrowLeft")
                Key.MoveHome -> ctx.key(child, "Home"); Key.MoveEnd -> ctx.key(child, "End")
                else -> false
            }
        }
        .semantics(mergeDescendants = true) {
            role = Role.Tab; selected = active; contentDescription = child.name
            if (disabled) disabled() else onClick(child.name) { click(false); true }
        }
        .inspectAWCNode(inspection, "", "md-tab", null)) {
        if (g != null) {
            // ::part(content) box (gate-7 R6-17): over the state layer and the divider, under the tab's content and the indicator (the
            // source's stacking order), clipped by the tab as the strip's scroll container clips it.
            parts.content?.takeIf { it.paints }?.let { b -> val cb = g.content
                Box(Modifier.fillMaxSize().drawBehind { clipRect { drawAWCPartBox(b, color, Offset((cb.x * density).toFloat(), (cb.y * density).toFloat()), Size((cb.w * density).toFloat(), (cb.h * density).toFloat())) } }) }
            val ic = g.icon
            if (child.icon.isNotEmpty() && ic != null) Box(Modifier.offset(ic.x.dp, ic.y.dp).size(ic.w.dp, ic.h.dp).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
                val fs = with(LocalDensity.current) { m.icon.dp.toSp() }
                Text(child.icon, Modifier.wrapContentSize(unbounded = true), color = iconColor, fontFamily = tabsSymbolFamily(), fontWeight = FontWeight(400), fontSize = fs, lineHeight = fs,
                    letterSpacing = 0.sp, maxLines = 1, softWrap = false, style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false), fontFeatureSettings = "liga"))
            }
            // An authored icon (slot) renders in the icon box; its presence decides the anatomy (stacked / inline).
            if (child.icon.isEmpty()) CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides color) {
                Layout(content = { slot?.invoke("icon") }, modifier = Modifier.clearAndSetSemantics { }) { ms, _ ->
                    val has = ms.isNotEmpty(); if (child.slotIcon != has) child.slotIcon = has
                    val box = ic ?: return@Layout layout(0, 0) {}
                    val bw = (box.w * density).roundToInt(); val bh = (box.h * density).roundToInt()
                    val pls = ms.map { it.measure(Constraints.fixed(bw, bh)) }
                    layout(bw, bh) { pls.forEach { it.place((box.x * density).roundToInt(), (box.y * density).roundToInt()) } }
                }
            }
            if (child.hasLabel) {
                val lt = g.labelText
                val fs = with(LocalDensity.current) { m.labelSize.dp.toSp() }; val lh = with(LocalDensity.current) { m.lineHeight.dp.toSp() }; val ls = with(LocalDensity.current) { 0.1.dp.toSp() }
                val truncate = lt.w + 0.01 < text.width(child.label, m.labelSize)
                Box(Modifier.offset(lt.x.dp, lt.y.dp).size(lt.w.dp, lt.h.dp).clearAndSetSemantics { }, contentAlignment = Alignment.CenterStart) {
                    Text(child.label, if (truncate) Modifier else Modifier.wrapContentSize(Alignment.CenterStart, unbounded = true), style = tabsText(0.0, 0.0, 500, 0.0, parts.label ?: color).copy(fontSize = fs, lineHeight = lh, letterSpacing = ls),
                        maxLines = 1, softWrap = false, overflow = if (truncate) TextOverflow.Ellipsis else TextOverflow.Visible)
                }
            }
            val b = g.badge; val bt = child.badge
            if (b != null && bt != null) Box(Modifier.offset(b.x.dp, b.y.dp).size(b.w.dp, b.h.dp).clearAndSetSemantics { }.background(pal.badge, RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                if (bt.isNotEmpty()) { val fs = with(LocalDensity.current) { 10.dp.toSp() }
                    Text(bt, color = pal.onBadge, fontFamily = AccordionRoboto, fontWeight = FontWeight(500), fontSize = fs, lineHeight = with(LocalDensity.current) { 14.dp.toSp() }, maxLines = 1, softWrap = false,
                        style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false))) }
            }
            // An authored badge (slot): in flow after the label (margin 4) on a label-only tab, else on the icon (top 2, end -8).
            Layout(content = { CompositionLocalProvider(LocalAWCSlotTextRegistry provides child.slotBadgeText) { slot?.invoke("badge") } }, modifier = Modifier.clearAndSetSemantics { }) { ms, _ ->
                val pls = ms.map { it.measure(Constraints()) }
                val w = if (pls.isEmpty()) null else pls.maxOf { it.width } / density.toDouble()
                if (child.slotBadgeWidth != w) child.slotBadgeWidth = w
                if (w == null) return@Layout layout(0, 0) {}
                val bh = pls.maxOf { it.height } / density.toDouble()
                val icon = g.icon; val l = g.label
                val (x, y) = if (!child.hasIcon && l != null) (if (ctx.rtl) l.x else l.maxX - w) to l.y + (l.h - bh) / 2
                    else if (icon != null) (if (ctx.rtl) icon.x - 8 else icon.maxX + 8 - w) to icon.y + 2 else return@Layout layout(0, 0) {}
                layout((g.width * density).roundToInt(), (g.height * density).roundToInt()) { pls.forEach { it.place((x * density).roundToInt(), (y * density).roundToInt()) } }
            }
            val ind = g.indicator
            val r = if (ctx.primary) min(ind.h, ind.w / 2) else min(2.0, ind.h)
            Box(Modifier.offset(ind.x.dp, ind.y.dp).size(ind.w.dp, ind.h.dp)
                .graphicsLayer { scaleX = tr[1].toFloat(); translationX = (tr[0] * density).toFloat(); alpha = opacity.toFloat() }
                .background(parts.indicator ?: pal.indicator, RoundedCornerShape(topStart = r.dp, topEnd = r.dp)))
            if (focusVisible) Box(Modifier.fillMaxSize().drawBehind { val w = 3 * density; drawRect(pal.focusRing, topLeft = Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w), style = Stroke(w)) })
        }
    }
    val probe = ctx.probe
    if (probe != null && g != null) SideEffect {
        probe.tabs[child.id] = mapOf("active" to active, "disabled" to disabled, "tabStop" to tabStop, "focused" to child.focused, "focusVisible" to focusVisible, "hover" to hover,
            "pressed" to pressed, "color" to color, "iconColor" to iconColor, "layer" to layer, "opacity" to opacity, "translate" to tr[0], "scale" to tr[1], "renderTime" to now, "animating" to child.motion.running(now),
            "name" to child.name, "width" to g.width, "height" to g.height, "coords" to coords,
            "rects" to mapOf("content" to g.content, "icon" to g.icon, "label" to g.label, "indicator" to g.indicator, "divider" to g.divider, "badge" to g.badge)
                .mapValues { (_, r) -> r?.let { listOf(it.x, it.y, it.w, it.h) } }, "indicatorColor" to (parts.indicator ?: pal.indicator), "divider" to (parts.divider ?: pal.tabDivider), "container" to pal.container,
            "labelColor" to (parts.label ?: color), "layerColor" to (parts.layerColor ?: color), "contentBox" to parts.content?.probe(color))
    }
}


// MARK: panels

internal class PanelChild { var active by mutableStateOf(false); var label by mutableStateOf("") }
internal val LocalTabPanels = staticCompositionLocalOf<Boolean> { false }

/**
 * md-tab-panels: follows the md-tabs named by `for` (else the nearest preceding md-tabs in document order) through the
 * tabs registry, which md-tabs updates on every path. `stable` stacks every panel in one cell (the region keeps the
 * largest box; inactive panels keep their layout but are not drawn or exposed); `active` lays out the active panel only.
 */
@Composable
internal fun NativeTabPanels(p: Props, emit: EventSink, slot: Slot?) {
    if (p.bool("hidden")) return
    val registry = LocalAWCTabsRegistry.current
    val preceding = remember { registry.last }
    val tabsID = p.str("for").ifEmpty { preceding ?: "" }
    val index = registry.indices[tabsID] ?: 0
    val labels = registry.labels[tabsID] ?: emptyList()
    val activeOnly = p.str("sizing") == "active"
    val probe = LocalAWCTabsProbe.current
    CompositionLocalProvider(LocalTabPanels provides true) {
        Layout(content = { slot?.invoke("") }, modifier = Modifier.fillMaxWidth()) { ms, c ->
            ms.forEachIndexed { i, m -> (m.layoutId as? PanelChild)?.let { k -> val a = i == index; if (k.active != a) k.active = a; val l = labels.getOrElse(i) { "" }; if (k.label != l) k.label = l } }
            val pls = ms.mapIndexed { i, m -> if (!activeOnly || i == index) m.measure(c.copy(minHeight = 0)) else null }
            val w = max(c.minWidth, pls.maxOfOrNull { it?.width ?: 0 } ?: 0); val h = pls.maxOfOrNull { it?.height ?: 0 } ?: 0
            layout(w, h) { pls.forEach { it?.placeRelative(0, 0) } }
        }
    }
    if (probe != null) SideEffect { probe.panels[p.str("id")] = mapOf("index" to index, "for" to tabsID, "sizing" to if (activeOnly) "active" else "stable") }
}
/** md-tab-panel: role tabpanel named by its tab; an inactive panel keeps its box but is not drawn, hit or exposed. */
@Composable
internal fun NativeTabPanel(p: Props, emit: EventSink, slot: Slot?, child: PanelChild?) {
    if (p.bool("hidden")) return
    val active = child?.active ?: p.bool("active")
    val probe = LocalAWCTabsProbe.current
    val ring = awcRippleHex(LocalAWCThemeTokens.current["--md-sys-color-primary"]) ?: Color(0xFF6750A4)
    // The source sets no colour on the panel: slotted text inherits the page colour. Natively inherited text in a panel paints the
    // theme's on-surface colour on both platforms (gate-7 R6-23; decision in md-tabs-source-review.md).
    val onSurface = awcRippleHex(LocalAWCThemeTokens.current["--md-sys-color-on-surface"]) ?: Color(0xFF1C1B1F)
    val density = LocalDensity.current.density
    var focused by remember { mutableStateOf(false) }
    val label = child?.label ?: ""
    // Source: the active panel is a sequential focus stop (tabindex 0; inactive -1) named by its tab (aria-labelledby), with
    // :host(:focus-visible) { outline: 3px solid primary; outline-offset: 2px; border-radius: 4px } (gate-7 R6-08). A panel has
    // no pointer focus (it is not clickable), so a focused panel was reached by the keyboard and always shows the ring.
    Box(Modifier.fillMaxWidth().graphicsLayer { alpha = if (active) 1f else 0f }
        .then(if (active) Modifier.semantics { isTraversalGroup = true; if (label.isNotEmpty()) contentDescription = label } else Modifier.clearAndSetSemantics { hideFromAccessibility() })
        .onFocusChanged { focused = it.isFocused }
        .focusProperties { canFocus = active }
        .focusable(active)
        .drawWithContent {
            drawContent()
            if (focused && active) {
                val w = 3 * density; val o = 2 * density + w / 2
                drawRoundRect(ring, topLeft = Offset(-o, -o), size = Size(size.width + 2 * o, size.height + 2 * o), cornerRadius = CornerRadius(6 * density + w / 2), style = Stroke(w))
            }
        }) { CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides onSurface) { slot?.invoke("") } }
    if (probe != null) SideEffect { probe.panels[p.str("id")] = mapOf("active" to active, "label" to label, "tabStop" to active, "focused" to focused, "focusVisible" to (focused && active)) }
}
