package dev.awc.playground

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performMouseInput
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.max

/**
 * md-table family paint against Mac Chrome (the fixture shared byte-identically with NativeTablePaintIntegration.swift):
 * resolved column tracks, every md-table-cell box and content box, and every flat pixel of the clip
 * (mean ≤ 1.0, > 6 ratio ≤ 0.5 %; DPR 1 vs density 2). Animated regions and nested components owned elsewhere are masked.
 */
class NativeTablePaintTest {
    /** Geometry renders at 2 px per dp (half-pixel resolution, like the macOS backing scale); pixels at 1 dp = 1 px (the
     *  oracle is DPR 1 and the whole page fits the emulator's portrait screen only at 1×). */
    private var S by mutableFloatStateOf(2f); private val K = 1
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()
    data class Node(val id: String, val tag: String, val props: Map<String, Any?>, val children: List<Node>, val slot: String?)
    private fun JSONObject.toMap(): Map<String, Any?> = keys().asSequence().associateWith { k -> opt(k).let { v -> when (v) { JSONObject.NULL -> null; is JSONObject -> v.toMap(); is JSONArray -> (0 until v.length()).map { v.get(it) }; else -> v } } }
    private fun parse(o: JSONObject): Node = Node(o.optString("id"), o.getString("tag"), o.optJSONObject("properties")?.toMap() ?: emptyMap(),
        (o.optJSONArray("children") ?: JSONArray()).let { a -> (0 until a.length()).map { parse(a.getJSONObject(it)) } }, if (o.has("slot") && !o.isNull("slot")) o.getString("slot") else null)
    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
    private val assets get() = InstrumentationRegistry.getInstrumentation().context.assets

    private var nodes by mutableStateOf<List<Node>>(emptyList())
    private var dark by mutableStateOf(false); private var rtl by mutableStateOf(false); private var forced by mutableStateOf(false)
    private var width by mutableStateOf(760.0); private var page by mutableStateOf(Color.White); private var epoch by mutableIntStateOf(0)
    private val inspection = AWCTableInspection(); private val scroller = AWCTableScrollController()
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray()
    private fun check(ok: Boolean, msg: () -> String) { checks++; if (!ok) failures += msg() }

    @Composable private fun Render(n: Node) {
        when (n.tag) {
            "#text" -> AWCSlotText(n.props["text"]?.toString() ?: "")
            "#symbol" -> AWCMaterialSymbol(n.props["name"]?.toString() ?: "", size = 24.dp)
            "br" -> {}
            "div", "p", "span", "strong", "em" -> {
                val pad = padding(n.props["style"]?.toString() ?: "")
                Column(Modifier.padding(start = pad[3].dp, top = pad[0].dp, end = pad[1].dp, bottom = pad[2].dp),
                    horizontalAlignment = if ((n.props["style"]?.toString() ?: "").contains("text-align:center")) androidx.compose.ui.Alignment.CenterHorizontally else androidx.compose.ui.Alignment.Start) {
                    n.children.forEach { Render(it) } }
            }
            else -> AWCComponent(n.tag, n.props + ("id" to n.id)) { slot -> n.children.filter { (it.slot ?: "") == slot }.forEach { Render(it) } }
        }
    }
    private fun padding(style: String): List<Double> {
        val v = Regex("padding:\\s*([^;]+)").find(style)?.groupValues?.get(1)?.trim()?.split(Regex("\\s+"))?.mapNotNull { it.removeSuffix("px").toDoubleOrNull() } ?: return listOf(0.0, 0.0, 0.0, 0.0)
        return when (v.size) { 1 -> List(4) { v[0] }; 2 -> listOf(v[0], v[1], v[0], v[1]); 3 -> listOf(v[0], v[1], v[2], v[1]); 4 -> v; else -> listOf(0.0, 0.0, 0.0, 0.0) }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(S, 1f)) {
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(page)) { key(epoch) {
            Box(Modifier.absoluteOffset(24.dp, 24.dp).wrapContentSize(androidx.compose.ui.AbsoluteAlignment.TopLeft, unbounded = true).width(width.dp)) {
                CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    AWCTableInspectionScope(inspection) { AWCTableForcedColorsScope(forced) { AWCTableReducedMotionScope(true) { AWCTableScrollControllerScope(scroller) {
                        Column { nodes.forEach { Render(it) } }
                    } } } }
                }
            }
        } } }
    } } }
    private fun web(path: String): Pair<IntArray, Pair<Int, Int>> {
        val b = assets.open(path).use { BitmapFactory.decodeStream(it) }
        val px = IntArray(b.width * b.height); b.getPixels(px, 0, b.width, 0, 0, b.width, b.height); return px to (b.width to b.height)
    }
    private fun ids(ns: List<Node>, tag: String): List<String> = ns.flatMap { (if (it.tag == tag) listOf(it.id) else emptyList()) + ids(it.children, tag) }
    private fun select(n: Node, rows: List<Int>): Node = if (n.tag == "md-table-body") n.copy(children = n.children.mapIndexed { i, r -> if (r.tag == "md-table-row" && i in rows) r.copy(props = r.props + ("selected" to true)) else r })
        else n.copy(children = n.children.map { select(it, rows) })
    private fun rect(a: JSONArray?): List<Double>? = a?.takeIf { it.length() == 4 && (0 until 4).none { k -> it.isNull(k) } }?.let { (0 until 4).map { k -> it.getDouble(k) } }
    private fun masks(c: JSONObject): List<List<Double>> {
        val out = mutableListOf<List<Double>>()
        val els = c.getJSONObject("web").getJSONArray("elements").objects()
        val sub = c.getString("subset"); val name = c.getString("name")
        for (e in els) {
            val tag = e.getString("tag"); val r = rect(e.optJSONArray("rect"))
            if (r != null && r[2] > 0 && (tag == "md-progress-indicator" || tag == "md-select" || (sub == "forced-colors" && tag in setOf("md-checkbox", "md-icon-button", "md-table-expand-toggle")))) out += listOf(r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2)
            val parts = e.optJSONObject("parts") ?: JSONObject()
            val partNames = mutableListOf("rpp-select", "progress"); if (sub == "forced-colors") partNames += listOf("first-button", "prev-button", "next-button", "last-button")
            for (k in partNames) rect(parts.optJSONArray(k))?.takeIf { it[2] > 0 }?.let { out += listOf(it[0] - 1, it[1] - 1, it[2] + 2, it[3] + 2) }
        }
        val table = els.firstOrNull { it.getString("tag") == "md-table" }?.let { rect(it.optJSONArray("rect")) }
        if (name.contains("skeleton") && table != null) out += listOf(table[0], table[1] + 57, table[2], table[3] - 57)
        if (name.contains("gutter") && table != null) out += listOf(if (c.getString("dir") == "rtl") table[0] else table[0] + table[2] - 10, table[1] + 57, 10.0, table[3] - 57)
        return out
    }

    private var notIdle = 0
    private fun hasLoadingOverlay(ns: List<Node>): Boolean = ns.any { (it.tag == "md-table" && it.props["loading"] == true && it.props["loadingMode"] != "skeleton") || hasLoadingOverlay(it.children) }
    /** The compose root's pixels from a device screenshot (no idle synchronisation). */
    private fun screenImage(): android.graphics.Bitmap {
        val root = compose.activity.findViewById<android.view.View>(android.R.id.content)
        val loc = IntArray(2); compose.runOnUiThread { root.getLocationOnScreen(loc) }
        val shot = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot().copy(android.graphics.Bitmap.Config.ARGB_8888, false)
        return android.graphics.Bitmap.createBitmap(shot, loc[0], loc[1], minOf(root.width, shot.width - loc[0]), minOf(root.height, shot.height - loc[1]))
    }
    /** Waits for idle; when compose never idles, records which snapshot states keep changing (and who writes them) and resets. */
    private fun settle(name: String, frames: Int): Boolean {
        try { compose.waitForIdle(); repeat(frames) { compose.mainClock.advanceTimeBy(64); compose.waitForIdle() }; return true }
        catch (e: Throwable) {
            if (!e.javaClass.name.contains("NotIdle") && !e.javaClass.name.contains("IdlingResourceTimeout")) throw e
            notIdle++
            val applied = java.util.concurrent.ConcurrentHashMap<String, Int>(); val writers = java.util.concurrent.ConcurrentHashMap<String, String>()
            fun describe(o: Any) = o.toString().replace(Regex("@[0-9a-f]{5,}"), "").take(160)
            val h1 = androidx.compose.runtime.snapshots.Snapshot.registerApplyObserver { changed, _ -> changed.forEach { applied.merge(describe(it), 1, Int::plus) } }
            val h2 = androidx.compose.runtime.snapshots.Snapshot.registerGlobalWriteObserver { o -> val k = describe(o)
                if (writers.size < 16 && !writers.containsKey(k)) writers[k] = Throwable().stackTrace.filter { it.className.startsWith("dev.awc") || it.className.startsWith("androidx.compose.ui.layout") }.take(10)
                    .joinToString(" < ") { "${it.className.substringAfterLast('.')}.${it.methodName}:${it.lineNumber}" } }
            AWCTableTrace.hits.clear(); AWCTableTrace.on = true
            repeat(8) { try { compose.mainClock.advanceTimeByFrame() } catch (_: Throwable) {}; Thread.sleep(40) }
            AWCTableTrace.on = false; h1.dispose(); h2.dispose()
            val msg = "$name: NOT IDLE; trace=${AWCTableTrace.hits.entries.sortedByDescending { it.value }}; applied=${applied.entries.sortedByDescending { it.value }.take(14)}; globalWriters=$writers"
            check(false) { msg }; android.util.Log.w("AWCTable", msg)
            report.put(JSONObject().put("name", name).put("notIdle", msg))
            nodes = emptyList(); epoch++
            try { compose.waitForIdle() } catch (_: Throwable) {}
            return false
        }
    }

    @Test fun tableMatchesChromePaintAndGeometry() {
        AWCTableTrace.diagnostics = true
        content()
        val fixture = JSONObject(assets.open("table/table-web-paint.json").bufferedReader().use { it.readText() })
        val only = InstrumentationRegistry.getArguments().getString("tableOnly")
        var passed = 0
        for (c in fixture.getJSONArray("cases").objects()) {
            val name = c.getString("name"); if (only != null && !name.contains(only)) continue
            val prep = c.getJSONObject("prepare")
            if (prep.has("tabs")) { report.put(JSONObject().put("name", name).put("skipped", "keyboard focus — NativeTableStatesTest")); continue }
            val before = failures.size
            val (webPx, size) = web("table/" + c.getString("shot")); val (ww, wh) = size
            dark = c.getString("theme") == "dark"; rtl = c.getString("dir") == "rtl"; forced = c.getString("subset") == "forced-colors"
            page = Color(webPx[0]); width = c.getDouble("width")
            var ns = c.getJSONArray("nodes").objects().map(::parse)
            prep.optJSONArray("select")?.let { a -> val rows = (0 until a.length()).map { a.getInt(it) }; ns = ns.map { select(it, rows) } }
            // The loading overlay's indeterminate md-progress-indicator steps every frame (its own motion loop), so compose
            // never idles: drive frames by hand and capture the screen instead of the idle-synchronised captureToImage().
            val animated = hasLoadingOverlay(ns)
            /** Renders the case at the current scale and applies the page's preparation (scroll, hover). */
            fun prepareCase(): Boolean {
                nodes = ns; epoch++
                if (animated) { repeat(30) { compose.mainClock.advanceTimeByFrame() }; Thread.sleep(300); repeat(4) { compose.mainClock.advanceTimeByFrame() }; Thread.sleep(150) }
                else {
                    // Idle first (a previous loading case's indicator is gone), then park the pointer off the fixture.
                    if (!settle(name, 1)) return false
                    compose.onRoot().performMouseInput { moveTo(Offset(1190f * S, 890f * S)) }
                    if (!settle(name, 3)) return false
                }
                val sc = prep.optJSONArray("scroll")?.optJSONObject(0)
                if (sc != null) { compose.runOnUiThread { scroller.snap(abs(sc.getDouble("left")).takeIf { it > 0 }, sc.getDouble("top").takeIf { it > 0 }) }
                    if (!settle("$name scroll", 2)) return false }
                prep.optJSONObject("hover")?.let { h ->
                    val els = c.getJSONObject("web").getJSONArray("elements").objects()
                    val target = if (h.has("sortLabel")) { val labels = els.filter { it.getString("tag") == "md-table-sort-label" }; val i = listOf("name", "cal", "fat", "carbs", "protein").indexOf(h.getString("sortLabel")); labels.getOrNull(i)?.let { rect(it.optJSONArray("rect")) } }
                        else { val rows = els.filter { it.getString("tag") == "md-table-row" }; val cells = els.filter { it.getString("tag") == "md-table-cell" }
                            val per = cells.size / max(1, rows.size); cells.getOrNull((h.getInt("row") + 1) * per + h.optInt("cell", 0))?.let { rect(it.optJSONArray("rect")) } }
                    target?.let { t -> compose.onRoot().performMouseInput { moveTo(Offset(((t[0] + t[2] / 2) * S).toFloat(), ((t[1] + t[3] / 2) * S).toFloat())) }
                        settle("$name hover", 6) }
                }
                return true
            }
            S = 2f
            if (!prepareCase()) { if (notIdle >= 4) break; continue }
            val web = c.getJSONObject("web")
            // Columns.
            val grid = web.getJSONArray("grid").let { a -> (0 until a.length()).map { a.getDouble(it) } }
            val cols = inspection.columns.toList()
            if (grid.isNotEmpty()) check(cols.size == grid.size && cols.zip(grid).all { abs(it.first - it.second) <= 0.5 }) { "$name: columns $cols vs $grid" }
            // Cells and content boxes.
            if (!name.contains("skeleton")) {
                val webCells = web.getJSONArray("elements").objects().filter { it.getString("tag") == "md-table-cell" }
                ids(ns, "md-table-cell").forEachIndexed { i, id ->
                    val w = webCells.getOrNull(i) ?: return@forEachIndexed; val r = rect(w.optJSONArray("rect")) ?: return@forEachIndexed
                    if (r[2] <= 0) return@forEachIndexed
                    val b = inspection.cells[id] ?: run { check(false) { "$name: cell $i $id not inspected" }; return@forEachIndexed }
                    check(abs(b.x - r[0]) <= 0.6 && abs(b.width - r[2]) <= 0.6 && abs(b.y - r[1]) <= 0.6 && abs(b.height - r[3]) <= 0.6) { "$name: cell $i $id box (${b.x},${b.y},${b.width},${b.height}) vs $r" }
                    rect(w.optJSONObject("parts")?.optJSONArray("content"))?.takeIf { it[2] > 0 }?.let { k -> inspection.contents[id]?.let { n ->
                        check(abs(n.x - k[0]) <= 0.75 && abs(n.width - k[2]) <= 0.75 && abs((n.y + n.height / 2) - (k[1] + k[3] / 2)) <= 0.75) { "$name: cell $i content (${n.x},${n.y},${n.width},${n.height}) vs $k" } } }
                }
            }
            // Pixels (1 dp = 1 px).
            S = 1f
            if (!prepareCase()) { if (notIdle >= 4) break; continue }
            val clip = c.getJSONObject("clip"); val cx = clip.getDouble("x"); val cy = clip.getDouble("y")
            val image = if (animated) screenImage() else compose.onRoot().captureToImage().asAndroidBitmap()
            val m = masks(c)
            var sum = 0.0; var over = 0; var n = 0; var uncovered = 0
            fun flatWeb(x: Int, y: Int): Boolean { for (ch in 0..2) { var lo = 255; var hi = 0
                for (dy in -1..1) for (dx in -1..1) { val v = (webPx[(y + dy) * ww + x + dx] shr (16 - ch * 8)) and 0xFF; lo = minOf(lo, v); hi = maxOf(hi, v) }; if (hi - lo > 6) return false }; return true }
            fun nat(x: Int, y: Int, ch: Int): Int { val px = ((cx + x) * S).toInt(); val py = ((cy + y) * S).toInt(); var s = 0
                for (dy in 0 until K) for (dx in 0 until K) s += (image.getPixel(px + dx, py + dy) shr (16 - ch * 8)) and 0xFF; return s / (K * K) }
            fun flatNat(x: Int, y: Int): Boolean { for (ch in 0..2) { var lo = 255; var hi = 0
                for (dy in -1..1) for (dx in -1..1) { val v = nat(x + dx, y + dy, ch); lo = minOf(lo, v); hi = maxOf(hi, v) }; if (hi - lo > 6) return false }; return true }
            for (y in 1 until wh - 1) for (x in 1 until ww - 1) {
                val px = cx + x + 0.5; val py = cy + y + 0.5
                if (m.any { px >= it[0] && px <= it[0] + it[2] && py >= it[1] && py <= it[1] + it[3] }) continue
                if (((cx + x + 1) * S).toInt() >= image.width || ((cy + y + 1) * S).toInt() >= image.height) { uncovered++; continue }
                if (!flatWeb(x, y) || !flatNat(x, y)) continue
                val wp = webPx[y * ww + x]
                val d = (0..2).maxOf { ch -> abs(((wp shr (16 - ch * 8)) and 0xFF) - nat(x, y, ch)) }
                sum += d; n++; if (d > 6) over++
            }
            val mean = if (n == 0) 0.0 else sum / n; val ratio = if (n == 0) 0.0 else over.toDouble() / n
            check(uncovered == 0) { "$name: $uncovered clip pixels outside the captured root (${image.width}x${image.height})" }
            check(mean <= 1.0 && ratio <= 0.005) { "$name: flat-pixel mean ${"%.3f".format(mean)} >6 ${"%.3f".format(ratio * 100)}% ($n px)" }
            if (failures.size != before) runCatching {
                val shots = java.io.File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir("accordion"), "table-shots").apply { mkdirs() }
                val crop = android.graphics.Bitmap.createBitmap(image, (cx * S).toInt().coerceAtLeast(0), (cy * S).toInt().coerceAtLeast(0),
                    minOf((ww * S).toInt(), image.width - (cx * S).toInt()), minOf((wh * S).toInt(), image.height - (cy * S).toInt()))
                java.io.FileOutputStream(java.io.File(shots, "$name.png")).use { crop.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
            }
            if (failures.size == before) passed++
            report.put(JSONObject().put("name", name).put("ok", failures.size == before).put("mean", mean).put("over", ratio).put("compared", n).put("columns", JSONArray(cols)))
        }
        val dir = InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir("accordion")!!
        java.io.File(dir, "table-paint.json").writeText(JSONObject().put("checks", checks).put("failures", failures.size).put("passed", passed).put("failureList", JSONArray(failures.take(3000))).put("report", report).toString(1))
        assertTrue("NativeTablePaintTest: ${checks - failures.size}/$checks checks, $passed cases fully passing\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
}
