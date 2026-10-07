package dev.awc.playground

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.junit4.createComposeRule
import dev.awc.nativeui.*
import dev.awc.nativeui.generated.AWCNativeCatalog
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Run on an emulator/device: ./gradlew :app:connectedDebugAndroidTest */
class NativeInteractionTest {
    @get:Rule val compose = createComposeRule()

    @Test fun everySourceTagComposesNatively() {
        var tag by mutableStateOf(AWCNativeCatalog.tags.first())
        compose.setContent { AWCTheme { key(tag) { AWCComponent(tag, AWCNativeCatalog.defaults[tag].orEmpty() + fixture(tag)) { SampleSlot(tag, it) { _, _ -> } } } } }
        AWCNativeCatalog.tags.forEach { next -> compose.runOnIdle { tag = next }; compose.waitForIdle() }
    }

    @Test fun genericProgressUsesSourceDefaultMaximum() {
        compose.setContent { AWCTheme { AWCComponent("md-progress-indicator", mapOf("value" to 50)) } }
        compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo)).assert(SemanticsMatcher.expectValue(SemanticsProperties.ProgressBarRangeInfo, ProgressBarRangeInfo(.5f, 0f..1f)))
    }

    @Test fun buttonToggleEmitsSelectedValue() {
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { AWCTheme { AWCComponent("md-button", mapOf("toggle" to true, "value" to "save"), onEvent = { name, value -> events += name to value }) { if(it == "") Text("Save") } } }
        compose.onNodeWithText("Save").performClick()
        compose.runOnIdle { val detail = events.last { it.first == "mdChange" }.second as Map<*, *>; assertEquals(true, detail["selected"]); assertEquals("save", detail["value"]) }
    }

    @Test fun textInputEmitsTheTypedSourceValue() {
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { AWCTheme { AWCComponent("md-text-field", mapOf("label" to "Name", "value" to ""), onEvent = { name, value -> events += name to value }) } }
        compose.onNode(hasSetTextAction()).performTextInput("Android")
        compose.runOnIdle { assertEquals("Android", events.last { it.first == "mdInput" }.second) }
    }

    @Test fun segmentedSetCoordinatesSelectionAndContainerEvent() {
        val values = mutableListOf<AWCValue>()
        compose.setContent { AWCTheme { AWCComponent("md-segmented-button-set", onEvent = { name, value -> if(name == "mdChange") values += value }) {
            if(it == "") { AWCComponent("md-segmented-button", mapOf("label" to "Day", "value" to "day")); AWCComponent("md-segmented-button", mapOf("label" to "Week", "value" to "week")) }
        } } }
        compose.onNodeWithText("Day").performClick()
        compose.onNodeWithText("Week").performClick()
        compose.runOnIdle { assertEquals(listOf("week"), values.last()) }
        compose.onNodeWithText("Day").assertIsNotSelected()
        compose.onNodeWithText("Week").assertIsSelected()
    }

    @Test fun checkboxEmitsSourcePayloadAndFollowsExternalUpdate() {
        var external by mutableStateOf(false)
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { MaterialTheme { AWCComponent("md-checkbox", mapOf("checked" to external), onEvent = { name, value -> events += name to value }) } }
        compose.onNode(isToggleable()).assertIsOff().performClick().assertIsOn()
        compose.runOnIdle { assertEquals("mdChange", events.last().first); assertEquals(true, (events.last().second as Map<*, *>)["checked"]); external = true }
        compose.runOnIdle { external = false }
        compose.onNode(isToggleable()).assertIsOff()
    }

    @Test fun transferMoveUsesActualItemsAndPreservesDisabledRows() {
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { MaterialTheme { AWCComponent("md-transfer-list", fixture("md-transfer-list"), onEvent = { name, value -> events += name to value }) } }
        compose.onNodeWithContentDescription("Move all to target").performClick()
        compose.runOnIdle {
            val targets = events.last { it.first == "mdChange" }.second as List<*>
            assertTrue(targets.contains("engineering")); assertFalse(targets.contains("archived"))
        }
    }
}
