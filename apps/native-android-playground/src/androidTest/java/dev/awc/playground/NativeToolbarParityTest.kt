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
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.onFocusChanged
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
import kotlin.math.floor

/**
 * md-toolbar against Chrome (paint.html / states.html, Mac Chrome 153, DPR 1): the paint matrix (host, container, FAB and item
 * boxes, chrome colours, radius and elevation, role / orientation / name, the roving stop, the toolbar-only icon-button tints,
 * flat pixels) and the interaction runs (Tab in/out, arrows on the bar's axis, wrap, Home/End, modified and off-axis arrows,
 * independent stops, soft-disabled and opted-out members, setFocus(), generic mode, the dynamic re-sync, pointer state layers)
 * through real key and mouse input: focus, stops, rings, role, focusin/click sequence and the flat pixels of each phase.
 * Raw HTML controls of the oracle have no native node: phases landing on one are not replayed.
 */
@OptIn(ExperimentalTestApi::class)
class NativeToolbarParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\"}"))
    private var nodes by mutableStateOf<List<JSONObject>>(emptyList())
    private var epoch by mutableIntStateOf(0)
    private var origin by mutableStateOf(40.0 to 40.0)
    private var pageWidth by mutableStateOf(720.0)
    private val scale = 2f
    private val probe = AWCToolbarProbe()
    private val controller = AWCToolbarController()
    private val before = FocusRequester()
    private val sink = FocusRequester()
    private var sinkOn by mutableStateOf(false)
    private val events = mutableListOf<Pair<String, String>>()
    private var focusedID = "body"
    private val focusOf = HashMap<String, Boolean>()
    private lateinit var view: android.view.View
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun hex(v: String?) = Color(android.graphics.Color.parseColor(v!!))
    private fun numbers(s: String) = Regex("-?[0-9.]+(e-?[0-9]+)?").findAll(s).mapNotNull { it.value.toDoubleOrNull() }.toList()
    private fun css(s: String): List<Double> { val n = numbers(s)
        return when { s.startsWith("rgba") && n.size >= 4 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, n[3]); s.startsWith("rgb") && n.size >= 3 -> listOf(n[0] / 255, n[1] / 255, n[2] / 255, 1.0)
            s.startsWith("#") && s.length >= 7 -> { val c = android.graphics.Color.parseColor(s); listOf((c shr 16 and 255) / 255.0, (c shr 8 and 255) / 255.0, (c and 255) / 255.0, (c ushr 24) / 255.0) }
            else -> listOf(0.0, 0.0, 0.0, 0.0) } }
    private fun rgba(c: Any?): List<Double>? = when (c) { is Color -> listOf(c.red.toDouble(), c.green.toDouble(), c.blue.toDouble(), c.alpha.toDouble()); is String -> css(c); else -> null }
    private fun colorClose(a: Any?, web: String, tol: Double = .014): Boolean {
        val n = rgba(a) ?: return false; val w = css(web)
        fun pm(c: List<Double>) = listOf(c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3])
        return pm(n).zip(pm(w)).all { (x, y) -> abs(x - y) <= tol }
    }
    private fun props(o: JSONObject): Map<String, AWCValue> = buildMap { val p = o.optJSONObject("properties") ?: JSONObject()
        for (k in p.keys()) if (k != "_hooks") put(k, p.get(k)); put("id", o.getString("id")) }
    /** ::part() rules of the case: container (background / background-color; gate-7 R6-03) and the fab-container box (R6-17). */
    private fun toolbarParts(c: JSONObject) = AWCToolbarPartAppearance(Regex("md-toolbar::part\\(container\\)\\{[^}]*background(-color)?:\\s*(#[0-9A-Fa-f]{6,8})")
        .find(c.optString("parts"))?.groupValues?.get(2), PartBoxParity.box(PartBoxParity.rule(c.optString("parts"), "md-toolbar", "fab-container")))
    private fun hooks(o: JSONObject?): AWCToolbarAppearance {
        val h = o?.optJSONObject("properties")?.optJSONObject("_hooks") ?: return AWCToolbarAppearance()
        return AWCToolbarAppearance.fromCSS(h.keys().asSequence().associateWith { h.getString(it) })
    }
    @Composable private fun Node(o: JSONObject) {
        val id = o.getString("id"); val kids = o.getJSONArray("children").objects()
        AWCComponent(o.getString("tag"), props(o), modifier = Modifier.onFocusChanged { focusOf[id] = it.hasFocus }, onEvent = { n, _ -> events += n to id }) { slot ->
            for (k in kids) {
                if (k.optString("slot").ifEmpty { "" } != slot) continue
                when (k.getString("tag")) {
                    "#text" -> AWCSlotText(k.getJSONObject("properties").getString("text"))
                    else -> key(k.getString("id")) { Node(k) }
                }
            }
        }
    }
    /** The tree's authored texts by id (the host's IDREF scope for aria-labelledby). */
    private fun labelTexts(list: List<JSONObject>): Map<String, String> = buildMap {
        fun text(o: JSONObject): String = if (o.getString("tag") == "#text") o.getJSONObject("properties").optString("text")
            else o.optJSONArray("children")?.objects().orEmpty().joinToString("") { text(it) }
        fun walk(o: JSONObject) { put(o.getString("id"), text(o)); o.optJSONArray("children")?.objects().orEmpty().forEach { walk(it) } }
        list.forEach { walk(it) }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(scale, 1f)) {
        view = LocalView.current
        val c = case; val dark = c.optString("theme") == "dark"; val t = if (dark) AWCGeneratedTokens.dark else AWCGeneratedTokens.light
        val frame = c.optJSONObject("frame") ?: JSONObject(); val inherited = c.optDouble("inheritedDensity", 0.0)
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(hex(t["--md-sys-color-surface"]))) { key(epoch) {
            val dir = if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr, LocalAWCToolbarProbe provides probe) {
                AWCLabelTextsScope(labelTexts(nodes)) { AWCToolbarAppearanceScope(hooks(nodes.firstOrNull { it.getString("tag") != "#text" })) { AWCToolbarPartAppearanceScope(toolbarParts(c)) { AWCToolbarControllerScope(controller) { AWCDensityScope(if (inherited.isNaN()) 0.0 else inherited) {
                    Box(Modifier.size(1.dp).focusRequester(before).onFocusChanged { focusOf["before"] = it.hasFocus }.focusable())
                    // blur(): focus leaves for an untracked sink (Chrome's body).
                    Box(Modifier.size(1.dp).focusRequester(sink).focusProperties { canFocus = sinkOn }.focusable())
                    Column(Modifier.absoluteOffset(origin.first.dp, origin.second.dp).wrapContentWidth(Alignment.Start, unbounded = true).width(pageWidth.dp)) {
                        CompositionLocalProvider(LocalLayoutDirection provides dir) { Column(Modifier.fillMaxWidth()) { for (n in nodes) key(n.getString("id")) {
                            Box(Modifier.then(if (frame.has("width")) Modifier.width(frame.getDouble("width").dp) else Modifier)
                                .then(if (frame.has("maxWidth")) Modifier.widthIn(max = (frame.getDouble("maxWidth") + 32).dp) else Modifier)
                                .then(if (frame.has("maxHeight")) Modifier.heightIn(max = frame.getDouble("maxHeight").dp) else Modifier)) {
                                if (n.getString("tag") == "#text") AWCSlotText(n.getJSONObject("properties").getString("text")) else Node(n) } } } }
                        Box(Modifier.padding(top = 300.dp).size(1.dp).onFocusChanged { focusOf["after"] = it.hasFocus }.focusable())
                    }
                } } } } }
            }
        } } }
    } } }
    private fun frame() { compose.mainClock.advanceTimeByFrame() }
    private fun run(ms: Double) { var t = 0.0; while (t < ms) { frame(); trackFocus(); t += 16.0 } }
    private fun trackFocus() { val f = compose.runOnIdle { focusOf.entries.filter { it.value }.map { it.key }.sortedBy { if (it == "bar1") 1 else 0 }.firstOrNull() ?: "body" }
        if (f != focusedID) { focusedID = f; if (f != "body" && f != "bar1") events += "focusin" to f } }
    private fun px(x: Double, y: Double) = Offset((x * scale).toFloat(), (y * scale).toFloat())
    private fun pos(c: Any?): List<Double>? = compose.runOnIdle { val l = c as? LayoutCoordinates ?: return@runOnIdle null
        if (!l.isAttached) null else l.positionInRoot().let { listOf(it.x / scale.toDouble(), it.y / scale.toDouble(), l.size.width / scale.toDouble(), l.size.height / scale.toDouble()) } }
    private fun item(id: String): List<Double>? { val bar = compose.runOnIdle { probe.bar }; val cpos = pos(bar["container"]) ?: return null
        @Suppress("UNCHECKED_CAST") val r = compose.runOnIdle { probe.items[id]?.get("rect") as? List<Double> } ?: return null
        // The container box includes the pill padding: items are laid out inside it.
        val pad = (bar["padding"] as? Double) ?: 0.0
        return listOf(cpos[0] + r[0] + pad, cpos[1] + r[1] + pad, r[2], r[3]) }
    private fun sendKey(code: Int, meta: Int = 0) = compose.runOnIdle { view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_DOWN, code, 0, meta)); view.dispatchKeyEvent(KeyEvent(0, 0, KeyEvent.ACTION_UP, code, 0, meta)) }
    private fun load(c: JSONObject, page: Double, at: Pair<Double, Double>) {
        compose.mainClock.autoAdvance = false
        case = c; nodes = JSONArray(c.getString("nodesJSON")).objects(); origin = at; pageWidth = page
        probe.items.clear(); events.clear(); focusOf.clear(); focusedID = "body"; epoch++
    }

    @Test fun toolbarMatchesChromePaint() {
        content()
        for (c in CardWeb.document("ToolbarWebPaint.json").getJSONArray("cases").objects()) paint(c)
        // aria-labelledby: the IDREF list resolves to the referenced texts in the host's scope (wins over aria-label); an
        // unresolved reference falls back to aria-label; a text change of the referenced node renames the toolbar.
        fun labelled(text: String, ref: String): String {
            load(JSONObject().put("name", "labelledby").put("nodesJSON", JSONArray().put(JSONObject("{\"id\":\"tb-title\",\"tag\":\"#text\",\"properties\":{\"text\":${JSONObject.quote(text)}},\"children\":[]}"))
                .put(JSONObject("{\"id\":\"tbl\",\"tag\":\"md-toolbar\",\"properties\":{\"ariaLabelledby\":${JSONObject.quote(ref)},\"ariaLabelProp\":\"Fallback\"},\"children\":[{\"id\":\"tbl-b1\",\"tag\":\"md-icon-button\",\"properties\":{\"icon\":\"undo\",\"aria-label\":\"Undo\"},\"children\":[]}]}")).toString()), 720.0, 40.0 to 40.0)
            run(300.0); return compose.runOnIdle { probe.bar["label"] as? String } ?: "-"
        }
        labelled("Text formatting", "tb-title").let { check(it == "Text formatting", "aria-labelledby names the toolbar ($it)") }
        labelled("Text formatting", "missing").let { check(it == "Fallback", "an unresolved aria-labelledby falls back to aria-label ($it)") }
        labelled("Paragraph", "tb-title missing").let { check(it == "Paragraph", "IDREF lists keep the resolved names ($it)") }
        AccordionEvidence.log("toolbar-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(300))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun paint(c: JSONObject) {
        val name = c.getString("name"); val host = c.getJSONObject("host"); val hr = host.getJSONObject("rect")
        val par = c.getJSONObject("parent"); val ox = par.getDouble("x"); val oy = par.getDouble("y")
        load(c, par.getDouble("width"), ox to oy); run(500.0)
        fun near(a: Double?, b: Double?, l: String, tol: Double = .75) = check(a != null && b != null && abs(a - b) <= tol, "$name $l $a vs $b")
        val bar = compose.runOnIdle { probe.bar }
        if (host.getString("display") == "none" || hr.getDouble("width") == 0.0) { check(pos(bar["host"]) == null || bar.isEmpty(), "$name hidden bar takes no space"); return }
        val hp = pos(bar["host"]) ?: run { check(false, "$name bar measured"); return }
        val dropped = c.getJSONArray("dropped").let { a -> (0 until a.length()).map { a.getString(it) } }.toSet()
        val hugs = dropped.isNotEmpty() && host.getString("display") != "flex"
        near(hp[0] - ox, hr.getDouble("x"), "host x"); near(hp[1] - oy, hr.getDouble("y"), "host y")
        if (!hugs) near(hp[2], hr.getDouble("width"), "host width", 1.0); near(hp[3], hr.getDouble("height"), "host height")
        check(colorClose(bar["background"], host.getString("bg")), "$name host background ${rgba(bar["background"])} vs ${host.getString("bg")}")
        check((bar["role"] == "toolbar") == (host.optString("role") == "toolbar"), "$name role ${bar["role"]} vs ${host.optString("role")}")
        if (host.optString("role") == "toolbar") {
            check(bar["orientation"] == host.optString("orientation"), "$name orientation ${bar["orientation"]} vs ${host.optString("orientation")}")
            check(bar["label"] == (if (host.isNull("label")) "" else host.getString("label")), "$name name ${bar["label"]}")
        }
        val ct = c.getJSONObject("container"); val cr = ct.getJSONObject("rect")
        pos(bar["container"])?.let { cp -> near(cp[0] - ox, cr.getDouble("x"), "container x"); near(cp[1] - oy, cr.getDouble("y"), "container y")
            if (!hugs) near(cp[2], cr.getDouble("width"), "container width", 1.0); near(cp[3], cr.getDouble("height"), "container height")
            check(colorClose(bar["pill"], ct.getString("bg")), "$name container background ${rgba(bar["pill"])} vs ${ct.getString("bg")}") } ?: check(false, "$name container measured")
        c.optJSONObject("fab")?.let { f -> val fr = f.getJSONObject("rect"); pos(bar["fab"])?.let { fp ->
            near(fp[0] - ox, fr.getDouble("x"), "fab x"); near(fp[1] - oy, fr.getDouble("y"), "fab y"); near(fp[2], fr.getDouble("width"), "fab width", 1.0); near(fp[3], fr.getDouble("height"), "fab height", 1.0) } ?: check(false, "$name fab measured")
            // ::part(fab-container) box (gate-7 R6-17): the typed box against Chrome's computed box.
            if (PartBoxParity.rule(c.optString("parts"), "md-toolbar", "fab-container") != null) {
                @Suppress("UNCHECKED_CAST") val pb = bar["fabBox"] as? Map<String, Any?>
                for ((ok, l) in PartBoxParity.checks("$name fab-container", pb, f.getString("bg"), f.getString("bw"), f.getString("bc"), f.getString("radius"),
                    f.getJSONArray("pad").let { a -> (0 until a.length()).map { a.getString(it) } })) check(ok, l)
            } }
        var shifted = false
        for (ch in c.getJSONArray("children").objects()) {
            val id = ch.getString("id"); if (id in dropped) { shifted = true; continue }
            val m = compose.runOnIdle { probe.items[id] } ?: run { check(false, "$name $id measured"); null } ?: continue
            if (ch.getString("slot") != "fab") { val r = item(id); val wr = ch.getJSONObject("rect")
                if (r == null) check(false, "$name $id rect") else {
                    if (!shifted) near(r[0] - ox, wr.getDouble("x"), "$id x"); near(r[1] - oy, wr.getDouble("y"), "$id y")
                    near(r[2], wr.getDouble("width"), "$id width", 1.0); near(r[3], wr.getDouble("height"), "$id height", 1.0) } }
            val member = m["member"] == true
            check(member == (!ch.isNull("groupTabindex")), "$name $id roving member $member")
            if (member) check((m["tabStop"] == true) == (ch.optString("tabindex") == "0"), "$name $id tab stop")
            ch.optJSONObject("vars")?.let { v -> val sch = m["scheme"] as? Map<*, *>
                for ((k, f) in listOf("--md-icon-button-icon-color" to "iconColor", "--md-icon-button-state-layer-color" to "stateLayerColor", "--md-icon-button-container-color" to "containerColor")) {
                    val web = v.optString(k); val nat = sch?.get(f)
                    if (web.isEmpty()) check(nat == null, "$name $id $f untinted ($nat)") else check(nat != null && colorClose(nat, web), "$name $id $f $nat vs $web") } }
        }
        if (dropped.isNotEmpty()) { report.put(JSONObject().put("case", name).put("skipped", "pixels: raw HTML controls have no native node")); return }
        val clip = c.getJSONObject("clip")
        val nat = CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(), clip.getInt("x"), clip.getInt("y"), clip.getInt("width"), clip.getInt("height"))
        val res = CardWeb.compare(CardWeb.webGrid("ToolbarWebPaint/$name.png", clip), nat)
        check(res.getInt("over6").toDouble() / maxOf(res.getInt("compared"), 1) <= .005 && res.getDouble("mean") <= 1.0, "$name flat pixels $res"); report.put(res.put("case", name))
    }
    @Test fun toolbarMatchesChromeStates() {
        content()
        for ((file, red) in listOf("ToolbarWebStates.json" to false, "ToolbarWebStatesReduced.json" to true))
            for (r in CardWeb.document(file).getJSONArray("runs").objects()) states(r, red)
        AccordionEvidence.log("toolbar-states", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    private fun webID(active: String) = if (active == "body") "body" else active.substringAfterLast('#')
    private fun edit(id: String, change: (JSONObject) -> Unit) {
        val copy = nodes.map { JSONObject(it.toString()) }
        for (bar in copy) { if (bar.getString("id") == id) change(bar) else for (c in bar.getJSONArray("children").objects()) if (c.getString("id") == id) change(c) }
        nodes = copy
    }
    private fun states(r: JSONObject, red: Boolean) {
        val name = (if (red) "reduced " else "") + r.getString("name")
        compose.onRoot().performMouseInput { moveTo(px(1190.0, 890.0)) }
        load(r, 720.0, 60.0 to 60.0); run(600.0)
        val dropped = r.getJSONArray("dropped").let { a -> (0 until a.length()).map { a.getString(it) } }.toSet()
        val scenario = r.getString("scenario"); val target = r.optString("target")
        if (scenario != "setFocus" && scenario != "pointer") { compose.runOnIdle { runCatching { before.requestFocus() } }; run(48.0); events.clear() }
        val phases = r.getJSONArray("phases").objects()
        for ((i, ph) in phases.withIndex()) {
            val lbl = ph.getString("label")
            if (webID(ph.getString("active")) in dropped) { report.put(JSONObject().put("run", name).put("phase", lbl).put("skipped", "lands on ${ph.getString("active")}")); continue }
            // The last phase lasts as long as Chrome sampled it (its screenshot ends it).
            val fr = ph.getJSONArray("frames"); val dur = if (i + 1 < phases.size) phases[i + 1].getDouble("t") - ph.getDouble("t") else (if (fr.length() > 0) fr.getJSONObject(fr.length() - 1).getDouble("t") else 200.0) + 17
            val shift = KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON
            when {
                lbl in setOf("tab", "tab1", "tab2", "tab3", "tab4", "tabOut", "tabToInput") -> sendKey(KeyEvent.KEYCODE_TAB)
                lbl.startsWith("shiftTab") -> sendKey(KeyEvent.KEYCODE_TAB, shift)
                lbl == "shiftRight" -> sendKey(KeyEvent.KEYCODE_DPAD_RIGHT, shift)
                lbl.startsWith("right") -> sendKey(KeyEvent.KEYCODE_DPAD_RIGHT)
                lbl == "left" || lbl == "arrowOnFab" -> sendKey(KeyEvent.KEYCODE_DPAD_LEFT)
                lbl == "downAfterSwitch" -> { compose.runOnIdle { controller.setFocus() }; run(32.0); sendKey(KeyEvent.KEYCODE_DPAD_DOWN) }
                lbl.startsWith("down") -> sendKey(KeyEvent.KEYCODE_DPAD_DOWN)
                lbl == "up" || lbl == "upWrap" -> sendKey(KeyEvent.KEYCODE_DPAD_UP)
                lbl == "home" -> sendKey(KeyEvent.KEYCODE_MOVE_HOME)
                lbl == "end" -> sendKey(KeyEvent.KEYCODE_MOVE_END)
                lbl == "enter" -> sendKey(KeyEvent.KEYCODE_ENTER)
                lbl == "enterOnSoft" -> { sendKey(KeyEvent.KEYCODE_MOVE_HOME); run(32.0); sendKey(KeyEvent.KEYCODE_ENTER) }
                lbl == "setFocus" || lbl == "setFocusAgain" -> compose.runOnIdle { controller.setFocus() }
                lbl == "blur" -> { sinkOn = true; run(16.0); compose.runOnIdle { runCatching { sink.requestFocus() } }; run(16.0); sinkOn = false }
                lbl == "hideActive" -> edit("b2") { it.getJSONObject("properties").put("hidden", true) }
                lbl == "disableFirst" -> edit("b1") { it.getJSONObject("properties").put("disabled", true) }
                lbl == "append" -> edit("bar1") { it.getJSONArray("children").put(JSONObject("{\"id\":\"b5\",\"tag\":\"md-icon-button\",\"properties\":{\"icon\":\"add\",\"aria-label\":\"add\"},\"children\":[]}")) }
                lbl == "toGeneric" -> edit("bar1") { it.getJSONObject("properties").put("containerSemantics", "generic") }
                lbl == "toToolbar" -> edit("bar1") { it.getJSONObject("properties").put("containerSemantics", "toolbar") }
                lbl == "toVertical" -> edit("bar1") { it.getJSONObject("properties").put("variant", "floating").put("layout", "vertical") }
                lbl == "restore" -> { edit("b2") { it.getJSONObject("properties").put("hidden", false) }; edit("b1") { it.getJSONObject("properties").put("disabled", false) } }
                lbl == "hover" -> item(target)?.let { b -> compose.onRoot().performMouseInput { moveTo(px(b[0] + b[2] / 2, b[1] + b[3] / 2)) } }
                lbl == "press" -> compose.onRoot().performMouseInput { press() }
                lbl == "release" -> compose.onRoot().performMouseInput { release() }
                lbl == "leave" -> compose.onRoot().performMouseInput { moveTo(px(1190.0, 890.0)) }
                else -> check(false, "$name unknown phase $lbl")
            }
            run(maxOf(150.0, dur - 20))
            snapshot("$name $lbl", ph, dropped)
        }
        val web = r.getJSONArray("events").objects().filter { it.getString("target") !in dropped }.map { (if (it.getString("name") == "click") "mdClick" else it.getString("name")) + "@" + it.getString("target") }
        val got = events.filter { (it.first == "focusin" || it.first == "mdClick") && it.second !in setOf("before", "after", "bar1") }.map { it.first + "@" + it.second }
        check(got == web, "$name events $got vs $web")
        report.put(JSONObject().put("run", name).put("events", got.size))
    }
    private fun snapshot(name: String, ph: JSONObject, dropped: Set<String>) {
        val want = webID(ph.getString("active"))
        check(focusedID == want || (want == "after" && focusedID == "body"), "$name focus $focusedID vs $want")
        val bar = compose.runOnIdle { probe.bar }
        val role = if (ph.isNull("role")) "generic" else ph.getString("role")
        check(bar["role"] == role, "$name role ${bar["role"]} vs $role")
        if (role == "toolbar") check(bar["orientation"] == ph.optString("orientation"), "$name orientation ${bar["orientation"]} vs ${ph.optString("orientation")}")
        for (c in ph.getJSONArray("children").objects()) {
            val id = c.getString("id"); if (id in dropped || c.optBoolean("hidden")) continue
            val m = compose.runOnIdle { probe.items[id] } ?: run { check(false, "$name $id measured"); null } ?: continue
            if (m["member"] == true) check((m["tabStop"] == true) == (c.optString("tabindex") == "0"), "$name $id tab stop ${m["tabStop"]} vs ${c.optString("tabindex")}")
            if (!c.isNull("layer")) check((m["focusVisible"] == true) == (c.optString("ring") == "solid"), "$name $id focus ring ${m["focusVisible"]} vs ${c.optString("ring")}")
        }
    }
}
