@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativePreviewPresentationTest {
    @get:Rule val compose = createComposeRule()

    @Test fun dialogIsCapturedInRootAndClosesThroughRealNativeAction() {
        val events = mutableListOf<String>()
        compose.setContent { AWCTheme { AWCPreviewScope(Modifier.width(360.dp)) {
            AWCComponent("md-dialog", mapOf("headline" to "Preview dialog"), onEvent = { name, _ -> events += name }) { slot ->
                if(slot.isEmpty()) Column { Box(Modifier.size(32.dp).background(Color.Magenta)); Text("Actual dialog content") }
            }
        } } }
        compose.onNodeWithText("Open dialog").performClick()
        compose.onNodeWithText("Actual dialog content").assertIsDisplayed()
        compose.onAllNodes(isDialog()).assertCountEquals(0)
        val pixels = compose.onRoot().captureToImage().toPixelMap()
        var marker = 0
        for(y in 0 until pixels.height) for(x in 0 until pixels.width) {
            val c = pixels[x,y]; if(c.red > .98f && c.blue > .98f && c.green < .02f) marker++
        }
        assertTrue("The single captured root includes the dialog content", marker > 100)
        compose.onNodeWithText("OK").performClick()
        compose.onNodeWithText("Actual dialog content").assertDoesNotExist()
        compose.onNodeWithText("Open dialog").assertIsDisplayed()
        assertEquals(listOf("mdOpen", "mdClose"), events)
    }

    @Test fun normalProductionDialogStillUsesItsPlatformWindow() {
        compose.setContent { AWCTheme { AWCComponent("md-dialog", mapOf("open" to true, "headline" to "Production dialog")) } }
        compose.onAllNodes(isDialog()).assertCountEquals(1)
        compose.onNodeWithText("Production dialog").assertIsDisplayed()
        compose.onNodeWithText("OK").performClick()
        compose.onAllNodes(isDialog()).assertCountEquals(0)
    }

    @Test fun allWindowBasedFamiliesComposeInsidePreviewAndCanDismiss() {
        var tag by mutableStateOf("md-bottom-sheet")
        compose.setContent { AWCTheme { AWCPreviewScope(Modifier.width(360.dp)) { key(tag) {
            AWCComponent(tag, fixture(tag) + mapOf("open" to true, "headline" to "Preview content", "closeable" to true)) { slot -> SampleSlot(tag,slot) { _,_ -> } }
        } } } }
        for(next in listOf("md-bottom-sheet", "md-side-sheet", "md-menu", "md-fab-menu", "md-date-picker", "md-time-picker", "md-color-picker")) {
            compose.runOnIdle { tag = next }
            compose.waitForIdle()
            compose.onAllNodes(isDialog()).assertCountEquals(0)
            compose.onAllNodes(isPopup()).assertCountEquals(0)
            val close = when(next) { "md-date-picker", "md-time-picker" -> "Cancel"; "md-color-picker" -> "Apply"; "md-menu", "md-fab-menu" -> null; else -> "Close" }
            if(close != null) compose.onNode(hasText(close) or hasContentDescription(close)).performClick()
            else compose.onRoot().performKeyInput { pressKey(Key.Escape) }
            compose.waitForIdle()
            if(next.startsWith("md-menu") || next == "md-fab-menu") {
                try { compose.onNodeWithText("Open " + next.removePrefix("md-").replace('-', ' ')).assertIsDisplayed() }
                catch(error: AssertionError) { throw AssertionError(next + "\n" + compose.onRoot().printToString(), error) }
            }
            else if(next.endsWith("sheet")) compose.onNodeWithText("Open " + next.removePrefix("md-").replace('-', ' ')).assertIsDisplayed()
        }
    }

    @Test fun slotsAreBoundedLiteralTextAndStructuralChildrenStayIntact() {
        val body = "Salut 👋 <b>&</b>"
        assertEquals(mapOf("" to body), parseLivePreviewSlots(JSONObject().put("slots", JSONObject().put("", body).put("actions", "Replace buttons")), "md-dialog"))
        assertTrue(parseLivePreviewSlots(JSONObject().put("slots", JSONObject().put("", body)), "md-tabs").isEmpty())
        assertEquals(mapOf("" to body), parseLivePreviewSlots(JSONObject().put("slots", JSONObject().put("", body).put("trailing-icon", "home").put("loader", "Wait")), "md-button"))
        assertTrue(parseLivePreviewSlots(JSONObject().put("slots", JSONObject().put("header", body)), "md-navigation-rail").isEmpty())
        for(value in listOf(JSONObject.NULL, true, 4, JSONObject().put("", 4), JSONObject().put("", "👋".repeat(1025)), JSONObject().put("x".repeat(81), "x"))) {
            assertThrows(IllegalArgumentException::class.java) { parseLivePreviewSlots(JSONObject().put("slots", value), "md-card") }
        }
        assertEquals(mapOf("" to ""), parseLivePreviewSlots(JSONObject().put("slots", JSONObject().put("", "")), "md-card"))
        val tooMany = JSONObject().also { objectValue -> repeat(33) { objectValue.put("slot$it", "x") } }
        val tooLarge = JSONObject().also { objectValue -> repeat(9) { objectValue.put("slot$it", "x".repeat(4096)) } }
        for(value in listOf(tooMany, tooLarge)) assertThrows(IllegalArgumentException::class.java) { parseLivePreviewSlots(JSONObject().put("slots", value), "md-card") }
        compose.setContent { AWCTheme { Column {
            val slots = mapOf("" to body)
            AWCComponent("md-chip", previewSlotProperties("md-chip", fixture("md-chip"), slots)) { slot -> LivePreviewSampleSlot("md-chip", slot, "", null, slots) { _, _ -> } }
            AWCComponent("md-card") { slot -> LivePreviewSampleSlot("md-card", slot, "", null, slots) { _, _ -> } }
        } } }
        compose.onAllNodesWithText(body).assertCountEquals(2)
        compose.onNodeWithText("Android").assertDoesNotExist()
        compose.onNodeWithText("Build once. Render natively.").assertDoesNotExist()
    }

    @Test fun embeddedColorPickerCommitsAnEditedValueThroughSourceEvents() {
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { AWCTheme { AWCPreviewScope(Modifier.width(360.dp)) {
            AWCComponent("md-color-picker", fixture("md-color-picker") + mapOf("open" to true), onEvent = { name, value -> events += name to value })
        } } }
        compose.onNodeWithContentDescription("#386a20").performScrollTo().performClick()
        compose.onNodeWithText("Apply").performClick()
        compose.runOnIdle {
            assertTrue(events.any { it.first == "mdInput" && (it.second as? Map<*, *>)?.get("value") == "#386a20" })
            assertTrue(events.any { it.first == "mdChange" && (it.second as? Map<*, *>)?.get("value") == "#386a20" })
            assertTrue(events.any { it.first == "mdOpenChange" && (it.second as? Map<*, *>)?.get("open") == false })
        }
        compose.onNodeWithText("Apply").assertDoesNotExist()
    }

    @Test fun everyAllowedTextSlotRendersTheEditedContentWithoutMaskingFixtureProperties() {
        var selected by mutableStateOf("md-card" to "")
        compose.setContent { AWCTheme { AWCPreviewScope(Modifier.width(360.dp)) { key(selected) {
            val (tag, name) = selected
            val slots = mapOf(name to "Edited $tag / $name")
            val props = fixture(tag) + mapOf("open" to true, "expanded" to true, "active" to true, "autoHide" to false)
            AWCComponent(tag, previewSlotProperties(tag, props, slots)) { slot -> LivePreviewSampleSlot(tag, slot, "", null, slots) { _, _ -> } }
        } } } }
        for ((tag, names) in previewTextSlots) for (name in names) {
            compose.runOnIdle { selected = tag to name }
            compose.onNodeWithText("Edited $tag / $name").assertIsDisplayed()
        }
    }

    @Test fun snackbarSlotReplacesMessageIncludingAnExplicitEmptyStringAndRetainsActions() {
        var edited by mutableStateOf<String?>(null)
        compose.setContent { AWCTheme {
            val slots = edited?.let { mapOf("" to it) }.orEmpty()
            AWCComponent("md-snackbar", previewSlotProperties("md-snackbar", fixture("md-snackbar"), slots)) { slot -> LivePreviewSampleSlot("md-snackbar", slot, "", null, slots) { _, _ -> } }
        } }
        compose.onNodeWithText("Changes saved").assertIsDisplayed()
        compose.runOnIdle { edited = "Saved 👋 <b>literal</b>" }
        compose.onNodeWithText("Saved 👋 <b>literal</b>").assertIsDisplayed()
        compose.onNodeWithText("Changes saved").assertDoesNotExist()
        compose.onNodeWithText("Undo").assertIsDisplayed()
        compose.runOnIdle { edited = "" }
        compose.onNodeWithText("Saved 👋 <b>literal</b>").assertDoesNotExist()
        compose.onNodeWithText("Changes saved").assertDoesNotExist()
        compose.onNodeWithText("Undo").assertIsDisplayed()
    }
}
