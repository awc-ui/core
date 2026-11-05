package dev.awc.nativeui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusTarget
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.max

// md-organization-chart Compose renderer: the source's centred connector tree (vertical/horizontal, RTL) in its scrolling
// viewport, avatar cards, hung togglers (md-icon-button in md-tooltip), the selection trail, density, the fifteen hooks,
// state layers, hover elevation, md-ripple, focus ring, the 300 ms emphasized transitions (explicit tracks on the frame
// clock), the unfold motion, the roving tree-item focus and the WAI-ARIA tree keyboard model. Geometry: OrgChartModel.

internal val LocalAWCOrgChartAppearance = staticCompositionLocalOf { AWCOrgChartAppearance() }
/** md-organization-chart hooks for this subtree; nested scopes merge field by field (inner wins). */
@Composable fun AWCOrgChartAppearanceScope(appearance: AWCOrgChartAppearance, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCOrgChartAppearance provides LocalAWCOrgChartAppearance.current.merging(appearance.validated()), content = content)
internal val LocalAWCOrgChartReducedMotion = staticCompositionLocalOf<Boolean?> { null }
/** Overrides the system reduced-motion setting for charts in this subtree (parity tests, the Laboratory's motion toggle). */
@Composable fun AWCOrgChartReducedMotionScope(reduced: Boolean?, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCOrgChartReducedMotion provides reduced, content = content)

/** A frame of the chart's state as the parity tests read it (host coordinates, CSS px). */
data class OrgChartSnapshot(val active: String?, val nodes: List<Node>, val groups: List<Group>, val hostHeight: Double, val frame: Double) {
    data class Node(val id: String, val tab: Int, val expanded: Boolean?, val selected: Boolean?, val onPath: Boolean, val border: List<Double>, val borderWidth: Double,
                    val shadow: List<Double>, val focusRing: Boolean, val layer: Double, val layerColor: List<Double>, val z: Int, val card: OrgRect, val toggle: OrgRect?)
    /** A group's own enter keyframe: opacity and `translate(tx, ty) scale(s)`. */
    data class Group(val id: String, val opacity: Double, val scale: Double, val tx: Double, val ty: Double, val rect: OrgRect)
}
/** The chart's live state for parity tests, read at the current frame ([at]: at a frame-clock time); [focus] gives a tree
 *  item keyboard focus (its ring). */
class OrgChartProbe(val snapshot: () -> OrgChartSnapshot, val focus: (String) -> Unit = {}, val at: (Double) -> OrgChartSnapshot = { snapshot() })
internal val LocalAWCOrgChartInspector = staticCompositionLocalOf<((OrgChartProbe) -> Unit)?> { null }
internal val LocalAWCOrgChartFrameScale = staticCompositionLocalOf { 1.0 }
/** Parity inspection: [onProbe] receives the chart's probe; [frameScale] scales the frame clock (a test clock stepping 16 ms
 *  runs on Chrome's 60 Hz frame grid with 16.667 / 16). */
@Composable fun AWCOrgChartInspectionScope(onProbe: (OrgChartProbe) -> Unit, frameScale: Double = 1.0, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCOrgChartInspector provides onProbe, LocalAWCOrgChartFrameScale provides frameScale, content = content)

/** One CSS transition (`from` → `to`, emphasized easing). It starts at the frame its change is composed in (a deferred one
 *  a frame later); until then the transition it replaces ([before]) keeps running, and this one starts from its value at
 *  that frame. A transition back to where a running one began is shortened like CSS (reversing-adjusted start value and
 *  reversing shortening factor): it lasts the share of the duration the running one had covered. */
internal class OrgChartTrack(var from: List<Double>, val to: List<Double>, var start: Double, var before: OrgChartTrack? = null, var wait: Int = 0) {
    var factor = 1.0; var reverseFrom: List<Double>? = null
    fun value(now: Double, duration: Double): List<Double> {
        if(start.isNaN()) return before?.value(now, duration) ?: from
        val d = duration * factor
        if(d <= 0 || start == Double.NEGATIVE_INFINITY || now - start >= d) return to
        val p = orgEmphasized(max(0.0, (now - start) / d))
        return from.zip(to) { a, b -> a + (b - a) * p }
    }
    fun begin(s: Double, duration: Double) {
        val current = before?.value(s, duration) ?: from; val b = before
        if(b != null && duration > 0 && b.start.isFinite() && s - b.start < duration * b.factor && b.reverseFrom?.let { r -> r.size == to.size && r.indices.all { kotlin.math.abs(r[it] - to[it]) < 1e-6 } } == true) {
            val p = orgEmphasized(((s - b.start) / (duration * b.factor)).coerceIn(0.0, 1.0))
            factor = kotlin.math.abs(p * b.factor + 1 - b.factor).coerceIn(0.0, 1.0); reverseFrom = b.to
        } else { factor = 1.0; reverseFrom = current }
        from = current; before = null; wait = 0; start = s
    }
}
/** cubic-bezier(0.2, 0, 0, 1) (md-sys-motion-easing-emphasized) at progress x. */
internal fun orgEmphasized(x: Double): Double {
    val t0 = x.coerceIn(0.0, 1.0); if(t0 == 0.0 || t0 == 1.0) return t0
    fun bx(t: Double) = 3 * (1 - t) * (1 - t) * t * 0.2 + t * t * t
    fun by(t: Double) = 3 * (1 - t) * t * t * 1.0 + t * t * t
    var lo = 0.0; var hi = 1.0; var t = t0
    repeat(60) { t = (lo + hi) / 2; if(bx(t) < t0) lo = t else hi = t }
    return by(t)
}

/** What a card paints for its current state (the source's computed style targets). */
internal data class OrgChartVisual(val layer: Double, val layerColor: String, val border: List<Double>, val borderWidth: Double, val shadow: List<Double>, val lifted: Boolean) {
    companion object {
        const val SHADOW_LAYERS = 3
        fun rgba(hex: String): List<Double> {
            val h = hex.trim('#'); val v = h.toLong(16); val a = h.length == 8; val rgb = if(a) v shr 8 else v
            return listOf(((rgb shr 16) and 255) / 255.0, ((rgb shr 8) and 255) / 255.0, (rgb and 255) / 255.0, if(a) (v and 255) / 255.0 else 1.0)
        }
        /** Box-shadow lists interpolate layer by layer, the shorter one padded with transparent zero shadows (CSS). */
        fun flatten(layers: List<NativeShadowLayer>): List<Double> {
            val out = ArrayList<Double>()
            for(l in layers.take(SHADOW_LAYERS)) { val c = l.color; val a = c.alpha.toDouble(); out += listOf(l.x, l.y, l.blur, l.spread, c.red * a, c.green * a, c.blue * a, a) }
            repeat((SHADOW_LAYERS - layers.size.coerceAtMost(SHADOW_LAYERS)) * 8) { out += 0.0 }
            return out
        }
        fun layers(v: List<Double>): List<NativeShadowLayer> = (v.indices step 8).mapNotNull { i ->
            val a = v[i + 7]; if(a <= 0.0005) null
            else NativeShadowLayer(v[i], v[i + 1], max(0.0, v[i + 2]), v[i + 3], Color((v[i + 4] / a).toFloat().coerceIn(0f, 1f), (v[i + 5] / a).toFloat().coerceIn(0f, 1f), (v[i + 6] / a).toFloat().coerceIn(0f, 1f), a.toFloat().coerceIn(0f, 1f)), false)
        }
    }
}

/** View state of one chart: folds (rebuilt from `expanded` on every `nodes` assignment), roving owner, focus, pointer,
 *  transition tracks, unfold clocks and the frame clock. */
internal class OrgChartState {
    var collapsed by mutableStateOf(setOf<String>())
    var nodesValue: Any? = Unit
    var activeId by mutableStateOf("")
    var focused by mutableStateOf<String?>(null)
    val showFocus = mutableStateMapOf<String, Boolean>()
    val pending = HashSet<String>()
    private val requesters = HashMap<String, FocusRequester>()
    var hover by mutableStateOf<Offset?>(null)
    var press by mutableStateOf<Offset?>(null)
    val grow = mutableStateMapOf<String, Double>()
    var frame by mutableDoubleStateOf(0.0)
    val tracks = HashMap<String, OrgChartTrack>()
    private var duration = 300.0
    private val lifted = HashSet<String>(); private val liftEnded = HashMap<String, Double>()
    /** The frame interval, measured while the clock runs (60 Hz until then). */
    private var period = 1000.0 / 60; private var lastFrame = Double.NaN
    private var loop: Job? = null; private var loopDuration = 300.0; private var loopHold = 100.0
    var timeScale = 1.0
    fun requester(id: String) = requesters.getOrPut(id) { FocusRequester() }
    fun sync(nodes: Any?, roots: List<OrgChartNode>, collapsible: Boolean) {
        if(nodes == nodesValue) return
        nodesValue = nodes
        collapsed = OrgChartModel.seededCollapsed(roots)
        val ids = HashSet<String>(); fun walk(l: List<OrgChartNode>) { for(n in l) { ids += n.id; walk(n.children) } }; walk(roots)
        if(activeId.isEmpty() || activeId !in ids) activeId = roots.firstOrNull()?.id ?: ""
        activeId = OrgChartModel.visibleOwner(activeId, roots, collapsed, collapsible)
    }
    /** Starts a transition from the presented value when a target changes, at the frame it is composed in ([deferred]: the
     *  frame after, like the source's asynchronously rendered pointer-driven state); with no duration it switches then. */
    fun retarget(key: String, target: List<Double>, duration: Double, deferred: Boolean = false) {
        val t = tracks[key]
        if(t == null) { tracks[key] = OrgChartTrack(target, target, Double.NEGATIVE_INFINITY); return }
        if(t.to == target) return
        this.duration = duration
        tracks[key] = if(duration > 0 || deferred) OrgChartTrack(t.value(frame, duration), target, Double.NaN, if(t.start.isNaN()) t.before else t, if(deferred) 1 else 0)
            else OrgChartTrack(target, target, Double.NEGATIVE_INFINITY)
    }
    fun value(key: String, duration: Double, now: Double = frame) = tracks[key]?.value(now, duration)
    fun lift(id: String, on: Boolean) { if(on) { lifted += id; liftEnded.remove(id) } else if(lifted.remove(id)) liftEnded[id] = Double.NaN }
    fun z(id: String, hold: Double, now: Double = frame) = if(id in lifted || (liftEnded[id]?.let { it.isNaN() || now - it < hold } ?: false)) 4 else 2
    /** The first frame after a composition: what changed in it starts at that composed frame (one frame interval back), the
     *  deferred changes at this one. */
    fun onFrame(now: Double) {
        if(!lastFrame.isNaN()) (now - lastFrame).let { if(it in 4.0..50.0) period = it }
        lastFrame = now; frame = now
        val composed = now - period
        for(t in tracks.values) if(t.start.isNaN()) t.begin(if(t.wait > 0) now else composed, duration)
        for(k in liftEnded.keys) if(liftEnded[k]!!.isNaN()) liftEnded[k] = composed
        for(k in grow.keys.toList()) if(grow[k]!!.isNaN()) grow[k] = if(growDeferred.remove(k)) now else composed
    }
    /** The groups shown at the last composition and the keyframes they run (orientation; horizontal RTL mirrors them). */
    private var shownGroups: Set<String>? = null; private var motionKey = ""
    private val growDeferred = HashSet<String>()
    /** The source re-renders state changes asynchronously (Stencil): after a click, selection and fold paint one frame later
     *  than the pointer pseudo-classes (:hover/:active). Set by pointer-driven changes, consumed by the next composition. */
    var pointerCommit = false
    /** Each card's pointer pseudo-classes (hover, press) at the last composition: a layer change without one is state-driven. */
    val pseudo = HashMap<String, Pair<Boolean, Boolean>>()
    /** `md-org-chart-grow` runs when a group is inserted, and restarts on every shown group when its keyframes change. */
    fun detectGroups(ids: Set<String>, key: String, reduced: Boolean) {
        for(id in grow.keys.toList()) if(id !in ids) { grow.remove(id); growDeferred -= id }
        if(reduced) { grow.clear(); growDeferred.clear() }
        else { val restart = shownGroups != null && key != motionKey
            for(id in ids) if(restart || shownGroups?.contains(id) != true) { grow[id] = Double.NaN; if(pointerCommit) growDeferred += id else growDeferred -= id } }
        shownGroups = ids; motionKey = key
    }
    fun animating(duration: Double, hold: Double) = grow.values.any { it.isNaN() || frame - it < duration } || tracks.values.any { it.start.isNaN() || frame - it.start < duration } ||
        liftEnded.values.any { it.isNaN() || frame - it < hold }
    /** Runs the frame clock while anything moves; called after every composition (it changes nothing while running). */
    fun wake(scope: CoroutineScope, duration: Double, hold: Double) {
        loopDuration = duration; loopHold = hold
        if(loop?.isActive == true || !animating(duration, hold)) return
        loop = scope.launch { try { do { withFrameMillis { t -> onFrame(t.toDouble() * timeScale) } } while(animating(loopDuration, loopHold)) } finally { lastFrame = Double.NaN } }
    }
}

private val OrgRoboto = FontFamily(Font(R.font.awc_roboto_regular, FontWeight.Normal), Font(R.font.awc_roboto_bold, FontWeight.Bold))

/** `<slot name="empty">No data</slot>`: the authored `empty` slot when it composes anything, else its fallback. A host that
 *  always passes a slot lambda (the Laboratory) composes nothing for an unassigned slot, which must show the fallback. */
@Composable private fun OrgChartEmptySlot(slots: AWCSlotRegistry?, slot: Slot?, fallback: @Composable () -> Unit) {
    androidx.compose.ui.layout.SubcomposeLayout { constraints ->
        val authored = subcompose("authored") { if(slots?.contains("empty") == true) slots.Render("empty") else slot?.invoke("empty") }
        val used = authored.ifEmpty { subcompose("fallback", fallback) }
        val placeables = used.map { it.measure(constraints.copy(minWidth = 0, minHeight = 0)) }
        layout(placeables.maxOfOrNull { it.width } ?: 0, placeables.maxOfOrNull { it.height } ?: 0) { placeables.forEach { it.place(0, 0) } }
    }
}

@Composable internal fun NativeOrgChart(p: Props, emit: EventSink, slot: Slot? = null) {
    val context = LocalContext.current
    val text = remember(context) { OrgChartText(context) }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val tokens = LocalAWCThemeTokens.current
    val appearance = LocalAWCOrgChartAppearance.current
    val density = resolveAWCDensity(p["density"], LocalAWCNativeDensity.current)
    val metrics = remember(density, appearance) { OrgChartMetrics(density, appearance) }
    val systemReduced = rememberAWCAccessibilityAppearance().first
    val reduce = LocalAWCOrgChartReducedMotion.current ?: systemReduced
    val duration = if(reduce) 0.0 else metrics.duration; val hold = if(reduce) 0.0 else 100.0
    val inspector = LocalAWCOrgChartInspector.current
    val emitNow by rememberUpdatedState(emit)
    fun token(name: String, fallback: String) = tokens["--md-sys-color-$name"] ?: fallback
    fun hexColor(h: String) = OrgChartVisual.rgba(h).let { Color(it[0].toFloat(), it[1].toFloat(), it[2].toFloat(), it[3].toFloat()) }
    val nodesValue = p["nodes"]
    val roots = remember(nodesValue) { OrgChartNode.parse(nodesValue) }
    val collapsible = p.bool("collapsible", true)
    val mode = p.str("selectionMode", "none").takeIf { it in setOf("none", "single", "multiple") } ?: "none"
    var selection by awcState(p["selectedIds"]) { p.list("selectedIds").map { it.toString() } }
    val vertical = p.str("orientation", "vertical") != "horizontal"
    val label = p.str("label", "Organization chart").ifEmpty { "Organization chart" }
    val state = remember { OrgChartState() }
    state.timeScale = LocalAWCOrgChartFrameScale.current
    state.sync(nodesValue, roots, collapsible)
    val model = OrgChartModel(roots, state.collapsed, collapsible, mode, selection, vertical, rtl, metrics, text)
    // New data or a `collapsible` change can un-render the focused row: focus moves to the roving owner (CH2).
    LaunchedEffect(collapsible) { state.activeId = OrgChartModel.visibleOwner(state.activeId, roots, state.collapsed, collapsible) }
    // The focused row's id at this composition: un-rendering it clears focus before the effect runs.
    val focusedNow = state.focused
    LaunchedEffect(nodesValue, collapsible) {
        val f = focusedNow
        if(f != null && f != state.activeId) {
            val owner = state.activeId; state.showFocus[owner] = state.showFocus[f] == true; state.pending += owner
            runCatching { state.requester(owner).requestFocus() }
        }
    }
    val clockScope = rememberCoroutineScope()
    fun focusNode(id: String, indicator: Boolean) {
        state.activeId = id; state.showFocus[id] = indicator; state.pending += id
        runCatching { state.requester(id).requestFocus() }
    }
    fun toggleFold(n: OrgChartNode, moveFocus: Boolean = false) {
        if(collapsible && n.hasChildren) {
            val willExpand = n.id in state.collapsed
            state.collapsed = if(willExpand) state.collapsed - n.id else state.collapsed + n.id
            if(!willExpand) state.activeId = OrgChartModel.visibleOwner(state.activeId, roots, state.collapsed, collapsible)
            emitNow("mdNodeToggle", mapOf("node" to n.raw, "expanded" to willExpand))
        }
        // A toggler press focuses the row it belongs to, which becomes the roving owner (CH2).
        if(moveFocus) focusNode(n.id, false)
    }
    fun select(n: OrgChartNode) {
        if(!model.isSelectable(n)) return
        val next = if(mode == "single") { if(selection == listOf(n.id)) emptyList() else listOf(n.id) } else if(n.id in selection) selection - n.id else selection + n.id
        selection = next
        emitNow("mdSelectionChange", mapOf("node" to n.raw, "selectedIds" to next))
    }

    if(roots.isEmpty()) {
        // `role=status`: the `empty` slot or the default "No data" (body-medium 14px, on-surface-variant, padding 32/16).
        val slots = LocalAWCSlots.current
        Box(Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = (metrics.toggle / 2 + 10).dp).padding(horizontal = 16.dp, vertical = 32.dp)
            .semantics { liveRegion = LiveRegionMode.Polite }, contentAlignment = Alignment.TopCenter) {
            OrgChartEmptySlot(slots, slot) {
                BasicText("No data", style = TextStyle(color = hexColor(token("on-surface-variant", "#49454F")), fontSize = 14.sp, lineHeight = 16.sp, fontFamily = OrgRoboto,
                    platformStyle = PlatformTextStyle(includeFontPadding = false), lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)))
            }
        }
        return
    }

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val W = maxWidth.value.toDouble().takeIf { it.isFinite() && it > 0 } ?: 600.0
        val layout = model.layout(W)
        state.detectGroups(layout.groups.keys.toSet(), if(vertical) "v" else if(rtl) "h-rtl" else "h", reduce)
        val dx = if(rtl) layout.contentWidth - W else 0.0
        val scroll = rememberScrollState()
        // Pointer: hover (mouse) and press in content coordinates (CSS px).
        val dens = LocalDensity.current.density
        fun hit(o: Offset?) = o?.let { q -> layout.items.lastOrNull { it.card.contains(q.x - dx, q.y.toDouble()) || it.toggle?.contains(q.x - dx, q.y.toDouble()) == true }?.node?.id }
        val hovered = hit(state.hover); val pressed = hit(state.press)
        val elevation = remember(tokens) { NativeShadowLayer.parse(tokens["--md-sys-elevation-1"] ?: "0px 1px 2px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)") }
        fun selectedHex(n: OrgChartNode) = n.accent?.takeIf { Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$").matches(it) }?.uppercase() ?: appearance.selectedColor ?: token("primary", "#6750A4")
        val visuals = HashMap<String, OrgChartVisual>()
        for(item in layout.items) {
            val n = item.node; val selectable = model.isSelectable(n); val selected = model.isSelected(n); val sel = selectedHex(n)
            val hover = hovered == n.id; val press = pressed == n.id && selectable
            // `.selectable:hover` / `:active` (0,3,0) outrank `.selected` (0,2,0) for the layer opacity; the selected layer keeps its colour.
            val layer = if(selectable) (if(press) 0.12 else if(hover || selected) 0.08 else 0.0) else if(selected) 0.08 else 0.0
            val border = if(selected) sel else appearance.nodeOutlineColor ?: token("outline-variant", "#CAC4D0")
            val shadow = if(selectable && hover) (if(selected) listOf(NativeShadowLayer(0.0, 0.0, 0.0, 1.0, hexColor(sel), false)) else emptyList()) + elevation else emptyList()
            val v = OrgChartVisual(layer, if(selected) sel else appearance.stateLayerColor ?: token("on-surface", "#1C1B1F"), OrgChartVisual.rgba(border),
                if(selected) metrics.outline + 1 else metrics.outline, OrgChartVisual.flatten(shadow), hover)
            val pseudoChanged = state.pseudo.put(n.id, hover to press).let { it != null && it != (hover to press) }
            state.retarget(n.id + ".layer", listOf(v.layer), duration, state.pointerCommit && !pseudoChanged); state.retarget(n.id + ".border", v.border, duration, state.pointerCommit); state.retarget(n.id + ".shadow", v.shadow, duration, state.pointerCommit)
            state.lift(n.id, hover)
            visuals[n.id] = v
        }
        state.pointerCommit = false
        SideEffect { state.wake(clockScope, duration, hold) }
        // Group motion: own keyframe (opacity, scale, tx, ty) and the composed transform of an element's ancestor groups.
        fun keyframe(id: String, now: Double = state.frame): DoubleArray {
            val start = state.grow[id]; if(reduce || start == null) return doubleArrayOf(1.0, 1.0, 0.0, 0.0)
            if(start.isNaN()) return doubleArrayOf(0.0, 0.96, if(vertical) 0.0 else if(rtl) 8.0 else -8.0, if(vertical) -8.0 else 0.0)
            val raw = (now - start) / max(1.0, metrics.duration); if(raw >= 1) return doubleArrayOf(1.0, 1.0, 0.0, 0.0)
            val pr = orgEmphasized(max(0.0, raw)); val shift = -8 * (1 - pr)
            return doubleArrayOf(pr, 0.96 + 0.04 * pr, if(vertical) 0.0 else if(rtl) -shift else shift, if(vertical) shift else 0.0)
        }
        val parents = layout.items.associate { it.node.id to it.parent }
        /** (opacity, scale, bx, by): p' = scale·p + b in content coordinates, composed outer → inner. */
        fun motion(group: String?): DoubleArray {
            var o = 1.0; var s = 1.0; var bx = 0.0; var by = 0.0
            val chain = ArrayList<String>(); var g = group; while(g != null) { chain += g; g = parents[g] }
            for(id in chain.asReversed()) {
                val k = keyframe(id); val box = layout.groups[id] ?: continue
                if(k[0] >= 1.0 && k[1] == 1.0) continue
                val ox = (if(vertical) box.midX else if(rtl) box.maxX else box.x) + dx; val oy = if(vertical) box.y else box.midY
                // q = O + d + k·(p − O) applied after the outer transform: compose (s, b) with (k, O + d − k·O).
                val ks = k[1]; val cx = ox + k[2] - ks * ox; val cy = oy + k[3] - ks * oy
                s *= ks; bx = ks * bx + cx; by = ks * by + cy; o *= k[0]
            }
            return doubleArrayOf(o, s, bx, by)
        }
        val connector = hexColor(appearance.connectorColor ?: token("outline-variant", "#CAC4D0")); val selectedLine = hexColor(appearance.selectedColor ?: token("primary", "#6750A4"))
        fun snapshotAt(now: Double) = OrgChartSnapshot(state.focused, layout.items.map { item ->
            val n = item.node; val v = visuals[n.id]!!
            OrgChartSnapshot.Node(n.id, if(n.id == state.activeId) 0 else -1, if(n.hasChildren) model.isExpanded(n) else null, if(model.isSelectable(n)) model.isSelected(n) else null,
                item.onPath, state.value(n.id + ".border", duration, now) ?: v.border, v.borderWidth, state.value(n.id + ".shadow", duration, now) ?: v.shadow,
                state.focused == n.id && state.showFocus[n.id] == true, state.value(n.id + ".layer", duration, now)?.first() ?: v.layer, OrgChartVisual.rgba(v.layerColor),
                state.z(n.id, hold, now), item.card, item.toggle)
        }, layout.groups.keys.sorted().map { id -> val k = keyframe(id, now); OrgChartSnapshot.Group(id, k[0], k[1], k[2], k[3], layout.groups[id]!!) }, layout.hostHeight, now)
        inspector?.invoke(OrgChartProbe({ snapshotAt(state.frame) }, { id: String -> focusNode(id, true) }, { now: Double -> snapshotAt(now) }))
        // Web role="tree" named by `label`: a collection of the visible tree items (rows), each a collection item.
        Box(Modifier.fillMaxWidth().height(layout.hostHeight.dp).semantics { contentDescription = label; collectionInfo = CollectionInfo(layout.items.size, 1); isTraversalGroup = true }
            .horizontalScroll(scroll, enabled = layout.contentWidth > W + 0.5)) {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Box(Modifier.size(layout.contentWidth.dp, layout.hostHeight.dp)
                    .pointerInput(Unit) { awaitPointerEventScope { while(true) {
                        val e = awaitPointerEvent(PointerEventPass.Initial); val ch = e.changes.firstOrNull() ?: continue
                        val q = Offset(ch.position.x / dens, ch.position.y / dens)
                        when(e.type) {
                            PointerEventType.Move, PointerEventType.Enter -> if(ch.type == PointerType.Mouse) state.hover = q
                            PointerEventType.Exit -> { state.hover = null; state.press = null }
                            PointerEventType.Press -> { state.press = q; if(ch.type == PointerType.Mouse) state.hover = q }
                            PointerEventType.Release -> { state.press = null; if(ch.type != PointerType.Mouse) state.hover = null }
                        } } } }) {
                    // Connectors (pseudo-element borders) with their group's motion.
                    Canvas(Modifier.size(layout.contentWidth.dp, layout.hostHeight.dp)) {
                        @Suppress("UNUSED_VARIABLE") val f = state.frame
                        for(b in layout.connectors) { val m = motion(b.owner); if(m[0] > 0) drawBorderBox(b, dx, m, connector, selectedLine) }
                    }
                    layout.items.forEachIndexed { index, item -> key(item.node.id) {
                        val n = item.node; val v = visuals[n.id]!!
                        Box(Modifier.zIndex(state.z(n.id, hold).toFloat())) {
                            OrgChartCard(item, index, n, v, model, metrics, dx, rtl, state, duration, { motion(item.groupID) }, tokens, appearance, ::selectedHex, ::hexColor,
                                onPress = { focusNode(n.id, false) }, onActivate = { state.pointerCommit = true; select(n) },
                                onKey = { k -> orgKey(k, n, model, layout, rtl, collapsible, ::focusNode, ::toggleFold, ::select) })
                            if(item.toggle != null) OrgChartToggle(item, n, model, metrics, dx, p, density, { motion(item.groupID) }, tokens) { state.pointerCommit = true; toggleFold(n, true) }
                        }
                    } }
                }
            }
        }
        LaunchedEffect(rtl, layout.contentWidth > W + 0.5) { if(rtl) scroll.scrollTo(0) }
    }
}

/** The source `handleKeyDown` on a focused tree item. Modifiers are ignored; Tab and other keys pass through. */
private fun orgKey(k: String, n: OrgChartNode, model: OrgChartModel, layout: OrgChartLayout, rtl: Boolean, collapsible: Boolean,
                   focus: (String, Boolean) -> Unit, toggle: (OrgChartNode, Boolean) -> Unit, select: (OrgChartNode) -> Unit): Boolean {
    val items = layout.items; val idx = items.indexOfFirst { it.node.id == n.id }; if(idx < 0) return false
    val forward = if(rtl) "ArrowLeft" else "ArrowRight"; val backward = if(rtl) "ArrowRight" else "ArrowLeft"
    fun to(i: Int) { if(i in items.indices) focus(items[i].node.id, true) }
    when(k) {
        "ArrowDown" -> to(idx + 1)
        "ArrowUp" -> to(idx - 1)
        forward -> if(n.hasChildren) { if(!model.isExpanded(n)) toggle(n, false) else items.firstOrNull { it.parent == n.id }?.let { focus(it.node.id, true) } }
        backward -> if(collapsible && n.hasChildren && model.isExpanded(n)) toggle(n, false) else items[idx].parent?.let { focus(it, true) }
        "Home" -> to(0)
        "End" -> to(items.size - 1)
        "Enter", " " -> if(model.isSelectable(n)) select(n) else if(n.hasChildren) toggle(n, false)
        else -> return false
    }
    return true
}

/** One pseudo-element border box: an even-odd ring (outer minus inner rounded rect), each side in its colour role. */
private fun DrawScope.drawBorderBox(b: OrgChartBorderBox, dx: Double, m: DoubleArray, connector: Color, selected: Color) {
    val s = m[1].toFloat(); val px = density
    withTransform({ translate((m[2] * px).toFloat(), (m[3] * px).toFloat()); scale(s, s, Offset.Zero) }) {
        val r = b.rect; val x0 = ((r.x + dx) * px).toFloat(); val y0 = (r.y * px).toFloat(); val x1 = ((r.maxX + dx) * px).toFloat(); val y1 = (r.maxY * px).toFloat()
        val il = x0 + (b.left * px).toFloat(); val it = y0 + (b.top * px).toFloat(); val ir = x1 - (b.right * px).toFloat(); val ib = y1 - (b.bottom * px).toFloat()
        fun cr(v: Double) = CornerRadius((v * px).toFloat())
        fun inner(rad: Double, a: Double, c: Double) = CornerRadius((max(0.0, rad - max(a, c)) * px).toFloat())
        val ring = Path().apply {
            fillType = PathFillType.EvenOdd
            addRoundRect(RoundRect(x0, y0, x1, y1, cr(b.topLeft), cr(b.topRight), cr(b.bottomRight), cr(b.bottomLeft)))
            addRoundRect(RoundRect(il, it, max(il, ir), max(it, ib), inner(b.topLeft, b.left, b.top), inner(b.topRight, b.right, b.top),
                inner(b.bottomRight, b.right, b.bottom), inner(b.bottomLeft, b.left, b.bottom)))
        }
        val alpha = m[0].toFloat()
        val wedges = listOf("top" to (b.top to listOf(Offset(x0, y0), Offset(x1, y0), Offset(ir, it), Offset(il, it))),
            "right" to (b.right to listOf(Offset(x1, y0), Offset(x1, y1), Offset(ir, ib), Offset(ir, it))),
            "bottom" to (b.bottom to listOf(Offset(x1, y1), Offset(x0, y1), Offset(il, ib), Offset(ir, ib))),
            "left" to (b.left to listOf(Offset(x0, y1), Offset(x0, y0), Offset(il, it), Offset(il, ib))))
        for((side, wp) in wedges) { val (w, pts) = wp; if(w <= 0) continue
            val wedge = Path().apply { moveTo(pts[0].x, pts[0].y); pts.drop(1).forEach { lineTo(it.x, it.y) }; close() }
            clipPath(wedge) { drawPath(ring, if(b.selected(side)) selected else connector, alpha = alpha) }
        }
    }
}

@Composable private fun OrgChartCard(item: OrgChartLayout.Item, index: Int, n: OrgChartNode, v: OrgChartVisual, model: OrgChartModel, m: OrgChartMetrics, dx: Double, rtl: Boolean,
                                     state: OrgChartState, duration: Double, motion: () -> DoubleArray, tokens: Map<String, String>, appearance: AWCOrgChartAppearance,
                                     selectedHex: (OrgChartNode) -> String, hexColor: (String) -> Color, onPress: () -> Unit, onActivate: () -> Unit, onKey: (String) -> Boolean) {
    val c = item.card; val selectable = model.isSelectable(n)
    val shape = remember(m.radius) { AWCCornerShape.uniform(m.radius) }
    val background = hexColor(appearance.nodeColor ?: tokens["--md-sys-color-surface-container-low"] ?: "#F7F2FA")
    val ringColor = hexColor(appearance.focusRingColor ?: tokens["--md-sys-color-secondary"] ?: "#625B71")
    val accent = n.accent?.takeIf { Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$").matches(it) }
    val ringVisible = state.focused == n.id && state.showFocus[n.id] == true
    val selected = model.isSelected(n)
    val itemLabel = listOf(n.name, n.title).filter { it.isNotEmpty() }.joinToString(" ")
    Box(Modifier
        .absoluteOffset((c.x + dx).dp, c.y.dp).size(c.w.dp, c.h.dp)
        .graphicsLayer { @Suppress("UNUSED_VARIABLE") val f = state.frame
            val mo = motion(); alpha = mo[0].toFloat()
            // p' = s·p + b about the content origin, expressed about this card's top-left.
            transformOrigin = TransformOrigin(0f, 0f); scaleX = mo[1].toFloat(); scaleY = mo[1].toFloat()
            translationX = ((mo[2] - (1 - mo[1]) * (c.x + dx)) * density).toFloat(); translationY = ((mo[3] - (1 - mo[1]) * c.y) * density).toFloat() }
        .accordionShadow(shape, { @Suppress("UNUSED_VARIABLE") val f = state.frame; OrgChartVisual.layers(state.value(n.id + ".shadow", duration) ?: v.shadow) }, false)
        .drawWithContent {
            val t = state.value(n.id + ".border", duration) ?: v.border
            val r = CornerRadius((m.radius * density).toFloat())
            drawRoundRect(background, cornerRadius = r)
            val bw = (v.borderWidth * density).toFloat()
            drawRoundRect(Color(t[0].toFloat(), t[1].toFloat(), t[2].toFloat(), t[3].toFloat()), topLeft = Offset(bw / 2, bw / 2), size = Size(size.width - bw, size.height - bw),
                cornerRadius = CornerRadius(r.x - bw / 2), style = Stroke(bw))
            drawContent()
            if(ringVisible) { val o = (3.5 * density).toFloat()
                drawRoundRect(ringColor, topLeft = Offset(-o, -o), size = Size(size.width + 2 * o, size.height + 2 * o), cornerRadius = CornerRadius(r.x + o), style = Stroke((3 * density).toFloat())) }
        }
        .focusRequester(state.requester(n.id))
        .onKeyEvent { e -> if(e.type != KeyEventType.KeyDown || state.focused != n.id) false else {
            state.showFocus[n.id] = true
            val k = when(e.key) { Key.DirectionDown -> "ArrowDown"; Key.DirectionUp -> "ArrowUp"; Key.DirectionRight -> "ArrowRight"; Key.DirectionLeft -> "ArrowLeft"
                Key.MoveHome -> "Home"; Key.MoveEnd -> "End"; Key.Enter, Key.NumPadEnter -> "Enter"; Key.Spacebar -> " "; else -> "" }
            k.isNotEmpty() && onKey(k) } }
        .focusProperties { canFocus = n.id == state.activeId || state.focused == n.id || n.id in state.pending }
        .onFocusChanged { f -> if(f.isFocused) { if(n.id !in state.pending) state.showFocus[n.id] = true; state.pending -= n.id; state.focused = n.id; state.activeId = n.id }
            else if(state.focused == n.id) state.focused = null }
        .focusTarget()
        // A press focuses the tree item (browsers move focus on mousedown); a release on the card clicks it.
        .pointerInput(n.id) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false); onPress(); if(waitForUpOrCancellation() != null) onActivate() } }
        .semantics(mergeDescendants = false) {
            contentDescription = itemLabel
            if(selectable) this.selected = selected
            // A tree item is focusable (roving) and clickable for assistive technology too: focus state, a focus request
            // and the click (TalkBack double tap) a pointer click performs.
            focused = state.focused == n.id
            requestFocus { state.activeId = n.id; state.showFocus[n.id] = true; state.pending += n.id; runCatching { state.requester(n.id).requestFocus() }.isSuccess }
            onClick { onActivate(); true }
            if(n.hasChildren) stateDescription = if(model.isExpanded(n)) "Expanded" else "Collapsed"
            collectionItemInfo = CollectionItemInfo(index, 1, 0, 1)
            // Reading order: the tree's DOM (pre-)order (`layout.items`), not geometry (later siblings after descendants).
            traversalIndex = index.toFloat()
        }) {
        // In-flow text, the positioned state layer + md-ripple, then md-avatar (its host is `position: relative`) above them.
        OrgChartCardText(n, m, rtl, tokens, hexColor)
        Box(Modifier.fillMaxSize().padding(v.borderWidth.dp)
            .then(if(selectable) Modifier.awcRipple(cornerRadius = max(0.0, m.radius - v.borderWidth).dp, appearance = AWCRippleAppearance(color = selectedHex(n))) else Modifier)
            .drawBehind { val o = state.value(n.id + ".layer", duration)?.first() ?: v.layer
                if(o > 0) drawRoundRect(hexColor(v.layerColor).copy(alpha = o.toFloat()), cornerRadius = CornerRadius(((m.radius - v.borderWidth) * density).toFloat().coerceAtLeast(0f))) }
            .clearAndSetSemantics { })
        Box(Modifier.fillMaxSize().padding(horizontal = (m.padInline + m.outline).dp), contentAlignment = if(rtl) Alignment.CenterEnd else Alignment.CenterStart) {
            Box(Modifier.size(m.avatar.dp).drawWithContent { drawContent()
                if(accent != null) { val w = (2 * density); drawCircle(hexColor(accent.uppercase()), radius = size.minDimension / 2 + w / 2, style = Stroke(w)) } }
                .clearAndSetSemantics { }) {
                AWCAvatarAppearanceScope(AWCAvatarAppearance(containerColor = tokens["--md-sys-color-primary-container"] ?: "#EADDFF", labelColor = tokens["--md-sys-color-on-primary-container"] ?: "#21005D")) {
                    CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                        AWCComponent("md-avatar", mapOf("src" to n.avatar, "initials" to n.avatarInitials, "name" to n.name, "size" to "medium", "shape" to "circle", "colorFromName" to false, "density" to m.density))
                    }
                }
            }
        }
    }
}

/** The text column beside the avatar's slot, start-aligned in the card's direction; `text-overflow: ellipsis` cuts at the
 *  line's end edge, so a run whose own direction differs from the card's is cut at its head. */
@Composable private fun OrgChartCardText(n: OrgChartNode, m: OrgChartMetrics, rtl: Boolean, tokens: Map<String, String>, hexColor: (String) -> Color) {
    fun cut(s: String) = if(OrgChartText.isRtl(s) == rtl) TextOverflow.Ellipsis else TextOverflow.StartEllipsis
    val lh = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)
    CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Row(Modifier.fillMaxSize().padding(horizontal = (m.padInline + m.outline).dp, vertical = (m.padBlock + m.outline).dp).clearAndSetSemantics { },
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(m.gap.dp)) {
            Spacer(Modifier.size(m.avatar.dp))
            Column(Modifier.weight(1f, fill = false), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BasicText(n.name, Modifier.height(m.nameLine.dp), maxLines = 1, softWrap = false, overflow = cut(n.name), style = TextStyle(color = hexColor(tokens["--md-sys-color-on-surface"] ?: "#1C1B1F"),
                    fontFamily = OrgRoboto, fontWeight = FontWeight.Bold, fontSize = m.nameSize.sp, lineHeight = m.nameLine.sp, lineHeightStyle = lh, platformStyle = PlatformTextStyle(includeFontPadding = false)))
                if(n.title.isNotEmpty()) BasicText(n.title, Modifier.height(m.titleLine.dp), maxLines = 1, softWrap = false, overflow = cut(n.title), style = TextStyle(color = hexColor(tokens["--md-sys-color-on-surface-variant"] ?: "#49454F"),
                    fontFamily = OrgRoboto, fontWeight = FontWeight.Normal, fontSize = m.titleSize.sp, lineHeight = m.titleLine.sp, lineHeightStyle = lh, platformStyle = PlatformTextStyle(includeFontPadding = false)))
            }
        }
    }
}

/** md-tooltip (bottom, the expand/collapse label) around an md-icon-button (xs, tonal, round, aria-hidden, out of the tab order). */
@Composable private fun OrgChartToggle(item: OrgChartLayout.Item, n: OrgChartNode, model: OrgChartModel, m: OrgChartMetrics, dx: Double, p: Props, density: Double,
                                       motion: () -> DoubleArray, tokens: Map<String, String>, onToggle: () -> Unit) {
    val t = item.toggle!!; val expanded = model.isExpanded(n)
    val tip = if(expanded) p.str("collapseLabel", "Collapse").ifEmpty { "Collapse" } else p.str("expandLabel", "Expand").ifEmpty { "Expand" }
    val toggleNow by rememberUpdatedState(onToggle)
    Box(Modifier.absoluteOffset((t.x + dx).dp, t.y.dp).size(t.w.dp, t.h.dp).zIndex(3f)
        .graphicsLayer { val mo = motion(); alpha = mo[0].toFloat(); transformOrigin = TransformOrigin(0f, 0f); scaleX = mo[1].toFloat(); scaleY = mo[1].toFloat()
            translationX = ((mo[2] - (1 - mo[1]) * (t.x + dx)) * this.density).toFloat(); translationY = ((mo[3] - (1 - mo[1]) * t.y) * this.density).toFloat() }
        .clearAndSetSemantics { }) {
        AWCIconButtonAppearanceScope(AWCIconButtonAppearance(containerColor = tokens["--md-sys-color-surface-container-high"] ?: "#ECE6F0", iconSize = m.toggle * 0.66, width = m.toggle, height = m.toggle)) {
            AWCComponent("md-tooltip", mapOf("text" to tip, "position" to "bottom"), content = { slot -> if(slot == "") AWCComponent("md-icon-button",
                mapOf("icon" to if(expanded) "expand_less" else "expand_more", "size" to "xs", "variant" to "tonal", "shape" to "round", "aria-hidden" to "true", "groupTabindex" to -1, "density" to density),
                onEvent = { name, _ -> if(name == "mdClick") toggleNow() }) })
        }
    }
}
