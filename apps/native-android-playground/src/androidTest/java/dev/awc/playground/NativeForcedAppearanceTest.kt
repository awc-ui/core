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

/** d3 (r3-01, r3-02, r3-07): md-divider, md-avatar, md-card, md-dialog and md-accordion(+item) in light and dark themes, with
 * and without `forced-colors: active`, against Chrome 153 (forced-appearance-web.json: host/part geometry and 2x pixel probes). */
class NativeForcedAppearanceTest {
    @get:Rule val compose = createComposeRule()
    private val oracle by lazy { JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("forced-appearance-web.json").bufferedReader().readText()) }
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
        AWCComponent(tag, props(n), onEvent = { _, _ -> }, content = { slot -> kids.filter { it.getJSONObject("properties").optString("slot") == slot }.forEach { Build(it) } })
    }
    @Composable private fun Hooked(n: JSONObject, content: @Composable () -> Unit) {
        val style = n.getJSONObject("properties").optString("style")
        if (n.getString("tag") == "md-divider" && style.isNotEmpty()) AWCDividerAppearanceScope(AWCDividerAppearance(color = style.substringAfter(":").trim())) { content() }
        else content()
    }
    private fun contains(n: JSONObject, id: String): Boolean = n.optString("id") == id || n.optJSONArray("children").objects().any { contains(it, id) }
    @Composable private fun Parts(c: JSONObject, content: @Composable () -> Unit) {
        // Typed part declarations equivalent to the case's ::part() rules (md-accordion-item parts).
        val list = c.optJSONObject("nativeParts")?.let { np -> np.keys().asSequence().flatMap { tag -> np.getJSONObject(tag).let { o -> o.keys().asSequence().map { it to o.getJSONObject(it) } } }.toList() } ?: emptyList()
        list.fold(content) { inner, (name, v) ->
            val part = AWCAccordionItemPart.fromSource(name) ?: return@fold inner
            val a = AWCAccordionPartAppearance(backgroundColor = v.optString("backgroundColor").ifEmpty { null },
                cornerShape = if (v.has("cornerRadius")) AWCCornerShape.uniform(v.getDouble("cornerRadius")) else null,
                width = if (v.has("width")) v.getDouble("width") else null, height = if (v.has("height")) v.getDouble("height") else null,
                opacity = if (v.has("opacity")) v.getDouble("opacity") else null)
            val next: @Composable () -> Unit = { AWCAccordionItemPartAppearanceScope(part, a) { inner() } }
            next
        }()
    }
    private val collectors = mutableMapOf<String, AWCInspectionCollector>()
    private var run by mutableStateOf<Triple<JSONObject, Boolean, Boolean>?>(null)
    private var density = 1f

    @Test fun forcedAndDarkAppearanceMatchesChrome() {
        compose.setContent {
            density = androidx.compose.ui.platform.LocalDensity.current.density
            val r = run
            if (r != null) key(r) {
                val (c, dark, forced) = r
                AWCTheme(darkTheme = dark) {
                    AWCAccessibilityAppearanceScope(reducedMotion = true, forcedColors = forced) {
                        Box(Modifier.requiredSize(400.dp, 600.dp)) {
                            AWCModalScope(Modifier.fillMaxSize(), insets = WindowInsets(0.dp)) {
                                Box(Modifier.fillMaxSize().background(if (forced) Color.Black else MaterialTheme.colorScheme.surface)) {
                                    Parts(c) { Column(Modifier.padding(start = 24.dp, top = 24.dp).width(320.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        c.getJSONArray("nodes").objects().forEach { n ->
                                            val tag = n.getString("tag")
                                            val stretch = tag in setOf("md-card", "md-divider") || (tag == "md-accordion" && !n.getJSONObject("properties").optBoolean("floating"))
                                            Box(if (stretch) Modifier.fillMaxWidth() else Modifier) {
                                                AWCInspectionScope(collectors.getOrPut(n.getString("id")) { AWCInspectionCollector() }) { Hooked(n) { Build(n) } }
                                            }
                                        }
                                    } }
                                }
                            }
                        }
                    }
                }
            }
        }
        val failures = mutableListOf<String>(); var checks = 0
        fun check(ok: Boolean, msg: String) { checks++; if (!ok) failures += msg }
        val cases = oracle.getJSONArray("cases").objects().associateBy { it.getString("name") }
        for (r in oracle.getJSONArray("results").objects()) {
            val name = r.getString("name"); val dark = r.getString("theme") == "dark"; val forced = r.getBoolean("forced"); val c = cases.getValue(name)
            val label = "$name ${if (dark) "dark" else "light"}${if (forced) " forced" else ""}"
            collectors.clear(); compose.runOnIdle { run = Triple(c, dark, forced) }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(900); compose.waitForIdle()
            val roots = c.getJSONArray("nodes").objects()
            fun rect(id: String, part: String?): AWCInspectionBounds? {
                val root = roots.first { contains(it, id) }; val nodes = collectors[root.getString("id")]?.snapshot()?.nodes ?: return null
                val prefix = when {
                    id == root.getString("id") -> "component"
                    root.getString("tag") == "md-accordion" -> "component.item-" + root.getJSONArray("children").objects().indexOfFirst { it.getString("id") == id }
                    else -> "component.$id"
                }
                return (if (part == null) nodes.firstOrNull { it.id == prefix }
                    else nodes.firstOrNull { it.id == "$prefix.$part" } ?: nodes.firstOrNull { it.id.startsWith(prefix) && (it.name == part || it.id.endsWith(".$part")) })?.bounds
            }
            val bitmap = compose.onRoot().captureToImage().asAndroidBitmap()
            fun rgb(x: Int, y: Int): List<Int> { val p = bitmap.getPixel(x.coerceIn(0, bitmap.width - 1), y.coerceIn(0, bitmap.height - 1))
                return listOf((p shr 16) and 255, (p shr 8) and 255, p and 255) }
            val geometry = r.getJSONObject("geometry")
            for (id in geometry.keys()) {
                val g = geometry.getJSONObject(id)
                // A floating md-accordion leaves a 0×0 box in the flow on Compose; its panel is the "floating-panel" node.
                if (!g.isNull("host")) { val web = g.getJSONArray("host"); val n = rect(id, null)?.let { b -> if (b.width == 0.0 && b.height == 0.0) rect(id, "floating-panel") ?: b else b }
                    if (n != null) check(abs(n.width - web.getDouble(2)) <= 1 && abs(n.height - web.getDouble(3)) <= 1, "$label $id host size ${n.width}×${n.height} vs Chrome ${web.getDouble(2)}×${web.getDouble(3)}") }
                g.optJSONObject("parts")?.optJSONArray("container")?.let { web -> rect(id, "container")?.let { n ->
                    check(abs(n.width - web.getDouble(2)) <= 1 && abs(n.height - web.getDouble(3)) <= 1.5, "$label $id container size ${n.width}×${n.height} vs Chrome ${web.getDouble(2)}×${web.getDouble(3)}") } }
            }
            c.optJSONArray("sizeParts")?.let { sp -> for (i in 0 until sp.length()) { val pair = sp.getJSONArray(i); val id = pair.getString(0); val part = pair.getString(1)
                val web = geometry.optJSONObject(id)?.optJSONObject("parts")?.optJSONArray(part); val n = rect(id, part)
                if (web == null || n == null) check(false, "$label $id $part measured")
                else check(abs(n.width - web.getDouble(2)) <= 1 && abs(n.height - web.getDouble(3)) <= 1, "$label $id $part size ${n.width}×${n.height} vs Chrome ${web.getDouble(2)}×${web.getDouble(3)}") } }
            for (p in r.getJSONArray("probes").objects()) {
                val tag = p.getString("label"); val id = p.getString("node"); val part = if (p.isNull("part")) null else p.getString("part")
                val webArr = p.optJSONArray("rgb") ?: continue; val web = (0 until 3).map { webArr.getInt(it) }
                val base = rect(id, part); if (base == null) { check(false, "$label $tag: not measured natively"); continue }
                if (p.getString("kind") == "point") {
                    val at = p.getJSONArray("at")
                    val got = rgb(((base.x + at.getDouble(0)) * density).toInt(), ((base.y + at.getDouble(1)) * density).toInt())
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
        android.util.Log.i("AWCForcedAppearance", "NativeForcedAppearanceTest ${checks - failures.size}/$checks checks passed")
        assertTrue("${failures.size} of $checks failed:\n" + failures.take(60).joinToString("\n"), failures.isEmpty())
    }
}
