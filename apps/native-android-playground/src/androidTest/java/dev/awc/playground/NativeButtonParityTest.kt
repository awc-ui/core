@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/** Exercises public native APIs against the observable Web button contract. */
class NativeButtonParityTest {
    @get:Rule val compose = createComposeRule()

    @Test fun dimensionsRespectMinimumMaximumFullWidthAndIntrinsicSingleLineContent() {
        var appearance by mutableStateOf(AWCButtonAppearance(width=160.0, height=64.0))
        var fullWidth by mutableStateOf(false)
        val collector = AWCInspectionCollector()
        compose.setContent { AWCTheme {
            Box(Modifier.width(300.dp)) {
                AWCInspectionScope(collector) { AWCButtonAppearanceScope(appearance) {
                    AWCComponent("md-button", mapOf("label" to "A very long unwrapped action label", "fullWidth" to fullWidth),
                        modifier=Modifier.testTag("button"))
                } }
            }
        } }
        fun bounds() = compose.onNodeWithTag("button", true).fetchSemanticsNode().boundsInRoot
        fun assertSize(width: Float, height: Float) {
            assertEquals(width * compose.density.density, bounds().width, 1f)
            assertEquals(height * compose.density.density, bounds().height, 1f)
        }
        assertSize(160f,64f)
        compose.runOnIdle {
            val nodes = collector.snapshot().nodes.associateBy { it.id }
            assertTrue("Long label keeps its intrinsic width instead of wrapping", nodes.getValue("component.content.label").bounds.width > 160)
            assertEquals(20.0, nodes.getValue("component.content.label").bounds.height, 1.0)
            fullWidth=true
        }
        assertSize(160f,64f) // Explicit width wins over fullWidth.
        compose.runOnIdle { appearance=AWCButtonAppearance(width=20.0,height=10.0,minWidth=90.0,minHeight=50.0,maxWidth=80.0) }
        assertSize(90f,50f) // CSS minimum wins over conflicting width/maximum.
        compose.runOnIdle { appearance=AWCButtonAppearance() }
        assertSize(300f,40f) // An omitted maximum preserves the parent's available width.
        compose.runOnIdle { appearance=AWCButtonAppearance(maxWidth=600.0) }
        assertSize(300f,40f) // A larger maximum does not force fullWidth to overflow its parent.
        compose.runOnIdle { appearance=AWCButtonAppearance(maxWidth=180.0) }
        assertSize(180f,40f) // A maximum still constrains fullWidth.
        compose.runOnIdle { fullWidth=false }
        assertSize(180f,40f)
        compose.runOnIdle { appearance=AWCButtonAppearance(width=0.0,minWidth=0.0,height=0.0,minHeight=0.0,paddingInline=24.0,paddingBlock=10.0) }
        assertSize(48f,20f)
        compose.runOnIdle { appearance=AWCButtonAppearance(width=600.0) }
        compose.runOnIdle {
            assertEquals("Explicit width can overflow the preview parent",600.0,
                collector.snapshot().nodes.single { it.id=="component" }.bounds.width,.5)
        }
    }

    @Test fun symbolSlotsInheritRealIconSizeAndLoaderOverrideDoesNotShrinkAuthoredProgress() {
        val collector = AWCInspectionCollector()
        var progress by mutableStateOf(false)
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme {
            AWCInspectionScope(collector) {
                AWCButtonAppearanceScope(AWCButtonAppearance(iconSize=40.0,loadingSize=12.0)) {
                    AWCComponent("md-button", mapOf("label" to "Load","loading" to true)) { slot ->
                        when(slot) {
                            "leading-icon" -> AWCMaterialSymbol("favorite",Modifier.testTag("symbol"))
                            "loader" -> if(progress) AWCComponent("md-progress-indicator",
                                mapOf("variant" to "circular","indeterminate" to true,"size" to 24),modifier=Modifier.testTag("progress"))
                        }
                    }
                }
            }
        } }
        compose.mainClock.advanceTimeBy(32)
        compose.runOnIdle {
            val nodes=collector.snapshot().nodes.associateBy { it.id }
            assertEquals(40.0,nodes.getValue("component.content.leading-icon").bounds.width,.1)
            assertEquals(12.0,nodes.getValue("component.content.loader").bounds.width,.5)
            progress=true
        }
        compose.mainClock.advanceTimeBy(32)
        val progressBounds=compose.onNodeWithTag("progress",true).fetchSemanticsNode().boundsInRoot
        assertEquals(24f*compose.density.density,progressBounds.width,1f)
        compose.runOnIdle {
            assertEquals(24.0,collector.snapshot().nodes.single { it.id=="component.content.loader" }.bounds.width,.1)
        }
        compose.onNodeWithTag("symbol",true).assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.HideFromAccessibility))
        val actionText=compose.onNode(hasClickAction()).fetchSemanticsNode().config.getOrElse(SemanticsProperties.Text) { emptyList() }
        assertFalse("Decorative symbol name must not enter the action label",actionText.any { it.text.contains("favorite") })
    }

    @Test fun defaultLoaderUsesOverriddenIconSize() {
        val collector=AWCInspectionCollector()
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme {
            AWCInspectionScope(collector) { AWCButtonAppearanceScope(AWCButtonAppearance(iconSize=40.0)) {
                AWCComponent("md-button",mapOf("label" to "Load","loading" to true))
            } }
        } }
        compose.mainClock.advanceTimeBy(32)
        compose.runOnIdle {
            assertEquals(28.0,collector.snapshot().nodes.single { it.id=="component.content.loader" }.bounds.width,.5)
        }
    }

    @Test fun explicitLineHeightIsAnExactLineBoxEvenBelowGlyphSize() {
        val collector=AWCInspectionCollector()
        compose.setContent { AWCTheme {
            AWCInspectionScope(collector) {
                AWCButtonAppearanceScope(AWCButtonAppearance(fontSize=48.0,lineHeight=12.0,minHeight=0.0)) {
                    AWCComponent("md-button",mapOf("label" to "Text"))
                }
            }
        } }
        compose.runOnIdle {
            val nodes=collector.snapshot().nodes.associateBy { it.id }
            assertEquals(12.0,nodes.getValue("component.content.label").bounds.height,.6)
            assertEquals(12.0,nodes.getValue("component").bounds.height,.6)
        }
    }

    @Test fun loadingRetainsHoverStateButCannotActivateAndExplicitFocusRingColorIsUsed() {
        var loading by mutableStateOf(true)
        val events=mutableListOf<String>()
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme(darkTheme=false) {
            Box(Modifier.testTag("surface").background(Color.White).padding(24.dp)) {
                AWCButtonAppearanceScope(AWCButtonAppearance(containerColor="#FFFFFF",stateLayerColor="#FF0000",
                    hoverOpacity=.5,pressedOpacity=.75,focusRingColor="#00FF00",cornerRadius=0.0)) {
                    AWCComponent("md-button",mapOf("label" to "Action","loading" to loading,"ripple" to false),
                        modifier=Modifier.testTag("button"),onEvent={name,_->events+=name})
                }
            }
        } }
        val button=compose.onNodeWithText("Action")
        button.performMouseInput { enter(center) }
        compose.mainClock.advanceTimeBy(400)
        val hover=button.captureToImage().toPixelMap()[2,2]
        assertEquals(1f,hover.red,.02f); assertEquals(.5f,hover.green,.02f)
        button.performTouchInput { down(center) }
        compose.mainClock.advanceTimeBy(300)
        val pressed=button.captureToImage().toPixelMap()[2,2]
        assertEquals("Loading pointer state still follows source :active",.25f,pressed.green,.02f)
        button.performTouchInput { up() }
        compose.runOnIdle { assertTrue(events.isEmpty()); loading=false }
        button.performTouchInput { click(center) }
        button.performKeyInput { pressKey(Key.DirectionRight) }
        compose.mainClock.advanceTimeBy(500)
        val pixels=compose.onNodeWithTag("surface").captureToImage().toPixelMap()
        var green=0
        for(y in 0 until pixels.height) for(x in 0 until pixels.width) {
            val color=pixels[x,y]
            if(color.green>.95f && color.red<.05f && color.blue<.05f) green++
        }
        assertTrue("Focus ring uses the requested green color",green>20)
    }

    @Test fun connectedGroupInjectsButtonSizeShapeAndEmitsChildBeforeGroupChange() {
        val events=mutableListOf<String>()
        compose.setContent { AWCTheme { Box(Modifier.background(Color.Black).padding(8.dp)) {
            AWCButtonAppearanceScope(AWCButtonAppearance(cornerRadius=0.0,containerColor="#FFFFFF")) {
                AWCComponent("md-button-group",mapOf("size" to "md","shape" to "round","variant" to "connected"),
                    onEvent={name,_->events+="group:$name"}) { slot ->
                    if(slot=="") for(label in listOf("Day","Week")) {
                        AWCComponent("md-button",mapOf("label" to label,"value" to label),
                            modifier=Modifier.testTag(label),onEvent={name,_->events+="$label:$name"})
                    }
                }
            }
        } } }
        val day=compose.onNodeWithText("Day")
        assertEquals(56f*compose.density.density,day.fetchSemanticsNode().boundsInRoot.height,1f)
        day.performClick().assertIsSelected()
        compose.runOnIdle { assertEquals(listOf("Day:mdClick","Day:mdChange","group:mdSelectionChange"),events) }
        compose.onNodeWithText("Week").performClick().assertIsSelected()
        day.assertIsNotSelected()
        // Connected corners override a globally supplied square radius.
        val corner=day.captureToImage().toPixelMap()[1,1]
        assertTrue("Round outer connected corner remains clipped",corner.alpha<.1f || abs(corner.red-1f)>.1f)
    }

    @Test fun actualActivationSourceSurvivesCancellationAndScopedPropagation() {
        val actions=mutableListOf<AWCActionEvent>()
        var cancel by mutableStateOf(false)
        compose.setContent { AWCTheme {
            AWCActionScope(onAction={},onCapture={actions+=it},id="outer") {
                AWCActionScope(onAction={if(cancel) {it.preventDefault();it.stopPropagation()}},id="inner") {
                    AWCComponent("md-button",mapOf("label" to "Action","toggle" to true,"ripple" to false))
                }
            }
        } }
        val button=compose.onNodeWithText("Action")
        button.performTouchInput { down(center); advanceEventTime(32); up() }
        compose.runOnIdle {
            val click=actions.last { it.name=="mdClick" }
            assertEquals("pointer",click.activation.source)
            assertTrue(click.activation.x!!>0); assertTrue(click.activation.y!!>0)
            actions.clear()
        }
        button.performKeyInput { pressKey(Key.Enter) }
        compose.runOnIdle { assertEquals("keyboard",actions.first().activation.source); actions.clear(); cancel=true }
        button.performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.runOnIdle {
            assertEquals(1,actions.size)
            assertEquals("accessibility",actions.single().activation.source)
            assertTrue(actions.single().defaultPrevented)
            assertTrue(actions.single().path.size>=3)
        }
    }

    @Test fun hostAcceptsOnlyValidNamedContentDescriptors() {
        val parsed=parseLivePreviewSlots(JSONObject().put("slots",JSONObject()
            .put("leading-icon",JSONObject().put("kind","symbol").put("value","favorite"))
            .put("loader",JSONObject().put("kind","progress"))),"md-button")
        assertEquals(mapOf("kind" to "symbol","value" to "favorite"),parsed["leading-icon"])
        assertEquals(mapOf("kind" to "progress"),parsed["loader"])
        for((name,value) in listOf("" to JSONObject().put("kind","symbol").put("value","add"),
            "leading-icon" to JSONObject().put("kind","progress"),
            "trailing-icon" to JSONObject().put("kind","symbol").put("value","<img>"))) {
            assertThrows(IllegalArgumentException::class.java) {
                parseLivePreviewSlots(JSONObject().put("slots",JSONObject().put(name,value)),"md-button")
            }
        }
    }
}
