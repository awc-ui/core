package dev.awc.nativeui

import androidx.compose.foundation.border
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.graphics.addOutline
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal val ModalRoboto = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_medium, FontWeight.Medium), Font(R.font.awc_roboto_bold, FontWeight.Bold))
/** CSS line box text: fixed line height with centred half-leading, no font padding. */
internal fun modalText(size: Double, line: Double, color: Color, tracking: Double = 0.0, weight: Int = 400, underline: Boolean = false, align: TextAlign = TextAlign.Start) =
    TextStyle(fontFamily = ModalRoboto, fontSize = size.sp, lineHeight = line.sp, fontWeight = FontWeight(weight), letterSpacing = tracking.sp, color = color,
        textDecoration = if (underline) TextDecoration.Underline else null, textAlign = align,
        platformStyle = PlatformTextStyle(includeFontPadding = false),
        lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None, LineHeightStyle.Mode.Fixed))

/** A source slot from the explicit registry or the adapter content lambda. */
internal class ModalSlots(private val registry: AWCSlotRegistry?, private val slot: Slot?) {
    fun registered(name: String) = registry?.contains(name) == true
    @Composable fun Render(name: String) {
        if (registry?.contains(name) == true) CompositionLocalProvider(LocalAWCSlots provides null) { registry.Render(name) }
        else CompositionLocalProvider(LocalAWCSlots provides null) { slot?.invoke(name) }
    }
}

/**
 * The authored slot when it renders anything (or is registered), else [fallback], laid out in a row (gap, aligned to
 * the end or the start, centred vertically) with an optional minimum height (the source `slotchange` presence).
 */
@Composable internal fun ModalSlotRow(slots: ModalSlots, name: String, gap: Dp, end: Boolean, minHeight: Dp, modifier: Modifier, fill: Boolean = true, fallback: @Composable () -> Unit) {
    SubcomposeLayout(modifier) { constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val authored = subcompose("slot") { slots.Render(name) }.map { it.measure(loose) }
        val items = if (slots.registered(name) || authored.any { it.width > 0 || it.height > 0 }) authored else subcompose("fallback", fallback).map { it.measure(loose) }
        val g = gap.roundToPx()
        val used = items.sumOf { it.width } + max(0, items.size - 1) * g
        val height = constraints.constrainHeight(max(minHeight.roundToPx(), items.maxOfOrNull { it.height } ?: 0))
        val width = if (fill && constraints.maxWidth != Constraints.Infinity) constraints.maxWidth else constraints.constrainWidth(used)
        layout(width, height) {
            var x = if (end) width - used else 0
            items.forEach { it.placeRelative(x, (height - it.height) / 2); x += it.width + g }
        }
    }
}

internal data class AWCDialogModel(val p: Props) {
    val headline = p.str("headline"); val ariaLabel = p.str("dialogAriaLabel"); val icon = p.str("icon")
    val fullscreen = p.bool("fullscreen"); val scrimDismissible = p.bool("scrimDismissible", true); val locale = p.str("locale", "en-US")
    val divider = p.bool("divider"); val headerDivider = p.bool("headerDivider"); val hidden = p.bool("hidden")
    val density: Double? = (p["density"] as? Number)?.toDouble()
    fun label(key: String): String {
        val explicit = when (key) { "close" -> p.str("closeLabel"); "cancel" -> p.str("cancelLabel"); else -> p.str("okLabel") }
        return explicit.ifEmpty { AWCDialogLabels.resolve(locale, key) }
    }
}

/** Per-instance runtime: open cycle, CSS transition tracks on the frame clock, owner and focus handles. */
internal class NativeDialogState(id: String) {
    val clock = AWCModalClock()
    val track = AWCCSSTransitionTrack()
    val tint = AWCCSSTransitionTrack()
    var pending: Double? = null
    var tintPending: Double? = null
    var emitted: Boolean? = null
    val owner = AWCModalOwner(id)
    val cancel = AWCButtonFocusState(); val ok = AWCButtonFocusState()
    var cancelFocused by mutableStateOf(false); var okFocused by mutableStateOf(false)
    val close = FocusRequester(); var closeFocused by mutableStateOf(false); var closeVisible by mutableStateOf(true); var closeAttached = false
    val container = FocusRequester(); var containerWanted = false; var containerFocused by mutableStateOf(false)
    var fallbackActions = false
    val contentGroup = FocusRequester(); var contentHasFocus = false
    val actionsGroup = FocusRequester(); var actionsHasFocus = false
    var focusSerial by mutableIntStateOf(0)
    var surfaceAttached = false
    /** Window position of the last pointer event the surface saw: real movement versus a synthesized event (Compose
     *  re-sends the last pointer position when content moves under a still pointer). */
    var pointerWindow: Offset? = null
    fun running(now: Double) = pending != null || tintPending != null || track.isRunning(now) || tint.isRunning(now)
}

/**
 * md-dialog: basic (centred alertdialog over a scrim) and fullscreen (dialog filling the viewport), hosted by the
 * nearest [AWCModalScope] (or an implicit one). Events: mdOpen/mdClose on every open change; a user dismissal
 * (Escape, back, enabled scrim, close button, fallback Cancel) emits mdCancel then mdClose; the fallback OK and
 * `close()` emit mdClose only. All payloads are null.
 */
@Composable
internal fun NativeDialogRenderer(p: Props, onEvent: EventSink, slot: Slot?) {
    val m = AWCDialogModel(p)
    val emit by rememberUpdatedState(onEvent)
    var open by awcState(p["open"]) { p.bool("open") }
    val identity = remember { "md-dialog-" + java.util.UUID.randomUUID() }
    val s = remember { NativeDialogState(identity) }
    val tokens = LocalAWCThemeTokens.current
    val reduced = rememberAWCAccessibilityAppearance().first
    val duration = if (reduced) 0.0 else cardDuration(tokens, "--md-sys-motion-duration-medium2", 300.0)
    val curve = accordionCubicBezierCurve(tokens["--md-sys-motion-easing-standard"]) ?: listOf(.2, 0.0, 0.0, 1.0)
    val now = s.clock.frameMillis
    val visible = !m.hidden && (open || s.pending != null || s.track.isRunning(now) || s.track.presented(now) > 1e-4)
    val slots = ModalSlots(LocalAWCSlots.current, slot)
    val rtl = androidx.compose.ui.platform.LocalLayoutDirection.current == androidx.compose.ui.unit.LayoutDirection.Rtl
    AWCModalImplicitScope(visible) {
        val session = LocalAWCModalSession.current
        val controller = LocalAWCDialogController.current
        fun sync(value: Boolean) {
            val a = value && !m.hidden
            if (s.emitted == null) {
                // First connection: an initially open dialog opens with motion and emits mdOpen (componentDidLoad).
                s.emitted = a
                if (a) { s.pending = 1.0; s.clock.version++; session?.acquire(s.owner); emit("mdOpen", null); s.focusSerial++ }
                return
            }
            if (a == s.emitted) return
            s.emitted = a
            s.pending = if (a) 1.0 else 0.0; s.clock.version++
            if (a) { session?.acquire(s.owner); emit("mdOpen", null); s.focusSerial++ } else { session?.release(identity); emit("mdClose", null) }
        }
        fun dismiss(cancel: Boolean) {
            if (!open || (session != null && !session.isTop(identity))) return
            if (cancel) emit("mdCancel", null)
            open = false; sync(false)
        }
        SideEffect { sync(open) }
        DisposableEffect(Unit) { onDispose { if (s.emitted == true) session?.release(identity); s.emitted = null } }
        SideEffect {
            s.owner.containerHasFocus = { s.containerFocused }
            s.owner.groups = listOf(s.contentGroup, s.actionsGroup)
            s.owner.escape = { if (open && session?.isTop(identity) != false) { dismiss(true); true } else false }
            s.owner.focusContainer = { s.containerWanted = true; runCatching { s.container.requestFocus() }.getOrDefault(false) }
            s.owner.focused = { pointer ->
                // After a pointer interaction programmatic focus is not :focus-visible (own controls hide their ring).
                if (pointer && s.cancelFocused) s.cancel.requestPointerFocus()
                if (pointer && s.okFocused) s.ok.requestPointerFocus()
                s.closeVisible = !pointer
            }
            controller?.let { c ->
                c.showAction = { if (!open) { open = true; sync(true) } }
                c.closeAction = { if (open) { open = false; sync(false) } }
                c.openState = { open }
                c.exiting = { s.pending != null || s.track.isRunning(s.clock.frameMillis) }
            }
        }
        AWCModalTicker(s.clock, { s.running(it) }) { ms ->
            s.pending?.let { s.track.set(it, ms, duration, curve); s.pending = null }
            s.tintPending?.let { s.tint.set(it, ms, if (reduced) 0.0 else cardDuration(tokens, "--md-sys-motion-duration-short1", 50.0), curve); s.tintPending = null }
        }
        // Initial focus one frame after open, once the surface is attached (the source requestAnimationFrame).
        LaunchedEffect(s.focusSerial) {
            if (s.focusSerial == 0) return@LaunchedEffect
            var frames = 0
            do { withFrameNanos { }; frames++ } while (!s.surfaceAttached && frames < 10)
            if (open && session?.isTop(identity) == true) session.focusFirst(s.owner)
        }
        val context = currentCompositionLocalContext
        val appearance = LocalAWCDialogAppearance.current.merge(LocalAWCDialogAppearanceTargets.current[p.str("id")] ?: AWCDialogAppearance())
        AWCModalEntryEffect(session, identity, visible, appearance.zIndex ?: 2147483647.0) {
            CompositionLocalProvider(context) {
                // Slot content is reached only through `slots`; the dialog's own controls see no registry or controller.
                CompositionLocalProvider(LocalAWCDialogController provides null, LocalAWCSlots provides null) {
                    DialogShell(m, s, session, appearance, slots, reduced, open, ::dismiss)
                }
            }
        }
        Box(Modifier.size(0.dp).semantics { hideFromAccessibility() })
    }
}
@Composable
private fun DialogShell(m: AWCDialogModel, s: NativeDialogState, session: AWCModalSession?, appearance: AWCDialogAppearance, slots: ModalSlots,
                        reduced: Boolean, open: Boolean, dismiss: (Boolean) -> Unit) {
    val parts = LocalAWCDialogParts.current
    val id = m.p.str("id")
    val part = { x: AWCDialogPart -> (parts[x.source] ?: AWCModalPartAppearance()).merge(parts["$id|${x.source}"] ?: AWCModalPartAppearance()) }
    val inspection = LocalAWCInspection.current
    val d = resolveAWCDensity(m.density, LocalAWCNativeDensity.current)
    val vw = session?.viewportWidth ?: 0.0; val vh = session?.viewportHeight ?: 0.0
    val t = s.clock.frameMillis
    val presented = if (reduced) (if (open && !m.hidden) 1.0 else 0.0) else s.track.presented(t)
    val fullscreen = m.fullscreen
    val width = if (fullscreen) vw else min(560.0, max(280.0, vw - 48))
    val shift = (if (fullscreen) 30.0 else 20.0) * (1 - presented)
    val corners = if (fullscreen) AWCCornerShape.uniform(0.0) else appearance.containerShape ?: AWCCornerShape.uniform(max(16.0, 28 + 2 * d))
    val name = m.ariaLabel.ifEmpty { m.headline }
    val inspector = LocalAWCModalInspector.current
    if (inspector != null) {
        val values = AWCModalInspection { mapOf("frameMillis" to s.clock.frameMillis, "opacity" to presented, "translateY" to shift,
            "scrim" to if (fullscreen) null else presented, "closeTint" to if (fullscreen) s.tint.presented(s.clock.frameMillis) else null,
            "role" to if (fullscreen) "dialog" else "alertdialog", "label" to name, "open" to open,
            "radius" to corners.radii(width, 100.0).first().first,
            "focus" to when { s.cancelFocused -> "cancel-button"; s.okFocused -> "ok-button"; s.closeFocused -> "close-button"; s.containerFocused -> "container"; else -> "" },
            "openerSaved" to (s.owner.opener != null), "restore" to (session?.lastRestore ?: ""),
            "focusVisible" to (s.cancel.isFocusVisible || s.ok.isFocusVisible || (s.closeFocused && s.closeVisible))) }
        SideEffect { inspector(id, values) }
    }
    Box(Modifier.fillMaxSize().inspectAWCNode(inspection, "", "md-dialog")) {
        if (!fullscreen) {
            // forced-colors: the UA forces the scrim's background to Canvas keeping its alpha.
            val forcedScrim = awcForcedColors()?.let { f -> awcColor(f.canvasKeepingAlphaOf(part(AWCDialogPart.Scrim).background ?: appearance.scrimColor ?: "#00000052"), Color.Black) }
            val scrimColor = forcedScrim ?: part(AWCDialogPart.Scrim).background?.let { awcColor(it, Color.Transparent) } ?: appearance.scrimColor?.let { awcColor(it, Color.Transparent) } ?: Color(0f, 0f, 0f, .32f)
            val scrimZ = appearance.scrimZIndex ?: 2147483646.0; val z = appearance.zIndex ?: 2147483647.0
            Box(Modifier.fillMaxSize().zIndex(if (scrimZ > z) 1f else 0f)
                .drawBehind { drawRect(scrimColor.copy(alpha = scrimColor.alpha * presented.toFloat())) }
                .then(if (open) Modifier.pointerInput(m.scrimDismissible) {
                    awaitPointerEventScope {
                        while (true) {
                            val e = awaitPointerEvent(PointerEventPass.Main)
                            e.changes.forEach { it.consume() }
                            if (e.type == PointerEventType.Press) {
                                // Chrome: pressing the non-focusable scrim blurs focus to the body (even when protected).
                                if (session?.isTop(s.owner.id) != false && !m.scrimDismissible) session?.blur()
                            } else if (e.type == PointerEventType.Release && m.scrimDismissible) dismiss(true)
                        }
                    }
                } else Modifier)
                .inspectAWCNode(inspection, "scrim", "scrim"))
        }
        // Group opacity and the motion offset apply to a viewport-sized layer, so the elevation shadow fades with the surface.
        Box(Modifier.fillMaxSize().zIndex(.5f).graphicsLayer { alpha = presented.toFloat(); translationY = (shift * density).toFloat() }) {
            DialogContainer(m, s, session, appearance, slots, d, width, vh, corners, name, part, dismiss)
        }
    }
}

@Composable
private fun DialogContainer(m: AWCDialogModel, s: NativeDialogState, session: AWCModalSession?, appearance: AWCDialogAppearance, slots: ModalSlots, d: Double,
                            width: Double, vh: Double, corners: AWCCornerShape, name: String,
                            part: (AWCDialogPart) -> AWCModalPartAppearance, dismiss: (Boolean) -> Unit) {
    val tokens = LocalAWCThemeTokens.current
    val dens = LocalDensity.current.density
    val inspection = LocalAWCInspection.current
    val fullscreen = m.fullscreen
    // forced-colors: `.md-dialog__container { border: 2px solid CanvasText }` (content-box: around the width), the UA's Canvas
    // fill keeping alpha and no box-shadow; text, icon and divider CanvasText.
    val forced = awcForcedColors()
    val fill = forced?.let { awcColor(it.canvasKeepingAlphaOf(appearance.containerColor ?: "#ECE6F0"), Color.Black) } ?: appearance.containerColor?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-surface-container-high"] ?: "#ECE6F0", Color.White)
    val containerPart = part(AWCDialogPart.Container)
    val cv = max(8.0, 16 + 2 * d); val ch = max(12.0, 24 + 2 * d)
    val contentTop = if (fullscreen) max(12.0, 24 + 2 * d) else cv
    val headerDivider = fullscreen && m.headerDivider
    val shadow = if (fullscreen || forced != null) emptyList() else NativeShadowLayer.parse(tokens["--md-sys-elevation-3"])
    val borderPx = if (forced != null) (2 * 2 * dens).roundToInt() else 0
    val contentIndex = if (headerDivider) 2 else 1
    val maxHeight = vh - 96
    val w = (width * dens).roundToInt(); val fullH = (vh * dens).roundToInt()
    val inherited = LocalAWCNativeDensity.current
    // State read in the measure block: a retained width/fullscreen change re-measures the open surface (see the sheet).
    val geometry = rememberUpdatedState(Triple(w, fullH, fullscreen))
    Layout(modifier = Modifier
        .layout { measurable, constraints ->
            val (gw, gh, gf) = geometry.value
            val pl = measurable.measure(Constraints(minWidth = gw + borderPx, maxWidth = gw + borderPx, minHeight = if (gf) gh else 0, maxHeight = if (gf) gh else Constraints.Infinity))
            layout(constraints.maxWidth, constraints.maxHeight) {
                if (gf) pl.place(0, 0) else pl.place(((constraints.maxWidth - pl.width) / 2f).roundToInt(), ((constraints.maxHeight - pl.height) / 2f).roundToInt())
            }
        }
        .then(if (shadow.isNotEmpty()) Modifier.accordionShadow(corners, shadow, false) else Modifier)
        .clip(corners)
        .background((if (forced == null) containerPart.background?.let { awcColor(it, Color.Transparent) } else null) ?: fill)
        .drawWithContent {
            drawContent()
            val o = containerPart.outlineColor; val ow = containerPart.outlineWidth
            if (o != null && ow != null && ow > 0) {
                // outline with a negative offset of its width: a stroke inside the border box.
                val px = (ow * density).toFloat()
                val outline = corners.createOutline(androidx.compose.ui.geometry.Size(size.width - px, size.height - px), layoutDirection, this)
                val path = Path().apply { addOutline(outline) }
                translate(px / 2, px / 2) { drawPath(path, awcColor(o, Color.Transparent), style = Stroke(px)) }
            }
        }
        .awcModalSurface(session, s.owner)
        .onGloballyPositioned { s.surfaceAttached = true }
        .focusRequester(s.container)
        .onFocusChanged { s.containerFocused = it.isFocused; if (!it.isFocused) s.containerWanted = false }
        .focusProperties { canFocus = s.containerWanted }
        .focusable()
        // The surface takes its own pointer input: presses on it never reach the scrim below. The final pass records
        // the window position after the controls (main pass) compared it with the previous one.
        .pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Final); e.motionEvent?.let { s.pointerWindow = Offset(it.x, it.y) } } } }
        .semantics { paneTitle = name; if (name.isNotEmpty()) contentDescription = name; isTraversalGroup = true }
        .inspectAWCNode(inspection, "container", "container")
        .then(if (forced != null) Modifier.border(2.dp, awcColor(forced.canvasText, Color.White), corners).awcBorderInset(2.dp) else Modifier),
        content = {
            CompositionLocalProvider(LocalAWCNativeDensity provides d) {
                DialogHeader(m, s, d, fill, slots, appearance, part, dismiss)
                if (headerDivider) DialogDivider(part(AWCDialogPart.Divider), appearance, "divider", tokens)
                DialogContent(d, contentTop, cv, ch, part(AWCDialogPart.Content), appearance, tokens, slots,
                    Modifier.focusRequester(s.contentGroup).onFocusChanged { s.contentHasFocus = it.hasFocus }.focusGroup())
                if (m.divider) DialogDivider(part(AWCDialogPart.Divider), appearance, if (headerDivider) "divider-bottom" else "divider", tokens)
                DialogActions(m, s, d, inherited, slots, part(AWCDialogPart.Actions), dismiss)
            }
        }) { measurables, constraints ->
        // Header, dividers and actions keep their natural height (flex-shrink:0); the content takes what remains of
        // min(natural, max-block-size) (basic) or of the viewport (fullscreen), never less than its padding.
        val cw = constraints.maxWidth
        val others = measurables.mapIndexedNotNull { i, ms -> if (i == contentIndex) null else i to ms.measure(Constraints(minWidth = cw, maxWidth = cw)) }.toMap()
        val othersHeight = others.values.sumOf { it.height }
        val contentMin = ((contentTop + cv) * dens).roundToInt()
        val contentMax = if (fullscreen) max(contentMin, fullH - othersHeight) else max(contentMin, (maxHeight * dens).roundToInt() - othersHeight)
        val content = measurables[contentIndex].measure(Constraints(minWidth = cw, maxWidth = cw, minHeight = if (fullscreen) contentMax else contentMin, maxHeight = contentMax))
        // The surface is min(natural, max-block-size) tall; rows that do not fit overflow and are clipped.
        val total = if (fullscreen) fullH else min(othersHeight + content.height, max(0, (maxHeight * dens).roundToInt()))
        layout(cw, max(0, total)) {
            var y = 0
            for (i in measurables.indices) { val pl = if (i == contentIndex) content else others[i]!!; pl.place(0, y); y += pl.height }
        }
    }
}

@Composable
private fun DialogHeader(m: AWCDialogModel, s: NativeDialogState, d: Double, fill: Color, slots: ModalSlots, appearance: AWCDialogAppearance,
                         part: (AWCDialogPart) -> AWCModalPartAppearance, dismiss: (Boolean) -> Unit) {
    val tokens = LocalAWCThemeTokens.current
    val inspection = LocalAWCInspection.current
    val headerPart = part(AWCDialogPart.Header)
    val headlinePart = part(AWCDialogPart.Headline)
    val headlineColor = awcForcedColors()?.let { awcColor(it.canvasText, Color.White) } ?: headlinePart.color?.let { awcColor(it, Color.Transparent) } ?: appearance.headlineColor?.let { awcColor(it, Color.Transparent) }
        ?: awcColor(tokens["--md-sys-color-on-surface"] ?: "#1C1B1F", Color.Black)
    val headlineBg = headlinePart.background?.let { awcColor(it, Color.Transparent) }
    @Composable fun headlineText(size: Double, line: Double, single: Boolean, center: Boolean) {
        val style = modalText(size, line, headlineColor, headlinePart.letterSpacing ?: 0.0, underline = headlinePart.underline == true, align = if (center) TextAlign.Center else TextAlign.Start)
        CompositionLocalProvider(LocalTextStyle provides style, LocalContentColor provides headlineColor) {
            if (slots.registered("headline")) slots.Render("headline")
            else SubcomposeLayout { c ->
                val authored = subcompose("slot") { slots.Render("headline") }.map { it.measure(c.copy(minWidth = 0)) }
                val items = if (authored.any { it.width > 0 || it.height > 0 }) authored
                    else if (m.headline.isEmpty()) emptyList()
                    else subcompose("fallback") {
                        if (single) Text(m.headline, style = style, maxLines = 1, overflow = TextOverflow.Ellipsis, softWrap = false)
                        else NativeSourceText(m.headline, style, wrap = true, wordWrapOnly = true)
                    }.map { it.measure(c.copy(minWidth = 0)) }
                val wd = c.constrainWidth(items.maxOfOrNull { it.width } ?: 0); val ht = items.sumOf { it.height }
                layout(wd, ht) { var y = 0; items.forEach { it.placeRelative(if (center) (wd - it.width) / 2 else 0, y); y += it.height } }
            }
        }
    }
    if (m.fullscreen) {
        val hh = max(48.0, 64 + 4 * d); val pi = max(8.0, 16 + 2 * d); val gap = max(4.0, 12 + 2 * d)
        val hasHeadline = m.headline.isNotEmpty() || slots.registered("headline")
        // close, the headline (flex:1, one line with ellipsis) and the header action; the flex gap only separates rendered items.
        SubcomposeLayout(Modifier.fillMaxWidth().height(hh.dp).background(headerPart.background?.let { awcColor(it, Color.Transparent) } ?: fill)
            .inspectAWCNode(inspection, "header", "header")) { c ->
            val loose = Constraints(0, c.maxWidth, 0, c.maxHeight)
            val p = pi.dp.roundToPx(); val g = gap.dp.roundToPx(); val inner = c.maxWidth - 2 * p
            val close = subcompose("close") { DialogCloseButton(m.label("close"), s, part(AWCDialogPart.CloseButton), s.emitted == true, Modifier.awcCursor(AWCCursorStyle.Pointer).inspectAWCNode(inspection, "close-button", "close-button")) { dismiss(true) } }
                .map { it.measure(loose) }
            val action = subcompose("action") { Box(Modifier.inspectAWCNode(inspection, "header-action", "header-action")) { slots.Render("header-action") } }
                .map { it.measure(loose) }.filter { it.width > 0 || it.height > 0 }
            val closeW = close.maxOfOrNull { it.width } ?: 0
            val actionW = action.maxOfOrNull { it.width } ?: 0
            val headlineW = max(0, inner - closeW - g - if (action.isNotEmpty()) actionW + g else 0)
            val headline = if (!hasHeadline && !slots.registered("headline")) subcompose("headline") {
                    Box(Modifier.then(if (headlineBg != null) Modifier.background(headlineBg) else Modifier)) { headlineText(max(16.0, 22 + d), max(22.0, 28 + d), true, false) }
                }.map { it.measure(Constraints(headlineW, headlineW, 0, c.maxHeight)) }.filter { it.height > 0 }
                else subcompose("headline") {
                    Box(Modifier.then(if (headlineBg != null) Modifier.background(headlineBg) else Modifier).inspectAWCNode(inspection, "headline", "headline")) { headlineText(max(16.0, 22 + d), max(22.0, 28 + d), true, false) }
                }.map { it.measure(Constraints(headlineW, headlineW, 0, c.maxHeight)) }
            layout(c.maxWidth, c.maxHeight) {
                close.forEach { it.placeRelative(p, (c.maxHeight - it.height) / 2) }
                headline.forEach { it.placeRelative(p + closeW + g, (c.maxHeight - it.height) / 2) }
                action.forEach { it.placeRelative(c.maxWidth - p - it.width, (c.maxHeight - it.height) / 2) }
            }
        }
    } else {
        val pad = max(12.0, 24 + 2 * d); val gap = max(8.0, 16 + 2 * d)
        val size = max(18.0, 24 + d); val line = max(24.0, 32 + 2 * d)
        // icon (authored or the icon property), then the headline: a fit-content block, centred with an icon.
        SubcomposeLayout(Modifier.fillMaxWidth().then(if (headerPart.background != null) Modifier.background(awcColor(headerPart.background, Color.Transparent)) else Modifier)
            .inspectAWCNode(inspection, "header", "header").padding(top = pad.dp, start = pad.dp, end = pad.dp)) { c ->
            val loose = c.copy(minWidth = 0, minHeight = 0)
            val iconSlot = subcompose("icon-slot") { DialogIcon(null, slots, appearance, part(AWCDialogPart.Icon)) }.map { it.measure(loose) }
            val icon = if (slots.registered("icon") || iconSlot.any { it.width > 0 && it.height > 0 }) iconSlot
                else if (m.icon.isNotEmpty()) subcompose("icon") { DialogIcon(m.icon, slots, appearance, part(AWCDialogPart.Icon)) }.map { it.measure(loose) } else emptyList()
            val hasIcon = icon.isNotEmpty()
            val headline = subcompose("headline") {
                Box(Modifier.then(if (headlineBg != null) Modifier.background(headlineBg) else Modifier).inspectAWCNode(inspection, "headline", "headline")) {
                    headlineText(size, line, false, hasIcon)
                }
            }.map { it.measure(loose) }.filter { it.width > 0 || it.height > 0 }
            val rows = icon + headline
            val g = gap.dp.roundToPx()
            val ht = rows.sumOf { it.height } + max(0, rows.size - 1) * g
            layout(c.maxWidth, ht) { var y = 0; rows.forEach { it.placeRelative(if (hasIcon) (c.maxWidth - it.width) / 2 else 0, y); y += it.height + g } }
        }
    }
}

@Composable
private fun DialogIcon(symbol: String?, slots: ModalSlots, appearance: AWCDialogAppearance, iconPart: AWCModalPartAppearance) {
    val tokens = LocalAWCThemeTokens.current
    val size = appearance.iconSize ?: 24.0
    val ink = awcForcedColors()?.let { awcColor(it.canvasText, Color.White) } ?: iconPart.color?.let { awcColor(it, Color.Transparent) } ?: appearance.iconColor?.let { awcColor(it, Color.Transparent) }
        ?: awcColor(tokens["--md-sys-color-secondary"] ?: "#625B71", Color.Black)
    CompositionLocalProvider(LocalContentColor provides ink, LocalAWCButtonSlotSize provides size.dp,
        LocalTextStyle provides LocalTextStyle.current.merge(TextStyle(color = ink, fontSize = size.sp, lineHeight = size.sp))) {
        if (symbol == null) {
            // Authored icon: only present when it renders.
            Box(Modifier.inspectAWCNode(LocalAWCInspection.current, "icon", "icon")) { slots.Render("icon") }
        } else Box(Modifier.size(size.dp).inspectAWCNode(LocalAWCInspection.current, "icon", "icon"), contentAlignment = Alignment.Center) { AWCMaterialSymbol(symbol, size = size.dp) }
    }
}

@Composable
private fun DialogDivider(p: AWCModalPartAppearance, appearance: AWCDialogAppearance, name: String, tokens: Map<String, String>) {
    val color = awcForcedColors()?.let { awcColor(it.canvasText, Color.White) } ?: p.background?.let { awcColor(it, Color.Transparent) } ?: appearance.dividerColor?.let { awcColor(it, Color.Transparent) }
        ?: awcColor(tokens["--md-sys-color-outline-variant"] ?: "#CAC4D0", Color.Gray)
    Box(Modifier.fillMaxWidth().height((p.height ?: 1.0).dp).background(color).inspectAWCNode(LocalAWCInspection.current, name, name))
}

@Composable
private fun DialogContent(d: Double, top: Double, bottom: Double, inline: Double, p: AWCModalPartAppearance, appearance: AWCDialogAppearance,
                          tokens: Map<String, String>, slots: ModalSlots, group: Modifier) {
    val size = max(12.0, 14 + .5 * d); val line = max(16.0, 20 + d)
    val ink = awcForcedColors()?.let { awcColor(it.canvasText, Color.White) } ?: p.color?.let { awcColor(it, Color.Transparent) } ?: appearance.contentColor?.let { awcColor(it, Color.Transparent) }
        ?: awcColor(tokens["--md-sys-color-on-surface-variant"] ?: "#49454F", Color.DarkGray)
    val style = modalText(size, line, ink, .25)
    Column(Modifier.fillMaxWidth().then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
        .inspectAWCNode(LocalAWCInspection.current, "content", "content", AWCInspectionMetrics(typography = AWCInspectionTypography(size, line, 400, .25, "Roboto")))
        .then(group)
        .verticalScroll(rememberScrollState())
        .padding(start = inline.dp, end = inline.dp, top = top.dp, bottom = bottom.dp)) {
        CompositionLocalProvider(LocalTextStyle provides style, LocalContentColor provides ink) { slots.Render("") }
    }
}

@Composable
private fun DialogActions(m: AWCDialogModel, s: NativeDialogState, d: Double, inherited: Double, slots: ModalSlots, p: AWCModalPartAppearance, dismiss: (Boolean) -> Unit) {
    val local = m.density?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) }
    val gap = AWCModalSpacing.gapSM(local, inherited)
    val inspection = LocalAWCInspection.current
    val padding = if (m.fullscreen) PaddingValues(horizontal = max(12.0, 24 + 2 * d).dp, vertical = max(4.0, 8 + d).dp)
        else AWCModalSpacing.insetXL(local, inherited).let { PaddingValues(start = it.dp, end = it.dp, bottom = it.dp, top = if (m.divider) it.dp else 0.dp) }
    ModalSlotRow(slots, "actions", gap.dp, true, if (m.fullscreen) max(40.0, 56 + 4 * d).dp else 0.dp,
        Modifier.fillMaxWidth().then(if (p.background != null) Modifier.background(awcColor(p.background, Color.Transparent)) else Modifier)
            .inspectAWCNode(inspection, "actions", "actions").padding(padding)
            .focusRequester(s.actionsGroup).onFocusChanged { s.actionsHasFocus = it.hasFocus }.focusGroup()) {
        DisposableEffect(Unit) { s.fallbackActions = true; onDispose { s.fallbackActions = false } }
        Box(Modifier.inspectAWCNode(inspection, "cancel-button", "cancel-button")) {
            AWCButtonFocusScope(s.cancel, { s.cancelFocused = it }) {
                AWCComponent("md-button", mapOf("variant" to "text", "label" to m.label("cancel")), onEvent = { n, _ -> if (n == "mdClick") dismiss(true) })
            }
        }
        Box(Modifier.inspectAWCNode(inspection, "ok-button", "ok-button")) {
            AWCButtonFocusScope(s.ok, { s.okFocused = it }) {
                AWCComponent("md-button", mapOf("variant" to "filled", "label" to m.label("ok")), onEvent = { n, _ -> if (n == "mdClick") dismiss(false) })
            }
        }
    }
}

/**
 * Fullscreen close control: 40×40 circle, 24 dp glyph, 8 % hover / 12 % press on-surface tint on the short1 standard
 * transition, a 3 dp secondary focus ring inset by its width; a press focuses it without the keyboard ring.
 */
@Composable
private fun DialogCloseButton(label: String, s: NativeDialogState, p: AWCModalPartAppearance, open: Boolean, modifier: Modifier, action: () -> Unit) {
    val tokens = LocalAWCThemeTokens.current
    val forced = awcForcedColors()
    val ink = forced?.let { awcColor(it.buttonText, Color.White) } ?: p.color?.let { awcColor(it, Color.Transparent) } ?: awcColor(tokens["--md-sys-color-on-surface"] ?: "#1C1B1F", Color.Black)
    val ring = awcColor(forced?.highlight ?: tokens["--md-sys-color-secondary"] ?: "#625B71", Color.Gray)
    var hover by remember { mutableStateOf(false) }; var pressed by remember { mutableStateOf(false) }
    var lastInside by remember { mutableStateOf(false) }
    LaunchedEffect(open) { if (!open && lastInside) hover = true }
    val keyInputs = LocalAWCModalSession.current?.keyInputs ?: 0
    LaunchedEffect(keyInputs) { if (keyInputs > 0 && lastInside) hover = true }
    // Applied in the closing composition itself (the effect below only keeps it), so the tint starts on the same frame.
    val target = if (pressed) .12 else if (hover || (!open && lastInside)) .08 else 0.0
    var primed by remember { mutableStateOf(false) }
    SideEffect { if (!primed) { s.tint.snap(target); primed = true } else if (target != s.tint.value && s.tintPending != target) { s.tintPending = target; s.clock.version++ } }
    DisposableEffect(Unit) { s.closeAttached = true; onDispose { s.closeAttached = false } }
    val bg = p.background?.let { awcColor(it, Color.Transparent) }
    Box(modifier.size(40.dp)
        .focusRequester(s.close)
        .onFocusChanged { s.closeFocused = it.isFocused }
        .onPreviewKeyEvent { e -> if (e.type == KeyEventType.KeyDown) s.closeVisible = true
            if (e.type == KeyEventType.KeyDown && (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.Spacebar)) { action(); true } else false }
        .focusable()
        .pointerInput(Unit) {
            awaitPointerEventScope {
                while (true) {
                    val e = awaitPointerEvent()
                    val c = e.changes.firstOrNull() ?: continue
                    val inside = c.position.x >= 0 && c.position.y >= 0 && c.position.x < size.width && c.position.y < size.height
                    // Real movement changes the pointer's window position; an event synthesized because the control
                    // moved under a still pointer repeats it.
                    val window = e.motionEvent?.let { Offset(it.x, it.y) }
                    val moved = window != null && s.pointerWindow != null && window != s.pointerWindow
                    when (e.type) {
                        // Chrome updates :hover on real pointer movement, not when the control appears under a still
                        // pointer; it re-evaluates it at the next key input and when the dialog starts closing.
                        PointerEventType.Enter, PointerEventType.Move -> { lastInside = inside; if (moved) hover = inside }
                        // A still pointer left behind by the closing (moving) dialog keeps :hover, as in Chrome.
                        PointerEventType.Exit -> { lastInside = false; if (moved) hover = false }
                        PointerEventType.Press -> { pressed = true; hover = inside; s.closeVisible = false; runCatching { s.close.requestFocus() }; c.consume() }
                        PointerEventType.Release -> { val was = pressed; pressed = false; c.consume(); if (was && inside) action() }
                    }
                }
            }
        }
        .semantics { role = Role.Button; contentDescription = label }
        .drawBehind {
            val r = size.minDimension / 2
            drawCircle(ink.copy(alpha = ink.alpha * s.tint.presented(s.clock.frameMillis).toFloat()), r)
            if (bg != null) drawCircle(bg, r)
            val g = 24.dp.toPx(); val o = Offset((size.width - g) / 2, (size.height - g) / 2); val k = g / 24f
            val pts = listOf(19f to 6.41f, 17.59f to 5f, 12f to 10.59f, 6.41f to 5f, 5f to 6.41f, 10.59f to 12f, 5f to 17.59f, 6.41f to 19f, 12f to 13.41f, 17.59f to 19f, 19f to 17.59f, 13.41f to 12f)
            val path = Path().apply { pts.forEachIndexed { i, (x, y) -> if (i == 0) moveTo(o.x + x * k, o.y + y * k) else lineTo(o.x + x * k, o.y + y * k) }; close() }
            drawPath(path, ink)
            if (s.closeFocused && s.closeVisible) drawCircle(ring, r - 1.5.dp.toPx(), style = Stroke(3.dp.toPx()))
        })
}

/**
 * The parity renderer presents in the nearest [AWCModalScope] (viewport, owner stack, focus trap, key routing). Outside
 * one, `md-dialog` keeps the previous presentation (platform dialog window, preview capture), so hosts that have not
 * installed a modal scope are unchanged.
 */
@Composable
internal fun NativeDialog(p: Props, onEvent: EventSink, slot: Slot?) {
    if (LocalAWCModalSession.current != null) NativeDialogRenderer(p, onEvent, slot) else OverlayComponent("md-dialog", p, onEvent, slot)
}
