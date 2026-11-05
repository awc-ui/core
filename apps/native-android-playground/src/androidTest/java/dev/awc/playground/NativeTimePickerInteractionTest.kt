package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin

/**
 * md-time-picker interaction against Chrome 153 (Mac capture of tp-states.html: the runs + the same runs under reduced motion):
 * open from the trigger (click, Enter), dial drags and taps on both rings, minute-step wrap, AM / PM, keyboard entry with
 * ArrowUp / ArrowDown / Tab / Enter, invalid entry, mode toggle, dismissal (Escape, scrim, Cancel), the focus trap, min / max
 * validity with form reset, show() / close(), landscape and the responsive policy. Each phase fires Chrome's input at its
 * recorded time on the test clock (density 1: the 1200 × 900 dp oracle viewport fits the device for pointer input); checks: the md* event sequence and details, per-phase end state (value, open, focused part,
 * tile text / validity / active tile, period, dial mode, hand target and length, active number, status) and, for every Chrome
 * sample, the presented motion (scrim, dialog, mode areas, hand, period colours) within one frame of the sample's time.
 */
@OptIn(ExperimentalTestApi::class)
class NativeTimePickerInteractionTest {
    @get:Rule val compose = createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{}}"))
    private var props by mutableStateOf<Map<String, Any?>>(emptyMap())
    private var reduced by mutableStateOf(false); private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector(); private var picker: AWCTimePickerRuntime? = null
    private val events = mutableListOf<Pair<String, Any?>>()
    private val outside = FocusRequester()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) { failures += label; android.util.Log.i("AWCAccordion", "FAIL: $label") } }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        val r = run; val rtl = r.optString("dir") == "rtl"; val (vw, vh) = NativeTimePickerParityTest.viewport(r)
        AWCTheme(r.optString("theme") == "dark") { AWCAccessibilityAppearanceScope(reducedMotion = reduced) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
                Box(Modifier.wrapContentSize(Alignment.TopStart, unbounded = true).requiredSize(vw.dp, vh.dp)) {
                    AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp)) {
                        Box(Modifier.absoluteOffset(1100.dp, 10.dp).size(40.dp, 24.dp).focusRequester(outside).focusable())
                        Box(Modifier.absoluteOffset(24.dp, 24.dp).width(240.dp)) {
                            CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                AWCTimePickerInspectionScope({ picker = it }) { AWCInspectionScope(collector) {
                                    // The page binds `open` / `value` to the element's properties, which the component itself changes.
                                    AWCComponent("md-time-picker", props + ("id" to "tp"), onEvent = { n, v ->
                                        if (n.startsWith("md")) events += n to v
                                        when (n) { "mdOpen" -> props = props + ("open" to true); "mdClose" -> props = props + ("open" to false)
                                            "mdChange" -> (v as? Map<*, *>)?.get("value")?.let { props = props + ("value" to it) } }
                                    })
                                } }
                            }
                        }
                    }
                }
            } }
        } }
    } } }
    @Test fun timePickerInteractionMatchesChrome() {
        // The oracle page pins `new Date()` to Thursday 2025-06-12 10:30 local time (fixed-clock.js).
        AWCTimeMath.clock = { java.util.GregorianCalendar(2025, 5, 12, 10, 30).timeInMillis }
        content()
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcTpOnly")
        for ((file, red) in listOf("TimePickerWebStates.json" to false, "TimePickerWebStatesReduced.json" to true))
            for (r in CardWeb.document(file).getJSONArray("runs").objects()) if (only == null || only.split(",").any { r.getString("name").contains(it) }) runCase(r, red)
        AccordionEvidence.log("timepicker-states", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(600))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    /** Native latency (ms) from an input to the first frame of the transition it causes (the state recomposes in the next
     *  frame; the modal motion clock starts at the frame after the change). */
    private fun latency(kind: String): Double = if (kind in setOf("scrim", "dialog", "mode")) 44.0 else 32.0
    private class Frame(val t: Double, val v: Map<String, List<Double>>)
    private class Step(val at: Double?, val f: () -> Unit)
    private fun matrix(t: String?): DoubleArray { if (t == null || !t.startsWith("matrix(")) return doubleArrayOf(1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
        return t.removePrefix("matrix(").removeSuffix(")").split(",").map { it.trim().toDouble() }.toDoubleArray() }
    /** A computed colour as premultiplied sRGB 0–1: rgb()/rgba() and Chrome's interpolated forms oklab() / color(srgb …). */
    private fun premultiplied(css: String): List<Double> {
        val v = css.substringAfter("(").substringBeforeLast(")").replace("/", " ").replace(",", " ").split(" ").mapNotNull { it.trim().toDoubleOrNull() }
        if (v.size < 3) return listOf(0.0, 0.0, 0.0, 0.0)
        val a = v.getOrElse(3) { 1.0 }
        return when {
            css.startsWith("oklab(") -> AWCTimeMath.oklabToSRGB(listOf(v[0] * a, v[1] * a, v[2] * a, a))
            css.startsWith("color(srgb") -> listOf(v[0] * a, v[1] * a, v[2] * a, a)
            else -> listOf(v[0] / 255 * a, v[1] / 255 * a, v[2] / 255 * a, a)
        }
    }
    /** The native focused part as Chrome's deep active element below the host. */
    private fun focusedPart(): String = when (val f = picker?.focused) { null -> "body"; "trigger" -> "md-time-picker > trigger > input"; else -> "md-time-picker > $f" }
    private fun text(name: String, d: Any?): String {
        fun v(k: String, x: Any?): String = when {
            k == "date" || k == "isoDateTime" -> if (x?.toString().isNullOrEmpty()) "-" else "*"   // the device's time zone
            x is Map<*, *> -> "{" + x.keys.map { it.toString() }.sorted().filter { x[it] == true }.joinToString(",") + "}"
            x is JSONObject -> "{" + x.keys().asSequence().sorted().filter { x.optBoolean(it) }.joinToString(",") + "}"
            x is Number -> x.toDouble().toInt().toString()
            else -> x.toString()
        }
        return when (d) {
            is Map<*, *> -> name + "(" + d.keys.map { it.toString() }.sorted().joinToString(",") { "$it=" + v(it, d[it]) } + ")"
            is JSONObject -> name + "(" + d.keys().asSequence().sorted().joinToString(",") { "$it=" + v(it, d.get(it)) } + ")"
            else -> name
        }
    }

    private fun runCase(r: JSONObject, red: Boolean) {
        val name = (if (red) "reduced/" else "") + r.getString("name")
        android.util.Log.i("AWCAccordion", "timepicker-states run $name")
        compose.mainClock.autoAdvance = true
        compose.onRoot().performMouseInput { moveTo(Offset(2f, 2f), 0) }
        events.clear(); picker = null; collector.clear(); reduced = red; run = r
        props = NativeTimePickerParityTest.props(r); epoch++; compose.waitForIdle()
        compose.mainClock.autoAdvance = false; compose.mainClock.advanceTimeBy(100); compose.waitForIdle(); events.clear()
        fun m(n: String) = collector.snapshot().nodes.firstOrNull { it.name == n }?.bounds
        fun center(part: String): Offset { val b = m(part) ?: return Offset.Zero; return Offset((b.x + b.width / 2).toFloat(), (b.y + b.height / 2).toFloat()) }
        /** The point on the dial at clock angle `deg` (0 = 12 o'clock, clockwise) and radius fraction `f`, in 1/16 px steps (Chrome). */
        fun dialPoint(deg: Double, f: Double): Offset { val d = m("dial") ?: return Offset.Zero
            val rad = Math.toRadians(deg); val rr = d.width / 2 * f
            fun q(v: Double) = floor(v * 16 + .5) / 16
            return Offset(q(d.x + d.width / 2 + rr * sin(rad)).toFloat(), q(d.y + d.height / 2 - rr * cos(rad)).toFloat()) }
        fun mouse(block: MouseInjectionScope.() -> Unit) { compose.onRoot().performMouseInput(block) }
        fun click(p: Offset) = mouse { moveTo(p, 0); press(); release() }
        // Keys through the window (the modal scope routes Tab / Escape there), keydown and keyup together as Chrome sends them.
        fun key(code: Int, shift: Boolean = false) { ModalWeb.key(code, shift); compose.waitForIdle() }
        val keys = mapOf("ArrowUp" to KeyEvent.KEYCODE_DPAD_UP, "ArrowDown" to KeyEvent.KEYCODE_DPAD_DOWN, "ArrowLeft" to KeyEvent.KEYCODE_DPAD_LEFT,
            "ArrowRight" to KeyEvent.KEYCODE_DPAD_RIGHT, "Home" to KeyEvent.KEYCODE_MOVE_HOME, "End" to KeyEvent.KEYCODE_MOVE_END, "Enter" to KeyEvent.KEYCODE_ENTER,
            "Escape" to KeyEvent.KEYCODE_ESCAPE, "Tab" to KeyEvent.KEYCODE_TAB)
        fun one(f: () -> Unit): (Double, Double) -> List<Step> = { _, _ -> listOf(Step(null, f)) }
        val acts = mutableMapOf<String, (Double, Double) -> List<Step>>()
        acts["open"] = one { click(center("md-text-field")) }
        acts["show"] = one { compose.runOnIdle { picker?.show?.invoke(); Unit } }; acts["reopen"] = acts["show"]!!
        acts["hide"] = one { compose.runOnIdle { picker?.hide?.invoke(); Unit } }
        acts["am"] = one { click(center("period-am")) }
        acts["ok"] = one { click(center("confirm-button")) }
        acts["cancel"] = one { click(center("cancel-button")) }
        acts["to-input"] = one { click(center("toggle-mode")) }; acts["to-dial"] = acts["to-input"]!!
        acts["select-minutes"] = one { click(center("input-minute")) }
        acts["scrim"] = one { click(Offset(80f, 600f)) }   // any scrim point (Chrome: 1150, 850)
        acts["submit-empty"] = one { }
        acts["reset"] = one { props = props + ("value" to "") }
        acts["Control+a"] = one { compose.runOnIdle { picker?.selectAll(); Unit } }
        for ((k, code) in keys) acts[k] = one { key(code) }
        acts["Shift+Tab"] = one { key(KeyEvent.KEYCODE_TAB, true) }
        // Drags: down at the start angle, `n` moves spread over Chrome's drag, release when Chrome's did.
        fun drag(a0: Double, a1: Double, f: Double, n: Int): (Double, Double) -> List<Step> = { s, e ->
            listOf(Step(s) { val p = dialPoint(a0, f); mouse { moveTo(p, 0); press() } }) +
                (1..n).map { i -> Step(s + (e - s) * i / (n + 1)) { val p = dialPoint(a0 + (a1 - a0) * i / n, f); mouse { moveTo(p, 0) } } } +
                listOf(Step(e) { mouse { release() } }) }
        // Taps: press when Chrome's pointerdown landed (its first md* event), release when its pointerup's state change did.
        fun tap(deg: Double, f: Double = .8): (Double, Double) -> List<Step> = { s, e ->
            listOf(Step(s) { val p = dialPoint(deg, f); mouse { moveTo(p, 0); press() } }, Step(e) { mouse { release() } }) }
        acts["drag-hour-2-to-4"] = drag(60.0, 120.0, .8, 12); acts["drag-minute-30-to-45"] = drag(180.0, 270.0, .8, 16)
        acts["drag-inner-14-to-17"] = drag(60.0, 150.0, .52, 12); acts["tap-outer-9"] = tap(270.0); acts["tap-minute-20"] = tap(120.0)
        acts["drag-50-across-0-to-10"] = drag(300.0, 420.0, .8, 18); acts["drag-back-to-55"] = drag(60.0, -30.0, .8, 12)
        acts["tap-hour-7"] = tap(210.0); acts["tap-minute-5"] = tap(30.0); acts["tap-hour-5"] = tap(150.0); acts["drag-hour"] = drag(60.0, 150.0, .8, 12)

        val phases = r.getJSONArray("phases").objects()
        val clock0 = compose.mainClock.currentTime + 48
        fun elapsed() = (compose.mainClock.currentTime - clock0).toDouble()
        val frames = mutableListOf<Frame>()
        fun sample() { val pk = picker ?: return; frames += Frame(elapsed(), pk.motion.mapValues { it.value.last().second }) }
        fun advance() { compose.mainClock.advanceTimeByFrame(); compose.waitForIdle(); sample() }
        val webEvents = r.getJSONArray("events").objects()
        val anims = r.optJSONArray("anims")?.objects()?.map { it.getString("kind") to it.getDouble("start") } ?: emptyList()
        val anchored = mutableListOf<Triple<String, Pair<String, Double>, Double>>()
        // The input plan: a one-step input fires at Chrome's animation start minus the native latency (else at Chrome's first
        // md* event of the phase, else at the phase start); a drag runs from the phase start to its release, timed by the first
        // animation after it or Chrome's last event of the phase; typed digits one per 33 ms.
        class Plan(val start: Double, val end: Double, val anchor: Pair<String, Double>?)
        fun plan(i: Int): Plan {
            val ph = phases[i]; val lbl = ph.getString("label"); val t = ph.getDouble("t")
            val nextT = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else t + 900
            val inPhase = anims.filter { it.second >= t - (if (i == 0) 1 else 0) && it.second < nextT }
            val evs = webEvents.filter { it.getDouble("t") >= t && it.getDouble("t") < nextT }.map { it.getDouble("t") }
            // A pointer's dial change moves the hand in the input's own frame (the hand's transition is dated back to it),
            // so a drag's release is timed with one frame of latency, not the state latency.
            if (lbl.startsWith("drag") || lbl.startsWith("type-")) {
                val end = inPhase.lastOrNull()?.let { it.second - (if (lbl.startsWith("drag")) 16.7 else latency(it.first)) } ?: evs.lastOrNull()?.plus(2) ?: (t + 300)
                return Plan(t, maxOf(t + 50, end), inPhase.lastOrNull())
            }
            // A tap: Chrome's pointerdown restyles the dial in the next frame (its first animation of the phase) and its
            // pointerup hands over to the minutes (the hand's last transition); the press and release land just before.
            if (lbl.startsWith("tap-")) {
                val downAt = inPhase.firstOrNull()?.second ?: evs.firstOrNull() ?: t
                val handAt = inPhase.lastOrNull { it.first == "hand" }?.second
                val down = maxOf(t, downAt - 2); val up = maxOf(down + 17, (handAt ?: (down + 35)) - 2)
                return Plan(down, up, inPhase.lastOrNull())
            }
            inPhase.lastOrNull()?.let { return Plan(it.second - latency(it.first), 0.0, it) }
            // Without a recorded animation the input is timed by Chrome's event (or the phase start): Chrome paints the
            // state one frame after it, the native `latency` after its input, so the input leads by the difference.
            val lead = latency("state") - 16.7
            evs.firstOrNull()?.let { return Plan(maxOf(t, it - 2) - lead, 0.0, null) }
            return Plan(t - lead, 0.0, null)
        }
        val plans = phases.indices.map { plan(it) }
        for ((i, ph) in phases.withIndex()) {
            val lbl = ph.getString("label"); val p = plans[i]
            // Chrome's click moves the pointer first: the AM button's hover tint starts before the click's state change.
            if (lbl == "am") {
                val t = ph.getDouble("t"); val nextT = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else t + 900
                val hover = anims.firstOrNull { it.first == "period" && it.second >= t && it.second < nextT }?.second?.minus(latency("period"))
                if (hover != null && hover < p.start - 4) { while (elapsed() < hover) advance(); val q = center("period-am"); mouse { moveTo(q, 0) }; compose.waitForIdle(); sample() }
            }
            while (elapsed() < p.start) advance()
            p.anchor?.let { anchored += Triple(lbl, it, elapsed()) }
            if (lbl.startsWith("type-")) {
                // One digit per frame pair (Chrome: input events 33 ms apart) into the focused tile.
                for ((k, ch) in lbl.removePrefix("type-").withIndex()) { while (elapsed() < p.start + k * 33.3) advance()
                    key(KeyEvent.KEYCODE_0 + (ch - '0')); sample() }
            } else {
                val steps = acts[lbl]?.invoke(p.start, p.end)
                if (steps == null) check(false, "$name no native action for $lbl")
                else for (s in steps) { s.at?.let { at -> while (elapsed() < at) advance() }; s.f(); compose.waitForIdle(); sample() }
            }
            val next = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else p.start + 900
            val nextInput = if (i + 1 < phases.size) plans[i + 1].start - 2 else next
            while (elapsed() < minOf(next - 20, nextInput)) advance()
            phaseEnd(name, lbl, ph)
        }
        // Calibration: where each anchored native transition started (the first frame after the input whose value changed).
        for ((lbl, a, fired) in anchored) {
            val keysFor = { f: Frame -> f.v.filterKeys { k -> when (a.first) { "hand" -> k == "hand"; "number" -> k.startsWith("number"); "period" -> k.startsWith("period")
                "scrim", "dialog" -> k == a.first; "mode" -> k.startsWith("mode"); else -> false } } }
            val before = frames.lastOrNull { it.t <= fired } ?: continue
            val ch = frames.firstOrNull { it.t > fired && keysFor(it) != keysFor(before) } ?: continue
            android.util.Log.i("AWCAccordion", "timepicker-anchor $name/$lbl ${a.first} chrome ${a.second.toInt()} fired ${fired.toInt()} native ${ch.t.toInt()} (${(ch.t - a.second).toInt()} ms)")
        }
        // Motion: each Chrome sample against the native frames within one frame of its time (plus the values bracketing it).
        for (ph in phases) for (smp in ph.getJSONArray("samples").objects()) {
            val st = smp.optDouble("t", Double.NaN); if (st.isNaN()) continue
            val lbl = ph.getString("label")
            fun motion(key: String, web: List<Double>, tol: List<Double>, angle: Boolean = false) {
                fun get(f: Frame) = f.v[key]
                val cands = frames.filter { abs(it.t - st) <= 20 }.mapNotNull(::get) +
                    listOfNotNull(frames.lastOrNull { it.t < st - 20 }?.let(::get), frames.lastOrNull { it.t <= st }?.let(::get), frames.firstOrNull { it.t >= st }?.let(::get))
                if (cands.isEmpty()) { check(false, "$name/$lbl t=${st.toInt()} $key never presented natively"); return }
                fun norm(x: Double) = if (angle) ((x % 360) + 360) % 360 else x
                val ok = web.indices.all { k -> val vals = cands.mapNotNull { it.getOrNull(k)?.let(::norm) }; vals.isNotEmpty() &&
                    norm(web[k]) >= vals.min() - tol[k] && norm(web[k]) <= vals.max() + tol[k] }
                check(ok, "$name/$lbl t=${st.toInt()} $key web ${web.map { Math.round(it * 1000) / 1000.0 }} vs native ${cands.map { c -> c.take(web.size).map { Math.round(it * 1000) / 1000.0 } }}")
            }
            fun mx(o: JSONObject?): List<Double>? { o ?: return null; val op = o.optString("opacity").toDoubleOrNull() ?: return null; val m = matrix(o.optString("transform")); return listOf(op, m[0], m[5]) }
            mx(smp.optJSONObject("dialog"))?.let { motion("dialog", it, listOf(.03, .006, .35)) }
            smp.optJSONObject("scrim")?.optString("opacity")?.toDoubleOrNull()?.let { motion("scrim", listOf(it), listOf(.03)) }
            mx(smp.optJSONObject("dialWrap"))?.let { motion("mode-dial", it, listOf(.03, .006, .35)) }
            mx(smp.optJSONObject("inputArea"))?.let { motion("mode-input", it, listOf(.03, .006, .35)) }
            smp.optJSONObject("hand")?.optDouble("angle", Double.NaN)?.takeIf { !it.isNaN() }?.let { motion("hand", listOf(it), listOf(.8), angle = true) }
            smp.optJSONObject("period")?.let { o -> for ((k, key) in listOf("amBg" to "period-am", "pmBg" to "period-pm")) {
                val css = o.optString(k).takeIf { it.isNotEmpty() } ?: continue; motion(key, premultiplied(css), listOf(.012, .012, .012, .012)) } }
        }
        repeat(6) { advance() }
        // md* events: names and every detail (the clock is pinned as on the oracle page; date strings depend on the time zone).
        val own = setOf("mdOpen", "mdClose", "mdCancel", "mdChange", "mdInput", "mdModeChange", "mdValidityChange")
        val web = webEvents.filter { it.getString("name") in own }.map { text(it.getString("name"), it.opt("detail")) }
        val native = events.filter { it.first in own }.map { text(it.first, it.second) }
        val d0 = native.indices.firstOrNull { it >= web.size || native[it] != web[it] } ?: if (native.size < web.size) native.size else -1
        check(native == web, "$name events differ at $d0: native ${native.drop(maxOf(0, d0 - 1)).take(3)} vs web ${web.drop(maxOf(0, d0 - 1)).take(3)} (${native.size} vs ${web.size})")
        report.put(JSONObject().put("run", name).put("events", native.size).put("webEvents", web.size))
        if (picker?.isOpen == true) { compose.runOnIdle { picker?.hide?.invoke(); Unit }; repeat(6) { advance() } }
        compose.runOnIdle { outside.requestFocus() }; repeat(2) { advance() }
        compose.mainClock.autoAdvance = true
    }
    private fun phaseEnd(name: String, lbl: String, ph: JSONObject) {
        val ss = ph.getJSONArray("samples"); val last = if (ss.length() > 0) ss.getJSONObject(ss.length() - 1) else return
        val pk = picker ?: run { check(false, "$name/$lbl mounted"); return }; val label = "$name/$lbl"
        check(pk.committedValue == last.optString("value"), "$label value ${pk.committedValue} vs ${last.optString("value")}")
        check(pk.isOpen == last.optBoolean("open"), "$label open ${pk.isOpen} vs ${last.opt("open")}")
        val nf = focusedPart(); val wf = last.optString("active", "body")
        check(nf == wf, "$label focus $nf vs $wf")
        if (!pk.isOpen) return
        for ((key, id) in listOf("hour" to "input-hour", "minute" to "input-minute")) {
            val o = last.optJSONObject(key) ?: continue
            val text = if (key == "hour") pk.hourBuffer else pk.minuteBuffer
            check(text == o.optString("value"), "$label $key text $text vs ${o.optString("value")}")
            val invalid = if (key == "hour") pk.hourError else pk.minuteError
            check(invalid == (!o.has("valuenow") || o.isNull("valuenow")), "$label $key invalid $invalid vs valuenow ${o.opt("valuenow")}")
            if (last.has("status") && !last.isNull("status")) {
                val active = pk.selecting == key; val webActive = last.optString("status") == (if (key == "hour") "Hour" else "Minute")
                check(active == webActive, "$label $key active $active vs status ${last.optString("status")}")
            }
        }
        last.optJSONObject("period")?.let { o -> check((pk.period == "AM") == (o.optString("am") == "true"), "$label period AM ${pk.period == "AM"} vs ${o.optString("am")}") }
        if (last.has("dialMode") && !last.isNull("dialMode")) {
            val web = if (last.optString("dialMode").contains("--minute")) "minute" else "hour"
            check(pk.selecting == web, "$label dial mode ${pk.selecting} vs $web")
            last.optJSONObject("hand")?.let { h ->
                val target = h.optString("inline").removePrefix("rotate(").removeSuffix("deg)").toDoubleOrNull() ?: Double.NaN
                check(abs(pk.handTarget - target) < .01, "$label hand target ${pk.handTarget} vs $target")
                val length = (h.optString("length").removeSuffix("%").toDoubleOrNull() ?: Double.NaN) / 100
                check(abs(pk.handLength - length) < .001, "$label hand length ${pk.handLength} vs $length")
            }
            val web2 = if (last.isNull("activeNumber")) null else last.optString("activeNumber")
            check(pk.activeNumber == web2, "$label active number ${pk.activeNumber} vs $web2")
        }
        if (last.has("status") && !last.isNull("status")) {
            val status = if (pk.selecting == "hour") "Hour" else "Minute"
            check(status == last.optString("status"), "$label status $status vs ${last.optString("status")}")
        }
    }
}
