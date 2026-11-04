@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.ScrollableState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.*
import androidx.compose.ui.zIndex
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.drop
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.key.*
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// md-table family (md-table.tsx and its ten sub-components) on Compose. The host composes rows and cells itself
// (content(slot) lambdas), so the table owns a shared model: rows register, cells report their intrinsic widths,
// the table solves the shared column tracks (AWCTableColumnSolver) and every row lays its cells on them.

// MARK: Public test / host hooks

/** Geometry the table publishes for tests and the Laboratory (dp, root coordinates). */
class AWCTableInspection {
    val columns = mutableStateListOf<Double>()
    var gridWidth by mutableStateOf(0.0)
    val rows = mutableStateMapOf<String, AWCInspectionBounds>()
    val cells = mutableStateMapOf<String, AWCInspectionBounds>()
    val contents = mutableStateMapOf<String, AWCInspectionBounds>()
    var selection by mutableStateOf<Map<String, Any?>>(emptyMap())
    var sortBy by mutableStateOf(""); var sortOrder by mutableStateOf("asc")
    /** Live state the interaction tests read: frozen.scrollLeft / scrollTop, focus rings, thumb press. */
    val metrics = mutableStateMapOf<String, Any?>()
}
internal val LocalAWCTableInspection = staticCompositionLocalOf<AWCTableInspection?> { null }
@Composable fun AWCTableInspectionScope(inspection: AWCTableInspection, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTableInspection provides inspection, content = content)

/** `forced-colors: active` equivalent (Canvas black, CanvasText white, Highlight rgba(0,230,255,.8)). */
internal val LocalAWCTableForcedColors = staticCompositionLocalOf { false }
@Composable fun AWCTableForcedColorsScope(on: Boolean, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTableForcedColors provides on, content = content)
internal val LocalAWCTableReducedMotion = staticCompositionLocalOf<Boolean?> { null }
@Composable fun AWCTableReducedMotionScope(reduced: Boolean?, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTableReducedMotion provides reduced, content = content)

/** Programmatic scrolling of the table scrollport (logical offsets, like scrollLeft / scrollTop) in dp. */
class AWCTableScrollController {
    internal var horizontal: ScrollState? = null
    internal var vertical: ScrollState? = null
    internal var density = 1f
    /** Immediate scroll (no animation), on the UI thread. */
    fun snap(x: Double?, y: Double?) {
        x?.let { v -> horizontal?.let { it.dispatchRawDelta((v * density).toFloat() - it.value) } }
        y?.let { v -> vertical?.let { it.dispatchRawDelta((v * density).toFloat() - it.value) } }
    }
    suspend fun scroll(x: Double?, y: Double?) {
        x?.let { horizontal?.scrollTo((it * density).roundToInt()) }
        y?.let { vertical?.scrollTo((it * density).roundToInt()) }
    }
}
internal val LocalAWCTableScrollController = staticCompositionLocalOf<AWCTableScrollController?> { null }
@Composable fun AWCTableScrollControllerScope(controller: AWCTableScrollController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTableScrollController provides controller, content = content)

/** Native counterpart of md-table's methods (attach by node id with [AWCTableControllerScope]). */
class AWCTableController {
    internal var owner: NativeTableOwner? = null
    val isConnected get() = owner != null
    /** `getSelection()`: count, total, values, all, indeterminate. */
    fun getSelection(): Map<String, Any?> = owner?.state()?.detail ?: emptyMap()
    fun selectAll() { owner?.selectAll(true) }
    fun deselectAll() { owner?.selectAll(false) }
    fun toggleSelectAll() { owner?.let { it.selectAll(!it.state().all) } }
    fun setSort(column: String, order: String) { owner?.setSort(column, order) }
    /** Pins the ORIGINAL column to start / end (`none` unpins, the same side toggles off); null when the table cannot pin. */
    fun pinColumn(column: Int, side: String): String? = owner?.pinColumn(column, side)
    fun setColumnVisibility(column: Int, visible: Boolean): Boolean = owner?.setColumnVisibility(column, visible) ?: true
    fun animateNextChange() { owner?.let { it.armedUntil = android.os.SystemClock.uptimeMillis() + 600 } }
    /** md-table-row `toggle()` for the row with node id [row]. */
    fun toggleRow(row: String) { owner?.let { o -> o.rows.firstOrNull { it.id == row }?.let { o.toggle(it) } } }
}
/** Native counterpart of md-table-pagination's methods. */
class AWCTablePaginationController {
    internal var go: (Int) -> Unit = {}; internal var rows: (Int) -> Unit = {}; internal var connected = false
    val isConnected get() = connected
    fun goToPage(page: Int) = go(page)
    fun setRowsPerPage(rowsPerPage: Int) = rows(rowsPerPage)
}
internal val LocalAWCTableControllers = staticCompositionLocalOf<Map<String, AWCTableController>> { emptyMap() }
internal val LocalAWCTablePaginationControllers = staticCompositionLocalOf<Map<String, AWCTablePaginationController>> { emptyMap() }
@Composable fun AWCTableControllerScope(tables: Map<String, AWCTableController>, paginations: Map<String, AWCTablePaginationController> = emptyMap(), content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCTableControllers provides tables, LocalAWCTablePaginationControllers provides paginations, content = content)

/** Test / Laboratory motion probe: the latest drawn value of each table motion (`selected:<row>`, `hover:<row>`, `expand:<row>`,
 *  `caret:<toggle>`, `sort-rot:<label>`, `sort-op:<label>`, `order:<row>`, `toolbar:<toolbar>`, `thumb:<table>`). */
class AWCTableMotionRecorder { val values = java.util.concurrent.ConcurrentHashMap<String, Double>(); internal fun record(k: String, v: Double) { values[k] = v } }
internal val LocalAWCTableMotion = staticCompositionLocalOf<AWCTableMotionRecorder?> { null }
@Composable fun AWCTableMotionScope(recorder: AWCTableMotionRecorder?, content: @Composable () -> Unit) = CompositionLocalProvider(LocalAWCTableMotion provides recorder, content = content)

/** Diagnostics: counts compositions / measures / model writes while [on] (used by the paint test when compose never idles). */
object AWCTableTrace {
    @Volatile @JvmField var on = false
    /** Logs rows whose cells are taller than the row minimum (intrinsic heights per cell). */
    @Volatile @JvmField var diagnostics = false
    /** Logs a stack trace whenever a sort label / expand toggle activates (tests chasing an unexpected activation). */
    @Volatile @JvmField var activations = false
    val hits = java.util.concurrent.ConcurrentHashMap<String, Int>()
    fun hit(k: String) { if (on) hits.merge(k, 1, Int::plus) }
}

// MARK: Palette

internal data class NativeTablePalette(val tokens: Map<String, String>, val forced: Boolean) {
    fun hex(role: String): String {
        if (forced) forcedRoles[role]?.let { return it }
        return tokens["--md-sys-color-$role"] ?: fallbacks[role] ?: "#000000"
    }
    fun color(role: String): Color = tableColor(hex(role))
    companion object {
        val fallbacks = mapOf("on-surface" to "#1C1B1F", "on-surface-variant" to "#49454F", "surface" to "#FEF7FF", "surface-container" to "#F3EDF7",
            "surface-container-low" to "#F7F2FA", "surface-container-high" to "#ECE6F0", "outline" to "#79747E", "outline-variant" to "#CAC4D0",
            "primary" to "#6750A4", "on-primary" to "#FFFFFF", "primary-container" to "#EADDFF", "on-primary-container" to "#21005D", "secondary" to "#625B71",
            "secondary-container" to "#E8DEF8", "on-secondary-container" to "#1E192B", "tertiary-container" to "#FFD8E4", "on-tertiary-container" to "#31111D")
        val forcedRoles = mapOf("on-surface" to "#FFFFFF", "on-surface-variant" to "#FFFFFF", "on-secondary-container" to "#FFFFFF", "on-primary-container" to "#FFFFFF",
            "on-tertiary-container" to "#FFFFFF", "outline" to "#FFFFFF", "outline-variant" to "#FFFFFF", "surface" to "#000000", "surface-container" to "#000000",
            "surface-container-low" to "#000000", "surface-container-high" to "#000000", "secondary-container" to "#000000", "primary-container" to "#000000",
            "tertiary-container" to "#000000", "primary" to "#00E6FFCC", "on-primary" to "#000000", "secondary" to "#FFFFFF")
    }
}
/** CSS colour (#rgb[a], #rrggbb[aa], rgb()/rgba()) → Color; `color-mix(in srgb, a p, b)` with premultiplied interpolation. */
internal fun tableColor(css: String): Color {
    val s = css.trim()
    if (s.startsWith("#") && (s.length == 9 || s.length == 7 || s.length == 4 || s.length == 5)) {
        var h = s.drop(1); if (h.length <= 4) h = h.map { "$it$it" }.joinToString("")
        val v = h.toLong(16); val n = if (h.length == 6) (v shl 8) or 0xFF else v
        return Color(((n shr 24) and 0xFF) / 255f, ((n shr 16) and 0xFF) / 255f, ((n shr 8) and 0xFF) / 255f, (n and 0xFF) / 255f)
    }
    if (s == "transparent") return Color.Transparent
    return awcColor(s, Color.Black)
}
internal fun tableMix(a: String, p: Double, b: String?): Color {
    val x = tableColor(a); val y = b?.let { tableColor(it) } ?: Color.Transparent
    val q = 1 - p; val alpha = x.alpha * p + y.alpha * q
    if (alpha <= 0) return Color.Transparent
    return Color(((x.red * x.alpha * p + y.red * y.alpha * q) / alpha).toFloat(), ((x.green * x.alpha * p + y.green * y.alpha * q) / alpha).toFloat(),
        ((x.blue * x.alpha * p + y.blue * y.alpha * q) / alpha).toFloat(), alpha.toFloat())
}
internal fun Color.hex(): String = "#%02X%02X%02X%02X".format((red * 255).roundToInt(), (green * 255).roundToInt(), (blue * 255).roundToInt(), (alpha * 255).roundToInt())

// MARK: Model

internal enum class NativeTableGroup { HEAD, BODY, FOOT }
/** A node's full box in root dp (like getBoundingClientRect: parts scrolled or clipped out of view still count). */
internal fun LayoutCoordinates.tableBox(density: Density): AWCInspectionBounds {
    val o = positionInRoot(); val d = density.density
    return AWCInspectionBounds((o.x / d).toDouble(), (o.y / d).toDouble(), (size.width / d).toDouble(), (size.height / d).toDouble())
}
/** Parent data of an md-table-cell (attached by AWCComponent so its row's layout can read span / pin / checkbox). */
@Stable internal class NativeTableCellData {
    var span by mutableIntStateOf(1); var sticky by mutableStateOf<String?>(null); var checkbox by mutableStateOf(false); var head by mutableStateOf(false)
    /** Set by a slotted md-table-sort-label (frozen header floors measure its border box: +8 px). */
    var sortLabel by mutableStateOf(false)
    /** ORIGINAL column index (position in its row), set by the row layout: pinColumn / setColumnVisibility address it. */
    var column by mutableIntStateOf(-1)
    fun update(p: Props) { span = (p.int("colSpan", p.int("colspan", 1))).coerceIn(1, 1000); sticky = p.str("sticky").takeIf { it == "start" || it == "end" }
        checkbox = p.str("padding") == "checkbox"; head = p.bool("head") }
    companion object { fun of(p: Props) = NativeTableCellData().also { it.update(p) } }
}
internal val LocalNativeTableCellData = staticCompositionLocalOf<NativeTableCellData?> { null }
@Stable internal class NativeTableRow(val key: Any) {
    var props by mutableStateOf<Props>(emptyMap())
    var group by mutableStateOf(NativeTableGroup.BODY)
    /** The row's own `--md-table-*` declarations (they shadow md-table-row's :host rules, e.g. --md-table-cell-sticky-bg). */
    var own = AWCTableVars()
    /** The row's box clipped by its scrollports, in root px (hover is re-hit-tested against it after a scroll). */
    var visible: androidx.compose.ui.geometry.Rect? = null
    var y = Float.NaN
    var groupIndex by mutableIntStateOf(0)
    var index by mutableIntStateOf(0)
    /** Sum of the row's cell spans (reported by its layout): the default track count of a table without a template. */
    var cellCount by mutableIntStateOf(0)
    /** Cell spans and authored sticky sides (reported by the row layout; the pin base validates against them). */
    var cellSpans: List<Int> = emptyList(); var cellSticky: List<String?> = emptyList()
    /** captureFlip: the row's transform (px) and entrant fade; an order change leaves its pending move here for the play. */
    val flip = Animatable(0f); val fade = Animatable(1f)
    var pendingDy: Float? = null; var pendingEnter = false
    val id get() = props.str("id")
    val value get() = props.str("value")
    val identity get() = value.ifEmpty { groupIndex.toString() }
}
@Stable internal class NativeTableOwner {
    var props by mutableStateOf<Props>(emptyMap())
    var emit: EventSink = { _, _ -> }
    var metrics by mutableStateOf(AWCTableMetrics.resolve(null, 0.0))
    var tracks by mutableStateOf<List<AWCTableTrack>>(emptyList())
    var minWidth by mutableStateOf<Double?>(null)
    var available by mutableStateOf(0.0)
    var palette by mutableStateOf(NativeTablePalette(emptyMap(), false))
    var hooks by mutableStateOf(AWCTableHooks())
    /** The family's custom properties at the table (inherited under the table's own `style`). */
    var vars = AWCTableVars()
    /** Last pointer position over the table (root px); null once it left. */
    var pointer: Offset? = null
    /** keep-height: the height (px) the table — frozen: its body — is floored at two frames after the first layout. */
    var heightFloor by mutableStateOf<Int?>(null)
    var lastHeight = 0
    var surface by mutableStateOf("#FEF7FF")
    var reduced by mutableStateOf(false)
    var vibrant by mutableStateOf(false)
    var inContainer by mutableStateOf(false); var hasBottomBar by mutableStateOf(false)
    var floorRowKey: Any? = null
    // Rows in document order (rendered top to bottom).
    private val rowList = mutableListOf<NativeTableRow>()
    var rows by mutableStateOf<List<NativeTableRow>>(emptyList())
    fun register(r: NativeTableRow) { if (r !in rowList) { rowList += r; resort() } }
    fun unregister(r: NativeTableRow) { rowList -= r; contributions.remove(r.key); resort(); version++ }
    fun place(r: NativeTableRow, y: Float) { if (r.y != y) { AWCTableTrace.hit("owner.place.moved"); r.y = y; resort() } }
    private fun resort() {
        val sorted = rowList.sortedWith(compareBy({ it.group.ordinal }, { if (it.y.isNaN()) Float.MAX_VALUE else it.y }))
        val counters = IntArray(3)
        sorted.forEachIndexed { i, r -> r.index = i; r.groupIndex = counters[r.group.ordinal]++ }
        if (sorted != rows) { AWCTableTrace.hit("owner.rows.changed"); rows = sorted }
    }
    // Column contributions reported by row layouts (dp).
    private val contributions = HashMap<Any, List<AWCTableContribution>>()
    private val floors = HashMap<Int, Double>()
    var version by mutableIntStateOf(0)
    fun report(key: Any, items: List<AWCTableContribution>, headFloors: Map<Int, Double>?) {
        var changed = false
        if (contributions[key] != items) { contributions[key] = items; changed = true }
        if (headFloors != null && headFloors != floors) { floors.clear(); floors.putAll(headFloors); changed = true }
        if (changed) { AWCTableTrace.hit("owner.report.changed"); Snapshot.withoutReadObservation { version++ } }
    }
    val widths: AWCTableColumnSolver.Result by derivedStateOf {
        version
        var t = tracks
        if (floors.isNotEmpty()) t = t.mapIndexed { i, tr -> floors[i]?.let { need -> floored(tr, need) } ?: tr }
        AWCTableColumnSolver.solve(t, contributions.values.flatten(), available, minWidth)
    }
    private fun floored(t: AWCTableTrack, need: Double): AWCTableTrack =
        if (t.max is AWCTableTrackMax.FitContent) t else when (val m = t.min) { is AWCTableTrackMin.Px -> t.copy(min = AWCTableTrackMin.Px(max(m.v, need))); else -> t.copy(min = AWCTableTrackMin.Px(need)) }
    /** Column pins / hidden columns once pinColumn or setColumnVisibility established the pin base. */
    var pinLayout by mutableStateOf<AWCTablePinLayout?>(null)
    /** FLIP bracket: a body-row order change before this uptime glides (sort / pagination / animateNextChange). */
    var armedUntil = 0L
    var lastOrder: List<Any> = emptyList()
    /** Bumped when rows moved / appeared under an armed bracket: the table plays the staggered FLIP next frame. */
    var flipRequest by mutableIntStateOf(0)
    var motion: AWCTableMotionRecorder? = null
    var announced by mutableStateOf<Int?>(null)
    // Interaction state (host property changes win, as on SwiftUI).
    val selected = mutableStateMapOf<Any, Boolean>()
    val expanded = mutableStateMapOf<Any, Boolean>()
    var sortBy by mutableStateOf<String?>(null); var sortOrder by mutableStateOf<String?>(null)
    var hoverRow by mutableStateOf<Any?>(null)
    var scrollMaxY by mutableStateOf(0)
    var scrollX by mutableStateOf(0); var scrollY by mutableStateOf(0); var viewportWidth by mutableStateOf(0); var viewportHeight by mutableStateOf(0)
    /** Host `selected` writes not handled yet (their row's watcher has not run): they still count with the previous value, so a
     *  batch of writes emits one row at a time like the source's per-property watchers (1/n, then 2/n). */
    val pendingSelected = HashMap<Any, Boolean>()
    fun isSelected(r: NativeTableRow) = pendingSelected[r.key] ?: selected[r.key] ?: r.props.bool("selected")
    fun isExpanded(r: NativeTableRow) = expanded[r.key] ?: r.props.bool("expanded")
    val selection get() = props.str("selection").takeIf { it == "single" || it == "multiple" } ?: "none"
    val effectiveSortBy get() = sortBy ?: props.str("sortBy")
    val effectiveSortOrder get() = sortOrder ?: props.str("sortOrder").takeIf { it == "asc" || it == "desc" } ?: "asc"
    fun state(): AWCTableSelectionState = AWCTableSelectionState.compute(rows.filter { it.group == NativeTableGroup.BODY }.map {
        AWCTableSelectableRow(it.key.toString(), it.value, isSelected(it), it.props.bool("disabled"), it.props.bool("selectable", true)) })
    /** A row's `selected` changed (checkbox, keyboard, host property): md-table handles the row's event during its dispatch —
     *  single mode first deselects the others (their events reach the page first), then mdSelectionChange — so the row's own
     *  mdRowSelectionChange arrives last. */
    fun setSelected(r: NativeTableRow, v: Boolean, alreadyApplied: Boolean = false) {
        if (!alreadyApplied && isSelected(r) == v) return
        selected[r.key] = v
        if (selection == "single" && v) rows.filter { it.group == NativeTableGroup.BODY && it !== r && isSelected(it) }.forEach {
            selected[it.key] = false; emit("mdRowSelectionChange", mapOf("selected" to false, "value" to it.identity, "row" to it.id)) }
        emit("mdSelectionChange", state().detail)
        emit("mdRowSelectionChange", mapOf("selected" to v, "value" to r.identity, "row" to r.id))
    }
    /** `selection` switched to single with several rows selected: the first stays. */
    fun trimSingle() {
        val sel = rows.filter { it.group == NativeTableGroup.BODY && isSelected(it) }
        if (sel.size < 2) return
        sel.drop(1).forEach { selected[it.key] = false; emit("mdRowSelectionChange", mapOf("selected" to false, "value" to it.identity, "row" to it.id)) }
        emit("mdSelectionChange", state().detail)
    }
    fun arm() { if (props.str("motion") != "none") armedUntil = android.os.SystemClock.uptimeMillis() + 600 }
    fun setSort(column: String, order: String) { sortBy = column; sortOrder = order; arm(); emit("mdSortChange", mapOf("column" to column, "order" to order)) }
    private fun pinBase(): AWCTablePinLayout? = pinLayout ?: AWCTablePinLayout.make(props.str("columnTemplate"), rows.map { Triple(it.group == NativeTableGroup.HEAD, it.cellSpans, it.cellSticky) })
    fun pinColumn(column: Int, side: String): String? {
        val base = pinBase() ?: return null
        val pins = base.pins.toMutableMap(); if (side == "none" || pins[column] == side) pins.remove(column) else pins[column] = side
        pinLayout = base.copy(pins = pins)
        val effective = pins[column]
        emit("mdPinChange", mapOf("column" to column, "side" to effective)); return effective
    }
    fun setColumnVisibility(column: Int, visible: Boolean): Boolean {
        val base = pinBase() ?: return true
        if (column < 0 || column >= base.base.size) return true
        if (!visible && base.hidden.size >= base.base.size - 1 && column !in base.hidden) return true
        val hidden = if (visible) base.hidden - column else base.hidden + column
        pinLayout = base.copy(hidden = hidden)
        val effective = column !in hidden
        emit("mdColumnVisibilityChange", mapOf("column" to column, "visible" to effective, "hidden" to hidden.sorted())); return effective
    }
    fun selectAll(v: Boolean) {
        if (v && selection != "multiple") return
        rows.filter { it.group == NativeTableGroup.BODY && (!v || (!it.props.bool("disabled") && it.props.bool("selectable", true))) && isSelected(it) != v }.forEach {
            selected[it.key] = v; emit("mdRowSelectionChange", mapOf("selected" to v, "value" to it.identity, "row" to it.id)) }
        emit("mdSelectionChange", state().detail)
    }
    fun requestSort(column: String, defaultOrder: String) {
        if (column.isEmpty()) return
        val (c, o) = AWCTableSort.next(effectiveSortBy, effectiveSortOrder, column, defaultOrder)
        sortBy = c; sortOrder = if (o == "none") "asc" else o
        arm()
        emit("mdSortChange", mapOf("column" to c, "order" to o))
    }
    fun toggle(r: NativeTableRow) {
        if (!r.props.bool("expandable")) return
        val v = !isExpanded(r); expanded[r.key] = v; emit("mdRowExpandedChange", mapOf("expanded" to v, "row" to r.id))
    }
    // Paint helpers.
    val forced get() = palette.forced
    val divider get() = if (forced) palette.hex("on-surface") else if (props.bool("noDividers")) "#00000000" else hooks.dividerColor ?: palette.hex("outline-variant")
    val headBg get() = (if (forced) null else hooks.headBackground) ?: palette.hex("surface-container")
    val headColor get() = (if (forced) null else hooks.headColor) ?: palette.hex("on-surface-variant")
    val footBg get() = (if (forced) null else hooks.footBackground) ?: palette.hex("surface-container-low")
    val selectedBg get() = if (forced) palette.hex("primary") else hooks.rowSelectedBackground ?: palette.hex("secondary-container")
    val selectedColor get() = if (forced) palette.hex("on-primary") else hooks.rowSelectedColor ?: palette.hex("on-secondary-container")
    val hoverColor get() = if (forced) "#000000" else hooks.rowHoverColor ?: palette.hex("on-surface")
    fun stripe(): Color = if (forced) Color(0f, 0f, 0f, 0.04f) else hooks.stripeColor?.let { tableColor(it) } ?: tableMix(palette.hex("on-surface"), 0.04, null)
    /** Chrome re-hit-tests hover after a scroll: the body row now under a resting pointer (within its scrollport) is hovered. */
    fun rehit() {
        val p = pointer ?: return
        val hit = rows.firstOrNull { it.group == NativeTableGroup.BODY && !it.props.bool("disabled") && it.visible?.contains(p) == true }
        if (hoverRow != hit?.key) hoverRow = hit?.key
    }
    /** The logical inline ranges (dp, from the scrollport's inline start) the pinned columns cover at the current scroll. */
    fun pinnedRanges(scrollDp: Double, viewportDp: Double): List<Pair<Double, Double>> {
        val ws = widths.widths; val head = rows.firstOrNull() ?: return emptyList()
        if (ws.isEmpty()) return emptyList()
        val pl = pinLayout; val n = head.cellSpans.size
        var c0 = 0
        val cols = if (pl != null) (0 until n).map { k -> pl.visible.indexOf(k) } else head.cellSpans.map { sp -> c0.also { c0 += sp } }
        fun side(k: Int) = if (pl != null) pl.pins[k] else head.cellSticky.getOrNull(k)
        fun x(c: Int): Double = ws.take(c).sum()
        fun w(k: Int): Double = ws.drop(cols[k]).take(if (pl != null) 1 else head.cellSpans[k]).sum()
        val staticMode = props.str("pinMode") == "static"
        val order = (0 until n).filter { cols[it] >= 0 }.sortedBy { cols[it] }
        val inset = DoubleArray(n)
        if (staticMode) { var cum = 0.0; order.forEach { k -> if (side(k) == "start") { inset[k] = cum; cum += w(k) } }
            cum = 0.0; order.asReversed().forEach { k -> if (side(k) == "end") { inset[k] = cum; cum += w(k) } } }
        return order.mapNotNull { k -> when (side(k)) {
            "start" -> { val cx = min(max(x(cols[k]), scrollDp + inset[k]), widths.width - w(k)); (cx - scrollDp) to (cx - scrollDp + w(k)) }
            "end" -> { val cx = max(min(x(cols[k]), scrollDp + viewportDp - inset[k] - w(k)), 0.0); (cx - scrollDp) to (cx - scrollDp + w(k)) }
            else -> null } }
    }
}
/** Stops bring-into-view requests (a focused header control): Chrome does not scroll the sticky head's focus into view. */
private class NativeTableNoFocusScrollNode : Modifier.Node(), androidx.compose.ui.relocation.BringIntoViewModifierNode {
    override suspend fun bringIntoView(childCoordinates: LayoutCoordinates, boundsProvider: () -> androidx.compose.ui.geometry.Rect?) {}
}
private object NativeTableNoFocusScroll : androidx.compose.ui.node.ModifierNodeElement<NativeTableNoFocusScrollNode>() {
    override fun create() = NativeTableNoFocusScrollNode()
    override fun update(node: NativeTableNoFocusScrollNode) {}
    override fun hashCode() = 7; override fun equals(other: Any?) = other === this
}
internal val LocalNativeTableOwner = staticCompositionLocalOf<NativeTableOwner?> { null }
internal val NativeTableArrows = setOf(Key.DirectionLeft, Key.DirectionRight, Key.DirectionUp, Key.DirectionDown)
internal val LocalNativeTableGroup = staticCompositionLocalOf { NativeTableGroup.BODY }
internal val LocalNativeTableRow = staticCompositionLocalOf<NativeTableRow?> { null }
/** Auto-wired selection checkbox: props overlay + mdChange handler for the md-checkbox inside a checkbox cell. */
internal class NativeTableCheckboxControl(val props: Props, val onChange: (Boolean) -> Unit)
internal val LocalNativeTableCheckbox = staticCompositionLocalOf<NativeTableCheckboxControl?> { null }
/** Container context: surface for pinned cells, vibrant overrides, bottom bar, frozen body max height, toolbar link. */
internal class NativeTableContainerContext(val surface: String, val vibrant: Boolean, val hasBottomBar: Boolean, val bodyMaxHeight: Double?,
                                           val selectionCount: MutableState<Int?>, val frozenChild: MutableState<Boolean>,
                                           /** md-table-container arms its table's FLIP when pagination events pass (mdMotionArm). */
                                           val armTable: Array<(() -> Unit)?> = arrayOfNulls(1))
internal val LocalNativeTableContainer = staticCompositionLocalOf<NativeTableContainerContext?> { null }

private val TableRoboto get() = androidx.compose.ui.text.font.FontFamily(androidx.compose.ui.text.font.Font(R.font.awc_roboto_regular, androidx.compose.ui.text.font.FontWeight.Normal),
    androidx.compose.ui.text.font.Font(R.font.awc_roboto_medium, androidx.compose.ui.text.font.FontWeight.Medium))
internal fun tableTextStyle(size: Double, line: Double, weight: Int, tracking: Double, color: Color, tabular: Boolean = false): TextStyle =
    listTextStyle(size, line, weight, tracking, color).let { if (tabular) it.copy(fontFeatureSettings = "tnum") else it }

// MARK: Dispatch

@Composable internal fun NativeTableFamily(tag: String, p: Props, onEvent: EventSink, content: Slot?, cell: NativeTableCellData?) {
    when (tag) {
        "md-table" -> NativeTable(p, onEvent, content)
        "md-table-container" -> NativeTableContainer(p, onEvent, content)
        "md-table-head", "md-table-body", "md-table-foot" -> if (LocalNativeTableOwner.current == null) StandaloneTable(tag, p, onEvent, content) else NativeTableRowGroup(tag, content)
        "md-table-row" -> NativeTableRowView(p, onEvent, content)
        "md-table-cell" -> CompositionLocalProvider(LocalNativeTableCellData provides cell) { NativeTableCellView(p, onEvent, content) }
        "md-table-sort-label" -> NativeTableSortLabel(p, onEvent, content)
        "md-table-expand-toggle" -> NativeTableExpandToggle(p, onEvent)
        "md-table-pagination" -> NativeTablePagination(p, onEvent, content)
        else -> NativeTableToolbar(p, onEvent, content)
    }
}
/** Renders a slot and reports whether it produced any size (the source's slot fallback / :empty checks). */
@Composable internal fun NativeTableSlot(modifier: Modifier = Modifier, onPresence: (Boolean) -> Unit, content: @Composable () -> Unit) {
    Box(modifier.onSizeChanged { onPresence(it.width > 0 && it.height > 0) }) { content() }
}

// MARK: md-table

@Composable internal fun NativeTable(p: Props, onEvent: EventSink, content: Slot?) {
    val owner = remember { NativeTableOwner() }
    val container = LocalNativeTableContainer.current
    val forced = LocalAWCTableForcedColors.current
    val tokens = LocalAWCThemeTokens.current
    val reduced = LocalAWCTableReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val inherited = LocalAWCNativeDensity.current
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    AWCTableTrace.hit("table.compose")
    if (AWCTableTrace.on) { if (owner.props != p) AWCTableTrace.hit("table.write.props") }
    // The container's auto-bound toolbar follows mdSelectionChange events (a re-render that drops selected rows emits none).
    owner.props = p; owner.emit = { n, d -> if (n == "mdSelectionChange") owner.announced = (awcMap(d)["count"] as? Number)?.toInt() ?: owner.announced; onEvent(n, d) }; owner.reduced = reduced
    if (AWCTableTrace.on && owner.palette != NativeTablePalette(tokens, forced)) AWCTableTrace.hit("table.write.palette")
    owner.palette = NativeTablePalette(tokens, forced)
    val vars = LocalAWCTableVars.current.merging(p.str("style"))
    owner.vars = vars
    var hooks = AWCTableHooks.vars(vars)
    if (container?.vibrant == true && !forced) {
        val pr = owner.palette.hex("primary")
        hooks = AWCTableHooks(headBackground = owner.palette.hex("primary-container"), headColor = owner.palette.hex("on-primary-container"), rowHoverColor = pr,
            rowSelectedBackground = owner.palette.hex("tertiary-container"), rowSelectedColor = owner.palette.hex("on-tertiary-container"),
            dividerColor = tableMix(pr, 0.22, null).hex(), stripeColor = tableMix(pr, 0.07, null).hex()).merging(hooks)
    }
    if (AWCTableTrace.on && owner.hooks != hooks) AWCTableTrace.hit("table.write.hooks")
    owner.hooks = hooks; owner.vibrant = container?.vibrant == true
    owner.surface = (if (forced) null else vars.color("--md-table-surface")) ?: container?.surface ?: owner.palette.hex("surface")
    owner.inContainer = container != null; owner.hasBottomBar = container?.hasBottomBar == true
    owner.metrics = AWCTableMetrics.resolve(p["density"], inherited, hooks)
    val template = when {
        p.str("columnTemplate").isNotEmpty() -> p.str("columnTemplate")
        p.int("columns") > 0 -> "repeat(${p.int("columns")}, minmax(0, 1fr))"
        hooks.columnsTemplate != null -> hooks.columnsTemplate
        else -> owner.rows.firstOrNull()?.cellCount?.takeIf { it > 0 }?.let { "repeat($it, minmax(0, 1fr))" } ?: ""
    }
    if (AWCTableTrace.on && owner.metrics != AWCTableMetrics.resolve(p["density"], inherited, hooks)) AWCTableTrace.hit("table.write.metrics")
    val parsedTracks = AWCTableTemplate.parse(owner.pinLayout?.template ?: template ?: "") ?: emptyList()
    if (AWCTableTrace.on && owner.tracks != parsedTracks) AWCTableTrace.hit("table.write.tracks")
    owner.tracks = parsedTracks
    owner.minWidth = AWCTableTemplate.length(p.str("minWidth")) ?: hooks.minWidth ?: if (p.bool("frozenHeader")) 0.0 else null
    val inspection = LocalAWCTableInspection.current
    LaunchedEffect(owner.widths, inspection) { inspection?.let { it.columns.clear(); it.columns.addAll(owner.widths.widths); it.gridWidth = owner.widths.width } }
    LaunchedEffect(p["sortBy"], p["sortOrder"]) { owner.sortBy = null; owner.sortOrder = null }
    val controllers = LocalAWCTableControllers.current
    SideEffect { controllers[p.str("id")]?.let { if (it.owner !== owner) it.owner = owner } }
    owner.motion = LocalAWCTableMotion.current
    val firstSelection = remember { arrayOf(true) }
    LaunchedEffect(owner.selection) { if (firstSelection[0]) firstSelection[0] = false else if (owner.selection == "single") owner.trimSingle() }
    val m = owner.metrics
    val density = LocalDensity.current
    val scrollCtx = LocalNativeTableScroll.current
    val frozen = p.bool("frozenHeader")
    val fh = rememberScrollState(); val fv = rememberScrollState()
    val controller = LocalAWCTableScrollController.current
    if (frozen) SideEffect { controller?.let { it.horizontal = fh; it.vertical = fv; it.density = density.density } }
    owner.scrollX = if (frozen) fh.value else scrollCtx?.h?.value ?: 0
    owner.scrollY = if (frozen) fv.value else scrollCtx?.v?.value ?: 0
    owner.scrollMaxY = if (frozen) fv.maxValue else scrollCtx?.v?.maxValue ?: 0
    if (!frozen && scrollCtx != null) owner.viewportWidth = with(density) { scrollCtx.width.roundToPx() }
    val loading = p.bool("loading"); val skeleton = loading && p.str("loadingMode") == "skeleton"
    val live = if (owner.selection == "none") 0 else owner.state().count
    if (owner.announced == null && owner.rows.isNotEmpty()) SideEffect { if (owner.announced == null) owner.announced = live }
    val count = if (owner.selection == "none") 0 else owner.announced ?: live
    LaunchedEffect(count) { container?.selectionCount?.value = count }
    inspection?.let { ins -> SideEffect { val st = owner.state(); ins.metrics["table.all"] = st.all; ins.metrics["table.indeterminate"] = st.indeterminate
        ins.metrics["table.head"] = when (owner.selection) { "single" -> listOf(false, false, true); "none" -> listOf(false, false, false); else -> listOf(st.all, st.indeterminate, false) }
        ins.metrics["table.count"] = st.count; ins.metrics["table.busy"] = p.bool("loading"); ins.metrics["table.columnOrder"] = owner.pinLayout?.visible } }
    SideEffect { if (container != null && container.frozenChild.value != frozen) container.frozenChild.value = frozen; container?.armTable?.set(0) { owner.arm() } }
    // captureFlip play: movers glide back from their old box on the fast spatial spring, entrants drop in from -8 dp and fade
    // in (150 ms effects curve); 18 ms stagger per element in document order, capped at 6.
    LaunchedEffect(owner.flipRequest) {
        if (owner.flipRequest == 0) return@LaunchedEffect
        val spring = CubicBezierEasing(0.42f, 1.67f, 0.21f, 0.9f); val fade = CubicBezierEasing(0.31f, 0.94f, 0.34f, 1f)
        val minDelta = 6 * density.density
        var movers = 0; var entrants = 0
        // Stagger in the new document order (settled positions: the rows are still drawn at their old boxes).
        owner.rows.filter { it.group == NativeTableGroup.BODY }.sortedBy { if (it.y.isNaN()) Float.MAX_VALUE else it.y - it.flip.value }.forEach { r ->
            if (r.pendingEnter) { r.pendingEnter = false; val d = min(entrants++, 6) * 18
                launch { r.fade.animateTo(1f, tween(150, d, fade)) }; launch { r.flip.animateTo(0f, tween(350, d, spring)) } }
            else r.pendingDy?.let { dy -> r.pendingDy = null
                if (kotlin.math.abs(dy) > minDelta) { val d = min(movers++, 6) * 18; launch { r.flip.animateTo(0f, tween(350, d, spring)) } } else launch { r.flip.snapTo(0f) } }
        }
    }
    val label = p.str("label").ifEmpty { p.str("caption") }.ifEmpty { "Data table" }
    // keep-height (md-table.tsx componentDidLoad): two animation frames after the first layout the table is floored at that height.
    val keepHeight = p.bool("keepHeight", true)
    LaunchedEffect(owner) { withFrameNanos { }; withFrameNanos { }; if (owner.heightFloor == null && owner.lastHeight > 1) owner.heightFloor = owner.lastHeight }
    // Hover follows content scrolled under a resting pointer (Chrome re-hit-tests after the scroll's layout).
    LaunchedEffect(owner) { snapshotFlow { owner.scrollX to owner.scrollY }.drop(1).collect { withFrameNanos { }; owner.rehit() } }
    var rootCoords by remember { mutableStateOf<LayoutCoordinates?>(null) }
    CompositionLocalProvider(LocalNativeTableOwner provides owner, LocalAWCTableVars provides vars) {
        // ARIA grid size: with row-count the dataset size (head + row-count + foot), else the rows present.
        val heads = owner.rows.count { it.group == NativeTableGroup.HEAD }; val feet = owner.rows.count { it.group == NativeTableGroup.FOOT }
        val rowTotal = if (p.int("rowCount") > 0) heads + p.int("rowCount") + feet else owner.rows.size
        // role="table" / "treegrid": a collection (rows × columns) named by its label (TalkBack); none for a presentational wrapper.
        Box(Modifier.semantics { if (!p.bool("awcTablePresentational")) { contentDescription = label; if (p.str("summary").isNotEmpty()) stateDescription = p.str("summary")
                collectionInfo = CollectionInfo(rowTotal, max(1, owner.tracks.size)) } }
            .onGloballyPositioned { rootCoords = it }
            .pointerInput(owner) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Initial)
                val c = rootCoords; val pos = e.changes.firstOrNull()?.position
                owner.pointer = if (e.type == PointerEventType.Exit || c == null || pos == null || !c.isAttached) null else c.localToRoot(pos) } } }
            // No grid keyboard model (decision log): arrows never move focus between the table's controls. Inside a container its
            // scrollport takes them (the browser's arrow scrolling); a table on its own leaves the page where it is.
            .then(if (container == null) Modifier.onKeyEvent { e -> e.key in NativeTableArrows && !e.isCtrlPressed && !e.isAltPressed && !e.isMetaPressed } else Modifier)) {
            Column(Modifier.fillMaxWidth()
                .onSizeChanged { if (!frozen) owner.lastHeight = it.height }
                .then(if (keepHeight && !frozen) owner.heightFloor?.let { Modifier.heightIn(min = with(density) { it.toDp() }) } ?: Modifier else Modifier)) {
                if (p.str("caption").isNotEmpty()) BasicText(p.str("caption"), Modifier.padding(horizontal = m.padInline.dp, vertical = 12.dp).clearAndSetSemantics { },
                    style = tableTextStyle(14.0, 20.0, 500, 0.1, owner.palette.color("on-surface-variant")))
                // The source moves a frozen table's md-table-head into its internal "head" slot (and back): a head group
                // authored in that slot is the table's head in either mode.
                if (frozen) NativeTableFrozen(owner, p, fh, fv, container?.bodyMaxHeight) {
                    NativeTableGridArea(owner, p, skeleton) { content?.invoke("head"); content?.invoke("") }
                    if (p.bool("empty") && !loading) NativeTableEmpty(owner, content)
                } else {
                    NativeTableGridArea(owner, p, skeleton) { content?.invoke("head"); content?.invoke("") }
                    if (p.bool("empty") && !loading) NativeTableEmpty(owner, content)
                }
            }
            if (loading && !skeleton) Box(Modifier.matchParentSize().clearAndSetSemantics { }) {
                // `loader` (or the older `loading`) replaces the progress line and scrim; `loader` wins when both are given.
                var loader by remember { mutableStateOf(false) }; var legacy by remember { mutableStateOf(false) }
                NativeTableSlot(onPresence = { loader = it }) { Column { content?.invoke("loader") } }
                if (!loader) NativeTableSlot(onPresence = { legacy = it }) { Column { content?.invoke("loading") } }
                if (!loader && !legacy) Box(Modifier.padding(top = m.headHeight.dp).fillMaxWidth()) {
                    // The table's reduced-motion / forced-colours environment reaches the nested indicator.
                    AWCAccessibilityAppearanceScope(reducedMotion = LocalAWCTableReducedMotion.current, forcedColors = if (forced) true else null) {
                        AWCComponent("md-progress-indicator", mapOf("variant" to "linear", "indeterminate" to true, "ariaLabel" to "Loading")) } }
                // The scrim follows the progress line in the source's DOM order, so it dims the line too.
                if (!loader && !legacy) Box(Modifier.padding(top = m.headHeight.dp).fillMaxSize().background(tableMix(owner.palette.hex("surface"), 0.55, null)))
            }
        }
    }
}

/** The grid area: available width tracking, horizontal / vertical scroll context, frozen header body and scrollbars. */
@Composable private fun NativeTableGridArea(owner: NativeTableOwner, p: Props, skeleton: Boolean, rows: @Composable () -> Unit) {
    val density = LocalDensity.current
    Layout(content = {
        Column(Modifier.fillMaxWidth()) {
            rows()
            if (skeleton) repeat(max(1, p.int("loadingRows", 4))) { k -> NativeTableSkeletonRow(owner, k == max(1, p.int("loadingRows", 4)) - 1) }
        }
    }) { measurables, constraints ->
        // In a horizontal scrollport the width is unbounded: the grid fills the scrollport (its minimum) like `min-inline-size: 100%`.
        val availPx = if (constraints.hasBoundedWidth) constraints.maxWidth else max(constraints.minWidth, owner.viewportWidth)
        val avail = with(density) { availPx.toDp().value.toDouble() }
        AWCTableTrace.hit("grid.measure"); if (owner.available != avail) AWCTableTrace.hit("grid.write.available")
        if (owner.available != avail) Snapshot.withoutReadObservation { owner.available = avail }
        val gridWidthPx = with(density) { owner.widths.width.dp.roundToPx() }
        val w = max(gridWidthPx, if (constraints.hasBoundedWidth) constraints.maxWidth else 0)
        val placeable = measurables.first().measure(Constraints.fixedWidth(w))
        if (AWCTableTrace.diagnostics && (gridWidthPx > constraints.maxWidth || placeable.measuredWidth != w)) android.util.Log.w("AWCTable", "DIAG grid ${p.str("id")} width $gridWidthPx max ${constraints.maxWidth} bounded ${constraints.hasBoundedWidth} measured ${placeable.measuredWidth} w $w")
        layout(if (constraints.hasBoundedWidth) min(w, constraints.maxWidth) else w, placeable.height) { placeable.placeRelative(0, 0) }
    }
}

/** frozen-header: the head row sticks while the body scrolls on both axes inside --md-table-body-max-h; custom overlay bars
 *  (scrollbar="overlay") or no custom bars (scrollbar="gutter", the platform's own indicator). */
@Composable private fun NativeTableFrozen(owner: NativeTableOwner, p: Props, h: ScrollState, v: ScrollState, containerMax: Double?, content: @Composable () -> Unit) {
    val m = owner.metrics; val density = LocalDensity.current
    val heads = owner.rows.count { it.group == NativeTableGroup.HEAD }
    val headBox = heads * (m.headHeight + 1)
    val bodyMax = owner.hooks.bodyMaxHeight ?: containerMax
    val gutter = p.str("scrollbar") == "gutter"
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val inspection = LocalAWCTableInspection.current
    val scope = rememberCoroutineScope()
    val inputMode = androidx.compose.ui.platform.LocalInputModeManager.current
    var bodyFocused by remember { mutableStateOf(false) }
    var thumbPressed by remember { mutableStateOf(false) }
    // mdScroll: once per frame from the body scroller (RTL scrollLeft runs negative).
    LaunchedEffect(h, v, rtl) {
        snapshotFlow { h.value to v.value }.drop(1).collect { (x, y) -> with(density) {
            val left = x.toDp().value.toDouble(); val top = y.toDp().value.toDouble()
            inspection?.metrics?.set("frozen.scrollLeft", left); inspection?.metrics?.set("frozen.scrollTop", top)
            owner.emit("mdScroll", mapOf("scrollLeft" to if (rtl) -left else left, "scrollTop" to top)) } }
    }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val vw = constraints.maxWidth; val mw = maxWidth
        SideEffect { if (owner.viewportWidth != vw) owner.viewportWidth = vw }
        Column {
            val floor = if (p.bool("keepHeight", true)) owner.heightFloor?.let { with(density) { it.toDp() } } else null
            Box(Modifier.fillMaxWidth().heightIn(min = floor?.let { it + headBox.dp } ?: 0.dp, max = bodyMax?.let { (headBox + it).dp } ?: Dp.Infinity)
                .onSizeChanged { owner.lastHeight = max(0, it.height - with(density) { headBox.dp.roundToPx() }) }.horizontalScroll(h).verticalScroll(v)) {
                Box(Modifier.widthIn(min = mw)) { Column { content() } }
            }
            if (!gutter && h.maxValue > 0) {
                val track = with(density) { (mw - 16.dp).toPx() }
                val contentW = vw + h.maxValue.toFloat()
                val thumb = max(with(density) { 24.dp.toPx() }, track * vw / contentW)
                val x = (track - thumb) * (h.value.toFloat() / h.maxValue)
                val press by animateFloatAsState(if (thumbPressed) 1f else 0f, if (owner.reduced) snap() else tween(150, easing = CubicBezierEasing(0.31f, 0.94f, 0.34f, 1f)), label = "thumb")
                val rest = if (owner.forced) owner.palette.color("on-surface") else owner.palette.color("outline")
                val active = if (owner.forced) rest else owner.palette.color("on-surface-variant")
                Box(Modifier.padding(horizontal = 8.dp, vertical = 2.dp).height(10.dp).fillMaxWidth().clearAndSetSemantics { }
                    .onGloballyPositioned { c -> inspection?.let { ins -> val o = c.positionInRoot(); val left = if (rtl) c.size.width - x - thumb else x
                        ins.metrics["hthumb.x"] = ((o.x + left + thumb / 2) / density.density).toDouble(); ins.metrics["hthumb.y"] = ((o.y + c.size.height / 2f) / density.density).toDouble() } }
                    // The thumb drags the body (pointer only; the body itself is the keyboard tab stop).
                    .pointerInput(rtl, track, thumb, contentW) {
                        detectDragGestures(onDragStart = { thumbPressed = true }, onDragEnd = { thumbPressed = false }, onDragCancel = { thumbPressed = false }) { change, drag ->
                            change.consume()
                            val ratio = (contentW - vw) / max(1f, track - thumb)
                            h.dispatchRawDelta(drag.x * ratio * (if (rtl) -1f else 1f))
                        }
                    }
                    .drawBehind {
                        owner.motion?.record("thumb:" + p.str("id"), press.toDouble())
                        val px = if (rtl) size.width - x - thumb else x
                        drawRoundRect(androidx.compose.ui.graphics.lerp(rest, active, press), Offset(px, 1.dp.toPx()), Size(thumb, 8.dp.toPx()), androidx.compose.ui.geometry.CornerRadius(4.dp.toPx()))
                    })
            }
        }
        // The body scroller is a keyboard tab stop (WAI scrollable region): arrows / Page / Home / End scroll it (vertical keys
        // smooth like the browser, horizontal steps of 48 dp or to the inline edges with Ctrl/Meta+Home/End); inset 2 dp ring.
        val bodyHeightDp = bodyMax ?: 0.0
        val ringColor = owner.palette.color("secondary")
        Box(Modifier.padding(top = headBox.dp).fillMaxWidth().height(max(1.0, bodyHeightDp).dp)
            .testTag(p.str("id") + "-body")
            .onFocusChanged { bodyFocused = it.isFocused; inspection?.metrics?.set("body.focused", it.isFocused) }
            .onKeyEvent { e ->
                if (e.type != KeyEventType.KeyDown) return@onKeyEvent false
                val page = with(density) { bodyHeightDp.dp.toPx() } * 0.875f
                val step = with(density) { 48.dp.toPx() }; val line = with(density) { 40.dp.toPx() }
                fun smooth(target: Float) { scope.launch { v.animateScrollTo(target.roundToInt().coerceIn(0, v.maxValue), tween(150, easing = CubicBezierEasing(0.42f, 0f, 0.58f, 1f))) } }
                val mod = e.isCtrlPressed || e.isMetaPressed
                when (e.key) {
                    // md-table.tsx onBodyKeyDown: ArrowRight is dx = isRtl ? -48 : 48 on scrollLeft — 48 toward the inline end either way.
                    Key.DirectionRight -> { if (h.maxValue <= 0) return@onKeyEvent false; h.dispatchRawDelta(step); true }
                    Key.DirectionLeft -> { if (h.maxValue <= 0) return@onKeyEvent false; h.dispatchRawDelta(-step); true }
                    Key.MoveHome -> { if (mod) h.dispatchRawDelta(-h.value.toFloat()) else if (!e.isShiftPressed) smooth(0f); true }
                    Key.MoveEnd -> { if (mod) h.dispatchRawDelta((h.maxValue - h.value).toFloat()) else if (!e.isShiftPressed) smooth(v.maxValue.toFloat()); true }
                    Key.DirectionDown -> { smooth(v.value + line); true }
                    Key.DirectionUp -> { smooth(v.value - line); true }
                    Key.PageDown -> { smooth(v.value + page); true }
                    Key.PageUp -> { smooth(v.value - page); true }
                    Key.Spacebar -> { smooth(v.value + if (e.isShiftPressed) -page else page); true }
                    else -> false
                }
            }
            .focusable()
            // The ring is the body scroller's outline: Chrome paints it under the sticky pinned cells.
            .drawBehind { if (bodyFocused && inputMode.inputMode == androidx.compose.ui.input.InputMode.Keyboard) {
                val d = density.density
                val covered = owner.pinnedRanges((h.value / d).toDouble(), (size.width / d).toDouble()).map { (lo, hi) ->
                    if (rtl) (size.width - hi.toFloat() * d) to (size.width - lo.toFloat() * d) else (lo.toFloat() * d) to (hi.toFloat() * d) }
                val open = Path().apply { addRect(androidx.compose.ui.geometry.Rect(0f, 0f, size.width, size.height))
                    covered.forEach { (a, b) -> val cut = Path().apply { addRect(androidx.compose.ui.geometry.Rect(max(0f, a), 0f, min(size.width, b), size.height)) }; op(this, cut, PathOperation.Difference) } }
                clipPath(open) { drawRect(ringColor, Offset(1.dp.toPx(), 1.dp.toPx()), Size(size.width - 2.dp.toPx(), size.height - 2.dp.toPx()), style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx())) } } })
        if (!gutter && v.maxValue > 0 && bodyMax != null) {
            val bodyH = with(density) { bodyMax.dp.toPx() }
            val bodyContent = bodyH + v.maxValue
            val thumb = max(with(density) { 24.dp.toPx() }, bodyH * bodyH / bodyContent)
            val y = (bodyH - thumb) * (v.value.toFloat() / v.maxValue)
            Box(Modifier.align(Alignment.TopEnd).padding(top = headBox.dp, end = 3.dp).width(8.dp).height(bodyMax.dp).clearAndSetSemantics { }.drawBehind {
                drawRoundRect(if (owner.forced) owner.palette.color("on-surface") else tableMix(owner.palette.hex("on-surface"), 0.5, null), Offset(0f, y), Size(size.width, thumb), androidx.compose.ui.geometry.CornerRadius(4.dp.toPx()))
            })
        }
    }
}

@Composable internal fun NativeTableRowGroup(tag: String, content: Slot?) {
    val group = when (tag) { "md-table-head" -> NativeTableGroup.HEAD; "md-table-foot" -> NativeTableGroup.FOOT; else -> NativeTableGroup.BODY }
    CompositionLocalProvider(LocalNativeTableGroup provides group) {
        Column(Modifier.fillMaxWidth().zIndex(when (group) { NativeTableGroup.HEAD -> 2f; NativeTableGroup.FOOT -> 1f; else -> 0f })
            .then(if (group == NativeTableGroup.HEAD) NativeTableNoFocusScroll else Modifier)) { content?.invoke("") } }
}

// MARK: md-table-row

@Composable internal fun NativeTableRowView(p: Props, onEvent: EventSink, content: Slot?) {
    val owner = LocalNativeTableOwner.current ?: run { StandaloneTable("md-table-row", p, onEvent, content); return }
    val group = LocalNativeTableGroup.current
    val row = remember { NativeTableRow(Any()) }
    AWCTableTrace.hit("row.compose"); if (AWCTableTrace.on && row.props != p) AWCTableTrace.hit("row.write.props")
    row.props = p; row.group = group
    row.own = AWCTableVars.style(p.str("style"))
    val rowVars = LocalAWCTableVars.current.merging(row.own)
    DisposableEffect(owner, row) { owner.register(row); onDispose { owner.unregister(row) } }
    // Host property changes win; a change the row's watchers would see (effective value differs) emits like the source.
    val authored = remember { arrayOfNulls<Boolean>(2) }
    authored[0]?.let { prev -> if (prev != p.bool("selected") && group == NativeTableGroup.BODY) owner.pendingSelected.getOrPut(row.key) { owner.selected[row.key] ?: prev } }
    LaunchedEffect(p.bool("selected")) {
        val v = p.bool("selected"); val prev = authored[0]; authored[0] = v
        val before = owner.pendingSelected.remove(row.key) ?: owner.selected[row.key] ?: prev; owner.selected.remove(row.key)
        if (prev != null && before != v && group == NativeTableGroup.BODY) owner.setSelected(row, v, alreadyApplied = true)
    }
    LaunchedEffect(p.bool("expanded")) {
        val v = p.bool("expanded"); val prev = authored[1]; authored[1] = v
        val before = owner.expanded[row.key] ?: prev; owner.expanded.remove(row.key)
        if (prev != null && before != v) onEvent("mdRowExpandedChange", mapOf("expanded" to v, "row" to row.id))
    }
    val m = owner.metrics; val density = LocalDensity.current
    val rows = owner.rows
    val i = rows.indexOf(row)
    val footExists = rows.any { it.group == NativeTableGroup.FOOT }
    val lastBody = rows.indexOfLast { it.group == NativeTableGroup.BODY }
    val skeleton = owner.props.bool("loading") && owner.props.str("loadingMode") == "skeleton"
    if (skeleton && group != NativeTableGroup.HEAD) { LocalAWCTableInspection.current?.let { ins -> SideEffect { ins.rows.remove(row.id) } }; return }
    val borderTop = if (group == NativeTableGroup.FOOT && (i == 0 || rows.getOrNull(i - 1)?.group != NativeTableGroup.FOOT)) 1 else 0
    var borderBottom = if (group == NativeTableGroup.FOOT) 0 else 1
    if (owner.inContainer && !owner.hasBottomBar && i == rows.lastIndex && !skeleton) borderBottom = 0
    if (footExists && i == lastBody) borderBottom = 0
    val selected = owner.isSelected(row); val hovered = owner.hoverRow == row.key
    LocalAWCTableInspection.current?.let { ins -> SideEffect { ins.metrics["selected:" + row.id] = selected; ins.metrics["expanded:" + row.id] = owner.isExpanded(row) } }
    val disabled = p.bool("disabled")
    val pal = owner.palette
    val bg: Color = when (group) {
        NativeTableGroup.HEAD -> tableColor(owner.headBg)
        NativeTableGroup.FOOT -> tableColor(owner.footBg)
        NativeTableGroup.BODY -> when {
            p.bool("highlight") -> pal.color("primary-container")
            selected -> tableColor(owner.selectedBg)
            owner.props.bool("striped") && row.groupIndex % 2 == 1 -> owner.stripe()
            else -> Color.Transparent
        }
    }
    val bgAnimated by animateColorAsState(bg, if (owner.reduced || group != NativeTableGroup.BODY) snap() else tween(150, easing = CubicBezierEasing(0.31f, 0.94f, 0.34f, 1f)), label = "row-bg")
    val hoverOn = hovered && owner.props.bool("hoverable", true) && group == NativeTableGroup.BODY && !disabled
    val hoverAlpha by animateFloatAsState(if (hoverOn) 1f else 0f, if (owner.reduced) snap() else tween(150, easing = CubicBezierEasing(0.31f, 0.94f, 0.34f, 1f)), label = "row-hover")
    val hoverLayer = tableMix(owner.hoverColor, 0.08, null)
    val divider = tableColor(owner.divider)
    val minH = if (group == NativeTableGroup.HEAD) m.headHeight else m.rowHeight
    val expandable = p.bool("expandable"); val open = owner.isExpanded(row)
    val sticky = (group == NativeTableGroup.HEAD && (owner.props.bool("stickyHeader") || owner.props.bool("frozenHeader"))) || (group == NativeTableGroup.FOOT && owner.props.bool("stickyFooter"))
    val inspection = LocalAWCTableInspection.current
    val headFirst = group == NativeTableGroup.HEAD && rows.firstOrNull { it.group == NativeTableGroup.HEAD } === row
    val floorsOn = owner.props.bool("frozenHeader") && headFirst
    // FLIP (md-table.tsx armMotion → captureFlip): a body row that moved (or appeared) right after a sort / page event jumps back
    // to its old box (or -8 dp, transparent) at once; the table plays the staggered glide next frame.
    val flip = row.flip
    val lastY = remember { floatArrayOf(Float.NaN) }
    val scope = rememberCoroutineScope()
    val inputMode = androidx.compose.ui.platform.LocalInputModeManager.current
    var focused by remember { mutableStateOf(false) }
    val rowFocus = remember { FocusRequester() }
    val clickable = p.bool("clickable") && !disabled && group == NativeTableGroup.BODY
    val ring = owner.palette.color("secondary")
    val motion = owner.motion
    val rowRtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    Column(Modifier.fillMaxWidth()
        .zIndex(if (sticky) 2f else 0f)
        .offset { IntOffset(0, if (sticky && group == NativeTableGroup.HEAD) owner.scrollY else if (sticky && group == NativeTableGroup.FOOT) min(0, owner.scrollY - owner.scrollMaxY) else 0) }
        .onPlaced { c ->
            val y = c.positionInRoot().y
            val armed = group == NativeTableGroup.BODY && !owner.reduced && owner.armedUntil > android.os.SystemClock.uptimeMillis()
            if (armed && lastY[0].isNaN()) {
                row.pendingEnter = true
                scope.launch(start = kotlinx.coroutines.CoroutineStart.UNDISPATCHED) { flip.snapTo(-8 * density.density); row.fade.snapTo(0f) }
                owner.flipRequest++
            } else if (armed && y != lastY[0]) {
                val from = lastY[0] - y + flip.value
                row.pendingDy = from
                scope.launch(start = kotlinx.coroutines.CoroutineStart.UNDISPATCHED) { flip.snapTo(from) }
                owner.flipRequest++
            }
            lastY[0] = y
        }
        .graphicsLayer { translationY = flip.value; alpha = row.fade.value }
        .onGloballyPositioned { c -> owner.place(row, c.positionInRoot().y); row.visible = c.boundsInRoot()
            inspection?.let { ins -> ins.rows[row.id.ifEmpty { row.key.toString() }] = c.tableBox(density) } }
        .drawBehind {
            if (motion != null) { motion.record("selected:" + row.id, bgAnimated.alpha.toDouble()); motion.record("hover:" + row.id, hoverAlpha.toDouble())
                motion.record("y:" + row.id, ((lastY[0] + flip.value) / density.density).toDouble()) }
            // An overflowing grid: the row box spans the solved tracks (it reports the constraint width; see the cell layout).
            val full = max(size.width, owner.widths.width.dp.toPx()); val x0 = if (rowRtl) size.width - full else 0f
            drawRect(bgAnimated, Offset(x0, 0f), Size(full, size.height))
            val px = 1.dp.toPx()
            if (borderTop > 0) drawRect(divider, Offset(x0, 0f), Size(full, px))
            if (borderBottom > 0) drawRect(divider, Offset(x0, size.height - px), Size(full, px))
        }
        .drawBehind { if (hoverAlpha > 0f) { val full = max(size.width, owner.widths.width.dp.toPx()); drawRect(hoverLayer, Offset(if (rowRtl) size.width - full else 0f, 0f), Size(full, size.height), alpha = hoverAlpha) } }
        .pointerInput(row) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent()
            val inside = e.changes.firstOrNull()?.position?.let { it.x >= 0 && it.y >= 0 && it.x < size.width && it.y < size.height } ?: false
            when (e.type) { PointerEventType.Enter, PointerEventType.Move, PointerEventType.Press, PointerEventType.Release -> if (inside) { if (owner.hoverRow != row.key && group == NativeTableGroup.BODY && !disabled) owner.hoverRow = row.key } else if (owner.hoverRow == row.key) owner.hoverRow = null
                PointerEventType.Exit -> if (owner.hoverRow == row.key && e.changes.none { it.pressed }) owner.hoverRow = null } } } }
        // A clickable body row is its own tab stop: Enter / Space (keydown) are mdRowClick; :focus-visible draws a 2 dp inset ring.
        .then(if (clickable) Modifier
            // A mouse press focuses the clickable row (tabindex 0); a control inside it takes focus after (inner handlers run later).
            .pointerInput(row) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Initial)
                if (e.type == PointerEventType.Press) runCatching { rowFocus.requestFocus() } } } }
            // tabindex 0: focusable in touch mode too (a clickable alone is not), so a pointer press focuses it like Chrome.
            .focusProperties { canFocus = true }
            .focusRequester(rowFocus)
            .onFocusChanged { focused = it.isFocused; inspection?.metrics?.set("focus:" + row.id, it.isFocused) }
            // Only the row's own keys (md-table-row handleKeyDown ignores events from the controls inside it).
            .onPreviewKeyEvent { e -> if (focused && e.type == KeyEventType.KeyDown && (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.Spacebar)) {
                onEvent("mdRowClick", mapOf("value" to row.identity, "row" to row.id)); true } else false }
            .clickable(interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, indication = null) {
                onEvent("mdRowClick", mapOf("value" to row.identity, "row" to row.id)) }
            // Enter / Space a focused control inside the row leaves unhandled must not click the row (they never reach the
            // row's own focus target; Compose's clickable would otherwise take them from its descendants).
            .onKeyEvent { e -> e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.Spacebar }
            .drawWithContent { drawContent(); if (focused && inputMode.inputMode == androidx.compose.ui.input.InputMode.Keyboard)
                drawRect(ring, Offset(1.dp.toPx(), 1.dp.toPx()), Size(size.width - 2.dp.toPx(), size.height - 2.dp.toPx()), style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx())) }
            else Modifier)
        .semantics { if (p.bool("awcTablePresentational")) return@semantics
            if (group == NativeTableGroup.BODY && owner.selection != "none") this.selected = selected; if (disabled) disabled()
            // aria-expanded only under a treegrid (a table with an expandable row), never for a lone row.
            if (expandable && !owner.props.bool("awcTablePresentational")) stateDescription = if (open) "expanded" else "collapsed"
            // aria-rowindex (row-offset / row-count: the row's position in the whole dataset; foot rows after it).
            val heads = rows.count { it.group == NativeTableGroup.HEAD }; val rc = owner.props.int("rowCount")
            val index = if (rc <= 0) i else when (group) { NativeTableGroup.HEAD -> row.groupIndex; NativeTableGroup.BODY -> heads + owner.props.int("rowOffset") + row.groupIndex; NativeTableGroup.FOOT -> heads + rc + row.groupIndex }
            if (index >= 0) collectionItemInfo = CollectionItemInfo(index, 1, 0, 1) }
        .padding(top = borderTop.dp, bottom = borderBottom.dp)
    ) {
        CompositionLocalProvider(LocalNativeTableRow provides row, LocalAWCTableVars provides rowVars) {
            Layout(content = { content?.invoke("") }, modifier = Modifier.fillMaxWidth().heightIn(min = minH.dp)) { measurables, constraints ->
                AWCTableTrace.hit("row.measure")
                val datas = measurables.map { it.layoutId as? NativeTableCellData ?: NativeTableCellData() }
                var col = 0
                val authoredColumns = datas.map { d -> col.also { col += d.span } }
                if (row.cellCount != col) Snapshot.withoutReadObservation { row.cellCount = col }
                row.cellSpans = datas.map { it.span }; row.cellSticky = datas.map { it.sticky }
                datas.forEachIndexed { k, d -> if (d.column != k) Snapshot.withoutReadObservation { d.column = k } }
                // pinColumn / setColumnVisibility: cells re-sequence (start pins, the rest, end pins); hidden cells take no track.
                val pins = owner.pinLayout
                val visible = pins?.visible
                val columns = if (visible != null) datas.indices.map { k -> visible.indexOf(k) } else authoredColumns
                fun sticky(k: Int) = if (pins != null) pins.pins[k] else datas[k].sticky
                fun shown(k: Int) = columns[k] >= 0
                val items = measurables.mapIndexedNotNull { k, me -> if (!shown(k)) null else
                    AWCTableContribution(columns[k], datas[k].span, me.minIntrinsicWidth(Constraints.Infinity).toDp().value.toDouble(), me.maxIntrinsicWidth(Constraints.Infinity).toDp().value.toDouble()) }
                val floors = if (floorsOn) measurables.indices.filter { shown(it) }.zip(items).mapNotNull { (k, it) -> if (datas[k].checkbox || it.span != 1) null else it.start to ceil(it.maxContent + (if (datas[k].sortLabel) 8.0 else 0.0)) }.toMap() else null
                items.filter { it.maxContent > 4000 || it.minContent > 4000 }.forEach { android.util.Log.w("AWCTable", "row ${row.id} col ${it.start} intrinsic min ${it.minContent} max ${it.maxContent} tag ${measurables.getOrNull(items.indexOf(it))?.layoutId}") }
                owner.report(row.key, items.map { it.copy(minContent = it.minContent.coerceIn(0.0, 4000.0), maxContent = it.maxContent.coerceIn(0.0, 4000.0)) }, floors)
                val solved = owner.widths
                val widthsPx = solved.widths.map { it.dp.toPx() }
                fun x(c: Int) = widthsPx.take(c).sum()
                fun w(c: Int, s: Int) = widthsPx.drop(c).take(s).sum()
                val total = max(constraints.minWidth, solved.width.dp.roundToPx())
                if (AWCTableTrace.diagnostics && total > constraints.maxWidth) android.util.Log.w("AWCTable", "DIAG row ${row.id} total $total > max ${constraints.maxWidth} (solved ${solved.width} widths ${solved.widths})")
                // One measure per measurable: the row height comes from intrinsic heights at the track widths.
                val cellH0 = measurables.mapIndexedNotNull { k, me -> if (!shown(k)) null else me.maxIntrinsicHeight(w(columns[k], datas[k].span).roundToInt().coerceAtLeast(0)) }.maxOrNull() ?: 0
                val h = max(cellH0, minH.dp.roundToPx())
                if (cellH0 > minH.dp.roundToPx() && AWCTableTrace.diagnostics) android.util.Log.w("AWCTable", "row ${row.id} group $group intrinsic heights ${measurables.mapIndexed { k, me -> if (shown(k)) me.maxIntrinsicHeight(w(columns[k], datas[k].span).roundToInt().coerceAtLeast(0)) else -1 }} min ${minH.dp.roundToPx()} widths ${widthsPx}")
                val placeables = measurables.mapIndexed { k, me -> me.measure(if (shown(k)) Constraints.fixed(w(columns[k], datas[k].span).roundToInt().coerceAtLeast(0), h) else Constraints.fixed(0, 0)) }
                val viewport = owner.viewportWidth.toFloat()
                // pin-mode="static": each pin sticks after the widths of the earlier pins on its side (all stay visible).
                val inset = FloatArray(placeables.size)
                if (owner.props.str("pinMode") == "static") {
                    val order = placeables.indices.filter { shown(it) }.sortedBy { columns[it] }
                    var cum = 0f; order.forEach { k -> if (sticky(k) == "start") { inset[k] = cum; cum += w(columns[k], datas[k].span) } }
                    cum = 0f; order.asReversed().forEach { k -> if (sticky(k) == "end") { inset[k] = cum; cum += w(columns[k], datas[k].span) } }
                }
                // An overflowing grid reports the constraint (Compose would centre a larger box); cells overflow toward the end.
                layout(if (constraints.hasBoundedWidth) min(total, constraints.maxWidth) else total, h) {
                    placeables.forEachIndexed { k, pl ->
                        if (!shown(k)) return@forEachIndexed
                        var cx = x(columns[k])
                        val side = sticky(k)
                        if (side == "start") cx = min(max(cx, owner.scrollX + inset[k]), total - pl.width.toFloat())
                        if (side == "end" && viewport > 0) cx = max(min(cx, owner.scrollX + viewport - pl.width - inset[k]), 0f)
                        pl.placeRelative(cx.roundToInt(), 0, zIndex = if (side != null) 3f else 1f)
                    }
                }
            }
            if (expandable) NativeTableExpanded(owner, open, content)
        }
    }
}

@Composable private fun NativeTableExpanded(owner: NativeTableOwner, open: Boolean, content: Slot?) {
    val fraction by animateFloatAsState(if (open) 1f else 0f, if (owner.reduced) snap() else if (open) tween(500, easing = CubicBezierEasing(0.38f, 1.21f, 0.22f, 1f)) else tween(200, easing = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)), label = "expand")
    // Panel opacity 200 ms (effects / exit curve); __expanded-inner: opacity 200 ms after 60 ms (exit 100 ms linear) and
    // translateY(-10px) → 0 on the fast spatial spring (350 ms after 60 ms; exit 150 ms).
    val panel by animateFloatAsState(if (open) 1f else 0f, if (owner.reduced) snap() else if (open) tween(200, easing = CubicBezierEasing(0.34f, 0.8f, 0.34f, 1f)) else tween(200, easing = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)), label = "expand-panel")
    val alpha by animateFloatAsState(if (open) 1f else 0f, if (owner.reduced) snap() else if (open) tween(200, 60, CubicBezierEasing(0.34f, 0.8f, 0.34f, 1f)) else tween(100, easing = LinearEasing), label = "expand-alpha")
    val shift by animateFloatAsState(if (open) 0f else -10f, if (owner.reduced) snap() else if (open) tween(350, 60, CubicBezierEasing(0.38f, 1.21f, 0.22f, 1f)) else tween(150, easing = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)), label = "expand-shift")
    val row = LocalNativeTableRow.current
    Layout(content = {
        Box(Modifier.fillMaxWidth().padding(start = owner.metrics.padInline.dp, end = owner.metrics.padInline.dp, top = 12.dp, bottom = 16.dp)
            .graphicsLayer { this.alpha = alpha * panel; translationY = shift.dp.toPx() }) {
            // The expanded zone inherits the row's body text (14 / 20 at standard density).
            CompositionLocalProvider(LocalTextStyle provides tableTextStyle(owner.metrics.fontSize, owner.metrics.lineHeight, 400, 0.25, owner.palette.color("on-surface")), LocalAWCSourceText provides true) {
                Column { content?.invoke("expanded") } } }
    }, modifier = Modifier.fillMaxWidth().clipToBounds().semantics { if (!open) invisibleToUser() }) { ms, c ->
        val pl = ms.first().measure(c.copy(minHeight = 0, maxHeight = Constraints.Infinity))
        owner.motion?.record("expand:" + (row?.id ?: ""), fraction.toDouble())
        val h = (pl.height * fraction.coerceAtLeast(0f)).roundToInt()
        // Intrinsic passes (a container measuring its content) may propose an unbounded width.
        layout(if (c.hasBoundedWidth) c.maxWidth else pl.width, h) { pl.placeRelative(0, 0) }
    }
}

@Composable private fun NativeTableSkeletonRow(owner: NativeTableOwner, last: Boolean) {
    val m = owner.metrics; val pal = owner.palette
    val shimmer = rememberInfiniteTransition(label = "shimmer")
    val t by shimmer.animateFloat(0f, 1f, infiniteRepeatable(tween(1400, easing = CubicBezierEasing(0.25f, 0.1f, 0.25f, 1f))), label = "shimmer-t")
    val position = if (owner.reduced) 1f else 1f - t
    val widths = owner.widths.widths
    Row(Modifier.fillMaxWidth().heightIn(min = m.rowHeight.dp).drawBehind { if (!last) drawRect(tableColor(owner.divider), Offset(0f, size.height - 1.dp.toPx()), Size(size.width, 1.dp.toPx())) }
        .padding(bottom = if (last) 0.dp else 1.dp).clearAndSetSemantics { }, verticalAlignment = Alignment.CenterVertically) {
        widths.forEach { w ->
            Box(Modifier.width(w.dp).padding(horizontal = m.padInline.dp).height(16.dp).clip(CircleShape).drawBehind {
                val image = size.width * 4; val offset = -(image - size.width) * position
                drawRect(Brush.horizontalGradient(0.25f to pal.color("surface-container-high"), 0.37f to pal.color("surface-container"), 0.63f to pal.color("surface-container-high"),
                    startX = offset, endX = offset + image))
            })
        }
    }
}

@Composable private fun NativeTableEmpty(owner: NativeTableOwner, content: Slot?) {
    val m = owner.metrics
    Box(Modifier.fillMaxWidth().heightIn(min = (owner.hooks.emptyMinHeight ?: 160.0).dp).padding(vertical = 32.dp, horizontal = m.padInline.dp), contentAlignment = Alignment.Center) {
        CompositionLocalProvider(LocalTextStyle provides tableTextStyle(m.fontSize, m.lineHeight, 400, 0.25, owner.palette.color("on-surface-variant")), LocalAWCSourceText provides true) {
            var slotted by remember { mutableStateOf(false) }
            NativeTableSlot(onPresence = { slotted = it }) { Column(horizontalAlignment = Alignment.CenterHorizontally) { content?.invoke("empty") } }
            if (!slotted) BasicText("No data", style = tableTextStyle(m.fontSize, m.lineHeight, 400, 0.25, owner.palette.color("on-surface-variant")))
        }
    }
}

internal val NativeTablePresentational: Props = mapOf("awcTablePresentational" to true)
@Composable private fun StandaloneTable(tag: String, p: Props, onEvent: EventSink, content: Slot?) {
    // A sub-tag shown alone gets a table around it (the Laboratory previews each family member).
    // The wrappers are presentational: no table semantics around a lone part, as on the Web.
    NativeTable(NativeTablePresentational, onEvent) { slot -> if (slot.isEmpty()) {
        when (tag) {
            "md-table-row" -> CompositionLocalProvider(LocalNativeTableGroup provides NativeTableGroup.BODY) { NativeTableRowView(p, onEvent, content) }
            // A lone row group is the table's row group (its rows, not one cell holding them).
            "md-table-head", "md-table-body", "md-table-foot" -> NativeTableRowGroup(tag, content)
            else -> NativeTableRowView(NativeTablePresentational, onEvent) { s -> if (s.isEmpty()) Box(Modifier.layoutId(NativeTableCellData.of(p))) { NativeTableCellView(p, onEvent, content) } }
        }
    } }
}

// MARK: md-table-cell

@Composable internal fun NativeTableCellView(p: Props, onEvent: EventSink, content: Slot?) {
    val owner = LocalNativeTableOwner.current ?: run { StandaloneTable("md-table-cell", p, onEvent, content); return }
    AWCTableTrace.hit("cell.compose")
    val row = LocalNativeTableRow.current
    val group = row?.group ?: NativeTableGroup.BODY
    val m = owner.metrics; val pal = owner.palette
    val padding = p.str("padding").takeIf { it == "none" || it == "checkbox" } ?: "default"
    val align = p.str("align").takeIf { it == "center" || it == "end" || it == "justify" } ?: "start"
    val meta = p.str("variant") == "meta"; val numeric = p.bool("numeric"); val head = p.bool("head")
    val selected = row?.let { owner.isSelected(it) } ?: false
    val cellData = LocalNativeTableCellData.current
    val sticky = owner.pinLayout?.let { pl -> cellData?.column?.takeIf { it >= 0 }?.let { pl.pins[it] } } ?: if (owner.pinLayout != null) null else p.str("sticky").takeIf { it == "start" || it == "end" }
    // The cell's custom properties: the table's, under its row's (provided by the row), under its own `style`.
    val own = AWCTableVars.style(p.str("style"))
    val vars = LocalAWCTableVars.current.merging(own)
    fun hookColor(name: String) = if (owner.forced) null else vars.color(name)
    // md-table-cell--pinned: the head cell of a pinned column advertising its pin (its content keeps to the inline start even when
    // --md-table-cell-pin-display hides the glyph).
    val pinnedHead = head && sticky != null && padding != "checkbox" && !p.bool("noPinIndicator") && group != NativeTableGroup.BODY
    val showPin = pinnedHead && vars["--md-table-cell-pin-display"] != "none"
    val disabledRow = row?.props?.bool("disabled") == true
    val cellColor = hookColor("--md-table-cell-color")
    val color: Color = when {
        cellColor != null -> tableColor(cellColor)
        owner.forced && selected && group == NativeTableGroup.BODY -> pal.color("on-primary")
        group == NativeTableGroup.HEAD -> tableColor(owner.headColor)
        group == NativeTableGroup.BODY && disabledRow -> if (owner.forced) pal.color("on-surface") else tableMix(pal.hex("on-surface"), 0.38, null)
        group == NativeTableGroup.BODY && row?.props?.bool("highlight") == true -> pal.color("on-primary-container")
        group == NativeTableGroup.BODY && selected -> tableColor(owner.selectedColor)
        meta -> pal.color("on-surface-variant")
        else -> pal.color("on-surface")
    }
    val weight = if (group == NativeTableGroup.BODY) 400 else 500
    val tracking = if (group == NativeTableGroup.HEAD) 0.1 else 0.25
    val size = if (meta) 12.0 else m.fontSize; val line = if (meta) 16.0 else m.lineHeight
    val hovered = row != null && owner.hoverRow == row.key && owner.props.bool("hoverable", true) && !disabledRow && group == NativeTableGroup.BODY
    val stickyBase = when (group) {
        NativeTableGroup.HEAD -> owner.headBg
        NativeTableGroup.FOOT -> owner.footBg
        NativeTableGroup.BODY -> if (selected) owner.selectedBg else if (owner.props.bool("striped") && (row?.groupIndex ?: 0) % 2 == 1) tableMix(pal.hex("on-surface"), 0.04, owner.surface).hex() else owner.surface
    }
    // md-table-row stamps --md-table-cell-sticky-bg per state on its host; the row's or the cell's own declaration wins.
    val stickyOwn = if (owner.forced) null else (row?.own ?: AWCTableVars()).merging(own).color("--md-table-cell-sticky-bg")
    // The sticky hover mix reads the row's --md-table-row-hover-color (md-table-row.css).
    val rowHover = if (owner.forced) owner.hoverColor else (owner.vars.merging(row?.own ?: AWCTableVars()).color("--md-table-row-hover-color") ?: owner.hoverColor)
    val stickyTarget = stickyOwn?.let { tableColor(it) } ?: if (hovered) tableMix(rowHover, 0.08, stickyBase) else tableColor(stickyBase)
    // --md-table-cell-sticky-transition (head / foot rows set 0s; default 150 ms on the effects curve).
    val stickyMs = if (group != NativeTableGroup.BODY) ((row?.own ?: AWCTableVars()).merging(own).duration("--md-table-cell-sticky-transition") ?: 0.0) else vars.duration("--md-table-cell-sticky-transition") ?: 150.0
    val stickyBg by animateColorAsState(stickyTarget, if (owner.reduced || stickyMs <= 0 || sticky == null) snap() else tween(stickyMs.roundToInt(), easing = CubicBezierEasing(0.31f, 0.94f, 0.34f, 1f)), label = "sticky-bg")
    val padBlock = vars.length("--md-table-cell-padding-block") ?: m.padBlock; val padInline = vars.length("--md-table-cell-padding-inline") ?: m.padInline
    val cellBg = if (sticky == null) hookColor("--md-table-cell-background") else null
    val minCell = vars.length("--md-table-cell-min-height")
    val horizontal = when {
        padding == "checkbox" -> Alignment.CenterHorizontally
        pinnedHead && (align == "end" || numeric) -> Alignment.Start
        numeric || align == "end" -> Alignment.End
        align == "center" -> Alignment.CenterHorizontally
        else -> Alignment.Start
    }
    val inspection = LocalAWCTableInspection.current; val density = LocalDensity.current
    val checkbox = if (padding == "checkbox" && row != null && owner.selection != "none") {
        if (group == NativeTableGroup.HEAD) { val st = owner.state()
            if (owner.selection == "single") NativeTableCheckboxControl(mapOf("checked" to false, "indeterminate" to false, "disabled" to true)) { }
            else NativeTableCheckboxControl(mapOf("checked" to st.all, "indeterminate" to st.indeterminate, "disabled" to false)) { owner.selectAll(it) } }
        else if (group == NativeTableGroup.BODY) NativeTableCheckboxControl(mapOf("checked" to owner.isSelected(row), "indeterminate" to false, "disabled" to disabledRow)) { v ->
            if (!disabledRow && row.props.bool("selectable", true)) owner.setSelected(row, v) } else null
    } else null
    Box(Modifier.fillMaxSize()
        // min-block-size: --md-table-cell-min-height (border-box; the row grows to its tallest cell).
        .then(if (minCell != null) Modifier.heightIn(min = minCell.dp) else Modifier)
        .then(if (sticky != null) Modifier.background(stickyBg) else if (cellBg != null) Modifier.background(tableColor(cellBg)) else Modifier)
        .onGloballyPositioned { c -> inspection?.let { ins -> ins.cells[p.str("id")] = c.tableBox(density) } }
        .padding(start = if (padding == "none") 0.dp else if (padding == "checkbox") 4.dp else padInline.dp, end = if (padding == "default") padInline.dp else 0.dp,
            top = if (padding == "default") padBlock.dp else 0.dp, bottom = if (padding == "default") padBlock.dp else 0.dp)
        // columnheader / rowheader: a heading named by its content (a control inside it keeps its own node).
        .semantics(mergeDescendants = head) { if (head) heading() }, contentAlignment = Alignment.CenterStart) {
        Row(Modifier.align(when (horizontal) { Alignment.End -> Alignment.CenterEnd; Alignment.CenterHorizontally -> Alignment.Center; else -> Alignment.CenterStart })
            .onGloballyPositioned { c -> if (!showPin) inspection?.let { ins -> ins.contents[p.str("id")] = c.tableBox(density) } },
            verticalAlignment = Alignment.CenterVertically) {
            if (showPin) { NativeTablePin(p.str("pinIcon").ifEmpty { owner.props.str("pinIcon") }, if (owner.forced) pal.color("on-surface") else tableColor(vars.color("--md-table-cell-pin-color") ?: pal.hex("primary")),
                vars.length("--md-table-cell-pin-size")); Spacer(Modifier.width(4.dp)) }
            // The content box is the slotted content (the pin glyph sits in the cell's own shadow part before it).
            Row(Modifier.onGloballyPositioned { c -> if (showPin) inspection?.let { ins -> ins.contents[p.str("id")] = c.tableBox(density) } },
                verticalAlignment = Alignment.CenterVertically) {
            // Head and foot cells (weight 500) keep their text on one line: the Compose paragraph at 500 can need more than the
            // measured run advance and would wrap a word that fits its column.
            CompositionLocalProvider(LocalTextStyle provides tableTextStyle(size, line, weight, tracking, color, numeric), LocalAWCSourceText provides true,
                LocalAWCSlotTextNoWrap provides (head || group == NativeTableGroup.FOOT || p.bool("ellipsis")), LocalNativeTableCheckbox provides checkbox, LocalAWCTableVars provides vars,
                LocalAWCCheckboxAppearance provides if (m.compact) LocalAWCCheckboxAppearance.current.merge(AWCCheckboxAppearance(touchTargetSize = 32.0)) else LocalAWCCheckboxAppearance.current) {
                content?.invoke("")
            } }
        }
    }
}

@Composable private fun NativeTablePin(icon: String, tint: Color, glyph: Double? = null) {
    if (icon.isNotEmpty()) CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides tint) { AWCMaterialSymbol(icon, size = (glyph ?: 14.0).dp) }
    else Canvas(Modifier.size((glyph ?: 16.0).dp)) {
        val s = size.width / 24f
        val pts = listOf(16f to 12f, 16f to 4f, 17f to 4f, 17f to 2f, 7f to 2f, 7f to 4f, 8f to 4f, 8f to 12f, 6f to 14f, 6f to 16f, 11.2f to 16f, 11.2f to 22f, 12.8f to 22f, 12.8f to 16f, 18f to 16f, 18f to 14f)
        val path = Path().apply { pts.forEachIndexed { i, (x, y) -> if (i == 0) moveTo(x * s, y * s) else lineTo(x * s, y * s) }; close() }
        rotate(45f) { drawPath(path, tint) }
    }
}

// MARK: md-table-sort-label

@Composable internal fun NativeTableSortLabel(p: Props, onEvent: EventSink, content: Slot?) {
    val owner = LocalNativeTableOwner.current
    val cellData = LocalNativeTableCellData.current
    AWCTableTrace.hit("sortlabel.compose")
    SideEffect { if (cellData != null && !cellData.sortLabel) cellData.sortLabel = true }
    val tokens = LocalAWCThemeTokens.current; val forced = LocalAWCTableForcedColors.current
    val pal = owner?.palette ?: NativeTablePalette(tokens, forced)
    val column = p.str("column")
    val active = owner?.let { column.isNotEmpty() && column == it.effectiveSortBy } ?: p.bool("active")
    val order = if (active) owner?.effectiveSortOrder ?: (p.str("order").takeIf { it == "asc" || it == "desc" } ?: "asc") else "none"
    val labelInspection = LocalAWCTableInspection.current
    val disabled = p.bool("disabled")
    var hovered by remember { mutableStateOf(false) }
    val reduced = owner?.reduced ?: false
    val labelDensity = (p["density"] as? Number)?.toDouble()?.takeIf { it in listOf(-1.0, -2.0, -3.0, -4.0) }
    val gap = if ((labelDensity ?: owner?.metrics?.scale ?: 0.0) <= -4) 2.dp else 4.dp
    // --md-table-sort-label-* (the label's own declarations over the cell's / container's).
    val hooks = LocalAWCTableVars.current.merging(p.str("style")); val hookOff = owner?.forced ?: forced
    val activeColor = (if (hookOff) null else hooks.color("--md-table-sort-label-active-color"))?.let { tableColor(it) } ?: pal.color("primary")
    val rest = (if (hookOff) null else hooks.color("--md-table-sort-label-color"))?.let { tableColor(it) } ?: if (owner?.vibrant == true) pal.color("on-primary-container") else pal.color("on-surface")
    val iconSize = (hooks.length("--md-table-sort-label-icon-size") ?: 18.0).dp
    val color by animateColorAsState(if (active || (hovered && !disabled)) activeColor else rest, if (reduced) snap() else tween(150, easing = CubicBezierEasing(0.31f, 0.94f, 0.34f, 1f)), label = "sort-color")
    var focused by remember { mutableStateOf(false) }
    val labelFocus = remember { FocusRequester() }
    val inputMode = androidx.compose.ui.platform.LocalInputModeManager.current
    val focusVisible = focused && inputMode.inputMode == androidx.compose.ui.input.InputMode.Keyboard
    // The hover rule (:host(:hover:not(--disabled)), specificity 0,4,0) beats the active one (0,3,0); focus-visible ties with
    // active and loses to it (source order).
    val iconTarget = when { hovered && !disabled -> 0.6f; active -> 1f; focusVisible -> 0.6f; p.str("inactiveIcon") == "hover" -> 0f
        else -> (hooks.number("--md-table-sort-label-rest-opacity")?.coerceIn(0.0, 1.0) ?: 0.38).toFloat() }
    labelInspection?.let { ins -> SideEffect { ins.metrics["sort:" + p.str("id")] = listOf(active, order, iconTarget.toDouble(), focused) } }
    val iconAlpha by animateFloatAsState(iconTarget, if (reduced) snap() else tween(150, easing = CubicBezierEasing(0.31f, 0.94f, 0.34f, 1f)), label = "sort-op")
    val ringColor = pal.color("secondary")
    val rotation by animateFloatAsState(if (active && order == "desc") 180f else 0f, if (reduced) snap() else tween(350, easing = CubicBezierEasing(0.42f, 1.67f, 0.21f, 0.9f)), label = "sort-rot")
    val style = LocalTextStyle.current.copy(color = color)
    fun activate() {
        if (disabled || column.isEmpty()) return
        if (AWCTableTrace.activations) android.util.Log.w("AWCTable", "DIAG sort-label activate $column", Throwable())
        val def = if (p.str("defaultOrder") == "desc") "desc" else "asc"
        // md-table stops mdSortRequest at its boundary and answers with mdSortChange; a label alone lets it bubble.
        if (owner != null) owner.requestSort(column, def) else onEvent("mdSortRequest", mapOf("column" to column, "defaultOrder" to def))
    }
    val arrow: @Composable () -> Unit = {
        Box(Modifier.size(iconSize).graphicsLayer { owner?.motion?.let { it.record("sort-rot:" + p.str("id"), (rotation / 180f).toDouble()); it.record("sort-op:" + p.str("id"), iconAlpha.toDouble()) }
            alpha = iconAlpha; rotationZ = rotation }) {
            if (p.str("icon").isNotEmpty()) CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides color) { AWCMaterialSymbol(p.str("icon"), size = iconSize) }
            else Canvas(Modifier.size(iconSize)) { val s = size.width / 24f
                val pts = listOf(4f to 12f, 5.41f to 13.41f, 11f to 7.83f, 11f to 20f, 13f to 20f, 13f to 7.83f, 18.58f to 13.42f, 20f to 12f, 12f to 4f)
                drawPath(Path().apply { pts.forEachIndexed { i, (x, y) -> if (i == 0) moveTo(x * s, y * s) else lineTo(x * s, y * s) }; close() }, color) }
        }
    }
    Row(Modifier.layout { me, c -> val over = 8.dp.roundToPx()
            // margin-inline: -4px — the label's border box overhangs the cell's content box by 4 dp on each side.
            val pl = me.measure(c.copy(minWidth = 0, maxWidth = if (c.hasBoundedWidth) c.maxWidth + over else c.maxWidth))
            layout((pl.width - over).coerceAtLeast(0), pl.height) { pl.placeRelative(-over / 2, 0) } }
        // :focus-visible — 3 dp secondary outline, offset 2 dp, following the 4 dp corners.
        .drawWithContent { drawContent(); if (focusVisible) drawRoundRect(ringColor, Offset(-3.5.dp.toPx(), -3.5.dp.toPx()), Size(size.width + 7.dp.toPx(), size.height + 7.dp.toPx()),
            androidx.compose.ui.geometry.CornerRadius(7.5.dp.toPx()), style = androidx.compose.ui.graphics.drawscope.Stroke(3.dp.toPx())) }
        .clip(RoundedCornerShape(4.dp))
        .pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent()
            val inside = e.changes.firstOrNull()?.position?.let { it.x >= 0 && it.y >= 0 && it.x < size.width && it.y < size.height } ?: false
            when (e.type) {
                PointerEventType.Enter, PointerEventType.Move, PointerEventType.Release -> hovered = inside
                // A mouse press focuses the label (tabindex 0) without the keyboard ring, like the browser's mousedown.
                PointerEventType.Press -> { hovered = inside; if (inside && !disabled) runCatching { labelFocus.requestFocus() } }
                PointerEventType.Exit -> if (e.changes.none { it.pressed }) hovered = false
            } } } }
        .focusProperties { canFocus = true }
        .focusRequester(labelFocus)
        .onFocusChanged { focused = it.isFocused }
        .onPreviewKeyEvent { e -> if (!disabled && e.type == KeyEventType.KeyDown && (e.key == Key.Enter || e.key == Key.NumPadEnter || e.key == Key.Spacebar)) { activate(); true } else false }
        .clickable(enabled = !disabled, interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, indication = null) { activate() }
        .graphicsLayer { alpha = if (disabled) 0.6f else 1f }
        .padding(horizontal = 4.dp, vertical = 2.dp)
        // Its sort status (Web: the sr-only aria-live="polite" text in the name) is the button's state, announced politely.
        .semantics { role = Role.Button; liveRegion = LiveRegionMode.Polite; if (active) stateDescription = if (order == "desc") p.str("sortedDescendingLabel", "sorted descending") else p.str("sortedAscendingLabel", "sorted ascending") },
        horizontalArrangement = Arrangement.spacedBy(hooks.length("--md-table-sort-label-gap")?.dp ?: gap), verticalAlignment = Alignment.CenterVertically) {
        if (p.str("iconPosition") == "start") arrow()
        CompositionLocalProvider(LocalTextStyle provides style, LocalAWCSlotTextNoWrap provides true) { content?.invoke("") }
        if (p.str("iconPosition") != "start") arrow()
    }
}

// MARK: md-table-expand-toggle

@Composable internal fun NativeTableExpandToggle(p: Props, onEvent: EventSink) {
    val owner = LocalNativeTableOwner.current; val row = LocalNativeTableRow.current
    val keyboard = androidx.compose.ui.platform.LocalInputModeManager.current
    val expanded = row != null && owner != null && owner.isExpanded(row)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    // --md-table-expand-toggle-rotation (expanded; default 90°).
    val turn = (LocalAWCTableVars.current.merging(p.str("style")).angle("--md-table-expand-toggle-rotation") ?: 90.0).toFloat()
    val rotation by animateFloatAsState(if (expanded) turn else 0f, if (owner?.reduced == true) snap() else tween(350, easing = CubicBezierEasing(0.42f, 1.67f, 0.21f, 0.9f)), label = "caret")
    // Probe in the source's terms: the caret's matrix angle / 90° (RTL scaleX(-1) rotate(r): 180° closed, 180° − r open).
    // The activation's source: a pointer press / release on the toggle just before its mdClick (the input mode can lag behind).
    val lastPointer = remember { longArrayOf(0L) }
    Box(Modifier.pointerInput(Unit) { awaitPointerEventScope { while (true) { val e = awaitPointerEvent(PointerEventPass.Initial)
            if (e.type == PointerEventType.Press || e.type == PointerEventType.Release) lastPointer[0] = android.os.SystemClock.uptimeMillis() } } }
        .graphicsLayer { owner?.motion?.record("caret:" + p.str("id"), (if (rtl) (180f - rotation) / 90f else rotation / 90f).toDouble()); scaleX = if (rtl) -1f else 1f; rotationZ = if (rtl) -rotation else rotation }) {
        AWCComponent("md-icon-button", mapOf("size" to "xs", "icon" to p.str("icon").ifEmpty { "chevron_right" }, "aria-label" to p.str("buttonLabel", "Expand row"), "id" to p.str("id") + "-button",
                "aria-expanded" to expanded.toString()),
            // Pointer: the toggle's click handler opens the row before the inner button's mdClick reaches the page;
            // keyboard: the button's key handler emits mdClick first.
            onEvent = { name, detail -> if (name == "mdClick" && AWCTableTrace.activations) android.util.Log.w("AWCTable", "DIAG expand-toggle mdClick ${p.str("id")} mode ${keyboard.inputMode}", Throwable())
                val pointer = android.os.SystemClock.uptimeMillis() - lastPointer[0] < 500 || keyboard.inputMode != androidx.compose.ui.input.InputMode.Keyboard
                if (name == "mdClick" && row != null) { if (!pointer) { onEvent(name, detail); owner?.toggle(row) } else { owner?.toggle(row); onEvent(name, detail) } } else onEvent(name, detail) })
    }
}

// MARK: md-table-container, toolbar, pagination

@Composable internal fun NativeTableContainer(p: Props, onEvent: EventSink, content: Slot?) {
    var hasBottom by remember { mutableStateOf(false) }
    val frozenChild = remember { mutableStateOf(false) }
    val frozen = frozenChild.value
    val tokens = LocalAWCThemeTokens.current; val forced = LocalAWCTableForcedColors.current
    val pal = NativeTablePalette(tokens, forced)
    val variant = p.str("variant").takeIf { it == "outlined" || it == "filled" || it == "flat" } ?: "elevated"
    // The `shape` class always sets the radius (--md-table-container-shape is the base the classes override; readme).
    val radius = mapOf("extra-large" to 28, "large" to 16, "medium" to 12, "small" to 8, "none" to 0)[p.str("shape", "large")] ?: 16
    val vars = LocalAWCTableVars.current.merging(p.str("style"))
    // --md-table-surface: each variant rule re-sets it on the host and an authored declaration wins (--md-table-container-color,
    // the base background, is always covered by a variant rule — readme).
    val surface = (if (forced) null else vars.color("--md-table-surface")) ?: if (variant == "elevated" || variant == "filled") pal.hex("surface-container-low") else pal.hex("surface")
    val bg = if (p.bool("vibrant") && !forced) tableMix(pal.hex("primary"), 0.06, pal.hex("surface")) else if (variant == "flat") Color.Transparent else tableColor(surface)
    val outlineWidth = if (variant == "outlined") vars.length("--md-table-container-outline-width") ?: 1.0 else 0.0
    val outlineColor = tableColor((if (forced) null else vars.color("--md-table-container-outline-color")) ?: pal.hex("outline-variant"))
    val maxH = AWCTableTemplate.length(p.str("maxHeight")); val minH = AWCTableTemplate.length(p.str("minHeight"))
    val count = remember { mutableStateOf<Int?>(null) }
    val armRef = remember { arrayOfNulls<() -> Unit>(1) }
    val ctx = NativeTableContainerContext(surface, p.bool("vibrant"), hasBottom, if (frozen) maxH else null, count, frozenChild, armRef)
    val hScroll = rememberScrollState(); val vScroll = rememberScrollState()
    val containerInspection = LocalAWCTableInspection.current
    val scale = LocalDensity.current.density
    LaunchedEffect(hScroll, vScroll) { snapshotFlow { hScroll.value to vScroll.value }.collect { (x, y) -> containerInspection?.metrics?.set("container.scroll", listOf(x / scale, y / scale)) } }
    val controller = LocalAWCTableScrollController.current; val density = LocalDensity.current
    SideEffect { controller?.let { it.horizontal = hScroll; it.vertical = vScroll; it.density = density.density } }
    val shape = RoundedCornerShape(radius.dp)
    // box-shadow: an explicit `elevation` level wins, else the elevated variant's --md-table-container-elevation (elevation-1).
    val level = (p["elevation"] as? Number)?.toInt()
    val shadowCss = if (forced) null else if (level != null) tokens["--md-sys-elevation-$level"] ?: dev.awc.nativeui.generated.AWCGeneratedTokens.light["--md-sys-elevation-$level"]
        else if (variant == "elevated") vars["--md-table-container-elevation"] ?: tokens["--md-sys-elevation-1"] ?: "0 1px 2px rgba(0, 0, 0, 0.08)" else null
    val shadowLayers = remember(shadowCss) { NativeShadowLayer.parse(shadowCss) }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val arrowScope = rememberCoroutineScope()
    Column(Modifier.fillMaxWidth()
        .onGloballyPositioned { c -> containerInspection?.let { ins -> val b = c.boundsInRoot(); ins.metrics["container.center"] = listOf((b.center.x / scale).toDouble(), (b.center.y / scale).toDouble()) } }
        .accordionShadow(AWCCornerShape.uniform(radius.toDouble()), shadowLayers, inset = false)
        .clip(shape).background(bg)
        .then(if (outlineWidth > 0) Modifier.border(outlineWidth.dp, outlineColor, shape).padding(outlineWidth.dp) else Modifier)
        // Arrows never move focus between the family's controls (no grid keyboard model); the scrollport below scrolls with them.
        .onKeyEvent { e -> e.key in NativeTableArrows }) {
        CompositionLocalProvider(LocalNativeTableContainer provides ctx, LocalAWCTableVars provides vars) {
            content?.invoke("top")
            if (frozen) content?.invoke("")
            else BoxWithConstraints(Modifier.fillMaxWidth().heightIn(min = (minH ?: 0.0).dp, max = maxH?.dp ?: Dp.Infinity)) {
                val mw = maxWidth; val mh = maxHeight
                // The browser's arrow scrolling on the container's scrollport (40 px per press, smooth) for arrows the focused
                // control inside does not use.
                Box(Modifier.onKeyEvent { e ->
                        if (e.type != KeyEventType.KeyDown || e.key !in NativeTableArrows || e.isCtrlPressed || e.isAltPressed || e.isMetaPressed) return@onKeyEvent e.key in NativeTableArrows
                        val step = 40 * density.density; val ease = tween<Float>(150, easing = CubicBezierEasing(0.42f, 0f, 0.58f, 1f))
                        when (e.key) {
                            Key.DirectionRight -> arrowScope.launch { hScroll.animateScrollBy(if (rtl) -step else step, ease) }
                            Key.DirectionLeft -> arrowScope.launch { hScroll.animateScrollBy(if (rtl) step else -step, ease) }
                            Key.DirectionDown -> if (maxH != null) arrowScope.launch { vScroll.animateScrollBy(step, ease) }
                            else -> if (maxH != null) arrowScope.launch { vScroll.animateScrollBy(-step, ease) }
                        }
                        true
                    }.horizontalScroll(hScroll).then(if (maxH != null) Modifier.verticalScroll(vScroll) else Modifier)) {
                    Box(Modifier.widthIn(min = mw)) { NativeTableScrollContext(hScroll, vScroll, mw, mh) { content?.invoke("") } }
                }
            }
            NativeTableSlot(onPresence = { hasBottom = it }) { Column { content?.invoke("bottom") } }
        }
    }
}
/** Hands the scroll offsets to the table inside (pinned cells / sticky rows read them during placement). */
@Composable private fun NativeTableScrollContext(h: ScrollState, v: ScrollState, width: Dp, height: Dp, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalNativeTableScroll provides NativeTableScroll(h, v, width, height), content = content)
}
internal class NativeTableScroll(val h: ScrollState, val v: ScrollState, val width: Dp, val height: Dp)
internal val LocalNativeTableScroll = staticCompositionLocalOf<NativeTableScroll?> { null }

internal fun Modifier.awcTableShadow(css: String?, shape: androidx.compose.ui.graphics.Shape): Modifier = this.shadow(1.dp, shape, clip = false,
    ambientColor = Color.Black.copy(alpha = 0.15f), spotColor = Color.Black.copy(alpha = 0.3f))

@Composable internal fun NativeTableToolbar(p: Props, onEvent: EventSink, content: Slot?) {
    var hasLeading by remember { mutableStateOf(false) }
    val tokens = LocalAWCThemeTokens.current; val forced = LocalAWCTableForcedColors.current
    val pal = NativeTablePalette(tokens, forced)
    val ctx = LocalNativeTableContainer.current
    val scale = resolveAWCDensity(p["density"], LocalAWCNativeDensity.current)
    val count = if (p.bool("autoBind")) ctx?.selectionCount?.value ?: p.int("numSelected") else p.int("numSelected")
    LocalAWCTableInspection.current?.let { ins -> SideEffect { ins.metrics["toolbar.numSelected"] = count } }
    val compact = p.bool("compact"); val selection = count > 0
    val vars = LocalAWCTableVars.current.merging(p.str("style"))
    fun hook(name: String) = if (forced) null else vars.color(name)?.let { tableColor(it) }
    val fg = if (selection) hook("--md-table-toolbar-selection-color") ?: pal.color("on-secondary-container") else hook("--md-table-toolbar-color") ?: pal.color("on-surface")
    val gap = max(8.0, 16 + scale * 2); val padInline = vars.length("--md-table-toolbar-padding-inline") ?: max(12.0, 24 + scale * 2)
    // `compact` wins over the hooks (it re-sets --_pad-block / --_min-h).
    val minH = if (compact) 48.0 else vars.length("--md-table-toolbar-min-height") ?: (64 + scale * 4)
    val padBlock = if (compact) 6.0 else vars.length("--md-table-toolbar-padding-block") ?: if (scale <= -2) 8.0 else 12.0
    val toolbarBg = if (selection) hook("--md-table-toolbar-selection-bg") ?: pal.color("secondary-container") else hook("--md-table-toolbar-bg") ?: Color.Transparent
    Row(Modifier.fillMaxWidth().background(toolbarBg)
        .padding(horizontal = padInline.dp, vertical = padBlock.dp).heightIn(min = minH.dp)
        .semantics { contentDescription = p.str("headline").ifEmpty { "Table toolbar" } },
        verticalAlignment = Alignment.CenterVertically) {
        // The leading part takes a flex gap whenever it is shown (authored content, or the empty part in selection mode).
        if (selection) Spacer(Modifier.width(gap.dp))
        else NativeTableSlot(Modifier.padding(end = if (hasLeading) gap.dp else 0.dp), onPresence = { hasLeading = it }) { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { content?.invoke("leading") } }
        Box(Modifier.weight(1f).padding(end = gap.dp)) {
            if (selection) BasicText(awcTableSelectedLabel(p.str("labelSelected", "%count% selected"), count), Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                style = tableTextStyle(max(13.0, 16 + scale * 0.5), max(18.0, 24 + scale), 500, 0.0, fg))
            else Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                // The headline / supporting-text slots replace the property text (rendered only while that property is set).
                if (p.str("headline").isNotEmpty()) {
                    val style = tableTextStyle(if (compact) 16.0 else max(16.0, 22 + scale), if (compact) 24.0 else max(22.0, 28 + scale), 400, 0.0, fg)
                    var slotted by remember { mutableStateOf(false) }
                    NativeTableSlot(Modifier.semantics { heading() }, onPresence = { slotted = it }) { CompositionLocalProvider(LocalTextStyle provides style, LocalAWCSourceText provides true) { content?.invoke("headline") } }
                    if (!slotted) BasicText(p.str("headline"), Modifier.semantics { heading() }, style = style)
                }
                if (p.str("supportingText").isNotEmpty()) {
                    val style = tableTextStyle(14.0, 20.0, 400, 0.25, pal.color("on-surface-variant"))
                    var slotted by remember { mutableStateOf(false) }
                    NativeTableSlot(onPresence = { slotted = it }) { CompositionLocalProvider(LocalTextStyle provides style, LocalAWCSourceText provides true) { content?.invoke("supporting-text") } }
                    if (!slotted) BasicText(p.str("supportingText"), style = style)
                }
                if (p.str("headline").isEmpty() && p.str("supportingText").isEmpty()) content?.invoke("title-area")
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(max(0.0, 4 + scale).dp), verticalAlignment = Alignment.CenterVertically) {
            AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconSize = max(18.0, 24 + scale), width = max(32.0, 40 + scale * 4), height = max(32.0, 40 + scale * 4))) {
                content?.invoke(if (selection) "selection-actions" else "actions")
            }
        }
    }
}

@Composable internal fun NativeTablePagination(p: Props, onEvent: EventSink, content: Slot?) {
    val tokens = LocalAWCThemeTokens.current; val forced = LocalAWCTableForcedColors.current
    val pal = NativeTablePalette(tokens, forced)
    val scale = resolveAWCDensity(p["density"], LocalAWCNativeDensity.current)
    var page by remember(p["page"]) { mutableStateOf(p.int("page")) }
    var rpp by remember(p["rowsPerPage"]) { mutableStateOf(p.int("rowsPerPage", 10)) }
    val model = AWCTablePaginationModel(p.int("count"), page, rpp)
    val compact = p.bool("compact"); val disabled = p.bool("disabled")
    val vars = LocalAWCTableVars.current.merging(p.str("style"))
    val fg = (if (forced) null else vars.color("--md-table-pagination-color"))?.let { tableColor(it) } ?: pal.color("on-surface-variant")
    val pageBg = (if (forced) null else vars.color("--md-table-pagination-bg"))?.let { tableColor(it) } ?: Color.Transparent
    val size = max(10.0, 12 + scale * 0.5); val line = max(14.0, 16 + scale * 0.5)
    val options = AWCTablePaginationModel.options(p.str("rowsPerPageOptions", "5,10,25,50"), model.count, p.str("labelAll", "All"))
    val selectDensity = if (scale <= -2) max(-4.0, scale) else -2.0
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val arm = LocalNativeTableContainer.current?.armTable
    fun go(t: Int) { val target = t.coerceIn(0, model.lastPage); if (target != model.clampedPage) { page = target; arm?.get(0)?.invoke(); onEvent("mdPageChange", mapOf("page" to target)) } }
    fun setRows(n: Int) { if (n > 0 && n != model.rowsPerPage) { rpp = n; page = 0; arm?.get(0)?.invoke(); onEvent("mdRowsPerPageChange", mapOf("rowsPerPage" to n)); onEvent("mdPageChange", mapOf("page" to 0)) } }
    val controller = LocalAWCTablePaginationControllers.current[p.str("id")]
    SideEffect { controller?.let { it.go = { t -> go(t) }; it.rows = { n -> setRows(n) }; it.connected = true } }
    LocalAWCTableInspection.current?.metrics?.let { ms -> SideEffect { ms["pagination.page"] = model.clampedPage; ms["pagination.rowsPerPage"] = model.rowsPerPage
        ms["pagination.display"] = model.display(p.str("labelDisplayedRows", "%from%–%to% of %count%")); ms["pagination.prevDisabled"] = disabled || model.clampedPage == 0
        ms["pagination.nextDisabled"] = disabled || model.clampedPage >= model.lastPage } }
    // `compact` wins over --md-table-pagination-padding-block. The source declares --md-table-pagination-padding-inline
    // (--_pad-inline) but its padding-inline never reads it: no effect there, none here (decision log).
    Row(Modifier.fillMaxWidth().graphicsLayer { alpha = if (disabled) 0.6f else 1f }.background(pageBg)
        .padding(horizontal = max(8.0, 16 + scale * 2).dp, vertical = if (compact) 4.dp else (vars.length("--md-table-pagination-padding-block")?.dp ?: if (scale <= -3) 4.dp else 8.dp))
        .semantics { contentDescription = p.str("label", "Pagination") },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy((if (compact) 12.0 else max(12.0, 24 + scale * 3)).dp)) {
        BasicText(model.display(p.str("labelDisplayedRows", "%from%–%to% of %count%")), Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite }, style = tableTextStyle(size, line, 400, 0.4, fg), maxLines = 1)
        Row(horizontalArrangement = Arrangement.spacedBy(max(4.0, 8 + scale).dp), verticalAlignment = Alignment.CenterVertically) {
            BasicText(p.str("labelRowsPerPage", "Rows per page:"), Modifier.clearAndSetSemantics { }, style = tableTextStyle(size, line, 400, 0.4, fg), maxLines = 1)
            val rppInspection = LocalAWCTableInspection.current; val rppDensity = LocalDensity.current
            Box(Modifier.size((vars.length("--md-table-pagination-select-width") ?: max(56.0, 80 + selectDensity * 4)).dp, (56 + selectDensity * 4).dp)
                .onGloballyPositioned { c -> rppInspection?.metrics?.set("pagination.rpp", c.tableBox(rppDensity).let { listOf(it.x, it.y, it.width, it.height) }) }) {
                AWCComponent("md-select", mapOf("options" to options.map { mapOf("value" to it.first.toString(), "label" to it.second) }, "value" to model.rowsPerPage.toString(),
                    "density" to selectDensity, "disabled" to disabled, "placement" to "top-start", "ariaLabel" to p.str("labelRowsPerPage", "Rows per page:")),
                    // Internal select / buttons' events stop at the pagination (onInternalChrome).
                    onEvent = { name, detail -> if (name !in setOf("mdChange", "mdClick", "mdOpen", "mdClose")) onEvent(name, detail)
                        if (name == "mdChange") { val n = (detail as? String ?: awcMap(detail)["value"]?.toString())?.toIntOrNull()
                            if (n != null) setRows(n) } })
            }
        }
        Row(Modifier.graphicsLayer { scaleX = if (rtl) -1f else 1f }, horizontalArrangement = Arrangement.spacedBy(max(0.0, 4 + scale).dp), verticalAlignment = Alignment.CenterVertically) {
            AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconSize = max(18.0, 24 + scale), width = max(32.0, 40 + scale * 4), height = max(32.0, 40 + scale * 4))) {
                @Composable fun nav(icon: String, label: String, off: Boolean, action: () -> Unit) =
                    AWCComponent("md-icon-button", mapOf("size" to "sm", "icon" to icon, "aria-label" to label, "disabled" to off), onEvent = { n, d -> if (n !in setOf("mdChange", "mdClick", "mdOpen", "mdClose")) onEvent(n, d); if (n == "mdClick") action() })
                if (p.bool("showFirstLast")) nav("first_page", p.str("labelFirstPage", "First page"), disabled || model.clampedPage == 0) { go(0) }
                nav("chevron_left", p.str("labelPreviousPage", "Previous page"), disabled || model.clampedPage == 0) { go(model.clampedPage - 1) }
                nav("chevron_right", p.str("labelNextPage", "Next page"), disabled || model.clampedPage >= model.lastPage) { go(model.clampedPage + 1) }
                if (p.bool("showFirstLast")) nav("last_page", p.str("labelLastPage", "Last page"), disabled || model.clampedPage >= model.lastPage) { go(model.lastPage) }
                content?.invoke("actions")
            }
        }
    }
}
