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
    private var inkMeasured = 0; private var inkOffCapture = 0
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
    /** The oracle's `::part()` rules ("tag::part" → property → value). */
    private fun partRules(css: String): Map<String, Map<String, String>> {
        val out = mutableMapOf<String, MutableMap<String, String>>()
        for (m in Regex("([a-z-]+)::part\\(([a-z-]+)\\)\\{([^}]*)\\}").findAll(css)) {
            val key = m.groupValues[1] + "::" + m.groupValues[2]
            for (decl in m.groupValues[3].split(';')) { val kv = decl.split(':', limit = 2).map { it.trim() }; if (kv.size == 2) out.getOrPut(key) { mutableMapOf() }[kv[0]] = kv[1] }
        }
        return out
    }
    private fun cssPx(s: String?) = s?.trim()?.removeSuffix("px")?.toDoubleOrNull()
    /** CSS colours to the typed API's #RRGGBB(AA) (a 3/4-digit hex expands). */
    private fun cssHex(v: String) = if (Regex("^#[0-9A-Fa-f]{3,4}$").matches(v)) "#" + v.drop(1).map { "$it$it" }.joinToString("") else v
    /** The typed part appearances that carry the case's `::part()` rules (gate-7 R6-03; `::part(overflow)` as a box: R6-17). */
    private fun itemParts(c: JSONObject): AWCBreadcrumbItemPartAppearance {
        val r = partRules(c.optString("parts")); fun p(k: String, prop: String) = r["md-breadcrumb-item::$k"]?.get(prop)?.let { cssHex(it) }
        fun bg(k: String) = p(k, "background-color") ?: p(k, "background")
        val border = p("static", "border")?.split(' ')
        return AWCBreadcrumbItemPartAppearance(p("separator", "color"), cssPx(p("separator", "font-size")), p("icon", "color"), p("label", "color"), p("link", "color"),
            p("link", "text-decoration")?.contains("underline"), p("static", "color"), bg("static"), border?.firstOrNull()?.let { cssPx(it) }, border?.firstOrNull { it.startsWith("#") },
            bg("state-layer"), p("state-layer", "opacity")?.toDoubleOrNull())
    }
    private fun trailParts(c: JSONObject): AWCBreadcrumbsPartAppearance {
        val r = partRules(c.optString("parts")); fun p(k: String, prop: String) = r["md-breadcrumbs::$k"]?.get(prop)?.let { cssHex(it) }
        fun bg(k: String) = p(k, "background-color") ?: p(k, "background")
        return AWCBreadcrumbsPartAppearance(bg("list"), p("list", "padding")?.let { numbers(it) }, p("separator", "color"), cssPx(p("separator", "font-size")),
            bg("overflow-button"), p("overflow-button", "color"), PartBoxParity.box(r["md-breadcrumbs::overflow"]))
    }
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
                AWCBreadcrumbsPartAppearanceScope(trailParts(c)) { AWCBreadcrumbItemPartAppearanceScope(itemParts(c)) {
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
                } }
            }
        } } }
    } } }
    private fun frame() { compose.mainClock.advanceTimeByFrame() }
    private fun run(ms: Double) { var t = 0.0; while (t < ms) { frame(); t += 16.0 } }
    private fun px(x: Double, y: Double) = Offset((x * scale).toFloat(), (y * scale).toFloat())
    /** Glyph ink (gate-7 R6-22): in the band 15–60 % of a label box (glyph bodies; an underline lies below), the dominant colour
     *  (the background) and the pixel farthest from it, at the capture's device scale. */
    private fun labelInk(pm: androidx.compose.ui.graphics.PixelMap, b: List<Double>): Pair<IntArray, IntArray>? {
        val x0 = (b[0] * scale).toInt().coerceAtLeast(0); val x1 = ((b[0] + b[2]) * scale).toInt().coerceAtMost(pm.width)
        val y0 = ((b[1] + b[3] * .15) * scale).toInt().coerceAtLeast(0); val y1 = ((b[1] + b[3] * .6) * scale).toInt().coerceAtMost(pm.height)
        if (x1 - x0 < 2 || y1 - y0 < 2) return null
        fun ch(c: Color) = intArrayOf((c.red * 255).toInt(), (c.green * 255).toInt(), (c.blue * 255).toInt())
        val counts = HashMap<Int, Int>()
        for (y in y0 until y1) for (x in x0 until x1) { val p = ch(pm[x, y]); val k = p[0] shl 16 or (p[1] shl 8) or p[2]; counts[k] = (counts[k] ?: 0) + 1 }
        val mode = counts.maxByOrNull { it.value }!!.key; val bg = intArrayOf(mode shr 16 and 255, mode shr 8 and 255, mode and 255)
        var best = bg; var far = -1
        for (y in y0 until y1) for (x in x0 until x1) { val p = ch(pm[x, y]); val d = (0..2).maxOf { abs(p[it] - bg[it]) }; if (d > far) { far = d; best = p } }
        return bg to best
    }
    /** The label of [id] paints [rgba] (0…1, straight alpha) over its background. */
    private fun inkCheck(what: String, id: String, rgba: List<Double>) {
        val pm = compose.onRoot().captureToImage().toPixelMap(); val ink = box(crumb(id), "label")?.let { labelInk(pm, it) }
        if (ink == null) { check(false, "$what: $id label ink measured"); return }
        val exp = (0..2).map { ink.first[it] * (1 - rgba[3]) + rgba[it] * 255 * rgba[3] }
        check((0..2).all { abs(ink.second[it] - exp[it]) <= 12 }, "$what: $id label ink ${ink.second.toList()} vs ${exp.map { it.toInt() }}")
    }
    /** Gate-7 R6-22: a crumb whose kind swaps by an update (link ↔ static: `disabled`, an authored `current`) paints its new ink in
     *  the frames of the change — the painted glyph ink equals the model's ink — and a crumb that stays static after its 200 ms. */
    @Test fun crumbLabelInkFollowsStateChanges() {
        content(); reduced = null
        load(JSONObject("{\"name\":\"ink-updates\",\"theme\":\"light\",\"dir\":\"ltr\"}"), null, 40.0, 720.0); run(1400.0)
        @Suppress("UNCHECKED_CAST") fun model(id: String) = crumb(id)?.get("ink") as? List<Double> ?: listOf(0.0, 0.0, 0.0, 0.0)
        val t = AWCGeneratedTokens.light; fun tok(k: String) = hex(t["--md-sys-color-$k"]).let { listOf(it.red.toDouble(), it.green.toDouble(), it.blue.toDouble(), 1.0) }
        fun same(a: List<Double>, b: List<Double>) = a.zip(b).all { (x, y) -> abs(x - y) <= .012 }
        inkCheck("at rest", "lib", tok("on-surface-variant")); inkCheck("at rest", "page", tok("on-secondary-container"))
        fun change(id: String, key: String, value: Boolean, wait: Double = 48.0) { items = items.map { o -> JSONObject(o.toString()).also { if (it.getString("id") == id) it.put(key, value) } }; run(wait) }
        change("lib", "disabled", true)
        check(same(model("lib"), tok("on-surface").let { listOf(it[0], it[1], it[2], .61) }), "disabled: lib model ink ${model("lib")}"); inkCheck("disabled by an update", "lib", model("lib"))
        change("lib", "disabled", false)
        check(same(model("lib"), tok("on-surface-variant")), "enabled: lib model ink ${model("lib")}"); inkCheck("enabled again by an update", "lib", model("lib"))
        change("docs", "current", true)
        check(same(model("docs"), tok("on-secondary-container")), "current: docs model ink ${model("docs")}"); inkCheck("an authored current by an update", "docs", model("docs"))
        run(400.0); inkCheck("the last crumb while another is current (after its transition)", "page", model("page"))
        change("docs", "current", false)
        check(same(model("docs"), tok("on-surface-variant")), "not current: docs model ink ${model("docs")}"); inkCheck("current removed by an update", "docs", model("docs"))
        run(400.0); inkCheck("the last crumb current again (after its transition)", "page", model("page"))
        AccordionEvidence.log("breadcrumbs-ink-updates", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(60))))
        assertTrue("${failures.size} of $checks failed:\n" + failures.joinToString("\n"), failures.isEmpty())
    }
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
        AccordionEvidence.log("breadcrumbs-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("labelInkMeasured", inkMeasured).put("labelInkOffCapture", inkOffCapture).put("failureList", JSONArray(failures.take(300))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun paint(c: JSONObject) {
        val name = c.getString("name")
        reduced = null; load(c, c.optJSONArray("items"), 40.0, 720.0); run(64.0)
        if (c.optBoolean("expand")) { compose.runOnIdle { controller.expand() }; run(64.0) }
        run(1200.0)
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
        // ::part(overflow) box (gate-7 R6-17): the overflow item's border box and its typed box against Chrome's computed box.
        if (tg != null && !s.isNull("overflow") && PartBoxParity.box(partRules(c.optString("parts"))["md-breadcrumbs::overflow"]) != null) {
            val ov = s.getJSONObject("overflow"); val wr = ov.getJSONObject("rect"); val ob = box(tg, "overflow")
            near(ob?.get(0), wr.getDouble("x"), "overflow x"); near(ob?.get(1), wr.getDouble("y"), "overflow y"); near(ob?.get(2), wr.getDouble("width"), "overflow width", 1.0); near(ob?.get(3), wr.getDouble("height"), "overflow height")
            @Suppress("UNCHECKED_CAST") val pb = tg["box"] as? Map<String, Any?>
            for ((ok, l) in PartBoxParity.checks("$name overflow", pb, ov.getString("backgroundColor"), ov.getString("borderTopWidth"), ov.getString("borderTopColor"), ov.getString("borderTopLeftRadius"),
                listOf("paddingTop", "paddingRight", "paddingBottom", "paddingLeft").map { ov.getString(it) })) check(ok, l)
        }
        if (c.has("parts") && !c.isNull("parts")) {
            // ::part() targets (gate-7 R6-03): the typed values against Chrome's computed styles (the ::part(overflow) box: above).
            val lw = s.getJSONObject("list"); val tr = compose.runOnIdle { probe.trail }
            @Suppress("UNCHECKED_CAST") val lp = tr["listPadding"] as? List<Double>; val wp = listOf("paddingTop", "paddingRight", "paddingBottom", "paddingLeft").map { cssPx(lw.optString(it)) ?: -1.0 }
            check(lp != null && lp.zip(wp).all { (a, b) -> abs(a - b) < .01 }, "$name list padding $lp vs $wp")
            val wlb = lw.optString("backgroundColor")
            check(if (alpha(wlb) == 0.0) tr["listBackground"] == null else colorClose(tr["listBackground"], wlb), "$name list background ${tr["listBackground"]} vs $wlb")
            for (it in s.getJSONArray("items").objects()) {
                if (it.getJSONObject("rect").getDouble("width") == 0.0) continue
                val id = it.getString("id"); val m = crumb(id) ?: continue
                it.optJSONObject("label")?.let { l -> check(colorClose(m["labelColor"], l.getString("color")), "$name $id label colour ${m["labelColor"]} vs ${l.getString("color")}") }
                it.optJSONObject("icon")?.let { ic -> check(colorClose(m["iconColor"], ic.getString("color")), "$name $id icon colour ${m["iconColor"]} vs ${ic.getString("color")}") }
                it.optJSONObject("separator")?.let { sp -> check(colorClose(m["sepColor"], sp.getString("color")), "$name $id separator colour ${m["sepColor"]} vs ${sp.getString("color")}")
                    near(m["sepSize"] as? Double, cssPx(sp.getString("fontSize")), "$id separator font size", .01)
                    near(box(m, "separator")?.get(2), sp.getJSONObject("rect").getDouble("width"), "$id separator width") }
                val ws = it.optJSONObject("surface") ?: continue
                val under = ws.optString("textDecorationLine").contains("underline")
                check((m["underline"] == true) == under, "$name $id underline ${m["underline"]} vs ${ws.optString("textDecorationLine")}")
                // The underline is drawn (its first baseline resolved) under the label and an icon-font glyph.
                if (under) { check(((m["underlineLabel"] as? IntArray)?.get(0) ?: -1) >= 0, "$name $id label underline drawn")
                    if (!it.isNull("icon") && it.getJSONObject("icon").optJSONObject("glyph") != null) check(((m["underlineIcon"] as? IntArray)?.get(0) ?: -1) >= 0, "$name $id icon underline drawn") }
                val bw = cssPx(ws.optString("borderTopWidth")) ?: 0.0
                near(m["border"] as? Double, bw, "$id border width", .01)
                if (bw > 0) check(colorClose(m["borderColor"], ws.getString("borderTopColor")), "$name $id border colour ${m["borderColor"]} vs ${ws.getString("borderTopColor")}")
                if (ws.getString("kind") == "link") it.optJSONObject("stateLayer")?.let { sl ->
                    check(colorClose(m["layerColor"], sl.getString("backgroundColor")), "$name $id state layer colour ${m["layerColor"]} vs ${sl.getString("backgroundColor")}")
                    near(m["layer"] as? Double, sl.optString("opacity").toDoubleOrNull(), "$id state layer opacity", .001) }
            }
            val ov = s.optJSONObject("overflow")
            if (ov != null && tg != null) { val b = ov.getJSONObject("button")
                check(colorClose(tg["background"], b.getString("backgroundColor")), "$name toggle background ${tg["background"]} vs ${b.getString("backgroundColor")}")
                check(colorClose(tg["color"], b.getString("color")), "$name toggle colour ${tg["color"]} vs ${b.getString("color")}")
                ov.optJSONObject("separator")?.let { sp -> check(colorClose(tg["sepColor"], sp.getString("color")), "$name overflow separator colour ${tg["sepColor"]} vs ${sp.getString("color")}")
                    near(tg["sepSize"] as? Double, cssPx(sp.getString("fontSize")), "overflow separator font size", .01) } }
        }
        if (name.startsWith("matrix-light-ltr")) report.put(JSONObject().put("debug", name).put("crumbs", JSONObject(s.getJSONArray("items").objects().associate { it.getString("id") to
            JSONArray(listOf("item", "surface", "label", "separator").map { k -> box(crumb(it.getString("id")), k)?.let { b -> JSONArray(b) } } +
                listOf(crumb(it.getString("id"))?.get("labelPx"), crumb(it.getString("id"))?.get("sepPx"), crumb(it.getString("id"))?.get("label"),
                    android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG or android.graphics.Paint.LINEAR_TEXT_FLAG).run {
                        typeface = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.resources.getFont(dev.awc.nativeui.R.font.awc_roboto_medium)
                        textSize = 28f; letterSpacing = .1f / 14f; measureText(crumb(it.getString("id"))?.get("label") as? String ?: "") })) })))
        val clip = c.getJSONObject("clip")
        val pm = compose.onRoot().captureToImage().toPixelMap()
        // Glyph ink (gate-7 R6-22): the flat-pixel comparison skips glyphs, so every label's ink is checked against Chrome's colour.
        for (it in s.getJSONArray("items").objects()) {
            if (it.getJSONObject("rect").getDouble("width") == 0.0 || it.isNull("label")) continue
            val id = it.getString("id"); val lb = box(crumb(id), "label") ?: continue
            val ws = it.getJSONObject("label").optString("color").ifEmpty { it.optJSONObject("surface")?.optString("color") ?: "" }
            val want = css(ws); if (lb[2] <= 2 || want[3] <= 0.0) continue
            // A label outside the capture (the 720 dp page is wider than the emulator screen: right-to-left trails start off screen)
            // has no pixels to read: counted, not failed.
            if (lb[0] < 0 || lb[1] < 0 || (lb[0] + lb[2]) * scale > pm.width || (lb[1] + lb[3]) * scale > pm.height) { inkOffCapture++; continue }
            val ink = labelInk(pm, lb); if (ink == null) { check(false, "$name $id label ink measured"); continue }
            inkMeasured++
            val exp = (0..2).map { k -> ink.first[k] * (1 - want[3]) + want[k] * 255 * want[3] }
            check((0..2).all { k -> abs(ink.second[k] - exp[k]) <= 12 }, "$name $id label ink ${ink.second.toList()} vs ${exp.map { v -> v.toInt() }} ($ws)")
        }
        val nat = CardWeb.nativeGrid(pm, clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
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
