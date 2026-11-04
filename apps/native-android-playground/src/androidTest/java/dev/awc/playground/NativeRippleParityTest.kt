package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.nativeui.generated.AWCGeneratedTokens
import dev.awc.playground.CardWeb.objects
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * md-ripple against Chrome (ripple/{paint,motion,behaviour}.html, DPR 1, canonical dist): 160 frozen paint frames
 * (wave box, scale, opacity, colour and every flat pixel), per-frame motion within Chrome's frame envelope with removal
 * times, and the lifecycle/ownership/method scenarios — on the frame clock, through real pointer input.
 */
@OptIn(ExperimentalTestApi::class)
class NativeRippleParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"w\":120,\"h\":60,\"radius\":12}"))
    private var epoch by mutableIntStateOf(0)
    private var frame by mutableStateOf<AWCRippleFrame?>(null)
    private var mounted by mutableStateOf(true)
    private var alternate by mutableStateOf(false)
    private var disabledOverride by mutableStateOf<Boolean?>(null)
    private var suppressedOverride by mutableStateOf<Boolean?>(null)
    private var hooksOverride by mutableStateOf<AWCRippleAppearance?>(null)
    private val controller = AWCRippleController()
    private lateinit var scope: CoroutineScope
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun hex(v: String?) = Color(android.graphics.Color.parseColor(v!!))
    private fun app(h: JSONObject?) = if (h == null) AWCRippleAppearance() else AWCRippleAppearance.cssValues(h.keys().asSequence().associateWith { h.getString(it) })
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
        val c = case; val dark = c.optString("theme") == "dark"; val t = if (dark) AWCGeneratedTokens.dark else AWCGeneratedTokens.light
        scope = rememberCoroutineScope()
        val w = if (alternate) 90.0 else c.optDouble("w", 120.0); val h = if (alternate) 50.0 else c.optDouble("h", 60.0); val r = if (alternate) 8.0 else c.optDouble("radius", 12.0)
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(hex(t["--md-sys-color-surface"]))) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr,
                LocalAWCRippleFrame provides frame, LocalAWCRippleController provides controller,
                LocalAWCRippleHostCornerRadius provides (if (c.optBoolean("boxless")) 0.0 else r).dp, LocalAWCRippleContentColor provides hex(t["--md-sys-color-on-surface"]),
                LocalAWCRippleEnabled provides !(suppressedOverride ?: c.optBoolean("suppressed")), LocalAWCRippleAppearance provides app(c.optJSONObject("inherited"))) {
                Box(Modifier.absoluteOffset(40.dp, 40.dp).size(w.dp, h.dp).background(if (alternate) Color(0xFFDDDDDD) else hex(t["--md-sys-color-surface-container-highest"]), RoundedCornerShape(r.dp))) {
                    if (mounted) CompositionLocalProvider(LocalAWCRippleAppearance provides LocalAWCRippleAppearance.current.merging(hooksOverride ?: app(c.optJSONObject("hooks")))) {
                        AWCComponent("md-ripple", buildMap { if (disabledOverride ?: c.optBoolean("disabled")) put("disabled", true); if (c.optBoolean("hidden")) put("hidden", true) })
                    }
                }
            }
        } } }
    } } }
    private fun idle(ms: Long = 32) { compose.waitForIdle(); compose.mainClock.advanceTimeBy(ms); compose.waitForIdle() }
    private fun px(x: Double, y: Double) = Offset(((40 + x) * 2).toFloat(), ((40 + y) * 2).toFloat())
    private val origins = mapOf<String, (Double, Double) -> Pair<Double, Double>>("corner" to { _, _ -> 6.0 to 5.0 }, "far" to { w, h -> w - 7 to h - 4 })
    private fun scale(t: String) = if (t == "none" || t.isEmpty()) 1.0 else t.substringAfter("(").substringBefore(",").trim().toDouble()

    @Test fun rippleMatchesChromePaint() {
        content()
        for (c in CardWeb.document("RippleWebPaint.json").getJSONArray("cases").objects()) paint(c)
        AccordionEvidence.log("ripple-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(300))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun paint(c: JSONObject) {
        val name = c.getString("name"); val phase = c.getString("phase"); val t = c.optDouble("t", 0.0)
        android.util.Log.i("AWCAccordion", "ripple-paint case $name")
        frame = if (phase == "held") AWCRippleFrame.Held else AWCRippleFrame.Grow(if (phase == "grow") t else 0.0)
        mounted = true; alternate = false; disabledOverride = null; suppressedOverride = null; hooksOverride = null
        case = c; epoch++; idle(64)
        val w = c.optDouble("w", 120.0); val h = c.optDouble("h", 60.0); val right = c.optString("button") == "right"
        var down: Offset? = null
        if (c.optString("origin") == "center" || w == 0.0) compose.runOnIdle { controller.trigger() }
        else { down = px(c.getDouble("px"), c.getDouble("py"))
            if (right) compose.onRoot().performMouseInput { moveTo(down!!); press(MouseButton.Secondary) } else compose.onRoot().performTouchInput { down(down!!) } }
        idle()
        if (phase == "fade" && down != null) { compose.onRoot().performTouchInput { up() }; down = null; idle(); frame = AWCRippleFrame.Fade(t) }
        idle()
        val s = c.getJSONObject("snap"); val wave = controller.wave; val webWaves = s.getInt("waves")
        check((if (wave != null) 1 else 0) == webWaves, "$name waves ${wave != null} vs $webWaves")
        if (webWaves > 0 && wave != null) { val ww = s.getJSONObject("wave")
            fun near(a: Double, b: Double, l: String, tol: Double = .05) = check(abs(a - b) <= tol, "$name $l $a vs $b")
            near(wave.x - wave.radius, ww.getDouble("left"), "wave left"); near(wave.y - wave.radius, ww.getDouble("top"), "wave top"); near(2 * wave.radius, ww.getDouble("size"), "wave size")
            // A hidden (display:none) ripple keeps its wave but Chrome reports no transform for it; nothing paints.
            if (!c.optBoolean("hidden")) { near(wave.scale, scale(ww.getString("transform")), "wave scale", .001); near(wave.opacity, ww.getDouble("opacity"), "wave opacity", .0015) }
        }
        val clip = c.getJSONObject("clip")
        val nat = CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(), clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
        val res = CardWeb.compare(CardWeb.webGrid("RippleWebPaint/$name.png", clip), nat)
        check(res.getInt("compared") > 300 && res.getInt("over6").toDouble() / res.getInt("compared") <= .005 && res.getDouble("mean") <= 1.0, "$name flat pixels $res"); report.put(res.put("case", name))
        if (down != null) { if (right) compose.onRoot().performMouseInput { release(MouseButton.Secondary) } else compose.onRoot().performTouchInput { up() } }
        frame = null; idle()
    }

    /** Two Chrome frames either way (lead 2f + 7 ms, trail 2f + 1 ms; f = Chrome's measured frame interval, 40/34 ms at 60 fps): Chrome starts a Web Animation on the frame after it is created, starts the fade on the frame after the grow's finished promise and observes removal at its next frame. */
    private var lead = 40.0; private var trail = 34.0
    private fun within(web: List<List<Pair<Double, Double?>>>, t: Double, v: Double, tol: Double): Boolean {
        var lo = Double.POSITIVE_INFINITY; var hi = Double.NEGATIVE_INFINITY
        for (rep in web) for ((i, f) in rep.withIndex()) { val fv = f.second ?: continue
            if (f.first >= t - lead && f.first <= t + trail) { lo = minOf(lo, fv); hi = maxOf(hi, fv) }
            if (i + 1 < rep.size) { val nv = rep[i + 1].second ?: continue
                for (edge in listOf(t - lead, t + trail)) if (f.first < edge && rep[i + 1].first > edge) { val x = fv + (nv - fv) * (edge - f.first) / (rep[i + 1].first - f.first); lo = minOf(lo, x); hi = maxOf(hi, x) } } }
        return lo == Double.POSITIVE_INFINITY || (v >= lo - tol && v <= hi + tol)
    }
    @Test fun rippleMotionMatchesChrome() {
        content(); compose.mainClock.autoAdvance = false
        val all = CardWeb.document("RippleWebMotion.json").getJSONArray("cases").objects().toList()
        for (name in all.map { it.getString("name") }.distinct()) {
            val reps = all.filter { it.getString("name") == name }; val c = reps[0]
            frame = null; mounted = true; alternate = false; case = JSONObject().put("name", name).put("w", 120).put("h", 60).put("radius", 12).put("hooks", c.optJSONObject("hooks") ?: JSONObject()); epoch++; idle(64)
            // Each wave exists from the press at scale 0 (and its first opacity) until Chrome's first sampled frame.
            fun series(k: String) = reps.map { r -> val f = r.getJSONArray("frames").objects().map { it.getDouble("t") to (if (it.isNull(k)) null else it.getDouble(k)) }
                listOf(0.0 to (if (k == "scale") 0.0 else f.firstOrNull { it.second != null }?.second)) + f }
            val gaps = reps.flatMap { r -> r.getJSONArray("frames").objects().map { it.getDouble("t") }.zipWithNext { a, b -> b - a } }.sorted()
            val fi = if (gaps.isEmpty()) 16.7 else gaps[gaps.size / 2]; lead = 2 * fi + 7; trail = 2 * fi + 1
            val sc = series("scale"); val op = series("opacity")
            val removal = reps.mapNotNull { r -> val f = r.getJSONArray("frames").objects().toList(); val last = f.indexOfLast { it.optInt("waves") > 0 }; if (last >= 0 && last + 1 < f.size) f[last + 1].getDouble("t") else null }
            // Release when Chrome actually released (its setTimeout fired late): the median of the repetitions.
            val releases = reps.filter { it.has("upAt") && !it.isNull("upAt") }.map { it.getDouble("upAt") }.sorted()
            val release = if (releases.isEmpty()) null else releases[releases.size / 2]
            if (c.optBoolean("trigger")) compose.runOnIdle { controller.trigger() } else compose.onRoot().performTouchInput { down(px(6.0, 5.0)) }
            var clock = 0.0; var released = false; var removedAt: Double? = null; var samples = 0; var bad = 0; var first = ""
            while (clock < (release ?: 0.0) + 1400) {
                compose.mainClock.advanceTimeByFrame(); clock += 16.0
                if (release != null && !released && clock >= release) { compose.onRoot().performTouchInput { up() }; released = true }
                val w = compose.runOnIdle { controller.wave }
                if (w == null) { if (removedAt == null && clock > 20) removedAt = clock; continue }
                samples++
                if (!within(sc, w.sinceMs, w.scale, .004) || !within(op, w.sinceMs, w.opacity, .002)) { bad++; if (first.isEmpty()) first = "t=${w.sinceMs} scale ${w.scale} opacity ${w.opacity}" }
            }
            check(samples > 10, "$name sampled $samples"); check(bad == 0, "$name motion within Chrome's envelope ($bad/$samples outside; first $first)")
            check(removedAt != null && removal.isNotEmpty() && removedAt!! >= removal.min() - lead && removedAt!! <= removal.max() + trail, "$name removal $removedAt vs Chrome $removal")
            report.put(JSONObject().put("motion", name).put("samples", samples).put("outside", bad).put("removedAt", removedAt ?: -1.0))
        }
        AccordionEvidence.log("ripple-motion", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures)).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.joinToString("\n"), failures.isEmpty())
    }

    @Test fun rippleBehaviourMatchesChrome() {
        content(); compose.mainClock.autoAdvance = false
        val web = CardWeb.document("RippleWebBehaviour.json").getJSONObject("scenarios")
        fun fresh(o: JSONObject = JSONObject()) { frame = null; mounted = true; alternate = false; disabledOverride = null; suppressedOverride = null; hooksOverride = null
            case = o.put("name", "behaviour").put("w", o.optInt("w", 120)).put("h", o.optInt("h", 60)).put("radius", 12); epoch++; idle(64) }
        fun waves() = compose.runOnIdle { if (controller.wave != null) 1 else 0 }
        fun wave() = compose.runOnIdle { controller.wave }
        val P = px(10.0, 10.0)
        fun press(p: Offset = P) = compose.onRoot().performTouchInput { down(p) }
        fun lift() = compose.onRoot().performTouchInput { up() }
        fun run(ms: Double) { var t = 0.0; while (t < ms) { compose.mainClock.advanceTimeByFrame(); t += 16.0 } }
        fun until(limit: Double = 2000.0): Double? { var t = 0.0; while (t < limit) { compose.mainClock.advanceTimeByFrame(); t += 16.0; if (waves() == 0) return t }; return null }
        fun settled(): Double { var done = false; compose.runOnIdle { scope.launch { controller.whenSettled(); done = true } }; var t = 0.0; while (!done && t < 2000) { compose.mainClock.advanceTimeByFrame(); t += 16.0 }; return t }
        fun near(a: Double?, b: Double, tol: Double) = a != null && abs(a - b) <= tol
        fresh(); compose.onRoot().performMouseInput { moveTo(P); press(MouseButton.Secondary) }; run(32.0)
        check(waves() == web.getJSONObject("secondary").getInt("afterDown"), "secondary button starts no wave"); compose.onRoot().performMouseInput { release(MouseButton.Secondary) }; run(32.0)
        // A second finger's release does not end the first finger's wave (foreign pointer release).
        fresh(); compose.onRoot().performTouchInput { down(0, P) }; run(500.0); compose.onRoot().performTouchInput { down(1, px(60.0, 30.0)) }; compose.onRoot().performTouchInput { up(1) }; run(300.0)
        check(waves() == web.getJSONObject("foreignRelease").getInt("heldAfterForeign") && near(wave()?.opacity, web.getJSONObject("foreignRelease").getDouble("opacity"), .001), "a foreign pointer release leaves the wave held")
        compose.onRoot().performTouchInput { up(0) }; check(near(until(), web.getJSONObject("foreignRelease").getDouble("removedAfterRealUpMs"), 60.0), "the owning release fades the wave")
        fresh(); press(); run(100.0); disabledOverride = true; run(32.0); check(waves() == web.getJSONObject("disableMid").getInt("afterDisable"), "disabling removes the wave"); lift()
        press(); run(32.0); check(waves() == web.getJSONObject("disableMid").getInt("pressWhileDisabled"), "no wave while disabled"); lift()
        disabledOverride = false; run(32.0); compose.runOnIdle { controller.trigger() }; run(32.0); check(waves() == web.getJSONObject("disableMid").getInt("triggerAfterEnable"), "trigger works after re-enabling"); run(700.0)
        fresh(); press(); run(100.0); lift(); press(px(100.0, 50.0)); run(32.0); val rw = web.getJSONObject("replace"); val w1 = wave()
        check(waves() == rw.getInt("waves") && near(w1?.let { it.x - it.radius }, rw.getDouble("left"), .05) && near(w1?.let { 2 * it.radius }, rw.getDouble("size"), .05), "a new press replaces the old wave"); lift(); run(700.0)
        fresh(); press(); run(16.0); var e = settled(); check(e >= 195 && e <= 240 && waves() == 1, "whenSettled() with a held wave returns at the bound ($e)"); lift(); run(400.0)
        fresh(); compose.runOnIdle { controller.trigger() }; run(16.0); e = settled(); check(e >= 195 && e <= 240 && waves() == 1, "whenSettled() after trigger() is bounded ($e)")
        val g = until(); check(near(g?.plus(e)?.plus(16.0), web.getJSONObject("settledTrigger").getDouble("removedMs"), 60.0), "trigger wave removal ${g?.plus(e)} vs ${web.getJSONObject("settledTrigger").getDouble("removedMs")}")
        fresh(); e = settled(); check(e <= 16, "whenSettled() without a wave returns at once ($e)")
        fresh(); hooksOverride = AWCRippleAppearance.cssValues(mapOf("grow-duration" to "0ms")); run(32.0); press(); run(32.0); lift(); e = settled(); check(e <= 220 && waves() == 0, "whenSettled() resolves with the finished fade ($e)")
        fresh(); press(); run(100.0); mounted = false; run(32.0); check(waves() == 0, "removing md-ripple removes its wave"); lift()
        alternate = true; mounted = true; run(64.0); press(px(20.0, 20.0)); run(32.0)
        check(waves() == web.getJSONObject("disconnect").getInt("onNewSurface") && near(wave()?.radius?.times(2), web.getJSONObject("disconnect").getDouble("newWaveSize"), .05), "a reconnected ripple binds to its new surface ${wave()}"); lift(); run(700.0)
        fresh(JSONObject().put("disabled", true)); compose.runOnIdle { controller.trigger() }; run(32.0); check(waves() == web.getJSONObject("triggerDisabled").getInt("waves"), "trigger() while disabled adds nothing")
        fresh(JSONObject().put("suppressed", true)); compose.runOnIdle { controller.trigger() }; run(32.0); val st = waves(); press(); run(32.0)
        check(st == web.getJSONObject("suppressed").getInt("trigger") && waves() == web.getJSONObject("suppressed").getInt("press"), "suppressed ripples allocate nothing"); lift()
        fresh(); press(); run(100.0); suppressedOverride = true; run(32.0); check(waves() == web.getJSONObject("suppressMidflight").getInt("waves"), "suppressing keeps the running wave hidden"); lift(); suppressedOverride = false; run(700.0)
        fresh(); press(px(20.0, 170.0)); run(32.0); check(waves() == web.getJSONObject("outside").getInt("waves"), "a press outside the surface adds nothing"); lift()
        fresh(); press(); run(100.0); lift(); val er = until()?.plus(100.0); check(near(er, web.getJSONObject("earlyRelease").getDouble("removedMs"), 70.0), "early release fades after growth ($er)")
        fresh(); press(); run(1000.0); check(waves() == 1 && near(wave()?.opacity, web.getJSONObject("heldLong").getDouble("opacity"), .001), "a held wave stays at full opacity"); lift()
        check(near(until(), web.getJSONObject("heldLong").getDouble("removedAfterUpMs"), 60.0), "held wave fades 150 ms after release")
        fresh(); hooksOverride = AWCRippleAppearance.cssValues(mapOf("grow-duration" to "0ms")); run(32.0); press(); run(50.0); lift(); check(near(until(), web.getJSONObject("zeroDuration").getDouble("removedAfterUpMs"), 60.0), "zero grow duration fades on release")
        fresh(JSONObject().put("dir", "rtl")); press(); run(32.0); val ro = web.getJSONObject("rtlOrigin"); val w2 = wave()
        check(near(w2?.let { it.x - it.radius }, ro.getDouble("left"), .05) && near(w2?.let { it.y - it.radius }, ro.getDouble("top"), .05), "RTL keeps the physical origin $w2"); lift(); run(700.0)
        fresh(JSONObject().put("hidden", true)); press(); run(32.0); check(waves() == web.getJSONObject("hiddenPress").getInt("waves"), "a hidden ripple still tracks the press"); lift(); run(700.0)
        fresh(JSONObject().put("w", 200).put("h", 80)); compose.runOnIdle { controller.trigger() }; run(32.0); val tc = web.getJSONObject("triggerCentered"); val w3 = wave()
        check(near(w3?.let { it.x - it.radius }, tc.getDouble("left"), .05) && near(w3?.let { 2 * it.radius }, tc.getDouble("size"), .05), "trigger() is centred $w3"); run(700.0)
        fresh(); press(); run(32.0); compose.runOnIdle { controller.trigger() }; run(16.0); val tr = web.getJSONObject("triggerReplace"); val w4 = wave()
        check(waves() == tr.getInt("waves") && near(w4?.let { it.x - it.radius }, tr.getDouble("left"), .05), "trigger() replaces a held wave"); lift(); run(50.0); check(waves() == tr.getInt("afterUp"), "the old press release does not end the trigger wave"); run(700.0)
        AccordionEvidence.log("ripple-behaviour", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures)))
        assertTrue("${failures.size} of $checks failed:\n" + failures.joinToString("\n"), failures.isEmpty())
    }
}
