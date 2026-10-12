package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import kotlin.math.abs

/** Checks measured content insets and rasterized outlines, beyond the metric table. */
class NativeButtonExpressiveMetricsTest {
    @get:Rule val compose = createComposeRule()

    @Test fun outlinedAndFilledContentShareTheAuditedOuterInsets() {
        var size by mutableStateOf("xs")
        var density by mutableFloatStateOf(0f)
        var variant by mutableStateOf("filled")
        compose.setContent { AWCTheme(darkTheme = false) {
            Box(Modifier.background(Color.White).padding(16.dp)) {
                AWCComponent("md-button", mapOf("size" to size, "density" to density, "variant" to variant, "ripple" to false), modifier = Modifier.testTag("button")) {
                    if(it == "") Box(Modifier.size(width = 100.dp, height = 10.dp).testTag("content"))
                }
            }
        } }
        val sizes = listOf("xs", "sm", "md", "lg", "xl")
        val base = listOf(12f, 16f, 24f, 48f, 64f)
        for (rung in listOf(0f, -4f)) for ((index, nextSize) in sizes.withIndex()) for (nextVariant in listOf("filled", "outlined")) {
            compose.runOnIdle { size = nextSize; density = rung; variant = nextVariant }
            compose.mainClock.advanceTimeBy(1000); compose.waitForIdle()
            val button = compose.onNodeWithTag("button", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
            val content = compose.onNodeWithTag("content", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
            val expected = base[index] * (if(rung == 0f) 1f else .75f) * compose.density.density
            assertEquals("$nextSize/$rung/$nextVariant leading inset", expected, content.left - button.left, 1f)
            assertEquals("$nextSize/$rung/$nextVariant trailing inset", expected, button.right - content.right, 1f)
        }
    }

    @Test fun outlinedStrokeActuallyRendersOneTwoAndThreeDp() {
        var size by mutableStateOf("md")
        compose.setContent { AWCTheme(darkTheme = false) {
            Box(Modifier.background(Color.White).padding(16.dp)) {
                AWCComponent("md-button", mapOf("size" to size, "variant" to "outlined", "ripple" to false), modifier = Modifier.testTag("button")) {
                    if(it == "") Box(Modifier.size(width = 100.dp, height = 10.dp))
                }
            }
        } }
        val measured = mutableListOf<Int>()
        for ((nextSize, thickness) in listOf("md" to 1f, "lg" to 2f, "xl" to 3f)) {
            compose.runOnIdle { size = nextSize }
            compose.mainClock.advanceTimeBy(1000); compose.waitForIdle()
            val bitmap = compose.onNodeWithTag("button").captureToImage()
            val pixels = bitmap.toPixelMap()
            val x = bitmap.width / 2
            val darkRows = (0 until (6f * compose.density.density).toInt()).count { y ->
                val pixel = pixels[x, y]
                maxOf(abs(pixel.red - 1f), abs(pixel.green - 1f), abs(pixel.blue - 1f)) > .2f
            }
            measured += darkRows
            assertEquals("$nextSize stroke width in physical pixels", thickness * compose.density.density, darkRows.toFloat(), 1.1f)
        }
        assertTrue("Large outline must be thicker than medium", measured[1] > measured[0])
        assertTrue("Extra-large outline must be thicker than large", measured[2] > measured[1])
    }
}
