@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// MARK: hooks

private fun navColor(v: Any?): String? = v?.toString()?.trim()?.takeIf { awcRippleHex(it) != null }
private fun navNumber(v: Any?, unit: String = "px"): Double? = ((v as? Number)?.toDouble() ?: v?.toString()?.trim()?.removeSuffix(unit)?.trim()?.toDoubleOrNull())?.takeIf { it.isFinite() }
private fun navText(v: Any?): String? = v?.toString()?.trim()?.takeIf { it.isNotEmpty() }

/** md-navigation-tab's public hooks (`--md-navigation-tab-*`, the source stylesheet's documented list): colours `#RRGGBB(AA)`,
 *  lengths dp, the indicator shape one corner radius (9999 = full), opacities 0…1; `labelFont` is the CSS `font` shorthand
 *  (inactive weight and line height), `slottedIconFont` the family of text slotted as an icon. Nearer values win. */
data class AWCNavigationTabAppearance(
    val activeIndicatorColor: String? = null, val activeIndicatorWidth: Double? = null, val activeIndicatorHeight: Double? = null, val activeIndicatorShape: Double? = null,
    val activeIconColor: String? = null, val inactiveIconColor: String? = null, val activeLabelColor: String? = null, val inactiveLabelColor: String? = null,
    val labelFont: String? = null, val labelFontSize: Double? = null, val labelFontWeight: Double? = null, val iconSize: Double? = null,
    val paddingBlockStart: Double? = null, val paddingBlockEnd: Double? = null,
    val hoverStateLayerColor: String? = null, val focusStateLayerColor: String? = null, val pressedStateLayerColor: String? = null, val focusStateLayerOpacity: Double? = null,
    val badgeColor: String? = null, val badgeOnColor: String? = null, val disabledOpacity: Double? = null, val slottedIconFont: String? = null,
) {
    fun merging(o: AWCNavigationTabAppearance) = AWCNavigationTabAppearance(o.activeIndicatorColor ?: activeIndicatorColor, o.activeIndicatorWidth ?: activeIndicatorWidth,
        o.activeIndicatorHeight ?: activeIndicatorHeight, o.activeIndicatorShape ?: activeIndicatorShape, o.activeIconColor ?: activeIconColor, o.inactiveIconColor ?: inactiveIconColor,
        o.activeLabelColor ?: activeLabelColor, o.inactiveLabelColor ?: inactiveLabelColor, o.labelFont ?: labelFont, o.labelFontSize ?: labelFontSize,
        o.labelFontWeight ?: labelFontWeight, o.iconSize ?: iconSize, o.paddingBlockStart ?: paddingBlockStart, o.paddingBlockEnd ?: paddingBlockEnd,
        o.hoverStateLayerColor ?: hoverStateLayerColor, o.focusStateLayerColor ?: focusStateLayerColor, o.pressedStateLayerColor ?: pressedStateLayerColor,
        o.focusStateLayerOpacity ?: focusStateLayerOpacity, o.badgeColor ?: badgeColor, o.badgeOnColor ?: badgeOnColor, o.disabledOpacity ?: disabledOpacity,
        o.slottedIconFont ?: slottedIconFont)
    internal fun normalized() = AWCNavigationTabAppearance(navColor(activeIndicatorColor), activeIndicatorWidth?.takeIf { it >= 0 }, activeIndicatorHeight?.takeIf { it >= 0 },
        activeIndicatorShape?.takeIf { it >= 0 }, navColor(activeIconColor), navColor(inactiveIconColor), navColor(activeLabelColor), navColor(inactiveLabelColor),
        navText(labelFont), labelFontSize?.takeIf { it >= 0 }, labelFontWeight?.takeIf { it in 1.0..1000.0 }, iconSize?.takeIf { it >= 0 }, paddingBlockStart, paddingBlockEnd,
        navColor(hoverStateLayerColor), navColor(focusStateLayerColor), navColor(pressedStateLayerColor), focusStateLayerOpacity?.coerceIn(0.0, 1.0),
        navColor(badgeColor), navColor(badgeOnColor), disabledOpacity?.coerceIn(0.0, 1.0), navText(slottedIconFont))
    /** The `font` shorthand's weight and line height. */
    internal val shorthand: Pair<Double?, Double?> get() {
        val f = labelFont ?: return null to null
        var weight: Double? = null; var line: Double? = null
        for (t in f.split(" ").filter { it.isNotEmpty() }) {
            t.toDoubleOrNull()?.takeIf { it in 1.0..1000.0 && weight == null }?.let { weight = it }
            if (t == "bold") weight = 700.0
            if (t.contains("/")) t.split("/").getOrNull(1)?.removeSuffix("px")?.toDoubleOrNull()?.let { line = it }
        }
        return weight to line
    }
    companion object {
        /** Laboratory names (the CSS hook without `--md-navigation-tab-`, camel-cased). */
        fun fromValues(v: Map<String, Any?>) = AWCNavigationTabAppearance(navColor(v["activeIndicatorColor"]), navNumber(v["activeIndicatorWidth"]),
            navNumber(v["activeIndicatorHeight"]), navNumber(v["activeIndicatorShape"]), navColor(v["activeIconColor"]), navColor(v["inactiveIconColor"]),
            navColor(v["activeLabelColor"]), navColor(v["inactiveLabelColor"]), navText(v["labelFont"]), navNumber(v["labelFontSize"]), navNumber(v["labelFontWeight"], ""),
            navNumber(v["iconSize"]), navNumber(v["paddingBlockStart"]), navNumber(v["paddingBlockEnd"]), navColor(v["hoverStateLayerColor"]), navColor(v["focusStateLayerColor"]),
            navColor(v["pressedStateLayerColor"]), navNumber(v["focusStateLayerOpacity"], ""), navColor(v["badgeColor"]), navColor(v["badgeOnColor"]),
            navNumber(v["disabledOpacity"], ""), navText(v["slottedIconFont"])).normalized()
    }
}

/** md-navigation-bar's seven hooks plus every md-navigation-tab hook set on the bar (inherited by the tabs). The container
 *  shape is the CSS border-radius corners, the elevation the CSS box-shadow layers. */
data class AWCNavigationBarAppearance(
    val containerColor: String? = null, val containerHeight: Double? = null, val containerShape: AWCCornerShape? = null, val containerElevation: List<AWCBoxShadow>? = null,
    val dividerColor: String? = null, val dividerWidth: Double? = null, val zIndex: Double? = null,
    val activeIndicatorColor: String? = null, val activeIndicatorWidth: Double? = null, val activeIndicatorHeight: Double? = null, val activeIndicatorShape: Double? = null,
    val activeIconColor: String? = null, val inactiveIconColor: String? = null, val activeLabelColor: String? = null, val inactiveLabelColor: String? = null,
    val labelFont: String? = null, val labelFontSize: Double? = null, val labelFontWeight: Double? = null, val iconSize: Double? = null,
    val paddingBlockStart: Double? = null, val paddingBlockEnd: Double? = null,
    val hoverStateLayerColor: String? = null, val focusStateLayerColor: String? = null, val pressedStateLayerColor: String? = null, val focusStateLayerOpacity: Double? = null,
    val badgeColor: String? = null, val badgeOnColor: String? = null, val disabledOpacity: Double? = null, val slottedIconFont: String? = null,
) {
    constructor(bar: AWCNavigationBarAppearance, tab: AWCNavigationTabAppearance) : this(bar.containerColor, bar.containerHeight, bar.containerShape, bar.containerElevation,
        bar.dividerColor, bar.dividerWidth, bar.zIndex, tab.activeIndicatorColor, tab.activeIndicatorWidth, tab.activeIndicatorHeight, tab.activeIndicatorShape,
        tab.activeIconColor, tab.inactiveIconColor, tab.activeLabelColor, tab.inactiveLabelColor, tab.labelFont, tab.labelFontSize, tab.labelFontWeight, tab.iconSize,
        tab.paddingBlockStart, tab.paddingBlockEnd, tab.hoverStateLayerColor, tab.focusStateLayerColor, tab.pressedStateLayerColor, tab.focusStateLayerOpacity,
        tab.badgeColor, tab.badgeOnColor, tab.disabledOpacity, tab.slottedIconFont)
    val tab: AWCNavigationTabAppearance get() = AWCNavigationTabAppearance(activeIndicatorColor, activeIndicatorWidth, activeIndicatorHeight, activeIndicatorShape,
        activeIconColor, inactiveIconColor, activeLabelColor, inactiveLabelColor, labelFont, labelFontSize, labelFontWeight, iconSize, paddingBlockStart, paddingBlockEnd,
        hoverStateLayerColor, focusStateLayerColor, pressedStateLayerColor, focusStateLayerOpacity, badgeColor, badgeOnColor, disabledOpacity, slottedIconFont).normalized()
    fun merging(o: AWCNavigationBarAppearance) = AWCNavigationBarAppearance(AWCNavigationBarAppearance(o.containerColor ?: containerColor, o.containerHeight ?: containerHeight,
        o.containerShape ?: containerShape, o.containerElevation ?: containerElevation, o.dividerColor ?: dividerColor, o.dividerWidth ?: dividerWidth, o.zIndex ?: zIndex), tab.merging(o.tab))
    companion object {
        /** Laboratory names: the bar hooks plus every md-navigation-tab hook. */
        fun fromValues(v: Map<String, Any?>) = AWCNavigationBarAppearance(AWCNavigationBarAppearance(navColor(v["containerColor"]), navNumber(v["containerHeight"])?.takeIf { it >= 0 },
            AWCCornerShape.fromValues(v["containerShape"]), AWCBoxShadow.list(v["containerElevation"]), navColor(v["dividerColor"]), navNumber(v["dividerWidth"])?.takeIf { it >= 0 },
            navNumber(v["zIndex"], "")?.let { Math.floor(it) }), AWCNavigationTabAppearance.fromValues(v))
        /** The CSS `border-radius` shorthand in px (one to four corners). */
        fun corners(css: String): AWCCornerShape? {
            val v = css.trim().split(Regex("\\s+")).map { it.removeSuffix("px").toDoubleOrNull() ?: return null }
            if (v.isEmpty() || v.size > 4 || v.any { it < 0 }) return null
            val tl = v[0]; val tr = v.getOrElse(1) { v[0] }; val br = v.getOrElse(2) { v[0] }; val bl = v.getOrElse(3) { v.getOrElse(1) { v[0] } }
            fun r(x: Double) = AWCCornerRadius(AWCCornerLength(x), AWCCornerLength(x))
            return AWCCornerShape(r(tl), r(tr), r(br), r(bl))
        }
        /** Source hook text (`--md-navigation-bar-*` / `--md-navigation-tab-*` → value), as the paint fixtures author it. */
        fun fromCSS(css: Map<String, String>): AWCNavigationBarAppearance {
            val b = "--md-navigation-bar-"; val t = "--md-navigation-tab-"
            fun n(k: String) = css[k]?.trim()?.removeSuffix("px")?.removeSuffix("ms")?.toDoubleOrNull()
            val bar = AWCNavigationBarAppearance(navColor(css[b + "container-color"]), n(b + "container-height"), css[b + "container-shape"]?.let { corners(it) },
                css[b + "container-elevation"]?.let { e -> NativeShadowLayer.parse(e).map { l ->
                    val c = l.color; fun ch(v: Float) = "%02X".format((v * 255).roundToInt().coerceIn(0, 255))
                    AWCBoxShadow(l.x, l.y, l.blur, l.spread, "#" + ch(c.red) + ch(c.green) + ch(c.blue) + ch(c.alpha), l.inset) } }, navColor(css[b + "divider-color"]), n(b + "divider-width"), n(b + "z-index"))
            val tab = AWCNavigationTabAppearance(css[t + "active-indicator-color"], n(t + "active-indicator-width"), n(t + "active-indicator-height"), n(t + "active-indicator-shape"),
                css[t + "active-icon-color"], css[t + "inactive-icon-color"], css[t + "active-label-color"], css[t + "inactive-label-color"], css[t + "label-font"],
                n(t + "label-font-size"), n(t + "label-font-weight"), n(t + "icon-size"), n(t + "padding-block-start"), n(t + "padding-block-end"),
                css[t + "hover-state-layer-color"], css[t + "focus-state-layer-color"], css[t + "pressed-state-layer-color"], n(t + "focus-state-layer-opacity"),
                css[t + "badge-color"], css[t + "badge-on-color"], n(t + "disabled-opacity"), css[t + "slotted-icon-font"]).normalized()
            return AWCNavigationBarAppearance(bar, tab)
        }
    }
}

/** md-navigation-bar's methods: `select(index)` clamps to an activatable destination and emits mdChange when the selection
 *  changes; `focusTab(index)` moves keyboard focus to a destination (not a hard-disabled one) without selecting it. */
class AWCNavigationBarController {
    internal var selectHandler: ((Int) -> Unit)? = null
    internal var focusHandler: ((Int) -> Unit)? = null
    fun select(index: Int) { selectHandler?.invoke(index) }
    fun focusTab(index: Int) { focusHandler?.invoke(index) }
}

/** md-navigation-tab's `focusEl()` for a destination outside a bar (inside a bar use the bar's `focusTab(index)`). */
class AWCNavigationTabController {
    internal var focusHandler: (() -> Unit)? = null
    /** Focuses the destination unless it is hard-disabled. */
    fun focusEl() { focusHandler?.invoke() }
}
internal val LocalAWCNavigationTabController = staticCompositionLocalOf<AWCNavigationTabController?> { null }
@Composable
fun AWCNavigationTabControllerScope(controller: AWCNavigationTabController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCNavigationTabController provides controller, content = content)
internal val LocalAWCNavigationBarAppearance = staticCompositionLocalOf { AWCNavigationBarAppearance() }
internal val LocalAWCNavigationTabAppearance = staticCompositionLocalOf { AWCNavigationTabAppearance() }
internal val LocalAWCNavigationBarController = staticCompositionLocalOf<AWCNavigationBarController?> { null }
/** Overrides the system animator scale for the navigation bar (null follows the system: "remove animations" is reduced motion). */
val LocalAWCNavigationBarReducedMotion = staticCompositionLocalOf<Boolean?> { null }
@Composable
fun AWCNavigationBarAppearanceScope(appearance: AWCNavigationBarAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCNavigationBarAppearance.current
    CompositionLocalProvider(LocalAWCNavigationBarAppearance provides inherited.merging(appearance), content = content)
}
@Composable
fun AWCNavigationTabAppearanceScope(appearance: AWCNavigationTabAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCNavigationTabAppearance.current
    CompositionLocalProvider(LocalAWCNavigationTabAppearance provides inherited.merging(appearance.normalized()), content = content)
}
@Composable
fun AWCNavigationBarControllerScope(controller: AWCNavigationBarController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCNavigationBarController provides controller, content = content)

/** Test/Laboratory probe: live per-tab values and the bar state (dp). */
class AWCNavigationBarProbe {
    val tabs = HashMap<String, Map<String, Any?>>()
    var bar: Map<String, Any?> = emptyMap()
}
val LocalAWCNavigationBarProbe = staticCompositionLocalOf<AWCNavigationBarProbe?> { null }

// MARK: model

private val NAV_EMPHASIZED_DECELERATE = listOf(0.05, 0.7, 0.1, 1.0)
private val NAV_EASE = listOf(0.25, 0.1, 0.25, 1.0)

/** A destination of a bar: props, slot facts, interaction state and transitions. */
internal class NavigationChild {
    var props by mutableStateOf<Props>(emptyMap())
    val focus = FocusRequester()
    var focused by mutableStateOf(false)
    var pointerFocus = false
    var wantsFocus = false
    var hover by mutableStateOf(false)
    var pressed by mutableStateOf(false)
    var slotIcon by mutableStateOf(false)
    var slotActiveIcon by mutableStateOf(false)
    val labelSlot = AWCSlotTextRegistry()
    val motion = NavigationMotion()
    val ripple = AWCRippleController()
    val id get() = props.str("id")
    val label get() = props.str("label")
    val icon get() = props.str("icon")
    val activeIcon get() = props.str("activeIcon")
    val hardDisabled get() = props.bool("disabled")
    val softDisabled get() = props.bool("softDisabled")
    val disabled get() = hardDisabled || softDisabled
    /** Authored property names: the catalog defaults fill `props`, but only an authored label-behavior overrides the bar's (the source treats the attribute as the override). */
    var authored: Set<String> = emptySet()
    val ownBehavior: String? get() = if ("labelBehavior" in authored) props["labelBehavior"]?.toString() else null
    /** Default-slot text replaces the label (its fallback). */
    val labelText: String get() = if (labelSlot.hasEntries) awcCollapsedWhitespace(labelSlot.text).trim() else label
    /** null: no badge; "": a small dot; text: a large badge (numbers above badgeMax > 0 read "max+"). */
    val badge: String? get() {
        val rawValue = props["badgeValue"]; val raw = when (rawValue) { is Number -> if (rawValue.toDouble() == Math.rint(rawValue.toDouble())) rawValue.toLong().toString() else rawValue.toString(); null -> ""; else -> rawValue.toString() }
        if (!props.bool("badge") && raw.isEmpty()) return null
        val value = raw.trim(); if (value.isEmpty()) return ""
        val maxValue = (props["badgeMax"] as? Number)?.toDouble() ?: props["badgeMax"]?.toString()?.toDoubleOrNull() ?: 999.0
        val n = value.toDoubleOrNull()
        if (maxValue > 0 && n != null && n.isFinite() && n > maxValue) return (if (maxValue == Math.rint(maxValue)) maxValue.toLong().toString() else maxValue.toString()) + "+"
        return value
    }
    /** Web accessible name: aria-label (the label in icon-only mode), else the badge's "N new" / "New" and the label text. */
    fun name(behavior: String): String {
        props.str("aria-label").takeIf { it.isNotEmpty() }?.let { return it }
        if (behavior == "none") return label
        val b = badge?.let { if (it.isEmpty()) "New" else "$it new" }
        return listOfNotNull(b, labelText).filter { it.isNotEmpty() }.joinToString(" ")
    }
}

internal data class NavigationTargets(val color: Color, val labelColor: Color, val labelOpacity: Double, val layer: Double, val active: Boolean, val reduced: Boolean)

/** Per-destination transitions: host colour (icon, state-layer currentColor) 200 ms emphasized-decelerate; label colour and
 *  opacity, state layer and indicator opacity 100 ms ease; indicator scaleX 200 ms emphasized-decelerate. */
internal class NavigationMotion {
    val color = AWCCSSValueTrack(Color.Transparent, accordionColorLerp)
    val labelColor = AWCCSSValueTrack(Color.Transparent, accordionColorLerp)
    val labelOpacity = AWCCSSValueTrack(1.0, accordionLerp)
    val layer = AWCCSSValueTrack(0.0, accordionLerp)
    val scale = AWCCSSValueTrack(0.0, accordionLerp)
    val opacity = AWCCSSValueTrack(0.0, accordionLerp)
    var initialized = false
    var pending: NavigationTargets? = null
    private var last: NavigationTargets? = null
    fun running(now: Double) = pending != null || color.isRunning(now) || labelColor.isRunning(now) || labelOpacity.isRunning(now) || layer.isRunning(now) || scale.isRunning(now) || opacity.isRunning(now)
    fun request(t: NavigationTargets): Boolean {
        if (t == last) return false
        last = t
        if (!initialized) { color.snap(t.color); labelColor.snap(t.labelColor); labelOpacity.snap(t.labelOpacity); layer.snap(t.layer)
            scale.snap(if (t.active) 1.0 else 0.0); opacity.snap(if (t.active) 1.0 else 0.0); initialized = true; return false }
        pending = t; return true
    }
    fun apply(now: Double) {
        val t = pending ?: return; pending = null
        val r = t.reduced
        color.set(t.color, now, if (r) 0.0 else 200.0, NAV_EMPHASIZED_DECELERATE)
        labelColor.set(t.labelColor, now, if (r) 0.0 else 100.0, NAV_EASE)
        labelOpacity.set(t.labelOpacity, now, if (r) 0.0 else 100.0, NAV_EASE)
        layer.set(t.layer, now, if (r) 0.0 else 100.0, NAV_EASE)
        scale.set(if (t.active) 1.0 else 0.0, now, if (r) 0.0 else 200.0, NAV_EMPHASIZED_DECELERATE)
        opacity.set(if (t.active) 1.0 else 0.0, now, if (r) 0.0 else 100.0, NAV_EASE)
    }
}

internal class NavigationMetrics(val d: Double, val look: AWCNavigationTabAppearance, val behavior: String) {
    val indicatorWidth get() = look.activeIndicatorWidth ?: max(40.0, 56 + 4 * d)
    val indicatorHeight get() = look.activeIndicatorHeight ?: max(24.0, 32 + 2 * d)
    val iconSize get() = look.iconSize ?: max(18.0, 24 + d)
    val labelSize get() = look.labelFontSize ?: max(10.0, 12 + 0.5 * d)
    val lineHeight get() = look.shorthand.second ?: 16.0
    val inactiveWeight get() = look.shorthand.first ?: 500.0
    val activeWeight get() = look.labelFontWeight ?: 600.0
    val gap get() = max(2.0, 6 + d)
    val padTop get() = if (behavior == "none") 16.0 else look.paddingBlockStart ?: (5 + d)
    val padBottom get() = if (behavior == "none") 16.0 else look.paddingBlockEnd ?: (5 + d)
    val shape get() = look.activeIndicatorShape ?: 9999.0
    val disabledOpacity get() = look.disabledOpacity ?: 0.38
    val focusOpacity get() = look.focusStateLayerOpacity ?: 0.1
}

internal class NavigationGeometry(val x: Double, val width: Double, val height: Double, val container: TabRect, val indicator: TabRect, val icon: TabRect, val label: TabRect?)

internal object NavigationLayout {
    fun geometry(labelWidth: Double, m: NavigationMetrics, x: Double, width: Double, height: Double): NavigationGeometry {
        val iw = m.indicatorWidth; val ih = m.indicatorHeight; val hasLabel = m.behavior != "none"
        val stackH = ih + if (hasLabel) m.gap + m.lineHeight else 0.0
        // justify-content: center (icon-only) centres even an overflowing stack (negative free space splits evenly).
        val top = if (hasLabel) m.padTop else m.padTop + (height - m.padTop - m.padBottom - stackH) / 2
        val lw = min(width, labelWidth)
        return NavigationGeometry(x, width, height, TabRect(0.0, top, width, stackH), TabRect((width - iw) / 2, top, iw, ih),
            TabRect((width - m.iconSize) / 2, top + (ih - m.iconSize) / 2, m.iconSize, m.iconSize),
            if (hasLabel) TabRect((width - lw) / 2, top + ih + m.gap, lw, m.lineHeight) else null)
    }
    /** Small dot: 6 × 6 at top 2 / inline-end 14 of the icon container. Large: 16 tall, min 16 wide (4 dp padding), anchored on the
     *  glyph's inline-end top corner, then translate(50%, −50%) (physical, also in RTL as Chrome renders it). */
    fun badge(text: String, g: NavigationGeometry, m: NavigationMetrics, rtl: Boolean, measure: (String) -> Double): TabRect {
        val c = g.indicator
        if (text.isEmpty()) return TabRect(if (rtl) c.x + 14 else c.maxX - 14 - 6, c.y + 2, 6.0, 6.0)
        val w = max(16.0, measure(text) + 8)
        val inset = (c.w - m.iconSize) / 2; val top = (c.h - m.iconSize) / 2
        val x0 = if (rtl) c.x + inset else c.maxX - inset - w
        return TabRect(x0 + w / 2, c.y + top - 8, w, 16.0)
    }
}

internal class NavigationBarPalette(private val tokens: Map<String, String>, private val bar: AWCNavigationBarAppearance, private val tab: AWCNavigationTabAppearance) {
    private fun t(k: String, d: Long) = awcRippleHex(tokens["--md-sys-color-$k"]) ?: Color(d)
    private fun h(v: String?) = v?.let { awcRippleHex(it) }
    val container get() = h(bar.containerColor) ?: t("surface-container", 0xFFF3EDF7)
    val divider get() = h(bar.dividerColor) ?: Color.Transparent
    private val onSurface get() = t("on-surface", 0xFF1C1B1F)
    val indicator get() = h(tab.activeIndicatorColor) ?: t("secondary-container", 0xFFE8DEF8)
    val activeIcon get() = h(tab.activeIconColor) ?: t("on-secondary-container", 0xFF1E192B)
    val inactiveIcon get() = h(tab.inactiveIconColor) ?: t("on-surface-variant", 0xFF49454F)
    val activeLabel get() = h(tab.activeLabelColor) ?: t("on-surface", 0xFF1C1B1F)
    val inactiveLabel get() = h(tab.inactiveLabelColor) ?: t("on-surface-variant", 0xFF49454F)
    val hover get() = h(tab.hoverStateLayerColor) ?: onSurface
    val focus get() = h(tab.focusStateLayerColor) ?: onSurface
    val pressed get() = h(tab.pressedStateLayerColor) ?: onSurface
    val badge get() = h(tab.badgeColor) ?: t("error", 0xFFB3261E)
    val onBadge get() = h(tab.badgeOnColor) ?: t("on-error", 0xFFFFFFFF)
    val focusRing get() = t("secondary", 0xFF625B71)
}

/** Selection: activeIndex truncated (NaN → 0), clamped into range, then the nearest activatable destination forward, then
 *  backward; −1 when none is (source clampToEnabled). */
internal fun navigationClamp(raw: Any?, disabled: List<Boolean>): Int {
    if (disabled.isEmpty()) return -1
    val n = when (raw) { is Number -> raw.toDouble(); is Boolean -> if (raw) 1.0 else 0.0; null -> 0.0; else -> raw.toString().trim().toDoubleOrNull() ?: Double.NaN }
    val t = if (n.isNaN()) 0.0 else if (n.isInfinite()) (if (n > 0) (disabled.size - 1).toDouble() else 0.0) else n.toLong().toDouble()
    val i = t.coerceIn(0.0, (disabled.size - 1).toDouble()).toInt()
    if (!disabled[i]) return i
    for (k in i + 1 until disabled.size) if (!disabled[k]) return k
    for (k in i - 1 downTo 0) if (!disabled[k]) return k
    return -1
}
/** Arrow-key tour: wraps and skips hard-disabled destinations only. */
internal fun navigationNext(hard: List<Boolean>, from: Int, dir: Int): Int {
    val n = hard.size; var i = from
    repeat(n) { i = ((i + dir) % n + n) % n; if (!hard[i]) return i }
    return from
}

internal class NavigationBarState {
    var order by mutableStateOf<List<NavigationChild>>(emptyList())
    var active by mutableIntStateOf(-1)
    var previous = -1
    var lastProperty: Any? = null
    var initialized = false
    var frame by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var placed: Map<NavigationChild, NavigationGeometry> = emptyMap()
    fun running(now: Double) = order.any { it.motion.running(now) }
}

internal class NavigationBarContext(val state: NavigationBarState, val palette: NavigationBarPalette, val look: AWCNavigationTabAppearance, val barBehavior: String,
                                    val barDensity: Double, val reduced: Boolean, val rtl: Boolean, val standalone: Boolean, val activate: (Int) -> Unit,
                                    val key: (NavigationChild, String) -> Boolean, val probe: AWCNavigationBarProbe?, val text: TabsText) {
    fun behavior(c: NavigationChild): String { val b = c.ownBehavior ?: if (standalone) "always" else barBehavior; return if (b in setOf("always", "selected", "none")) b else "always" }
    fun metrics(c: NavigationChild) = NavigationMetrics(resolveAWCDensity(c.props["density"], barDensity), look, behavior(c))
}
internal val LocalNavigationBarRow = staticCompositionLocalOf<NavigationBarContext?> { null }

private fun navigationAnimatorsOff() = !android.animation.ValueAnimator.areAnimatorsEnabled()

// MARK: bar

/**
 * md-navigation-bar: full-width row of equal destinations (flex 1 1 0, min 64 dp), surface-container, density-tapered height;
 * selection (clamped to activatable destinations; programmatic writes and select() announce), the roving tab stop, arrows in
 * visual order (soft-disabled reachable, automatic or manual activation), Home/End, label-behaviour inheritance, mdTabClick /
 * mdChange and link following. Children are md-navigation-tab nodes.
 */
@Composable
internal fun NativeNavigationBar(p: Props, emit: EventSink, slot: Slot?) {
    if (p.bool("hidden")) return
    val state = remember { NavigationBarState() }
    val tokens = LocalAWCThemeTokens.current
    val appearance = LocalAWCNavigationBarAppearance.current; val look = appearance.tab.merging(LocalAWCNavigationTabAppearance.current)
    val standalone = p.bool("_standalone")
    val palette = NavigationBarPalette(tokens, appearance, look)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val reduced = LocalAWCNavigationBarReducedMotion.current ?: navigationAnimatorsOff()
    val barDensity = resolveAWCDensity(p["density"], LocalAWCNativeDensity.current)
    val ctxAndroid = LocalContext.current; val density = LocalDensity.current.density
    val text = remember(ctxAndroid, density) { TabsText(ctxAndroid, density) }
    val probe = LocalAWCNavigationBarProbe.current
    val behavior = p.str("labelBehavior", "always"); val manual = p.bool("manualActivation")
    val label = p.str("aria-label").ifEmpty { p.str("ariaLabel") }
    val height = max(48.0, (appearance.containerHeight ?: 64.0) + 4 * barDensity)
    val divider = appearance.dividerWidth ?: 0.0
    fun disabled() = state.order.map { it.disabled }
    /** source updateSelection: clamp, reflect, mark, emit when the applied index changed (announce). */
    fun update(raw: Any?, announce: Boolean) {
        val clamped = if (state.order.isEmpty()) -1 else navigationClamp(raw, disabled())
        state.active = clamped
        val previous = state.previous; state.previous = clamped
        if (announce && clamped != previous) emit("mdChange", mapOf("index" to clamped, "previousIndex" to previous))
    }
    fun activate(index: Int) { if (!standalone && index != state.active) { update(index, true); state.lastProperty = p["activeIndex"] } }
    fun key(c: NavigationChild, k: String): Boolean {
        if (standalone) return false
        val o = state.order; val current = o.indexOf(c); if (current < 0) return false
        val hard = o.map { it.hardDisabled }; val dir = if (rtl) -1 else 1
        val target = when (k) { "ArrowRight" -> navigationNext(hard, current, dir); "ArrowLeft" -> navigationNext(hard, current, -dir)
            "Home" -> hard.indexOf(false).takeIf { it >= 0 } ?: 0; "End" -> hard.lastIndexOf(false).takeIf { it >= 0 } ?: (o.size - 1); else -> return false }
        if (target == current) return true
        o[target].pointerFocus = false; o[target].wantsFocus = true; runCatching { o[target].focus.requestFocus() }
        if (!manual && !o[target].disabled) update(target, true)
        return true
    }
    LocalAWCNavigationBarController.current?.let { ctl -> SideEffect {
        ctl.selectHandler = { i -> if (!standalone) update(i, true) }
        ctl.focusHandler = { i -> state.order.getOrNull(i)?.takeUnless { it.hardDisabled }?.let { c -> c.wantsFocus = true; runCatching { c.focus.requestFocus() } } }
    } }
    if (standalone) LocalAWCNavigationTabController.current?.let { ctl -> SideEffect {
        ctl.focusHandler = { state.order.firstOrNull()?.takeUnless { it.hardDisabled }?.let { c -> c.wantsFocus = true; runCatching { c.focus.requestFocus() } } }
    } }
    // Children register during layout: reading the order here recomposes the bar once they have, so the initial selection applies.
    val registered = state.order
    // The bar recomposes with its selection too (the probe and semantics follow it).
    @Suppress("UNUSED_VARIABLE") val selected = state.active
    // The initial order selects without announcing; activeIndex writes and child changes re-apply (writes announce).
    SideEffect {
        val o = registered
        if (standalone) return@SideEffect
        if (!state.initialized && o.isNotEmpty()) { state.initialized = true; state.lastProperty = p["activeIndex"]; state.active = navigationClamp(p["activeIndex"], disabled()); state.previous = state.active }
        else if (state.initialized && p["activeIndex"] != state.lastProperty) { state.lastProperty = p["activeIndex"]; update(p["activeIndex"], true) }
        else if (state.initialized) { val c = if (o.isEmpty()) -1 else navigationClamp(state.active, disabled()); if (c != state.active) update(c, false) }
    }
    // The frame clock: transition targets apply on frames; the loop sleeps when nothing runs.
    LaunchedEffect(state) {
        while (isActive) {
            withFrameNanos { t -> val ms = t / 1e6; state.order.forEach { it.motion.apply(ms) }; state.frame = ms }
            if (!state.running(state.frame)) { val v = state.version; snapshotFlow { state.version }.first { it != v } }
        }
    }
    val context = NavigationBarContext(state, palette, look, behavior, barDensity, reduced, rtl, standalone, ::activate, ::key, probe, text)
    val shape = appearance.containerShape ?: AWCCornerShape()
    val shadows = remember(appearance.containerElevation) { appearance.containerElevation?.map { it.resolved() } ?: emptyList() }
    fun writeProbe() { probe?.bar = mapOf("activeIndex" to state.active, "count" to state.order.size, "height" to height + divider, "label" to label, "labelBehavior" to behavior,
        "manualActivation" to manual, "reduced" to reduced, "container" to palette.container, "divider" to palette.divider, "dividerWidth" to divider,
        "zIndex" to (appearance.zIndex ?: 200.0), "elevation" to shadows.size) }
    CompositionLocalProvider(LocalNavigationBarRow provides context, LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints((if (standalone) Modifier else Modifier.fillMaxWidth())
            .zIndex((appearance.zIndex ?: 200.0).toFloat())
            .then(if (standalone) Modifier else Modifier.accordionShadow(shape, shadows, false))
            .then(if (standalone) Modifier else Modifier.background(palette.container, shape)
                .drawBehind { if (divider > 0) clipPath(androidx.compose.ui.graphics.Path().apply { addOutline(shape.createOutline(size, layoutDirection, this@drawBehind)) }) { drawRect(palette.divider, Offset.Zero, Size(size.width, (divider * density).toFloat())) } })
            .then(if (probe != null) Modifier.onGloballyPositioned { writeProbe() } else Modifier)
            .then(if (standalone) Modifier else Modifier.semantics { isTraversalGroup = true; if (label.isNotEmpty()) contentDescription = label; collectionInfo = CollectionInfo(1, state.order.size) })) {
            val viewport = if (standalone) 0.0 else maxWidth.value.toDouble()
            Layout(content = { slot?.invoke("") }) { measurables, _ ->
                val order = measurables.mapNotNull { it.layoutId as? NavigationChild }
                if (order != state.order) state.order = order
                val n = order.size
                val widths = if (standalone) order.map { c -> val m = context.metrics(c); max(48.0, max(m.indicatorWidth, if (m.behavior == "none") 0.0 else text.width(c.labelText, m.labelSize, m.activeWeight.toInt(), 0.5))) }
                    else List(n) { max(64.0, if (n > 0) viewport / n else 0.0) }
                val content = widths.sum(); val span = if (standalone) content else viewport
                val geos = HashMap<NavigationChild, NavigationGeometry>(); var x = 0.0
                order.forEachIndexed { i, c ->
                    val m = context.metrics(c); val activeNow = if (standalone) c.props.bool("active") else i == state.active
                    val lw = if (m.behavior == "none") 0.0 else text.width(c.labelText, m.labelSize, (if (activeNow) m.activeWeight else m.inactiveWeight).toInt(), 0.5)
                    // RTL starts at the right edge (an overflowing row overflows to the left).
                    geos[c] = NavigationLayout.geometry(lw, m, if (rtl) span - x - widths[i] else x, widths[i], height); x += widths[i]
                }
                state.placed = geos
                val hPx = (height * density).roundToInt()
                val placeables = measurables.map { m -> (m.layoutId as? NavigationChild)?.let { c -> geos[c] }?.let { g ->
                    val l = (g.x * density).roundToInt(); val r = ((g.x + g.width) * density).roundToInt()
                    m.measure(Constraints.fixed(r - l, hPx)) to l } ?: (m.measure(Constraints()) to 0) }
                // The destinations sit below the top border (border-block-start).
                val top = (divider * density).roundToInt()
                layout((max(span, if (standalone) content else 0.0) * density).roundToInt(), hPx + top) { placeables.forEach { (pl, l) -> pl.place(l, top) } }
            }
        }
    }
    if (probe != null) SideEffect { writeProbe() }
}

// MARK: destination

private val NavigationSymbols = HashMap<Int, FontFamily>()
private fun navigationSymbolFamily() = NavigationSymbols.getOrPut(400) {
    FontFamily(Font(R.font.awc_material_symbols, FontWeight(400), variationSettings = FontVariation.Settings(
        FontVariation.Setting("FILL", 0f), FontVariation.weight(400), FontVariation.Setting("opsz", 24f), FontVariation.grade(0))))
}
private fun navigationText(size: Double, lineHeight: Double, weight: Int, color: Color) = TextStyle(color = color, fontFamily = AccordionRoboto,
    fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = lineHeight.sp, letterSpacing = 0.5.sp,
    platformStyle = PlatformTextStyle(includeFontPadding = false), lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None))

/** md-navigation-tab: a bar child (the bar lays it out and owns selection) or a standalone destination with its own `active`. */
@Composable
internal fun NativeNavigationTab(p: Props, emit: EventSink, slot: Slot?, child: NavigationChild?, authored: Set<String> = p.keys) {
    if (p.bool("hidden")) return
    if (child == null) {
        // Outside a bar: its own active state and tab stop; activation emits mdTabClick only (index 0) and follows its link.
        NativeNavigationBar(mapOf("_standalone" to true, "id" to p.str("id") + "-bar"), emit) { s ->
            if (s == "") { val c = remember { NavigationChild() }; Box(Modifier.layoutId(c)) { NativeNavigationTab(p, emit, slot, c, authored) } }
        }
        return
    }
    val ctx = LocalNavigationBarRow.current ?: return
    SideEffect { if (child.props != p) child.props = p; if (child.authored != authored) child.authored = authored }
    val st = ctx.state; val now = st.frame; val pal = ctx.palette
    val index = st.order.indexOf(child)
    val active = if (ctx.standalone) child.props.bool("active") else index >= 0 && index == st.active
    val hard = child.hardDisabled; val soft = child.softDisabled && !hard; val inert = hard || soft
    val focusVisible = child.focused && !child.pointerFocus && !hard
    val hover = !hard && child.hover; val pressed = !hard && child.pressed
    val m = ctx.metrics(child)
    val color0 = if (active) pal.activeIcon else pal.inactiveIcon
    // focus-visible wins, then pressed, then hover (the stylesheet order); a soft-disabled destination shows only the focus layer.
    val (layerTarget, layerColor) = when { focusVisible -> m.focusOpacity to pal.focus; inert -> 0.0 to color0; pressed -> 0.12 to pal.pressed; hover -> 0.08 to pal.hover; else -> 0.0 to color0 }
    val targets = NavigationTargets(color0, if (active) pal.activeLabel else pal.inactiveLabel, if (m.behavior == "selected" && !active) 0.0 else 1.0, layerTarget, active, ctx.reduced)
    if (!child.motion.initialized) child.motion.request(targets)
    SideEffect { if (child.motion.request(targets)) st.version++ }
    val g = st.placed[child]
    val density = LocalDensity.current.density
    val inspection = LocalAWCInspection.current
    val color = child.motion.color.presented(now); val layer = child.motion.layer.presented(now)
    val labelColor = child.motion.labelColor.presented(now); val labelOpacity = child.motion.labelOpacity.presented(now)
    val scale = child.motion.scale.presented(now); val opacity = child.motion.opacity.presented(now)
    val tabStop = if (ctx.standalone) !hard else active
    val name = child.name(m.behavior)
    val uri = LocalUriHandler.current
    val router = LocalAWCURLRouter.current ?: remember(uri) { AWCURLRouter { r -> if (!java.net.URI(r.url).isAbsolute) false else runCatching { uri.openUri(r.url); true }.getOrDefault(false) } }
    fun click(keyboard: Boolean) {
        if (inert) return
        if (keyboard) child.ripple.trigger()
        emit("mdTabClick", mapOf("index" to if (ctx.standalone) 0 else index))
        if (!ctx.standalone && index >= 0) ctx.activate(index)
        val href = child.props.str("href"); if (href.isNotEmpty()) AWCNavigationRequest.from(href, child.props.str("target").ifEmpty { "_self" })?.let { router.open(it) }
    }
    var coords by remember { mutableStateOf<androidx.compose.ui.layout.LayoutCoordinates?>(null) }
    Box(Modifier.fillMaxSize()
        .graphicsLayer { alpha = if (inert) m.disabledOpacity.toFloat() else 1f }
        .drawBehind { drawRect(layerColor.copy(alpha = (layerColor.alpha * layer).toFloat())) }
        .awcRipple(disabled = inert, contentColor = color, controller = child.ripple)
        .onGloballyPositioned { coords = it }
        .pointerInput(child, hard) {
            awaitPointerEventScope {
                while (true) {
                    val e = awaitPointerEvent(PointerEventPass.Main)
                    val c = e.changes.firstOrNull() ?: continue
                    val inside = c.position.x >= 0 && c.position.y >= 0 && c.position.x < size.width && c.position.y < size.height
                    when (e.type) {
                        PointerEventType.Enter, PointerEventType.Move -> if (c.type == PointerType.Mouse || child.pressed) child.hover = !child.hardDisabled && inside
                        PointerEventType.Exit -> child.hover = false
                        PointerEventType.Press -> if (!child.hardDisabled) { child.pressed = true; child.hover = inside || child.hover; child.pointerFocus = true; child.wantsFocus = true; runCatching { child.focus.requestFocus() } }
                        PointerEventType.Release -> { val was = child.pressed; child.pressed = false
                            if (c.type != PointerType.Mouse) child.hover = false
                            if (was && inside && e.motionEvent?.actionMasked != android.view.MotionEvent.ACTION_CANCEL) click(false) }
                        else -> {}
                    }
                }
            }
        }
        .focusRequester(child.focus)
        .onFocusChanged { child.focused = it.isFocused; if (!it.isFocused) { child.pointerFocus = false; child.wantsFocus = false } }
        // The roving stop is the active destination; arrows, focusTab() and presses focus others (soft-disabled included).
        .focusProperties { canFocus = !child.hardDisabled && (tabStop || child.pressed || child.focused || child.wantsFocus) }
        .focusable(enabled = !hard)
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
            role = Role.Tab; selected = active; contentDescription = name
            if (inert) disabled() else onClick(name) { click(false); true }
        }
        .inspectAWCNode(inspection, "", "md-navigation-tab", null)) {
        // The default slot's text replaces the label (collected, then drawn with the label styling).
        Layout(content = { CompositionLocalProvider(LocalAWCSlotTextRegistry provides child.labelSlot) { slot?.invoke("") } }, modifier = Modifier.size(0.dp)) { ms, _ ->
            ms.forEach { it.measure(Constraints()) }; layout(0, 0) {} }
        if (g != null) {
            val ind = g.indicator
            val radius = min(m.shape, min(ind.h / 2, ind.w / 2))
            Box(Modifier.offset(ind.x.dp, ind.y.dp).size(ind.w.dp, ind.h.dp)
                .graphicsLayer { scaleX = scale.toFloat(); alpha = opacity.toFloat() }
                .background(pal.indicator, RoundedCornerShape(radius.dp)))
            val ic = g.icon
            // The active destination shows the active-icon slot, else the icon glyph; an inactive one the icon slot, else the glyph.
            val slotName = if (active) "active-icon" else "icon"
            val hasSlot = if (active) child.slotActiveIcon else child.slotIcon
            androidx.compose.runtime.CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides color) {
                Layout(content = { slot?.invoke(slotName) }, modifier = Modifier.clearAndSetSemantics { }) { ms, _ ->
                    val has = ms.isNotEmpty(); if (active) { if (child.slotActiveIcon != has) child.slotActiveIcon = has } else if (child.slotIcon != has) child.slotIcon = has
                    val bw = (ic.w * density).roundToInt(); val bh = (ic.h * density).roundToInt()
                    val pls = ms.map { it.measure(Constraints.fixed(bw, bh)) }
                    layout(bw, bh) { pls.forEach { it.place((ic.x * density).roundToInt(), (ic.y * density).roundToInt()) } }
                }
            }
            val glyph = if (active && child.activeIcon.isNotEmpty()) child.activeIcon else child.icon
            if (!hasSlot && glyph.isNotEmpty()) Box(Modifier.offset(ic.x.dp, ic.y.dp).size(ic.w.dp, ic.h.dp).clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
                val fs = with(LocalDensity.current) { m.iconSize.dp.toSp() }
                Text(glyph, Modifier.wrapContentSize(unbounded = true), color = color, fontFamily = navigationSymbolFamily(), fontWeight = FontWeight(400), fontSize = fs, lineHeight = fs,
                    letterSpacing = 0.sp, maxLines = 1, softWrap = false, style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false), fontFeatureSettings = "liga"))
            }
            g.label?.let { l ->
                val weight = (if (active) m.activeWeight else m.inactiveWeight).toInt()
                val fs = with(LocalDensity.current) { m.labelSize.dp.toSp() }; val lh = with(LocalDensity.current) { m.lineHeight.dp.toSp() }; val ls = with(LocalDensity.current) { 0.5.dp.toSp() }
                val truncate = l.w + 0.01 < ctx.text.width(child.labelText, m.labelSize, weight, 0.5)
                Box(Modifier.offset(l.x.dp, l.y.dp).size(l.w.dp, l.h.dp).graphicsLayer { alpha = labelOpacity.toFloat() }.clearAndSetSemantics { }, contentAlignment = Alignment.Center) {
                    Text(child.labelText, if (truncate) Modifier else Modifier.wrapContentSize(Alignment.Center, unbounded = true),
                        style = navigationText(0.0, 0.0, weight, labelColor).copy(fontSize = fs, lineHeight = lh, letterSpacing = ls, textAlign = TextAlign.Center),
                        maxLines = 1, softWrap = false, overflow = if (truncate) TextOverflow.Ellipsis else TextOverflow.Visible)
                }
            }
            child.badge?.let { bt ->
                val b = NavigationLayout.badge(bt, g, m, ctx.rtl) { s -> ctx.text.width(s, 11.0, 500, 0.5) }
                Box(Modifier.offset(b.x.dp, b.y.dp).size(b.w.dp, b.h.dp).clearAndSetSemantics { }.background(pal.badge, RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                    if (bt.isNotEmpty()) { val fs = with(LocalDensity.current) { 11.dp.toSp() }
                        Text(bt, color = pal.onBadge, fontFamily = AccordionRoboto, fontWeight = FontWeight(500), fontSize = fs, lineHeight = with(LocalDensity.current) { 16.dp.toSp() },
                            letterSpacing = with(LocalDensity.current) { 0.5.dp.toSp() }, maxLines = 1, softWrap = false, style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false))) }
                }
            }
            if (focusVisible) Box(Modifier.offset((ind.x - 4).dp, (ind.y - 4).dp).size((ind.w + 8).dp, (ind.h + 8).dp).drawBehind {
                val w = 3 * density; val r = (min(m.shape, min((ind.h + 8) / 2, (ind.w + 8) / 2)) * density).toFloat()
                drawRoundRect(pal.focusRing, topLeft = Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w), cornerRadius = CornerRadius(r - w / 2, r - w / 2), style = Stroke(w))
            })
        }
    }
    val probe = ctx.probe
    if (probe != null && g != null) SideEffect {
        val badge = child.badge?.let { NavigationLayout.badge(it, g, m, ctx.rtl) { s -> ctx.text.width(s, 11.0, 500, 0.5) } }
        probe.tabs[child.id] = mapOf("active" to active, "disabled" to hard, "softDisabled" to soft, "tabStop" to tabStop, "focused" to child.focused, "focusVisible" to focusVisible,
            "hover" to hover, "pressed" to pressed, "color" to color, "layer" to layer, "layerColor" to layerColor, "labelColor" to labelColor, "labelOpacity" to labelOpacity,
            "scale" to scale, "opacity" to opacity, "renderTime" to now, "animating" to child.motion.running(now), "name" to name, "behavior" to m.behavior,
            "alpha" to if (inert) m.disabledOpacity else 1.0, "width" to g.width, "height" to g.height, "coords" to coords, "labelWeight" to (if (active) m.activeWeight else m.inactiveWeight),
            "labelSize" to m.labelSize, "badge" to child.badge, "indicatorColor" to pal.indicator, "badgeColor" to pal.badge, "badgeTextColor" to pal.onBadge,
            "radius" to min(m.shape, min(g.indicator.h / 2, g.indicator.w / 2)),
            "rects" to mapOf("container" to g.container, "indicator" to g.indicator, "icon" to g.icon, "label" to g.label, "badge" to badge).mapValues { (_, r) -> r?.let { listOf(it.x, it.y, it.w, it.h) } })
    }
}
