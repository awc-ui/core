package dev.awc.playground

import androidx.compose.runtime.Composable
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject

/** The md-table family in the Laboratory host: typed hooks of the selected member (defaults first, local values win), retained
 *  updates with the source property types (eleven tags), the methods with results (md-table, md-table-row,
 *  md-table-pagination) and the shared example (the SwiftUI host's AWCExamples table) as the preview's children. */
internal val livePreviewTableTags = setOf("md-table", "md-table-container", "md-table-head", "md-table-body", "md-table-foot", "md-table-row", "md-table-cell",
    "md-table-toolbar", "md-table-sort-label", "md-table-pagination", "md-table-expand-toggle")
private val tableMethods = mapOf(
    "md-table" to setOf("getSelection", "selectAll", "deselectAll", "toggleSelectAll", "setSort", "pinColumn", "setColumnVisibility", "animateNextChange"),
    "md-table-row" to setOf("toggle"), "md-table-pagination" to setOf("goToPage", "setRowsPerPage"))
internal val livePreviewTableMethodTags = tableMethods.keys

internal class LivePreviewTableOptions(
    val table: AWCTableAppearance = AWCTableAppearance(), val cell: AWCTableCellAppearance = AWCTableCellAppearance(),
    val container: AWCTableContainerAppearance = AWCTableContainerAppearance(), val expandToggle: AWCTableExpandToggleAppearance = AWCTableExpandToggleAppearance(),
    val pagination: AWCTablePaginationAppearance = AWCTablePaginationAppearance(), val row: AWCTableRowAppearance = AWCTableRowAppearance(),
    val sortLabel: AWCTableSortLabelAppearance = AWCTableSortLabelAppearance(), val toolbar: AWCTableToolbarAppearance = AWCTableToolbarAppearance())

private fun tableJson(value: Any?): Any? = when (value) {
    JSONObject.NULL -> null
    is JSONObject -> value.keys().asSequence().associateWith { tableJson(value.opt(it)) }
    is JSONArray -> List(value.length()) { tableJson(value.opt(it)) }
    is Number -> value.toDouble()
    else -> value
}
private fun tableValues(request: JSONObject, field: String): Map<String, Any?> {
    val obj = request.optJSONObject(field) ?: return emptyMap()
    return obj.keys().asSequence().associateWith { tableJson(obj.opt(it)) }
}
internal fun parseLivePreviewTableOptions(request: JSONObject): LivePreviewTableOptions {
    fun pair(key: String) = tableValues(request, "${key}Defaults") to tableValues(request, key)
    return when (request.optString("tag")) {
        "md-table" -> pair("tableAppearance").let { (d, l) -> LivePreviewTableOptions(table = AWCTableAppearance.fromValues(d).merging(AWCTableAppearance.fromValues(l))) }
        "md-table-cell" -> pair("tableCellAppearance").let { (d, l) -> LivePreviewTableOptions(cell = AWCTableCellAppearance.fromValues(d).merging(AWCTableCellAppearance.fromValues(l))) }
        "md-table-container" -> pair("tableContainerAppearance").let { (d, l) -> LivePreviewTableOptions(container = AWCTableContainerAppearance.fromValues(d).merging(AWCTableContainerAppearance.fromValues(l))) }
        "md-table-expand-toggle" -> pair("tableExpandToggleAppearance").let { (d, l) -> LivePreviewTableOptions(expandToggle = AWCTableExpandToggleAppearance.fromValues(d).merging(AWCTableExpandToggleAppearance.fromValues(l))) }
        "md-table-pagination" -> pair("tablePaginationAppearance").let { (d, l) -> LivePreviewTableOptions(pagination = AWCTablePaginationAppearance.fromValues(d).merging(AWCTablePaginationAppearance.fromValues(l))) }
        "md-table-row" -> pair("tableRowAppearance").let { (d, l) -> LivePreviewTableOptions(row = AWCTableRowAppearance.fromValues(d).merging(AWCTableRowAppearance.fromValues(l))) }
        "md-table-sort-label" -> pair("tableSortLabelAppearance").let { (d, l) -> LivePreviewTableOptions(sortLabel = AWCTableSortLabelAppearance.fromValues(d).merging(AWCTableSortLabelAppearance.fromValues(l))) }
        "md-table-toolbar" -> pair("tableToolbarAppearance").let { (d, l) -> LivePreviewTableOptions(toolbar = AWCTableToolbarAppearance.fromValues(d).merging(AWCTableToolbarAppearance.fromValues(l))) }
        else -> LivePreviewTableOptions()
    }
}

/** The controllers attach to the preview's (id-less) table and pagination. */
@Composable internal fun LivePreviewTableScope(o: LivePreviewTableOptions, table: AWCTableController, pagination: AWCTablePaginationController, content: @Composable () -> Unit) =
    AWCTableAppearanceScope(o.table) { AWCTableCellAppearanceScope(o.cell) { AWCTableContainerAppearanceScope(o.container) { AWCTableExpandToggleAppearanceScope(o.expandToggle) {
        AWCTablePaginationAppearanceScope(o.pagination) { AWCTableRowAppearanceScope(o.row) { AWCTableSortLabelAppearanceScope(o.sortLabel) { AWCTableToolbarAppearanceScope(o.toolbar) {
            AWCTableControllerScope(mapOf("" to table), mapOf("" to pagination)) { content() }
        } } } } } } } }

// ---- the shared example (AWCExamples.tableExample on SwiftUI): the children of the previewed root ----
private fun node(tag: String, properties: JSONObject = JSONObject(), children: List<JSONObject> = emptyList(), slot: String? = null) =
    JSONObject().put("tag", tag).put("properties", properties).put("children", JSONArray(children)).also { if (slot != null) it.put("slot", slot) }
private fun text(value: String, slot: String? = null) = node("#text", JSONObject().put("text", value), slot = slot)
private fun cell(value: String, head: Boolean = false) = node("md-table-cell", JSONObject().put("head", head), listOf(text(value)))
private fun header() = node("md-table-head", children = listOf(node("md-table-row", children = listOf(
    node("md-table-cell", JSONObject().put("head", true), listOf(node("md-table-sort-label", JSONObject().put("column", "name"), listOf(text("Project"))))),
    cell("Status", true), cell("Members", true)))))
private fun rows() = listOf(listOf("AWC Native", "In progress", "8"), listOf("Design tokens", "Complete", "4"), listOf("Playground", "Review", "6")).mapIndexed { i, values ->
    node("md-table-row", JSONObject().put("value", "project-$i").put("selectable", true).put("clickable", true).put("expandable", i == 0),
        values.map { cell(it) } + text("Last updated today", "expanded"))
}
/** Children of the previewed root, or null when the root has none (a pagination, a sort label's text is its own). */
internal fun livePreviewTableExampleChildren(tag: String): JSONArray? = when (tag) {
    "md-table" -> JSONArray(listOf(header(), node("md-table-body", children = rows())))
    "md-table-container" -> JSONArray(listOf(node("md-table", JSONObject().put("caption", "Workspace projects").put("selection", "multiple").put("label", "Project table"),
        listOf(header(), node("md-table-body", children = rows())))))
    "md-table-head" -> header().getJSONArray("children")
    "md-table-body" -> JSONArray(rows())
    "md-table-foot" -> JSONArray(listOf(node("md-table-row", children = listOf(cell("Total"), cell("3 projects"), cell("18")))))
    "md-table-row" -> rows()[0].getJSONArray("children")
    "md-table-cell" -> JSONArray(listOf(text("AWC Native")))
    "md-table-toolbar" -> JSONArray(listOf(node("md-icon-button", JSONObject().put("icon", "filter_list"))))
    "md-table-sort-label" -> JSONArray(listOf(text("Project")))
    else -> null
}

// ---- retained updates (source property types) ----
private const val SORT = "e=asc|desc|none"
private val tableSpec = mapOf(
    "md-table" to "density:td columnTemplate:s columns:n minWidth:s stickyHeader:b frozenHeader:b keepHeight:b scrollbar:e=overlay|gutter pinMode:e=stack|static pinIcon:s stickyFooter:b striped:b noDividers:b hoverable:b motion:e=expressive|none selection:e=none|single|multiple sortBy:s sortOrder:$SORT loading:b loadingMode:e=overlay|skeleton loadingRows:n empty:b label:s caption:s summary:s rowOffset:n rowCount:n",
    "md-table-body" to "presentational:b", "md-table-foot" to "presentational:b",
    "md-table-cell" to "align:e=start|center|end|justify numeric:b padding:e=default|none|checkbox head:b scope:e=col|row|colgroup|rowgroup| sticky:e=start|end| colSpan:n rowSpan:n ellipsis:b variant:e=body|meta noPinIndicator:b pinIcon:s density:d",
    "md-table-container" to "variant:e=elevated|outlined|filled|flat shape:e=extra-large|large|medium|small|none maxHeight:s minHeight:s vibrant:b elevation:el",
    "md-table-expand-toggle" to "buttonLabel:s icon:s",
    "md-table-pagination" to "count:n page:n rowsPerPage:n rowsPerPageOptions:s showFirstLast:b labelDisplayedRows:s labelRowsPerPage:s labelFirstPage:s labelPreviousPage:s labelNextPage:s labelLastPage:s labelAll:s label:s compact:b disabled:b density:d",
    "md-table-row" to "rowgroup:e=head|body|foot selected:b disabled:b selectable:b clickable:b value:s expandable:b expanded:b highlight:b",
    "md-table-sort-label" to "column:s disabled:b defaultOrder:e=asc|desc iconPosition:e=start|end icon:s inactiveIcon:e=always|hover active:b order:$SORT sortedAscendingLabel:s sortedDescendingLabel:s density:d",
    "md-table-toolbar" to "headline:s supportingText:s numSelected:n autoBind:b labelSelected:s compact:b density:d",
).mapValues { (_, spec) -> spec.split(' ').associate { it.substringBefore(':') to it.substringAfter(':') } }
internal val livePreviewTableUpdateTags = tableSpec.keys
private fun tableFinite(v: Any?) = v is Number && v.toDouble().isFinite()

internal fun parseLivePreviewTableUpdate(tag: String, request: JSONObject): Map<String, AWCValue> {
    require(request.keys().asSequence().all { it in setOf("command", "properties") } && request.optString("command") == "update") { "Expected a property update." }
    val properties = request.getJSONObject("properties"); val types = tableSpec.getValue(tag)
    require(properties.length() > 0) { "A property update must contain at least one field." }
    return properties.keys().asSequence().associateWith { name ->
        val raw = properties.get(name); val type = types[name] ?: throw IllegalArgumentException("Unknown $tag property: $name")
        val ok = when (type) {
            "b" -> raw is Boolean
            "n" -> tableFinite(raw)
            "s" -> raw is String && raw.toByteArray().size <= 4096
            "d" -> raw is Number && raw.toDouble() in setOf(0.0, -1.0, -2.0, -3.0, -4.0)
            "td" -> raw is Number && raw.toDouble() in setOf(0.0, -1.0, -2.0, -3.0, -4.0) || raw is String && raw in setOf("compact", "standard", "comfortable")
            "el" -> raw is Number && raw.toDouble() in setOf(0.0, 1.0, 2.0, 3.0, 4.0, 5.0)
            else -> type.startsWith("e=") && raw is String && raw in type.removePrefix("e=").split('|')
        }
        require(ok) { "Invalid $tag $name." }
        tableJson(raw)
    }
}

/** The table / row / pagination methods through the native controllers; getSelection and pinColumn / setColumnVisibility return
 *  results, sent as {"awcTableResult": value} (null is a valid pinColumn result; the generic method-result contract rejects a bare null). */
internal fun invokeLivePreviewTableMethod(tag: String, request: JSONObject, rootId: String, table: AWCTableController, pagination: AWCTablePaginationController): Any? =
    tableMethodResult(tag, request, rootId, table, pagination)?.let { JSONObject().put("awcTableResult", it) }

private fun tableMethodResult(tag: String, request: JSONObject, rootId: String, table: AWCTableController, pagination: AWCTablePaginationController): Any? {
    val method = request.optString("method"); val args = request.optJSONArray("arguments") ?: JSONArray()
    require(tableMethods[tag]?.contains(method) == true) { "Unsupported native method." }
    fun index(i: Int): Int? = args.opt(i).let { v -> if (v is Number && v.toDouble() >= 0 && v.toDouble() == Math.floor(v.toDouble()) && v.toDouble() < 1e9) v.toInt() else null }
    if (tag == "md-table-pagination") {
        check(pagination.isConnected) { "The md-table-pagination is not mounted." }
        val n = args.opt(0)
        require(args.length() == 1 && n is Number && n.toDouble() == Math.floor(n.toDouble()) && Math.abs(n.toDouble()) < 1e9) { "$method requires one integer." }
        if (method == "goToPage") pagination.goToPage(n.toInt()) else { require(n.toInt() >= 1) { "setRowsPerPage requires a positive integer." }; pagination.setRowsPerPage(n.toInt()) }
        return null
    }
    check(table.isConnected) { "The $tag is not mounted." }
    if (tag == "md-table-row") { require(args.length() == 0) { "toggle requires no arguments." }; table.toggleRow(rootId); return null }
    return when (method) {
        "setSort" -> {
            val column = args.opt(0); val order = args.opt(1)
            require(args.length() == 2 && column is String && column.toByteArray().size <= 4096 && order in setOf("asc", "desc", "none")) { "setSort requires a column id and asc, desc or none." }
            table.setSort(column as String, order as String); null
        }
        "pinColumn" -> {
            val column = index(0); val side = args.opt(1)
            require(args.length() == 2 && column != null && side in setOf("start", "end", "none")) { "pinColumn requires a column index and start, end or none." }
            table.pinColumn(column!!, side as String) ?: JSONObject.NULL
        }
        "setColumnVisibility" -> {
            val column = index(0); val visible = args.opt(1)
            require(args.length() == 2 && column != null && visible is Boolean) { "setColumnVisibility requires a column index and a boolean." }
            table.setColumnVisibility(column!!, visible as Boolean)
        }
        else -> {
            require(args.length() == 0) { "$method requires no arguments." }
            when (method) {
                "getSelection" -> table.getSelection().let { s -> JSONObject().put("count", (s["count"] as Number).toInt()).put("total", (s["total"] as Number).toInt())
                    .put("values", JSONArray((s["values"] as List<*>).map { it.toString() })).put("all", s["all"]).put("indeterminate", s["indeterminate"]) }
                "selectAll" -> { table.selectAll(); null }
                "deselectAll" -> { table.deselectAll(); null }
                "toggleSelectAll" -> { table.toggleSelectAll(); null }
                else -> { table.animateNextChange(); null }
            }
        }
    }
}
