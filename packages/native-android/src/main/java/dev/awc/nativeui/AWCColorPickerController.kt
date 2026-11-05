package dev.awc.nativeui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf

/** md-color-picker's methods for a mounted picker (`show()` / `close()`, the source's popover methods). As in the source, both
 *  act on a popover picker only and `show()` does nothing while it is disabled; each emits `mdOpenChange` through the
 *  picker's `open` property, and `close()` returns focus that was inside the popover to the trigger. */
class AWCColorPickerController {
    internal var runtime: AWCColorPickerRuntime? = null
    internal var showAction: () -> Unit = {}
    internal var closeAction: () -> Unit = {}
    /** A picker is mounted and attached. */
    val isConnected get() = runtime != null
    /** The popover is open (the picker's `open` as last composed). */
    val isOpen get() = runtime?.open ?: false
    fun show() = showAction()
    fun close() = closeAction()
}
internal val LocalAWCColorPickerController = staticCompositionLocalOf<AWCColorPickerController?> { null }
/** Binds `controller` to the md-color-picker(s) below. */
@Composable fun AWCColorPickerControllerScope(controller: AWCColorPickerController, content: @Composable () -> Unit) =
    CompositionLocalProvider(LocalAWCColorPickerController provides controller, content = content)
