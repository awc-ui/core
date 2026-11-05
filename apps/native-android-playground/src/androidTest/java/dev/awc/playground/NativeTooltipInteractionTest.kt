package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalTestApi::class)
class NativeTooltipInteractionTest {
    @get:Rule val compose=createComposeRule()
    @Test fun realAuthoredSlotsKeepCallbacksAndDescriptionsFollowVisibleContent() {
        val controller=AWCTooltipController();var mode by mutableIntStateOf(0);var clicks=0
        val events=mutableListOf<Pair<String,AWCValue>>();val propagated=mutableListOf<String>();val targetEvents=mutableListOf<AWCActionEvent>()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCTooltipScope(Modifier.requiredSize(600.dp,400.dp)) {
                Box(Modifier.fillMaxSize(),contentAlignment=androidx.compose.ui.Alignment.Center) {
                    AWCTooltipControllerScope(controller) { AWCActionScope(onAction={propagated+=it.name},onCapture={propagated+="capture:${it.name}"},id="outer") {
                        val slots=mutableMapOf<String,@Composable ()->Unit>("" to { AWCComponent("md-button",mapOf("label" to "Anchor")) })
                        if(mode==0) {
                            slots["subhead"]={AWCSlotText("Authored heading")};slots["content"]={AWCSlotText("Authored support")}
                            slots["actions"]={AWCComponent("md-button",mapOf("label" to "Read more"),onEvent={n,_->if(n=="mdClick") clicks++})}
                        } else if(mode==1) { slots["subhead"]={};slots["content"]={};slots["actions"]={} }
                        AWCSlotsScope(AWCSlotRegistry(slots)) { AWCActionTargetScope(onAction={targetEvents+=it}) {
                            AWCComponent("md-tooltip",mapOf("open" to true,"variant" to "rich","subhead" to "Fallback heading","text" to "Fallback support"),onEvent={n,d->events+=n to d})
                        } }
                    } }
                }
            } }
        } } }
        compose.onNodeWithText("Authored support").assertExists();compose.onNodeWithText("Fallback support").assertDoesNotExist()
        val description=compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.CustomActions)).fetchSemanticsNode().config[SemanticsActions.CustomActions]
        assertEquals(listOf("Authored heading. Authored support"),description.map { it.label })
        compose.runOnIdle {
            assertEquals(listOf("mdOpen" to null),events);assertEquals(listOf("capture:mdOpen"),propagated)
            assertEquals(1,targetEvents.size);assertFalse(targetEvents.single().bubbles);assertFalse(targetEvents.single().crossesBoundaries);assertNull(targetEvents.single().rawDetail)
        }
        compose.onNodeWithText("Read more").performClick();compose.runOnIdle { assertEquals(1,clicks);assertTrue(controller.isOpen);mode=1 }
        compose.onNodeWithText("Authored support").assertDoesNotExist();compose.onNodeWithText("Fallback support").assertDoesNotExist();compose.onNodeWithText("Read more").assertDoesNotExist()
        compose.runOnIdle { mode=2 }
        compose.onNodeWithText("Fallback support").assertExists()
        assertEquals(listOf("Fallback heading. Fallback support"),compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.CustomActions)).fetchSemanticsNode().config[SemanticsActions.CustomActions].map { it.label })
        compose.runOnIdle { assertEquals(listOf("mdOpen" to null),events) }
    }

    @Test fun lifecycleEventsCaptureInsideBoundaryWithoutBubblingAndRemainCancelable() {
        val controller=AWCTooltipController();val delivery=mutableListOf<String>();val flags=mutableListOf<List<Boolean>>()
        compose.setContent { AWCTheme(false) { AWCTooltipScope(Modifier.requiredSize(600.dp,400.dp)) {
            AWCActionScope(id="outside",onCapture={delivery+="outside-capture:${it.name}"},onAction={delivery+="outside-bubble:${it.name}"}) {
                AWCActionScope(id="boundary",boundary=true,onCapture={delivery+="boundary-capture:${it.name}"},onAction={delivery+="boundary-bubble:${it.name}"}) {
                    AWCActionTargetScope(id="tooltip",onAction={event->
                        delivery+="target:${event.name}";event.preventDefault()
                        flags+=listOf(event.bubbles,event.crossesBoundaries,event.cancelable,event.defaultPrevented,event.phase==AWCEventPhase.TARGET)
                    }) { AWCTooltipControllerScope(controller) {
                        AWCSlotsScope(AWCSlotRegistry(mapOf("" to { AWCSlotText("Anchor") }))) {
                            AWCComponent("md-tooltip",mapOf("open" to true,"text" to "Information"))
                        }
                    } }
                }
            }
        } } }
        compose.runOnIdle {
            assertTrue(controller.isOpen);assertEquals(listOf("boundary-capture:mdOpen","target:mdOpen"),delivery)
            controller.hide()
        }
        compose.runOnIdle {
            assertFalse(controller.isOpen)
            assertEquals(listOf("boundary-capture:mdOpen","target:mdOpen","boundary-capture:mdClose","target:mdClose"),delivery)
            assertEquals(listOf(listOf(false,false,true,true,true),listOf(false,false,true,true,true)),flags)
        }
    }

    @Test fun arbitraryNativeSlotControlComposesOnceAndRetainsItsActualCallback() {
        var attachments=0;var clicks=0;val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCTooltipScope(Modifier.requiredSize(600.dp,400.dp)) {
                Box(Modifier.fillMaxSize(),contentAlignment=androidx.compose.ui.Alignment.Center) {
                    AWCSlotsScope(AWCSlotRegistry(mapOf(
                        "" to { AWCComponent("md-button",mapOf("label" to "Anchor")) },
                        "content" to {
                            DisposableEffect(Unit) { attachments++;onDispose { attachments-- } }
                            AWCComponent("md-button",mapOf("label" to "Native content action"),onEvent={name,_->if(name=="mdClick") clicks++})
                        }))) { AWCInspectionScope(collector) {
                        AWCComponent("md-tooltip",mapOf("open" to true,"variant" to "rich","text" to "This substantially longer fallback must never determine the authored slot width"))
                    } }
                }
            } }
        } } }
        compose.onNodeWithText("Native content action").performClick()
        compose.runOnIdle {
            assertEquals(1,attachments);assertEquals(1,clicks)
            val popup=collector.snapshot().nodes.single { it.id=="component.popup" }
            assertTrue("Natural authored content determines popup width",popup.bounds.width<320)
        }
    }

    @Test fun realFocusGraceEscapeAndTouchAccessibilityActionPreserveAnchorRole() {
        val controller=AWCTooltipController();val events=mutableListOf<Pair<String,AWCValue>>()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCTooltipScope(Modifier.requiredSize(600.dp,400.dp)) {
                AWCComponent("md-button",mapOf("label" to "Outside"))
                Box(Modifier.fillMaxSize(),contentAlignment=androidx.compose.ui.Alignment.Center) {
                    AWCTooltipControllerScope(controller) { AWCSlotsScope(AWCSlotRegistry(mapOf(
                        "" to { AWCComponent("md-button",mapOf("label" to "Anchor")) },
                        "actions" to { AWCComponent("md-button",mapOf("label" to "Read more")) }))) {
                        AWCComponent("md-tooltip",mapOf("text" to "Details","variant" to "rich","showDelay" to 500,"hideDelay" to 200),onEvent={n,d->events+=n to d})
                    } }
                }
            } }
        } } }
        compose.onNodeWithText("Anchor").assert(SemanticsMatcher.expectValue(SemanticsProperties.Role,Role.Button))
        compose.onNodeWithText("Anchor").performSemanticsAction(SemanticsActions.RequestFocus)
        compose.mainClock.advanceTimeBy(550);compose.waitForIdle();compose.runOnIdle { assertTrue(controller.isOpen) }
        compose.onNodeWithText("Read more").performSemanticsAction(SemanticsActions.RequestFocus)
        compose.mainClock.advanceTimeBy(300);compose.runOnIdle { assertTrue(controller.isOpen) }
        compose.onNodeWithText("Read more").performKeyInput { keyDown(Key.Escape);keyUp(Key.Escape) }
        compose.runOnIdle { assertFalse(controller.isOpen) }
        compose.onNodeWithText("Anchor").assertIsFocused()
        compose.mainClock.advanceTimeBy(700);compose.runOnIdle { assertFalse(controller.isOpen) }
        compose.onNodeWithText("Outside").performSemanticsAction(SemanticsActions.RequestFocus)
        val action=compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.CustomActions)).fetchSemanticsNode().config[SemanticsActions.CustomActions].single()
        compose.runOnIdle { assertTrue(action.action()) }
        compose.runOnIdle { assertTrue(controller.isOpen) }
        compose.onNodeWithText("Outside").assertIsFocused()
        compose.onNodeWithText("Outside").performKeyInput { keyDown(Key.Escape);keyUp(Key.Escape) }
        compose.runOnIdle { assertFalse(controller.isOpen) };compose.onNodeWithText("Outside").assertIsFocused()
    }
}
