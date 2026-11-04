package dev.awc.nativeui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.semantics

/** One top-layer surface of the scope (an anchored menu or a submenu flyout), painted above the content in depth order. */
internal class NativeMenuEntry(val id:String,val depth:Int,val content:State<@Composable ()->Unit>)

/**
 * Anchors, open surfaces and dismissal for the md-menu family. Anchored menus present in the nearest [AWCMenuScope]
 * (the top layer: above content, positioned in the scope's viewport); outside one they render in flow.
 * Geometry is in dp relative to the scope.
 */
@Stable internal class NativeMenuRegistry {
    val anchors=mutableStateMapOf<String,Rect>()
    /** Anchor ids named by some menu (`anchor="<id>"`); only those report their frames. */
    val wanted=mutableStateMapOf<String,Unit>()
    var viewport by mutableStateOf(Size.Zero)
    var coordinates:LayoutCoordinates?=null
    var density=1f
    val entries=mutableStateListOf<NativeMenuEntry>()
    val surfaces=mutableMapOf<String,Rect>()
    val controllers=mutableMapOf<String,NativeMenuController>()
    val order=mutableListOf<String>()
    /** The most recent user interaction was a pointer press (Chrome's :focus-visible heuristic for script focus). */
    var pointerModality=false
    /** Focus actions of mounted anchors (the anchor element of `anchor="<id>"`). */
    val anchorFocus=mutableMapOf<String,()->Boolean>()
    /** Frame-clock time (ms) of the last pointer / key input handled by the menu family (NaN before any). */
    var inputTime=Double.NaN
    /** A menu row has the focus: its own key handling (Escape closes only its menu) wins over the window listener. */
    var focusedRow:String?=null
    /** Bumped when a menu registers or unregisters (anchors re-read their expanded state). */
    var registrations by mutableIntStateOf(0)
    fun register(c:NativeMenuController) { if(controllers[c.nodeID]==null) order+=c.nodeID;controllers[c.nodeID]=c;registrations++ }
    fun unregister(c:NativeMenuController) { if(controllers[c.nodeID]===c) { controllers.remove(c.nodeID);order.remove(c.nodeID);surfaces.remove(c.nodeID);registrations++ } }
    /** Accessible names of mounted anchors and submenu rows (a menu is named after its anchor). */
    val anchorLabels=mutableStateMapOf<String,String>()
    fun anchorMenus(id:String)=controllers.values.filter { it.parent==null && it.model.anchor==id }
    /** aria-expanded of the anchor [id]: null while no top-level menu names it, else whether one of them is open
     *  (`open` turns false at the end of the exit, as on the Web). */
    fun anchorExpanded(id:String):Boolean? {
        if(id.isEmpty() || !wanted.containsKey(id) || registrations<0) return null
        val menus=anchorMenus(id);return if(menus.isEmpty()) null else menus.any { it.isOpen }
    }
    /** Bounds of [c] in scope dp. */
    fun rect(c:LayoutCoordinates):Rect? {
        val root=coordinates?.takeIf { it.isAttached } ?: return null
        if(!c.isAttached) return null
        val r=root.localBoundingBoxOf(c,clipBounds=false)
        return Rect(r.left/density,r.top/density,r.right/density,r.bottom/density)
    }
    fun focusAnchor(id:String)=anchorFocus[id]?.invoke() ?: false
    /** `document` click listener: runs after the target's handler; a menu opened by this very click is not dismissed. */
    fun click(at:Offset) {
        for(id in order.toList()) { val c=controllers[id] ?: continue
            if(!c.isOpen || c.closing || c.model.persistent || c.justOpened) continue
            if(!c.treeContains(at,surfaces)) c.close() }
    }
    /** Escape outside any menu row: the open anchored menus close and focus their anchors. */
    fun escape():Boolean {
        if(focusedRow!=null) return false
        var handled=false
        for(id in order.toList().asReversed()) { val c=controllers[id] ?: continue
            if(c.isOpen && !c.closing && c.parent==null && c.model.anchor.isNotEmpty()) { c.close();c.focusAnchor();handled=true } }
        return handled
    }
    /** Opening a menu closes every other open, non-persistent menu that neither contains nor is contained by it. */
    fun dismissPeers(opened:NativeMenuController) {
        if(opened.model.persistent) return
        for(id in order.toList()) { val c=controllers[id] ?: continue
            if(c===opened || !c.isOpen || c.model.persistent) continue
            if(c.isAncestor(opened) || opened.isAncestor(c)) continue
            c.close() }
    }
}
internal val LocalNativeMenuRegistry=staticCompositionLocalOf<NativeMenuRegistry?> { null }

/**
 * Hosts anchored md-menu surfaces above [content] within this composable's bounds (the menu viewport). Author the
 * anchor and the menu as separate components; the anchor's source `id` (or [awcMenuAnchor]) matches the menu's `anchor`.
 * Pointer presses outside every open, non-persistent menu dismiss it (on release, after the target's own handler);
 * Escape closes the open anchored menus.
 */
/** The menus presented in one [AWCMenuScope]: md-menu handles by source id (methods, Laboratory and test hooks). */
@Stable class AWCMenuScopeState {
    internal val registry=NativeMenuRegistry()
    fun menu(id:String)=AWCMenuHandle({ registry },id)
    /** Persisted checkbox / radio state of a row (the owning menu keeps it while its surface is closed), else null. */
    fun selectionOf(rowID:String):Boolean? = registry.controllers.values.firstNotNullOfOrNull { it.selection[rowID] }
    /** Focus the anchor element registered as [id] (as the menu does when it restores focus). */
    fun focusAnchor(id:String)=registry.focusAnchor(id)
    /** Ids of the menus currently registered (mounted) in the scope, in registration order. */
    val menuIds:List<String> get()=registry.order.toList()
}
@Composable fun rememberAWCMenuScopeState()=remember { AWCMenuScopeState() }
@Composable fun AWCMenuScope(state:AWCMenuScopeState=rememberAWCMenuScopeState(),modifier:Modifier=Modifier,content:@Composable ()->Unit) {
    AWCMenuScope(state.registry,modifier,content)
}
@Composable internal fun AWCMenuScope(registry:NativeMenuRegistry,modifier:Modifier=Modifier,content:@Composable ()->Unit) {
    registry.density=LocalDensity.current.density
    NativeWindowKeys { e->
        if(e.action==android.view.KeyEvent.ACTION_DOWN) registry.inputTime=e.eventTime.toDouble()
        e.action==android.view.KeyEvent.ACTION_DOWN && e.keyCode==android.view.KeyEvent.KEYCODE_ESCAPE && registry.escape() }
    CompositionLocalProvider(LocalNativeMenuRegistry provides registry) {
        Box(modifier
            .onGloballyPositioned { registry.coordinates=it;registry.viewport=Size(it.size.width/registry.density,it.size.height/registry.density) }
            // Every pointer event's time, before any target handles it (a menu opened by this event knows its request time).
            .pointerInput(registry) { awaitPointerEventScope { while(true) { val e=awaitPointerEvent(PointerEventPass.Initial)
                e.changes.firstOrNull()?.let { registry.inputTime=it.uptimeMillis.toDouble() } } } }
            .pointerInput(registry) {
                awaitEachGesture {
                    val down=awaitFirstDown(false,PointerEventPass.Initial)
                    registry.pointerModality=true
                    // The document click runs after the target's own handler (Final pass of the release).
                    while(true) {
                        val event=awaitPointerEvent(PointerEventPass.Final)
                        val change=event.changes.firstOrNull { it.id==down.id } ?: break
                        if(!change.pressed) { if(change.previousPressed) registry.click(Offset(change.position.x/registry.density,change.position.y/registry.density));break }
                    }
                }
            }) {
            content()
            // Entries keep their own Box so the overlay never takes part in normal-flow measurement.
            registry.entries.sortedBy { it.depth }.forEach { entry-> key(entry) { Box(Modifier.matchParentSize()) { entry.content.value() } } }
        }
    }
}

/**
 * Reports this element's bounds as the md-menu anchor `id` to the nearest [AWCMenuScope]. Focus restoration
 * (Escape, Tab, activation) moves focus to the first focusable element inside it.
 */
@Composable fun Modifier.awcMenuAnchor(id:String,label:String?=null):Modifier {
    val registry=LocalNativeMenuRegistry.current ?: return this
    if(id.isEmpty()) return this
    val requester=remember { FocusRequester() }
    DisposableEffect(registry,id) {
        registry.anchorFocus[id]={ runCatching { requester.requestFocus() }.isSuccess }
        onDispose { registry.anchors.remove(id);registry.anchorFocus.remove(id);registry.anchorLabels.remove(id) }
    }
    // [label] names the menus anchored here (their accessible name, as the Web names a menu after its anchor).
    if(label!=null) SideEffect { if(registry.anchorLabels[id]!=label) registry.anchorLabels[id]=label }
    return this.onGloballyPositioned { c-> registry.rect(c)?.let { if(registry.anchors[id]!=it) registry.anchors[id]=it } }.focusRequester(requester)
}
/** AWCComponent applies this to every node with a source `id`: it reports the frame only while some menu names it. */
@Composable internal fun Modifier.nativeMenuAnchorAuto(id:String,label:String=""):Modifier {
    val registry=LocalNativeMenuRegistry.current ?: return this
    return if(id.isNotEmpty() && registry.wanted.containsKey(id)) awcMenuAnchor(id,label) else this
}
/**
 * The md-menu state of an anchor button, on the button's own semantics node (Web aria-expanded on a role="button"
 * anchor while its menu is open): TalkBack's expand / collapse open and close the anchored menu.
 */
@Composable internal fun Modifier.nativeMenuAnchorSemantics(id:String):Modifier {
    val registry=LocalNativeMenuRegistry.current ?: return this
    val expanded=registry.anchorExpanded(id) ?: return this
    return semantics { if(expanded) collapse { registry.anchorMenus(id).forEach { it.close() };true } else expand { registry.anchorMenus(id).firstOrNull()?.show();true } }
}
