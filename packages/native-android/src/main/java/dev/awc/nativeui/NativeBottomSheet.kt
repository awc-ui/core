package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.*
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
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.isPrimaryPressed
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * `--md-bottom-sheet-container-shape`: one CSS value used per corner (`horizontal [vertical]`) on the standard
 * variant's two top corners and as a `border-radius` shorthand (1–4 radii, optional `/` vertical list) when detached.
 */
@Immutable data class AWCBottomSheetShape(val radii: List<Double>, val vertical: List<Double>? = null) {
    internal val valid get() = radii.isNotEmpty() && (radii + (vertical ?: emptyList())).all { it.isFinite() && it >= 0 } && vertical?.isNotEmpty() != false
    private fun four(v: List<Double>) = when (v.size) { 1 -> List(4) { v[0] }; 2 -> listOf(v[0], v[1], v[0], v[1]); 3 -> listOf(v[0], v[1], v[2], v[1]); else -> v.take(4) }
    internal val shorthand: AWCCornerShape get() {
        val h = four(radii); val v = four(vertical ?: radii)
        val c = (0..3).map { AWCCornerRadius(AWCCornerLength(h[it]), AWCCornerLength(v[it])) }
        return AWCCornerShape(c[0], c[1], c[2], c[3])
    }
    internal val corner: AWCCornerRadius get() = if (vertical != null || radii.size > 2) AWCCornerRadius() else AWCCornerRadius(AWCCornerLength(radii[0]), AWCCornerLength(radii.getOrElse(1) { radii[0] }))
    companion object {
        /** From plain data (Laboratory/IR): `{ radii: [px], vertical?: [px] }`, one to four non-negative lengths each. */
        fun fromValues(value: Any?): AWCBottomSheetShape? {
            val values = value as? Map<*, *> ?: return null
            if (values.keys.any { it !in setOf("radii", "vertical") }) return null
            fun list(v: Any?): List<Double>? { val l = v as? List<*> ?: return null; val d = l.mapNotNull { (it as? Number)?.toDouble() }; return d.takeIf { it.size == l.size && it.size in 1..4 } }
            val radii = list(values["radii"]) ?: return null
            val vertical = if (values.containsKey("vertical")) list(values["vertical"]) ?: return null else null
            return AWCBottomSheetShape(radii, vertical).takeIf { it.valid }
        }
    }
}

/** The sixteen public md-bottom-sheet hooks (`--md-bottom-sheet-*`); size fractions resolve against the viewport. */
@Immutable data class AWCBottomSheetAppearance(
    val containerColor: String? = null, val containerShape: AWCBottomSheetShape? = null, val contentColor: String? = null, val headlineColor: String? = null,
    val scrimColor: String? = null, val dragHandleColor: String? = null, val dividerColor: String? = null, val iconColor: String? = null,
    val width: AWCSkeletonLength? = null, val minWidth: AWCSkeletonLength? = null, val maxWidth: AWCSkeletonLength? = null,
    val height: AWCSkeletonLength? = null, val minHeight: AWCSkeletonLength? = null, val maxHeight: AWCSkeletonLength? = null,
    val detachedMargin: Double? = null, val contentPaddingInline: Double? = null,
) {
    internal fun normalized() = copy(containerColor = awcModalColor(containerColor), containerShape = containerShape?.takeIf { it.valid }, contentColor = awcModalColor(contentColor),
        headlineColor = awcModalColor(headlineColor), scrimColor = awcModalColor(scrimColor), dragHandleColor = awcModalColor(dragHandleColor), dividerColor = awcModalColor(dividerColor),
        iconColor = awcModalColor(iconColor), detachedMargin = detachedMargin?.takeIf { it.isFinite() }, contentPaddingInline = contentPaddingInline?.takeIf { it.isFinite() && it >= 0 })
    companion object {
        /** From plain data (Laboratory/IR): hook names in camelCase; shapes as [AWCBottomSheetShape.fromValues], sizes as [AWCSkeletonLength.fromValues]. */
        fun fromValues(values: Map<String, Any?>): AWCBottomSheetAppearance {
            fun s(k: String) = (values[k] as? String)?.takeIf { it.isNotEmpty() }
            fun n(k: String) = (values[k] as? Number)?.toDouble()
            fun l(k: String) = AWCSkeletonLength.fromValues(values[k])
            return AWCBottomSheetAppearance(s("containerColor"), AWCBottomSheetShape.fromValues(values["containerShape"]), s("contentColor"), s("headlineColor"), s("scrimColor"),
                s("dragHandleColor"), s("dividerColor"), s("iconColor"), l("width"), l("minWidth"), l("maxWidth"), l("height"), l("minHeight"), l("maxHeight"),
                n("detachedMargin"), n("contentPaddingInline")).normalized()
        }
    }
    fun merge(o: AWCBottomSheetAppearance) = AWCBottomSheetAppearance(o.containerColor ?: containerColor, o.containerShape ?: containerShape, o.contentColor ?: contentColor,
        o.headlineColor ?: headlineColor, o.scrimColor ?: scrimColor, o.dragHandleColor ?: dragHandleColor, o.dividerColor ?: dividerColor, o.iconColor ?: iconColor,
        o.width ?: width, o.minWidth ?: minWidth, o.maxWidth ?: maxWidth, o.height ?: height, o.minHeight ?: minHeight, o.maxHeight ?: maxHeight,
        o.detachedMargin ?: detachedMargin, o.contentPaddingInline ?: contentPaddingInline)
}

/** The eleven md-bottom-sheet parts (`::part(...)`). */
enum class AWCBottomSheetPart(val source: String) {
    Scrim("scrim"), Container("container"), DragHandle("drag-handle"), DragHandleIndicator("drag-handle-indicator"), Header("header"), Headline("headline"),
    Close("close"), DividerTop("divider-top"), DividerBottom("divider-bottom"), Content("content"), Actions("actions")
}
internal val LocalAWCBottomSheetAppearance = staticCompositionLocalOf { AWCBottomSheetAppearance() }
internal val LocalAWCBottomSheetTargets = staticCompositionLocalOf<Map<String, AWCBottomSheetAppearance>> { emptyMap() }
internal val LocalAWCBottomSheetParts = staticCompositionLocalOf<Map<String, AWCModalPartAppearance>> { emptyMap() }
/** md-bottom-sheet hooks for every sheet below, or only the sheet whose `id` property is [id]. */
@Composable fun AWCBottomSheetAppearanceScope(appearance: AWCBottomSheetAppearance, id: String? = null, content: @Composable () -> Unit) {
    val value = appearance.normalized()
    if (id == null) CompositionLocalProvider(LocalAWCBottomSheetAppearance provides LocalAWCBottomSheetAppearance.current.merge(value), content = content)
    else { val t = LocalAWCBottomSheetTargets.current
        CompositionLocalProvider(LocalAWCBottomSheetTargets provides t + (id to (t[id] ?: AWCBottomSheetAppearance()).merge(value)), content = content) }
}
/** Style one md-bottom-sheet part (`::part(name)`) for every sheet below, or only [id]. */
@Composable fun AWCBottomSheetPartAppearanceScope(part: AWCBottomSheetPart, appearance: AWCModalPartAppearance, id: String? = null, content: @Composable () -> Unit) {
    val key = if (id == null) part.source else "$id|${part.source}"
    val parts = LocalAWCBottomSheetParts.current
    CompositionLocalProvider(LocalAWCBottomSheetParts provides parts + (key to (parts[key] ?: AWCModalPartAppearance()).merge(appearance.normalized())), content = content)
}
/** Source methods `show()` and `close()` (state changes immediately; the source has no `whenClosed()`). */
@Stable class AWCBottomSheetController {
    internal var showAction: () -> Unit = {}
    internal var closeAction: () -> Unit = {}
    internal var openState: () -> Boolean = { false }
    val isOpen get() = openState()
    fun show() = showAction()
    fun close() = closeAction()
}
internal val LocalAWCBottomSheetController = staticCompositionLocalOf<AWCBottomSheetController?> { null }
/** Binds [controller] to the md-bottom-sheet rendered directly below. */
@Composable fun AWCBottomSheetControllerScope(controller: AWCBottomSheetController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCBottomSheetController provides controller, content = content)

/** md3.css density rungs: each spacing token comes from the nearest rung that defines it, else the default. */
internal object AWCSheetSpacing {
    private val rungs = mapOf(-2.0 to mapOf("inset-lg" to 12.0, "inset-xl" to 20.0),
        -3.0 to mapOf("inset-sm" to 4.0, "inset-lg" to 12.0, "inset-xl" to 16.0, "gap-sm" to 4.0),
        -4.0 to mapOf("inset-sm" to 4.0, "inset-lg" to 8.0, "inset-xl" to 16.0, "gap-sm" to 4.0))
    private val defaults = mapOf("inset-sm" to 8.0, "inset-lg" to 16.0, "inset-xl" to 24.0, "gap-sm" to 8.0)
    fun token(name: String, local: Double?, inherited: Double) = local?.let { rungs[it]?.get(name) } ?: rungs[inherited]?.get(name) ?: defaults[name] ?: 0.0
    /** Rungs nearest first (own, then every ancestor's): the nearest rung that defines the token wins (gate-7 R4-02). */
    fun token(name: String, nearestFirst: List<Double>) = AWCSpacingTokens.token(name, nearestFirst)
}

internal data class AWCBottomSheetModel(val p: Props) {
    val variant = if (p.str("variant") == "detached") "detached" else "standard"
    val headline = p.str("headline"); val showDragHandle = p.bool("showDragHandle", true); val closeable = p.bool("closeable")
    val scrimDismissible = p.bool("scrimDismissible", true); val topDivider = p.bool("topDivider"); val bottomDivider = p.bool("bottomDivider")
    val ariaLabel = p.str("sheetAriaLabel", p.str("aria-label")); val scrollShadow = p.bool("scrollShadow", true)
    val headlineAlign = p.str("headlineAlign").takeIf { it in setOf("center", "end") } ?: "start"
    val contentAlign = p.str("contentAlign").takeIf { it in setOf("center", "end") } ?: "start"
    val density: Double? = (p["density"] as? Number)?.toDouble(); val hidden = p.bool("hidden")
}

internal class NativeBottomSheetState(id: String) {
    val clock = AWCModalClock()
    val opacity = AWCCSSTransitionTrack(); val fraction = AWCCSSTransitionTrack().also { it.snap(1.0) }; val pixels = AWCCSSTransitionTrack()
    val indicator = AWCCSSTransitionTrack().also { it.snap(.4) }
    val pending = mutableListOf<(Double) -> Unit>()
    var emitted: Boolean? = null
    var dragging by mutableStateOf(false); var drag by mutableDoubleStateOf(0.0); var hover by mutableStateOf(false); var closeFocused by mutableStateOf(false)
    val owner = AWCModalOwner(id)
    val contentGroup = FocusRequester(); val actionsGroup = FocusRequester()
    val container = FocusRequester(); var containerWanted = false; var containerFocused by mutableStateOf(false); var containerRing by mutableStateOf(false)
    var focusSerial by mutableIntStateOf(0)
    var surfaceAttached = false
    // A drag keeps the frame clock running so the rendered offset is stamped with its frame time.
    fun running(now: Double) = dragging || pending.isNotEmpty() || opacity.isRunning(now) || fraction.isRunning(now) || pixels.isRunning(now) || indicator.isRunning(now)
    fun later(op: (Double) -> Unit) { pending += op; clock.version++ }
}

/**
 * md-bottom-sheet: standard (anchored, top corners rounded) and detached (16 dp margins, all corners, elevation 3),
 * both modal in the nearest [AWCModalScope]. Events: mdOpen/mdClose on every open change; Escape/back (always), an
 * enabled scrim, the fallback close and a handle drag released beyond 100 dp emit mdCancel then mdClose; `close()`
 * emits mdClose only. Payloads are null.
 */
@Composable
internal fun NativeBottomSheetRenderer(p: Props, onEvent: EventSink, slot: Slot?) {
    val m = AWCBottomSheetModel(p)
    val emit by rememberUpdatedState(onEvent)
    var open by awcState(p["open"]) { p.bool("open") }
    val identity = remember { "md-bottom-sheet-" + java.util.UUID.randomUUID() }
    val s = remember { NativeBottomSheetState(identity) }
    val tokens = LocalAWCThemeTokens.current
    val reduced = rememberAWCAccessibilityAppearance().first
    val standard = accordionCubicBezierCurve(tokens["--md-sys-motion-easing-standard"]) ?: listOf(.2, 0.0, 0.0, 1.0)
    val emphasized = accordionCubicBezierCurve(tokens["--md-sys-motion-easing-emphasized"]) ?: listOf(.2, 0.0, 0.0, 1.0)
    val fade = if (reduced) 0.0 else cardDuration(tokens, "--md-sys-motion-duration-medium2", 300.0)
    val slide = if (reduced) 0.0 else cardDuration(tokens, "--md-sys-motion-duration-medium4", 400.0)
    val short2 = cardDuration(tokens, "--md-sys-motion-duration-short2", 100.0)
    val now = s.clock.frameMillis
    // The surface stays composed until every shell track (the 400 ms slide outlasts the 300 ms fade) has finished.
    val visible = !m.hidden && (open || s.running(now) || s.opacity.presented(now) > 1e-4)
    val slots = ModalSlots(LocalAWCSlots.current, slot)
    val parts = LocalAWCBottomSheetParts.current
    val id = p.str("id")
    val part = { x: AWCBottomSheetPart -> (parts[x.source] ?: AWCModalPartAppearance()).merge(parts["$id|${x.source}"] ?: AWCModalPartAppearance()) }
    AWCModalImplicitScope(visible) {
        val session = LocalAWCModalSession.current
        val controller = LocalAWCBottomSheetController.current
        fun indicatorTarget() { // Chrome never renders the `--dragging` state (.8) during a handle drag: only hover (.6) and rest (.4) apply.
            val target = part(AWCBottomSheetPart.DragHandleIndicator).opacity ?: if (s.hover) .6 else .4
            // The handle indicator keeps its 100 ms transition under reduced motion (the source removes only the shell's).
            s.later { ms -> s.indicator.set(target, ms, short2, standard) } }
        fun begin(a: Boolean) = s.later { ms -> s.opacity.set(if (a) 1.0 else 0.0, ms, fade, standard); s.fraction.set(if (a) 0.0 else 1.0, ms, slide, emphasized) }
        /** Pointer cancel, lost capture, hiding the handle, closing, being covered: the offset returns without an event. */
        fun cancelDrag() {
            if (!s.dragging && s.drag == 0.0) return
            val from = s.drag; s.dragging = false; s.drag = 0.0
            s.later { ms -> s.pixels.snap(from); s.pixels.set(0.0, ms, slide, emphasized) }; indicatorTarget()
        }
        fun sync(value: Boolean) {
            val a = value && !m.hidden
            if (s.emitted == null) { s.emitted = a; if (a) { begin(true); session?.acquire(s.owner); emit("mdOpen", null); s.focusSerial++ }; return }
            if (a == s.emitted) return
            s.emitted = a
            cancelDrag(); begin(a)
            if (a) { session?.acquire(s.owner); emit("mdOpen", null); s.focusSerial++ } else { session?.release(identity); emit("mdClose", null) }
        }
        fun dismiss() {
            if (!open || (session != null && !session.isTop(identity))) return
            emit("mdCancel", null); open = false; sync(false)
        }
        /** A release beyond the threshold: the exit transition starts from the dragged offset. */
        fun dragDismiss(from: Double) {
            s.dragging = false; s.drag = 0.0
            s.later { ms -> s.pixels.snap(from); s.pixels.set(0.0, ms, slide, emphasized) }
            indicatorTarget(); dismiss()
        }
        SideEffect { sync(open) }
        LaunchedEffect(m.showDragHandle) { if (!m.showDragHandle) cancelDrag() }
        DisposableEffect(Unit) { onDispose { if (s.emitted == true) session?.release(identity); s.emitted = null } }
        SideEffect {
            s.owner.containerHasFocus = { s.containerFocused }
            s.owner.groups = listOf(s.contentGroup, s.actionsGroup)
            s.owner.escape = { if (open && session?.isTop(identity) != false) { dismiss(); true } else false }
            s.owner.focusContainer = { s.containerWanted = true; runCatching { s.container.requestFocus() }.getOrDefault(false) }
            s.owner.focused = { pointer -> if (s.containerFocused) s.containerRing = !pointer }
            // A newly active owner cancels an in-progress drag on this sheet (late pointer events cannot dismiss it).
            s.owner.covered = { cancelDrag() }
            controller?.let { c -> c.showAction = { if (!open) { open = true; sync(true) } }; c.closeAction = { if (open) { open = false; sync(false) } }; c.openState = { open } }
        }
        AWCModalTicker(s.clock, { s.running(it) }) { ms -> val ops = s.pending.toList(); s.pending.clear(); ops.forEach { it(ms) } }
        LaunchedEffect(s.focusSerial) {
            if (s.focusSerial == 0) return@LaunchedEffect
            var frames = 0
            do { withFrameNanos { }; frames++ } while (!s.surfaceAttached && frames < 10)
            if (open && session?.isTop(identity) == true) session.focusFirst(s.owner)
        }
        val context = currentCompositionLocalContext
        val appearance = LocalAWCBottomSheetAppearance.current.merge(LocalAWCBottomSheetTargets.current[id] ?: AWCBottomSheetAppearance())
        // Source `--md-sys-z-index-dialog-scrim` (1001) surface over the `--md-sys-z-index-popup` (1000) scrim.
        // Two layers, as in the source: the scrim (`--md-sys-z-index-popup`, 1000) and the surface (1001) sort independently,
        // so a later sheet's scrim paints below an earlier sheet's surface (Chrome's stacking).
        for (layer in 0..1) key(layer) {
            AWCModalEntryEffect(session, if (layer == 0) "$identity#scrim" else identity, visible, if (layer == 0) 1000.0 else 1001.0) {
                CompositionLocalProvider(context) {
                    CompositionLocalProvider(LocalAWCBottomSheetController provides null, LocalAWCSlots provides null) {
                        SheetShell(m, s, session, appearance, slots, part, reduced, open, ::dismiss, ::cancelDrag, ::indicatorTarget, ::dragDismiss, layer)
                    }
                }
            }
        }
        Box(Modifier.size(0.dp).semantics { hideFromAccessibility() })
    }
}

@Composable
private fun SheetShell(m: AWCBottomSheetModel, s: NativeBottomSheetState, session: AWCModalSession?, a: AWCBottomSheetAppearance, slots: ModalSlots,
                       part: (AWCBottomSheetPart) -> AWCModalPartAppearance, reduced: Boolean, open: Boolean, dismiss: () -> Unit, cancelDrag: () -> Unit,
                       indicatorTarget: () -> Unit, dragDismiss: (Double) -> Unit, layer: Int = 1) {
    val tokens = LocalAWCThemeTokens.current
    val dens = LocalDensity.current.density
    val inspection = LocalAWCInspection.current
    val inheritedDensity = LocalAWCNativeDensity.current
    val d = resolveAWCDensity(m.density, inheritedDensity)
    val local = m.density?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) }
    // AWCComponent provides the resolved density; the rung list keeps the inherited rungs under a local one (gate-7 R4-02).
    val spacingRungs = LocalAWCDensityRungs.current.ifEmpty { listOfNotNull(local, inheritedDensity.takeIf { it <= -1 }) }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val vw = session?.viewportWidth ?: 0.0; val vh = session?.viewportHeight ?: 0.0
    val t = s.clock.frameMillis
    val active = open && !m.hidden
    val opacity = if (reduced) (if (active) 1.0 else 0.0) else s.opacity.presented(t)
    val fraction = if (reduced) (if (active) 0.0 else 1.0) else s.fraction.presented(t)
    val pixels = if (s.dragging) s.drag else if (reduced) 0.0 else s.pixels.presented(t)
    val detached = m.variant == "detached"
    val margin = a.detachedMargin ?: 16.0
    val wide = vw >= 640
    fun res(l: AWCSkeletonLength?, basis: Double) = l?.resolve(basis, 14.0, 16.0, 7.0)
    var maxW = res(a.maxWidth ?: if (wide) AWCSkeletonLength(points = -112.0, fraction = 1.0) else AWCSkeletonLength(fraction = 1.0), vw) ?: vw
    if (detached) maxW = min(maxW, vw - 2 * margin)
    val width = max(res(a.minWidth, vw) ?: 0.0, min(res(a.width ?: if (wide) AWCSkeletonLength(points = 640.0) else AWCSkeletonLength(fraction = 1.0), vw) ?: vw, maxW))
    val left = if (detached) margin else 0.0; val right = if (detached) vw - margin else vw
    val x = if (width <= right - left) left + (right - left - width) / 2 else if (rtl) right - width else left
    val bottomInset = if (detached) margin else 0.0
    val name = m.ariaLabel.ifEmpty { if (m.headline.isNotEmpty() || slots.registered("headline")) m.headline else "Bottom sheet" }
    val heightBox = remember { doubleArrayOf(0.0) }
    val inspector = LocalAWCModalInspector.current
    if (inspector != null && layer == 1) {
        val values = AWCModalInspection { mapOf("frameMillis" to s.clock.frameMillis, "opacity" to opacity, "translateY" to fraction * heightBox[0] + pixels, "scrim" to opacity,
            "drag" to s.drag, "dragging" to s.dragging, "indicator" to (part(AWCBottomSheetPart.DragHandleIndicator).opacity ?: s.indicator.presented(s.clock.frameMillis)), "role" to "dialog", "label" to name, "open" to open,
            "focus" to if (s.closeFocused) "close-button" else if (s.containerFocused) "container" else "", "containerRing" to (s.containerFocused && s.containerRing)) }
        SideEffect { inspector(m.p.str("id"), values) }
    }
    Box(Modifier.fillMaxSize().then(if (layer == 1) Modifier.inspectAWCNode(inspection, "", "md-bottom-sheet") else Modifier)) {
        val scrimColor = part(AWCBottomSheetPart.Scrim).background?.let { awcColor(it, Color.Transparent) } ?: a.scrimColor?.let { awcColor(it, Color.Transparent) } ?: Color(0f, 0f, 0f, .32f)
        if (layer == 0) Box(Modifier.fillMaxSize().drawBehind { drawRect(scrimColor.copy(alpha = scrimColor.alpha * opacity.toFloat())) }
            .then(if (open) Modifier.pointerInput(m.scrimDismissible) {
                awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Main); e.changes.forEach { it.consume() }
                    if (e.type == PointerEventType.Press && !m.scrimDismissible && session?.isTop(s.owner.id) != false) session?.blur()
                    else if (e.type == PointerEventType.Release && m.scrimDismissible) dismiss() } }
            } else Modifier)
            .inspectAWCNode(inspection, "scrim", "scrim"))
        if (layer == 1) Box(Modifier.fillMaxSize().zIndex(.5f).graphicsLayer { alpha = opacity.toFloat(); translationY = ((fraction * heightBox[0] + pixels) * density).toFloat() }) {
            SheetContainer(m, s, session, a, slots, part, d, local, spacingRungs, width, x, vh, bottomInset, detached, name, dismiss, cancelDrag, indicatorTarget, dragDismiss, heightBox, dens, tokens)
        }
    }
}

@Composable
private fun SheetContainer(m: AWCBottomSheetModel, s: NativeBottomSheetState, session: AWCModalSession?, a: AWCBottomSheetAppearance, slots: ModalSlots,
                           part: (AWCBottomSheetPart) -> AWCModalPartAppearance, d: Double, local: Double?, spacingRungs: List<Double>, width: Double, x: Double, vh: Double,
                           bottomInset: Double, detached: Boolean, name: String, dismiss: () -> Unit, cancelDrag: () -> Unit, indicatorTarget: () -> Unit,
                           dragDismiss: (Double) -> Unit, heightBox: DoubleArray, dens: Float, tokens: Map<String, String>) {
    val inspection = LocalAWCInspection.current
    val base = max(16.0, 28 + 2 * d)
    val corners = if (detached) a.containerShape?.shorthand ?: AWCCornerShape.uniform(base)
        else { val c = a.containerShape?.corner ?: AWCCornerRadius(AWCCornerLength(base), AWCCornerLength(base)); AWCCornerShape(c, c, AWCCornerRadius(), AWCCornerRadius()) }
    val fill = a.containerColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-surface-container-low"] ?: "#F7F2FA", Color.White)
    val cp = part(AWCBottomSheetPart.Container)
    val shadow = if (detached) NativeShadowLayer.parse(tokens["--md-sys-elevation-3"]) else emptyList()
    val ring = awcColor(tokens["--md-sys-color-secondary"] ?: "#625B71", Color.Gray)
    val gutter = a.contentPaddingInline ?: max(12.0, 24 + 2 * d)
    val insetSM = AWCSheetSpacing.token("inset-sm", spacingRungs); val insetLG = AWCSheetSpacing.token("inset-lg", spacingRungs)
    val hasActions = slots.registered("actions")
    val hasHeadline = m.headline.isNotEmpty() || slots.registered("headline")
    val hasClose = m.closeable || slots.registered("close")
    val top = if (m.showDragHandle) 0.0 else max(12.0, 24 + 2 * d)
    val bottom = session?.safeArea?.bottom ?: 0.0
    var contentIndex = 0
    if (m.showDragHandle) contentIndex++; if (hasHeadline || hasClose) contentIndex++; if (m.topDivider) contentIndex++
    fun res(l: AWCSkeletonLength?) = l?.resolve(vh, 14.0, 16.0, 7.0)
    val maxH = res(a.maxHeight) ?: vh * .8; val minH = res(a.minHeight) ?: 0.0; val fixedH = res(a.height)
    val w = (width * dens).roundToInt()
    // Read as state in the measure block: a retained change (e.g. variant → detached) re-places the open sheet even when
    // nothing inside it changes size (an updated layout lambda alone was observed not to re-run placement).
    val geometry = rememberUpdatedState(Triple(w, (x * dens).roundToInt(), (bottomInset * dens).roundToInt()))
    Layout(modifier = Modifier
        .layout { measurable, constraints ->
            val (gw, gx, gi) = geometry.value
            val pl = measurable.measure(Constraints(minWidth = gw, maxWidth = gw))
            heightBox[0] = pl.height / dens.toDouble()
            layout(constraints.maxWidth, constraints.maxHeight) { pl.place(gx, constraints.maxHeight - gi - pl.height) }
        }
        .then(if (shadow.isNotEmpty()) Modifier.accordionShadow(corners, shadow, false) else Modifier)
        .clip(corners)
        .background(cp.background?.let { awcColor(it, Color.Transparent) } ?: fill)
        .drawWithContent {
            drawContent()
            fun stroke(color: Color, widthDp: Double) { val px = (widthDp * density).toFloat()
                val path = Path().apply { addOutline(corners.createOutline(Size(size.width - px, size.height - px), layoutDirection, this@drawWithContent)) }
                translate(px / 2, px / 2) { drawPath(path, color, style = Stroke(px)) } }
            if (cp.outlineColor != null && (cp.outlineWidth ?: 0.0) > 0) stroke(awcColor(cp.outlineColor, Color.Transparent), cp.outlineWidth!!)
            // `:focus-visible` container (no tabbable descendant): a 3 dp secondary outline offset −3 dp along the corners.
            if (s.containerFocused && s.containerRing) stroke(ring, 3.0)
        }
        .awcModalSurface(session, s.owner)
        .onGloballyPositioned { s.surfaceAttached = true }
        .focusRequester(s.container)
        .onFocusChanged { s.containerFocused = it.isFocused; if (!it.isFocused) s.containerWanted = false }
        .focusProperties { canFocus = s.containerWanted }
        .focusable()
        .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent(PointerEventPass.Final) } }
        .semantics { paneTitle = name; contentDescription = name; isTraversalGroup = true }
        .inspectAWCNode(inspection, "container", "container"),
        content = {
            CompositionLocalProvider(LocalAWCNativeDensity provides d) {
                if (m.showDragHandle) SheetHandle(m, s, session, a, part, d, cancelDrag, indicatorTarget, dragDismiss, tokens)
                if (hasHeadline || hasClose) SheetHeader(m, s, a, slots, part, d, hasHeadline, hasClose, dismiss, tokens)
                if (m.topDivider) SheetDivider(part(AWCBottomSheetPart.DividerTop), a, "divider-top", tokens)
                SheetContent(m, a, slots, part(AWCBottomSheetPart.Content), d, gutter, insetSM, insetLG, tokens, s.contentGroup)
                if (hasActions && m.bottomDivider) SheetDivider(part(AWCBottomSheetPart.DividerBottom), a, "divider-bottom", tokens)
                if (hasActions) SheetActions(slots, part(AWCBottomSheetPart.Actions), local, spacingRungs, s.actionsGroup)
            }
        }) { measurables, constraints ->
        // Rows keep their natural height; the content (flex: 1 1 auto) takes the free space of the clamped container
        // height or shrinks to its padding; rows that do not fit overflow and are clipped.
        val cw = constraints.maxWidth
        val others = measurables.mapIndexedNotNull { i, ms -> if (i == contentIndex) null else i to ms.measure(Constraints(minWidth = cw, maxWidth = cw)) }.toMap()
        val pads = ((top + bottom) * dens).roundToInt()
        val othersH = others.values.sumOf { it.height } + pads
        val minPx = (minH * dens).roundToInt(); val maxPx = (maxH * dens).roundToInt()
        val contentMin = ((insetSM + insetLG) * dens).roundToInt()
        val fixed = fixedH?.let { min(max((it * dens).roundToInt(), 0), maxPx).coerceAtLeast(minPx) }
        val upper = max(contentMin, (fixed ?: max(maxPx, minPx)) - othersH)
        val lower = if (fixed != null) upper else max(contentMin, minPx - othersH)
        val content = measurables[contentIndex].measure(Constraints(minWidth = cw, maxWidth = cw, minHeight = min(lower, upper), maxHeight = upper))
        val total = fixed ?: max(minPx, min(othersH + content.height, maxPx))
        layout(cw, total) {
            var y = (top * dens).roundToInt()
            for (i in measurables.indices) { val pl = if (i == contentIndex) content else others[i]!!; pl.place(0, y); y += pl.height }
        }
    }
}

@Composable
private fun SheetHandle(m: AWCBottomSheetModel, s: NativeBottomSheetState, session: AWCModalSession?, a: AWCBottomSheetAppearance, part: (AWCBottomSheetPart) -> AWCModalPartAppearance,
                        d: Double, cancelDrag: () -> Unit, indicatorTarget: () -> Unit, dragDismiss: (Double) -> Unit, tokens: Map<String, String>) {
    val p = part(AWCBottomSheetPart.DragHandle); val ip = part(AWCBottomSheetPart.DragHandleIndicator)
    val pad = max(12.0, 22 + 2 * d); val iw = max(24.0, 32 + 2 * d); val ih = max(3.0, 4 + .25 * d)
    val color = ip.background?.let { awcColor(it, Color.Transparent) } ?: a.dragHandleColor?.let { awcColor(it, Color.Transparent) }
        ?: awcColor(tokens["--md-sys-color-on-surface-variant"] ?: "#49454F", Color.Gray)
    val inspection = LocalAWCInspection.current
    val dens = LocalDensity.current.density
    // The handle moves with the drag (the sheet's layer translation), so the drag distance is measured in root coordinates.
    val coords = remember { arrayOfNulls<androidx.compose.ui.layout.LayoutCoordinates>(1) }
    Box(Modifier.fillMaxWidth().height((2 * pad + ih).dp).then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
        .onGloballyPositioned { coords[0] = it }
        .pointerInput(m.showDragHandle) {
            awaitPointerEventScope {
                var pointer: androidx.compose.ui.input.pointer.PointerId? = null; var startY = 0f
                fun rootY(local: Offset) = coords[0]?.takeIf { it.isAttached }?.localToRoot(local)?.y ?: local.y
                while (true) {
                    val e = awaitPointerEvent()
                    val c = (pointer?.let { id -> e.changes.firstOrNull { it.id == id } } ?: e.changes.firstOrNull()) ?: continue
                    val inside = c.position.x >= 0 && c.position.y >= 0 && c.position.x < size.width && c.position.y < size.height
                    val cancelled = e.type == PointerEventType.Release && e.motionEvent.let { it == null || it.actionMasked == android.view.MotionEvent.ACTION_CANCEL }
                    // While dragging, every event of the captured pointer carries its position (Compose reports the first move
                    // past the handle's bounds as Exit, since the handle only follows on the next frame).
                    if (pointer != null && !cancelled && e.type != PointerEventType.Press && c.pressed) s.drag = max(0.0, ((rootY(c.position) - startY) / dens).toDouble())
                    when {
                        cancelled -> { pointer = null; cancelDrag() }
                        e.type == PointerEventType.Press && pointer == null && (c.type != PointerType.Mouse || e.buttons.isPrimaryPressed) -> {
                            if (!m.showDragHandle || session?.isTop(s.owner.id) == false || s.dragging) continue
                            // The press lands on the handle: Chrome's :hover (from the pointer move that precedes it) applies.
                            // Chrome's mousedown focuses the nearest focusable ancestor: the `tabindex=-1` container (no ring).
                            if (!s.containerFocused) { s.containerWanted = true; s.containerRing = false; runCatching { s.container.requestFocus() } }
                            pointer = c.id; startY = rootY(c.position); s.hover = true; s.dragging = true; s.drag = 0.0; s.later { _ -> s.pixels.snap(0.0) }; indicatorTarget(); c.consume()
                        }
                        e.type == PointerEventType.Move && pointer != null && c.id == pointer -> {
                            if (session?.isTop(s.owner.id) == false) { pointer = null; cancelDrag(); continue }
                            s.drag = max(0.0, ((rootY(c.position) - startY) / dens).toDouble()); c.consume()
                        }
                        e.type == PointerEventType.Release && pointer != null && c.id == pointer -> {
                            pointer = null; c.consume()
                            // Strictly beyond 100 dp dismisses; 100 exactly snaps back.
                            if (s.drag > 100) dragDismiss(s.drag) else cancelDrag()
                        }
                        // :hover follows pointer movement over an open sheet; Compose's re-dispatch after the sheet moved under a
                        // still pointer keeps its position (Move/Exit) and a closing sheet takes no new hover, as in Chrome.
                        (e.type == PointerEventType.Enter || (e.type == PointerEventType.Move && c.position != c.previousPosition)) && c.type == PointerType.Mouse && pointer == null && s.emitted == true -> { if (s.hover != inside) { s.hover = inside; indicatorTarget() } }
                        // The captured handle keeps :hover while dragged.
                        e.type == PointerEventType.Exit && pointer == null && c.position != c.previousPosition -> if (s.hover) { s.hover = false; indicatorTarget() }
                    }
                }
            }
        }
        .semantics { hideFromAccessibility() }
        .inspectAWCNode(inspection, "drag-handle", "drag-handle")) {
        Box(Modifier.align(androidx.compose.ui.Alignment.Center).size(iw.dp, ih.dp)
            .drawBehind { val o = (ip.opacity ?: s.indicator.presented(s.clock.frameMillis)).toFloat()
                drawRoundRect(color.copy(alpha = color.alpha * o), cornerRadius = CornerRadius(2.dp.toPx(), 2.dp.toPx())) }
            .inspectAWCNode(inspection, "drag-handle-indicator", "drag-handle-indicator"))
    }
}

@Composable
private fun SheetHeader(m: AWCBottomSheetModel, s: NativeBottomSheetState, a: AWCBottomSheetAppearance, slots: ModalSlots, part: (AWCBottomSheetPart) -> AWCModalPartAppearance, d: Double,
                        hasHeadline: Boolean, hasClose: Boolean, dismiss: () -> Unit, tokens: Map<String, String>) {
    val p = part(AWCBottomSheetPart.Header); val hp = part(AWCBottomSheetPart.Headline); val cp = part(AWCBottomSheetPart.Close)
    val pad = max(12.0, 24 + 2 * d); val bottom = max(4.0, 8 + d); val gap = max(4.0, 12 + 2 * d)
    val size = max(18.0, 24 + d); val line = max(24.0, 32 + 2 * d); val iconBox = max(32.0, 40 + 4 * d); val iconSize = max(18.0, 24 + d)
    val color = hp.color?.let { awcColor(it, Color.Transparent) } ?: a.headlineColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-on-surface"] ?: "#1C1B1F", Color.Black)
    val align = when (m.headlineAlign) { "center" -> TextAlign.Center; "end" -> TextAlign.End; else -> TextAlign.Start }
    val style = modalText(size, line, color, hp.letterSpacing ?: 0.0, underline = hp.underline == true, align = align)
    val inspection = LocalAWCInspection.current
    val endPull = 12 + d
    SubcomposeLayout(Modifier.fillMaxWidth().then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
        .inspectAWCNode(inspection, "header", "header").padding(start = pad.dp, end = pad.dp, bottom = bottom.dp)) { c ->
        val loose = Constraints(0, c.maxWidth, 0, Constraints.Infinity)
        val close = if (!hasClose) emptyList() else subcompose("close") {
            Box(Modifier.then(if (cp.background != null) Modifier.background(awcColor(cp.background, Color.Transparent)) else Modifier).inspectAWCNode(inspection, "close", "close")
                .onFocusChanged { s.closeFocused = it.hasFocus }) {
                if (slots.registered("close")) slots.Render("close")
                else AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor = a.iconColor ?: tokens["--md-sys-color-on-surface-variant"], iconSize = iconSize, width = iconBox, height = iconBox)) {
                    AWCComponent("md-icon-button", mapOf("icon" to "close", "variant" to "standard", "aria-label" to "Close bottom sheet"), onEvent = { n, _ -> if (n == "mdClick") dismiss() })
                }
            }
        }.map { it.measure(loose) }
        val closeW = close.maxOfOrNull { it.width } ?: 0
        val pull = (endPull * density).roundToInt()
        val g = gap.dp.roundToPx()
        val headlineW = max(0, c.maxWidth - if (close.isNotEmpty()) closeW - pull + g else 0)
        val headline = if (!hasHeadline) emptyList() else subcompose("headline") {
            Box(Modifier.then(if (hp.background != null) Modifier.background(awcColor(hp.background, Color.Transparent)) else Modifier).inspectAWCNode(inspection, "headline", "headline")) {
                CompositionLocalProvider(LocalTextStyle provides style, LocalContentColor provides color) {
                    if (slots.registered("headline")) slots.Render("headline") else NativeSourceText(m.headline, style, Modifier.fillMaxWidth(), wrap = true, wordWrapOnly = true)
                }
            }
        }.map { it.measure(Constraints(headlineW, headlineW, 0, Constraints.Infinity)) }
        val h = max(headline.maxOfOrNull { it.height } ?: 0, close.maxOfOrNull { it.height } ?: 0)
        layout(c.maxWidth, h) {
            headline.forEach { it.placeRelative(0, (h - it.height) / 2) }
            close.forEach { it.placeRelative(c.maxWidth + pull - it.width, (h - it.height) / 2) }
        }
    }
}

@Composable
private fun SheetDivider(p: AWCModalPartAppearance, a: AWCBottomSheetAppearance, name: String, tokens: Map<String, String>) {
    val color = p.background?.let { awcColor(it, Color.Transparent) } ?: a.dividerColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-outline-variant"] ?: "#CAC4D0", Color.Gray)
    Box(Modifier.fillMaxWidth().height((p.height ?: 1.0).dp).background(color).inspectAWCNode(LocalAWCInspection.current, name, name))
}

@Composable
private fun SheetContent(m: AWCBottomSheetModel, a: AWCBottomSheetAppearance, slots: ModalSlots, p: AWCModalPartAppearance, d: Double, gutter: Double, top: Double, bottom: Double, tokens: Map<String, String>, group: FocusRequester? = null) {
    val size = max(12.0, 14 + .5 * d); val line = max(16.0, 20 + d)
    val ink = p.color?.let { awcColor(it, Color.Transparent) } ?: a.contentColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-on-surface"] ?: "#1C1B1F", Color.Black)
    val align = when (m.contentAlign) { "center" -> TextAlign.Center; "end" -> TextAlign.End; else -> TextAlign.Start }
    val horizontal = when (m.contentAlign) { "center" -> androidx.compose.ui.Alignment.CenterHorizontally; "end" -> androidx.compose.ui.Alignment.End; else -> androidx.compose.ui.Alignment.Start }
    // The content part is the only scroller; its slotted blocks are flex items that shrink to their minimum first (gate-7 R4-01).
    var viewport by androidx.compose.runtime.remember { androidx.compose.runtime.mutableIntStateOf(0) }
    val density = androidx.compose.ui.platform.LocalDensity.current.density
    Column(Modifier.fillMaxWidth().then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
        .inspectAWCNode(LocalAWCInspection.current, "content", "content", AWCInspectionMetrics(typography = AWCInspectionTypography(size, line, 400, .25, "Roboto")))
        .then(if (group != null) Modifier.focusRequester(group).focusGroup() else Modifier)
        .onSizeChanged { viewport = it.height }
        .verticalScroll(rememberScrollState())
        .padding(start = gutter.dp, end = gutter.dp, top = top.dp, bottom = bottom.dp), horizontalAlignment = horizontal) {
        CompositionLocalProvider(LocalTextStyle provides modalText(size, line, ink, .25, align = align), LocalContentColor provides ink) {
            AWCSheetFlexColumn(if (viewport > 0) kotlin.math.max(0, viewport - ((top + bottom) * density).toInt()) else -1, horizontal) { slots.Render("") }
        }
    }
}

/**
 * The sheet content column (`display: flex; flex-direction: column`): slotted blocks are flex items (`flex: 0 1 auto`,
 * `min-height: auto`). Basis = max intrinsic height, minimum = min intrinsic height; negative free space is distributed by basis
 * and clamped at the minimum with iterative freezing, as CSS does; `available` < 0 (not yet measured) keeps the ideal heights
 * (gate-7 R4-01).
 */
@Composable
internal fun AWCSheetFlexColumn(available: Int, horizontal: androidx.compose.ui.Alignment.Horizontal, content: @Composable () -> Unit) {
    androidx.compose.ui.layout.Layout(content) { measurables, constraints ->
        val w = constraints.maxWidth
        val ideal = measurables.map { it.maxIntrinsicHeight(w).toFloat() }; val minimum = measurables.map { it.minIntrinsicHeight(w).toFloat() }
        val size = ideal.toMutableList()
        if (available >= 0 && ideal.sum() > available) {
            val frozen = ideal.indices.map { ideal[it] <= minimum[it] }.toMutableList()
            repeat(measurables.size + 1) {
                val free = available - size.sum(); val basis = ideal.indices.filter { !frozen[it] }.sumOf { ideal[it].toDouble() }.toFloat()
                if (free >= -.001f || basis <= 0f) return@repeat
                var clamped = false
                for (i in ideal.indices) if (!frozen[i]) { val t = size[i] + free * ideal[i] / basis; if (t <= minimum[i]) { size[i] = minimum[i]; frozen[i] = true; clamped = true } else size[i] = t }
                if (!clamped) return@repeat
            }
        }
        val placeables = measurables.mapIndexed { i, m -> m.measure(androidx.compose.ui.unit.Constraints(0, w, 0, kotlin.math.max(0, kotlin.math.round(size[i]).toInt()))) }
        layout(w, placeables.sumOf { it.height }) { var y = 0; placeables.forEach { p -> p.place(horizontal.align(p.width, w, layoutDirection), y); y += p.height } }
    }
}

@Composable
private fun SheetActions(slots: ModalSlots, p: AWCModalPartAppearance, local: Double?, spacingRungs: List<Double>, group: FocusRequester? = null) {
    val gap = AWCSheetSpacing.token("gap-sm", spacingRungs); val xl = AWCSheetSpacing.token("inset-xl", spacingRungs); val lg = AWCSheetSpacing.token("inset-lg", spacingRungs)
    // Actions are start-aligned (no justify-content), centred vertically, with the gap-sm gap.
    ModalSlotRow(slots, "actions", gap.dp, false, 0.dp, Modifier.fillMaxWidth().then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
        .inspectAWCNode(LocalAWCInspection.current, "actions", "actions").padding(start = xl.dp, end = xl.dp, top = lg.dp, bottom = xl.dp)
        .then(if (group != null) Modifier.focusRequester(group) else Modifier).focusGroup()) {}
}

/**
 * The parity renderer presents in the nearest [AWCModalScope] (viewport, owner stack, focus trap, key routing). Outside
 * one, `md-bottom-sheet` keeps the previous presentation (platform dialog window, preview capture), so hosts that have not
 * installed a modal scope are unchanged.
 */
@Composable
internal fun NativeBottomSheet(p: Props, onEvent: EventSink, slot: Slot?) {
    if (LocalAWCModalSession.current != null) NativeBottomSheetRenderer(p, onEvent, slot) else OverlayComponent("md-bottom-sheet", p, onEvent, slot)
}
