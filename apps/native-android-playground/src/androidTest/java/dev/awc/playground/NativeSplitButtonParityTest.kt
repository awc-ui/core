@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

class NativeSplitButtonParityTest {
    @get:Rule val compose=createComposeRule()
    @Composable private fun ReferenceTheme(content:@Composable ()->Unit) {
        CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(darkTheme=true,content=content) }
    }
    private fun settle() { compose.mainClock.advanceTimeBy(400);compose.waitForIdle() }
    private fun JSONObject.props():Map<String,AWCValue> = listOf("variant","size","disabled","softDisabled","icon","label","trailingIcon","trailingChecked","menuLabel","haspopup","controls","fullWidth","ripple","density").filter(::has).associateWith(::get)
    @Test fun all50WebFixturesMatchBothHalvesTypographyAndActualGlyphBounds() {
        val reference=JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("SplitButtonWebGeometry.json").bufferedReader().use { it.readText() }).getJSONArray("results")
        var index by mutableIntStateOf(0);val inspection=AWCInspectionCollector()
        compose.setContent { ReferenceTheme {
            val fixture=reference.getJSONObject(index).getJSONObject("fixture")
            CompositionLocalProvider(LocalLayoutDirection provides if(fixture.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.requiredSize(700.dp,240.dp),contentAlignment=Alignment.Center) { key(index) {
                    val styles=fixture.optJSONObject("style")
                    AWCSplitButtonAppearanceScope(AWCSplitButtonAppearance.fromValues(styles?.keys()?.asSequence()?.associateWith(styles::get).orEmpty())) {
                        Box(Modifier.then(if(fixture.has("width")) Modifier.requiredWidth(fixture.getDouble("width").dp) else Modifier)) {
                            AWCInspectionScope(inspection) {
                                AWCComponent("md-split-button",fixture.props()) { slot ->
                                    if(slot.isEmpty() && fixture.has("content")) AWCSlotText(fixture.getString("content"))
                                }
                            }
                        }
                    }
                } }
            }
        } }
        val failures=mutableListOf<String>()
        fun check(id:String,name:String,expected:Double,actual:Double,tolerance:Double=.55) { if(abs(expected-actual)>tolerance) failures+="$id $name native=$actual Web=$expected" }
        fun insets(css:String):List<Double> { val v=css.split(' ').map { it.removeSuffix("px").toDouble() };return when(v.size) { 1->List(4){v[0]};2->listOf(v[0],v[1],v[0],v[1]);3->listOf(v[0],v[1],v[2],v[1]);else->v } }
        for(i in 0 until reference.length()) {
            compose.runOnIdle { index=i };settle()
            compose.runOnIdle {
                val entry=reference.getJSONObject(i);val fixture=entry.getJSONObject("fixture");val id=fixture.getString("id")
                val nodes=inspection.snapshot().nodes.associateBy { it.id }
                val root=nodes.getValue("component")
                check(id,"root width",entry.getJSONObject("host").getDouble("width"),root.bounds.width,2.0)
                check(id,"root height",entry.getJSONObject("host").getDouble("height"),root.bounds.height)
                for(part in listOf("leading","trailing","icon","trailingIcon","label")) {
                    val expected=entry.optJSONObject(part);val native=nodes["component.${if(part=="trailingIcon") "trailing-icon" else part}"]
                    if(expected==null) { if(native!=null) failures+="$id unexpected $part";continue }
                    if(native==null) { if(expected.getDouble("width")>0 && expected.getDouble("height")>0) failures+="$id missing $part";continue }
                    check(id,"$part width",expected.getDouble("width"),native.bounds.width,if(part in listOf("leading","label")) 2.0 else .55)
                    check(id,"$part height",expected.getDouble("height"),native.bounds.height)
                    if(part in listOf("leading","trailing")) {
                        val padding=insets(expected.getString("padding"));val actual=native.metrics!!.padding!!
                        listOf(actual.top,actual.right,actual.bottom,actual.left).forEachIndexed { n,value -> check(id,"$part pad$n",padding[n],value,.01) }
                    }
                    if(part=="leading") {
                        val type=native.metrics!!.typography!!
                        check(id,"font",expected.getString("fontSize").removeSuffix("px").toDouble(),type.size,.01)
                        check(id,"line",expected.getString("lineHeight").removeSuffix("px").toDouble(),type.lineHeight,.01)
                        assertEquals(expected.getString("fontWeight").toInt(),type.weight)
                    }
                }
                val lead=nodes.getValue("component.leading");val trail=nodes.getValue("component.trailing")
                check(id,"split gap",2.0,if(fixture.optString("dir")=="rtl") lead.bounds.x-trail.bounds.x-trail.bounds.width else trail.bounds.x-lead.bounds.x-lead.bounds.width,.01)
            }
        }
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }

    @Test fun realPointerKeyboardAndCancellationKeepIndependentActionsAndCommittedState() {
        val state=AWCSplitButtonState();val events=mutableListOf<Pair<String,AWCValue>>()
        var controlled by mutableStateOf(false);var disabled by mutableStateOf(false);var soft by mutableStateOf(false)
        val raw=mutableListOf<AWCValue>();val sources=mutableListOf<String>()
        compose.setContent { ReferenceTheme { AWCSplitButtonStateScope(state) {
            AWCActionScope(onAction={ event -> raw+=event.rawDetail;sources+=event.activation.source;event.preventDefault() }) {
                AWCComponent("md-split-button",mapOf("label" to "Create","menuLabel" to "More options","trailingChecked" to controlled,"disabled" to disabled,"softDisabled" to soft),
                    onEvent={n,d->events+=n to d})
            }
        } } }
        settle()
        val leading=compose.onNode(hasClickAction() and hasText("Create"));val trailing=compose.onNodeWithContentDescription("More options")
        leading.performTouchInput { click() };trailing.performTouchInput { click() };settle()
        compose.runOnIdle { assertEquals(listOf("mdLeadingClick","mdTrailingClick"),events.map { it.first });assertNull(events[0].second);assertEquals(mapOf("checked" to true),events[1].second);assertEquals(true,state.snapshot());assertNull(raw[0]);assertEquals(listOf("pointer","pointer"),sources) }
        trailing.performSemanticsAction(SemanticsActions.RequestFocus) { it() }
        trailing.performKeyInput { pressKey(Key.Enter) };settle();compose.runOnIdle { assertEquals(false,state.snapshot());assertEquals("keyboard",sources.last()) }
        trailing.performKeyInput { pressKey(Key.Spacebar) };settle();compose.runOnIdle { assertEquals(true,state.snapshot());assertEquals(4,events.size);controlled=true }
        settle();compose.runOnIdle { controlled=false };settle();compose.runOnIdle { assertEquals(false,state.snapshot());soft=true }
        settle();trailing.assertIsNotEnabled();trailing.performSemanticsAction(SemanticsActions.RequestFocus) { it() };trailing.assertIsFocused()
        trailing.performKeyInput { pressKey(Key.Spacebar) };leading.performTouchInput { click() };compose.runOnIdle { assertEquals(4,events.size);disabled=true;soft=false }
        settle();trailing.assertIsNotEnabled();leading.assertIsNotEnabled()
        trailing.performTouchInput { click() };compose.runOnIdle { assertEquals(4,events.size) }
    }

    @Test fun controlsResolveActualNativePopupFocusWithoutCreatingOrOpeningIt() {
        var present by mutableStateOf(false);var kind by mutableStateOf("menu")
        var activations=0
        compose.setContent { ReferenceTheme { AWCPopupScope { Column {
            AWCComponent("md-split-button",mapOf("label" to "Create","controls" to "actual-menu","haspopup" to kind,"menuLabel" to "Open choices"),onEvent={_,_->activations++})
            if(present) AWCPopupTargetScope("actual-menu") { AWCComponent("md-button",mapOf("label" to "Popup option")) }
        } } } }
        settle();val trigger=compose.onNodeWithContentDescription("Open choices")
        assertEquals("actual-menu",trigger.fetchSemanticsNode().config[AWCControlledPopupKey])
        assertNull(trigger.fetchSemanticsNode().config.getOrNull(SemanticsActions.CustomActions))
        compose.runOnIdle { present=true };settle()
        val moveToPopup=trigger.fetchSemanticsNode().config[SemanticsActions.CustomActions].single()
        compose.runOnIdle { assertTrue(moveToPopup.action()) };settle()
        compose.onNode(hasClickAction() and hasText("Popup option")).assertIsFocused()
        compose.runOnIdle { assertEquals(0,activations);present=false;kind="false" };settle()
        assertNull(trigger.fetchSemanticsNode().config.getOrNull(SemanticsActions.CustomActions));assertNull(trigger.fetchSemanticsNode().config.getOrNull(AWCPopupKindKey))
    }

    @Test fun allSixAppearanceHooksAffectPaintAndSlotsRemainAdditiveAcrossLabelChanges() {
        var label by mutableStateOf("Create");var disabled by mutableStateOf(false);var outlined by mutableStateOf(false)
        var mounts=0;var disposals=0
        val collector=AWCInspectionCollector()
        compose.setContent { ReferenceTheme {
            Box(Modifier.requiredSize(400.dp,160.dp).background(Color.White).testTag("canvas"),contentAlignment=Alignment.Center) {
                AWCSplitButtonAppearanceScope(AWCSplitButtonAppearance(containerColor="#123456",labelColor="#ABCDEF",iconColor="#FEDCBA",outlineColor="#00FF00",cornerRadius=0.0,iconSize=30.0)) {
                    AWCInspectionScope(collector) { AWCComponent("md-split-button",mapOf("label" to label,"icon" to "add","disabled" to disabled,"variant" to if(outlined) "outlined" else "filled")) { slot -> if(slot.isEmpty()) {
                        DisposableEffect(Unit) { mounts++;onDispose { disposals++ } };AWCSlotText("extra")
                    } } }
                }
            }
        } }
        settle();compose.onNodeWithText("Create").assertExists();compose.onNodeWithText("extra").assertExists()
        fun pixelAtLeadingInset():Color {
            val image=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
            val bounds=compose.onNodeWithTag("canvas").fetchSemanticsNode().boundsInRoot
            val node=collector.snapshot().nodes.first { it.id=="component.leading" }
            return image[((node.bounds.x+2)*2-bounds.left).toInt(),((node.bounds.y+2)*2-bounds.top).toInt()]
        }
        assertEquals(Color(0xFF123456),pixelAtLeadingInset())
        compose.runOnIdle { assertEquals(30.0,collector.snapshot().nodes.first { it.id=="component.icon" }.bounds.width,.01);label="Changed" }
        settle();compose.onNodeWithText("Changed").assertExists();compose.onNodeWithText("extra").assertExists()
        compose.runOnIdle { assertEquals(1,mounts);assertEquals(0,disposals);outlined=true }
        settle();assertEquals(Color.White,pixelAtLeadingInset())
        compose.runOnIdle { disabled=true;outlined=false };settle();assertNotEquals(Color(0xFF123456),pixelAtLeadingInset())
    }

    @Test fun actualGeneratedStateOpacityPaintsIndependentSplitAndSegmentStates() {
        var segmented by mutableStateOf(false)
        var stateInk=Color.Unspecified
        compose.mainClock.autoAdvance=false
        compose.setContent { ReferenceTheme {
            stateInk=if(segmented) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onPrimary
            Box(Modifier.requiredSize(300.dp,140.dp).background(Color.White),contentAlignment=Alignment.Center) {
                key(segmented) {
                    if(segmented) AWCSegmentedButtonAppearanceScope(AWCSegmentedButtonAppearance(containerColor="#FFFFFF",cornerRadius=0.0)) {
                        AWCComponent("md-segmented-button",mapOf("label" to "Action","ripple" to false),Modifier.testTag("overlay-segment"))
                    } else AWCSplitButtonAppearanceScope(AWCSplitButtonAppearance(containerColor="#FFFFFF",cornerRadius=0.0)) {
                        AWCComponent("md-split-button",mapOf("label" to "Action","ripple" to false))
                    }
                }
            }
        } }
        fun expectOverlay(control:SemanticsNodeInteraction,opacity:Float) {
            val pixels=control.captureToImage().toPixelMap()
            val actual=pixels[8,pixels.height/2]
            val expected=stateInk.copy(alpha=opacity).compositeOver(Color.White)
            assertEquals("red at opacity $opacity",expected.red,actual.red,.006f)
            assertEquals("green at opacity $opacity",expected.green,actual.green,.006f)
            assertEquals("blue at opacity $opacity",expected.blue,actual.blue,.006f)
        }
        for(isSegmented in listOf(false,true)) {
            compose.runOnIdle { segmented=isSegmented };settle()
            val control=compose.onNode(if(isSegmented) hasAnyAncestor(hasTestTag("overlay-segment")) and hasClickAction()
                else hasClickAction() and hasText("Action"))
            expectOverlay(control,0f)
            control.performMouseInput { enter(center) };settle();expectOverlay(control,.08f)
            if(!isSegmented) expectOverlay(compose.onNodeWithContentDescription("Toggle menu"),0f)
            control.performTouchInput { down(center) };settle();expectOverlay(control,.12f)
            control.performTouchInput { up() };settle()
            control.performSemanticsAction(SemanticsActions.RequestFocus) { it() }
            settle();control.assertIsFocused()
            control.performKeyInput { pressKey(Key.A) };settle();control.assertIsFocused();expectOverlay(control,.12f)
        }
    }

    @Test fun outlinedInspectionUsesTheSamePhysicalBorderAsNativeLayoutAndPaint() {
        val collector=AWCInspectionCollector()
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(1.3125f,1f)) { AWCTheme {
                AWCSplitButtonAppearanceScope(AWCSplitButtonAppearance(outlineColor="#FF0000",cornerRadius=0.0)) {
                    AWCInspectionScope(collector) {
                        AWCComponent("md-split-button",mapOf("label" to "Action","variant" to "outlined"))
                    }
                }
            } }
        }
        settle()
        compose.runOnIdle {
            val nodes=collector.snapshot().nodes.associateBy { it.id }
            for(part in listOf("leading","trailing")) {
                val half=nodes.getValue("component.$part")
                val layer=nodes.getValue("component.$part-state-layer")
                val physical=1.0/1.3125
                assertEquals(physical,half.metrics!!.border!!.left,.0001)
                assertEquals(physical,layer.bounds.x-half.bounds.x,.0001)
                assertEquals(physical,layer.bounds.y-half.bounds.y,.0001)
                assertEquals(physical*2,half.bounds.width-layer.bounds.width,.0001)
            }
        }
        val pixels=compose.onNode(hasClickAction() and hasText("Action")).captureToImage().toPixelMap()
        assertEquals(Color.Red,pixels[pixels.width/2,0])
        assertNotEquals(Color.Red,pixels[pixels.width/2,1])
    }
}
