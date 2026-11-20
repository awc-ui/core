package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Button family interaction and motion against Mac Chrome 153 trusted-input records (gate-7 R1-03a–f; button-family/web-reference:
 * runs.js, states.html and the reduced-motion set): pointer hover/press/release/leave/click, keyboard (Tab, Enter/Space, arrows,
 * Escape), hard/soft disabled, property and method driven motion (FAB extend/collapse, setMenuIcon, split trailing check), FAB menu
 * open/close/roving. The recorded actions replay on the test clock at Chrome's times (a click presses one frame before Chrome's
 * ripple wave starts and releases at Chrome's click). Checked per phase: md* events (order, target tag), focus, the root's border
 * box per frame against Chrome's samples (±1 Chrome frame) and every flat pixel of Chrome's phase screenshot against the frames
 * inside Chrome's capture window [shotStart, shotEnd]. Instrumentation args: familyOnly, familyComps.
 */
@OptIn(ExperimentalTestApi::class)
class NativeButtonFamilyStatesTest {
    @get:Rule val compose = createComposeRule()
    private var run by mutableStateOf<JSONObject?>(null)
    private var reduced by mutableStateOf(false); private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector(); private val fab = AWCFabController()
    private val events = mutableListOf<Triple<String, String, String>>()
    private val before = FocusRequester(); private val focus = mutableMapOf<String, Boolean>()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) {
        val r = run
        AWCTheme(r?.optString("theme") == "dark") { AWCButtonReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            Box(Modifier.absoluteOffset(1000.dp, 10.dp).size(60.dp, 32.dp).focusRequester(before).onFocusChanged { focus["before"] = it.isFocused }.focusable())
            if (r != null) AWCFabControllerScope(fab) {
                // Events are observed in the capture phase at the document, as the Chrome record (document capture listeners).
                AWCActionScope(onAction = {}, id = "document", onCapture = { e -> if (e.name.startsWith("md")) events += Triple(e.name, e.tag, e.targetID) }) {
                    FamilyScene(r, collector, { _, _, _, _ -> }) { path, has -> focus[path] = has }
                }
            }
            Box(Modifier.absoluteOffset(10.dp, 860.dp).size(40.dp, 20.dp).onFocusChanged { focus["after"] = it.isFocused }.focusable())
        } } } }
    } } }
    @Test fun buttonFamilyInteractionMatchesChrome() {
        content()
        compose.mainClock.autoAdvance = false
        FamilyWeb.viewport = compose.onRoot().fetchSemanticsNode().size.width / 2.0
        val args = InstrumentationRegistry.getArguments(); val only = args.getString("familyOnly"); val comps = args.getString("familyComps")?.split(",")?.toSet()
        for ((file, red) in listOf("ButtonFamilyWebStates" to false, "ButtonFamilyWebStatesReduced" to true))
            for (r in CardWeb.document("$file.json").getJSONArray("runs").objects())
                if ((only == null || r.getString("name").contains(only)) && (comps == null || r.getString("comp") in comps)) runCase(r, red, file)
        AccordionEvidence.log("button-family-states", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(6000).map { it.take(400) })).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    /** The node at an index path ("n0-1") in the run's tree. */
    private fun tagAt(r: JSONObject, path: String): String {
        val parts = path.removePrefix("n").split("-").map { it.toInt() }
        var n = FamilyWeb.nodes(r)[parts[0]]
        for (i in parts.drop(1)) n = FamilyWeb.kids(n)[i]
        return n.optString("tag", "other")
    }
    /** Focused element as Chrome reports document.activeElement's host: the deepest node holding focus. */
    private fun active(r: JSONObject): String {
        if (focus["before"] == true) return "before"; if (focus["after"] == true) return "after"
        val path = focus.filter { it.value && it.key.startsWith("n") }.keys.maxByOrNull { it.count { c -> c == '-' } } ?: return "body"
        return if (r.optString("comp") == "fab-menu" && path == "n0") "fm-anchor" else tagAt(r, path)
    }
    private val keys = mapOf("Tab" to Key.Tab, "Enter" to Key.Enter, "Space" to Key.Spacebar, "Escape" to Key.Escape, "ArrowLeft" to Key.DirectionLeft,
        "ArrowRight" to Key.DirectionRight, "ArrowUp" to Key.DirectionUp, "ArrowDown" to Key.DirectionDown, "Home" to Key.MoveHome, "End" to Key.MoveEnd)
    private fun runCase(r0: JSONObject, red: Boolean, file: String) {
        val name = (if (red) "reduced/" else "") + r0.getString("name")
        android.util.Log.i("AWCAccordion", "button-family-states run $name")
        // Away: an empty spot inside the root (a mouse gesture cannot start outside the Compose root).
        val away = Offset(((FamilyWeb.viewport - 4) * 2).toFloat(), 1190f * 2)
        // Leaving (the run's "away" step) takes the pointer out of the root, a hover exit, as NativeButtonInteractionTest's away: the
        // test mouse does not re-enter hover after a button release (Android's input pipeline sends HOVER_ENTER there), so an in-root
        // move after a click never reaches the released node's hover.
        val gone = Offset((FamilyWeb.viewport * 2 + 400).toFloat(), 1200f)
        fun mouse(block: MouseInjectionScope.() -> Unit) = compose.onRoot().performMouseInput(block)
        mouse { moveTo(gone, 0) }
        events.clear(); collector.clear(); focus.clear(); reduced = red; run = r0; epoch++
        compose.mainClock.advanceTimeBy(400); compose.waitForIdle()
        var r = r0; val dx = FamilyWeb.shift(r0)
        val rest = r.optJSONArray("rest")?.optJSONObject(0)
        collector.snapshot().nodes.firstOrNull { it.id == "component" }.let { n ->
            check(n != null && rest != null && abs(n.bounds.x + dx - rest.getDouble("x")) <= 1.0 && abs(n.bounds.y - rest.getDouble("y")) <= .75 && abs(n.bounds.width - rest.getDouble("width")) <= 1.0 && abs(n.bounds.height - rest.getDouble("height")) <= .75,
                "$name rest box ${n?.bounds} vs $rest") }
        val phases = r.getJSONArray("phases").objects(); val anims = r.getJSONArray("anims").objects(); val webEvents = r.getJSONArray("events").objects()
        val webT0 = phases[0].getDouble("t")
        // Points off the emulator screen (an outside click far from the scene) are clamped inside the root: still outside the scene.
        fun pt(a: JSONObject) = if (a.has("x") && !a.isNull("x")) Offset(((a.getDouble("x").toFloat() - dx) * 2).coerceIn(1f, (FamilyWeb.viewport * 2 - 2).toFloat()), (a.getDouble("y").toFloat() * 2).coerceIn(1f, 2398f)) else away
        val steps = mutableListOf<Pair<Double, () -> Unit>>()
        for (ph in phases) {
            val label = ph.getString("label"); val t = ph.getDouble("t"); val acts = ph.getJSONArray("actions").objects()
            val due = acts.map { it.optDouble("t", t) - webT0 }.toMutableList()
            // A click (down + up in one phase): Chrome's wave starts the frame after the press and the click follows the release.
            val d = acts.indexOfFirst { it.getString("type") == "down" }; val u = acts.indexOfFirst { it.getString("type") == "up" }
            if (d >= 0 && u >= 0) {
                val wave = anims.firstOrNull { it.optString("phase") == label && it.optString("target").contains("ripple__wave") && !it.isNull("startTime") }?.getDouble("startTime")
                val click = webEvents.firstOrNull { it.getString("name") == "click" && it.getDouble("t") >= t && it.getDouble("t") <= t + 200 }?.getDouble("t")
                if (wave != null) due[d] = max(due[d], wave - 16 - webT0)
                due[u] = max(due[d] + 4, (click ?: (due[u] + webT0)) - webT0)
            }
            // A property set / method call: apply it one frame before the Chrome frame where the root box starts to move (Chrome's
            // transition starts on the frame after the set; the native one after the recomposition that the set causes).
            val samples0 = ph.getJSONArray("samples").objects()
            fun rootRect(x: JSONObject) = x.getJSONArray("comps").optJSONObject(0)?.optJSONObject("rect")
            val k = (1 until samples0.size).firstOrNull { j -> val a = rootRect(samples0[j]); val b = rootRect(samples0[0]); a != null && b != null && (abs(a.getDouble("width") - b.getDouble("width")) > .01 || abs(a.getDouble("height") - b.getDouble("height")) > .01) }
            if (k != null) for (j in acts.indices) if (acts[j].getString("type") in setOf("set", "call")) due[j] = max(0.0, min(due[j], samples0[k - 1].getDouble("t") - 16 - webT0))
            for ((i, a) in acts.withIndex()) { val act: () -> Unit = when (a.getString("type")) {
                "move" -> { { mouse { moveTo(pt(a), 0) } } }
                "down" -> { { mouse { moveTo(pt(a), 0); press() } } }
                // After a button release Android's input pipeline re-enters hover (HOVER_ENTER); the test mouse does not, so the
                // released node would never see the pointer leave. Leave the root and come back at the same point instead.
                "up" -> { { mouse { moveTo(pt(a), 0); release(); moveTo(gone, 0); moveTo(pt(a), 0) } } }
                "away" -> { { mouse { moveTo(gone, 0) } } }
                "key" -> { { keys[a.getString("key")]?.let { k -> compose.onRoot().performKeyInput { pressKey(k) } } } }
                "focusBefore" -> { { mouse { moveTo(away, 0) }; compose.runOnIdle { before.requestFocus() } } }
                "set" -> { { r = FamilyWeb.set(r, a); run = r } }
                "call" -> { { if (a.getString("method") == "setMenuIcon") fab.setMenuIcon(a.getJSONArray("args").let { if (it.length() == 0 || it.isNull(0)) null else it.getString(0) }) } }
                else -> { {} }
            }; steps += due[i] to act }
        }
        steps.sortBy { it.first }
        fun windowFor(i: Int): Pair<Double, Double> { val ph = phases[i]; val next = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else max(ph.getDouble("t") + 500, ph.optDouble("shotEnd", 0.0) + 1)
            return (ph.optDouble("shotStart", next) - 4) to min(ph.optDouble("shotEnd", next), next) }
        val clip = r.getJSONObject("clip")
        var lastImage: androidx.compose.ui.graphics.ImageBitmap? = null
        fun grab() = CardWeb.nativeGrid(compose.onRoot().captureToImage().also { lastImage = it }.toPixelMap(), clip.getInt("x") - dx, clip.getInt("y"), clip.getInt("width"), clip.getInt("height")).let { CardWeb.Grid(clip.getInt("x"), it.y, it.w, it.h, it.v) }
        // Each frame inside a phase's capture window is compared at once (only the best result is kept: grids are large).
        val webGrids = mutableMapOf<Int, CardWeb.Grid>(); val best = mutableMapOf<Int, JSONObject>(); val bestImage = mutableMapOf<Int, androidx.compose.ui.graphics.ImageBitmap?>(); val tried = mutableMapOf<Int, JSONArray>(); val prevGrid = mutableMapOf<Int, CardWeb.Grid>(); val focusAt = mutableMapOf<Int, String>(); val boxes = mutableMapOf<Int, MutableList<Pair<Double, AWCInspectionBounds>>>()
        val clock0 = compose.mainClock.currentTime
        fun now() = webT0 + (compose.mainClock.currentTime - clock0).toDouble()
        val end = phases.indices.maxOf { windowFor(it).second } + 20; var next = 0
        while (now() < end) {
            while (next < steps.size && now() - webT0 >= steps[next].first) { steps[next].second(); next++ }
            compose.mainClock.advanceTimeByFrame(); compose.waitForIdle()
            val t = now(); val i = phases.indexOfLast { it.getDouble("t") <= t }.coerceAtLeast(0)
            collector.snapshot().nodes.firstOrNull { it.id == "component" }?.let { boxes.getOrPut(i) { mutableListOf() } += t to it.bounds }
            for (k in phases.indices) { val (a, b) = windowFor(k); if (t in a..b) {
                val web = webGrids.getOrPut(k) { CardWeb.webGrid("$file/${r.getString("name")}-${phases[k].getString("label")}.png", clip) }
                val g = grab(); val res = CardWeb.compare(web, g).put("frame", t); tried.getOrPut(k) { JSONArray() }.put(JSONArray().put(t).put(res.getDouble("mean")))
                val o = best[k]; if (o == null || (familyOk(res) && !familyOk(o)) || (familyOk(res) == familyOk(o) && res.getDouble("mean") < o.getDouble("mean"))) { best[k] = res; bestImage[k] = lastImage }
                // Chrome photographs on demand at any moment of its animation clock, the test clock steps 16 ms: when no frame matches
                // and two neighbouring distinct frames straddle Chrome's image (signed mean of opposite sign), Chrome is compared with
                // their blend (1 - w)·A + w·B, w in 0.05 steps, same thresholds (md-button's states fixture, di-054).
                val p = prevGrid[k]; prevGrid[k] = g
                if (p != null && !familyOk(best.getValue(k))) {
                    fun signed(a: CardWeb.Grid): Double { var s = 0.0; var n = 0; for (j in a.v.indices) if (a.v[j] > -900 && web.v[j] > -900) { s += a.v[j] - web.v[j]; n++ }; return if (n == 0) 0.0 else s / n }
                    val sa = signed(p); val sb = signed(g)
                    if (sa * sb < 0) for (step in 1..19) { val w = step / 20.0
                        val cand = CardWeb.compare(web, CardWeb.Grid(g.x, g.y, g.w, g.h, DoubleArray(g.v.size) { j -> if (g.v[j] < -900 || p.v[j] < -900) -999.0 else (1 - w) * p.v[j] + w * g.v[j] })).put("frame", t).put("bracket", w)
                        val o2 = best.getValue(k); if ((familyOk(cand) && !familyOk(o2)) || (familyOk(cand) == familyOk(o2) && cand.getDouble("mean") < o2.getDouble("mean"))) { best[k] = cand; bestImage[k] = lastImage } }
                }
                focusAt[k] = active(r) } else if (webGrids.remove(k) != null) { prevGrid.remove(k)
                    // A failing phase keeps its best native frame (files/accordion/png/states-<run>-<phase>.png), then drops it.
                    val b = best[k]; val img = bestImage.remove(k); if (b != null && img != null && !familyOk(b)) AccordionEvidence.png("states-${name.replace('/', '-')}-${phases[k].getString("label")}", img) } }
        }
        compose.mainClock.advanceTimeBy(150); compose.waitForIdle()
        val mine = events.map { "${it.first}@${it.second}" }
        val theirs = webEvents.filter { it.getString("name") != "click" }.map { "${it.getString("name")}@${it.getJSONObject("target").getString("tag")}" }
        check(mine == theirs, "$name events $mine vs $theirs")
        val allSamples = phases.flatMap { it.getJSONArray("samples").objects() }
        fun norm(s: String) = if (s in setOf("body", "before", "after", "fm-anchor") || s.startsWith("md-")) s else "other"
        for ((i, ph) in phases.withIndex()) {
            val label = ph.getString("label"); val web = ph.optJSONObject("active")?.optString("host") ?: "body"
            // Tab past the page's last stop: Chrome hands focus to the browser UI (activeElement = body); the native focus order wraps.
            val leftPage = web == "body" && i > 0 && phases[i - 1].optJSONObject("active")?.optString("host") == "after" && ph.getJSONArray("actions").objects().any { it.optString("key") == "Tab" }
            val mine = focusAt[i] ?: active(r)
            check(norm(mine) == norm(web) || (leftPage && mine in setOf("before", "body")), "$name/$label focus $mine vs $web")
            val samples = ph.getJSONArray("samples").objects()
            for ((t, b) in boxes[i].orEmpty()) {
                // Chrome frames shown within one frame of t: samples within ±17 ms and the frame still on screen 17 ms before.
                val before = allSamples.lastOrNull { it.getDouble("t") < t - 17 }
                // Before the first sample the frame on screen is the rest frame (a set at the run's start).
                val near = (allSamples.filter { abs(it.getDouble("t") - t) <= 17 } + listOfNotNull(before)).mapNotNull { it.getJSONArray("comps").optJSONObject(0)?.getJSONObject("rect") } +
                    listOfNotNull(if (before == null) rest else null)
                if (near.isEmpty()) continue
                val ws = near.map { it.getDouble("width") }; val hs = near.map { it.getDouble("height") }
                check(b.width in ws.minOrNull()!! - 1.5..ws.maxOrNull()!! + 1.5 && b.height in hs.minOrNull()!! - 1.5..hs.maxOrNull()!! + 1.5, "$name/$label box at +${(t - ph.getDouble("t")).toInt()} ms ${b.width}×${b.height} vs Chrome ${ws.zip(hs)}")
            }
            val res = best[i] ?: JSONObject().put("compared", 0).put("mean", 99.0).put("over6", 0)
            check(familyOk(res), "$name/$label flat pixels ${res.put("tried", tried[i] ?: JSONArray())}"); report.put(res.put("case", "$name/$label"))
        }
        mouse { moveTo(gone, 0) }
    }
}
