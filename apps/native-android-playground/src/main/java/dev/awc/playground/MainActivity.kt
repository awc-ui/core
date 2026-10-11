@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.playground

import android.os.Bundle
import android.os.Build
import android.view.View
import android.view.WindowInsetsController
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.nativeui.generated.AWCNativeCatalog
import org.json.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val initialSelection = intent.getStringExtra("component")?.takeIf { it in AWCNativeCatalog.tags }
        setContent { Playground(initialSelection, ::updateSystemBars) }
    }

    @Suppress("DEPRECATION")
    private fun updateSystemBars(dark: Boolean, surfaceColor: Int) {
        // Change only appearance; Scaffold remains responsible for system-bar insets.
        if (Build.VERSION.SDK_INT >= 30) {
            val lightBars = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (dark) 0 else lightBars, lightBars)
        } else {
            val lightBars = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            window.decorView.systemUiVisibility = if (dark) window.decorView.systemUiVisibility and lightBars.inv() else window.decorView.systemUiVisibility or lightBars
        }
        if (Build.VERSION.SDK_INT < 35) {
            window.statusBarColor = surfaceColor
            window.navigationBarColor = surfaceColor
        }
    }
}

@Composable fun Playground(initialSelection: String? = null, onThemeChanged: (Boolean, Int) -> Unit = { _, _ -> }) {
    var dark by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf(initialSelection) }
    AWCTheme(darkTheme = dark) {
        val surfaceColor = MaterialTheme.colorScheme.surface.toArgb()
        SideEffect { onThemeChanged(dark, surfaceColor) }
        Scaffold(topBar = {
            TopAppBar(title = { Column { Text(if(selected == null) "AWC Native" else selected!!); Text(if(selected == null) "${AWCNativeCatalog.tags.size} Compose components" else "Native Android • live properties", style = MaterialTheme.typography.labelSmall) } }, navigationIcon = { if(selected != null) TextButton(onClick = { selected = null }) { Text("←") } }, actions = { TextButton(onClick = { dark = !dark }) { Text(if(dark) "Light" else "Dark") } })
        }) { padding ->
            if(selected == null) Column(Modifier.padding(padding).padding(horizontal = 16.dp)) {
                OutlinedTextField(query, { query = it }, label = { Text("Search all components") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("catalog-search"))
                Spacer(Modifier.height(12.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.testTag("catalog")) {
                    items(AWCNativeCatalog.tags.filter { it.contains(query, true) }, key = { it }) { tag ->
                        OutlinedCard(onClick = { selected = tag }, modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.padding(16.dp)) { Text(tag, style = MaterialTheme.typography.titleMedium); Text(AWCNativeCatalog.summaries[tag].orEmpty().lineSequence().firstOrNull().orEmpty().take(160), style = MaterialTheme.typography.bodySmall, maxLines = 2) }
                        }
                    }
                }
            } else key(selected) { ComponentScreen(selected!!, Modifier.padding(padding)) }
        }
    }
}

@Composable private fun ComponentScreen(tag: String, modifier: Modifier) {
    val initial = remember(tag) { (AWCNativeCatalog.defaults[tag] ?: emptyMap()) + fixture(tag) }
    var props by remember(tag) { mutableStateOf(initial) }
    var draft by remember(tag) { mutableStateOf(JSONObject(props).toString(2)) }
    var error by remember { mutableStateOf<String?>(null) }
    var revision by remember { mutableIntStateOf(0) }
    val events = remember { mutableStateListOf<String>() }
    val event: (String, AWCValue) -> Unit = { name, value ->
        events.add(0, "$name: ${renderValue(value)}")
        while(events.size > 30) events.removeAt(events.lastIndex)
        // The preview retains local native state. Explicit editor changes reset only their own state.
    }
    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Native preview", style = MaterialTheme.typography.titleLarge)
        Surface(Modifier.fillMaxWidth().testTag("native-preview"), tonalElevation = 2.dp, shape = MaterialTheme.shapes.large) {
            Box(Modifier.padding(20.dp).heightIn(min = 96.dp)) {
                key(revision) { AWCComponent(tag, props, onEvent = event) { slot -> SampleSlot(tag, slot, event) } }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if(tag in overlays) Button(onClick = { props = props + ("open" to true); revision++ }) { Text("Open component") }
            OutlinedButton(onClick = { props = initial; draft = JSONObject(initial).toString(2); revision++; events.clear(); error = null }) { Text("Reset") }
        }
        Text("Quick controls", style = MaterialTheme.typography.titleMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            listOf("disabled", "error", "selected", "checked").forEach { property ->
                if(initial.containsKey(property)) Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(props[property] == true, { props = props + (property to it); draft = JSONObject(props).toString(2) })
                    Text(property)
                }
            }
        }
        Text("Properties (source names, JSON)", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(draft, { draft = it }, modifier = Modifier.fillMaxWidth().testTag("properties-editor"), minLines = 6, maxLines = 16, textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace), isError = error != null)
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(onClick = { runCatching { jsonValue(JSONObject(draft)) as Map<String, AWCValue> }.onSuccess { props = it; revision++; error = null }.onFailure { error = it.message } }, modifier = Modifier.testTag("apply-properties")) { Text("Apply properties") }
        Text("Events", style = MaterialTheme.typography.titleMedium)
        if(events.isEmpty()) Text("Interact with the component to inspect source event names and payloads.", style = MaterialTheme.typography.bodySmall)
        events.take(12).forEach { Text(it, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall) }
        Text("Porting status", style = MaterialTheme.typography.titleMedium)
        Text("This preview uses Android Compose widgets and Canvas. The compiler's coverage report lists supported properties and the remaining platform differences; visual and behavioral parity is still being expanded.", style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(32.dp))
    }
}

private val overlays = setOf("md-dialog", "md-bottom-sheet", "md-side-sheet", "md-menu", "md-fab-menu", "md-snackbar", "md-tooltip", "md-date-picker", "md-time-picker", "md-color-picker")
private val choices = listOf(mapOf("value" to "design", "label" to "Design"), mapOf("value" to "engineering", "label" to "Engineering"), mapOf("value" to "research", "label" to "Research"), mapOf("value" to "archived", "label" to "Archived", "disabled" to true))
internal fun fixture(tag: String): Map<String, AWCValue> = when(tag) {
    "md-button" -> mapOf("label" to "Continue", "size" to "md", "variant" to "filled", "icon" to "", "toggle" to false)
    "md-icon-button" -> mapOf("icon" to "favorite", "toggle" to true)
    "md-fab" -> mapOf("icon" to "add", "label" to "Create", "extended" to true)
    "md-fab-menu-item" -> mapOf("icon" to "edit", "label" to "New document")
    "md-split-button" -> mapOf("label" to "Publish", "icon" to "upload")
    "md-segmented-button" -> mapOf("label" to "Week", "value" to "week")
    "md-chip" -> mapOf("label" to "Android", "selectable" to true, "removable" to true, "icon" to "check")
    "md-avatar" -> mapOf("name" to "Alex Morgan", "size" to "large")
    "md-badge" -> mapOf("value" to 8, "variant" to "large")
    "md-checkbox", "md-radio", "md-switch" -> mapOf("value" to "notifications")
    "md-text-field" -> mapOf("label" to "Project name", "value" to "AWC Native", "clearable" to true, "supportingText" to "This is a native text field")
    "md-number-field" -> mapOf("label" to "Quantity", "value" to 3, "min" to 0, "max" to 20, "step" to 1)
    "md-otp-field" -> mapOf("label" to "Verification code", "length" to 6, "value" to "123")
    "md-search" -> mapOf("placeholder" to "Search components", "value" to "")
    "md-select", "md-autocomplete" -> mapOf("label" to "Team", "options" to choices, "value" to "design", "filterable" to true)
    "md-multi-select" -> mapOf("label" to "Teams", "options" to choices, "value" to listOf("design"), "filterable" to true, "showSelectAll" to true)
    "md-select-option" -> mapOf("value" to "design", "label" to "Design", "supportingText" to "Product and brand design")
    "md-slider" -> mapOf("value" to 40, "min" to 0, "max" to 100, "step" to 5, "labeled" to true)
    "md-rating" -> mapOf("value" to 3, "max" to 5, "showValueLabel" to true)
    "md-date-picker" -> mapOf("label" to "Start date", "value" to "2026-10-07")
    "md-time-picker" -> mapOf("label" to "Start time", "value" to "14:30", "format" to "24")
    "md-color-picker" -> mapOf("value" to "#6750a4", "presets" to listOf("#6750a4", "#386a20", "#b3261e", "#00639b"))
    "md-dialog", "md-bottom-sheet", "md-side-sheet" -> mapOf("headline" to "Native AWC overlay", "open" to false)
    "md-menu", "md-fab-menu" -> mapOf("open" to false, "menuLabel" to "Actions")
    "md-tooltip" -> mapOf("text" to "This tooltip is rendered with Compose", "subhead" to "Native content", "open" to true)
    "md-snackbar" -> mapOf("message" to "Changes saved", "action" to "Undo", "closeable" to true, "open" to true, "autoHide" to false)
    "md-list-item" -> mapOf("headline" to "Design system", "supportingText" to "81 components across platforms", "leadingIcon" to "palette", "expandable" to true)
    "md-menu-item", "md-sub-menu-item" -> mapOf("headline" to "Settings", "supportingText" to "Manage preferences")
    "md-menu-item-group" -> mapOf("label" to "Workspace")
    "md-progress-indicator" -> mapOf("value" to 0.65, "max" to 1, "label" to "Upload progress")
    "md-meter" -> mapOf("value" to 65, "max" to 100, "label" to "Storage used", "showValue" to true)
    "md-loading-indicator" -> mapOf("label" to "Loading preview")
    "md-skeleton" -> mapOf("lines" to 3, "height" to 24)
    "md-status-dot" -> mapOf("state" to "success", "label" to "Online", "inline" to true)
    "md-app-bar" -> mapOf("headline" to "Workspace", "subtitle" to "AWC Native", "leadingIcon" to "menu")
    "md-accordion" -> mapOf("exclusive" to true, "keepOneExpanded" to true, "defaultExpanded" to "0")
    "md-list" -> mapOf("selectionMode" to "single-select")
    "md-accordion-item" -> mapOf("headline" to "How does this work?", "supportingText" to "Expand to read more", "icon" to "info")
    "md-tab", "md-navigation-tab", "md-navigation-rail-tab" -> mapOf("label" to "Home", "icon" to "home")
    "md-step" -> mapOf("label" to "Account details", "description" to "First step", "active" to true)
    "md-breadcrumb-item" -> mapOf("icon" to "home")
    "md-table-pagination" -> mapOf("count" to 128, "rowsPerPage" to 10, "rowsPerPageOptions" to listOf(10, 25, 50), "showFirstLast" to true)
    "md-table-toolbar" -> mapOf("headline" to "Team members", "supportingText" to "Manage access")
    "md-table-sort-label" -> mapOf("column" to "name", "order" to "asc")
    "md-table-row" -> mapOf("selectable" to true, "expandable" to true, "value" to "alex")
    "md-transfer-list" -> mapOf("items" to choices, "value" to listOf("design"), "sourceTitle" to "Available", "targetTitle" to "Assigned")
    "md-organization-chart" -> mapOf("selectionMode" to "multiple", "nodes" to listOf(mapOf("id" to "lead", "name" to "Alex Morgan", "title" to "Product lead", "children" to listOf(mapOf("id" to "design", "name" to "Taylor Lee", "title" to "Design"), mapOf("id" to "eng", "name" to "Sam Patel", "title" to "Engineering")))))
    "md-bar-chart", "md-line-chart", "md-area-chart" -> mapOf("label" to "Weekly activity", "series" to listOf(mapOf("id" to "android", "label" to "Android", "data" to listOf(12, 25, 18, 34, 29, 46)), mapOf("id" to "ios", "label" to "iOS", "data" to listOf(8, 16, 22, 28, 33, 39))), "xAxis" to mapOf("data" to listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat")), "showMarks" to true)
    "md-pie-chart" -> mapOf("label" to "Platform share", "data" to listOf(mapOf("label" to "Android", "value" to 45), mapOf("label" to "iOS", "value" to 35), mapOf("label" to "Web", "value" to 20)))
    "md-sparkline" -> mapOf("data" to listOf(5, 12, 8, 16, 24, 18, 29, 33), "variant" to "area")
    else -> emptyMap()
}

@Composable internal fun SampleSlot(tag: String, slot: String, event: (String, AWCValue) -> Unit) {
    if(slot == "expanded" || slot == "submenu" || slot == "expanded-content") { Text("Additional native content", Modifier.padding(12.dp)); return }
    if(slot == "actions") { AWCComponent("md-button", mapOf("variant" to "text"), onEvent = event) { if(it == "") Text("Learn more") }; return }
    if(slot != "") return
    when(tag) {
        "md-accordion" -> Column { listOf("Getting started", "Native rendering", "Accessibility").forEach { title -> AWCComponent("md-accordion-item", mapOf("headline" to title), onEvent = event) { if(it == "") Text("AWC components compile to platform-native APIs.") } } }
        "md-tabs", "md-navigation-bar", "md-navigation-rail" -> {
            val child = when(tag) { "md-tabs" -> "md-tab"; "md-navigation-rail" -> "md-navigation-rail-tab"; else -> "md-navigation-tab" }
            listOf("Home" to "home", "Search" to "search", "Settings" to "settings").forEach { (label, icon) -> AWCComponent(child, mapOf("label" to label, "icon" to icon), onEvent = event) }
        }
        "md-stepper" -> listOf("Account", "Preferences", "Review").forEach { title -> AWCComponent("md-step", mapOf("label" to title, "hideActions" to true), onEvent = event) { if(it == "") Text("Complete the $title step.") } }
        "md-button-group", "md-segmented-button-set" -> listOf("Day", "Week", "Month").forEach { title -> AWCComponent(if(tag == "md-button-group") "md-button" else "md-segmented-button", mapOf("label" to title, "value" to title.lowercase(), "variant" to "outlined", "toggle" to true), onEvent = event) }
        "md-list", "md-menu-item-group" -> listOf("Design system", "Native compiler", "Playground").forEach { title -> AWCComponent("md-list-item", mapOf("headline" to title, "leadingIcon" to "check"), onEvent = event) }
        "md-menu", "md-fab-menu" -> listOf("Edit", "Duplicate", "Archive").forEach { title -> AWCComponent("md-menu-item", mapOf("headline" to title), onEvent = event) }
        "md-card" -> Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("Build once. Render natively.", style = MaterialTheme.typography.titleLarge); Text("A native Material card with content, actions, accessibility and theme support."); AWCComponent("md-button", onEvent = event) { if(it == "") Text("Explore") } }
        "md-table", "md-table-container" -> Column {
            AWCComponent("md-table-head") { if(it == "") TableRow(listOf("Name", "Team", "Status"), event) }
            AWCComponent("md-table-body") { if(it == "") { TableRow(listOf("Alex", "Design", "Active"), event); TableRow(listOf("Sam", "Engineering", "Active"), event); TableRow(listOf("Taylor", "Research", "Away"), event) } }
            AWCComponent("md-table-pagination", mapOf("count" to 3, "rowsPerPage" to 10), onEvent = event)
        }
        "md-table-head", "md-table-body", "md-table-foot" -> TableRow(listOf("Alex", "Design", "Active"), event)
        "md-table-row" -> listOf("Alex", "Design", "Active").forEach { value -> AWCComponent("md-table-cell") { if(it == "") Text(value) } }
        "md-table-cell" -> Text("Cell content")
        "md-table-sort-label" -> Text("Name")
        "md-breadcrumbs" -> { AWCComponent("md-breadcrumb-item", onEvent = event) { if(it == "") Text("Workspace") }; Text("/"); AWCComponent("md-breadcrumb-item", mapOf("current" to true), onEvent = event) { if(it == "") Text("Components") } }
        "md-breadcrumb-item" -> Text("Workspace")
        "md-checkbox", "md-radio", "md-switch" -> Text("Enable notifications")
        "md-toolbar" -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("edit", "search", "settings").forEach { icon -> AWCComponent("md-icon-button", mapOf("icon" to icon), onEvent = event) } }
        "md-ripple" -> Text("Tap to see native ripple", Modifier.padding(24.dp))
        "md-tooltip" -> Text("Tap for details", Modifier.padding(12.dp))
        "md-tab-panels", "md-tab-panel" -> Text("This is native tab panel content.")
        "md-button" -> Text("Continue")
        "md-accordion-item" -> Text("The source contract is compiled into typed platform wrappers. Native adapters provide Compose behavior.")
        "md-dialog", "md-bottom-sheet", "md-side-sheet", "md-step" -> Text("This content is composed with native Android views. Change props and inspect events below.")
        else -> Unit
    }
}

@Composable private fun TableRow(values: List<String>, event: (String, AWCValue) -> Unit) { AWCComponent("md-table-row", mapOf("clickable" to true, "value" to values.first()), onEvent = event) { slot -> if(slot == "") values.forEach { value -> AWCComponent("md-table-cell") { if(it == "") Text(value) } } } }
private fun renderValue(value: AWCValue): String = when(value) { is Map<*, *> -> JSONObject(value).toString(); is List<*> -> JSONArray(value).toString(); else -> value.toString() }
private fun jsonValue(value: Any?): Any? = when(value) { JSONObject.NULL -> null; is JSONObject -> value.keys().asSequence().associateWith { jsonValue(value.opt(it)) }; is JSONArray -> List(value.length()) { jsonValue(value.opt(it)) }; else -> value }
