package dev.awc.nativeui

import androidx.compose.runtime.*
import androidx.compose.ui.layout.LayoutCoordinates
import kotlinx.coroutines.*
import kotlinx.coroutines.selects.select

/** UI-thread lifecycle controller for one attached FAB menu. */
@Stable
class AWCFabMenuController {
    private var owner: Any?=null
    private var target: NativeFabMenuState?=null
    val isOpen: Boolean get() = target?.open==true
    val isClosing: Boolean get() = target?.closing==true
    /** Waits for the menu's initial closed paint before opening, not entry motion. */
    suspend fun show() { checkNotNull(target) { "The FAB menu controller is not attached." }.show() }
    /** Starts closing; use whenClosed for the completed close lifecycle. */
    suspend fun close() { target?.close() }
    /** Resolves after this opening cycle closes, or after its target disconnects. */
    suspend fun whenClosed() { target?.whenClosed() }
    internal fun attach(identity: Any,state: NativeFabMenuState) {
        check(owner==null || owner===identity) { "AWCFabMenuControllerScope must contain one FAB menu." }
        owner=identity;target=state
    }
    internal fun detach(identity: Any) { if(owner===identity) { owner=null;target=null } }
}
@Composable fun rememberAWCFabMenuController() = remember { AWCFabMenuController() }
internal val LocalAWCFabMenuController = staticCompositionLocalOf<AWCFabMenuController?> { null }
@Composable
fun AWCFabMenuControllerScope(controller: AWCFabMenuController,content: @Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCFabMenuController provides controller,content=content)
}

internal data class NativeFabMenuItemEntry(
    val id: Any,
    val focus: AWCButtonFocusState,
    val label: ()->String,
)

internal class NativeFabMenuState(
    initialOpen: Boolean,
    val scope: CoroutineScope,
    private val frame: suspend ()->Unit = { withFrameNanos { } },
) {
    var open by mutableStateOf(initialOpen); private set
    var closing by mutableStateOf(false); private set
    var focusedIndex by mutableIntStateOf(if(initialOpen) 0 else -1); private set
    var rovingFocus by mutableStateOf(false); private set
    var effectivePlacement by mutableStateOf("up")
    var coordinates: LayoutCoordinates?=null
    var childSequence=0
    fun nextChildID()=++childSequence
    var quick=false
    var props: Props=emptyMap()
    var onOpenCommit: (Boolean)->Unit={}
    var onAnchorFocus: ()->Unit={}
    var onKeyboardInput: ()->Unit={}
    var onOpeningFocus: ()->Boolean={false}
    val items=mutableStateListOf<NativeFabMenuItemEntry>()
    private val initialized=CompletableDeferred<Unit>()
    private var pendingOpen: CompletableDeferred<Unit>?=null
    private var cycle=if(initialOpen) CompletableDeferred<Unit>() else null
    private var generation=0
    private var transition=0
    private var closeJob: Job?=null
    private var typeaheadJob: Job?=null
    private var typeahead=""
    private var disconnected=false

    suspend fun loaded() { frame();frame();initialized.complete(Unit) }
    private fun openingCycle() { if(cycle==null) cycle=CompletableDeferred() }
    suspend fun show() {
        pendingOpen?.complete(Unit)
        val pending=CompletableDeferred<Unit>();pendingOpen=pending
        val request=++generation
        ++transition;openingCycle()
        select<Unit> { initialized.onAwait { };pending.onAwait { } }
        if(disconnected || request!=generation) return
        pendingOpen=null
        closeJob?.cancel();closing=false
        val changed=!open
        if(changed) { open=true;++transition;onOpenCommit(true) }
        if(open && !closing && !disconnected) {
            val shouldFocus=onOpeningFocus()
            scope.launch {
                frame()
                if(open && !closing && !disconnected && generation==request) {
                    if(shouldFocus) focusItem(0,true) else { focusedIndex=if(items.isEmpty()) -1 else 0;rovingFocus=false }
                }
            }
        }
    }
    fun updateOpen(value: Boolean) {
        cancelPendingOpen()
        if(value==open) return
        closeJob?.cancel();closing=false
        open=value;++transition
        if(value) openingCycle()
        onOpenCommit(value)
        if(value) {
            val request=generation
            scope.launch { frame();if(open && request==generation) { focusedIndex=if(items.isEmpty()) -1 else 0;rovingFocus=false } }
        } else finishClose()
    }
    private fun cancelPendingOpen() { ++generation;pendingOpen?.complete(Unit);pendingOpen=null }
    fun close() {
        cancelPendingOpen()
        if(!open) { settleCycle();return }
        if(closing) return
        if(quick) commitClose()
        else { closing=true;closeJob=scope.launch { delay(180);commitClose() } }
    }
    private fun commitClose() {
        if(disconnected || !open) return
        closing=false;open=false;++transition
        onOpenCommit(false)
        finishClose()
    }
    private fun finishClose() {
        focusedIndex=-1;rovingFocus=false;onAnchorFocus()
        settleCycle()
    }
    private fun settleCycle() {
        val current=cycle ?: return
        val revision=++transition
        scope.launch {
            frame()
            if(!open && pendingOpen==null && transition==revision) { cycle=null;current.complete(Unit) }
        }
    }
    suspend fun whenClosed() { if(!disconnected) cycle?.await() }
    fun disconnect() {
        disconnected=true;cancelPendingOpen();++transition
        closeJob?.cancel();typeaheadJob?.cancel();initialized.complete(Unit)
        cycle?.complete(Unit);cycle=null
    }
    fun register(entry: NativeFabMenuItemEntry) {
        val index=items.indexOfFirst { it.id===entry.id }
        if(index<0) items+=entry else if(items[index]!=entry) items[index]=entry
    }
    fun remove(id: Any) { items.removeAll { it.id===id };if(focusedIndex>=items.size) focusedIndex=items.lastIndex }
    fun reorder(ids: List<Any>) {
        val focused=items.getOrNull(focusedIndex)?.id
        val next=ids.mapNotNull { id->items.find { it.id===id } }
        if(next.size==items.size && next.map { it.id }!=items.map { it.id }) {
            items.clear();items.addAll(next);focusedIndex=items.indexOfFirst { it.id===focused }
        }
    }
    fun focused(id: Any) {
        val index=items.indexOfFirst { it.id===id }
        if(index>=0) { focusedIndex=index;rovingFocus=false }
    }
    fun focusItem(index: Int,visible: Boolean=true) {
        if(items.isEmpty()) return
        focusedIndex=((index%items.size)+items.size)%items.size
        rovingFocus=visible
        // Source traversal includes disabled items. Native hard-disabled focus
        // may be refused; the explicit roving visual remains independently set.
        if(visible) items[focusedIndex].focus.requestFocus() else items[focusedIndex].focus.requestPointerFocus()
    }
    fun focusAnchor() { focusedIndex=-1;rovingFocus=false;onAnchorFocus() }
    fun itemActivated() { close();onAnchorFocus() }
    fun itemKey(id: Any,key: String,shift: Boolean=false): Boolean {
        if(!open || items.isEmpty()) return false
        onKeyboardInput()
        val original=items.indexOfFirst { it.id===id }.takeIf { it>=0 } ?: focusedIndex
        when(key) {
            "Escape" -> { close();onAnchorFocus() }
            "ArrowUp" -> if(effectivePlacement=="up") focusItem(focusedIndex+1) else if(focusedIndex<=0) focusAnchor() else focusItem(focusedIndex-1)
            "ArrowDown" -> if(effectivePlacement=="down") focusItem(focusedIndex+1) else if(focusedIndex<=0) focusAnchor() else focusItem(focusedIndex-1)
            "Home" -> focusItem(0)
            "End" -> focusItem(items.lastIndex)
            "Tab" -> {
                if(shift) { if(original<=0) focusAnchor() else focusItem(original-1,false) }
                else if(original>=items.lastIndex) { close();return false } else focusItem(original+1,false)
            }
            else -> {
                if(key.length!=1) return false
                typeaheadJob?.cancel();typeahead+=key.lowercase()
                typeaheadJob=scope.launch { delay(300);typeahead="" }
                val start=focusedIndex.coerceAtLeast(0)
                for(offset in 1..items.size) {
                    val index=(start+offset)%items.size
                    if(items[index].label().trim().lowercase().startsWith(typeahead)) { focusItem(index);break }
                }
                return false
            }
        }
        return true
    }
    fun anchorKey(key: String,shift: Boolean): Boolean {
        if(!open && !closing) return false
        when(key) {
            "Escape" -> close()
            "ArrowUp" -> if(effectivePlacement=="up") focusItem(0) else return false
            "ArrowDown" -> if(effectivePlacement=="down") focusItem(0) else return false
            "Tab" -> if(!shift) focusItem(0,false) else return false
            else -> return false
        }
        return true
    }
}
