package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.nativeui.generated.AWCGeneratedTokens
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
 * md-navigation-rail interaction states and motion against Chrome (rail-states.html, Mac Chrome 153; rail-web-states and
 * rail-web-states-reduced, the fixtures of the SwiftUI suite): standard rails with all / selected labels × LTR/RTL, icons only,
 * dark, the modal overlay and horizontal bars — pointer hover/press/release/leave on a destination (state layer, ripple,
 * activation), Tab into the rail (focus ring and layer), the forward arrow, Enter, End, Space, Home, a silent activeIndex write,
 * the toggle (expand, collapse), a mid-flight reversal and expand() (the width transition and the destinations' FLIP), Escape
 * and the scrim in a modal, through real mouse and key input on the frame clock: the events, every phase's settled state
 * (variant, active, tab stops, focus, rings, ripple) and every sampled frame within Chrome's frame envelope (rail width, the
 * modal surface, the scrim; per destination the indicator box and colour, state layer, icon wrapper, icon colour, label box,
 * colour and opacity).
 */
@OptIn(ExperimentalTestApi::class)
class NativeNavigationRailStatesTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\"}"))
    private var nodes by mutableStateOf<List<JSONObject>>(emptyList())
    private var epoch by mutableIntStateOf(0)
    private var reduced by mutableStateOf(false)
    private var box by mutableStateOf(420.0 to 560.0)
    private val scale = 1.25f
    private val probe = AWCNavigationRailProbe()
    private val controller = AWCNavigationRailController()
    private val before = FocusRequester()
    private class Event(val name: String, val target: String, val detail: Any?, val phase: String)
    private val events = mutableListOf<Event>()
    private var phase = ""
    private lateinit var view: android.view.View
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun hex(v: String?) = Color(android.graphics.Color.parseColor(v!!))
    private fun numbers(s: String) = Regex("-?[0-9.]+(e-?[0-9]+)?").findAll(s).mapNotNull { it.value.toDoubleOrNull() }.toList()
    private fun css(s: String): List<Double> { val n = numbers(s)
        return when { s.startsWith("rgba") && n.size >= 4 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, n[3]); s.startsWith("rgb") && n.size >= 3 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, 1.0)
            s.startsWith("color(srgb") && n.size >= 3 -> listOf(n[0], n[1], n[2], if (n.size >= 4) n[3] else 1.0); else -> listOf(0.0, 0.0, 0.0, 0.0) } }
    /** Premultiplied, so a transparent colour compares by its (zero) alpha only. */
    private fun pm(c: List<Double>) = listOf(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3])
    private fun rgba(c: Any?): List<Double>? = (c as? Color)?.let { listOf(it.red.toDouble(), it.green.toDouble(), it.blue.toDouble(), it.alpha.toDouble()) }
    private fun props(o: JSONObject): Map<String, Any?> = buildMap { val p = o.optJSONObject("properties") ?: JSONObject()
        for (k in p.keys()) if (k != "_hooks" && k != "_box") put(k, p.get(k)); put("id", o.getString("id")) }
    @Composable private fun Node(o: JSONObject) {
        val id = o.getString("id"); val kids = o.optJSONArray("children")?.objects() ?: emptyList()
        when (o.getString("tag")) {
            "#text" -> AWCSlotText(o.getJSONObject("properties").getString("text"))
            "#symbol" -> { val p = o.getJSONObject("properties"); val b = p.optDouble("_box", 24.0)
                Box(Modifier.size(b.dp), contentAlignment = Alignment.Center) { AWCMaterialSymbol(p.optString("name"), size = b.dp) } }
            else -> AWCComponent(o.getString("tag"), props(o), onEvent = { n, d -> events += Event(n, id, d, phase) }) { slot ->
                for (k in kids) { if (k.optString("slot").ifEmpty { "" } != slot) continue; key(k.getString("id")) { Node(k) } }
            }
        }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(scale, 1f)) {
        view = LocalView.current
        val c = case; val dark = c.optString("theme") == "dark"; val t = if (dark) AWCGeneratedTokens.dark else AWCGeneratedTokens.light
        // The reference page's body (surface-container-low): what a modal rail's scrim covers.
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(hex(t["--md-sys-color-surface-container-low"]))) { key(epoch) {
            val dir = if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr
            CompositionLocalProvider(LocalAWCNavigationRailProbe provides probe, LocalAWCNavigationRailReducedMotion provides reduced) {
                AWCNavigationRailControllerScope(controller) {
                    // #before precedes the rail in the Tab order.
                    Box(Modifier.size(1.dp).focusRequester(before).focusable())
                    Box(Modifier.absoluteOffset(24.dp, 24.dp).requiredSize(box.first.dp, box.second.dp)) {
                        CompositionLocalProvider(LocalLayoutDirection provides dir) { Column(Modifier.fillMaxWidth()) { for (n in nodes) key(n.getString("id")) { Node(n) } } }
                    }
                }
            }
        } } }
    } } }
    private fun frame() { compose.mainClock.advanceTimeByFrame() }
    private fun advance(ms: Double) { var t = 0.0; while (t < ms) { frame(); t += 16.0 } }
    private fun px(x: Double, y: Double) = Offset((x * scale).toFloat(), (y * scale).toFloat())
    private fun sendKey(code: Int) = compose.runOnIdle { view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_DOWN, code, 0, 0)); view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_UP, code, 0, 0)) }
    private val railNode get() = nodes.first { it.getString("tag") == "md-navigation-rail" }
    private val tabIDs get() = (railNode.optJSONArray("children")?.objects() ?: emptyList()).filter { it.optString("tag") == "md-navigation-rail-tab" }.map { it.getString("id") }
    @Suppress("UNCHECKED_CAST") private fun origin(r: Map<String, Any?>) = (r["origin"] as? List<Double>) ?: listOf(24.0, 24.0)
    @Suppress("UNCHECKED_CAST") private fun abs4(r: Map<String, Any?>, v: Any?): List<Double>? = (v as? List<Double>)?.let { val o = origin(r); listOf(it[0] + o[0], it[1] + o[1], it[2], it[3]) }
    private fun tabCentre(i: Int): Offset? = compose.runOnIdle {
        val r = probe.rail; val m = probe.tabs[tabIDs[i]] ?: return@runOnIdle null
        @Suppress("UNCHECKED_CAST") val t = abs4(r, (m["rects"] as Map<String, Any?>)["tab"]) ?: return@runOnIdle null
        px(t[0] + t[2] / 2, t[1] + t[3] / 2) }
    private fun toggleCentre(): Offset? = compose.runOnIdle { val r = probe.rail; abs4(r, r["toggle"])?.let { px(it[0] + it[2] / 2, it[1] + it[3] / 2) } }

    @Test fun railMatchesChromeStates() {
        content()
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("railOnly")
        for ((file, red) in listOf("rail-web-states.json" to false, "rail-web-states-reduced.json" to true))
            for (r in CardWeb.document(file).getJSONArray("runs").objects()) if (only == null || only.split(',').any { r.getString("name").contains(it) }) run(r, red)
        AccordionEvidence.log("rail-states", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(800))).put("report", report))
        android.util.Log.i("AWCRail", "rail-states ${checks - failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }

    /** One native frame: rail [host width, surface x, y, w, h, scrim] and per destination [indicator x, y, w, h, colour premultiplied
     *  r, g, b, a, layer, icon wrapper x, y, icon colour r, g, b, a, label x, y, label colour r, g, b, a, label opacity]. */
    private class Frame(val t: Double, val rail: List<Double>, val tabs: Map<Int, Pair<Double, Array<Double?>>>)
    @Suppress("UNCHECKED_CAST")
    private fun sample(t0: Double): Frame = compose.runOnIdle {
        val now = compose.mainClock.currentTime - t0
        val r = probe.rail
        val host = r["host"] as? List<Double>; val cont = abs4(r, r["container"])
        val rail = if (host == null || cont == null) emptyList() else listOf(host[2]) + cont + listOf((r["scrim"] as? Double) ?: 0.0)
        val tabs = HashMap<Int, Pair<Double, Array<Double?>>>()
        for ((i, id) in tabIDs.withIndex()) {
            val m = probe.tabs[id] ?: continue; val rects = m["rects"] as Map<String, Any?>
            val v = arrayOfNulls<Double>(22)
            abs4(r, rects["indicator"])?.let { for (k in 0..3) v[k] = it[k] }
            rgba(m["indicatorColor"])?.let { c -> val p = pm(c); for (k in 0..3) v[4 + k] = p[k] }
            v[8] = m["layerOpacity"] as? Double
            abs4(r, rects["iconWrapper"])?.let { v[9] = it[0]; v[10] = it[1] }
            rgba(m["iconColor"])?.let { c -> for (k in 0..3) v[11 + k] = c[k] }
            abs4(r, rects["label"])?.let { l -> v[15] = l[0]; v[16] = l[1]
                rgba(m["labelColor"])?.let { c -> for (k in 0..3) v[17 + k] = c[k] }
                v[21] = m["labelOpacity"] as? Double }
            // A destination settled at its last render (nothing running) or not rendered since the action holds that render now.
            val rt = ((m["renderTime"] as? Double) ?: 0.0) - t0
            tabs[i] = (if (rt < 0 || m["animating"] == false) now.toDouble() else rt) to v
        }
        Frame(now.toDouble(), rail, tabs)
    }
    private fun within(vals: List<Double>, w: Double, tol: Double) = vals.any { abs(it - w) <= tol } || (vals.size >= 2 && vals.min() - tol <= w && w <= vals.max() + tol)

    /** When Chrome's expand / collapse transitions started in a phase (ms after its start): the rail width, the modal scrim or a
     *  destination's FLIP animation, whichever is first. */
    private fun clickStart(r: JSONObject, ph: JSONObject): Double? {
        val t = ph.getDouble("t")
        return (r.optJSONArray("anims")?.objects() ?: emptyList()).mapNotNull { a ->
            val st = a.optDouble("startTime", -1.0); if (st < t || st > t + 300) return@mapNotNull null
            val target = a.optString("target"); val prop = a.optString("property")
            val rail = prop in setOf("width", "min-width", "max-width") && target.startsWith("md-navigation-rail ")
            val scrim = target.endsWith(" scrim") && prop == "opacity"
            val flip = target.startsWith("md-navigation-rail-tab[") && target.endsWith(" indicator") && prop == "animation"
            if (rail || scrim || flip) st - t else null
        }.minOrNull()
    }
    /** When Chrome's mousedown landed in a phase (ms after its start): its press ripple's start. */
    private fun pressStart(r: JSONObject, ph: JSONObject): Double? {
        val t = ph.getDouble("t")
        return (r.optJSONArray("anims")?.objects() ?: emptyList()).mapNotNull { a ->
            val st = a.optDouble("startTime", -1.0); if (st < t || st > t + 300) return@mapNotNull null
            if (a.optString("target").startsWith("md-ripple") && a.optString("property") == "animation" && a.optJSONObject("from")?.optString("transform") == "scale(0)") st - t else null
        }.minOrNull()
    }
    private fun run(r: JSONObject, red: Boolean) {
        val name = (if (red) "reduced " else "") + r.getString("name")
        compose.mainClock.autoAdvance = false
        compose.onRoot().performMouseInput { moveTo(px(1190.0, 890.0)) }
        reduced = red; case = r; nodes = JSONArray(r.getString("nodesJSON")).objects()
        val horizontal = railNode.optJSONObject("properties")?.optString("orientation") == "horizontal"
        val modal = railNode.optJSONObject("properties")?.optBoolean("modal") == true
        box = if (horizontal) 560.0 to 120.0 else 420.0 to 560.0
        probe.tabs.clear(); events.clear(); phase = ""; epoch++
        advance(600.0)
        val phases = r.getJSONArray("phases").objects()
        for ((i, ph) in phases.withIndex()) {
            val lbl = ph.getString("label"); phase = lbl
            val ss = ph.getJSONArray("samples")
            val lastSample = if (ss.length() > 0) ss.getJSONObject(ss.length() - 1).getDouble("t") - ph.getDouble("t") else 0.0
            val dur = if (i + 1 < phases.size) phases[i + 1].getDouble("t") - ph.getDouble("t") else max(420.0, lastSample + 30)
            val pre = sample(compose.mainClock.currentTime.toDouble())
            val t0 = compose.mainClock.currentTime.toDouble()
            val frames = ArrayList<Frame>()
            // The state right before the action (Chrome samples can still show it for a frame after the input).
            frames += Frame(-1.0, pre.rail, pre.tabs.mapValues { (_, v) -> -1.0 to v.second })
            when (lbl) {
                "hover" -> tabCentre(2)?.let { p -> compose.onRoot().performMouseInput { moveTo(p) } }
                "press" -> compose.onRoot().performMouseInput { press() }
                "release" -> compose.onRoot().performMouseInput { release() }
                "leave" -> compose.onRoot().performMouseInput { moveTo(px(1190.0, 890.0)) }
                "focus" -> { compose.onRoot().performMouseInput { moveTo(px(1190.0, 890.0)) }; compose.runOnIdle { runCatching { before.requestFocus() } }; sendKey(KeyEvent.KEYCODE_TAB)
                    if (railNode.optJSONObject("properties")?.optBoolean("expandable") == true) { frame(); sendKey(KeyEvent.KEYCODE_TAB) } }
                "arrow-forward" -> sendKey(if (horizontal) (if (r.optString("dir") == "rtl") KeyEvent.KEYCODE_DPAD_LEFT else KeyEvent.KEYCODE_DPAD_RIGHT) else KeyEvent.KEYCODE_DPAD_DOWN)
                "end" -> sendKey(KeyEvent.KEYCODE_MOVE_END)
                "home" -> sendKey(KeyEvent.KEYCODE_MOVE_HOME)
                "enter" -> sendKey(KeyEvent.KEYCODE_ENTER)
                "space" -> sendKey(KeyEvent.KEYCODE_SPACE)
                "programmatic" -> nodes = nodes.map { n -> if (n.getString("tag") == "md-navigation-rail") JSONObject(n.toString()).also { it.getJSONObject("properties").put("activeIndex", 1) } else n }
                // Chrome delivers the trusted mouse input on its next frames: its mousedown lands on the frame its press ripple
                // starts (the toggle takes focus there: a focused destination's layer fades from that frame), its click on the
                // frame the expand / collapse transitions start (the oracle's recorded starts; one frame apart, two in
                // standard-selected-rtl's expand). Press and release on those frames too.
                "toggle-expand", "toggle-collapse" -> toggleCentre()?.let { p ->
                    // The pointer reaches the toggle at the phase start (Chrome's mouse move: the destination under the previous
                    // position loses its hover then).
                    compose.onRoot().performMouseInput { moveTo(p) }
                    val click = clickStart(r, ph); val down = pressStart(r, ph)?.takeIf { d -> click == null || d < click }
                    fun until(ms: Double) { while (compose.mainClock.currentTime - t0 < ms - 16) { frame(); frames += sample(t0) } }
                    if (down != null) { until(down); compose.onRoot().performMouseInput { press() } }
                    click?.let { until(it) }
                    compose.onRoot().performMouseInput { if (down == null) press(); release() } }
                "rapid-reverse" -> { compose.runOnIdle { controller.expand() }; advance(100.0); compose.runOnIdle { controller.collapse() } }
                "method-expand" -> compose.runOnIdle { controller.expand() }
                "escape" -> { compose.onRoot().performMouseInput { moveTo(px(1190.0, 890.0)) }; compose.runOnIdle { controller.focusTab(0) }; frame(); sendKey(KeyEvent.KEYCODE_ESCAPE) }
                "scrim-click" -> { compose.onRoot().performMouseInput { moveTo(px(380.0, 400.0)); press() }; frame(); compose.onRoot().performMouseInput { release() } }
                else -> check(false, "$name unknown phase $lbl")
            }
            while (compose.mainClock.currentTime - t0 < dur - 12) { frame(); frames += sample(t0) }
            snapshot(name, ph, horizontal)
            // The layer opacities the previous phase ended with (the start of this phase's transitions; the first phase starts
            // at rest: no pointer, no focus, no layer).
            val before = if (i > 0) phases[i - 1].getJSONArray("samples").let { ps -> if (ps.length() == 0) null else ps.getJSONObject(ps.length() - 1) } else null
            samples(name, ph, frames, horizontal, modal, before?.getJSONArray("tabs")?.objects()?.map { it.getJSONObject("layer").getDouble("opacity") })
        }
        // Events: mdTabChange / mdExpand / mdCollapse, and a pointer click on a destination (Web `click`) as its mdTabClick.
        val web = r.getJSONArray("events").objects().filter { !(it.getString("name") == "click" && it.getString("target").startsWith("md-navigation-rail[")) }
        val native = events.filter { it.name in setOf("mdTabChange", "mdExpand", "mdCollapse") || (it.name == "mdTabClick" && it.phase in setOf("press", "release")) }
        check(native.size == web.size, "$name events ${native.map { "${it.name}@${it.target}" }} vs ${web.map { "${it.getString("name")}@${it.getString("target")}" }}")
        val labels = (railNode.optJSONArray("children")?.objects() ?: emptyList()).filter { it.optString("tag") == "md-navigation-rail-tab" }.map { it.optJSONObject("properties")?.optString("label") ?: "" }
        for ((n, w) in native.zip(web)) {
            val target = w.getString("target"); val isTab = target.startsWith("md-navigation-rail-tab[")
            val wantID = if (isTab) tabIDs[max(0, labels.indexOf(target.drop(23).dropLast(1)))] else railNode.getString("id")
            val wantName = if (w.getString("name") == "click") "mdTabClick" else w.getString("name")
            check(n.name == wantName && n.target == wantID, "$name event ${n.name}@${n.target} vs ${w.getString("name")}@$target")
            val d = w.optJSONObject("detail")
            if (d != null) { @Suppress("UNCHECKED_CAST") val nd = n.detail as? Map<String, Any?>
                if (d.has("index")) check((nd?.get("index") as? Number)?.toInt() == d.optInt("index"), "$name ${n.name}.index ${nd?.get("index")} vs ${d.opt("index")}")
                if (d.has("value")) check(nd?.get("value")?.toString() == d.optString("value"), "$name ${n.name}.value ${nd?.get("value")} vs ${d.opt("value")}") }
        }
        android.util.Log.i("AWCRail", "RUN $name: ${checks - failures.size}/$checks cumulative")
    }
    private fun snapshot(name: String, ph: JSONObject, horizontal: Boolean) {
        val ss = ph.getJSONArray("samples"); if (ss.length() == 0) return
        val last = ss.getJSONObject(ss.length() - 1); val lbl = "$name ${ph.getString("label")}"
        val rail = compose.runOnIdle { probe.rail }
        check(rail["variant"] == last.optString("variant"), "$lbl variant ${rail["variant"]} vs ${last.optString("variant")}")
        check((rail["activeIndex"] as? Int) == last.optInt("activeIndex"), "$lbl activeIndex ${rail["activeIndex"]} vs ${last.opt("activeIndex")}")
        val ids = tabIDs
        for ((i, wt) in last.getJSONArray("tabs").objects().withIndex()) { if (i >= ids.size) break
            val m = compose.runOnIdle { probe.tabs[ids[i]] } ?: run { check(false, "$lbl tab$i measured"); null } ?: continue
            check((m["active"] == true) == wt.optBoolean("active"), "$lbl tab$i active")
            check((m["tabStop"] == true) == (wt.optString("tabindex") == "0"), "$lbl tab$i tab stop ${m["tabStop"]} vs ${wt.optString("tabindex")}")
            if (!horizontal) { val ring = wt.getJSONObject("indicator").optString("outline").startsWith("solid")
                check((m["focusVisible"] == true) == ring, "$lbl tab$i focus ring ${m["focusVisible"]} vs ${wt.getJSONObject("indicator").optString("outline")}") }
            if (ph.getString("label") == "press") { val wave = (m["waveOpacity"] as? Double) ?: 0.0
                check((wave > 0) == ((wt.optJSONArray("waves")?.length() ?: 0) > 0), "$lbl tab$i ripple wave $wave vs ${wt.optJSONArray("waves")?.length()}") }
        }
        val focused = compose.runOnIdle { ids.indexOfFirst { probe.tabs[it]?.get("focused") == true } }
        val toggleFocused = rail["focusedToggle"] == true
        when (val f = last.opt("focused")) {
            is Number -> check(focused == f.toInt(), "$lbl focus tab$focused vs tab$f")
            "md-navigation-rail" -> check(toggleFocused && focused < 0, "$lbl focus tab$focused toggle $toggleFocused vs the toggle")
            else -> check(focused < 0, "$lbl focus tab$focused vs $f")
        }
    }
    private fun samples(name: String, ph: JSONObject, frames: List<Frame>, horizontal: Boolean, modal: Boolean, layerBefore: List<Double>?) {
        val ss = ph.getJSONArray("samples").objects(); if (ss.isEmpty()) return
        var compared = 0; var met = 0; var uncovered = 0; var total = 0
        val tol = listOf(1.5, 1.5, 1.5, 1.5, .03, .03, .03, .03, .015, 1.5, 1.5, .03, .03, .03, .03, 2.5, 1.5, .03, .03, .03, .03, .06)
        val lbl = ph.getString("label")
        for (s in ss) {
            val e = s.getDouble("t") - ph.getDouble("t")
            if (e < 30) continue   // Chrome applies input on its next frames; the native host reacts in the input frame
            fun <T> window(get: (Frame) -> Pair<Double, T>?): List<T> {
                val out = ArrayList<T>(); var before = false; var after = false
                for (f in frames) { val (t, v) = get(f) ?: continue; if (t >= e - 50 && t <= e + 50) { out += v; if (t <= e + 20) before = true; if (t >= e - 20) after = true } }
                return if (before && after) out else emptyList()
            }
            // Rail: width (non-modal), the modal surface and the scrim.
            val rw = window { f -> if (f.rail.isEmpty()) null else f.t to f.rail }
            if (rw.isEmpty()) uncovered++ else {
                val web = arrayOfNulls<Double>(6); web[5] = s.optJSONObject("scrim")?.optDouble("opacity")
                if (modal) { val c = s.getJSONObject("container").getJSONObject("rect"); web[1] = c.getDouble("x"); web[2] = c.getDouble("y"); web[3] = c.getDouble("width"); web[4] = c.getDouble("height") }
                else if (!horizontal) web[0] = s.getJSONObject("host").getDouble("width")
                for (k in 0..5) { val w = web[k] ?: continue; compared++
                    val vals = rw.map { it[k] }
                    if (within(vals, w, if (k == 5) .04 else 1.5)) met++ else check(false, "$name $lbl t+${e.toInt()} rail[$k] web $w native ${vals.map { Math.round(it * 100) / 100.0 }}") }
            }
            for ((i, wt) in s.getJSONArray("tabs").objects().withIndex()) { if (i >= tabIDs.size) break
                total++
                val web = arrayOfNulls<Double>(22)
                if (!horizontal) { val r = wt.getJSONObject("indicator").getJSONObject("rect"); web[0] = r.getDouble("x"); web[1] = r.getDouble("y"); web[2] = r.getDouble("width"); web[3] = r.getDouble("height")
                    val c = pm(css(wt.getJSONObject("indicator").getString("color"))); for (k in 0..3) web[4 + k] = c[k] }
                // Horizontal: Web's [part=state-layer] is display: none (the visible tint is the icon wrapper's ::after, hover and press
                // only), yet the oracle samples its opacity, which carries the :focus-visible rule; the keyboard phases don't compare it.
                val keyboardPhase = lbl !in setOf("hover", "press", "release", "leave")
                // The pointer phases: that sampled opacity steps (display: none runs no transition) while the visible ::after
                // runs its 150 ms opacity transition from Chrome's input frame (not sampled): until it has settled (200 ms) the
                // native tint must lie between the previous phase's value and this one; then it must match.
                val settling = horizontal && !keyboardPhase && e < 200
                if (!(horizontal && keyboardPhase) && !settling) web[8] = wt.getJSONObject("layer").getDouble("opacity")
                wt.optJSONObject("iconWrapper")?.let { web[9] = it.getDouble("x"); web[10] = it.getDouble("y") }
                wt.optJSONObject("icon")?.let { val c = css(it.getString("color")); for (k in 0..3) web[11 + k] = c[k] }
                wt.optJSONObject("label")?.let { l ->
                    if (l.optString("display") != "none" && l.optDouble("opacity", 0.0) > .01) { val r = l.getJSONObject("rect"); web[15] = r.getDouble("x"); web[16] = r.getDouble("y")
                        val c = css(l.getString("color")); for (k in 0..3) web[17 + k] = c[k] }
                    if (l.optString("display") != "none") web[21] = l.getDouble("opacity") }
                val win = window { f -> f.tabs[i] }
                // Sparse host frames: a sample between two native frames more than 40 ms apart has no native evidence.
                val ts = frames.mapNotNull { it.tabs[i]?.first }.sorted()
                val gap = ts.lastOrNull { it <= e }?.let { p -> ts.firstOrNull { it > e }?.let { q -> q - p > 40 && e - p > 8 && q - e > 8 } } ?: false
                if (win.isEmpty() || gap) { uncovered++; continue }
                if (settling) { val to = wt.getJSONObject("layer").getDouble("opacity"); val from = layerBefore?.getOrNull(i) ?: 0.0
                    val vals = win.mapNotNull { it[8] }; compared++
                    if (vals.isNotEmpty() && vals.all { it >= min(from, to) - tol[8] && it <= max(from, to) + tol[8] }) met++
                    else check(false, "$name $lbl t+${e.toInt()} tab$i [8] web $from→$to (the ::after transition) native ${vals.map { Math.round(it * 1000) / 1000.0 }}") }
                for (k in 0..21) { val w = web[k] ?: continue; compared++
                    val vals = win.mapNotNull { it[k] }
                    if (vals.isNotEmpty() && within(vals, w, tol[k])) met++
                    else check(false, "$name $lbl t+${e.toInt()} tab$i [$k] web $w native ${vals.map { Math.round(it * 1000) / 1000.0 }}") }
            }
        }
        checks += met
        check(uncovered <= max(2, total / 6), "$name $lbl native frames cover the samples ($uncovered uncovered)")
        report.put(JSONObject().put("run", name).put("phase", lbl).put("samples", ss.size).put("compared", compared).put("met", met).put("frames", frames.size).put("uncovered", uncovered))
    }
}
