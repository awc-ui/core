@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp

internal class SelectionScope(val tag: String, val props: Props, val focus: ButtonFocusGroup = ButtonFocusGroup(props.str("selectionMode", "single-select") == "single-select"), val emit: EventSink) {
    val states = mutableStateMapOf<Any, Boolean>()
    private val values = linkedMapOf<Any, String>()
    val indices get() = values.keys.toList()
    fun register(id: Any, value: String, selected: Boolean): Int {
        if(id !in values) { values[id] = value; states[id] = selected }
        return indices.indexOf(id)
    }
    fun remove(id: Any) { values.remove(id); states.remove(id) }
    fun toggle(id: Any): Boolean {
        if(tag == "md-button-group") focus.focused(id)
        val previous = values.filterKeys { states[it] == true }.values.toList()
        val current = states[id] == true
        val multi = when(tag) { "md-segmented-button-set" -> props.bool("multiselect"); "md-accordion" -> !props.bool("exclusive"); else -> props.str("selectionMode", if(tag == "md-button-group") "single-select" else "none") == "multi-select" }
        val required = props.bool("required") || props.bool("keepOneExpanded") || (tag == "md-segmented-button-set" && !multi) || (tag == "md-list" && !multi)
        if(current && required && states.values.count { it } <= 1) return true
        if(!multi && !current) states.keys.toList().forEach { states[it] = false }
        states[id] = !current
        val next = values.filterKeys { states[it] == true }.values.toList()
        val index = indices.indexOf(id)
        when(tag) {
            "md-button-group" -> emit("mdSelectionChange", mapOf("values" to next, "added" to (next - previous.toSet()), "removed" to (previous - next.toSet())))
            "md-segmented-button-set" -> emit("mdChange", next)
            "md-accordion" -> emit("mdToggle", mapOf("index" to index, "expanded" to !current, "expandedIndices" to indices.mapIndexedNotNull { i, key -> if(states[key] == true) i else null }))
            "md-list" -> emit("mdSelect", mapOf("index" to index, "selected" to !current, "value" to values[id]))
        }
        return states[id] == true
    }
}
internal val LocalSelection = compositionLocalOf<SelectionScope?> { null }

@Composable internal fun SelectionContainer(tag: String, p: Props, emit: EventSink, slot: Slot?) {
    val latest by rememberUpdatedState(emit)
    val focus = remember(tag) { ButtonFocusGroup(p.str("selectionMode", "single-select") == "single-select") }
    SideEffect { focus.updateSelectionMode(p.str("selectionMode", "single-select") == "single-select") }
    val scope = remember(tag, p) { SelectionScope(tag, p, focus) { name, value -> latest(name, value) } }
    CompositionLocalProvider(LocalSelection provides scope) {
        when(tag) {
            "md-button-group", "md-segmented-button-set" -> FlowRow(modifier = (if(p.bool("fullWidth")) Modifier.fillMaxWidth() else Modifier).then(if(tag == "md-button-group") Modifier.selectableGroup().semantics { collectionInfo = CollectionInfo(1, scope.focus.count) } else Modifier), horizontalArrangement = Arrangement.spacedBy(4.dp)) { slot?.invoke("") }
            else -> Column(verticalArrangement = Arrangement.spacedBy(if(p.str("listStyle") == "segmented") 8.dp else 4.dp)) { if(tag == "md-list" && p.label().isNotEmpty()) Text(p.label(), style = MaterialTheme.typography.labelLarge); slot?.invoke("") }
        }
    }
}
