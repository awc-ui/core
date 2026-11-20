package dev.awc.nativeui

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// md-transfer-list: data, logic and CSS metrics for the Compose renderer and its parity tests
// (packages/core/src/components/md-transfer-list/md-transfer-list.{tsx,css}).

/** One item (`{value, label, description?, disabled?}`). */
data class AWCTransferItem(val value: String, val label: String, val description: String, val disabled: Boolean) {
    companion object {
        /** `items` as a list of maps, a JSON array or its JSON string; entries without a string or number value are skipped. */
        fun parse(v: Any?): List<AWCTransferItem> {
            val list: List<Any?> = when(v) {
                is String -> runCatching { JSONArray(v) }.getOrNull()?.let { a -> List(a.length()) { a.opt(it) } } ?: emptyList()
                is JSONArray -> List(v.length()) { v.opt(it) }
                is List<*> -> v
                else -> emptyList()
            }
            return list.mapNotNull { o ->
                fun get(k: String): Any? = when(o) { is JSONObject -> o.opt(k).takeUnless { it == JSONObject.NULL }; is Map<*, *> -> o[k]; else -> null }
                if(o !is JSONObject && o !is Map<*, *>) return@mapNotNull null
                val value = when(val raw = get("value")) { is String -> raw; is Number -> raw.toDouble().let { d -> if(d == Math.rint(d) && kotlin.math.abs(d) < 1e15) d.toLong().toString() else d.toString() }; else -> return@mapNotNull null }
                AWCTransferItem(value, get("label") as? String ?: value, get("description") as? String ?: "", get("disabled") == true)
            }
        }
    }
}

/** `--md-transfer-list-item-padding`: the CSS padding shorthand's physical sides (px as dp). */
data class AWCTransferListInsets(val top: Double, val right: Double, val bottom: Double, val left: Double) {
    constructor(all: Double) : this(all, all, all, all)
    constructor(block: Double, inline: Double) : this(block, inline, block, inline)
    internal val valid get() = listOf(top, right, bottom, left).all { it.isFinite() && it >= 0 }
}

/** The twenty `--md-transfer-list-*` hooks (px lengths as dp, `#RRGGBB[AA]` colours); null = the source default. */
data class AWCTransferListAppearance(
    val width: Double? = null, val minWidth: Double? = null, val maxWidth: Double? = null, val height: Double? = null, val minHeight: Double? = null, val maxHeight: Double? = null,
    val columnMinWidth: Double? = null, val columnMaxBlock: Double? = null, val containerShape: Double? = null, val containerColor: String? = null, val headerColor: String? = null,
    val headerTextColor: String? = null, val itemInset: Double? = null, val itemPadding: AWCTransferListInsets? = null, val itemGap: Double? = null,
    val dividerColor: String? = null, val controlsGap: Double? = null, val emptyIconSize: Double? = null, val controlSize: Double? = null, val controlIconSize: Double? = null) {
    fun validated(): AWCTransferListAppearance {
        fun l(v: Double?) = v?.takeIf { it.isFinite() && it >= 0 }
        fun c(v: String?) = v?.takeIf { Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$").matches(it) }?.uppercase()
        return AWCTransferListAppearance(l(width), l(minWidth), l(maxWidth), l(height), l(minHeight), l(maxHeight), l(columnMinWidth), l(columnMaxBlock), l(containerShape),
            c(containerColor), c(headerColor), c(headerTextColor), l(itemInset), itemPadding?.takeIf { it.valid }, l(itemGap), c(dividerColor), l(controlsGap),
            l(emptyIconSize), l(controlSize), l(controlIconSize))
    }
    companion object {
        /** Laboratory / snippet values keyed by field name (lengths as numbers, colours as hex strings, itemPadding as {top, right, bottom, left}). */
        fun of(values: Map<String, AWCValue>): AWCTransferListAppearance {
            fun t(k: String) = (values[k] as? String)?.takeIf { it.isNotEmpty() }
            fun n(k: String) = (values[k] as? Number)?.toDouble()
            val pad = (values["itemPadding"] as? Map<*, *>)?.let { m -> listOf("top", "right", "bottom", "left").map { (m[it] as? Number)?.toDouble() } }
                ?: (values["itemPadding"] as? org.json.JSONObject)?.let { o -> listOf("top", "right", "bottom", "left").map { if(o.has(it)) o.optDouble(it) else null } }
            return AWCTransferListAppearance(n("width"), n("minWidth"), n("maxWidth"), n("height"), n("minHeight"), n("maxHeight"), n("columnMinWidth"), n("columnMaxBlock"),
                n("containerShape"), t("containerColor"), t("headerColor"), t("headerTextColor"), n("itemInset"),
                pad?.takeIf { it.all { v -> v != null } }?.let { AWCTransferListInsets(it[0]!!, it[1]!!, it[2]!!, it[3]!!) }, n("itemGap"), t("dividerColor"), n("controlsGap"),
                n("emptyIconSize"), n("controlSize"), n("controlIconSize")).validated()
        }
    }
    /** Field-by-field merge: [inner] wins where set. */
    fun merging(inner: AWCTransferListAppearance) = AWCTransferListAppearance(inner.width ?: width, inner.minWidth ?: minWidth, inner.maxWidth ?: maxWidth, inner.height ?: height,
        inner.minHeight ?: minHeight, inner.maxHeight ?: maxHeight, inner.columnMinWidth ?: columnMinWidth, inner.columnMaxBlock ?: columnMaxBlock, inner.containerShape ?: containerShape,
        inner.containerColor ?: containerColor, inner.headerColor ?: headerColor, inner.headerTextColor ?: headerTextColor, inner.itemInset ?: itemInset,
        inner.itemPadding ?: itemPadding, inner.itemGap ?: itemGap, inner.dividerColor ?: dividerColor,
        inner.controlsGap ?: controlsGap, inner.emptyIconSize ?: emptyIconSize, inner.controlSize ?: controlSize, inner.controlIconSize ?: controlIconSize)
}

/** One `::part()` rule of md-transfer-list in typed form: what the part's own box paints (`#RRGGBB[AA]` colours, px lengths as dp).
 *  A part value wins over the hooks and every state rule (hover, checked, focus, disabled), as a `::part()` declaration of the outer
 *  tree does. A property the part does not paint is ignored ([AWCTransferListPartAppearance] lists them per part).
 *  [backgroundColor] `background-color`; [color] `color` (count text; empty text and icon; empty-icon glyph); [borderColor] `border-color`
 *  (column) / `border-block-end-color` (header: the divider under it); [shape] `border-radius` (column, count, item); [size] `font-size`
 *  (empty-icon); [opacity] `opacity` (empty-icon). */
data class AWCTransferListPartStyle(val backgroundColor: String? = null, val color: String? = null, val borderColor: String? = null,
                                    val shape: Double? = null, val size: Double? = null, val opacity: Double? = null) {
    fun validated(): AWCTransferListPartStyle {
        fun l(v: Double?) = v?.takeIf { it.isFinite() && it >= 0 }
        fun c(v: String?) = v?.takeIf { Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$").matches(it) }?.uppercase()
        return AWCTransferListPartStyle(c(backgroundColor), c(color), c(borderColor), l(shape), l(size), opacity?.takeIf { it.isFinite() }?.coerceIn(0.0, 1.0))
    }
    /** Field-by-field merge: [inner] wins where set. */
    fun merging(inner: AWCTransferListPartStyle) = AWCTransferListPartStyle(inner.backgroundColor ?: backgroundColor, inner.color ?: color, inner.borderColor ?: borderColor,
        inner.shape ?: shape, inner.size ?: size, inner.opacity ?: opacity)
    companion object {
        /** Laboratory / snippet values keyed by field name. */
        fun of(values: Map<*, *>): AWCTransferListPartStyle {
            fun t(k: String) = (values[k] as? String)?.takeIf { it.isNotEmpty() }
            fun n(k: String) = (values[k] as? Number)?.toDouble()
            return AWCTransferListPartStyle(t("backgroundColor"), t("color"), t("borderColor"), n("shape"), n("size"), n("opacity")).validated()
        }
    }
}

/** Typed counterparts of md-transfer-list's ten `::part()` names. What each part paints: column (backgroundColor, borderColor, shape),
 *  header (backgroundColor, borderColor: the divider under it), headerTitle (backgroundColor), count (backgroundColor, color, shape),
 *  search (backgroundColor: the field's padded box), list (backgroundColor), item (backgroundColor, which replaces the hover / checked /
 *  focus layers as `::part(item) { background-color }` does; shape: the row's corners, its focus ring and ripple), empty (backgroundColor,
 *  color: text and icon), emptyIcon (color, size, opacity), controls (backgroundColor). */
data class AWCTransferListPartAppearance(val column: AWCTransferListPartStyle = AWCTransferListPartStyle(), val header: AWCTransferListPartStyle = AWCTransferListPartStyle(),
                                         val headerTitle: AWCTransferListPartStyle = AWCTransferListPartStyle(), val count: AWCTransferListPartStyle = AWCTransferListPartStyle(),
                                         val search: AWCTransferListPartStyle = AWCTransferListPartStyle(), val list: AWCTransferListPartStyle = AWCTransferListPartStyle(),
                                         val item: AWCTransferListPartStyle = AWCTransferListPartStyle(), val empty: AWCTransferListPartStyle = AWCTransferListPartStyle(),
                                         val emptyIcon: AWCTransferListPartStyle = AWCTransferListPartStyle(), val controls: AWCTransferListPartStyle = AWCTransferListPartStyle(),
                                         /** `::part(column-source)` / `::part(column-target)`: one side's column, over [column]. */
                                         val columnSource: AWCTransferListPartStyle = AWCTransferListPartStyle(), val columnTarget: AWCTransferListPartStyle = AWCTransferListPartStyle()) {
    fun validated() = AWCTransferListPartAppearance(column.validated(), header.validated(), headerTitle.validated(), count.validated(), search.validated(), list.validated(),
        item.validated(), empty.validated(), emptyIcon.validated(), controls.validated(), columnSource.validated(), columnTarget.validated())
    /** Part by part, field by field: [inner] wins where set. */
    fun merging(inner: AWCTransferListPartAppearance) = AWCTransferListPartAppearance(column.merging(inner.column), header.merging(inner.header),
        headerTitle.merging(inner.headerTitle), count.merging(inner.count), search.merging(inner.search), list.merging(inner.list), item.merging(inner.item),
        empty.merging(inner.empty), emptyIcon.merging(inner.emptyIcon), controls.merging(inner.controls), columnSource.merging(inner.columnSource), columnTarget.merging(inner.columnTarget))
    companion object {
        /** Laboratory / snippet values keyed by the CSS part name: `{ "column": { "backgroundColor": "#FFF8E1" }, "empty-icon": { "size": 48 } }`. */
        fun of(values: Map<String, AWCValue>): AWCTransferListPartAppearance {
            fun p(k: String): AWCTransferListPartStyle = when(val v = values[k]) {
                is Map<*, *> -> AWCTransferListPartStyle.of(v)
                is JSONObject -> AWCTransferListPartStyle.of(v.keys().asSequence().associateWith { v.opt(it) })
                else -> AWCTransferListPartStyle() }
            return AWCTransferListPartAppearance(p("column"), p("header"), p("header-title"), p("count"), p("search"), p("list"), p("item"), p("empty"), p("empty-icon"), p("controls"), p("column-source"), p("column-target"))
        }
    }
}

/** The CSS metrics at a density rung (tokens.css spacing rungs + the component's tapers) with the hooks applied. */
internal class TransferListMetrics(density: Double, a: AWCTransferListAppearance, fullHeight: Boolean = false) {
    val s = max(-4.0, min(0.0, density.roundToInt().toDouble()))
    val insetXs = 4.0; val insetSm = if(s <= -3) 4.0 else 8.0; val insetMd = if(s <= -2) 8.0 else 12.0; val insetLg = if(s <= -4) 8.0 else if(s <= -2) 12.0 else 16.0
    val gapSm = if(s <= -3) 4.0 else 8.0; val gapMd = if(s <= -4) 4.0 else if(s <= -2) 8.0 else 12.0; val gapLg = if(s <= -4) 8.0 else if(s <= -2) 12.0 else 16.0
    val titleSize = max(12.0, 14 + 0.5 * s); val titleLine = max(16.0, 20 + s); val countSize = max(10.0, 11 + 0.5 * s); val countLine = max(14.0, 16 + 0.5 * s)
    val labelSize = max(12.0, 14 + 0.5 * s); val descSize = max(10.0, 12 + 0.5 * s); val emptySize = max(12.0, 14 + 0.5 * s)
    val emptyPad = max(4.0, 32 + 2 * s); val emptyIcon = a.emptyIconSize ?: max(24.0, 32 + 2 * s)
    val columnMinWidth = a.columnMinWidth ?: 260.0; /** The column cap; null = `100%` of the grid row (full-height). */
    val columnMaxBlock: Double? = a.columnMaxBlock ?: if(fullHeight) null else a.height ?: 360.0
    val shape = a.containerShape ?: 16.0; val itemInset = a.itemInset ?: 6.0
    val itemPad = a.itemPadding ?: AWCTransferListInsets(insetSm, insetLg - itemInset)
    val itemGap = a.itemGap ?: gapMd; val controlsGap = a.controlsGap ?: gapMd
    val controlSize = a.controlSize ?: max(24.0, 40 + 4 * s); val controlIconSize = a.controlIconSize ?: max(16.0, 24 + 2 * s)
    val searchTop = 8 + max(4.0, 8 + s)
}

/** The source's selection and move rules (checks per side in check order). */
internal data class TransferListLogic(val items: List<AWCTransferItem>, var value: List<String>, var sourceChecked: List<String> = emptyList(), var targetChecked: List<String> = emptyList(),
                                      var sourceQuery: String = "", var targetQuery: String = "") {
    val sourceItems get() = value.toSet().let { v -> items.filter { it.value !in v } }
    val targetItems get() = value.toSet().let { v -> items.filter { it.value in v } }
    fun visible(target: Boolean): List<AWCTransferItem> {
        val q = (if(target) targetQuery else sourceQuery).trim().lowercase(); val list = if(target) targetItems else sourceItems
        return if(q.isEmpty()) list else list.filter { it.label.lowercase().contains(q) || it.description.lowercase().contains(q) }
    }
    fun checked(target: Boolean) = if(target) targetChecked else sourceChecked
    fun eligibleChecked(target: Boolean): List<String> { val ok = visible(target).filter { !it.disabled }.map { it.value }.toSet(); return checked(target).filter { it in ok } }
    fun toggle(target: Boolean, v: String) { val c = checked(target).toMutableList(); if(!c.remove(v)) c += v; if(target) targetChecked = c else sourceChecked = c }
    data class SelectAll(val checked: Int, val total: Int, val all: Boolean, val some: Boolean)
    fun selectAll(target: Boolean): SelectAll { val e = visible(target).filter { !it.disabled }; val c = checked(target).toSet(); val n = e.count { it.value in c }
        val all = e.isNotEmpty() && n == e.size; return SelectAll(n, e.size, all, n > 0 && !all) }
    fun toggleSelectAll(target: Boolean) { val e = visible(target).filter { !it.disabled }.map { it.value }; val c = checked(target).toMutableList()
        if(selectAll(target).all) c.removeAll { it in e } else e.forEach { if(it !in c) c += it }
        if(target) targetChecked = c else sourceChecked = c }
    /** A move, or null when nothing is eligible (no events): direction, moved, the new value. */
    fun move(right: Boolean, all: Boolean): Triple<String, List<String>, List<String>>? {
        val side = !right
        val moved = if(all) (if(side) targetItems else sourceItems).filter { !it.disabled }.map { it.value } else eligibleChecked(side)
        if(moved.isEmpty()) return null
        value = if(right) value + moved.filter { it !in value } else moved.toSet().let { m -> value.filter { it !in m } }
        if(side) targetChecked = emptyList() else sourceChecked = emptyList()
        return Triple(if(right) "right" else "left", moved, value)
    }
    /** Checks are dropped when an item leaves its side or the pool by a controlled change (TL4). */
    fun prune() { val s = sourceItems.map { it.value }.toSet(); val t = targetItems.map { it.value }.toSet(); sourceChecked = sourceChecked.filter { it in s }; targetChecked = targetChecked.filter { it in t } }
}

/** Linear advances (measured 16× for sub-pixel precision) of the bundled Roboto faces plus CSS `letter-spacing` (after every
 *  character): the count pill's width as Chrome lays it out. */
internal class TransferListText(context: android.content.Context) {
    private val faces = mapOf(400 to context.resources.getFont(R.font.awc_roboto_regular), 500 to context.resources.getFont(R.font.awc_roboto_medium))
    private val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.LINEAR_TEXT_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG)
    private val cache = HashMap<String, Double>()
    fun width(text: String, size: Double, weight: Int, letterSpacing: Double = 0.0): Double = if(text.isEmpty()) 0.0 else cache.getOrPut("$weight|$size|$letterSpacing|$text") {
        paint.typeface = faces[weight] ?: faces[400]; paint.textSize = (size * 16).toFloat()
        paint.measureText(text) / 16.0 + letterSpacing * text.codePointCount(0, text.length)
    }
}

