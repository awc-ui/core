package dev.awc.playground

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeNavigationEventsTest {
    @get:Rule val compose = createComposeRule()

    @Test fun actualButtonUsesCaptureTargetBubbleAndCancellationBeforeToggle() {
        var cancel by mutableStateOf(true)
        val trace = mutableListOf<String>(); val events = mutableListOf<AWCActionEvent>()
        compose.setContent { AWCTheme {
            AWCActionScope(id = "outer", onCapture = { if (it.name == "mdClick") { trace += "outer:capture"; if (cancel) it.preventDefault() } }, onAction = { if (it.name == "mdClick") trace += "outer:bubble" }) {
                AWCActionScope(id = "inner", onCapture = { if (it.name == "mdClick") trace += "inner:capture" }, onAction = { if (it.name == "mdClick") trace += "inner:bubble" }) {
                    AWCActionTargetScope(id = "toggle", onAction = {
                        events += it
                        if (it.name == "mdClick") trace += "target" else it.preventDefault()
                    }) { AWCComponent("md-button", mapOf("label" to "Toggle", "toggle" to true), onEvent = { name, _ -> trace += name }) }
                }
            }
        } }
        compose.onNodeWithText("Toggle").performClick().assertIsNotSelected()
        compose.runOnIdle {
            assertEquals(listOf("outer:capture", "inner:capture", "target", "inner:bubble", "outer:bubble", "mdClick"), trace)
            assertEquals(listOf("toggle", "inner", "outer"), events.single().path)
            assertTrue(events.single().defaultPrevented); trace.clear(); cancel = false
        }
        compose.onNodeWithText("Toggle").performClick().assertIsSelected()
        compose.runOnIdle {
            assertEquals("mdChange", trace.last()); assertEquals("mdChange", events.last().name)
            assertFalse(events.last().cancelable); assertFalse(events.last().defaultPrevented)
            assertTrue(events.all { it.targetID == "toggle" && it.phase == AWCEventPhase.NONE })
        }
    }

    @Test fun targetImmediateStopSkipsSecondListenerAndBubbleButNotNativeNavigation() {
        lateinit var navigation: AWCNavigationCoordinator
        val trace = mutableListOf<String>()
        compose.setContent { AWCTheme {
            navigation = rememberAWCNavigationCoordinator("https://awc.local/demo/")
            AWCNavigationScope(navigation) {
                AWCActionScope(onAction = { trace += "bubble" }) {
                    AWCActionTargetScope(onAction = { trace += "target"; it.stopImmediatePropagation() }, listeners = listOf({ trace += "second" })) {
                        AWCComponent("md-button", mapOf("label" to "Go", "href" to "next"), onEvent = { name, _ -> trace += name })
                    }
                }
            }
        } }
        compose.onNodeWithText("Go").performClick()
        compose.runOnIdle {
            assertEquals(listOf("target", "mdClick"), trace)
            assertEquals("https://awc.local/demo/next", navigation.activeContext.currentURL)
            assertEquals(2, navigation.activeContext.history.size)
        }
    }

    @Test fun actualDemoReusesNamedContextsAndShowsCanceledAndRejectedDefaults() {
        val events = mutableListOf<Pair<String, AWCValue>>()
        compose.setContent { AWCTheme { AWCButtonNavigationDemo(onEvent = { name, detail -> events += name to detail }) } }
        compose.onNodeWithText("report").performClick()
        compose.onNodeWithText("Navigate").performClick()
        compose.onNodeWithText("Contexts: 4").assertExists()
        compose.onNodeWithText("Navigate").performClick()
        compose.onNodeWithText("Contexts: 4").assertExists()
        compose.onNodeWithText("Back").performClick()
        compose.onNodeWithContentDescription("Cancel default").performClick()
        compose.onNodeWithText("Navigate").performClick()
        compose.onNodeWithText("History: 1/2 · Status: Default canceled").assertExists()
        compose.onNodeWithContentDescription("Cancel default").performClick()
        compose.onNodeWithContentDescription("Reject navigation").performClick()
        compose.onNodeWithText("_blank").performClick()
        compose.onNodeWithText("Navigate").performClick()
        compose.onNodeWithText("Contexts: 4").assertExists()
        compose.onNodeWithText("History: 1/2 · Status: Navigation rejected").assertExists()
        compose.runOnIdle {
            val phases = events.filter { it.first == "mdEventPhase" }.map { (it.second as Map<*, *>)["label"] }
            assertTrue(phases.containsAll(listOf("outer:capture", "inner:capture", "button:target", "button:second", "inner:bubble", "outer:bubble")))
            assertEquals(3, events.count { it.first == "mdNavigate" })
        }
    }

    @Test fun nestedNativeContextRoutesParentAndTopFromActualButtons() {
        lateinit var navigation: AWCNavigationCoordinator
        lateinit var child: AWCNavigationContext; lateinit var grandchild: AWCNavigationContext
        compose.setContent { AWCTheme {
            navigation = rememberAWCNavigationCoordinator("https://awc.local/demo/")
            child = remember { navigation.createContext("child") }
            grandchild = remember { navigation.createContext("grandchild", child.id) }
            AWCNavigationScope(navigation, grandchild.id) { Column {
                AWCComponent("md-button", mapOf("label" to "Parent", "href" to "parent", "target" to "_parent"))
                AWCComponent("md-button", mapOf("label" to "Top", "href" to "top", "target" to "_top"))
            } }
        } }
        compose.onNodeWithText("Parent").performClick()
        compose.runOnIdle { assertEquals(child.id, navigation.activeContextID); assertEquals("https://awc.local/demo/parent", child.currentURL) }
        compose.onNodeWithText("Top").performClick()
        compose.runOnIdle { assertEquals("root", navigation.activeContextID); assertEquals("https://awc.local/demo/top", navigation.activeContext.currentURL) }
    }
    @Test fun actualDemoParentAndTopHaveDifferentNativeDestinations() {
        compose.setContent { AWCTheme { AWCButtonNavigationDemo() } }
        compose.onNodeWithText("Source: editor · Current: editor").assertExists()
        compose.onNodeWithText("_parent").performClick()
        compose.onNodeWithText("Navigate").performClick()
        compose.onNodeWithText("Source: editor · Current: section").assertExists()
        compose.onNodeWithText("_top").performClick()
        compose.onNodeWithText("Navigate").performClick()
        compose.onNodeWithText("Source: editor · Current: root").assertExists()
        compose.onNodeWithText("Contexts: 3").assertExists()
    }

}
