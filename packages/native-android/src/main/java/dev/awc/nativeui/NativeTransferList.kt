package dev.awc.nativeui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.material3.LocalContentColor
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.isPrimaryPressed
import androidx.compose.ui.layout.IntrinsicMeasurable
import androidx.compose.ui.layout.IntrinsicMeasureScope
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.node.LayoutModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextMotion
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// md-transfer-list Compose renderer: two columns (header with the select-all md-checkbox, title and count pill; the md-text-field
// search; the listbox of option rows with a decorative md-checkbox, label and description, or the empty state) around the four
// md-icon-button movers; the ≤ 640 dp stacked layout with rotated movers; RTL mirrored movers; density; the twenty hooks; row
// hover/checked/focus layers (100 ms); the source's check and move rules and events.

private val TLRoboto = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_medium, FontWeight.Medium), Font(R.font.awc_roboto_bold, FontWeight.Bold))

/** A column's block size in its grid row: the definite cap (searchable: `block-size`), stretched to the row up to the cap
 *  (`align-items: stretch` under `max-block-size`), or its content up to the cap (stacked auto rows). A definite cap taller
 *  than the row overflows it, as in CSS. A null cap is `100%` (full-height): the row. */
internal enum class TLBlock { Definite, Stretch, Content }
private data class TLBlockElement(val cap: Double?, val mode: TLBlock) : ModifierNodeElement<TLBlockNode>() {
    override fun create() = TLBlockNode(cap, mode)
    override fun update(node: TLBlockNode) { node.cap = cap; node.mode = mode }
}
private class TLBlockNode(var cap: Double?, var mode: TLBlock) : Modifier.Node(), LayoutModifierNode {
    override fun MeasureScope.measure(measurable: Measurable, constraints: Constraints): MeasureResult {
        val c = cap?.let { it.dp.roundToPx() }; val row = if(constraints.hasBoundedHeight) constraints.maxHeight else null
        val h = when(mode) { TLBlock.Definite -> c ?: row; TLBlock.Stretch -> if(c == null) row else row?.let { kotlin.math.min(it, c) }; TLBlock.Content -> null }
        val p = measurable.measure(if(h != null) constraints.copy(minHeight = h, maxHeight = h)
            else constraints.copy(minHeight = 0, maxHeight = c?.let { if(constraints.hasBoundedHeight) kotlin.math.min(it, constraints.maxHeight) else it } ?: constraints.maxHeight))
        return layout(p.width, constraints.constrainHeight(p.height)) { p.place(0, 0) }
    }
    private fun IntrinsicMeasureScope.capped(content: Int): Int { val c = cap?.let { it.dp.roundToPx() } ?: return content; return if(mode == TLBlock.Definite) c else kotlin.math.min(content, c) }
    override fun IntrinsicMeasureScope.minIntrinsicHeight(measurable: IntrinsicMeasurable, width: Int) = capped(measurable.minIntrinsicHeight(width))
    override fun IntrinsicMeasureScope.maxIntrinsicHeight(measurable: IntrinsicMeasurable, width: Int) = capped(measurable.maxIntrinsicHeight(width))
}

internal val LocalAWCTransferListAppearance = staticCompositionLocalOf { AWCTransferListAppearance() }
/** md-transfer-list hooks for this subtree; nested scopes merge field by field (inner wins). */
@Composable fun AWCTransferListAppearanceScope(appearance: AWCTransferListAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTransferListAppearance provides LocalAWCTransferListAppearance.current.merging(appearance.validated()), content = content)
internal val LocalAWCTransferListPartAppearance = staticCompositionLocalOf { AWCTransferListPartAppearance() }
/** md-transfer-list `::part()` values (typed) for this subtree; nested scopes merge part by part, field by field (inner wins). */
@Composable fun AWCTransferListPartAppearanceScope(parts: AWCTransferListPartAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTransferListPartAppearance provides LocalAWCTransferListPartAppearance.current.merging(parts.validated()), content = content)
internal val LocalAWCTransferListViewport = staticCompositionLocalOf<Double?> { null }
/** The viewport width (dp) the source's `@media (max-width: 640px)` reads; null = the window's. */
@Composable fun AWCTransferListViewportScope(width: Double?, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTransferListViewport provides width, content = content)

/** Parity-test access to a transfer list's interaction state. */
class TransferListProbe(val toggle: (Boolean, String) -> Unit, val search: (Boolean, String) -> Unit, val hover: (Boolean, String?) -> Unit, val focusRow: (Boolean, String) -> Unit,
                        /** Part boxes in root coordinates (px), keyed like the oracle's parts: `column-source`, `item-s:<value>`, `controls`… */
                        val parts: () -> Map<String, androidx.compose.ui.geometry.Rect> = { emptyMap() },
                        /** Clears focus (a press on the page outside the list). */
                        val blur: () -> Unit = {},
                        /** What the Chrome states oracle samples, now. */
                        val snapshot: () -> TransferListSnapshot? = { null })
/** One side as the states oracle samples it: rows (label, checked, background, keyboard ring), the count, the select-all
 *  checkbox (checked, indeterminate, disabled; null when hidden), the search query (null when not searchable), the empty text. */
data class TransferListSideSnapshot(val rows: List<TransferListRowSnapshot>, val count: String, val selectAll: List<Boolean>?, val query: String?, val empty: String?)
data class TransferListRowSnapshot(val label: String, val checked: Boolean, val background: Color, val ring: Boolean)
/** The whole list: value, both sides, the movers (aria-label, disabled) and the focused part (`item-s:<value>`, `select-all-s`,
 *  `search-t`, `mover-right`…; null = outside the list). */
data class TransferListSnapshot(val value: List<String>, val source: TransferListSideSnapshot, val target: TransferListSideSnapshot, val movers: List<Pair<String, Boolean>>, val focus: String?)

/** Row backgrounds transition as CSS colours do: premultiplied Oklab. */
internal val TLPremultipliedOklab = androidx.compose.animation.core.TwoWayConverter<Color, androidx.compose.animation.core.AnimationVector4D>(
    convertToVector = { c -> val o = c.convert(androidx.compose.ui.graphics.colorspace.ColorSpaces.Oklab); val a = c.alpha
        androidx.compose.animation.core.AnimationVector4D(o.red * a, o.green * a, o.blue * a, a) },
    convertFromVector = { v -> val a = v.v4.coerceIn(0f, 1f)
        if(a <= 0f) Color.Transparent else Color((v.v1 / a).coerceIn(0f, 1f), (v.v2 / a).coerceIn(-0.5f, 0.5f), (v.v3 / a).coerceIn(-0.5f, 0.5f), a,
            androidx.compose.ui.graphics.colorspace.ColorSpaces.Oklab).convert(androidx.compose.ui.graphics.colorspace.ColorSpaces.Srgb) })
/** CSS `ease`. */
internal val TLEase = androidx.compose.animation.core.CubicBezierEasing(0.25f, 0.1f, 0.25f, 1f)

internal val LocalAWCTransferListReducedMotion = staticCompositionLocalOf<Boolean?> { null }
/** Overrides the system reduced-motion setting for transfer lists in this subtree (parity tests, the Laboratory's motion toggle). */
@Composable fun AWCTransferListReducedMotionScope(reduced: Boolean?, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTransferListReducedMotion provides reduced, content = content)

internal val LocalAWCTransferListInspector = staticCompositionLocalOf<((TransferListProbe) -> Unit)?> { null }
@Composable fun AWCTransferListInspectionScope(onProbe: (TransferListProbe) -> Unit, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTransferListInspector provides onProbe, content = content)

/** Native counterparts of md-transfer-list's methods (`moveSelectedRight`, `moveSelectedLeft`): the movers' moves with their
 *  events, nothing when disabled or when no visible, enabled item is checked. A controller addresses one list (by node id). */
@Stable class AWCTransferListController {
    internal var mover: ((Boolean) -> Unit)? by mutableStateOf(null)
    val isConnected: Boolean get() = mover != null
    fun moveSelectedRight() { mover?.invoke(true) }
    fun moveSelectedLeft() { mover?.invoke(false) }
}
internal val LocalAWCTransferListControllers = staticCompositionLocalOf { emptyMap<String, AWCTransferListController>() }
/** Attach [controller] to the md-transfer-list with node id [id] rendered inside [content]. */
@Composable fun AWCTransferListControllerScope(controller: AWCTransferListController, id: String, content: @Composable () -> Unit) {
    val inherited = LocalAWCTransferListControllers.current
    CompositionLocalProvider(LocalAWCTransferListControllers provides inherited + (id to controller), content = content)
}

@Composable internal fun NativeTransferList(p: Props, emit: EventSink) {
    val tokens = LocalAWCThemeTokens.current
    val appearance = LocalAWCTransferListAppearance.current
    // `::part()` values (typed): they win over the hooks and every state rule.
    val parts = LocalAWCTransferListPartAppearance.current
    fun partFill(hex: String?) = if(hex == null) Modifier else Modifier.background(transferListRgba(hex).let { Color(it[0].toFloat(), it[1].toFloat(), it[2].toFloat(), it[3].toFloat()) })
    val awcDensity = resolveAWCDensity(p["density"], LocalAWCNativeDensity.current)
    val fullWidth = p.bool("fullWidth", false); val fullHeight = p.bool("fullHeight", false)
    val m = remember(awcDensity, appearance, fullHeight) { TransferListMetrics(awcDensity, appearance, fullHeight) }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val viewport = LocalAWCTransferListViewport.current ?: LocalConfiguration.current.screenWidthDp.toDouble()
    val stacked = viewport <= 640
    val systemReduced = rememberAWCAccessibilityAppearance().first
    val reduced = LocalAWCTransferListReducedMotion.current ?: systemReduced
    val emitNow by rememberUpdatedState(emit)
    fun token(name: String, fallback: String) = tokens["--md-sys-color-$name"] ?: fallback
    fun color(hook: String?, role: String, fallback: String) = (hook ?: token(role, fallback)).let { h -> transferListRgba(h).let { Color(it[0].toFloat(), it[1].toFloat(), it[2].toFloat(), it[3].toFloat()) } }
    val disabled = p.bool("disabled", false); val searchable = p.bool("searchable", true)
    var sourceChecked by remember { mutableStateOf(listOf<String>()) }; var targetChecked by remember { mutableStateOf(listOf<String>()) }
    var sourceQuery by remember { mutableStateOf("") }; var targetQuery by remember { mutableStateOf("") }
    var hover by remember { mutableStateOf<String?>(null) }; var focused by remember { mutableStateOf<String?>(null) }
    // Focus of the nested controls (select-all, search, movers) for the parity snapshot; rows report through `focused`.
    var focusedPart by remember { mutableStateOf<String?>(null) }
    fun Modifier.focusPart(key: String) = this.onFocusChanged { f -> if(f.hasFocus) focusedPart = key else if(focusedPart == key) focusedPart = null }
    val rowTracks = remember { HashMap<String, TLRowTrack>() }
    // The list's frame clock: row transitions start at the frame after the change (the test clock in instrumentation).
    val frame = remember { mutableDoubleStateOf(-1.0) }
    val wake = remember { kotlinx.coroutines.channels.Channel<Unit>(kotlinx.coroutines.channels.Channel.CONFLATED) }
    fun clockNow() = frame.doubleValue.let { if(it < 0) Double.NaN else it }
    val rowRings = remember { HashMap<String, Boolean>() }
    // :hover is a hit test: the row under the mouse or stylus pointer (root coordinates), re-evaluated on every pointer event the
    // list sees and when a row's box changes under a still pointer (Chrome's :hover; removed rows lose it, disabled rows show none).
    val rowRects = remember { HashMap<String, androidx.compose.ui.geometry.Rect>() }
    val pointerAt = remember { arrayOfNulls<Offset>(1) }; val hostLayout = remember { arrayOfNulls<LayoutCoordinates>(1) }
    fun hitRow(p: Offset?) = p?.let { q -> rowRects.entries.firstOrNull { it.value.contains(q) }?.key }
    // The display's frame interval (ms): a transition starts at the frame whose composition saw the change, one frame before the
    // frame loop's first tick (the loop measures it; the display's refresh rate until then).
    val view = androidx.compose.ui.platform.LocalView.current
    val frameMs = remember { doubleArrayOf(1000.0 / (view.display?.refreshRate?.takeIf { it > 1f } ?: 60f)) }
    var value by awcState(p["value"]) { p.list("value").map { it.toString() } }
    val items = remember(p["items"]) { AWCTransferItem.parse(p["items"]) }
    fun logic() = TransferListLogic(items, value, sourceChecked, targetChecked, sourceQuery, targetQuery).also { it.prune() }
    fun commit(l: TransferListLogic) { sourceChecked = l.sourceChecked; targetChecked = l.targetChecked }
    val l = logic()
    LaunchedEffect(items, value) { commit(logic()) }
    val requesters = remember { HashMap<String, androidx.compose.ui.focus.FocusRequester>() }
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    fun requester(id: String) = requesters.getOrPut(id) { androidx.compose.ui.focus.FocusRequester() }
    val inspect = LocalAWCTransferListInspector.current != null
    val partRects = remember { HashMap<String, androidx.compose.ui.geometry.Rect>() }
    // Laboratory inspection: the parts under the component root, named like the SwiftUI renderer (`column-source`, `item-s:<value>`…).
    val inspection = LocalAWCInspection.current
    @Composable fun Modifier.part(key: String): Modifier {
        val probed = if(inspect) this.then(Modifier.onGloballyPositioned { val o = it.positionInRoot(); partRects[key] = androidx.compose.ui.geometry.Rect(o, androidx.compose.ui.geometry.Size(it.size.width.toFloat(), it.size.height.toFloat())) }) else this
        return if(inspection != null) probed.inspectAWCNode(inspection, key, if(key.startsWith("mover-")) "mover" else key.replace(Regex("-(source|target|[st]:.*)$"), "")) else probed
    }
    fun snapshot(): TransferListSnapshot {
        val x = logic()
        fun side(target: Boolean): TransferListSideSnapshot {
            val visible = x.visible(target); val checked = x.checked(target).toSet(); val st = x.selectAll(target); val t = if(target) "t:" else "s:"
            return TransferListSideSnapshot(visible.map { TransferListRowSnapshot(it.label, it.value in checked, rowTracks[t + it.value]?.color(clockNow()) ?: Color.Transparent, rowRings[t + it.value] == true) },
                p.str("countTemplate", "{checked}/{total} selected").replaceFirst("{checked}", st.checked.toString()).replaceFirst("{total}", st.total.toString()),
                if(p.bool("showSelectAll", true)) listOf(st.all, st.some, disabled || st.total == 0) else null,
                if(searchable) (if(target) targetQuery else sourceQuery) else null, if(visible.isEmpty()) p.str("emptyText", "No items") else null)
        }
        val sourceAvailable = x.sourceItems.any { !it.disabled }; val targetAvailable = x.targetItems.any { !it.disabled }
        val movers = listOf(p.str("moveAllRightLabel", "Move all to target") to (disabled || !sourceAvailable), p.str("moveRightLabel", "Move selected to target") to (disabled || x.eligibleChecked(false).isEmpty()),
            p.str("moveLeftLabel", "Move selected to source") to (disabled || x.eligibleChecked(true).isEmpty()), p.str("moveAllLeftLabel", "Move all to source") to (disabled || !targetAvailable))
        val single = p.bool("singleStepOnly", false)
        val ids = if(single) listOf("right", "left") else listOf("all-right", "right", "left", "all-left")
        val part = focusedPart?.let { fp -> if(fp.startsWith("mover#")) ids.getOrNull(fp.substring(6).toIntOrNull() ?: -1)?.let { "mover-$it" } else fp }
        return TransferListSnapshot(x.value, side(false), side(true), if(single) listOf(movers[1], movers[2]) else movers, focused?.let { "item-$it" } ?: part)
    }
    fun move(right: Boolean, all: Boolean) {
        if(disabled) return
        val x = logic(); val r = x.move(right, all) ?: return
        commit(x); value = r.third
        emitNow("mdChange", r.third)
        emitNow("mdMove", mapOf("direction" to r.first, "moved" to r.second, "target" to r.third))
    }
    LocalAWCTransferListInspector.current?.invoke(TransferListProbe({ t, v -> val x = logic(); x.toggle(t, v); commit(x) }, { t, q -> if(t) targetQuery = q else sourceQuery = q },
        { t, v -> hover = v?.let { (if(t) "t:" else "s:") + it } }, { t, v -> focusManager.clearFocus(); runCatching { requester((if(t) "t:" else "s:") + v).requestFocus() } }, { HashMap(partRects) }, { focusManager.clearFocus() }, { snapshot() }))
    val controllers = LocalAWCTransferListControllers.current; val nodeId = p.str("id").ifEmpty { "transfer-list" }
    SideEffect { controllers[nodeId]?.mover = { right -> move(right, false) } }
    val divider = color(appearance.dividerColor, "outline-variant", "#CAC4D0")
    val ink = color(null, "on-surface", "#1C1B1F")
    val rippleOn = LocalAWCRippleEnabled.current && tokens["--md-sys-ripple-enabled"]?.trim() != "0"
    val ctx = androidx.compose.ui.platform.LocalContext.current; val texts = remember(ctx) { TransferListText(ctx) }

    @Composable fun Header(target: Boolean) {
        val st = l.selectAll(target); val title = if(target) p.str("targetTitle", "Chosen") else p.str("sourceTitle", "Choices")
        val count = p.str("countTemplate", "{checked}/{total} selected").replaceFirst("{checked}", st.checked.toString()).replaceFirst("{total}", st.total.toString())
        val side = if(target) "target" else "source"
        val headerDivider = parts.header.borderColor?.let { color(it, "", it) } ?: divider
        Row(Modifier.fillMaxWidth().part("header-$side").background(color(parts.header.backgroundColor ?: appearance.headerColor, "surface-container", "#F3EDF7"))
            .drawWithContent { drawContent(); drawRect(headerDivider, topLeft = Offset(0f, size.height - density), size = Size(size.width, density)) }
            .padding(bottom = 1.dp).padding(horizontal = m.insetLg.dp, vertical = m.insetMd.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(m.gapMd.dp)) {
            if(p.bool("showSelectAll", true)) Box(Modifier.focusPart("select-all-" + (if(target) "t" else "s"))) { AWCComponent("md-checkbox", mapOf("checked" to st.all, "indeterminate" to st.some, "disabled" to (disabled || st.total == 0), "density" to awcDensity,
                "aria-label" to p.str("selectAllLabel", "Select all {title}").replace("{title}", title)), onEvent = { n, _ -> if(n == "mdChange") { val x = logic(); x.toggleSelectAll(target); commit(x) } }) }
            Column(Modifier.weight(1f).part("header-title-$side").then(partFill(parts.headerTitle.backgroundColor))) {
                BasicText(title, Modifier.height(m.titleLine.dp), maxLines = 1, overflow = TextOverflow.Ellipsis,
                    style = TextStyle(fontFamily = TLRoboto, textMotion = TextMotion.Animated, platformStyle = PlatformTextStyle(includeFontPadding = false), color = color(appearance.headerTextColor, "on-surface", "#1C1B1F"), fontSize = m.titleSize.sp, fontWeight = FontWeight.Medium, lineHeight = m.titleLine.sp))
                BasicText(if(rtl) "\u200F" + count else count, Modifier.padding(top = 2.dp).part("count-$side").background(color(parts.count.backgroundColor, "secondary-container", "#E8DEF8"), parts.count.shape?.let { RoundedCornerShape(it.dp) } ?: RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 1.dp)
                    .width(texts.width(count, m.countSize, 500, 0.4).dp).height(m.countLine.dp), softWrap = false,
                    maxLines = 1, style = TextStyle(fontFamily = TLRoboto, textMotion = TextMotion.Animated, platformStyle = PlatformTextStyle(includeFontPadding = false), color = color(parts.count.color, "on-secondary-container", "#1D192B"), fontSize = m.countSize.sp, fontWeight = FontWeight.Medium, lineHeight = m.countLine.sp, letterSpacing = 0.4.sp))
            }
        }
    }
    @Composable fun Search(target: Boolean) {
        val icon = p.str("searchIcon", "search")
        val key = "search-" + (if(target) "t" else "s"); val req = requester(key)
        // Chrome focuses the input on mousedown (the field focuses on the tap's release otherwise).
        Box(Modifier.fillMaxWidth().part("search-" + (if(target) "target" else "source")).focusPart(key).focusRequester(req)
            .pointerInput(disabled) { if(!disabled) awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                if(focusedPart != key) runCatching { req.requestFocus() } } }.then(partFill(parts.search.backgroundColor)).padding(start = m.insetMd.dp, end = m.insetMd.dp, top = m.searchTop.dp, bottom = m.insetSm.dp)) {
            AWCComponent("md-text-field", mapOf("variant" to "outlined", "density" to awcDensity, "clearable" to "internal", "disabled" to disabled,
                "label" to (if(target) p.str("targetSearchPlaceholder", "Search chosen") else p.str("sourceSearchPlaceholder", "Search choices")),
                "value" to (if(target) targetQuery else sourceQuery)), onEvent = { n, d -> if(n == "mdInput") { val q = d?.toString() ?: ""; if(target) targetQuery = q else sourceQuery = q } },
                content = if(icon.isEmpty()) null else ({ slot -> if(slot == "leading-icon") AWCMaterialSymbol(icon) }))
        }
    }
    @Composable fun Row(target: Boolean, item: AWCTransferItem, checked: Boolean, index: Int, scroll: ScrollState) {
        val id = (if(target) "t:" else "s:") + item.value; val off = item.disabled || disabled
        val arrowStep = 40f * androidx.compose.ui.platform.LocalDensity.current.density   // Chrome's arrow-key scroll step
        // :focus-visible: keyboard focus and keys on a focused row show the ring; a press focuses the row without it (browsers focus on mousedown).
        var ring by remember { mutableStateOf(false) }; var pressFocus by remember { mutableStateOf(false) }
        val rippleCtl = remember { AWCRippleController() }
        fun toggle() { val x = logic(); x.toggle(target, item.value); commit(x) }
        val tint = if(checked) token("primary", "#6750A4") else token("on-surface", "#1C1B1F")
        val layer = if(off) 0.0 else if(checked) (if(hover == id || ring) 0.12 else 0.08) else if(ring) 0.12 else if(hover == id) 0.08 else 0.0
        // `transition: background-color 100ms ease` (none under reduced motion), interpolated as CSS does.
        val target0 = color(tint, "", tint).copy(alpha = layer.toFloat())
        val track = remember { TLRowTrack(target0) }
        val now = clockNow()
        if(track.set(target0, now, if(reduced) 0.0 else 100.0)) SideEffect { wake.trySend(Unit) }
        // A row that leaves (moved, filtered) takes its hover with it (no exit event reaches a removed node).
        DisposableEffect(id) { rowTracks[id] = track; onDispose { if(rowTracks[id] === track) rowTracks.remove(id); rowRings.remove(id); rowRects.remove(id); if(hover == id) hover = null } }
        SideEffect { rowRings[id] = ring; rowTracks[id] = track }
        // `::part(item) { background-color }` replaces the state layers (the outer tree's declaration wins over the hover / checked / focus rules).
        val bg = parts.item.backgroundColor?.let { color(it, "", it) } ?: track.color(now); val corner = parts.item.shape ?: 8.0
        Row(Modifier.padding(horizontal = m.itemInset.dp).fillMaxWidth().part("item-$id").alpha(if(item.disabled) 0.38f else 1f)
            // The md-ripple wave paints over the row's background and under its (positioned) md-checkbox, as in the source.
            .clip(RoundedCornerShape(corner.dp)).drawBehind { drawRect(bg)
                if(rippleOn) rippleCtl.wave?.let { w -> drawCircle(ink.copy(alpha = ink.alpha * w.opacity.toFloat()), (w.radius * w.scale * density).toFloat(), Offset((w.x * density).toFloat(), (w.y * density).toFloat())) } }
            .drawWithContent { drawContent(); if(ring) { val w = 3 * density; drawRoundRect(color(null, "secondary", "#625B71"), topLeft = Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w), cornerRadius = CornerRadius((corner.toFloat() * density - w / 2).coerceAtLeast(0f)), style = Stroke(w)) } }
            .awcRipple(disabled = off, cornerRadius = corner.dp, controller = rippleCtl, hidden = true)
            .focusRequester(requester(id))
            .onFocusChanged { f -> focused = if(f.isFocused) id else if(focused == id) null else focused; ring = f.isFocused && !pressFocus; if(!f.isFocused) pressFocus = false }
            .focusable(!off)
            // Web: the arrow keys never move focus between the options (Tab does) — they scroll the list. A keyboard keeps that; a D-pad
            // (a non-alphabetic device: no Tab key) keeps Android's directional focus navigation.
            .onKeyEvent { e -> if(off) false
                else if((e.key == Key.DirectionDown || e.key == Key.DirectionUp || e.key == Key.DirectionLeft || e.key == Key.DirectionRight)
                    && e.nativeKeyEvent.device?.keyboardType != android.view.InputDevice.KEYBOARD_TYPE_NON_ALPHABETIC) {
                    if(e.type == KeyEventType.KeyDown) { ring = true
                        if(e.key == Key.DirectionDown) scroll.dispatchRawDelta(arrowStep) else if(e.key == Key.DirectionUp) scroll.dispatchRawDelta(-arrowStep) }
                    true }
                else if(e.type != KeyEventType.KeyDown) false else { ring = true
                if(e.key == Key.Spacebar || e.key == Key.Enter || e.key == Key.NumPadEnter) { toggle(); true } else false } }
            .onGloballyPositioned { c -> val r = c.boundsInRoot(); if(rowRects[id] != r) { rowRects[id] = r
                val p = pointerAt[0]; if(p != null) { if(r.contains(p)) { if(hover != id) hover = id } else if(hover == id) hover = hitRow(p) } } }
            .pointerInput(id, off) { if(!off) awaitEachGesture { val down = awaitFirstDown(requireUnconsumed = false)
                if(down.type == PointerType.Mouse && !currentEvent.buttons.isPrimaryPressed) return@awaitEachGesture
                if(focused != id) { pressFocus = true; runCatching { requester(id).requestFocus() } }
                if(waitForUpOrCancellation() != null) toggle() } }
            // role="option" in the listbox: a selectable item of the list's collection, disabled rows included.
            // The option's name is its label and its description, once (a merged node would read the contentDescription and the texts both; a
            // disabled row's texts are not exposed to the checker at all).
            .clearAndSetSemantics { contentDescription = if(item.description.isEmpty()) item.label else item.label + " " + item.description; selected = checked; collectionItemInfo = CollectionItemInfo(index, 1, 0, 1); if(off) disabled() else onClick { toggle(); true } }
            .absolutePadding(left = m.itemPad.left.dp, top = m.itemPad.top.dp, right = m.itemPad.right.dp, bottom = m.itemPad.bottom.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(m.itemGap.dp)) {
            // `inert`: out of the focus order and of hit testing (an overlay takes the presses, unconsumed, for the row).
            Box(Modifier.focusProperties { canFocus = false }.clearAndSetSemantics { }) { AWCComponent("md-checkbox", mapOf("checked" to checked, "disabled" to off, "density" to awcDensity, "inert" to true, "aria-hidden" to "true"))
                Box(Modifier.matchParentSize().pointerInput(Unit) { awaitPointerEventScope { while(true) awaitPointerEvent() } }) }
            Column(Modifier.weight(1f)) {
                BasicText(item.label, Modifier.height((m.labelSize * 1.4).dp), maxLines = 1, overflow = TextOverflow.Ellipsis, style = TextStyle(fontFamily = TLRoboto, textMotion = TextMotion.Animated, platformStyle = PlatformTextStyle(includeFontPadding = false), color = color(null, "on-surface", "#1C1B1F"), fontSize = m.labelSize.sp, lineHeight = (m.labelSize * 1.4).sp))
                if(item.description.isNotEmpty()) BasicText(item.description, Modifier.height((m.descSize * 1.35).dp), maxLines = 1, overflow = TextOverflow.Ellipsis,
                    style = TextStyle(fontFamily = TLRoboto, textMotion = TextMotion.Animated, platformStyle = PlatformTextStyle(includeFontPadding = false), color = color(null, "on-surface-variant", "#49454F"), fontSize = m.descSize.sp, lineHeight = (m.descSize * 1.35).sp))
            }
        }
    }
    @Composable fun ColumnView(target: Boolean, mod: Modifier, block: TLBlock) {
        val visible = l.visible(target); val checked = l.checked(target).toSet()
        val side = if(target) "target" else "source"
        // `::part(column-source)` / `::part(column-target)` over `::part(column)`.
        val part = parts.column.merging(if(target) parts.columnTarget else parts.columnSource); val shape = RoundedCornerShape((part.shape ?: m.shape).dp)
        Column(mod.then(TLBlockElement(m.columnMaxBlock, block)).part("column-$side").widthIn(min = m.columnMinWidth.dp)
            .clip(shape).background(color(part.backgroundColor ?: appearance.containerColor, "surface-container-low", "#F7F2FA"))
            .border(1.dp, part.borderColor?.let { color(it, "", it) } ?: divider, shape).padding(1.dp)) {
            Header(target)
            if(searchable) Search(target)
            if(visible.isEmpty()) Column(Modifier.fillMaxWidth().part("empty-$side").then(partFill(parts.empty.backgroundColor)).padding(horizontal = m.insetLg.dp, vertical = m.emptyPad.dp).semantics { liveRegion = LiveRegionMode.Polite },
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(m.gapSm.dp)) {
                p.str("emptyIcon", "").takeIf { it.isNotEmpty() }?.let { CompositionLocalProvider(LocalContentColor provides color(parts.emptyIcon.color ?: parts.empty.color, "on-surface-variant", "#49454F")) {
                    AWCMaterialSymbol(it, Modifier.alpha((parts.emptyIcon.opacity ?: 0.9).toFloat()).clearAndSetSemantics { }, size = (parts.emptyIcon.size ?: m.emptyIcon).dp) } }
                BasicText(p.str("emptyText", "No items"), style = TextStyle(fontFamily = TLRoboto, textMotion = TextMotion.Animated, platformStyle = PlatformTextStyle(includeFontPadding = false), color = color(parts.empty.color, "on-surface-variant", "#49454F"), fontSize = m.emptySize.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center))
            } else { val scroll = rememberScrollState(); Column(Modifier.fillMaxWidth().weight(1f, fill = block != TLBlock.Content).part("list-$side").then(partFill(parts.list.backgroundColor))
                // A disabled list keeps its scroll region keyboard-reachable (tabindex 0) and takes the presses its rows ignore.
                .then(if(disabled) Modifier.focusRequester(requester("list-$side")).focusPart("list-" + (if(target) "t" else "s")).focusable()
                    .pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false); runCatching { requester("list-$side").requestFocus() } } } else Modifier)
                .verticalScroll(scroll).padding(vertical = m.insetXs.dp)
                .semantics { contentDescription = if(target) p.str("targetTitle", "Chosen") else p.str("sourceTitle", "Choices"); collectionInfo = CollectionInfo(visible.size, 1) },
                verticalArrangement = Arrangement.spacedBy(2.dp)) { visible.forEachIndexed { i, it -> key(it.value) { Row(target, it, it.value in checked, i, scroll) } } } }
        }
    }
    @Composable fun Movers(row: Boolean) {
        val sourceAvailable = l.sourceItems.any { !it.disabled }; val targetAvailable = l.targetItems.any { !it.disabled }
        data class Mover(val id: String, val icon: String, val label: String, val variant: String, val off: Boolean, val right: Boolean, val all: Boolean)
        val movers = listOf(Mover("all-right", p.str("moveAllRightIcon", "keyboard_double_arrow_right"), p.str("moveAllRightLabel", "Move all to target"), "tonal", disabled || !sourceAvailable, true, true),
            Mover("right", p.str("moveRightIcon", "chevron_right"), p.str("moveRightLabel", "Move selected to target"), "filled", disabled || l.eligibleChecked(false).isEmpty(), true, false),
            Mover("left", p.str("moveLeftIcon", "chevron_left"), p.str("moveLeftLabel", "Move selected to source"), "filled", disabled || l.eligibleChecked(true).isEmpty(), false, false),
            Mover("all-left", p.str("moveAllLeftIcon", "keyboard_double_arrow_left"), p.str("moveAllLeftLabel", "Move all to source"), "tonal", disabled || !targetAvailable, false, true))
            .filter { !(p.bool("singleStepOnly", false) && it.all) }
        @Composable fun one(slot: Int, mv: Mover) {
            // Chrome keeps a button that becomes disabled under focus as the active element (Tab continues from it; Space and Enter do
            // nothing). Compose drops focus from a node that stops being focusable, so while it holds focus a disabled mover is
            // soft-disabled (the disabled paint and semantics, still focusable, no activation) and hard-disabled once focus leaves.
            // Focus is tracked by slot: the source re-renders its unkeyed buttons in place (focus keeps the slot when the set changes).
            var held by remember { mutableStateOf(false) }
            val offNow by rememberUpdatedState(mv.off)
            val button = remember { androidx.compose.ui.focus.FocusRequester() }
            val keep = mv.off && held
            Box(Modifier.onFocusChanged { f -> held = f.hasFocus; if(f.hasFocus) focusedPart = "mover#$slot" else if(focusedPart == "mover#$slot") focusedPart = null }
                .part("mover-" + mv.id)
                // A press focuses an enabled mover (Chrome focuses a button on mousedown; Compose buttons take focus outside touch mode).
                .pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                    if(!offNow) runCatching { button.requestFocus() } } }
                .rotate(if(row) 90f else 0f).scale(if(!row && rtl) -1f else 1f, 1f)) {
                AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconSize = m.controlIconSize, width = m.controlSize, height = m.controlSize)) {
                    AWCComponent("md-icon-button", mapOf("variant" to mv.variant, "icon" to mv.icon, "disabled" to (mv.off && !keep), "softDisabled" to keep, "aria-label" to mv.label, "density" to awcDensity),
                        Modifier.focusRequester(button), onEvent = { n, _ -> if(n == "mdClick" && !offNow) move(mv.right, mv.all) })
                }
            }
        }
        if(row) Row(Modifier.fillMaxWidth().part("controls").then(partFill(parts.controls.backgroundColor)).padding(vertical = m.insetMd.dp), horizontalArrangement = Arrangement.spacedBy(m.controlsGap.dp, Alignment.CenterHorizontally)) { movers.forEachIndexed { i, mv -> one(i, mv) } }
        else Column(Modifier.fillMaxHeight().part("controls").then(partFill(parts.controls.backgroundColor)).padding(horizontal = m.insetXs.dp), verticalArrangement = Arrangement.spacedBy(m.controlsGap.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) { movers.forEachIndexed { i, mv -> one(i, mv) } }
    }
    // Host box: min/max beat inline-/block-size (CSS), full-width/full-height beat the size hooks; the grid row is at least the host's min block size.
    Box(Modifier.widthIn(min = (appearance.minWidth ?: 0.0).dp, max = appearance.maxWidth?.dp ?: androidx.compose.ui.unit.Dp.Unspecified)
        .heightIn(min = (appearance.minHeight ?: 0.0).dp, max = appearance.maxHeight?.dp ?: androidx.compose.ui.unit.Dp.Unspecified)
        .then(if(fullWidth) Modifier.fillMaxWidth() else appearance.width?.let { Modifier.width(it.dp) } ?: Modifier.fillMaxWidth())
        .then(if(fullHeight) Modifier.fillMaxHeight() else appearance.height?.let { Modifier.height(it.dp) } ?: Modifier)
        .semantics { isTraversalGroup = true; if(disabled) this.disabled() }
        .onGloballyPositioned { hostLayout[0] = it }
        .pointerInput(Unit) { awaitPointerEventScope { while(true) { val e = awaitPointerEvent(PointerEventPass.Initial); val c = e.changes.firstOrNull() ?: continue
            if(c.type != PointerType.Mouse && c.type != PointerType.Stylus) continue
            if(e.type == PointerEventType.Exit) { pointerAt[0] = null; hover = null; continue }
            val at = hostLayout[0]?.takeIf { it.isAttached }?.localToRoot(c.position) ?: continue
            pointerAt[0] = at; val h = hitRow(at); if(hover != h) hover = h } } }, propagateMinConstraints = true) {
        val block = if(searchable) TLBlock.Definite else TLBlock.Stretch
        if(stacked) Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(m.gapLg.dp)) {
            val b = if(searchable && m.columnMaxBlock != null) TLBlock.Definite else TLBlock.Content
            ColumnView(false, Modifier.fillMaxWidth(), b); Movers(true); ColumnView(true, Modifier.fillMaxWidth(), b) }
        else Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(m.gapLg.dp)) { ColumnView(false, Modifier.weight(1f), block); Movers(false); ColumnView(true, Modifier.weight(1f), block) }
    }
    // The tick runs inside the frame callback, before the frame's recomposition (code after withFrameMillis resumes through the
    // dispatcher, after it): a change composed in frame F is ticked first in F + 1, one frame after the frame that drew it.
    LaunchedEffect(Unit) { var last = Double.NaN; while(true) { wake.receive()
        do { val ft = androidx.compose.runtime.withFrameMillis { millis -> val t = millis.toDouble()
                if(!last.isNaN() && t - last > 0.5 && t - last < 50) frameMs[0] = t - last; last = t
                rowTracks.values.forEach { it.tick(t, frameMs[0]) }; frame.doubleValue = t; t }
        } while(rowTracks.values.any { it.running(ft) })
        last = Double.NaN } }
}

/** `#RRGGBB[AA]` → sRGB channels and alpha, 0…1. */
internal fun transferListRgba(hex: String): List<Double> {
    val h = hex.trim().trim('#'); val v = h.toLongOrNull(16) ?: 0L; val a = h.length == 8; val rgb = if(a) v shr 8 else v
    return listOf(((rgb shr 16) and 255) / 255.0, ((rgb shr 8) and 255) / 255.0, (rgb and 255) / 255.0, if(a) (v and 255) / 255.0 else 1.0)
}

/** A row's `transition: background-color 100ms ease` on the list's frame clock: from the colour shown when the target changes,
 *  starting at the frame whose composition sees the change (Chrome starts a transition at the frame that sees the change),
 *  interpolated in premultiplied Oklab; a zero duration (reduced motion) switches at once. */
internal class TLRowTrack(c: Color) {
    var target = c; private set
    private var from = TLPremultipliedOklab.convertToVector(c); private var to = from
    private var start = Double.NaN; private var duration = 0.0
    /** The transition this one interrupts: it keeps running until this one starts, and its value at this one's start frame is
     *  where this one begins (Chrome: the style change at that frame sees the running transition's current value). */
    private var pFrom = from; private var pTo = to; private var pStart = Double.NaN; private var pDuration = 0.0
    /** Retargets; true when a transition starts (the frame loop must run). */
    fun set(c: Color, now: Double, ms: Double): Boolean {
        if(c == target) return false
        val cur = vector(now)
        if(start.isNaN()) { pFrom = cur; pTo = cur; pStart = Double.NaN; pDuration = 0.0 } else { pFrom = from; pTo = to; pStart = start; pDuration = duration }
        target = c; from = cur; to = TLPremultipliedOklab.convertToVector(c); duration = ms; start = Double.NaN
        return ms > 0
    }
    /** The loop's first frame after the change: the transition began at the frame whose composition saw it (one frame earlier),
     *  where Chrome's style change starts it. */
    fun tick(ft: Double, frameMs: Double) { if(start.isNaN() && duration > 0) { start = ft - frameMs; from = seg(pFrom, pTo, pStart, pDuration, start) } }
    fun running(now: Double) = duration > 0 && (start.isNaN() || now.isNaN() || now < start + duration)
    private fun seg(a: androidx.compose.animation.core.AnimationVector4D, b: androidx.compose.animation.core.AnimationVector4D, s: Double, d: Double, now: Double): androidx.compose.animation.core.AnimationVector4D {
        if(d <= 0) return if(s.isNaN()) a else b
        if(s.isNaN() || now.isNaN()) return a
        val p = ((now - s) / d).coerceIn(0.0, 1.0); if(p >= 1.0) return b
        val e = TLEase.transform(p.toFloat())
        return androidx.compose.animation.core.AnimationVector4D(a.v1 + (b.v1 - a.v1) * e, a.v2 + (b.v2 - a.v2) * e, a.v3 + (b.v3 - a.v3) * e, a.v4 + (b.v4 - a.v4) * e)
    }
    private fun vector(now: Double): androidx.compose.animation.core.AnimationVector4D {
        if(duration <= 0) return to
        if(start.isNaN()) return seg(pFrom, pTo, pStart, pDuration, now)
        return seg(from, to, start, duration, now)
    }
    fun color(now: Double): Color = TLPremultipliedOklab.convertFromVector(vector(now))
}
