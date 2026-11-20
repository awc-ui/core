@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeIconButtonParityTest {
    @get:Rule val compose=createComposeRule()

    @Test fun all75SizeDensityWidthCombinationsHaveMeasuredSourceGeometry() {
        var size by mutableStateOf("sm");var density by mutableStateOf(0);var width by mutableStateOf("default")
        val collector=AWCInspectionCollector()
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { AWCInspectionScope(collector) {
            AWCComponent("md-icon-button",mapOf("size" to size,"density" to density,"buttonWidth" to width,"icon" to "favorite"))
        } } }
        val sizes=listOf("xs","sm","md","lg","xl")
        val heights=listOf(32.0,40.0,56.0,96.0,136.0)
        val widths=mapOf("narrow" to listOf(28.0,32.0,48.0,64.0,104.0),"default" to heights,"wide" to listOf(40.0,52.0,72.0,128.0,184.0))
        for((i,value) in sizes.withIndex()) for(d in 0 downTo -4) for(w in widths.keys) {
            compose.runOnIdle { size=value;density=d;width=w }
            compose.mainClock.advanceTimeBy(1000)
            compose.runOnIdle {
                val nodes=collector.snapshot().nodes.associateBy { it.id }
                val bounds=nodes.getValue("component").bounds
                assertEquals("$value/$d/$w width",maxOf(32.0,widths.getValue(w)[i]+4*d),bounds.width,.5)
                assertEquals("$value/$d/$w height",maxOf(32.0,heights[i]+4*d),bounds.height,.5)
                val expected=maxOf(listOf(16.0,18.0,18.0,24.0,28.0)[i],listOf(20.0,24.0,24.0,32.0,40.0)[i]+d*listOf(1.0,1.0,1.0,2.0,3.0)[i])
                assertEquals(expected,nodes.getValue("component.icon").bounds.width,.5)
                assertEquals(bounds.x+bounds.width/2,nodes.getValue("component.icon").bounds.let { it.x+it.width/2 },.5)
                assertTrue(nodes.containsKey("component.state-layer"))
            }
        }
    }

    @Test fun pointerKeyboardAndSemanticsActivateOnceWithCommittedSelectedPayload() {
        val events=mutableListOf<Pair<String,AWCValue>>()
        val sources=mutableListOf<String>()
        var disabled by mutableStateOf(false);var soft by mutableStateOf(false)
        compose.setContent { AWCTheme { AWCActionScope(onAction={sources+=it.activation.source}) {
            AWCComponent("md-icon-button",mapOf("icon" to "favorite","aria-label" to "Save","toggle" to true,
                "disabled" to disabled,"softDisabled" to soft),modifier=Modifier.testTag("icon"),onEvent={name,value->events+=name to value})
        } } }
        val target=compose.onNodeWithContentDescription("Save")
        target.performTouchInput { down(center);up() }
        compose.runOnIdle { assertEquals(listOf("mdClick"),events.map { it.first });assertEquals(mapOf("selected" to true),events.last().second) }
        target.performKeyInput { keyDown(Key.Spacebar);keyUp(Key.Spacebar) }
        compose.runOnIdle { assertEquals(2,events.size);assertEquals(mapOf("selected" to false),events.last().second) }
        target.performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.runOnIdle { assertEquals(listOf("pointer","keyboard","accessibility"),sources);soft=true }
        target.assertIsNotEnabled().performClick()
        target.performKeyInput { keyDown(Key.Enter);keyUp(Key.Enter) }
        compose.runOnIdle { assertEquals(3,events.size);soft=false;disabled=true }
        target.assertIsNotEnabled()
        compose.runOnIdle { assertEquals(3,events.size) }
    }

    @Test fun registryReplacementSelectedFallbackAndAdornmentSizingFollowSource() {
        var selected by mutableStateOf(false)
        var customSelected by mutableStateOf(false)
        var avatar by mutableStateOf(false)
        val collector=AWCInspectionCollector()
        compose.setContent { AWCTheme { AWCInspectionScope(collector) {
            AWCSlotsScope(AWCSlotRegistry(buildMap {
                put("") {
                    if(avatar) AWCComponent("md-avatar",mapOf("initials" to "AB","size" to 48),modifier=Modifier.testTag("avatar"))
                    else AWCComponent("md-badge",mapOf("value" to "3"),modifier=Modifier.testTag("badge"))
                }
                if(customSelected) put("selected") { AWCMaterialSymbol("check",Modifier.testTag("custom")) }
            })) {
                AWCComponent("md-icon-button",mapOf("icon" to "favorite","toggle" to true,"selected" to selected),modifier=Modifier.testTag("root"))
            }
        } } }
        compose.onNodeWithTag("badge",true).assertExists()
        compose.onNodeWithText("favorite",useUnmergedTree=true).assertExists()
        compose.runOnIdle { selected=true }
        // Selected with no replacement keeps default content and its badge.
        compose.onNodeWithTag("badge",true).assertExists()
        compose.runOnIdle { customSelected=true }
        compose.onNodeWithTag("custom",true).assertIsDisplayed()
        compose.onNodeWithTag("badge",true).assertIsNotDisplayed()
        compose.runOnIdle { selected=false;avatar=true }
        val bounds=compose.onNodeWithTag("avatar",true).getUnclippedBoundsInRoot()
        assertEquals(48f,bounds.width.value,.5f)
        compose.onNodeWithText("favorite",useUnmergedTree=true).assertDoesNotExist()
    }

    // R1-07: the selectedIcon property. toggle + selected shows the selectedIcon glyph in the selected-icon part; not selected shows
    // the icon glyph in the icon part; a selected non-toggle ignores selectedIcon and keeps the default slot (as on SwiftUI).
    @Test fun selectedIconPropertyFollowsToggleAndSelection() {
        var toggle by mutableStateOf(true); var selected by mutableStateOf(true)
        val collector=AWCInspectionCollector()
        compose.setContent { AWCTheme { AWCInspectionScope(collector) {
            AWCComponent("md-icon-button",mapOf("icon" to "favorite","selectedIcon" to "close","toggle" to toggle,"selected" to selected),modifier=Modifier.testTag("root"))
        } } }
        fun parts()=compose.runOnIdle { collector.snapshot().nodes.associate { it.id to it.bounds } }
        fun shows(glyph:String,hidden:String) { compose.onNodeWithText(glyph,useUnmergedTree=true).assertExists();compose.onNodeWithText(hidden,useUnmergedTree=true).assertDoesNotExist() }
        shows("close","favorite")
        parts().let { assertEquals(24.0,it["component.selected-icon"]!!.width,.5);assertNull(it["component.icon"]) }
        compose.runOnIdle { selected=false }
        shows("favorite","close")
        parts().let { assertEquals(24.0,it["component.icon"]!!.width,.5);assertNull(it["component.selected-icon"]) }
        compose.runOnIdle { toggle=false;selected=true }
        shows("favorite","close")
        parts().let { assertNotNull(it["component.icon"]);assertNull(it["component.selected-icon"]) }
    }

    @Test fun editorEmptyTextSlotSuppressesFallbackUntilOmitted() {
        var slotValue by mutableStateOf<String?>("")
        compose.setContent { AWCTheme {
            AWCComponent("md-icon-button",mapOf("icon" to "favorite")) { slot ->
                LivePreviewSampleSlot("md-icon-button",slot,"",null,
                    slotValue?.let { mapOf("" to it) } ?: emptyMap()) { _,_-> }
            }
        } }
        compose.onNodeWithText("favorite",useUnmergedTree=true).assertDoesNotExist()
        compose.runOnIdle { slotValue="  " }
        compose.onNodeWithText("favorite",useUnmergedTree=true).assertDoesNotExist()
        compose.runOnIdle { slotValue=null }
        compose.onNodeWithText("favorite",useUnmergedTree=true).assertExists()
    }

    @Test fun allNineAppearanceFieldsApplyAndDisabledPaletteOverridesCustomInk() {
        val collector=AWCInspectionCollector()
        var disabled by mutableStateOf(false)
        var variant by mutableStateOf("filled")
        var selected by mutableStateOf(false)
        var scheme:ColorScheme?=null
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme {
            scheme=MaterialTheme.colorScheme
            Box(Modifier.background(Color.Black).padding(8.dp)) { AWCInspectionScope(collector) {
                AWCIconButtonAppearanceScope(AWCIconButtonAppearance(containerColor="#FF0000",iconColor="#00FF00",
                    stateLayerColor="#0000FF",iconSize=34.0,cornerRadius=0.0,outlineColor="#FFFFFF",outlineWidth=4.0,width=90.0,height=70.0)) {
                    AWCComponent("md-icon-button",mapOf("variant" to variant,"disabled" to disabled,"selected" to selected,"shapeMorph" to false),
                        modifier=Modifier.testTag("root"))
                }
            } }
        } }
        fun pixels()=compose.onNodeWithTag("root",true).captureToImage().toPixelMap()
        fun assertColor(expected:Color,actual:Color) {
            assertEquals(expected.red,actual.red,.02f);assertEquals(expected.green,actual.green,.02f);assertEquals(expected.blue,actual.blue,.02f)
        }
        compose.mainClock.advanceTimeBy(1000)
        compose.runOnIdle {
            val nodes=collector.snapshot().nodes.associateBy { it.id }
            assertEquals(90.0,nodes.getValue("component").bounds.width,.5)
            assertEquals(70.0,nodes.getValue("component").bounds.height,.5)
            assertEquals(34.0,nodes.getValue("component.icon").bounds.width,.5)
        }
        pixels().let { assertColor(Color.Red,it[it.width/2,it.height/2]) }
        compose.runOnIdle { disabled=true };compose.mainClock.advanceTimeBy(1000)
        pixels().let { val c=scheme!!.onSurface;assertColor(Color(c.red*.12f,c.green*.12f,c.blue*.12f),it[it.width/2,it.height/2]) }
        compose.runOnIdle { variant="outlined" };compose.mainClock.advanceTimeBy(1000)
        pixels().let { assertColor(Color.Red,it[it.width/2,it.height/2]) }
        compose.runOnIdle { disabled=false };compose.mainClock.advanceTimeBy(1000)
        pixels().let { assertColor(Color.White,it[1,it.height/2]) }
        compose.runOnIdle { selected=true };compose.mainClock.advanceTimeBy(1000)
        pixels().let { assertColor(Color.Red,it[1,it.height/2]) } // selected outlined hides even custom outline.
    }

    @Test fun sourcePalettesToggleAndNonToggleSelectionRenderNativePixels() {
        var variant by mutableStateOf("standard")
        var selected by mutableStateOf(false)
        var toggle by mutableStateOf(false)
        var disabled by mutableStateOf(false)
        var colors:ColorScheme?=null
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { colors=MaterialTheme.colorScheme
            Box(Modifier.background(Color.Black)) {
                AWCComponent("md-icon-button",mapOf("variant" to variant,"selected" to selected,"toggle" to toggle,
                    "disabled" to disabled,"shapeMorph" to false),modifier=Modifier.testTag("root"))
            }
        } }
        for(v in listOf("standard","filled","tonal","outlined")) for(t in listOf(false,true)) for(s in listOf(false,true)) for(d in listOf(false,true)) {
            compose.runOnIdle { variant=v;toggle=t;selected=s;disabled=d };compose.mainClock.advanceTimeBy(1000)
            val expected=if(d) {
                if(v in listOf("filled","tonal")) colors!!.onSurface.let { Color(it.red*.12f,it.green*.12f,it.blue*.12f) }
                else Color.Black
            } else when(v) {
                "filled" -> if(t && !s) colors!!.surfaceContainerHighest else colors!!.primary
                "tonal" -> if(t && !s) colors!!.surfaceContainerHighest else colors!!.secondaryContainer
                "outlined" -> if(s) colors!!.inverseSurface else Color.Black
                else -> Color.Black
            }
            val p=compose.onNodeWithTag("root",true).captureToImage().toPixelMap()
            val actual=p[p.width/2,p.height/2]
            assertEquals("$v/$t/$s/$d",expected.red,actual.red,.02f)
            assertEquals("$v/$t/$s/$d",expected.green,actual.green,.02f)
            assertEquals("$v/$t/$s/$d",expected.blue,actual.blue,.02f)
        }
    }

    @Test fun connectedCornersUseLogicalDirectionAndOverrideFixedRadius() {
        var rtl by mutableStateOf(false)
        compose.mainClock.autoAdvance=false
        compose.setContent { CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
            AWCTheme { Box(Modifier.background(Color.Black)) {
                AWCIconButtonAppearanceScope(AWCIconButtonAppearance(containerColor="#FFFFFF",cornerRadius=0.0)) {
                    AWCComponent("md-icon-button",mapOf("size" to "md","connectedRight" to true),modifier=Modifier.testTag("root"))
                }
            } }
        } }
        fun cornerPair():Pair<Float,Float> {
            val p=compose.onNodeWithTag("root",true).captureToImage().toPixelMap()
            val inset=(4*compose.density.density).toInt()
            return p[inset,inset].red to p[p.width-1-inset,inset].red
        }
        compose.mainClock.advanceTimeBy(1000)
        cornerPair().let { assertTrue(it.first<.1f);assertTrue(it.second>.9f) }
        compose.runOnIdle { rtl=true };compose.mainClock.advanceTimeBy(1000)
        cornerPair().let { assertTrue(it.first>.9f);assertTrue(it.second<.1f) }
    }

    @Test fun pressCancellationDoesNotActivateAndRippleCanBeDisabled() {
        val events=mutableListOf<String>()
        var ripple by mutableStateOf(false)
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme {
            AWCIconButtonAppearanceScope(AWCIconButtonAppearance(containerColor="#FFFFFF",stateLayerColor="#FF0000",iconColor="#0000FF")) {
                AWCComponent("md-icon-button",mapOf("size" to "lg","shapeMorph" to false,"ripple" to ripple),
                    modifier=Modifier.testTag("root"),onEvent={name,_->events+=name})
            }
        } }
        val target=compose.onNodeWithTag("root",true)
        compose.mainClock.advanceTimeBy(1000)
        fun heldCenter():Color {
            target.performTouchInput { down(center) }
            compose.mainClock.advanceTimeBy(300)
            val p=target.captureToImage().toPixelMap()
            val color=p[p.width/2,p.height/2]
            target.performTouchInput { cancel() }
            compose.mainClock.advanceTimeBy(1000)
            return color
        }
        val noRipple=heldCenter()
        compose.runOnIdle { ripple=true };compose.mainClock.advanceTimeBy(1000)
        val withRipple=heldCenter()
        assertTrue("Blue icon ink adds ripple independently of the red state layer",withRipple.red<noRipple.red-.04f)
        assertTrue("Ripple uses icon ink rather than state-layer ink",withRipple.blue>noRipple.blue+.005f)
        compose.runOnIdle { assertTrue(events.isEmpty()) }
    }

    @Test fun outlinedStateLayerUsesTheInnerBorderBoxAndDoesNotFillTransparentSelectedBorder() {
        val collector=AWCInspectionCollector()
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { AWCInspectionScope(collector) {
            AWCIconButtonAppearanceScope(AWCIconButtonAppearance(containerColor="#FFFFFF",stateLayerColor="#FF0000",
                width=80.0,height=80.0,cornerRadius=0.0,outlineWidth=16.0)) {
                AWCComponent("md-icon-button",mapOf("variant" to "outlined","selected" to true,"shapeMorph" to false,"ripple" to false),
                    modifier=Modifier.testTag("root"))
            }
        } } }
        val root=compose.onNodeWithTag("root",true)
        compose.mainClock.advanceTimeBy(1000)
        root.performTouchInput { down(center) };compose.mainClock.advanceTimeBy(300)
        compose.runOnIdle {
            val nodes=collector.snapshot().nodes.associateBy { it.id }
            val bounds=nodes.getValue("component").bounds;val layer=nodes.getValue("component.state-layer").bounds
            assertEquals(48.0,layer.width,.5);assertEquals(48.0,layer.height,.5)
            assertEquals(bounds.x+16,layer.x,.5);assertEquals(bounds.y+16,layer.y,.5)
        }
        val pixels=root.captureToImage().toPixelMap()
        val border=pixels[(8*compose.density.density).toInt(),pixels.height/2]
        val inside=pixels[pixels.width/2,pixels.height/2]
        assertEquals(1f,border.green,.01f);assertTrue(inside.green<.9f)
        root.performTouchInput { cancel() }
    }

    @Test fun selectedAndPressedMorphOverrideOnlyRestingRadiusAndShapeMorphCanFreezeIt() {
        var selected by mutableStateOf(false)
        var morph by mutableStateOf(true)
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { Box(Modifier.background(Color.Black)) {
            AWCIconButtonAppearanceScope(AWCIconButtonAppearance(containerColor="#FFFFFF",cornerRadius=0.0)) {
                AWCComponent("md-icon-button",mapOf("size" to "md","selected" to selected,"shapeMorph" to morph,
                    "ripple" to false),modifier=Modifier.testTag("root"))
            }
        } } }
        val root=compose.onNodeWithTag("root",true)
        fun corner():Float {
            val p=root.captureToImage().toPixelMap();val edge=(3*compose.density.density).toInt()
            return p[edge,edge].red
        }
        compose.mainClock.advanceTimeBy(1000)
        assertTrue(corner()>.9f)
        compose.runOnIdle { selected=true };compose.mainClock.advanceTimeBy(1000)
        assertTrue("Selected source radius overrides explicit resting radius even without toggle",corner()<.1f)
        compose.runOnIdle { morph=false };compose.mainClock.advanceTimeBy(1000)
        assertTrue(corner()>.9f)
        compose.runOnIdle { selected=false;morph=true };compose.mainClock.advanceTimeBy(1000)
        root.performTouchInput { down(center) };compose.mainClock.advanceTimeBy(300)
        assertTrue("Pressed radius overrides resting radius",corner()<.1f)
        root.performTouchInput { cancel() };compose.mainClock.advanceTimeBy(1000)
        assertTrue(corner()>.9f)
    }

    @Test fun softDisabledAndNegativeTabindexKeepExplicitFocusButHardDisabledDoesNot() {
        val focus=AWCButtonFocusState()
        var soft by mutableStateOf(true)
        var hard by mutableStateOf(false)
        var activated=0
        compose.setContent { AWCTheme { AWCButtonFocusScope(focus) {
            AWCComponent("md-icon-button",mapOf("aria-label" to "Save","softDisabled" to soft,"disabled" to hard,
                "groupTabindex" to -1),onEvent={_,_->activated++})
        } } }
        compose.runOnIdle { assertTrue(focus.requestFocus()) }
        compose.waitForIdle()
        compose.runOnIdle { assertTrue(focus.isFocused) }
        compose.onNodeWithContentDescription("Save").performKeyInput { keyDown(Key.Enter);keyUp(Key.Enter) }
        compose.runOnIdle { assertEquals(0,activated);soft=false }
        compose.onNodeWithContentDescription("Save").performKeyInput { keyDown(Key.Enter);keyUp(Key.Enter) }
        compose.runOnIdle { assertEquals(1,activated);hard=true }
        compose.waitForIdle()
        compose.runOnIdle { assertFalse(focus.requestFocus()) }
    }

    @Test fun groupInjectsGeometrySelectionAndRovingFocusIntoIconChildren() {
        val events=mutableListOf<String>()
        compose.setContent { AWCTheme {
            AWCComponent("md-button-group",mapOf("size" to "md","variant" to "connected"),
                onEvent={name,_->events+=name}) {
                Row {
                    AWCComponent("md-icon-button",mapOf("aria-label" to "First","value" to "a"),
                        modifier=Modifier.testTag("first"),onEvent={name,_->events+=name})
                    AWCComponent("md-icon-button",mapOf("aria-label" to "Second","value" to "b"),
                        modifier=Modifier.testTag("second"))
                }
            }
        } }
        compose.onNodeWithTag("first",true).assertHeightIsEqualTo(56.dp)
        compose.onNodeWithContentDescription("First").performTouchInput { click() }
        compose.runOnIdle { assertEquals(listOf("mdClick","mdSelectionChange"),events) }
        compose.onNodeWithContentDescription("First").assertIsSelected()
        compose.onNodeWithContentDescription("First").performKeyInput { keyDown(Key.DirectionRight);keyUp(Key.DirectionRight) }
        compose.onNodeWithContentDescription("Second").assertIsFocused().assertIsNotSelected()
    }
}
