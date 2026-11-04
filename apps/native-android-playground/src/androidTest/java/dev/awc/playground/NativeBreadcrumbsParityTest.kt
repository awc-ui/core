package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
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
 * md-breadcrumbs / md-breadcrumb-item against Chrome (breadcrumbs/{paint,states}.html, Mac Chrome 153, DPR 1): the paint
 * matrix (boxes of crumbs, separators, surfaces, labels and the toggle, colours and every flat pixel), and the interaction
 * runs (entrance, pointer, keyboard, overflow toggle, methods, select, runtime; full and reduced motion) through real
 * mouse and key input on the frame clock: settled phase snapshots, events and every sampled frame in Chrome's envelope.
 */
@OptIn(ExperimentalTestApi::class)
class NativeBreadcrumbsParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\"}"))
    private var trailProps by mutableStateOf<Map<String, AWCValue>>(emptyMap())
    private var items by mutableStateOf<List<JSONObject>>(emptyList())
    private var epoch by mutableIntStateOf(0)
    private var reduced by mutableStateOf<Boolean?>(null)
    private var origin by mutableStateOf(40.0)
    private var parentWidth by mutableStateOf(720.0)
    private var cancel = true
    /** 2 for paint (2 x 2 device pixels per CSS px); the states runs use 1.25 so the 820 dp page fits the screen. */
    private var scale = 2f
    private val probe = AWCBreadcrumbsProbe()
    private val controller = AWCBreadcrumbsController()
    private val events = mutableListOf<AWCActionEvent>(); private val routes = mutableListOf<String>()
    private lateinit var view: android.view.View
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun hex(v: String?) = Color(android.graphics.Color.parseColor(v!!))
    private fun numbers(s: String) = Regex("-?[0-9.]+(e-?[0-9]+)?").findAll(s).mapNotNull { it.value.toDoubleOrNull() }.toList()
    private fun css(s: String): List<Double> { val n = numbers(s)
        return when { s.startsWith("rgba") && n.size >= 4 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, n[3]); s.startsWith("rgb") && n.size >= 3 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, 1.0)
            s.startsWith("color(srgb") && n.size >= 3 -> listOf(n[0], n[1], n[2], if (n.size > 3) n[3] else 1.0); else -> listOf(0.0, 0.0, 0.0, 0.0) } }
    private fun alpha(s: String) = if (s.startsWith("oklab")) numbers(s).getOrElse(3) { 1.0 } else css(s)[3]
    private fun colorClose(a: Any?, web: String, tol: Double = .014): Boolean {
        @Suppress("UNCHECKED_CAST") val n = (a as? List<Double>) ?: return false; val w = css(web)
        fun pm(c: List<Double>) = listOf(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3])
        return pm(n).zip(pm(w)).all { (x, y) -> abs(x - y) <= tol }
    }
    private fun translateX(t: String) = if (t == "none" || t.isEmpty()) 0.0 else numbers(t).getOrElse(4) { 0.0 }
    private fun scaleOf(t: String) = if (t == "none" || t.isEmpty()) 1.0 else numbers(t).firstOrNull() ?: 1.0
    private fun hooks(h: JSONObject?) = if (h == null) AWCBreadcrumbsAppearance() else AWCBreadcrumbsAppearance.cssValues(h.keys().asSequence().associateWith { h.getString(it) })
    private val TRAIL = JSONArray("[{\"id\":\"home\",\"href\":\"#home\",\"icon\":\"home\",\"label\":\"Home\"},{\"id\":\"lib\",\"href\":\"#library\",\"label\":\"Library\"},{\"id\":\"docs\",\"href\":\"#documents\",\"label\":\"Documents\"},{\"id\":\"page\",\"label\":\"Quarterly report\"}]")
    private fun props(o: JSONObject, keys: List<Pair<String, String>>) = buildMap<String, AWCValue> { for ((k, key) in keys) if (o.has(k) && !o.isNull(k)) put(key, o.get(k)) }
    private fun trailOf(c: JSONObject) = props(c, listOf("hidden" to "hidden", "label" to "label", "expandLabel" to "expandLabel", "separator" to "separator", "maxItems" to "maxItems", "before" to "itemsBeforeCollapse", "after" to "itemsAfterCollapse", "density" to "density"))
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(scale, 1f)) {
        view = LocalView.current
        val c = case; val dark = c.optString("theme") == "dark"; val t = if (dark) AWCGeneratedTokens.dark else AWCGeneratedTokens.light
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(hex(t["--md-sys-color-surface"]))) { key(epoch) {
            // The page stays left-to-right (the 540 dp wide screen would right-align a 720 dp column); dir applies to the trail's parent.
            val dir = if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr,
                LocalAWCBreadcrumbsProbe provides probe, LocalAWCBreadcrumbsReducedMotion provides reduced) {
                AWCBreadcrumbsControllerScope(controller) { AWCBreadcrumbsAppearanceScope(hooks(c.optJSONObject("hooks"))) {
                    AWCNavigationScope(AWCURLRouter { r -> routes += r.url; true }) { AWCActionScope(onAction = { e -> if (e.name == "mdSelect" && cancel) e.preventDefault(); events += e }) {
                        AWCDensityScope(c.optDouble("inheritedDensity", 0.0)) {
                            Column(Modifier.absoluteOffset(origin.dp, origin.dp).wrapContentWidth(Alignment.Start, unbounded = true).width(parentWidth.dp)) {
                                val w = c.optString("width").removeSuffix("px").toDoubleOrNull()
                                CompositionLocalProvider(LocalLayoutDirection provides dir) { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopStart) {
                                Box(if (w != null) Modifier.width(w.dp) else Modifier.fillMaxWidth()) {
                                    AWCComponent("md-breadcrumbs", trailProps) { slot -> if (slot == "") for (it in items) key(it.getString("id")) {
                                        AWCComponent("md-breadcrumb-item", props(it, listOf("id" to "id", "href" to "href", "icon" to "icon", "current" to "current", "disabled" to "disabled", "density" to "density", "target" to "target", "rel" to "rel", "hidden" to "hidden"))) { s ->
                                            if (s == "") AWCSlotText((if (it.has("html")) it.getString("html") else it.optString("label")).replace("<b>", "").replace("</b>", "").replace("&amp;", "&"))
                                            if (s == "icon" && it.optBoolean("svg")) { val ink = LocalContentColor.current
                                                Canvas(Modifier.size(18.dp)) { drawRect(ink, Offset(3.dp.toPx(), 3.dp.toPx()), Size(12.dp.toPx(), 12.dp.toPx())) } }
                                        }
                                    } }
                                } } }
                                Spacer(Modifier.height(40.dp))
                                AWCComponent("md-button", mapOf("id" to "after")) { if (it == "") AWCSlotText("After") }
                            }
                        }
                    } }
                } }
            }
        } } }
    } } }
    private fun frame() { compose.mainClock.advanceTimeByFrame() }
    private fun run(ms: Double) { var t = 0.0; while (t < ms) { frame(); t += 16.0 } }
    private fun px(x: Double, y: Double) = Offset((x * scale).toFloat(), (y * scale).toFloat())
    private fun crumb(id: String) = compose.runOnIdle { probe.crumbs[id] }
    /** Live bounds of a probe part (item, surface, label, separator; button for the toggle). */
    private fun box(m: Map<String, Any?>?, k: String) = compose.runOnIdle { probe.bounds((m?.get("coords") as? Map<*, *>)?.get(k)) }
    private fun center(id: String) = box(crumb(id), "surface")?.let { px(it[0] + it[2] / 2, it[1] + it[3] / 2) }
    private fun toggleCenter() = box(compose.runOnIdle { probe.toggle }, "button")?.let { px(it[0] + it[2] / 2, it[1] + it[3] / 2) }
    private fun sendKey(code: Int, shift: Boolean = false) = compose.runOnIdle {
        val meta = if (shift) KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON else 0
        view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_DOWN, code, 0, meta)); view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_UP, code, 0, meta)) }
    private fun load(c: JSONObject, list: JSONArray?, originAt: Double, width: Double) {
        compose.mainClock.autoAdvance = false
        case = c; trailProps = trailOf(c); items = (list ?: TRAIL).objects(); origin = originAt; parentWidth = width
        probe.crumbs.clear(); events.clear(); routes.clear(); epoch++
    }

    @Test fun breadcrumbsMatchChromePaint() {
        content()
        for (c in CardWeb.document("BreadcrumbsWebPaint.json").getJSONArray("cases").objects()) paint(c)
        AccordionEvidence.log("breadcrumbs-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(300))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun paint(c: JSONObject) {
        val name = c.getString("name")
        reduced = null; load(c, c.optJSONArray("items"), 40.0, 720.0); run(64.0)
        if (c.optBoolean("expand")) { compose.runOnIdle { controller.expand() }; run(64.0) }
        run(1200.0)
        if (c.has("parts") && !c.isNull("parts")) { report.put(JSONObject().put("case", name).put("skipped", "::part() styling is not available natively")); return }
        val s = c.getJSONObject("snap")
        if (c.optBoolean("hidden")) { check(compose.runOnIdle { probe.crumbs.isEmpty() }, "$name hidden trail renders nothing"); return }
        fun near(a: Double?, b: Double?, l: String, tol: Double = .75) = check(a != null && b != null && abs(a - b) <= tol, "$name $l $a vs $b")
        for (it in s.getJSONArray("items").objects()) {
            val id = it.getString("id"); val r = it.getJSONObject("rect"); val m = crumb(id)
            if (r.getDouble("width") == 0.0) { check(m == null, "$name $id collapsed/hidden"); continue }
            if (m == null) { check(false, "$name $id measured"); continue }
            val ib = box(m, "item")
            near(ib?.get(0), r.getDouble("x"), "$id x"); near(ib?.get(1), r.getDouble("y"), "$id y"); near(ib?.get(2), r.getDouble("width"), "$id width", 1.2); near(ib?.get(3), r.getDouble("height"), "$id height")
            if (!it.isNull("surface")) { val ws = it.getJSONObject("surface"); val sb = box(m, "surface"); val wr = ws.getJSONObject("rect")
                near(sb?.get(0), wr.getDouble("x"), "$id surface x"); near(sb?.get(2), wr.getDouble("width"), "$id surface width", 1.2); near(sb?.get(3), wr.getDouble("height"), "$id surface height")
                check((if (m["link"] == true) "link" else "static") == ws.getString("kind"), "$name $id kind")
                check(colorClose(m["ink"], ws.getString("color")), "$name $id colour ${m["ink"]} vs ${ws.getString("color")}")
                check(colorClose(m["background"], ws.getString("backgroundColor")), "$name $id background ${m["background"]} vs ${ws.getString("backgroundColor")}") }
            val sep = box(m, "separator")
            check((m["separator"] != null) == !it.isNull("separator"), "$name $id separator presence")
            if (sep != null && !it.isNull("separator")) near(sep[0], it.getJSONObject("separator").getJSONObject("rect").getDouble("x"), "$id separator x")
            val lb = box(m, "label")
            if (lb != null && !it.isNull("label")) { val wl = it.getJSONObject("label").getJSONObject("rect"); near(lb[0], wl.getDouble("x"), "$id label x"); near(lb[2], wl.getDouble("width"), "$id label width", 1.2) }
        }
        val tg = compose.runOnIdle { probe.toggle }
        check((tg != null) == !s.isNull("overflow"), "$name toggle presence")
        if (tg != null && !s.isNull("overflow")) { val b = box(tg, "button"); val wr = s.getJSONObject("overflow").getJSONObject("button").getJSONObject("rect")
            near(b?.get(0), wr.getDouble("x"), "toggle x"); near(b?.get(1), wr.getDouble("y"), "toggle y"); near(b?.get(2), 32.0, "toggle size") }
        if (name.startsWith("matrix-light-ltr")) report.put(JSONObject().put("debug", name).put("crumbs", JSONObject(s.getJSONArray("items").objects().associate { it.getString("id") to
            JSONArray(listOf("item", "surface", "label", "separator").map { k -> box(crumb(it.getString("id")), k)?.let { b -> JSONArray(b) } } +
                listOf(crumb(it.getString("id"))?.get("labelPx"), crumb(it.getString("id"))?.get("sepPx"), crumb(it.getString("id"))?.get("label"),
                    android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG or android.graphics.Paint.LINEAR_TEXT_FLAG).run {
                        typeface = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.resources.getFont(dev.awc.nativeui.R.font.awc_roboto_medium)
                        textSize = 28f; letterSpacing = .1f / 14f; measureText(crumb(it.getString("id"))?.get("label") as? String ?: "") })) })))
        val clip = c.getJSONObject("clip")
        val nat = CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(), clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
        val res = CardWeb.compare(CardWeb.webGrid("BreadcrumbsWebPaint/$name.png", clip), nat)
        check(res.getInt("over6").toDouble() / maxOf(res.getInt("compared"), 1) <= .005 && res.getDouble("mean") <= 1.0, "$name flat pixels $res"); report.put(res.put("case", name))
    }

    @Test fun breadcrumbsMatchChromeStates() {
        scale = 1.25f; content()
        for ((file, red) in listOf("BreadcrumbsWebStates.json" to false, "BreadcrumbsWebStatesReduced.json" to true))
            for (r in CardWeb.document(file).getJSONArray("runs").objects()) states(r, red)
        AccordionEvidence.log("breadcrumbs-states", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    private class Sample(val t: Double, val crumbs: Map<String, Pair<Double, List<Double>>>, val crumbsEntrance: Map<String, Double>, val toggle: List<Double>?)
    private fun sample(t0: Double): Sample = compose.runOnIdle {
        val now = compose.mainClock.currentTime.toDouble()
        val cr = HashMap<String, Pair<Double, List<Double>>>(); val en = HashMap<String, Double>()
        for ((id, m) in probe.crumbs) { @Suppress("UNCHECKED_CAST") val ink = m["inkNow"] as List<Double>; val f = m["frame"] as Double
            cr[id] = (f - t0) to (ink + listOf(m["layerNow"] as Double, m["nudgeNow"] as Double, m["opacity"] as Double, m["slide"] as Double))
            (m["entranceStart"] as? Double)?.takeIf { it.isFinite() }?.let { en[id] = f - it } }
        Sample(now - t0, cr, en, probe.toggle?.let { listOf(it["layerNow"] as Double, it["scaleNow"] as Double) })
    }
    private fun states(r: JSONObject, red: Boolean) {
        val name = (if (red) "reduced " else "") + r.getString("name"); val scenario = r.getString("scenario")
        reduced = red; cancel = !(r.has("cancel") && !r.optBoolean("cancel", true))
        compose.onRoot().performMouseInput { moveTo(px(1190.0, 600.0)) }
        val list = r.optJSONArray("items") ?: TRAIL
        if (scenario == "entrance") { load(r, JSONArray(), 60.0, 760.0); run(200.0) } else { load(r, list, 60.0, 760.0); run(1200.0) }
        val phases = r.getJSONArray("phases").objects()
        for ((i, ph) in phases.withIndex()) {
            val lbl = ph.getString("label"); val snap = ph.getJSONObject("snap")
            if (snap.optString("active").startsWith("button#before") || (snap.optString("active") == "body" && i > 0 && lbl.startsWith("tab"))) { report.put(JSONObject().put("run", name).put("phase", lbl).put("skipped", "document focus wrap")); break }
            val ss = ph.getJSONArray("samples"); val lastSample = if (ss.length() > 0) ss.getJSONObject(ss.length() - 1).getDouble("t") - ph.getDouble("t") else 0.0
            val dur = if (i + 1 < phases.size) phases[i + 1].getDouble("t") - ph.getDouble("t") else maxOf(420.0, lastSample + 30)
            val target = r.optString("target")
            when {
                scenario == "entrance" -> items = list.objects()
                lbl == "hover" && scenario == "pointer" -> center(target)?.let { p -> compose.onRoot().performMouseInput { moveTo(p) } }
                lbl == "click" -> center(target)?.let { p -> compose.onRoot().performMouseInput { moveTo(p); press() }; frame(); compose.onRoot().performMouseInput { release() } }
                lbl == "press" && scenario == "pointer" -> compose.onRoot().performMouseInput { press() }
                lbl == "release" && scenario == "pointer" -> compose.onRoot().performMouseInput { release() }
                lbl == "hover" -> toggleCenter()?.let { p -> compose.onRoot().performMouseInput { moveTo(p) } }
                lbl == "press" -> compose.onRoot().performMouseInput { press() }
                lbl == "release" -> compose.onRoot().performMouseInput { release() }
                lbl == "leave" -> compose.onRoot().performMouseInput { moveTo(px(1190.0, 600.0)) }
                lbl.startsWith("tab") -> sendKey(KeyEvent.KEYCODE_TAB)
                lbl == "shiftTab" -> sendKey(KeyEvent.KEYCODE_TAB, shift = true)
                lbl == "enter" -> sendKey(KeyEvent.KEYCODE_ENTER)
                scenario == "methods" -> compose.runOnIdle { if (lbl.startsWith("expand")) controller.expand() else controller.collapse() }
                lbl == "separator" -> trailProps = trailProps + ("separator" to "›")
                lbl == "maxItems3" -> trailProps = trailProps + ("maxItems" to 3)
                lbl == "authorCurrent" || lbl == "clearCurrent" -> items = items.map { if (it.getString("id") == "d") JSONObject(it.toString()).put("current", lbl == "authorCurrent") else it }
                lbl == "append" -> items = items + JSONObject().put("id", "tail").put("label", "Appendix")
                lbl == "remove" -> items = items.filter { it.getString("id") != "tail" }
                lbl == "label" -> trailProps = trailProps + mapOf("label" to "Site path", "expandLabel" to "Show every level")
                else -> check(false, "$name unknown phase $lbl")
            }
            val t0 = compose.mainClock.currentTime.toDouble(); val frames = ArrayList<Sample>()
            while (compose.mainClock.currentTime - t0 < dur - 12) { frame(); frames += sample(t0) }
            snapshot("$name $lbl", snap)
            if (lbl.startsWith("tab") || lbl == "shiftTab" || lbl == "enter" || (scenario == "overflowPointer" && lbl == "release")) {
                val active = snap.getString("active")
                val want = when { active.startsWith("md-breadcrumb-item#") -> active.removePrefix("md-breadcrumb-item#").substringBefore(" "); active.contains("overflow-btn") -> "toggle"; active.startsWith("button#after") -> "after"; else -> "body" }
                val got = compose.runOnIdle { probe.crumbs.entries.firstOrNull { it.value["focused"] == true }?.key ?: if (probe.toggle?.get("focused") == true) "toggle" else "after/body" }
                check(got == want || (want == "after" && got == "after/body"), "$name $lbl focus $got vs $want")
            }
            if (scenario == "runtime" && lbl == "label") { check(compose.runOnIdle { probe.trail["label"] } == "Site path", "$name label updated"); check(compose.runOnIdle { probe.toggle?.get("label") } == "Show every level", "$name expandLabel updated") }
            samples("$name $lbl", ph, frames, scenario == "entrance" && !red)
        }
        // The host attributes are recorded after the run (the runtime run relabels the trail).
        if (scenario != "entrance") check(compose.runOnIdle { probe.trail["label"] } == r.getJSONObject("host").getString("ariaLabel"), "$name landmark label")
        val web = r.getJSONArray("events").objects()
        check(events.size == web.size, "$name events ${events.map { it.name }} vs ${web.map { it.getString("name") }}")
        for ((n, w) in events.zip(web)) {
            check(n.name == w.getString("name") && n.defaultPrevented == w.optBoolean("prevented") && n.cancelable == w.optBoolean("cancelable"), "$name event ${n.name} prevented ${n.defaultPrevented}")
            val wd = w.getJSONObject("detail")
            for (k in listOf("href", "label", "current", "itemIndex", "itemTotal", "expanded", "itemCount")) if (wd.has(k)) {
                val a = n.detail[k]; val b = wd.get(k)
                check(if (a is Number && b is Number) a.toDouble() == b.toDouble() else a == b, "$name ${n.name}.$k $a vs $b") }
        }
        if (r.getJSONArray("phases").objects().any { it.getJSONObject("snap").optString("hash").isNotEmpty() })
            check(routes.lastOrNull() == r.getJSONArray("phases").objects().last().getJSONObject("snap").getString("hash"), "$name navigated $routes")
        compose.onRoot().performMouseInput { moveTo(px(1190.0, 600.0)) }; run(32.0)
    }
    private fun snapshot(name: String, snap: JSONObject) {
        for (it in snap.getJSONArray("items").objects()) {
            val id = it.getString("id"); val m = crumb(id)
            if (it.getString("display") == "none") { check(m == null, "$name $id hidden"); continue }
            if (m == null) { check(false, "$name $id shown"); continue }
            check(m["current"] == it.optBoolean("current"), "$name $id current")
            check(abs((m["opacity"] as Double) - it.optDouble("opacity", 1.0)) <= .12, "$name $id opacity ${m["opacity"]} vs ${it.optDouble("opacity")}")
            if (it.isNull("surface")) continue
            val ws = it.getJSONObject("surface")
            check(colorClose(m["ink"], ws.getString("color")), "$name $id colour ${m["ink"]} vs ${ws.getString("color")}")
            check(abs((m["nudgeNow"] as Double) - translateX(ws.getString("transform"))) <= .3, "$name $id nudge ${m["nudgeNow"]} vs ${ws.getString("transform")}")
            check((m["focusRing"] == true) == (ws.getString("outlineStyle") == "solid"), "$name $id focus ring")
            if (!it.isNull("layer")) check(abs((m["layer"] as Double) - it.getJSONObject("layer").getDouble("opacity")) <= .011, "$name $id layer ${m["layer"]} vs ${it.getJSONObject("layer").getDouble("opacity")}")
            if (!it.isNull("glyph")) check((m["fill"] as Int) == (if (it.getString("glyph").contains("\"FILL\" 1")) 1 else 0), "$name $id icon fill")
            check((m["separator"] != null) == !it.isNull("separator"), "$name $id separator presence")
            if (m["separator"] != null && !it.isNull("separator")) check(m["separator"] == it.getJSONObject("separator").getString("text"), "$name $id separator text ${m["separator"]}")
        }
        val tg = compose.runOnIdle { probe.toggle }
        check((tg != null) == !snap.isNull("overflow"), "$name toggle presence")
        if (tg != null && !snap.isNull("overflow")) { val ov = snap.getJSONObject("overflow")
            check(abs((tg["layer"] as Double) - alpha(ov.getString("backgroundColor"))) <= .011, "$name toggle layer ${tg["layer"]} vs ${ov.getString("backgroundColor")}")
            check(abs((tg["scaleNow"] as Double) - scaleOf(ov.getString("transform"))) <= .006, "$name toggle scale ${tg["scaleNow"]} vs ${ov.getString("transform")}")
            check((tg["focusRing"] == true) == (ov.getString("outlineStyle") == "solid"), "$name toggle focus ring") }
    }
    private fun samples(name: String, ph: JSONObject, frames: List<Sample>, entrance: Boolean) {
        val ss = ph.getJSONArray("samples").objects(); if (ss.isEmpty()) return
        var webStart = 0.0
        if (entrance) for (s in ss) { val h = s.getJSONArray("items").objects().firstOrNull() ?: continue; val o = h.optDouble("opacity", 1.0)
            if (o > .02 && o < .95) { var lo = 0.0; var hi = 500.0
                repeat(40) { val mid = (lo + hi) / 2; if (cubic(mid / 500) < o) lo = mid else hi = mid }; webStart = s.getDouble("t") - lo; break } }
        var compared = 0; var met = 0
        val tol = listOf(.03, .03, .03, .03, .012, .35, .07, .6)
        for (s in ss) {
            val e = s.getDouble("t") - (if (entrance) webStart else ph.getDouble("t"))
            if (!entrance && e < 30) continue   // Chrome applies input on its next frames; the native host reacts in the input frame
            for (it in s.getJSONArray("items").objects()) { if (it.getString("display") == "none") continue
                val id = it.getString("id")
                val web = arrayOfNulls<Double>(8); web[6] = it.optDouble("opacity", 1.0); web[7] = translateX(it.optString("transform"))
                if (!it.isNull("surface")) { val c = css(it.getJSONObject("surface").getString("color")); for (k in 0..3) web[k] = c[k]; web[5] = translateX(it.getJSONObject("surface").getString("transform")) }
                if (!it.isNull("layer")) web[4] = it.getJSONObject("layer").getDouble("opacity")
                val window = frames.mapNotNull { f -> val c = f.crumbs[id] ?: return@mapNotNull null; val te = if (entrance) f.crumbsEntrance[id] ?: return@mapNotNull null else c.first
                    if (te >= e - 50 && te <= e + 50) c.second else null }
                if (window.isEmpty()) continue
                for (k in 0..7) { val w = web[k] ?: continue; compared++
                    if (window.any { abs(it[k] - w) <= tol[k] }) met++ else check(false, "$name t+${e.toInt()} $id [$k] web $w native ${window.map { it[k] }}") }
            }
            if (!s.isNull("overflow")) { val ov = s.getJSONObject("overflow"); val web = listOf(alpha(ov.getString("backgroundColor")), scaleOf(ov.getString("transform")))
                val window = frames.filter { it.t >= e - 50 && it.t <= e + 50 }.mapNotNull { it.toggle }
                if (window.isNotEmpty()) for (k in 0..1) { compared++
                    if (window.any { abs(it[k] - web[k]) <= (if (k == 0) .012 else .008) }) met++ else check(false, "$name t+${e.toInt()} toggle [$k] web ${web[k]} native ${window.map { it[k] }}") } }
        }
        checks += met
        report.put(JSONObject().put("run", name).put("samples", ss.size).put("compared", compared).put("met", met).put("frames", frames.size))
    }
    private fun cubic(x: Double): Double { // cubic-bezier(0.38, 1.21, 0.22, 1)
        var lo = 0.0; var hi = 1.0; var t = x
        repeat(50) { t = (lo + hi) / 2; val bx = 3 * (1 - t) * (1 - t) * t * .38 + 3 * (1 - t) * t * t * .22 + t * t * t; if (bx < x) lo = t else hi = t }
        return 3 * (1 - t) * (1 - t) * t * 1.21 + 3 * (1 - t) * t * t * 1.0 + t * t * t
    }
}
