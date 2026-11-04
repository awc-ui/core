package dev.awc.playground

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeButtonBehaviorTest {
    @get:Rule val compose = createComposeRule()

    @Test fun quickPressBeforeAnimationFrameCompletesOnComposeClock() {
        var clicks = 0
        compose.setContent { AWCTheme { AWCComponent("md-button", mapOf("label" to "Quick press", "ripple" to true),
            onEvent = { name, _ -> if (name == "mdClick") clicks++ }) } }
        compose.mainClock.autoAdvance = false
        compose.onNodeWithText("Quick press").performTouchInput { down(center); advanceEventTime(1); up() }
        compose.mainClock.advanceTimeBy(800)
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        compose.runOnIdle { assertEquals(1, clicks) }
    }

    @Test fun actualDemoValidatesSubmitsAndResetsNativeField() {
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { AWCTheme { AWCButtonBehaviorDemo(onEvent = { name, detail -> events += name to detail }) } }
        compose.onNode(hasSetTextAction()).performTextReplacement("")
        compose.onNodeWithText("Submit").performClick()
        compose.onNodeWithText("Status: Invalid").assertExists()
        compose.onNodeWithText("Please fill out this field.").assertExists()
        compose.runOnIdle { assertTrue(events.any { it.first == "mdInvalid" }); assertFalse(events.any { it.first == "mdSubmit" }) }
        compose.onNodeWithText("Reset").performClick()
        compose.onNode(hasSetTextAction()).assertTextContains("Ada")
        compose.onNodeWithText("Please fill out this field.").assertDoesNotExist()
        compose.onNodeWithText("Submit").performClick()
        compose.runOnIdle {
            val submission = events.last { it.first == "mdSubmit" }.second as Map<*, *>
            assertEquals("Ada", (submission["values"] as Map<*, *>)["name"])
            assertTrue(events.any { it.first == "mdReset" })
        }
    }

    @Test fun realButtonCancellationStopsToggleFormAndNavigationButStillEmitsClick() {
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { AWCTheme { AWCButtonBehaviorDemo(onEvent = { name, detail -> events += name to detail }) } }
        compose.onNodeWithText("Toggle").performClick().assertIsSelected()
        compose.onNodeWithContentDescription("Cancel actions").performClick()
        compose.runOnIdle { events.clear() }
        for (label in listOf("Submit", "Reset", "Toggle", "Link")) compose.onNodeWithText(label).performClick()
        compose.onNodeWithText("Toggle").assertIsSelected()
        compose.onNodeWithText("Status: Canceled").assertExists()
        compose.runOnIdle { assertEquals(listOf("mdClick", "mdClick", "mdClick", "mdClick"), events.map { it.first }) }
        compose.onNodeWithContentDescription("Cancel actions").performClick()
        compose.onNodeWithText("Link").performClick()
        compose.runOnIdle {
            assertEquals("mdClick", events[events.lastIndex - 1].first)
            val route = events.last().second as Map<*, *>
            assertEquals("mdNavigate", events.last().first); assertEquals("https://example.com", route["url"]); assertEquals("_blank", route["target"])
        }
    }

    @Test fun nestedFormAndActionScopesUseNativeMembershipAndPropagation() {
        val submissions = mutableListOf<AWCFormSubmission>()
        val actions = mutableListOf<String>()
        compose.setContent { AWCTheme {
            val outer = rememberAWCFormState(onSubmit = { submissions += it })
            val inner = rememberAWCFormState(onSubmit = { submissions += it })
            AWCFormScope(outer) {
                rememberAWCFormField("name", "Outer")
                AWCActionScope(onAction = { actions += "outer" }) {
                    Column {
                        AWCComponent("md-button", mapOf("type" to "submit", "label" to "Outer submit"))
                        AWCFormScope(inner) {
                            rememberAWCFormField("name", "Inner")
                            AWCActionScope(onAction = { actions += "inner"; it.stopPropagation() }) {
                                AWCComponent("md-button", mapOf("type" to "submit", "label" to "Inner submit"))
                            }
                        }
                    }
                }
            }
        } }
        compose.onNodeWithText("Inner submit").performClick()
        compose.onNodeWithText("Outer submit").performClick()
        compose.runOnIdle {
            assertEquals(listOf("Inner", "Outer"), submissions.map { it.values["name"] })
            assertEquals(listOf("inner", "outer"), actions)
        }
    }

    @Test fun explicitNativeSlotRemovalRestoresFallback() {
        var supplied by mutableStateOf(true)
        compose.setContent { AWCTheme {
            val entries: Map<String, @Composable () -> Unit> = if (supplied) mapOf("" to { Text("Custom native label") }) else emptyMap()
            AWCSlotsScope(AWCSlotRegistry(entries)) { AWCComponent("md-button", mapOf("label" to "Fallback label")) }
        } }
        compose.onNodeWithText("Custom native label").assertExists()
        compose.onNodeWithText("Fallback label").assertDoesNotExist()
        compose.runOnIdle { supplied = false }
        compose.onNodeWithText("Custom native label").assertDoesNotExist()
        compose.onNodeWithText("Fallback label").assertExists()
    }
}
