package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.ceil
import kotlin.math.floor

/** A centered layout box is insufficient: the actual Material Symbols ink must be centered. */
class NativeButtonIconAlignmentTest {
    @get:Rule val compose = createComposeRule()

    @Test fun leadingAndTrailingHomeGlyphsStayCenteredAtEverySizeAndDensity() {
        var size by mutableStateOf("xs")
        var density by mutableFloatStateOf(0f)
        var trailing by mutableStateOf(true)
        compose.setContent { AWCTheme(darkTheme = false) {
            Box(Modifier.background(Color.White).padding(16.dp)) {
                AWCComponent("md-button", mapOf("label" to "Continue", "size" to size, "density" to density,
                    "variant" to "text", "ripple" to false, (if (trailing) "trailingIcon" else "icon") to "home"),
                    modifier = Modifier.testTag("button"))
            }
        } }
        for (rung in listOf(0f, -4f)) for (tier in listOf("xs", "sm", "md", "lg", "xl")) for (end in listOf(true, false)) {
            compose.runOnIdle { size = tier; density = rung; trailing = end }
            compose.mainClock.advanceTimeBy(1000); compose.waitForIdle()
            val button = compose.onNodeWithTag("button", useUnmergedTree = true)
            val bounds = button.fetchSemanticsNode().boundsInRoot
            val glyph = compose.onNodeWithText("home", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
            val bitmap = button.captureToImage()
            val pixels = bitmap.toPixelMap()
            val left = floor(glyph.left - bounds.left).toInt().coerceIn(0, bitmap.width - 1)
            val right = ceil(glyph.right - bounds.left).toInt().coerceIn(left + 1, bitmap.width)
            val rows = (0 until bitmap.height).filter { y ->
                (left until right).any { x ->
                    val color = pixels[x, y]
                    minOf(color.red, color.green, color.blue) < .65f
                }
            }
            assertTrue("$tier/$rung/$end must render the home glyph", rows.isNotEmpty())
            val inkCenter = (rows.first() + rows.last() + 1) / 2f
            assertEquals("$tier/$rung/${if (end) "trailing" else "leading"}: glyph ink must align with the button center",
                bitmap.height / 2f, inkCenter, 1f)
        }
    }
}
