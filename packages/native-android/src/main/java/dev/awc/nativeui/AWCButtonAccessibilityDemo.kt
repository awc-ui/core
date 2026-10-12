@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/** Native hardware-keyboard traversal and collection semantics, using the public focus APIs. */
@Composable
fun AWCButtonAccessibilityDemo(properties: Map<String, AWCValue> = emptyMap(), onEvent: (String, AWCValue) -> Unit = { _, _ -> }) {
    var focus by remember { mutableStateOf("None") }
    var rtl by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf("Two") }
    val before = remember { AWCButtonFocusState() }
    val cell = remember { AWCButtonFocusState() }
    val appearance = properties + mapOf("size" to "sm", "loading" to false, "disabled" to false, "softDisabled" to false, "href" to "", "type" to "button", "roleOverride" to "", "groupTabindex" to null)
    fun changed(label: String): (Boolean) -> Unit = { focused ->
        if (focused) { focus = label; onEvent("mdFocus", mapOf("label" to label)) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Keyboard focus & native roles", style = MaterialTheme.typography.titleMedium)
        Text("Tab enters once; ←/→ wrap; Home/End jump. Enter/Space activates. Focus alone does not select.", style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Switch(rtl, { rtl = it }, Modifier.semantics { contentDescription = "Right to left" })
            Text("Right to left")
        }
        AWCButtonFocusScope(before, changed("Before")) { AWCComponent("md-button", appearance + mapOf("label" to "Before"), onEvent = onEvent) }
        CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
            AWCComponent("md-button-group", mapOf("selectionMode" to "single-select"), onEvent = { name, detail ->
                selected = ((detail as? Map<*, *>)?.get("values") as? List<*>)?.joinToString().orEmpty()
                onEvent(name, detail)
            }) {
                listOf("One", "Two", "Off", "Soft", "Busy").forEach { label ->
                    val handle = remember(label) { AWCButtonFocusState() }
                    AWCButtonFocusScope(handle, changed(label)) {
                        AWCComponent("md-button", appearance + mapOf("label" to label, "value" to label, "selected" to (label == "Two"), "toggle" to true,
                            "disabled" to (label == "Off"), "softDisabled" to (label == "Soft"), "loading" to (label == "Busy")), onEvent = onEvent)
                    }
                }
            }
        }
        val after = remember { AWCButtonFocusState() }
        AWCButtonFocusScope(after, changed("After")) { AWCComponent("md-button", appearance + mapOf("label" to "After"), onEvent = onEvent) }
        Text("Grid cell: selected, groupTabindex=-1", style = MaterialTheme.typography.bodySmall)
        AWCGridScope(rows = 1, columns = 1) {
            AWCGridCellScope(row = 0, column = 0) {
                AWCButtonFocusScope(cell, changed("Day 15")) {
                    AWCComponent("md-button", appearance + mapOf("label" to "Day 15", "roleOverride" to "gridcell", "groupTabindex" to -1, "selected" to true, "toggle" to false), onEvent = onEvent)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { before.requestFocus() }) { Text("Focus before") }
            Button(onClick = { cell.requestFocus() }) { Text("Focus cell") }
        }
        Text("Focused: $focus · Selected: $selected", style = MaterialTheme.typography.bodySmall)
        Text("Off is skipped. Soft/Busy keep focus but block activation. The cell stays touch/accessibility reachable.", style = MaterialTheme.typography.bodySmall)
    }
}
