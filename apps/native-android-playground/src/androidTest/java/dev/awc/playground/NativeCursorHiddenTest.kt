package dev.awc.playground

import android.view.PointerIcon
import android.view.View
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalView
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

/** Shared d3 fixture (cursor-hidden-web.json, Chrome 153): effective CSS cursor at part centres (hover, :active press),
 * `hidden` hosts and hidden children, accordion roving onto a hidden item, md-list names from `labelledby`. */
@OptIn(ExperimentalTestApi::class)
class NativeCursorHiddenTest {
    @get:Rule val compose = createComposeRule()
    private val oracle by lazy { JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("cursor-hidden-web.json").bufferedReader().readText()) }
    private fun JSONArray?.objects() = if (this == null) emptyList() else (0 until length()).map { getJSONObject(it) }
    private fun text(o: JSONObject): String = if (o.getString("tag") == "#text") o.getJSONObject("properties").optString("text")
        else o.optJSONArray("children").objects().joinToString("") { text(it) }
    private fun props(n: JSONObject): Map<String, Any?> {
        val o = n.getJSONObject("properties")
        val m = o.keys().asSequence().filter { it != "id" }.associateWith { k -> o.get(k).let { if (it is Int) it.toDouble() else it } }.toMutableMap()
        if (n.getString("tag") == "md-list-item") m["id"] = n.getString("id") // inspection identity of the row
        return m
    }
    @Composable private fun Build(n: JSONObject) {
        val tag = n.getString("tag")
        if (tag == "#text" || tag == "h2" || tag == "span") { Text(text(n)); return }
        val kids = n.optJSONArray("children").objects()
        val id = n.getString("id")
        AWCComponent(tag, props(n), onEvent = { name, d -> events += Triple(name, id, d) }, content = { slot -> kids.filter { it.getJSONObject("properties").optString("slot") == slot }.forEach { Build(it) } })
    }
    private fun contains(n: JSONObject, id: String): Boolean = n.getString("id") == id || n.optJSONArray("children").objects().any { contains(it, id) }
    private val collectors = mutableMapOf<String, AWCInspectionCollector>()
    private val events = mutableListOf<Triple<String, String, Any?>>()
    private var case by mutableStateOf<JSONObject?>(null)
    private lateinit var view: View
    private var density = 1f

    private fun cursorOf(icon: PointerIcon?): String {
        if (icon == null) return "arrow"
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        return AWCCursorStyle.entries.firstOrNull { PointerIcon.getSystemIcon(ctx, it.androidType) == icon }?.css?.let { if (it == "default") "arrow" else it } ?: "arrow"
    }
    private fun shown(css: String?) = if (css == null || css == "auto" || css == "default" || css == "null") "arrow" else css

    @Test fun cursorsHiddenAndNamesMatchChrome() {
        compose.setContent {
            view = LocalView.current; density = androidx.compose.ui.platform.LocalDensity.current.density
            val c = case
            AWCTheme {
                if (c != null) key(c.getString("name")) {
                    val texts = c.getJSONArray("nodes").objects().filter { it.getString("tag") in setOf("h2", "span") }.associate { it.getString("id") to text(it) }
                    AWCLabelTextsScope(texts) {
                        Column(Modifier.width(360.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            c.getJSONArray("nodes").objects().forEach { n -> AWCInspectionScope(collectors.getOrPut(n.getString("id")) { AWCInspectionCollector() }) { Build(n) } }
                        }
                    }
                }
            }
        }
        val failures = mutableListOf<String>(); var checks = 0
        fun check(ok: Boolean, msg: String) { checks++; if (!ok) failures += msg }
        val cases = oracle.getJSONArray("cases").objects(); val results = oracle.getJSONArray("results").objects()
        for ((c, r) in cases.zip(results)) {
            val name = c.getString("name")
            collectors.clear(); compose.runOnIdle { case = c }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(600); compose.waitForIdle()
            val roots = c.getJSONArray("nodes").objects()
            fun rootOf(id: String) = roots.first { contains(it, id) }
            fun node(id: String, part: String): AWCInspectionNode? {
                val root = rootOf(id); val nodes = collectors[root.getString("id")]?.snapshot()?.nodes ?: return null
                val prefix = when {
                    id == root.getString("id") -> "component"
                    root.getString("tag") == "md-accordion" -> "component.item-" + root.getJSONArray("children").objects().indexOfFirst { it.getString("id") == id }
                    else -> "component.$id"
                }
                // A row inside an expanded panel records itself under its own id.
                return if (part.isEmpty()) nodes.firstOrNull { it.id == prefix } else nodes.firstOrNull { (it.id.startsWith(prefix) || it.id.startsWith(id)) && it.name == part }
            }
            for (p in r.getJSONArray("probes").objects()) {
                val target = p.getString("target"); val part = p.getString("part"); val press = p.optBoolean("press")
                val label = "$name $target ${part.ifEmpty { "host" }}${if (press) " :active" else ""}"
                val n = node(target, part); if (n == null) { check(false, "$label measured"); continue }
                val at = Offset(((n.bounds.x + n.bounds.width / 2) * density).toFloat(), ((n.bounds.y + n.bounds.height / 2) * density).toFloat())
                compose.onRoot().performMouseInput { moveTo(at) }; compose.waitForIdle()
                if (press) { compose.onRoot().performMouseInput { press() }; compose.waitForIdle() }
                val native = compose.runOnIdle { cursorOf(view.pointerIcon) }
                check(native == shown(p.optString("cursor", "null")), "$label cursor $native vs Chrome ${p.optString("cursor")}")
                if (press) { compose.onRoot().performMouseInput { release() }; compose.waitForIdle() }
                compose.onRoot().performMouseInput { moveTo(Offset(399f * density, 899f * density)) }; compose.waitForIdle()
            }
            val layout = r.optJSONObject("layout")
            layout?.keys()?.forEach { id ->
                val l = layout.getJSONObject(id); val rect = l.getJSONArray("rect")
                if (l.getString("display") == "none") {
                    if (roots.any { it.getString("id") == id }) check(collectors[id]?.snapshot()?.nodes.isNullOrEmpty(), "$name $id hidden root renders nothing")
                    else check(node(id, "") == null, "$name $id hidden child renders nothing")
                    return@forEach
                }
                val n = node(id, ""); if (n == null) { check(false, "$name $id measured"); return@forEach }
                val parent = if (l.isNull("parent")) null else node(l.getString("parent"), "")
                val y = n.bounds.y.toDouble() - (parent?.bounds?.y?.toDouble() ?: 0.0)
                check(kotlin.math.abs(y - rect.getDouble(1)) <= 1 && kotlin.math.abs(n.bounds.height.toDouble() - rect.getDouble(3)) <= 1,
                    "$name $id y/height $y/${n.bounds.height} vs Chrome ${rect.getDouble(1)}/${rect.getDouble(3)}")
            }
            val names = r.optJSONObject("names")
            names?.keys()?.forEach { id ->
                val want = names.getJSONObject(id).getString("name")
                check(compose.onAllNodes(SemanticsMatcher.expectValue(androidx.compose.ui.semantics.SemanticsProperties.ContentDescription, listOf(want))).fetchSemanticsNodes().isNotEmpty(),
                    "$name $id accessible name $want")
            }
            // List-facing item events (Chrome order and payloads) for pointer actions.
            val types = c.optJSONArray("events").let { a -> if (a == null) emptySet() else (0 until a.length()).map { a.getString(it) }.toSet() }
            fun fmt(n: String, t: String, d: Any?): String {
                val m = d as? Map<*, *> ?: (d as? JSONObject)?.let { o -> o.keys().asSequence().associateWith { o.get(it) } } ?: emptyMap<String, Any?>()
                return "$n@$t" + listOf("index", "childIndex", "selected", "expanded", "value", "item").mapNotNull { k -> m[k]?.takeUnless { it == JSONObject.NULL }?.let { v -> "$k=" + (if (v is Number) v.toInt().toString() else v.toString()) } }.joinToString(",")
            }
            for (k in r.optJSONArray("keys").objects().filter { it.optJSONObject("action")?.optString("type") == "click" }) {
                val a = k.getJSONObject("action"); val row = node(a.getString("target"), a.getString("part"))
                if (row == null) { check(false, "$name ${a.getString("target")} row measured"); continue }
                events.clear()
                val at = Offset(((row.bounds.x + minOf(24.0, row.bounds.width / 2)) * density).toFloat(), ((row.bounds.y + row.bounds.height / 2) * density).toFloat())
                compose.onRoot().performMouseInput { moveTo(at); press(); release() }; compose.waitForIdle(); compose.mainClock.advanceTimeBy(400); compose.waitForIdle()
                val nat = events.filter { it.first in types }.map { fmt(it.first, it.second, it.third) }
                val web = k.getJSONArray("events").objects().map { fmt(it.getString("type"), it.getString("target"), it.opt("detail")) }
                check(nat == web, "$name click ${a.getString("target")} events $nat vs Chrome $web")
            }
            for (k in r.optJSONArray("keys").objects().filter { !it.has("action") }) {
                val header = compose.onAllNodes(hasText("One") and hasClickAction())[0]
                header.requestFocus(); compose.waitForIdle()
                header.performKeyInput { pressKey(Key.DirectionDown) }; compose.waitForIdle()
                check(compose.onAllNodes(isFocused() and hasText("One")).fetchSemanticsNodes().isNotEmpty(), "$name ArrowDown onto a hidden item keeps focus on ${k.getString("focusAfter")}")
            }
        }
        android.util.Log.i("AWCCursorHidden", "NativeCursorHiddenTest ${checks - failures.size}/$checks checks passed")
        assertTrue("NativeCursorHiddenTest ${checks - failures.size}/$checks\n" + failures.joinToString("\n"), failures.isEmpty())
    }
}
