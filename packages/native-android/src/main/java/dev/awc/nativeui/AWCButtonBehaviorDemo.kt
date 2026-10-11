@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Native playground fixture using the same public APIs available to applications. */
@Composable
fun AWCButtonBehaviorDemo(properties: Map<String, AWCValue> = emptyMap(), onEvent: (String, AWCValue) -> Unit = { _, _ -> }) {
    var cancel by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("Ready") }
    val form = rememberAWCFormState(
        onSubmit = { submission -> status = "Submitted"; onEvent("mdSubmit", mapOf("values" to submission.values, "submitter" to submission.submitter)) },
        onReset = { values -> status = "Reset"; onEvent("mdReset", mapOf("values" to values)) },
        onInvalid = { errors -> status = "Invalid"; onEvent("mdInvalid", mapOf("errors" to errors)) },
    )
    AWCFormScope(form) {
        val name = rememberAWCFormField("name", "Ada") { if (it?.toString().orEmpty().isBlank()) "Name is required" else null }
        val selection = rememberAWCFormField("selected", false)
        AWCActionScope(onAction = { event -> if (cancel) { event.preventDefault(); status = "Canceled" } }) {
            AWCNavigationScope(AWCURLRouter { request ->
                status = "Navigation intercepted"
                onEvent("mdNavigate", mapOf("url" to request.url, "target" to request.target))
                true
            }) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    AWCComponent("md-text-field", mapOf("label" to "Name", "value" to name.value, "required" to true,
                        "error" to (name.error != null), "errorText" to (name.error ?: "")), onEvent = { event, detail ->
                        if (event == "mdInput") name.value = detail
                        onEvent(event, detail)
                    })
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Switch(cancel, { cancel = it }, Modifier.semantics { contentDescription = "Cancel actions" })
                        Text("Cancel actions")
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val appearance = properties + mapOf("size" to "sm", "loading" to false, "disabled" to false, "softDisabled" to false)
                        AWCComponent("md-button", appearance + mapOf("label" to "Submit", "value" to "submit", "type" to "submit", "toggle" to false, "href" to ""), onEvent = onEvent)
                        AWCComponent("md-button", appearance + mapOf("label" to "Reset", "value" to "reset", "type" to "reset", "toggle" to false, "href" to ""), onEvent = onEvent)
                        AWCSlotsScope(AWCSlotRegistry(mapOf("leading-icon" to { Text("★") }))) {
                            AWCComponent("md-button", appearance + mapOf("label" to "Toggle", "value" to "toggle", "type" to "button", "toggle" to true, "selected" to selection.value, "href" to ""), onEvent = { event, detail ->
                                if (event == "mdChange") selection.value = (detail as? Map<*, *>)?.get("selected")
                                onEvent(event, detail)
                            })
                        }
                        AWCComponent("md-button", appearance + mapOf("label" to "Link", "value" to "link", "type" to "button", "toggle" to false, "href" to "https://example.com", "target" to "_blank"), onEvent = onEvent)
                    }
                    Text("Value: ${name.value}")
                    Text("Selected: ${selection.value}")
                    Text("Status: $status")
                }
            }
        }
    }
}
