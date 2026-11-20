package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/** d3 (r3-14): md-list-item ::part() declarations on every visual part against Chrome 153 (list-parts-web.json from
 * d3-lab/web2/list-parts.mjs: host/part geometry and 2x pixel probes). A part the native renderer does not inspect is located from
 * its nearest inspected ancestor part with Chrome's offset inside it. */
class NativeListPartsTest {
    @get:Rule val compose = createComposeRule()
    private val oracle by lazy { JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("list-parts-web.json").bufferedReader().readText()) }
    private fun JSONArray?.objects() = if (this == null) emptyList() else (0 until length()).map { getJSONObject(it) }
    private fun text(o: JSONObject): String = if (o.getString("tag") == "#text") o.getJSONObject("properties").optString("text")
        else o.optJSONArray("children").objects().joinToString("") { text(it) }
    private fun props(n: JSONObject): Map<String, Any?> {
        val o = n.getJSONObject("properties")
        return o.keys().asSequence().filter { it != "style" }.associateWith { k -> o.get(k).let { if (it is Int) it.toDouble() else it } }
    }
    @Composable private fun Build(n: JSONObject) {
        val tag = n.getString("tag")
        if (tag == "#text") { Text(text(n)); return }
        val kids = n.optJSONArray("children").objects()
        // The node id is the component's `id` (md-list-item inspection names its parts after it).
        AWCComponent(tag, props(n) + ("id" to n.optString("id")), onEvent = { _, _ -> }, content = { slot -> kids.filter { it.getJSONObject("properties").optString("slot") == slot }.forEach { Build(it) } })
    }
    private fun contains(n: JSONObject, id: String): Boolean = n.optString("id") == id || n.optJSONArray("children").objects().any { contains(it, id) }
    @Composable private fun Parts(c: JSONObject, content: @Composable () -> Unit) {
        // Typed part declarations equivalent to the case's ::part() rules (md-list-item parts).
        val list = c.optJSONObject("native")?.let { o -> o.keys().asSequence().map { it to o.getJSONObject(it) }.toList() } ?: emptyList()
        list.fold(content) { inner, (name, v) ->
            val part = AWCListItemPart.fromSource(name) ?: return@fold inner
            val a = AWCAccordionPartAppearance(color = v.optString("color").ifEmpty { null }, backgroundColor = v.optString("backgroundColor").ifEmpty { null },
                cornerShape = if (v.has("cornerShape")) AWCCornerShape.uniform(v.getDouble("cornerShape")) else null,
                opacity = if (v.has("opacity")) v.getDouble("opacity") else null)
            val next: @Composable () -> Unit = { AWCListItemPartAppearanceScope(part, a) { inner() } }
            next
        }()
    }
    private val collectors = mutableMapOf<String, AWCInspectionCollector>()
    private var run by mutableStateOf<JSONObject?>(null)
    private var density = 1f

    @Test fun listItemPartsMatchChrome() {
        compose.setContent {
            density = androidx.compose.ui.platform.LocalDensity.current.density
            val c = run
            if (c != null) key(c) {
                AWCTheme(darkTheme = false) {
                    AWCAccessibilityAppearanceScope(reducedMotion = true) {
                        Box(Modifier.requiredSize(400.dp, 600.dp).background(MaterialTheme.colorScheme.surface)) {
                            Parts(c) { Column(Modifier.padding(start = 24.dp, top = 24.dp).width(320.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                c.getJSONArray("nodes").objects().forEach { n ->
                                    Box(Modifier.fillMaxWidth()) { AWCInspectionScope(collectors.getOrPut(n.getString("id")) { AWCInspectionCollector() }) { Build(n) } }
                                }
                            } }
                        }
                    }
                }
            }
        }
        val failures = mutableListOf<String>(); var checks = 0
        fun check(ok: Boolean, msg: String) { checks++; if (!ok) failures += msg }
        val cases = oracle.getJSONArray("cases").objects().associateBy { it.getString("name") }
        for (r in oracle.getJSONArray("results").objects()) {
            val name = r.getString("name"); val c = cases.getValue(name); val label = name
            collectors.clear(); compose.runOnIdle { run = c }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(900); compose.waitForIdle()
            val roots = c.getJSONArray("nodes").objects()
            fun measured(id: String, part: String?): AWCInspectionBounds? {
                val root = roots.first { contains(it, id) }; val nodes = collectors[root.getString("id")]?.snapshot()?.nodes ?: return null
                val prefix = if (id == root.getString("id")) "component" else "component.$id"
                return (if (part == null) nodes.firstOrNull { it.id == prefix }
                    else nodes.firstOrNull { it.id == "$prefix.$part" } ?: nodes.firstOrNull { it.id.startsWith(prefix) && (it.name == part || it.id.endsWith(".$part")) })?.bounds
            }
            val geometry = r.getJSONObject("geometry")
            // A part the renderer does not inspect: Chrome's offset inside its smallest enclosing part that is inspected natively.
            fun rect(id: String, part: String?): AWCInspectionBounds? {
                measured(id, part)?.let { return it }
                val webParts = geometry.optJSONObject(id)?.optJSONObject("parts") ?: return null
                val t = webParts.optJSONArray(part ?: return null) ?: return null
                fun box(a: JSONArray) = listOf(a.getDouble(0), a.getDouble(1), a.getDouble(2), a.getDouble(3))
                val tb = box(t)
                val anc = webParts.keys().asSequence().filter { it != part }.mapNotNull { k -> val b = box(webParts.getJSONArray(k))
                    if (b[0] - .5 <= tb[0] && b[1] - .5 <= tb[1] && b[0] + b[2] + .5 >= tb[0] + tb[2] && b[1] + b[3] + .5 >= tb[1] + tb[3]) measured(id, k)?.let { b to it } else null }
                    .minByOrNull { it.first[2] * it.first[3] } ?: return null
                return AWCInspectionBounds(anc.second.x + tb[0] - anc.first[0], anc.second.y + tb[1] - anc.first[1], tb[2], tb[3])
            }
            val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
            fun rgb(x: Int, y: Int): List<Int> { val p = bitmap.getPixel(x.coerceIn(0, bitmap.width - 1), y.coerceIn(0, bitmap.height - 1))
                return listOf((p shr 16) and 255, (p shr 8) and 255, p and 255) }
            for (id in geometry.keys()) {
                val g = geometry.getJSONObject(id)
                if (!g.isNull("host")) { val web = g.getJSONArray("host"); measured(id, null)?.let { n ->
                    check(abs(n.width - web.getDouble(2)) <= 1 && abs(n.height - web.getDouble(3)) <= 1, "$label $id host size ${n.width}×${n.height} vs Chrome ${web.getDouble(2)}×${web.getDouble(3)}") } }
                g.optJSONObject("parts")?.let { ps -> for (part in ps.keys()) { val web = ps.getJSONArray(part); measured(id, part)?.let { n ->
                    check(abs(n.width - web.getDouble(2)) <= 1 && abs(n.height - web.getDouble(3)) <= 1, "$label $id $part size ${n.width}×${n.height} vs Chrome ${web.getDouble(2)}×${web.getDouble(3)}") } } }
            }
            for (p in r.getJSONArray("probes").objects()) {
                val tag = p.getString("label"); val id = p.getString("node"); val part = if (p.isNull("part")) null else p.getString("part")
                val webArr = p.optJSONArray("rgb") ?: continue; val web = (0 until 3).map { webArr.getInt(it) }
                val base = rect(id, part); if (base == null) {
                    val ids = roots.flatMap { r0 -> collectors[r0.getString("id")]?.snapshot()?.nodes?.map { it.id } ?: emptyList() }.take(12)
                    check(false, "$label $tag: not measured natively ($ids)"); continue }
                if (p.getString("kind") == "point") {
                    val at = p.getJSONArray("at"); val ax = at.getDouble(0); val ay = at.getDouble(1)
                    val x = if (ax < 0) base.x + base.width + ax else base.x + ax; val y = if (ay < 0) base.y + base.height + ay else base.y + ay
                    val got = rgb((x * density).toInt(), (y * density).toInt())
                    val d = got.zip(web).maxOf { abs(it.first - it.second) }
                    check(d <= 12, "$label $tag: native $got vs Chrome $web (Δ$d)")
                } else {
                    val rr = p.optJSONArray("rect")
                    val x0 = base.x + (rr?.getDouble(0) ?: 0.0); val y0 = base.y + (rr?.getDouble(1) ?: 0.0)
                    val w = rr?.getDouble(2) ?: base.width; val h = rr?.getDouble(3) ?: base.height
                    val pts = mutableListOf<List<Int>>()
                    for (y in kotlin.math.ceil(y0 * density).toInt() until maxOf(kotlin.math.ceil(y0 * density).toInt() + 1, ((y0 + h) * density).toInt()))
                        for (x in kotlin.math.ceil(x0 * density).toInt() until maxOf(kotlin.math.ceil(x0 * density).toInt() + 1, ((x0 + w) * density).toInt())) pts += rgb(x, y)
                    val med = (0 until 3).map { k -> pts.map { it[k] }.sorted()[pts.size / 2] }
                    val best = pts.maxByOrNull { q -> q.zip(med).sumOf { abs(it.first - it.second) } } ?: med
                    val d = best.zip(web).maxOf { abs(it.first - it.second) }
                    check(d <= 48, "$label $tag: native ink $best vs Chrome $web (Δ$d)")
                }
            }
        }
        android.util.Log.i("AWCListParts", "NativeListPartsTest ${checks - failures.size}/$checks checks passed")
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
}
