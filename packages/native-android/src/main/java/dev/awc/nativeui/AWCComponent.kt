@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Native Compose adapter for an AWC source tag. Props use source camelCase names.
 * Events retain source names and JSON payloads; DOM event objects are intentionally absent.
 * Content receives each supported source slot name (empty string means default slot).
 * Unknown tags fail explicitly. See support.json for the supported property subset.
 */
@Composable
fun AWCComponent(
    tag: String,
    properties: Map<String, AWCValue> = emptyMap(),
    modifier: Modifier = Modifier,
    onEvent: (String, AWCValue) -> Unit = { _, _ -> },
    content: (@Composable (String) -> Unit)? = null,
) {
    val p = awcProperties(tag, properties)
    val spacing = (12 + p.int("density") * 2).coerceAtLeast(4).dp
    Box(modifier) {
        when (tag) {
            "md-button", "md-icon-button", "md-fab", "md-fab-menu-item", "md-split-button", "md-segmented-button" -> Action(tag, p, onEvent, content)
            "md-checkbox", "md-radio", "md-switch", "md-slider", "md-rating", "md-text-field", "md-number-field", "md-otp-field", "md-search", "md-select", "md-multi-select", "md-autocomplete", "md-select-option" -> InputComponent(tag, p, onEvent, content)
            "md-date-picker", "md-time-picker", "md-color-picker" -> PickerComponent(tag, p, onEvent)
            "md-dialog", "md-bottom-sheet", "md-side-sheet", "md-menu", "md-fab-menu", "md-tooltip", "md-snackbar" -> OverlayComponent(tag, p, onEvent, content)
            "md-bar-chart", "md-line-chart", "md-area-chart", "md-pie-chart", "md-sparkline" -> ChartComponent(tag, p, onEvent)
            "md-transfer-list" -> TransferList(p, onEvent)
            "md-organization-chart" -> OrganizationChart(p, onEvent)
            "md-table", "md-table-container", "md-table-head", "md-table-body", "md-table-foot", "md-table-row", "md-table-cell", "md-table-sort-label", "md-table-expand-toggle", "md-table-pagination", "md-table-toolbar" -> TableComponent(tag, p, onEvent, content)
            "md-accordion", "md-accordion-item" -> Accordion(tag, p, onEvent, content)
            "md-navigation-bar", "md-navigation-rail", "md-tabs", "md-navigation-tab", "md-navigation-rail-tab", "md-tab", "md-tab-panels", "md-tab-panel", "md-stepper", "md-step", "md-breadcrumbs", "md-breadcrumb-item" -> NavigationComponent(tag, p, onEvent, content)
            "md-list" -> SelectionContainer(tag, p, onEvent, content)
            "md-menu-item-group" -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (p.label().isNotBlank()) Text(p.label(), style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(spacing).semantics { heading() })
                content?.invoke("")
            }
            "md-list-item", "md-menu-item", "md-sub-menu-item" -> {
                var localSelected by awcState(p["selected"]) { p.bool("selected") }
                val parent = LocalSelection.current?.takeIf { it.tag == "md-list" && it.props.str("selectionMode") != "none" }
                val identity = remember { Any() }
                val index = parent?.register(identity, p.str("headline"), localSelected) ?: 0
                val selected = parent?.states?.get(identity) ?: localSelected
                DisposableEffect(parent, identity) { onDispose { parent?.remove(identity) } }
                LaunchedEffect(p["selected"]) { if(parent != null) parent.states[identity] = p.bool("selected") }
                var expanded by awcState(p["expanded"]) { p.bool("expanded") }
                Column {
                    ListItem(
                        headlineContent = { if (p.str("headline").isNotEmpty()) Text(p.str("headline")) else content?.invoke("") },
                        supportingContent = if (p.str("supportingText").isNotEmpty()) ({ Text(p.str("supportingText")) }) else null,
                        overlineContent = if (p.str("overline").isNotEmpty()) ({ Text(p.str("overline")) }) else null,
                        leadingContent = { if (p.str("leadingIcon").isNotBlank()) Glyph(p.str("leadingIcon")); content?.invoke("leading") },
                        trailingContent = {
                            if (p.bool("expandable") || tag == "md-sub-menu-item") IconButton(onClick = { expanded = !expanded; onEvent("mdExpand", mapOf("expanded" to expanded)) }, enabled = p.enabled()) { Glyph(if (expanded) "expand_less" else "expand_more") }
                            else if (p.str("trailingSupportingText", p.str("trailingText")).isNotBlank()) Text(p.str("trailingSupportingText", p.str("trailingText")))
                            else if (p.str("type") in listOf("checkbox", "radio")) Checkbox(selected, null)
                            content?.invoke("trailing")
                        },
                        colors = ListItemDefaults.colors(containerColor = if (selected) MaterialTheme.colorScheme.secondaryContainer else Color.Transparent),
                        modifier = Modifier.clickable(enabled = p.enabled()) {
                            localSelected = parent?.toggle(identity) ?: !localSelected
                            onEvent("mdClick", null)
                            if (tag == "md-list-item") { onEvent("mdItemClick", mapOf("index" to index, "selected" to localSelected)); onEvent("mdItemSelect", mapOf("index" to index, "selected" to localSelected)) }
                        }.semantics { this.selected = selected }
                    )
                    if (expanded) content?.invoke(if(tag == "md-list-item") "expanded-content" else "submenu")
                    if (p.bool("divider")) HorizontalDivider()
                }
            }
            "md-button-group", "md-segmented-button-set" -> SelectionContainer(tag, p, onEvent, content)
            "md-card" -> {
                val shape = RoundedCornerShape(16.dp)
                val body: @Composable ColumnScope.() -> Unit = { content?.invoke("") }
                val m = if (p.bool("fullWidth")) Modifier.fillMaxWidth() else Modifier
                if (p.bool("interactive")) Card(onClick = { onEvent("mdClick", null) }, enabled = p.enabled(), shape = shape, modifier = m, content = body)
                else when(p.str("variant")) {
                    "outlined" -> OutlinedCard(modifier = m, shape = shape, content = body)
                    "filled" -> Card(modifier = m, shape = shape, content = body)
                    else -> ElevatedCard(modifier = m, shape = shape, content = body)
                }
            }
            "md-chip" -> {
                var selected by awcState(p["selected"]) { p.bool("selected") }
                var removed by remember { mutableStateOf(false) }
                if (!removed) InputChip(selected = selected, onClick = {
                    if (p.bool("selectable") || p.str("variant") == "filter") { selected = !selected; onEvent("mdSelect", mapOf("selected" to selected)) }
                    onEvent("mdClick", null)
                }, enabled = p.enabled(), label = { if (p.label().isNotBlank()) Text(p.label()) else content?.invoke("") },
                    leadingIcon = if (p.str("icon").isNotBlank()) ({ Glyph(p.str("icon")) }) else null,
                    trailingIcon = if (p.bool("removable")) ({ IconButton(onClick = { removed = true; onEvent("mdRemove", null) }, modifier = Modifier.size(24.dp), enabled = p.enabled()) { Glyph("close") } }) else null)
            }
            "md-avatar" -> Avatar(p, onEvent, content)
            "md-badge" -> Badge { if (p.str("variant") != "dot") Text(if (p.num("value") > p.num("max", 99f)) "${p.int("max", 99)}+" else p.str("value")) }
            "md-divider" -> if (p.bool("vertical")) VerticalDivider(Modifier.height(48.dp)) else HorizontalDivider(Modifier.padding(start = if (p.bool("inset") || p.bool("insetStart")) 16.dp else 0.dp, end = if (p.bool("inset") || p.bool("insetEnd")) 16.dp else 0.dp))
            "md-progress-indicator", "md-loading-indicator", "md-meter" -> {
                val min = p.num("min")
                val max = p.num("max", if (tag == "md-meter") 100f else 1f).coerceAtLeast(min + 0.001f)
                val value = ((p.num("value") - min) / (max - min)).coerceIn(0f, 1f)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (p.bool("showLabel", true) && p.label().isNotEmpty()) Text(p.label())
                    if (p.str("variant") == "circular" || tag == "md-loading-indicator") {
                        if (p.bool("indeterminate") || tag == "md-loading-indicator") CircularProgressIndicator(Modifier.size(40.dp)) else CircularProgressIndicator(progress = { value }, modifier = Modifier.size(40.dp))
                    } else {
                        if (p.bool("indeterminate")) LinearProgressIndicator(Modifier.fillMaxWidth()) else LinearProgressIndicator(progress = { value }, modifier = Modifier.fillMaxWidth())
                    }
                    if (p.bool("showValue")) Text(p.str("valueText", "${p.num("value")}"))
                }
                LaunchedEffect(value) { if (tag == "md-progress-indicator" && value >= 1f) onEvent("mdComplete", null) }
            }
            "md-skeleton" -> Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.semantics { if (p.bool("announce")) contentDescription = p.str("ariaLabelProp", "Loading") }) {
                repeat(p.int("lines", 1).coerceIn(1, 30)) { Box(Modifier.fillMaxWidth(if (it % 2 == 0) 1f else .75f).height(p.num("height", 24f).coerceIn(8f, 200f).dp).clip(if (p.str("variant") == "circular") CircleShape else RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) }
            }
            "md-status-dot" -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val color = when(p.str("state")) { "success", "online" -> Color(0xff388e3c); "error", "danger", "busy" -> MaterialTheme.colorScheme.error; "warning", "away" -> Color(0xffffa000); else -> MaterialTheme.colorScheme.primary }
                Box(Modifier.size(12.dp).clip(if (p.str("shape") == "square") RoundedCornerShape(2.dp) else CircleShape).background(color).semantics { contentDescription = p.label(p.str("state")) })
                if (p.bool("inline")) Text(p.label())
            }
            "md-toolbar", "md-app-bar" -> Surface(color = MaterialTheme.colorScheme.surfaceContainer, shape = RoundedCornerShape(16.dp)) {
                Row(Modifier.fillMaxWidth().padding(spacing), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    content?.invoke("leading")
                    if (p.str("leadingIcon").isNotBlank()) IconButton(onClick = { onEvent("mdLeadingClick", null) }) { Glyph(p.str("leadingIcon"), p.str("leadingIconLabel")) }
                    Column(Modifier.weight(1f)) {
                        if (p.str("headline").isNotEmpty()) Text(p.str("headline"), style = MaterialTheme.typography.titleLarge)
                        if (p.str("subtitle").isNotEmpty()) Text(p.str("subtitle"), style = MaterialTheme.typography.bodySmall)
                        content?.invoke("")
                    }
                    content?.invoke("trailing")
                }
            }
            "md-ripple" -> Box(Modifier.clip(RoundedCornerShape(16.dp)).clickable(enabled = p.enabled()) {}) { content?.invoke("") }
            else -> error("No native Android adapter for $tag")
        }
    }
}

@Composable internal fun Glyph(name: String, description: String? = null) {
    val icon: ImageVector = when(name) {
        "add", "plus" -> Icons.Default.Add; "remove", "minus" -> Icons.Default.Remove
        "close", "clear" -> Icons.Default.Close; "check", "done" -> Icons.Default.Check
        "search" -> Icons.Default.Search; "favorite", "favorite_border" -> Icons.Default.Favorite
        "star", "star_border" -> Icons.Default.Star; "home" -> Icons.Default.Home
        "settings" -> Icons.Default.Settings; "person", "account_circle" -> Icons.Default.Person
        "menu" -> Icons.Default.Menu; "more_vert" -> Icons.Default.MoreVert
        "arrow_back", "chevron_left" -> Icons.AutoMirrored.Filled.ArrowBack
        "arrow_forward", "chevron_right" -> Icons.AutoMirrored.Filled.ArrowForward
        "expand_less" -> Icons.Default.KeyboardArrowUp; "expand_more", "arrow_drop_down" -> Icons.Default.KeyboardArrowDown
        "calendar_month", "calendar_today", "event" -> Icons.Default.DateRange
        "schedule", "access_time" -> Icons.Default.Schedule; "visibility" -> Icons.Default.Visibility
        "visibility_off" -> Icons.Default.VisibilityOff; "info" -> Icons.Default.Info
        "delete" -> Icons.Default.Delete; "edit" -> Icons.Default.Edit; "mail" -> Icons.Default.Email
        "notifications" -> Icons.Default.Notifications; "download" -> Icons.Default.Download
        "upload" -> Icons.Default.Upload; "palette" -> Icons.Default.Palette
        else -> Icons.Default.Circle
    }
    Icon(icon, description, Modifier.size(22.dp))
}

@Composable private fun Action(tag: String, p: Props, emit: EventSink, slot: Slot?) {
    var localSelected by awcState(p["selected"]) { p.bool("selected") }
    val group = LocalSelection.current?.takeIf { it.tag == "md-button-group" || it.tag == "md-segmented-button-set" }
    val identity = remember { Any() }
    group?.register(identity, p.str("value"), localSelected)
    val selected = group?.states?.get(identity) ?: localSelected
    DisposableEffect(group, identity) { onDispose { group?.remove(identity) } }
    LaunchedEffect(p["selected"]) { if(group != null) group.states[identity] = p.bool("selected") }
    var trailingChecked by awcState(p["trailingChecked"]) { p.bool("trailingChecked") }
    val uri = LocalUriHandler.current
    val enabled = p.enabled() && !p.bool("loading")
    val click = {
        if (group != null || p.bool("toggle") || tag == "md-segmented-button") localSelected = group?.toggle(identity) ?: !localSelected
        val detail = eventDetail("value" to p["value"], "toggle" to p.bool("toggle"), "selected" to localSelected, "href" to p["href"], "target" to p["target"])
        emit(if (tag == "md-segmented-button") "mdSegmentClick" else if (tag == "md-split-button") "mdLeadingClick" else "mdClick", when(tag) { "md-button" -> detail; "md-icon-button" -> mapOf("selected" to localSelected); "md-segmented-button" -> mapOf("value" to p.str("value"), "selected" to localSelected); else -> null })
        if (p.bool("toggle") && tag == "md-button") emit("mdChange", eventDetail("selected" to localSelected, "value" to p["value"]))
        if (p.str("href").startsWith("https://") || p.str("href").startsWith("http://")) uri.openUri(p.str("href"))
    }
    val label: @Composable RowScope.() -> Unit = {
        if (p.bool("loading")) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
        else if (p.str("icon").isNotBlank()) Glyph(if(selected) p.str("selectedIcon", p.str("icon")) else p.str("icon"))
        slot?.invoke(if(tag == "md-button") "leading-icon" else "icon")
        if (p.label().isNotBlank()) Text(p.label(), Modifier.padding(horizontal = 6.dp)) else slot?.invoke("")
        if (p.str("trailingIcon").isNotBlank()) Glyph(p.str("trailingIcon"))
        slot?.invoke("trailing-icon")
    }
    val modifier = (if (p.bool("fullWidth")) Modifier.fillMaxWidth() else Modifier).semantics { if(p.bool("toggle")) this.selected = selected }
    when(tag) {
        "md-icon-button" -> IconToggleButton(checked = selected, onCheckedChange = { click() }, enabled = enabled, modifier = modifier) { Glyph(p.str("icon", "favorite"), p.label(p.str("icon"))) }
        "md-fab" -> FloatingActionButton(onClick = { if(enabled) click() }, modifier = modifier.semantics { if(!enabled) disabled() }) { Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, content = label) }
        "md-split-button" -> Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) { Button(onClick = click, enabled = enabled, content = label); FilledIconButton(onClick = { trailingChecked = !trailingChecked; emit("mdTrailingClick", mapOf("checked" to trailingChecked)) }, enabled = enabled) { Glyph(p.str("trailingIcon", "expand_more"), p.str("menuLabel", "Open menu")) } }
        "md-segmented-button" -> FilterChip(selected, click, enabled = enabled, label = { Row(content = label) })
        else -> when(p.str("variant")) {
            "outlined" -> OutlinedButton(click, enabled = enabled, modifier = modifier, content = label)
            "text" -> TextButton(click, enabled = enabled, modifier = modifier, content = label)
            "tonal", "filled-tonal" -> FilledTonalButton(click, enabled = enabled, modifier = modifier, content = label)
            "elevated" -> ElevatedButton(click, enabled = enabled, modifier = modifier, content = label)
            else -> Button(click, enabled = enabled, modifier = modifier, content = label)
        }
    }
}

@Composable private fun Avatar(p: Props, emit: EventSink, slot: Slot?) {
    val src = p.str("src")
    val bitmap by produceState<android.graphics.Bitmap?>(null, src) {
        if(src.startsWith("https://") || src.startsWith("http://")) {
            val result = withContext(Dispatchers.IO) { runCatching { val connection = java.net.URL(src).openConnection(); connection.connectTimeout = 8000; connection.readTimeout = 8000; connection.getInputStream().use { android.graphics.BitmapFactory.decodeStream(it) } } }
            value = result.getOrNull()
            emit(if(value != null) "mdLoad" else "mdError", null)
        }
    }
    val initials = p.str("initials").ifBlank { p.str("name").split(" ").filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() } }
    val size = when(p.str("size")) { "small" -> 32.dp; "large" -> 64.dp; else -> p.num("size", 40f).coerceIn(24f, 120f).dp }
    Surface(modifier = Modifier.size(size).semantics { contentDescription = p.str("alt", p.str("label", p.str("name"))) }, shape = if(p.str("shape") == "square") RoundedCornerShape(8.dp) else CircleShape, color = MaterialTheme.colorScheme.secondaryContainer) {
        Box(contentAlignment = Alignment.Center) { if(bitmap != null) Image(bitmap!!.asImageBitmap(), contentDescription = p.str("alt"), contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) else if (initials.isEmpty()) { slot?.invoke(""); Glyph("person") } else Text(initials.take(3), fontWeight = FontWeight.Medium) }
    }
}

@Composable private fun Accordion(tag: String, p: Props, emit: EventSink, slot: Slot?) {
    if(tag == "md-accordion") { SelectionContainer(tag, p, emit, slot); return }
    var localExpanded by awcState(p["expanded"]) { p.bool("expanded") }
    val parent = LocalSelection.current?.takeIf { it.tag == "md-accordion" }
    val identity = remember { Any() }
    val index = parent?.register(identity, p.str("headline"), localExpanded) ?: 0
    val expanded = parent?.states?.get(identity) ?: localExpanded
    DisposableEffect(parent, identity) { onDispose { parent?.remove(identity) } }
    LaunchedEffect(p["expanded"]) { if(parent != null) parent.states[identity] = p.bool("expanded") || index in parent.props.str("defaultExpanded").split(",").mapNotNull { it.trim().toIntOrNull() } }
    OutlinedCard {
        ListItem(headlineContent = { Text(p.str("headline")) }, supportingContent = { if(p.str("supportingText").isNotBlank()) Text(p.str("supportingText")) }, leadingContent = { if(p.str("icon").isNotBlank()) Glyph(p.str("icon")) }, trailingContent = { Glyph(if(expanded) "expand_less" else "expand_more") }, modifier = Modifier.fillMaxWidth().clickable(enabled = p.enabled() && p.bool("collapsible", true)) { localExpanded = parent?.toggle(identity) ?: !localExpanded; emit("mdItemToggle", mapOf("expanded" to localExpanded, "index" to index)) }.semantics { stateDescription = if(expanded) "Expanded" else "Collapsed"; heading() })
        if(expanded) Box(Modifier.padding(16.dp)) { slot?.invoke("") }
    }
}
