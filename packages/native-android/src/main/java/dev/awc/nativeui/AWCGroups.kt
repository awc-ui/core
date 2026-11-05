@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp

internal class SelectionScope(val tag: String, props: Props, val focus: ButtonFocusGroup = ButtonFocusGroup(props.str("selectionMode", "single-select") == "single-select"), val parentButtonGroup: SelectionScope? = null, val emit: EventSink) {
    var props by mutableStateOf(props)
    private val depth: Int=(parentButtonGroup?.depth ?: -1)+1
    var syncRevision by mutableLongStateOf(-depth.toLong())
        private set
    fun updateProps(next: Props) {
        if(listOf("variant","size","shape","selectionMode","required").any { props[it]!=next[it] }) syncRevision=nextSyncRevision++
        props=next
    }
    private var hadDirectChildren=false
    fun updateDirectChildren(next: Set<Any>) {
        if(directChildren!=next) {
            if(hadDirectChildren) syncRevision=nextSyncRevision++
            directChildren=next;hadDirectChildren=true
        }
    }
    companion object { private var nextSyncRevision=1L }
    val states: androidx.compose.runtime.snapshots.SnapshotStateMap<Any,Boolean> = parentButtonGroup?.states ?: mutableStateMapOf<Any, Boolean>()
    private val values = linkedMapOf<Any, String>()
    private val registrations: MutableMap<Any,Int> = parentButtonGroup?.registrations ?: mutableMapOf()
    private var membership by mutableIntStateOf(0)
    val indices get(): List<Any> { membership; return values.keys.toList() }
    fun register(id: Any, value: String, selected: Boolean): Int {
        if(id !in values) { values[id] = value; registrations[id]=(registrations[id] ?: 0)+1; if(id !in states) states[id] = selected; membership++ }
        else if (values[id] != value) values[id] = value
        return indices.indexOf(id)
    }
    fun remove(id: Any) {
        if(values.remove(id)!=null) {
            membership++
            val remaining=(registrations[id] ?: 1)-1
            if(remaining<=0) { registrations.remove(id);states.remove(id) } else registrations[id]=remaining
        }
        childSizing.remove(id)
    }
    var directChildren by mutableStateOf<Set<Any>>(emptySet())
    val childSizing = mutableStateMapOf<Any,ButtonGroupSizing>()
    val motionEnabled = props.str("variant","standard")=="standard"
    var startMotion: (Any)->Unit = {}
    var motionJob: kotlinx.coroutines.Job? = null
    val motionOffsets = mutableStateMapOf<Any,Float>()
    var groupAction: ((Map<String,AWCValue>,AWCActivationMetadata)->Unit)? = null
    private var previousValues: List<String>? = null
    fun seedPreviousValues() { if(previousValues==null) previousValues=selectedValues() }
    fun reorder(order: List<Any>) {
        val existing=indices
        val next=order.filter { it in values }+existing.filter { it !in order }
        if(existing==next) return
        val snapshot=next.associateWith { values.getValue(it) }
        values.clear();values.putAll(snapshot);membership++
        focus.reorder(next)
    }
    fun selectedValues(): List<String> = values.filterKeys { states[it] == true }.values.toList()
    /** Source group click runs after the child's mdChange and default action. */
    fun reconcileButtonClick(id: Any, previous: List<String> = previousValues.orEmpty(), activation: AWCActivationMetadata = AWCActivationMetadata()) {
        if (props.str("selectionMode", "single-select") == "single-select") indices.filter { it != id }.forEach { states[it] = false }
        if (props.bool("required") && indices.none { states[it]==true }) states[id] = true
        focus.focused(id)
        val next = selectedValues()
        previousValues=next
        val detail=mapOf("values" to next,"added" to (next-previous.toSet()),"removed" to (previous-next.toSet()))
        groupAction?.invoke(detail,activation) ?: emit("mdSelectionChange",detail)
    }
    fun toggle(id: Any): Boolean {
        if(tag == "md-button-group") focus.focused(id)
        val previous = values.filterKeys { states[it] == true }.values.toList()
        val current = states[id] == true
        val multi = when(tag) { "md-segmented-button-set" -> props.bool("multiselect"); else -> props.str("selectionMode", if(tag == "md-button-group") "single-select" else "none") == "multi-select" }
        val required = props.bool("required") || (tag == "md-segmented-button-set" && !multi) || (tag == "md-list" && !multi)
        if(current && required && states.values.count { it } <= 1) return true
        if(!multi && !current) states.keys.toList().forEach { states[it] = false }
        states[id] = !current
        val next = values.filterKeys { states[it] == true }.values.toList()
        val index = indices.indexOf(id)
        when(tag) {
            "md-button-group" -> emit("mdSelectionChange", mapOf("values" to next, "added" to (next - previous.toSet()), "removed" to (previous - next.toSet())))
            "md-segmented-button-set" -> emit("mdChange", next)
            "md-list" -> emit("mdSelect", mapOf("index" to index, "selected" to !current, "value" to values[id]))
        }
        return states[id] == true
    }
}
internal val LocalSelection = compositionLocalOf<SelectionScope?> { null }
internal val LocalButtonGroupAncestors = compositionLocalOf<List<SelectionScope>> { emptyList() }

@Composable internal fun SelectionContainer(tag: String, p: Props, emit: EventSink, slot: Slot?) {
    val latest by rememberUpdatedState(emit)
    val ancestors=LocalButtonGroupAncestors.current
    val focus = remember(tag) { ButtonFocusGroup(p.str("selectionMode", "single-select") == "single-select") }
    SideEffect { focus.updateSelectionMode(p.str("selectionMode", "single-select") == "single-select") }
    val scope = remember(tag,if(tag=="md-button-group") ancestors.lastOrNull() else null) { SelectionScope(tag, p, focus, if(tag=="md-button-group") ancestors.lastOrNull() else null) { name, value -> latest(name, value) } }
    SideEffect { scope.updateProps(p) }
    CompositionLocalProvider(LocalSelection provides scope,LocalButtonGroupAncestors provides if(tag=="md-button-group") ancestors+scope else ancestors) {
        when(tag) {
            "md-button-group" -> NativeButtonGroup(scope,slot)
            "md-segmented-button-set" -> FlowRow(modifier = (if(p.bool("fullWidth")) Modifier.fillMaxWidth() else Modifier).then(if(tag == "md-button-group") Modifier.selectableGroup().semantics { collectionInfo = CollectionInfo(1, scope.focus.count) } else Modifier), horizontalArrangement = Arrangement.spacedBy(if (tag == "md-button-group" && p.str("variant") == "connected") 2.dp else 4.dp)) { slot?.invoke("") }
            else -> Column(verticalArrangement = Arrangement.spacedBy(if(p.str("listStyle") == "segmented") 8.dp else 4.dp)) { if(tag == "md-list" && p.label().isNotEmpty()) Text(p.label(), style = MaterialTheme.typography.labelLarge); slot?.invoke("") }
        }
    }
}
