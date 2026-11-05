package dev.awc.nativeui

import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier

/** Actual authored text used by native controls that need searchable slot content. */
internal class AWCSlotTextRegistry {
    private val strings=mutableStateMapOf<Any,String>()
    private val order=mutableStateListOf<Any>()
    val hasEntries:Boolean get()=order.isNotEmpty()
    val text: String get() = order.joinToString("") { strings[it].orEmpty() }
    fun update(identity: Any,text: String) {
        if(identity !in order) order+=identity
        if(strings[identity]!=text) strings[identity]=text
    }
    fun remove(identity: Any) { strings.remove(identity);order.remove(identity) }
}
internal val LocalAWCSourceText=staticCompositionLocalOf { false }
internal val LocalAWCSlotTextNoWrap=staticCompositionLocalOf { false }
internal fun awcCollapsedWhitespace(value:String)=value.replace(Regex("[ \t\r\n\u000C]+")," ").trim(' ')
internal val LocalAWCSlotTextRegistry = staticCompositionLocalOf<AWCSlotTextRegistry?> { null }

/**
 * Native text for a source string slot. Besides rendering Text, it exposes the
 * actual string to an enclosing control's typeahead implementation. An arbitrary
 * Compose content lambda has no DOM textContent to query.
 */
@Composable
fun AWCSlotText(text: String, modifier: Modifier = Modifier) {
    val nowrap=LocalAWCSlotTextNoWrap.current
    AWCSearchableLabelScope(text) {
        val visible=if(nowrap) awcCollapsedWhitespace(text) else text
        if(visible.isNotEmpty() || !nowrap) {
            if(LocalAWCSourceText.current) NativeSourceText(visible,androidx.compose.material3.LocalTextStyle.current,modifier,wrap=!nowrap)
            else Text(visible,modifier,softWrap=!nowrap,maxLines=if(nowrap) 1 else Int.MAX_VALUE)
        }
    }
}

/** Supply the searchable name of custom label content without altering its UI. */
@Composable
fun AWCSearchableLabelScope(label: String, content: @Composable () -> Unit) {
    val registry=LocalAWCSlotTextRegistry.current
    val identity=remember { Any() }
    SideEffect { registry?.update(identity,label) }
    DisposableEffect(registry,identity) { onDispose { registry?.remove(identity) } }
    CompositionLocalProvider(LocalAWCSlotTextRegistry provides null,content=content)
}
