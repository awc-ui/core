// fa (2026-10-29): from n5's generated md-slider / md-rating harness, decoupled from the chart port.
package dev.awc.playground.sr

import dev.awc.nativeui.rating.*
import dev.awc.nativeui.slider.srJsNumberString
import java.io.File
import kotlin.math.abs

class RatingReplay(val c: Map<String, Any?>, val reduced: Boolean = false) {
    var props = RatingProps(); var initialValue = 0.0; var densityProp: Int? = null
    val name = c["name"] as String
    val phases: List<Map<String, Any?>> = c["phases"].cast()
    val r = RatingInteraction()
    val events = mutableListOf<Pair<Int, RatingEvent>>()
    var phaseIdx = 0
    var hoverItem = -1
    val diffs = mutableListOf<String>()
    fun d(m: String) { if (diffs.size < 40) diffs.add(m) }
    var showLabel = false
    var pressedItem = -1
    val ripples = mutableListOf<RatingRipple>()
    var pendingRipple: Pair<Int, Double>? = null
    /** A tap's :active (the synthesized mousedown) is held at least 150 ms (kMinimumActiveInterval), then drops to :hover. */
    var touchRelease = false
    var pendingPress = -1
    val motion = dev.awc.nativeui.slider.SliderMotion(reducedMotion = reduced)
    val anims: List<Map<String, Any?>> = (c["anims"] as List<Map<String, Any?>>?) ?: emptyList()
    lateinit var size: String; lateinit var icon: String; lateinit var styleHooks: RatingHooks
    init {
        val html = c["html"] as String
        val a = html.substring(html.indexOf("<md-rating"), html.indexOf('>', html.indexOf("<md-rating")))
        fun attr(n: String): String? = Regex("""\s$n(?:="([^"]*)")?(?=[\s>]|$)""").find(a)?.let { it.groups[1]?.value ?: "" }
        props = RatingProps(attr("value")?.toDouble() ?: 0.0, attr("default-value")?.toDouble() ?: 0.0, attr("max")?.toInt() ?: 5,
            attr("precision")?.toDouble() ?: 1.0, attr("readonly") != null, attr("disabled") != null, attr("soft-disabled") != null,
            attr("hover") ?: "preview", c["dir"] == "rtl")
        showLabel = attr("show-value-label") != null
        size = attr("size") ?: "md"; icon = attr("icon") ?: "star"; styleHooks = ratingHooks(attr("style") ?: ""); densityProp = attr("density")?.toIntOrNull()
        r.onEvent = { events.add(phaseIdx to it) }
        r.onPropWrite = { v -> props = props.copy(value = v) }
        r.sync(props)
        initialValue = r.value   // componentWillLoad: the validated initial value
    }
    fun setProp(spec: String) {
        val name = spec.substringBefore('='); val v = srParseJson(spec.substringAfter('='))
        val n = (v as? Number)?.toDouble(); val b = v as? Boolean; val t = v as? String
        when (name) {
            "value" -> props = props.copy(value = n ?: 0.0); "defaultValue" -> props = props.copy(defaultValue = n ?: 0.0)
            "max" -> props = props.copy(max = (n ?: 5.0).toInt()); "precision" -> props = props.copy(precision = n ?: 1.0)
            "readonly" -> props = props.copy(readonly = b ?: false); "disabled" -> props = props.copy(disabled = b ?: false)
            "softDisabled" -> props = props.copy(softDisabled = b ?: false); "hover" -> props = props.copy(hover = t ?: "preview")
            "size" -> size = t ?: "md"; "density" -> densityProp = n?.toInt(); "showValueLabel" -> showLabel = b ?: false; "icon" -> icon = t ?: "star"
            else -> d("unknown prop $name")
        }
        r.sync(props)
        // A state that removes focusability takes the focus away (the readonly host loses its tabindex).
        if (r.focused && !r.focusable) r.blur()
    }
    fun step(label: String) {
        if (label.startsWith("prop:")) { setProp(label.removePrefix("prop:")); return }
        if (label == "form-reset") { props = props.copy(value = initialValue); r.sync(props); return }
        if (label == "method:focusRating") { if (r.focusable) r.focus(keyboard = false); return }   // script focus: no ring until a key
        Regex("""^touch-(down|up)-(\d+)@(\d+)$""").find(label)?.let { t ->
            // Trusted touch (Chrome): pointerdown runs the ripple; the synthesized mouse events after the lift focus the rating
            // without :focus-visible, click, and leave the tapped item :hover — no mdHover (no pointermove), no :active.
            val i = t.groupValues[2].toInt() - 1; val f = t.groupValues[3].toDouble() / 100; val fx = if (r.rtl) 1 - f else f
            if (t.groupValues[1] == "down") pendingRipple = i to fx * 100                    // ripple only: no :active, no focus yet
            else { r.tap(i, fx); hoverItem = i; if (r.isInteractive) { pressedItem = i; touchRelease = true } }   // focus (no ring), click; :active (a live state layer only), then :hover
            return
        }
        val m = Regex("""^(move|down|up)-(\d+)@(\d+)$""").find(label)
        when {
            label == "arm" -> {}
            label == "leave" -> { if (hoverItem >= 0) r.pointerLeave(); hoverItem = -1; pressedItem = -1 }
            label == "tab-in" -> { if (r.focused) r.blur(); if (r.focusable) r.focus(keyboard = true) }
            label == "key-Tab" -> if (r.focused) r.blur()
            label.startsWith("key-") -> if (r.focused) r.keyDown(label.removePrefix("key-"))
            m != null -> {
                val i = m.groupValues[2].toInt() - 1; val f = m.groupValues[3].toDouble() / 100
                // The page measures the fraction from the inline-start edge; the component from the left.
                val fx = if (r.rtl) 1 - f else f
                hoverItem = i
                when (m.groupValues[1]) {
                    "move" -> r.pointerMove(i, fx)
                    "down" -> { r.pointerMove(i, fx); r.pointerDown(); pendingPress = i; pendingRipple = i to fx * 100 }
                    "up" -> { r.pointerMove(i, fx); r.click(i, fx); pressedItem = -1 }
                }
            }
            else -> d("unknown step $label")
        }
    }
    fun run(): List<String> {
        for ((i, p) in phases.withIndex()) { phaseIdx = i; step(p["label"] as String); r.sync(props); compare(i, p); compareMotion(i, p) }
        val ph = phases.map { (it["t"] as Number).toDouble() }
        fun n(v: Any?) = (v as? Number)?.toDouble() ?: v
        val web = (c["events"] as List<Map<String, Any?>>).map { e -> (e["name"] as String) to n(e["detail"]) }
        val mine = events.map { it.second.name to n(it.second.detail) }
        if (web != mine) d("events web $web native $mine")
        return diffs
    }
    val theme = ratingTheme(c["theme"] == "dark", 0.0)
    fun paintAt(now: Double) = RatingLayout.layout(r, theme, styleHooks, ApproxMeasurer(), size = size, icon = icon,
        showValueLabel = showLabel, densityProp = densityProp, hoverItem = if (r.disabled) -1 else visHover, pressedItem = if (r.disabled) -1 else visPressed,
        ripples = ripples, reducedMotion = reduced, motion = motion, now = now)
    /** Per frame: the hover pop (scale), state-layer opacity, glyph ripple and focus ring, within the coarsened timestamps (±0.1 ms). */
    var visHover = -1; var visPressed = -1
    fun compareMotion(i: Int, p: Map<String, Any?>) {
        val samples = p["samples"] as List<Map<String, Any?>>
        val t0 = (p["t"] as Number).toDouble()
        val next = (phases.getOrNull(i + 1)?.get("t") as Number?)?.toDouble() ?: Double.MAX_VALUE
        val first = samples.firstOrNull()?.let { (it["t"] as Number).toDouble() } ?: (t0 + 16.7)
        // The visual state (:hover / :active) changes on the frame its CSS transitions start — which can come after the
        // phase's first sample (an `up` moves first, then releases); a WAAPI animation (the ripple) resolves a frame later.
        val trStarts = anims.filter { it["property"] != "animation" }.map { (it["startTime"] as Number).toDouble() }.filter { it >= t0 - 1e-6 && it < next }
        val change = trStarts.minOrNull() ?: (first - 16.7)
        val rippleStart = anims.filter { (it["target"] as String).endsWith("ripple") }.map { (it["startTime"] as Number).toDouble() }.firstOrNull { it >= t0 - 1e-6 && it < next }
        if (pendingPress >= 0) { pressedItem = pendingPress; pendingPress = -1 }
        pendingRipple?.let { (item, x) -> if (r.isInteractive && rippleStart != null) ripples.add(RatingRipple(item, rippleStart, x, 50.0)) }; pendingRipple = null
        val disabling = p["label"] in setOf("prop:disabled=true", "prop:softDisabled=true", "prop:readonly=true")
        val prevStates = if (i > 0) (((phases[i - 1]["samples"] as List<Map<String, Any?>>).lastOrNull()?.get("items") as List<Map<String, Any?>>?) ?: emptyList()).map { (it["state"] as Number).toDouble() } else emptyList()
        var applied = false
        fun apply() { if (!applied) { visHover = hoverItem; visPressed = pressedItem; applied = true; paintAt(change) } }
        if (change <= first) apply()
        // The tap's :active drops on the phase's next transition start, which must come 100–170 ms after the change
        // (Chrome's 150 ms minimum counts from the synthesized mousedown, before the change frame).
        var releaseAt = Double.POSITIVE_INFINITY
        if (touchRelease) {
            touchRelease = false
            val later = trStarts.filter { it > change + 100 }.minOrNull()
            if (later != null && later <= change + 170) releaseAt = later
            else { d("${p["label"]}#$i :active release web ${later?.let { it - change } ?: "none"} ms after the tap"); releaseAt = change + 150 }
        }
        for (sm in samples) {
            val t = (sm["t"] as Number).toDouble()
            if (t >= change - 0.05) apply()
            if (t >= releaseAt - 0.05) { pressedItem = -1; visPressed = -1; paintAt(releaseAt); releaseAt = Double.POSITIVE_INFINITY }
            val win = listOf(paintAt(t - 0.1), paintAt(t + 0.1), paintAt(t))
            val tag = "${p["label"]}#$i@${"%.1f".format(t)}"
            fun within(l: String, web: Double, tol: Double, pick: (RatingPaint) -> Double?) {
                val vs = win.mapNotNull(pick); if (vs.isEmpty()) return
                if (web < vs.min() - tol || web > vs.max() + tol) d("$tag $l web $web native ${vs.last()}")
            }
            (sm["items"] as List<Map<String, Any?>>).forEachIndexed { k, it ->
                val tr = it["transform"] as String
                val sc = if (tr == "none") 1.0 else tr.removePrefix("matrix(").substringBefore(',').toDouble()
                within("item[$k] scale", sc, 1e-4) { pp -> pp.itemList.getOrNull(k)?.scale }
                val webState = (it["state"] as Number).toDouble()
                // Chrome drops :hover a frame after a disabling class change (its hover update runs on the next frame): for
                // that frame a state layer may still read its previous value.
                if (!(disabling && t < change + 16.7 && k < prevStates.size && abs(webState - prevStates[k]) < 1e-9))
                    within("item[$k] state", webState, 0.0006) { pp -> pp.itemList.getOrNull(k)?.stateOpacity }
                val rps = it["ripple"] as List<Map<String, Any?>>
                val rp = rps.lastOrNull()
                if (rp == null) { if (win.last().itemList.getOrNull(k)?.rippleRadiusPct != null && win.first().itemList.getOrNull(k)?.rippleRadiusPct != null) d("$tag item[$k] ripple web none native ${win.last().itemList[k].rippleRadiusPct}") }
                else {
                    val rad = Regex("""circle\(([\d.]+)%""").find(rp["clip"] as String)?.groupValues?.get(1)?.toDouble() ?: -1.0
                    within("item[$k] ripple radius", rad, 0.05) { pp -> pp.itemList.getOrNull(k)?.rippleRadiusPct ?: 0.0 }
                    within("item[$k] ripple opacity", (rp["opacity"] as String).toDouble(), 0.0005) { pp -> pp.itemList.getOrNull(k)?.rippleOpacity }
                    val at = Regex("""at ([\d.]+)% ([\d.]+)%""").find(rp["clip"] as String)
                    if (at != null && abs(at.groupValues[1].toDouble() - (win.last().itemList[k].rippleXPct)) > 1e-3) d("$tag item[$k] ripple x web ${at.groupValues[1]} native ${win.last().itemList[k].rippleXPct}")
                }
            }
            val ring = (sm["outline"] as String).startsWith("solid")
            if (ring != win.last().focusRing) d("$tag focus ring web ${sm["outline"]} native ${win.last().focusRing}")
        }
    }

    fun compare(i: Int, p: Map<String, Any?>) {
        val label = "${p["label"]}#$i"
        val s = (p["samples"] as List<Map<String, Any?>>).lastOrNull() ?: return
        if ((s["value"] as Number).toDouble() != r.value) d("$label value web ${s["value"]} native ${r.value}")
        val aria = s["aria"] as Map<String, Any?>
        val interactive = !r.readonly
        if (aria["role"] != (if (interactive) "slider" else "img")) d("$label role ${aria["role"]}")
        if (interactive) {
            if (aria["now"] != srJsNumberString(r.value)) d("$label valuenow web ${aria["now"]} native ${srJsNumberString(r.value)}")
            if (aria["text"] != r.label(r.value)) d("$label valuetext web ${aria["text"]} native ${r.label(r.value)}")
            if (aria["label"] != "Rating") d("$label aria-label web ${aria["label"]}")
        } else if (aria["label"] != "Rating: ${r.label(r.value)}") d("$label aria-label web ${aria["label"]} native Rating: ${r.label(r.value)}")
        val tab = if (r.disabled) "-1" else if (r.readonly) null else "0"
        if (aria["tabindex"] != tab) d("$label tabindex web ${aria["tabindex"]} native $tab")
        if (s["focused"] != r.focused) d("$label focused web ${s["focused"]} native ${r.focused}")
        val items = (s["items"] as List<Map<String, Any?>>).map { (it["cls"] as String).substringAfter("md-rating__item--").substringBefore(' ') }
        val mine = (0 until r.max).map { r.itemState(it) }
        if (items != mine) d("$label items web $items native $mine")
        val clips = (s["items"] as List<Map<String, Any?>>).map { it["clip"] as String }
        val myClips = (0 until r.max).map { val pct = srJsNumberString((1 - r.fill(it)) * 100); if (r.rtl) "inset(0px 0px 0px $pct%)" else "inset(0px $pct% 0px 0px)" }
        if (clips != myClips) d("$label clips web $clips native $myClips")
        val lbl = s["label"] as String?
        val myLbl = if (showLabel) r.label(r.displayValue) else null
        if (lbl != myLbl) d("$label label web $lbl native $myLbl")
    }
}
object RatingInteract { @JvmStatic fun main(args: Array<String>) {
    for (f in args) {
        val runs: List<Map<String, Any?>> = (srParseJson(File(f).readText()) as Map<String, Any?>)["runs"].cast()
        var ok = 0
        for (c in runs) { val rr = RatingReplay(c, f.contains("reduced")); val diffs = try { rr.run() } catch (e: Exception) { listOf("EXC $e") }; if (diffs.isEmpty()) ok++ else { println("FAIL ${rr.name}"); diffs.take(10).forEach { println("   $it") } } }
        println("${File(f).name}: $ok/${runs.size}")
    }
} }
