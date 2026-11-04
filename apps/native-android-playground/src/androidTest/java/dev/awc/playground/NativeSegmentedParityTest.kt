@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.*
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

class NativeSegmentedParityTest {
    @get:Rule val compose=createComposeRule()
    @Composable private fun ReferenceTheme(content:@Composable ()->Unit) {
        CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(content=content) }
    }
    private fun settle() { compose.mainClock.advanceTimeBy(350);compose.waitForIdle() }
    private fun JSONObject.props():Map<String,AWCValue> = listOf("label","value","icon","selected","disabled","softDisabled","noCheckmark","density","segmentIndex","segmentTotal","segmentDensity","segmentMultiselect").filter(::has).associateWith(::get)
    @Test fun all12NarrowWebGridsPreservePaddingFloorsOverflowAndRtlPositions() {
        val cases=JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("SegmentedNarrowWebGeometry.json").bufferedReader().use { it.readText() }).getJSONArray("results")
        var index by mutableIntStateOf(0);val collector=AWCInspectionCollector()
        var origin=androidx.compose.ui.geometry.Offset.Zero
        compose.setContent { ReferenceTheme {
            val fixture=cases.getJSONObject(index).getJSONObject("fixture")
            CompositionLocalProvider(LocalLayoutDirection provides if(fixture.getString("direction")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.requiredSize(300.dp,100.dp),contentAlignment=Alignment.Center) { key(index) {
                    AWCComponent("md-segmented-button-set",mapOf("density" to fixture.getInt("density")),
                        Modifier.requiredWidth(fixture.getDouble("width").dp).onGloballyPositioned { origin=it.positionInRoot()/2f }) { slot -> if(slot.isEmpty()) {
                        listOf("Day","Week","Month").forEachIndexed { child,label ->
                            AWCInspectionScope(collector,"child-$child") {
                                AWCComponent("md-segmented-button",mapOf("label" to label,"noCheckmark" to true))
                            }
                        }
                    } }
                } }
            }
        } }
        val failures=mutableListOf<String>()
        for(i in 0 until cases.length()) {
            compose.runOnIdle { index=i };settle()
            compose.runOnIdle {
                val entry=cases.getJSONObject(i);val id=entry.getJSONObject("fixture").getString("id")
                val nodes=collector.snapshot().nodes.associateBy { it.id }
                for(child in 0..2) {
                    val expected=entry.getJSONArray("children").getJSONObject(child)
                    val bounds=expected.getJSONObject("host").getJSONObject("bounds")
                    val native=nodes.getValue("child-$child").bounds
                    fun check(name:String,a:Double,b:Double) { if(abs(a-b)>.55) failures+="$id child$child $name native=$b Web=$a" }
                    check("width",bounds.getDouble("width"),native.width);check("height",bounds.getDouble("height"),native.height)
                    check("x",expected.getJSONObject("relative").getDouble("x"),native.x-origin.x)
                    check("y",expected.getJSONObject("relative").getDouble("y"),native.y-origin.y)
                }
            }
        }
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }
    @Test fun all35WebFixturesMatchMeasuredRootPartsGridAndDensity() {
        val reference=JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("SegmentedWebGeometry.json").bufferedReader().use { it.readText() }).getJSONArray("results")
        var index by mutableIntStateOf(0)
        val inspection=AWCInspectionCollector()
        var setBounds=Rect.Zero;var scale=1f
        compose.setContent { ReferenceTheme {
            scale=LocalDensity.current.density
            val fixture=reference.getJSONObject(index).getJSONObject("fixture")
            CompositionLocalProvider(LocalLayoutDirection provides if(fixture.optString("direction")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.requiredSize(700.dp,240.dp),contentAlignment=Alignment.Center) { key(index) {
                    @Composable fun Segment(value:JSONObject,id:String) {
                        val styles=value.optJSONObject("style")
                        AWCSegmentedButtonAppearanceScope(AWCSegmentedButtonAppearance.fromValues(styles?.keys()?.asSequence()?.associateWith(styles::get).orEmpty())) {
                            AWCInspectionScope(inspection,id) {
                                AWCComponent("md-segmented-button",value.props()) { slot->
                                    if(slot=="icon" && value.has("slot")) AWCSlotText(value.getString("slot"))
                                    if(slot.isEmpty() && value.has("content")) AWCSlotText(value.getString("content"))
                                }
                            }
                        }
                    }
                    if(fixture.optBoolean("set")) {
                        val children=fixture.getJSONArray("children")
                        AWCComponent("md-segmented-button-set",mapOf("density" to fixture.optInt("density"),"multiselect" to fixture.optBoolean("multiselect")),
                            Modifier.then(if(fixture.has("width")) Modifier.requiredWidth(fixture.getDouble("width").dp) else Modifier)
                                .onGloballyPositioned { setBounds=it.boundsInRoot() }) { slot->
                            if(slot.isEmpty()) for(i in 0 until children.length()) Segment(children.getJSONObject(i),"child-$i")
                        }
                    } else Segment(fixture,"component")
                } }
            }
        } }
        val failures=mutableListOf<String>()
        fun check(id:String,name:String,expected:Double,actual:Double,tolerance:Double=.55) { if(abs(expected-actual)>tolerance) failures+="$id $name native=$actual Web=$expected" }
        for(i in 0 until reference.length()) {
            compose.runOnIdle { index=i };settle()
            compose.runOnIdle {
                val entry=reference.getJSONObject(i);val fixture=entry.getJSONObject("fixture");val id=fixture.getString("id")
                val nodes=inspection.snapshot().nodes.associateBy { it.id }
                fun segment(expected:JSONObject,prefix:String) {
                    val host=expected.getJSONObject("host");val root=nodes[prefix]
                    if(root==null) { failures+="$id missing $prefix";return }
                    check(id,"$prefix width",host.getDouble("width"),root.bounds.width,1.5)
                    check(id,"$prefix height",host.getDouble("height"),root.bounds.height)
                    val typography=root.metrics!!.typography!!
                    check(id,"font",host.getString("fontSize").removeSuffix("px").toDouble(),typography.size,.01)
                    check(id,"line",host.getString("lineHeight").removeSuffix("px").toDouble(),typography.lineHeight,.01)
                    check(id,"gap",host.getString("gap").removeSuffix("px").toDouble(),root.metrics!!.gap!!.column,.01)
                    val padding=host.getString("padding").split(' ').map { it.removeSuffix("px").toDouble() }
                    check(id,"inline inset",padding.getOrElse(1) { padding[0] },root.metrics!!.padding!!.left,.01)
                    for(name in listOf("graphic","label","slot")) {
                        val web=expected.optJSONObject(name)
                        val part=when(name) { "graphic"->if(web?.optString("text")=="check") "checkmark" else "icon";"slot"->"icon-slot-0";else->name }
                        val native=nodes["$prefix.$part"]
                        if(web==null || web.optString("visibility")=="hidden") { if(native!=null) failures+="$id unexpected $prefix.$part" }
                        else if(native==null) failures+="$id missing $prefix.$part"
                        else {
                            check(id,"$prefix.$part width",web.getDouble("width"),native.bounds.width,1.5)
                            check(id,"$prefix.$part height",web.getDouble("height"),native.bounds.height)
                            check(id,"$prefix.$part x",web.getDouble("x")-host.getDouble("x"),native.bounds.x-root.bounds.x,1.5)
                            check(id,"$prefix.$part y",web.getDouble("y")-host.getDouble("y"),native.bounds.y-root.bounds.y,.55)
                        }
                    }
                }
                if(fixture.optBoolean("set")) {
                    val web=entry.getJSONObject("set")
                    check(id,"grid width",web.getDouble("width"),setBounds.width/scale.toDouble(),4.5)
                    check(id,"grid height",web.getDouble("height"),setBounds.height/scale.toDouble())
                    val children=entry.getJSONArray("children")
                    for(j in 0 until children.length()) {
                        val child=children.getJSONObject(j);segment(child,"child-$j")
                        nodes["child-$j"]?.let { node->check(id,"child$j x",child.getJSONObject("host").getDouble("x")-web.getDouble("x"),node.bounds.x-setBounds.left/scale.toDouble(),3.0) }
                    }
                } else segment(entry,"component")
            }
        }
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }

    @Test fun standaloneProposesWithoutMutationAndSetCommitsAfterTargetNotificationByIdentity() {
        val state=AWCSegmentedButtonSetState();val events=mutableListOf<Pair<String,AWCValue>>()
        var selected by mutableStateOf(false);var multi by mutableStateOf(false)
        var prevent by mutableStateOf(false);var stop by mutableStateOf(false)
        compose.setContent { ReferenceTheme { Column {
            AWCComponent("md-segmented-button",mapOf("label" to "Standalone","value" to "solo","selected" to selected,"segmentMultiselect" to multi),Modifier.testTag("standalone"),onEvent={n,d->events+=n to d})
            AWCSegmentedButtonSetStateScope(state) {
                AWCActionScope(onAction={ if(it.name=="mdSegmentClick") error("The set must stop its internal proposal") }) {
                    AWCComponent("md-segmented-button-set",mapOf("multiselect" to multi),onEvent={n,d->events+=n to d}) { slot-> if(slot.isEmpty()) {
                        listOf("First","Second","Third").forEachIndexed { i,label->
                            AWCActionTargetScope(onAction={ if(it.name=="mdSegmentClick") { if(prevent) it.preventDefault();if(stop) it.stopPropagation() } }) {
                                AWCComponent("md-segmented-button",mapOf("label" to label,"value" to if(i<2) "same" else "","selected" to (i<2)),Modifier.testTag("segment-$i"),onEvent={n,d->
                                    if(n=="mdSegmentClick") events+="before" to state.snapshot();events+=n to d
                                })
                            }
                        }
                    } }
                }
            }
        } } }
        settle();compose.onNodeWithTag("standalone").performClick();compose.onNode(hasAnyAncestor(hasTestTag("standalone")) and hasClickAction()).assertIsNotSelected()
        assertEquals(mapOf("value" to "solo","selected" to true),events.last().second)
        compose.runOnIdle { selected=true;multi=true };settle();compose.onNodeWithTag("standalone").performClick()
        compose.onNode(hasAnyAncestor(hasTestTag("standalone")) and hasClickAction()).assertIsOn();assertEquals(mapOf("value" to "solo","selected" to false),events.last().second)
        compose.runOnIdle { multi=false;prevent=true;events.clear() };settle()
        compose.onNodeWithTag("segment-1").performClick();compose.runOnIdle {
            assertEquals(listOf(true,true,false),events[0].second)
            assertEquals(listOf("before","mdSegmentClick","mdChange"),events.map { it.first })
            assertEquals(listOf(false,true,false),state.snapshot());assertEquals(listOf("same"),events.last().second)
            events.clear();stop=true
        }
        compose.onNodeWithTag("segment-2").performClick();compose.runOnIdle { assertEquals(listOf(false,true,false),state.snapshot());assertFalse(events.any { it.first=="mdChange" });stop=false;multi=true;events.clear() }
        settle();compose.onNodeWithTag("segment-0").performClick();compose.runOnIdle { assertEquals(listOf(true,true,false),state.snapshot());assertEquals(listOf("same","same"),events.last().second) }
    }

    @Test fun arrowsRespectSourceModesPhysicalDirectionSoftDisabledAndKeyedReorder() {
        val state=AWCSegmentedButtonSetState();val handles=(0..3).associateWith { AWCButtonFocusState() }
        var ids by mutableStateOf(listOf(0,1,2,3));var multi by mutableStateOf(false)
        val changes=mutableListOf<AWCValue>()
        compose.setContent { ReferenceTheme { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            AWCSegmentedButtonSetStateScope(state) {
                AWCComponent("md-segmented-button-set",mapOf("multiselect" to multi),onEvent={_,value->changes+=value}) { slot->if(slot.isEmpty()) ids.forEach { id->key(id) {
                    Box { AWCButtonFocusScope(handles.getValue(id)) {
                        AWCComponent("md-segmented-button",mapOf("label" to "Segment$id","value" to "$id","disabled" to (id==1),"softDisabled" to (id==2),"selected" to (id==0)),Modifier.testTag("s$id"))
                    } }
                } } }
            }
        } } }
        settle();compose.runOnIdle { handles.getValue(0).requestFocus() };settle()
        compose.onNodeWithTag("s0").performKeyInput { pressKey(Key.DirectionRight) };settle()
        compose.runOnIdle { assertTrue(handles.getValue(2).isFocused);assertEquals(listOf(true,false,false,false),state.snapshot());assertTrue(changes.isEmpty()) }
        compose.onNodeWithTag("s2").performKeyInput { pressKey(Key.DirectionDown) };settle()
        compose.runOnIdle { assertTrue(handles.getValue(3).isFocused);assertEquals(listOf(false,false,false,true),state.snapshot());multi=true }
        settle();compose.onNodeWithTag("s3").performKeyInput { pressKey(Key.DirectionRight) };settle()
        compose.runOnIdle { assertTrue(handles.getValue(0).isFocused);assertEquals(listOf(false,false,false,true),state.snapshot());ids=listOf(3,2,1,0) }
        settle();compose.onNodeWithTag("s0").performKeyInput { pressKey(Key.DirectionRight) };settle()
        compose.runOnIdle { assertTrue(handles.getValue(3).isFocused);assertEquals(listOf(true,false,false,false),state.snapshot());ids=listOf(3,0) }
        settle();compose.runOnIdle { assertEquals(listOf(true,false),state.snapshot()) }
        compose.onNodeWithTag("s3").performKeyInput { pressKey(Key.DirectionLeft) };settle()
        compose.runOnIdle { assertTrue(handles.getValue(0).isFocused) }
    }

    @Test fun initialNamedTextCreatesItsSourceLabelWrapperWhileLaterTextDoesNotChangeTheFlag() {
        val symbol=AWCInspectionCollector();val empty=AWCInspectionCollector()
        var text by mutableStateOf("")
        compose.setContent { ReferenceTheme { Column {
            AWCInspectionScope(symbol) { AWCComponent("md-segmented-button",mapOf("icon" to "add")) { slot->
                if(slot=="icon") AWCMaterialSymbol("favorite")
                if(slot.isEmpty()) AWCSlotText(text)
            } }
            AWCInspectionScope(empty) { AWCComponent("md-segmented-button",mapOf("icon" to "add")) { slot->
                if(slot.isEmpty()) AWCSlotText(text)
            } }
        } } }
        settle();compose.runOnIdle {
            val nodes=symbol.snapshot().nodes.associateBy { it.id }
            assertEquals("Source reserves an empty label after named icon text",76.0,nodes.getValue("component").bounds.width,.55)
            assertNull(empty.snapshot().nodes.find { it.id=="component.label" })
            text="Later label"
        }
        settle();compose.onAllNodesWithText("Later label").assertCountEquals(2)
        compose.runOnIdle { assertNotNull(symbol.snapshot().nodes.find { it.id=="component.label" });assertNull("Initial empty host text never gains the label part",empty.snapshot().nodes.find { it.id=="component.label" }) }
    }

    @Test fun sevenAppearanceHooksPaintActualPartsAndRetainMaskedAuthoredContent() {
        val collector=AWCInspectionCollector();var shown by mutableStateOf(true);var selected by mutableStateOf(true)
        var mounted=0;var disposed=0
        compose.setContent { ReferenceTheme {
            Box(Modifier.requiredSize(300.dp,120.dp).background(Color.White).testTag("pixels"),contentAlignment=Alignment.Center) {
                AWCSegmentedButtonAppearanceScope(AWCSegmentedButtonAppearance("#112233","#345678","#ABCDEF","#FEDCBA","#00FF00",6.0,26.0)) {
                    AWCInspectionScope(collector) {
                        AWCComponent("md-segmented-button",mapOf("label" to if(shown) "Property" else "","selected" to selected)) { slot->
                            if(slot.isEmpty()) { DisposableEffect(Unit) { mounted++;onDispose { disposed++ } };AWCSlotText("Authored label") }
                            if(slot=="icon") AWCSlotText("")
                        }
                    }
                }
            }
        } }
        settle();compose.runOnIdle { assertEquals(1,mounted);assertEquals(0,disposed);assertEquals(26.0,collector.snapshot().nodes.first { it.id=="component.icon-slot-0" }.bounds.width,.01) }
        fun hasColor(red:Float,green:Float,blue:Float):Boolean {
            val pixels=compose.onNodeWithTag("pixels").captureToImage().toPixelMap()
            return (0 until pixels.height).any { y->(0 until pixels.width).any { x->val c=pixels[x,y];abs(c.red-red)<.025 && abs(c.green-green)<.025 && abs(c.blue-blue)<.025 } }
        }
        assertTrue("selected container paint",hasColor(0x34/255f,0x56/255f,0x78/255f))
        assertTrue("authored outline paint",hasColor(0f,1f,0f))
        compose.runOnIdle { shown=false;selected=false };settle()
        compose.runOnIdle { assertEquals(1,mounted);assertEquals(0,disposed);assertNotNull(collector.snapshot().nodes.find { it.id=="component.label" }) }
        assertTrue("unselected container paint",hasColor(0x11/255f,0x22/255f,0x33/255f))
    }
}
