package dev.awc.nativeui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf

// md-table family appearance: the source's 52 public custom properties (md-table 18, md-table-cell 10, md-table-container 5,
// md-table-expand-toggle 1, md-table-pagination 5, md-table-row 1, md-table-sort-label 5, md-table-toolbar 7).
//
// Like CSS custom properties they inherit down the family: authored `style` declarations on any family node,
// AWCTableHooksScope("--md-table-…: …") and the typed appearance scopes all feed one variable map, and each part reads the
// variables it uses (a cell reads its own declarations over its row's over the table's).

/** The family's custom properties as CSS values, inherited down the family. */
@Immutable internal data class AWCTableVars(val values: Map<String, String> = emptyMap()) {
    fun merging(o: AWCTableVars): AWCTableVars = if (o.values.isEmpty()) this else AWCTableVars(values + o.values)
    fun merging(style: String?): AWCTableVars = merging(style(style))
    operator fun get(name: String): String? = values[name]
    fun length(name: String): Double? = values[name]?.let { AWCTableTemplate.length(it) }
    /** A colour the table's parser accepts (hex, rgb()/rgba(), transparent, color-mix()). */
    fun color(name: String): String? = values[name]?.trim()?.takeIf { v ->
        v.matches(Regex("#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})")) || v == "transparent" ||
            v.startsWith("rgb(") || v.startsWith("rgba(") || v.startsWith("color-mix(") }
    fun number(name: String): Double? = values[name]?.trim()?.toDoubleOrNull()?.takeIf { it.isFinite() }
    /** `<angle>` in deg, grad, rad or turn (0 without a unit). */
    fun angle(name: String): Double? {
        val v = values[name]?.trim()?.lowercase() ?: return null
        for ((unit, scale) in listOf("deg" to 1.0, "grad" to 0.9, "rad" to 180 / Math.PI, "turn" to 360.0)) if (v.endsWith(unit)) return v.dropLast(unit.length).toDoubleOrNull()?.let { it * scale }
        return if (v.toDoubleOrNull() == 0.0) 0.0 else null
    }
    /** A `transition` value's first time in ms; `none` / `0s` → 0. */
    fun duration(name: String): Double? {
        val v = values[name]?.trim()?.lowercase() ?: return null
        if (v == "none") return 0.0
        for (t in v.split(' ')) { if (t.endsWith("ms")) t.dropLast(2).toDoubleOrNull()?.let { return it }; if (t.endsWith("s")) t.dropLast(1).toDoubleOrNull()?.let { return it * 1000 } }
        return null
    }
    companion object {
        /** `style="--md-table-…: value; …"` (other declarations are ignored). */
        fun style(style: String?): AWCTableVars {
            if (style.isNullOrBlank()) return AWCTableVars()
            val out = LinkedHashMap<String, String>(); var depth = 0; val cur = StringBuilder(); val decls = mutableListOf<String>()
            for (c in style) { if (c == '(') depth++ else if (c == ')') depth = maxOf(0, depth - 1); if (c == ';' && depth == 0) { decls += cur.toString(); cur.clear() } else cur.append(c) }
            decls += cur.toString()
            for (d in decls) { val i = d.indexOf(':'); if (i < 0) continue; val k = d.substring(0, i).trim(); val v = d.substring(i + 1).trim()
                if (k.startsWith("--md-table") && v.isNotEmpty()) out[k] = v }
            return AWCTableVars(out)
        }
    }
}
internal val LocalAWCTableVars = staticCompositionLocalOf { AWCTableVars() }
@Composable internal fun AWCTableVarsScope(vars: AWCTableVars, content: @Composable () -> Unit) {
    val inherited = LocalAWCTableVars.current
    CompositionLocalProvider(LocalAWCTableVars provides inherited.merging(vars), content = content)
}
/** Applies the family's public CSS hooks as a `--md-table-*` declaration list (e.g. `"--md-table-head-bg: #fde7f3"`). */
@Composable fun AWCTableHooksScope(declarations: String, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars.style(declarations), content)
@Composable fun AWCTableAppearanceScope(appearance: AWCTableAppearance, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars(appearance.declarations), content)
@Composable fun AWCTableCellAppearanceScope(appearance: AWCTableCellAppearance, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars(appearance.declarations), content)
@Composable fun AWCTableContainerAppearanceScope(appearance: AWCTableContainerAppearance, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars(appearance.declarations), content)
@Composable fun AWCTableExpandToggleAppearanceScope(appearance: AWCTableExpandToggleAppearance, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars(appearance.declarations), content)
@Composable fun AWCTablePaginationAppearanceScope(appearance: AWCTablePaginationAppearance, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars(appearance.declarations), content)
@Composable fun AWCTableRowAppearanceScope(appearance: AWCTableRowAppearance, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars(appearance.declarations), content)
@Composable fun AWCTableSortLabelAppearanceScope(appearance: AWCTableSortLabelAppearance, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars(appearance.declarations), content)
@Composable fun AWCTableToolbarAppearanceScope(appearance: AWCTableToolbarAppearance, content: @Composable () -> Unit) = AWCTableVarsScope(AWCTableVars(appearance.declarations), content)

// MARK: Typed values → CSS declarations (invalid values are dropped, like an invalid CSS declaration)

internal object AWCTableHookCSS {
    private fun n(v: Double): String = if (v == Math.rint(v) && kotlin.math.abs(v) < 1e15) v.toLong().toString() else v.toString()
    fun color(v: String?): String? = v?.takeIf { it.matches(Regex("#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})")) }?.uppercase(java.util.Locale.ROOT)
    fun length(v: Double?): String? = v?.takeIf { it.isFinite() && it >= 0 }?.let { n(it) + "px" }
    fun opacity(v: Double?): String? = v?.takeIf { it.isFinite() && it in 0.0..1.0 }?.let { n(it) }
    fun duration(v: Double?): String? = v?.takeIf { it.isFinite() && it >= 0 }?.let { n(it) + "ms" }
    fun angle(v: Double?): String? = v?.takeIf { it.isFinite() }?.let { n(it) + "deg" }
    fun text(v: String?): String? = v?.trim()?.takeIf { it.isNotEmpty() && it.length <= 512 && it.none { c -> c in ";{}<>\\" } }
    fun display(v: String?): String? = v?.takeIf { it == "inline-flex" || it == "none" }
    fun shadow(v: List<AWCBoxShadow>?): String? {
        if (v == null || !v.all { it.valid }) return null
        if (v.isEmpty()) return "none"
        return v.joinToString(", ") { (if (it.inset) "inset " else "") + "${n(it.x)}px ${n(it.y)}px ${n(it.blur)}px ${n(it.spread)}px ${it.color}" }
    }
    fun corners(v: AWCCornerShape?): String? {
        if (v == null) return null
        val all = listOf(v.topLeft, v.topRight, v.bottomRight, v.bottomLeft)
        if (all.flatMap { listOf(it.x, it.y) }.any { !it.points.isFinite() || !it.fraction.isFinite() || it.points < 0 || it.fraction < 0 }) return null
        fun l(c: AWCCornerLength) = if (c.fraction == 0.0) n(c.points) + "px" else if (c.points == 0.0) n(c.fraction * 100) + "%" else "calc(${n(c.fraction * 100)}% + ${n(c.points)}px)"
        val h = all.joinToString(" ") { l(it.x) }; val w = all.joinToString(" ") { l(it.y) }
        return if (h == w) h else "$h / $w"
    }
    fun declarations(prefix: String, fields: List<Pair<String, String?>>): Map<String, String> =
        fields.mapNotNull { (k, v) -> v?.let { "--md-$prefix-$k" to it } }.toMap()
}
private fun Map<*, *>.txt(k: String): String? = (this[k] as? String)?.takeIf { it.isNotEmpty() }
private fun Map<*, *>.num(k: String): Double? = (this[k] as? Number)?.toDouble()

/** md-table's eighteen hooks. */
@Immutable data class AWCTableAppearance(
    val rowHeightCompact: Double? = null, val rowHeightStandard: Double? = null, val rowHeightComfortable: Double? = null, val headerHeight: Double? = null,
    val cellPaddingInline: Double? = null, val cellPaddingBlock: Double? = null, val dividerColor: String? = null, val stripeColor: String? = null,
    val headBackground: String? = null, val headColor: String? = null, val footBackground: String? = null, val rowHoverColor: String? = null,
    val rowSelectedBackground: String? = null, val rowSelectedColor: String? = null, val columnsTemplate: String? = null, val minWidth: Double? = null,
    val bodyMaxHeight: Double? = null, val emptyMinHeight: Double? = null,
) {
    internal val declarations: Map<String, String> get() = with(AWCTableHookCSS) { declarations("table", listOf(
        "row-height-compact" to length(rowHeightCompact), "row-height-standard" to length(rowHeightStandard), "row-height-comfortable" to length(rowHeightComfortable),
        "header-height" to length(headerHeight), "cell-padding-inline" to length(cellPaddingInline), "cell-padding-block" to length(cellPaddingBlock),
        "divider-color" to color(dividerColor), "stripe-color" to color(stripeColor), "head-bg" to color(headBackground), "head-color" to color(headColor),
        "foot-bg" to color(footBackground), "row-hover-color" to color(rowHoverColor), "row-selected-bg" to color(rowSelectedBackground),
        "row-selected-color" to color(rowSelectedColor), "columns-template" to text(columnsTemplate), "min-width" to length(minWidth),
        "body-max-h" to length(bodyMaxHeight), "empty-min-height" to length(emptyMinHeight))) }
    fun merging(o: AWCTableAppearance) = AWCTableAppearance(o.rowHeightCompact ?: rowHeightCompact, o.rowHeightStandard ?: rowHeightStandard,
        o.rowHeightComfortable ?: rowHeightComfortable, o.headerHeight ?: headerHeight, o.cellPaddingInline ?: cellPaddingInline, o.cellPaddingBlock ?: cellPaddingBlock,
        o.dividerColor ?: dividerColor, o.stripeColor ?: stripeColor, o.headBackground ?: headBackground, o.headColor ?: headColor, o.footBackground ?: footBackground,
        o.rowHoverColor ?: rowHoverColor, o.rowSelectedBackground ?: rowSelectedBackground, o.rowSelectedColor ?: rowSelectedColor, o.columnsTemplate ?: columnsTemplate,
        o.minWidth ?: minWidth, o.bodyMaxHeight ?: bodyMaxHeight, o.emptyMinHeight ?: emptyMinHeight)
    companion object {
        fun fromValues(v: Map<*, *>) = AWCTableAppearance(v.num("rowHeightCompact"), v.num("rowHeightStandard"), v.num("rowHeightComfortable"), v.num("headerHeight"),
            v.num("cellPaddingInline"), v.num("cellPaddingBlock"), v.txt("dividerColor"), v.txt("stripeColor"), v.txt("headBackground"), v.txt("headColor"),
            v.txt("footBackground"), v.txt("rowHoverColor"), v.txt("rowSelectedBackground"), v.txt("rowSelectedColor"), v.txt("columnsTemplate"), v.num("minWidth"),
            v.num("bodyMaxHeight"), v.num("emptyMinHeight"))
    }
}
/** md-table-cell's ten hooks. */
@Immutable data class AWCTableCellAppearance(
    val color: String? = null, val background: String? = null, val paddingInline: Double? = null, val paddingBlock: Double? = null, val minHeight: Double? = null,
    val stickyBackground: String? = null, val stickyTransition: Double? = null, val pinDisplay: String? = null, val pinColor: String? = null, val pinSize: Double? = null,
) {
    internal val declarations: Map<String, String> get() = with(AWCTableHookCSS) { declarations("table-cell", listOf(
        "color" to color(color), "background" to color(background), "padding-inline" to length(paddingInline), "padding-block" to length(paddingBlock),
        "min-height" to length(minHeight), "sticky-bg" to color(stickyBackground), "sticky-transition" to duration(stickyTransition),
        "pin-display" to display(pinDisplay), "pin-color" to color(pinColor), "pin-size" to length(pinSize))) }
    fun merging(o: AWCTableCellAppearance) = AWCTableCellAppearance(o.color ?: color, o.background ?: background, o.paddingInline ?: paddingInline,
        o.paddingBlock ?: paddingBlock, o.minHeight ?: minHeight, o.stickyBackground ?: stickyBackground, o.stickyTransition ?: stickyTransition,
        o.pinDisplay ?: pinDisplay, o.pinColor ?: pinColor, o.pinSize ?: pinSize)
    companion object {
        fun fromValues(v: Map<*, *>) = AWCTableCellAppearance(v.txt("color"), v.txt("background"), v.num("paddingInline"), v.num("paddingBlock"), v.num("minHeight"),
            v.txt("stickyBackground"), v.num("stickyTransition"), v.txt("pinDisplay"), v.txt("pinColor"), v.num("pinSize"))
    }
}
/** md-table-container's five hooks. */
@Immutable data class AWCTableContainerAppearance(
    val color: String? = null, val shape: AWCCornerShape? = null, val elevation: List<AWCBoxShadow>? = null, val outlineColor: String? = null, val outlineWidth: Double? = null,
) {
    internal val declarations: Map<String, String> get() = with(AWCTableHookCSS) { declarations("table-container", listOf(
        "color" to color(color), "shape" to corners(shape), "elevation" to shadow(elevation), "outline-color" to color(outlineColor), "outline-width" to length(outlineWidth))) }
    fun merging(o: AWCTableContainerAppearance) = AWCTableContainerAppearance(o.color ?: color, o.shape ?: shape, o.elevation ?: elevation, o.outlineColor ?: outlineColor, o.outlineWidth ?: outlineWidth)
    companion object {
        fun fromValues(v: Map<*, *>) = AWCTableContainerAppearance(v.txt("color"), AWCCornerShape.fromValues(v["shape"]), AWCBoxShadow.list(v["elevation"]), v.txt("outlineColor"), v.num("outlineWidth"))
    }
}
/** md-table-expand-toggle's hook: the caret's rotation while its row is expanded, in degrees. */
@Immutable data class AWCTableExpandToggleAppearance(val rotation: Double? = null) {
    internal val declarations: Map<String, String> get() = AWCTableHookCSS.declarations("table-expand-toggle", listOf("rotation" to AWCTableHookCSS.angle(rotation)))
    fun merging(o: AWCTableExpandToggleAppearance) = AWCTableExpandToggleAppearance(o.rotation ?: rotation)
    companion object { fun fromValues(v: Map<*, *>) = AWCTableExpandToggleAppearance(v.num("rotation")) }
}
/** md-table-pagination's five hooks. */
@Immutable data class AWCTablePaginationAppearance(
    val color: String? = null, val background: String? = null, val paddingBlock: Double? = null, val paddingInline: Double? = null, val selectWidth: Double? = null,
) {
    internal val declarations: Map<String, String> get() = with(AWCTableHookCSS) { declarations("table-pagination", listOf(
        "color" to color(color), "bg" to color(background), "padding-block" to length(paddingBlock), "padding-inline" to length(paddingInline), "select-width" to length(selectWidth))) }
    fun merging(o: AWCTablePaginationAppearance) = AWCTablePaginationAppearance(o.color ?: color, o.background ?: background, o.paddingBlock ?: paddingBlock, o.paddingInline ?: paddingInline, o.selectWidth ?: selectWidth)
    companion object { fun fromValues(v: Map<*, *>) = AWCTablePaginationAppearance(v.txt("color"), v.txt("background"), v.num("paddingBlock"), v.num("paddingInline"), v.num("selectWidth")) }
}
/** md-table-row's hook. */
@Immutable data class AWCTableRowAppearance(val hoverColor: String? = null) {
    internal val declarations: Map<String, String> get() = AWCTableHookCSS.declarations("table-row", listOf("hover-color" to AWCTableHookCSS.color(hoverColor)))
    fun merging(o: AWCTableRowAppearance) = AWCTableRowAppearance(o.hoverColor ?: hoverColor)
    companion object { fun fromValues(v: Map<*, *>) = AWCTableRowAppearance(v.txt("hoverColor")) }
}
/** md-table-sort-label's five hooks. */
@Immutable data class AWCTableSortLabelAppearance(
    val color: String? = null, val activeColor: String? = null, val iconSize: Double? = null, val gap: Double? = null, val restOpacity: Double? = null,
) {
    internal val declarations: Map<String, String> get() = with(AWCTableHookCSS) { declarations("table-sort-label", listOf(
        "color" to color(color), "active-color" to color(activeColor), "icon-size" to length(iconSize), "gap" to length(gap), "rest-opacity" to opacity(restOpacity))) }
    fun merging(o: AWCTableSortLabelAppearance) = AWCTableSortLabelAppearance(o.color ?: color, o.activeColor ?: activeColor, o.iconSize ?: iconSize, o.gap ?: gap, o.restOpacity ?: restOpacity)
    companion object { fun fromValues(v: Map<*, *>) = AWCTableSortLabelAppearance(v.txt("color"), v.txt("activeColor"), v.num("iconSize"), v.num("gap"), v.num("restOpacity")) }
}
/** md-table-toolbar's seven hooks. */
@Immutable data class AWCTableToolbarAppearance(
    val color: String? = null, val background: String? = null, val selectionBackground: String? = null, val selectionColor: String? = null,
    val paddingBlock: Double? = null, val paddingInline: Double? = null, val minHeight: Double? = null,
) {
    internal val declarations: Map<String, String> get() = with(AWCTableHookCSS) { declarations("table-toolbar", listOf(
        "color" to color(color), "bg" to color(background), "selection-bg" to color(selectionBackground), "selection-color" to color(selectionColor),
        "padding-block" to length(paddingBlock), "padding-inline" to length(paddingInline), "min-height" to length(minHeight))) }
    fun merging(o: AWCTableToolbarAppearance) = AWCTableToolbarAppearance(o.color ?: color, o.background ?: background, o.selectionBackground ?: selectionBackground,
        o.selectionColor ?: selectionColor, o.paddingBlock ?: paddingBlock, o.paddingInline ?: paddingInline, o.minHeight ?: minHeight)
    companion object {
        fun fromValues(v: Map<*, *>) = AWCTableToolbarAppearance(v.txt("color"), v.txt("background"), v.txt("selectionBackground"), v.txt("selectionColor"),
            v.num("paddingBlock"), v.num("paddingInline"), v.num("minHeight"))
    }
}
