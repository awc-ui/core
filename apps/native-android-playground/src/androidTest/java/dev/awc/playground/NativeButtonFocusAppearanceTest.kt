@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.roundToInt

/** Real native focus remains independent of the source focus-visible ring and state layer. */
class NativeButtonFocusAppearanceTest {
    @get:Rule val compose = createComposeRule()
    @Before fun freezeAnimations() { compose.mainClock.autoAdvance = false }
    private fun settle() { compose.mainClock.advanceTimeBy(1000); compose.waitForIdle() }
    private fun show(state: AWCButtonFocusState) {
        compose.setContent { AWCTheme(darkTheme = false) {
            Box(Modifier.testTag("focus-surface").background(Color.White).padding(24.dp)) {
                AWCButtonFocusScope(state) {
                    AWCComponent("md-button", mapOf("label" to "Continue", "size" to "md", "variant" to "filled", "ripple" to true))
                }
            }
        } }
        settle()
    }
    private fun capture(): ImageBitmap = compose.onNodeWithTag("focus-surface").captureToImage()
    private fun buttonRect(): Rect {
        val root = compose.onNodeWithTag("focus-surface").fetchSemanticsNode().boundsInRoot
        val button = compose.onNodeWithText("Continue").fetchSemanticsNode().boundsInRoot
        return Rect(button.left - root.left, button.top - root.top, button.right - root.left, button.bottom - root.top)
    }
    private fun difference(a: Color, b: Color): Float = maxOf(abs(a.red - b.red), abs(a.green - b.green), abs(a.blue - b.blue), abs(a.alpha - b.alpha))
    private fun assertSameRestingPixels(expected: ImageBitmap, actual: ImageBitmap) {
        assertEquals(expected.width, actual.width); assertEquals(expected.height, actual.height)
        val first = expected.toPixelMap(); val second = actual.toPixelMap()
        var changed = 0
        for (y in 0 until expected.height) for (x in 0 until expected.width) if (difference(first[x, y], second[x, y]) > 1.1f / 255f) changed++
        assertEquals("Pointer-rested button must match unfocused pixels, without retained ring or focus tint", 0, changed)
    }

    @Test fun pointerDownAndReleaseKeepActualFocusWithoutPersistentFocusAppearance() {
        val state = AWCButtonFocusState(); show(state)
        val baseline = capture()
        compose.onNodeWithText("Continue").performTouchInput { down(center) }
        compose.mainClock.advanceTimeBy(32); compose.waitForIdle()
        compose.runOnIdle { assertTrue(state.isFocused); assertFalse(state.isFocusVisible) }
        compose.onNodeWithText("Continue").performTouchInput { up() }
        settle()
        compose.onNodeWithText("Continue").assertIsFocused()
        compose.runOnIdle { assertFalse(state.isFocusVisible) }
        assertSameRestingPixels(baseline, capture())
    }

    @Test fun keyboardPointerKeyboardSwitchesFocusVisibleAndDrawsThreeDpRingWithTwoDpGap() {
        val state = AWCButtonFocusState(); show(state)
        val baseline = capture()
        val button = compose.onNodeWithText("Continue")
        button.performTouchInput { click(center) }; settle()
        button.performKeyInput { pressKey(Key.DirectionRight) }; settle()
        compose.runOnIdle { assertTrue(state.isFocused); assertTrue(state.isFocusVisible) }
        val keyboard = capture().toPixelMap()
        val bounds = buttonRect()
        val scale = compose.density.density
        val centerY = bounds.center.y.roundToInt()
        fun pixel(distanceOutside: Float): Color = keyboard[(bounds.left - distanceOutside * scale).roundToInt(), centerY]
        assertTrue("The 2dp gap must remain background", difference(Color.White, pixel(1f)) < .01f)
        assertTrue("The ring must cover the 3dp stroke outside the gap", difference(Color.White, pixel(3.5f)) > .05f)
        assertTrue("Beyond the 3dp ring and 2dp gap must remain background", difference(Color.White, pixel(6.5f)) < .01f)
        val fillX = (bounds.left + 16f * scale).roundToInt()
        assertTrue("Keyboard focus must apply its focus state layer", difference(baseline.toPixelMap()[fillX, centerY], keyboard[fillX, centerY]) > 1.1f / 255f)
        button.performTouchInput { click(center) }; settle()
        compose.runOnIdle { assertTrue(state.isFocused); assertFalse(state.isFocusVisible) }
        assertSameRestingPixels(baseline, capture())
        button.performKeyInput { pressKey(Key.DirectionLeft) }; settle()
        compose.runOnIdle { assertTrue(state.isFocused); assertTrue(state.isFocusVisible) }
    }
}
