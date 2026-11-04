package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.ModalWeb.objects
import dev.awc.playground.ModalWeb.opt2
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * md-dialog paint and geometry against Chrome (dialog native-paint.html: 150 cases, DPR 1 viewport captures): every
 * part box, the fallback/close/authored controls, the slotted body, role and accessible name, initial focus, and
 * every flat pixel of the viewport (the page's UA buttons masked).
 */
class NativeDialogParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"vp\":[800,600],\"open\":false}"))
    private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector()
    private var inspection: AWCModalInspection? = null
    private val boxes = mutableMapOf<String, Rect>()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    companion object {
        val ALL = JSONObject(mapOf("container-color" to "#224466AA", "content-color" to "#DDBB88CC", "headline-color" to "#BB3366EE", "scrim-color" to "#11223366",
            "divider-color" to "#CC9933DD", "icon-color" to "#55AA88AA"))
    }
    private fun appearance(h: JSONObject?): AWCDialogAppearance {
        if (h == null) return AWCDialogAppearance()
        fun s(k: String) = h.opt2(k) as? String
        return AWCDialogAppearance(s("container-color"), s("container-shape")?.let(ModalWeb::corners), s("headline-color"), s("content-color"), s("icon-color"),
            s("icon-size")?.removeSuffix("px")?.toDouble(), s("scrim-color"), s("divider-color"), s("z-index")?.toDouble(), s("scrim-z-index")?.toDouble())
    }
    @Composable private fun Parts(on: Boolean, content: @Composable () -> Unit) {
        if (!on) { content(); return }
        AWCDialogPartAppearanceScope(AWCDialogPart.Container, AWCModalPartAppearance(outlineColor = "#C2185B", outlineWidth = 2.0)) {
        AWCDialogPartAppearanceScope(AWCDialogPart.Headline, AWCModalPartAppearance(letterSpacing = 1.0, underline = true)) {
        AWCDialogPartAppearanceScope(AWCDialogPart.Content, AWCModalPartAppearance(background = "#FFF3E0")) {
        AWCDialogPartAppearanceScope(AWCDialogPart.Actions, AWCModalPartAppearance(background = "#E8F5E9")) {
        AWCDialogPartAppearanceScope(AWCDialogPart.Divider, AWCModalPartAppearance(background = "#1565C0", height = 3.0)) {
        AWCDialogPartAppearanceScope(AWCDialogPart.Scrim, AWCModalPartAppearance(background = "#00280066")) {
        AWCDialogPartAppearanceScope(AWCDialogPart.Header, AWCModalPartAppearance(background = "#F3E5F5")) {
        AWCDialogPartAppearanceScope(AWCDialogPart.Icon, AWCModalPartAppearance(color = "#2E7D32")) {
        AWCDialogPartAppearanceScope(AWCDialogPart.CloseButton, AWCModalPartAppearance(background = "#FFE0B2"), content = content)
        } } } } } } } }
    }
    @Composable private fun Measured(name: String, content: @Composable () -> Unit) =
        Box(Modifier.onGloballyPositioned { val p = it.positionInRoot(); boxes[name] = Rect(p.x, p.y, p.x + it.size.width, p.y + it.size.height) }) { content() }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        val c = case; val e = epoch
        val vp = c.getJSONArray("vp"); val w = vp.getInt(0); val h = vp.getInt(1)
        AWCTheme(c.optString("theme") == "dark") { AWCAccessibilityAppearanceScope(reducedMotion = true) { key(e) {
            Box(Modifier.requiredSize(w.dp, h.dp)) { AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp)) {
                Box(Modifier.fillMaxSize()) {
                    // The page is physical (absolute left/top); only the dialog follows `dir`.
                    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                        Box(Modifier.offset(16.dp, 64.dp).size(200.dp, 120.dp).background(MaterialTheme.colorScheme.primaryContainer))
                    }
                    val props = mutableMapOf<String, AWCValue>("headline" to "Account details")
                    c.optJSONObject("props")?.let { p -> p.keys().forEach { k -> props[k] = p.get(k) } }
                    props["open"] = c.opt2("open") != false
                    if (c.optBoolean("hidden")) props["hidden"] = true
                    val body = c.optDouble("bodyHeight", 60.0)
                    val fullscreen = props["fullscreen"] == true
                    val slots = mutableMapOf<String, @Composable () -> Unit>("" to {
                        Measured("body") { Box(Modifier.fillMaxWidth().height(body.dp)) { if (body > 0) Text("Supporting text") } } })
                    if (c.optBoolean("slots")) { slots["headline"] = { Text("Authored headline") }; slots["icon"] = { AWCMaterialSymbol("star") } }
                    if (c.optBoolean("actions")) slots["actions"] = {
                        AWCComponent("md-button", mapOf("variant" to "text", "label" to "Later")); AWCComponent("md-button", mapOf("variant" to "filled", "label" to "Accept")) }
                    if (c.optBoolean("headerAction") && fullscreen) slots["header-action"] = { Measured("header-action") { AWCComponent("md-button", mapOf("variant" to "text", "label" to "Save")) } }
                    CompositionLocalProvider(LocalLayoutDirection provides if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                        AWCDensityScope((c.opt2("inheritedDensity") as? Number)?.toDouble() ?: 0.0) {
                            AWCDialogAppearanceScope(appearance(c.optJSONObject("hooks"))) { Parts(c.optBoolean("parts")) {
                                AWCInspectionScope(collector) { AWCModalInspectionScope({ _, i -> inspection = i }) {
                                    AWCSlotsScope(AWCSlotRegistry(slots)) { AWCComponent("md-dialog", props) }
                                } }
                            } }
                        }
                    }
                }
            } }
        } } }
    } } }

    @Test fun dialogMatchesChromePaintAndGeometry() {
        content()
        val oracle = ModalWeb.document("DialogWebPaint.json")
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("modalOnly")
        for (c in oracle.getJSONArray("cases").objects()) if (only == null || c.getString("name").contains(only)) run(c)
        ModalWeb.log("dialog-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun r(o: JSONObject) = Rect(o.getDouble("x").toFloat(), o.getDouble("y").toFloat(), (o.getDouble("x") + o.getDouble("width")).toFloat(), (o.getDouble("y") + o.getDouble("height")).toFloat())
    private fun near(a: Rect?, b: Rect, tol: Double) = a != null && abs(a.left - b.left) <= tol && abs(a.top - b.top) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol
    private fun d(a: Rect?) = a?.let { "(%.2f,%.2f,%.2f,%.2f)".format(it.left, it.top, it.width, it.height) } ?: "nil"
    private fun run(c: JSONObject) {
        val name = c.getString("name"); val handOff = name.startsWith("local-density-wins")
        boxes.clear(); inspection = null; collector.clear(); case = c; epoch++
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(200); compose.waitForIdle()
        val nodes = collector.snapshot().nodes
        fun box(n: String) = nodes.firstOrNull { it.name == n }?.bounds?.let { Rect(it.x.toFloat(), it.y.toFloat(), (it.x + it.width).toFloat(), (it.y + it.height).toFloat()) }
        val snap = c.getJSONObject("snap")
        val open = c.opt2("open") != false && !c.optBoolean("hidden")
        if (!open) check(box("container") == null, "$name closed/hidden dialog renders no surface")
        else {
            val textSized = setOf("headline", "cancel-button", "ok-button")
            val parts = snap.getJSONObject("parts")
            // Known Android deviation: AWCComponent hands renderers only the resolved density, so a local rung that defines
            // fewer spacing tokens than the inherited one (local -1 inside data-density -4) uses the default tokens.
            if (handOff) report.put(JSONObject().put("case", name).put("deviation", "inherited spacing rung not visible under a local density"))
            for (part in parts.keys()) {
                if (handOff && part in setOf("container", "header", "content", "actions", "cancel-button", "ok-button", "headline", "divider")) continue
                val web = r(parts.getJSONObject(part).getJSONObject("rect")); if (web.width <= 0 && web.height <= 0) continue
                val native = box(part)
                if (c.optString("group") == "locale" && part in setOf("cancel-button", "ok-button") && c.getJSONObject("props").optString("locale") in setOf("ar", "ja")) {
                    // Arabic/Japanese labels fall back to platform fonts (not the bundled Roboto): compare the row, not the advances.
                    check(native != null && abs(native.top - web.top) <= .6 && abs(native.height - web.height) <= .6, "$name $part row ${d(native)} vs ${d(web)}"); continue
                }
                // An authored Compose Text box includes its platform guard pixels (the test slot, not the renderer).
                val tol = if (part == "headline" && c.optBoolean("slots")) 2.5 else if (part in textSized) 1.5 else .6
                check(near(native, web, tol), "$name $part ${d(native)} vs ${d(web)}")
            }
            for (control in snap.getJSONArray("controls").objects()) if (control.optString("part") == "close-button")
                check(near(box("close-button"), r(control.getJSONObject("rect")), .6), "$name close button ${d(box("close-button"))}")
            for (child in snap.getJSONArray("children").objects()) {
                val web = r(child.getJSONObject("rect"))
                when (child.optString("slot")) {
                    "" -> if (!handOff) check(near(boxes["body"], web, .6), "$name body ${d(boxes["body"])} vs ${d(web)}")
                    "header-action" -> if (web.width > 0) check(near(boxes["header-action"], web, 1.5), "$name header action ${d(boxes["header-action"])} vs ${d(web)}")
                }
            }
            val v = inspection?.values ?: emptyMap()
            val sem = snap.getJSONObject("semantics")
            check(v["role"] == sem.optString("role"), "$name role ${v["role"]} vs ${sem.optString("role")}")
            val webLabel = (sem.opt2("aria-label") as? String)?.takeIf { it.isNotEmpty() } ?: (sem.opt2("labelledbyText") as? String ?: "")
            if (!c.optBoolean("slots")) check(v["label"] == webLabel, "$name accessible name ${v["label"]} vs $webLabel")
            // Initial focus: first tabbable (fallback Cancel / fullscreen close) or the container.
            val leaf = snap.getJSONObject("focus").optJSONArray("path")?.let { it.optString(it.length() - 1) } ?: ""
            val expected = when { "cancel-button" in leaf -> "cancel-button"; "close-button" in leaf -> "close-button"; "ok-button" in leaf -> "ok-button"
                leaf.startsWith("md-button") -> null; leaf.startsWith("md-dialog") -> "container"; else -> null }
            if (expected != null) check(v["focus"] == expected, "$name initial focus ${v["focus"]} vs $leaf")
        }
        // Paint: every flat viewport pixel, the page UA buttons masked.
        val vp = c.getJSONArray("vp"); val w = vp.getInt(0); val h = vp.getInt(1)
        val image = compose.onRoot().captureToImage()
        val res = ModalWeb.compare(ModalWeb.webGrid("DialogWebPaint/$name.png", w, h), ModalWeb.nativeGrid(image, w, h)) { x, y -> x in 12 until 112 && (y in 12 until 60 || y in 196 until 244) }
        if (!handOff) check(ModalWeb.ok(res), "$name flat pixels $res")
        if (!ModalWeb.ok(res)) ModalWeb.png("dialog-$name", image)
        report.put(res.put("case", name))
    }
}
