package dev.awc.nativeui

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.*
import androidx.compose.ui.zIndex

internal class NativeSnackbarEntry(val state:NativeSnackbarState,val content:State<@Composable ()->Unit>)
internal class NativeSnackbarRegistry {
    val entries=mutableStateListOf<NativeSnackbarEntry>()
    fun raise(state:NativeSnackbarState) {
        val peers=entries.filter { it.state!==state && it.state.open }.sortedBy { it.state.rank }
        peers.forEachIndexed { i,entry->entry.state.rank=i+1 }
        state.rank=peers.size+1
    }
    fun escape():Boolean {
        var handled=false
        // Every source snackbar has its own window listener, not only the top.
        entries.forEach { if(it.state.escape()) handled=true }
        return handled
    }
}
internal val LocalNativeSnackbarRegistry=staticCompositionLocalOf<NativeSnackbarRegistry?> { null }

/** Actual native overlay viewport. Snackbar declarations occupy no normal-flow
 * space; content determines this scope's size and open peers paint by open order. */
@Composable fun AWCSnackbarScope(modifier:Modifier=Modifier,content:@Composable ()->Unit) {
    val registry=remember { NativeSnackbarRegistry() }
    NativeWindowKeys { it.action==android.view.KeyEvent.ACTION_DOWN && it.keyCode==android.view.KeyEvent.KEYCODE_ESCAPE && registry.escape() }
    CompositionLocalProvider(LocalNativeSnackbarRegistry provides registry) {
        Box(modifier.onPreviewKeyEvent {
            it.type==KeyEventType.KeyDown && it.key==Key.Escape && registry.escape()
        }) {
            content()
            registry.entries.forEach { entry->key(entry) {
                Box(Modifier.matchParentSize().zIndex(entry.state.rank.toFloat())) { entry.content.value() }
            } }
        }
    }
}
