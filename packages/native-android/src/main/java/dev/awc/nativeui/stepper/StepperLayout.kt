package dev.awc.nativeui.stepper

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// md-stepper / md-step geometry, paint and motion (md-stepper.css, md-step.css) as Chrome lays them out — lockstep with
// Swift's AWCStepperLayout: LayoutUnit (1/64 px) snapping, the panel-mode grid, the vertical rail, the mobile bar,
// density, hooks and RTL. Pure (CSS px): the Compose view draws it and the parity tests compare it with Chrome.

data class SRect(val x: Double = 0.0, val y: Double = 0.0, val width: Double = 0.0, val height: Double = 0.0) {
    val isEmpty get() = x == 0.0 && y == 0.0 && width == 0.0 && height == 0.0
    fun offset(dx: Double, dy: Double) = SRect(x + dx, y + dy, width, height)
    fun mirrored(w: Double) = SRect(w - x - width, y, width, height)
    companion object { val ZERO = SRect() }
}

data class SRGBA(val r: Double, val g: Double, val b: Double, val a: Double) { fun list() = listOf(r, g, b, a) }

fun stepperLU(v: Double) = floor(v * 64 + 1e-7) / 64
fun stepperLUCeil(v: Double) = ceil(v * 64 - 1e-7) / 64
/** LayoutUnit / 2 (truncating division of the raw value). */
fun stepperHalf(v: Double): Double { val raw = Math.round(v * 64).toDouble() / 2; return (if (raw < 0) ceil(raw) else floor(raw)) / 64 }

/** CSS colours: #rgb[a], #rrggbb[aa], rgb()/rgba(), color(srgb …). */
fun stepperColor(css: String): SRGBA? {
    val s = css.trim().lowercase()
    if (s == "transparent") return SRGBA(0.0, 0.0, 0.0, 0.0)
    if (s.startsWith("#")) {
        var h = s.drop(1)
        if (h.length == 3 || h.length == 4) h = h.map { "$it$it" }.joinToString("")
        if (h.length != 6 && h.length != 8) return null
        val v = h.toLongOrNull(16) ?: return null
        val rgb = if (h.length == 8) v shr 8 else v
        return SRGBA(((rgb shr 16) and 255) / 255.0, ((rgb shr 8) and 255) / 255.0, (rgb and 255) / 255.0, if (h.length == 8) (v and 255) / 255.0 else 1.0)
    }
    fun nums(body: String) = body.split(',', ' ', '/').filter { it.isNotEmpty() }
    if (s.startsWith("rgb")) {
        val o = s.indexOf('('); val c = s.lastIndexOf(')'); if (o < 0 || c < 0) return null
        val n = nums(s.substring(o + 1, c)); if (n.size < 3) return null
        fun ch(v: String) = if (v.endsWith("%")) (v.dropLast(1).toDoubleOrNull() ?: 0.0) / 100 else (v.toDoubleOrNull() ?: 0.0) / 255
        val a = if (n.size > 3) (if (n[3].endsWith("%")) (n[3].dropLast(1).toDoubleOrNull() ?: 100.0) / 100 else n[3].toDoubleOrNull() ?: 1.0) else 1.0
        return SRGBA(ch(n[0]), ch(n[1]), ch(n[2]), a)
    }
    if (s.startsWith("color(srgb")) {
        val c = s.lastIndexOf(')'); val n = nums(s.substring(10, c)); if (n.size < 3) return null
        return SRGBA(n[0].toDoubleOrNull() ?: 0.0, n[1].toDoubleOrNull() ?: 0.0, n[2].toDoubleOrNull() ?: 0.0, if (n.size > 3) n[3].toDoubleOrNull() ?: 1.0 else 1.0)
    }
    return null
}

fun stepperPx(raw: String?): Double? { var s = raw?.trim() ?: return null; if (s.endsWith("px")) s = s.dropLast(2); return s.toDoubleOrNull() }

/** CSS `cubic-bezier()` timing function. */
fun stepperBezier(x1: Double, y1: Double, x2: Double, y2: Double): (Double) -> Double {
    val cx = 3 * x1; val bx = 3 * (x2 - x1) - cx; val ax = 1 - cx - bx
    val cy = 3 * y1; val by = 3 * (y2 - y1) - cy; val ay = 1 - cy - by
    fun sx(t: Double) = ((ax * t + bx) * t + cx) * t
    fun sy(t: Double) = ((ay * t + by) * t + cy) * t
    fun dx(t: Double) = (3 * ax * t + 2 * bx) * t + cx
    fun solve(x: Double): Double {
        var t = x
        for (k in 0 until 8) { val e = sx(t) - x; if (abs(e) < 1e-7) return t; val d = dx(t); if (abs(d) < 1e-6) break; t -= e / d }
        var lo = 0.0; var hi = 1.0; t = x
        while (lo < hi) { val v = sx(t); if (abs(v - x) < 1e-7) return t; if (x > v) lo = t else hi = t; t = (lo + hi) / 2; if (hi - lo < 1e-9) break }
        return t
    }
    return { x -> if (x <= 0) 0.0 else if (x >= 1) 1.0 else sy(solve(x)) }
}

object StepperEasing {
    val effects = stepperBezier(0.34, 0.80, 0.34, 1.00)
    val spatial = stepperBezier(0.38, 1.21, 0.22, 1.00)
    val collapse = stepperBezier(0.3, 0.0, 0.8, 0.15)
    val linear: (Double) -> Double = { it.coerceIn(0.0, 1.0) }
}

/**
 * CSS transitions keyed by property (target change → transition from the current value; back to the running
 * transition's start → reversed with the shortened duration), discretely animated properties (visibility: the old
 * value through the delay and at progress 0) and the error pulse keyframes.
 */
class StepperMotion {
    private class Tr(val from: List<Double>, val to: List<Double>, val start: Double, val dur: Double, val ease: (Double) -> Double, val rev: List<Double>, val short: Double)
    private class Disc(val from: Boolean, val to: Boolean, val start: Double, val dur: Double, val delay: Double)
    private val run = HashMap<String, Tr>(); private val target = HashMap<String, List<Double>>()
    private val disc = HashMap<String, Disc>(); private val keyframes = HashMap<String, Pair<Double, Double>>()
    /** Every keyframe animation start (key, time), in order — the parity harness compares them with Chrome's animations. */
    val started = ArrayList<Pair<String, Double>>()
    private fun eased(t: Tr, now: Double) = if (t.dur <= 0) 1.0 else t.ease(((now - t.start) / t.dur).coerceIn(0.0, 1.0))
    private fun sample(t: Tr, now: Double): List<Double> { val e = eased(t, now); return t.from.zip(t.to) { a, b -> a + (b - a) * e } }
    fun animate(key: String, value: List<Double>, now: Double, duration: Double, ease: (Double) -> Double): List<Double> {
        val prev = target.put(key, value) ?: run { run.remove(key); return value }
        if (value != prev) {
            val r = run[key]
            val cur = r?.let { sample(it, now) } ?: prev
            if (cur == value) run.remove(key)
            else if (r != null && value == r.rev) {
                val f = min(1.0, abs(eased(r, now) * r.short + 1 - r.short))
                run[key] = Tr(cur, value, now, duration * f, ease, r.to, f)
            } else run[key] = Tr(cur, value, now, duration, ease, cur, 1.0)
        }
        return run[key]?.let { sample(it, now) } ?: value
    }
    fun discrete(key: String, value: Boolean, now: Double, duration: Double, delay: Double): Boolean {
        var r = disc[key] ?: run { disc[key] = Disc(value, value, now, 0.0, 0.0); return value }
        if (value != r.to) { r = Disc(discreteAt(r, now), value, now, duration, delay); disc[key] = r }
        return discreteAt(r, now)
    }
    private fun discreteAt(r: Disc, now: Double): Boolean { val dt = now - r.start; return if (dt < r.delay || (r.dur > 0 && dt - r.delay <= 0)) r.from else r.to }
    /** Start time of a keyframe animation while `on` (null when off); turning on again restarts it. */
    fun keyframe(key: String, on: Boolean, now: Double, duration: Double = 300.0): Double? {
        if (on) { if (key !in keyframes) { keyframes[key] = now to duration; started += key to now } } else keyframes.remove(key)
        return keyframes[key]?.first
    }
    fun running(key: String, now: Double) = run[key]?.let { now < it.start + it.dur } ?: false
    fun active(now: Double) = run.values.any { now < it.start + it.dur } || disc.values.any { now <= it.start + it.delay + it.dur } || keyframes.values.any { now < it.first + it.second }
    fun reset() { run.clear(); target.clear(); disc.clear(); keyframes.clear(); started.clear() }
}

/** md-step-glyph-in (500ms spring, spatial easing per keyframe interval, fill both): scale 0 → 1.18 (60%) → 1, opacity 0 → 1 (60%). */
fun stepperGlyphIn(dt: Double): Pair<Double, Double> {
    val x = (dt / 500).coerceIn(0.0, 1.0)
    if (x <= 0.6) { val e = StepperEasing.spatial(x / 0.6); return 1.18 * e to e.coerceIn(0.0, 1.0) }
    val e = StepperEasing.spatial((x - 0.6) / 0.4); return (1.18 - 0.18 * e) to 1.0
}
/** md-step-content-enter (a lazy panel's mount; expand duration, spatial easing): opacity 0 → 1, translateY(-6px) → 0. */
fun stepperContentEnter(dt: Double, duration: Double): Pair<Double, Double> {
    val e = StepperEasing.spatial(if (duration <= 0) 1.0 else (dt / duration).coerceIn(0.0, 1.0))
    return e.coerceIn(0.0, 1.0) to -6 * (1 - e)
}
/** md-step-enter (the step's mount; 300ms effects easing, `backwards` fill, delay index × 40ms): opacity 0 → 1. */
fun stepperEnter(dt: Double, delay: Double): Double = if (dt < delay) 0.0 else StepperEasing.effects(min(1.0, (dt - delay) / 300)).coerceIn(0.0, 1.0)

/** md-step-error-pulse: scale 1 → 1.08 (40%) → 1 over 300ms, effects easing per keyframe interval, fill both. */
fun stepperErrorPulse(dt: Double): Double {
    val x = (dt / 300).coerceIn(0.0, 1.0)
    return if (x <= 0.4) 1 + 0.08 * StepperEasing.effects(x / 0.4) else 1.08 - 0.08 * StepperEasing.effects((x - 0.4) / 0.6)
}

/** The `--md-step-*` hooks (inherited from the stepper) and `--md-stepper-gap`. */
data class StepperHooks(val values: Map<String, String> = emptyMap()) {
    fun step(k: String) = values["--md-step-$k"]?.takeIf { it.isNotEmpty() }
    fun px(k: String) = stepperPx(step(k))
    /** A CSS time hook (`350ms`, `0.35s`) in milliseconds. */
    fun ms(k: String): Double? {
        val v = step(k)?.trim()?.lowercase() ?: return null
        return if (v.endsWith("ms")) v.dropLast(2).toDoubleOrNull() else if (v.endsWith("s")) v.dropLast(1).toDoubleOrNull()?.times(1000) else null
    }
    val stepperGap get() = stepperPx(values["--md-stepper-gap"]) ?: 0.0
    /** A step's hooks: the stepper's, then the step's own inline `style` (nearer wins). */
    fun merging(style: String) = if (style.isEmpty()) this else StepperHooks(values + fromStyle(style).values)
    companion object {
        fun fromStyle(style: String) = StepperHooks(style.split(';').mapNotNull { d ->
            val kv = d.split(':', limit = 2).map { it.trim() }; if (kv.size == 2 && kv[0].startsWith("--")) kv[0] to kv[1] else null }.toMap())
    }
}

/** Tokens plus the density rung payload (tokens.css §12: the spacing tokens a rung re-declares). */
class StepperTheme(val tokens: Map<String, String>) {
    companion object {
        val rungs: Map<Int, Map<String, Double>> = mapOf(
            -2 to mapOf("inset-md" to 8.0, "inset-lg" to 12.0, "inset-xl" to 20.0, "gap-md" to 8.0, "gap-lg" to 12.0),
            -3 to mapOf("inset-sm" to 4.0, "inset-md" to 8.0, "inset-lg" to 12.0, "inset-xl" to 16.0, "gap-sm" to 4.0, "gap-md" to 8.0, "gap-lg" to 12.0),
            -4 to mapOf("inset-sm" to 4.0, "inset-md" to 8.0, "inset-lg" to 8.0, "inset-xl" to 16.0, "gap-xs" to 2.0, "gap-sm" to 4.0, "gap-md" to 4.0, "gap-lg" to 8.0),
        )
    }
    fun spacing(name: String, rung: Double, fallback: Double) = rungs[rung.toInt()]?.get(name) ?: stepperPx(tokens["--md-sys-spacing-$name"]) ?: fallback
    fun color(role: String, fallback: String) = stepperColor(tokens["--md-sys-color-$role"] ?: fallback) ?: stepperColor(fallback)!!
}

internal class StepperEnv(val s: Double, val theme: StepperTheme, val hooks: StepperHooks) {
    fun sp(name: String, d: Double) = theme.spacing(name, s, d)
    fun c(hook: String, role: String, d: String) = hooks.step(hook)?.let(::stepperColor) ?: theme.color(role, d)
}

fun stepperDensity(local: Double, inherited: Double) = if (local in listOf(-1.0, -2.0, -3.0, -4.0)) local else inherited

/** Text measurement: the CSS advance width of `text` in Roboto at size / CSS weight / letter spacing. */
fun interface StepperMeasure { fun width(text: String, size: Double, weight: Double, letterSpacing: Double): Double }

/** Pointer state the host tracks (the Web's :hover / :active on a header). */
data class StepperPointer(val hover: Int? = null, val pressed: Int? = null)

data class StepLine(val part: String, val rect: SRect, val color: SRGBA, val fontSize: Double, val lineHeight: Double, val weight: Double,
                    val text: String, val lines: Int, val italic: Boolean, val wrapped: List<String>)
data class StepConnector(val rect: SRect, val color: SRGBA, val fill: Double, val fillColor: SRGBA, val vertical: Boolean)
data class StepPanel(val rect: SRect, val opacity: Double, val visible: Boolean, val gridRows: Double?, val contentX: Double, val contentY: Double, val contentWidth: Double)

class StepPaint {
    var index = 0
    var hostRect = SRect.ZERO
    var inner = SRect.ZERO; var indicator = SRect.ZERO; var stateLayer = SRect.ZERO; var bubble = SRect.ZERO
    var indicatorOpacity = 1.0
    var focusRing: Pair<SRGBA, SRGBA>? = null
    var stateLayerVisible = true; var stateOpacity = 0.0; var stateColor = SRGBA(0.0, 0.0, 0.0, 0.0)
    var dot = false
    var bubbleColor = SRGBA(0.0, 0.0, 0.0, 0.0); var bubbleText: SRGBA? = null
    var scale = 1.0; var transformNone = true
    var halo: Pair<SRGBA, Double>? = null
    var number: String? = null; var glyph: String? = null; var glyphFilled = false
    /** md-step-glyph-in on the glyph (scale about the bubble centre, opacity); md-step-enter on the whole step (opacity). */
    var glyphScale = 1.0; var glyphOpacity = 1.0; var hostOpacity = 1.0
    /** md-step-content-enter on a lazy panel's content (opacity, translateY). */
    var contentOpacity = 1.0; var contentDY = 0.0
    var bubbleSize = 32.0; var glyphSize = 17.92; var bubbleFontSize = 14.0
    var text: SRect? = null; var textOpacity = 1.0
    var lines: List<StepLine> = emptyList()
    var connector: StepConnector? = null
    var hasLeadingConnector = false
    var panel: StepPanel? = null
    var actions: SRect? = null
    var disabled = false; var readonly = false
    var hasPanel = false; var renderPanel = false
}

class StepperPaint {
    var host = SRect.ZERO
    var list: SRect? = null; var content = SRect.ZERO
    var nav: SRect? = null; var mobileNav: SRect? = null; var mobileProgress: SRect? = null
    var navButtons: Pair<SRect, SRect>? = null
    var mobileDots: List<Triple<SRect, SRGBA, Double>> = emptyList()
    var mobileText: Triple<SRect, String, SRGBA>? = null
    var steps: List<StepPaint> = emptyList()
    var hideList = false
    var buttonDensity = 0.0
}

/** Inputs from the host and its children. */
data class StepperLayoutInput(
    val width: Double, val rtl: Boolean = false, val dark: Boolean = false, val globalDensity: Double = 0.0,
    /** Height of the `content` slot child (null: nothing slotted). */
    val slotHeight: Double? = null,
    val contentHeights: Map<Int, Double> = emptyMap(), val defaultContentHeight: Double = 0.0,
    /** Each rendered panel's natural inner height as the host measured it (overrides the computation). */
    val panelInnerHeights: Map<Int, Double> = emptyMap(),
    /** Viewport width for md-step.css `@media (max-width: 599px)` (the compact horizontal row). */
    val viewportWidth: Double = 1200.0,
    val tokens: Map<String, String> = emptyMap(), val hooks: StepperHooks = StepperHooks(),
    /** Widths of the built-in nav buttons (Back, Continue/Finish) when the host measured them; else md-button sm metrics. */
    val buttonWidths: Pair<Double, Double>? = null,
)

object StepperLayout {
    /** The width a step's panel content lays out at (known before its height): the full width in a horizontal stepper,
     *  the rail's remainder (inline start: 8 + indicator + ring + gap-md) in a vertical one. */
    fun contentWidth(m: StepperModel, input: StepperLayoutInput, i: Int): Double {
        if (m.p.orientation == "horizontal" || i >= m.count) return input.width
        val sd = stepperDensity(m.p.density, input.globalDensity)
        val e = StepperEnv(stepperDensity(m.steps[i].density, sd), StepperTheme(input.tokens), input.hooks.merging(m.steps[i].style))
        val ind = indicator(m, e, false, false)
        return max(0.0, input.width - (8 + ind.h + 2 * ind.ring + e.sp("gap-md", 12.0)))
    }
    fun buttonHeight(s: Double) = max(24.0, 40 + 4 * s)
    /** md-button size sm: min-width max(40, 58 + 4s), padding-inline max(8, 16 + s), label-large 14 (+.5s, floor 12), letter-spacing .1. */
    fun buttonWidth(label: String, s: Double, measure: StepperMeasure): Double {
        val fs = max(12.0, 14 + 0.5 * s)
        return max(max(40.0, 58 + 4 * s), stepperLUCeil(measure.width(label, fs, 500.0, 0.1)) + 2 * max(8.0, 16 + s))
    }

    private class TextItem(val part: String, val w: Double, val h: Double, val fs: Double, val lh: Double, val weight: Double, val text: String, val lines: Int, val wrapped: List<String>)
    private class TextM(val w: Double, val h: Double, val items: List<TextItem>)

    private fun wrap(text: String, fs: Double, weight: Double, avail: Double, measure: StepperMeasure): List<String> {
        val lines = ArrayList<String>(); var cur = ""
        for (w in text.split(" ")) {
            val cand = if (cur.isEmpty()) w else "$cur $w"
            if (cur.isNotEmpty() && stepperLUCeil(measure.width(cand, fs, weight, 0.0)) > avail + 1e-9) { lines += cur; cur = w } else cur = cand
        }
        if (cur.isNotEmpty()) lines += cur
        return lines
    }

    private fun textMetrics(m: StepperModel, i: Int, e: StepperEnv, avail: Double, horizontal: Boolean, compact: Boolean, measure: StepperMeasure): TextM? {
        val s = m.steps[i]
        var labFs = max(11.0, 14 + 0.5 * e.s); var labLh = max(16.0, 20 + e.s)
        if (compact && horizontal) { labFs = 12.0; labLh = 16.0 }
        val capFs = max(10.0, 12 + 0.5 * e.s); val capLh = max(14.0, 16 + 0.5 * e.s)
        val weight = if (m.isActive(i)) 600.0 else 500.0
        val fontWeight = if (weight > 500) 700.0 else 500.0
        val supporting = if (s.error && s.errorText.isNotEmpty()) s.errorText else s.description
        val opt = if (s.optional) m.p.optionalWord else ""
        val items = ArrayList<TextItem>()
        if (s.label.isNotEmpty()) {
            var w = stepperLUCeil(measure.width(s.label, labFs, fontWeight, 0.0)); var lines = 1; var wrapped = listOf(s.label)
            if (w > avail) {
                val ls = wrap(s.label, labFs, fontWeight, avail, measure); lines = if (horizontal) min(2, ls.size) else ls.size; w = avail
                val keep = ls.take(lines).toMutableList(); if (ls.size > lines && keep.isNotEmpty()) keep[keep.size - 1] = keep.last() + "…"; wrapped = keep
            }
            items += TextItem("label", w, lines * labLh, labFs, labLh, weight, s.label, lines, wrapped)
        }
        val captions = !(compact && horizontal)
        if (opt.isNotEmpty() && captions) { val w = stepperLUCeil(measure.width(opt, capFs, 400.0, 0.0)); items += TextItem("optional", min(w, avail), capLh, capFs, capLh, 400.0, opt, 1, listOf(opt)) }
        if (supporting.isNotEmpty() && captions) {
            var w = stepperLUCeil(measure.width(supporting, capFs, 400.0, 0.0)); var lines = 1; var wrapped = listOf(supporting)
            if (w > avail) { wrapped = wrap(supporting, capFs, 400.0, avail, measure); lines = wrapped.size; w = avail }
            items += TextItem("description", w, lines * capLh, capFs, capLh, 400.0, supporting, lines, wrapped)
        }
        if (items.isEmpty()) return null
        return TextM(items.maxOf { it.w }, items.sumOf { it.h } + 2.0 * (items.size - 1), items)
    }

    private class Visual(val bg: SRGBA, val fg: SRGBA?, val scale: Double, val transformNone: Boolean, val halo: Pair<SRGBA, Double>?,
                         val label: SRGBA, val optional: SRGBA, val description: SRGBA, val state: Double, val stateColor: SRGBA,
                         val connector: SRGBA, val filled: SRGBA, val fill: Double, val panel: Double, val panelVisible: Boolean, val panelOpacity: Double,
                         val glyphScale: Double = 1.0, val glyphOpacity: Double = 1.0, val hostOpacity: Double = 1.0, val contentOpacity: Double = 1.0, val contentDY: Double = 0.0)

    private fun resolve(m: StepperModel, i: Int, e: StepperEnv, pointer: StepperPointer, motion: StepperMotion?, now: Double, reduced: Boolean): Visual {
        val s = m.steps[i]; val dot = m.p.indicator == "dot"; val active = m.isActive(i)
        fun anim(k: String, v: List<Double>, dur: Double, ease: (Double) -> Double) = motion?.animate("s$i.$k", v, now, if (reduced) 0.01 else dur, ease) ?: v
        fun back(v: List<Double>) = SRGBA(v[0], v[1], v[2], v[3])
        val pending = e.hooks.step("indicator-color")?.let(::stepperColor) ?: if (dot) e.theme.color("outline", "#79747E") else e.theme.color("surface-container-highest", "#E6E0E9")
        var bg = pending; var fg = e.c("indicator-text", "on-surface-variant", "#49454F")
        if (active) { bg = e.c("active-color", "primary", "#6750A4"); fg = e.c("active-text", "on-primary", "#FFFFFF") }
        if (s.completed) { bg = e.c("completed-color", "primary", "#6750A4"); fg = e.c("completed-text", "on-primary", "#FFFFFF") }
        if (s.error) { bg = e.c("error-color", "error", "#B3261E"); fg = e.c("error-text", "on-error", "#FFFFFF") }
        val bgNow = back(anim("bg", bg.list(), 200.0, StepperEasing.effects))
        val fgNow = if (dot) null else back(anim("fg", fg.list(), 200.0, StepperEasing.effects))
        val base = if (active && !reduced) (if (dot) 1.4 else 1.12) else 1.0
        val sc = anim("scale", listOf(base), 500.0, StepperEasing.spatial)[0]
        var pulse: Double? = null
        if (!dot && s.error && !reduced) pulse = if (motion != null) stepperErrorPulse(now - (motion.keyframe("s$i.pulse", true, now) ?: now)) else 1.0
        else motion?.keyframe("s$i.pulse", false, now)
        val running = motion?.running("s$i.scale", now) ?: false
        val transformNone = pulse == null && base == 1.0 && abs(sc - 1) < 1e-12 && !running
        val haloColor = e.c("active-halo-color", "primary", "#6750A4")
        val pct = if (reduced) 0.25 else if (dot) 0.18 else 0.14
        val h = anim("halo", if (active) listOf(haloColor.a * pct, 3.0) else listOf(0.0, 0.0), 500.0, StepperEasing.spatial)
        var label = e.c("label-color", "on-surface-variant", "#49454F")
        if (active) label = e.c("label-active-color", "on-surface", "#1C1B1F")
        if (s.error) label = e.c("error-color", "error", "#B3261E")
        val optional = e.c("description-color", "on-surface-variant", "#49454F")
        // :active (.12) > :hover (.08) > :focus-visible (.12) by specificity; hover / active skip aria-disabled headers.
        // A disabled or readonly state layer is display:none: its computed opacity switches without a transition.
        val dis = m.effectivelyDisabled(i); val ro = m.p.readonly
        val sl = if (!dis && pointer.pressed == i) 0.12 else if (!dis && pointer.hover == i) 0.08 else if (m.focusVisible == i) 0.12 else 0.0
        val state = if (dis || ro) sl else anim("state", listOf(sl), 200.0, StepperEasing.effects)[0]
        // --md-step-connector-duration / -expand-duration / -collapse-duration (350 / 500 / 200ms).
        val fillDur = e.hooks.ms("connector-duration") ?: 350.0; val expandDur = e.hooks.ms("expand-duration") ?: 500.0; val collapseDur = e.hooks.ms("collapse-duration") ?: 200.0
        val fill = anim("fill", listOf(if (i < m.active) 1.0 else 0.0), fillDur, StepperEasing.linear)[0]
        val open = active
        val frac = if (m.p.lazy) (if (open) 1.0 else 0.0) else anim("panel", listOf(if (open) 1.0 else 0.0), if (open) expandDur else collapseDur, if (open) StepperEasing.spatial else StepperEasing.collapse)[0]
        var visible = open
        if (!m.p.lazy && motion != null) visible = if (reduced) motion.discrete("s$i.vis", open, now, 0.01, 0.0) else motion.discrete("s$i.vis", open, now, 0.0, if (open) 0.0 else collapseDur)
        // Keyframe animations (none under reduced motion): the glyph span scales in when it shows with the completed / error
        // class; a lazy panel's content fades and slides in on mount; the step itself fades in on mount (index × 40ms).
        var glyphScale = 1.0; var glyphOpacity = 1.0; var hostOpacity = 1.0; var contentOpacity = 1.0; var contentDY = 0.0
        if (motion != null) {
            motion.keyframe("s$i.glyph", !reduced && !dot && (s.completed || s.error) && m.glyph(i) != null, now, 500.0)?.let { t -> stepperGlyphIn(now - t).let { glyphScale = it.first; glyphOpacity = it.second } }
            motion.keyframe("s$i.content", !reduced && m.p.lazy && m.renderPanel(i), now, expandDur)?.let { t -> stepperContentEnter(now - t, expandDur).let { contentOpacity = it.first; contentDY = it.second } }
            motion.keyframe("s$i.mount", !reduced, now, 300.0 + 40 * i)?.let { t -> hostOpacity = stepperEnter(now - t, 40.0 * i) }
        }
        val popacity = if (m.p.lazy) 1.0 else anim("popacity", listOf(if (open) 1.0 else 0.0), if (open) 200.0 else collapseDur, if (open) StepperEasing.effects else StepperEasing.collapse)[0]
        return Visual(bgNow, fgNow, pulse ?: sc, transformNone, if (h[0] > 0 || h[1] > 0) SRGBA(haloColor.r, haloColor.g, haloColor.b, h[0]) to h[1] else null,
            back(anim("label", label.list(), 200.0, StepperEasing.effects)), optional, if (s.error) e.c("error-color", "error", "#B3261E") else optional,
            state, e.c("state-layer-color", "on-surface", "#1C1B1F"), e.c("connector-color", "outline-variant", "#CAC4D0"),
            e.c("connector-filled-color", "primary", "#6750A4"), fill, frac.coerceIn(0.0, 1.0), visible, popacity,
            glyphScale, glyphOpacity, hostOpacity, contentOpacity, contentDY)
    }

    private class Ind(val size: Double, val h: Double, val ring: Double)
    private fun indicator(m: StepperModel, e: StepperEnv, compact: Boolean, horizontal: Boolean): Ind {
        val dot = m.p.indicator == "dot"
        val size = e.hooks.px("indicator-size") ?: if (compact && horizontal) 28.0 else max(24.0, 32 + 2 * e.s)
        return Ind(size, if (dot) 10.0 else size, e.hooks.px("indicator-ring") ?: max(4.0, 8 + e.s))
    }

    private class Header(val inner: SRect, val pad: Double, val pin: Double, val gap: Double, val indw: Double, val ind: Ind, val text: TextM?)
    private fun header(m: StepperModel, i: Int, e: StepperEnv, colw: Double, compact: Boolean, measure: StepperMeasure): Header {
        val ind = indicator(m, e, compact, true)
        val pad = max(0.0, 4 + e.s); val pin = if (compact) e.sp("inset-xs", 4.0) else e.sp("inset-sm", 8.0)
        val gap = if (compact) e.sp("gap-xs", 4.0) else max(2.0, 6 + e.s); val indw = ind.h + 2 * ind.ring
        val tm = textMetrics(m, i, e, colw - 2 * pin, true, compact, measure)
        val cw = max(indw, tm?.w ?: 0.0)
        val iw = min(colw, cw + 2 * pin); val ih = pad + indw + (tm?.let { gap + it.h } ?: 0.0)
        return Header(SRect(stepperHalf(colw - iw), 0.0, iw, ih), pad, pin, gap, indw, ind, tm)
    }

    private fun parts(m: StepperModel, i: Int, e: StepperEnv, v: Visual, inner: SRect, ind: SRect, ih: Ind, textX: Double, textY: Double, tm: TextM?, horizontal: Boolean): StepPaint {
        val p = StepPaint(); p.index = i
        val dis = m.effectivelyDisabled(i); val ro = m.p.readonly
        p.disabled = dis; p.readonly = ro; p.hasPanel = m.hasPanel(i); p.renderPanel = m.renderPanel(i)
        p.inner = inner; p.indicator = ind; p.indicatorOpacity = if (dis) 0.38 else 1.0
        if (m.focusVisible == i && !ro) p.focusRing = e.theme.color("surface", "#FEF7FF") to e.theme.color("secondary", "#625B71")
        p.stateLayerVisible = !(dis || ro); p.stateLayer = if (p.stateLayerVisible) ind else SRect.ZERO
        p.stateOpacity = v.state; p.stateColor = v.stateColor
        p.dot = m.p.indicator == "dot"
        val h = ih.h
        val bx = ind.x + stepperHalf(ind.width - h); val by = ind.y + stepperHalf(ind.height - h)
        p.scale = v.scale; p.transformNone = v.transformNone
        p.glyphScale = v.glyphScale; p.glyphOpacity = v.glyphOpacity; p.hostOpacity = v.hostOpacity
        p.contentOpacity = v.contentOpacity; p.contentDY = v.contentDY
        p.bubble = SRect(bx + h / 2 - h * v.scale / 2, by + h / 2 - h * v.scale / 2, h * v.scale, h * v.scale)
        p.bubbleSize = h; p.glyphSize = ih.size * 0.56
        p.bubbleColor = v.bg; p.bubbleText = v.fg; p.halo = v.halo
        val g = m.glyph(i)
        p.glyph = g; p.number = if (p.dot || g != null) null else (i + 1).toString()
        p.glyphFilled = m.isActive(i) || m.steps[i].completed || m.steps[i].error
        if (tm != null) {
            p.text = SRect(textX, textY, tm.w, tm.h); p.textOpacity = if (dis) 0.38 else 1.0
            var y = textY; val lines = ArrayList<StepLine>()
            for (it in tm.items) {
                val w = if (horizontal) it.w else tm.w
                val x = textX + if (horizontal) stepperHalf(tm.w - w) else 0.0
                val color = when (it.part) { "label" -> v.label; "optional" -> v.optional; else -> v.description }
                lines += StepLine(it.part, SRect(x, y, w, it.h), color, it.fs, it.lh, it.weight, it.text, it.lines, it.part == "optional", it.wrapped)
                y += it.h + 2
            }
            p.lines = lines
        }
        return p
    }

    fun layout(m: StepperModel, input: StepperLayoutInput, measure: StepperMeasure, motion: StepperMotion? = null, now: Double = 0.0,
               reduced: Boolean = false, pointer: StepperPointer = StepperPointer()): StepperPaint {
        val p = m.p; val n = m.count; val W = input.width
        val sd = stepperDensity(p.density, input.globalDensity)
        val theme = StepperTheme(input.tokens)
        val senv = StepperEnv(sd, theme, input.hooks)
        val horizontal = p.orientation == "horizontal"; val mobile = p.variant == "mobile"
        val compact = input.viewportWidth < 600
        // `:host(.md-stepper--mobile) .md-stepper__list { display: none }` loses to the panel-mode grid rule: a mobile
        // stepper whose steps carry content still shows its header row.
        val hideList = mobile && !(horizontal && m.panelMode == "step")
        val envs = m.steps.map { StepperEnv(stepperDensity(it.density, sd), theme, input.hooks.merging(it.style)) }
        val vis = (0 until n).map { resolve(m, it, envs[it], pointer, motion, now, reduced) }
        val out = StepperPaint(); out.hideList = hideList; out.buttonDensity = sd
        fun contentH(i: Int) = if (m.steps[i].hasContent) input.contentHeights[i] ?: input.defaultContentHeight else 0.0
        fun panelInner(i: Int, horizontalMode: Boolean): Double {
            input.panelInnerHeights[i]?.let { return it }
            val e = envs[i]
            if (horizontalMode) return (e.hooks.px("panel-padding-block-start") ?: e.sp("inset-lg", 16.0)) + contentH(i) + e.sp("inset-lg", 16.0)
            return e.sp("inset-xs", 4.0) + contentH(i) + (if (m.navActions(i)) e.sp("gap-lg", 16.0) + buttonHeight(e.s) else 0.0) + e.sp("inset-lg", 16.0)
        }
        val steps = ArrayList<StepPaint>()
        var listH = 0.0
        if (hideList || horizontal) {
            val xs = (0..max(n, 0)).map { k -> if (n == 0) 0.0 else stepperLU(W * k / n) }
            val cols = (0 until n).map { xs[it + 1] - xs[it] }
            val hds = (0 until n).map { header(m, it, envs[it], if (hideList) W else cols[it], compact, measure) }
            val row1 = hds.maxOfOrNull { it.inner.height } ?: 0.0
            for (i in 0 until n) {
                val hd = hds[i]; val colx = if (hideList) 0.0 else xs[i]; val colw = if (hideList) W else cols[i]; val e = envs[i]
                val inner = hd.inner.offset(colx, 0.0)
                val ind = SRect(inner.x + stepperHalf(inner.width - hd.indw), inner.y + hd.pad, hd.indw, hd.indw)
                val tx = inner.x + hd.pin + (hd.text?.let { stepperHalf(inner.width - 2 * hd.pin - it.w) } ?: 0.0)
                val sp = parts(m, i, e, vis[i], inner, ind, hd.ind, tx, ind.y + hd.indw + hd.gap, hd.text, true)
                if (!m.isLast(i)) {
                    val th = e.hooks.px("connector-thickness") ?: max(2.0, 4 + 0.5 * e.s)
                    val gap = if (compact) 8.0 else max(4.0, 10 + e.s)
                    val top = hd.pad + hd.ind.ring + hd.ind.h / 2
                    sp.connector = StepConnector(SRect(colx + stepperLU(colw / 2) + hd.ind.h / 2 + gap, top - th / 2, colw - hd.ind.h - 2 * gap, th), vis[i].connector, vis[i].fill, vis[i].filled, false)
                }
                sp.hostRect = if (m.panelMode == "step" && m.hasPanel(i)) SRect.ZERO else SRect(colx, 0.0, colw, hd.inner.height)
                steps += sp
            }
            if (hideList) {
                for (sp in steps) {
                    // No box (display: none list): every rect is empty and the transform resolves to none.
                    sp.hostRect = SRect.ZERO; sp.inner = SRect.ZERO; sp.indicator = SRect.ZERO; sp.stateLayer = SRect.ZERO; sp.bubble = SRect.ZERO
                    sp.text = sp.text?.let { SRect.ZERO }; sp.lines = sp.lines.map { it.copy(rect = SRect.ZERO) }
                    sp.connector = sp.connector?.copy(rect = SRect.ZERO); sp.scale = 1.0; sp.transformNone = true
                }
            } else if (m.panelMode == "step") {
                var row2 = 0.0
                for (i in 0 until n) if (m.renderPanel(i)) {
                    val e = envs[i]; val h = stepperLU(panelInner(i, true) * vis[i].panel)
                    row2 = max(row2, h)
                    val top = e.hooks.px("panel-padding-block-start") ?: e.sp("inset-lg", 16.0)
                    steps[i].panel = StepPanel(SRect(0.0, row1, W, h), vis[i].panelOpacity, vis[i].panelVisible, if (m.p.lazy) null else h, 0.0, row1 + top, W)
                }
                listH = row1 + row2
            } else listH = row1
        } else {
            var y = 0.0
            for (i in 0 until n) {
                val e = envs[i]; val v = vis[i]
                val ind = indicator(m, e, false, false)
                val indw = ind.h + 2 * ind.ring; val gap = e.sp("gap-md", 12.0)
                val tm = textMetrics(m, i, e, W - 8 - indw - gap, false, false, measure)
                val ih = max(indw, tm?.h ?: 0.0); val iw = 8 + indw + (tm?.let { gap + it.w } ?: 0.0)
                val inner = SRect(0.0, y, iw, ih)
                val indR = SRect(8.0, y + stepperHalf(ih - indw), indw, indw)
                val sp = parts(m, i, e, v, inner, indR, ind, 8 + indw + gap, y + (tm?.let { stepperHalf(ih - it.h) } ?: 0.0), tm, false)
                val pb = if (m.isLast(i)) 0.0 else e.sp("inset-lg", 16.0)
                val ms = 8 + ind.h + 2 * ind.ring + gap
                val panelH = if (m.renderPanel(i)) stepperLU(panelInner(i, false) * v.panel) else 0.0
                val hostH = ih + panelH + pb
                sp.hasLeadingConnector = i > 0
                if (!m.isLast(i)) {
                    val th = e.hooks.px("connector-thickness") ?: max(2.0, 4 + 0.5 * e.s)
                    val top = ind.ring + ind.h + 6; val bottom = 6 - ind.ring
                    sp.connector = StepConnector(SRect(8 + ind.ring + (ind.h - th) / 2, y + top, th, hostH - top - bottom), v.connector, v.fill, v.filled, true)
                }
                if (m.renderPanel(i)) {
                    val cr = SRect(ms, y + ih, W - ms, panelH)
                    sp.panel = StepPanel(cr, v.panelOpacity, v.panelVisible, if (m.p.lazy) null else panelH, ms, cr.y + e.sp("inset-xs", 4.0), W - ms)
                    if (m.navActions(i)) sp.actions = SRect(ms, cr.y + e.sp("inset-xs", 4.0) + contentH(i) + e.sp("gap-lg", 16.0), W - ms, buttonHeight(e.s))
                }
                sp.hostRect = SRect(0.0, y, W, hostH)
                steps += sp
                y += hostH + (if (i < n - 1) input.hooks.stepperGap else 0.0)
            }
            listH = y
        }
        var hostOff = 0.0
        out.list = if (hideList) null else SRect(0.0, 0.0, W, listH)
        var cy = if (hideList) 0.0 else listH
        val slot = input.slotHeight
        if (slot != null) {
            val mg = senv.sp("inset-xl", 24.0)
            if (hideList) { hostOff = mg; out.content = SRect(0.0, 0.0, W, slot) }    // the margin collapses through the host
            else out.content = SRect(0.0, cy + mg, W, slot)
            cy = out.content.y + slot
        } else out.content = SRect(0.0, cy, W, 0.0)
        val bh = buttonHeight(sd)
        val backW = input.buttonWidths?.first ?: buttonWidth(p.backLabel, sd, measure)
        val nextW = input.buttonWidths?.second ?: buttonWidth(if (m.isFinishStep) p.finishLabel else p.nextLabel, sd, measure)
        if (p.nav && !mobile && horizontal && n > 0) {
            val ny = cy + max(4.0, 20 + 2 * sd)
            out.nav = SRect(0.0, ny, W, bh)
            val g = senv.sp("gap-sm", 8.0)
            out.navButtons = SRect(W - nextW - g - backW, ny, backW, bh) to SRect(W - nextW, ny, nextW, bh)
            cy = ny + bh
        }
        if (p.nav && mobile && n > 0) {
            val my = cy + senv.sp("gap-lg", 16.0); val g = senv.sp("gap-sm", 8.0)
            out.mobileNav = SRect(0.0, my, W, bh)
            val ph = if (p.indicator == "dot") 8.0 else 20.0
            val prog = SRect(backW + g, my + stepperHalf(bh - ph), W - backW - nextW - 2 * g, ph)
            out.mobileProgress = prog
            out.navButtons = SRect(0.0, my, backW, bh) to SRect(W - nextW, my, nextW, bh)
            if (p.indicator == "dot") {
                val total = n * 8.0 + max(0, n - 1) * g
                var x = prog.x + stepperHalf(prog.width - total)
                val dots = ArrayList<Triple<SRect, SRGBA, Double>>()
                for (i in 0 until n) {
                    val activeDot = i == m.active; val done = i < m.active || m.steps[i].completed
                    val color = if (activeDot || done) input.hooks.step("active-color")?.let(::stepperColor) ?: theme.color("primary", "#6750A4")
                                else input.hooks.step("connector-color")?.let(::stepperColor) ?: theme.color("outline", "#79747E")
                    var c = color.list(); var sc = if (activeDot && !reduced) 1.5 else 1.0
                    if (motion != null) { c = motion.animate("dot$i.bg", c, now, if (reduced) 0.01 else 200.0, StepperEasing.effects)
                                          sc = motion.animate("dot$i.scale", listOf(sc), now, if (reduced) 0.01 else 500.0, StepperEasing.spatial)[0] }
                    dots += Triple(SRect(x, prog.y, 8.0, 8.0), SRGBA(c[0], c[1], c[2], c[3]), sc)
                    x += 8 + g
                }
                out.mobileDots = dots
            } else {
                val t = "${p.stepWord} ${m.active + 1} ${p.ofWord} $n"
                val tw = stepperLUCeil(measure.width(t, 14.0, 500.0, 0.0))
                out.mobileText = Triple(SRect(prog.x + stepperHalf(prog.width - tw), prog.y, tw, 20.0), t, theme.color("on-surface-variant", "#49454F"))
            }
            cy = my + bh
        }
        out.host = SRect(0.0, hostOff, W, cy)
        fun fix(r: SRect) = if (r.isEmpty) r else (if (input.rtl) r.mirrored(W) else r).offset(0.0, hostOff)
        out.list = out.list?.let(::fix); out.content = fix(out.content); out.nav = out.nav?.let(::fix)
        out.mobileNav = out.mobileNav?.let(::fix); out.mobileProgress = out.mobileProgress?.let(::fix)
        out.navButtons = out.navButtons?.let { fix(it.first) to fix(it.second) }
        out.mobileDots = out.mobileDots.map { Triple(fix(it.first), it.second, it.third) }
        out.mobileText = out.mobileText?.let { Triple(fix(it.first), it.second, it.third) }
        for (s in steps) {
            s.hostRect = fix(s.hostRect); s.inner = fix(s.inner); s.indicator = fix(s.indicator); s.stateLayer = fix(s.stateLayer); s.bubble = fix(s.bubble)
            s.text = s.text?.let(::fix); s.lines = s.lines.map { it.copy(rect = fix(it.rect)) }
            s.connector = s.connector?.let { it.copy(rect = fix(it.rect)) }
            s.panel = s.panel?.let { pn ->
                val ox = if (input.rtl) W - pn.contentX - pn.contentWidth else pn.contentX
                pn.copy(rect = fix(pn.rect), contentX = ox, contentY = pn.contentY + hostOff)
            }
            s.actions = s.actions?.let(::fix)
        }
        out.steps = steps
        return out
    }
}
