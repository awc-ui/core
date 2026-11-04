package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.*
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// MARK: hooks

/** md-toolbar's eleven public hooks (`--md-toolbar-*`): colours `#RRGGBB(AA)`, lengths dp (the container shape one corner
 *  radius, 9999 = full) and the opt-in overflow keywords (`overflowX` / `overflowY`: visible | hidden | clip | scroll | auto;
 *  `flexWrap`: nowrap | wrap | wrap-reverse; `scrollbarWidth`: thin | auto | none). Unset hooks keep the source defaults. */
@Immutable
data class AWCToolbarAppearance(
    val containerColor: String? = null, val iconColor: String? = null,
    val containerShape: Double? = null, val containerHeight: Double? = null, val padding: Double? = null, val gap: Double? = null, val fabGap: Double? = null,
    val overflowX: String? = null, val overflowY: String? = null, val flexWrap: String? = null, val scrollbarWidth: String? = null,
) {
    val values: Map<String, AWCValue> get() = mapOf("containerColor" to containerColor, "iconColor" to iconColor, "containerShape" to containerShape,
        "containerHeight" to containerHeight, "padding" to padding, "gap" to gap, "fabGap" to fabGap, "overflowX" to overflowX, "overflowY" to overflowY,
        "flexWrap" to flexWrap, "scrollbarWidth" to scrollbarWidth).filterValues { it != null }
    fun normalized() = fromValues(values)
    fun merged(local: AWCToolbarAppearance) = fromValues(normalized().values + local.normalized().values)
    companion object {
        private val OVERFLOW = setOf("visible", "hidden", "clip", "scroll", "auto")
        fun fromValues(values: Map<String, AWCValue>): AWCToolbarAppearance {
            fun color(k: String) = (values[k] as? String)?.trim()?.takeIf { it.matches(Regex("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) }?.uppercase(java.util.Locale.ROOT)
            fun len(k: String) = (values[k] as? Number)?.toDouble()?.takeIf { it.isFinite() && it in 0.0..10000.0 }
            fun word(k: String, allowed: Set<String>) = (values[k] as? String)?.trim()?.lowercase(java.util.Locale.ROOT)?.takeIf { it in allowed }
            return AWCToolbarAppearance(color("containerColor"), color("iconColor"), len("containerShape"), len("containerHeight"), len("padding"), len("gap"),
                len("fabGap"), word("overflowX", OVERFLOW), word("overflowY", OVERFLOW), word("flexWrap", setOf("nowrap", "wrap", "wrap-reverse")),
                word("scrollbarWidth", setOf("thin", "auto", "none")))
        }
        /** CSS values keyed by the hook names (`--md-toolbar-gap: 10px`), as authored on Web. */
        fun fromCSS(css: Map<String, String>): AWCToolbarAppearance {
            fun v(k: String) = css["--md-toolbar-$k"]
            fun px(k: String) = v(k)?.trim()?.removeSuffix("px")?.toDoubleOrNull()
            return fromValues(mapOf("containerColor" to v("container-color"), "iconColor" to v("icon-color"), "containerShape" to px("container-shape"),
                "containerHeight" to px("container-height"), "padding" to px("padding"), "gap" to px("gap"), "fabGap" to px("fab-gap"),
                "overflowX" to v("overflow-x"), "overflowY" to v("overflow-y"), "flexWrap" to v("flex-wrap"), "scrollbarWidth" to v("scrollbar-width")))
        }
    }
}
internal val LocalAWCToolbarAppearance = staticCompositionLocalOf { AWCToolbarAppearance() }
/** The md-toolbar hooks for this subtree; nearer values win field by field. */
@Composable
fun AWCToolbarAppearanceScope(appearance: AWCToolbarAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCToolbarAppearance.current
    val resolved = remember(inherited, appearance) { inherited.merged(appearance) }
    CompositionLocalProvider(LocalAWCToolbarAppearance provides resolved, content = content)
}

/** setFocus(): focuses the roving Tab stop (the remembered member, else the preferred one); no-op when the roving group is
 *  empty or the toolbar is generic. */
@Stable
class AWCToolbarController {
    internal var handler: (() -> Boolean)? = null
    fun setFocus(): Boolean = handler?.invoke() ?: false
}
internal val LocalAWCToolbarController = staticCompositionLocalOf<AWCToolbarController?> { null }
@Composable
fun AWCToolbarControllerScope(controller: AWCToolbarController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCToolbarController provides controller, content = content)

/** Test and Laboratory measurement surface (host, container, FAB, items, roving state). */
class AWCToolbarProbe {
    @Volatile var bar: Map<String, Any?> = emptyMap()
    val items = java.util.concurrent.ConcurrentHashMap<String, Map<String, Any?>>()
}
val LocalAWCToolbarProbe = staticCompositionLocalOf<AWCToolbarProbe?> { null }

/**
 * Authored text by element id (IDREF names: `aria-labelledby`). Compose has no document to resolve ids in, so the host that
 * renders a node tree supplies its texts (the SwiftUI renderer registers every node's text in its scope automatically).
 * Nested scopes add to the outer one; a text change recomposes the names that reference it.
 */
val LocalAWCLabelTexts = compositionLocalOf<Map<String, String>> { emptyMap() }

@Composable
fun AWCLabelTextsScope(texts: Map<String, String>, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCLabelTexts provides LocalAWCLabelTexts.current + texts, content = content)

/** The name an `aria-labelledby` IDREF list resolves to: the referenced texts in order, unresolved ids skipped ("" if none). */
internal fun awcLabelledByName(p: Props, texts: Map<String, String>): String =
    listOf(p.str("ariaLabelledby"), p.str("aria-labelledby")).firstOrNull { it.isNotBlank() }.orEmpty().trim().split(Regex("\\s+"))
        .mapNotNull { id -> texts[id]?.trim()?.takeIf { it.isNotEmpty() } }.joinToString(" ")

/** The toolbar-only md-icon-button token map a toolbar supplies to its direct icon buttons (md-toolbar section 7). */
internal data class AWCIconButtonScheme(val ink: String, val tonalOff: Pair<String, String>?, val tonalOn: Pair<String, String>?) {
    fun appearance(variant: String, toggle: Boolean, selected: Boolean): AWCIconButtonAppearance? = when {
        (variant == "standard" || variant == "outlined") && !selected -> AWCIconButtonAppearance(iconColor = ink, stateLayerColor = ink)
        variant == "tonal" && toggle -> (if (selected) tonalOn else tonalOff)?.let { AWCIconButtonAppearance(containerColor = it.first, iconColor = it.second, stateLayerColor = it.second) }
        else -> null
    }
}
internal val LocalAWCIconButtonScheme = staticCompositionLocalOf<AWCIconButtonScheme?> { null }
/** A docked toolbar flattens its paired FAB (`::slotted([slot=fab]) { box-shadow: none !important }`). */
internal val LocalAWCFabFlatElevation = staticCompositionLocalOf { false }

// MARK: model

/** A toolbar's direct child (its layout id): the section it was composed in, roving membership (md-icon-button / md-button,
 *  visible, not hard-disabled, not aria-hidden; md-chip, md-fab, fields and composites keep their own Tab stop), the
 *  roving stamp (`groupTabindex`) and its native focus handle. */
internal class ToolbarChild {
    var tag by mutableStateOf("")
    var props by mutableStateOf<Props>(emptyMap())
    var slot by mutableStateOf("")
    val focus = AWCButtonFocusState()
    var focused by mutableStateOf(false)
    var tabIndex by mutableStateOf<Int?>(null)
    var scheme by mutableStateOf<AWCIconButtonScheme?>(null)
    var flatFab by mutableStateOf(false)
    val id get() = props.str("id")
    val hidden get() = props.bool("hidden")
    val member get() = slot != "fab" && tag in setOf("md-icon-button", "md-button") && !props.bool("disabled") && props.str("aria-hidden") != "true" && !hidden
    val soft get() = props.bool("softDisabled")
    /** The bar's effective density (local or inherited --md-sys-density-scale) for a child without its own. */
    var density by mutableStateOf(0.0)
    fun roved(p: Props): Props {
        var q = tabIndex?.let { p + ("groupTabindex" to it) } ?: p
        if (density < 0 && !(p.num("density") < 0)) q = q + ("density" to density)
        return q
    }
}
internal class ToolbarContext(val registered: Boolean)
private val toolbarArrowKeys = setOf(Key.DirectionLeft, Key.DirectionRight, Key.DirectionUp, Key.DirectionDown)
internal val LocalToolbarRow = staticCompositionLocalOf<ToolbarContext?> { null }
internal val LocalToolbarSlot = staticCompositionLocalOf { "" }

/** The child's toolbar-supplied context: its focus handle (roving), the icon-button tints and the flattened FAB. */
@Composable
internal fun AWCToolbarMember(child: ToolbarChild?, content: @Composable () -> Unit) {
    if (child == null) { content(); return }
    // `hidden` is display:none on the Web: the control leaves the tree (and drops focus) instead of only the layout.
    if (child.hidden) return
    AWCButtonFocusScope(child.focus, onFocusChanged = { child.focused = it }) {
        CompositionLocalProvider(LocalAWCIconButtonScheme provides child.scheme, LocalAWCFabFlatElevation provides child.flatFab, content = content)
    }
}

internal class ToolbarMetrics(variant: String, layout: String, alignment: String, a: AWCToolbarAppearance, s: Double, rung: Double) {
    val floating = variant == "floating"; val vertical = floating && layout == "vertical"
    val justify = if (alignment in setOf("start", "center", "end", "space-between")) alignment else "start"
    private val insetLg = if (rung <= -4) 8.0 else if (rung <= -2) 12.0 else 16.0
    private val insetSm = if (rung <= -3) 4.0 else 8.0
    private val gapXs = if (rung <= -4) 2.0 else 4.0
    private val gapSm = if (rung <= -3) 4.0 else 8.0
    private val gapLg = if (rung <= -4) 8.0 else if (rung <= -2) 12.0 else 16.0
    private val itemGap = max(4.0, 32 + 2 * s)
    val height = a.containerHeight ?: max(48.0, 64 + 4 * s)
    val gap = if (floating) a.gap ?: gapXs else if (justify == "space-between") 0.0 else a.gap ?: (if (justify == "center") gapSm else itemGap)
    val sectionGap = if (!floating && justify == "space-between") a.gap ?: itemGap else gap
    val padding = a.padding ?: if (floating) insetSm else insetLg
    val fabGap = a.fabGap ?: if (floating) gapSm else gapLg
    val shape = a.containerShape ?: if (floating) 9999.0 else 0.0
    val margin = if (floating) insetLg else 0.0
}

internal class ToolbarState {
    var order by mutableStateOf<List<ToolbarChild>>(emptyList())
    var fabs by mutableStateOf<List<ToolbarChild>>(emptyList())
    var active by mutableStateOf<ToolbarChild?>(null)
    var scroll by mutableStateOf(0.0)
    var scrollMax = 0.0
    var viewport = 0.0
    var spans: Map<ToolbarChild, ClosedFloatingPointRange<Double>> = emptyMap()
    var rects: Map<ToolbarChild, List<Double>> = emptyMap()
    var host: LayoutCoordinates? = null; var container: LayoutCoordinates? = null; var fab: LayoutCoordinates? = null
    fun scrollTo(v: Double) { val c = min(max(v, 0.0), scrollMax); if (c != scroll) scroll = c }
}

/** The `.md-toolbar__container` flex line(s): leading/trailing sections are one item each (`sectionGap` inside), default
 *  items `gap` apart, positive free space goes to the sections' auto margins (horizontal) else `justify-content`, items
 *  centred on the cross axis, `flex-wrap` lines `gap` apart; physical positions (RTL runs right to left). */
internal object ToolbarFlex {
    class Unit(val idx: List<Int>, val main: Double, val cross: Double, val slot: String)
    class Placed(val x: Double, val y: Double)
    fun units(slots: List<String>, main: List<Double>, cross: List<Double>, sectionGap: Double): List<Unit> {
        fun group(s: String): Unit? { val ids = slots.indices.filter { slots[it] == s }; if (ids.isEmpty()) return null
            return Unit(ids, ids.sumOf { main[it] } + sectionGap * (ids.size - 1), ids.maxOf { cross[it] }, s) }
        return listOfNotNull(group("leading")) + slots.indices.filter { slots[it] != "leading" && slots[it] != "trailing" }.map { Unit(listOf(it), main[it], cross[it], "") } + listOfNotNull(group("trailing"))
    }
    fun natural(us: List<Unit>, gap: Double) = if (us.isEmpty()) 0.0 else us.sumOf { it.main } + gap * (us.size - 1)
    fun lines(us: List<Unit>, mainLen: Double, gap: Double, wrap: Boolean, reverse: Boolean): List<List<Int>> {
        if (us.isEmpty()) return emptyList()
        if (!wrap) return listOf(us.indices.toList())
        val out = mutableListOf<List<Int>>(); var cur = mutableListOf<Int>(); var used = 0.0
        for (i in us.indices) { val add = if (cur.isEmpty()) us[i].main else used + gap + us[i].main
            if (cur.isNotEmpty() && add > mainLen + .01) { out += cur; cur = mutableListOf(i); used = us[i].main } else { cur += i; used = add } }
        if (cur.isNotEmpty()) out += cur
        return if (reverse) out.reversed() else out
    }
    fun cross(us: List<Unit>, ls: List<List<Int>>, gap: Double) = if (ls.isEmpty()) 0.0 else ls.sumOf { l -> l.maxOf { us[it].cross } } + gap * (ls.size - 1)
    fun place(us: List<Unit>, ls: List<List<Int>>, sizes: List<Pair<Double, Double>>, mainLen: Double, crossLen: Double, vertical: Boolean, rtl: Boolean,
              gap: Double, sectionGap: Double, justify: String): Map<Int, Placed> {
        val out = HashMap<Int, Placed>()
        val total = cross(us, ls, gap); var crossCursor = if (ls.size == 1) 0.0 else max(0.0, (crossLen - total) / 2)
        for (line in ls) {
            val lineCross = if (ls.size == 1) crossLen else line.maxOf { us[it].cross }
            val free = mainLen - (line.sumOf { us[it].main } + gap * (line.size - 1))
            val lead = !vertical && line.any { us[it].slot == "leading" }; val trail = !vertical && line.any { us[it].slot == "trailing" }
            val autos = (if (lead) 1 else 0) + (if (trail) 1 else 0)
            var cursor = 0.0; var between = gap; var leadM = 0.0; var trailM = 0.0
            if (autos > 0 && free > 0) { val share = free / autos; if (lead) leadM = share; if (trail) trailM = share }
            else when (justify) { "center" -> cursor = free / 2; "end" -> cursor = free; "space-between" -> if (line.size > 1 && free > 0) between = gap + free / (line.size - 1) }
            for (ui in line) { val u = us[ui]
                if (u.slot == "trailing") cursor += trailM
                var inner = cursor
                for (i in u.idx) {
                    val (w, h) = sizes[i]; val m = if (vertical) h else w; val c = if (vertical) w else h
                    val cp = crossCursor + (lineCross - c) / 2
                    out[i] = if (vertical) Placed(cp, inner) else Placed(if (rtl) mainLen - inner - m else inner, cp)
                    inner += m + sectionGap
                }
                cursor += u.main + between
                if (u.slot == "leading") cursor += leadM
            }
            crossCursor += lineCross + gap
        }
        return out
    }
}

// MARK: toolbar

/**
 * md-toolbar: the docked bar (full width, surface-container, elevation 2, square corners) or the floating pill (corner-full,
 * elevation 2, the FAB beside it), standard/vibrant chrome, sections, alignment, density, the eleven hooks, the toolbar-only
 * icon-button tints, the roving Tab stop over its activators (arrows on the bar's axis, wrap, Home/End, soft-disabled members
 * reachable, modifier arrows ignored, the stop remembered), setFocus() and generic mode.
 */
@Composable
internal fun NativeToolbar(p: Props, emit: EventSink, slot: Slot?) {
    if (p.bool("hidden")) return
    val state = remember { ToolbarState() }
    val tokens = LocalAWCThemeTokens.current
    val appearance = LocalAWCToolbarAppearance.current
    val scale = LocalAWCNativeDensity.current
    val rung = LocalAWCDensityRungs.current.firstOrNull { it <= -2 } ?: 0.0
    val m = ToolbarMetrics(p.str("variant", "docked"), p.str("layout", "horizontal"), p.str("alignment", "start"), appearance, scale, rung)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val toolbar = p.str("containerSemantics", "toolbar") != "generic"
    // aria-labelledby wins over aria-label when it resolves; an unresolved reference falls back to aria-label.
    val label = awcLabelledByName(p, LocalAWCLabelTexts.current).ifEmpty {
        listOf(p.str("aria-label"), p.str("ariaLabelProp"), p.str("ariaLabel")).map { it.trim() }.firstOrNull { it.isNotEmpty() } ?: "" }
    fun token(role: String, fallback: Long) = awcRippleHex(tokens["--md-sys-color-$role"]) ?: Color(fallback)
    fun hexOf(c: Color) = String.format("#%02X%02X%02X", (c.red * 255).roundToInt(), (c.green * 255).roundToInt(), (c.blue * 255).roundToInt())
    val vibrant = p.str("color", "standard") == "vibrant"
    val container = appearance.containerColor?.let { awcRippleHex(it) } ?: if (vibrant) token("primary-container", 0xFFEADDFF) else token("surface-container", 0xFFF3EDF7)
    val ink = appearance.iconColor ?: hexOf(if (vibrant) token("on-surface", 0xFF1C1B1F) else token("on-surface-variant", 0xFF49454F))
    val scheme = AWCIconButtonScheme(ink, if (vibrant) hexOf(token("surface-container", 0xFFF3EDF7)) to hexOf(token("on-surface", 0xFF1C1B1F)) else null,
        if (vibrant) hexOf(token("secondary-container", 0xFFE8DEF8)) to hexOf(token("on-secondary-container", 0xFF1E192B)) else null)
    val wrap = appearance.flexWrap == "wrap" || appearance.flexWrap == "wrap-reverse"
    val overflow = if (m.vertical) appearance.overflowY else appearance.overflowX
    val scrolling = (overflow == "auto" || overflow == "scroll") && !wrap
    val clips = scrolling || overflow == "hidden" || overflow == "clip"
    // Children register during layout: reading the order recomposes the toolbar once they have (roving stamps, tints).
    val order = state.order + state.fabs
    val visible = order.filter { !it.hidden }
    val members = if (toolbar) visible.filter { it.member }.sortedBy { listOf("leading", "", "trailing").indexOf(it.slot).let { i -> if (i < 0) 1 else i } } else emptyList()
    val preferred = members.firstOrNull { !it.soft } ?: members.firstOrNull()
    // focusin: the focused member becomes the stop (also after a pointer press).
    members.firstOrNull { it.focused }?.let { f -> if (state.active !== f) SideEffect { state.active = f } }
    val stop = state.active?.takeIf { it in members } ?: preferred
    SideEffect {
        for (c in order) { c.tabIndex = if (toolbar && c in members) (if (c === stop) 0 else -1) else null
            c.scheme = if (c.tag == "md-icon-button" && c.slot != "fab") scheme else null; c.flatFab = c.slot == "fab" && !m.floating; c.density = scale }
    }
    LocalAWCToolbarController.current?.let { ctl -> SideEffect { ctl.handler = { if (!toolbar) false else (state.active?.takeIf { it in members } ?: preferred)?.focus?.requestFocus() ?: false } } }
    fun key(e: KeyEvent): Boolean {
        if (!toolbar || e.type != KeyEventType.KeyDown) return false
        if (e.isShiftPressed || e.isCtrlPressed || e.isAltPressed || e.isMetaPressed) return false
        val current = members.firstOrNull { it.focused } ?: return false
        val i = members.indexOf(current); val n = members.size
        val next = when (e.key) {
            Key.MoveHome -> 0; Key.MoveEnd -> n - 1
            Key.DirectionRight -> if (m.vertical) return false else (i + (if (rtl) -1 else 1) + n) % n
            Key.DirectionLeft -> if (m.vertical) return false else (i + (if (rtl) 1 else -1) + n) % n
            Key.DirectionDown -> if (!m.vertical) return false else (i + 1) % n
            Key.DirectionUp -> if (!m.vertical) return false else (i - 1 + n) % n
            else -> return false
        }
        val target = members[next]
        if (target !== current) { state.active = target; target.focus.requestFocus() }
        return true
    }
    val density = LocalDensity.current.density
    val probe = LocalAWCToolbarProbe.current
    val shadows = remember(tokens) { awcElevationTokenLayers(tokens) }
    val hasFab = visible.any { it.slot == "fab" }
    fun writeProbe() {
        probe ?: return
        probe.bar = mapOf("role" to (if (toolbar) "toolbar" else "generic"), "orientation" to (if (toolbar) (if (m.vertical) "vertical" else "horizontal") else ""),
            "label" to (if (toolbar) label else ""), "background" to (if (m.floating) Color.Transparent else container), "pill" to (if (m.floating) container else Color.Transparent),
            "radius" to m.shape, "elevation" to 2, "floating" to m.floating, "padding" to (if (m.floating) m.padding else 0.0), "host" to state.host, "container" to state.container, "fab" to state.fab,
            "members" to members.map { it.id }, "active" to (if (toolbar) stop?.id ?: "" else ""), "scrollMax" to state.scrollMax, "scroll" to state.scroll)
        for (c in order) probe.items[c.id] = mapOf("slot" to c.slot, "member" to (c in members), "tabStop" to (c === stop && c in members), "rect" to state.rects[c],
            "scheme" to (if (c.tag == "md-icon-button" && c.slot != "fab") scheme.appearance(c.props.str("variant", "standard"), c.props.bool("toggle"), c.props.bool("selected"))?.values else null),
            "focused" to c.focused, "focusVisible" to (c.focused && c.focus.isFocusVisible))
    }
    val hostShape = AWCCornerShape.uniform(points = m.shape)
    val hostModifier = Modifier
        .padding(horizontal = m.margin.dp)
        .then(if (m.floating) Modifier else Modifier.accordionShadow(hostShape, shadows.getOrElse(2) { emptyList() }, false).background(container, hostShape))
        .onGloballyPositioned { state.host = it; writeProbe() }
        .onPreviewKeyEvent { key(it) }
        // Chrome never moves focus on an arrow key; an arrow no member and no child handled stays here instead of
        // starting Compose's directional focus search (bubble phase: a child that uses arrows, a text field, keeps them).
        .onKeyEvent { e -> e.type == KeyEventType.KeyDown && e.key in toolbarArrowKeys }
        .semantics { isTraversalGroup = true; if (toolbar && label.isNotEmpty()) contentDescription = label }
    Layout(content = {
        // 0: the container (floating: the pill with its chrome and padding).
        val pillShape = AWCCornerShape.uniform(points = m.shape)
        Box(Modifier.layoutId("container")
            .then(if (m.floating) Modifier.accordionShadow(pillShape, shadows.getOrElse(2) { emptyList() }, false).background(container, pillShape) else Modifier)
            .onGloballyPositioned { state.container = it; writeProbe() }
            .padding((if (m.floating) m.padding else 0.0).dp)
            .then(if (clips) Modifier.clipToBounds() else Modifier)
            .then(if (scrolling) Modifier.draggable(rememberDraggableState { d -> state.scrollTo(state.scroll - d / density * (if (rtl && !m.vertical) -1 else 1)) },
                if (m.vertical) Orientation.Vertical else Orientation.Horizontal) else Modifier)) {
            ToolbarItems(state, m, rtl, wrap, appearance.flexWrap == "wrap-reverse", scrolling, fill = !m.floating) {
                CompositionLocalProvider(LocalToolbarRow provides ToolbarContext(true)) {
                    CompositionLocalProvider(LocalToolbarSlot provides "leading") { slot?.invoke("leading") }
                    CompositionLocalProvider(LocalToolbarSlot provides "") { slot?.invoke("") }
                    CompositionLocalProvider(LocalToolbarSlot provides "trailing") { slot?.invoke("trailing") }
                }
            }
        }
        // 1: the FAB container.
        Layout(content = { CompositionLocalProvider(LocalToolbarRow provides ToolbarContext(true), LocalToolbarSlot provides "fab") { slot?.invoke("fab") } },
            modifier = Modifier.layoutId("fab").onGloballyPositioned { state.fab = it; writeProbe() }) { ms, _ ->
            val kids = ms.mapNotNull { it.layoutId as? ToolbarChild }; if (kids != state.fabs) state.fabs = kids
            val shown = ms.filter { (it.layoutId as? ToolbarChild)?.hidden != true }.map { it.measure(Constraints()) }
            val w = shown.sumOf { it.width }; val h = shown.maxOfOrNull { it.height } ?: 0
            layout(w, h) { var x = 0; for (pl in shown) { pl.place(x, (h - pl.height) / 2); x += pl.width } }
        }
    }, modifier = hostModifier) { measurables, constraints ->
        val cm = measurables.first { it.layoutId == "container" }; val fm = measurables.first { it.layoutId == "fab" }
        val fp = fm.measure(Constraints()); val fw = if (hasFab) fp.width / density.toDouble() else 0.0; val fh = if (hasFab) fp.height / density.toDouble() else 0.0
        fun px(v: Double) = (v * density).roundToInt()
        val maxW = if (constraints.hasBoundedWidth) constraints.maxWidth / density.toDouble() else null
        val maxH = if (constraints.hasBoundedHeight) constraints.maxHeight / density.toDouble() else null
        if (!m.floating) {
            val fabExtra = if (hasFab) m.fabGap + fw else 0.0
            val cp = if (maxW != null) cm.measure(Constraints.fixedWidth(px(max(0.0, maxW - 2 * m.padding - fabExtra)))) else cm.measure(Constraints())
            val cw = cp.width / density.toDouble(); val w = maxW ?: (cw + 2 * m.padding + fabExtra)
            val ch = cp.height / density.toDouble(); val h = maxOf(m.height, ch, fh)
            layout(px(w), px(h)) {
                cp.place(px(if (rtl) w - m.padding - cw else m.padding), px((h - ch) / 2))
                if (hasFab) fp.place(px(if (rtl) m.padding else w - m.padding - fw), px((h - fh) / 2))
            }
        } else if (!m.vertical) {
            val fabExtra = if (hasFab) m.fabGap + fw else 0.0
            val avail = maxW?.let { max(0.0, it - fabExtra) }; val h = max(m.height, fh)
            val cp = cm.measure(Constraints(0, avail?.let { px(it) } ?: Constraints.Infinity, px(m.height), px(m.height)))
            val cw = cp.width / density.toDouble()
            val w = cw + fabExtra
            layout(px(w), px(h)) {
                cp.place(px(if (rtl) w - cw else 0.0), px((h - m.height) / 2))
                if (hasFab) fp.place(px(if (rtl) 0.0 else cw + m.fabGap), px((h - fh) / 2))
            }
        } else {
            val w = m.height; val fabExtra = if (hasFab) m.fabGap + fh else 0.0
            val avail = maxH?.let { max(0.0, it - fabExtra) }
            val cp = cm.measure(Constraints(px(w), px(w), 0, avail?.let { px(it) } ?: Constraints.Infinity))
            val ch = cp.height / density.toDouble()
            layout(px(w), px(ch + fabExtra)) {
                cp.place(0, 0)
                if (hasFab) fp.place(px((w - fw) / 2), px(ch + m.fabGap))
            }
        }
    }
    if (probe != null) {
        // Focus changes inside a generic bar recompose nothing else: read them here so the probe follows focus.
        order.forEach { it.focused; it.focus.isFocusVisible }
        SideEffect { writeProbe() }
    }
}

/** The items row/column inside the container, with the opt-in scroller (an offset moved by a drag). */
@Composable
private fun ToolbarItems(state: ToolbarState, m: ToolbarMetrics, rtl: Boolean, wrap: Boolean, reverse: Boolean, scrolling: Boolean, fill: Boolean, content: @Composable () -> Unit) {
    Layout(content = content) { measurables, constraints ->
        val d = density.toDouble()
        val children = measurables.map { it.layoutId as? ToolbarChild }
        val order = children.filterNotNull()
        if (order != state.order) state.order = order
        val shown = measurables.indices.filter { children[it]?.hidden != true }
        val placeables = measurables.map { it.measure(Constraints()) }
        val sizes = placeables.map { it.width / d to it.height / d }
        val slots = shown.map { children[it]?.slot ?: "" }
        val main = shown.map { if (m.vertical) sizes[it].second else sizes[it].first }; val cross = shown.map { if (m.vertical) sizes[it].first else sizes[it].second }
        val us = ToolbarFlex.units(slots, main, cross, m.sectionGap)
        val natural = ToolbarFlex.natural(us, m.gap)
        val boundedMain = if (m.vertical) constraints.hasBoundedHeight else constraints.hasBoundedWidth
        val proposedMain = if (boundedMain) (if (m.vertical) constraints.maxHeight else constraints.maxWidth) / d else null
        // A docked bar's items fill its width (justify-content); a floating pill hugs them, up to the space it has.
        val viewport = proposedMain?.let { if (fill) it else min(natural, it) } ?: natural
        val mainLen = if (scrolling) max(viewport, natural) else viewport
        val ls = ToolbarFlex.lines(us, mainLen, m.gap, wrap, reverse)
        val content = ToolbarFlex.cross(us, ls, m.gap)
        val boundedCross = if (m.vertical) constraints.hasBoundedWidth else constraints.hasBoundedHeight
        // A bounded cross size (the floating pill's content box) is the line box the items centre in (align-items: center),
        // overflowing it evenly when they are taller (a padding hook larger than the free space); a docked bar's height is
        // unbounded here and hugs the items.
        val crossLen = if (boundedCross) (if (m.vertical) constraints.maxWidth else constraints.maxHeight) / d else content
        val placed = ToolbarFlex.place(us, ls, shown.map { sizes[it] }, mainLen, crossLen, m.vertical, rtl, m.gap, m.sectionGap, m.justify)
        state.viewport = viewport; state.scrollMax = if (scrolling) max(0.0, natural - viewport) else 0.0
        if (state.scroll > state.scrollMax) state.scroll = state.scrollMax
        val off = if (scrolling) state.scroll else 0.0
        val rects = HashMap<ToolbarChild, List<Double>>(); val spans = HashMap<ToolbarChild, ClosedFloatingPointRange<Double>>()
        val outW = if (m.vertical) crossLen else viewport; val outH = if (m.vertical) viewport else crossLen
        layout((outW * d).roundToInt(), (outH * d).roundToInt()) {
            for ((k, i) in shown.withIndex()) { val pl = placed[k] ?: continue
                var x = pl.x; var y = pl.y
                if (scrolling) { if (m.vertical) y -= off else x += if (rtl) off - (mainLen - viewport) else -off }
                else if (rtl && !m.vertical) x -= (mainLen - viewport)
                placeables[i].place((x * d).roundToInt(), (y * d).roundToInt())
                children[i]?.let { c -> rects[c] = listOf(x, y, sizes[i].first, sizes[i].second); spans[c] = (if (m.vertical) pl.y else pl.x).let { s -> s..(s + if (m.vertical) sizes[i].second else sizes[i].first) } }
            }
        }.also { state.rects = rects; state.spans = spans }
    }
}
