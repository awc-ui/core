package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.delay
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** `--md-side-sheet-container-shape`: a `border-radius` shorthand applied to detached sheets only. */
typealias AWCSideSheetShape = AWCBottomSheetShape

/** The nine public md-side-sheet hooks (`--md-side-sheet-*`); width fractions resolve against the containing block. */
@Immutable data class AWCSideSheetAppearance(
    val containerColor: String? = null, val containerShape: AWCSideSheetShape? = null, val headlineColor: String? = null, val contentColor: String? = null,
    val scrimColor: String? = null, val dividerColor: String? = null, val iconColor: String? = null,
    val width: AWCSkeletonLength? = null, val maxWidth: AWCSkeletonLength? = null,
) {
    internal fun normalized() = copy(containerColor = awcModalColor(containerColor), containerShape = containerShape?.takeIf { it.valid }, headlineColor = awcModalColor(headlineColor),
        contentColor = awcModalColor(contentColor), scrimColor = awcModalColor(scrimColor), dividerColor = awcModalColor(dividerColor), iconColor = awcModalColor(iconColor))
    companion object {
        /** From plain data (Laboratory/IR): hook names in camelCase; the shape as [AWCBottomSheetShape.fromValues], widths as [AWCSkeletonLength.fromValues]. */
        fun fromValues(values: Map<String, Any?>): AWCSideSheetAppearance {
            fun s(k: String) = (values[k] as? String)?.takeIf { it.isNotEmpty() }
            fun l(k: String) = AWCSkeletonLength.fromValues(values[k])
            return AWCSideSheetAppearance(s("containerColor"), AWCBottomSheetShape.fromValues(values["containerShape"]), s("headlineColor"), s("contentColor"), s("scrimColor"),
                s("dividerColor"), s("iconColor"), l("width"), l("maxWidth")).normalized()
        }
    }
    fun merge(o: AWCSideSheetAppearance) = AWCSideSheetAppearance(o.containerColor ?: containerColor, o.containerShape ?: containerShape, o.headlineColor ?: headlineColor,
        o.contentColor ?: contentColor, o.scrimColor ?: scrimColor, o.dividerColor ?: dividerColor, o.iconColor ?: iconColor, o.width ?: width, o.maxWidth ?: maxWidth)
}

/** The nine md-side-sheet parts (`::part(...)`; the back wrapper has none). */
enum class AWCSideSheetPart(val source: String) {
    Scrim("scrim"), Container("container"), Header("header"), Headline("headline"), Close("close"),
    DividerTop("divider-top"), DividerBottom("divider-bottom"), Content("content"), Actions("actions")
}
internal val LocalAWCSideSheetAppearance = staticCompositionLocalOf { AWCSideSheetAppearance() }
internal val LocalAWCSideSheetTargets = staticCompositionLocalOf<Map<String, AWCSideSheetAppearance>> { emptyMap() }
internal val LocalAWCSideSheetParts = staticCompositionLocalOf<Map<String, AWCModalPartAppearance>> { emptyMap() }
/** md-side-sheet hooks for every side sheet below, or only the sheet whose `id` property is [id]. */
@Composable fun AWCSideSheetAppearanceScope(appearance: AWCSideSheetAppearance, id: String? = null, content: @Composable () -> Unit) {
    val value = appearance.normalized()
    if (id == null) CompositionLocalProvider(LocalAWCSideSheetAppearance provides LocalAWCSideSheetAppearance.current.merge(value), content = content)
    else { val t = LocalAWCSideSheetTargets.current
        CompositionLocalProvider(LocalAWCSideSheetTargets provides t + (id to (t[id] ?: AWCSideSheetAppearance()).merge(value)), content = content) }
}
/** Style one md-side-sheet part (`::part(name)`) for every side sheet below, or only [id]. */
@Composable fun AWCSideSheetPartAppearanceScope(part: AWCSideSheetPart, appearance: AWCModalPartAppearance, id: String? = null, content: @Composable () -> Unit) {
    val key = if (id == null) part.source else "$id|${part.source}"
    val parts = LocalAWCSideSheetParts.current
    CompositionLocalProvider(LocalAWCSideSheetParts provides parts + (key to (parts[key] ?: AWCModalPartAppearance()).merge(appearance.normalized())), content = content)
}
/** Source methods `show()`, `close()` and `whenClosed()` (after the current open cycle and its exit motion). */
@Stable class AWCSideSheetController {
    internal var showAction: () -> Unit = {}
    internal var closeAction: () -> Unit = {}
    internal var openState: () -> Boolean = { false }
    internal var exiting: () -> Boolean = { false }
    val isOpen get() = openState()
    fun show() = showAction()
    fun close() = closeAction()
    suspend fun whenClosed() { do { delay(16) } while (openState() || exiting()) }
}
internal val LocalAWCSideSheetController = staticCompositionLocalOf<AWCSideSheetController?> { null }
/** Binds [controller] to the md-side-sheet rendered directly below. */
@Composable fun AWCSideSheetControllerScope(controller: AWCSideSheetController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCSideSheetController provides controller, content = content)

internal data class AWCSideSheetModel(val p: Props) {
    val modal = p.str("variant") == "modal"; val start = p.str("side") == "start"
    val headline = p.str("headline"); val closeable = p.bool("closeable", true); val showBack = p.bool("showBack")
    val scrimDismissible = p.bool("scrimDismissible", true); val topDivider = p.bool("topDivider"); val bottomDivider = p.bool("bottomDivider")
    val detached = p.bool("detached"); val ariaLabel = p.str("sheetAriaLabel", p.str("aria-label"))
    val density: Double? = (p["density"] as? Number)?.toDouble(); val hidden = p.bool("hidden")
}

internal class NativeSideSheetState(id: String) {
    val clock = AWCModalClock()
    val opacity = AWCCSSTransitionTrack(); val fraction = AWCCSSTransitionTrack().also { it.snap(1.0) }
    val pending = mutableListOf<(Double) -> Unit>()
    var emitted: Boolean? = null; var acquired = false
    val owner = AWCModalOwner(id)
    val contentGroup = FocusRequester(); val actionsGroup = FocusRequester()
    val container = FocusRequester(); var containerWanted = false; var containerFocused by mutableStateOf(false)
    var closeFocused by mutableStateOf(false); var backFocused by mutableStateOf(false); var focusWithin = false
    var focusSerial by mutableIntStateOf(0)
    var surfaceAttached = false
    fun running(now: Double) = pending.isNotEmpty() || opacity.isRunning(now) || fraction.isRunning(now)
    fun later(op: (Double) -> Unit) { pending += op; clock.version++ }
}

/**
 * md-side-sheet: `standard` is an inline region in the authored layout (no modal resources, no focus move or trap,
 * hidden when closed); `modal` is a fixed overlay in the nearest [AWCModalScope] sliding from its logical side.
 * Events: mdOpen/mdClose on every open change; the fallback close emits mdCancel then mdClose in both variants; modal
 * Escape/back and scrim emit mdCancel then mdClose only when `scrimDismissible` (protected Escape is consumed, a
 * protected scrim tap blurs); the back control emits mdBack and stays open; `close()` emits mdClose only.
 */
@Composable
internal fun NativeSideSheetRenderer(p: Props, onEvent: EventSink, slot: Slot?) {
    val m = AWCSideSheetModel(p)
    val emit by rememberUpdatedState(onEvent)
    var open by awcState(p["open"]) { p.bool("open") }
    val identity = remember { "md-side-sheet-" + java.util.UUID.randomUUID() }
    val s = remember { NativeSideSheetState(identity) }
    val tokens = LocalAWCThemeTokens.current
    val reduced = rememberAWCAccessibilityAppearance().first
    val standard = accordionCubicBezierCurve(tokens["--md-sys-motion-easing-standard"]) ?: listOf(.2, 0.0, 0.0, 1.0)
    val emphasized = accordionCubicBezierCurve(tokens["--md-sys-motion-easing-emphasized"]) ?: listOf(.2, 0.0, 0.0, 1.0)
    val duration = if (reduced) 0.0 else cardDuration(tokens, "--md-sys-motion-duration-medium2", 300.0)
    val now = s.clock.frameMillis
    val active = open && !m.hidden
    val slots = ModalSlots(LocalAWCSlots.current, slot)
    val parts = LocalAWCSideSheetParts.current
    val id = p.str("id")
    val part = { x: AWCSideSheetPart -> (parts[x.source] ?: AWCModalPartAppearance()).merge(parts["$id|${x.source}"] ?: AWCModalPartAppearance()) }
    val appearance = LocalAWCSideSheetAppearance.current.merge(LocalAWCSideSheetTargets.current[id] ?: AWCSideSheetAppearance())
    val controller = LocalAWCSideSheetController.current
    // The standard variant has no shell transition (it is `display: none` when closed).
    fun begin(a: Boolean) { val dur = if (m.modal) duration else 0.0
        s.later { ms -> s.opacity.set(if (a) 1.0 else 0.0, ms, dur, standard); s.fraction.set(if (a) 0.0 else 1.0, ms, dur, emphasized) } }
    fun sync(value: Boolean) {
        val a = value && !m.hidden
        if (s.emitted == null) { s.emitted = a; if (a) { begin(true); emit("mdOpen", null) }; return }
        if (a == s.emitted) return
        s.emitted = a; begin(a); emit(if (a) "mdOpen" else "mdClose", null)
    }
    SideEffect { sync(open) }
    SideEffect {
        controller?.let { c -> c.showAction = { if (!open) { open = true; sync(true) } }; c.closeAction = { if (open) { open = false; sync(false) } }
            c.openState = { open }; c.exiting = { s.running(s.clock.frameMillis) } }
    }
    AWCModalTicker(s.clock, { s.running(it) }) { ms -> val ops = s.pending.toList(); s.pending.clear(); ops.forEach { it(ms) } }
    val name = m.ariaLabel.ifEmpty { if (m.headline.isNotEmpty() || slots.registered("headline")) m.headline else "Side sheet" }
    val outer = LocalAWCModalSession.current
    fun cancel() {
        // A standard sheet hidden with focus inside drops focus to the document (`<body>`), as the source does.
        if (!m.modal && s.focusWithin) outer?.blur()
        emit("mdCancel", null); open = false; sync(false)
    }
    SideEffect { controller?.let { c -> c.closeAction = { if (open) { if (!m.modal && s.focusWithin) outer?.blur(); open = false; sync(false) } } } }
    if (!m.modal) {
        if (active) StandardSideSheet(m, s, appearance, slots, part, name, { cancel() }, tokens)
        return
    }
    val visible = !m.hidden && (open || s.running(now) || s.opacity.presented(now) > 1e-4)
    AWCModalImplicitScope(visible) {
        val session = LocalAWCModalSession.current
        // Switching presentation while open acquires or releases the session without an mdOpen/mdClose cycle.
        SideEffect {
            if (active && !s.acquired && session != null) { session.acquire(s.owner); s.acquired = true; s.focusSerial++ }
            else if (!active && s.acquired) { session?.release(identity); s.acquired = false }
        }
        DisposableEffect(session) { onDispose { if (s.acquired) { session?.release(identity); s.acquired = false } } }
        fun dismiss() { if (open && session?.isTop(identity) != false) cancel() }
        SideEffect {
            s.owner.containerHasFocus = { s.containerFocused }
            s.owner.groups = listOf(s.contentGroup, s.actionsGroup)
            s.owner.escape = { if (open && session?.isTop(identity) != false) { if (m.scrimDismissible) dismiss(); true } else false }
            s.owner.focusContainer = { s.containerWanted = true; runCatching { s.container.requestFocus() }.getOrDefault(false) }
        }
        LaunchedEffect(s.focusSerial) {
            if (s.focusSerial == 0) return@LaunchedEffect
            var frames = 0
            do { withFrameNanos { }; frames++ } while (!s.surfaceAttached && frames < 10)
            if (open && session?.isTop(identity) == true) session.focusFirst(s.owner)
        }
        val context = currentCompositionLocalContext
        // Source `--md-sys-z-index-dialog-scrim` (1001) surface over its `--md-sys-z-index-popup` (1000) scrim.
        // Two layers, as in the source: the scrim (1000) and the surface (1001) sort independently (Chrome's stacking).
        for (layer in 0..1) key(layer) {
            AWCModalEntryEffect(session, if (layer == 0) "$identity#scrim" else identity, visible, if (layer == 0) 1000.0 else 1001.0) {
                CompositionLocalProvider(context) {
                    CompositionLocalProvider(LocalAWCSideSheetController provides null, LocalAWCSlots provides null) {
                        ModalSideShell(m, s, session, appearance, slots, part, reduced, active, name, ::dismiss,
                            { if (open && session?.isTop(identity) != false) cancel() },
                            { if (open && m.showBack && session?.isTop(identity) != false) emit("mdBack", null) }, tokens, layer)
                    }
                }
            }
        }
        Box(Modifier.size(0.dp).semantics { hideFromAccessibility() })
    }
}

private fun widthOf(a: AWCSideSheetAppearance, d: Double, basis: Double?): Double {
    val w = a.width ?: AWCSkeletonLength(points = max(280.0, 360 + 16 * d)); val mx = a.maxWidth ?: AWCSkeletonLength(points = max(320.0, 400 + 16 * d))
    return if (basis != null) max(0.0, minOf(w.points + w.fraction * basis, basis, mx.points + mx.fraction * basis)) else max(0.0, min(w.points, mx.points))
}

@Composable
private fun StandardSideSheet(m: AWCSideSheetModel, s: NativeSideSheetState, a: AWCSideSheetAppearance, slots: ModalSlots, part: (AWCSideSheetPart) -> AWCModalPartAppearance,
                              name: String, close: () -> Unit, tokens: Map<String, String>) {
    val d = resolveAWCDensity(m.density, LocalAWCNativeDensity.current)
    val dens = LocalDensity.current.density
    val inset = if (m.detached) 16.0 else 0.0
    val inspector = LocalAWCModalInspector.current
    if (inspector != null) {
        val values = AWCModalInspection { mapOf("role" to "region", "label" to name, "open" to true,
            "focus" to if (s.closeFocused) "close-button" else if (s.containerFocused) "container" else "") }
        SideEffect { inspector(m.p.str("id"), values) }
    }
    // Host box: `inline-size: min(width, 100%)`, `max-inline-size: min(max-width, 100%)`, `block-size: 100%`.
    Layout(modifier = Modifier.inspectAWCNode(LocalAWCInspection.current, "host", "host"), content = {
        // The fallback controls must not see the authored slot registry (slot content renders through [slots]).
        CompositionLocalProvider(LocalAWCSlots provides null, LocalAWCSideSheetController provides null) {
            SideContainer(m, s, null, a, slots, part, d, false, name, close, {}, tokens)
        }
    }) { measurables, c ->
        val basis = if (c.hasBoundedWidth) c.maxWidth / dens.toDouble() else null
        val w = (widthOf(a, d, basis) * dens).roundToInt()
        val i = (inset * dens).roundToInt()
        val pl = if (c.hasBoundedHeight) measurables.first().measure(Constraints.fixed(max(0, w - 2 * i), max(0, c.maxHeight - 2 * i)))
            else measurables.first().measure(Constraints(minWidth = max(0, w - 2 * i), maxWidth = max(0, w - 2 * i)))
        val h = if (c.hasBoundedHeight) c.maxHeight else pl.height + 2 * i
        layout(w, h) { pl.placeRelative(i, i) }
    }
}

@Composable
private fun ModalSideShell(m: AWCSideSheetModel, s: NativeSideSheetState, session: AWCModalSession?, a: AWCSideSheetAppearance, slots: ModalSlots,
                           part: (AWCSideSheetPart) -> AWCModalPartAppearance, reduced: Boolean, open: Boolean, name: String, dismiss: () -> Unit,
                           close: () -> Unit, back: () -> Unit, tokens: Map<String, String>, layer: Int = 1) {
    val inspection = LocalAWCInspection.current
    val d = resolveAWCDensity(m.density, LocalAWCNativeDensity.current)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val vw = session?.viewportWidth ?: 0.0; val vh = session?.viewportHeight ?: 0.0
    val t = s.clock.frameMillis
    val opacity = if (reduced) (if (open) 1.0 else 0.0) else s.opacity.presented(t)
    val fraction = if (reduced) (if (open) 0.0 else 1.0) else s.fraction.presented(t)
    // Inline size `min(width, room)` capped by `min(max-width, room)` (room: 100%, or `max(0, 100% − 32)` detached).
    val room = if (m.detached) max(0.0, vw - 32) else vw
    val width = min(widthOf(a, d, vw), room)
    val right = !m.start != rtl
    val inline = if (m.detached) 16.0 else 0.0
    val top = if (m.detached) max(8.0, 16 + 2 * d) else 0.0
    val height = if (m.detached) max(0.0, vh - max(16.0, 32 + 4 * d)) else vh
    val x = if (right) vw - inline - width else inline
    val sign = if (right) 1.0 else -1.0
    val inspector = LocalAWCModalInspector.current
    if (inspector != null && layer == 1) {
        val values = AWCModalInspection { mapOf("frameMillis" to s.clock.frameMillis, "opacity" to opacity, "translateX" to sign * fraction * width, "scrim" to opacity,
            "role" to "dialog", "label" to name, "open" to open,
            "focus" to if (s.backFocused) "back-button" else if (s.closeFocused) "close-button" else if (s.containerFocused) "container" else "") }
        SideEffect { inspector(m.p.str("id"), values) }
    }
    Box(Modifier.fillMaxSize().then(if (layer == 1) Modifier.inspectAWCNode(inspection, "", "md-side-sheet") else Modifier)) {
        val scrimColor = part(AWCSideSheetPart.Scrim).background?.let { awcColor(it, Color.Transparent) } ?: a.scrimColor?.let { awcColor(it, Color.Transparent) } ?: Color(0f, 0f, 0f, .32f)
        if (layer == 0) Box(Modifier.fillMaxSize().drawBehind { drawRect(scrimColor.copy(alpha = scrimColor.alpha * opacity.toFloat())) }
            .then(if (open) Modifier.pointerInput(m.scrimDismissible) {
                awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Main); e.changes.forEach { it.consume() }
                    // A protected scrim tap leaves the sheet open and moves focus to the document (`<body>`).
                    if (e.type == PointerEventType.Press && !m.scrimDismissible && session?.isTop(s.owner.id) != false) session?.blur()
                    else if (e.type == PointerEventType.Release && m.scrimDismissible) dismiss() } }
            } else Modifier)
            .inspectAWCNode(inspection, "scrim", "scrim"))
        val dens = LocalDensity.current.density
        if (layer == 1) Box(Modifier.align(androidx.compose.ui.AbsoluteAlignment.TopLeft).zIndex(.5f).absoluteOffset(x.dp, top.dp).size(width.dp, height.dp)
            // translateX(±100%) closed: the percentage resolves against the container's own width.
            .graphicsLayer { alpha = opacity.toFloat(); translationX = (sign * fraction * width * dens).toFloat() }) {
            SideContainer(m, s, session, a, slots, part, d, true, name, close, back, tokens)
        }
    }
}

@Composable
private fun SideContainer(m: AWCSideSheetModel, s: NativeSideSheetState, session: AWCModalSession?, a: AWCSideSheetAppearance, slots: ModalSlots,
                          part: (AWCSideSheetPart) -> AWCModalPartAppearance, d: Double, modal: Boolean, name: String, close: () -> Unit, back: () -> Unit,
                          tokens: Map<String, String>) {
    val inspection = LocalAWCInspection.current
    val radius = tokens["--md-sys-shape-corner-large"]?.removeSuffix("px")?.toDoubleOrNull() ?: 16.0
    val corners = if (m.detached) a.containerShape?.shorthand ?: AWCCornerShape.uniform(radius) else AWCCornerShape.uniform(0.0)
    val fill = a.containerColor?.let { awcColor(it, Color.Transparent) }
        ?: awcColor(tokens[if (modal) "--md-sys-color-surface-container-low" else "--md-sys-color-surface"] ?: if (modal) "#F7F2FA" else "#FFFBFE", Color.White)
    val cp = part(AWCSideSheetPart.Container)
    val elevation = if (modal) (if (m.detached) "--md-sys-elevation-3" else "--md-sys-elevation-1") else if (m.detached) "--md-sys-elevation-1" else null
    val shadow = elevation?.let { NativeShadowLayer.parse(tokens[it]) } ?: emptyList()
    val divider = a.dividerColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-outline-variant"] ?: "#CAC4D0", Color.Gray)
    // Standard flush: a 1 dp divider-coloured border on the content-facing edge (inline-start for `end`).
    val border = !modal && !m.detached
    val hasActions = slots.registered("actions")
    val contentIndex = if (m.topDivider) 2 else 1
    Layout(modifier = Modifier
        .then(if (shadow.isNotEmpty()) Modifier.accordionShadow(corners, shadow, false) else Modifier)
        .clip(corners)
        .background(cp.background?.let { awcColor(it, Color.Transparent) } ?: fill)
        .drawWithContent {
            drawContent()
            if (border) { val px = density; val startEdge = !m.start; val left = startEdge != (layoutDirection == LayoutDirection.Rtl)
                drawRect(divider, Offset(if (left) 0f else size.width - px, 0f), Size(px, size.height)) }
            if (cp.outlineColor != null && (cp.outlineWidth ?: 0.0) > 0) { val px = (cp.outlineWidth!! * density).toFloat()
                val path = Path().apply { addOutline(corners.createOutline(Size(size.width - px, size.height - px), layoutDirection, this@drawWithContent)) }
                translate(px / 2, px / 2) { drawPath(path, awcColor(cp.outlineColor, Color.Transparent), style = Stroke(px)) } }
        }
        .then(if (modal) Modifier.awcModalSurface(session, s.owner).onGloballyPositioned { s.surfaceAttached = true }
            .focusRequester(s.container).onFocusChanged { s.containerFocused = it.isFocused; if (!it.isFocused) s.containerWanted = false }
            .focusProperties { canFocus = s.containerWanted }.focusable()
            .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent(PointerEventPass.Final) } } else Modifier)
        .onFocusChanged { s.focusWithin = it.hasFocus }
        .semantics { if (modal) paneTitle = name; contentDescription = name; isTraversalGroup = true }
        .inspectAWCNode(inspection, "container", "container")
        .padding(start = if (border && !m.start) 1.dp else 0.dp, end = if (border && m.start) 1.dp else 0.dp),
        content = {
            CompositionLocalProvider(LocalAWCNativeDensity provides d) {
                SideHeader(m, s, a, slots, part, d, modal && m.showBack, close, back, tokens)
                if (m.topDivider) SideDivider(part(AWCSideSheetPart.DividerTop), a, "divider-top", tokens)
                SideContent(a, slots, part(AWCSideSheetPart.Content), d, tokens, s.contentGroup)
                if (hasActions && m.bottomDivider) SideDivider(part(AWCSideSheetPart.DividerBottom), a, "divider-bottom", tokens)
                if (hasActions) SideActions(slots, part(AWCSideSheetPart.Actions), d, s.actionsGroup)
            }
        }) { measurables, constraints ->
        // Rows keep their natural height; the content (`flex: 1; min-block-size: 0`) takes the rest of the definite height.
        val cw = constraints.maxWidth
        val others = measurables.mapIndexedNotNull { i, ms -> if (i == contentIndex) null else i to ms.measure(Constraints(minWidth = cw, maxWidth = cw)) }.toMap()
        val othersH = others.values.sumOf { it.height }
        val content = if (constraints.hasBoundedHeight) measurables[contentIndex].measure(Constraints.fixed(cw, max(0, constraints.maxHeight - othersH)))
            else measurables[contentIndex].measure(Constraints(minWidth = cw, maxWidth = cw, maxHeight = 100_000))
        val total = if (constraints.hasBoundedHeight) constraints.maxHeight else othersH + content.height
        layout(cw, total) {
            var y = 0
            for (i in measurables.indices) { val pl = if (i == contentIndex) content else others[i]!!; pl.place(0, y); y += pl.height }
        }
    }
}

@Composable
private fun SideHeader(m: AWCSideSheetModel, s: NativeSideSheetState, a: AWCSideSheetAppearance, slots: ModalSlots, part: (AWCSideSheetPart) -> AWCModalPartAppearance,
                       d: Double, showBack: Boolean, close: () -> Unit, back: () -> Unit, tokens: Map<String, String>) {
    val p = part(AWCSideSheetPart.Header); val hp = part(AWCSideSheetPart.Headline); val cp = part(AWCSideSheetPart.Close)
    val pad = max(12.0, 24 + 2 * d); val bottom = max(8.0, 12 + d); val gap = max(4.0, 12 + 2 * d)
    val size = max(16.0, 22 + d); val line = max(22.0, 28 + d); val iconBox = max(32.0, 40 + 4 * d); val iconSize = max(18.0, 24 + d)
    val color = hp.color?.let { awcColor(it, Color.Transparent) } ?: a.headlineColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-on-surface-variant"] ?: "#49454F", Color.Black)
    val style = modalText(size, line, color, hp.letterSpacing ?: 0.0, underline = hp.underline == true)
    val inspection = LocalAWCInspection.current
    val icons = AWCIconButtonAppearance(iconColor = a.iconColor ?: tokens["--md-sys-color-on-surface-variant"], iconSize = iconSize, width = iconBox, height = iconBox)
    val hasHeadline = m.headline.isNotEmpty() || slots.registered("headline")
    SubcomposeLayout(Modifier.fillMaxWidth().then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
        .inspectAWCNode(inspection, "header", "header").padding(start = pad.dp, end = pad.dp, top = pad.dp, bottom = bottom.dp)) { c ->
        val loose = Constraints(0, c.maxWidth, 0, Constraints.Infinity)
        val pull = ((12 + d) * density).roundToInt(); val g = gap.dp.roundToPx()
        val backs = if (!showBack) emptyList() else subcompose("back") {
            Box(Modifier.inspectAWCNode(inspection, "back", "back").onFocusChanged { s.backFocused = it.hasFocus }) {
                AWCIconButtonAppearanceScope(icons) {
                    if (slots.registered("back")) slots.Render("back")
                    else AWCComponent("md-icon-button", mapOf("icon" to "arrow_back", "variant" to "standard", "aria-label" to "Back"), onEvent = { n, _ -> if (n == "mdClick") back() })
                }
            }
        }.map { it.measure(loose) }
        val closes = if (!m.closeable) emptyList() else subcompose("close") {
            Box(Modifier.then(if (cp.background != null) Modifier.background(awcColor(cp.background, Color.Transparent)) else Modifier).inspectAWCNode(inspection, "close", "close")
                .onFocusChanged { s.closeFocused = it.hasFocus }) {
                AWCIconButtonAppearanceScope(icons) {
                    if (slots.registered("close")) slots.Render("close")
                    else AWCComponent("md-icon-button", mapOf("icon" to "close", "variant" to "standard", "aria-label" to "Close side sheet"), onEvent = { n, _ -> if (n == "mdClick") close() })
                }
            }
        }.map { it.measure(loose) }
        val backW = backs.maxOfOrNull { it.width }?.let { it - pull + g } ?: 0
        val closeW = closes.maxOfOrNull { it.width }?.let { it - pull + g } ?: 0
        val headlineW = max(0, c.maxWidth - backW - closeW)
        val headline = subcompose("headline") {
            Box(Modifier.then(if (hp.background != null) Modifier.background(awcColor(hp.background, Color.Transparent)) else Modifier).inspectAWCNode(inspection, "headline", "headline", allowZeroSize = true)) {
                if (hasHeadline) CompositionLocalProvider(LocalTextStyle provides style, LocalContentColor provides color) {
                    if (slots.registered("headline")) slots.Render("headline") else Text(m.headline, style = style, maxLines = 1, overflow = TextOverflow.Ellipsis, softWrap = false, modifier = Modifier.fillMaxWidth())
                }
            }
        }.map { it.measure(Constraints(headlineW, headlineW, 0, Constraints.Infinity)) }
        val h = maxOf(headline.maxOfOrNull { it.height } ?: 0, backs.maxOfOrNull { it.height } ?: 0, closes.maxOfOrNull { it.height } ?: 0)
        layout(c.maxWidth, h) {
            backs.forEach { it.placeRelative(-pull, (h - it.height) / 2) }
            headline.forEach { it.placeRelative(backW, (h - it.height) / 2) }
            closes.forEach { it.placeRelative(c.maxWidth + pull - it.width, (h - it.height) / 2) }
        }
    }
}

@Composable
private fun SideDivider(p: AWCModalPartAppearance, a: AWCSideSheetAppearance, name: String, tokens: Map<String, String>) {
    val color = p.background?.let { awcColor(it, Color.Transparent) } ?: a.dividerColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-outline-variant"] ?: "#CAC4D0", Color.Gray)
    Box(Modifier.fillMaxWidth().height((p.height ?: 1.0).dp).background(color).inspectAWCNode(LocalAWCInspection.current, name, name))
}

@Composable
private fun SideContent(a: AWCSideSheetAppearance, slots: ModalSlots, p: AWCModalPartAppearance, d: Double, tokens: Map<String, String>, group: FocusRequester? = null) {
    val size = max(12.0, 14 + .5 * d); val line = max(16.0, 20 + d); val gutter = max(12.0, 24 + 2 * d); val block = max(8.0, 12 + d)
    val ink = p.color?.let { awcColor(it, Color.Transparent) } ?: a.contentColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-on-surface"] ?: "#1C1B1F", Color.Black)
    Column(Modifier.fillMaxWidth().then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
        .inspectAWCNode(LocalAWCInspection.current, "content", "content", AWCInspectionMetrics(typography = AWCInspectionTypography(size, line, 400, .25, "Roboto")))
        .then(if (group != null) Modifier.focusRequester(group).focusGroup() else Modifier)
        .verticalScroll(rememberScrollState())
        .padding(start = gutter.dp, end = gutter.dp, top = block.dp, bottom = block.dp)) {
        CompositionLocalProvider(LocalTextStyle provides modalText(size, line, ink, .25), LocalContentColor provides ink) { slots.Render("") }
    }
}

@Composable
private fun SideActions(slots: ModalSlots, p: AWCModalPartAppearance, d: Double, group: FocusRequester? = null) {
    val gap = max(4.0, 8 + d); val inline = max(12.0, 24 + 2 * d); val block = max(6.0, 12 + d); val minH = max(40.0, 72 + 4 * d)
    ModalSlotRow(slots, "actions", gap.dp, false, (minH - 2 * block).dp, Modifier.fillMaxWidth().then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
        .inspectAWCNode(LocalAWCInspection.current, "actions", "actions").padding(start = inline.dp, end = inline.dp, top = block.dp, bottom = block.dp)
        .then(if (group != null) Modifier.focusRequester(group) else Modifier).focusGroup()) {}
}

/**
 * The parity renderer presents in the nearest [AWCModalScope] (viewport, owner stack, focus trap, key routing). Outside
 * one, `md-side-sheet` keeps the previous presentation (platform dialog window, preview capture), so hosts that have not
 * installed a modal scope are unchanged.
 */
@Composable
internal fun NativeSideSheet(p: Props, onEvent: EventSink, slot: Slot?) {
    if (LocalAWCModalSession.current != null) NativeSideSheetRenderer(p, onEvent, slot) else OverlayComponent("md-side-sheet", p, onEvent, slot)
}
