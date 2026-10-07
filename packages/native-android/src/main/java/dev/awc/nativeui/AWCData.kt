@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import kotlin.math.*

private data class ChartSeries(val label: String, val values: List<Float?>, val color: Color)
@Composable internal fun ChartComponent(tag: String, p: Props, emit: EventSink) {
    val palette = listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.tertiary, MaterialTheme.colorScheme.secondary, Color(0xffe09424), Color(0xff2d9973))
    val pie = tag == "md-pie-chart"
    val spark = tag == "md-sparkline"
    val series = if(pie || spark) listOf(ChartSeries(p.label(), p.list("data").map { item -> if(item is Number) item.toFloat() else awcMap(item).num("value", Float.NaN).takeIf { it.isFinite() } }, palette[0])) else p.list("series").mapIndexed { index, item ->
        val series = awcMap(item)
        ChartSeries(series.str("label", series.str("id", "Series ${index + 1}")), series.list("data").map { point -> when(point) { is Number -> point.toFloat(); is List<*> -> (point.lastOrNull() as? Number)?.toFloat(); is Map<*, *> -> (point["y"] as? Number)?.toFloat(); else -> null } }, awcColor(series.str("color"), palette[index % palette.size]))
    }
    var hidden by remember { mutableStateOf(setOf<Int>()) }
    var selected by remember { mutableStateOf<String?>(null) }
    val visible = series.filterIndexed { index, _ -> index !in hidden }
    val values = visible.flatMap { it.values.filterNotNull() }
    val axis = awcMap(p["xAxis"]).list("data").map { it.toString() }
    val count = visible.maxOfOrNull { it.values.size } ?: 0
    val minimum = if(spark) p.num("min", min(0f, values.minOrNull() ?: 0f)) else min(0f, values.minOrNull() ?: 0f)
    val maximum = if(spark) p.num("max", max(1f, values.maxOrNull() ?: 1f)) else max(1f, values.maxOrNull() ?: 1f)
    val span = (maximum - minimum).coerceAtLeast(.001f)
    val gridColor = MaterialTheme.colorScheme.outlineVariant
    val summaries = series.joinToString(". ") { s -> "${s.label}: ${s.values.joinToString { it?.toString() ?: "missing" }}" }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        if(p.label().isNotBlank()) Text(p.label(), style = MaterialTheme.typography.titleMedium)
        if(p.str("subtitle").isNotBlank()) Text(p.str("subtitle"), style = MaterialTheme.typography.bodySmall)
        if(p.bool("loading")) { LinearProgressIndicator(Modifier.fillMaxWidth()); Text(p.str("loadingLabel", "Loading")); return@Column }
        if(values.isEmpty()) { Text(p.str("labelEmpty", "No data")); return@Column }
        Canvas(Modifier.fillMaxWidth().height(p.num("heightProp", if(spark) 72f else 200f).coerceIn(48f, 600f).dp).semantics { contentDescription = p.str("summary", summaries) }.pointerInput(series, tag) {
            detectTapGestures { point ->
                var index = if(tag == "md-bar-chart" || (spark && p.str("variant") == "bar")) (point.x / size.width * count).toInt() else (point.x / size.width * (count - 1)).roundToInt()
                index = index.coerceIn(0, (count - 1).coerceAtLeast(0))
                var seriesIndex = visible.indices.minByOrNull { i -> val v = visible[i].values.getOrNull(index) ?: minimum; abs(point.y - (size.height - 4f - (v - minimum) / span * (size.height - 8f))) } ?: 0
                if(pie) {
                    val diameter = min(size.width, size.height).toFloat()
                    val degrees = Math.toDegrees(atan2((point.y - diameter / 2).toDouble(), (point.x - size.width / 2).toDouble())).toFloat()
                    val relative = ((degrees - p.num("startAngle", 0f)) % 360f + 360f) % 360f
                    val sweep = (p.num("endAngle", 360f) - p.num("startAngle", 0f)).coerceIn(1f, 360f)
                    val total = values.sum().coerceAtLeast(.001f)
                    var accumulated = 0f
                    index = values.indexOfFirst { v -> accumulated += v.coerceAtLeast(0f) / total * sweep; relative <= accumulated }.coerceAtLeast(0)
                    seriesIndex = 0
                }
                val y = visible.getOrNull(seriesIndex)?.values?.getOrNull(index)
                val pointLabel = if(pie) awcMap(p.list("data").getOrNull(index)).str("label", "${index + 1}") else axis.getOrNull(index) ?: "${index + 1}"
                selected = "$pointLabel: $y"
                emit(when { pie -> "mdSliceClick"; spark -> "mdSparkClick"; tag == "md-bar-chart" -> "mdBarClick"; tag == "md-area-chart" -> "mdAreaClick"; else -> "mdMarkerClick" }, mapOf("dataIndex" to index, "seriesIndex" to seriesIndex, "value" to y, "label" to pointLabel))
            }
        }) {
            val bottom = size.height - 4f
            fun y(value: Float) = bottom - (value - minimum) / span * (size.height - 8f)
            if(!spark && !pie && (p["grid"] != false && p.str("grid") != "none")) repeat(5) { i -> val lineY = 4f + i * (size.height - 8f) / 4; drawLine(gridColor, Offset(0f, lineY), Offset(size.width, lineY), 1f) }
            if(pie) {
                val total = values.filter { it > 0f }.sum().coerceAtLeast(.001f)
                val diameter = min(size.width, size.height)
                val topLeft = Offset((size.width - diameter) / 2, 0f)
                var angle = p.num("startAngle", 0f)
                values.forEachIndexed { index, value -> val sweep = value.coerceAtLeast(0f) / total * (p.num("endAngle", 360f) - p.num("startAngle", 0f)).coerceIn(1f, 360f); drawArc(palette[index % palette.size], angle, sweep, useCenter = p.num("innerRadius") <= 0f, topLeft = topLeft, size = Size(diameter, diameter), style = if(p.num("innerRadius") > 0f) Stroke(diameter * .2f) else androidx.compose.ui.graphics.drawscope.Fill); angle += sweep }
            } else visible.forEachIndexed { seriesIndex, s ->
                val bar = tag == "md-bar-chart" || (spark && p.str("variant") == "bar")
                if(bar) s.values.forEachIndexed { index, value -> if(value != null) {
                    val group = size.width / count.coerceAtLeast(1)
                    val width = group * .8f / visible.size.coerceAtLeast(1)
                    val x = index * group + group * .1f + seriesIndex * width
                    val zero = y(0f.coerceIn(minimum, maximum))
                    drawRoundRect(s.color, Offset(x, min(y(value), zero)), Size(width.coerceAtLeast(1f), abs(zero - y(value)).coerceAtLeast(1f)), androidx.compose.ui.geometry.CornerRadius(p.num("cornerRadius", 3f)))
                } }
                else {
                    val path = Path(); var started = false
                    val area = tag == "md-area-chart" || p.bool("area") || (spark && p.str("variant") == "area")
                    s.values.forEachIndexed { index, value ->
                        if(value == null) { if(!p.bool("connectNulls")) started = false }
                        else { val x = if(count <= 1) size.width / 2 else index * size.width / (count - 1); if(!started) { path.moveTo(x, y(value)); started = true } else path.lineTo(x, y(value)); if(p.bool("showMarks")) drawCircle(s.color, p.num("markSize", 4f), Offset(x, y(value))) }
                    }
                    if(area && s.values.none { it == null }) { val fill = Path().apply { addPath(path); lineTo(size.width, bottom); lineTo(0f, bottom); close() }; drawPath(fill, s.color.copy(alpha = p.num("fillOpacity", .2f).coerceIn(0f, 1f))) }
                    drawPath(path, s.color, style = Stroke(p.num("lineWidth", 3f)))
                }
            }
        }
        if(!spark && !pie && axis.isNotEmpty()) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { axis.take(8).forEach { Text(it, style = MaterialTheme.typography.labelSmall) } }
        if(!spark && p.str("legend", "bottom") != "none" && p["legend"] != false) FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if(pie) p.list("data").forEachIndexed { index, datum -> AssistChip(onClick = { emit("mdLegendClick", mapOf("dataIndex" to index)) }, label = { Text(awcMap(datum).str("label", "${index + 1}") + ": ${values.getOrNull(index)}") }) }
            else series.forEachIndexed { index, s -> FilterChip(selected = index !in hidden, onClick = { hidden = if(index in hidden) hidden - index else hidden + index; emit("mdLegendClick", mapOf("seriesIndex" to index, "visible" to (index !in hidden))) }, label = { Text(s.label) }) }
        }
        selected?.let { Text(it, style = MaterialTheme.typography.labelMedium) }
    }
    LaunchedEffect(series) { emit("mdReady", null) }
}

@Composable internal fun TransferList(p: Props, emit: EventSink) {
    val items = p.choices("items")
    var target by awcState(p["value"]) { p.list("value").map { it.toString() }.toSet() }
    var checked by remember { mutableStateOf(setOf<String>()) }
    var leftQuery by remember { mutableStateOf("") }
    var rightQuery by remember { mutableStateOf("") }
    fun visible(right: Boolean) = items.filter { (it.value in target) == right && it.label.contains(if(right) rightQuery else leftQuery, true) }
    fun move(right: Boolean, all: Boolean) {
        val moved = visible(!right).filter { !it.disabled && (all || it.value in checked) }.map { it.value }
        target = if(right) target + moved.toSet() else target - moved.toSet(); checked = checked - moved.toSet()
        emit("mdChange", target.toList()); emit("mdMove", mapOf("direction" to if(right) "right" else "left", "moved" to moved, "target" to target.toList()))
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(false, true).forEach { right ->
                OutlinedCard(Modifier.weight(1f)) {
                    Column(Modifier.padding(8.dp)) {
                        Text(p.str(if(right) "targetTitle" else "sourceTitle", if(right) "Chosen" else "Choices"), style = MaterialTheme.typography.titleSmall)
                        if(p.bool("searchable", true)) OutlinedTextField(if(right) rightQuery else leftQuery, { if(right) rightQuery = it else leftQuery = it }, label = { Text(p.str(if(right) "targetSearchPlaceholder" else "sourceSearchPlaceholder", "Search")) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        if(p.bool("showSelectAll", true)) Row(verticalAlignment = Alignment.CenterVertically) {
                            val eligible = visible(right).filter { !it.disabled }.map { it.value }
                            Checkbox(eligible.isNotEmpty() && eligible.all { it in checked }, { check -> checked = if(check) checked + eligible else checked - eligible.toSet() }, enabled = p.enabled())
                            Text("${eligible.count { it in checked }}/${eligible.size}", style = MaterialTheme.typography.labelSmall)
                        }
                        if(visible(right).isEmpty()) Text(p.str("emptyText", "No items"), Modifier.padding(8.dp))
                        visible(right).forEach { item -> Row(Modifier.fillMaxWidth().clickable(enabled = p.enabled() && !item.disabled) { checked = if(item.value in checked) checked - item.value else checked + item.value }, verticalAlignment = Alignment.CenterVertically) { Checkbox(item.value in checked, null, enabled = p.enabled() && !item.disabled); Column { Text(item.label); if(item.description.isNotBlank()) Text(item.description, style = MaterialTheme.typography.labelSmall) } } }
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            if(!p.bool("singleStepOnly")) TextButton(onClick = { move(false, true) }, enabled = p.enabled()) { Text("≪", Modifier.semantics { contentDescription = p.str("moveAllLeftLabel", "Move all left") }) }
            TextButton(onClick = { move(false, false) }, enabled = p.enabled()) { Text("←", Modifier.semantics { contentDescription = p.str("moveLeftLabel", "Move selected left") }) }
            TextButton(onClick = { move(true, false) }, enabled = p.enabled()) { Text("→", Modifier.semantics { contentDescription = p.str("moveRightLabel", "Move selected right") }) }
            if(!p.bool("singleStepOnly")) TextButton(onClick = { move(true, true) }, enabled = p.enabled()) { Text("≫", Modifier.semantics { contentDescription = p.str("moveAllRightLabel", "Move all right") }) }
        }
    }
}

@Composable internal fun OrganizationChart(p: Props, emit: EventSink) {
    var selected by awcState(p["selectedIds"]) { p.list("selectedIds").map { it.toString() }.toSet() }
    val expanded = remember { mutableStateMapOf<String, Boolean>() }
    val mode = p.str("selectionMode", "none")
    @Composable fun Node(node: Props, depth: Int) {
        val id = node.str("id")
        val children = node.list("children")
        val open = expanded[id] ?: node.bool("expanded", true)
        Column(Modifier.padding(start = if(depth == 0) 0.dp else 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Surface(shape = MaterialTheme.shapes.medium, color = if(id in selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.fillMaxWidth().clickable(enabled = mode != "none" && node.bool("selectable", true)) {
                selected = if(mode == "multiple") { if(id in selected) selected - id else selected + id } else setOf(id)
                emit("mdSelectionChange", mapOf("node" to node, "selectedIds" to selected.toList()))
            }.semantics { this.selected = id in selected; stateDescription = if(open) "Expanded" else "Collapsed" }) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    AWCComponent("md-avatar", mapOf("name" to node.str("name"), "initials" to node["avatarInitials"]))
                    Column(Modifier.padding(start = 12.dp).weight(1f)) { Text(node.str("name"), style = MaterialTheme.typography.titleSmall); if(node.str("title").isNotBlank()) Text(node.str("title"), style = MaterialTheme.typography.bodySmall) }
                    if(children.isNotEmpty() && p.bool("collapsible", true)) IconButton(onClick = { expanded[id] = !open; emit("mdNodeToggle", mapOf("node" to node, "expanded" to !open)) }) { Glyph(if(open) "expand_less" else "expand_more", p.str(if(open) "collapseLabel" else "expandLabel", if(open) "Collapse" else "Expand")) }
                }
            }
            if(open) children.forEach { Node(awcMap(it), depth + 1) }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.semantics { contentDescription = p.label("Organization chart") }) { p.list("nodes").forEach { Node(awcMap(it), 0) } }
}
