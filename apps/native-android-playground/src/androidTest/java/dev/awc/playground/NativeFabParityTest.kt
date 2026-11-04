@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeFabParityTest {
    @get:Rule val compose=createComposeRule()

    @Test fun all15IconOnlySizeDensityCasesAnd45LabelledCasesUseActualSourceGeometry() {
        var size by mutableStateOf("standard");var density by mutableStateOf(0)
        var label by mutableStateOf("");var extended by mutableStateOf<Boolean?>(null)
        val collector=AWCInspectionCollector()
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { AWCInspectionScope(collector) {
            AWCComponent("md-fab",mapOf("size" to size,"density" to density,"label" to label,"extended" to extended,"icon" to "add"))
        } } }
        val sizes=listOf("standard","medium","large")
        for((index,value) in sizes.withIndex()) for(d in 0 downTo -4) {
            compose.runOnIdle { size=value;density=d;label="";extended=null };compose.mainClock.advanceTimeBy(1000)
            compose.runOnIdle {
                val nodes=collector.snapshot().nodes.associateBy { it.id };val root=nodes.getValue("component").bounds
                assertEquals(listOf(56.0,80.0,96.0)[index]+4*d,root.width,.5)
                assertEquals(root.width,root.height,.5)
                assertEquals(listOf(24.0,28.0,36.0)[index]+d,nodes.getValue("component.icon").bounds.width,.5)
            }
            for(expansion in listOf<Boolean?>(null,true,false)) {
                compose.runOnIdle { label="Compose";extended=expansion };compose.mainClock.advanceTimeBy(1000)
                compose.runOnIdle {
                    val nodes=collector.snapshot().nodes.associateBy { it.id };val root=nodes.getValue("component")
                    assertEquals(56.0+4*d,root.bounds.height,.5)
                    assertEquals(24.0+d,nodes.getValue("component.icon").bounds.width,.5)
                    assertEquals(14.0+.5*d,root.metrics!!.typography!!.size,.01)
                    if(expansion==false) { assertEquals(56.0,root.bounds.width,.5);assertFalse(nodes.containsKey("component.label")) }
                    else {
                        val inset=listOf(16.0,16.0,12.0,12.0,8.0)[-d]
                        val gap=if(d<=-2) 8.0 else 12.0
                        assertEquals(inset,root.metrics!!.padding!!.left,.01);assertEquals(20.0,root.metrics!!.padding!!.right,.01)
                        assertEquals(gap,root.metrics!!.gap!!.column,.01)
                        assertEquals(inset+(24+d)+gap+nodes.getValue("component.label").bounds.width+20,root.bounds.width,1.0)
                    }
                }
            }
        }
    }

    @Test fun labelOnlyAndLogicalIconPaddingFollowDirectionAndLiveLabelChanges() {
        var icon by mutableStateOf("");var rtl by mutableStateOf(false);var label by mutableStateOf("Compose")
        val collector=AWCInspectionCollector()
        compose.mainClock.autoAdvance=false
        compose.setContent { CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
            AWCTheme { AWCInspectionScope(collector) { AWCComponent("md-fab",mapOf("label" to label,"icon" to icon,"density" to -2)) } }
        } }
        compose.mainClock.advanceTimeBy(1000)
        compose.runOnIdle {
            val root=collector.snapshot().nodes.first { it.id=="component" }
            assertEquals(16.0,root.metrics!!.padding!!.left,0.0);assertEquals(16.0,root.metrics!!.padding!!.right,0.0)
            assertEquals(0.0,root.metrics!!.gap!!.column,0.0);icon="add";rtl=true
        }
        compose.mainClock.advanceTimeBy(1000)
        var before=0.0
        compose.runOnIdle {
            val nodes=collector.snapshot().nodes.associateBy { it.id };val root=nodes.getValue("component")
            assertEquals(12.0,root.metrics!!.padding!!.right,0.0);assertEquals(20.0,root.metrics!!.padding!!.left,0.0)
            assertTrue(nodes.getValue("component.icon").bounds.x>nodes.getValue("component.label").bounds.x)
            before=root.bounds.width;label="A much longer action"
        }
        compose.mainClock.advanceTimeBy(1000)
        compose.runOnIdle { assertTrue(collector.snapshot().nodes.first { it.id=="component" }.bounds.width>before) }
        compose.onNodeWithContentDescription("A much longer action").assertExists()
    }

    @Test fun scopedControllerPreservesMountedAuthoredSlotAndLatestFallbackWhileDisabled() {
        val controller=AWCFabController();var mounted by mutableStateOf(true);var custom by mutableStateOf(true)
        var authored by mutableStateOf("add");var disabled by mutableStateOf(false)
        var mounts=0;var disposals=0
        compose.setContent { AWCTheme { if(mounted) AWCFabControllerScope(controller) {
            AWCComponent("md-fab",mapOf("icon" to authored,"label" to "Create","disabled" to disabled)) { name ->
                if(name=="icon" && custom) { DisposableEffect(Unit) { mounts++;onDispose { disposals++ } };AWCMaterialSymbol("favorite",Modifier.testTag("authored")) }
            }
        } } }
        compose.onNodeWithTag("authored",true).assertIsDisplayed()
        compose.runOnIdle { disabled=true;assertTrue(controller.setMenuIcon("close")) }
        compose.onNodeWithText("close",useUnmergedTree=true).assertExists()
        compose.onNodeWithTag("authored",true).assertIsNotDisplayed()
        compose.runOnIdle { assertEquals(1,mounts);assertEquals(0,disposals);assertTrue(controller.setMenuIcon(null)) }
        compose.onNodeWithTag("authored",true).assertIsDisplayed()
        compose.runOnIdle { custom=false;authored="edit";assertTrue(controller.setMenuIcon(" ")) }
        compose.onNodeWithText("edit",useUnmergedTree=true).assertDoesNotExist()
        compose.runOnIdle { assertTrue(controller.setMenuIcon("")) }
        compose.onNodeWithText("edit",useUnmergedTree=true).assertExists()
        compose.runOnIdle { mounted=false }
        compose.runOnIdle { assertFalse(controller.setMenuIcon("close")) }
    }

    @Test fun explicitEmptyIconSlotSuppressesFallbackAndStillOwnsIconSpace() {
        var text by mutableStateOf<String?>("")
        val collector=AWCInspectionCollector()
        compose.setContent { AWCTheme { AWCInspectionScope(collector) {
            AWCComponent("md-fab",mapOf("icon" to "add","label" to "Create")) { slot ->
                LivePreviewSampleSlot("md-fab",slot,"",null,text?.let { mapOf("icon" to it) } ?: emptyMap()) { _,_-> }
            }
        } } }
        compose.onNodeWithText("add",useUnmergedTree=true).assertDoesNotExist()
        compose.runOnIdle { assertEquals(24.0,collector.snapshot().nodes.first { it.id=="component.icon" }.bounds.width,.5);text="  " }
        compose.onNodeWithText("add",useUnmergedTree=true).assertDoesNotExist()
        compose.runOnIdle { text=null }
        compose.onNodeWithText("add",useUnmergedTree=true).assertExists()
    }

    @Test fun oversizedFallbackAndAuthoredIconsRemainCenteredOutsideFixedHost() {
        val collector=AWCInspectionCollector()
        var custom by mutableStateOf(false)
        compose.setContent { AWCTheme { Box(Modifier.padding(24.dp)) { AWCInspectionScope(collector) {
            AWCFabAppearanceScope(AWCFabAppearance(iconSize=80.0)) {
                AWCComponent("md-fab",mapOf("icon" to "add")) { slot ->
                    if(slot=="icon" && custom) AWCMaterialSymbol("favorite")
                }
            }
        } } } }
        for(authored in listOf(false,true)) {
            compose.runOnIdle { custom=authored }
            compose.runOnIdle {
                val nodes=collector.snapshot().nodes.associateBy { it.id }
                val root=nodes.getValue("component").bounds
                val icon=nodes.getValue("component.icon").bounds
                assertEquals(56.0,root.width,.5);assertEquals(56.0,root.height,.5)
                assertEquals(80.0,icon.width,.5);assertEquals(80.0,icon.height,.5)
                assertEquals(-12.0,icon.x-root.x,.5);assertEquals(-12.0,icon.y-root.y,.5)
            }
        }
    }

    @Test fun literalIconTextInheritsLabelTypographyWhileSymbolUsesIconSize() {
        val collector=AWCInspectionCollector()
        var density by mutableStateOf(0)
        compose.setContent { AWCTheme { AWCInspectionScope(collector) {
            AWCFabAppearanceScope(AWCFabAppearance(iconSize=36.0)) {
                AWCComponent("md-fab",mapOf("label" to "Create","density" to density)) { slot -> if(slot=="icon") {
                    val text=rememberAWCInspectionText("icon.literal",family="Roboto")
                    Text("X",modifier=text.modifier,onTextLayout=text.onTextLayout)
                } }
            }
        } } }
        for(d in 0 downTo -4) {
            compose.runOnIdle { density=d }
            compose.runOnIdle {
                val nodes=collector.snapshot().nodes.associateBy { it.id }
                assertEquals(36.0,nodes.getValue("component.icon").bounds.width,.5)
                val type=nodes.getValue("component.icon.literal").metrics!!.typography!!
                assertEquals(14.0+.5*d,type.size,.01);assertEquals(type.size,type.lineHeight,.01)
                val icon=nodes.getValue("component.icon").bounds;val text=nodes.getValue("component.icon.literal").bounds
                assertTrue(text.width<icon.width)
                assertEquals(icon.x+icon.width/2,text.x+text.width/2,.5)
                assertEquals(icon.y+icon.height/2,text.y+text.height/2,.5)
            }
        }
    }

    @Test fun pointerKeyboardAccessibilityAndDisabledFocusUseNativeInputMetadata() {
        val events=mutableListOf<AWCValue>();val activations=mutableListOf<AWCActivationMetadata>()
        var disabled by mutableStateOf(false);var soft by mutableStateOf(false);var expanded by mutableStateOf(false)
        val focus=AWCButtonFocusState()
        compose.setContent { AWCTheme { AWCActionScope(onAction={activations+=it.activation}) {
            AWCButtonFocusScope(focus) { AWCComponent("md-fab",mapOf("label" to "Create","icon" to "add","extended" to expanded,
                "disabled" to disabled,"softDisabled" to soft),onEvent={_,value->events+=value}) }
        } } }
        val target=compose.onNodeWithContentDescription("Create")
        target.performTouchInput { down(center);up() }
        target.performKeyInput { keyDown(Key.Enter);keyUp(Key.Enter);keyDown(Key.Spacebar);keyUp(Key.Spacebar) }
        target.performSemanticsAction(SemanticsActions.OnClick) { it() }
        compose.runOnIdle {
            assertEquals(listOf("pointer","keyboard","keyboard","accessibility"),activations.map { it.source })
            assertTrue(activations.first().x!!>0);assertEquals(listOf(null,null,null,null),events);soft=true
        }
        target.assertIsNotEnabled().performClick()
        target.performKeyInput { keyDown(Key.Enter);keyUp(Key.Enter) }
        compose.runOnIdle { assertEquals(4,events.size);assertTrue(focus.requestFocus());soft=false;disabled=true }
        compose.runOnIdle { assertFalse(focus.requestFocus());disabled=false;expanded=true }
        target.assertExists()
    }

    @Test fun sevenVariantsLoweredAndDisabledUseSourceContainerPixels() {
        var variant by mutableStateOf("surface");var lowered by mutableStateOf(false);var disabled by mutableStateOf(false)
        var scheme:ColorScheme?=null
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { scheme=MaterialTheme.colorScheme
            Box(Modifier.background(Color.Black)) { AWCComponent("md-fab",mapOf("variant" to variant,"lowered" to lowered,"disabled" to disabled),Modifier.testTag("root")) }
        } }
        for(v in listOf("surface","primary-container","secondary-container","tertiary-container","primary","secondary","tertiary")) for(l in listOf(false,true)) for(d in listOf(false,true)) {
            compose.runOnIdle { variant=v;lowered=l;disabled=d };compose.mainClock.advanceTimeBy(1000)
            val c=scheme!!
            val expected=if(d) Color(c.onSurface.red*.12f,c.onSurface.green*.12f,c.onSurface.blue*.12f) else when(v) {
                "surface"->if(l) c.surfaceContainerLow else c.surfaceContainerHigh
                "primary-container"->c.primaryContainer;"secondary-container"->c.secondaryContainer;"tertiary-container"->c.tertiaryContainer
                "primary"->c.primary;"secondary"->c.secondary;else->c.tertiary
            }
            val pixels=compose.onNodeWithTag("root",true).captureToImage().toPixelMap();val actual=pixels[pixels.width/2,pixels.height/2]
            assertEquals("$v/$l/$d red",expected.red,actual.red,.02f);assertEquals("$v/$l/$d green",expected.green,actual.green,.02f);assertEquals("$v/$l/$d blue",expected.blue,actual.blue,.02f)
        }
    }

    @Test fun fiveAppearanceHooksApplyAndDisabledInnerColorOverridesRemainVisible() {
        var disabled by mutableStateOf(false)
        val collector=AWCInspectionCollector()
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { Box(Modifier.background(Color.Black)) {
            AWCInspectionScope(collector) { AWCFabAppearanceScope(AWCFabAppearance(containerColor="#FF0000",iconColor="#00FF00",iconSize=36.0,cornerRadius=0.0,labelColor="#0000FF")) {
                AWCComponent("md-fab",mapOf("icon" to "add","label" to "Create","disabled" to disabled),Modifier.testTag("root"))
            } }
        } } }
        compose.mainClock.advanceTimeBy(1000)
        compose.runOnIdle { assertEquals(36.0,collector.snapshot().nodes.first { it.id=="component.icon" }.bounds.width,.5) }
        fun pixels()=compose.onNodeWithTag("root",true).captureToImage().toPixelMap()
        pixels().let { assertTrue(it[1,1].red>.95f) }
        compose.runOnIdle { disabled=true };compose.mainClock.advanceTimeBy(1000)
        pixels().let { p ->
            assertTrue(p[1,1].red<.2f)
            var green=0;var blue=0
            for(y in 0 until p.height) for(x in 0 until p.width) { val c=p[x,y];if(c.green>.8f && c.red<.2f) green++;if(c.blue>.8f && c.red<.2f) blue++ }
            assertTrue("Authored icon color survives disabled host ink",green>5)
            assertTrue("Authored label color survives disabled host ink",blue>5)
        }
    }

    @Test fun extensionAnimatesAfterMountAndRippleCancellationNeverActivates() {
        var extended by mutableStateOf(false);var ripple by mutableStateOf(false)
        val collector=AWCInspectionCollector();val events=mutableListOf<String>()
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { AWCFabAppearanceScope(AWCFabAppearance(containerColor="#FFFFFF",iconColor="#0000FF")) {
            AWCInspectionScope(collector) { AWCComponent("md-fab",mapOf("label" to "Create a new item","icon" to "add","extended" to extended,"ripple" to ripple),Modifier.testTag("root"),onEvent={n,_->events+=n}) }
        } } }
        compose.runOnIdle { assertEquals(56.0,collector.snapshot().nodes.first { it.id=="component" }.bounds.width,.5);extended=true }
        compose.mainClock.advanceTimeBy(80)
        var during=0.0
        compose.runOnIdle { during=collector.snapshot().nodes.first { it.id=="component" }.bounds.width;assertTrue(during>56) }
        compose.mainClock.advanceTimeBy(1000)
        compose.runOnIdle { assertTrue(collector.snapshot().nodes.first { it.id=="component" }.bounds.width>=during) }
        val target=compose.onNodeWithTag("root",true)
        fun heldColor():Color {
            target.performTouchInput { down(center) };compose.mainClock.advanceTimeBy(300)
            val p=target.captureToImage().toPixelMap();val c=p[p.width/2,4]
            target.performTouchInput { cancel() };compose.mainClock.advanceTimeBy(1000);return c
        }
        val noRipple=heldColor();compose.runOnIdle { ripple=true };compose.mainClock.advanceTimeBy(1000);val withRipple=heldColor()
        assertTrue("Ripple must add blue ink: without=$noRipple with=$withRipple",withRipple.red<noRipple.red-.03f)
        compose.runOnIdle { assertTrue(events.isEmpty()) }
    }
}
