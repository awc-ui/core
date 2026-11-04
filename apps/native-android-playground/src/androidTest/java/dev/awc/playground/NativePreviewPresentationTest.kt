@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
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
        compose.setContent { AWCTheme { AWCFabMenuScope { AWCPreviewScope(Modifier.width(360.dp)) { key(tag) {
            // md-fab-menu belongs to an anchor FAB inside AWCFabMenuScope (as in the Laboratory host).
            if (tag == "md-fab-menu") Box(Modifier.size(360.dp, 480.dp)) {
                Box(Modifier.align(Alignment.BottomEnd).padding(16.dp)) { AWCComponent("md-fab", mapOf("id" to "preview-fab", "icon" to "add", "aria-label" to "Create")) }
                AWCComponent(tag, fixture(tag) + mapOf("open" to true, "anchor" to "preview-fab")) { slot -> SampleSlot(tag,slot) { _,_ -> } }
            }
            else AWCComponent(tag, fixture(tag) + mapOf("open" to true, "headline" to "Preview content", "closeable" to true)) { slot -> SampleSlot(tag,slot) { _,_ -> } }
        } } } } }
        for(next in listOf("md-bottom-sheet", "md-side-sheet", "md-menu", "md-fab-menu", "md-date-picker", "md-time-picker", "md-color-picker")) {
            // An open FAB menu re-reads its anchor every frame (AWCFabMenuScope), so Compose never idles while it is open.
            if(next == "md-fab-menu") compose.mainClock.autoAdvance = false
            compose.runOnIdle { tag = next }
            compose.waitForIdle()
            compose.onAllNodes(isDialog()).assertCountEquals(0)
            compose.onAllNodes(isPopup()).assertCountEquals(0)
            if(next == "md-fab-menu") { compose.mainClock.advanceTimeBy(600); compose.onNode(hasText("Edit") or hasContentDescription("Edit")).assertIsDisplayed() }
            // md-color-picker (inline by default, as the source) has no close action: it renders in place inside the preview.
            val close = when(next) { "md-date-picker", "md-time-picker" -> "Cancel"; "md-menu", "md-fab-menu", "md-color-picker" -> null; else -> "Close" }
            if(close != null) compose.onNode(hasText(close) or hasContentDescription(close)).performClick()
            else if(next == "md-fab-menu") compose.onRoot().performTouchInput { click(androidx.compose.ui.geometry.Offset(4f, 4f)) } // outside click closes
            else if(next == "md-color-picker") compose.onNodeWithContentDescription("#386a20").assertIsDisplayed()
            else compose.onRoot().performKeyInput { pressKey(Key.Escape) }
            compose.waitForIdle()
            if(next == "md-fab-menu") {
                // Escape closes the anchored menu inside the preview window: its items leave and the anchor stays.
                compose.mainClock.advanceTimeBy(600)
                compose.onAllNodes(hasText("Edit") or hasContentDescription("Edit")).assertCountEquals(0)
                compose.onNodeWithContentDescription("Create").assertIsDisplayed()
                compose.mainClock.autoAdvance = true
            }
            else if(next.startsWith("md-menu")) {
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
        assertEquals(mapOf("" to body, "trailing-icon" to "home", "loader" to "Wait"), parseLivePreviewSlots(JSONObject().put("slots", JSONObject().put("", body).put("trailing-icon", "home").put("loader", "Wait")), "md-button"))
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
        compose.onNodeWithText("Ideas take shape.").assertDoesNotExist()
    }

    @Test fun embeddedColorPickerCommitsAnEditedValueThroughSourceEvents() {
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { AWCTheme { AWCPreviewScope(Modifier.width(360.dp)) {
            AWCComponent("md-color-picker", fixture("md-color-picker") + mapOf("open" to true), onEvent = { name, value -> events += name to value })
        } } }
        // The source (md-color-picker.tsx): a preset click commits at once (input + change, formatted value); the inline
        // variant has no Apply step and no open state.
        compose.onNodeWithContentDescription("#386a20").performClick()
        fun has(name: String) = events.any { it.first == name && ((it.second as? Map<*, *>)?.get("value") as? String)?.equals("#386a20", ignoreCase = true) == true }
        compose.runOnIdle { assertTrue(events.toString(), has("mdInput")); assertTrue(events.toString(), has("mdChange")) }
        compose.onAllNodes(isDialog()).assertCountEquals(0)
        compose.onAllNodes(isPopup()).assertCountEquals(0)
    }

    @Test fun everyAllowedTextSlotRendersTheEditedContentWithoutMaskingFixtureProperties() {
        var selected by mutableStateOf("md-card" to "")
        compose.setContent { AWCTheme { AWCPreviewScope(Modifier.width(360.dp)) { key(selected) {
            val (tag, name) = selected
            // A tooltip is anchored to its trigger (default slot): keep one so the open bubble can show.
            val slots = mapOf(name to "Edited $tag / $name") + (if (tag == "md-tooltip") mapOf("" to "Trigger") else emptyMap())
            // The selected slot only shows on a selected toggle (source: selected icon/slot replace the default).
            val props = fixture(tag) + (if (tag == "md-icon-button" && name == "selected") mapOf("toggle" to true, "selected" to true) else emptyMap()) + mapOf("open" to true, "expanded" to true, "active" to true, "autoHide" to false,
                "loading" to (tag=="md-button" && name=="loader")) +
                // The subhead/content slots exist only while the tooltip renders its rich variant (source: md-tooltip.tsx).
                (if (tag == "md-tooltip") mapOf("variant" to "rich") else emptyMap())
            if(tag=="md-tooltip") AWCTooltipScope(Modifier.size(360.dp,240.dp)) {
                // As in the Laboratory host: the trigger and the text slots come from the slot registry.
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    AWCSlotsScope(AWCSlotRegistry(slots.mapValues { (_, value) -> @Composable { AWCSlotText(value) } })) { AWCComponent(tag, props) }
                }
            } else if(tag=="md-snackbar") AWCSnackbarScope(Modifier.size(360.dp,240.dp)) {
                Box(Modifier.fillMaxSize())
                AWCSlotsScope(AWCSlotRegistry(slots.mapValues { (_,value)->{ AWCSlotText(value) } })) { AWCComponent(tag,props) }
            } else AWCComponent(tag, previewSlotProperties(tag, props, slots)) { slot -> LivePreviewSampleSlot(tag, slot, "", null, slots) { _, _ -> } }
        } } } }
        val failures = mutableListOf<String>(); val drawnOnly = mutableListOf<String>()
        fun pixels() = compose.onRoot().captureToImage().toPixelMap().let { map -> IntArray(map.width * map.height) { map[it % map.width, it / map.width].hashCode() } }
        for ((tag, names) in previewTextSlots) for (name in names) {
            if (tag == "md-badge") {
                // The badge names itself from its value (Web role=status, aria-label = value): the authored icon content is
                // drawn inside it without becoming a second semantics node, so its rendering is checked from pixels against
                // the same badge without the slot.
                compose.runOnIdle { selected = tag to "-" }; compose.waitForIdle(); val without = pixels()
                compose.runOnIdle { selected = tag to name }; compose.waitForIdle(); val with = pixels()
                val changed = without.indices.count { without[it] != with[it] }
                if (changed < 40) failures += "$tag/$name: authored icon content not drawn ($changed changed pixels)"
                continue
            }
            compose.runOnIdle { selected = tag to name }
            // Named controls expose authored text as their accessible name (contentDescription) rather than a text node.
            val found = runCatching { compose.onNode(hasText("Edited $tag / $name") or hasContentDescription("Edited $tag / $name"), useUnmergedTree = true).assertIsDisplayed() }.isSuccess
            if (!found) {
                // Not a separate semantics node (the control keeps its own accessible name): require the edited content to
                // be drawn, from pixels against the same component with this slot left unedited.
                val with = pixels(); compose.runOnIdle { selected = tag to "-" }; compose.waitForIdle(); val without = pixels()
                val changed = without.indices.count { without[it] != with[it] }
                if (changed < 40) failures += "$tag/$name: edited content neither a semantics node nor drawn ($changed changed pixels)"
                else drawnOnly += "$tag/$name"
            }
        }
        android.util.Log.i("AWCAccordion", "slot-test drawn without own semantics node: $drawnOnly")
        assertTrue(failures.joinToString("\n"), failures.isEmpty())
    }

    @Test fun snackbarSlotReplacesMessageIncludingAnExplicitEmptyStringAndRetainsActions() {
        var edited by mutableStateOf<String?>(null)
        compose.setContent { AWCTheme {
            val slots = edited?.let { mapOf("" to it) }.orEmpty()
            AWCSnackbarScope(Modifier.size(360.dp,240.dp)) {
                Box(Modifier.fillMaxSize())
                AWCSlotsScope(AWCSlotRegistry(slots.mapValues { (_,value)->{ AWCSlotText(value) } })) {
                    AWCComponent("md-snackbar",fixture("md-snackbar"))
                }
            }
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
