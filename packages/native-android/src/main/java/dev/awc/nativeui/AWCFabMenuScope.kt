package dev.awc.nativeui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import kotlinx.coroutines.isActive

internal data class NativeFabAnchorPresentation(val variant: String,val circle: Boolean,val fading: Boolean)
internal class NativeAnchor(val id: String,val tag: String) {
    var coordinates: LayoutCoordinates?=null
    var bounds by mutableStateOf(Rect.Zero)
    var focus: AWCButtonFocusState?=null
    var pointerWasFocused=false
    var expanded by mutableStateOf<Boolean?>(null)
    var fabPresentation by mutableStateOf<NativeFabAnchorPresentation?>(null)
    var setMenuIcon: ((String?)->Unit)?=null
    var activateMenu: ((AWCActivationMetadata,Boolean)->Unit)?=null
    var menuKey: ((String,Boolean)->Boolean)?=null
    fun refreshBounds() {
        val c=coordinates ?: return
        if(c.isAttached) bounds=c.findRootCoordinates().localBoundingBoxOf(c,clipBounds=false)
    }
    fun activate(metadata: AWCActivationMetadata): Boolean {
        val action=activateMenu ?: return false
        action(metadata,pointerWasFocused);return true
    }
}
internal val LocalNativeAnchor = staticCompositionLocalOf<NativeAnchor?> { null }
internal class NativeFabMenuLayerEntry(
    val state: NativeFabMenuState,
    val content: State<@Composable ()->Unit>,
) {
    fun contains(point: androidx.compose.ui.geometry.Offset): Boolean {
        val c=state.coordinates ?: return false
        return c.isAttached && c.findRootCoordinates().localBoundingBoxOf(c,clipBounds=false).contains(point)
    }
}
internal class NativeAnchorRegistry {
    val anchors=mutableStateMapOf<String,NativeAnchor>()
    val menus=mutableStateListOf<NativeFabMenuLayerEntry>()
    var coordinates: LayoutCoordinates?=null
    var bounds by mutableStateOf(Rect.Zero)
    fun refresh() {
        coordinates?.takeIf { it.isAttached }?.let { bounds=it.findRootCoordinates().localBoundingBoxOf(it,clipBounds=false) }
        anchors.values.forEach { it.refreshBounds() }
    }
}
internal val LocalNativeAnchorRegistry = staticCompositionLocalOf<NativeAnchorRegistry?> { null }

/**
 * A nonmodal native coordinate and anchor scope for FAB menus. Author the anchor
 * and menu as separate AWCComponents, with the anchor's source `id` matching the
 * menu's `anchor`. The scope's bounds are the native viewport for auto placement.
 * Existing content keeps its own input and accessibility tree while a menu opens.
 */
@Composable
fun AWCFabMenuScope(modifier: Modifier=Modifier,content: @Composable ()->Unit) {
    val registry=remember { NativeAnchorRegistry() }
    val active=registry.menus.any { it.state.open }
    LaunchedEffect(active) {
        while(active && isActive) { withFrameNanos { };registry.refresh() }
    }
    CompositionLocalProvider(LocalNativeAnchorRegistry provides registry) {
        Box(modifier.onGloballyPositioned { registry.coordinates=it;registry.refresh() }
            .pointerInput(registry) {
                awaitEachGesture {
                    val down=awaitFirstDown(false,PointerEventPass.Initial)
                    var up: androidx.compose.ui.input.pointer.PointerInputChange?=null
                    while(up==null) {
                        val event=awaitPointerEvent(PointerEventPass.Final)
                        val change=event.changes.firstOrNull { it.id==down.id } ?: break
                        if(!change.pressed) { if(change.previousPressed) up=change;break }
                    }
                    val released=up ?: return@awaitEachGesture
                    registry.refresh()
                    val point=released.position+registry.bounds.topLeft
                    registry.menus.toList().filter { it.state.open }.forEach { entry ->
                        val anchor=registry.anchors[entry.state.props.str("anchor")]
                        if(!entry.contains(point) && anchor?.bounds?.contains(point)!=true) entry.state.close()
                    }
                }
            }) {
            content()
            // matchParentSize keeps the overlay out of normal-flow measurement.
            registry.menus.forEach { entry ->
                key(entry) { Box(Modifier.matchParentSize()) { entry.content.value() } }
            }
        }
    }
}

@Composable
internal fun rememberNativeAnchor(tag: String,properties: Props): NativeAnchor? {
    val registry=LocalNativeAnchorRegistry.current ?: return null
    val id=properties.str("id").takeUnless { it.isEmpty() } ?: return null
    val anchor=remember(registry,id,tag) { NativeAnchor(id,tag) }
    DisposableEffect(registry,anchor) {
        check(registry.anchors[id]==null || registry.anchors[id]===anchor) { "Native anchor IDs must be unique inside AWCFabMenuScope: $id" }
        registry.anchors[id]=anchor
        onDispose { if(registry.anchors[id]===anchor) registry.anchors.remove(id) }
    }
    return anchor
}
internal fun Modifier.nativeAnchorBounds(anchor: NativeAnchor?): Modifier =
    if(anchor==null) this else onGloballyPositioned { anchor.coordinates=it;anchor.refreshBounds() }
        .pointerInput(anchor) {
            awaitEachGesture {
                awaitFirstDown(false,PointerEventPass.Initial)
                anchor.pointerWasFocused=anchor.focus?.isFocused==true
                waitForUpOrCancellation()
            }
        }

internal fun KeyEvent.fabMenuKey(): String = when(key) {
    Key.DirectionUp->"ArrowUp";Key.DirectionDown->"ArrowDown";Key.MoveHome->"Home";Key.MoveEnd->"End"
    Key.Escape->"Escape";Key.Tab->"Tab"
    else->if(!isCtrlPressed && !isAltPressed && !isMetaPressed) {
        nativeKeyEvent.unicodeChar.takeIf { it>0 }?.let { String(Character.toChars(it)) }.orEmpty()
    } else ""
}
