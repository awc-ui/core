@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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

/** Captures actual Compose corner pixels; ripple and selection changes cannot imitate a morph. */
class NativeButtonKeyboardMorphTest {
    @get:Rule val compose = createComposeRule()
    @Before fun freezeAnimations() { compose.mainClock.autoAdvance = false }
    private fun advance(milliseconds: Long) { compose.mainClock.advanceTimeBy(milliseconds); compose.waitForIdle() }
    private fun capture(): ImageBitmap = compose.onNodeWithTag("morph-surface").captureToImage()
    private fun bounds(label: String): Rect {
        val root = compose.onNodeWithTag("morph-surface").fetchSemanticsNode().boundsInRoot
        val button = compose.onNodeWithText(label).fetchSemanticsNode().boundsInRoot
        return Rect(button.left - root.left, button.top - root.top, button.right - root.left, button.bottom - root.top)
    }
    private fun difference(a: Color, b: Color): Float = maxOf(abs(a.red - b.red), abs(a.green - b.green), abs(a.blue - b.blue), abs(a.alpha - b.alpha))
    private fun cornerCoverage(frame: ImageBitmap, rect: Rect): Int {
        val pixels = frame.toPixelMap(); val scale = compose.density.density
        val left = (rect.left + 2f * scale).roundToInt(); val right = (rect.left + 16f * scale).roundToInt()
        val top = (rect.top + 2f * scale).roundToInt(); val bottom = (rect.top + 16f * scale).roundToInt()
        var count = 0
        for (y in top until bottom) for (x in left until right) if(difference(Color.White, pixels[x, y]) > .05f) count++
        return count
    }
    private fun assertRestored(expected: ImageBitmap, actual: ImageBitmap) {
        assertEquals(expected.width, actual.width); assertEquals(expected.height, actual.height)
        val first = expected.toPixelMap(); val second = actual.toPixelMap()
        var changed = 0
        for (y in 0 until expected.height) for (x in 0 until expected.width) if(difference(first[x, y], second[x, y]) > 1.1f / 255f) changed++
        assertEquals("Keyboard pulse must settle back to the same focused appearance", 0, changed)
    }
    private fun show(state: AWCButtonFocusState, morph: Boolean = true, ripple: Boolean = false, clicked: () -> Unit) {
        compose.setContent { AWCTheme(darkTheme = false) {
            Box(Modifier.testTag("morph-surface").background(Color.White).padding(24.dp)) {
                AWCButtonFocusScope(state) {
                    AWCComponent("md-button", mapOf("label" to "Continue", "size" to "md", "variant" to "filled", "shapeMorph" to morph, "ripple" to ripple),
                        onEvent = { name, _ -> if(name == "mdClick") clicked() })
                }
            }
        } }
        advance(1000); compose.runOnIdle { assertTrue(state.requestFocus()) }; advance(1000)
    }

    @Test fun enterAndSpaceProduceTransientCornerMorphAndOneActivationWithoutLosingFocus() {
        val state = AWCButtonFocusState(); var clicks = 0
        show(state) { clicks++ }
        val baseline = capture(); val rect = bounds("Continue"); val restingCoverage = cornerCoverage(baseline, rect)
        listOf(Key.Enter, Key.Spacebar, Key.NumPadEnter).forEachIndexed { index, key ->
            compose.onNodeWithText("Continue").performKeyInput { pressKey(key) }
            advance(96)
            assertTrue("$key must visibly expand the corner toward its pressed shape", cornerCoverage(capture(), rect) > restingCoverage + 20)
            compose.runOnIdle { assertTrue(state.isFocused); assertTrue(state.isFocusVisible); assertEquals(index + 1, clicks) }
            advance(1000)
            assertRestored(baseline, capture())
            compose.onNodeWithText("Continue").assertIsFocused()
            compose.runOnIdle { assertEquals("No duplicate key-up/default activation", index + 1, clicks) }
        }
    }

    @Test fun shapeMorphFalseKeepsCornerGeometryWhileKeyboardStillActivatesOnce() {
        val state = AWCButtonFocusState(); var clicks = 0
        show(state, morph = false) { clicks++ }
        val baseline = capture(); val rect = bounds("Continue"); val restingCoverage = cornerCoverage(baseline, rect)
        listOf(Key.Enter, Key.Spacebar).forEachIndexed { index, key ->
            compose.onNodeWithText("Continue").performKeyInput { pressKey(key) }; advance(96)
            assertEquals(restingCoverage, cornerCoverage(capture(), rect))
            advance(1000); assertRestored(baseline, capture())
            compose.runOnIdle { assertTrue(state.isFocused); assertEquals(index + 1, clicks) }
        }
    }

    @Test fun softDisabledAndLoadingKeepFocusButDoNotMorphOrActivateFromKeyboard() {
        val soft = AWCButtonFocusState(); val busy = AWCButtonFocusState(); var clicks = 0
        compose.setContent { AWCTheme(darkTheme = false) {
            Column(Modifier.testTag("morph-surface").background(Color.White).padding(24.dp)) {
                listOf("Soft" to soft, "Busy" to busy).forEach { (label, state) ->
                    AWCButtonFocusScope(state) {
                        AWCComponent("md-button", mapOf("label" to label, "size" to "md", "variant" to "filled", "ripple" to false,
                            "softDisabled" to (label == "Soft"), "loading" to (label == "Busy")), onEvent = { name, _ -> if(name == "mdClick") clicks++ })
                    }
                }
            }
        } }
        advance(1000)
        for ((label, state) in listOf("Soft" to soft, "Busy" to busy)) {
            compose.runOnIdle { assertTrue(state.requestFocus()) }; advance(1000)
            val rect = bounds(label); val restingCoverage = cornerCoverage(capture(), rect)
            for (key in listOf(Key.Enter, Key.Spacebar)) {
                compose.onNodeWithText(label).performKeyInput { pressKey(key) }; advance(96)
                assertEquals(restingCoverage, cornerCoverage(capture(), rect))
                compose.runOnIdle { assertTrue(state.isFocused); assertEquals(0, clicks) }
                advance(1000)
            }
        }
    }
    @Test fun overlappingKeyboardPulsesReleaseCompletelyWithoutDuplicateActions() {
        val state = AWCButtonFocusState(); var clicks = 0
        show(state) { clicks++ }
        val baseline = capture(); val rect = bounds("Continue"); val restingCoverage = cornerCoverage(baseline, rect)
        compose.onNodeWithText("Continue").performKeyInput { pressKey(Key.Enter) }; advance(64)
        compose.onNodeWithText("Continue").performKeyInput { pressKey(Key.Spacebar) }; advance(96)
        assertTrue(cornerCoverage(capture(), rect) > restingCoverage + 20)
        compose.runOnIdle { assertEquals(2, clicks); assertTrue(state.isFocused) }
        advance(1000); assertRestored(baseline, capture())
        compose.runOnIdle { assertEquals(2, clicks); assertTrue(state.isFocusVisible) }
    }

    @Test fun keyboardRippleStartsWithoutAnExtraCompositionFrameAndSettlesOnTheTestClock() {
        val state = AWCButtonFocusState(); var clicks = 0
        // Focus keeps the state layer at the same opacity, and shapeMorph=false
        // fixes the geometry, so changed pixels can only come from the ripple.
        show(state, morph = false, ripple = true) { clicks++ }
        val baseline = capture(); val rect = bounds("Continue")
        compose.onNodeWithText("Continue").performKeyInput { pressKey(Key.Enter) }
        advance(32)
        val before = baseline.toPixelMap(); val after = capture().toPixelMap()
        var changed = 0
        for(y in rect.top.roundToInt() until rect.bottom.roundToInt()) {
            for(x in rect.left.roundToInt() until rect.right.roundToInt()) {
                if(difference(before[x, y], after[x, y]) > 1.1f / 255f) changed++
            }
        }
        assertTrue("The centered ripple must be visible by its second Compose frame", changed > 0)
        compose.runOnIdle { assertEquals(1, clicks) }
        advance(1000)
        assertRestored(baseline, capture())
        compose.runOnIdle { assertEquals(1, clicks); assertTrue(state.isFocusVisible) }
    }

    @Test fun rapidToggleKeyDownsKeepThePressShapeAndCommitExactlyOncePerKey() {
        val state = AWCButtonFocusState(); var clicks = 0
        val changes = mutableListOf<Boolean>()
        compose.setContent { AWCTheme(darkTheme = false) {
            Box(Modifier.testTag("morph-surface").background(Color.White).padding(24.dp)) {
                AWCButtonFocusScope(state) {
                    AWCComponent("md-button", mapOf("label" to "Toggle", "size" to "md", "toggle" to true, "ripple" to false),
                        onEvent = { name, detail ->
                            if(name == "mdClick") clicks++
                            if(name == "mdChange") changes += (detail as Map<*, *>)["selected"] as Boolean
                        })
                }
            }
        } }
        advance(1000); compose.runOnIdle { assertTrue(state.requestFocus()) }; advance(1000)
        val baseline = capture(); val rect = bounds("Toggle"); val restingCoverage = cornerCoverage(baseline, rect)
        compose.onNodeWithText("Toggle").performKeyInput { keyDown(Key.Enter) }
        compose.runOnIdle { assertEquals(1, clicks); assertEquals(listOf(true), changes) }
        advance(64)
        assertTrue(cornerCoverage(capture(), rect) > restingCoverage + 20)
        compose.onNodeWithText("Toggle").assertIsSelected()
        compose.onNodeWithText("Toggle").performKeyInput { keyUp(Key.Enter); pressKey(Key.Spacebar) }
        compose.runOnIdle { assertEquals(2, clicks); assertEquals(listOf(true, false), changes) }
        advance(96)
        assertTrue("Canceling the first pulse must not release the newer press", cornerCoverage(capture(), rect) > restingCoverage + 20)
        compose.onNodeWithText("Toggle").assertIsNotSelected()
        advance(1000)
        assertRestored(baseline, capture())
        compose.runOnIdle { assertEquals(2, clicks); assertTrue(state.isFocusVisible) }
    }

}
