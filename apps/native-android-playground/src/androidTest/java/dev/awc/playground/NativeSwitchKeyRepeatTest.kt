package dev.awc.playground

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import dev.awc.nativeui.*
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** md-switch source (md-switch.tsx keydown: `if (e.repeat) return`): a held Space toggles once; OS auto-repeats are consumed without acting (gate-7 R4-06). */
@OptIn(ExperimentalTestApi::class)
class NativeSwitchKeyRepeatTest {
    @get:Rule val compose = createComposeRule()

    @Test fun heldSpaceTogglesOnce() {
        val changes = mutableListOf<Any?>(); var repeats = 0
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) { AWCTheme(false) {
            Box(Modifier.onPreviewKeyEvent { if (it.nativeKeyEvent.repeatCount > 0) repeats++; false }) {
                AWCComponent("md-switch", mapOf("selected" to false), onEvent = { n, v -> if (n == "mdChange") changes += v }) } } } }
        compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Switch)).performSemanticsAction(SemanticsActions.RequestFocus)
        compose.onRoot().performKeyInput { keyDown(Key.Spacebar); advanceEventTime(1500); keyUp(Key.Spacebar) }
        compose.waitForIdle()
        assertTrue("key repeats were delivered ($repeats)", repeats > 0)
        assertTrue("one mdChange for a held Space: $changes", changes.size == 1)
        compose.onRoot().performKeyInput { pressKey(Key.Spacebar) }; compose.waitForIdle()
        assertTrue("a second press toggles back: $changes", changes.size == 2)
    }

    /** Source: Enter is reserved for form submission and never toggles the switch, held or not. */
    @Test fun heldEnterNeverToggles() {
        val changes = mutableListOf<Any?>(); var repeats = 0
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f, 1f)) { AWCTheme(false) {
            Box(Modifier.onPreviewKeyEvent { if (it.nativeKeyEvent.repeatCount > 0) repeats++; false }) {
                AWCComponent("md-switch", mapOf("selected" to false), onEvent = { n, v -> if (n == "mdChange") changes += v }) } } } }
        compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Switch)).performSemanticsAction(SemanticsActions.RequestFocus)
        compose.onRoot().performKeyInput { keyDown(Key.Enter); advanceEventTime(1500); keyUp(Key.Enter) }
        compose.waitForIdle()
        assertTrue("key repeats were delivered ($repeats)", repeats > 0)
        assertTrue("Enter does not toggle: $changes", changes.isEmpty())
    }
}
