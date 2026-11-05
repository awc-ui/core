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
import androidx.compose.ui.zIndex
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
    val tableCheckbox = if(tag=="md-checkbox") LocalNativeTableCheckbox.current else null
    val source = awcProperties(tag, properties).let { if(tableCheckbox != null) it + tableCheckbox.props else it }
    val formControl = rememberAutomaticFormControl(tag, source, onEvent)
    val p = formControl?.properties ?: source
    if(tag in setOf("md-loading-indicator","md-skeleton") && p.bool("hidden")) return
    var loadingFocused by remember(tag) { mutableStateOf(false) }
    val suppliedModifier=if(tag=="md-loading-indicator") Modifier.onFocusChanged { loadingFocused=it.isFocused }.then(modifier) else modifier
    val inheritedDensity = resolveAWCDensity(p["density"], LocalAWCNativeDensity.current)
    val tableCell = if(tag=="md-table-cell") remember { NativeTableCellData() }.also { it.update(p) } else null
    val controlEvent: EventSink = (formControl?.emit ?: onEvent).let { base -> if(tableCheckbox != null) { n, d -> base(n, d); if(n == "mdChange") tableCheckbox.onChange(awcMap(d)["checked"] == true) } else base }
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
    // A floating md-accordion stacks among its siblings with the source z-index (fixed panels default to 1000).
    val accordionFloating=if(tag=="md-accordion") remember { NativeAccordionFloatingHolder() } else null
    val accordionChild=if(tag=="md-accordion-item") remember { NativeAccordionChild(NativeAccordionItemState(java.util.UUID.randomUUID().toString(),
        p.bool("expanded"),p.bool("disabled"),p.int("headingLevel",3),p.str("regionRole","region"),p.bool("collapsible",true))) } else null
    // A trail's crumb reports its holder as layout id: the trail computes the source model from the authored order.
    val breadcrumbChild=if(tag=="md-breadcrumb-item" && LocalBreadcrumbsTrail.current!=null) remember { BreadcrumbChild() } else null
    // A tablist's tab / a panel region's panel reports its holder as layout id (the parent computes selection and layout).
    val tabChild=if(tag=="md-tab" && LocalTabsStrip.current!=null) remember { TabChild() } else null
    val navigationChild=if(tag=="md-navigation-tab" && LocalNavigationBarRow.current!=null) remember { NavigationChild() } else null
    val panelChild=if(tag=="md-tab-panel" && LocalTabPanels.current) remember { PanelChild() } else null
    // A toolbar's direct child reports its holder as layout id (the toolbar lays out its sections, roves its activators and tints its icon buttons).
    val toolbarChild=if(LocalToolbarRow.current!=null) remember { ToolbarChild() } else null
    val toolbarSlot=LocalToolbarSlot.current
    if(toolbarChild!=null) SideEffect { toolbarChild.tag=tag; toolbarChild.props=p; toolbarChild.slot=toolbarSlot }
    // An md-step of a stepper emits its header control and panel as the stepper's own layout children (authored order = keyboard order).
    val stepChild=if(tag=="md-step" && LocalStepperContext.current!=null) remember { StepChild() } else null
    if(stepChild!=null) { NativeStepParts(p, onEvent, content, stepChild); return }
    val menuSlot=rememberNativeMenuSlot(tag,p)
    val measuredModifier = (if (tag in setOf("md-button","md-icon-button","md-button-group","md-fab","md-divider","md-fab-menu","md-fab-menu-item","md-badge","md-status-dot","md-segmented-button","md-segmented-button-set","md-split-button","md-loading-indicator","md-meter","md-progress-indicator","md-skeleton","md-snackbar","md-tooltip","md-menu","md-menu-item","md-sub-menu-item","md-menu-item-group") || accordionChild!=null) suppliedModifier else suppliedModifier.inspectAWCNode(inspection, "", tag, allowZeroSize = accordionFloating?.zIndex != null))
        .nativeAnchorBounds(nativeAnchor)
        .nativeMenuAnchorAuto(p.str("id"),p.str("aria-label").ifEmpty { p.str("label") })
        .then(if(tag == "md-badge" && (LocalAWCIconButtonSlot.current || LocalAWCBadgeHost.current))
            Modifier.layoutId(NativeBadgePlacement.from(p, LocalAWCBadgeAppearance.current.normalized()))
            else if(tag == "md-status-dot" && LocalAWCStatusDotHost.current)
                Modifier.layoutId(NativeStatusDotMetrics.from(p, LocalAWCStatusDotAppearance.current,
                    inheritedDensity, androidx.compose.ui.platform.LocalDensity.current.density.toDouble()))
            else if(tag == "md-avatar" && LocalAWCIconButtonSlot.current) Modifier.layoutId("awc-icon-avatar") else if(tableCell != null) Modifier.layoutId(tableCell) else Modifier)
    Box(measuredModifier.awcCardContentMarker(tag,p.bool("hidden")).nativeMenuSlot(menuSlot).then(if(toolbarChild!=null) Modifier.layoutId(toolbarChild) else if(navigationChild!=null) Modifier.layoutId(navigationChild) else if(tabChild!=null) Modifier.layoutId(tabChild) else if(panelChild!=null) Modifier.layoutId(panelChild) else if(breadcrumbChild!=null) Modifier.layoutId(breadcrumbChild) else if(groupChild!=null) Modifier.layoutId(groupChild) else if(segmentChild!=null) Modifier.layoutId(segmentChild) else if(accordionChild!=null) Modifier.layoutId(accordionChild).then(AccordionChildMarkerElement(accordionChild)) else Modifier)
        .then(accordionFloating?.zIndex?.let { Modifier.zIndex(it) } ?: if(tag=="md-table-head") Modifier.zIndex(2f) else if(tag=="md-table-foot") Modifier.zIndex(1f) else Modifier),propagateMinConstraints=groupChild!=null || segmentChild!=null || accordionChild!=null || tag=="md-segmented-button-set") {
      CompositionLocalProvider(LocalToolbarRow provides null,LocalAWCInspection provides inspection,LocalButtonGroupChild provides groupChild,
          LocalNativeAnchor provides nativeAnchor,LocalSegmentedChild provides segmentChild,
          LocalAWCNativeDensity provides inheritedDensity,LocalNativeMenuSlot provides menuSlot,LocalAWCDensityRungs provides awcDensityRungs(p["density"])) {
        when (tag) {
            "md-button" -> AWCToolbarMember(toolbarChild) { NativeButton(toolbarChild?.roved(p) ?: p, onEvent, content) }
            "md-icon-button" -> AWCToolbarMember(toolbarChild) { NativeIconButton(toolbarChild?.roved(p) ?: p, onEvent, content) }
            "md-fab" -> AWCToolbarMember(toolbarChild) { NativeFab(p, onEvent, content) }
            "md-fab-menu" -> NativeFabMenu(p,onEvent,content)
            "md-fab-menu-item" -> NativeFabMenuItem(p,onEvent,content)
            "md-snackbar" -> NativeSnackbar(p,onEvent,content)
            "md-tooltip" -> NativeTooltip(p,onEvent,content)
            "md-segmented-button" -> NativeSegmentedButton(p,onEvent,content)
            "md-segmented-button-set" -> NativeSegmentedSet(p,onEvent,content)
            "md-split-button" -> NativeSplitButton(p, onEvent, content)
            "md-switch" -> NativeSwitch(p, onEvent, controlEvent, content)
            "md-checkbox" -> NativeCheckbox(p, onEvent, controlEvent, content)
            "md-radio" -> NativeRadio(p, onEvent, controlEvent, content)
            "md-text-field" -> NativeTextField(p, onEvent, controlEvent, content, formControl?.field, formControl?.form)
            "md-number-field" -> NativeNumberField(p, onEvent, controlEvent, content, formControl?.field, formControl?.form)
            "md-otp-field" -> NativeOTPField(p, onEvent, controlEvent, content, formControl?.field, formControl?.form)
            // Dedicated renderers (NativeSliderView.kt / NativeRatingView.kt): Web geometry, motion, events, per-thumb inputs.
            // Host-authored properties outside a form (the component's own writes live in its model until the host changes them).
            "md-slider" -> NativeSliderView(if (formControl?.form != null) p else source, controlEvent)
            "md-rating" -> NativeRatingView(if (formControl?.form != null) p else source, controlEvent)
            "md-select" -> NativeSelect(p, onEvent, controlEvent, content, formControl?.field, formControl?.form)
            "md-select-option" -> if(LocalAWCSelectOptions.current!=null) NativeSelectOption(p, content) else InputComponent(tag, p, controlEvent, content, formControl?.form)
            "md-multi-select" -> NativeMultiSelect(p, onEvent, controlEvent, content, formControl?.field, formControl?.form)
            "md-text-field", "md-number-field", "md-otp-field", "md-search", "md-autocomplete" -> InputComponent(tag, p, controlEvent, content, formControl?.form)
            "md-color-picker" -> NativeColorPicker(p, controlEvent, content)
            "md-time-picker" -> NativeTimePicker(p, controlEvent)
            "md-date-picker" -> PickerComponent(tag, p, controlEvent)
            "md-dialog" -> NativeDialog(p, onEvent, content)
            "md-bottom-sheet" -> NativeBottomSheet(p, onEvent, content)
            "md-side-sheet" -> NativeSideSheet(p, onEvent, content)
            "md-menu" -> NativeMenu(p, onEvent, content)
            // Dedicated renderer (NativeChartView.kt): the ported engine's scene, hover layer, tooltips, legend, zoom, keyboard, motion.
            "md-bar-chart", "md-line-chart", "md-area-chart", "md-pie-chart", "md-sparkline" -> NativeChartView(tag, p, onEvent, content)
            "md-transfer-list" -> TransferList(p, onEvent)
            "md-organization-chart" -> NativeOrgChart(p, onEvent, content)
            "md-table", "md-table-container", "md-table-head", "md-table-body", "md-table-foot", "md-table-row", "md-table-cell", "md-table-sort-label", "md-table-expand-toggle", "md-table-pagination", "md-table-toolbar" -> NativeTableFamily(tag, p, onEvent, content, tableCell)
            "md-accordion" -> NativeAccordionGroup(p, onEvent, content, accordionFloating!!)
            "md-accordion-item" -> NativeAccordionItem(p, onEvent, content, accordionChild!!, inspection)
            "md-breadcrumbs" -> NativeBreadcrumbs(p, onEvent, content)
            "md-navigation-bar" -> NativeNavigationBar(p, onEvent, content)
            "md-navigation-tab" -> NativeNavigationTab(p, onEvent, content, navigationChild, properties.keys)
            "md-tabs" -> NativeTabs(p, onEvent, content)
            "md-tab" -> NativeTab(p, onEvent, content, tabChild)
            "md-tab-panels" -> NativeTabPanels(p, onEvent, content)
            "md-tab-panel" -> NativeTabPanel(p, onEvent, content, panelChild)
            "md-breadcrumb-item" -> NativeBreadcrumbItem(p, onEvent, content, breadcrumbChild)
            // Dedicated renderers (NativeStepper.kt): Web geometry, motion, navigation rules and announcements.
            "md-stepper" -> NativeStepper(p, onEvent, content)
            "md-step" -> NativeStepStandalone(p, onEvent, content)
            "md-navigation-bar", "md-navigation-rail", "md-tabs", "md-navigation-tab", "md-navigation-rail-tab", "md-tab", "md-tab-panels", "md-tab-panel", "md-breadcrumbs", "md-breadcrumb-item" -> NavigationComponent(tag, p, onEvent, content)
            "md-list" -> NativeList(p, onEvent, content)
            "md-menu-item-group" -> NativeMenuGroup(p, content)
            "md-list-item" -> NativeListItem(p, onEvent, content)
            "md-menu-item", "md-sub-menu-item" -> NativeMenuRowHost(tag, p, onEvent, content)
            "md-button-group" -> SelectionContainer(tag, p, onEvent, content)
            "md-card" -> NativeCard(p, onEvent) { content?.invoke("") }
            "md-chip" -> NativeChip(p, onEvent, content)
            "md-avatar" -> NativeAvatar(p, onEvent, content)
            "md-badge" -> NativeBadge(p, content)
            "md-divider" -> NativeDivider(p)
            "md-loading-indicator" -> NativeLoadingIndicator(p,loadingFocused)
            "md-meter" -> NativeMeter(p)
            "md-progress-indicator" -> NativeProgressIndicator(p,onEvent)
            "md-skeleton" -> NativeSkeleton(p)
            "md-status-dot" -> NativeStatusDot(p)
            "md-toolbar" -> NativeToolbar(p, onEvent, content)
            "md-app-bar" -> Surface(color = MaterialTheme.colorScheme.surfaceContainer, shape = RoundedCornerShape(16.dp)) {
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
            "md-ripple" -> NativeRippleNode(p)
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

