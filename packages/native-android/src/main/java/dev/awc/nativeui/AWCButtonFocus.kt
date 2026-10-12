package dev.awc.nativeui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.*
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.LayoutDirection

/** A native button focus handle. Requests are applied after Compose updates focus eligibility. */
@Stable
class AWCButtonFocusState {
    var isFocused: Boolean by mutableStateOf(false)
        internal set
    internal var pending by mutableStateOf(false)
    internal var revision by mutableIntStateOf(0)
    internal var attached = false
    internal var enabled = true
    fun requestFocus(): Boolean {
        if (!attached || !enabled) return false
        pending = true; revision++
        return true
    }
}
private data class ButtonFocusBinding(val state: AWCButtonFocusState, val changed: (Boolean) -> Unit)
private val LocalButtonFocusBinding = staticCompositionLocalOf<ButtonFocusBinding?> { null }

/** Apply to a single button; -1 stays programmatically focusable through this native handle. */
@Composable
fun AWCButtonFocusScope(state: AWCButtonFocusState, onFocusChanged: (Boolean) -> Unit = {}, content: @Composable () -> Unit) {
    val latest = rememberUpdatedState(onFocusChanged)
    val binding = remember(state) { ButtonFocusBinding(state) { latest.value(it) } }
    CompositionLocalProvider(LocalButtonFocusBinding provides binding, content = content)
}

internal data class ButtonFocusEntry(val id: Any, val state: AWCButtonFocusState, val disabled: Boolean, val selected: Boolean)
internal class ButtonFocusGroup(single: Boolean) {
    private var single by mutableStateOf(single)
    fun updateSelectionMode(single: Boolean) { this.single = single }
    private val entries = mutableStateListOf<ButtonFocusEntry>()
    private var recent by mutableStateOf<Any?>(null)
    val count get() = entries.size
    val active: Any? get() = entries.firstOrNull { it.id == recent && !it.disabled }?.id
        ?: entries.firstOrNull { single && it.selected && !it.disabled }?.id
        ?: entries.firstOrNull { !it.disabled }?.id ?: entries.firstOrNull()?.id
    fun update(entry: ButtonFocusEntry) {
        val index = entries.indexOfFirst { it.id == entry.id }
        if (index < 0) entries += entry else if (entries[index] != entry) {
            val wasFocused = entries[index].state.isFocused
            entries[index] = entry
            if (entry.disabled && wasFocused) entries.firstOrNull { it.id == active && !it.disabled }?.state?.requestFocus()
        }
    }
    fun remove(id: Any) { entries.removeAll { it.id == id } }
    fun focused(id: Any) { recent = id }
    fun tabIndex(id: Any): Int = if (active == id) 0 else -1
    fun destination(id: Any, key: String, rtl: Boolean): Any? {
        val eligible = entries.filter { !it.disabled }
        if (eligible.isEmpty()) return null
        val current = eligible.indexOfFirst { it.id == id }
        val next = when (key) {
            "Home" -> 0
            "End" -> eligible.lastIndex
            "ArrowLeft", "ArrowRight" -> {
                val forward = (key == "ArrowRight") != rtl
                if (current < 0) { if (forward) 0 else eligible.lastIndex }
                else (current + (if (forward) 1 else -1) + eligible.size) % eligible.size
            }
            else -> return null
        }
        return eligible[next].id.takeUnless { it == id }
    }
    fun move(id: Any, key: String, rtl: Boolean): Boolean {
        val target = destination(id, key, rtl) ?: return false
        val item = entries.first { it.id == target }
        if (!item.state.requestFocus()) return false
        recent = target
        return true
    }
}

internal fun nativeButtonTabIndex(p: Props, group: ButtonFocusGroup?, id: Any): Int = when {
    p.bool("disabled") -> -1
    group != null -> group.tabIndex(id)
    (p["groupTabindex"] as? Number)?.toInt() == -1 -> -1
    p["groupTabindex"] == "-1" -> -1
    else -> 0
}
internal fun nativeButtonRole(p: Props): String = if (p.str("roleOverride").lowercase() == "gridcell") "gridcell" else "button"

@Composable
internal fun nativeButtonFocusModifier(p: Props, id: Any, group: ButtonFocusGroup?, selected: Boolean): Modifier {
    val binding = LocalButtonFocusBinding.current
    val ownState = remember { AWCButtonFocusState() }
    val state = binding?.state ?: ownState
    val requester = remember { FocusRequester() }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val hardEnabled = !p.bool("disabled")
    val tabIndex = nativeButtonTabIndex(p, group, id)
    SideEffect { state.enabled = hardEnabled; group?.update(ButtonFocusEntry(id, state, !hardEnabled, selected)) }
    DisposableEffect(state, group, id) {
        state.attached = true
        onDispose { state.attached = false; state.isFocused = false; state.pending = false; group?.remove(id) }
    }
    LaunchedEffect(state.revision) {
        if (state.pending && state.enabled) {
            requester.requestFocus()
            state.pending = false
        }
    }
    return Modifier
        .focusRequester(requester)
        .focusProperties { canFocus = hardEnabled && (tabIndex == 0 || state.isFocused || state.pending) }
        .onFocusChanged {
            if (state.isFocused != it.isFocused) {
                state.isFocused = it.isFocused
                if (it.isFocused) group?.focused(id)
                binding?.changed?.invoke(it.isFocused)
            }
        }
        .onPreviewKeyEvent { event ->
            if (event.type != KeyEventType.KeyDown || group == null) false
            else group.move(id, when (event.key) {
                Key.DirectionLeft -> "ArrowLeft"; Key.DirectionRight -> "ArrowRight"; Key.MoveHome -> "Home"; Key.MoveEnd -> "End"; else -> ""
            }, rtl)
        }
        .pointerInput(state, hardEnabled) {
            awaitEachGesture {
                awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                if (hardEnabled) state.requestFocus()
                waitForUpOrCancellation()
            }
        }
}

data class AWCGridCell(val row: Int, val column: Int, val rowSpan: Int = 1, val columnSpan: Int = 1) {
    init { require(row >= 0 && column >= 0 && rowSpan > 0 && columnSpan > 0) }
}
internal val LocalAWCGridCell = staticCompositionLocalOf<AWCGridCell?> { null }

/** Native collection metadata for a custom grid, independent of the Material date-picker widget. */
@Composable
fun AWCGridScope(rows: Int, columns: Int, content: @Composable () -> Unit) {
    require(rows > 0 && columns > 0)
    Box(Modifier.semantics { collectionInfo = CollectionInfo(rows, columns) }, content = { content() })
}
@Composable
fun AWCGridCellScope(row: Int, column: Int, rowSpan: Int = 1, columnSpan: Int = 1, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAWCGridCell provides AWCGridCell(row, column, rowSpan, columnSpan), content = content)
}
