package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.positionInRoot
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

/**
 * md-tabs / md-tab / md-tab-panels against Chrome (tabs.html / tabs-states.html, Mac Chrome 153, DPR 1): the paint matrix
 * (strip, tabs, content, icon, label, indicator and divider boxes, colours, tab stops, names, scroll, flat pixels) and the
 * interaction runs (pointer hover/press/release/leave, Tab, arrows, End, Home, a programmatic activeTabIndex write; full
 * and reduced motion) through real mouse and key input on the frame clock: settled states, events and every sampled frame.
 */
@OptIn(ExperimentalTestApi::class)
class NativeTabsParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\"}"))
    private var nodes by mutableStateOf<List<JSONObject>>(emptyList())
    private var epoch by mutableIntStateOf(0)
    private var reduced by mutableStateOf<Boolean?>(null)
    private var origin by mutableStateOf(24.0)
    private var pageWidth by mutableStateOf(480.0)
    private var activeOverride by mutableStateOf<Int?>(null)
    private var scale = 2f
    private val probe = AWCTabsProbe()
    private val controller = AWCTabsController()
    private val before = FocusRequester()
    private val events = mutableListOf<Pair<String, Any?>>()
    private lateinit var view: android.view.View
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun hex(v: String?) = Color(android.graphics.Color.parseColor(v!!))
    private fun numbers(s: String) = Regex("-?[0-9.]+(e-?[0-9]+)?").findAll(s).mapNotNull { it.value.toDoubleOrNull() }.toList()
    private fun css(s: String): List<Double> { val n = numbers(s)
        return when { s.startsWith("rgba") && n.size >= 4 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, n[3]); s.startsWith("rgb") && n.size >= 3 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, 1.0)
            s.startsWith("color(srgb") && n.size >= 3 -> listOf(n[0], n[1], n[2], if (n.size > 3) n[3] else 1.0); else -> listOf(0.0, 0.0, 0.0, 0.0) } }
    private fun rgba(c: Any?): List<Double>? = (c as? Color)?.let { listOf(it.red.toDouble(), it.green.toDouble(), it.blue.toDouble(), it.alpha.toDouble()) }
    private fun colorClose(a: Any?, web: String, tol: Double = .014): Boolean {
        val n = rgba(a) ?: return false; val w = css(web)
        fun pm(c: List<Double>) = listOf(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3])
        return pm(n).zip(pm(w)).all { (x, y) -> abs(x - y) <= tol }
    }
    private fun matrix(t: String): Pair<Double, Double> { val n = numbers(t); return if (t == "none" || n.size < 6) 1.0 to 0.0 else n[0] to n[4] }
    private fun props(o: JSONObject): Map<String, AWCValue> = buildMap { val p = o.optJSONObject("properties") ?: JSONObject()
        for (k in p.keys()) if (k != "_hooks") put(k, p.get(k)); put("id", o.getString("id")) }
    /** `tag::part(name){prop:value;…}` rules of a case → "tag::name" → prop → value (gate-7 R6-03). */
    private fun partRules(css: String): Map<String, Map<String, String>> {
        val out = mutableMapOf<String, MutableMap<String, String>>()
        for (m in Regex("([a-z-]+)::part\\(([a-z-]+)\\)\\{([^}]*)\\}").findAll(css)) {
            val key = m.groupValues[1] + "::" + m.groupValues[2]
            for (decl in m.groupValues[3].split(';')) { val kv = decl.split(':', limit = 2).map { it.trim() }; if (kv.size == 2) out.getOrPut(key) { mutableMapOf() }[kv[0]] = kv[1] }
        }
        return out
    }
    private fun tabParts(c: JSONObject): AWCTabPartAppearance {
        val r = partRules(c.optString("parts")); fun p(part: String, prop: String) = r["md-tab::$part"]?.get(prop)
        return AWCTabPartAppearance(p("state-layer", "background-color"), p("state-layer", "opacity")?.toDoubleOrNull(), p("icon", "color"), p("label", "color"),
            p("indicator", "background-color"), p("divider", "background-color"))
    }
    private fun hooks(o: JSONObject?): AWCTabsAppearance {
        val h = o?.optJSONObject("properties")?.optJSONObject("_hooks") ?: return AWCTabsAppearance()
        fun s(k: String) = h.optString(k).ifEmpty { null }
        return AWCTabsAppearance(s("--md-tabs-container-color"), s("--md-tabs-divider-color"), AWCTabAppearance(s("--md-tab-container-color"), s("--md-tab-active-label-color"),
            s("--md-tab-inactive-label-color"), s("--md-tab-active-icon-color"), s("--md-tab-inactive-icon-color"), s("--md-tab-active-indicator-color"),
            s("--md-tab-active-indicator-height")?.removeSuffix("px")?.toDoubleOrNull(), s("--md-tab-divider-color")))
    }
    @Composable private fun Node(o: JSONObject) {
        var p = props(o)
        if (o.getString("tag") == "md-tabs") activeOverride?.let { p = p + ("activeTabIndex" to it) }
        val kids = o.getJSONArray("children").objects()
        AWCComponent(o.getString("tag"), p, onEvent = { n, d -> events += n to d }) { slot ->
            for (k in kids) {
                val ks = k.optString("slot").ifEmpty { "" }
                if (ks != slot) continue
                when (k.getString("tag")) {
                    "#text" -> AWCSlotText(k.getJSONObject("properties").getString("text"))
                    "#symbol" -> { val ink = LocalContentColor.current; Canvas(Modifier.fillMaxSize()) { drawCircle(ink, radius = size.minDimension * 9 / 24) } }
                    else -> key(k.getString("id")) { Node(k) }
                }
            }
        }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(scale, 1f)) {
        view = LocalView.current
        val c = case; val dark = c.optString("theme") == "dark"; val t = if (dark) AWCGeneratedTokens.dark else AWCGeneratedTokens.light
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(hex(t["--md-sys-color-surface"]))) { key(epoch) {
            val dir = if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr, LocalAWCTabsProbe provides probe, LocalAWCTabsReducedMotion provides reduced,
                LocalAWCTabsRegistry provides remember(epoch) { AWCTabsRegistry() }) {
                AWCTabsControllerScope(controller) { AWCTabsAppearanceScope(hooks(nodes.firstOrNull())) { AWCDensityScope(c.optDouble("density", 0.0)) {
                AWCTabPartAppearanceScope(tabParts(c)) { AWCTabsPartAppearanceScope(AWCTabsPartAppearance(partRules(c.optString("parts"))["md-tabs::container"]?.get("background-color"))) {
                    Box(Modifier.size(1.dp).focusRequester(before).focusable())
                    Column(Modifier.absoluteOffset(origin.dp, origin.dp).wrapContentWidth(Alignment.Start, unbounded = true).width(pageWidth.dp)) {
                        CompositionLocalProvider(LocalLayoutDirection provides dir) { Column(Modifier.fillMaxWidth()) { for (n in nodes) key(n.getString("id")) { Node(n) } } }
                    }
                } }
                } } }
            }
        } } }
    } } }
    private fun frame() { compose.mainClock.advanceTimeByFrame() }
    private fun run(ms: Double) { var t = 0.0; while (t < ms) { frame(); t += 16.0 } }
    private fun px(x: Double, y: Double) = Offset((x * scale).toFloat(), (y * scale).toFloat())
    private fun tab(id: String) = compose.runOnIdle { probe.tabs[id] }
    private fun pos(m: Map<String, Any?>?): Pair<Double, Double>? = compose.runOnIdle {
        val c = m?.get("coords") as? LayoutCoordinates ?: return@runOnIdle null
        if (!c.isAttached) null else c.positionInRoot().let { it.x / scale.toDouble() to it.y / scale.toDouble() } }
    private fun center(id: String): Offset? { val m = tab(id) ?: return null; val (x, y) = pos(m) ?: return null
        return px(x + (m["width"] as Double) / 2, y + (m["height"] as Double) / 2) }
    @Suppress("UNCHECKED_CAST") private fun rect(m: Map<String, Any?>, name: String): List<Double>? = (m["rects"] as? Map<String, List<Double>?>)?.get(name)
    private fun sendKey(code: Int) = compose.runOnIdle { view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_DOWN, code, 0, 0)); view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_UP, code, 0, 0)) }
    private fun load(c: JSONObject, page: Double, at: Double) {
        compose.mainClock.autoAdvance = false
        case = c; nodes = JSONArray(c.getString("nodesJSON")).objects(); origin = at; pageWidth = page; activeOverride = null
        probe.tabs.clear(); probe.panels.clear(); events.clear(); epoch++
    }

    @Test fun tabsMatchChromePaint() {
        content()
        for (c in CardWeb.document("TabsWebPaint.json").getJSONArray("cases").objects()) paint(c)
        AccordionEvidence.log("tabs-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(300))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun paint(c: JSONObject) {
        val name = c.getString("name"); val host = c.getJSONObject("host"); val hr = host.getJSONObject("rect")
        reduced = null
        load(c, if (c.optBoolean("wrapped")) hr.getDouble("width") else c.optDouble("width", 480.0), hr.getDouble("x")); run(400.0)
        if (name.startsWith("overflow-scrolled")) { compose.runOnIdle { controller.selectTab(6) }; run(1000.0) }
        run(200.0)
        fun near(a: Double?, b: Double?, l: String, tol: Double = .75) = check(a != null && b != null && abs(a - b) <= tol, "$name $l $a vs $b")
        val strip = compose.runOnIdle { probe.strip }
        near(strip["height"] as? Double, hr.getDouble("height"), "strip height")
        check(colorClose(strip["host"], host.getString("bg")), "$name strip background ${rgba(strip["host"])} vs ${host.getString("bg")}")
        check(strip["label"] == host.optString("label"), "$name tablist label ${strip["label"]}")
        val after = host.optJSONObject("after"); val full = after != null && after.optString("height") == "1px"
        check(full == (strip["divider"] != null), "$name full divider presence")
        if (full && strip["divider"] != null) check(colorClose(strip["divider"], after!!.getString("backgroundColor")), "$name full divider colour")
        host.optJSONObject("scroll")?.let { sc -> if (sc.getDouble("width") > sc.getDouble("client") + 1) near(strip["scrollLeft"] as? Double, sc.getDouble("left"), "scrollLeft", 1.5) }
        val tabsNode = nodes.firstOrNull { it.getString("tag") == "md-tabs" } ?: return
        val ids = tabsNode.getJSONArray("children").objects().map { it.getString("id") }
        val ax = c.getJSONArray("ax").objects().filter { it.optString("role") == "tab" }
        for ((i, wt) in c.getJSONArray("tabs").objects().withIndex()) {
            if (i >= ids.size) break
            val id = ids[i]; val m = tab(id); if (m == null) { check(false, "$name $id measured"); continue }
            val (tx, ty) = pos(m) ?: (Double.NaN to Double.NaN)
            val r = wt.getJSONObject("rect")
            near(tx, r.getDouble("x"), "$id x"); near(ty, r.getDouble("y"), "$id y")
            near(m["width"] as? Double, r.getDouble("width"), "$id width", 1.0)
            near(m["height"] as? Double, r.getDouble("height"), "$id height")
            check((m["active"] == true) == (wt.optString("selected") == "true"), "$name $id selected")
            check((m["tabStop"] == true) == (wt.optString("tabindex") == "0"), "$name $id tab stop")
            check(colorClose(m["color"], wt.getString("color")), "$name $id colour ${rgba(m["color"])} vs ${wt.getString("color")}")
            if (i < ax.size) check(m["name"] == ax[i].getString("name"), "$name $id name ${m["name"]} vs ${ax[i].getString("name")}")
            // Authored slot content keeps its HTML styling on Web (inline padding, colours): only its presence is native (as on macOS).
            val authoredSlot = tabsNode.getJSONArray("children").objects().getOrNull(i)?.getJSONArray("children")?.objects()?.any { it.optString("slot") == "badge" } == true
            for ((part, key) in listOf("content" to "content", "label" to "label", "icon" to "icon", "divider" to "divider")) {
                if (authoredSlot && part != "icon" && part != "divider") continue
                val wp = wt.optJSONObject(part) ?: continue; val wr = wp.getJSONObject("rect"); if (wr.getDouble("width") <= 0) continue
                val pr = rect(m, key) ?: run { check(false, "$name $id $part measured"); null } ?: continue
                near(tx + pr[0], wr.getDouble("x"), "$id $part x"); near(ty + pr[1], wr.getDouble("y"), "$id $part y"); near(pr[2], wr.getDouble("width"), "$id $part width", 1.0)
                if (part == "icon") check(colorClose(m["iconColor"], wp.getString("color")), "$name $id icon colour ${rgba(m["iconColor"])} vs ${wp.getString("color")}")
                if (part == "divider") check(colorClose(m["divider"], wp.getString("bg")), "$name $id divider colour ${rgba(m["divider"])} vs ${wp.getString("bg")}")
            }
            if (!authoredSlot) wt.optJSONObject("indicator")?.let { wi -> val ir = rect(m, "indicator"); val wr = wi.getJSONObject("rect")
                if (ir != null) { val s = m["scale"] as Double; val t = m["translate"] as Double; val w = ir[2] * s; val cx = tx + ir[0] + ir[2] / 2 + t
                    near(cx - w / 2, wr.getDouble("x"), "$id indicator x"); near(ty + ir[1], wr.getDouble("y"), "$id indicator y"); near(w, wr.getDouble("width"), "$id indicator width", 1.0)
                    near(m["opacity"] as Double, wi.optString("opacity").toDoubleOrNull(), "$id indicator opacity", .02)
                    check(colorClose(m["indicatorColor"], wi.getString("bg")), "$name $id indicator colour") } }
        }
        c.optJSONObject("panels")?.let { pp -> val panels = nodes.firstOrNull { it.getString("tag") == "md-tab-panels" } ?: return@let
            val pids = panels.getJSONArray("children").objects().map { it.getString("id") }
            val idx = compose.runOnIdle { probe.panels[panels.getString("id")]?.get("index") }
            check(idx == tabsNode.getJSONObject("properties").optInt("activeTabIndex", 0), "$name panels index $idx")
            for ((i, wr) in pp.getJSONArray("items").objects().withIndex()) if (i < pids.size) {
                val pm = compose.runOnIdle { probe.panels[pids[i]] }
                check((pm?.get("active") == true) == (i == idx), "$name panel $i active ${pm?.get("active")}")
            } }
        if (!c.optBoolean("wrapped") && name != "slotted-icon-badge") {
            val clip = c.getJSONObject("clip")
            val nat = CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(), clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
            val res = CardWeb.compare(CardWeb.webGrid("TabsWebPaint/$name.png", clip), nat)
            check(res.getInt("over6").toDouble() / maxOf(res.getInt("compared"), 1) <= .005 && res.getDouble("mean") <= 1.0, "$name flat pixels $res"); report.put(res.put("case", name))
        }
    }

    @Test fun tabsMatchChromeStates() {
        scale = 1.25f; content()
        for ((file, red) in listOf("TabsWebStates.json" to false, "TabsWebStatesReduced.json" to true))
            for (r in CardWeb.document(file).getJSONArray("runs").objects()) states(r, red)
        AccordionEvidence.log("tabs-states", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    private class Sample(val t: Double, val tabs: Map<Int, Pair<Double, List<Double>>>)
    private fun sample(t0: Double, ids: List<String>): Sample = compose.runOnIdle {
        val out = HashMap<Int, Pair<Double, List<Double>>>()
        for ((i, id) in ids.withIndex()) { val m = probe.tabs[id] ?: continue
            // A tab settled at its last render (nothing running) or not rendered since the action holds that render now.
            val rt = (m["renderTime"] as Double) - t0
            out[i] = (if (rt < 0 || m["animating"] == false) compose.mainClock.currentTime - t0 else rt) to (rgba(m["color"])!! + listOf(m["layer"] as Double, m["opacity"] as Double, m["translate"] as Double, m["scale"] as Double) + rgba(m["iconColor"])!!) }
        Sample(compose.mainClock.currentTime - t0, out)
    }
    private fun states(r: JSONObject, red: Boolean) {
        val name = (if (red) "reduced " else "") + r.getString("name")
        reduced = red
        compose.onRoot().performMouseInput { moveTo(px(1190.0, 890.0)) }
        load(r, 480.0, 24.0); run(600.0)
        val tabsNode = nodes.first { it.getString("tag") == "md-tabs" }; val ids = tabsNode.getJSONArray("children").objects().map { it.getString("id") }
        val labels = tabsNode.getJSONArray("children").objects().map { it.getJSONObject("properties").optString("label") }
        val icons = r.getString("name").contains("icons")
        val phases = r.getJSONArray("phases").objects()
        for ((i, ph) in phases.withIndex()) {
            val lbl = ph.getString("label"); val ss = ph.getJSONArray("samples")
            val lastSample = if (ss.length() > 0) ss.getJSONObject(ss.length() - 1).getDouble("t") - ph.getDouble("t") else 0.0
            val dur = if (i + 1 < phases.size) phases[i + 1].getDouble("t") - ph.getDouble("t") else maxOf(420.0, lastSample + 30)
            val pre = sample(compose.mainClock.currentTime.toDouble(), ids)
            when (lbl) {
                "arm" -> compose.runOnIdle { runCatching { before.requestFocus() } }
                "hover" -> center(ids[2])?.let { p -> compose.onRoot().performMouseInput { moveTo(p) } }
                "press" -> compose.onRoot().performMouseInput { press() }
                "release" -> compose.onRoot().performMouseInput { release() }
                "leave" -> compose.onRoot().performMouseInput { moveTo(px(1190.0, 890.0)) }
                "focus" -> { compose.runOnIdle { runCatching { before.requestFocus() } }; sendKey(KeyEvent.KEYCODE_TAB) }
                "arrow-forward" -> sendKey(if (r.optString("dir") == "rtl") KeyEvent.KEYCODE_DPAD_LEFT else KeyEvent.KEYCODE_DPAD_RIGHT)
                "end" -> sendKey(KeyEvent.KEYCODE_MOVE_END)
                "home" -> sendKey(KeyEvent.KEYCODE_MOVE_HOME)
                "programmatic" -> activeOverride = 2
            }
            val t0 = compose.mainClock.currentTime.toDouble(); val frames = ArrayList<Sample>()
            // The state right before the action (Chrome samples can still show it for a frame after the input).
            frames += pre.let { s -> Sample(-1.0, s.tabs.mapValues { (_, v) -> -1.0 to v.second }) }
            while (compose.mainClock.currentTime - t0 < dur - 12) { frame(); frames += sample(t0, ids) }
            snapshot("$name $lbl", ph, ids)
            samples("$name $lbl", ph, frames, icons)
        }
        val web = r.getJSONArray("events").objects()
        val got = events.filter { it.first == "mdTabChange" || it.first == "mdTabClick" }
        check(got.size == web.size, "$name events ${got.map { it.first }} vs ${web.map { it.getString("name") }}")
        for ((n, w) in got.zip(web)) {
            check(n.first == w.getString("name"), "$name event ${n.first} vs ${w.getString("name")}")
            if (!w.isNull("detail")) { val d = w.getJSONObject("detail"); @Suppress("UNCHECKED_CAST") val nd = n.second as? Map<String, Any?>
                for (k in listOf("index", "previousIndex")) check((nd?.get(k) as? Number)?.toInt() == d.optInt(k), "$name ${n.first}.$k ${nd?.get(k)} vs ${d.optInt(k)}") }
        }
        if (web.size == got.size) report.put(JSONObject().put("run", name).put("events", got.size))
        labels.size
    }
    private fun snapshot(name: String, ph: JSONObject, ids: List<String>) {
        val ss = ph.getJSONArray("samples"); if (ss.length() == 0) return
        val last = ss.getJSONObject(ss.length() - 1)
        for ((i, wt) in last.getJSONArray("tabs").objects().withIndex()) { if (i >= ids.size) break
            val m = tab(ids[i]) ?: run { check(false, "$name tab$i measured"); null } ?: continue
            check((m["active"] == true) == wt.optBoolean("active"), "$name tab$i active")
            check((m["tabStop"] == true) == (wt.optString("tabindex") == "0"), "$name tab$i tab stop")
            check((m["focusVisible"] == true) == wt.optString("outline").startsWith("solid"), "$name tab$i focus ring ${m["focusVisible"]} vs ${wt.optString("outline")}")
        }
        val strip = compose.runOnIdle { probe.strip }
        check(strip["activeTabIndex"] == last.optInt("activeTabIndex"), "$name activeTabIndex ${strip["activeTabIndex"]} vs ${last.optInt("activeTabIndex")}")
        val focused = compose.runOnIdle { ids.indexOfFirst { probe.tabs[it]?.get("focused") == true } }
        val webFocus = if (last.isNull("focused")) -1 else last.getInt("focused")
        check(focused == webFocus, "$name focus $focused vs $webFocus")
    }
    private fun samples(name: String, ph: JSONObject, frames: List<Sample>, icons: Boolean) {
        val ss = ph.getJSONArray("samples").objects(); if (ss.isEmpty()) return
        var compared = 0; var met = 0; var uncovered = 0; var total = 0
        val tol = listOf(.03, .03, .03, .03, .012, .07, 2.0, .025, .03, .03, .03, .03)
        for (s in ss) {
            val e = s.getDouble("t") - ph.getDouble("t"); if (e < 30) continue
            for ((i, wt) in s.getJSONArray("tabs").objects().withIndex()) { total++
                val web = arrayOfNulls<Double>(12); val c = css(wt.getString("color")); for (k in 0..3) web[k] = c[k]
                web[4] = wt.getJSONObject("layer").getDouble("opacity")
                wt.optJSONObject("indicator")?.let { wi -> web[5] = wi.getDouble("opacity"); val (sx, tx) = matrix(wi.getString("transform")); web[6] = tx; web[7] = sx }
                if (icons && !wt.isNull("icon")) { val ic = css(wt.getString("icon")); for (k in 0..3) web[8 + k] = ic[k] }
                var before = false; var after = false
                val window = frames.mapNotNull { f -> val v = f.tabs[i] ?: return@mapNotNull null; if (v.first >= e - 50 && v.first <= e + 50) { if (v.first <= e + 20) before = true; if (v.first >= e - 20) after = true; v.second } else null }
                if (window.isEmpty() || !(before && after)) { uncovered++; continue }
                for (k in 0..11) { val w = web[k] ?: continue; compared++
                    val vals = window.map { it[k] }
                    if (vals.any { abs(it - w) <= tol[k] } || (vals.size >= 2 && vals.min() - tol[k] <= w && w <= vals.max() + tol[k])) met++
                    else check(false, "$name t+${e.toInt()} tab$i [$k] web $w native ${vals.map { Math.round(it * 1000) / 1000.0 }}") }
            }
        }
        checks += met
        check(uncovered <= maxOf(2, total / 6), "$name native frames cover the samples ($uncovered uncovered)")
        report.put(JSONObject().put("run", name).put("samples", ss.size).put("compared", compared).put("met", met).put("frames", frames.size).put("uncovered", uncovered))
    }
}
