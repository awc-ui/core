@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp

internal class NavigationScope(var active: Int, private val onChange: (Int, AWCValue) -> Unit) { private val children = mutableListOf<Any>(); fun index(key: Any): Int { if(key !in children) children.add(key); return children.indexOf(key) }; val count get() = children.size; fun change(index: Int, value: AWCValue = null) = onChange(index, value) }
internal val LocalNavigation = compositionLocalOf<NavigationScope?> { null }

@Composable internal fun NavigationComponent(tag: String, p: Props, emit: EventSink, slot: Slot?) {
    when(tag) {
        "md-navigation-bar", "md-navigation-rail", "md-tabs", "md-stepper", "md-tab-panels" -> {
            val key = when(tag) { "md-tabs" -> "activeTabIndex"; "md-stepper" -> "active"; else -> "activeIndex" }
            var active by awcState(p[key]) { p.int(key) }
            val callback by rememberUpdatedState<(Int, AWCValue) -> Unit>({ next, value -> val previous = active; active = next; emit(when(tag) { "md-stepper" -> "mdStepChange"; "md-navigation-bar" -> "mdChange"; else -> "mdTabChange" }, when(tag) { "md-stepper" -> mapOf("index" to next, "previous" to previous); "md-navigation-rail" -> mapOf("index" to next, "value" to value); else -> mapOf("index" to next, "previousIndex" to previous) }) })
            val scope = remember(tag) { NavigationScope(active) { index, value -> callback(index, value) } }
            scope.active = active
            CompositionLocalProvider(LocalNavigation provides scope) {
                when(tag) {
                    "md-navigation-bar" -> Surface(color = MaterialTheme.colorScheme.surfaceContainer) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) { slot?.invoke("") } }
                    "md-navigation-rail" -> Surface(color = MaterialTheme.colorScheme.surfaceContainer, shape = MaterialTheme.shapes.large) { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { slot?.invoke("header"); slot?.invoke(""); slot?.invoke("footer") } }
                    "md-tabs" -> Column { Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) { slot?.invoke("") }; if(p.bool("divider", true)) HorizontalDivider() }
                    "md-stepper" -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        slot?.invoke("")
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { if(active > 0) { emit("mdBeforeChange", mapOf("index" to active - 1, "previous" to active)); scope.change(active - 1) } }, enabled = active > 0 && !p.bool("readonly")) { Text(p.str("backLabel", "Back")) }
                            Button(onClick = { if(active + 1 >= scope.count) emit("mdComplete", null) else { emit("mdBeforeChange", mapOf("index" to active + 1, "previous" to active)); scope.change(active + 1) } }, enabled = !p.bool("readonly") && !p.bool("nextDisabled") && !p.bool("loading")) { Text(p.str(if(active + 1 >= scope.count) "finishLabel" else "nextLabel", if(active + 1 >= scope.count) "Finish" else "Next")) }
                        }
                    }
                    else -> Column { slot?.invoke("") }
                }
            }
        }
        "md-navigation-tab", "md-navigation-rail-tab", "md-tab", "md-step" -> {
            val parent = LocalNavigation.current
            val identity = remember { Any() }
            val index = parent?.index(identity) ?: 0
            val active = parent?.let { it.active == index } ?: p.bool("active")
            val click = { parent?.change(index, p["value"]); emit(if(tag == "md-step") "mdStepClick" else "mdTabClick", when(tag) { "md-tab" -> null; "md-navigation-rail-tab" -> mapOf("value" to p.str("value")); else -> mapOf("index" to index) }) }
            when(tag) {
                "md-step" -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth().clickable(enabled = p.enabled() && p.bool("editable", true), onClick = click).padding(8.dp).semantics { selected = active }, verticalAlignment = Alignment.CenterVertically) {
                        FilledTonalIconButton(onClick = click, enabled = p.enabled()) { if(p.bool("completed")) Glyph("check") else Text("${index + 1}") }
                        Column(Modifier.padding(start = 12.dp)) { Text(p.label(), style = MaterialTheme.typography.titleMedium); if(p.str("description").isNotBlank()) Text(p.str("description")); if(p.bool("error")) Text(p.str("errorText"), color = MaterialTheme.colorScheme.error) }
                    }
                    if(active) { Box(Modifier.padding(start = 16.dp)) { slot?.invoke("") }; if(!p.bool("hideActions")) Row { TextButton(onClick = { emit("mdStepBack", mapOf("index" to index)); parent?.change((index - 1).coerceAtLeast(0)) }) { Text("Back") }; TextButton(onClick = { emit("mdStepNext", mapOf("index" to index)); parent?.change(index + 1) }) { Text("Continue") } } }
                }
                "md-tab" -> FilterChip(selected = active, onClick = click, enabled = p.enabled(), label = { Text(p.label()) }, leadingIcon = if(p.str("icon").isNotBlank()) ({ Glyph(p.str("icon")) }) else null)
                else -> Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable(enabled = p.enabled(), onClick = click).padding(12.dp).semantics { selected = active }) {
                    Surface(color = if(active) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceContainer, shape = MaterialTheme.shapes.extraLarge) { Box(Modifier.padding(horizontal = 20.dp, vertical = 6.dp)) { Glyph(if(active) p.str("activeIcon", p.str("icon", "home")) else p.str("icon", "home"), p.label()) } }
                    if(p.str("labelVisibility") != "hidden" && p.str("labelBehavior") != "always-hide") Text(p.label(), style = MaterialTheme.typography.labelMedium)
                    if(p.bool("badge")) Badge { Text(p.str("badgeValue")) }
                    slot?.invoke("submenu")
                }
            }
        }
        "md-tab-panel" -> { if(p.bool("active", true)) slot?.invoke("") }
        "md-breadcrumbs" -> Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) { slot?.invoke("") }
        "md-breadcrumb-item" -> {
            val uri = androidx.compose.ui.platform.LocalUriHandler.current
            TextButton(onClick = { emit("mdSelect", mapOf("href" to p["href"])); if(p.str("href").startsWith("https://")) uri.openUri(p.str("href")) }, enabled = p.enabled() && !p.bool("current")) { if(p.str("icon").isNotBlank()) Glyph(p.str("icon")); slot?.invoke(""); if(p.bool("collapsed")) Text("…") }
        }
    }
}

@Composable internal fun TableComponent(tag: String, p: Props, emit: EventSink, slot: Slot?) {
    when(tag) {
        "md-table", "md-table-container" -> Surface(shape = MaterialTheme.shapes.medium, tonalElevation = if(p.str("variant") == "elevated") 3.dp else 0.dp, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.horizontalScroll(rememberScrollState()).widthIn(min = 300.dp).padding(8.dp)) {
                if(p.str("caption").isNotBlank()) Text(p.str("caption"), style = MaterialTheme.typography.titleMedium)
                if(p.bool("loading")) LinearProgressIndicator(Modifier.fillMaxWidth())
                slot?.invoke("")
            }
        }
        "md-table-head" -> Surface(color = MaterialTheme.colorScheme.surfaceContainerHighest) { Column { slot?.invoke("") } }
        "md-table-body", "md-table-foot" -> Column { slot?.invoke("") }
        "md-table-row" -> {
            var selected by awcState(p["selected"]) { p.bool("selected") }
            var expanded by awcState(p["expanded"]) { p.bool("expanded") }
            Column {
                Row(Modifier.fillMaxWidth().background(if(selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface).clickable(enabled = p.enabled() && p.bool("clickable")) { emit("mdRowClick", mapOf("value" to p["value"])) }.padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    if(p.bool("selectable")) Checkbox(selected, { selected = it; emit("mdRowSelectionChange", mapOf("selected" to it, "value" to p["value"])) }, enabled = p.enabled())
                    if(p.bool("expandable")) IconButton(onClick = { expanded = !expanded; emit("mdRowExpandedChange", mapOf("expanded" to expanded)) }) { Glyph(if(expanded) "expand_less" else "expand_more", "Expand row") }
                    slot?.invoke("")
                }
                if(expanded) slot?.invoke("expanded")
                HorizontalDivider()
            }
        }
        "md-table-cell" -> Box(Modifier.widthIn(min = 100.dp).padding(horizontal = if(p.str("padding") == "none") 0.dp else 12.dp, vertical = 12.dp).semantics { if(p.bool("head")) heading() }, contentAlignment = if(p.bool("numeric") || p.str("align") == "end") Alignment.CenterEnd else Alignment.CenterStart) { slot?.invoke("") }
        "md-table-sort-label" -> {
            var order by awcState(p["order"]) { p.str("order", p.str("defaultOrder", "asc")) }
            TextButton(onClick = { order = if(order == "asc") "desc" else "asc"; emit("mdSortRequest", mapOf("column" to p["column"], "defaultOrder" to p.str("defaultOrder", "asc"))) }, enabled = p.enabled()) { slot?.invoke(""); Glyph(if(order == "asc") "expand_less" else "expand_more") }
        }
        "md-table-expand-toggle" -> { var expanded by remember { mutableStateOf(false) }; IconButton(onClick = { expanded = !expanded }) { Glyph(if(expanded) "expand_less" else "expand_more", p.str("buttonLabel", "Expand row")) } }
        "md-table-pagination" -> {
            var page by awcState(p["page"]) { p.int("page") }
            var size by awcState(p["rowsPerPage"]) { p.int("rowsPerPage", 10).coerceAtLeast(1) }
            val count = p.int("count").coerceAtLeast(0)
            val last = ((count - 1).coerceAtLeast(0) / size)
            fun change(next: Int) { page = next.coerceIn(0, last); emit("mdPageChange", mapOf("page" to page)) }
            Column {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("${if(count == 0) 0 else page * size + 1}–${minOf((page + 1) * size, count)} / $count", Modifier.weight(1f))
                    if(p.bool("showFirstLast")) TextButton(onClick = { change(0) }, enabled = p.enabled() && page > 0) { Text("≪") }
                    IconButton(onClick = { change(page - 1) }, enabled = p.enabled() && page > 0) { Glyph("chevron_left", p.str("labelPreviousPage", "Previous page")) }
                    IconButton(onClick = { change(page + 1) }, enabled = p.enabled() && page < last) { Glyph("chevron_right", p.str("labelNextPage", "Next page")) }
                    if(p.bool("showFirstLast")) TextButton(onClick = { change(last) }, enabled = p.enabled() && page < last) { Text("≫") }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { p.list("rowsPerPageOptions").forEach { option -> val amount = (option as? Number)?.toInt() ?: 10; if(amount > 0) FilterChip(size == amount, { size = amount; page = 0; emit("mdRowsPerPageChange", mapOf("rowsPerPage" to amount)); emit("mdPageChange", mapOf("page" to 0)) }, label = { Text(amount.toString()) }, enabled = p.enabled()) } }
            }
        }
        "md-table-toolbar" -> Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { Text(if(p.int("numSelected") > 0) "${p.int("numSelected")} ${p.str("labelSelected", "selected")}" else p.str("headline"), style = MaterialTheme.typography.titleMedium); if(p.str("supportingText").isNotBlank()) Text(p.str("supportingText")) }; slot?.invoke(""); slot?.invoke("actions") }
    }
}
