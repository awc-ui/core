@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package dev.awc.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

internal class PreviewOverlayEntry(
    val content: State<@Composable () -> Unit>,
    val dismiss: State<() -> Unit>,
    val scrim: Boolean,
    val escapeDismissible: Boolean,
)

internal class AWCPreviewPresentation internal constructor() {
    internal val overlays = mutableStateListOf<Pair<Any, PreviewOverlayEntry>>()
}

internal val LocalAWCPreviewPresentation = staticCompositionLocalOf<AWCPreviewPresentation?> { null }

/**
 * Laboratory-only presentation: native dialog/menu content stays in this Compose
 * surface so a single-window capture and local pointer/keyboard dispatch can reach
 * it. Production adapters continue using platform windows outside this scope.
 * The canvas grows while a modal is open. Menus are centered, and sheets use a
 * fixed preview viewport; platform-window placement and sheet dragging are not
 * simulated. Do not use this scope to replace production modal presentation.
 */
@Composable
fun AWCPreviewScope(modifier: Modifier = Modifier, overlayHeight: Dp = 640.dp, content: @Composable () -> Unit) {
    val presentation = remember { AWCPreviewPresentation() }
    CompositionLocalProvider(LocalAWCPreviewPresentation provides presentation) {
        BoxWithConstraints(modifier) {
            val open = presentation.overlays.isNotEmpty()
            val height = if (constraints.hasBoundedHeight) minOf(overlayHeight, maxHeight) else overlayHeight
            Box(Modifier.fillMaxWidth().then(if (open) Modifier.heightIn(min = height) else Modifier), contentAlignment = Alignment.Center) {
                Box(if (open) Modifier.clearAndSetSemantics {}.focusProperties { canFocus = false } else Modifier) { content() }
                presentation.overlays.toList().forEachIndexed { index, (identity, entry) ->
                    key(identity) {
                        val top = index == presentation.overlays.size - 1
                        val focus = remember { FocusRequester() }
                        Box(Modifier.matchParentSize()
                            .then(if (!top) Modifier.clearAndSetSemantics {} else Modifier)
                            .onPreviewKeyEvent { event ->
                                if (top && event.type == KeyEventType.KeyDown && event.key == Key.Escape) {
                                    if (entry.escapeDismissible) entry.dismiss.value()
                                    true
                                } else false
                            }
                            .focusRequester(focus)
                            .focusProperties { onExit = { cancelFocusChange() } }
                            .focusable(), contentAlignment = Alignment.Center) {
                            Box(Modifier.matchParentSize()
                                .background(if (entry.scrim) MaterialTheme.colorScheme.scrim.copy(alpha = .32f) else Color.Transparent)
                                .pointerInput(identity) { detectTapGestures { entry.dismiss.value() } })
                            entry.content.value()
                        }
                        LaunchedEffect(top) { if (top) runCatching { focus.requestFocus() } }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmbeddedOverlay(onDismissRequest: () -> Unit, scrim: Boolean = true, escapeDismissible: Boolean = true, content: @Composable () -> Unit) {
    val presentation = checkNotNull(LocalAWCPreviewPresentation.current)
    val identity = remember { Any() }
    val rendered = rememberUpdatedState(content)
    val dismiss = rememberUpdatedState(onDismissRequest)
    DisposableEffect(presentation, identity, scrim, escapeDismissible) {
        presentation.overlays.add(identity to PreviewOverlayEntry(rendered, dismiss, scrim, escapeDismissible))
        onDispose { presentation.overlays.removeAll { it.first === identity } }
    }
}

@Composable
internal fun AWCDialog(onDismissRequest: () -> Unit, properties: DialogProperties = DialogProperties(), content: @Composable () -> Unit) {
    if (LocalAWCPreviewPresentation.current == null) Dialog(onDismissRequest, properties = properties, content = content)
    else EmbeddedOverlay(onDismissRequest, escapeDismissible = properties.dismissOnBackPress) { content() }
}

@Composable
private fun PreviewDialogSurface(title: (@Composable () -> Unit)? = null, icon: (@Composable () -> Unit)? = null,
    confirmButton: @Composable () -> Unit, dismissButton: (@Composable () -> Unit)? = null, content: @Composable () -> Unit) {
    Surface(Modifier.padding(16.dp).widthIn(max = 560.dp).fillMaxWidth()
        .pointerInput(Unit) { detectTapGestures {} }.semantics { paneTitle = "Native preview dialog" },
        shape = MaterialTheme.shapes.extraLarge, color = MaterialTheme.colorScheme.surfaceContainerHigh, tonalElevation = 6.dp) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            icon?.let { Box(Modifier.align(Alignment.CenterHorizontally)) { it() } }
            title?.let { ProvideTextStyle(MaterialTheme.typography.headlineSmall) { it() } }
            Column(Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) { content() }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                dismissButton?.invoke(); confirmButton()
            }
        }
    }
}

@Composable
internal fun AWCAlertDialog(onDismissRequest: () -> Unit, confirmButton: @Composable () -> Unit,
    dismissButton: (@Composable () -> Unit)? = null, title: (@Composable () -> Unit)? = null,
    text: (@Composable () -> Unit)? = null, icon: (@Composable () -> Unit)? = null, properties: DialogProperties = DialogProperties()) {
    if (LocalAWCPreviewPresentation.current == null) AlertDialog(onDismissRequest, confirmButton, dismissButton = dismissButton, title = title, text = text, icon = icon, properties = properties)
    else AWCDialog(onDismissRequest, properties) { PreviewDialogSurface(title, icon, confirmButton, dismissButton) { text?.invoke() } }
}

@Composable
internal fun AWCDatePickerDialog(onDismissRequest: () -> Unit, confirmButton: @Composable () -> Unit,
    dismissButton: (@Composable () -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    if (LocalAWCPreviewPresentation.current == null) DatePickerDialog(onDismissRequest, confirmButton, dismissButton = dismissButton, content = content)
    else AWCDialog(onDismissRequest) { PreviewDialogSurface(confirmButton = confirmButton, dismissButton = dismissButton) { Column(content = content) } }
}

@Composable
internal fun AWCModalBottomSheet(onDismissRequest: () -> Unit, dragHandle: (@Composable () -> Unit)? = { BottomSheetDefaults.DragHandle() }, content: @Composable ColumnScope.() -> Unit) {
    if (LocalAWCPreviewPresentation.current == null) ModalBottomSheet(onDismissRequest, dragHandle = dragHandle, content = content)
    else EmbeddedOverlay(onDismissRequest) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            Surface(Modifier.fillMaxWidth().fillMaxHeight(.8f).pointerInput(Unit) { detectTapGestures {} }.semantics { paneTitle = "Native preview bottom sheet" },
                shape = BottomSheetDefaults.ExpandedShape, color = MaterialTheme.colorScheme.surfaceContainerLow, tonalElevation = 4.dp) {
                Column(Modifier.verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) { dragHandle?.invoke(); content() }
            }
        }
    }
}

@Composable
internal fun AWCDropdownMenu(expanded: Boolean, onDismissRequest: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    if (LocalAWCPreviewPresentation.current == null) DropdownMenu(expanded, onDismissRequest, content = content)
    else if (expanded) EmbeddedOverlay(onDismissRequest, scrim = false) {
        Surface(Modifier.padding(16.dp).widthIn(max = 360.dp).fillMaxWidth().heightIn(max = 480.dp)
            .pointerInput(Unit) { detectTapGestures {} }.semantics { paneTitle = "Native preview menu" },
            shape = MaterialTheme.shapes.extraSmall, color = MaterialTheme.colorScheme.surfaceContainer, shadowElevation = 3.dp) {
            Column(Modifier.verticalScroll(rememberScrollState()), content = content)
        }
    }
}
