package dev.awc.nativeui

import androidx.compose.animation.core.withInfiniteAnimationFrameNanos
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.*
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.geometry.Offset
import kotlinx.coroutines.isActive

internal class NativeTooltipEntry(val state:NativeTooltipState,val content:State<@Composable ()->Unit>) {
    var coordinates:LayoutCoordinates?=null
    var bounds by mutableStateOf(Rect.Zero)
    var popupCoordinates:LayoutCoordinates?=null
    var popupBounds=Rect.Zero
    var anchorHovered=false;var popupHovered=false
    fun refresh() {
        coordinates?.takeIf { it.isAttached }?.let { bounds=it.findRootCoordinates().localBoundingBoxOf(it,clipBounds=false) }
        popupCoordinates?.takeIf { it.isAttached }?.let { popupBounds=it.findRootCoordinates().localBoundingBoxOf(it,clipBounds=false) }
    }
    fun hover(point:Offset?) {
        val anchor=point!=null && bounds.contains(point)
        val popup=point!=null && state.visible && popupBounds.contains(point)
        if(anchor!=anchorHovered) { anchorHovered=anchor;if(anchor) state.triggerEnter() else state.triggerLeave() }
        if(popup!=popupHovered) { popupHovered=popup;if(popup) state.popupEnter() else state.popupLeave() }
    }
}
internal class NativeTooltipRegistry {
    val entries=mutableStateListOf<NativeTooltipEntry>()
    var coordinates:LayoutCoordinates?=null
    var bounds by mutableStateOf(Rect.Zero)
    fun refresh() {
        coordinates?.takeIf { it.isAttached }?.let { bounds=it.findRootCoordinates().localBoundingBoxOf(it,clipBounds=false) }
        entries.forEach { it.refresh() }
    }
    fun escape():Boolean {
        var handled=false
        entries.toList().forEach { if(it.state.escape()) handled=true }
        return handled
    }
}
internal val LocalNativeTooltipRegistry=staticCompositionLocalOf<NativeTooltipRegistry?> { null }

/** A viewport overlay: anchors retain their natural flow size, while tooltip
 * surfaces escape their parents' clipping and track actual native coordinates.
 * Place the scope at the viewport boundary, outside clipped/scrolling content. */
@Composable fun AWCTooltipScope(modifier:Modifier=Modifier,content:@Composable ()->Unit) {
    val registry=remember { NativeTooltipRegistry() }
    val active=registry.entries.any { it.state.visible }
    LaunchedEffect(active) { while(active && isActive) { withInfiniteAnimationFrameNanos { };registry.refresh() } }
    NativeWindowKeys { it.action==android.view.KeyEvent.ACTION_DOWN && it.keyCode==android.view.KeyEvent.KEYCODE_ESCAPE && registry.escape() }
    CompositionLocalProvider(LocalNativeTooltipRegistry provides registry) {
        Box(modifier.pointerInput(registry) {
            awaitPointerEventScope { while(true) {
                val event=awaitPointerEvent(PointerEventPass.Initial)
                val mouse=event.changes.firstOrNull { it.type==PointerType.Mouse }
                if(mouse!=null) {
                    registry.refresh()
                    val point=if(event.type==PointerEventType.Exit) null else mouse.position+registry.bounds.topLeft
                    registry.entries.toList().forEach { it.hover(point) }
                }
            } }
        }.onPreviewKeyEvent { it.type==KeyEventType.KeyDown && it.key==Key.Escape && registry.escape() }.onGloballyPositioned { registry.coordinates=it;registry.refresh() }) {
            content()
            registry.entries.forEach { entry->key(entry) { Box(Modifier.matchParentSize()) { entry.content.value() } } }
        }
    }
}
