package dev.awc.nativeui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.KeyEvent
import android.view.View
import android.view.ViewParent
import android.view.Window
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.window.DialogWindowProvider

/** Window-wide source listeners must also work when no Compose child is focused.
 * This does not claim focus or replace the developer's existing window callback. */
@Composable internal fun NativeWindowKeys(handler:(KeyEvent)->Boolean) {
    val view=LocalView.current
    val latest=rememberUpdatedState(handler)
    val window=remember(view) { nativeWindow(view) }
    DisposableEffect(window) {
        val identity=Any()
        val entry=window?.let { owner->
            val callback=(owner.callback as? NativeWindowKeyCallback)
                ?: NativeWindowKeyCallback(owner.callback).also { owner.callback=it }
            callback.listeners[identity]={ latest.value(it) };callback
        }
        onDispose {
            entry?.listeners?.remove(identity)
            if(window!=null && entry!=null && entry.listeners.isEmpty() && window.callback===entry) window.callback=entry.delegate
        }
    }
}
private class NativeWindowKeyCallback(val delegate:Window.Callback):Window.Callback by delegate {
    val listeners=linkedMapOf<Any,(KeyEvent)->Boolean>()
    override fun dispatchKeyEvent(event:KeyEvent):Boolean {
        var handled=false
        listeners.values.toList().forEach { if(it(event)) handled=true }
        return handled || delegate.dispatchKeyEvent(event)
    }
}
private fun nativeWindow(view:View):Window? {
    var parent:ViewParent?=view.parent
    while(parent!=null) {
        if(parent is DialogWindowProvider) return parent.window
        parent=parent.parent
    }
    var context:Context?=view.context
    while(context!=null) {
        if(context is Activity) return context.window
        context=(context as? ContextWrapper)?.baseContext?.takeUnless { it===context }
    }
    return null
}
