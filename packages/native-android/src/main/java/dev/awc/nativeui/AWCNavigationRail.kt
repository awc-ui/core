@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isAltPressed
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// MARK: hooks

private fun railColor(v: Any?): String? = v?.toString()?.trim()?.takeIf { awcRippleHex(it) != null }
private fun railNumber(v: Any?, unit: String = "px"): Double? =
    ((v as? Number)?.toDouble() ?: v?.toString()?.trim()?.removeSuffix(unit)?.trim()?.toDoubleOrNull())?.takeIf { it.isFinite() }
private fun railLength(v: Double?) = v?.takeIf { it.isFinite() && it >= 0 }
private fun railUnit(v: Double?) = v?.takeIf { it.isFinite() }?.coerceIn(0.0, 1.0)

/** md-navigation-rail-tab's public hooks (`--md-navigation-rail-tab-*`): colours `#RRGGBB(AA)`, lengths dp, the indicator
 *  shape one corner radius (9999 = full), opacities 0…1, the caret duration ms. `labelTypography` is accepted and, as on Web
 *  (no rule reads it), has no effect. Nearer values win. */
data class AWCNavigationRailTabAppearance(
    val activeIconColor: String? = null, val activeLabelColor: String? = null, val badgeColor: String? = null, val badgeContentColor: String? = null,
    val caretDuration: Double? = null, val focusRingColor: String? = null, val focusStateLayerOpacity: Double? = null,
    val iconColor: String? = null, val iconSize: Double? = null, val indicatorColor: String? = null, val indicatorHeight: Double? = null,
    val indicatorShape: Double? = null, val indicatorWidth: Double? = null, val labelColor: String? = null, val labelTypography: String? = null,
    val minHeight: Double? = null, val pressStateLayerOpacity: Double? = null, val stateLayerColor: String? = null,
) {
    internal fun normalized() = AWCNavigationRailTabAppearance(railColor(activeIconColor), railColor(activeLabelColor), railColor(badgeColor), railColor(badgeContentColor),
        railLength(caretDuration), railColor(focusRingColor), railUnit(focusStateLayerOpacity), railColor(iconColor), railLength(iconSize), railColor(indicatorColor),
        railLength(indicatorHeight), railLength(indicatorShape), railLength(indicatorWidth), railColor(labelColor), labelTypography?.trim()?.takeIf { it.isNotEmpty() },
        railLength(minHeight), railUnit(pressStateLayerOpacity), railColor(stateLayerColor))
    fun merging(o: AWCNavigationRailTabAppearance) = AWCNavigationRailTabAppearance(o.activeIconColor ?: activeIconColor, o.activeLabelColor ?: activeLabelColor,
        o.badgeColor ?: badgeColor, o.badgeContentColor ?: badgeContentColor, o.caretDuration ?: caretDuration, o.focusRingColor ?: focusRingColor,
        o.focusStateLayerOpacity ?: focusStateLayerOpacity, o.iconColor ?: iconColor, o.iconSize ?: iconSize, o.indicatorColor ?: indicatorColor,
        o.indicatorHeight ?: indicatorHeight, o.indicatorShape ?: indicatorShape, o.indicatorWidth ?: indicatorWidth, o.labelColor ?: labelColor,
        o.labelTypography ?: labelTypography, o.minHeight ?: minHeight, o.pressStateLayerOpacity ?: pressStateLayerOpacity, o.stateLayerColor ?: stateLayerColor)
    companion object {
        /** Laboratory names (the CSS hook without `--md-navigation-rail-tab-`, camel-cased). */
        fun fromValues(v: Map<String, Any?>) = AWCNavigationRailTabAppearance(railColor(v["activeIconColor"]), railColor(v["activeLabelColor"]), railColor(v["badgeColor"]),
            railColor(v["badgeContentColor"]), railNumber(v["caretDuration"], "ms"), railColor(v["focusRingColor"]), railNumber(v["focusStateLayerOpacity"], ""),
            railColor(v["iconColor"]), railNumber(v["iconSize"]), railColor(v["indicatorColor"]), railNumber(v["indicatorHeight"]), railNumber(v["indicatorShape"]),
            railNumber(v["indicatorWidth"]), railColor(v["labelColor"]), v["labelTypography"]?.toString(), railNumber(v["minHeight"]),
            railNumber(v["pressStateLayerOpacity"], ""), railColor(v["stateLayerColor"])).normalized()
        /** Source hook text (`--md-navigation-rail-tab-*` → value), as the paint fixtures author it. */
        fun fromCSS(css: Map<String, String>): AWCNavigationRailTabAppearance {
            val t = "--md-navigation-rail-tab-"
            fun n(k: String) = css[t + k]?.trim()?.removeSuffix("px")?.removeSuffix("ms")?.trim()?.toDoubleOrNull()
            return AWCNavigationRailTabAppearance(css[t + "active-icon-color"], css[t + "active-label-color"], css[t + "badge-color"], css[t + "badge-content-color"],
                n("caret-duration"), css[t + "focus-ring-color"], n("focus-state-layer-opacity"), css[t + "icon-color"], n("icon-size"), css[t + "indicator-color"],
                n("indicator-height"), n("indicator-shape"), n("indicator-width"), css[t + "label-color"], css[t + "label-typography"], n("min-height"),
                n("press-state-layer-opacity"), css[t + "state-layer-color"]).normalized()
        }
    }
}

/** md-navigation-rail's hooks (`--md-navigation-rail-*`) plus the md-navigation-rail-tab hooks set on the rail (inherited by
 *  every destination). The container shape is the CSS border-radius corners (physical), the elevation the box-shadow layers. */
data class AWCNavigationRailAppearance(
    val containerColor: String? = null, val containerElevation: List<AWCBoxShadow>? = null, val containerShape: AWCCornerShape? = null,
    val containerWidth: Double? = null, val contentColor: String? = null, val destinationsGap: Double? = null, val expandedMaxWidth: Double? = null,
    val expandedWidth: Double? = null, val fabSize: Double? = null, val footerGap: Double? = null, val footerLeadingSize: Double? = null, val gap: Double? = null,
    val headerSpace: Double? = null, val horizontalHeight: Double? = null, val horizontalPaddingBlock: Double? = null, val horizontalPaddingInline: Double? = null,
    val logoIconSize: Double? = null, val paddingBlock: Double? = null, val paddingInline: Double? = null,
    val tab: AWCNavigationRailTabAppearance = AWCNavigationRailTabAppearance(),
) {
    fun merging(o: AWCNavigationRailAppearance) = AWCNavigationRailAppearance(o.containerColor ?: containerColor, o.containerElevation ?: containerElevation,
        o.containerShape ?: containerShape, o.containerWidth ?: containerWidth, o.contentColor ?: contentColor, o.destinationsGap ?: destinationsGap,
        o.expandedMaxWidth ?: expandedMaxWidth, o.expandedWidth ?: expandedWidth, o.fabSize ?: fabSize, o.footerGap ?: footerGap,
        o.footerLeadingSize ?: footerLeadingSize, o.gap ?: gap, o.headerSpace ?: headerSpace, o.horizontalHeight ?: horizontalHeight,
        o.horizontalPaddingBlock ?: horizontalPaddingBlock, o.horizontalPaddingInline ?: horizontalPaddingInline, o.logoIconSize ?: logoIconSize,
        o.paddingBlock ?: paddingBlock, o.paddingInline ?: paddingInline, tab.merging(o.tab))
    internal fun normalized() = copy(containerColor = railColor(containerColor), contentColor = railColor(contentColor), containerWidth = railLength(containerWidth),
        destinationsGap = railLength(destinationsGap), expandedMaxWidth = railLength(expandedMaxWidth), expandedWidth = railLength(expandedWidth),
        fabSize = railLength(fabSize), footerGap = railLength(footerGap), footerLeadingSize = railLength(footerLeadingSize), gap = railLength(gap),
        headerSpace = railLength(headerSpace), horizontalHeight = railLength(horizontalHeight), horizontalPaddingBlock = railLength(horizontalPaddingBlock),
        horizontalPaddingInline = railLength(horizontalPaddingInline), logoIconSize = railLength(logoIconSize), paddingBlock = railLength(paddingBlock),
        paddingInline = railLength(paddingInline), tab = tab.normalized())
    companion object {
        /** Laboratory names: the rail hooks plus every md-navigation-rail-tab hook. */
        fun fromValues(v: Map<String, Any?>) = AWCNavigationRailAppearance(railColor(v["containerColor"]), AWCBoxShadow.list(v["containerElevation"]),
            AWCCornerShape.fromValues(v["containerShape"]), railNumber(v["containerWidth"]), railColor(v["contentColor"]), railNumber(v["destinationsGap"]),
            railNumber(v["expandedMaxWidth"]), railNumber(v["expandedWidth"]), railNumber(v["fabSize"]), railNumber(v["footerGap"]), railNumber(v["footerLeadingSize"]),
            railNumber(v["gap"]), railNumber(v["headerSpace"]), railNumber(v["horizontalHeight"]), railNumber(v["horizontalPaddingBlock"]),
            railNumber(v["horizontalPaddingInline"]), railNumber(v["logoIconSize"]), railNumber(v["paddingBlock"]), railNumber(v["paddingInline"]),
            AWCNavigationRailTabAppearance.fromValues(v)).normalized()
        /** Source hook text (`--md-navigation-rail-*` / `--md-navigation-rail-tab-*` → value), as the paint fixtures author it. */
        fun fromCSS(css: Map<String, String>): AWCNavigationRailAppearance {
            val r = "--md-navigation-rail-"
            fun n(k: String) = css[r + k]?.trim()?.removeSuffix("px")?.trim()?.toDoubleOrNull()
            val shadows = css[r + "container-elevation"]?.let { e -> NativeShadowLayer.parse(e).map { l ->
                val c = l.color; fun ch(v: Float) = "%02X".format((v * 255).roundToInt().coerceIn(0, 255))
                AWCBoxShadow(l.x, l.y, l.blur, l.spread, "#" + ch(c.red) + ch(c.green) + ch(c.blue) + ch(c.alpha), l.inset) } }
            return AWCNavigationRailAppearance(css[r + "container-color"], shadows, css[r + "container-shape"]?.let { AWCNavigationBarAppearance.corners(it) },
                n("container-width"), css[r + "content-color"], n("destinations-gap"), n("expanded-max-width"), n("expanded-width"), n("fab-size"), n("footer-gap"),
                n("footer-leading-size"), n("gap"), n("header-space"), n("horizontal-height"), n("horizontal-padding-block"), n("horizontal-padding-inline"),
                n("logo-icon-size"), n("padding-block"), n("padding-inline"), AWCNavigationRailTabAppearance.fromCSS(css)).normalized()
        }
    }
}

/** md-navigation-rail's methods: `expand()`, `collapse()`, `toggle()` (each emits mdExpand / mdCollapse when the variant
 *  changes), `focusTab(index)` (keyboard focus and the roving stop, no selection) and the destinations'
 *  `clearSubmenuSelection()` by index. */
class AWCNavigationRailController {
    internal var variantHandler: ((String?) -> Unit)? = null
    internal var focusHandler: ((Int) -> Unit)? = null
    internal var clearHandler: ((Int) -> Unit)? = null
    fun expand() { variantHandler?.invoke("expanded") }
    fun collapse() { variantHandler?.invoke("standard") }
    fun toggle() { variantHandler?.invoke(null) }
    fun focusTab(index: Int) { focusHandler?.invoke(index) }
    fun clearSubmenuSelection(tabIndex: Int) { clearHandler?.invoke(tabIndex) }
}
// MARK: parts

/** md-navigation-rail's CSS parts (CEM order). Part rules come from the outer tree, so a native part appearance wins over the
 *  hooks and every internal state rule (an opacity replaces the part's own state-driven opacity). Every part honours
 *  `backgroundColor`, `cornerShape` and `opacity` on its source box (the opacity also covers what the part contains); `color`
 *  inherits to the footer profile text (footer, footer-profile, footer-content) and inks the overflow trigger; `gap` sets the
 *  destinations' spacing (destinations), the footer items' spacing (footer) and the profile's leading → text gap
 *  (footer-profile); footer-content also takes `fontSize`, `fontWeight` and `letterSpacing`. */
enum class AWCNavigationRailPart(val source: String) {
    Scrim("scrim"), Container("container"), Logo("logo"), LogoContracted("logo-contracted"), LogoExpanded("logo-expanded"), Toggle("toggle"), Header("header"),
    Fab("fab"), Destinations("destinations"), Overflow("overflow"), OverflowTrigger("overflow-trigger"), Footer("footer"), FooterProfile("footer-profile"),
    FooterLeading("footer-leading"), FooterContent("footer-content");
    companion object { fun fromSource(name: String) = entries.firstOrNull { it.source == name } }
}
/** md-navigation-rail-tab's CSS parts (CEM order). indicator: `backgroundColor` (every destination, whatever its state),
 *  `cornerShape` (also the state layer's), `width` / `height`, `opacity`; state-layer: `backgroundColor`, `opacity` (fixed in
 *  every state); icon-wrapper: `backgroundColor`, `cornerShape`, `opacity`, `color` (inherited by the icon); icon: `color`,
 *  `fontSize` (the glyph inside its unchanged box), `opacity`; label: `color`, `fontSize`, `lineHeight`, `fontWeight`,
 *  `letterSpacing`, `opacity`; caret: `color`, `opacity`; anchor (link destinations; `display: contents` paints nothing):
 *  `color`, inherited by the icon. */
enum class AWCNavigationRailTabPart(val source: String) {
    Indicator("indicator"), Label("label"), IconWrapper("icon-wrapper"), Icon("icon"), StateLayer("state-layer"), Caret("caret"), Anchor("anchor");
    companion object { fun fromSource(name: String) = entries.firstOrNull { it.source == name } }
}
/** The shared sparse part vocabulary (md-accordion / md-list). */
typealias AWCNavigationRailPartAppearance = AWCAccordionPartAppearance
internal val LocalAWCNavigationRailParts = staticCompositionLocalOf { emptyMap<AWCNavigationRailPart, AWCAccordionPartAppearance>() }
internal val LocalAWCNavigationRailTabParts = staticCompositionLocalOf { emptyMap<AWCNavigationRailTabPart, AWCAccordionPartAppearance>() }
internal val LocalAWCNavigationRailTabPartTargets = staticCompositionLocalOf { emptyMap<String, Map<AWCNavigationRailTabPart, AWCAccordionPartAppearance>>() }
/** `md-navigation-rail::part(<part>)` styling for the rails in this subtree (nested scopes merge, nearer values win). */
@Composable fun AWCNavigationRailPartAppearanceScope(part: AWCNavigationRailPart, appearance: AWCAccordionPartAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCNavigationRailParts.current
    CompositionLocalProvider(LocalAWCNavigationRailParts provides inherited + (part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)), content = content)
}
/** `md-navigation-rail-tab::part(<part>)` styling for every destination in this subtree, or — with [id] — only for the destination
 *  whose `id` property matches (declared on it, so it wins over the subtree value). */
@Composable fun AWCNavigationRailTabPartAppearanceScope(part: AWCNavigationRailTabPart, appearance: AWCAccordionPartAppearance, id: String? = null, content: @Composable () -> Unit) {
    if (id == null) {
        val inherited = LocalAWCNavigationRailTabParts.current
        CompositionLocalProvider(LocalAWCNavigationRailTabParts provides inherited + (part to (inherited[part] ?: AWCAccordionPartAppearance()).merged(appearance)), content = content)
    } else {
        val targets = LocalAWCNavigationRailTabPartTargets.current; val own = targets[id] ?: emptyMap()
        CompositionLocalProvider(LocalAWCNavigationRailTabPartTargets provides targets + (id to own + (part to (own[part] ?: AWCAccordionPartAppearance()).merged(appearance))), content = content)
    }
}
private fun railPartColor(v: String?) = v?.let { awcRippleHex(it) }

internal val LocalAWCNavigationRailAppearance = staticCompositionLocalOf { AWCNavigationRailAppearance() }
internal val LocalAWCNavigationRailTabAppearance = staticCompositionLocalOf { AWCNavigationRailTabAppearance() }
internal val LocalAWCNavigationRailController = staticCompositionLocalOf<AWCNavigationRailController?> { null }
/** Overrides the system animator scale for the rail (null follows the system: "remove animations" is reduced motion). */
val LocalAWCNavigationRailReducedMotion = staticCompositionLocalOf<Boolean?> { null }
/** The viewport a `fullHeight` rail spans (Web `100dvh`, dp); null spans the height offered to it. */
val LocalAWCNavigationRailViewport = staticCompositionLocalOf<Size?> { null }
@Composable fun AWCNavigationRailAppearanceScope(appearance: AWCNavigationRailAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCNavigationRailAppearance.current
    CompositionLocalProvider(LocalAWCNavigationRailAppearance provides inherited.merging(appearance.normalized()), content = content)
}
@Composable fun AWCNavigationRailTabAppearanceScope(appearance: AWCNavigationRailTabAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCNavigationRailTabAppearance.current
    CompositionLocalProvider(LocalAWCNavigationRailTabAppearance provides inherited.merging(appearance.normalized()), content = content)
}
@Composable fun AWCNavigationRailControllerScope(controller: AWCNavigationRailController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCNavigationRailController provides controller, content = content)

/** Test / Laboratory probe: the rail and per-destination values (dp, rail-local), written every rendered frame. */
class AWCNavigationRailProbe {
    @Volatile var rail: Map<String, Any?> = emptyMap()
    val tabs = java.util.concurrent.ConcurrentHashMap<String, Map<String, Any?>>()
}
val LocalAWCNavigationRailProbe = staticCompositionLocalOf<AWCNavigationRailProbe?> { null }

// MARK: model

internal data class RailRect(val x: Double = 0.0, val y: Double = 0.0, val w: Double = 0.0, val h: Double = 0.0) {
    val maxX get() = x + w; val maxY get() = y + h; val midX get() = x + w / 2; val midY get() = y + h / 2
    fun offset(dx: Double, dy: Double) = copy(x = x + dx, y = y + dy)
    fun contains(px: Double, py: Double) = px >= x && py >= y && px < maxX && py < maxY
    fun list() = listOf(x, y, w, h)
}
internal val RAIL_STANDARD = listOf(0.2, 0.0, 0.0, 1.0)
/** --md-sys-motion-spring-effects-fast (the destinations' colour, layer, weight, FILL and reveal transitions). */
internal val RAIL_EFFECTS_FAST = listOf(0.31, 0.94, 0.34, 1.0)
/** --md-sys-motion-spring-effects-default (the modal surface's colour, shadow and corners). */
internal val RAIL_EFFECTS_DEFAULT = listOf(0.34, 0.8, 0.34, 1.0)

/** A destination of a rail: props, slot facts, interaction state and transitions (registered as the layout id). */
internal class RailChild {
    var props by mutableStateOf<Props>(emptyMap())
    val focus = FocusRequester()
    var focused by mutableStateOf(false)
    var pointerFocus = false
    var wantsFocus = false
    var hover by mutableStateOf(false)
    var pressed by mutableStateOf(false)
    var slotIcon by mutableStateOf(false)
    var hasMenu by mutableStateOf(false)
    var menuOpen by mutableStateOf(false)
    /** The submenu's items (reported by the slotted md-menu-items). */
    val submenu = RailSubmenuProbe()
    /** The props and interaction state the rail's frame clock last saw (a change wakes it). */
    var lastSignal: Any? = null
    val motion = RailTabMotion()
    val ripple = AWCRippleController()
    /** The destination's own event sink (mdTabClick / mdSubmenuToggle fire on the destination). */
    var emit: EventSink? = null
    val id get() = props.str("id")
    val label get() = props.str("label")
    val icon get() = props.str("icon")
    val value get() = props.str("value")
    val disabled get() = props.bool("disabled")
    val ariaDisabled get() = props.str("aria-disabled") == "true" || props.str("ariaDisabled") == "true" || props["aria-disabled"] == true
    val ariaLabel get() = listOf(props.str("aria-label"), props.str("ariaLabel")).firstOrNull { it.isNotEmpty() }
    val href get() = props.str("href")
    val isLink get() = !disabled && href.isNotEmpty() && AWCNavigationRequest.from(href, props.str("target").ifEmpty { "_self" }) != null
    /** null: no badge; "": the dot; text: the large badge (a number above 999 reads "999+"). */
    val badge: String? get() {
        val v = props["badgeValue"]
        val raw = when (v) { is Number -> if (v.toDouble() == Math.rint(v.toDouble()) && abs(v.toDouble()) < 1e15) v.toLong().toString() else v.toString(); null -> ""; else -> v.toString() }
        if (raw.isNotEmpty()) { val n = raw.trim().toDoubleOrNull(); return if (n != null && n.isFinite() && n > 999) "999+" else raw }
        return if (props.bool("badge")) "" else null
    }
    val badgeName get() = badge?.let { if (it.isEmpty()) "new notifications" else "$it new notifications" }
    /** Web accessible name (see the SwiftUI renderer). */
    fun name(labelRendered: Boolean): String {
        if (isLink) return label.ifEmpty { ariaLabel ?: "" }
        if (label.isEmpty()) return ariaLabel ?: (badgeName ?: "")
        if (!labelRendered) return ariaLabel ?: label
        return ariaLabel ?: listOfNotNull(badgeName, label).joinToString(" ")
    }
}

/** Rail lengths (every value derives from --md-sys-density-scale by calc) and its hooks. */
internal class RailMetrics(val d: Double, val look: AWCNavigationRailAppearance, val parts: Map<AWCNavigationRailPart, AWCAccordionPartAppearance> = emptyMap()) {
    val containerWidth get() = look.containerWidth ?: max(56.0, 80 + 4 * d)
    val fabSize get() = look.fabSize ?: 56.0
    val expandedWidth get() = look.expandedWidth ?: max(140.0, 220 + 20 * d)
    val expandedMax get() = look.expandedMaxWidth ?: 360.0
    val paddingBlock get() = look.paddingBlock ?: max(24.0, 44 + 4 * d)
    fun paddingInline(expanded: Boolean) = if (expanded) 12.0 else look.paddingInline ?: 0.0
    val gap get() = look.gap ?: 12.0
    val headerSpace get() = look.headerSpace ?: max(20.0, 40 + 4 * d)
    val destinationsGap get() = look.destinationsGap ?: max(0.0, 8 + 2 * d)
    val logoIconSize get() = look.logoIconSize ?: 24.0
    val footerLeading get() = look.footerLeadingSize ?: 32.0
    val footerGap get() = look.footerGap ?: 12.0
    /** The destinations' spacing (part `destinations` gap wins over the hook). */
    val tabGap get() = parts[AWCNavigationRailPart.Destinations]?.gap ?: destinationsGap
    /** The footer's item spacing (its own `gap: var(--_destinations-gap)`; part `footer` gap wins). */
    val footerItemGap get() = parts[AWCNavigationRailPart.Footer]?.gap ?: destinationsGap
    /** The profile's leading → text gap (part `footer-profile` gap wins over the hook). */
    val profileGap get() = parts[AWCNavigationRailPart.FooterProfile]?.gap ?: footerGap
    val horizontalHeight get() = look.horizontalHeight ?: max(64.0, 72 + 4 * d)
    val horizontalPaddingBlock get() = look.horizontalPaddingBlock ?: 0.0
    val horizontalPaddingInline get() = look.horizontalPaddingInline ?: 12.0
    val overflowHeight get() = max(40.0, 56 + 2 * d)
    val overflowIcon get() = max(18.0, 24 + d)
    fun width(expanded: Boolean) = if (expanded) expandedWidth else containerWidth
}
/** Destination lengths (the destination's own density rung wins over the rail's) and the destination hooks. */
internal class RailTabMetrics(val d: Double, val look: AWCNavigationRailTabAppearance, val parts: Map<AWCNavigationRailTabPart, AWCAccordionPartAppearance> = emptyMap()) {
    val indicatorWidth get() = look.indicatorWidth ?: max(40.0, 56 + 4 * d)
    val indicatorHeight get() = look.indicatorHeight ?: max(24.0, 32 + 2 * d)
    val iconSize get() = look.iconSize ?: max(18.0, 24 + d)
    val minHeight get() = max(48.0, (look.minHeight ?: 56.0) + 4 * d)
    val expandedMinHeight get() = max(48.0, 56 + 4 * d)
    val padBlock get() = max(0.0, 2 + 0.5 * d)
    val gap get() = max(2.0, 4 + d)
    val indicatorTop get() = max(2.0, 2 - 0.5 * d)
    val labelSize get() = parts[AWCNavigationRailTabPart.Label]?.fontSize ?: max(10.0, 12 + 0.5 * d)
    val lineHeight get() = parts[AWCNavigationRailTabPart.Label]?.lineHeight ?: max(14.0, 16 + 0.5 * d)
    val shape get() = look.indicatorShape ?: 9999.0
    val caretSize get() = max(14.0, 18 + d)
    val caretWidth get() = caretSize * 1.006
    fun radius(r: RailRect) = min(shape, min(r.w, r.h) / 2)
    /** The pill (part `indicator` width / height win over the hooks; the icon wrapper keeps the hooked size). */
    val pillWidth get() = parts[AWCNavigationRailTabPart.Indicator]?.width ?: indicatorWidth
    val pillHeight get() = parts[AWCNavigationRailTabPart.Indicator]?.height ?: indicatorHeight
    /** Label-large in an expanded rail; part typography wins in every layout. */
    val expandedLabelSize get() = parts[AWCNavigationRailTabPart.Label]?.fontSize ?: 14.0
    val expandedLineHeight get() = parts[AWCNavigationRailTabPart.Label]?.lineHeight ?: 20.0
    fun labelTracking(expanded: Boolean) = parts[AWCNavigationRailTabPart.Label]?.letterSpacing ?: if (expanded) 0.1 else 0.5
    fun labelWeight(active: Boolean) = parts[AWCNavigationRailTabPart.Label]?.fontWeight ?: if (active) 700.0 else 500.0
    /** The built-in glyph's font size (part `icon` font-size; its box keeps the icon size). */
    val glyphSize get() = parts[AWCNavigationRailTabPart.Icon]?.fontSize ?: iconSize
    /** The indicator's corners: the part's corner shape, else the hooked radius. */
    fun indicatorCorners(r: RailRect): AWCCornerShape = parts[AWCNavigationRailTabPart.Indicator]?.cornerShape
        ?: radius(r).let { v -> AWCCornerRadius(AWCCornerLength(v), AWCCornerLength(v)).let { c -> AWCCornerShape(c, c, c, c) } }
    /** The reported indicator radius (the top-left corner, clamped to the box like CSS). */
    fun indicatorRadius(r: RailRect): Double = parts[AWCNavigationRailTabPart.Indicator]?.cornerShape?.let { c ->
        min(c.topLeft.x.points + c.topLeft.x.fraction * r.w, min(r.w, r.h) / 2) } ?: radius(r)
}

internal data class RailTabGeometry(var frame: RailRect = RailRect(), var indicator: RailRect = RailRect(), var iconWrapper: RailRect = RailRect(), var icon: RailRect = RailRect(),
                                    var label: RailRect? = null, var labelOpacity: Double = 1.0, var labelTextWidth: Double = 0.0, var caret: RailRect? = null, var overflowed: Boolean = false)
internal class RailGeometry {
    var width = 0.0; var height = 0.0
    var container = RailRect(); var surface = RailRect()
    var logo: RailRect? = null; var toggle: RailRect? = null; var header: RailRect? = null; var fab: RailRect? = null; var fabItem: RailRect? = null
    var destinations = RailRect(); var overflow: RailRect? = null; var footer: RailRect? = null; var profile: RailRect? = null; var leading: RailRect? = null; var content: RailRect? = null
    var footerItems: List<RailRect> = emptyList()
    var tabs: MutableList<RailTabGeometry> = mutableListOf()
    var naturalHeight = 0.0
}
internal class RailTabInput(val label: String, val hasMenu: Boolean, val m: RailTabMetrics)
internal class RailLayoutInput(val tabs: List<RailTabInput>, val m: RailMetrics, val activeIndex: Int, val visibility: String, val alignment: String,
                               val expanded: Boolean, val horizontal: Boolean, val modal: Boolean, val overflowed: Set<Int>, val overflowLabel: String, val height: Double) {
    var hasLogo = false; var logoW = 24.0; var logoH = 24.0; var hasToggle = false; var hasHeader = false; var headerW = 0.0; var headerH = 0.0
    var hasFab = false; var fabLabelled = false; var fabW = 56.0; var fabH = 56.0; var hasFooterProfile = false; var hasFooterLeading = false; var leadingHeight = 32.0
    var contentWidth = 0.0; var contentHeight = 19.0; var footerItems: List<Pair<Double, Double>> = emptyList()
    var reveal: List<Double> = emptyList(); var submenuSelected: Set<Int> = emptySet(); var proposedWidth = 0.0
    /** A destination alone (md-navigation-rail-tab outside a rail). */
    var standalone = false
    /** Hidden destinations (display: none): no box, their indices kept. */
    var hiddenTabs: Set<Int> = emptySet()
    /** The modal surface as rendered (its inset / size transition); null: the layout's own (final) surface. */
    var surface: RailRect? = null
}

internal object RailLayout {
    /** A collapsed (stacked) or horizontal destination: pill over the label, centred in a min-height column. */
    fun stacked(t: RailTabInput, active: Boolean, visibility: String, width: Double, height: Double?, reveal: Double, text: (String, Double, Int, Double) -> Double): RailTabGeometry {
        val m = t.m; val g = RailTabGeometry()
        val hasLabel = t.label.isNotEmpty() && visibility != "none"; val selectedMode = visibility == "selected"
        val p = if (selectedMode) reveal else 1.0
        val labelH = if (hasLabel) min(m.lineHeight, 20 * p) else 0.0; val margin = if (hasLabel) -4 * (1 - p) else 0.0
        val content = m.indicatorHeight + if (hasLabel) m.gap + margin + labelH else 0.0
        val h = height ?: max(m.minHeight, content + 2 * m.padBlock)
        val top = m.padBlock + (h - 2 * m.padBlock - content) / 2
        g.frame = RailRect(0.0, 0.0, width, h)
        g.iconWrapper = RailRect((width - m.indicatorWidth) / 2, top, m.indicatorWidth, m.indicatorHeight)
        val centred = visibility == "none" || (selectedMode && !active)
        g.indicator = RailRect((width - m.pillWidth) / 2, if (centred) (h - m.pillHeight) / 2 else m.indicatorTop, m.pillWidth, m.pillHeight)
        g.icon = RailRect((width - m.iconSize) / 2, top + (m.indicatorHeight - m.iconSize) / 2, m.iconSize, m.iconSize)
        if (hasLabel) {
            val tw = text(t.label, m.labelSize, m.labelWeight(active).roundToInt(), m.labelTracking(false))
            val caret = if (t.hasMenu) m.caretWidth + 2 else 0.0
            val lw = min(width, tw + caret + 8)
            g.labelTextWidth = tw
            val l = RailRect((width - lw) / 2, top + m.indicatorHeight + m.gap + margin, lw, labelH)
            g.label = l; g.labelOpacity = p
            if (t.hasMenu) g.caret = RailRect(l.x + 4 + tw + 2, l.midY - 11, m.caretWidth, 22.0)
        }
        return g
    }
    /** An expanded destination: a pill that hugs icon and label (16 + icon + 8 + label + 16), the icon on the collapsed axis. */
    fun expanded(t: RailTabInput, active: Boolean, visibility: String, axis: Double, text: (String, Double, Int, Double) -> Double): RailTabGeometry {
        val m = t.m; val g = RailTabGeometry()
        val showLabel = t.label.isNotEmpty() && (visibility == "all" || (visibility == "selected" && active))
        val start = axis - m.iconSize / 2
        val tw = if (showLabel) text(t.label, m.expandedLabelSize, m.labelWeight(active).roundToInt(), m.labelTracking(true)) else 0.0
        val caret = if (showLabel && t.hasMenu) m.caretWidth + 2 else 0.0
        val lw = if (showLabel) tw + caret + 8 else 0.0
        // fit-content: the label does not wrap, so the pill keeps its natural width (clipped by the destinations' overflow-x).
        val w = start + m.iconSize + (if (showLabel) 8 + lw else 0.0) + 16
        val lineH = m.expandedLineHeight + if (showLabel && t.hasMenu) 0.297 else 0.0
        val h = max(m.expandedMinHeight, max(m.iconSize, if (showLabel) lineH else 0.0))
        // inset: 0 with auto sizes; a part width centres (margin-inline: auto), a part height sits at the top.
        val pw = m.parts[AWCNavigationRailTabPart.Indicator]?.width; val ph = m.parts[AWCNavigationRailTabPart.Indicator]?.height
        g.frame = RailRect(0.0, 0.0, w, h); g.indicator = RailRect(pw?.let { (w - it) / 2 } ?: 0.0, 0.0, pw ?: w, ph ?: h)
        g.iconWrapper = RailRect(start, (h - m.iconSize) / 2, m.iconSize, m.iconSize); g.icon = g.iconWrapper
        if (showLabel) {
            val lx = start + m.iconSize + 8
            g.labelTextWidth = tw
            g.label = RailRect(lx, (h - lineH) / 2, max(0.0, min(lw, w - 16 - lx)), lineH)
            if (t.hasMenu) g.caret = RailRect(lx + 4 + tw + 2, (h - lineH) / 2 + (lineH - 22) / 2 + 0.297, m.caretWidth, 22.0)
        }
        return g
    }
    fun compute(i: RailLayoutInput, text: (String, Double, Int, Double) -> Double) = if (i.horizontal) horizontal(i, text) else vertical(i, text)

    private enum class Item { LOGO, TOGGLE, HEADER, FAB, DESTINATIONS, OVERFLOW, FOOTER }
    fun vertical(i: RailLayoutInput, text: (String, Double, Int, Double) -> Double): RailGeometry {
        val out = RailGeometry(); val m = i.m; val padI = m.paddingInline(i.expanded); val cw = m.containerWidth
        val hostW = if (i.modal) cw else m.width(i.expanded)
        out.width = hostW; out.height = i.height
        val finalSurface = if (!i.modal) RailRect(0.0, 0.0, hostW, i.height)
            else if (i.expanded) RailRect(16.0, 16.0, min(m.expandedWidth, m.expandedMax), max(0.0, i.height - 32)) else RailRect(0.0, 0.0, cw, i.height)
        val surface = i.surface ?: finalSurface
        out.surface = surface
        val pb = m.paddingBlock
        val c = RailRect(surface.x + padI, surface.y + pb, max(0.0, surface.w - 2 * padI), max(0.0, surface.h - 2 * pb))
        out.container = c
        val items = mutableListOf<Pair<Item, Double>>()
        if (i.hasLogo) items += Item.LOGO to 48.0
        if (i.hasToggle) items += Item.TOGGLE to 48.0
        if (i.hasHeader) items += Item.HEADER to max(56.0, i.headerH) + 4
        if (i.hasFab) items += Item.FAB to i.fabH + 8
        items += Item.DESTINATIONS to 0.0
        if (i.overflowed.isNotEmpty()) items += Item.OVERFLOW to m.overflowHeight
        // The profile row: min-block-size footer-leading-size; the leading box is footer-leading-size wide, its child's height high.
        val profileH = if (i.hasFooterProfile) max(m.footerLeading, max(i.contentHeight, if (i.hasFooterLeading) i.leadingHeight else 0.0)) else 0.0
        val footerItemsH = i.footerItems.sumOf { it.second } + max(0, i.footerItems.size - 1 + (if (i.hasFooterProfile) 1 else 0)) * m.footerItemGap
        val hasFooter = i.hasFooterProfile || i.footerItems.isNotEmpty()
        if (hasFooter) items += Item.FOOTER to 8 + profileH + footerItemsH
        val fixed = items.sumOf { it.second }
        val destH = max(0.0, c.h - fixed - m.gap * (items.size - 1))
        var y = c.y; val footerPad = if (i.expanded) 8.0 else 0.0
        for ((kind, hh) in items) {
            val h = if (kind == Item.DESTINATIONS) destH else hh
            val r = RailRect(c.x, y, c.w, h)
            when (kind) {
                Item.LOGO -> out.logo = r
                Item.TOGGLE -> out.toggle = r
                Item.HEADER -> out.header = r
                Item.FAB -> { out.fab = r
                    // A labelled FAB keeps its icon on the collapsed axis; an icon-only FAB centres on the axis with its own width.
                    val x = surface.x + if (i.fabLabelled) (cw - m.fabSize) / 2 else cw / 2 - i.fabW / 2
                    out.fabItem = RailRect(x, y, i.fabW, i.fabH) }
                Item.DESTINATIONS -> out.destinations = r
                Item.OVERFLOW -> out.overflow = r
                Item.FOOTER -> { out.footer = r
                    var fy = y + 8
                    if (i.hasFooterProfile) {
                        val px = surface.x + (cw - m.footerLeading) / 2
                        out.profile = RailRect(px, fy, max(0.0, c.maxX - px), profileH)
                        out.leading = RailRect(px, fy + (profileH - i.leadingHeight) / 2, m.footerLeading, i.leadingHeight)
                        val cx = px + m.footerLeading + m.profileGap
                        out.content = RailRect(cx, fy + (profileH - i.contentHeight) / 2, max(0.0, c.maxX - cx), i.contentHeight)
                        fy += profileH + m.footerItemGap
                    }
                    out.footerItems = i.footerItems.map { (w, h2) -> RailRect(c.x + footerPad, fy, w, h2).also { fy += h2 + m.footerItemGap } } }
            }
            y += h + m.gap
        }
        val d = out.destinations
        val padTop = if (i.hasHeader || i.hasFab) m.headerSpace - m.gap else 5.0
        val tabs = i.tabs.mapIndexed { k, t ->
            val active = k == i.activeIndex
            (if (i.expanded) expanded(t, active, i.visibility, cw / 2 - padI, text)
             else stacked(t, active, i.visibility, cw - 2 * padI, null, i.reveal.getOrElse(k) { if (active) 1.0 else 0.0 }, text)).also { it.overflowed = k in i.overflowed || k in i.hiddenTabs }
        }
        val shown = tabs.indices.filter { !tabs[it].overflowed }
        val content = shown.sumOf { tabs[it].frame.h } + m.tabGap * max(0, shown.size - 1)
        val box = d.h - padTop - 5
        out.naturalHeight = 2 * pb + fixed + m.gap * (items.size - 1) + padTop + 5 + content
        var ty = d.y + padTop + when (i.alignment) { "middle" -> (box - content) / 2; "bottom" -> box - content; else -> 0.0 }
        for (k in shown) { tabs[k].frame = tabs[k].frame.copy(x = d.x, y = ty); ty += tabs[k].frame.h + m.tabGap }
        out.tabs = tabs.toMutableList()
        if (i.standalone && i.tabs.isNotEmpty()) {
            // A destination alone is Web's lone md-navigation-rail-tab: inline-size 100% of its box (the pill and label centred),
            // its own block size (min-block-size 56), at the box's origin; no rail around it.
            val w = max(cw, i.proposedWidth)
            val g = stacked(i.tabs[0], i.activeIndex == 0, i.visibility, w, null, i.reveal.getOrElse(0) { if (i.activeIndex == 0) 1.0 else 0.0 }, text)
            g.frame = g.frame.copy(x = 0.0, y = 0.0)
            out.tabs = mutableListOf(g)
            val box = RailRect(0.0, 0.0, w, g.frame.h)
            out.width = w; out.height = g.frame.h; out.surface = box; out.container = box; out.destinations = box; out.naturalHeight = g.frame.h
        }
        return out
    }
    fun horizontal(i: RailLayoutInput, text: (String, Double, Int, Double) -> Double): RailGeometry {
        val out = RailGeometry(); val m = i.m; val cw = m.containerWidth
        val W = i.proposedWidth; val pb = m.horizontalPaddingBlock; val pi = m.horizontalPaddingInline
        val tabs = i.tabs.mapIndexed { k, t ->
            val active = k == i.activeIndex
            val hasLabel = t.label.isNotEmpty() && i.visibility != "none"
            val tw = if (hasLabel) text(t.label, t.m.labelSize, t.m.labelWeight(active).roundToInt(), t.m.labelTracking(false)) + (if (t.hasMenu) t.m.caretWidth + 2 else 0.0) + 8 else 0.0
            stacked(t, active, i.visibility, max(cw, max(t.m.indicatorWidth, tw)), null, i.reveal.getOrElse(k) { if (active) 1.0 else 0.0 }, text).also { it.overflowed = k in i.overflowed || k in i.hiddenTabs }
        }.toMutableList()
        val shown = tabs.indices.filter { !tabs[it].overflowed }
        val naturalTab = shown.maxOfOrNull { tabs[it].frame.h } ?: 0.0
        val fabWrapW = if (i.hasFab) max(0.0, (cw - m.fabSize) / 2) + i.fabW else 0.0
        val fabWrapH = if (i.hasFab) i.fabH + 8 else 0.0
        val logoW = if (i.hasLogo) 16 + i.logoW else 0.0
        val profileW = if (i.hasFooterProfile) m.footerLeading + m.profileGap + i.contentWidth else 0.0
        val footerW = if (i.hasFooterProfile || i.footerItems.isNotEmpty()) 8 + profileW + i.footerItems.sumOf { it.first } + m.footerItemGap * max(0, i.footerItems.size - (if (i.hasFooterProfile) 0 else 1)) else 0.0
        val overflowW = if (i.overflowed.isNotEmpty()) max(cw, text(i.overflowLabel, 12.0, 500, 0.5) + 16) else 0.0
        val rowNatural = listOf(naturalTab, fabWrapH, if (i.hasFooterProfile) max(m.footerLeading, max(i.contentHeight, if (i.hasFooterLeading) i.leadingHeight else 0.0)) else 0.0,
            if (i.overflowed.isNotEmpty()) m.overflowHeight else 0.0, if (i.hasLogo) i.logoH else 0.0, if (i.hasHeader) i.headerH else 0.0).max()
        val rowH = max(m.horizontalHeight - 2 * pb, rowNatural)
        out.width = W; out.height = rowH + 2 * pb
        val c = RailRect(pi, pb, max(0.0, W - 2 * pi), rowH)
        out.container = c; out.surface = RailRect(0.0, 0.0, W, out.height)
        val items = mutableListOf<Pair<Item, Double>>()
        if (i.hasLogo) items += Item.LOGO to logoW
        if (i.hasHeader) items += Item.HEADER to i.headerW
        if (i.hasFab) items += Item.FAB to fabWrapW
        items += Item.DESTINATIONS to 0.0
        if (i.overflowed.isNotEmpty()) items += Item.OVERFLOW to overflowW
        if (footerW > 0) items += Item.FOOTER to footerW
        var headerW = i.headerW
        val destW: Double
        if (i.hasHeader) {
            // Header basis 100% and the destinations' content basis shrink in proportion to their inner (content-box) bases
            // (flex-shrink 1); the header keeps its min-content width, the destinations may shrink to 0.
            val others = items.filter { it.first != Item.HEADER && it.first != Item.DESTINATIONS }.sumOf { it.second } + m.gap * (items.size - 1)
            val headerBase = c.w; val destInner = shown.sumOf { tabs[it].frame.w } + m.tabGap * max(0, shown.size - 1); val destBase = destInner + (m.headerSpace - m.gap) + 5
            val space = c.w - others - headerBase - destBase
            if (space < 0) { headerW = max(i.headerW, headerBase + space * headerBase / (headerBase + destInner)); destW = max(0.0, c.w - others - headerW) }
            else { headerW = headerBase; destW = destBase + space }
        } else destW = max(0.0, c.w - items.sumOf { it.second } - m.gap * (items.size - 1))
        var x = c.x
        for ((kind, ww) in items) {
            val w = if (kind == Item.DESTINATIONS) destW else if (kind == Item.HEADER) headerW else ww
            val r = RailRect(x, c.y, w, c.h)
            when (kind) {
                Item.LOGO -> out.logo = r
                Item.HEADER -> out.header = r
                Item.FAB -> { out.fab = r; out.fabItem = RailRect(x + max(0.0, (cw - m.fabSize) / 2), c.y + (c.h - 8 - i.fabH) / 2, i.fabW, i.fabH) }
                Item.DESTINATIONS -> out.destinations = r
                Item.OVERFLOW -> out.overflow = r
                Item.FOOTER -> { out.footer = r
                    var fx = x + 8
                    if (i.hasFooterProfile) {
                        val ph = max(m.footerLeading, max(i.contentHeight, if (i.hasFooterLeading) i.leadingHeight else 0.0))
                        out.profile = RailRect(fx, c.midY - ph / 2, profileW, ph)
                        out.leading = RailRect(fx, c.midY - i.leadingHeight / 2, m.footerLeading, i.leadingHeight)
                        out.content = RailRect(fx + m.footerLeading + m.profileGap, c.midY - i.contentHeight / 2, i.contentWidth, i.contentHeight)
                        fx += profileW + m.footerItemGap
                    }
                    out.footerItems = i.footerItems.map { (w2, h2) -> RailRect(fx, c.midY - h2 / 2, w2, h2).also { fx += w2 + m.footerItemGap } } }
                Item.TOGGLE -> {}
            }
            x += w + m.gap
        }
        val d = out.destinations
        val padStart = if (i.hasHeader || i.hasFab) m.headerSpace - m.gap else 5.0
        val total = shown.sumOf { tabs[it].frame.w } + m.tabGap * max(0, shown.size - 1)
        var tx = d.x + padStart + (d.w - padStart - 5 - total) / 2
        for (k in shown) {
            val t = i.tabs[k]; val active = k == i.activeIndex
            val g = stacked(t, active, i.visibility, tabs[k].frame.w, d.h, i.reveal.getOrElse(k) { if (active) 1.0 else 0.0 }, text)
            g.frame = g.frame.copy(x = tx, y = d.y); tabs[k] = g; tx += g.frame.w + m.tabGap
        }
        out.tabs = tabs; out.naturalHeight = out.height
        return out
    }
}

// MARK: motion and state

internal class RailFlip(val start: Double = Double.NEGATIVE_INFINITY, val duration: Double = 0.0, val curve: List<Double> = RAIL_STANDARD) {
    var indicator: DoubleArray? = null          // dx, dy, sx, sy (first relative to last)
    var icon: Pair<Double, Double>? = null
    var label: DoubleArray? = null              // dx, dy, from opacity, to opacity
    var outgoing: RailOutgoing? = null
    /** The inline size at the flip (RTL: the outgoing box keeps its distance from the inline-start edge as the width animates). */
    var space = 0.0
    fun progress(t: Double) = if (duration <= 0 || t >= start + duration) 1.0 else if (t <= start) 0.0 else accordionCubicBezier((t - start) / duration, curve)
    fun running(t: Double) = duration > 0 && t < start + duration
}
/** The outgoing label (a label that stops rendering) stays at its previous box and fades out. */
internal class RailOutgoing(val rect: RailRect, val opacity: Double, val size: Double, val weight: Double, val tracking: Double)
internal class RailRendered(val indicator: RailRect, val iconCentre: Pair<Double, Double>, val label: RailRect?, val labelOpacity: Double, val labelVisible: Boolean,
                            val labelSize: Double, val labelWeight: Double, val labelTracking: Double,
                            /** The inline size the rects were mirrored across (RTL: rail-local x follows the moving inline-start edge). */
                            val space: Double = 0.0)
internal class RailTabMotion {
    val color = AWCCSSValueTrack(Color.Black, accordionColorLerp); val iconColor = AWCCSSValueTrack(Color.Black, accordionColorLerp)
    val labelColor = AWCCSSValueTrack(Color.Black, accordionColorLerp); val indicator = AWCCSSValueTrack(Color.Transparent, accordionColorLerp)
    val layer = AWCCSSValueTrack(0.0, accordionLerp); val fill = AWCCSSValueTrack(0.0, accordionLerp)
    val weight = AWCCSSValueTrack(500.0, accordionLerp); val reveal = AWCCSSValueTrack(1.0, accordionLerp)
    var flip = RailFlip()
    var initialized = false
    /** The label was rendered (not display: none) at the last retarget. */
    var labelDisplayed = true
    fun running(t: Double) = listOf(color, iconColor, labelColor, indicator).any { it.isRunning(t) } || listOf(layer, fill, weight, reveal).any { it.isRunning(t) } || flip.running(t)
}
internal data class RailTabState(val active: Boolean, val disabled: Boolean, val ariaDisabled: Boolean, val overflowed: Boolean, val hover: Boolean, val pressed: Boolean,
                                 val focused: Boolean, val focusVisible: Boolean, val tabStop: Boolean, val childSelected: Boolean, val isLink: Boolean)
private val railListLerp: (List<Double>, List<Double>, Double) -> List<Double> = { a, b, t -> a.zip(b) { x, y -> x + (y - x) * t } }

internal class RailState {
    /** The latest composition's retarget (a plain field: a local function's references compare equal across compositions, so a
     *  remembered-updated state would keep the first composition's closure and its stale variant, palette and states). */
    var retargetFn: ((Double) -> Unit)? = null
    var order by mutableStateOf<List<RailChild>>(emptyList())
    var active by mutableIntStateOf(-1)
    var lastActiveProperty: Any? = null
    var initialized = false
    var variant by mutableStateOf("standard")
    var lastVariantProperty: Any? = null
    var lastHostProps: Props? = null
    var variantInitialized = false
    var roving by mutableStateOf<Int?>(null)
    var submenuSelection = mutableStateMapOf<String, Int>()
    var frame by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    val width = AWCCSSValueTrack(80.0, accordionLerp)
    val surface = AWCCSSValueTrack(listOf(0.0, 0.0, 80.0, 0.0), railListLerp)   // modal surface inset, inset, width, height delta
    val surfacePaint = AWCCSSValueTrack(0.0, accordionLerp)
    val scrim = AWCCSSValueTrack(0.0, accordionLerp)
    val logo = AWCCSSValueTrack(0.0, accordionLerp)
    val footerContent = AWCCSSValueTrack(0.0, accordionLerp)
    var tracksInitialized = false
    var pendingFlip = false
    /** The frame time at the variant change: the FLIP starts with the track a later frame starts (see the measure). */
    var pendingFlipFrame = 0.0
    val rendered = HashMap<RailChild, RailRendered>()
    /** The destinations as the last measure pass placed them: snapshot state with structural equality, so a destination's
     *  drawing and placement follow every change of its frame (and nothing is invalidated while the frames hold still). */
    var placed: Map<RailChild, RailTabFrame> by mutableStateOf(emptyMap())
    /** The same frames for the measure pass itself (not observed: the pass that writes them must not re-run for it). */
    var placedLast: Map<RailChild, RailTabFrame> = emptyMap()
    var frameInfo by mutableStateOf<RailFrameInfo?>(null)
    val sizes = mutableStateMapOf<String, Pair<Double, Double>>()
    var overflowOpen by mutableStateOf(false)
    var proposedWidth = 0.0
    var placedOrigin = 0.0 to 0.0
    var rootOrigin = 0.0 to 0.0
    /** The root's width at that position (the probe: an RTL rail's start edge follows its animated width). */
    var rootWidth = -1.0
    var contentClip by mutableDoubleStateOf(0.0)
    var fabLabelled by mutableStateOf(false)
    var boxes by mutableStateOf<List<RailPartBox>>(emptyList())
    val header = RailHeaderSlot()
    fun running(now: Double) = pendingFlip || listOf(width, surfacePaint, scrim, logo, footerContent).any { it.isRunning(now) } || surface.isRunning(now) || order.any { it.motion.running(now) }
}
/** A destination as placed this frame (physical, rail-local dp) with its animated paint. */
internal data class RailTabFrame(val tab: RailRect, val indicator: RailRect, val iconWrapper: RailRect, val icon: RailRect, val label: RailRect?, val caret: RailRect?,
                            val labelOpacity: Double, val labelSize: Double, val labelLine: Double, val labelTracking: Double, val badge: RailRect?,
                            val outgoing: Pair<RailOutgoing, Double>?, val hidden: Boolean, val state: RailTabState, val labelTextWidth: Double)
internal class RailFrameInfo(val host: RailRect, val surface: RailRect, val surfacePaint: Double, val scrim: Double, val logoExpanded: Double, val footerContent: Double,
                             val geometry: RailGeometry, val time: Double)

internal class RailPalette(private val tokens: Map<String, String>, private val rail: AWCNavigationRailAppearance) {
    private val tab = rail.tab
    private fun token(k: String, d: Long) = awcRippleHex(tokens["--md-sys-color-$k"]) ?: Color(d)
    private fun hex(v: String?) = v?.let { awcRippleHex(it) }
    fun container(modalExpanded: Boolean) = hex(rail.containerColor) ?: if (modalExpanded) token("surface-container", 0xFFF3EDF7) else token("surface", 0xFFFFFBFE)
    val content get() = hex(rail.contentColor) ?: token("on-surface-variant", 0xFF49454F)
    val scrim get() = token("scrim", 0xFF000000)
    val indicator get() = hex(tab.indicatorColor) ?: token("secondary-container", 0xFFE8DEF8)
    val activeIcon get() = hex(tab.activeIconColor) ?: token("on-secondary-container", 0xFF4A4458)
    val inactiveIcon get() = hex(tab.iconColor) ?: token("on-surface-variant", 0xFF49454F)
    val activeLabel get() = hex(tab.activeLabelColor) ?: token("secondary", 0xFF625B71)
    val inactiveLabel get() = hex(tab.labelColor) ?: token("on-surface-variant", 0xFF49454F)
    val stateLayer get() = hex(tab.stateLayerColor) ?: token("on-secondary-container", 0xFF4A4458)
    val disabled get() = token("on-surface", 0xFF1C1B1F).copy(alpha = 0.38f)
    val badge get() = hex(tab.badgeColor) ?: token("error", 0xFFB3261E)
    val onBadge get() = hex(tab.badgeContentColor) ?: token("on-error", 0xFFFFFFFF)
    val focusRing get() = hex(tab.focusRingColor) ?: token("secondary", 0xFF625B71)
    val overflowRing get() = token("secondary", 0xFF625B71)
    val elevation3 get() = NativeShadowLayer.parse(tokens["--md-sys-elevation-3"] ?: "0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px rgba(0,0,0,0.3)")
}

/** The rail as its destinations see it. */
internal class RailContext(val state: RailState, val palette: RailPalette, val look: AWCNavigationRailAppearance, val railDensity: Double, val visibility: String,
                           val expanded: Boolean, val horizontal: Boolean, val modal: Boolean, val rtl: Boolean, val reduced: Boolean, val standalone: Boolean,
                           val manageFocus: Boolean, val overflowed: Set<Int>, val text: TabsText, val probe: AWCNavigationRailProbe?,
                           val click: (RailChild) -> Unit, val keyActivate: (RailChild) -> Unit, val key: (RailChild, String) -> Boolean, val emitRail: EventSink,
                           val railParts: Map<AWCNavigationRailPart, AWCAccordionPartAppearance> = emptyMap(),
                           val tabPartsAll: Map<AWCNavigationRailTabPart, AWCAccordionPartAppearance> = emptyMap(),
                           val tabPartTargets: Map<String, Map<AWCNavigationRailTabPart, AWCAccordionPartAppearance>> = emptyMap(),
                           val pickSubmenu: (RailChild, Int) -> Unit = { _, _ -> }) {
    /** A destination's part appearances: the subtree's, then the ones declared for its id. */
    fun tabParts(c: RailChild): Map<AWCNavigationRailTabPart, AWCAccordionPartAppearance> {
        val own = tabPartTargets[c.id] ?: return tabPartsAll
        return tabPartsAll + own.mapValues { (k, v) -> (tabPartsAll[k] ?: AWCAccordionPartAppearance()).merged(v) }
    }
    fun tabMetrics(c: RailChild) = RailTabMetrics(resolveAWCDensity(c.props["density"], railDensity), look.tab, tabParts(c))
    /** The product of the parts' own opacities along a part's ancestry (opacity covers what a part contains). */
    fun chain(vararg parts: AWCNavigationRailPart) = parts.fold(1.0) { a, p -> a * (railParts[p]?.opacity ?: 1.0) }
    fun stateLayerColor(c: RailChild) = railPartColor(tabParts(c)[AWCNavigationRailTabPart.StateLayer]?.backgroundColor) ?: palette.stateLayer
    fun skipped(c: RailChild, i: Int) = c.disabled || c.ariaDisabled || i in overflowed || c.props.bool("hidden")
    fun tabStop(): Int? {
        if (!manageFocus) return null
        val o = state.order
        state.roving?.let { r -> return if (r in o.indices && !skipped(o[r], r)) r else null }
        if (state.active >= 0) return if (state.active in o.indices && !skipped(o[state.active], state.active)) state.active else null
        return o.indices.firstOrNull { !skipped(o[it], it) }
    }
    fun tabState(c: RailChild, i: Int, stop: Int?): RailTabState {
        val hover = !c.disabled && c.hover
        val pressed = !c.disabled && c.pressed
        val tabStop = if (standalone) !c.disabled else if (manageFocus) stop == i else !c.disabled && i == state.active
        return RailTabState(i == state.active && !standalone || (standalone && c.props.bool("active")), c.disabled, c.ariaDisabled, i in overflowed || c.props.bool("hidden"), hover, pressed, c.focused,
            c.focused && !c.pointerFocus && !c.disabled, tabStop, state.submenuSelection[c.id] != null && i != state.active, c.isLink)
    }
    /** CSS targets of a destination's transitions (effects-fast 150 ms; none under reduced motion). */
    fun targets(c: RailChild, st: RailTabState, now: Double) {
        // The live variant: the frame clock retargets before the frame's recomposition, so a toggle / method / Escape / scrim
        // write is seen here first (this context's `expanded` is the previous composition's).
        val expanded = !horizontal && state.variant == "expanded"
        val m = c.motion; val p = palette; val tm = tabMetrics(c); val tp = tm.parts
        val host = if (st.disabled) p.disabled else if (st.active) p.activeIcon else p.inactiveIcon
        // Part colours win over every state rule: the icon inherits the icon wrapper's (or a link's anchor's) colour.
        val iconPart = railPartColor((if (!c.slotIcon) tp[AWCNavigationRailTabPart.Icon]?.color else null) ?: tp[AWCNavigationRailTabPart.IconWrapper]?.color
            ?: if (st.isLink) tp[AWCNavigationRailTabPart.Anchor]?.color else null)
        val icon = iconPart ?: if (st.childSelected && !st.disabled) p.activeIcon else host
        val label = railPartColor(tp[AWCNavigationRailTabPart.Label]?.color) ?: if (st.childSelected) p.activeIcon else if (st.active) p.activeLabel else p.inactiveLabel
        val ind = railPartColor((if (horizontal) tp[AWCNavigationRailTabPart.IconWrapper] else tp[AWCNavigationRailTabPart.Indicator])?.backgroundColor)
            ?: if (st.active || st.childSelected) p.indicator else p.indicator.copy(alpha = 0f)
        val layer = tp[AWCNavigationRailTabPart.StateLayer]?.opacity ?: if (st.disabled) 0.0 else if (st.pressed) (look.tab.pressStateLayerOpacity ?: 0.1) else if (st.focusVisible && !horizontal) (look.tab.focusStateLayerOpacity ?: 0.1) else if (st.hover) 0.08 else 0.0
        val reveal = if (visibility == "selected" && !expanded) (if (st.active) 1.0 else 0.0) else 1.0
        val displayed = !(visibility == "selected" && expanded && !st.active)
        if (!m.initialized) {
            m.color.snap(host); m.iconColor.snap(icon); m.labelColor.snap(label); m.indicator.snap(ind); m.layer.snap(layer)
            m.fill.snap(if (st.active) 1.0 else 0.0); m.weight.snap(tm.labelWeight(st.active)); m.reveal.snap(reveal); m.initialized = true; m.labelDisplayed = displayed; return
        }
        val d = if (reduced) 0.0 else 150.0
        m.color.set(host, now, d, RAIL_EFFECTS_FAST); m.iconColor.set(icon, now, d, RAIL_EFFECTS_FAST); m.labelColor.set(label, now, d, RAIL_EFFECTS_FAST)
        m.indicator.set(ind, now, d, RAIL_EFFECTS_FAST); m.layer.set(layer, now, d, RAIL_EFFECTS_FAST)
        m.fill.set(if (st.active) 1.0 else 0.0, now, d, RAIL_EFFECTS_FAST); m.weight.set(tm.labelWeight(st.active), now, d, RAIL_EFFECTS_FAST)
        // A label that was display: none (an inactive destination of an expanded labels-selected rail) has no before-change style.
        if (m.labelDisplayed) m.reveal.set(reveal, now, d, RAIL_EFFECTS_FAST) else m.reveal.snap(reveal)
        m.labelDisplayed = displayed
    }
}
internal val LocalRailRow = staticCompositionLocalOf<RailContext?> { null }
/** A rail's FAB slot: the FAB is extended while the rail is (a labelled FAB), its icon inset follows the rail's fab-size, and it
 *  reports whether it is labelled (the layout keeps a labelled FAB's icon on the collapsed axis). */
internal class RailFabSlot(val extended: Boolean, val size: Double?, val state: RailState)
/** A rail's header slot: the first component composed in it reports whether it is an md-icon-button (which centres on the
 *  rail's axis in a vertical rail; other content centres collapsed and starts after the 8 dp inset expanded). */
internal class RailHeaderSlot { var fresh = false; var iconButton by mutableStateOf(false) }
internal val LocalAWCRailHeader = staticCompositionLocalOf<RailHeaderSlot?> { null }
/** A destination's submenu as its `md-menu-item` children report it (the rail presents the menu itself, as SwiftUI does from
 *  the item nodes): the headline, whether the item is enabled, the authored selection; keyed by authored order. */
internal class RailSubmenuItem(val title: String, val enabled: Boolean, val selected: Boolean)
internal class RailSubmenuProbe { val items = mutableStateMapOf<Int, RailSubmenuItem>(); private var n = 0; fun slot() = n++; var adopted = false }
internal val LocalAWCRailSubmenuProbe = staticCompositionLocalOf<RailSubmenuProbe?> { null }
/** A painted part box (rail-local physical dp) with its ancestry's opacity. */
internal class RailPartBox(val part: AWCNavigationRailPart, val value: AWCAccordionPartAppearance, val rect: RailRect, val opacity: Double)
internal val LocalAWCRailFab = staticCompositionLocalOf<RailFabSlot?> { null }
private fun railAnimatorsOff() = !android.animation.ValueAnimator.areAnimatorsEnabled()
private val RailSymbols = HashMap<Int, FontFamily>()
/** Material Symbols with the FILL axis (0 → 1 on the destination's colour transition), cached per hundredth. */
internal fun railSymbolFamily(fill: Double): FontFamily = RailSymbols.getOrPut((fill.coerceIn(0.0, 1.0) * 100).roundToInt()) {
    FontFamily(Font(R.font.awc_material_symbols, FontWeight(400), variationSettings = FontVariation.Settings(
        FontVariation.Setting("FILL", (fill.coerceIn(0.0, 1.0) * 100).roundToInt() / 100f), FontVariation.weight(400), FontVariation.Setting("opsz", 24f), FontVariation.grade(0))))
}

// MARK: rail

private fun RailRect.phys(rtl: Boolean, space: Double) = if (rtl) copy(x = space - x - w) else this
/** A tab-local (logical) part as a rail-local physical rect. */
private fun RailRect.inTab(tab: RailRect, rtl: Boolean) = RailRect(tab.x + (if (rtl) tab.w - maxX else x), tab.y + y, w, h)

/**
 * md-navigation-rail: the rail (standard 80 / expanded 220, the modal overlay with its scrim, or a horizontal bar) with its
 * logo, toggle, header, FAB, destinations (roving tab stop, arrows, Home / End, Enter / Space, Escape in a modal), overflow
 * trigger and footer; expand / collapse on the width clock with the destinations' FLIP; mdTabChange / mdExpand / mdCollapse.
 * Children are md-navigation-rail-tab nodes (default slot) and the named section slots.
 */
@Composable
internal fun NativeNavigationRail(p: Props, emit: EventSink, slot: Slot?) {
    if (p.bool("hidden")) return
    val state = remember { RailState() }
    val tokens = LocalAWCThemeTokens.current
    val base = LocalAWCNavigationRailAppearance.current
    val look = base.copy(tab = base.tab.merging(LocalAWCNavigationRailTabAppearance.current))
    val palette = RailPalette(tokens, look)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val reduced = LocalAWCNavigationRailReducedMotion.current ?: railAnimatorsOff()
    val railDensity = resolveAWCDensity(p["density"], LocalAWCNativeDensity.current)
    val standalone = p.bool("_standalone")
    val horizontal = p.str("orientation") == "horizontal"
    val modal = p.bool("modal") && !horizontal
    val fullHeight = p.bool("fullHeight")
    val alignment = p.str("alignment", "top").let { if (it == "middle" || it == "bottom") it else "top" }
    val expandable = p.bool("expandable") && !horizontal
    val toggleLabel = p.str("toggleLabel", "Toggle navigation")
    val visibility = p.str("labelVisibility", "all").let { if (it == "all" || it == "selected" || it == "none") it else "all" }
    val label = p.str("label", "Navigation")
    val manageFocus = !p.bool("disableFocusManagement")
    val overflowLabel = p.str("overflowLabel", "More"); val overflowIcon = p.str("overflowIcon", "more_horiz")
    val railParts = LocalAWCNavigationRailParts.current; val tabPartsAll = LocalAWCNavigationRailTabParts.current; val tabTargets = LocalAWCNavigationRailTabPartTargets.current
    fun rp(part: AWCNavigationRailPart) = railParts[part]
    val m = RailMetrics(railDensity, look, railParts)
    val androidContext = LocalContext.current; val density = LocalDensity.current.density
    val text = remember(androidContext, density) { TabsText(androidContext, density) }
    val textWidth: (String, Double, Int, Double) -> Double = { s, size, w, tr -> if (s.isEmpty()) 0.0 else text.width(s, size, w, tr) }
    val probe = LocalAWCNavigationRailProbe.current
    val viewport = LocalAWCNavigationRailViewport.current
    if (!state.variantInitialized) { state.variantInitialized = true; state.variant = if (p.str("variant") == "expanded") "expanded" else "standard"; state.lastVariantProperty = p["variant"] }
    val expanded = !horizontal && state.variant == "expanded"
    val registered = state.order
    val cap = (p["maxVisible"] as? Number)?.toDouble() ?: p.str("maxVisible").toDoubleOrNull()
    val overflowed = if (cap != null && cap.isFinite() && cap >= 1 && registered.size > cap) (cap.toInt() until registered.size).toSet() else emptySet()
    val uri = LocalUriHandler.current
    val router = LocalAWCURLRouter.current ?: remember(uri) { AWCURLRouter { r -> if (!java.net.URI(r.url).isAbsolute) false else runCatching { uri.openUri(r.url); true }.getOrDefault(false) } }
    val toggleFocus = remember { FocusRequester() }
    var toggleFocused by remember { mutableStateOf(false) }
    fun follow(c: RailChild) { AWCNavigationRequest.from(c.href, c.props.str("target").ifEmpty { "_self" })?.let { router.open(it) } }
    fun setVariant(requested: String?, fromProperty: Boolean = false) {
        val next = requested ?: if (state.variant == "expanded") "standard" else "expanded"
        if (next == state.variant) return
        state.variant = next; state.pendingFlip = !reduced && !horizontal; state.pendingFlipFrame = state.frame; state.roving = null; state.version++
        // lastVariantProperty tracks the host's property only: a toggle / method / Escape / scrim write is internal state, so a
        // later host write (also one to the value the rail already shows) is what the property sync compares against.
        emit(if (next == "expanded") "mdExpand" else "mdCollapse", null)
    }
    lateinit var ctx: RailContext
    fun select(i: Int) {
        val o = state.order; val changed = i != state.active
        state.active = i; state.roving = i
        o.forEachIndexed { k, c -> if (k != i) state.submenuSelection.remove(c.id) }
        state.version++
        if (changed) emit("mdTabChange", mapOf("index" to i, "value" to o[i].value))
    }
    fun click(c: RailChild) {
        val o = state.order; val i = o.indexOf(c)
        if (i < 0 || c.disabled) return
        if (c.hasMenu) { c.menuOpen = !c.menuOpen; c.emit?.invoke("mdSubmenuToggle", mapOf("open" to c.menuOpen)); return }
        if (standalone) { c.emit?.invoke("mdTabClick", mapOf("value" to c.value)); follow(c); return }
        if (ctx.skipped(c, i)) return
        c.emit?.invoke("mdTabClick", mapOf("value" to c.value))
        select(i)
        if (c.isLink) follow(c)
    }
    /** A submenu item chosen: the destination activates (mdTabClick, then the selection) and remembers the item (SwiftUI's
     *  openSubmenu); a destination alone only reports its click. */
    fun pickSubmenu(c: RailChild, j: Int) {
        val o = state.order; val i = o.indexOf(c)
        c.menuOpen = false; c.emit?.invoke("mdSubmenuToggle", mapOf("open" to false))
        state.submenuSelection[c.id] = j; state.version++
        if (standalone) { c.emit?.invoke("mdTabClick", mapOf("value" to c.value)); return }
        if (i < 0 || ctx.skipped(c, i)) return
        c.emit?.invoke("mdTabClick", mapOf("value" to c.value))
        select(i)
        state.submenuSelection[c.id] = j
    }
    fun keyActivate(c: RailChild) { if (c.disabled) return; c.ripple.trigger(); click(c) }
    fun focusTab(t: Int) { val o = state.order; if (t !in o.indices) return; state.roving = t; o[t].pointerFocus = false; o[t].wantsFocus = true; state.version++; runCatching { o[t].focus.requestFocus() } }
    fun key(c: RailChild, k: String): Boolean {
        if (k == "Escape" && modal && state.variant == "expanded") { setVariant("standard"); runCatching { toggleFocus.requestFocus() }; return true }
        if (!manageFocus || standalone) return false
        val o = state.order; val focusable = o.indices.filter { !ctx.skipped(o[it], it) }
        if (focusable.isEmpty()) return false
        val current = focusable.indexOf(o.indexOf(c))
        val bidi = horizontal && rtl
        val forward = k == "ArrowDown" || k == (if (bidi) "ArrowLeft" else "ArrowRight")
        val backward = k == "ArrowUp" || k == (if (bidi) "ArrowRight" else "ArrowLeft")
        val next = when { forward -> if (current < 0) 0 else (current + 1) % focusable.size
            backward -> if (current < 0) focusable.size - 1 else (current - 1 + focusable.size) % focusable.size
            k == "Home" -> 0; k == "End" -> focusable.size - 1; else -> return false }
        focusTab(focusable[next]); return true
    }
    ctx = RailContext(state, palette, look, railDensity, visibility, expanded, horizontal, modal, rtl, reduced, standalone, manageFocus, overflowed, text, probe,
        ::click, ::keyActivate, ::key, emit, railParts, tabPartsAll, tabTargets, ::pickSubmenu)
    LocalAWCNavigationRailController.current?.let { ctl -> SideEffect {
        ctl.variantHandler = { v -> setVariant(v) }
        ctl.focusHandler = { i -> if (i in state.order.indices && !state.order[i].disabled) focusTab(i) }
        ctl.clearHandler = { i -> state.order.getOrNull(i)?.let { state.submenuSelection.remove(it.id); state.version++ } }
    } }
    /** Sets every transition's target (idempotent): before each frame's layout, so a change starts on the next frames. */
    fun retarget(now: Double) {
        // The live variant: a toggle / method / Escape / scrim write retargets on the next frame, before its recomposition.
        val expanded = !horizontal && state.variant == "expanded"
        val stop = ctx.tabStop()
        state.order.forEachIndexed { i, c -> ctx.targets(c, ctx.tabState(c, i, stop), now) }
        val dur = if (reduced) 0.0 else 200.0; val cw = m.containerWidth
        val surfaceTarget = if (modal && expanded) listOf(16.0, 16.0, min(m.expandedWidth, m.expandedMax), -32.0) else listOf(0.0, 0.0, cw, 0.0)
        val targetWidth = if (modal || horizontal) cw else m.width(expanded)
        val paint = if (modal && expanded) 1.0 else 0.0; val scrim = if (modal && expanded) 0.32 else 0.0
        val logo = if (expanded) 1.0 else 0.0; val footer = if (expanded || horizontal) 1.0 else 0.0
        if (!state.tracksInitialized) {
            state.width.snap(targetWidth); state.surface.snap(surfaceTarget); state.surfacePaint.snap(paint); state.scrim.snap(scrim); state.logo.snap(logo); state.footerContent.snap(footer)
            state.tracksInitialized = true
        } else {
            state.width.set(targetWidth, now, dur, RAIL_STANDARD); state.surface.set(surfaceTarget, now, dur, RAIL_STANDARD)
            state.surfacePaint.set(paint, now, dur, RAIL_EFFECTS_DEFAULT); state.scrim.set(scrim, now, dur, RAIL_STANDARD)
            state.logo.set(logo, now, dur, RAIL_STANDARD); state.footerContent.set(footer, now, dur, RAIL_STANDARD)
        }
    }
    if (!state.tracksInitialized) retarget(state.frame)
    SideEffect { state.retargetFn = ::retarget }
    // Property writes: variant (with the expand/collapse transition and events), activeIndex (silent); the initial order selects.
    SideEffect {
        // A host property change replaces local interaction state (as AWCNativeView does): the host's variant applies again, also
        // when the host's value itself did not change after an internal toggle (the Web element's property moved; setting it back
        // collapses). Recompositions with the same properties change nothing.
        if (p != state.lastHostProps) { val first = state.lastHostProps == null; state.lastHostProps = p
            if (!first) setVariant(if (p.str("variant") == "expanded") "expanded" else "standard", true) }
        val o = registered
        if (!state.initialized && o.isNotEmpty()) {
            state.initialized = true; state.lastActiveProperty = p["activeIndex"]
            var idx = (p["activeIndex"] as? Number)?.toInt() ?: -1
            if (idx < 0) idx = o.indexOfFirst { it.props.bool("active") }
            state.active = idx; state.version++
        } else if (state.initialized && p["activeIndex"] != state.lastActiveProperty) {
            state.lastActiveProperty = p["activeIndex"]; state.active = (p["activeIndex"] as? Number)?.toInt() ?: -1; state.roving = null
        }
        state.version++
    }
    // The frame clock: targets apply on frames; the loop sleeps when nothing runs. A change signalled at any point of an
    // iteration — its frame's composition included (the initial selection, a destination's new props) — runs one more frame:
    // the version is taken before the frame, so a bump during that frame's composition is never lost. (Only real changes bump
    // it: a destination recomposed by the frame itself does not.)
    LaunchedEffect(state) {
        while (isActive) {
            val v = state.version
            withFrameNanos { t -> val ms = t / 1e6; (state.retargetFn ?: ::retarget)(ms); state.frame = ms }
            if (!state.running(state.frame)) snapshotFlow { state.version }.first { it != v }
        }
    }
    val fi = state.frameInfo
    val paintF = fi?.surfacePaint ?: 0.0
    // A modal rail's container is its surface: the container part's colour and corners replace the surface's.
    val containerColor = if (standalone) Color.Transparent
        else if (modal) (railPartColor(rp(AWCNavigationRailPart.Container)?.backgroundColor) ?: accordionColorLerp(palette.container(false), palette.container(true), paintF))
        else palette.container(false)
    val corners: AWCCornerShape = if (modal) rp(AWCNavigationRailPart.Container)?.cornerShape ?: run {
        val base0 = look.containerShape?.topRight?.x?.points ?: 0.0; val open = look.containerShape?.topRight?.x?.points ?: 16.0
        val end = base0 + (open - base0) * paintF; val start = open * paintF
        fun r(v: Double) = AWCCornerRadius(AWCCornerLength(v), AWCCornerLength(v))
        if (rtl) AWCCornerShape(r(end), r(start), r(start), r(end)) else AWCCornerShape(r(start), r(end), r(end), r(start))
    } else look.containerShape ?: AWCCornerShape()
    val shadows: List<NativeShadowLayer> = if (standalone) emptyList() else if (modal && look.containerElevation == null) palette.elevation3.map { it.copy(color = it.color.copy(alpha = (it.color.alpha * paintF).toFloat())) }
        else look.containerElevation?.map { it.resolved() } ?: emptyList()
    val open = state.variant == "expanded"
    val C = AWCNavigationRailPart.Container; val F = AWCNavigationRailPart.Footer; val FP = AWCNavigationRailPart.FooterProfile
    /** A logo mark's own opacity: the cross-fade (a part opacity replaces it). */
    fun logoOpacity(expandedMark: Boolean, fi: RailFrameInfo? = state.frameInfo): Double = if (expandedMark) rp(AWCNavigationRailPart.LogoExpanded)?.opacity ?: (fi?.logoExpanded ?: 0.0)
        else rp(AWCNavigationRailPart.LogoContracted)?.opacity ?: if (state.sizes.containsKey("logo-expanded") && !horizontal) 1 - (fi?.logoExpanded ?: 0.0) else 1.0
    /** The profile text: its own opacity (the reveal, or the part's) while visible — `visibility: hidden` once concealed. */
    fun footerContentOpacity(fi: RailFrameInfo? = state.frameInfo): Double { val v = fi?.footerContent ?: 0.0; return if (v > 0) rp(AWCNavigationRailPart.FooterContent)?.opacity ?: v else 0.0 }
    val scrimColor = railPartColor(rp(AWCNavigationRailPart.Scrim)?.backgroundColor) ?: palette.scrim
    val scrimCorners = rp(AWCNavigationRailPart.Scrim)?.cornerShape ?: AWCCornerShape()
    val dockedScrim = !modal && (rp(AWCNavigationRailPart.Scrim)?.opacity ?: 0.0) > 0
    val profileInk = listOf(AWCNavigationRailPart.FooterContent, FP, F, C).firstNotNullOfOrNull { railPartColor(rp(it)?.color) } ?: palette.content
    val fc = rp(AWCNavigationRailPart.FooterContent)
    CompositionLocalProvider(LocalRailRow provides ctx, LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(Modifier.semantics { if (!standalone) { isTraversalGroup = true; contentDescription = label } }
            .onGloballyPositioned { lc -> val pp = lc.positionInRoot(); state.rootOrigin = pp.x / density.toDouble() to pp.y / density.toDouble(); state.rootWidth = lc.size.width / density.toDouble() }) {
            val propW = if (constraints.hasBoundedWidth) maxWidth.value.toDouble() else 0.0
            val propH = if (constraints.hasBoundedHeight) maxHeight.value.toDouble() else 0.0
            state.proposedWidth = propW
            Layout(content = {
                if (modal) Box(Modifier.layoutId("scrim")
                    .drawBehind { drawOutline(scrimCorners.createOutline(size, layoutDirection, this), scrimColor.copy(alpha = (scrimColor.alpha * (rp(AWCNavigationRailPart.Scrim)?.opacity ?: state.frameInfo?.scrim ?: 0.0)).toFloat())) }
                    .pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(); if (e.type == PointerEventType.Release && state.variant == "expanded") { setVariant("standard"); runCatching { toggleFocus.requestFocus() } } } } })
                Box(Modifier.layoutId("surface").graphicsLayer { alpha = if (modal) ctx.chain(C).toFloat() else 1f }.accordionShadow(corners, shadows, false).drawBehind {
                    drawPath(androidx.compose.ui.graphics.Path().apply { addOutline(corners.createOutline(size, layoutDirection, this@drawBehind)) }, containerColor) })
                // The painted part boxes (background + corner shape) with their ancestry's opacity, in paint order.
                Box(Modifier.layoutId("boxes").drawBehind {
                    for (b in state.boxes) { val r = b.rect
                        translate((r.x * density).toFloat(), (r.y * density).toFloat()) {
                            drawOutline((b.value.cornerShape ?: AWCCornerShape()).createOutline(Size((r.w * density).toFloat(), (r.h * density).toFloat()), LayoutDirection.Ltr, this),
                                (railPartColor(b.value.backgroundColor) ?: Color.Transparent).let { it.copy(alpha = (it.alpha * b.opacity).toFloat()) }) } } })
                Box(Modifier.layoutId("logo").graphicsLayer { alpha = (ctx.chain(C, AWCNavigationRailPart.Logo) * logoOpacity(false)).toFloat() }) {
                    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) { slot?.invoke("logo") } }
                if (!horizontal) Box(Modifier.layoutId("logo-expanded").graphicsLayer { alpha = (ctx.chain(C, AWCNavigationRailPart.Logo) * logoOpacity(true)).toFloat() }) {
                    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) { slot?.invoke("logo-expanded") } }
                if (expandable) Box(Modifier.layoutId("toggle").graphicsLayer { alpha = ctx.chain(C, AWCNavigationRailPart.Toggle).toFloat() }.focusRequester(toggleFocus)
                    .onFocusChanged { toggleFocused = it.hasFocus }) {
                    AWCComponent("md-icon-button", mapOf("id" to p.str("id") + "-toggle", "icon" to if (open) "menu_open" else "menu", "aria-label" to toggleLabel,
                        "aria-expanded" to if (open) "true" else "false"), onEvent = { n, _ -> if (n == "mdClick") setVariant(null) })
                }
                state.header.fresh = true
                Box(Modifier.layoutId("header").graphicsLayer { alpha = ctx.chain(C, AWCNavigationRailPart.Header).toFloat() }) {
                    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr, LocalAWCRailHeader provides state.header) { slot?.invoke("header") } }
                Box(Modifier.layoutId("fab").graphicsLayer { alpha = ctx.chain(C, AWCNavigationRailPart.Fab).toFloat() }) {
                    CompositionLocalProvider(LocalAWCFabFlatElevation provides true, LocalAWCRailFab provides RailFabSlot(expanded, if (horizontal) null else m.fabSize, state),
                        LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) { slot?.invoke("fab") }
                }
                if (overflowed.isNotEmpty()) Box(Modifier.layoutId("overflow").graphicsLayer { alpha = ctx.chain(C, AWCNavigationRailPart.Overflow, AWCNavigationRailPart.OverflowTrigger).toFloat() }) {
                    RailOverflowTrigger(ctx, overflowLabel, overflowIcon, m) }
                Box(Modifier.layoutId("footer-leading").graphicsLayer { alpha = ctx.chain(C, F, FP, AWCNavigationRailPart.FooterLeading).toFloat() }, contentAlignment = Alignment.Center) {
                    slot?.invoke("footer-leading") }
                Box(Modifier.layoutId("footer-content").graphicsLayer { alpha = (ctx.chain(C, F, FP) * footerContentOpacity()).toFloat() }
                    .railContentClip(state, rtl)) {
                    // The profile text inherits its colour through footer-profile, footer and the container parts.
                    val ts = androidx.compose.material3.LocalTextStyle.current
                    // The page's text (16 px, 400, letter-spacing normal) unless the footer-content part sets it — not Material's
                    // body style (whose 0.5 tracking widened the profile, and with it the horizontal bar's footer).
                    val style = ts.merge(TextStyle(fontSize = with(LocalDensity.current) { (fc?.fontSize ?: 16.0).dp.toSp() },
                        fontWeight = FontWeight((fc?.fontWeight ?: 400.0).roundToInt().coerceIn(1, 1000)),
                        letterSpacing = with(LocalDensity.current) { (fc?.letterSpacing ?: 0.0).dp.toSp() }))
                    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr,
                        androidx.compose.material3.LocalContentColor provides profileInk, androidx.compose.material3.LocalTextStyle provides style) { slot?.invoke("footer-content") } }
                Box(Modifier.layoutId("footer").graphicsLayer { alpha = ctx.chain(C, F).toFloat() }) { CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    if (horizontal) Row(horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(m.footerItemGap.dp)) { slot?.invoke("footer") }
                    else Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(m.footerItemGap.dp)) { slot?.invoke("footer") } } }
                if (dockedScrim) Box(Modifier.layoutId("scrim-docked").drawBehind {
                    drawOutline(scrimCorners.createOutline(size, layoutDirection, this), scrimColor.copy(alpha = (scrimColor.alpha * (rp(AWCNavigationRailPart.Scrim)?.opacity ?: 0.0)).toFloat())) })
                Box(Modifier.layoutId("destinations").graphicsLayer { alpha = ctx.chain(C, AWCNavigationRailPart.Destinations).toFloat() }.clipToBounds()) {
                    Layout(content = { slot?.invoke("") }) { ms, cs ->
                        val order = ms.mapNotNull { it.layoutId as? RailChild }
                        if (order != state.order) state.order = order
                        val origin = state.placedOrigin
                        val pls = ms.map { mm -> (mm.layoutId as? RailChild)?.let { c -> state.placed[c] }?.let { f ->
                            if (f.hidden) null else mm.measure(Constraints.fixed((f.tab.w * density).roundToInt().coerceAtLeast(0), (f.tab.h * density).roundToInt().coerceAtLeast(0))) to f } }
                        layout(cs.maxWidth, cs.maxHeight) { pls.forEach { it?.let { (pl, f) -> pl.place(((f.tab.x - origin.first) * density).roundToInt(), ((f.tab.y - origin.second) * density).roundToInt()) } } }
                    }
                }
            }) { ms, _ ->
                val now = state.frame
                val byId = HashMap<Any?, androidx.compose.ui.layout.Measurable>(); ms.forEach { byId[it.layoutId] = it }
                fun natural(id: String): Placeable? = byId[id]?.measure(Constraints())?.also { pl ->
                    val s = pl.width / density.toDouble() to pl.height / density.toDouble()
                    if (pl.width > 0 || pl.height > 0) { if (state.sizes[id] != s) state.sizes[id] = s } else if (state.sizes.containsKey(id)) state.sizes.remove(id) }
                val logoP = natural("logo"); val logoXP = natural("logo-expanded"); val toggleP = natural("toggle"); val headerP = natural("header"); val fabP = natural("fab")
                val leadP = natural("footer-leading"); val contentP = natural("footer-content"); val footerP = natural("footer")
                fun has(id: String) = state.sizes.containsKey(id)
                val H = if (fullHeight) viewport?.height?.toDouble() ?: propH else propH
                val o = state.order
                val cw = m.containerWidth
                val S0 = if (horizontal || modal) propW else state.width.presented(now)
                val sv = state.surface.presented(now)
                val input = RailLayoutInput(o.map { RailTabInput(it.label, it.hasMenu, ctx.tabMetrics(it)) }, m, state.active, visibility, alignment, expanded, horizontal, modal,
                    overflowed, overflowLabel, H).apply {
                    hasLogo = has("logo") || has("logo-expanded"); (state.sizes["logo"] ?: state.sizes["logo-expanded"])?.let { logoW = it.first; logoH = it.second }
                    hasToggle = expandable; hasHeader = has("header"); state.sizes["header"]?.let { headerW = it.first; headerH = it.second }
                    hasFab = has("fab"); state.sizes["fab"]?.let { fabW = it.first; fabH = it.second }; fabLabelled = state.fabLabelled
                    hasFooterLeading = has("footer-leading"); hasFooterProfile = hasFooterLeading || has("footer-content")
                    state.sizes["footer-leading"]?.let { leadingHeight = it.second }
                    contentWidth = state.sizes["footer-content"]?.first ?: 0.0; contentHeight = if (has("footer-content")) state.sizes["footer-content"]?.second ?: 19.0 else 0.0
                    footerItems = state.sizes["footer"]?.let { listOf(it) } ?: emptyList()
                    reveal = o.map { it.motion.reveal.presented(now) }
                    submenuSelected = o.indices.filter { state.submenuSelection[o[it].id] != null && it != state.active }.toSet()
                    proposedWidth = propW; this.standalone = standalone
                    hiddenTabs = o.indices.filter { o[it].props.bool("hidden") }.toSet()
                    surface = if (modal) RailRect(sv[1], sv[0], sv[2], max(0.0, H + sv[3])) else null
                }
                val g = RailLayout.compute(input, textWidth)
                // A destination alone spans its box's inline size (as proposed) at its own block size.
                val alone = standalone && !horizontal
                val S = if (alone) g.width else S0
                val rootW = if (horizontal || modal || alone) (if (alone) g.width else propW) else S
                val rootH = if (horizontal || alone) g.height else if (fullHeight && viewport != null) viewport.height.toDouble() else if (propH > 0) propH else g.naturalHeight
                val space = S
                val host = if (horizontal || alone) RailRect(0.0, 0.0, S, g.height) else RailRect(0.0, 0.0, if (modal) cw else S, H).phys(rtl, space)
                val surface = if (modal) g.surface.phys(rtl, space) else host
                var dest = g.destinations
                if (!horizontal && !alone) dest = dest.copy(w = max(0.0, (if (modal) g.surface.w else S) - 2 * m.paddingInline(expanded)))
                val destP = dest.phys(rtl, space)
                state.placedOrigin = destP.x to destP.y
                // Destinations: the layout's final geometry, then the expand/collapse FLIP (timed with the width / surface track).
                val track = if (modal) state.surface.running else state.width.running
                val timing = if (track != null && now < track.end) Triple(track.start, track.duration, track.curve) else Triple(now, 200.0, RAIL_STANDARD)
                // The FLIP starts with the track the frame after the variant change starts (its retarget). A pass before that frame
                // (a layout the host drives, the clock still at the change) neither starts the flip at that stale time nor records
                // its rects as the next flip's first; a later frame without a track (an unchanged target) settles it.
                val trackStarted = track != null && now < track.end && track.start >= state.pendingFlipFrame && now > state.pendingFlipFrame
                val flipNow = state.pendingFlip && (trackStarted || now > state.pendingFlipFrame + 40)
                if (flipNow) state.pendingFlip = false
                val holdRendered = state.pendingFlip
                val stop = ctx.tabStop()
                val placed = HashMap<RailChild, RailTabFrame>()
                o.forEachIndexed { i, c ->
                    val tg = g.tabs.getOrNull(i) ?: return@forEachIndexed
                    val tm = ctx.tabMetrics(c); val mo = c.motion
                    val tab = tg.frame.phys(rtl, space)
                    var indicator = tg.indicator.inTab(tab, rtl); var iconWrapper = tg.iconWrapper.inTab(tab, rtl); var icon = tg.icon.inTab(tab, rtl)
                    var lab = tg.label?.inTab(tab, rtl); var caret = tg.caret?.inTab(tab, rtl)
                    var labelOpacity = if (tg.label == null) 0.0 else if (visibility == "selected" && !expanded) mo.reveal.presented(now) else 1.0
                    val labelSize = if (expanded) tm.expandedLabelSize else tm.labelSize; val labelLine = if (expanded) tm.expandedLineHeight else tm.lineHeight; val labelTracking = tm.labelTracking(expanded)
                    if (flipNow) {
                        val first = state.rendered[c]
                        val flip = RailFlip(timing.first, timing.second, timing.third).also { it.space = space }
                        if (first != null) {
                            // First and last in one frame: RTL rail-local x is measured from the moving inline-start edge (a flip
                            // mid-transition, e.g. a reversed expand, sees the width a frame later): the first rects move by the change.
                            val sh = if (rtl) space - first.space else 0.0
                            val fInd = first.indicator.offset(sh, 0.0); val fLab = first.label?.offset(sh, 0.0)
                            val last = indicator
                            if (fInd.w > 0 && fInd.h > 0 && last.w > 0 && last.h > 0)
                                flip.indicator = doubleArrayOf(fInd.x - last.x, fInd.y - last.y, fInd.w / last.w, fInd.h / last.h)
                            val dx = first.iconCentre.first + sh - iconWrapper.midX; val dy = first.iconCentre.second - iconWrapper.midY
                            if (abs(dx) > 0.5 || abs(dy) > 0.5) flip.icon = dx to dy
                            val l = lab
                            if (l != null && labelOpacity > 0) {
                                val lx = if (first.labelVisible) (fLab?.x ?: l.x) - l.x else 0.0; val ly = if (first.labelVisible) (fLab?.y ?: l.y) - l.y else 0.0
                                val from = if (first.labelVisible) first.labelOpacity else 0.0
                                if (abs(lx) > 0.5 || abs(ly) > 0.5 || abs(from - labelOpacity) > 0.01) flip.label = doubleArrayOf(lx, ly, from, labelOpacity)
                            } else if (first.labelVisible && first.labelOpacity > 0 && fLab != null && fLab.w > 0 && fLab.h > 0)
                                flip.outgoing = RailOutgoing(fLab, first.labelOpacity, first.labelSize, first.labelWeight, first.labelTracking)
                        }
                        mo.flip = flip
                    }
                    val flip = mo.flip; val e = flip.progress(now)
                    var outgoing: Pair<RailOutgoing, Double>? = null
                    if (flip.running(now) || e < 1) {
                        flip.indicator?.let { a -> val r = indicator
                            indicator = RailRect(r.x + a[0] * (1 - e), r.y + a[1] * (1 - e), r.w * (a[2] + (1 - a[2]) * e), r.h * (a[3] + (1 - a[3]) * e)) }
                        flip.icon?.let { (dx, dy) -> iconWrapper = iconWrapper.offset(dx * (1 - e), dy * (1 - e)); icon = icon.offset(dx * (1 - e), dy * (1 - e)) }
                        flip.label?.let { a -> lab = lab?.offset(a[0] * (1 - e), a[1] * (1 - e)); caret = caret?.offset(a[0] * (1 - e), a[1] * (1 - e)); labelOpacity = a[2] + (a[3] - a[2]) * e }
                        flip.outgoing?.let { og -> if (flip.running(now)) outgoing = (if (rtl && space != flip.space)
                            RailOutgoing(og.rect.offset(space - flip.space, 0.0), og.opacity, og.size, og.weight, og.tracking) else og) to og.opacity * (1 - e) }
                    }
                    val badge = c.badge?.let { bt ->
                        val ib = RailRect(iconWrapper.midX - tm.iconSize / 2, iconWrapper.midY - tm.iconSize / 2, tm.iconSize, tm.iconSize)
                        if (bt.isEmpty()) RailRect(if (rtl) ib.x + 3 else ib.maxX - 3, ib.y - 3, 6.0, 6.0)
                        else { val bw = max(16.0, textWidth(bt, 11.0, 500, 0.0) + 8); RailRect(if (rtl) ib.x + bw / 2 else ib.maxX - bw / 2, ib.y - 8, bw, 16.0) }
                    }
                    // The probe: this pass's rects and time (the destination's own probe entry is written at its composition, a frame
                    // earlier than this placement).
                    if (probe != null) { val pid = c.id.ifEmpty { "tab$i" }
                        probe.tabs[pid]?.let { old -> probe.tabs[pid] = old + mapOf("renderTime" to now, "rects" to mapOf("tab" to tab, "indicator" to indicator, "iconWrapper" to iconWrapper,
                            "icon" to icon, "label" to lab, "caret" to caret, "badge" to badge).mapValues { (_, rr) -> rr?.list() }) } }
                    placed[c] = RailTabFrame(tab, indicator, iconWrapper, icon, lab, caret, labelOpacity, labelSize, labelLine, labelTracking, badge, outgoing, tg.overflowed,
                        ctx.tabState(c, i, stop), tg.labelTextWidth)
                    if (!holdRendered) state.rendered[c] = RailRendered(indicator, iconWrapper.midX to iconWrapper.midY, lab, labelOpacity, lab != null && labelOpacity > 0 && !tg.overflowed,
                        labelSize, mo.weight.presented(now), labelTracking, space)
                }
                // A destination's state moved (activation, hover, press, focus, a property): wake the frame clock so its transitions
                // retarget (the measure pass is where the live state is read; nothing else may recompose).
                if (placed.any { (c, f) -> state.placedLast[c]?.state != f.state }) state.version++
                state.placedLast = placed; state.placed = placed
                val info = RailFrameInfo(host, surface, state.surfacePaint.presented(now), state.scrim.presented(now), state.logo.presented(now), state.footerContent.presented(now), g, now)
                // Composition reads the frame's paint fractions: publish a new frame only when one of them (or the host / surface) moved,
                // or every measure would recompose the rail and remeasure it again (the main looper would never go idle).
                state.frameInfo.let { f -> if (f == null || f.surfacePaint != info.surfacePaint || f.scrim != info.scrim || f.logoExpanded != info.logoExpanded
                    || f.footerContent != info.footerContent || f.host != info.host || f.surface != info.surface) state.frameInfo = info }
                state.contentClip = g.content?.w ?: 0.0
                fun px(v: Double) = (v * density).roundToInt()
                val toggleRect = g.toggle?.let { RailRect(cw / 2 - 24 + if (modal) g.surface.x else 0.0, it.y, 48.0, 48.0).phys(rtl, space) }
                val overflowP = g.overflow?.let { r -> byId["overflow"]?.measure(Constraints.fixed(px(r.w), px(r.h))) }
                val destPl = byId["destinations"]?.measure(Constraints.fixed(px(destP.w).coerceAtLeast(0), px(destP.h).coerceAtLeast(0)))
                val scrimP = byId["scrim"]?.measure(Constraints.fixed(px(propW), px(propH)))
                val surfaceP = byId["surface"]?.measure(Constraints.fixed(px(surface.w), px(surface.h)))
                val logoRect = g.logo?.let { l -> logoP?.let { pl -> RailRect(if (horizontal) l.x + 8 else (if (modal) g.surface.x else 0.0) + (cw - m.logoIconSize) / 2, l.midY - pl.height / density / 2.0,
                    pl.width / density.toDouble(), pl.height / density.toDouble()).phys(rtl, space) } }
                // The header: a column centred on the block axis above its 4 bottom padding; a slotted icon button centres on the rail's
                // axis (vertical rails), other content centres (collapsed, a bar) or starts after the 8 expanded inset.
                val headerRect = g.header?.let { r -> headerP?.let { pl -> val w = pl.width / density.toDouble(); val h = pl.height / density.toDouble(); val rr = r.phys(rtl, space)
                    val lead = if (state.header.iconButton && !horizontal) cw / 2 - m.paddingInline(expanded) - w / 2 else if (expanded) 8.0 else (r.w - w) / 2
                    RailRect(if (rtl) rr.maxX - lead - w else rr.x + lead, r.y + (r.h - 4 - h) / 2, w, h) } }
                // Part boxes: sections are `inline-size: 100%` content boxes, so the toggle's and a collapsed FAB's inline-start
                // padding and the expanded header's paddings overflow the container's inline end.
                val padI = m.paddingInline(expanded)
                fun grown(r: RailRect?, extra: Double) = r?.let { RailRect(it.x, it.y, it.w + max(0.0, extra), it.h).phys(rtl, space) }
                val boxes = mutableListOf<RailPartBox>()
                fun add(part: AWCNavigationRailPart, r: RailRect?, opacity: Double) { val v = railParts[part] ?: return
                    if (v.backgroundColor == null || r == null || r.w <= 0 || r.h <= 0) return; boxes += RailPartBox(part, v, r, opacity) }
                if (!modal) add(C, g.container.phys(rtl, space), ctx.chain(C))
                g.logo?.let { l ->
                    add(AWCNavigationRailPart.Logo, l.phys(rtl, space), ctx.chain(C, AWCNavigationRailPart.Logo))
                    // The two marks span the logo area from one rail inset before it (absolute, inset-inline 0, margin −padding); in a
                    // bar they are static boxes with 8 inline padding around the mark.
                    val mark = if (horizontal) state.sizes["logo"]?.let { (w, h) -> RailRect(l.x, l.midY - h / 2, w + 16, h).phys(rtl, space) }
                        else RailRect(l.x - padI, l.y, l.w + padI, l.h).phys(rtl, space)
                    add(AWCNavigationRailPart.LogoContracted, mark, ctx.chain(C, AWCNavigationRailPart.Logo) * logoOpacity(false, info))
                    if (!horizontal) add(AWCNavigationRailPart.LogoExpanded, mark, ctx.chain(C, AWCNavigationRailPart.Logo) * logoOpacity(true, info))
                }
                add(AWCNavigationRailPart.Toggle, grown(g.toggle, (cw - 40) / 2 - padI), ctx.chain(C, AWCNavigationRailPart.Toggle))
                add(AWCNavigationRailPart.Header, grown(g.header, if (expanded) 16.0 else 0.0), ctx.chain(C, AWCNavigationRailPart.Header))
                add(AWCNavigationRailPart.Fab, grown(g.fab, if (horizontal || expanded) 0.0 else (cw - m.fabSize) / 2), ctx.chain(C, AWCNavigationRailPart.Fab))
                add(AWCNavigationRailPart.Destinations, destP, ctx.chain(C, AWCNavigationRailPart.Destinations))
                add(AWCNavigationRailPart.Overflow, g.overflow?.phys(rtl, space), ctx.chain(C, AWCNavigationRailPart.Overflow))
                add(AWCNavigationRailPart.OverflowTrigger, g.overflow?.phys(rtl, space), ctx.chain(C, AWCNavigationRailPart.Overflow, AWCNavigationRailPart.OverflowTrigger))
                add(F, g.footer?.phys(rtl, space), ctx.chain(C, F))
                add(FP, g.profile?.phys(rtl, space), ctx.chain(C, F, FP))
                add(AWCNavigationRailPart.FooterLeading, g.leading?.phys(rtl, space), ctx.chain(C, F, FP, AWCNavigationRailPart.FooterLeading))
                add(AWCNavigationRailPart.FooterContent, g.content?.phys(rtl, space), ctx.chain(C, F, FP) * footerContentOpacity(info))
                if (state.boxes.size != boxes.size || state.boxes.indices.any { k -> state.boxes[k].rect != boxes[k].rect || state.boxes[k].opacity != boxes[k].opacity || state.boxes[k].value != boxes[k].value }) state.boxes = boxes
                val boxesP = byId["boxes"]?.measure(Constraints.fixed(px(rootW), px(rootH)))
                val dockedP = byId["scrim-docked"]?.measure(Constraints.fixed(px(host.w), px(host.h)))
                if (probe != null) probe.rail = mapOf("variant" to state.variant, "activeIndex" to state.active, "host" to host.list(), "container" to surface.list(),
                    "scrim" to (rp(AWCNavigationRailPart.Scrim)?.opacity ?: info.scrim), "surfacePaint" to info.surfacePaint, "background" to containerColor, "count" to o.size, "overflowCount" to overflowed.size,
                    "label" to label, "horizontal" to horizontal, "modal" to modal, "reduced" to reduced, "density" to railDensity, "renderTime" to now, "animating" to state.running(now),
                    "destinations" to destP.list(), "toggle" to toggleRect?.list(), "overflow" to g.overflow?.phys(rtl, space)?.list(),
                    "logo" to g.logo?.phys(rtl, space)?.list(), "fab" to g.fabItem?.phys(rtl, space)?.list(), "leading" to g.leading?.phys(rtl, space)?.list(),
                    "content" to g.content?.phys(rtl, space)?.list(), "padding" to m.paddingInline(expanded), "focusedToggle" to toggleFocused,
                    // This pass's origin: the last placement's, with an RTL rail's start edge moved by its width change (the
                    // end edge stays), so the probe's rail-local rects of this pass read in the same frame.
                    "origin" to listOf(if (rtl && state.rootWidth >= 0) state.rootOrigin.first + state.rootWidth - rootW else state.rootOrigin.first, state.rootOrigin.second),
                    "proposed" to listOf(propW, propH),
                    "boxes" to boxes.associate { b -> b.part.source to mapOf("rect" to b.rect.list(), "color" to railPartColor(b.value.backgroundColor), "opacity" to b.opacity) },
                    "footerContent" to mapOf("color" to profileInk, "fontSize" to (fc?.fontSize ?: 16.0), "fontWeight" to (fc?.fontWeight ?: 400.0), "opacity" to footerContentOpacity(info)),
                    "overflowColor" to (railPartColor(rp(AWCNavigationRailPart.OverflowTrigger)?.color) ?: palette.content),
                    "logoMark" to logoRect?.list(), "headerItem" to headerRect?.list(), "scrimColor" to scrimColor, "scrimOpacity" to (rp(AWCNavigationRailPart.Scrim)?.opacity ?: info.scrim))
                layout(px(rootW), px(rootH)) {
                    scrimP?.place(0, 0)
                    surfaceP?.place(px(surface.x), px(surface.y))
                    boxesP?.place(0, 0)
                    logoRect?.let { r -> logoP?.place(px(r.x), px(r.y)) }
                    g.logo?.let { l ->
                        logoXP?.let { pl -> val r = RailRect((if (modal) g.surface.x else 0.0) + (cw - m.logoIconSize) / 2, l.midY - pl.height / density / 2.0, pl.width / density.toDouble(), pl.height / density.toDouble()).phys(rtl, space); pl.place(px(r.x), px(r.y)) } }
                    toggleRect?.let { r -> toggleP?.let { pl -> pl.place(px(r.x + (r.w - pl.width / density) / 2), px(r.y + (r.h - pl.height / density) / 2)) } }
                    headerRect?.let { r -> headerP?.place(px(r.x), px(r.y)) }
                    g.fabItem?.let { r -> fabP?.let { pl -> val rr = r.phys(rtl, space); pl.place(px(rr.x), px(rr.y)) } }
                    g.overflow?.let { r -> overflowP?.place(px(r.phys(rtl, space).x), px(r.y)) }
                    g.leading?.let { r -> leadP?.let { pl -> val rr = r.phys(rtl, space); pl.place(px(rr.x + (rr.w - pl.width / density) / 2), px(rr.y + (rr.h - pl.height / density) / 2)) } }
                    g.content?.let { r -> contentP?.let { pl -> val rr = r.phys(rtl, space); pl.place(px(if (rtl) rr.maxX - pl.width / density else rr.x), px(rr.y)) } }
                    g.footerItems.firstOrNull()?.let { r -> footerP?.let { pl -> val rr = r.phys(rtl, space); pl.place(px(rr.x), px(rr.y)) } }
                    destPl?.place(px(destP.x), px(destP.y))
                    dockedP?.place(px(host.x), px(host.y))
                }
            }
        }
    }
}
/** The profile text clips to its box (overflow hidden), at the inline start. */
private fun Modifier.railContentClip(state: RailState, rtl: Boolean) = this.drawWithContent {
    val w = (state.contentClip * density).toFloat()
    if (w <= 0f) return@drawWithContent
    clipRect(if (rtl) size.width - w else 0f, 0f, if (rtl) size.width else w, size.height) { this@drawWithContent.drawContent() }
}

// MARK: destination

/** md-navigation-rail-tab: a rail destination (the rail lays it out and owns selection), or a standalone one with its own `active`. */
@Composable
internal fun NativeNavigationRailTab(p: Props, emit: EventSink, slot: Slot?, child: RailChild?) {
    if (child == null) {
        if (p.bool("hidden")) return
        NativeNavigationRail(mapOf("_standalone" to true, "id" to p.str("id") + "-rail", "labelVisibility" to "all"), emit) { s ->
            if (s == "") { val c = remember { RailChild() }; Box(Modifier.layoutId(c)) { NativeNavigationRailTab(p, emit, slot, c) } }
        }
        return
    }
    val ctx = LocalRailRow.current ?: return
    val state = ctx.state
    SideEffect {
        if (child.props != p) child.props = p
        child.emit = emit
        // Wake the rail's frame clock on a real change (props, interaction state), not on a recomposition its own frame caused.
        val signal = listOf(p, child.hover, child.pressed, child.focused, child.pointerFocus, child.slotIcon, child.hasMenu, child.menuOpen)
        if (signal != child.lastSignal) { child.lastSignal = signal; state.version++ }
    }
    // A hidden destination (display: none) keeps its index; the rail gives it no box, and it draws and announces nothing.
    if (p.bool("hidden")) return
    val now = state.frame
    val f = state.placed[child]
    val index = state.order.indexOf(child)
    val tm = ctx.tabMetrics(child); val mo = child.motion; val pal = ctx.palette; val tp = tm.parts
    // Part opacities: the icon wrapper covers the icon and the badge; a label part opacity replaces its reveal.
    val wrapperOpacity = tp[AWCNavigationRailTabPart.IconWrapper]?.opacity ?: 1.0
    val layerColor = ctx.stateLayerColor(child)
    val st = f?.state ?: ctx.tabState(child, index, ctx.tabStop())
    val host = mo.color.presented(now); val iconColor = mo.iconColor.presented(now); val labelColor = mo.labelColor.presented(now)
    val indicator = mo.indicator.presented(now); val layer = mo.layer.presented(now); val fill = mo.fill.presented(now); val weight = mo.weight.presented(now)
    val name = child.name(!(ctx.visibility == "none" || (ctx.visibility == "selected" && ctx.expanded && !st.active)))
    val density = LocalDensity.current.density
    val rtl = ctx.rtl
    val tab = f?.tab ?: RailRect()
    fun local(r: RailRect) = r.offset(-tab.x, -tab.y)
    val pillRadius = if (ctx.expanded && f != null) tm.radius(RailRect(0.0, 0.0, tab.w, tab.h)) else 0.0
    Box(Modifier
        // Drawing reads this frame's placement (snapshot state read in the draw phase: the pass that placed the destination
        // redraws it, whether or not anything recomposes).
        .graphicsLayer { alpha = if (state.placed[child]?.hidden == true) 0f else 1f }
        .drawBehind {
            val g = state.placed[child] ?: return@drawBehind
            fun local(r: RailRect) = r.offset(-g.tab.x, -g.tab.y)
            fun rr(r: RailRect, radius: Double, color: Color) = drawRoundRect(color, Offset((r.x * density).toFloat(), (r.y * density).toFloat()),
                Size((r.w * density).toFloat(), (r.h * density).toFloat()), CornerRadius((radius * density).toFloat(), (radius * density).toFloat()))
            fun shapeAt(r: RailRect, corners: AWCCornerShape, color: Color) = translate((r.x * density).toFloat(), (r.y * density).toFloat()) {
                drawOutline(corners.createOutline(Size((r.w * density).toFloat(), (r.h * density).toFloat()), LayoutDirection.Ltr, this), color) }
            fun faded(c: Color, a: Double) = c.copy(alpha = (c.alpha * a).toFloat())
            // The pill (the indicator; a bar's icon wrapper) with the state layer sharing its corners.
            val wp = tp[AWCNavigationRailTabPart.IconWrapper]
            val pill = if (ctx.horizontal) local(g.iconWrapper) else local(g.indicator)
            val corners = if (ctx.horizontal) wp?.cornerShape ?: tm.radius(g.iconWrapper).let { v -> AWCCornerRadius(AWCCornerLength(v), AWCCornerLength(v)).let { c -> AWCCornerShape(c, c, c, c) } }
                else tm.indicatorCorners(g.indicator)
            val pillOpacity = if (ctx.horizontal) wp?.opacity ?: 1.0 else tp[AWCNavigationRailTabPart.Indicator]?.opacity ?: 1.0
            shapeAt(pill, corners, faded(indicator, pillOpacity))
            if (layer > 0) shapeAt(pill, corners, faded(layerColor, layer * pillOpacity))
            // A column's icon wrapper paints only through its part (above the pill: z-index 1).
            if (!ctx.horizontal) wp?.backgroundColor?.let { bg -> railPartColor(bg)?.let { c -> shapeAt(local(g.iconWrapper), wp?.cornerShape ?: AWCCornerShape(), faded(c, wrapperOpacity)) } }
            g.badge?.let { b -> val lb = local(b); rr(lb, lb.h / 2, faded(pal.badge, wrapperOpacity)) }
        }
        .drawWithContent {
            drawContent()
            val g = state.placed[child] ?: return@drawWithContent
            fun local(r: RailRect) = r.offset(-g.tab.x, -g.tab.y)
            val r = if (ctx.horizontal) local(g.iconWrapper).let { r -> RailRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10) } else if (ctx.expanded) local(g.indicator)
                else local(g.indicator).let { r -> RailRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10) }
            val ringRadius = if (ctx.horizontal) tm.radius(g.iconWrapper) + 5 else if (ctx.expanded) tm.radius(g.indicator) else tm.radius(g.indicator) + 5
            if (!(g.state.focusVisible)) return@drawWithContent
            val w = 3 * density
            drawRoundRect(pal.focusRing, Offset((r.x * density).toFloat() + w / 2, (r.y * density).toFloat() + w / 2),
                Size((r.w * density).toFloat() - w, (r.h * density).toFloat() - w), CornerRadius((ringRadius * density).toFloat() - w / 2), style = Stroke(w))
        }
        .awcRipple(disabled = child.disabled, cornerRadius = pillRadius.dp, contentColor = host, controller = child.ripple)
        .pointerInput(child) {
            awaitPointerEventScope {
                while (true) {
                    val e = awaitPointerEvent(PointerEventPass.Main)
                    val c = e.changes.firstOrNull() ?: continue
                    val inside = c.position.x >= 0 && c.position.y >= 0 && c.position.x < size.width && c.position.y < size.height
                    when (e.type) {
                        PointerEventType.Enter, PointerEventType.Move -> if (c.type == PointerType.Mouse || child.pressed) child.hover = !child.disabled && inside
                        PointerEventType.Exit -> child.hover = false
                        PointerEventType.Press -> if (!child.disabled) { child.pressed = true; child.hover = inside || child.hover; child.pointerFocus = true; child.wantsFocus = true; runCatching { child.focus.requestFocus() } }
                        PointerEventType.Release -> { val was = child.pressed; child.pressed = false
                            if (c.type != PointerType.Mouse) child.hover = false
                            if (was && inside && e.motionEvent?.actionMasked != android.view.MotionEvent.ACTION_CANCEL) ctx.click(child) }
                        else -> {}
                    }
                }
            }
        }
        .focusRequester(child.focus)
        .onFocusChanged { child.focused = it.isFocused; if (!it.isFocused) { child.pointerFocus = false; child.wantsFocus = false } }
        .focusProperties { canFocus = !child.disabled && f?.hidden != true && (st.tabStop || child.pressed || child.focused || child.wantsFocus) }
        .focusable(enabled = !child.disabled)
        .onPreviewKeyEvent { e ->
            if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
            if (e.isCtrlPressed || e.isAltPressed || e.isMetaPressed) return@onPreviewKeyEvent false
            when (e.key) {
                Key.Enter, Key.NumPadEnter, Key.Spacebar -> { child.pointerFocus = false; ctx.keyActivate(child); true }
                Key.DirectionDown -> ctx.key(child, "ArrowDown"); Key.DirectionUp -> ctx.key(child, "ArrowUp")
                Key.DirectionRight -> ctx.key(child, "ArrowRight"); Key.DirectionLeft -> ctx.key(child, "ArrowLeft")
                Key.MoveHome -> ctx.key(child, "Home"); Key.MoveEnd -> ctx.key(child, "End"); Key.Escape -> ctx.key(child, "Escape")
                else -> false
            }
        }
        .semantics(mergeDescendants = true) {
            if (!child.isLink && !ctx.standalone) role = Role.Tab
            selected = st.active; contentDescription = name
            if (child.disabled || child.ariaDisabled) disabled()
            if (!child.disabled) onClick(name) { ctx.click(child); true }
            if (child.hasMenu) stateDescription = if (child.menuOpen) "expanded" else "collapsed"
        }) {
        // The parts at their (animated) rail frames: the icon (glyph with FILL, or the slotted icon), the label (+ caret), the
        // badge text and the outgoing label of a collapse.
        Layout(content = {
            Box(Modifier.clearAndSetSemantics { }.graphicsLayer { alpha = (wrapperOpacity * (if (child.slotIcon) 1.0 else tp[AWCNavigationRailTabPart.Icon]?.opacity ?: 1.0)).toFloat() },
                contentAlignment = Alignment.Center) {
                CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides iconColor) {
                    Layout(content = { slot?.invoke("icon") }) { ms, _ ->
                        val has = ms.isNotEmpty(); if (child.slotIcon != has) child.slotIcon = has
                        val s = (tm.iconSize * density).roundToInt(); val pls = ms.map { it.measure(Constraints.fixed(s, s)) }
                        layout(s, s) { pls.forEach { it.place(0, 0) } }
                    }
                }
                if (!child.slotIcon && child.icon.isNotEmpty()) {
                    val fs = with(LocalDensity.current) { tm.glyphSize.dp.toSp() }
                    Text(child.icon, Modifier.wrapContentSize(unbounded = true), color = iconColor, fontFamily = railSymbolFamily(fill), fontWeight = FontWeight(400), fontSize = fs, lineHeight = fs,
                        letterSpacing = 0.sp, maxLines = 1, softWrap = false, style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false), fontFeatureSettings = "liga"))
                }
            }
            Box(Modifier.clearAndSetSemantics { }.graphicsLayer { alpha = (if (f?.label == null) 0.0 else tp[AWCNavigationRailTabPart.Label]?.opacity ?: f.labelOpacity).toFloat() }.clipToBounds(),
                contentAlignment = if (ctx.expanded) Alignment.CenterStart else Alignment.Center) {
                if (f?.label != null) {
                    val fs = with(LocalDensity.current) { f.labelSize.dp.toSp() }; val lh = with(LocalDensity.current) { f.labelLine.dp.toSp() }
                    val ls = with(LocalDensity.current) { f.labelTracking.dp.toSp() }
                    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                        Row(Modifier.wrapContentSize(unbounded = true).padding(horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(child.label, style = TextStyle(color = labelColor, fontFamily = AccordionRoboto, fontWeight = FontWeight(weight.roundToInt().coerceIn(1, 1000)),
                                fontSize = fs, lineHeight = lh, letterSpacing = ls, platformStyle = PlatformTextStyle(includeFontPadding = false)), maxLines = 1, softWrap = false,
                                overflow = TextOverflow.Ellipsis)
                            if (child.hasMenu) {
                                val cs = with(LocalDensity.current) { tm.caretSize.dp.toSp() }
                                val cp = tp[AWCNavigationRailTabPart.Caret]
                                Text("arrow_drop_down", Modifier.graphicsLayer { rotationZ = if (child.menuOpen) 180f else 0f; alpha = (cp?.opacity ?: 1.0).toFloat() },
                                    color = railPartColor(cp?.color) ?: labelColor,
                                    fontFamily = railSymbolFamily(0.0), fontSize = cs, lineHeight = cs, maxLines = 1, softWrap = false,
                                    style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false), fontFeatureSettings = "liga"))
                            }
                        }
                    }
                }
            }
            Box(Modifier.clearAndSetSemantics { }.graphicsLayer { alpha = wrapperOpacity.toFloat() }, contentAlignment = Alignment.Center) {
                val bt = child.badge
                if (!bt.isNullOrEmpty()) Text(bt, style = TextStyle(color = pal.onBadge, fontFamily = AccordionRoboto, fontWeight = FontWeight(500), fontSize = with(LocalDensity.current) { 11.dp.toSp() },
                    lineHeight = with(LocalDensity.current) { 16.dp.toSp() }, platformStyle = PlatformTextStyle(includeFontPadding = false)), maxLines = 1, softWrap = false)
            }
            Box(Modifier.clearAndSetSemantics { }.graphicsLayer { alpha = (f?.outgoing?.second ?: 0.0).toFloat() }.clipToBounds(), contentAlignment = Alignment.CenterStart) {
                f?.outgoing?.let { (o, _) -> Text(child.label, Modifier.wrapContentSize(unbounded = true), style = TextStyle(color = labelColor, fontFamily = AccordionRoboto,
                    fontWeight = FontWeight(o.weight.roundToInt().coerceIn(1, 1000)), fontSize = with(LocalDensity.current) { o.size.dp.toSp() },
                    letterSpacing = with(LocalDensity.current) { o.tracking.dp.toSp() }, platformStyle = PlatformTextStyle(includeFontPadding = false)), maxLines = 1, softWrap = false) }
            }
        }) { ms, cs ->
            @Suppress("UNUSED_VARIABLE") val tick = state.frame
            val g = state.placed[child]
            fun px(v: Double) = (v * density).roundToInt()
            fun fix(r: RailRect?) = if (r == null) Constraints.fixed(0, 0) else Constraints.fixed(px(r.w).coerceAtLeast(0), px(r.h).coerceAtLeast(0))
            val rects = listOf(g?.icon, g?.label, g?.badge, g?.outgoing?.first?.rect).map { r -> g?.let { gg -> r?.offset(-gg.tab.x, -gg.tab.y) } }
            val pls = ms.mapIndexed { k, mm -> mm.measure(fix(rects.getOrNull(k))) }
            layout(cs.maxWidth, cs.maxHeight) { pls.forEachIndexed { k, pl -> rects.getOrNull(k)?.let { r -> pl.place(px(r.x), px(r.y)) } } }
        }
        // The submenu (md-menu in the `submenu` slot): its items report themselves through the probe (nothing renders); the
        // authored selection is adopted once; the destination presents the menu below itself while open.
        Layout(content = { CompositionLocalProvider(LocalAWCRailSubmenuProbe provides child.submenu) { slot?.invoke("submenu") } }, modifier = Modifier.size(0.dp)) { ms, _ ->
            val has = ms.isNotEmpty() || child.submenu.items.isNotEmpty(); if (child.hasMenu != has) child.hasMenu = has
            layout(0, 0) {}
        }
        val menuItems = child.submenu.items.toSortedMap()
        if (!child.submenu.adopted && menuItems.isNotEmpty()) SideEffect {
            if (!child.submenu.adopted) { child.submenu.adopted = true
                menuItems.entries.firstOrNull { it.value.selected }?.let { (j, _) -> if (state.submenuSelection[child.id] == null) { state.submenuSelection[child.id] = j; state.version++ } } }
        }
        if (child.menuOpen) DropdownMenu(expanded = true, onDismissRequest = { child.menuOpen = false; emit("mdSubmenuToggle", mapOf("open" to false)) }) {
            menuItems.forEach { (j, item) ->
                DropdownMenuItem(text = { Text(item.title) }, enabled = item.enabled, onClick = { ctx.pickSubmenu(child, j) },
                    trailingIcon = if (state.submenuSelection[child.id] == j) ({ Text("\u2713") }) else null)
            }
        }
    }
    val probe = ctx.probe
    if (probe != null && f != null) SideEffect {
        val id = child.id.ifEmpty { "tab$index" }
        probe.tabs[id] = mapOf("index" to index, "active" to st.active, "disabled" to st.disabled, "ariaDisabled" to st.ariaDisabled, "tabStop" to st.tabStop,
            "overflowed" to st.overflowed, "focused" to child.focused, "focusVisible" to st.focusVisible, "hover" to st.hover, "pressed" to st.pressed,
            "childSelected" to st.childSelected, "role" to if (child.isLink) "link" else "tab", "color" to host, "iconColor" to iconColor, "labelColor" to labelColor,
            "indicatorColor" to indicator, "layerOpacity" to layer, "layerColor" to layerColor, "fill" to fill, "weight" to weight, "name" to name,
            "expanded" to ctx.expanded, "renderTime" to now, "animating" to mo.running(now), "haspopup" to child.hasMenu,
            "labelOpacity" to (if (f.label == null) 0.0 else tp[AWCNavigationRailTabPart.Label]?.opacity ?: f.labelOpacity),
            "waveOpacity" to (child.ripple.wave?.opacity ?: 0.0), "labelSize" to f.labelSize, "labelLine" to f.labelLine, "labelTracking" to f.labelTracking, "glyphSize" to tm.glyphSize,
            "iconWrapperColor" to railPartColor(tp[AWCNavigationRailTabPart.IconWrapper]?.backgroundColor),
            "badge" to child.badge, "badgeColor" to pal.badge, "badgeTextColor" to pal.onBadge,
            "radius" to if (ctx.horizontal) tm.radius(f.iconWrapper) else tm.indicatorRadius(f.indicator),
            "rects" to mapOf("tab" to f.tab, "indicator" to f.indicator, "iconWrapper" to f.iconWrapper, "icon" to f.icon, "label" to f.label, "caret" to f.caret, "badge" to f.badge)
                .mapValues { (_, r) -> r?.list() })
    }
}
/** The overflow trigger: one more destination (icon over label) opening a menu of the overflowed destinations. */
@Composable
private fun RailOverflowTrigger(ctx: RailContext, label: String, icon: String, m: RailMetrics) {
    val state = ctx.state
    var focused by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize()  // fills the overflow slot (a bare Box wrapped its content at the slot's start: icon and label were not centred, nor the focus ring the trigger)
        .drawWithContent { drawContent(); if (focused) { val w = 3 * density; drawRoundRect(ctx.palette.overflowRing, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), CornerRadius(8 * density), style = Stroke(w)) } }
        .onFocusChanged { focused = it.isFocused }
        .focusable()
        .onPreviewKeyEvent { e -> if (e.type == KeyEventType.KeyDown && (e.key == Key.Enter || e.key == Key.Spacebar)) { state.overflowOpen = true; true } else false }
        .pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(); if (e.type == PointerEventType.Release) state.overflowOpen = true } } }
        .semantics(mergeDescendants = true) { role = Role.Button; contentDescription = label; onClick(label) { state.overflowOpen = true; true } }, contentAlignment = Alignment.Center) {
        Column(Modifier.offset(y = (-2).dp), horizontalAlignment = Alignment.CenterHorizontally) {  // -2 dp: ink of glyph and label on Chrome 153's rows (measured, S914-01)
            val fs = with(LocalDensity.current) { m.overflowIcon.dp.toSp() }
            val ink = railPartColor(ctx.railParts[AWCNavigationRailPart.OverflowTrigger]?.color) ?: ctx.palette.content
            Text(icon, color = ink, fontFamily = railSymbolFamily(0.0), fontSize = fs, lineHeight = fs, maxLines = 1, softWrap = false,
                style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false), fontFeatureSettings = "liga"))
            if (ctx.visibility != "none") Text(label, color = ink, fontFamily = AccordionRoboto, fontWeight = FontWeight(500),
                fontSize = with(LocalDensity.current) { 12.dp.toSp() }, letterSpacing = with(LocalDensity.current) { 0.5.dp.toSp() }, maxLines = 1, softWrap = false,
                lineHeight = with(LocalDensity.current) { 16.dp.toSp() }, style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false)),
                modifier = Modifier.padding(top = 2.dp))  // measured against Chrome 153 (S914-01): glyph and label ink 11 px apart = 24 icon, 2 gap, 16 label line, centred in the trigger
        }
        DropdownMenu(expanded = state.overflowOpen, onDismissRequest = { state.overflowOpen = false }) {
            state.order.forEachIndexed { i, c -> if (i in ctx.overflowed) DropdownMenuItem(text = { Text(c.label) }, enabled = !c.disabled,
                onClick = { state.overflowOpen = false; ctx.click(c) }) }
        }
    }
}
