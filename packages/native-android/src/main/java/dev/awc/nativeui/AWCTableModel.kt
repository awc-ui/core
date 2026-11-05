package dev.awc.nativeui

import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

// md-table family model shared by the Compose renderers (port of TableModel.swift; same CSS Grid subset).

sealed class AWCTableTrackMin {
    data class Px(val v: Double) : AWCTableTrackMin()
    data class Percent(val v: Double) : AWCTableTrackMin()
    object Auto : AWCTableTrackMin()
    object MinContent : AWCTableTrackMin()
    object MaxContent : AWCTableTrackMin()
}
sealed class AWCTableTrackMax {
    data class Px(val v: Double) : AWCTableTrackMax()
    data class Percent(val v: Double) : AWCTableTrackMax()
    data class Fr(val v: Double) : AWCTableTrackMax()
    object Auto : AWCTableTrackMax()
    object MinContent : AWCTableTrackMax()
    object MaxContent : AWCTableTrackMax()
    data class FitContent(val v: Double) : AWCTableTrackMax()
}
data class AWCTableTrack(val min: AWCTableTrackMin, val max: AWCTableTrackMax) {
    val isFlexible: Boolean get() = max is AWCTableTrackMax.Fr
    val flex: Double get() = (max as? AWCTableTrackMax.Fr)?.v ?: 0.0
}

/** `grid-template-columns` subset used by md-table (px / % / fr / auto / min- and max-content, minmax(), max() floors, fit-content(), repeat()). */
object AWCTableTemplate {
    fun parse(raw: String): List<AWCTableTrack>? {
        val tokens = split(raw.trim())
        if (tokens.isEmpty()) return null
        val out = mutableListOf<AWCTableTrack>()
        for (token in tokens) {
            if (token.startsWith("repeat(") && token.endsWith(")")) {
                val inner = token.substring(7, token.length - 1)
                val comma = topLevelComma(inner) ?: return null
                val n = inner.substring(0, comma).trim().toIntOrNull() ?: return null
                if (n <= 0 || n > 1000) return null
                val tracks = parse(inner.substring(comma + 1)) ?: return null
                repeat(n) { out += tracks }
            } else out += track(token) ?: return null
        }
        return out
    }
    fun track(token: String): AWCTableTrack? {
        val t = token.trim().lowercase()
        if (t.startsWith("minmax(") && t.endsWith(")")) {
            val inner = t.substring(7, t.length - 1)
            val comma = topLevelComma(inner) ?: return null
            val lo = minimum(inner.substring(0, comma)) ?: return null
            val hi = maximum(inner.substring(comma + 1)) ?: return null
            return AWCTableTrack(lo, hi)
        }
        if (t.startsWith("fit-content(") && t.endsWith(")")) return length(t.substring(12, t.length - 1))?.let { AWCTableTrack(AWCTableTrackMin.Auto, AWCTableTrackMax.FitContent(it)) }
        fr(t)?.let { return AWCTableTrack(AWCTableTrackMin.Auto, AWCTableTrackMax.Fr(it)) }
        val hi = maximum(t) ?: return null
        val lo = minimum(t) ?: return null
        return AWCTableTrack(lo, hi)
    }
    fun minimum(raw: String): AWCTableTrackMin? {
        val t = raw.trim()
        if (t.startsWith("max(") && t.endsWith(")")) {
            val inner = t.substring(4, t.length - 1)
            val comma = topLevelComma(inner) ?: return null
            val n = length(inner.substring(0, comma)) ?: return null
            val other = minimum(inner.substring(comma + 1))
            return AWCTableTrackMin.Px(if (other is AWCTableTrackMin.Px) max(n, other.v) else n)
        }
        return when (t) {
            "auto" -> AWCTableTrackMin.Auto
            "min-content" -> AWCTableTrackMin.MinContent
            "max-content" -> AWCTableTrackMin.MaxContent
            else -> if (t.endsWith("%")) t.dropLast(1).toDoubleOrNull()?.let { AWCTableTrackMin.Percent(it) } else length(t)?.let { AWCTableTrackMin.Px(it) }
        }
    }
    fun maximum(raw: String): AWCTableTrackMax? {
        val t = raw.trim()
        fr(t)?.let { return AWCTableTrackMax.Fr(it) }
        if (t.startsWith("fit-content(") && t.endsWith(")")) return length(t.substring(12, t.length - 1))?.let { AWCTableTrackMax.FitContent(it) }
        return when (t) {
            "auto" -> AWCTableTrackMax.Auto
            "min-content" -> AWCTableTrackMax.MinContent
            "max-content" -> AWCTableTrackMax.MaxContent
            else -> if (t.endsWith("%")) t.dropLast(1).toDoubleOrNull()?.let { AWCTableTrackMax.Percent(it) } else length(t)?.let { AWCTableTrackMax.Px(it) }
        }
    }
    fun fr(t: String): Double? = if (t.endsWith("fr")) t.dropLast(2).toDoubleOrNull()?.takeIf { it >= 0 } else null
    fun length(raw: String): Double? {
        val t = raw.trim()
        if (t == "0") return 0.0
        if (t.endsWith("px")) return t.dropLast(2).toDoubleOrNull()?.takeIf { it >= 0 }
        if (t.endsWith("rem")) return t.dropLast(3).toDoubleOrNull()?.takeIf { it >= 0 }?.times(16)
        if (t.endsWith("em")) return t.dropLast(2).toDoubleOrNull()?.takeIf { it >= 0 }?.times(14)
        return null
    }
    fun split(s: String): List<String> {
        val out = mutableListOf<String>(); val cur = StringBuilder(); var depth = 0
        for (ch in s) {
            if (ch == '(') depth++ else if (ch == ')') depth--
            if (ch.isWhitespace() && depth == 0) { if (cur.isNotEmpty()) { out += cur.toString(); cur.clear() } } else cur.append(ch)
        }
        if (cur.isNotEmpty()) out += cur.toString()
        return out
    }
    fun topLevelComma(s: String): Int? {
        var depth = 0
        s.forEachIndexed { i, ch -> if (ch == '(') depth++ else if (ch == ')') depth-- else if (ch == ',' && depth == 0) return i }
        return null
    }
}

data class AWCTableContribution(val start: Int, val span: Int, val minContent: Double, val maxContent: Double)

/** CSS Grid track sizing (css-grid-1 §11) for md-table's single column axis (see TableModel.swift). */
object AWCTableColumnSolver {
    data class Result(val widths: List<Double>, val width: Double)
    fun solve(tracks: List<AWCTableTrack>, items: List<AWCTableContribution>, available: Double, minWidth: Double?): Result {
        if (tracks.isEmpty()) return Result(emptyList(), available)
        val floor = minWidth ?: maxContentWidth(tracks, items)
        val width = max(available, floor)
        return Result(size(tracks, items, width), width)
    }
    fun maxContentWidth(tracks: List<AWCTableTrack>, items: List<AWCTableContribution>): Double {
        val (base, limit) = intrinsic(tracks, items, null)
        for (i in tracks.indices) if (!tracks[i].isFlexible && limit[i].isFinite()) base[i] = max(base[i], limit[i])
        val flexible = tracks.indices.filter { tracks[it].isFlexible }
        if (flexible.isNotEmpty()) {
            var fraction = 0.0
            for (i in flexible) { val f = tracks[i].flex; fraction = max(fraction, if (f > 1) base[i] / f else base[i]) }
            for (item in items) {
                val range = (item.start until min(tracks.size, item.start + item.span)).toList()
                if (range.any { tracks[it].isFlexible }) fraction = max(fraction, frSize(range, tracks, base, item.maxContent))
            }
            for (i in flexible) base[i] = max(base[i], fraction * tracks[i].flex)
        }
        return base.sum()
    }
    fun size(tracks: List<AWCTableTrack>, items: List<AWCTableContribution>, space: Double): List<Double> {
        val (base, limit) = intrinsic(tracks, items, space)
        var free = space - base.sum()
        var growable = tracks.indices.filter { !tracks[it].isFlexible && limit[it] > base[it] }
        while (free > 1e-9 && growable.isNotEmpty()) {
            val share = free / growable.size
            val next = mutableListOf<Int>()
            for (i in growable) { val add = min(share, limit[i] - base[i]); base[i] += add; free -= add; if (limit[i] - base[i] > 1e-9) next += i }
            if (next.size == growable.size && share <= 1e-9) break
            growable = next
        }
        val flexible = tracks.indices.filter { tracks[it].isFlexible }
        if (flexible.isNotEmpty()) {
            val fixed = tracks.indices.filter { !tracks[it].isFlexible }.sumOf { base[it] }
            val fraction = frSize(flexible, tracks, base, space - fixed)
            for (i in flexible) base[i] = max(base[i], fraction * tracks[i].flex)
        } else {
            val autos = tracks.indices.filter { tracks[it].max is AWCTableTrackMax.Auto }
            val left = space - base.sum()
            if (left > 0 && autos.isNotEmpty()) for (i in autos) base[i] += left / autos.size
        }
        return base.toList()
    }
    fun frSize(indices: List<Int>, tracks: List<AWCTableTrack>, base: DoubleArray, space: Double): Double {
        val flexible = indices.filter { tracks[it].isFlexible }.toMutableSet()
        var leftover = space - indices.filter { it !in flexible }.sumOf { base[it] }
        while (true) {
            val sum = max(1.0, flexible.sumOf { tracks[it].flex })
            val hypothetical = max(0.0, leftover) / sum
            val inflexible = flexible.filter { hypothetical * tracks[it].flex < base[it] }
            if (inflexible.isEmpty()) return hypothetical
            for (i in inflexible) { flexible.remove(i); leftover -= base[i] }
            if (flexible.isEmpty()) return 0.0
        }
    }
    fun intrinsic(tracks: List<AWCTableTrack>, items: List<AWCTableContribution>, space: Double?): Pair<DoubleArray, DoubleArray> {
        val base = DoubleArray(tracks.size); val limit = DoubleArray(tracks.size) { Double.POSITIVE_INFINITY }
        tracks.forEachIndexed { i, t ->
            base[i] = when (val m = t.min) { is AWCTableTrackMin.Px -> m.v; is AWCTableTrackMin.Percent -> space?.let { it * m.v / 100 } ?: 0.0; else -> 0.0 }
            limit[i] = when (val m = t.max) { is AWCTableTrackMax.Px -> m.v; is AWCTableTrackMax.Percent -> space?.let { it * m.v / 100 } ?: Double.POSITIVE_INFINITY; is AWCTableTrackMax.Fr -> Double.POSITIVE_INFINITY; else -> -1.0 }
        }
        val saw = BooleanArray(tracks.size)
        for (item in items) {
            if (item.span != 1 || item.start !in tracks.indices) continue
            val i = item.start; val t = tracks[i]
            when (t.min) { AWCTableTrackMin.MinContent -> base[i] = max(base[i], item.minContent); AWCTableTrackMin.MaxContent -> base[i] = max(base[i], item.maxContent); else -> {} }
            when (val m = t.max) {
                AWCTableTrackMax.Auto, AWCTableTrackMax.MaxContent -> { limit[i] = max(limit[i], item.maxContent); saw[i] = true }
                AWCTableTrackMax.MinContent -> { limit[i] = max(limit[i], item.minContent); saw[i] = true }
                is AWCTableTrackMax.FitContent -> { limit[i] = max(limit[i], min(item.maxContent, max(item.minContent, m.v))); saw[i] = true }
                else -> {}
            }
        }
        for (i in tracks.indices) if (limit[i] < 0) limit[i] = if (saw[i]) limit[i] else base[i]
        for (i in tracks.indices) if (limit[i].isFinite() && limit[i] < base[i]) limit[i] = base[i]
        for (item in items) {
            if (item.span <= 1) continue
            val range = (item.start until min(tracks.size, item.start + item.span)).toList()
            if (range.isEmpty() || range.any { tracks[it].isFlexible }) continue
            val current = range.sumOf { if (limit[it].isFinite()) limit[it] else base[it] }
            val extra = item.maxContent - current
            val targets = range.filter { tracks[it].max !is AWCTableTrackMax.Px }
            if (extra > 0 && targets.isNotEmpty()) for (i in targets) limit[i] = (if (limit[i].isFinite()) limit[i] else base[i]) + extra / targets.size
        }
        return base to limit
    }
}

/** Density metrics (md-table.css): rows 36 / 52 / 60, head 56, ±4 px per rung, padding per density. */
data class AWCTableMetrics(val rowHeight: Double, val headHeight: Double, val padInline: Double, val padBlock: Double,
                           val fontSize: Double, val lineHeight: Double, val scale: Double, val compact: Boolean, val comfortable: Boolean) {
    companion object {
        fun resolve(density: Any?, inheritedScale: Double, hooks: AWCTableHooks = AWCTableHooks()): AWCTableMetrics {
            var scale = inheritedScale; var mode = "standard"
            val s = density as? String
            if (s != null && s in setOf("compact", "standard", "comfortable")) mode = s
            else { val n = (density as? Number)?.toDouble() ?: s?.toDoubleOrNull(); if (n != null && n in listOf(-1.0, -2.0, -3.0, -4.0)) scale = n }
            val compact = mode == "compact"; val comfortable = mode == "comfortable"
            val standard = hooks.rowHeightStandard ?: (52 + scale * 4)
            val compactH = hooks.rowHeightCompact ?: max(28.0, 36 + scale * 4)
            val comfortableH = hooks.rowHeightComfortable ?: max(40.0, 60 + scale * 4)
            // --md-sys-spacing-inset-lg / -sm per density rung (Mac oracle: -1 keeps 16 / 8; -2 12 / 8; -3 12 / 4; -4 8 / 4).
            val rung = Math.round(scale).toInt()
            val insetLg = if (rung <= -4) 8.0 else if (rung <= -2) 12.0 else 16.0; val insetSm = if (rung <= -3) 4.0 else 8.0
            return AWCTableMetrics(
                rowHeight = if (compact) compactH else if (comfortable) comfortableH else standard,
                headHeight = hooks.headerHeight ?: max(40.0, 56 + scale * 4),
                padInline = hooks.cellPaddingInline ?: if (compact) 12.0 else if (comfortable) 20.0 else insetLg,
                padBlock = hooks.cellPaddingBlock ?: if (compact) 4.0 else insetSm,
                fontSize = max(12.0, 14 + scale * 0.5), lineHeight = max(16.0, 20 + scale), scale = scale, compact = compact, comfortable = comfortable)
        }
    }
}

/** Public `--md-table-*` hooks. */
data class AWCTableHooks(
    val bodyMaxHeight: Double? = null, val cellPaddingBlock: Double? = null, val cellPaddingInline: Double? = null, val columnsTemplate: String? = null,
    val dividerColor: String? = null, val emptyMinHeight: Double? = null, val footBackground: String? = null, val headBackground: String? = null,
    val headColor: String? = null, val headerHeight: Double? = null, val minWidth: Double? = null, val rowHeightCompact: Double? = null,
    val rowHeightStandard: Double? = null, val rowHeightComfortable: Double? = null, val rowHoverColor: String? = null, val rowSelectedBackground: String? = null,
    val rowSelectedColor: String? = null, val stripeColor: String? = null,
) {
    companion object {
        /** md-table's hooks from the family's custom properties (inherited and authored). */
        internal fun vars(v: AWCTableVars) = AWCTableHooks(
            bodyMaxHeight = v.length("--md-table-body-max-h"), cellPaddingBlock = v.length("--md-table-cell-padding-block"),
            cellPaddingInline = v.length("--md-table-cell-padding-inline"), columnsTemplate = v["--md-table-columns-template"],
            dividerColor = v["--md-table-divider-color"], emptyMinHeight = v.length("--md-table-empty-min-height"), footBackground = v["--md-table-foot-bg"],
            headBackground = v["--md-table-head-bg"], headColor = v["--md-table-head-color"], headerHeight = v.length("--md-table-header-height"),
            minWidth = v.length("--md-table-min-width"), rowHeightCompact = v.length("--md-table-row-height-compact"),
            rowHeightStandard = v.length("--md-table-row-height-standard"), rowHeightComfortable = v.length("--md-table-row-height-comfortable"),
            rowHoverColor = v["--md-table-row-hover-color"], rowSelectedBackground = v["--md-table-row-selected-bg"],
            rowSelectedColor = v["--md-table-row-selected-color"], stripeColor = v["--md-table-stripe-color"])
        fun style(style: String): AWCTableHooks {
            var h = AWCTableHooks()
            for (decl in style.split(';')) {
                val parts = decl.split(':', limit = 2).map { it.trim() }
                if (parts.size != 2) continue
                val (k, v) = parts; val px = AWCTableTemplate.length(v)
                h = when (k) {
                    "--md-table-body-max-h" -> h.copy(bodyMaxHeight = px)
                    "--md-table-cell-padding-block" -> h.copy(cellPaddingBlock = px)
                    "--md-table-cell-padding-inline" -> h.copy(cellPaddingInline = px)
                    "--md-table-columns-template" -> h.copy(columnsTemplate = v)
                    "--md-table-divider-color" -> h.copy(dividerColor = v)
                    "--md-table-empty-min-height" -> h.copy(emptyMinHeight = px)
                    "--md-table-foot-bg" -> h.copy(footBackground = v)
                    "--md-table-head-bg" -> h.copy(headBackground = v)
                    "--md-table-head-color" -> h.copy(headColor = v)
                    "--md-table-header-height" -> h.copy(headerHeight = px)
                    "--md-table-min-width" -> h.copy(minWidth = px)
                    "--md-table-row-height-compact" -> h.copy(rowHeightCompact = px)
                    "--md-table-row-height-standard" -> h.copy(rowHeightStandard = px)
                    "--md-table-row-height-comfortable" -> h.copy(rowHeightComfortable = px)
                    "--md-table-row-hover-color" -> h.copy(rowHoverColor = v)
                    "--md-table-row-selected-bg" -> h.copy(rowSelectedBackground = v)
                    "--md-table-row-selected-color" -> h.copy(rowSelectedColor = v)
                    "--md-table-stripe-color" -> h.copy(stripeColor = v)
                    else -> h
                }
            }
            return h
        }
    }
    fun merging(o: AWCTableHooks) = AWCTableHooks(
        o.bodyMaxHeight ?: bodyMaxHeight, o.cellPaddingBlock ?: cellPaddingBlock, o.cellPaddingInline ?: cellPaddingInline, o.columnsTemplate ?: columnsTemplate,
        o.dividerColor ?: dividerColor, o.emptyMinHeight ?: emptyMinHeight, o.footBackground ?: footBackground, o.headBackground ?: headBackground,
        o.headColor ?: headColor, o.headerHeight ?: headerHeight, o.minWidth ?: minWidth, o.rowHeightCompact ?: rowHeightCompact,
        o.rowHeightStandard ?: rowHeightStandard, o.rowHeightComfortable ?: rowHeightComfortable, o.rowHoverColor ?: rowHoverColor,
        o.rowSelectedBackground ?: rowSelectedBackground, o.rowSelectedColor ?: rowSelectedColor, o.stripeColor ?: stripeColor)
}

object AWCTableSort {
    fun next(currentColumn: String, currentOrder: String, column: String, defaultOrder: String): Pair<String, String> {
        val first = if (defaultOrder == "desc") "desc" else "asc"; val second = if (first == "asc") "desc" else "asc"
        var order = first
        if (currentColumn == column) order = if (currentOrder == first) second else if (currentOrder == second) "none" else first
        return (if (order == "none") "" else column) to order
    }
    fun ariaSort(sortBy: String, sortOrder: String, column: String): String =
        if (column.isEmpty() || column != sortBy) "none" else if (sortOrder == "desc") "descending" else "ascending"
}

data class AWCTableSelectableRow(val id: String, val value: String, val selected: Boolean, val disabled: Boolean, val selectable: Boolean)
data class AWCTableSelectionState(val count: Int, val total: Int, val values: List<String>, val all: Boolean, val indeterminate: Boolean) {
    val detail: Map<String, Any?> get() = mapOf("count" to count.toDouble(), "total" to total.toDouble(), "values" to values, "all" to all, "indeterminate" to indeterminate)
    companion object {
        fun compute(rows: List<AWCTableSelectableRow>): AWCTableSelectionState {
            val selectable = rows.filter { !it.disabled && it.selectable }
            val selected = selectable.filter { it.selected }
            val all = selectable.isNotEmpty() && selected.size == selectable.size
            return AWCTableSelectionState(selected.size, selectable.size, selected.map { r -> r.value.ifEmpty { rows.indexOf(r).toString() } }, all, selected.isNotEmpty() && !all)
        }
    }
}

data class AWCTablePaginationModel(val count: Int, val page: Int, val rowsPerPage: Int) {
    val lastPage: Int get() = if (rowsPerPage <= 0) 0 else max(0, ceil(count.toDouble() / rowsPerPage).toInt() - 1)
    val clampedPage: Int get() = if (page > lastPage) max(0, lastPage) else page
    val from: Int get() = if (count == 0) 0 else clampedPage * rowsPerPage + 1
    val to: Int get() = if (count == 0) 0 else min((clampedPage + 1) * rowsPerPage, count)
    fun display(template: String): String = template.replaceFirst("%from%", from.toString()).replaceFirst("%to%", to.toString()).replaceFirst("%count%", count.toString())
    companion object {
        fun options(raw: String, count: Int, labelAll: String): List<Pair<Int, String>> = raw.split(',').map { it.trim() }.filter { it.isNotEmpty() }.mapNotNull { t ->
            if (t.lowercase() == "all") { val v = if (count != 0) count else -1; if (v > 0) v to labelAll else null }
            else t.toDoubleOrNull()?.takeIf { it.isFinite() && it > 0 }?.let { it.toInt() to t }
        }
    }
}

fun awcTableSelectedLabel(template: String, count: Int): String = template.replaceFirst("%count%", "%,d".format(count))

/** md-table.tsx ensurePinBase / applyPinLayout: ORIGINAL tracks of an explicit template (no repeat()), one cell per column,
 *  no colspans; pins seed from the head row's `sticky` cells; display order = start pins, the rest, end pins; hidden drop out. */
data class AWCTablePinLayout(val base: List<String>, val pins: Map<Int, String>, val hidden: Set<Int>) {
    val order: List<Int> get() = base.indices.filter { pins[it] == "start" } + base.indices.filter { pins[it] == null } + base.indices.filter { pins[it] == "end" }
    val visible: List<Int> get() = order.filter { it !in hidden }
    val template: String get() = visible.joinToString(" ") { base[it] }
    companion object {
        fun split(template: String): List<String> {
            val out = mutableListOf<String>(); var depth = 0; val cur = StringBuilder()
            for (ch in template.trim()) {
                if (ch == '(') depth++ else if (ch == ')') depth--
                if (ch.isWhitespace() && depth == 0) { if (cur.isNotEmpty()) { out += cur.toString(); cur.clear() } } else cur.append(ch)
            }
            if (cur.isNotEmpty()) out += cur.toString()
            return out
        }
        /** rows: per row (head?, cell spans, cell sticky sides). */
        fun make(template: String, rows: List<Triple<Boolean, List<Int>, List<String?>>>): AWCTablePinLayout? {
            if (template.isEmpty() || template.contains("repeat(")) return null
            val base = split(template)
            for ((_, spans, _) in rows) if (spans.any { it != 1 } || spans.size != base.size) return null
            val pins = mutableMapOf<Int, String>()
            rows.firstOrNull { it.first }?.third?.forEachIndexed { i, s -> if (s == "start" || s == "end") pins[i] = s }
            return AWCTablePinLayout(base, pins, emptySet())
        }
    }
}
