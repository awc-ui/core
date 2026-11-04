package dev.awc.nativeui

import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.semantics

/** Native relationship metadata; no DOM node or automatic menu is created. */
val AWCPopupKindKey = SemanticsPropertyKey<String>("AWCPopupKind")
var SemanticsPropertyReceiver.awcPopupKind by AWCPopupKindKey
val AWCControlledPopupKey = SemanticsPropertyKey<String>("AWCControlledPopup")
var SemanticsPropertyReceiver.awcControlledPopup by AWCControlledPopupKey
val AWCPopupTargetKey = SemanticsPropertyKey<String>("AWCPopupTarget")
var SemanticsPropertyReceiver.awcPopupTarget by AWCPopupTargetKey

internal class AWCPopupRegistry {
    private data class Entry(val owner: Any, val focus: () -> Boolean)
    private val targets = mutableStateMapOf<String, Entry>()
    fun register(id: String, owner: Any, focus: () -> Boolean) { targets[id] = Entry(owner, focus) }
    fun unregister(id: String, owner: Any) { if (targets[id]?.owner === owner) targets.remove(id) }
    fun contains(id: String) = targets.containsKey(id)
    fun focus(id: String): Boolean = targets[id]?.focus?.invoke() ?: false
}
internal val LocalAWCPopupRegistry = staticCompositionLocalOf<AWCPopupRegistry?> { null }
internal val LocalAWCPopupFocusLabel = staticCompositionLocalOf { "Move to popup" }

/**
 * Connect controls IDs to actual native popup content. The accessibility action
 * only moves focus; opening and closing remain the application's responsibility.
 */
@Composable
fun AWCPopupScope(focusActionLabel: String = "Move to popup", content: @Composable () -> Unit) {
    val registry = remember { AWCPopupRegistry() }
    CompositionLocalProvider(LocalAWCPopupRegistry provides registry,
        LocalAWCPopupFocusLabel provides focusActionLabel, content = content)
}

/** Register one mounted popup's focus group under an authored controls ID. */
@Composable
fun AWCPopupTargetScope(id: String, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    require(id.isNotBlank()) { "A popup target needs a nonempty authored ID." }
    val registry = LocalAWCPopupRegistry.current
    val identity = remember { Any() }
    val focus = remember { FocusRequester() }
    DisposableEffect(registry, id, identity) {
        registry?.register(id, identity) { runCatching { focus.requestFocus() }.getOrDefault(false) }
        onDispose { registry?.unregister(id, identity) }
    }
    Box(modifier.focusRequester(focus).focusGroup().semantics { awcPopupTarget = id }) { content() }
}
