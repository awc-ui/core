package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * md-card's INTERACTIVE_CONTENT_SELECTOR lists the library's own interactive components: an interactive card wrapping one keeps
 * a container role (no button around a button) without an authored marker; plain content leaves the card a button. A nested
 * md-button keeps its own label colour (the source button sets `color` on its own box) inside a card, disabled or not.
 */
class NativeCardAwcContentTest {
    @get:Rule val compose = createComposeRule()
    private var child by mutableStateOf<String?>(null)
    private var hidden by mutableStateOf(false)
    private var disabled by mutableStateOf(false)
    private var inspection: AWCCardInspection? = null
    private fun role() = compose.runOnIdle { inspection?.values?.get("role") }
    private fun content() = compose.setContent { AWCTheme(darkTheme = false) { Box(Modifier.padding(24.dp).width(320.dp)) { AWCCardInspectionScope({ inspection = it }) {
        AWCComponent("md-card", mapOf("interactive" to true, "disabled" to disabled)) { slot ->
            if (slot == "") {
                Text("Body")
                child?.let { tag -> AWCComponent(tag, mapOf<String, Any?>("label" to "Option", "hidden" to hidden) + when (tag) { "md-button" -> mapOf("variant" to "text"); "md-chip" -> mapOf("variant" to "assist"); else -> emptyMap() }) { s -> if (s == "" && tag == "md-button") Text("Explore") } }
            }
        }
    } } } }

    @Test fun libraryControlsAreInteractiveContent() {
        content()
        assertEquals("plain text content: the card is the button", "button", role())
        for (tag in listOf("md-button", "md-icon-button", "md-checkbox", "md-switch", "md-radio", "md-chip", "md-text-field", "md-slider")) {
            child = tag; compose.waitForIdle()
            assertEquals("$tag is interactive content: the card keeps a container role", "", role())
        }
        child = "md-chip"; hidden = true; compose.waitForIdle()
        assertEquals("hidden content is not interactive content", "button", role())
        child = null; hidden = false; compose.waitForIdle()
        assertEquals("content removed: the card is a button again", "button", role())
    }

    @Test fun nestedButtonKeepsItsLabelColour() {
        child = "md-button"; content()
        for (state in listOf(false, true)) {
            disabled = state; compose.waitForIdle()
            val pixels = compose.onNodeWithText("Explore").captureToImage().toPixelMap()
            var primary = 0
            // The text button's label is the primary role (light theme #6750A4): violet ink, not the card's grey or black ink.
            for (y in 0 until pixels.height) for (x in 0 until pixels.width) { val c = pixels[x, y]; if (c.blue - c.green > .15f && c.blue > c.red) primary++ }
            assertTrue("card disabled=$state: the md-button label keeps its primary colour ($primary violet pixels)", primary >= 20)
        }
    }
}
