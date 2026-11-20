package dev.awc.nativeui

import android.graphics.Paint as APaint
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.stepper.*
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Dedicated Compose renderer for md-stepper / md-step — lockstep with Swift's NativeStepper.swift. StepperModel owns the
// behaviour (active index and its watcher, linear reachability, auto-complete, navigation, the cancelable mdBeforeChange,
// announcements); StepperLayout gives every box and colour as Chrome lays them out and runs the CSS transitions through
// StepperMotion. The chrome (bubbles, dots, halos, state layers, connectors, labels, focus ring, mobile progress) is drawn
// from the layout; each md-step emits its header control, its panel content and (vertical) its Back / Continue row as the
// stepper's own layout children, so the authored order is the keyboard order (header, its panel, the next header…); the
// `content` slot and the built-in nav (native md-buttons) follow. The stepper measures the panels and buttons and feeds
// their sizes into the layout before it places anything (no frame of lag).

// MARK: - Public API

/** Typed `--md-step-*` hooks (19, inherited by every step) and `--md-stepper-gap`: colours as CSS colour text, lengths in dp. */
@Immutable
class AWCStepperAppearance private constructor(val css: Map<String, String>) {
    constructor(indicatorSize: Double? = null, indicatorRing: Double? = null, indicatorColor: String? = null, indicatorText: String? = null,
                activeColor: String? = null, activeText: String? = null, activeHaloColor: String? = null, completedColor: String? = null,
                completedText: String? = null, errorColor: String? = null, errorText: String? = null, connectorColor: String? = null,
                connectorFilledColor: String? = null, connectorThickness: Double? = null, labelColor: String? = null, labelActiveColor: String? = null,
                descriptionColor: String? = null, stateLayerColor: String? = null, panelPaddingBlockStart: Double? = null, gap: Double? = null,
                connectorDuration: Double? = null, expandDuration: Double? = null, collapseDuration: Double? = null) : this(buildMap {
        fun px(k: String, v: Double?) { if (v != null && v.isFinite()) put("--md-step-$k", "${v}px") }
        fun text(k: String, v: String?) { if (!v.isNullOrEmpty()) put("--md-step-$k", v) }
        px("indicator-size", indicatorSize); px("indicator-ring", indicatorRing); text("indicator-color", indicatorColor); text("indicator-text", indicatorText)
        text("active-color", activeColor); text("active-text", activeText); text("active-halo-color", activeHaloColor); text("completed-color", completedColor)
        text("completed-text", completedText); text("error-color", errorColor); text("error-text", errorText); text("connector-color", connectorColor)
        text("connector-filled-color", connectorFilledColor); px("connector-thickness", connectorThickness); text("label-color", labelColor)
        text("label-active-color", labelActiveColor); text("description-color", descriptionColor); text("state-layer-color", stateLayerColor)
        px("panel-padding-block-start", panelPaddingBlockStart)
        fun ms(k: String, v: Double?) { if (v != null && v.isFinite() && v >= 0) put("--md-step-$k", "${v}ms") }
        ms("connector-duration", connectorDuration); ms("expand-duration", expandDuration); ms("collapse-duration", collapseDuration)
        if (gap != null && gap.isFinite()) put("--md-stepper-gap", "${gap}px")
    })
    /** Nearer values win. */
    fun merging(other: AWCStepperAppearance) = AWCStepperAppearance(css + other.css)
    override fun equals(other: Any?) = other is AWCStepperAppearance && other.css == css
    override fun hashCode() = css.hashCode()
    companion object {
        val stepSuffixes = listOf("indicator-size", "indicator-ring", "indicator-color", "indicator-text", "active-color", "active-text", "active-halo-color",
            "completed-color", "completed-text", "error-color", "error-text", "connector-color", "connector-filled-color", "connector-thickness",
            "label-color", "label-active-color", "description-color", "state-layer-color", "panel-padding-block-start",
            "connector-duration", "expand-duration", "collapse-duration")
        /** From CSS custom properties (`--md-step-*` hooks and `--md-stepper-gap`; anything else is ignored). */
        fun fromCss(values: Map<String, String>) = AWCStepperAppearance(values.filterKeys { it == "--md-stepper-gap" || (it.startsWith("--md-step-") && it.removePrefix("--md-step-") in stepSuffixes) })
        /** From typed values keyed by the camelCase hook names (indicatorSize, activeColor, …, gap). */
        fun fromValues(v: Map<String, AWCValue>): AWCStepperAppearance {
            fun n(k: String) = (v[k] as? Number)?.toDouble()
            fun s(k: String) = v[k] as? String
            return AWCStepperAppearance(n("indicatorSize"), n("indicatorRing"), s("indicatorColor"), s("indicatorText"), s("activeColor"), s("activeText"),
                s("activeHaloColor"), s("completedColor"), s("completedText"), s("errorColor"), s("errorText"), s("connectorColor"), s("connectorFilledColor"),
                n("connectorThickness"), s("labelColor"), s("labelActiveColor"), s("descriptionColor"), s("stateLayerColor"), n("panelPaddingBlockStart"), n("gap"),
                n("connectorDuration"), n("expandDuration"), n("collapseDuration"))
        }
    }
}

/** md-stepper's methods: next(), prev(), goTo(index), reset() (the source's navigation rules and events). */
@Stable
class AWCStepperController {
    internal var actions: ((String, Int?) -> Unit)? = null
    val isConnected: Boolean get() = actions != null
    fun next() { actions?.invoke("next", null) }
    fun prev() { actions?.invoke("prev", null) }
    fun goTo(index: Int) { actions?.invoke("goTo", index) }
    fun reset() { actions?.invoke("reset", null) }
}

internal val LocalAWCStepperAppearance = staticCompositionLocalOf { AWCStepperAppearance() }
internal val LocalAWCStepperController = staticCompositionLocalOf<AWCStepperController?> { null }
internal val LocalAWCStepperReducedMotion = staticCompositionLocalOf<Boolean?> { null }
internal val LocalAWCStepperSettled = staticCompositionLocalOf { false }

/** Applies md-stepper / md-step hook values to descendant steppers (inherited; nearer values win). */
@Composable fun AWCStepperAppearanceScope(appearance: AWCStepperAppearance, content: @Composable () -> Unit) {
    val inherited = LocalAWCStepperAppearance.current
    CompositionLocalProvider(LocalAWCStepperAppearance provides inherited.merging(appearance), content = content)
}
/** Binds next(), prev(), goTo() and reset() of the stepper below. */
@Composable fun AWCStepperControllerScope(controller: AWCStepperController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCStepperController provides controller, content = content)
/** Overrides the system reduced-motion setting for steppers below (tests and previews); null follows the system. */
@Composable fun AWCStepperReducedMotionScope(reduced: Boolean?, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCStepperReducedMotion provides reduced, content = content)
/** Renders steppers below settled — every transition and keyframe animation at its end (snapshots, still previews). */
@Composable fun AWCStepperSettledScope(settled: Boolean = true, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCStepperSettled provides settled, content = content)

// MARK: - Runtime

/** One md-step of a stepper: its published properties and event sink, and what the stepper measured of it. */
internal class StepChild {
    var props by mutableStateOf<Props>(emptyMap())
    var emit: EventSink = { _, _ -> }
    var index by mutableIntStateOf(-1)
    /** Light-DOM content children (written by the content layout when it measures). */
    var contentCount = 0
    var lastHasContent = false
    val focus = FocusRequester()
    val ripple = AWCRippleController()
}
private class StepHeaderId(val c: StepChild)
private class StepContentId(val c: StepChild)
private class StepActionsId(val c: StepChild)
private class StepCaptionId(val c: StepChild)
private object StepperSlotId
private object StepperNavBackId
private object StepperNavNextId
private object StepperLiveId

internal class StepperRuntime {
    val model = StepperModel()
    val motion = StepperMotion()
    var pointer by mutableStateOf(StepperPointer())
    var version by mutableIntStateOf(0)
    var frame by mutableLongStateOf(0L)
    var ticking by mutableStateOf(false)
    var paintGen by mutableIntStateOf(0)
    /** Header to focus once the views have recomposed (-1: none). */
    var focusTarget by mutableIntStateOf(-1)
    /** Last layout (written by the measure pass, read by the chrome and the header controls). */
    var paint = StepperPaint()
    var order: List<StepChild> = emptyList()
    var slotCount = 0
    var syncing = false
    var pointerFocus = false
    var signature = ""
    fun perform(block: () -> Unit) { block(); version++ }
    fun now() = SystemClock.uptimeMillis().toDouble()
}

internal class StepperContext(val rt: StepperRuntime, val vertical: Boolean, val readonly: Boolean)
internal val LocalStepperContext = staticCompositionLocalOf<StepperContext?> { null }

private class StepperFonts(val regular: Typeface, val medium: Typeface, val bold: Typeface, val symbols: Typeface) {
    val measure = StepperPaintMeasure(regular, medium, bold)
}
@Composable private fun rememberStepperFonts(): StepperFonts {
    val r = LocalContext.current.resources
    return remember(r) { StepperFonts(r.getFont(R.font.awc_roboto_regular), r.getFont(R.font.awc_roboto_medium), r.getFont(R.font.awc_roboto_bold), r.getFont(R.font.awc_material_symbols)) }
}

private fun stepPropsOf(q: Props, hasContent: Boolean, standalone: Boolean = false) = StepProps(
    label = q.str("label"), description = q.str("description"), errorText = q.str("errorText"), icon = q.str("icon"),
    completedIcon = q.str("completedIcon").ifEmpty { "check" }, errorIcon = q.str("errorIcon").ifEmpty { "priority_high" },
    accessibleName = q["accessibleName"] as? String, completed = q.bool("completed"), error = q.bool("error"), disabled = q.bool("disabled"),
    optional = q.bool("optional"), editable = q.bool("editable"), hideActions = q.bool("hideActions"), density = q.num("density").toDouble(), hasContent = hasContent,
    active = if (standalone) q.bool("active") else null, style = q.str("style"))

private fun stepperPropsOf(p: Props, standalone: Boolean): StepperProps {
    fun s(k: String, d: String) = p.str(k).ifEmpty { d }
    return StepperProps(orientation = s("orientation", "horizontal"), indicator = s("indicator", "numbered"), variant = s("variant", "default"),
        mode = s("mode", "linear"), active = (p["active"] as? Number)?.toDouble() ?: p.str("active").toDoubleOrNull() ?: 0.0,
        autoComplete = p.bool("autoComplete", true), nav = standalone || p.bool("nav", true), readonly = p.bool("readonly"),
        nextDisabled = p.bool("nextDisabled"), loading = p.bool("loading"), lazy = p.bool("lazy"), label = s("label", "Progress"),
        stepWord = s("stepWord", "Step"), ofWord = s("ofWord", "of"), completedWord = s("completedWord", "completed"), currentWord = s("currentWord", "current"),
        errorWord = s("errorWord", "error"), optionalWord = s("optionalWord", "Optional"), nextLabel = s("nextLabel", "Continue"), backLabel = s("backLabel", "Back"),
        finishLabel = s("finishLabel", "Finish"), density = p.num("density").toDouble())
}

/** The hooks: the typed appearance, then the host's inline `style` custom properties. */
private fun stepperHooks(appearance: AWCStepperAppearance, style: String): StepperHooks {
    val v = HashMap(appearance.css)
    for (part in style.split(';')) {
        val kv = part.split(':', limit = 2).map { it.trim() }
        if (kv.size == 2 && kv[0].startsWith("--md-step")) v[kv[0]] = kv[1]
    }
    return StepperHooks(v)
}

// MARK: - Views

/** md-stepper: its md-step children are the steps, its `content`-slot children the shared panel. */
@Composable internal fun NativeStepper(p: Props, onEvent: EventSink, content: Slot?) = StepperHost(p, onEvent, content, null)

/** A standalone md-step renders like the source with no stepper around it (data-* defaults: first, horizontal, shared). */
@Composable internal fun NativeStepStandalone(p: Props, onEvent: EventSink, @Suppress("UNUSED_PARAMETER") content: Slot?) = StepperHost(emptyMap(), onEvent, null, p)

@Composable
private fun StepperHost(p: Props, onEvent: EventSink, content: Slot?, standaloneStep: Props?) {
    val rt = remember { StepperRuntime() }
    val m = rt.model
    val standalone = standaloneStep != null
    val solo = remember { StepChild() }
    if (standaloneStep != null) SideEffect { solo.props = standaloneStep; solo.emit = onEvent }
    @Suppress("UNUSED_VARIABLE") val version = rt.version
    val fonts = rememberStepperFonts()
    val tokens = LocalAWCThemeTokens.current
    val appearance = LocalAWCStepperAppearance.current
    val hooks = remember(appearance, p.str("style")) { stepperHooks(appearance, p.str("style")) }
    val globalDensity = LocalAWCNativeDensity.current
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val viewport = LocalConfiguration.current.screenWidthDp.toDouble()
    val reduced = LocalAWCStepperReducedMotion.current ?: rememberAWCAccessibilityAppearance().first
    val settled = LocalAWCStepperSettled.current
    val stepParts = LocalAWCStepParts.current; val stepperParts = LocalAWCStepperParts.current
    val hostProps = stepperPropsOf(p, standalone)
    val action = LocalAWCAction.current
    val target = LocalAWCActionTarget.current
    val emitNow by rememberUpdatedState(onEvent)
    val handler = remember { Handler(Looper.getMainLooper()) }

    fun dispatch(name: String, detail: Map<String, Any>?, cancelable: Boolean): Boolean {
        val isStep = name == "mdStepClick" || name == "mdStepNext" || name == "mdStepBack"
        if (isStep) { val i = detail?.get("index") as? Int ?: 0; (if (standalone) solo else rt.order.getOrNull(i))?.emit?.invoke(name, detail); return true }
        val ev = AWCActionEvent(name, "md-stepper", detail ?: emptyMap(), cancelable = cancelable, rawDetail = detail)
        dispatchNativeAction(ev, action, target?.listeners?.invoke().orEmpty())
        emitNow(name, detail)
        return !ev.defaultPrevented
    }
    // A watcher run during a host sync (a host write to `active`) reports after the update, never during layout.
    m.emit = { name, detail, cancelable -> if (rt.syncing) { handler.post { dispatch(name, detail, false) }; true } else dispatch(name, detail, cancelable) }
    m.labelTotal = if (standalone) 0 else null
    m.standalone = standalone

    val controller = LocalAWCStepperController.current
    DisposableEffect(controller, rt) {
        controller?.actions = { a, index -> rt.perform { when (a) { "next" -> m.next(); "prev" -> m.prev(); "goTo" -> m.goTo(index ?: 0); else -> m.reset() } } }
        onDispose { controller?.actions = null }
    }
    LaunchedEffect(rt.ticking) {
        if (!rt.ticking) return@LaunchedEffect
        while (true) {
            withFrameMillis { rt.frame = it }
            if (!rt.motion.active(rt.now())) { rt.ticking = false; break }
        }
    }

    fun moveFocus(block: () -> Unit) {
        val before = m.focus
        rt.perform(block)
        val f = m.focus
        if (f != before && f is StepperModel.Focus.Header) rt.focusTarget = f.i
    }
    val ctx = StepperContext(rt, hostProps.orientation == "vertical", hostProps.readonly)
    val showNav = !standalone && hostProps.nav && m.count > 0 && (hostProps.variant == "mobile" || hostProps.orientation == "horizontal")
    val label = if (standalone) "" else hostProps.label

    CompositionLocalProvider(LocalStepperContext provides ctx) {
        Layout(content = {
            // (Semantics blocks capture the values they expose: Compose memoizes a lambda whose captures are unchanged instances.)
            val politeText = m.live; val alertText = m.errorLive
            Box(Modifier.layoutId(StepperLiveId).semantics { liveRegion = LiveRegionMode.Polite; if (politeText.isNotEmpty()) contentDescription = politeText })
            Box(Modifier.layoutId(StepperLiveId).semantics { liveRegion = LiveRegionMode.Assertive; if (alertText.isNotEmpty()) contentDescription = alertText })
            if (standalone) StepHeader(solo, ctx, standalone = true) else content?.invoke("")
            if (!standalone) Layout(content = { content?.invoke("content") }, modifier = Modifier.layoutId(StepperSlotId)) { ms, c ->
                rt.slotCount = ms.size
                val pls = ms.map { it.measure(c.copy(minWidth = 0, minHeight = 0)) }
                var y = 0
                layout(c.maxWidth.takeIf { c.hasBoundedWidth } ?: (pls.maxOfOrNull { it.width } ?: 0), pls.sumOf { it.height }) { pls.forEach { it.placeRelative(0, y); y += it.height } }   // inline start
            }
            if (showNav) {
                StepperButton(StepperNavBackId, m.p.backLabel, filled = false, enabled = m.backEnabled, loading = false, density = rt.paint.buttonDensity) { moveFocus { m.footerBack() } }
                StepperButton(StepperNavNextId, if (m.isFinishStep) m.p.finishLabel else m.p.nextLabel, filled = true, enabled = m.continueEnabled,
                    loading = m.p.loading, density = rt.paint.buttonDensity) { rt.perform { m.next(); m.focus = StepperModel.Focus.Nav(1) } }
            }
        }, modifier = Modifier
            .inspectAWCNode(LocalAWCInspection.current, "", if (standalone) "md-step" else "md-stepper", AWCInspectionMetrics(display = "Compose Layout", direction = if (rtl) "rtl" else "ltr"))
            .semantics { isTraversalGroup = true; if (label.isNotEmpty()) contentDescription = label }
            .drawBehind { rt.frame; rt.version; rt.paintGen; drawStepperChrome(rt.paint, m, fonts) }
        ) { measurables, constraints ->
            val d = density.toDouble()
            fun px(v: Double) = (v * d).roundToInt().coerceAtLeast(0)
            val W = if (constraints.hasBoundedWidth) constraints.maxWidth / d else 480.0
            @Suppress("UNUSED_VARIABLE") val tick = rt.frame
            @Suppress("UNUSED_VARIABLE") val ver = rt.version   // a model change (perform) remeasures
            val pointer = rt.pointer
            val headers = measurables.filter { it.layoutId is StepHeaderId }
            val holders = headers.map { (it.layoutId as StepHeaderId).c }
            holders.forEachIndexed { i, h -> if (h.index != i) h.index = i }
            if (!standalone) rt.order = holders
            fun sync() {
                val before = rt.signature
                rt.syncing = true
                m.sync(hostProps, holders.map { stepPropsOf(it.props, !standalone && it.contentCount > 0, standalone).also { _ -> it.lastHasContent = it.contentCount > 0 } })
                rt.syncing = false
                rt.signature = "${m.p}|${m.active}|${m.live}|${m.errorLive}|${m.steps}"   // every synced property (data classes)
                if (rt.signature != before) rt.version++     // the composition reads the model (labels, nav state)
            }
            sync()
            val base = StepperLayoutInput(width = W, rtl = rtl, globalDensity = globalDensity, viewportWidth = viewport, tokens = tokens, hooks = hooks, defaultContentHeight = 0.0,
                stepParts = stepParts, stepperParts = stepperParts)
            // Panel contents at their widths (known before their heights); then the slot and the nav buttons.
            val contentPl = HashMap<StepChild, Placeable>(); val heights = HashMap<Int, Double>()
            for (mm in measurables) {
                val h = (mm.layoutId as? StepContentId)?.c ?: continue
                val i = holders.indexOf(h); if (i < 0) continue
                val pl = mm.measure(Constraints(maxWidth = px(StepperLayout.contentWidth(m, base, i))))
                contentPl[h] = pl; heights[i] = pl.height / d
            }
            if (holders.any { (it.contentCount > 0) != it.lastHasContent }) sync()
            val slotPad = stepperParts[AWCStepperPart.Content]?.padding?.let { it.left + it.right } ?: 0.0     // ::part(content) padding
            val slotPl = measurables.firstOrNull { it.layoutId === StepperSlotId }?.measure(Constraints(maxWidth = px(maxOf(0.0, W - slotPad))))
            val backPl = measurables.firstOrNull { it.layoutId === StepperNavBackId }?.measure(Constraints())
            val nextPl = measurables.firstOrNull { it.layoutId === StepperNavNextId }?.measure(Constraints())
            val now = rt.now()
            val paint = StepperParts.applied(StepperLayout.layout(m, base.copy(slotHeight = if (slotPl != null && rt.slotCount > 0) slotPl.height / d else null, contentHeights = heights,
                buttonWidths = if (backPl != null && nextPl != null) (backPl.width / d) to (nextPl.width / d) else null), fonts.measure, if (settled) null else rt.motion, now, reduced, pointer), stepParts, stepperParts)
            rt.paint = paint; Snapshot.withoutReadObservation { rt.paintGen++ }   // the chrome draws this pass's layout (unobserved: no remeasure loop)
            if (rt.motion.active(now) && !rt.ticking) rt.ticking = true
            val headerPl = headers.mapIndexed { i, mm -> val r = paint.steps.getOrNull(i)?.inner ?: SRect.ZERO; mm.measure(Constraints.fixed(px(r.width), px(r.height))) }
            val actionPl = HashMap<StepChild, Placeable>()
            for (mm in measurables) {
                val h = (mm.layoutId as? StepActionsId)?.c ?: continue
                val r = paint.steps.getOrNull(holders.indexOf(h))?.actions
                actionPl[h] = mm.measure(if (r != null) Constraints(maxWidth = px(r.width)) else Constraints.fixed(0, 0))
            }
            val livePl = measurables.filter { it.layoutId === StepperLiveId }.map { it.measure(Constraints.fixed(1, 1)) }
            val captionPl = HashMap<StepChild, Pair<Placeable, SRect>>()
            for (mm in measurables) {
                val h = (mm.layoutId as? StepCaptionId)?.c ?: continue
                val r = paint.steps.getOrNull(holders.indexOf(h))?.lines?.firstOrNull { it.part == "description" }?.rect ?: SRect.ZERO
                captionPl[h] = mm.measure(Constraints.fixed(px(r.width), px(r.height))) to r
            }
            layout(px(W), px(paint.host.y + paint.host.height)) {
                livePl.forEach { it.place(0, 0) }
                holders.forEachIndexed { i, h ->
                    val sp = paint.steps.getOrNull(i) ?: return@forEachIndexed
                    headerPl[i].place(px(sp.inner.x), px(sp.inner.y))
                    captionPl[h]?.let { (pl, r) -> pl.place(px(r.x), px(r.y)) }
                    val pn = sp.panel
                    if (pn != null && pn.visible) {
                        // The panel clips its content (the sizer is overflow: hidden while the grid row animates) and fades.
                        fun clipped(pl: Placeable, x: Double, y: Double) {
                            val ins = sp.panelInset      // ::part(content) padding: the sizer clips at the content box
                            val outline = StepperClip(((pn.rect.x + ins.left - x) * d).toFloat(), ((pn.rect.y + ins.top - y) * d).toFloat(),
                                ((pn.rect.x + pn.rect.width - ins.right - x) * d).toFloat(), ((pn.rect.y + pn.rect.height - ins.bottom - y) * d).toFloat())
                            // The panel's opacity, md-step-content-enter (a lazy panel's mount: fade + slide) and md-step-enter.
                            pl.placeWithLayer(px(x), px(y)) { clip = true; shape = outline; alpha = (pn.opacity * sp.contentOpacity * sp.hostOpacity).toFloat().coerceIn(0f, 1f); translationY = (sp.contentDY * d).toFloat() }
                        }
                        contentPl[h]?.let { clipped(it, pn.contentX, pn.contentY) }
                        val a = sp.actions
                        if (a != null) actionPl[h]?.let { clipped(it, a.x, a.y) }
                    }
                }
                (paint.slot ?: paint.content).let { r -> slotPl?.place(px(r.x), px(r.y)) }
                paint.navButtons?.let { (b, n) -> backPl?.place(px(b.x), px(b.y)); nextPl?.place(px(n.x), px(n.y)) }
            }
        }
    }
}

/** The panel clip: a rectangle in the content's own coordinates (it may start above the content: the top padding). */
private class StepperClip(val l: Float, val t: Float, val r: Float, val b: Float) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density) = Outline.Rectangle(Rect(l, t, r, b))
    override fun equals(other: Any?) = other is StepperClip && other.l == l && other.t == t && other.r == r && other.b == b
    override fun hashCode() = listOf(l, t, r, b).hashCode()
}

/** md-step inside a stepper: its header control, its panel content and (vertical) its Back / Continue row. */
@Composable
internal fun NativeStepParts(p: Props, onEvent: EventSink, content: Slot?, child: StepChild) {
    val ctx = LocalStepperContext.current ?: return
    SideEffect { child.props = p; child.emit = onEvent }
    StepHeader(child, ctx, standalone = false)
    StepCaption(child, ctx)
    Layout(content = { content?.invoke("") }, modifier = Modifier.layoutId(StepContentId(child))) { ms, c ->
        child.contentCount = ms.size
        val pls = ms.map { it.measure(c.copy(minWidth = 0, minHeight = 0)) }
        var y = 0
        layout(if (c.hasBoundedWidth) c.maxWidth else pls.maxOfOrNull { it.width } ?: 0, pls.sumOf { it.height }) { pls.forEach { it.placeRelative(0, y); y += it.height } }   // inline start (RTL: right)
    }
    val rt = ctx.rt; val m = rt.model
    @Suppress("UNUSED_VARIABLE") val v = rt.version
    val i = child.index
    if (ctx.vertical && i in 0 until m.count && m.renderPanel(i) && m.navActions(i)) {
        val s = stepperDensity(m.steps[i].density, stepperDensity(m.p.density, LocalAWCNativeDensity.current))
        val handler = remember { Handler(Looper.getMainLooper()) }
        fun moveFocus(block: () -> Unit) {
            val before = m.focus
            rt.perform(block)
            val f = m.focus
            if (f != before && f is StepperModel.Focus.Header) rt.focusTarget = f.i
        }
        val gap = LocalAWCStepParts.current[AWCStepPart.Actions]?.gap ?: StepperTheme(LocalAWCThemeTokens.current).spacing("gap-sm", s, 8.0)
        Layout(content = {
            StepperButton(null, m.p.backLabel, filled = false, enabled = i != 0 && !m.p.loading, loading = false, density = s) { moveFocus { m.stepBack(i) } }
            StepperButton(null, if (m.isLast(i)) m.p.finishLabel else m.p.nextLabel, filled = true, enabled = m.continueEnabled, loading = m.p.loading, density = s) { moveFocus { m.stepNext(i) } }
        }, modifier = Modifier.layoutId(StepActionsId(child))) { ms, c ->
            val pls = ms.map { it.measure(Constraints()) }
            val g = (gap * density).roundToInt()
            layout(if (c.hasBoundedWidth) c.maxWidth else pls.sumOf { it.width } + g, pls.maxOfOrNull { it.height } ?: 0) {
                var x = 0; pls.forEach { it.placeRelative(x, 0); x += it.width + g }   // from the inline start (RTL: Back rightmost)
            }
        }
    }
}

/**
 * The header control at the inner box: pointer (hover / press / click), the md-ripple on the indicator, keyboard focus
 * (Enter / Space activation with a centred wave; the focus ring only for keyboard focus), and the step's semantics — a
 * button named by the composed label, disabled when unreachable, expanded / collapsed when it owns a panel. Readonly: text.
 */
@Composable
private fun StepHeader(child: StepChild, ctx: StepperContext, standalone: Boolean) {
    val rt = ctx.rt; val m = rt.model
    @Suppress("UNUSED_VARIABLE") val v = rt.version
    val i = if (standalone) 0 else child.index
    val valid = i in 0 until m.count
    val readonly = m.p.readonly
    val live = valid && !readonly && !m.effectivelyDisabled(i)
    val sp = rt.paint.steps.getOrNull(i)
    // The values the semantics expose, captured (Compose memoizes a lambda whose captures are unchanged instances).
    val roText = if (valid) (listOf(m.steps[i].label) + m.textLines(i)).filter { it.isNotEmpty() }.joinToString("\n") else ""
    val name = if (valid && !readonly) m.a11yLabel(i) else ""
    val hasPanel = valid && m.hasPanel(i); val active = valid && m.isActive(i)
    // Focus requested by a navigation (Back / Continue, Enter on a header) lands once this header is focusable.
    val focusTarget = rt.focusTarget
    LaunchedEffect(focusTarget, live) { if (focusTarget == i && live && !standalone) { runCatching { child.focus.requestFocus() }; rt.focusTarget = -1 } }
    val mod = if (!valid || readonly) Modifier.clearAndSetSemantics {
        if (valid) text = AnnotatedString(roText)
    } else Modifier
        .focusRequester(child.focus)
        .onFocusChanged { f ->
            rt.perform {
                if (f.isFocused) { m.focus = StepperModel.Focus.Header(i); m.focusVisible = if (rt.pointerFocus) null else i; rt.pointerFocus = false }
                else if (m.focus == StepperModel.Focus.Header(i)) { m.focus = null; if (m.focusVisible == i) m.focusVisible = null }
            }
        }
        .onPreviewKeyEvent { e ->
            if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
            if (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.Spacebar) {
                if (live) child.ripple.trigger()         // md-step: keyboard activation runs a centred wave
                rt.perform { m.focusVisible = i; m.activateHeader(i) }; true
            } else { if (m.focusVisible != i) rt.perform { m.focusVisible = i }; false }
        }
        .focusable(live)
        .clearAndSetSemantics {
            role = Role.Button
            contentDescription = name
            if (!live) disabled()
            onClick { rt.perform { m.activateHeader(i) }; true }
            if (hasPanel) {
                stateDescription = if (active) "Expanded" else "Collapsed"      // kept when disabled (Compose drops its actions)
                if (active) collapse { false } else expand { rt.perform { m.activateHeader(i) }; true }
            }
        }
    Box(Modifier.layoutId(StepHeaderId(child)).then(mod).pointerInput(i, live, readonly) {
        awaitPointerEventScope {
            while (true) {
                val ev = awaitPointerEvent()
                val ch = ev.changes.firstOrNull() ?: continue
                when (ev.type) {
                    PointerEventType.Enter, PointerEventType.Move -> if (ch.type != PointerType.Touch && !ch.pressed && rt.pointer.hover != i) rt.perform { rt.pointer = rt.pointer.copy(hover = i) }
                    PointerEventType.Exit -> if (rt.pointer.hover == i) rt.perform { rt.pointer = rt.pointer.copy(hover = null) }
                    PointerEventType.Press -> if (!readonly && rt.pointer.pressed != i) {
                        rt.perform { rt.pointer = rt.pointer.copy(pressed = i); m.focusVisible = null }
                        if (live) { rt.pointerFocus = true; runCatching { child.focus.requestFocus() } }   // mousedown focuses without the ring
                    }
                    PointerEventType.Release -> if (rt.pointer.pressed == i) {
                        val inside = ch.position.x >= 0 && ch.position.y >= 0 && ch.position.x <= size.width && ch.position.y <= size.height
                        rt.perform { rt.pointer = rt.pointer.copy(pressed = null, hover = if (ch.type == PointerType.Touch) null else rt.pointer.hover); if (inside) m.activateHeader(i) }
                    }
                    else -> {}
                }
            }
        }
    }) {
        if (!readonly && sp != null && !sp.indicator.isEmpty) {
            Box(Modifier.offset((sp.indicator.x - sp.inner.x).dp, (sp.indicator.y - sp.inner.y).dp).size(sp.indicator.width.dp, sp.indicator.height.dp)
                .awcRipple(disabled = !live, cornerRadius = (sp.indicator.width / 2).dp, contentColor = stepperColorOf(sp.stateColor), controller = child.ripple))
        }
    }
}

/** The description under a header as text (Web: a text run inside the header, not part of its composed name); drawn by the
 *  chrome, so this node only carries the semantics, at the painted line. */
@Composable
private fun StepCaption(child: StepChild, ctx: StepperContext) {
    val m = ctx.rt.model
    @Suppress("UNUSED_VARIABLE") val v = ctx.rt.version
    val i = child.index
    val s = m.steps.getOrNull(i)
    val line = ctx.rt.paint.steps.getOrNull(i)?.lines?.firstOrNull { it.part == "description" }
    val text = if (s != null && line != null && !m.p.readonly && !(s.error && s.errorText.isNotEmpty())) line.text else ""   // readonly: in the header text
    Box(Modifier.layoutId(StepCaptionId(child)).then(if (text.isEmpty()) Modifier else Modifier.clearAndSetSemantics { this.text = AnnotatedString(text) }))
}

/** A built-in md-button (size sm). Its own events stay internal: the source stops their composed mdClick. */
@Composable
private fun StepperButton(id: Any?, label: String, filled: Boolean, enabled: Boolean, loading: Boolean, density: Double, onClick: () -> Unit) {
    val click by rememberUpdatedState(onClick)
    val isolated = remember { AWCActionDispatcher(null) { } }
    Box(if (id != null) Modifier.layoutId(id) else Modifier) {
        CompositionLocalProvider(LocalAWCAction provides isolated, LocalAWCActionTarget provides null) {
            AWCComponent("md-button", mapOf("label" to label, "variant" to if (filled) "filled" else "text", "size" to "sm", "disabled" to !enabled,
                "loading" to loading, "density" to density), onEvent = { name, _ -> if (name == "mdClick" && enabled) click() })
        }
    }
}

// MARK: - Chrome

internal fun stepperColorOf(c: SRGBA) = Color(c.r.toFloat().coerceIn(0f, 1f), c.g.toFloat().coerceIn(0f, 1f), c.b.toFloat().coerceIn(0f, 1f), c.a.toFloat().coerceIn(0f, 1f))

private fun stepperRTL(p: StepperPaint): Boolean {
    // The first step's connector sits right of its bubble in LTR, left of it in RTL.
    val s = p.steps.firstOrNull() ?: return false
    val c = s.connector ?: return false
    return !c.vertical && c.rect.x < s.indicator.x
}

/** Half-leading: CSS centres the glyphs (Roboto ascent 1900 + descent 500 per 2048) in the line box. */
private fun halfLeading(size: Double, lineHeight: Double) = (lineHeight - size * 2400 / 2048) / 2

/** The chrome drawn from the last layout: connectors with their fill, focus rings, state layers, halos, bubbles / dots
 *  (number or glyph), labels and captions, the mobile progress (dots or caption). */
private fun DrawScope.drawStepperChrome(p: StepperPaint, m: StepperModel, fonts: StepperFonts) {
    val d = density.toDouble()
    fun r(rc: SRect) = Rect((rc.x * d).toFloat(), (rc.y * d).toFloat(), ((rc.x + rc.width) * d).toFloat(), ((rc.y + rc.height) * d).toFloat())
    val text = APaint(APaint.ANTI_ALIAS_FLAG).apply { isSubpixelText = true; isLinearText = true }
    fun layer(alpha: Double, block: () -> Unit) {
        if (alpha >= 1) { block(); return }
        drawIntoCanvas { c -> c.nativeCanvas.saveLayerAlpha(0f, 0f, size.width, size.height, (alpha * 255).roundToInt().coerceIn(0, 255)) }
        block()
        drawIntoCanvas { c -> c.nativeCanvas.restore() }
    }
    fun drawTextLine(t: String, x: Double, top: Double, fs: Double, lh: Double, weight: Double, italic: Boolean, color: SRGBA, ls: Double = 0.0) {
        text.typeface = fonts.measure.face(weight); text.textSize = (fs * d).toFloat(); text.color = stepperColorOf(color).toArgb()
        text.letterSpacing = if (fs > 0) (ls / fs).toFloat() else 0f      // CSS letter-spacing (px) as Paint's em units
        text.textSkewX = if (italic) -0.25f else 0f; text.setFontVariationSettings(null)
        val baseline = top + halfLeading(fs, lh) + fs * 1900 / 2048
        drawIntoCanvas { it.nativeCanvas.drawText(t, (x * d).toFloat(), (baseline * d).toFloat(), text) }
    }
    val horizontal = m.p.orientation == "horizontal"
    // ::part(list / content / nav / mobile-nav) and md-step ::part(content) backgrounds, under everything else.
    fun bg(rc: SRect?, c: SRGBA?) { if (rc != null && c != null && !rc.isEmpty) { val rr = r(rc); drawRect(stepperColorOf(c), rr.topLeft, rr.size) } }
    // A wrapper part's box (story 5-3): the background under the border, both following the radius (outer radius at the border edge).
    fun box(b: StepBox?, rc: SRect) {
        if (b == null || rc.isEmpty) return
        val rr = r(rc); val rad = min((b.radius * d).toFloat(), min(rr.width, rr.height) / 2)
        b.background?.let { drawRoundRect(stepperColorOf(it), rr.topLeft, rr.size, CornerRadius(rad)) }
        val w = (b.borderWidth * d).toFloat()
        if (w > 0f) drawRoundRect(stepperColorOf(b.borderColor ?: SRGBA(0.11, 0.106, 0.122, 1.0)), Offset(rr.left + w / 2, rr.top + w / 2), Size(rr.width - w, rr.height - w),
            CornerRadius(max(0f, rad - w / 2)), style = androidx.compose.ui.graphics.drawscope.Stroke(w))
    }
    bg(p.list, p.listBackground); bg(p.content, p.contentBackground); bg(p.nav, p.navBackground); bg(p.mobileNav, p.mobileNavBackground)
    p.mobileProgress?.let { box(p.mobileProgressBox, it) }
    for (s in p.steps) { val pn = s.panel; val c = s.panelBackground; if (pn != null && pn.visible && c != null) bg(pn.rect, c.copy(a = c.a * pn.opacity * s.hostOpacity)) }
    for (s in p.steps) {
        if (s.inner.isEmpty) continue
        val c = s.connector ?: continue
        if (c.rect.isEmpty) continue
        val rr = r(c.rect)
        val path = Path().apply { addRoundRect(RoundRect(rr, CornerRadius(min(rr.width, rr.height) / 2))) }
        layer(s.hostOpacity) {                                  // md-step-enter fades the whole step
            drawPath(path, stepperColorOf(c.color))
            if (c.fill > 0) clipPath(path) {
                val f = c.fill.toFloat()
                val fr = if (c.vertical) Rect(rr.left, rr.top, rr.right, rr.top + rr.height * f)
                         else if (horizontal && stepperRTL(p)) Rect(rr.right - rr.width * f, rr.top, rr.right, rr.bottom) else Rect(rr.left, rr.top, rr.left + rr.width * f, rr.bottom)
                drawRect(stepperColorOf(c.fillColor), fr.topLeft, fr.size)
            }
        }
    }
    for (s in p.steps) {
        if (s.inner.isEmpty) continue
        val ind = r(s.indicator)
        layer(s.hostOpacity) {
        box(s.innerBox, s.inner)
        s.focusRing?.let { (inner, outer) ->
            // The ring is the indicator's box-shadow: it follows the indicator's border-radius (50% unless a part sets one).
            val ibr = s.indicatorBox?.radius ?: 0.0
            fun ring(c: SRGBA, grow: Float) {
                if (ibr <= 0.0) drawCircle(stepperColorOf(c), ind.width / 2 + grow, ind.center)
                else drawRoundRect(stepperColorOf(c), Offset(ind.left - grow, ind.top - grow), Size(ind.width + 2 * grow, ind.height + 2 * grow), CornerRadius(min((ibr * d).toFloat() + grow, ind.width / 2 + grow)))
            }
            ring(outer, (5 * d).toFloat()); ring(inner, (2 * d).toFloat())
        }
        layer(s.indicatorOpacity) {
            box(s.indicatorBox, s.indicator)      // the indicator's own box fades with it (opacity .38 when disabled)
            if (s.stateLayerVisible && s.stateOpacity > 0) { val sl = r(s.stateLayer); drawOval(stepperColorOf(s.stateColor.copy(a = s.stateColor.a * s.stateOpacity)), sl.topLeft, sl.size) }
            val b = r(s.bubble)
            // ::part(bubble / dot) border-radius (scaled with the bubble; the halo's box-shadow follows it, spread added).
            val br = s.bubbleRadius
            fun shape(c: SRGBA, grow: Float) {
                if (br == null) { drawCircle(stepperColorOf(c), b.width / 2 + grow, b.center); return }
                val rad = min((br * s.scale * d).toFloat() + grow, b.width / 2 + grow)
                drawRoundRect(stepperColorOf(c), Offset(b.left - grow, b.top - grow), Size(b.width + 2 * grow, b.height + 2 * grow), CornerRadius(rad))
            }
            s.halo?.let { (hc, spread) -> if (spread > 0) shape(hc, (spread * s.scale * d).toFloat()) }
            shape(s.bubbleColor, 0f)
            val fg = s.bubbleText
            if (fg != null) {
                val n = s.number; val g = s.glyph
                if (n != null) {
                    val fs = s.bubbleFontSize * s.scale
                    text.typeface = fonts.medium; text.textSize = (fs * d).toFloat(); text.color = stepperColorOf(fg).toArgb(); text.textSkewX = 0f; text.setFontVariationSettings(null); text.letterSpacing = 0f
                    val w = text.measureText(n)
                    drawIntoCanvas { it.nativeCanvas.drawText(n, b.center.x - w / 2, b.center.y + (fs * 1400 / 4096 * d).toFloat(), text) }
                } else if (g != null && s.glyphScale * s.glyphSize * s.scale > 0.05) {
                    // md-step-glyph-in: the span scales about the bubble centre and fades in.
                    text.typeface = fonts.symbols; text.textSize = (s.glyphSize * s.scale * s.glyphScale * d).toFloat(); text.letterSpacing = 0f
                    text.color = stepperColorOf(fg.copy(a = fg.a * s.glyphOpacity)).toArgb(); text.textSkewX = 0f
                    text.setFontVariationSettings(if (s.glyphFilled) "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24" else "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24")
                    val bounds = android.graphics.Rect(); text.getTextBounds(g, 0, g.length, bounds)
                    val w = text.measureText(g)
                    drawIntoCanvas { it.nativeCanvas.drawText(g, b.center.x - w / 2, b.center.y - bounds.exactCenterY(), text) }
                }
            }
        }
        val tr = s.text
        if (tr != null) layer(s.textOpacity) {
            box(s.textBox, tr)
            val rtlText = tr.x + tr.width <= s.indicator.x + 0.5      // a vertical step's text column ends before its indicator in RTL
            for (line in s.lines) {
                val weight = if (line.weight > 500) 700.0 else line.weight
                for ((k, t) in (line.wrapped.ifEmpty { listOf(line.text) }).withIndex()) {
                    // Each line centred in a horizontal step's text column, start-aligned in a vertical one
                    // (text-align: start — each line ends at the column's right edge in RTL).
                    val w = fonts.measure.width(t, line.fontSize, weight, line.letterSpacing)
                    val x = if (horizontal) line.rect.x + (line.rect.width - w) / 2 else if (rtlText) line.rect.x + line.rect.width - w else line.rect.x
                    drawTextLine(t, x, line.rect.y + k * line.lineHeight, line.fontSize, line.lineHeight, weight, line.italic, line.color, line.letterSpacing)
                }
            }
        }
        }
    }
    for ((rect, color, scale) in p.mobileDots) {
        val rr = r(rect)
        drawCircle(stepperColorOf(color), rr.width / 2 * scale.toFloat(), rr.center)
    }
    p.mobileText?.let { (rect, t, color) -> drawTextLine(t, rect.x, rect.y, 14.0, 20.0, 500.0, false, color) }
}
