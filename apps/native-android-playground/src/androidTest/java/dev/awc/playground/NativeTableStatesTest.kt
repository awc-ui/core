package dev.awc.playground

import android.graphics.BitmapFactory
import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
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
import kotlin.math.atan2

/**
 * md-table family interaction against Mac Chrome 153 (table-web-states.json, shared byte-identically with
 * NativeTableStatesIntegration.swift): per phase the application events (order, payloads), row / head / toolbar / pagination /
 * scroll state, focus, the phase shot (flat pixels, 1 dp = 1 px like the DPR 1 oracle) and per-frame motion curves sampled on
 * the test clock (±2 frames). Nested components owned elsewhere (md-checkbox, md-icon-button, md-select, md-progress-indicator)
 * are masked in shots.
 */
class NativeTableStatesTest {
    @get:Rule val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()
    data class Node(val id: String, val tag: String, val props: Map<String, Any?>, val children: List<Node>, val slot: String?)
    private fun JSONObject.toMap(): Map<String, Any?> = keys().asSequence().associateWith { k -> opt(k).let { v -> when (v) { JSONObject.NULL -> null; is JSONObject -> v.toMap(); is JSONArray -> (0 until v.length()).map { v.get(it) }; else -> v } } }
    private fun parse(o: JSONObject): Node = Node(o.optString("id"), o.getString("tag"), o.optJSONObject("properties")?.toMap() ?: emptyMap(),
        (o.optJSONArray("children") ?: JSONArray()).let { a -> (0 until a.length()).map { parse(a.getJSONObject(it)) } }, if (o.has("slot") && !o.isNull("slot")) o.getString("slot") else null)
    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
    private val assets get() = InstrumentationRegistry.getInstrumentation().context.assets

    private var nodes by mutableStateOf<List<Node>>(emptyList())
    /** The page background under the web shots (their margin pixel): the native page paints the same. */
    private var pageBg by mutableStateOf<Color?>(null)
    private var lostFocus: String? = null
    private var runName = ""
    private var dark by mutableStateOf(false); private var rtl by mutableStateOf(false); private var reduced by mutableStateOf(false); private var epoch by mutableIntStateOf(0)
    private val inspection = AWCTableInspection(); private val scroller = AWCTableScrollController(); private val motion = AWCTableMotionRecorder()
    private val table = AWCTableController(); private val pagination = AWCTablePaginationController()
    private var tableId = "n0"; private var paginationId = "-"
    private val events = mutableListOf<Triple<String, Any?, String>>()
    private var focusManager: androidx.compose.ui.focus.FocusManager? = null
    /** The page's body: an inert focus sink first in the window's focus order (Chrome's "nothing focused" state; Tab from it
     *  reaches the first control, Shift+Tab re-enters at the last one). */
    private val sink = androidx.compose.ui.focus.FocusRequester(); private var sinkFocused = false
    private fun log(m: String) { android.util.Log.w("AWCTable", m) }
    private var checks = 0; private val failures = mutableListOf<String>(); private val report = JSONArray(); private val gaps = mutableListOf<String>()
    private fun check(ok: Boolean, msg: () -> String) { checks++; if (!ok) failures += msg() }

    // MARK: Host (declarative model + the page's consumer wiring)
    private var data: List<List<Any>> = emptyList()
    private var sortable = false; private var paged = false; private var page = 0; private var rpp = 5; private var renders = 0
    private fun map(d: Any?): Map<String, Any?> = (d as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value } ?: emptyMap()
    private fun go(n: Node, id: String, f: (Node) -> Node): Node = if (n.id == id) f(n) else n.copy(children = n.children.map { go(it, id, f) })
    private fun update(id: String, f: (Node) -> Node) { nodes = nodes.map { go(it, id, f) } }
    private fun find(ns: List<Node>, p: (Node) -> Boolean): List<Node> = ns.flatMap { (if (p(it)) listOf(it) else emptyList()) + find(it.children, p) }
    private fun bodyRows(): List<Node> = find(nodes) { it.tag == "md-table-body" }.firstOrNull()?.children?.filter { it.tag == "md-table-row" } ?: emptyList()
    private fun rowName(r: Node): String = r.children.firstOrNull { it.tag == "md-table-cell" && it.props["padding"] != "checkbox" }?.let { c -> c.children.joinToString(" ") { (it.props["text"] ?: "").toString() }.trim() } ?: ""
    /** First data cell in inline order as laid out (the source moves pinned cells in the light DOM; native pins visually). */
    private fun visualName(r: Node): String {
        val all = r.children.filter { it.tag == "md-table-cell" }
        // Pins / hidden columns re-sequence the cells: the table reports its display order of the authored cells.
        (inspection.metrics["table.columnOrder"] as? List<*>)?.mapNotNull { (it as? Number)?.toInt() }?.takeIf { it.isNotEmpty() }?.let { order ->
            order.mapNotNull { all.getOrNull(it) }.firstOrNull { it.props["padding"] != "checkbox" }?.let { c -> return c.children.joinToString(" ") { (it.props["text"] ?: "").toString() }.trim() } }
        val cells = r.children.filter { it.tag == "md-table-cell" && it.props["padding"] != "checkbox" }
        val placed = cells.mapNotNull { c -> inspection.cells[c.id]?.takeIf { it.width > 0 }?.let { c to it } }
        if (placed.size != cells.size || placed.isEmpty()) return rowName(r)
        val first = if (rtl) placed.maxByOrNull { it.second.x + it.second.width }!! else placed.minByOrNull { it.second.x }!!
        return first.first.children.joinToString(" ") { (it.props["text"] ?: "").toString() }.trim()
    }
    private fun num(v: Any): String = (v as Number).toDouble().let { if (it == Math.floor(it)) it.toLong().toString() else it.toString() }
    private fun render() {
        renders++
        val from = page * rpp; val n = if (rpp == -1) data.size else rpp
        val rows = (0 until n).mapNotNull { i -> if (from + i >= data.size) null else { val d = data[from + i]; val name = d[0].toString()
            Node("pg$renders-$i", "md-table-row", mapOf("value" to "r${from + i}"), listOf(Node("pg$renders-$i-c", "md-table-cell", mapOf("padding" to "checkbox"),
                listOf(Node("pg$renders-$i-cb", "md-checkbox", mapOf("ariaLabel" to "Select $name"), emptyList(), null)), null)) +
                d.mapIndexed { c, v -> Node("pg$renders-$i-$c", "md-table-cell", if (c == 0) mapOf("head" to true, "scope" to "row") else mapOf("numeric" to true),
                    listOf(Node("pg$renders-$i-$c-t", "#text", mapOf("text" to if (c == 0) name else num(v)), emptyList(), null)), null) }, null) } }
        find(nodes) { it.tag == "md-table-body" }.firstOrNull()?.let { b -> update(b.id) { it.copy(children = rows) } }
        update(tableId) { it.copy(props = it.props + ("rowOffset" to from) + ("rowCount" to data.size)) }
    }
    private fun consume(name: String, detail: Any?) {
        val d = map(detail)
        when (name) {
            "mdRowSelectionChange" -> (d["row"] as? String)?.let { id -> update(id) { it.copy(props = it.props + ("selected" to (d["selected"] == true))) } }
            "mdRowExpandedChange" -> (d["row"] as? String)?.let { id -> update(id) { it.copy(props = it.props + ("expanded" to (d["expanded"] == true))) } }
            "mdSortChange" -> if (sortable) {
                val column = d["column"]?.toString() ?: ""; val order = d["order"]?.toString() ?: "none"
                val rows = bodyRows(); val byName = rows.associateBy(::rowName)
                val ci = listOf("name", "cal", "fat", "carbs", "protein").indexOf(column).coerceAtLeast(0)
                var ordered = data.take(rows.size)
                if (order != "none") ordered = ordered.sortedWith { a, z -> val x = a[ci]; val y = z[ci]
                    val c = if (x is Number && y is Number) x.toDouble().compareTo(y.toDouble()) else x.toString().compareTo(y.toString()); if (order == "desc") -c else c }
                find(nodes) { it.tag == "md-table-body" }.firstOrNull()?.let { b -> update(b.id) { it.copy(children = ordered.mapNotNull { r -> byName[r[0].toString()] }) } }
            }
            "mdPageChange" -> if (paged) { page = (d["page"] as? Number)?.toInt() ?: 0; render() }
            "mdRowsPerPageChange" -> if (paged) { rpp = (d["rowsPerPage"] as? Number)?.toInt() ?: 5; render() }
        }
    }
    @Composable private fun Render(n: Node) {
        when (n.tag) {
            "#text" -> AWCSlotText(n.props["text"]?.toString() ?: "")
            "#symbol" -> AWCMaterialSymbol(n.props["name"]?.toString() ?: "", size = 24.dp)
            "br" -> {}
            "div", "p", "span", "strong", "em" -> {
                val pad = padding(n.props["style"]?.toString() ?: "")
                Column(Modifier.padding(start = pad[3].dp, top = pad[0].dp, end = pad[1].dp, bottom = pad[2].dp)) { n.children.forEach { Render(it) } }
            }
            else -> AWCComponent(n.tag, n.props + ("id" to n.id) + (if (n.tag == "md-icon-button" && n.props["ariaLabel"] != null) mapOf("aria-label" to n.props["ariaLabel"]) else emptyMap()), onEvent = { name, detail -> events += Triple(name, detail, n.id); consume(name, detail) }) { slot ->
                n.children.filter { (it.slot ?: "") == slot }.forEach { key(it.id) { Render(it) } } }
        }
    }
    private fun padding(style: String): List<Double> {
        val v = Regex("padding:\\s*([^;]+)").find(style)?.groupValues?.get(1)?.trim()?.split(Regex("\\s+"))?.mapNotNull { it.removeSuffix("px").toDoubleOrNull() } ?: return listOf(0.0, 0.0, 0.0, 0.0)
        return when (v.size) { 1 -> List(4) { v[0] }; 2 -> listOf(v[0], v[1], v[0], v[1]); 3 -> listOf(v[0], v[1], v[2], v[1]); 4 -> v; else -> listOf(0.0, 0.0, 0.0, 0.0) }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f, 1f)) {
        focusManager = androidx.compose.ui.platform.LocalFocusManager.current
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(pageBg ?: if (dark) Color(0xFF141218) else Color(0xFFFEF7FF))) {
          Box(Modifier.size(1.dp).focusRequester(sink).onFocusChanged { sinkFocused = it.isFocused }.focusable())
          key(epoch) {
            AWCTableInspectionScope(inspection) { AWCTableReducedMotionScope(reduced) { AWCTableScrollControllerScope(scroller) { AWCTableMotionScope(motion) {
                AWCTableControllerScope(mapOf(tableId to table), mapOf(paginationId to pagination)) {
                    Box(Modifier.absoluteOffset(24.dp, 24.dp).wrapContentSize(androidx.compose.ui.AbsoluteAlignment.TopLeft, unbounded = true).width(760.dp)) {
                        CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) { Column { nodes.forEach { key(it.id) { Render(it) } } } }
                    }
                    // The harness "Run" button (#bar, bottom right): the page's last tab stop.
                    Box(Modifier.absoluteOffset(1100.dp, 850.dp)) { AWCComponent("md-button", mapOf("variant" to "text", "id" to "after")) { AWCSlotText("Run") } }
                } } } } }
        } } }
    } } }

    // MARK: Input (1 dp = 1 px; root coordinates)
    private fun inputMove(x: Float, y: Float) = compose.onRoot().performMouseInput { moveTo(Offset(x, y)) }
    private fun down(p: Offset) = compose.onRoot().performMouseInput { moveTo(p); press() }
    private fun up(p: Offset) = compose.onRoot().performMouseInput { moveTo(p); release() }
    private fun click(p: Offset) { down(p); frames(1); up(p) }
    private fun key(code: Int, shift: Boolean = false) {
        val ins = InstrumentationRegistry.getInstrumentation(); val t = android.os.SystemClock.uptimeMillis(); val meta = if (shift) KeyEvent.META_SHIFT_ON else 0
        ins.sendKeySync(KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0, meta)); ins.sendKeySync(KeyEvent(t, t + 10, KeyEvent.ACTION_UP, code, 0, meta))
    }
    private fun wheel(p: Offset, dy: Float, dx: Float = 0f) {
        val factor = android.view.ViewConfiguration.get(compose.activity).scaledVerticalScrollFactor
        compose.onRoot().performMouseInput { moveTo(p); if (dy != 0f) scroll(dy / factor, ScrollWheel.Vertical); if (dx != 0f) scroll(dx / factor, ScrollWheel.Horizontal) }
    }
    private fun blur() = compose.runOnUiThread { runCatching { sink.requestFocus() }.onFailure { focusManager?.clearFocus(force = true) } }
    // The harness's blank-page click resets focus to the document start: a press on an empty spot of the page right of every
    // fixture (inside the root, far from any control's touch target), then the focus sink before the table.
    // The press of a new performMouseInput gesture landed at the previous gesture's position (the toggle / label clicked by
    // the phase before, whose clickable then fired again): move there first in a gesture of its own.
    private fun blank() {
        val e0 = events.size
        // A touch tap (the mouse press of a new gesture reached the expand toggle clicked by the phase before, LTR only).
        val hit = compose.onAllNodes(SemanticsMatcher("any") { true }, useUnmergedTree = true).fetchSemanticsNodes()
            .filter { it.boundsInRoot.contains(Offset(1000f, 600f)) }.map { "${it.id}:${it.boundsInRoot}" }
        inputMove(1000f, 600f); frames(1)
        compose.onRoot().performTouchInput { click(Offset(1000f, 600f)) }; frames(1)
        val e1 = events.size; blur(); frames(1)
        if (events.size != e0) log("DIAG blank: events +${e1 - e0} on the tap, +${events.size - e1} on blur: ${events.drop(e0).map { it.first }}; nodes at the tap $hit")
    }
    private fun center(id: String): Offset? = (inspection.cells[id] ?: inspection.rows[id])?.let { Offset((it.x + it.width / 2).toFloat(), (it.y + it.height / 2).toFloat()) }
    private fun nodeCenter(id: String): Offset? = compose.onAllNodes(hasTestTag(id), useUnmergedTree = true).fetchSemanticsNodes().firstOrNull()?.boundsInRoot?.center
    private fun labelCenter(label: String): Offset? {
        val c = compose.onAllNodes(hasContentDescription(label), useUnmergedTree = true).fetchSemanticsNodes().firstOrNull { it.boundsInRoot.width > 0 }?.boundsInRoot?.center
        if (c == null) log("DIAG no node for '$label'; descriptions ${compose.onAllNodes(SemanticsMatcher("any") { it.config.contains(SemanticsProperties.ContentDescription) }, true).fetchSemanticsNodes().map { it.config[SemanticsProperties.ContentDescription].joinToString() }.take(40)}")
        return c
    }
    private fun cellCenter(r: Int, c: Int): Offset? = bodyRows().getOrNull(r)?.children?.filter { it.tag == "md-table-cell" }?.getOrNull(c)?.let { center(it.id) }

    // MARK: Frames (test clock) and motion samples
    private var clock = 0L
    private val samples = mutableListOf<Pair<Long, Map<String, Double>>>()
    private fun frames(n: Int) { repeat(n) { compose.mainClock.advanceTimeByFrame(); clock += 16; samples += clock to HashMap(motion.values) } }

    private fun action(run: String, label: String): () -> Unit {
        fun leave() { compose.onRoot().performMouseInput { moveTo(Offset(1190f, 890f)) } }
        fun sortLabel(col: String) = find(nodes) { it.tag == "md-table-sort-label" && it.props["column"] == col }.firstOrNull()?.let { l -> labelCenter(l.children.joinToString("") { (it.props["text"] ?: "").toString() }) ?: compose.onAllNodes(hasText(l.children.joinToString("") { (it.props["text"] ?: "").toString() }), true).fetchSemanticsNodes().firstOrNull()?.boundsInRoot?.center }
        fun toggle(r: Int) = find(nodes) { it.tag == "md-table-expand-toggle" }.getOrNull(r)?.let { labelCenter(it.props["buttonLabel"]?.toString() ?: "Expand row") }
        if (run.startsWith("tb-hover-select")) return when (label) {
            "hover-row-1" -> { { cellCenter(1, 3)?.let { inputMove(it.x, it.y) } } }
            "hover-row-2" -> { { cellCenter(2, 3)?.let { inputMove(it.x, it.y) } } }
            "press-row-2-checkbox" -> { { cellCenter(2, 0)?.let { down(it) } } }
            "release-row-2-checkbox" -> { { cellCenter(2, 0)?.let { up(it) } } }
            "hover-selected-row-2-sticky" -> { { cellCenter(2, 1)?.let { inputMove(it.x, it.y) } } }
            "click-head-checkbox-select-all", "click-head-checkbox-deselect-all" -> { { labelCenter("Select all rows")?.let { click(it) } } }
            "click-row-3-cell-rowclick" -> { { cellCenter(3, 3)?.let { click(it) } } }
            else -> ::leave
        }
        if (run.startsWith("tb-expand")) return when (label) {
            "click-toggle-row-0-open", "click-toggle-row-0-close" -> { { toggle(0)?.let { click(it) } } }
            "Tab-to-toggle-1" -> { { blank(); key(KeyEvent.KEYCODE_TAB); key(KeyEvent.KEYCODE_TAB) } }
            "Enter-opens-row-1" -> { { key(KeyEvent.KEYCODE_ENTER) } }
            "Space-closes-row-1" -> { { key(KeyEvent.KEYCODE_SPACE) } }
            "row-2-toggle()-method" -> { { bodyRows().getOrNull(2)?.let { compose.runOnUiThread { table.toggleRow(it.id) } } } }
            else -> { { bodyRows().getOrNull(2)?.let { r -> update(r.id) { it.copy(props = it.props + ("expanded" to false)) } } } }
        }
        if (run.startsWith("tb-sort")) return when (label) {
            "click-calories", "click-calories-again-desc", "click-calories-third" -> { { sortLabel("cal")?.let { click(it) } } }
            "click-dessert" -> { { sortLabel("name")?.let { click(it) } } }
            "Tab-to-fat-label" -> { { blank(); repeat(3) { key(KeyEvent.KEYCODE_TAB) } } }
            "Enter-sorts-fat" -> { { key(KeyEvent.KEYCODE_ENTER) } }
            "Space-toggles-fat" -> { { key(KeyEvent.KEYCODE_SPACE) } }
            else -> { { compose.runOnUiThread { table.setSort("protein", "desc") } } }
        }
        if (run.startsWith("tb-pagination")) return when (label) {
            "select-row-0" -> { { cellCenter(0, 0)?.let { click(it) } } }
            "click-next" -> { { labelCenter("Next page")?.let { click(it) } } }
            "click-last" -> { { labelCenter("Last page")?.let { click(it) } } }
            "click-prev" -> { { labelCenter("Previous page")?.let { click(it) } } }
            "click-first" -> { { labelCenter("First page")?.let { click(it) } } }
            "setRowsPerPage(10)" -> { { compose.runOnUiThread { pagination.setRowsPerPage(10) } } }
            "goToPage(1)" -> { { compose.runOnUiThread { pagination.goToPage(1) } } }
            else -> { { update(paginationId) { it.copy(props = it.props + ("count" to 4)) } } }
        }
        if (run == "tb-keyboard") return when (label) {
            "blank" -> ::blank
            "Shift+Tab-x10" -> { { val seq = mutableListOf(focusKind()); repeat(10) { key(KeyEvent.KEYCODE_TAB, shift = true); repeat(2) { compose.mainClock.advanceTimeByFrame() }; seq += focusKind() }; log("DIAG shift-tab: ${seq.joinToString(" > ")}") } }
            "Enter" -> { { key(KeyEvent.KEYCODE_ENTER) } }
            "Space" -> { { key(KeyEvent.KEYCODE_SPACE) } }
            "ArrowDown-no-grid-nav" -> { { key(KeyEvent.KEYCODE_DPAD_DOWN) } }
            "ArrowRight" -> { { key(KeyEvent.KEYCODE_DPAD_RIGHT) } }
            else -> { { key(KeyEvent.KEYCODE_TAB); if (label == "Tab-18" && focusKind() != "none" && focusKind() != "after") {
                blur(); gaps += "tb-keyboard Tab-18: focus wraps inside the window; Chrome leaves the document (reset to none)" } } }
        }
        if (run.startsWith("tb-frozen-scroll")) { val r = run.endsWith("rtl"); return when (label) {
            "wheel-down-120" -> { { cellCenter(1, 2)?.let { wheel(it, 120f) } } }
            "wheel-inline-200" -> { { cellCenter(2, 2)?.let { wheel(it, 0f, if (r) -200f else 200f) } } }
            "hover-hthumb", "drag-hthumb-80" -> { {
                val y = (inspection.metrics["hthumb.y"] as? Double)?.toFloat(); val x = (inspection.metrics["hthumb.x"] as? Double)?.toFloat()
                if (x != null && y != null) { if (label == "hover-hthumb") inputMove(x, y) else {
                    compose.onRoot().performMouseInput { moveTo(Offset(x, y)); press(); for (i in 1..8) { moveBy(Offset(if (r) -10f else 10f, 0f), 16) }; release() } } } } }
            "focus-body-scroller" -> { { compose.onAllNodes(hasTestTag(tableId + "-body"), true).fetchSemanticsNodes().firstOrNull()?.let { compose.onNode(hasTestTag(tableId + "-body"), true).requestFocus() } } }
            "PageDown" -> { { key(KeyEvent.KEYCODE_PAGE_DOWN) } }
            "End" -> { { key(KeyEvent.KEYCODE_MOVE_END) } }
            "Home" -> { { key(KeyEvent.KEYCODE_MOVE_HOME) } }
            "ArrowRight-x3" -> { { repeat(3) { key(KeyEvent.KEYCODE_DPAD_RIGHT) } } }
            else -> { { key(KeyEvent.KEYCODE_MOVE_END, shift = true) } }
        } }
        if (run == "tb-sticky-container-scroll") { val cc = { find(nodes) { it.tag == "md-table-container" }.firstOrNull()?.let { (inspection.metrics["container.center"] as? List<*>)?.let { Offset((it[0] as Number).toFloat(), (it[1] as Number).toFloat()) } } }
            return when (label) {
                "wheel-down-100" -> { { cellCenter(1, 2)?.let { wheel(it, 100f) } } }
                "wheel-down-400" -> { { (cc() ?: cellCenter(1, 2))?.let { wheel(it, 400f) } } }
                else -> { { (cc() ?: cellCenter(1, 2))?.let { wheel(it, -1000f) } } }
            } }
        if (run == "tb-loading-empty") return when (label) {
            "loading-overlay-on" -> { { update(tableId) { it.copy(props = it.props + ("loading" to true)) } } }
            "loading-off" -> { { update(tableId) { it.copy(props = it.props + ("loading" to false)) } } }
            "skeleton-on" -> { { update(tableId) { it.copy(props = it.props + ("loadingMode" to "skeleton") + ("loading" to true)) } } }
            "skeleton-off-empty-on" -> { { update(tableId) { it.copy(props = it.props + ("loading" to false) + ("empty" to true)) }
                find(nodes) { it.tag == "md-table-body" }.firstOrNull()?.let { b -> update(b.id) { it.copy(children = emptyList()) } } } }
            else -> { { update(tableId) { it.copy(props = it.props + ("empty" to false)) } } }
        }
        if (run == "tb-pin-visibility") return when (label) {
            "pinColumn(2,start)" -> { { compose.runOnUiThread { table.pinColumn(2, "start") } } }
            "pinColumn(4,end)" -> { { compose.runOnUiThread { table.pinColumn(4, "end") } } }
            "scroll-inline-200" -> { { compose.runOnUiThread { scroller.snap(200.0, null) } } }
            "pinColumn(2,none)" -> { { compose.runOnUiThread { table.pinColumn(2, "none") } } }
            "setColumnVisibility(3,false)" -> { { compose.runOnUiThread { table.setColumnVisibility(3, false) } } }
            else -> { { compose.runOnUiThread { table.setColumnVisibility(3, true) } } }
        }
        if (run == "tb-toolbar-autobind") return when (label) {
            "select-two" -> { { val rs = bodyRows(); listOf(0, 2).forEach { k -> rs.getOrNull(k)?.let { r -> update(r.id) { it.copy(props = it.props + ("selected" to true)) } } } } }
            "insert-toolbar-late" -> { { find(nodes) { it.tag == "md-table-container" }.firstOrNull()?.let { c -> update(c.id) { it.copy(children = listOf(Node("late-toolbar", "md-table-toolbar",
                mapOf("headline" to "Desserts", "supportingText" to "Nutrition per serving", "autoBind" to true), listOf(
                    Node("late-filter", "md-icon-button", mapOf("ariaLabel" to "Filter list", "icon" to "filter_list"), emptyList(), "actions"),
                    Node("late-delete", "md-icon-button", mapOf("ariaLabel" to "Delete selected", "icon" to "delete"), emptyList(), "selection-actions")), "top")) + it.children) } } } }
            "move-toolbar" -> { { } }
            "deselect-one" -> { { bodyRows().firstOrNull()?.let { r -> update(r.id) { it.copy(props = it.props + ("selected" to false)) } } } }
            else -> { { bodyRows().getOrNull(1)?.let { r -> update(r.id) { it.copy(props = it.props + ("selected" to true)) } }; frames(3); update(tableId) { it.copy(props = it.props + ("selection" to "single")) } } }
        }
        return {}
    }

    // MARK: Focus
    private fun webFocusKind(f: JSONArray?): String {
        val first = f?.optString(0) ?: "body"; val head = first.split(" ").first()
        return when (head) { "body" -> "none"; "button" -> "after"; "md-checkbox" -> "checkbox"; "md-table-sort-label" -> "sort-label"; "md-table-row" -> "row"
            "md-table-expand-toggle" -> "expand-toggle"; "md-table-pagination" -> "pagination:" + (f?.optString(1) ?: "")
            "md-table" -> if (f?.optString(1)?.contains("body-scroll") == true) "body-scroll" else "table"; else -> head }
    }
    private fun focusKind(): String {
        if (inspection.metrics["body.focused"] == true) return "body-scroll"
        if (inspection.metrics.entries.any { it.key.startsWith("focus:") && it.value == true }) return "row"
        if (inspection.metrics.entries.any { it.key.startsWith("sort:") && (it.value as? List<*>)?.getOrNull(3) == true }) return "sort-label"
        if (sinkFocused) return "none"
        val raw = semNodes(isFocused()).firstOrNull() ?: return "none"
        if (raw.boundsInRoot.left >= 1090f && raw.boundsInRoot.top >= 840f) return "after"
        (inspection.metrics["pagination.rpp"] as? List<*>)?.let { b -> val c = raw.boundsInRoot.center; val v = b.map { (it as Number).toDouble() }
            if (c.x >= v[0] && c.x <= v[0] + v[2] && c.y >= v[1] && c.y <= v[1] + v[3]) return "pagination:rpp-select" }
        // The merged node of a clickable carries its label and role.
        var n = raw; var up: androidx.compose.ui.semantics.SemanticsNode? = raw
        while (up != null && up.config.getOrNull(SemanticsProperties.ContentDescription) == null && up.config.getOrNull(SemanticsProperties.Role) == null && up.config.getOrNull(SemanticsProperties.Text) == null) up = up.parent
        if (up != null) n = up
        val role = n.config.getOrNull(SemanticsProperties.Role); val desc = (n.config.getOrNull(SemanticsProperties.ContentDescription) ?: raw.children.flatMap { it.config.getOrNull(SemanticsProperties.ContentDescription) ?: emptyList() }).joinToString()
        val text = n.config.getOrNull(SemanticsProperties.Text)?.joinToString() ?: ""
        return when {
            role == androidx.compose.ui.semantics.Role.Checkbox || desc.startsWith("Select ") -> "checkbox"
            desc.startsWith("Details for") || desc == "Expand row" -> "expand-toggle"
            desc == "Next page" -> "pagination:next-button"; desc == "Last page" -> "pagination:last-button"
            desc == "Previous page" -> "pagination:prev-button"; desc == "First page" -> "pagination:first-button"
            desc.startsWith("Rows per page") -> "pagination:rpp-select"
            text == "Run" || desc == "Run" -> "after"
            else -> "other:$desc$text role=$role tag=${n.config.getOrNull(SemanticsProperties.TestTag) ?: ""} bounds=${n.boundsInRoot}"
        }
    }

    // MARK: Comparisons
    private val eventNames = setOf("mdSelectionChange", "mdRowSelectionChange", "mdRowClick", "mdRowExpandedChange", "mdSortChange", "mdPageChange", "mdRowsPerPageChange", "mdPinChange", "mdColumnVisibilityChange", "mdChange", "mdClick")
    private fun dbl(v: Any?) = (v as? Number)?.toDouble()
    private fun keyOf(name: String, raw: Any?): String { val d = if (raw is JSONObject) raw.toMap() else map(raw)
        fun list(v: Any?): List<String> = when (v) { is JSONArray -> (0 until v.length()).map { v.get(it).toString() }; is List<*> -> v.map { it.toString() }; else -> emptyList() }
        fun ints(v: Any?): List<Int> = list(v).mapNotNull { it.toDoubleOrNull()?.toInt() }
        return when (name) {
            "mdChange" -> "mdChange(${d["checked"] == true})"
            "mdSelectionChange" -> "mdSelectionChange(${dbl(d["count"])?.toInt()}/${dbl(d["total"])?.toInt()} ${list(d["values"])} all=${d["all"] == true} ind=${d["indeterminate"] == true})"
            "mdRowSelectionChange" -> "mdRowSelectionChange(${d["selected"] == true} ${d["value"]})"
            "mdRowExpandedChange" -> "mdRowExpandedChange(${d["expanded"] == true})"
            "mdRowClick" -> "mdRowClick(${d["value"]})"
            "mdSortChange" -> "mdSortChange(${d["column"]} ${d["order"]})"
            "mdPageChange" -> "mdPageChange(${dbl(d["page"])?.toInt()})"
            "mdRowsPerPageChange" -> "mdRowsPerPageChange(${dbl(d["rowsPerPage"])?.toInt()})"
            "mdPinChange" -> "mdPinChange(${dbl(d["column"])?.toInt()} ${d["side"] ?: "null"})"
            "mdColumnVisibilityChange" -> "mdColumnVisibilityChange(${dbl(d["column"])?.toInt()} ${d["visible"] == true} ${ints(d["hidden"])})"
            else -> name
        }
    }
    private fun numbers(s: String): List<Double> = Regex("-?[0-9.]+(e-?[0-9]+)?").findAll(s).mapNotNull { it.value.toDoubleOrNull() }.toList()
    private fun angle(m: String): Double { if (m == "none" || m.isEmpty()) return 0.0; val n = numbers(m); return if (n.size >= 2) Math.toDegrees(atan2(n[1], n[0])) else 0.0 }
    private fun translateY(m: String): Double { val n = numbers(m); return if (m != "none" && n.size >= 6) n[5] else 0.0 }
    private fun alpha(s: String): Double { val n = numbers(s); return when { s.startsWith("rgba") && n.size >= 4 -> n[3]; s.startsWith("color(srgb") && n.size >= 4 -> n[3]; s.startsWith("rgb") || s.startsWith("color(") -> 1.0; else -> 0.0 } }
    /** Native timeline shift: the web's τ = 0 is the input's handling; the native curves start at their first changed frame. */
    private var shift = 0L
    private fun motionCheck(tag: String, web: List<Pair<Double, Double>>, key: String, tolerance: Double, map: (Double) -> Double = { it }) {
        if (web.size < 3 || (web.maxOf { it.second } - web.minOf { it.second }) <= tolerance) return
        var ok = 0; val bad = mutableListOf<String>()
        for ((tau, v) in web) {
            val cands = listOf(-33, -17, 0, 17, 33).mapNotNull { dt -> samples.lastOrNull { it.first <= tau + dt + shift }?.second?.get(key)?.let(map) }
            // ±2 frames of latency: the native curve passes through the web value within 33 ms either side (between frames too).
            if (cands.isNotEmpty() && v >= cands.min() - tolerance && v <= cands.max() + tolerance) ok++ else bad += "${tau.toInt()}ms web ${"%.2f".format(v)} native ${cands.map { "%.2f".format(it) }}"
        }
        check(ok >= web.size * 0.9) { "$tag: motion $key $ok/${web.size} frames within $tolerance (±2 frames) — ${bad.take(4)}" }
        if (bad.isNotEmpty() && ok >= web.size * 0.9) gaps += "$tag: ${bad.size} frame(s) beyond ±2 frames for $key"
    }
    private fun compareState(tag: String, w: JSONObject) {
        // Rows the source keeps in the DOM without rendering them (skeleton mode) have no box.
        val webRows = (w.optJSONArray("rows") ?: JSONArray()).let { a -> JSONArray((0 until a.length()).map { a.getJSONArray(it) }.filter { it.length() < 4 || it.optDouble(3, 1.0) > 0 }) }
        val rows = bodyRows().mapNotNull { r -> inspection.rows[r.id]?.let { r to it } }.sortedBy { it.second.y }
        if (webRows.length() > 0 || rows.isNotEmpty()) {
            val webNames = (0 until webRows.length()).map { webRows.getJSONArray(it).optString(0) }
            check(webNames == rows.map { visualName(it.first) }) { "$tag: row order ${rows.map { visualName(it.first) }} vs $webNames" }
            for (k in 0 until minOf(webRows.length(), rows.size)) {
                val a = webRows.getJSONArray(k); val (node, b) = rows[k]
                check(abs(b.y - a.getDouble(2)) <= 1.5 && abs(b.height - a.getDouble(3)) <= 1.5) { "$tag: row $k ${rowName(node)} y/h (${b.y}, ${b.height}) vs (${a.getDouble(2)}, ${a.getDouble(3)})" }
                if (!a.isNull(4)) check((inspection.metrics["selected:" + node.id] == true) == (a.getString(4) == "true")) { "$tag: row $k selected ${inspection.metrics["selected:" + node.id]} vs ${a.getString(4)}" }
                if (!a.isNull(5)) check((inspection.metrics["expanded:" + node.id] == true) == (a.getString(5) == "true")) { "$tag: row $k expanded ${inspection.metrics["expanded:" + node.id]} vs ${a.getString(5)}" }
            }
        }
        val labels = find(nodes) { it.tag == "md-table-sort-label" }
        val head = w.optJSONArray("head") ?: JSONArray()
        val webLabels = (0 until head.length()).map { head.getJSONArray(it) }.filter { !it.isNull(1) }.map { it.getJSONArray(1) }
        webLabels.forEachIndexed { k, a -> labels.getOrNull(k)?.let { l -> (inspection.metrics["sort:" + l.id] as? List<*>)?.let { m ->
            val active = a.getBoolean(0); val order = if (active) a.getString(1) else "none"
            check(m[0] == active && (!active || m[1] == order)) { "$tag: sort label ${l.props["column"]} $m vs $active $order" }
            a.optString(3).toDoubleOrNull()?.let { op -> check(abs((m[2] as Double) - op) <= 0.05) { "$tag: sort icon opacity ${m[2]} vs $op" } } } } }
        for (i in 0 until head.length()) { val c = head.getJSONArray(i); if (c.length() > 2 && !c.isNull(2)) { val cb = c.getJSONArray(2)
            val web = (0 until cb.length()).map { cb.optBoolean(it) }
            check(inspection.metrics["table.head"] == web) { "$tag: select-all checkbox ${inspection.metrics["table.head"]} vs $web" } } }
        w.optJSONArray("toolbar")?.let { t -> check((inspection.metrics["toolbar.numSelected"] as? Number)?.toInt() == t.optInt(0)) { "$tag: toolbar numSelected ${inspection.metrics["toolbar.numSelected"]} vs ${t.opt(0)}" } }
        w.optJSONArray("pagination")?.let { pg ->
            check(inspection.metrics["pagination.page"] == pg.optInt(0) && inspection.metrics["pagination.rowsPerPage"] == pg.optInt(1) && inspection.metrics["pagination.display"] == pg.optString(2)) {
                "$tag: pagination ${inspection.metrics["pagination.page"]}/${inspection.metrics["pagination.rowsPerPage"]} '${inspection.metrics["pagination.display"]}' vs ${pg.opt(0)}/${pg.opt(1)} '${pg.optString(2)}'" }
            if (!pg.isNull(4)) check(inspection.metrics["pagination.prevDisabled"] == pg.getBoolean(4)) { "$tag: prev disabled ${inspection.metrics["pagination.prevDisabled"]} vs ${pg.get(4)}" }
            if (!pg.isNull(5)) check(inspection.metrics["pagination.nextDisabled"] == pg.getBoolean(5)) { "$tag: next disabled ${inspection.metrics["pagination.nextDisabled"]} vs ${pg.get(5)}" }
        }
        w.optJSONArray("scroll")?.objects()?.forEach { s ->
            val path = s.getString("path"); val left = abs(s.getDouble("left")); val top = s.getDouble("top")
            val nat: Pair<Double, Double>? = if (path.contains("body-scroll")) (dbl(inspection.metrics["frozen.scrollLeft"]) ?: 0.0) to (dbl(inspection.metrics["frozen.scrollTop"]) ?: 0.0)
                else if (path.contains("scroll")) (inspection.metrics["container.scroll"] as? List<*>)?.let { dbl(it[0])!! to dbl(it[1])!! } else null
            nat?.let { check(abs(it.first - left) <= 2 && abs(it.second - top) <= 2) { "$tag: scroll $path $it vs ($left, $top)" } }
        }
        check((inspection.metrics["table.busy"] == true) == (w.optString("busy") == "true")) { "$tag: aria-busy ${inspection.metrics["table.busy"]} vs ${w.opt("busy")}" }
    }
    private fun compareMotion(tag: String, ph: JSONObject, actEnd: Double) {
        val ss = ph.getJSONArray("samples").objects().filter { it.getDouble("t") >= actEnd - 1 }
        if (ss.size < 3) return
        fun tau(s: JSONObject) = s.getDouble("t") - actEnd
        val rows = bodyRows()
        val toggles = find(nodes) { it.tag == "md-table-expand-toggle" }
        rows.forEachIndexed { k, r ->
            val zone = ss.mapNotNull { s -> s.getJSONArray("rows").optJSONArray(k)?.let { a -> if (a.isNull(11)) null else tau(s) to a.getDouble(11) } }
            zone.maxOfOrNull { it.second }?.takeIf { it > 20 }?.let { full -> motionCheck(tag, zone.map { it.first to it.second / full }, "expand:" + r.id, 0.12) }
            toggles.firstOrNull { t -> r.children.any { c -> c.children.any { it.id == t.id } } }?.let { t ->
                motionCheck(tag, ss.mapNotNull { s -> s.getJSONArray("rows").optJSONArray(k)?.let { a -> if (a.length() > 12 && !a.isNull(12)) tau(s) to abs(angle(a.getString(12))) / 90 else null } }, "caret:" + t.id, 0.12) }
            if (!ph.getString("label").contains("hover")) motionCheck(tag, ss.mapNotNull { s -> s.getJSONArray("rows").optJSONArray(k)?.let { a -> tau(s) to alpha(a.getString(6)) } }, "selected:" + r.id, 0.15)
        }
        // FLIP: phases whose rows reordered or appeared — each row's visual position in rows against the settled first row.
        fun names(s: JSONObject) = s.getJSONArray("rows").let { a -> (0 until a.length()).map { a.getJSONArray(it).optString(0) } }
        val s1 = ss.last()
        if (names(ss.first()) != names(s1) && s1.getJSONArray("rows").length() > 0) {
            val base = s1.getJSONArray("rows").getJSONArray(0).getDouble(2)
            // The settled top row's y (whichever authored row is first after the change).
            val nativeBase = rows.mapNotNull { samples.lastOrNull()?.second?.get("y:" + it.id) }.minOrNull()
            if (nativeBase != null) rows.forEach { r -> val name = rowName(r)
                val entries = ss.mapNotNull { s -> s.getJSONArray("rows").let { a -> (0 until a.length()).map { a.getJSONArray(it) }.firstOrNull { it.optString(0) == name }?.let { s to it } } }
                // Chrome clears a row's FLIP transform early when the transition is cancelled (transitioncancel → clearInline).
                var lastTY = 0.0; var cut: Double? = null
                entries.forEach { (s, a) -> val m = a.optString(9); if (cut == null && abs(lastTY) > 8 && m == "none") cut = tau(s); lastTY = translateY(m) }
                if (cut != null) gaps += "$tag: Chrome cancels $name's FLIP glide at ${cut!!.toInt()} ms (transitioncancel); native completes it (captureFlip contract)"
                else motionCheck(tag, entries.map { (s, a) -> tau(s) to (a.getDouble(2) - base) / 53 }, "y:" + r.id, 0.2) { (it - nativeBase) / 53 } }
        }
        val labels = find(nodes) { it.tag == "md-table-sort-label" }
        labels.forEachIndexed { k, l ->
            fun head(s: JSONObject) = s.getJSONArray("head").let { h -> (0 until h.length()).map { h.getJSONArray(it) }.filter { !it.isNull(1) }.getOrNull(k)?.getJSONArray(1) }
            motionCheck(tag, ss.mapNotNull { s -> head(s)?.let { tau(s) to abs(angle(it.getString(2))) / 180 } }, "sort-rot:" + l.id, 0.12)
            motionCheck(tag, ss.mapNotNull { s -> head(s)?.optString(3)?.toDoubleOrNull()?.let { tau(s) to it } }, "sort-op:" + l.id, 0.1)
        }
    }

    // MARK: Run
    @Test fun tableMatchesChromeInteraction() {
        val fixture = JSONObject(assets.open("table/table-web-states.json").bufferedReader().use { it.readText() })
        data = fixture.getJSONArray("data").let { a -> (0 until a.length()).map { i -> a.getJSONArray(i).let { r -> (0 until r.length()).map { r.get(it) } } } }
        val only = InstrumentationRegistry.getArguments().getString("tableOnly")
        content()
        // Loading phases capture the screen (the indicator draws in its own layer): keep the system bars off the content.
        compose.runOnUiThread { compose.activity.window.insetsController?.let { it.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            it.hide(android.view.WindowInsets.Type.systemBars()) } }
        Thread.sleep(400)
        for (r in fixture.getJSONArray("runs").objects()) {
            val name = r.getString("name"); val set = r.getString("set"); val label0 = (if (set == "full") "" else "reduced/") + name
            if (only != null && !"$set/$name".contains(only)) continue
            compose.mainClock.autoAdvance = true; loopy = false
            compose.onRoot().performMouseInput { moveTo(Offset(1190f, 890f)) }
            reduced = set == "reduced"; rtl = r.getString("dir") == "rtl"; dark = r.getString("theme") == "dark"
            lostFocus = null; runName = name
            AWCTableTrace.activations = name.startsWith("tb-sort") || name.startsWith("tb-expand") || name.startsWith("tb-hover-select")
            pageBg = r.getJSONArray("phases").objects().firstOrNull()?.optString("shot")?.takeIf { it.isNotEmpty() }?.let { shot ->
                runCatching { assets.open("table/$shot").use { BitmapFactory.decodeStream(it) }?.let { Color(it.getPixel(0, 0)) } }.getOrNull() }
            val ns = r.getJSONArray("nodes").objects().map(::parse)
            tableId = find(ns) { it.tag == "md-table" }.firstOrNull()?.id ?: "n0"; paginationId = find(ns) { it.tag == "md-table-pagination" }.firstOrNull()?.id ?: "-"
            sortable = r.optString("prepare") == "sortable"; paged = r.optString("prepare") == "paged"; page = 0; rpp = 5
            inspection.metrics.clear(); motion.values.clear()
            nodes = ns; epoch++
            // The page inserts the rows after load (keep-height floors the table at that first layout).
            if (paged) { compose.waitForIdle(); compose.mainClock.advanceTimeBy(100); compose.waitForIdle(); render() }
            compose.waitForIdle(); compose.mainClock.advanceTimeBy(400); compose.waitForIdle()
            blur()
            events.clear()
            val phases = r.getJSONArray("phases").objects(); val webEvents = r.getJSONArray("events").objects()
            var runOk = true
            for ((i, ph) in phases.withIndex()) {
                val label = ph.getString("label"); val tag = "$label0 [$i] $label"; val before = failures.size
                val start = ph.getDouble("t"); val actEnd = ph.getDouble("actEnd")
                val next = if (i + 1 < phases.size) phases[i + 1].getDouble("t") else ph.getJSONArray("samples").let { s -> s.getJSONObject(s.length() - 1).getDouble("t") + 30 }
                val eventsBefore = events.size
                compose.mainClock.autoAdvance = false
                samples.clear(); clock = 0
                val motionBefore = HashMap(motion.values)
                action(name, label)()
                frames(((next - actEnd) / 16).toInt().coerceAtLeast(8))
                compose.mainClock.autoAdvance = true
                val loading = find(nodes) { it.tag == "md-table" && it.props["loading"] == true && it.props["loadingMode"] != "skeleton" }.isNotEmpty()
                loopy = loading
                if (!loading) compose.waitForIdle()
                // Events.
                val webKeys = webEvents.filter { it.getDouble("t") >= start - 0.5 && it.getDouble("t") < next - 0.5 && it.getString("name") != "mdScroll" }.map { keyOf(it.getString("name"), it.opt("detail")) }
                val natKeys = events.drop(eventsBefore).filter { it.first in eventNames }.map { keyOf(it.first, it.second) }
                check(webKeys == natKeys) { "$tag: events $natKeys vs $webKeys" }
                val webScroll = webEvents.lastOrNull { it.getString("name") == "mdScroll" && it.getDouble("t") >= start - 0.5 && it.getDouble("t") < next - 0.5 }
                val natScroll = events.drop(eventsBefore).lastOrNull { it.first == "mdScroll" }
                if (webScroll != null) { val wd = webScroll.getJSONObject("detail"); val nd = natScroll?.second?.let(::map)
                    check(nd != null && abs(abs(dbl(nd["scrollLeft"]) ?: 0.0) - abs(wd.getDouble("scrollLeft"))) <= 2 && abs((dbl(nd["scrollTop"]) ?: 0.0) - wd.getDouble("scrollTop")) <= 2) { "$tag: last mdScroll $nd vs $wd" } }
                else check(natScroll == null) { "$tag: unexpected mdScroll ${natScroll?.second}" }
                val samplesWeb = ph.getJSONArray("samples"); compareState(tag, samplesWeb.getJSONObject(samplesWeb.length() - 1))
                val wf = webFocusKind(ph.optJSONArray("focus")); val nf = focusKind()
                val finalWeb = samplesWeb.getJSONObject(samplesWeb.length() - 1)
                val pg = finalWeb.optJSONArray("pagination")
                val disabledIndex = mapOf("pagination:first-button" to 3, "pagination:prev-button" to 4, "pagination:next-button" to 5, "pagination:last-button" to 6)[wf]
                if (disabledIndex != null && pg != null && pg.length() > disabledIndex && pg.optBoolean(disabledIndex) && nf == "none") {
                    // Chrome keeps focus on a button disabled while focused; Compose (like AppKit) cannot keep a disabled control focused.
                    gaps += "$tag: focus stays on the disabled $wf in Chrome; native moves it away (platform rule)"; lostFocus = wf
                } else if (lostFocus != null && wf == lostFocus && nf == "none") {
                    // Consequence of the rule above: Chrome's focus is still on that (re-enabled) button.
                    gaps += "$tag: focus still on $wf in Chrome since it was disabled while focused (platform rule)"
                } else check(wf == nf) { "$tag: focus $nf vs $wf" }
                if (AWCTableTrace.activations) log("DIAG phase $tag: focus $nf (web $wf) events ${events.drop(eventsBefore).map { it.first }}")
                val first = samples.firstOrNull { (_, m) -> m.any { (k, v) -> motionBefore[k]?.let { abs(it - v) > 1e-6 } ?: false } }?.first
                shift = if (first != null && first > 17) first - 17 else 0L
                if (shift > 0) gaps += "$tag: native first frame ${first} ms after the input (curves aligned on it)"
                compareMotion(tag, ph, actEnd)
                // Phase shot.
                val clip = ph.getJSONObject("clip"); val cx = clip.getDouble("x"); val cy = clip.getDouble("y")
                val webBmp = assets.open("table/" + ph.getString("shot")).use { BitmapFactory.decodeStream(it) }
                val image = if (loading) screenImage() else compose.onRoot().captureToImage().asAndroidBitmap()
                val masks = masks()
                var sum = 0.0; var over = 0; var n = 0; var uncovered = 0
                fun flat(px: (Int, Int) -> Int, x: Int, y: Int): Boolean { for (ch in 0..2) { var lo = 255; var hi = 0
                    for (dy in -1..1) for (dx in -1..1) { val v = (px(x + dx, y + dy) shr (16 - ch * 8)) and 0xFF; lo = minOf(lo, v); hi = maxOf(hi, v) }; if (hi - lo > 6) return false }; return true }
                val webPx = { x: Int, y: Int -> webBmp.getPixel(x, y) }; val natPx = { x: Int, y: Int -> image.getPixel((cx + x).toInt(), (cy + y).toInt()) }
                for (y in 1 until webBmp.height - 1) for (x in 1 until webBmp.width - 1) {
                    val px = cx + x + 0.5; val py = cy + y + 0.5
                    if (masks.any { px >= it[0] && px <= it[0] + it[2] && py >= it[1] && py <= it[1] + it[3] }) continue
                    if ((cx + x + 1).toInt() >= image.width || (cy + y + 1).toInt() >= image.height) { uncovered++; continue }
                    if (!flat(webPx, x, y) || !flat(natPx, x, y)) continue
                    val a = webPx(x, y); val b = natPx(x, y)
                    val d = (0..2).maxOf { ch -> abs(((a shr (16 - ch * 8)) and 0xFF) - ((b shr (16 - ch * 8)) and 0xFF)) }
                    sum += d; n++; if (d > 6) over++
                }
                val mean = if (n == 0) 0.0 else sum / n; val ratio = if (n == 0) 0.0 else over.toDouble() / n
                check(uncovered == 0) { "$tag: $uncovered clip pixels outside the captured root" }
                check(mean <= 1.0 && ratio <= 0.005) { "$tag: phase shot mean ${"%.3f".format(mean)} >6 ${"%.2f".format(ratio * 100)}% ($n px)" }
                if (failures.size != before) { runOk = false; runCatching {
                    val dir = java.io.File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir("accordion"), "table-states").apply { mkdirs() }
                    java.io.FileOutputStream(java.io.File(dir, "$set-$name-${"%02d".format(i)}-$label.png")).use { android.graphics.Bitmap.createBitmap(image, cx.toInt(), cy.toInt(), minOf(webBmp.width, image.width - cx.toInt()), minOf(webBmp.height, image.height - cy.toInt())).compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) } } }
                report.put(JSONObject().put("run", label0).put("phase", i).put("label", label).put("mean", mean).put("over", ratio).put("compared", n).put("ok", failures.size == before))
            }
            android.util.Log.w("AWCTable", "RUN $label0: ${if (runOk) "ok" else "FAIL"}")
        }
        val dir = InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir("accordion")!!
        java.io.File(dir, "table-states.json").writeText(JSONObject().put("checks", checks).put("failures", failures.size).put("failureList", JSONArray(failures.take(3000))).put("gaps", JSONArray(gaps)).put("report", report).toString(1))
        assertTrue("NativeTableStatesTest: ${checks - failures.size}/$checks checks\n" + failures.take(80).joinToString("\n"), failures.isEmpty())
    }
    private fun masks(): List<List<Double>> {
        val out = mutableListOf<List<Double>>()
        semNodes(SemanticsMatcher("nested") { n -> val role = n.config.getOrNull(SemanticsProperties.Role); val d = n.config.getOrNull(SemanticsProperties.ContentDescription)?.joinToString() ?: ""
            role == androidx.compose.ui.semantics.Role.Checkbox || d.startsWith("Select ") || d.startsWith("Details for") || d.endsWith(" page") || d.startsWith("Rows per page") || d == "Loading" || d == "Filter list" || d == "Delete selected" })
            .forEach { val b = it.boundsInRoot
                // The nested md-select draws its focus indicator outside its box (owned by md-select's suite).
                val o = if ((it.config.getOrNull(SemanticsProperties.ContentDescription)?.joinToString() ?: "").startsWith("Rows per page")) 6.0 else 2.0
                out += listOf(b.left - o, b.top - o, b.width + 2 * o, b.height + 2 * o) }
        // Chrome places the right-to-left custom thumb from the track's inline start translated by (1 − p)·travel (source defect);
        // the native thumb follows the source's documented intent (starts at the right end, travels left): its track is masked.
        if (runName == "tb-frozen-scroll-rtl") (inspection.metrics["hthumb.y"] as? Double)?.let { y ->
            gaps += "tb-frozen-scroll-rtl: right-to-left h-thumb track masked (Chrome's translateX on the inline-start thumb is a source defect; native follows the documented intent)"
            out += listOf(24.0, y - 8.0, 760.0, 16.0) }
        // The rows-per-page select from the pagination's own inspection box (its semantics bounds move while it is focused).
        (inspection.metrics["pagination.rpp"] as? List<*>)?.mapNotNull { (it as? Number)?.toDouble() }?.takeIf { it.size == 4 }?.let { b -> out += listOf(b[0] - 6, b[1] - 6, b[2] + 12, b[3] + 12) }
        find(nodes) { it.tag == "md-table" && it.props["loading"] == true }.firstOrNull()?.let { t -> inspection.rows.values.minByOrNull { it.y }?.let { r -> out += listOf(r.x, r.y + 57, 760.0, 600.0) } }
        return out
    }
    /** While the loading overlay's md-progress-indicator steps its own frame loop, compose never idles, so the semantics
     *  tree is read straight from the root (no idle wait) instead of through the test finders. */
    private var loopy = false
    private fun semNodes(m: SemanticsMatcher): List<androidx.compose.ui.semantics.SemanticsNode> {
        if (!loopy) return compose.onAllNodes(m, useUnmergedTree = true).fetchSemanticsNodes()
        val out = mutableListOf<androidx.compose.ui.semantics.SemanticsNode>()
        compose.runOnUiThread {
            fun views(v: android.view.View): List<android.view.View> = listOf(v) + ((v as? android.view.ViewGroup)?.let { g -> (0 until g.childCount).flatMap { views(g.getChildAt(it)) } } ?: emptyList())
            fun walk(n: androidx.compose.ui.semantics.SemanticsNode) { if (m.matches(n)) out += n; n.children.forEach { walk(it) } }
            views(compose.activity.window.decorView).filterIsInstance<androidx.compose.ui.platform.ViewRootForTest>().forEach { walk(it.semanticsOwner.unmergedRootSemanticsNode) }
        }
        return out
    }
    private fun screenImage(): android.graphics.Bitmap {
        val root = compose.activity.findViewById<android.view.View>(android.R.id.content)
        val loc = IntArray(2); compose.runOnUiThread { root.getLocationOnScreen(loc) }
        val shot = InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot().copy(android.graphics.Bitmap.Config.ARGB_8888, false)
        return android.graphics.Bitmap.createBitmap(shot, loc[0], loc[1], minOf(root.width, shot.width - loc[0]), minOf(root.height, shot.height - loc[1]))
    }
}
