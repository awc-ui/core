package dev.awc.playground

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.awc.nativeui.AWCComponent
import dev.awc.nativeui.AWCTheme
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Uses only a Compose test surface; never opens or replaces the live-preview listener. */
class LivePreviewTextTest {
    @get:Rule val compose = createComposeRule()

    @Test fun validatesOptionalLiteralTextByUtf8Bytes() {
        fun parse(value: Any) = parseLivePreviewButtonText(JSONObject().put("text", value), "md-button")
        assertNull(parseLivePreviewButtonText(JSONObject(), "md-button"))
        assertEquals("", parse(""))
        assertEquals("Salut 👋 <b>&</b>", parse("Salut 👋 <b>&</b>"))
        assertEquals("x".repeat(4096), parse("x".repeat(4096)))
        assertEquals("👋".repeat(1024), parse("👋".repeat(1024)))
        assertThrows(IllegalArgumentException::class.java) { parse("x".repeat(4097)) }
        assertThrows(IllegalArgumentException::class.java) { parse("👋".repeat(1025)) }
        assertThrows(IllegalArgumentException::class.java) { parse(JSONObject.NULL) }
        assertThrows(IllegalArgumentException::class.java) { parse(123) }
        assertThrows(IllegalArgumentException::class.java) { parse(true) }
        assertThrows(IllegalArgumentException::class.java) { parseLivePreviewButtonText(JSONObject().put("text", "Label"), "md-checkbox") }
    }

    @Test fun literalAndEmptyDefaultSlotOverridesDoNotFallBackToContinue() {
        var text by mutableStateOf<String?>(null)
        compose.setContent { AWCTheme {
            AWCComponent("md-button", fixture("md-button")) { slot -> LivePreviewSampleSlot("md-button", slot, "", text) { _, _ -> } }
        } }
        compose.onNodeWithText("Continue").assertExists()
        compose.runOnIdle { text = "Salut 👋 <b>&</b>" }
        compose.onNodeWithText("Salut 👋 <b>&</b>").assertExists()
        compose.onNodeWithText("Continue").assertDoesNotExist()
        compose.runOnIdle { text = "" }
        compose.onNodeWithText("Continue").assertDoesNotExist()
        compose.onNodeWithText("Salut 👋 <b>&</b>").assertDoesNotExist()
    }

    @Test fun namedSlotsAndScenarioContentKeepTheirExistingContent() {
        compose.setContent { AWCTheme { Column {
            LivePreviewSampleSlot("md-button", "actions", "", "Replacement") { _, _ -> }
            LivePreviewSampleSlot("md-button", "", "button-behavior", "Replacement") { _, _ -> }
        } } }
        compose.onNodeWithText("Learn more").assertExists()
        compose.onNodeWithText("Continue").assertExists()
        compose.onNodeWithText("Replacement").assertDoesNotExist()
    }
}
