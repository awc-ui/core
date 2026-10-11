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
    var cancelForm by remember { mutableStateOf(false) }
    var encoded by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf(false) }
    val form = rememberAWCFormState(
        onSubmit = { submission -> status = "Submitted"; encoded = submission.encoded; onEvent("mdSubmit", mapOf("values" to submission.values, "entries" to submission.entries.map { mapOf("name" to it.name, "value" to it.value) }, "encoded" to submission.encoded)) },
        onReset = { values -> status = "Reset"; encoded = ""; selected = false; onEvent("mdReset", mapOf("values" to values)) },
        onInvalid = { errors -> status = "Invalid"; onEvent("mdInvalid", mapOf("errors" to errors)) },
        onSubmitEvent = { if (cancelForm) { it.preventDefault(); status = "Submit canceled"; onEvent("mdFormCanceled", mapOf("action" to "submit")) } },
        onResetEvent = { if (cancelForm) { it.preventDefault(); status = "Reset canceled"; onEvent("mdFormCanceled", mapOf("action" to "reset")) } },
    )
    AWCFormScope(form) {
        AWCActionScope(onAction = { event -> if (cancel) { event.preventDefault(); status = "Canceled" } }) {
            AWCNavigationScope(AWCURLRouter { request ->
                status = "Navigation intercepted"
                onEvent("mdNavigate", mapOf("url" to request.url, "target" to request.target))
                true
            }) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    AWCComponent("md-text-field", mapOf("label" to "Name", "name" to "name", "value" to "Ada", "required" to true, "minLength" to 2, "maxLength" to 40), onEvent = onEvent)
                    Text("Enter submits this form", style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Switch(cancel, { cancel = it }, Modifier.semantics { contentDescription = "Cancel actions" })
                        Text("Cancel actions")
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Switch(cancelForm, { cancelForm = it }, Modifier.semantics { contentDescription = "Cancel form events" })
                        Text("Cancel form events")
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val appearance = properties + mapOf("size" to "sm", "loading" to false, "disabled" to false, "softDisabled" to false)
                        AWCComponent("md-button", appearance + mapOf("label" to "Submit", "value" to "submit", "type" to "submit", "toggle" to false, "href" to ""), onEvent = onEvent)
                        AWCComponent("md-button", appearance + mapOf("label" to "Reset", "value" to "reset", "type" to "reset", "toggle" to false, "href" to ""), onEvent = onEvent)
                        AWCSlotsScope(AWCSlotRegistry(mapOf("leading-icon" to { Text("★") }))) {
                            AWCComponent("md-button", appearance + mapOf("label" to "Toggle", "value" to "toggle", "type" to "button", "toggle" to true, "selected" to selected, "href" to ""), onEvent = { event, detail ->
                                if (event == "mdChange") selected = (detail as? Map<*, *>)?.get("selected") == true
                                onEvent(event, detail)
                            })
                        }
                        AWCComponent("md-button", appearance + mapOf("label" to "Link", "value" to "link", "type" to "button", "toggle" to false, "href" to "https://example.com", "target" to "_blank"), onEvent = onEvent)
                    }
                    Text("Value: ${form.values["name"].orEmptyText()}")
                    Text("Selected: $selected")
                    Text("Status: $status")
                    if (encoded.isNotEmpty()) Text("Last submitted data: $encoded", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

private fun AWCValue.orEmptyText(): String = this?.toString().orEmpty()
