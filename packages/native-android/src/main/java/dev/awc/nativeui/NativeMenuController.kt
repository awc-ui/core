package dev.awc.nativeui

import androidx.compose.runtime.*
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Menu evidence for tests and the Laboratory: per row and per menu values at the frame they render. */
class AWCMenuInspection {
    val rows=mutableMapOf<String,Map<String,Any?>>()
    val menus=mutableMapOf<String,Map<String,Any?>>()
    /** md* events in dispatch order: (name, node id, frame-clock ms). */
    val events=mutableListOf<Triple<String,String,Double>>()
    fun clear() { rows.clear();menus.clear();events.clear() }
}
internal val LocalAWCMenuInspection=staticCompositionLocalOf<AWCMenuInspection?> { null }
@Composable fun AWCMenuInspectionScope(inspection:AWCMenuInspection,content:@Composable ()->Unit) {
    CompositionLocalProvider(LocalAWCMenuInspection provides inspection,content=content)
}

/** Imperative md-menu methods (show, close, reposition, getScrollViewport) for one menu id inside an [AWCMenuScope]. */
class AWCMenuHandle internal constructor(private val registry:()->NativeMenuRegistry?,val id:String) {
    private val c get()=registry()?.controllers?.get(id)
    internal val controller get()=c
    val isOpen get()=c?.isOpen ?: false
    fun show(keyboard:Boolean=false,autoFocus:Boolean?=null):Boolean { val m=c ?: return false;m.show(autoFocus,keyboard);return true }
    fun close():Boolean { val m=c ?: return false;m.close();return true }
    /** Re-runs placement on the next layout pass (the surface measures and positions itself every frame). */
    fun reposition():Boolean { val m=c ?: return false;m.repositions++;return true }
    /** The scroll viewport: its scrollTop, scroll height and client height in dp (null while closed). */
    /** `whenClosed()`: returns at once while closed, else when `open` turns false (after the exit). */
    suspend fun whenClosed() { val m=c ?: return;if(!m.isOpen) return;val d=kotlinx.coroutines.CompletableDeferred<Unit>();m.closeWaiters+=d;d.await() }
    fun getScrollViewport():Map<String,Double>? { val m=c?.takeIf { it.isOpen } ?: return null
        return mapOf("scrollTop" to m.scrollTop,"scrollHeight" to m.contentHeight,"clientHeight" to m.viewportHeight) }
    /** md-sub-menu-item `collapse()` on the submenu row [rowID] of this menu. */
    fun collapse(rowID:String):Boolean { val r=c?.rows?.get(rowID) ?: return false;r.collapse();return true }
    val isClosing get()=c?.closing ?: false
    /** Row ids of this menu in document order (mounted rows of an open surface). */
    val rows:List<String> get()=c?.rowOrder ?: emptyList()
    val submenuRows:List<String> get()=c?.let { m-> m.rowOrder.filter { m.rows[it]?.sub==true } } ?: emptyList()
    var scrollTop:Double
        get()=c?.scrollTop ?: 0.0
        set(v) { c?.scrollTop=v }
    /** Row focus as `HTMLElement.focus()` from script (ring per Chrome's :focus-visible heuristic when [ring] is null). */
    fun focusRow(rowID:String,ring:Boolean?=null):Boolean { val m=c ?: return false;return m.focus(rowID,ring ?: (m.registry?.pointerModality!=true)) }
    /** md-sub-menu-item opening its flyout (keyboard: [autoFocus] focuses the flyout's first row). */
    fun openSubmenu(rowID:String,autoFocus:Boolean):Boolean { val r=c?.rows?.get(rowID) ?: return false;r.openSubmenu(autoFocus);return true }
    val focusedRow:String? get()=c?.registry?.focusedRow
}

/**
 * One md-menu instance: open / closing state, its rows (roving focus, typeahead, radio scopes), its flyouts and the
 * source's close-the-tree rules. Nested flyout menus link to the menu of their submenu row. Times are frame-clock ms.
 */
@Stable internal class NativeMenuController(val nodeID:String) {
    var model by mutableStateOf(NativeMenuModel())
    var isOpen by mutableStateOf(false)
    var closing by mutableStateOf(false)
    /** The surface is still painted while its exit transition runs (after `open` turned false). */
    var lingering by mutableStateOf(false)
    /** Row that shows the focus ring (`data-md-focused`) and the roving index. */
    var ringed by mutableStateOf<String?>(null)
    var focusedID by mutableStateOf<String?>(null)
    /** The submenu row whose flyout is open (one per menu). */
    var openSubmenu by mutableStateOf<String?>(null)
    var scrollTop by mutableDoubleStateOf(0.0)
    var repositions by mutableIntStateOf(0)
    /** Checkbox / radio state of this menu's rows; it outlives the row composables of a closed surface. */
    val selection=mutableStateMapOf<String,Boolean>()
    var parent:NativeMenuController?=null
    var registry:NativeMenuRegistry?=null
    var parentRowID:String?=null
    val rows=linkedMapOf<String,Row>()
    val children=mutableMapOf<String,NativeMenuController>()
    var setOpen:(Boolean)->Unit={}
    var emit:(String)->Unit={}
    var focusAnchorAction:(()->Boolean)?=null
    /** The owner's claim on keys typed on a row before typeahead (printable characters and "Backspace"): md-autocomplete keeps
     *  typing in its input (`handleListboxKeyDown`). Returns true when the owner consumed the key. */
    var rowKeyClaim:((String)->Boolean)?=null
    var focusManager:FocusManager?=null
    var scope:CoroutineScope?=null
    var openedAt=Double.NaN
    var closingAt=Double.NaN
    var openedViaKeyboard=false
    var keyboardModality=false
    /** setVirtualProvider(): the virtual data model (null: the composed rows drive navigation). */
    var provider:AWCMenuVirtualProvider?=null
    /** The surface is a listbox while a provider is set (the source's listboxMode). */
    var listboxMode by mutableStateOf(false)
    /** setComboboxElement(): the element that keeps focus while the provider's rows are navigated. */
    var comboboxID:String?=null
    /** The combobox's active option (its aria-activedescendant) and the row ringed without focus (data-md-focused). */
    var activeDescendant by mutableStateOf<String?>(null)
    var virtualRing by mutableStateOf<String?>(null)
    var virtualIndex=-1
    private var virtualSeq=0;private var virtualBuffer="";private var virtualBufferAt=Double.NEGATIVE_INFINITY
    private val typeahead=NativeMenuTypeahead()
    private var closeJob:Job?=null;private var lingerJob:Job?=null
    var surfaceRect:Rect?=null
    var viewportRect:Rect?=null
    val rowRects=mutableMapOf<String,Rect>()
    var contentHeight=0.0;var viewportHeight=0.0
    /** Pointer over this (flyout) surface: the submenu row's close intent waits while it is inside. */
    var pointerInside=false
    /** Registration order of the rows of this menu (document order of the composed rows). */
    var rowOrder:List<String> = emptyList()
    class Row(val requester:FocusRequester,val showFocus:MutableState<Boolean>,val pending:MutableState<Boolean>) {
        var label="";var disabled=false;var sub=false;var radioScope:String?=null;var order=0.0
        var deselect:()->Unit={};var openSubmenu:(Boolean)->Unit={};var collapse:()->Unit={};var hoverLeave:()->Unit={}
        /** `closeSubmenu()`: the flyout plays its exit, the row keeps its open state for 100 ms. */
        var closeSubmenu:()->Unit={}
        /** The row's click (Enter on the combobox's active option). */
        var activate:()->Unit={}
    }
    val root:NativeMenuController get()=parent?.root ?: this
    /** The click that opened this menu is the click the document listener sees. */
    val justOpened get()=registry?.let { r-> !openedAt.isNaN() && !r.inputTime.isNaN() && r.inputTime-openedAt<40 && r.inputTime>=openedAt } ?: false
    fun isAncestor(other:NativeMenuController):Boolean { var p=other.parent;while(p!=null) { if(p===this) return true;p=p.parent };return false }
    fun treeContains(p:Offset,surfaces:Map<String,Rect>):Boolean {
        if(isOpen && surfaces[nodeID]?.contains(p)==true) return true
        return children.values.any { it.treeContains(p,surfaces) }
    }
    private fun requestTime()=registry?.inputTime ?: Double.NaN

    // MARK: open / close (md-menu show() / close())
    /** [at]: the frame-clock time of the request when it is not the latest input (a hover timer). */
    fun show(autoFocus:Boolean?=null,keyboard:Boolean=false,at:Double=Double.NaN) {
        closeJob?.cancel();lingerJob?.cancel();closing=false;lingering=false
        openedViaKeyboard=keyboard || keyboardModality
        val wasOpen=isOpen
        if(!isOpen) openedAt=if(at.isNaN()) requestTime() else at
        isOpen=true
        if(!wasOpen) { setOpen(true);emit("mdOpen") }
        registry?.dismissPeers(this)
        // data-md-focused follows the keyboard; script focus is still :focus-visible unless a pointer press came last.
        if(autoFocus ?: model.autoFocus) focusFirst(openedViaKeyboard || registry?.pointerModality!=true) else { focusedID=rowOrder.firstOrNull();ringed=null }
    }
    /** Non-quick menus play the 150 ms exit before `open` turns false (mdClose fires then). */
    /** [timer]: requested by a timer (activation), not by the latest input: the exit starts in the frame that applies it. */
    fun close(timer:Boolean=false) {
        if(!isOpen || closing) return
        collapseSubmenus()
        if(model.quick) { lingering=false;finishClose();return }
        closing=true;closingAt=if(timer) Double.NEGATIVE_INFINITY else requestTime();lingering=true
        closeJob?.cancel();lingerJob?.cancel()
        lingerJob=scope?.launch { delay(205);lingering=false }
        closeJob=scope?.launch { delay(150);if(closing) finishClose() }
        if(scope==null) { lingering=false;finishClose() }
    }
    /** `open = false` without the exit (md-sub-menu-item `collapse()`). */
    fun closeNow() { if(!isOpen) return;collapseSubmenus();closeJob?.cancel();lingerJob?.cancel();lingering=false;finishClose() }
    val closeWaiters=mutableListOf<kotlinx.coroutines.CompletableDeferred<Unit>>()
    private fun finishClose() { closing=false;isOpen=false;ringed=null;focusedID=null;virtualIndex=-1;virtualRing=null;activeDescendant=null;setOpen(false);emit("mdClose")
        val w=closeWaiters.toList();closeWaiters.clear();w.forEach { it.complete(Unit) } }
    /** `closeEntireMenuTree()` (Tab) closes the root and focuses its anchor. */
    fun closeTree() { val r=root;r.close();r.focusAnchor() }
    /** Row activation without `keep-open`: the root anchor takes focus now, the root closes after 150 ms. */
    fun activated() { val r=root;r.focusAnchor();scope?.launch { delay(150);r.close(timer=true) } ?: r.close() }
    fun focusAnchor():Boolean {
        val p=parent;val row=parentRowID
        if(p!=null && row!=null) return p.focus(row,true)
        return focusAnchorAction?.invoke() ?: false
    }
    fun collapseSubmenus() { rowOrder.forEach { rows[it]?.collapse?.invoke() };openSubmenu=null }

    // MARK: rows
    fun select(radio:String) { val sc=rows[radio]?.radioScope ?: return;rows.forEach { (id,r)-> if(id!=radio && r.radioScope==sc) r.deselect() } }
    fun focus(id:String,ring:Boolean):Boolean {
        val row=rows[id] ?: return false
        focusedID=id;ringed=if(ring) id else null
        row.showFocus.value=ring;row.pending.value=true
        val ok=runCatching { row.requester.requestFocus() }.isSuccess
        ensureVisible(id)
        return ok
    }
    /** `focus()` scrolls the capped viewport so the row is visible (nearest edge). */
    fun ensureVisible(id:String) {
        val r=rowRects[id] ?: return;val v=viewportRect ?: return
        if(v.height<=0f) return
        if(r.top<v.top) scrollTop=maxOf(0.0,scrollTop-(v.top-r.top)) else if(r.bottom>v.bottom) scrollTop+=(r.bottom-v.bottom)
    }
    fun focusFirst(ring:Boolean) {
        provider?.let { p-> val n=p.count();if(n>0) focusVirtual(nextEnabled(-1,1,n),ring);return }
        // The surface composes and lays out after the request: retry each frame until the first row is focusable.
        val s=scope
        if(s==null) { rowOrder.firstOrNull()?.let { focus(it,ring) };return }
        s.launch {
            repeat(40) {
                if(!isOpen || closing) return@launch
                val first=rowOrder.firstOrNull()
                if(first!=null && rows[first]!=null && focus(first,ring)) return@launch
                withFrameNanos { }
            }
        }
    }
    fun didFocus(id:String) { if(id in rowOrder) focusedID=id }
    private fun move(index:Int) {
        if(rowOrder.isEmpty()) return
        val i=if(index<0) rowOrder.size-1 else if(index>=rowOrder.size) 0 else index
        focus(rowOrder[i],true)
    }
    // MARK: virtual provider (handleKeyDownVirtual / focusVirtual / handleTypeaheadVirtual)
    /** Next non-disabled index from [from] in [dir], wrapping; -1 only when every row is disabled or the list is empty. */
    fun nextEnabled(from:Int,dir:Int,count:Int):Int {
        val p=provider ?: return -1;if(count<=0) return -1
        var idx=from
        repeat(count) { idx+=dir;if(idx<0) idx=count-1 else if(idx>=count) idx=0;if(!p.isDisabledAt(idx)) return idx }
        return if(from in 0 until count) from else -1
    }
    /** The active index moves at once; after `ensureVisible` the latest request rings its windowed row and (combobox) marks it
     *  active without moving focus, or (no combobox) focuses it. */
    fun focusVirtual(index:Int,ring:Boolean=true) {
        val p=provider ?: return;if(index<0) return
        val seq=++virtualSeq;virtualIndex=index
        val apply={ val id=p.rowIdForIndex(index)
            if(seq==virtualSeq && isOpen && !closing && provider===p && id!=null) {
                if(comboboxID!=null) { focusedID=id;virtualRing=if(ring) id else null;activeDescendant=id;ensureVisible(id) } else focus(id,ring) } }
        val s=scope
        if(s==null) return
        s.launch { p.ensureVisible(index);withFrameNanos { };apply() }
    }
    /** Keys from the combobox (header input or [AWCMenuHandle.handleKey]). */
    fun comboboxKey(key:String,shift:Boolean,modified:Boolean,fromInput:Boolean=false,time:Double=Double.NaN):Boolean {
        keyboardModality=true;registry?.pointerModality=false
        if(provider!=null) virtualKey(key,shift,modified,time,fromInput)?.let { return it }
        return when(key) {
            "Escape"->{ close();focusAnchor();true }
            "Tab"->{ val fm=root.focusManager ?: focusManager;closeTree();fm?.moveFocus(if(shift) FocusDirection.Previous else FocusDirection.Next);true }
            else->false
        }
    }
    /** The source's handleKeyDownVirtual; null: the key keeps the menu's ordinary handling (Escape, Tab). */
    fun virtualKey(key:String,shift:Boolean,modified:Boolean,time:Double,fromInput:Boolean=false):Boolean? {
        val p=provider ?: return null;val n=p.count()
        return when(key) {
            "ArrowDown"->{ focusVirtual(nextEnabled(virtualIndex,1,n));true }
            "ArrowUp"->{ focusVirtual(nextEnabled(virtualIndex,-1,n));true }
            "Home"->{ focusVirtual(nextEnabled(-1,1,n));true }
            "End"->{ focusVirtual(nextEnabled(n,-1,n));true }
            "Enter"->{ if(comboboxID==null || virtualIndex<0) false else { p.rowIdForIndex(virtualIndex)?.let { rows[it]?.activate?.invoke() };true } }
            "Escape","Tab"->null
            else->{
                // Characters typed in the header search field are its own (the source checks e.target).
                if(fromInput || key.length!=1 || modified || shift) return false
                val now=if(time.isNaN()) System.nanoTime()/1e6 else time
                if(now-virtualBufferAt>500) virtualBuffer=""
                virtualBuffer+=key.lowercase();virtualBufferAt=now
                val from=if(virtualBuffer.length==1) virtualIndex+1 else virtualIndex
                val hit=p.findPrefix(virtualBuffer,maxOf(0,from))
                if(hit>=0) focusVirtual(hit)
                true
            }
        }
    }
    /** md-menu `handleKeyDown` for a row of this menu (focus is on the row). */
    fun key(key:String,from:String,shift:Boolean,modified:Boolean,rtl:Boolean,time:Double):Boolean {
        if(!isOpen) return false
        keyboardModality=true;registry?.pointerModality=false
        if(provider!=null) virtualKey(key,shift,modified,time)?.let { return it }
        val index=rowOrder.indexOf(from)
        // Inside a flyout, Escape and the close key reach the submenu row: it closes the flyout and takes focus back.
        val p=parent;val row=parentRowID
        if(p!=null && row!=null && (key=="Escape" || key==(if(rtl) "ArrowRight" else "ArrowLeft"))) { p.rows[row]?.closeSubmenu?.invoke();p.focus(row,true);return true }
        return when(key) {
            "Escape"->{ close();focusAnchor();true }
            "ArrowDown"->{ move(index+1);true }
            "ArrowUp"->{ move(index-1);true }
            "Home"->{ move(0);true }
            "End"->{ move(rowOrder.size-1);true }
            "Tab"->{ val fm=root.focusManager ?: focusManager;closeTree();fm?.moveFocus(if(shift) FocusDirection.Previous else FocusDirection.Next);true }
            else->{
                rowKeyClaim?.let { claim-> if(!modified && (key.length==1 || key=="Backspace") && claim(key)) return true }
                if(key.length!=1 || modified || shift) return false
                val hit=typeahead.next(key,time,index,rowOrder.map { rows[it]?.label ?: "" })
                if(hit!=null) move(hit)
                true
            }
        }
    }
    /** Rows register in composition order; [order] keeps document order when rows remount. */
    fun register(id:String,row:Row) { rows[id]=row;rowOrder=rows.entries.sortedBy { it.value.order }.map { it.key } }
    fun unregister(id:String,row:Row) { if(rows[id]===row) { rows.remove(id);rowOrder=rowOrder-id;if(ringed==id) ringed=null } }
}
