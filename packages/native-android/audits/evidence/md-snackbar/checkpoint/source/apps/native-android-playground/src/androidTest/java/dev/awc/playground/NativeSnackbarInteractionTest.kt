package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeSnackbarInteractionTest {
    @get:Rule val compose=createComposeRule()
    @Test fun authoredSlotsOwnCallbacksAndCanChangeOrBecomeEmptyWithoutRemounting() {
        val controller=AWCSnackbarController();val events=mutableListOf<Pair<String,AWCValue>>()
        var actions=0;var closes=0;var mode by mutableIntStateOf(0);var politeness by mutableStateOf("polite")
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCSnackbarScope(Modifier.requiredSize(800.dp,240.dp)) {
                Box(Modifier.fillMaxSize())
                AWCSnackbarControllerScope(controller) {
                    val slots=when(mode) {
                        0->AWCSlotRegistry(mapOf("" to { AWCSlotText("Authored message") },"action" to { AWCComponent("md-button",mapOf("label" to "Custom action"),onEvent={n,_->if(n=="mdClick") actions++}) },"close" to { AWCComponent("md-button",mapOf("label" to "Custom close"),onEvent={n,_->if(n=="mdClick") closes++}) }))
                        1->AWCSlotRegistry(mapOf("" to {},"action" to {},"close" to {}))
                        else->AWCSlotRegistry(emptyMap())
                    }
                    AWCSlotsScope(slots) { AWCComponent("md-snackbar",mapOf("open" to true,"autoHide" to false,"message" to "Fallback message","action" to "Undo","closeable" to true,"politeness" to politeness),onEvent={n,d->events+=n to d}) }
                }
            } }
        } } }
        compose.onNodeWithText("Custom action").performClick();compose.onNodeWithText("Custom close").performClick()
        compose.runOnIdle { assertEquals(1,actions);assertEquals(1,closes);assertTrue(controller.isOpen);assertEquals(listOf("mdOpen" to null),events) }
        compose.onNodeWithText("Fallback message").assertDoesNotExist();compose.onNodeWithText("Undo").assertDoesNotExist()
        compose.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion,LiveRegionMode.Polite)).assertCountEquals(1)
        compose.runOnIdle { mode=1;politeness="assertive" }
        compose.onNodeWithText("Authored message").assertDoesNotExist();compose.onNodeWithText("Fallback message").assertDoesNotExist();compose.onNodeWithText("Undo").assertDoesNotExist()
        compose.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion,LiveRegionMode.Assertive)).assertCountEquals(1)
        compose.runOnIdle { mode=2 }
        compose.onNodeWithText("Fallback message").assertExists();compose.onNodeWithText("Undo").assertExists()
        compose.runOnIdle { assertEquals(listOf("mdOpen" to null),events) }
    }

    @Test fun realFocusPausesTimerAcrossChildrenAndLeavingRestartsFullDuration() {
        val controller=AWCSnackbarController();val events=mutableListOf<Pair<String,AWCValue>>()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCSnackbarScope(Modifier.requiredSize(800.dp,240.dp)) {
                Box(Modifier.fillMaxSize()) { AWCComponent("md-button",mapOf("label" to "Outside")) }
                AWCSnackbarControllerScope(controller) { AWCComponent("md-snackbar",mapOf("open" to true,"autoHide" to true,"autoHideDuration" to 1000,"message" to "Saved","action" to "Undo","closeable" to true,"dismissLabel" to "Close notice"),onEvent={n,d->events+=n to d}) }
            } }
        } } }
        compose.onNodeWithText("Undo").performSemanticsAction(SemanticsActions.RequestFocus)
        compose.mainClock.advanceTimeBy(1100);compose.waitForIdle()
        compose.runOnIdle { assertTrue(controller.isOpen);assertTrue(events.none { it.first=="mdClose" }) }
        compose.onNodeWithContentDescription("Close notice").performSemanticsAction(SemanticsActions.RequestFocus)
        compose.mainClock.advanceTimeBy(1100);compose.waitForIdle()
        compose.runOnIdle { assertTrue(controller.isOpen) }
        compose.onNodeWithText("Outside").performSemanticsAction(SemanticsActions.RequestFocus)
        compose.mainClock.advanceTimeBy(600);compose.waitForIdle();compose.runOnIdle { assertTrue(controller.isOpen) }
        compose.mainClock.advanceTimeBy(550);compose.waitForIdle();compose.runOnIdle { assertFalse(controller.isOpen);assertEquals("mdClose" to mapOf("reason" to "auto"),events.last()) }
    }
}
