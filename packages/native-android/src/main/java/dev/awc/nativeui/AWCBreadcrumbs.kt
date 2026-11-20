@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.absolutePadding
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
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
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextMotion
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

// MARK: hooks, controller, probe

/**
 * The twelve public hooks of md-breadcrumbs (`--md-breadcrumbs-*`) and md-breadcrumb-item (`--md-breadcrumb-item-*`).
 * Lengths are dp, the stagger milliseconds, colours `#RRGGBB(AA)`; [itemPadding] is the CSS padding shorthand (one to four
 * values). Unset hooks keep the density-derived defaults of the source; nearer scopes win.
 */
data class AWCBreadcrumbsAppearance(
    val gap: Double? = null, val separatorColor: String? = null, val textColor: String? = null, val stagger: Double? = null,
    val linkColor: String? = null, val currentColor: String? = null, val currentBackground: String? = null, val disabledColor: String? = null,
    val hoverColor: String? = null, val stateLayerColor: String? = null, val itemGap: Double? = null, val itemPadding: List<Double>? = null,
) {
    fun merging(o: AWCBreadcrumbsAppearance) = AWCBreadcrumbsAppearance(o.gap ?: gap, o.separatorColor ?: separatorColor, o.textColor ?: textColor,
        o.stagger ?: stagger, o.linkColor ?: linkColor, o.currentColor ?: currentColor, o.currentBackground ?: currentBackground,
        o.disabledColor ?: disabledColor, o.hoverColor ?: hoverColor, o.stateLayerColor ?: stateLayerColor, o.itemGap ?: itemGap, o.itemPadding ?: itemPadding)
    /** Invalid values (non-finite or negative lengths, other colour syntax, 0 or more than 4 padding values) are unset. */
    fun normalized(): AWCBreadcrumbsAppearance {
        fun len(v: Double?) = v?.takeIf { it.isFinite() && it >= 0 }
        fun col(v: String?) = v?.takeIf { awcRippleHex(it) != null }
        return AWCBreadcrumbsAppearance(len(gap), col(separatorColor), col(textColor), len(stagger), col(linkColor), col(currentColor), col(currentBackground),
            col(disabledColor), col(hoverColor), col(stateLayerColor), len(itemGap), itemPadding?.takeIf { p -> p.size in 1..4 && p.all { it.isFinite() && it >= 0 } })
    }
    /** (top, right, bottom, left) of the padding shorthand. */
    internal val padding: List<Double>? get() = itemPadding?.let { p -> when (p.size) { 1 -> List(4) { p[0] }; 2 -> listOf(p[0], p[1], p[0], p[1]); 3 -> listOf(p[0], p[1], p[2], p[1]); else -> p.take(4) } }
    companion object {
        /** Laboratory/source names; `itemPadding` is a number list or one number. */
        fun fromValues(values: Map<String, Any?>): AWCBreadcrumbsAppearance {
            fun n(k: String) = (values[k] as? Number)?.toDouble()
            fun s(k: String) = values[k] as? String
            val raw = values["itemPadding"]
            val pad = when (raw) { is Number -> listOf(raw.toDouble()); is List<*> -> raw.mapNotNull { (it as? Number)?.toDouble() }.takeIf { it.isNotEmpty() }
                is Map<*, *> -> listOf("top", "right", "bottom", "left").mapNotNull { (raw[it] as? Number)?.toDouble() }.takeIf { it.size == 4 }; else -> null }
            return AWCBreadcrumbsAppearance(n("gap"), s("separatorColor"), s("textColor"), n("stagger"), s("linkColor"), s("currentColor"), s("currentBackground"),
                s("disabledColor"), s("hoverColor"), s("stateLayerColor"), n("itemGap"), pad).normalized()
        }
        /** The source custom properties (`--md-breadcrumbs-gap: 14px`, `--md-breadcrumb-item-padding: 4px 20px`, …). */
        fun cssValues(css: Map<String, String>): AWCBreadcrumbsAppearance {
            fun num(v: String?) = v?.trim()?.removeSuffix("px")?.removeSuffix("ms")?.toDoubleOrNull()
            fun c(k: String) = css[k]
            return AWCBreadcrumbsAppearance(num(c("--md-breadcrumbs-gap")), c("--md-breadcrumbs-separator-color"), c("--md-breadcrumbs-text-color"), num(c("--md-breadcrumbs-stagger")),
                c("--md-breadcrumb-item-link-color"), c("--md-breadcrumb-item-current-color"), c("--md-breadcrumb-item-current-bg"), c("--md-breadcrumb-item-disabled-color"),
                c("--md-breadcrumb-item-hover-color"), c("--md-breadcrumb-item-state-layer-color"), num(c("--md-breadcrumb-item-gap")),
                c("--md-breadcrumb-item-padding")?.trim()?.split(Regex("\\s+"))?.mapNotNull { num(it) }).normalized()
        }
    }
}
internal val LocalAWCBreadcrumbsAppearance = staticCompositionLocalOf { AWCBreadcrumbsAppearance() }
internal val LocalAWCBreadcrumbsController = staticCompositionLocalOf<AWCBreadcrumbsController?> { null }
/** Overrides the system animator setting for trails (null follows the system). */
val LocalAWCBreadcrumbsReducedMotion = staticCompositionLocalOf<Boolean?> { null }
/** Applies md-breadcrumbs / md-breadcrumb-item hook values to descendant trails (nearer values win). */
@Composable
fun AWCBreadcrumbsAppearanceScope(appearance: AWCBreadcrumbsAppearance, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCBreadcrumbsAppearance provides LocalAWCBreadcrumbsAppearance.current.merging(appearance.normalized()), content = content)
}
/**
 * `::part()` styling of md-breadcrumb-item: separator (color, font-size), icon / label (color), link (color,
 * `text-decoration: underline`), static (color, background-color, border width and colour) and state-layer (background-color,
 * opacity). Part rules come from the outer tree, so they win over the hooks and every internal state rule: a link colour holds on
 * hover, a static colour / background replaces the current-page and disabled ones, and a state-layer opacity shows in every state
 * (links only: a static crumb has no state layer), as in Chrome. The underline is drawn in the link colour (the decorating box's
 * `currentColor`) at the font's underline position under the label and an icon-font glyph. Colours `#RRGGBB(AA)`, lengths in dp;
 * a border without a colour uses the crumb's colour.
 */
@Immutable data class AWCBreadcrumbItemPartAppearance(
    val separatorColor: String? = null, val separatorFontSize: Double? = null, val iconColor: String? = null, val labelColor: String? = null,
    val linkColor: String? = null, val linkUnderline: Boolean? = null, val staticColor: String? = null, val staticBackground: String? = null,
    val staticBorderWidth: Double? = null, val staticBorderColor: String? = null, val stateLayerColor: String? = null, val stateLayerOpacity: Double? = null,
) {
    fun merging(o: AWCBreadcrumbItemPartAppearance) = AWCBreadcrumbItemPartAppearance(o.separatorColor ?: separatorColor, o.separatorFontSize ?: separatorFontSize,
        o.iconColor ?: iconColor, o.labelColor ?: labelColor, o.linkColor ?: linkColor, o.linkUnderline ?: linkUnderline, o.staticColor ?: staticColor,
        o.staticBackground ?: staticBackground, o.staticBorderWidth ?: staticBorderWidth, o.staticBorderColor ?: staticBorderColor, o.stateLayerColor ?: stateLayerColor,
        o.stateLayerOpacity ?: stateLayerOpacity)
    internal val separator get() = awcRippleHex(separatorColor)
    internal val separatorSize get() = separatorFontSize?.takeIf { it.isFinite() && it > 0 }
    internal val icon get() = awcRippleHex(iconColor)
    internal val label get() = awcRippleHex(labelColor)
    internal val link get() = awcRippleHex(linkColor)
    internal val static get() = awcRippleHex(staticColor)
    internal val staticBg get() = awcRippleHex(staticBackground)
    internal val border get() = staticBorderWidth?.takeIf { it.isFinite() && it >= 0 } ?: 0.0
    internal val borderInk get() = awcRippleHex(staticBorderColor)
    internal val layerColor get() = awcRippleHex(stateLayerColor)
    internal val layerOpacity get() = stateLayerOpacity?.takeIf { it.isFinite() }?.coerceIn(0.0, 1.0)
    companion object {
        /** Laboratory names (the fields above). */
        fun fromValues(v: Map<String, Any?>): AWCBreadcrumbItemPartAppearance {
            fun n(k: String) = (v[k] as? Number)?.toDouble()
            fun s(k: String) = v[k] as? String
            return AWCBreadcrumbItemPartAppearance(s("separatorColor"), n("separatorFontSize"), s("iconColor"), s("labelColor"), s("linkColor"), v["linkUnderline"] as? Boolean,
                s("staticColor"), s("staticBackground"), n("staticBorderWidth"), s("staticBorderColor"), s("stateLayerColor"), n("stateLayerOpacity"))
        }
    }
}
/**
 * `::part()` styling of md-breadcrumbs: list (background-color and the CSS padding shorthand, physical edges), separator (the
 * overflow item's separator: color, font-size) and overflow-button (background-color in every state, replacing the hover / focus
 * tint, and the colour of its dots) and overflow (the overflow item's box: background, border, radius and padding with the layout
 * shift, [AWCPartBox]; gate-7 R6-17).
 */
@Immutable data class AWCBreadcrumbsPartAppearance(
    val listBackground: String? = null, val listPadding: List<Double>? = null, val separatorColor: String? = null, val separatorFontSize: Double? = null,
    val overflowButtonBackground: String? = null, val overflowButtonColor: String? = null, val overflow: AWCPartBox? = null,
) {
    fun merging(o: AWCBreadcrumbsPartAppearance) = AWCBreadcrumbsPartAppearance(o.listBackground ?: listBackground, o.listPadding ?: listPadding,
        o.separatorColor ?: separatorColor, o.separatorFontSize ?: separatorFontSize, o.overflowButtonBackground ?: overflowButtonBackground, o.overflowButtonColor ?: overflowButtonColor,
        AWCPartBox.merge(overflow, o.overflow))
    internal val listBg get() = awcRippleHex(listBackground)
    /** The list padding shorthand → physical (top, right, bottom, left). */
    internal val listInsets: List<Double> get() {
        val p = listPadding?.takeIf { it.size in 1..4 && it.all { v -> v.isFinite() && v >= 0 } } ?: return listOf(0.0, 0.0, 0.0, 0.0)
        return when (p.size) { 1 -> listOf(p[0], p[0], p[0], p[0]); 2 -> listOf(p[0], p[1], p[0], p[1]); 3 -> listOf(p[0], p[1], p[2], p[1]); else -> p }
    }
    internal val separator get() = awcRippleHex(separatorColor)
    internal val separatorSize get() = separatorFontSize?.takeIf { it.isFinite() && it > 0 }
    internal val buttonBg get() = awcRippleHex(overflowButtonBackground)
    internal val buttonInk get() = awcRippleHex(overflowButtonColor)
    companion object {
        /** Laboratory names; `listPadding` as one number or a list of one to four numbers, `overflow` as an [AWCPartBox] map. */
        fun fromValues(v: Map<String, Any?>): AWCBreadcrumbsPartAppearance {
            val pad = when (val p = v["listPadding"]) { is Number -> listOf(p.toDouble()); is List<*> -> p.mapNotNull { (it as? Number)?.toDouble() }.takeIf { it.isNotEmpty() }; else -> null }
            return AWCBreadcrumbsPartAppearance(v["listBackground"] as? String, pad, v["separatorColor"] as? String, (v["separatorFontSize"] as? Number)?.toDouble(),
                v["overflowButtonBackground"] as? String, v["overflowButtonColor"] as? String, AWCPartBox.fromValue(v["overflow"]))
        }
    }
}
internal val LocalAWCBreadcrumbItemPartAppearance = staticCompositionLocalOf { AWCBreadcrumbItemPartAppearance() }
internal val LocalAWCBreadcrumbsPartAppearance = staticCompositionLocalOf { AWCBreadcrumbsPartAppearance() }
/** Applies md-breadcrumb-item `::part()` styling to descendant crumbs. */
@Composable
fun AWCBreadcrumbItemPartAppearanceScope(appearance: AWCBreadcrumbItemPartAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCBreadcrumbItemPartAppearance provides LocalAWCBreadcrumbItemPartAppearance.current.merging(appearance), content = content)
/** Applies md-breadcrumbs `::part()` styling to descendant trails. */
@Composable
fun AWCBreadcrumbsPartAppearanceScope(appearance: AWCBreadcrumbsPartAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCBreadcrumbsPartAppearance provides LocalAWCBreadcrumbsPartAppearance.current.merging(appearance), content = content)

/** md-breadcrumbs' methods: expand() and collapse() set the trail state and emit mdExpand (even with maxItems 0, as the source). */
class AWCBreadcrumbsController {
    internal var setExpanded: ((Boolean) -> Unit)? = null
    val isConnected: Boolean get() = setExpanded != null
    fun expand() { setExpanded?.invoke(true) }
    fun collapse() { setExpanded?.invoke(false) }
}
/** Binds expand() / collapse() to the trails below. */
@Composable
fun AWCBreadcrumbsControllerScope(controller: AWCBreadcrumbsController, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCBreadcrumbsController provides controller, content = content)
}
/**
 * Rendered trail state for tests and the Laboratory inspector, keyed by the crumb's `id` property (else its label).
 * Times are frame-clock milliseconds; colours are [r, g, b, a]; bounds are dp in root coordinates.
 */
class AWCBreadcrumbsProbe {
    val crumbs: MutableMap<String, Map<String, Any?>> = java.util.concurrent.ConcurrentHashMap()
    @Volatile var toggle: Map<String, Any?>? = null
    @Volatile var trail: Map<String, Any?> = emptyMap()
    @Volatile var density = 1.0
    /** Live dp bounds [x, y, width, height] in root coordinates (current transforms included) of a `coords` entry. */
    fun bounds(entry: Any?): List<Double>? {
        val c = entry as? androidx.compose.ui.layout.LayoutCoordinates ?: return null
        if (!c.isAttached) return null
        val r = c.positionInRoot(); return listOf(r.x / density, r.y / density, c.size.width / density, c.size.height / density)
    }
}
val LocalAWCBreadcrumbsProbe = staticCompositionLocalOf<AWCBreadcrumbsProbe?> { null }

/** Density rungs set on this element and its ancestors, nearest first (md3.css defines some spacing tokens on some rungs only). */
internal val LocalAWCDensityRungs = staticCompositionLocalOf<List<Double>> { emptyList() }
@Composable internal fun awcDensityRungs(value: AWCValue?): List<Double> =
    listOfNotNull((value as? Number)?.toDouble()?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) }) + LocalAWCDensityRungs.current

// MARK: model

/** Density-derived metrics of the source stylesheets (d ≤ 0). */
internal class BreadcrumbMetrics(val d: Double, rungs: List<Double>) {
    private val set = rungs.ifEmpty { listOf(d) }
    val listGap get() = 8 + 2 * d
    /** `--md-sys-spacing-gap-sm` / `-gap-xs` of the density ladder. */
    val hostGap get() = if (set.any { it <= -3 }) 4.0 else 8.0
    val toggleGap get() = if (set.any { it <= -4 }) 2.0 else 4.0
    val fontSize get() = max(12.0, 14 + .5 * d)
    val lineHeight get() = max(16.0, 20 + d)
    val separatorSize get() = max(13.0, 16 + .5 * d)
    val paddingBlock get() = 8 + 2 * d
    val paddingInline get() = max(4.0, 12 + 2 * d)
    val iconGap get() = 6 + d
    val glyphSize get() = max(14.0, 18 + d)
}
internal class BreadcrumbPalette(private val tokens: Map<String, String>, a: AWCBreadcrumbsAppearance) {
    private fun t(k: String, d: Long) = awcRippleHex(tokens["--md-sys-color-$k"]) ?: Color(d)
    private fun h(v: String?) = v?.let { awcRippleHex(it) }
    val separator = h(a.separatorColor) ?: t("on-surface-variant", 0xFF49454F)
    val link = h(a.linkColor ?: a.textColor) ?: t("on-surface-variant", 0xFF49454F)
    /** The trail's text colour (`--md-breadcrumbs-text-color`): the `currentColor` of the overflow item. */
    val text = h(a.textColor) ?: t("on-surface-variant", 0xFF49454F)
    val current = h(a.currentColor) ?: t("on-secondary-container", 0xFF1D192B)
    val currentBackground = h(a.currentBackground) ?: t("secondary-container", 0xFFE8DEF8)
    val disabled = h(a.disabledColor) ?: t("on-surface", 0xFF1C1B1F).copy(alpha = .61f)
    val hover = h(a.hoverColor) ?: t("primary", 0xFF6750A4)
    val stateLayer = h(a.stateLayerColor) ?: t("on-surface", 0xFF1C1B1F)
    val focusRing = t("secondary", 0xFF625B71)
    val toggle = t("on-surface-variant", 0xFF49454F)
}
/** One md-breadcrumb-item of a trail: its published properties and the values the trail assigns (authored order). */
internal class BreadcrumbChild {
    var props by mutableStateOf<Props>(emptyMap())
    var index by mutableIntStateOf(-1)
    var total by mutableIntStateOf(0)
    var current by mutableStateOf(false)
    var collapsed by mutableStateOf(false)
    val label = AWCSlotTextRegistry()
    val focus = FocusRequester()
    val isLink get() = !current && props.str("href").isNotEmpty() && !props.bool("disabled")
}
internal class BreadcrumbsTrail {
    var expanded by mutableStateOf(false)
    var showToggle by mutableStateOf(false)
    var before by mutableIntStateOf(1)
    var order: List<BreadcrumbChild> = emptyList()
    val toggleFocus = FocusRequester()
    /** The crumb to focus once revealed, and whether the request came from the keyboard (focus ring). */
    var pendingFocus by mutableStateOf<Pair<BreadcrumbChild, Boolean>?>(null)
}
internal class BreadcrumbsContext(val trail: BreadcrumbsTrail, val separator: String, val palette: BreadcrumbPalette, val appearance: AWCBreadcrumbsAppearance,
                                  val reduced: Boolean, val rtl: Boolean)
internal val LocalBreadcrumbsTrail = staticCompositionLocalOf<BreadcrumbsContext?> { null }
internal val LocalBreadcrumbChild = staticCompositionLocalOf<BreadcrumbChild?> { null }
private object BreadcrumbToggleID
/** Text overflow of AWCSlotText labels (breadcrumb labels truncate with an ellipsis). */
internal val LocalAWCSlotTextOverflow = staticCompositionLocalOf { TextOverflow.Clip }

// MARK: motion

private val STANDARD = listOf(.34, .8, .34, 1.0)
private val NUDGE = listOf(.42, 1.67, .21, .9)
/**
 * The source's CSS transitions and staggered entrance on the composition frame clock: colour / state layer / toggle
 * background and press scale 200 ms cubic-bezier(0.34, 0.8, 0.34, 1), the hover nudge 350 ms cubic-bezier(0.42, 1.67,
 * 0.21, 0.9); the entrance fades in and slides 8 dp from the inline start over 500 ms cubic-bezier(0.38, 1.21, 0.22, 1)
 * after stagger × min(index, 11). Reduced motion: instant transitions, no entrance, nudge or press scale.
 */
internal class BreadcrumbMotion {
    var frame by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    val ink = AWCCSSValueTrack(Color.Transparent, accordionColorLerp)
    val layer = AWCCSSValueTrack(0.0, accordionLerp)
    val nudge = AWCCSSValueTrack(0.0, accordionLerp)
    val scale = AWCCSSValueTrack(1.0, accordionLerp)
    var pending: List<Any>? = null
    var primed = false
    var entranceStart: Double? = null
    var entranceEnd = 0.0
    var reduced = false
    var entrance = false
    var delay = 0.0
    var kind: String? = null
    fun running(now: Double) = pending != null || entranceStart == null || now < entranceEnd || ink.isRunning(now) || layer.isRunning(now) || nudge.isRunning(now) || scale.isRunning(now)
    /** [fromFrame]: called on a frame of the composition clock (the entrance starts on the first frame that renders it). */
    fun apply(now: Double, fromFrame: Boolean = true) {
        if (entranceStart == null && fromFrame) { entranceStart = if (entrance && !reduced) now else Double.NEGATIVE_INFINITY; if (entrance && !reduced) entranceEnd = now + delay + 500 }
        val p = pending ?: return; pending = null
        val c = p[0] as Color; val l = p[1] as Double; val n = p[2] as Double; val s = p[3] as Double
        if (!primed) { ink.snap(c); layer.snap(l); nudge.snap(n); scale.snap(s); primed = true; return }
        val k = if (reduced) 0.0 else 1.0
        ink.set(c, now, 200 * k, STANDARD); layer.set(l, now, 200 * k, STANDARD); nudge.set(n, now, 350 * k, NUDGE); scale.set(s, now, 200 * k, STANDARD)
    }
    /** (opacity, physical x offset dp) of the entrance at [now]. */
    fun entranceAt(now: Double, rtl: Boolean): Pair<Double, Double> {
        val s = entranceStart ?: return if (entrance && !reduced) 0.0 to (if (rtl) 8.0 else -8.0) else 1.0 to 0.0
        if (!s.isFinite()) return 1.0 to 0.0
        val e = now - s - delay
        val p = if (e <= 0) 0.0 else if (e >= 500) 1.0 else accordionCubicBezier(e / 500, listOf(.38, 1.21, .22, 1.0))
        return p.coerceIn(0.0, 1.0) to (if (rtl) 8.0 else -8.0) * (1 - p)
    }
}
@Composable
private fun rememberBreadcrumbMotion(targets: List<Any>, reduced: Boolean, entrance: Boolean, delay: Double, kind: String = ""): BreadcrumbMotion {
    val m = remember { BreadcrumbMotion() }
    m.reduced = reduced; m.entrance = entrance; m.delay = delay
    // The source swaps the surface element (<a> / <span>) when a crumb becomes or stops being a link: no transition. Applied while
    // composing, before the caller reads the tracks, so this composition already presents the new values (gate-7 R6-22: snapped in
    // the SideEffect, after the read, nothing recomposed the crumb and its label kept the old ink until a later recomposition).
    if (m.kind != null && m.kind != kind && m.primed) { m.ink.snap(targets[0] as Color); m.layer.snap(targets[1] as Double); m.nudge.snap(targets[2] as Double); m.scale.snap(targets[3] as Double); m.pending = null }
    m.kind = kind
    SideEffect {
        if (!m.primed || m.pending != null || targets != listOf(m.ink.value, m.layer.value, m.nudge.value, m.scale.value)) {
        if (m.pending != targets) { m.pending = targets; m.version++ }
        if (!m.primed) m.apply(m.frame, fromFrame = false) } }
    LaunchedEffect(m) {
        while (isActive) {
            withFrameNanos { t -> val ms = t / 1e6; m.apply(ms); m.frame = ms }
            if (!m.running(m.frame)) { val v = m.version; snapshotFlow { m.version }.first { it != v } }
        }
    }
    return m
}

// MARK: text

private val BreadcrumbSymbols = HashMap<Pair<Int, Int>, FontFamily>()
private fun breadcrumbSymbolFamily(fill: Int, weight: Int) = BreadcrumbSymbols.getOrPut(fill to weight) {
    FontFamily(Font(R.font.awc_material_symbols, FontWeight(weight), variationSettings = FontVariation.Settings(
        FontVariation.Setting("FILL", fill.toFloat()), FontVariation.weight(weight), FontVariation.Setting("opsz", 24f), FontVariation.grade(0))))
}
private fun breadcrumbText(size: Double, lineHeight: Double?, weight: Int, tracking: Double, color: Color) = TextStyle(color = color, fontFamily = AccordionRoboto,
    fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (lineHeight ?: size).sp, letterSpacing = tracking.sp,
    platformStyle = PlatformTextStyle(includeFontPadding = false), lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None),
    textMotion = TextMotion.Animated)
/** Exact (subpixel, unhinted) advance of a single-line text run in px, as Chrome lays it out (letter spacing in em). */
private fun breadcrumbAdvance(context: android.content.Context, text: String, sizePx: Float, weight: Int, spacingEm: Float, rtl: Boolean): Float {
    if (text.isEmpty()) return 0f
    val paint = android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG).apply {
        typeface = context.resources.getFont(when { weight >= 600 -> R.font.awc_roboto_bold; weight >= 500 -> R.font.awc_roboto_medium; else -> R.font.awc_roboto_regular })
        textSize = sizePx; letterSpacing = spacingEm; isLinearText = true
    }
    val bidi = java.text.Bidi(text, if (rtl) java.text.Bidi.DIRECTION_RIGHT_TO_LEFT else java.text.Bidi.DIRECTION_LEFT_TO_RIGHT)
    var width = 0f
    for (i in 0 until bidi.runCount) { val a = bidi.getRunStart(i); val b = bidi.getRunLimit(i); width += paint.getRunAdvance(text, a, b, a, b, bidi.getRunLevel(i) % 2 == 1, b) }
    return width
}
private fun rgba(c: Color) = listOf(c.red.toDouble(), c.green.toDouble(), c.blue.toDouble(), c.alpha.toDouble())
/**
 * `text-decoration: underline` propagated from the link: a line in the decorating box's colour [color] (not the text's), at the
 * font's underline position and thickness below the content's first baseline, snapped to device pixels as Chrome draws it; [out] receives the drawn row (px below the element's top) for the probe.
 */
private fun Modifier.breadcrumbUnderline(active: Boolean, color: Color, font: Int, sizeDp: Double, out: IntArray? = null): Modifier = if (!active) this else composed {
    val density = LocalDensity.current.density; val context = androidx.compose.ui.platform.LocalContext.current
    val metrics = remember(font, sizeDp, density) { android.graphics.Paint().run { typeface = context.resources.getFont(font); textSize = (sizeDp * density).toFloat()
        if (android.os.Build.VERSION.SDK_INT >= 29) underlinePosition to underlineThickness else textSize * .1f to textSize / 14f } }
    val baseline = remember { IntArray(1) { Int.MIN_VALUE } }
    this.layout { m, c -> val pl = m.measure(c); baseline[0] = pl[androidx.compose.ui.layout.FirstBaseline]; layout(pl.width, pl.height) { pl.placeRelative(0, 0) } }
        .drawWithContent { drawContent(); val b = baseline[0]; if (b == androidx.compose.ui.layout.AlignmentLine.Unspecified || b == Int.MIN_VALUE) return@drawWithContent
            val t = max(1f, metrics.second.roundToInt().toFloat()); val y = (b + metrics.first).roundToInt(); out?.set(0, y); drawRect(color, Offset(0f, y.toFloat()), Size(size.width, t)) }
}

// MARK: trail

/**
 * md-breadcrumbs: a navigation landmark holding the wrapping list (`flex-wrap: wrap; align-items: center; gap: 0 <gap>`)
 * of its md-breadcrumb-item children, the separators and the overflow toggle. The trail computes the source model in its
 * layout pass from the authored order: item index/total, the current crumb (the last unless an author marks another), and
 * the collapse window (`maxItems > 0 && count > maxItems && !expanded`, before ≥ 0, after ≥ 1).
 */
@Composable
internal fun NativeBreadcrumbs(p: Props, emit: EventSink, slot: Slot?) {
    if (p.bool("hidden")) return
    val trail = remember { BreadcrumbsTrail() }
    val appearance = LocalAWCBreadcrumbsAppearance.current
    val tokens = LocalAWCThemeTokens.current
    val palette = remember(tokens, appearance) { BreadcrumbPalette(tokens, appearance) }
    val d = LocalAWCNativeDensity.current
    val m = BreadcrumbMetrics(d, LocalAWCDensityRungs.current)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val reduced = LocalAWCBreadcrumbsReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val separator = p.str("separator", "/"); val label = p.str("label", "Breadcrumb"); val expandLabel = p.str("expandLabel", "Show full breadcrumb trail")
    val action = LocalAWCAction.current; val actionTarget = LocalAWCActionTarget.current
    val emitNow by rememberUpdatedState(emit)
    val probe = LocalAWCBreadcrumbsProbe.current
    val density = LocalDensity.current.density
    fun setExpanded(next: Boolean) {
        if (trail.expanded == next) return
        trail.expanded = next
        val detail = mapOf<String, AWCValue>("expanded" to next, "itemCount" to trail.order.size)
        val event = AWCActionEvent("mdExpand", "md-breadcrumbs", detail)   // cancelable like the source event, and ignored
        dispatchNativeAction(event, action, actionTarget?.listeners?.invoke().orEmpty())
        emitNow("mdExpand", detail)
    }
    val controller = LocalAWCBreadcrumbsController.current
    SideEffect { controller?.setExpanded = { setExpanded(it) } }
    fun expandFromToggle(keyboard: Boolean) {
        val order = trail.order
        val first = order.indexOfFirst { it.collapsed }
        setExpanded(true)
        if (first >= 0) order.drop(first).firstOrNull { it.props.str("href").isNotEmpty() && !it.props.bool("disabled") && !it.current }?.let { trail.pendingFocus = it to keyboard }
    }
    val gap = appearance.gap ?: m.listGap
    SideEffect { probe?.trail = mapOf("label" to label, "expanded" to trail.expanded, "collapsing" to trail.showToggle, "listGap" to gap, "density" to d, "itemCount" to trail.order.size) }
    val context = BreadcrumbsContext(trail, separator, palette, appearance, reduced, rtl)
    val trailParts = LocalAWCBreadcrumbsPartAppearance.current; val list = trailParts.listInsets
    SideEffect { probe?.trail = probe?.trail.orEmpty() + mapOf("listPadding" to list, "listBackground" to trailParts.listBg?.let { rgba(it) }) }
    CompositionLocalProvider(LocalBreadcrumbsTrail provides context) {
        // Children are placed in display order (leading crumbs, toggle, tail), which is also the keyboard order.
        Layout(content = {
            slot?.invoke("")
            Box(Modifier.layoutId(BreadcrumbToggleID)) { BreadcrumbToggle(context, m, expandLabel, ::expandFromToggle) }
        }, modifier = Modifier.semantics { isTraversalGroup = true; contentDescription = label }
            // ::part(list): the background fills the padded list; the CSS padding shorthand is physical (left stays left in RTL).
            .then(trailParts.listBg?.let { Modifier.drawBehind { drawRect(it) } } ?: Modifier)
            .absolutePadding(left = list[3].dp, top = list[0].dp, right = list[1].dp, bottom = list[2].dp)
        ) { measurables, constraints ->
            val crumbs = measurables.filter { it.layoutId !== BreadcrumbToggleID }; val toggle = measurables.first { it.layoutId === BreadcrumbToggleID }
            val kids = crumbs.map { it.layoutId as? BreadcrumbChild }
            val items = kids.filterNotNull()
            val count = items.size
            val maxItems = p.int("maxItems"); val before = max(0, p.int("itemsBeforeCollapse", 1)); val after = max(1, p.int("itemsAfterCollapse", 2))
            val collapsing = !trail.expanded && maxItems > 0 && count > maxItems
            val manual = items.withIndex().any { (i, c) -> c.props.bool("current") && i != count - 1 }
            items.forEachIndexed { i, c ->
                val cur = if (manual) c.props.bool("current") else i == count - 1
                val col = collapsing && !(i < before || i >= count - after)
                if (c.index != i) c.index = i
                if (c.total != count) c.total = count
                if (c.current != cur) c.current = cur
                if (c.collapsed != col) c.collapsed = col
            }
            trail.order = items
            if (trail.showToggle != collapsing) trail.showToggle = collapsing
            if (trail.before != before) trail.before = before
            val loose = Constraints(maxWidth = constraints.maxWidth)
            val placed = crumbs.map { it.measure(loose) }
            val tp = toggle.measure(loose)
            // Display order: the leading crumbs (index < before), the toggle, then the rest.
            val seq = ArrayList<Placeable>()
            var toggled = false
            placed.forEachIndexed { i, pl -> val idx = kids[i]?.let { items.indexOf(it) } ?: i
                if (!toggled && idx >= before) { seq += tp; toggled = true }
                seq += pl }
            if (!toggled) seq += tp
            val visible = seq.filter { it.width > 0 && it.height > 0 }
            val gapPx = gap * density
            val maxW = if (constraints.hasBoundedWidth) constraints.maxWidth.toDouble() else Double.MAX_VALUE
            val rows = ArrayList<MutableList<Placeable>>(); var used = 0.0
            for (pl in visible) {
                if (rows.isEmpty() || (rows.last().isNotEmpty() && used + gapPx + pl.width > maxW + .5)) { rows += mutableListOf(pl); used = pl.width.toDouble() }
                else { used += gapPx + pl.width; rows.last() += pl }
            }
            val widest = rows.maxOfOrNull { r -> r.sumOf { it.width } + gapPx * (r.size - 1) } ?: 0.0
            val width = if (constraints.hasBoundedWidth) constraints.maxWidth else widest.roundToInt()
            val height = rows.sumOf { r -> r.maxOf { it.height } }
            layout(width.coerceIn(constraints.minWidth, constraints.maxWidth), height.coerceIn(constraints.minHeight, constraints.maxHeight)) {
                var y = 0
                for (r in rows) { val h = r.maxOf { it.height }; var x = 0.0
                    for (pl in r) { pl.placeRelative(x.roundToInt(), y + (h - pl.height) / 2); x += pl.width + gapPx }
                    y += h }
                seq.filter { it.width <= 0 || it.height <= 0 }.forEach { it.placeRelative(0, 0) }
            }
        }
    }
}

/** md-breadcrumb-item. Inside a trail it renders as the trail assigns; alone it is the first crumb of a trail of one. */
@Composable
internal fun NativeBreadcrumbItem(p: Props, emit: EventSink, slot: Slot?, child: BreadcrumbChild?) {
    val context = LocalBreadcrumbsTrail.current
    if (context == null || child == null) {
        val tokens = LocalAWCThemeTokens.current; val appearance = LocalAWCBreadcrumbsAppearance.current
        val standalone = remember { BreadcrumbChild() }
        standalone.props = p; standalone.index = 0; standalone.total = 1; standalone.current = p.bool("current")
        BreadcrumbCrumb(p, emit, slot, standalone, BreadcrumbsContext(remember { BreadcrumbsTrail() }, "/", BreadcrumbPalette(tokens, appearance), appearance,
            LocalAWCBreadcrumbsReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled(), LocalLayoutDirection.current == LayoutDirection.Rtl))
        return
    }
    SideEffect { child.props = p }
    // An expanded trail collapses nothing: reveal in the frame of the change (the layout pass confirms it).
    if (child.index < 0 || (child.collapsed && !context.trail.expanded) || p.bool("hidden")) return
    BreadcrumbCrumb(p, emit, slot, child, context)
}

/**
 * One crumb: the leading separator (index > 0) and its surface — a link (href, not current, not disabled) with hover
 * (hover colour, 2 dp inline nudge, 8 % layer), keyboard focus (12 % layer, 3 dp secondary ring offset 2), press (12 %
 * layer) and the md-ripple wave, or a static span (current page pill: secondary-container, weight 600, FILL 1 icon).
 * Labels truncate at 32 ch with an ellipsis and keep the full accessible name.
 */
@Composable
private fun BreadcrumbCrumb(p: Props, emit: EventSink, slot: Slot?, child: BreadcrumbChild, ctx: BreadcrumbsContext) {
    val index = child.index; val total = child.total; val current = child.current
    val disabled = p.bool("disabled"); val href = p.str("href"); val isLink = !current && href.isNotEmpty() && !disabled
    val d = LocalAWCNativeDensity.current
    val m = BreadcrumbMetrics(d, LocalAWCDensityRungs.current)
    val a = ctx.appearance; val palette = ctx.palette; val rtl = ctx.rtl
    val parts = LocalAWCBreadcrumbItemPartAppearance.current
    var hover by remember { mutableStateOf(false) }; var pressed by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }; var pointerFocus by remember { mutableStateOf(false) }
    val focusVisible = isLink && focused && !pointerFocus
    val hovered = isLink && hover
    // ::part(link) / ::part(static) colour wins over the hover, current and disabled colours; a part opacity shows in every state.
    val ink = (if (isLink) parts.link else parts.static) ?: if (disabled) palette.disabled else if (current) palette.current else if (hovered) palette.hover else palette.link
    val layerTarget = if (!isLink) 0.0 else parts.layerOpacity ?: if (focusVisible || (pressed && hovered)) .12 else if (hovered) .08 else 0.0
    val sepSize = parts.separatorSize ?: m.separatorSize; val sepInk = parts.separator ?: palette.separator
    val underline = isLink && parts.linkUnderline == true; val border = if (isLink) 0.0 else parts.border
    val surfaceBg = if (isLink) null else parts.staticBg ?: if (current) palette.currentBackground else null
    val layerInk = parts.layerColor ?: palette.stateLayer
    val labelRow = remember { IntArray(1) { -1 } }; val iconRow = remember { IntArray(1) { -1 } }
    val nudgeTarget = if (hovered && !ctx.reduced) (if (rtl) -2.0 else 2.0) else 0.0
    val delay = (a.stagger ?: 40.0) * min(index, 11)
    val motion = rememberBreadcrumbMotion(listOf(ink, layerTarget, nudgeTarget, 1.0), ctx.reduced, true, delay, if (isLink) "link" else "static")
    val now = motion.frame
    val primed = motion.primed
    val inkNow = if (primed) motion.ink.presented(now) else ink; val layerNow = if (primed) motion.layer.presented(now) else layerTarget
    val nudgeNow = if (primed) motion.nudge.presented(now) else nudgeTarget
    val weight = if (current) 700 else 500
    val padding = a.padding ?: listOf(m.paddingBlock, m.paddingInline, m.paddingBlock, m.paddingInline)
    val density = LocalDensity.current.density
    val context = androidx.compose.ui.platform.LocalContext.current
    val ch = remember(m.fontSize, weight, density) { breadcrumbAdvance(context, "0", (m.fontSize * density).toFloat(), weight, 0f, false) / density }
    val action = LocalAWCAction.current; val actionTarget = LocalAWCActionTarget.current
    val uri = LocalUriHandler.current
    val router = LocalAWCURLRouter.current ?: remember(uri) { AWCURLRouter { r -> if (!java.net.URI(r.url).isAbsolute) false else runCatching { uri.openUri(r.url); true }.getOrDefault(false) } }
    val actionID = remember { java.util.UUID.randomUUID().toString() }
    val label = awcCollapsedWhitespace(child.label.text)
    val sepPx = remember(ctx.separator, sepSize, density) { breadcrumbAdvance(context, ctx.separator, (sepSize * density).toFloat(), 500, (.1 / sepSize).toFloat(), rtl) }
    val labelPx = remember(label, m.fontSize, weight, ch, density) { if (label.isEmpty()) null else min(breadcrumbAdvance(context, label, (m.fontSize * density).toFloat(), weight, (.1 / m.fontSize).toFloat(), rtl), (32 * ch * density).toFloat()) }
    val emitNow by rememberUpdatedState(emit)
    fun select(source: String) {
        if (!isLink) return
        val detail = mapOf<String, AWCValue>("href" to href, "label" to label, "current" to current, "itemIndex" to index, "itemTotal" to total)
        val event = AWCActionEvent("mdSelect", "md-breadcrumb-item", detail, targetID = actionID, activation = AWCActivationMetadata(source))
        dispatchNativeAction(event, action, actionTarget?.listeners?.invoke().orEmpty())
        emitNow("mdSelect", detail)
        if (!event.defaultPrevented) AWCNavigationRequest.from(href, p.str("target", "_self"))?.let { router.open(it) }
    }
    // A crumb revealed by the toggle takes focus (with the ring when the toggle was used from the keyboard).
    val pending = ctx.trail.pendingFocus
    LaunchedEffect(pending, index) {
        if (pending?.first === child) { pointerFocus = !pending.second; runCatching { child.focus.requestFocus() }; ctx.trail.pendingFocus = null }
    }
    val probe = LocalAWCBreadcrumbsProbe.current
    val key = p.str("id").ifEmpty { label.ifEmpty { "#$index" } }
    val coords = remember { java.util.concurrent.ConcurrentHashMap<String, androidx.compose.ui.layout.LayoutCoordinates>() }
    if (probe != null) probe.density = density.toDouble()
    val (opacity, slide) = motion.entranceAt(now, rtl)
    SideEffect { probe?.crumbs?.set(key, mapOf("index" to index, "total" to total, "current" to current, "disabled" to disabled, "link" to isLink,
        "ink" to rgba(ink), "inkNow" to rgba(inkNow), "layer" to layerTarget, "layerNow" to layerNow, "nudgeNow" to nudgeNow, "opacity" to opacity, "slide" to slide,
        "hover" to hovered, "pressed" to (pressed && isLink), "focusRing" to focusVisible, "focused" to focused, "frame" to now, "entranceStart" to motion.entranceStart,
        "separator" to (if (index > 0) ctx.separator else null), "label" to label, "labelPx" to labelPx, "sepPx" to sepPx, "coords" to coords, "fill" to (if (current) 1 else 0), "density" to d,
        "background" to rgba(surfaceBg ?: Color.Transparent), "iconColor" to rgba(parts.icon ?: ink), "labelColor" to rgba(parts.label ?: ink), "sepColor" to rgba(sepInk),
        "sepSize" to sepSize, "underline" to underline, "border" to border, "borderColor" to rgba(if (border > 0) parts.borderInk ?: ink else Color.Transparent), "layerColor" to rgba(layerInk),
        "underlineLabel" to labelRow, "underlineIcon" to iconRow)) }
    DisposableEffect(probe, key) { onDispose { probe?.crumbs?.remove(key) } }
    val inspection = LocalAWCInspection.current
    Layout(content = {
        if (index > 0) Box(Modifier.height(m.lineHeight.dp).onGloballyPositioned { coords["separator"] = it }.inspectAWCNode(inspection, "separator", "separator").clearAndSetSemantics { hideFromAccessibility() }, contentAlignment = Alignment.Center) {
            Text(ctx.separator, Modifier.exactWidth(sepPx), style = breadcrumbText(sepSize, null, 500, .1, sepInk.copy(alpha = sepInk.alpha * .7f)), maxLines = 1, softWrap = false)
        }
        BreadcrumbSurface(m, a, padding, palette, inkNow, layerNow, nudgeNow, current, isLink, focusVisible, rtl, inspection, onBounds = { coords["surface"] = it },
            background = surfaceBg, layerInk = layerInk, border = border, borderInk = parts.borderInk ?: inkNow,
            modifier = Modifier
                .semantics(mergeDescendants = true) {
                    if (isLink) { role = Role.Button; onClick(label) { select("accessibility"); true } } else if (disabled) disabled()
                    if (current) { selected = true; stateDescription = "current page" }
                    if (label.isNotEmpty()) contentDescription = label
                }
                .focusRequester(child.focus)
                .onFocusChanged { focused = it.isFocused; if (!it.isFocused) pointerFocus = false }
                .then(if (isLink) Modifier.focusable() else Modifier)
                .onKeyEvent { e -> if (isLink && e.type == KeyEventType.KeyDown && (e.key == Key.Enter || e.key == Key.NumPadEnter)) { select("keyboard"); true } else false }
                .pointerInput(isLink) {
                    awaitPointerEventScope {
                        while (true) {
                            val e = awaitPointerEvent(PointerEventPass.Main)
                            val c = e.changes.firstOrNull() ?: continue
                            val inside = c.position.x >= 0 && c.position.y >= 0 && c.position.x < size.width && c.position.y < size.height
                            when (e.type) {
                                PointerEventType.Enter, PointerEventType.Move -> if (c.type == PointerType.Mouse || pressed) hover = isLink && inside
                                PointerEventType.Exit -> hover = false
                                PointerEventType.Press -> if (isLink) { pressed = true; hover = inside || hover; pointerFocus = true; runCatching { child.focus.requestFocus() } }
                                PointerEventType.Release -> { val was = pressed; pressed = false
                                    if (c.type != PointerType.Mouse) hover = false
                                    if (was && inside && isLink && e.motionEvent?.actionMasked != android.view.MotionEvent.ACTION_CANCEL) select("pointer") }
                                else -> {}
                            }
                        }
                    }
                }) {
            if (p.str("icon").isNotBlank()) Box(Modifier.size(18.dp).clearAndSetSemantics { hideFromAccessibility() }, contentAlignment = Alignment.Center) {
                val fs = with(LocalDensity.current) { m.glyphSize.dp.toSp() }
                Text(p.str("icon"), Modifier.wrapContentSize(unbounded = true).breadcrumbUnderline(underline, inkNow, R.font.awc_material_symbols, m.glyphSize, iconRow), color = parts.icon ?: inkNow, fontFamily = breadcrumbSymbolFamily(if (current) 1 else 0, if (current) 600 else 500),
                    fontWeight = FontWeight(if (current) 600 else 500), fontSize = fs, lineHeight = fs, letterSpacing = 0.sp, maxLines = 1, softWrap = false,
                    style = TextStyle(platformStyle = PlatformTextStyle(includeFontPadding = false), fontFeatureSettings = "liga"))
            }
            BreadcrumbIconSlot { CompositionLocalProvider(LocalContentColor provides (parts.icon ?: inkNow)) { slot?.invoke("icon") } }
            // The crumb's merged node carries the name (contentDescription); the label text itself adds nothing (no "Home Home").
            val labelInk = parts.label ?: inkNow
            Box(Modifier.height(m.lineHeight.dp).onGloballyPositioned { coords["label"] = it }.inspectAWCNode(inspection, "label", "label").breadcrumbCap((32 * ch).dp).exactWidth(labelPx)
                .breadcrumbUnderline(underline, inkNow, R.font.awc_roboto_medium, m.fontSize, labelRow).clearAndSetSemantics { }, contentAlignment = Alignment.CenterStart) {
                CompositionLocalProvider(LocalContentColor provides labelInk, LocalTextStyle provides breadcrumbText(m.fontSize, m.lineHeight, weight, .1, labelInk),
                    LocalAWCSlotTextRegistry provides child.label, LocalAWCSlotTextNoWrap provides true, LocalAWCSlotTextOverflow provides TextOverflow.Ellipsis) { slot?.invoke("") }
            }
        }
    }, modifier = Modifier.onGloballyPositioned { coords["item"] = it }.graphicsLayer { alpha = motion.entranceAt(motion.frame, rtl).first.toFloat(); translationX = (motion.entranceAt(motion.frame, rtl).second * density).toFloat() }) { ms, c ->
        val loose = Constraints(maxWidth = c.maxWidth)
        val pls = ms.map { it.measure(loose) }
        val gapPx = ((a.gap ?: m.hostGap) * density).roundToInt()
        val w = pls.sumOf { it.width } + gapPx * (pls.size - 1).coerceAtLeast(0); val h = pls.maxOfOrNull { it.height } ?: 0
        layout(w, h) { var x = 0; for (pl in pls) { pl.placeRelative(x, (h - pl.height) / 2); x += pl.width + gapPx } }
    }
}

/** Lays the text out at its exact advance rounded to the nearest device pixel (Text alone rounds up: the error accumulates along a trail). */
private fun Modifier.exactWidth(px: Float?) = if (px == null) this else this.layout { measurable, constraints ->
    val pl = measurable.measure(constraints)
    val w = px.roundToInt().coerceIn(constraints.minWidth, constraints.maxWidth)
    layout(w, pl.height) { pl.placeRelative(0, 0) }
}
/** `max-inline-size` with the label's natural width below it. */
private fun Modifier.breadcrumbCap(limit: androidx.compose.ui.unit.Dp) = this.then(Modifier.layoutCap(limit))
private fun Modifier.layoutCap(limit: androidx.compose.ui.unit.Dp) = this.layout { measurable, constraints ->
    val max = min(constraints.maxWidth, limit.roundToPx())
    val pl = measurable.measure(constraints.copy(minWidth = 0, maxWidth = max))
    layout(pl.width, pl.height) { pl.placeRelative(0, 0) }
}
/** A slotted icon sits in the 18 dp icon box; an empty slot takes no space. */
@Composable
private fun BreadcrumbIconSlot(content: @Composable () -> Unit) {
    Layout(content = content, modifier = Modifier.clearAndSetSemantics { hideFromAccessibility() }) { ms, c ->
        if (ms.isEmpty()) return@Layout layout(0, 0) {}
        val box = 18.dp.roundToPx()
        val pls = ms.map { it.measure(Constraints(maxWidth = box, maxHeight = box)) }
        layout(box, box) { pls.forEach { it.placeRelative((box - it.width) / 2, (box - it.height) / 2) } }
    }
}

@Composable
private fun BreadcrumbSurface(m: BreadcrumbMetrics, a: AWCBreadcrumbsAppearance, padding: List<Double>, palette: BreadcrumbPalette, ink: Color, layer: Double, nudge: Double,
                              current: Boolean, isLink: Boolean, focusVisible: Boolean, rtl: Boolean, inspection: AWCInspectionContext?, onBounds: (androidx.compose.ui.layout.LayoutCoordinates) -> Unit,
                              background: Color?, layerInk: Color, border: Double, borderInk: Color,
                              modifier: Modifier, content: @Composable () -> Unit) {
    val density = LocalDensity.current.density
    val shape = RoundedCornerShape(50)
    Layout(content = content, modifier = Modifier
        .graphicsLayer { translationX = (nudge * density).toFloat() }
        .onGloballyPositioned { onBounds(it) }
        .inspectAWCNode(inspection, "surface", "surface")
        .drawWithContent {
            drawContent()
            if (focusVisible) { val o = 3.5f * density; val sw = 3f * density
                drawRoundRect(palette.focusRing, Offset(-o, -o), Size(size.width + 2 * o, size.height + 2 * o), CornerRadius((size.height + 2 * o) / 2), style = Stroke(sw)) }
        }
        .clip(shape)
        .drawBehind {
            if (background != null) drawRect(background)
            if (isLink && layer > 0) drawRect(layerInk.copy(alpha = layerInk.alpha * layer.toFloat()))
            // ::part(static) border: inside the pill, over the background (the padding below keeps the content clear of it).
            if (border > 0) { val w = (border * density).toFloat()
                drawRoundRect(borderInk, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), CornerRadius((size.height - w) / 2), style = Stroke(w)) }
        }
        .awcRipple(disabled = !isLink, cornerRadius = 9999.dp, contentColor = ink)
        .then(modifier)
        .padding(border.dp)
        .padding(start = (if (rtl) padding[1] else padding[3]).dp, top = padding[0].dp, end = (if (rtl) padding[3] else padding[1]).dp, bottom = padding[2].dp)
    ) { ms, c ->
        val pls = ms.map { it.measure(Constraints(maxWidth = c.maxWidth)) }.filter { it.width > 0 }
        val gapPx = ((a.itemGap ?: m.iconGap) * density).roundToInt()
        val w = pls.sumOf { it.width } + gapPx * (pls.size - 1).coerceAtLeast(0); val h = pls.maxOfOrNull { it.height } ?: 0
        layout(w, h) { var x = 0; for (pl in pls) { pl.placeRelative(x, (h - pl.height) / 2); x += pl.width + gapPx } }
    }
}

/** The overflow toggle: a 32 dp round "…" button labelled with expandLabel, after a separator when crumbs lead it. */
@Composable
private fun BreadcrumbToggle(ctx: BreadcrumbsContext, m: BreadcrumbMetrics, expandLabel: String, activate: (Boolean) -> Unit) {
    val trail = ctx.trail
    if (!trail.showToggle) return
    val palette = ctx.palette
    val parts = LocalAWCBreadcrumbsPartAppearance.current
    val sepSize = parts.separatorSize ?: m.separatorSize; val sepInk = parts.separator ?: palette.separator; val dots = parts.buttonInk ?: palette.toggle
    var hover by remember { mutableStateOf(false) }; var pressed by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }; var pointerFocus by remember { mutableStateOf(false) }
    val focusVisible = focused && !pointerFocus
    val layerTarget = if (focusVisible) .12 else if (hover) .08 else 0.0
    val scaleTarget = if (pressed) .94 else 1.0
    val motion = rememberBreadcrumbMotion(listOf(palette.toggle, layerTarget, 0.0, scaleTarget), ctx.reduced, false, 0.0)
    val now = motion.frame; val layer = if (motion.primed) motion.layer.presented(now) else layerTarget; val scale = if (motion.primed) motion.scale.presented(now) else scaleTarget
    val density = LocalDensity.current.density
    val probe = LocalAWCBreadcrumbsProbe.current
    val coords = remember { java.util.concurrent.ConcurrentHashMap<String, androidx.compose.ui.layout.LayoutCoordinates>() }
    SideEffect { probe?.toggle = mapOf("layer" to layerTarget, "layerNow" to layer, "scale" to scaleTarget, "scaleNow" to scale, "focusRing" to focusVisible, "focused" to focused,
        "hover" to hover, "pressed" to pressed, "label" to expandLabel, "frame" to now, "coords" to coords, "color" to rgba(dots),
        "background" to rgba(parts.buttonBg ?: palette.toggle.copy(alpha = palette.toggle.alpha * layerTarget.toFloat())), "sepColor" to rgba(sepInk), "sepSize" to sepSize,
        "box" to parts.overflow?.probe(palette.text)?.mapValues { (_, v) -> if (v is Color) rgba(v) else v }) }
    DisposableEffect(probe) { onDispose { probe?.toggle = null } }
    val inspection = LocalAWCInspection.current
    Layout(content = {
        if (trail.before > 0) Box(Modifier.clearAndSetSemantics { hideFromAccessibility() }, contentAlignment = Alignment.Center) {
            val context = androidx.compose.ui.platform.LocalContext.current
            val px = remember(ctx.separator, sepSize, density) { breadcrumbAdvance(context, ctx.separator, (sepSize * density).toFloat(), 400, 0f, ctx.rtl) }
            Text(ctx.separator, Modifier.exactWidth(px), style = breadcrumbText(sepSize, null, 400, 0.0, sepInk), maxLines = 1, softWrap = false)
        }
        Canvas(Modifier
            .onGloballyPositioned { coords["button"] = it }
            .inspectAWCNode(inspection, "overflow-button", "overflow-button")
            .size(32.dp)
            .graphicsLayer { scaleX = scale.toFloat(); scaleY = scale.toFloat() }
            .semantics { role = Role.Button; contentDescription = expandLabel; stateDescription = "collapsed"; onClick(expandLabel) { activate(false); true } }
            .focusRequester(trail.toggleFocus)
            .onFocusChanged { focused = it.isFocused; if (!it.isFocused) pointerFocus = false }
            .focusable()
            .onKeyEvent { e -> if (e.type == KeyEventType.KeyDown && (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.Spacebar)) { activate(true); true } else false }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val e = awaitPointerEvent(PointerEventPass.Main)
                        val c = e.changes.firstOrNull() ?: continue
                        val inside = c.position.x >= 0 && c.position.y >= 0 && c.position.x < size.width && c.position.y < size.height
                        when (e.type) {
                            PointerEventType.Enter, PointerEventType.Move -> if (c.type == PointerType.Mouse || pressed) hover = inside
                            PointerEventType.Exit -> hover = false
                            PointerEventType.Press -> { pressed = true; pointerFocus = true; runCatching { trail.toggleFocus.requestFocus() } }
                            PointerEventType.Release -> { val was = pressed; pressed = false; if (c.type != PointerType.Mouse) hover = false
                                if (was && inside && e.motionEvent?.actionMasked != android.view.MotionEvent.ACTION_CANCEL) activate(false) }
                            else -> {}
                        }
                    }
                }
            }) {
            val r = size.width / 2
            // ::part(overflow-button) background-color replaces the hover / focus tint in every state.
            drawCircle(parts.buttonBg ?: palette.toggle.copy(alpha = palette.toggle.alpha * layer.toFloat()), r)
            val k = 20.dp.toPx() / 24f; val ox = (size.width - 20.dp.toPx()) / 2; val oy = (size.height - 20.dp.toPx()) / 2
            for (x in listOf(6f, 12f, 18f)) drawCircle(dots, 1.6f * k, Offset(ox + x * k, oy + 12f * k))
            if (focusVisible) { val o = 3.5f * density; drawCircle(palette.focusRing, r + o, style = Stroke(3f * density)) }
        }
    // ::part(overflow) box (gate-7 R6-17): border + padding (physical edges) around the separator and the toggle; the list row grows
    // with it and the items after it shift.
    }, modifier = Modifier.onGloballyPositioned { coords["overflow"] = it }.awcPartBox(parts.overflow, palette.text)) { ms, c ->
        val pls = ms.map { it.measure(Constraints()) }
        val gapPx = (m.toggleGap * density).roundToInt()
        val w = pls.sumOf { it.width } + gapPx * (pls.size - 1).coerceAtLeast(0); val h = pls.maxOfOrNull { it.height } ?: 0
        layout(w, h) { var x = 0; for (pl in pls) { pl.placeRelative(x, (h - pl.height) / 2); x += pl.width + gapPx } }
    }
}
