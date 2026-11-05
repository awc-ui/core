// fa (2026-10-29): from n5's generated md-slider / md-rating harness, decoupled from the chart port.
package dev.awc.playground.sr

import dev.awc.nativeui.slider.*
import java.io.File
import kotlin.math.abs

// Replays md-slider states(.json / -reduced.json) and lifecycle.json through SliderInteraction: events, the props, the native inputs
// (value, aria-valuenow, focus), the CSS position variables, the value-indicator text and the stop classes.

class SliderReplay(val c: Map<String, Any?>, val last: Boolean, val reduced: Boolean = false) {
    /** The host's properties (the node state the view syncs from); the component's own writes land here too. */
    var props = SliderProps(); var initial = SliderProps()
    val name = c["name"] as String
    val phases: List<Map<String, Any?>> = c["phases"].cast()
    val rtl = c["dir"] == "rtl"
    val s = SliderInteraction()
    val events = mutableListOf<Pair<Int, SliderEvent>>()
    var phaseIdx = 0
    var w = 480.0; var ox = 24.0
    val diffs = mutableListOf<String>()
    fun d(m: String) { if (diffs.size < 40) diffs.add(m) }

    init {
        val html = c["html"] as String
        val tagStart = html.indexOf("<md-slider")
        val attrs = html.substring(tagStart, html.indexOf('>', tagStart))
        fun attr(n: String): String? = Regex("""\s$n(?:="([^"]*)")?(?=[\s>]|$)""").find(attrs)?.let { it.groups[1]?.value ?: "" }
        fun num(n: String, d: Double) = attr(n)?.toDoubleOrNull() ?: d
        fun flag(n: String) = attr(n) != null
        props = SliderProps(num("min", 0.0), num("max", 100.0), num("step", 1.0), num("value", 50.0), num("value-start", 0.0), num("value-end", 100.0),
            flag("disabled"), attr("variant") ?: "standard", flag("range"), flag("stops"), attr("size") ?: "xs", attr("orientation") ?: "horizontal",
            flag("value-indicator"), flag("labeled"), flag("inset-icon"), flag("controlled"), rtl)
        initial = props
        s.onEvent = { events.add(phaseIdx to it) }
        // The component's own writes land in the host props (the node state the view syncs from).
        s.onPropWrite = { k, v -> props = when (k) { "value" -> props.copy(value = v); "valueStart" -> props.copy(valueStart = v); "valueEnd" -> props.copy(valueEnd = v); else -> props } }
        s.sync(props)
        val snap = phases[0]["snap"] as Map<String, Any?>?
        val surf = (snap?.get("parts") as List<Map<String, Any?>>?)?.firstOrNull { it["part"] == "surface" }?.get("rect") as Map<String, Any?>?
        if (surf != null) { w = num(surf["width"]); ox = num(surf["x"]) }
    }

    /** The rail point at fraction f (as the page computes it), float32-quantised like Blink's pointer events. */
    fun at(f: Double): Pair<Double, Double> {
        if (s.vertical) return 0.0 to 1000.0 * (1 - f)
        val page = if (rtl) ox + w - w * f else ox + w * f
        return (page.toFloat().toDouble() - ox) to 22.0
    }

    /** `prop:<name>=<JSON>`: the host sets one property (Stencil runs its watcher if it changed). */
    fun setProp(spec: String) {
        val name = spec.substringBefore('='); val v = srParseJson(spec.substringAfter('='))
        val n = (v as? Number)?.toDouble(); val b = v as? Boolean; val t = v as? String
        props = when (name) {
            "min" -> props.copy(min = n ?: 0.0); "max" -> props.copy(max = n ?: 100.0); "step" -> props.copy(step = n ?: 1.0)
            "value" -> props.copy(value = n ?: 50.0); "valueStart" -> props.copy(valueStart = n ?: 0.0); "valueEnd" -> props.copy(valueEnd = n ?: 100.0)
            "disabled" -> props.copy(disabled = b ?: false); "variant" -> props.copy(variant = t ?: "standard"); "range" -> props.copy(range = b ?: false)
            "stops" -> props.copy(stops = b ?: false); "size" -> props.copy(size = t ?: "xs"); "orientation" -> props.copy(orientation = t ?: "horizontal")
            "valueIndicator" -> props.copy(valueIndicator = b ?: false); "labeled" -> props.copy(labeled = b ?: false); "insetIcon" -> props.copy(insetIcon = b ?: false)
            "controlled" -> props.copy(controlled = b ?: false); "icon" -> props
            else -> { d("unknown prop $name"); props }
        }
        s.sync(props)
    }

    fun step(raw: String) {
        if (raw.startsWith("prop:")) { setProp(raw.removePrefix("prop:")); return }
        // The owning form restores the authored values (formResetCallback; natively the form resets the node's values).
        if (raw == "form-reset") { props = props.copy(value = initial.value, valueStart = initial.valueStart, valueEnd = initial.valueEnd); s.sync(props); return }
        Regex("""^touch-(down|move|up)-(\d+)$""").find(raw)?.let { t ->
            // Trusted touch (Chrome): the finger lands without a hover move; a lift has no move either.
            val pt = at(t.groupValues[2].toDouble() / 100)
            when (t.groupValues[1]) { "down" -> s.pointerDown(pt.first, pt.second, w, 1000.0, touch = true); "move" -> s.pointerMove(pt.first, pt.second, w, 1000.0); else -> s.pointerUp(pt.first, pt.second, w, 1000.0) }
            return
        }
        val label = raw
        val f = Regex("""^(move|down|up)-(\d+)$""").find(label)
        when {
            label == "arm" || label == "leave" -> {}
            label == "install-cap-handler" -> { val prev = s.onEvent; s.onEvent = { e -> prev(e); if (e.name == "mdInput") s.setValueProp(minOf(60.0, (e.detail["value"] as Number).toDouble())) } }
            // The page focuses the button before the slider, then tabs: a focused thumb blurs first.
            label == "tab-in" -> { if (s.focusedThumb != null) s.blur(); if (!s.disabled) s.focus(if (s.range) "start" else "single", keyboard = true) }
            label == "key-Tab" -> { if (s.range && s.focusedThumb == "start") s.focus("end", keyboard = true) else s.blur() }
            label == "key-Tab+Shift" -> s.blur()
            label.startsWith("key-") -> s.focusedThumb?.let { th -> val k = label.removePrefix("key-"); s.keyDown(th, k); deferredKeyUp = { s.keyUp(th, k) } }
            f != null -> {
                val frac = fractions.removeFirstOrNull() ?: (f.groupValues[2].toDouble() / 100)
                if (abs(frac * 100 - f.groupValues[2].toDouble()) > 0.51) d("$label: fraction $frac out of step")
                val p = at(frac)
                // The harness moves to a point before pressing or releasing there (oracleMouse).
                when (f.groupValues[1]) {
                    "move" -> s.pointerMove(p.first, p.second, w, 1000.0)
                    "down" -> { s.pointerMove(p.first, p.second, w, 1000.0); s.pointerDown(p.first, p.second, w, 1000.0) }
                    "up" -> { s.pointerMove(p.first, p.second, w, 1000.0); s.pointerUp(p.first, p.second, w, 1000.0) }
                }
            }
            else -> d("unknown step $label")
        }
    }

    /** The exact pointer fractions of each run, in order (slider-states.html `drag` / `mouse`); labels only carry rounded percents. */
    val fractions: ArrayDeque<Double> = ArrayDeque(run {
        fun drag(a: Double, b: Double, n: Int = 5) = listOf(a, a) + (1..n).map { a + (b - a) * it / n } + listOf(b)
        when {
            name.startsWith("drag-standard") -> drag(0.3, 0.7)
            name.startsWith("drag-range-crossing") -> drag(0.2, 0.8, 6) + drag(0.8, 0.5, 3)
            name == "track-click-ltr" -> listOf(0.85, 0.85, 0.85)
            name == "track-click-range-ltr" -> listOf(0.9, 0.9, 0.05, 0.05)
            name == "drag-centered-ltr" -> drag(0.7, 0.2, 6)
            name == "drag-stops-ltr" -> drag(0.3, 0.74, 4)
            name == "drag-indicator-ltr" -> drag(0.3, 0.6, 3)
            name == "drag-inset-lg-ltr" -> drag(0.05, 0.6, 6)
            name == "drag-vertical-ltr" -> drag(0.3, 0.8, 5)
            name == "drag-vertical-range-rtl" -> drag(0.2, 0.7, 5)
            name == "controlled-cap-drag-ltr" -> drag(0.4, 0.9, 5)
            name == "controlled-reject-ltr" -> drag(0.5, 0.8, 3)
            name == "disabled-ltr" -> listOf(0.3, 0.7, 0.7)
            name == "dark-drag-ltr" -> drag(0.3, 0.6, 3)
            else -> emptyList()
        }
    })

    var deferredKeyUp: (() -> Unit)? = null
    /** A key press whose keyup landed a frame after the keydown: the press morph started, then reversed (shortened). */
    fun keyRelease(i: Int, p: Map<String, Any?>): Double? {
        val t0 = (p["t"] as Number).toDouble()
        val end = (phases.getOrNull(i + 1)?.get("t") as Number?)?.toDouble() ?: Double.MAX_VALUE
        return anims.firstOrNull { (it["target"] as String).endsWith("thumb-knob") && (it["duration"] as Number).toDouble() < 99.0 &&
            (it["startTime"] as Number).toDouble().let { t -> t >= t0 && t < end } }?.let { (it["startTime"] as Number).toDouble() }
    }

    fun run(): List<String> {
        for ((i, p) in phases.withIndex()) {
            phaseIdx = i
            step(p["label"] as String)
            if (keyRelease(i, p) == null) { deferredKeyUp?.invoke(); deferredKeyUp = null }
            s.sync(props)   // the render after the step (a no-op unless the host state changed)
            s.render()
            compare(i, p)
            comparePaint(i, p)
        }
        if (!last) { phaseIdx = phases.size - 1; s.blur() }
        compareEvents()
        return diffs
    }

    val hooks = run { val h = c["html"] as String; val t = h.indexOf("<md-slider"); Regex("""\sstyle="([^"]*)"""").find(h.substring(t, h.indexOf('>', t)))?.groupValues?.get(1) ?: "" }.let { sliderHooksFrom(it) }
    val fullHeight = (c["html"] as String).contains("full-height")
    val motion = SliderMotion(reducedMotion = reduced)
    val theme = WebTokens.theme(c["theme"] == "dark", 0.0)
    fun paintAt(now: Double) = SliderLayout.layout(s, theme, hooks, ApproxMeasurer(), 480.0, if (fullHeight) 300.0 else null, fullHeight, motion = motion, now = now)
    val anims: List<Map<String, Any?>> = (c["anims"] as List<Map<String, Any?>>?) ?: emptyList()
    fun comparePaint(i: Int, p: Map<String, Any?>) {
        val samples = p["samples"] as List<Map<String, Any?>>
        val t0 = (p["t"] as Number).toDouble()
        val first = samples.firstOrNull()?.let { (it["t"] as Number).toDouble() } ?: (t0 + 16.7)
        // The style change lands on the frame the transitions start on (Chrome stamps them with that frame's time).
        val change = anims.map { (it["startTime"] as Number).toDouble() }.filter { it >= t0 - 1e-6 && it <= first + 1.0 }.maxOrNull()?.let { minOf(it, first) } ?: (first - 16.7)
        val release = keyRelease(i, p)
        if (release != null && deferredKeyUp != null) {
            paintAt(release - 16.67)            // keydown's frame: the morph starts
            deferredKeyUp!!.invoke(); deferredKeyUp = null
            paintAt(release)                    // keyup's frame: it reverses
        } else paintAt(change)
        val tol = 1.0 / 64 + 1e-6
        fun rect(m: Any?): SliderRect {
            val r = m as Map<String, Any?>
            return SliderRect((r["x"] as Number).toDouble(), (r["y"] as Number).toDouble(), (r["width"] as Number).toDouble(), (r["height"] as Number).toDouble())
        }
        fun eqR(l: String, w: SliderRect, m: SliderRect) { if (abs(w.x - m.x) > tol || abs(w.y - m.y) > tol || abs(w.width - m.width) > tol || abs(w.height - m.height) > tol) d("$l web $w native $m") }
        for ((k, sm) in samples.withIndex()) {
            val t = (sm["t"] as Number).toDouble()
            // document.timeline times are coarsened to 0.1 ms: accept anything the native value takes within ±0.1 ms.
            val window = listOf(paintAt(t - 0.1), paintAt(t + 0.1), paintAt(t))
            val paint = window.last()
            if (System.getenv("SLIDER_DEBUG") == name) println("$i ${p["label"]} t=$t change=$change value=${s.displayValue} active=${paint.segments.first { it.kind == "active" }.rect.width} web=${(sm["active"] as Map<String, Any?>?)?.get("rect")}")
            val tag = "${p["label"]}#$i@${"%.1f".format(t)}"
            val ox = 24.0; val oy = 24.0
            fun within(l: String, w: SliderRect, pick: (SliderPaint) -> SliderRect?) {
                val rs = window.mapNotNull(pick).map { it.offset(ox, oy) }
                if (rs.isEmpty()) return
                fun ok(v: Double, f: (SliderRect) -> Double) = v >= rs.minOf(f) - tol && v <= rs.maxOf(f) + tol
                if (!(ok(w.x) { it.x } && ok(w.y) { it.y } && ok(w.width) { it.width } && ok(w.height) { it.height })) d("$l web $w native ${rs.last()}")
            }
            (sm["thumbs"] as List<Map<String, Any?>>).forEachIndexed { j, th ->
                within("$tag thumb[$j]", rect(th["rect"])) { it.thumbs.getOrNull(j)?.box }
                within("$tag knob[$j]", rect(th["knob"])) { it.thumbs.getOrNull(j)?.knob }
            }
            (sm["active"] as Map<String, Any?>?)?.let { a -> within("$tag active", rect(a["rect"])) { pp -> pp.segments.firstOrNull { it.kind == "active" }?.rect } }
            (sm["ticks"] as List<String>?)?.let { tk ->
                tk.forEachIndexed { j, str ->
                    val op = str.substringAfter(':').toDouble()
                    val ops = window.mapNotNull { it.ticks.getOrNull(j)?.opacity }
                    if (ops.isNotEmpty() && (op < ops.min() - 0.0051 || op > ops.max() + 0.0051)) d("$tag tick[$j] opacity web $op native ${"%.4f".format(ops.last())}")
                }
            }
        }
        val snap = p["snap"] as Map<String, Any?>? ?: return
        val snapT = (phases.getOrNull(i + 1)?.get("t") as Number?)?.toDouble() ?: ((samples.lastOrNull()?.get("t") as Number?)?.toDouble() ?: first) + 16.7
        val sp = paintAt(snapT)
        // The snapshot is read after the phase's screenshot; skip it if a transition may still be mid-flight then.
        if (!motion.active(snapT)) sliderTreeDiff(snap, sp, { m -> d("${p["label"]}#$i paint: $m") })
    }

    fun pctOf(v: Any?): Double? = (v as? String)?.removeSuffix("%")?.takeIf { it.isNotEmpty() }?.toDouble()

    fun compare(i: Int, p: Map<String, Any?>) {
        val label = "${p["label"]}#$i"
        val sm = (p["samples"] as List<Map<String, Any?>>).lastOrNull() ?: return
        fun eqNum(a: Any?, b: Double) = a is Number && abs(a.toDouble() - b) < 1e-9
        if (!eqNum(sm["value"], s.value)) d("$label value web ${sm["value"]} native ${s.value}")
        if (s.range) {
            if (!eqNum(sm["valueStart"], s.valueStart)) d("$label valueStart web ${sm["valueStart"]} native ${s.valueStart}")
            if (!eqNum(sm["valueEnd"], s.valueEnd)) d("$label valueEnd web ${sm["valueEnd"]} native ${s.valueEnd}")
        }
        val inputs = sm["inputs"] as List<Map<String, Any?>>
        val mine = if (s.range) listOf(Triple(s.inputStart, sliderNumberString(s.displayStart), s.focusedThumb == "start"), Triple(s.inputEnd, sliderNumberString(s.displayEnd), s.focusedThumb == "end"))
                   else listOf(Triple(s.inputValue, sliderNumberString(s.displayValue), s.focusedThumb == "single"))
        for ((k, inp) in inputs.withIndex()) {
            val m = mine.getOrNull(k) ?: break
            if (inp["value"] != m.first) d("$label input[$k] value web ${inp["value"]} native ${m.first}")
            if (inp["now"] != m.second) d("$label input[$k] valuenow web ${inp["now"]} native ${m.second}")
            if (inp["focused"] != m.third) d("$label input[$k] focused web ${inp["focused"]} native ${m.third}")
        }
        val vars = sm["vars"] as Map<String, Any?>
        fun v(k: String, x: Double) { val w = pctOf(vars[k]); if (w == null || abs(w - x) > 1e-9) d("$label $k web ${vars[k]} native $x") }
        v("--_value-pct", s.valuePct); v("--_active-start-pct", s.activeStartPct); v("--_active-width-pct", s.activeWidthPct)
        if (s.range) { v("--_start-pct", s.startPct); v("--_end-pct", s.endPct) }
        val ind = (sm["indicators"] as List<Map<String, Any?>>?)?.map { it["text"] } ?: emptyList()
        if (ind != s.indicatorTexts) d("$label indicators web $ind native ${s.indicatorTexts}")
        val ticks = (sm["ticks"] as List<String>?)?.map { it.substringBefore(':') }
        if (ticks != s.ticks()) d("$label ticks web $ticks native ${s.ticks()}")
    }

    fun norm(v: Any?): Any? = when (v) { is Number -> v.toDouble(); is Map<*, *> -> v.mapKeys { it.key.toString() }.mapValues { norm(it.value) }.toSortedMap(); else -> v }

    fun compareEvents() {
        val ph = phases.map { (it["t"] as Number).toDouble() }
        val web = (c["events"] as List<Map<String, Any?>>).map { e -> ph.indexOfLast { it <= (e["t"] as Number).toDouble() }.coerceAtLeast(0) to (e["name"] as String to norm(e["detail"])) }
        val mine = events.map { it.first to (it.second.name to norm(it.second.detail)) }
        if (web != mine) {
            d("events web ${web.size} native ${mine.size}")
            for (k in 0 until maxOf(web.size, mine.size)) { val a = web.getOrNull(k); val b = mine.getOrNull(k); if (a != b) d("  ev[$k] web $a | native $b") }
        }
    }
}

object SliderInteract { @JvmStatic fun main(args: Array<String>) {
    for (f in args) {
        val root: Map<String, Any?> = srParseJson(File(f).readText()).cast()
        val runs: List<Map<String, Any?>> = root["runs"].cast()
        var ok = 0
        for ((i, c) in runs.withIndex()) {
            val r = SliderReplay(c, i == runs.size - 1, f.contains("reduced"))
            val diffs = try { r.run() } catch (e: Exception) { listOf("EXC $e ${e.stackTrace.take(4).joinToString()}") }
            if (diffs.isEmpty()) ok++ else { println("FAIL ${r.name}"); diffs.take(14).forEach { println("   $it") } }
        }
        println("${File(f).name}: $ok/${runs.size}")
    }
} }
