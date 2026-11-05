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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layoutId
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
    val source = awcProperties(tag, properties)
    val formControl = rememberAutomaticFormControl(tag, source, onEvent)
    val p = formControl?.properties ?: source
    if(tag in setOf("md-loading-indicator","md-skeleton") && p.bool("hidden")) return
    var loadingFocused by remember(tag) { mutableStateOf(false) }
    val suppliedModifier=if(tag=="md-loading-indicator") Modifier.onFocusChanged { loadingFocused=it.isFocused }.then(modifier) else modifier
    val inheritedDensity = resolveAWCDensity(p["density"], LocalAWCNativeDensity.current)
    val controlEvent = formControl?.emit ?: onEvent
    val spacing = (12 + p.int("density") * 2).coerceAtLeast(4).dp
    val menu=LocalNativeFabMenu.current
    val menuInspection=LocalFabMenuInspection.current
    val menuChild=if(tag=="md-fab-menu-item" && menu!=null) remember(menu) { menu.nextChildID() } else null
    val inspection = if(menuChild!=null && menuInspection!=null)
        menuInspection.copy(id="${menuInspection.id}.item-$menuChild",entered=true,parentId=menuInspection.id)
        else LocalAWCInspection.current?.takeUnless { it.entered }?.copy(entered = true)
    val nativeAnchor=rememberNativeAnchor(tag,p)
    // Button supplies its actual visual root and parts; other adapters still expose
    // their measured component root without inventing uninstrumented style values.
    val groupChild=if(tag in setOf("md-button","md-icon-button") && LocalSelection.current?.tag=="md-button-group") remember(tag) { ButtonGroupChild(Any(),tag) } else null
    val segmentChild=if(tag=="md-segmented-button") remember { SegmentedChild(Any()) } else null
    val measuredModifier = (if (tag in setOf("md-button","md-icon-button","md-button-group","md-fab","md-divider","md-fab-menu","md-fab-menu-item","md-badge","md-status-dot","md-segmented-button","md-segmented-button-set","md-split-button","md-loading-indicator","md-meter","md-progress-indicator","md-skeleton","md-snackbar")) suppliedModifier else suppliedModifier.inspectAWCNode(inspection, "", tag))
        .nativeAnchorBounds(nativeAnchor)
        .then(if(tag == "md-badge" && (LocalAWCIconButtonSlot.current || LocalAWCBadgeHost.current))
            Modifier.layoutId(NativeBadgePlacement.from(p, LocalAWCBadgeAppearance.current.normalized()))
            else if(tag == "md-status-dot" && LocalAWCStatusDotHost.current)
                Modifier.layoutId(NativeStatusDotMetrics.from(p, LocalAWCStatusDotAppearance.current,
                    inheritedDensity, androidx.compose.ui.platform.LocalDensity.current.density.toDouble()))
            else if(tag == "md-avatar" && LocalAWCIconButtonSlot.current) Modifier.layoutId("awc-icon-avatar") else Modifier)
    Box(measuredModifier.then(if(groupChild!=null) Modifier.layoutId(groupChild) else if(segmentChild!=null) Modifier.layoutId(segmentChild) else Modifier),propagateMinConstraints=groupChild!=null || segmentChild!=null || tag=="md-segmented-button-set") {
      CompositionLocalProvider(LocalAWCInspection provides inspection,LocalButtonGroupChild provides groupChild,
          LocalNativeAnchor provides nativeAnchor,LocalSegmentedChild provides segmentChild,
          LocalAWCNativeDensity provides inheritedDensity) {
        when (tag) {
            "md-button" -> NativeButton(p, onEvent, content)
            "md-icon-button" -> NativeIconButton(p, onEvent, content)
            "md-fab" -> NativeFab(p, onEvent, content)
            "md-fab-menu" -> NativeFabMenu(p,onEvent,content)
            "md-fab-menu-item" -> NativeFabMenuItem(p,onEvent,content)
            "md-snackbar" -> NativeSnackbar(p,onEvent,content)
            "md-segmented-button" -> NativeSegmentedButton(p,onEvent,content)
            "md-segmented-button-set" -> NativeSegmentedSet(p,onEvent,content)
            "md-split-button" -> NativeSplitButton(p, onEvent, content)
            "md-checkbox", "md-radio", "md-switch", "md-slider", "md-rating", "md-text-field", "md-number-field", "md-otp-field", "md-search", "md-select", "md-multi-select", "md-autocomplete", "md-select-option" -> InputComponent(tag, p, controlEvent, content, formControl?.form)
            "md-date-picker", "md-time-picker", "md-color-picker" -> PickerComponent(tag, p, controlEvent)
            "md-dialog", "md-bottom-sheet", "md-side-sheet", "md-menu", "md-tooltip" -> OverlayComponent(tag, p, onEvent, content)
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
            "md-button-group" -> SelectionContainer(tag, p, onEvent, content)
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
            "md-badge" -> NativeBadge(p, content)
            "md-divider" -> NativeDivider(p)
            "md-loading-indicator" -> NativeLoadingIndicator(p,loadingFocused)
            "md-meter" -> NativeMeter(p)
            "md-progress-indicator" -> NativeProgressIndicator(p,onEvent)
            "md-skeleton" -> NativeSkeleton(p)
            "md-status-dot" -> NativeStatusDot(p)
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
    val iconFocus = if (tag == "md-icon-button") nativeButtonFocusModifier(p, identity, group?.takeIf { it.tag == "md-button-group" }?.focus, selected).modifier else Modifier
    val modifier = (if (p.bool("fullWidth")) Modifier.fillMaxWidth() else Modifier).then(iconFocus).semantics { if(p.bool("toggle") || group != null) this.selected = selected; if(!enabled) disabled() }
    when(tag) {
        "md-icon-button" -> IconToggleButton(checked = selected, onCheckedChange = { if(enabled) click() }, enabled = !p.bool("disabled"), modifier = modifier) { Glyph(p.str("icon", "favorite"), p.label(p.str("icon"))) }
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
