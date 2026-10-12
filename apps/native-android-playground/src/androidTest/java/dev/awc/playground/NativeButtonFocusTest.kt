@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.LayoutDirection
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class NativeButtonFocusTest {
    @get:Rule val compose = createComposeRule()
    @Before fun freezeAnimations() { compose.mainClock.autoAdvance = false }
    private fun settle() { compose.mainClock.advanceTimeBy(64); compose.waitForIdle() }
    private fun key(label: String, key: Key, shift: Boolean = false) {
        compose.onNodeWithText(label).performKeyInput { if(shift) withKeyDown(Key.ShiftLeft) { pressKey(key) } else pressKey(key) }; settle()
    }
    @Test fun nativeTabEntersOnceArrowsSkipDisabledAndFocusNeverSelects() {
        val before = AWCButtonFocusState(); val events = mutableListOf<String>()
        compose.setContent { AWCTheme { Column {
            AWCButtonFocusScope(before) { AWCComponent("md-button", mapOf("label" to "Before")) }
            AWCComponent("md-button-group", onEvent = { name, _ -> events += name }) {
                for (label in listOf("One", "Two", "Off", "Soft", "Busy")) AWCComponent("md-button", mapOf("label" to label, "value" to label,
                    "selected" to (label == "Two"), "toggle" to true, "disabled" to (label == "Off"), "softDisabled" to (label == "Soft"), "loading" to (label == "Busy")), onEvent = { name, _ -> events += name })
            }
            AWCComponent("md-button", mapOf("label" to "After"))
        } } }
        settle(); compose.runOnIdle { assertTrue(before.requestFocus()) }; settle()
        key("Before", Key.Tab); compose.onNodeWithText("Two").assertIsFocused()
        key("Two", Key.DirectionRight); compose.onNodeWithText("Soft").assertIsFocused()
        key("Soft", Key.Enter); compose.runOnIdle { assertTrue(events.isEmpty()) }
        key("Soft", Key.Tab); compose.onNodeWithText("After").assertIsFocused()
        key("After", Key.Tab, true); compose.onNodeWithText("Soft").assertIsFocused()
        key("Soft", Key.MoveHome); compose.onNodeWithText("One").assertIsFocused()
        key("One", Key.MoveEnd); compose.onNodeWithText("Busy").assertIsFocused()
        key("Busy", Key.Enter)
        compose.onNodeWithText("Two").assertIsSelected(); compose.onNodeWithText("One").assertIsNotSelected()
        compose.runOnIdle { assertTrue(events.isEmpty()) }
    }
    @Test fun rtlArrowsAndHomeEndFollowSourceAndKeyboardActivationStillWorks() {
        val first = AWCButtonFocusState(); val events = mutableListOf<String>()
        compose.setContent { AWCTheme { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            AWCComponent("md-button-group", onEvent = { name, _ -> events += name }) {
                AWCButtonFocusScope(first) { AWCComponent("md-button", mapOf("label" to "One", "value" to "One", "toggle" to true)) }
                AWCComponent("md-button", mapOf("label" to "Two", "value" to "Two", "toggle" to true))
                AWCComponent("md-button", mapOf("label" to "Three", "value" to "Three", "toggle" to true))
            }
        } } }
        settle(); compose.runOnIdle { first.requestFocus() }; settle()
        key("One", Key.DirectionRight); compose.onNodeWithText("Three").assertIsFocused()
        key("Three", Key.DirectionLeft); compose.onNodeWithText("One").assertIsFocused()
        key("One", Key.MoveEnd); compose.onNodeWithText("Three").assertIsFocused()
        key("Three", Key.Enter); compose.onNodeWithText("Three").assertIsSelected()
        compose.runOnIdle { assertEquals(listOf("mdSelectionChange"), events) }
    }
    @Test fun minusOneSkipsTabButRetainsProgrammaticTouchAndAccessibilityActivation() {
        val before = AWCButtonFocusState(); val skipped = AWCButtonFocusState(); var clicks = 0
        compose.setContent { AWCTheme { Column {
            AWCButtonFocusScope(before) { AWCComponent("md-button", mapOf("label" to "Before")) }
            AWCButtonFocusScope(skipped) { AWCComponent("md-button", mapOf("label" to "Skipped", "groupTabindex" to -1), onEvent = { name, _ -> if(name == "mdClick") clicks++ }) }
            AWCComponent("md-button", mapOf("label" to "After"))
        } } }
        settle(); compose.runOnIdle { before.requestFocus() }; settle()
        key("Before", Key.Tab); compose.onNodeWithText("After").assertIsFocused()
        compose.runOnIdle { assertTrue(skipped.requestFocus()) }; settle()
        compose.onNodeWithText("Skipped").assertIsFocused()
        key("Skipped", Key.Tab); compose.onNodeWithText("After").assertIsFocused()
        compose.onNodeWithText("Skipped").performTouchInput { click(center) }; settle()
        compose.onNodeWithText("Skipped").assertIsFocused().assertHasClickAction().performClick(); settle()
        compose.runOnIdle { assertEquals(2, clicks) }
    }
    @Test fun gridCellExposesCollectionSelectionAndClickWithoutPretendingToBeButtonRole() {
        var clicks = 0
        compose.setContent { AWCTheme { Column {
            AWCGridScope(rows = 2, columns = 7) { AWCGridCellScope(row = 1, column = 3) {
                AWCComponent("md-button", mapOf("label" to "Day 15", "roleOverride" to "gridcell", "selected" to true, "toggle" to false, "groupTabindex" to -1), onEvent = { name, _ -> if(name == "mdClick") clicks++ })
            } }
            AWCComponent("md-button", mapOf("label" to "Fallback", "roleOverride" to "unsupported-role", "toggle" to true, "selected" to true))
        } } }
        settle()
        val cell = compose.onNodeWithText("Day 15")
        cell.assertIsSelected().assertHasClickAction().assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Role))
        val info = cell.fetchSemanticsNode().config[SemanticsProperties.CollectionItemInfo]
        assertEquals(1, info.rowIndex); assertEquals(3, info.columnIndex)
        val parent = compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.CollectionInfo)).fetchSemanticsNode().config[SemanticsProperties.CollectionInfo]
        assertEquals(2, parent.rowCount); assertEquals(7, parent.columnCount)
        cell.performClick(); settle(); compose.runOnIdle { assertEquals(1, clicks) }
        compose.onNodeWithText("Fallback").assertIsSelected().assertHasClickAction().assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
    }
    @Test fun removingOrDisablingActiveEntryRecomputesNextGroupTabStop() {
        var disabled by mutableStateOf(false); var show by mutableStateOf(true)
        val before = AWCButtonFocusState()
        compose.setContent { AWCTheme { Column {
            AWCButtonFocusScope(before) { AWCComponent("md-button", mapOf("label" to "Before")) }
            AWCComponent("md-button-group") {
                AWCComponent("md-button", mapOf("label" to "One"))
                if (show) AWCComponent("md-button", mapOf("label" to "Two", "selected" to true, "disabled" to disabled))
            }
            AWCComponent("md-button", mapOf("label" to "After"))
        } } }
        settle(); compose.runOnIdle { before.requestFocus() }; settle()
        key("Before", Key.Tab); compose.onNodeWithText("Two").assertIsFocused()
        compose.runOnIdle { disabled = true }; settle()
        compose.runOnIdle { before.requestFocus() }; settle(); key("Before", Key.Tab); compose.onNodeWithText("One").assertIsFocused()
        compose.runOnIdle { show = false; before.requestFocus() }; settle(); key("Before", Key.Tab); compose.onNodeWithText("One").assertIsFocused()
    }
    @Test fun mixedIconButtonParticipatesInGroupRovingFocus() {
        val before = AWCButtonFocusState()
        compose.setContent { AWCTheme { Column {
            AWCButtonFocusScope(before) { AWCComponent("md-button", mapOf("label" to "Before")) }
            AWCComponent("md-button-group") {
                AWCComponent("md-button", mapOf("label" to "One"))
                AWCComponent("md-icon-button", mapOf("label" to "Star", "icon" to "star"))
            }
        } } }
        settle(); compose.runOnIdle { before.requestFocus() }; settle(); key("Before", Key.Tab)
        key("One", Key.DirectionRight); compose.onNodeWithContentDescription("Star").assertIsFocused()
    }
    @Test fun actualAccessibilityDemoMovesRealFocusToGroupAndGridCell() {
        compose.setContent { AWCTheme { AWCButtonAccessibilityDemo() } }
        settle(); compose.onNodeWithText("Focus before").performClick(); settle()
        compose.onNodeWithText("Before").assertIsFocused()
        key("Before", Key.Tab); compose.onNodeWithText("Two").assertIsFocused()
        compose.onNodeWithText("Focus cell").performClick(); settle()
        compose.onNodeWithText("Day 15").assertIsFocused().assertIsSelected().assertHasClickAction()
        compose.onNodeWithText("Focused: Day 15 · Selected: Two").assertExists()
    }

    @Test fun groupPropertyChangesPreserveMostRecentlyFocusedEntry() {
        var wide by mutableStateOf(false); var multi by mutableStateOf(false)
        val before = AWCButtonFocusState()
        compose.setContent { AWCTheme { Column {
            AWCButtonFocusScope(before) { AWCComponent("md-button", mapOf("label" to "Before")) }
            AWCComponent("md-button-group", mapOf("fullWidth" to wide, "selectionMode" to if(multi) "multi-select" else "single-select")) {
                AWCComponent("md-button", mapOf("label" to "One"))
                AWCComponent("md-button", mapOf("label" to "Two", "selected" to true))
            }
            AWCComponent("md-button", mapOf("label" to "After"))
        } } }
        settle(); compose.runOnIdle { before.requestFocus() }; settle(); key("Before", Key.Tab)
        key("Two", Key.DirectionLeft); compose.onNodeWithText("One").assertIsFocused()
        key("One", Key.Tab); compose.onNodeWithText("After").assertIsFocused()
        compose.runOnIdle { wide = true }; settle()
        key("After", Key.Tab, true); compose.onNodeWithText("One").assertIsFocused()
        key("One", Key.Tab); compose.runOnIdle { multi = true }; settle()
        key("After", Key.Tab, true); compose.onNodeWithText("One").assertIsFocused()
    }

}
