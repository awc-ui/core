package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Constraints
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
import kotlin.math.max

/**
 * md-side-sheet paint and geometry against Chrome (side-sheet native-paint.html: 178 cases, DPR 1 viewport captures):
 * every part box, the standard host and the page column it leaves, the fallback back/close, the slotted body, role and
 * accessible name, initial focus and every flat pixel of the viewport (the page's UA buttons masked).
 */
class NativeSideSheetParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"vp\":[800,600],\"open\":false,\"props\":{\"variant\":\"modal\"}}"))
    private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector()
    private var inspection: AWCModalInspection? = null
    private val boxes = mutableMapOf<String, Rect>()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun appearance(h: JSONObject?): AWCSideSheetAppearance {
        if (h == null) return AWCSideSheetAppearance()
        fun s(k: String) = h.opt2(k) as? String
        fun len(k: String): AWCSkeletonLength? { val v = s(k) ?: return null
            if (v.startsWith("calc(")) { val n = v.removePrefix("calc(").removeSuffix(")").split(" ")
                return AWCSkeletonLength(points = n[2].removeSuffix("px").toDouble() * (if (n[1] == "-") -1 else 1), fraction = n[0].removeSuffix("%").toDouble() / 100) }
            return AWCSkeletonLength(points = v.removeSuffix("px").toDouble()) }
        return AWCSideSheetAppearance(s("container-color"), s("container-shape")?.let { v -> AWCSideSheetShape(v.split(" ").map { it.removeSuffix("px").toDouble() }) },
            s("headline-color"), s("content-color"), s("scrim-color"), s("divider-color"), s("icon-color"), len("width"), len("max-width"))
    }
    @Composable private fun Parts(on: Boolean, content: @Composable () -> Unit) {
        if (!on) { content(); return }
        val list = listOf(AWCSideSheetPart.Container to AWCModalPartAppearance(outlineColor = "#C2185B", outlineWidth = 2.0), AWCSideSheetPart.Header to AWCModalPartAppearance(background = "#F3E5F5"),
            AWCSideSheetPart.Headline to AWCModalPartAppearance(letterSpacing = 1.0), AWCSideSheetPart.Close to AWCModalPartAppearance(background = "#FFE0B2"),
            AWCSideSheetPart.DividerTop to AWCModalPartAppearance(background = "#1565C0", height = 3.0), AWCSideSheetPart.DividerBottom to AWCModalPartAppearance(background = "#2E7D32", height = 3.0),
            AWCSideSheetPart.Content to AWCModalPartAppearance(background = "#E3F2FD"), AWCSideSheetPart.Actions to AWCModalPartAppearance(background = "#E8F5E9"),
            AWCSideSheetPart.Scrim to AWCModalPartAppearance(background = "#00280066"))
        @Composable fun nest(i: Int) { if (i == list.size) content() else AWCSideSheetPartAppearanceScope(list[i].first, list[i].second) { nest(i + 1) } }
        nest(0)
    }
    @Composable private fun Measured(name: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) =
        Box(modifier.onGloballyPositioned { val p = it.positionInRoot(); boxes[name] = Rect(p.x, p.y, p.x + it.size.width, p.y + it.size.height) }) { content() }
    /** The oracle page: `#page { display: flex }` with `#main { flex: 1 1 auto; min-width: 0 }` and a standard sheet before/after it. */
    @Composable private fun Page(sheetRight: Boolean, main: @Composable () -> Unit, sheet: @Composable () -> Unit) =
        Layout(content = { main(); sheet() }, modifier = Modifier.fillMaxSize()) { ms, c ->
            val s = ms.getOrNull(1)?.measure(Constraints(0, c.maxWidth, c.maxHeight, c.maxHeight))
            val sw = s?.width ?: 0; val mw = max(0, c.maxWidth - sw)
            val m = ms[0].measure(Constraints.fixed(mw, c.maxHeight))
            layout(c.maxWidth, c.maxHeight) { m.place(if (sheetRight) 0 else sw, 0); s?.place(if (sheetRight) mw else 0, 0) }
        }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        val c = case; val e = epoch
        val vp = c.getJSONArray("vp"); val w = vp.getInt(0); val h = vp.getInt(1)
        AWCTheme(c.optString("theme") == "dark") { AWCAccessibilityAppearanceScope(reducedMotion = true) { key(e) {
            Box(Modifier.requiredSize(w.dp, h.dp)) { AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp)) {
                val props = mutableMapOf<String, AWCValue>("headline" to "Filters")
                c.optJSONObject("props")?.let { p -> p.keys().forEach { k -> props[k] = p.get(k) } }
                props["open"] = c.opt2("open") != false
                if (c.optBoolean("hidden")) props["hidden"] = true
                val rtl = c.optString("dir") == "rtl"
                val modal = props["variant"] == "modal"
                val body = c.optDouble("bodyHeight", 120.0)
                val slots = mutableMapOf<String, @Composable () -> Unit>("" to { Measured("body") { Box(Modifier.fillMaxWidth().height(body.dp)) { Text("Sheet content") } } })
                if (c.optBoolean("slots")) { slots["headline"] = { Text("Authored headline") }
                    slots["back"] = { AWCComponent("md-icon-button", mapOf("icon" to "menu", "aria-label" to "Menu")) }
                    slots["close"] = { AWCComponent("md-button", mapOf("variant" to "text", "label" to "Done")) } }
                if (c.optBoolean("actions")) slots["actions"] = {
                    AWCComponent("md-button", mapOf("variant" to "filled", "label" to "Save")); AWCComponent("md-button", mapOf("variant" to "outlined", "label" to "Cancel")) }
                val main = @Composable { Measured("main", Modifier.fillMaxSize()) {
                    Box(Modifier.absoluteOffset(16.dp, 64.dp).size(200.dp, 120.dp).background(MaterialTheme.colorScheme.primaryContainer)) } }
                val sheet = @Composable {
                    CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                        AWCDensityScope((c.opt2("inheritedDensity") as? Number)?.toDouble() ?: 0.0) {
                            AWCSideSheetAppearanceScope(appearance(c.optJSONObject("hooks"))) { Parts(c.optBoolean("parts")) {
                                AWCInspectionScope(collector) { AWCModalInspectionScope({ _, i -> inspection = i }) {
                                    AWCSlotsScope(AWCSlotRegistry(slots)) { AWCComponent("md-side-sheet", props) }
                                } }
                            } }
                        }
                    }
                }
                Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                    if (modal) { main(); sheet() } else Page((props["side"] != "start") != rtl, main, sheet)
                }
            } }
        } } }
    } } }

    @Test fun sideSheetMatchesChromePaintAndGeometry() {
        content()
        val oracle = ModalWeb.document("SideSheetWebPaint.json")
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("modalOnly")
        for (c in oracle.getJSONArray("cases").objects()) if (only == null || c.getString("name").contains(only)) run(c)
        ModalWeb.log("side-sheet-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun r(o: JSONObject) = Rect(o.getDouble("x").toFloat(), o.getDouble("y").toFloat(), (o.getDouble("x") + o.getDouble("width")).toFloat(), (o.getDouble("y") + o.getDouble("height")).toFloat())
    private fun near(a: Rect?, b: Rect, tol: Double) = a != null && abs(a.left - b.left) <= tol && abs(a.top - b.top) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol
    private fun d(a: Rect?) = a?.let { "(%.2f,%.2f,%.2f,%.2f)".format(it.left, it.top, it.width, it.height) } ?: "nil"
    private fun run(c: JSONObject) {
        val name = c.getString("name")
        boxes.clear(); inspection = null; collector.clear(); case = c; epoch++
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(200); compose.waitForIdle()
        val nodes = collector.snapshot().nodes
        fun box(n: String) = nodes.firstOrNull { it.name == n }?.bounds?.let { Rect(it.x.toFloat(), it.y.toFloat(), (it.x + it.width).toFloat(), (it.y + it.height).toFloat()) }
        val snap = c.getJSONObject("snap")
        val modal = c.getJSONObject("props").optString("variant") == "modal"
        val open = c.opt2("open") != false && !c.optBoolean("hidden")
        check(near(boxes["main"], r(snap.getJSONObject("page").getJSONObject("main")), .6), "$name page main ${d(boxes["main"])} vs ${d(r(snap.getJSONObject("page").getJSONObject("main")))}")
        if (!open) check(box("container") == null, "$name closed/hidden sheet renders no surface")
        else {
            val authored = c.optBoolean("slots")
            if (!modal) check(near(box("host"), r(snap.getJSONObject("host").getJSONObject("rect")), .6), "$name host ${d(box("host"))} vs ${d(r(snap.getJSONObject("host").getJSONObject("rect")))}")
            val parts = snap.getJSONObject("parts")
            for (part in parts.keys()) {
                val web = r(parts.getJSONObject(part).getJSONObject("rect")); if (web.width <= 0 && web.height <= 0) continue
                val tol = if ((part == "headline" || part == "close") && authored) 2.5 else .6
                check(near(box(part), web, tol), "$name $part ${d(box(part))} vs ${d(web)}")
            }
            if (!authored) snap.getJSONArray("controls").objects().firstOrNull { it.optString("label") == "Back" && it.getJSONObject("rect").getDouble("width") > 0 }?.let {
                check(near(box("back"), r(it.getJSONObject("rect")), .6), "$name back ${d(box("back"))} vs ${d(r(it.getJSONObject("rect")))}") }
            for (child in snap.getJSONArray("children").objects()) if (child.optString("slot") == "") {
                val web = r(child.getJSONObject("rect")); check(near(boxes["body"], web, .6), "$name body ${d(boxes["body"])} vs ${d(web)}")
            }
            val v = inspection?.values ?: emptyMap()
            val sem = snap.getJSONObject("semantics")
            check(v["role"] == sem.optString("role"), "$name role ${v["role"]} vs ${sem.optString("role")}")
            val webLabel = (sem.opt2("aria-label") as? String)?.takeIf { it.isNotEmpty() } ?: (sem.opt2("labelledbyText") as? String ?: "")
            if (!authored) check(v["label"] == webLabel, "$name accessible name ${v["label"]} vs $webLabel")
            val focus = snap.getJSONObject("focus"); val leaf = focus.optJSONArray("path")?.let { it.optString(it.length() - 1) } ?: ""; val text = focus.optString("text")
            val expected = when { leaf == "body" -> ""; "[slot=back]" in leaf -> "back-button"; "[slot=close]" in leaf -> "close-button"
                leaf.startsWith("md-icon-button") -> if (text == "Back") "back-button" else "close-button"; "[part=container]" in leaf -> "container"; else -> null }
            if (expected != null) check(v["focus"] == expected, "$name initial focus ${v["focus"]} vs $leaf $text")
        }
        val vp = c.getJSONArray("vp"); val w = vp.getInt(0); val h = vp.getInt(1)
        val mx = (boxes["main"]?.left ?: 0f).toInt()
        val image = compose.onRoot().captureToImage()
        val res = ModalWeb.compare(ModalWeb.webGrid("SideSheetWebPaint/$name.png", w, h), ModalWeb.nativeGrid(image, w, h)) { x, y -> x in (mx + 12) until (mx + 112) && (y in 12 until 60 || y in 196 until 244) }
        check(ModalWeb.ok(res), "$name flat pixels $res")
        if (!ModalWeb.ok(res)) ModalWeb.png("side-$name", image)
        report.put(res.put("case", name))
    }
}
