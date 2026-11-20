package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/**
 * s7-20-01 / 9-30: a defaultExpanded md-accordion inside a real md-dialog and a real md-bottom-sheet. The first mdItemToggle of the connection
 * pass carries the items registered with index 0 and 1 and the first item expanded (Chrome: first expanded true index 0, second index 1).
 */
class NativeAccordionModalHostTest {
    @get:Rule val compose = createComposeRule()

    private fun first(host: String, page: Boolean = false): String {
        val controllers = List(2) { AWCAccordionItemController() }
        val events = mutableListOf<String>()
        fun snap() = org.json.JSONArray(controllers.mapIndexed { i, c -> JSONObject().put("id", i).put("expanded", c.isExpanded).put("index", c.index) }.sortedBy { it.getInt("index") }).toString()
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) { AWCTheme(false) { Box(Modifier.width(400.dp)) {
                @Composable fun acc() = AWCComponent("md-accordion", mapOf<String, AWCValue>("transition" to "none", "defaultExpanded" to "0")) { slot -> if (slot == "") {
                    for (i in 0..1) AWCAccordionItemControllerScope(controllers[i]) {
                        AWCComponent("md-accordion-item", mapOf<String, AWCValue>("headline" to "Item $i")) { if (it == "") Text("Body $i") } }
                } }
                AWCActionScope(onAction = { e -> if (e.name == "mdItemToggle") events += snap() }, id = "outer") {
                    if (page) AWCModalScope(Modifier.width(400.dp).height(500.dp), insets = WindowInsets(0.dp)) {
                        acc()
                        AWCComponent(host, mapOf<String, AWCValue>("open" to true, "headline" to "Host")) { hostSlot -> if (hostSlot == "") Text("Host body") }
                    }
                    else AWCComponent(host, mapOf<String, AWCValue>("open" to true, "headline" to "Host")) { hostSlot -> if (hostSlot == "") acc() }
                }
            } } }
        }
        compose.waitForIdle()
        AccordionEvidence.log("modal-host", JSONObject().put("host", host).put("page", page).put("events", events.size).put("first", events.firstOrNull() ?: "none").put("final", snap()))
        return events.firstOrNull() ?: "no mdItemToggle event"
    }

    private fun check(host: String, page: Boolean = false) {
        val f = org.json.JSONArray(first(host, page))
        // sorted by index: items carry index 0 and 1 (never -1) and the first is expanded at the first event
        assertEquals("$host items in first mdItemToggle: $f", 2, f.length())
        assertEquals("$host first index: $f", 0, f.getJSONObject(0).getInt("index"))
        assertEquals("$host second index: $f", 1, f.getJSONObject(1).getInt("index"))
        assertTrue("$host first item expanded: $f", f.getJSONObject(0).getBoolean("expanded"))
    }

    @Test fun dialogFirstToggleCarriesRegisteredItems() = check("md-dialog")
    @Test fun dialogScopePageAccordionFirstToggleCarriesRegisteredItems() = check("md-dialog", true)
    @Test fun bottomSheetScopePageAccordionFirstToggleCarriesRegisteredItems() = check("md-bottom-sheet", true)
    @Test fun bottomSheetFirstToggleCarriesRegisteredItems() = check("md-bottom-sheet")
}
