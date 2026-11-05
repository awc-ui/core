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
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test

/**
 * Measurement probe (records, does not assert): panel heights of a default-expanded item in
 * the first frames after the group enters composition. Documents whether a transient
 * closed frame is presented before the owner's connection commits the source selection.
 */
class NativeAccordionFirstFrameProbe {
    @get:Rule val compose=createComposeRule()
    @Test fun probeFirstFramesOfDefaultExpandedItem() {
        val collector=AWCInspectionCollector()
        compose.mainClock.autoAdvance=false
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { run { Box(Modifier.width(400.dp)) {
            AWCInspectionScope(collector) { AWCComponent("md-accordion",mapOf("defaultExpanded" to "0")) { slot-> if(slot=="") {
                AWCComponent("md-accordion-item",mapOf("headline" to "One")) { if(it=="") Text("Body") }
                AWCComponent("md-accordion-item",mapOf("headline" to "Two")) { if(it=="") Text("Body") }
            } } }
        } } } } }
        val heights=JSONArray()
        repeat(4) { heights.put(compose.runOnIdle { collector.snapshot().nodes.singleOrNull { it.id=="component.item-0.panel" }?.bounds?.height ?: -1.0 });compose.mainClock.advanceTimeByFrame() }
        AccordionEvidence.log("first-frame-probe",JSONObject().put("panelHeightsByFrame",heights))
    }
}
