package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
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
 * md-bottom-sheet paint and geometry against Chrome (bottom-sheet native-paint.html: 126 cases, DPR 1 viewport
 * captures): every part box, the fallback/authored close, the slotted body, role and accessible name, initial focus
 * and every flat pixel of the viewport (the page's UA buttons masked).
 */
/** The Web block `height: <h>px` with text in a flex column: preferred h, minimum the text line (min-height: auto). */
private fun Modifier.cssFlexBlock(preferred: Double, minContent: Double) = this.then(object : androidx.compose.ui.layout.LayoutModifier {
    override fun androidx.compose.ui.layout.MeasureScope.measure(measurable: androidx.compose.ui.layout.Measurable, constraints: androidx.compose.ui.unit.Constraints): androidx.compose.ui.layout.MeasureResult {
        val h = kotlin.math.max(minContent.dp.roundToPx(), preferred.dp.roundToPx().coerceIn(constraints.minHeight, constraints.maxHeight))
        val p = measurable.measure(constraints.copy(minHeight = h, maxHeight = h)); return layout(p.width, h) { p.place(0, 0) } }
    override fun androidx.compose.ui.layout.IntrinsicMeasureScope.minIntrinsicHeight(measurable: androidx.compose.ui.layout.IntrinsicMeasurable, width: Int) = minContent.dp.roundToPx()
    override fun androidx.compose.ui.layout.IntrinsicMeasureScope.maxIntrinsicHeight(measurable: androidx.compose.ui.layout.IntrinsicMeasurable, width: Int) = preferred.dp.roundToPx()
})

class NativeBottomSheetParityTest {
    @get:Rule val compose = createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"vp\":[800,600],\"open\":false}"))
    private var epoch by mutableIntStateOf(0)
    private val collector = AWCInspectionCollector()
    private var inspection: AWCModalInspection? = null
    private val boxes = mutableMapOf<String, Rect>()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, label: String) { checks++; if (!ok) failures += label }
    private fun appearance(h: JSONObject?): AWCBottomSheetAppearance {
        if (h == null) return AWCBottomSheetAppearance()
        fun s(k: String) = h.opt2(k) as? String
        fun px(k: String) = s(k)?.removeSuffix("px")?.toDouble()
        fun len(k: String) = px(k)?.let { AWCSkeletonLength(points = it) }
        return AWCBottomSheetAppearance(s("container-color"), s("container-shape")?.let { v -> AWCBottomSheetShape(v.split(" ").map { it.removeSuffix("px").toDouble() }) },
            s("content-color"), s("headline-color"), s("scrim-color"), s("drag-handle-color"), s("divider-color"), s("icon-color"),
            len("width"), len("min-width"), len("max-width"), len("height"), len("min-height"), len("max-height"), px("detached-margin"), px("content-padding-inline"))
    }
    @Composable private fun Parts(on: Boolean, content: @Composable () -> Unit) {
        if (!on) { content(); return }
        val list = listOf(AWCBottomSheetPart.Container to AWCModalPartAppearance(outlineColor = "#C2185B", outlineWidth = 2.0), AWCBottomSheetPart.DragHandle to AWCModalPartAppearance(background = "#FFF3E0"),
            AWCBottomSheetPart.DragHandleIndicator to AWCModalPartAppearance(background = "#C62828", opacity = 1.0), AWCBottomSheetPart.Header to AWCModalPartAppearance(background = "#F3E5F5"),
            AWCBottomSheetPart.Headline to AWCModalPartAppearance(letterSpacing = 1.0), AWCBottomSheetPart.Close to AWCModalPartAppearance(background = "#FFE0B2"),
            AWCBottomSheetPart.DividerTop to AWCModalPartAppearance(background = "#1565C0", height = 3.0), AWCBottomSheetPart.DividerBottom to AWCModalPartAppearance(background = "#2E7D32", height = 3.0),
            AWCBottomSheetPart.Content to AWCModalPartAppearance(background = "#E3F2FD"), AWCBottomSheetPart.Actions to AWCModalPartAppearance(background = "#E8F5E9"),
            AWCBottomSheetPart.Scrim to AWCModalPartAppearance(background = "#00280066"))
        @Composable fun nest(i: Int) { if (i == list.size) content() else AWCBottomSheetPartAppearanceScope(list[i].first, list[i].second) { nest(i + 1) } }
        nest(0)
    }
    @Composable private fun Measured(name: String, content: @Composable () -> Unit) =
        Box(Modifier.onGloballyPositioned { val p = it.positionInRoot(); boxes[name] = Rect(p.x, p.y, p.x + it.size.width, p.y + it.size.height) }) { content() }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        val c = case; val e = epoch
        val vp = c.getJSONArray("vp"); val w = vp.getInt(0); val h = vp.getInt(1)
        AWCTheme(c.optString("theme") == "dark") { AWCAccessibilityAppearanceScope(reducedMotion = true) { key(e) {
            Box(Modifier.requiredSize(w.dp, h.dp)) { AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp)) {
                Box(Modifier.fillMaxSize()) {
                    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) {
                        Box(Modifier.offset(16.dp, 64.dp).size(200.dp, 120.dp).background(MaterialTheme.colorScheme.primaryContainer))
                    }
                    val props = mutableMapOf<String, AWCValue>("headline" to "Account details")
                    c.optJSONObject("props")?.let { p -> p.keys().forEach { k -> props[k] = p.get(k) } }
                    props["open"] = c.opt2("open") != false
                    if (c.optBoolean("hidden")) props["hidden"] = true
                    val body = c.optDouble("bodyHeight", 120.0)
                    val slots = mutableMapOf<String, @Composable () -> Unit>("" to { Measured("body") { Box(Modifier.fillMaxWidth().cssFlexBlock(body, 20.0)) { Text("Sheet content") } } })
                    if (c.optBoolean("slots")) { slots["headline"] = { Text("Authored headline") }; slots["close"] = { AWCComponent("md-button", mapOf("variant" to "text", "label" to "Done")) } }
                    if (c.optBoolean("actions")) slots["actions"] = {
                        AWCComponent("md-button", mapOf("variant" to "text", "label" to "Later")); AWCComponent("md-button", mapOf("variant" to "filled", "label" to "Accept")) }
                    CompositionLocalProvider(LocalLayoutDirection provides if (c.optString("dir") == "rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                        AWCDensityScope((c.opt2("inheritedDensity") as? Number)?.toDouble() ?: 0.0) {
                            AWCBottomSheetAppearanceScope(appearance(c.optJSONObject("hooks"))) { Parts(c.optBoolean("parts")) {
                                AWCInspectionScope(collector) { AWCModalInspectionScope({ _, i -> inspection = i }) {
                                    AWCSlotsScope(AWCSlotRegistry(slots)) { AWCComponent("md-bottom-sheet", props) }
                                } }
                            } }
                        }
                    }
                }
            } }
        } } }
    } } }

    @Test fun bottomSheetMatchesChromePaintAndGeometry() {
        content()
        val oracle = ModalWeb.document("BottomSheetWebPaint.json")
        val only = androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("modalOnly")
        for (c in oracle.getJSONArray("cases").objects()) if (only == null || c.getString("name").contains(only)) run(c)
        ModalWeb.log("bottom-sheet-paint", JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(400))).put("report", report))
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
    private fun r(o: JSONObject) = Rect(o.getDouble("x").toFloat(), o.getDouble("y").toFloat(), (o.getDouble("x") + o.getDouble("width")).toFloat(), (o.getDouble("y") + o.getDouble("height")).toFloat())
    private fun near(a: Rect?, b: Rect, tol: Double) = a != null && abs(a.left - b.left) <= tol && abs(a.top - b.top) <= tol && abs(a.width - b.width) <= tol && abs(a.height - b.height) <= tol
    private fun d(a: Rect?) = a?.let { "(%.2f,%.2f,%.2f,%.2f)".format(it.left, it.top, it.width, it.height) } ?: "nil"
    private fun run(c: JSONObject) {
        val name = c.getString("name"); val local = name.startsWith("local-density-wins")
        boxes.clear(); inspection = null; collector.clear(); case = c; epoch++
        compose.waitForIdle(); compose.mainClock.advanceTimeBy(200); compose.waitForIdle()
        val nodes = collector.snapshot().nodes
        fun box(n: String) = nodes.firstOrNull { it.name == n }?.bounds?.let { Rect(it.x.toFloat(), it.y.toFloat(), (it.x + it.width).toFloat(), (it.y + it.height).toFloat()) }
        val snap = c.getJSONObject("snap")
        val open = c.opt2("open") != false && !c.optBoolean("hidden")
        if (!open) check(box("container") == null, "$name closed/hidden sheet renders no surface")
        else {
            val parts = snap.getJSONObject("parts")
            for (part in parts.keys()) {
                val web = r(parts.getJSONObject(part).getJSONObject("rect")); if (web.width <= 0 && web.height <= 0) continue
                val tol = if (part == "headline" && c.optBoolean("slots")) 2.5 else if (part == "headline" || (part == "close" && c.optBoolean("slots"))) 1.5 else .6
                check(near(box(part), web, tol), "$name $part ${d(box(part))} vs ${d(web)}")
            }
            for (child in snap.getJSONArray("children").objects()) if (child.optString("slot") == "") {
                // Chrome shrinks the slotted block (a flex item of the content column); so does native (gate-7 R4-01).
                val web = r(child.getJSONObject("rect")); val n = boxes["body"]
                check(near(n, web, .6), "$name body ${d(n)} vs ${d(web)}")
            }
            val v = inspection?.values ?: emptyMap()
            val sem = snap.getJSONObject("semantics")
            check(v["role"] == sem.optString("role"), "$name role ${v["role"]}")
            val webLabel = (sem.opt2("aria-label") as? String)?.takeIf { it.isNotEmpty() } ?: (sem.opt2("labelledbyText") as? String ?: "")
            if (!c.optBoolean("slots")) check(v["label"] == webLabel, "$name accessible name ${v["label"]} vs $webLabel")
            val leaf = snap.getJSONObject("focus").optJSONArray("path")?.let { it.optString(it.length() - 1) } ?: ""
            val expected = when { leaf.startsWith("md-icon-button") -> "close-button"; "[part=container]" in leaf -> "container"; else -> null }
            if (expected != null) check(v["focus"] == expected, "$name initial focus ${v["focus"]} vs $leaf")
        }
        val vp = c.getJSONArray("vp"); val w = vp.getInt(0); val h = vp.getInt(1)
        val image = compose.onRoot().captureToImage()
        val res = ModalWeb.compare(ModalWeb.webGrid("BottomSheetWebPaint/$name.png", w, h), ModalWeb.nativeGrid(image, w, h)) { x, y -> x in 12 until 112 && (y in 12 until 60 || y in 196 until 244) }
        check(ModalWeb.ok(res), "$name flat pixels $res")
        if (!ModalWeb.ok(res)) ModalWeb.png("sheet-$name", image)
        report.put(res.put("case", name))
    }
}
