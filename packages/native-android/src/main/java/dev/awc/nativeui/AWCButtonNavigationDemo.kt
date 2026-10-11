@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Local native navigation and event demo; no URL is opened externally or fetched. */
@Composable
fun AWCButtonNavigationDemo(properties: Map<String, AWCValue> = emptyMap(), onEvent: (String, AWCValue) -> Unit = { _, _ -> }) {
    var cancel by remember { mutableStateOf(false) }
    var stop by remember { mutableStateOf(false) }
    var immediate by remember { mutableStateOf(false) }
    var reject by remember { mutableStateOf(false) }
    var target by remember { mutableStateOf("_self") }
    var status by remember { mutableStateOf("Ready") }
    var trace by remember { mutableStateOf(emptyList<String>()) }
    val coordinator = rememberAWCNavigationCoordinator("https://awc.local/demo/", shouldNavigate = {
        if (reject) { status = "Navigation rejected"; false } else true
    }, onPresent = {
        status = if (it.kind == "back") "Went back" else "Navigated"
        onEvent("mdNavigate", mapOf("url" to it.url, "target" to it.target, "contextID" to it.contextID, "newContext" to it.createsContext, "kind" to it.kind))
    })
    val source = remember(coordinator) {
        val section = coordinator.createContext("section", coordinator.rootContextID)
        coordinator.createContext("editor", section.id).also { coordinator.activate(it.id) }
    }
    fun record(event: AWCActionEvent, label: String) {
        if (event.name != "mdClick") return
        if (label == "outer:capture") trace = emptyList()
        trace = (trace + label).takeLast(8)
        onEvent("mdEventPhase", mapOf("phase" to event.phase.name.lowercase(), "scope" to event.currentScopeID, "targetID" to event.targetID, "path" to event.path, "cancelable" to event.cancelable, "label" to label, "origin" to event.activation.source))
    }
    val appearance = properties + mapOf("size" to "sm", "loading" to false, "disabled" to false, "softDisabled" to false, "type" to "button", "toggle" to false)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Local navigation & event phases", style = MaterialTheme.typography.titleMedium)
        Text("Target", style = MaterialTheme.typography.bodySmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf("_self", "_blank", "_parent", "_top", "report").forEach { value ->
                FilterChip(selected = target == value, onClick = { target = value }, label = { Text(value) })
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            DemoEventSwitch("Cancel default", cancel) { cancel = it }
            DemoEventSwitch("Stop bubble", stop) { stop = it }
            DemoEventSwitch("Stop immediate", immediate) { immediate = it }
            DemoEventSwitch("Reject navigation", reject) { reject = it }
        }
        AWCNavigationScope(coordinator, source.id) {
            AWCActionScope(id = "outer", onCapture = { record(it, "outer:capture") }, onAction = { record(it, "outer:bubble") }) {
                AWCActionScope(id = "inner", onCapture = { record(it, "inner:capture") }, onAction = { record(it, "inner:bubble") }) {
                    AWCActionTargetScope(id = "navigation-button", onAction = {
                        record(it, "button:target")
                        if (it.name == "mdClick") {
                            if (cancel) { it.preventDefault(); status = "Default canceled" }
                            if (stop) it.stopPropagation()
                            if (immediate) it.stopImmediatePropagation()
                        }
                    }, listeners = listOf({ record(it, "button:second") })) {
                        AWCComponent("md-button", appearance + mapOf("label" to "Navigate", "href" to "next", "target" to target), onEvent = onEvent)
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { coordinator.back() }, enabled = coordinator.activeContext.canGoBack) { Text("Back") }
            Text("Contexts: ${coordinator.contexts.size}", style = MaterialTheme.typography.bodySmall)
        }
        Text("Source: editor · Current: ${coordinator.activeContext.name ?: if (coordinator.activeContextID == coordinator.rootContextID) "root" else "new context"}")
        Text(coordinator.activeContext.currentURL, style = MaterialTheme.typography.bodySmall)
        Text("History: ${coordinator.activeContext.index + 1}/${coordinator.activeContext.history.size} · Status: $status", style = MaterialTheme.typography.bodySmall)
        Text("Path: ${trace.joinToString(" → ")}", style = MaterialTheme.typography.bodySmall)
        Text("Local contexts only; no page is opened.", style = MaterialTheme.typography.bodySmall)
    }
}

@Composable private fun DemoEventSwitch(label: String, checked: Boolean, change: (Boolean) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Switch(checked, change, Modifier.semantics { contentDescription = label })
        Text(label, style = MaterialTheme.typography.bodySmall)
    }
}
