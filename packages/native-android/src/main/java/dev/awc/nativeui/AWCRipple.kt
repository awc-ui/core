package dev.awc.nativeui

import androidx.compose.foundation.layout.Box
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.focusable
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.isPrimaryPressed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * The six public md-ripple hooks (`--md-ripple-*`) as the CSS value text the source reads, so every fallback matches it:
 * opacity follows JavaScript `Number()` (empty/invalid → 0.12, finite values clamped to 0…1); the extents accept only
 * concrete non-negative pixel values (`12`, `12px`); growDuration accepts ms, s and unitless milliseconds (invalid → 450);
 * an easing the browser rejects falls back to the standard curve. color replaces the inherited content colour.
 * Nearer values win over inherited ones, including invalid values (which then fall back to the default).
 */
class AWCRippleAppearance private constructor(
    /** Hook text by suffix (color, opacity, extend-inline, extend-block, grow-duration, grow-easing). */
    val css: Map<String, String>,
) {
    /** Typed hooks: colour #RRGGBB/#RRGGBBAA, opacity, extents in dp, grow duration in ms, CSS easing text. */
    constructor(color: String? = null, opacity: Double? = null, extendInline: Double? = null, extendBlock: Double? = null,
                growDuration: Double? = null, growEasing: String? = null) : this(buildMap {
        fun n(v: Double) = if (!v.isFinite()) "invalid" else if (v == Math.rint(v) && abs(v) < 1e15) v.toLong().toString() else v.toString()
        color?.let { put("color", it) }; opacity?.let { put("opacity", n(it)) }
        extendInline?.let { put("extend-inline", if (it.isFinite()) n(it) + "px" else "invalid") }
        extendBlock?.let { put("extend-block", if (it.isFinite()) n(it) + "px" else "invalid") }
        growDuration?.let { put("grow-duration", if (it.isFinite()) n(it) + "ms" else "invalid") }
        growEasing?.let { put("grow-easing", it) }
    })
    val color: String? get() = css["color"]; val opacity: String? get() = css["opacity"]
    val extendInline: String? get() = css["extend-inline"]; val extendBlock: String? get() = css["extend-block"]
    val growDuration: String? get() = css["grow-duration"]; val growEasing: String? get() = css["grow-easing"]
    fun merging(o: AWCRippleAppearance) = AWCRippleAppearance(css + o.css)
    override fun equals(other: Any?) = other is AWCRippleAppearance && other.css == css
    override fun hashCode() = css.hashCode()
    override fun toString() = "AWCRippleAppearance($css)"
    val resolvedOpacity: Double get() {
        val raw = opacity?.trim().orEmpty(); if (raw.isEmpty()) return DEFAULT_OPACITY
        val v = jsNumber(raw) ?: return DEFAULT_OPACITY
        return if (v.isFinite()) v.coerceIn(0.0, 1.0) else DEFAULT_OPACITY
    }
    val resolvedExtendInline: Double get() = extent(extendInline)
    val resolvedExtendBlock: Double get() = extent(extendBlock)
    val resolvedGrowDuration: Double get() {
        val raw = growDuration?.trim().orEmpty()
        val m = Regex("^(\\d+\\.?\\d*|\\.\\d+)(ms|s)?$", RegexOption.IGNORE_CASE).matchEntire(raw) ?: return DEFAULT_GROW
        val n = m.groupValues[1].toDoubleOrNull() ?: return DEFAULT_GROW
        return if (m.groupValues[2].equals("s", true)) n * 1000 else n
    }
    val resolvedGrowEasing: AWCRippleEasing get() = growEasing?.trim()?.takeIf { it.isNotEmpty() }?.let { AWCRippleEasing.parse(it) } ?: AWCRippleEasing.Standard
    companion object {
        const val DEFAULT_OPACITY = 0.12; const val DEFAULT_GROW = 450.0; const val FADE = 150.0
        /** Raw custom-property text exactly as the source reads it (invalid text falls back like the source). */
        fun cssValues(values: Map<String, String>) = AWCRippleAppearance(values.filterKeys { it in setOf("color", "opacity", "extend-inline", "extend-block", "grow-duration", "grow-easing") })
        /** Laboratory/source names: color, opacity, extendInline, extendBlock, growDuration (ms), growEasing. */
        fun fromValues(values: Map<String, Any?>): AWCRippleAppearance {
            fun d(k: String) = (values[k] as? Number)?.toDouble()
            return AWCRippleAppearance(values["color"] as? String, d("opacity"), d("extendInline"), d("extendBlock"), d("growDuration"), values["growEasing"] as? String)
        }
        fun jsNumber(s: String): Double? {
            val l = s.lowercase()
            listOf("0x" to 16, "0o" to 8, "0b" to 2).forEach { (p, r) -> if (l.startsWith(p)) return l.drop(2).toLongOrNull(r)?.toDouble() }
            if (l == "infinity" || l == "+infinity" || l == "-infinity") return Double.POSITIVE_INFINITY
            if (!Regex("^[+-]?(\\d+\\.?\\d*|\\.\\d+)(e[+-]?\\d+)?$").matches(l)) return null
            return l.toDoubleOrNull()
        }
        fun extent(raw: String?): Double {
            val t = raw?.trim().orEmpty()
            if (!Regex("^(\\d+\\.?\\d*|\\.\\d+)(px)?$", RegexOption.IGNORE_CASE).matches(t)) return 0.0
            val v = t.lowercase().removeSuffix("px").toDoubleOrNull() ?: 0.0
            return if (v.isFinite() && v > 0) v else 0.0
        }
    }
}

/** A CSS `<easing-function>` (keywords, cubic-bezier(), steps(), linear()) evaluated like Web Animations. */
class AWCRippleEasing private constructor(val css: String, private val f: (Double) -> Double) {
    fun transform(p: Double): Double = f(p)
    override fun equals(other: Any?) = other is AWCRippleEasing && other.css == css
    override fun hashCode() = css.hashCode()
    companion object {
        fun bezier(x1: Double, y1: Double, x2: Double, y2: Double): (Double) -> Double = { p ->
            if (p <= 0 || p >= 1) p else {
                fun axis(t: Double, a: Double, b: Double) = 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t
                var lo = 0.0; var hi = 1.0
                repeat(20) { val t = (lo + hi) / 2; if (axis(t, x1, x2) < p) lo = t else hi = t }
                axis((lo + hi) / 2, y1, y2)
            }
        }
        val Standard = AWCRippleEasing("cubic-bezier(0.2, 0, 0, 1)", bezier(.2, 0.0, 0.0, 1.0))
        private fun num(t: String) = if (Regex("^[+-]?(\\d+\\.?\\d*|\\.\\d+)(e[+-]?\\d+)?$").matches(t)) t.toDoubleOrNull() else null
        /** null when Chrome would reject the value. */
        fun parse(raw: String): AWCRippleEasing? {
            val s = raw.trim().lowercase()
            val kw = mapOf("ease" to doubleArrayOf(.25, .1, .25, 1.0), "ease-in" to doubleArrayOf(.42, 0.0, 1.0, 1.0), "ease-out" to doubleArrayOf(0.0, 0.0, .58, 1.0), "ease-in-out" to doubleArrayOf(.42, 0.0, .58, 1.0))
            kw[s]?.let { return AWCRippleEasing(raw, bezier(it[0], it[1], it[2], it[3])) }
            if (s == "linear") return AWCRippleEasing(raw) { it }
            if (s == "step-start") return steps(raw, 1, "jump-start"); if (s == "step-end") return steps(raw, 1, "jump-end")
            fun args(name: String) = if (s.startsWith("$name(") && s.endsWith(")")) s.substring(name.length + 1, s.length - 1).split(",").map { it.trim() } else null
            args("cubic-bezier")?.let { a ->
                if (a.size != 4) return null
                val v = a.map { num(it) ?: return null }
                if (v[0] !in 0.0..1.0 || v[2] !in 0.0..1.0) return null
                return AWCRippleEasing(raw, bezier(v[0], v[1], v[2], v[3]))
            }
            args("steps")?.let { a ->
                if (a.size !in 1..2) return null
                val n = a[0].toIntOrNull() ?: return null
                val pos = mapOf("start" to "jump-start", "end" to "jump-end", "jump-start" to "jump-start", "jump-end" to "jump-end", "jump-none" to "jump-none", "jump-both" to "jump-both")[if (a.size == 2) a[1] else "end"] ?: return null
                if (n < (if (pos == "jump-none") 2 else 1)) return null
                return steps(raw, n, pos)
            }
            args("linear")?.let { a ->
                val stops = mutableListOf<Pair<Double, Double?>>()
                for (part in a) {
                    val tk = part.split(" ").filter { it.isNotEmpty() }
                    if (tk.isEmpty() || tk.size > 3) return null
                    val y = num(tk[0]) ?: return null
                    val ps = tk.drop(1).map { t -> if (!t.endsWith("%")) return null; (num(t.dropLast(1)) ?: return null) / 100 }
                    if (ps.isEmpty()) stops += y to null else ps.forEach { stops += y to it }
                }
                if (stops.size < 2) return null
                val xs = stops.map { it.second }.toMutableList()
                if (xs[0] == null) xs[0] = 0.0
                if (xs.last() == null) xs[xs.size - 1] = max(1.0, xs.filterNotNull().maxOrNull() ?: 1.0)
                var last = xs[0]!!
                for (i in 1 until xs.size) xs[i]?.let { xs[i] = max(it, last); last = xs[i]!! }
                var i = 0
                while (i < xs.size) { if (xs[i] == null) { var j = i; while (xs[j] == null) j++; val a0 = xs[i - 1]!!; val b0 = xs[j]!!
                        for (k in i until j) xs[k] = a0 + (b0 - a0) * (k - i + 1) / (j - i + 1); i = j } else i++ }
                val pts = xs.map { it!! }.zip(stops.map { it.first })
                return AWCRippleEasing(raw) { p ->
                    if (p <= pts[0].first) pts[0].second else {
                        var out = pts.last().second
                        for (k in 1 until pts.size) if (p <= pts[k].first || k == pts.size - 1) { val (x0, y0) = pts[k - 1]; val (x1, y1) = pts[k]
                            out = if (x1 == x0) y1 else y0 + (y1 - y0) * (p - x0) / (x1 - x0); break }
                        out
                    }
                }
            }
            return null
        }
        private fun steps(raw: String, n: Int, pos: String) = AWCRippleEasing(raw) { p ->
            val jumps = n.toDouble(); var cur = Math.floor(p * jumps)
            if (pos == "jump-start" || pos == "jump-both") cur += 1
            if (p >= 1) cur = when (pos) { "jump-none" -> jumps - 1; "jump-both" -> jumps + 1; else -> jumps }
            val total = when (pos) { "jump-none" -> jumps - 1; "jump-both" -> jumps + 1; else -> jumps }
            (cur / total).coerceIn(0.0, 1.0)
        }
    }
}

/** One ripple wave: physical origin (dp), final radius (dp), current scale and opacity. */
data class AWCRippleWave(val x: Double, val y: Double, val radius: Double, val scale: Double, val opacity: Double, val sinceMs: Double)

/**
 * md-ripple's methods: trigger() starts a centred, self-releasing wave unless disabled or suppressed; whenSettled() waits
 * for the current cycle with the source's 200 ms bound (it can return while a held or long-growing wave is still visible
 * and never settles a later wave). [wave] reads the current wave for inspection.
 */
@Stable
class AWCRippleController {
    internal var state: AWCRippleState? = null
    fun trigger() { state?.trigger() }
    suspend fun whenSettled() { state?.whenSettled() }
    val wave: AWCRippleWave? get() = state?.let { s -> s.cycle?.let { c -> s.sample(c, s.frameTime(c))?.let { (sc, op) -> AWCRippleWave(c.x, c.y, c.radius, sc, op, s.frameTime(c) - c.start) } } }
}

/** A fixed render instant for paint verification (the Web reference pauses its Web Animations at the same instants). */
sealed class AWCRippleFrame { data class Grow(val ms: Double) : AWCRippleFrame(); object Held : AWCRippleFrame(); data class Fade(val ms: Double) : AWCRippleFrame() }

/**
 * One ripple's cycle on the frame clock: a press or release is stamped by the next frame (a Web Animation likewise
 * starts on the frame after it is created), so timing is identical under real and virtual frame clocks.
 */
internal class AWCRippleState {
    data class Cycle(val id: Int, val x: Double, val y: Double, val radius: Double, val opacity: Double, val grow: Double, val easing: AWCRippleEasing, val start: Double, val release: Double?)
    var cycle by mutableStateOf<Cycle?>(null)
    var now by mutableDoubleStateOf(0.0)
    var frame by mutableStateOf<AWCRippleFrame?>(null)
    var size = Size.Zero
    var appearance = AWCRippleAppearance()
    var disabled = false; var suppressed = false; var connected = false
    private var nextId = 0
    private val waiters = mutableMapOf<Int, MutableList<CompletableDeferred<Unit>>>()
    fun radius(x: Double, y: Double): Double {
        val ei = appearance.resolvedExtendInline; val eb = appearance.resolvedExtendBlock
        val dx = max(abs(x + ei), abs(x - (size.width + ei))); val dy = max(abs(y + eb), abs(y - (size.height + eb)))
        return sqrt(dx * dx + dy * dy)
    }
    private val pending get() = if (frame != null) 0.0 else Double.NaN
    fun press(x: Double, y: Double): Boolean {
        if (!connected || disabled || suppressed) return false
        finish(); nextId++
        cycle = Cycle(nextId, x, y, radius(x, y), appearance.resolvedOpacity, appearance.resolvedGrowDuration, appearance.resolvedGrowEasing, pending, null)
        return true
    }
    fun release() { val c = cycle ?: return; if (c.release == null) cycle = c.copy(release = pending) }
    fun trigger() { if (connected && !disabled && !suppressed && press(size.width / 2.0, size.height / 2.0)) release() }
    fun finish() { val c = cycle ?: return; cycle = null; waiters.remove(c.id)?.forEach { it.complete(Unit) } }
    /** Stamps pending times with this frame and ends a finished fade; false once no cycle is left. */
    fun onFrame(t: Double): Boolean {
        now = t
        val c = cycle ?: return false
        var u = c
        if (u.start.isNaN()) u = u.copy(start = t)
        if (u.release?.isNaN() == true) u = u.copy(release = t)
        if (u != c) cycle = u
        val end = end(u)
        if (end != null && t >= end) { finish(); return false }
        return true
    }
    suspend fun whenSettled() {
        val id = cycle?.id ?: return
        val d = CompletableDeferred<Unit>(); waiters.getOrPut(id) { mutableListOf() } += d
        val bound = AWCRippleAppearance.FADE + 50
        try {
            val t0 = withFrameNanos { it } / 1e6
            while (!d.isCompleted) { if (withFrameNanos { it } / 1e6 - t0 >= bound) break }
        } catch (e: IllegalStateException) { withTimeoutOrNull(bound.toLong()) { d.await() } }
    }
    fun end(c: Cycle): Double? = c.release?.takeIf { !it.isNaN() && !c.start.isNaN() }?.let { max(c.start + c.grow, it) + AWCRippleAppearance.FADE }
    fun frameTime(c: Cycle): Double = when (val f = frame) {
        is AWCRippleFrame.Grow -> c.start + f.ms
        AWCRippleFrame.Held -> c.start + max(0.0, c.grow)
        is AWCRippleFrame.Fade -> max(c.start + c.grow, c.release ?: (c.start + c.grow)) + f.ms
        null -> now
    }
    fun sample(c: Cycle, t: Double): Pair<Double, Double>? {
        if (c.start.isNaN()) return 0.0 to c.opacity
        val scale = if (c.grow <= 0 || t - c.start >= c.grow) 1.0 else c.easing.transform(((t - c.start) / c.grow).coerceIn(0.0, 1.0))
        val r = c.release?.takeIf { !it.isNaN() } ?: return scale to c.opacity
        val fadeStart = max(c.start + c.grow, r)
        if (t < fadeStart) return scale to c.opacity
        val f = (t - fadeStart) / AWCRippleAppearance.FADE
        if (f >= 1) return null
        return scale to c.opacity * (1 - AWCRippleEasing.Standard.transform(f))
    }
}

val LocalAWCRippleAppearance = staticCompositionLocalOf { AWCRippleAppearance() }
/** The native `--md-sys-ripple-enabled`: false suppresses new waves and hides a running one. */
val LocalAWCRippleEnabled = compositionLocalOf { true }
val LocalAWCRippleController = compositionLocalOf<AWCRippleController?> { null }
/** The host surface's corner radius an md-ripple node inherits for its clip. */
val LocalAWCRippleHostCornerRadius = compositionLocalOf { 0.dp }
/** The inherited content colour (currentColor) an md-ripple node paints when no colour hook is set. */
val LocalAWCRippleContentColor = compositionLocalOf<Color?> { null }
/** Test-only fixed render instant (see [AWCRippleFrame]). */
val LocalAWCRippleFrame = compositionLocalOf<AWCRippleFrame?> { null }

internal fun awcRippleHex(value: String?): Color? {
    val v = value?.trim() ?: return null
    if (!Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$").matches(v)) return null
    val rgb = v.substring(1, 7).toLong(16); val a = if (v.length == 9) v.substring(7, 9).toLong(16) else 255L
    return Color((a shl 24) or rgb)
}

/**
 * Decorates this surface with an md-ripple. The host's own gestures keep working (presses are observed in the initial
 * pass and never consumed); the wave starts at the physical press point, reaches the farthest corner of the host
 * rectangle grown by the extents, grows with the hook duration/easing at constant opacity, and fades 150 ms with the
 * standard curve once the press is released and growth is complete. A new press replaces the old wave; disabling,
 * losing window focus and leaving composition remove it immediately.
 */
fun Modifier.awcRipple(disabled: Boolean = false, cornerRadius: Dp = 0.dp, contentColor: Color? = null, controller: AWCRippleController? = null,
                       appearance: AWCRippleAppearance? = null, hidden: Boolean = false): Modifier = composed {
    val inherited = LocalAWCRippleAppearance.current
    val resolved = appearance?.let { inherited.merging(it) } ?: inherited
    val tokens = LocalAWCThemeTokens.current
    val enabled = LocalAWCRippleEnabled.current && tokens["--md-sys-ripple-enabled"]?.trim() != "0"
    val color = if (!resolved.color.isNullOrBlank()) awcRippleHex(resolved.color) ?: Color.Transparent
        else contentColor ?: LocalAWCRippleContentColor.current ?: awcRippleHex(tokens["--md-sys-color-on-surface"]) ?: Color(0xFF1C1B1F)
    val frame = LocalAWCRippleFrame.current
    val density = LocalDensity.current
    val shape = RoundedCornerShape(cornerRadius)
    val state = remember { AWCRippleState() }
    state.appearance = resolved; state.disabled = disabled; state.suppressed = !enabled; state.frame = frame
    SideEffect { controller?.state = state }
    DisposableEffect(state) { state.connected = true; onDispose { state.connected = false; state.finish() } }
    LaunchedEffect(disabled) { if (disabled) state.finish() }
    val focused = LocalWindowInfo.current.isWindowFocused
    LaunchedEffect(focused) { if (!focused) state.finish() }
    val cycleId = state.cycle?.id
    LaunchedEffect(cycleId, frame) {
        if (cycleId == null || frame != null) return@LaunchedEffect
        while (isActive && state.onFrame(withFrameNanos { it } / 1e6)) Unit
    }
    this.onSizeChanged { with(density) { state.size = Size(it.width.toDp().value, it.height.toDp().value) } }
        .pointerInput(state, shape) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                if (down.type == PointerType.Mouse && !currentEvent.buttons.isPrimaryPressed) return@awaitEachGesture
                // Presses outside the rounded host shape miss the host, as Chrome hit-tests the border radius.
                val outline = shape.createOutline(Size(size.width.toFloat(), size.height.toFloat()), androidx.compose.ui.unit.LayoutDirection.Ltr, this)
                val hit = when (outline) { is Outline.Rectangle -> outline.rect.contains(down.position); is Outline.Rounded -> outline.roundRect.contains(down.position); is Outline.Generic -> true }
                if (!hit) return@awaitEachGesture
                val started = state.press(down.position.x / density.density.toDouble(), down.position.y / density.density.toDouble())
                try {
                    while (true) {
                        val ev = awaitPointerEvent(PointerEventPass.Initial)
                        val ch = ev.changes.firstOrNull { it.id == down.id } ?: break
                        if (!ch.pressed) break
                    }
                } finally { if (started) state.release() }
            }
        }
        .drawWithContent {
            drawContent()
            val c = state.cycle ?: return@drawWithContent
            if (hidden || !enabled) return@drawWithContent
            val (scale, opacity) = state.sample(c, state.frameTime(c)) ?: return@drawWithContent
            val outline = shape.createOutline(size, layoutDirection, this)
            val path = Path().apply { when (outline) { is Outline.Rectangle -> addRect(outline.rect); is Outline.Rounded -> addRoundRect(outline.roundRect); is Outline.Generic -> addPath(outline.path) } }
            clipPath(path) {
                drawCircle(color.copy(alpha = color.alpha * opacity.toFloat()), (c.radius * scale * density.density).toFloat(),
                    Offset((c.x * density.density).toFloat(), (c.y * density.density).toFloat()))
            }
        }
}


/** An md-ripple node: fills the area its parent gives it with the inherited host radius and content colour. */
@Composable
internal fun NativeRippleNode(properties: Map<String, AWCValue>) {
    Box(Modifier.fillMaxSize().clearAndSetSemantics { }.awcRipple(disabled = properties["disabled"] == true, cornerRadius = LocalAWCRippleHostCornerRadius.current,
        controller = LocalAWCRippleController.current, hidden = properties["hidden"] == true))
}

/** Applies md-ripple hook values to descendant ripples (nearer values win, like the inherited custom properties). */
@Composable
fun AWCRippleAppearanceScope(appearance: AWCRippleAppearance, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCRippleAppearance provides LocalAWCRippleAppearance.current.merging(appearance), content = content)
}

/** Binds trigger() / whenSettled() to the md-ripple nodes below. */
@Composable
fun AWCRippleControllerScope(controller: AWCRippleController, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCRippleController provides controller, content = content)
}

/**
 * The Laboratory's md-ripple example: a token-styled button surface ("Tap to see the ripple": label-large text, 16 × 24
 * padding, 16 radius, on-surface on surface-container-highest) decorated with the md-ripple node's disabled/hidden
 * properties and the scoped controller. The Web recipe renders the same button.
 */
@Composable
fun AWCRippleExampleSurface(properties: Map<String, AWCValue> = emptyMap(), label: String = "Tap to see the ripple") {
    val tokens = LocalAWCThemeTokens.current
    val ink = awcRippleHex(tokens["--md-sys-color-on-surface"]) ?: Color(0xFF1C1B1F)
    val fill = awcRippleHex(tokens["--md-sys-color-surface-container-highest"]) ?: Color(0xFFE6E0E9)
    val shape = RoundedCornerShape(16.dp)
    val rtl = androidx.compose.ui.platform.LocalLayoutDirection.current == androidx.compose.ui.unit.LayoutDirection.Rtl
    Box(androidx.compose.ui.Modifier
        .inspectAWCNode(LocalAWCInspection.current, "", "md-ripple", AWCInspectionMetrics(display = "Compose Box", direction = if (rtl) "rtl" else "ltr"))
        .clip(shape).background(fill, shape)
        .semantics(mergeDescendants = true) { role = androidx.compose.ui.semantics.Role.Button }.focusable()
        .awcRipple(disabled = properties["disabled"] == true, cornerRadius = 16.dp, contentColor = ink, controller = LocalAWCRippleController.current, hidden = properties["hidden"] == true)
        .padding(horizontal = 24.dp, vertical = 16.dp)) {
        androidx.compose.material3.Text(label, color = ink, style = androidx.compose.ui.text.TextStyle(fontFamily = AccordionRoboto,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Medium, fontSize = androidx.compose.ui.unit.TextUnit(14f, androidx.compose.ui.unit.TextUnitType.Sp),
            lineHeight = androidx.compose.ui.unit.TextUnit(20f, androidx.compose.ui.unit.TextUnitType.Sp), letterSpacing = androidx.compose.ui.unit.TextUnit(0.1f, androidx.compose.ui.unit.TextUnitType.Sp),
            platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false),
            lineHeightStyle = androidx.compose.ui.text.style.LineHeightStyle(androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center, androidx.compose.ui.text.style.LineHeightStyle.Trim.None)))
    }
}
