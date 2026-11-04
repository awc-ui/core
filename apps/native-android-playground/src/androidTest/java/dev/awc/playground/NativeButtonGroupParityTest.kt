@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import dev.awc.nativeui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeButtonGroupParityTest {
    @get:Rule val compose=createComposeRule()
    private fun bounds(tag:String)=compose.onNodeWithTag(tag,true).getUnclippedBoundsInRoot()
    @Composable private fun child(title:String,selected:Boolean=false,props:Map<String,AWCValue> = emptyMap(),onEvent:(String,AWCValue)->Unit={_,_->}) {
        AWCComponent("md-button",mapOf("label" to title,"value" to title,"selected" to selected)+props,Modifier.testTag(title),onEvent)
    }
    @Test fun all25GapAndDensityCombinationsAreMeasuredWithoutWrapping() {
        var size by mutableStateOf("sm");var density by mutableStateOf(0)
        compose.setContent { AWCTheme { AWCComponent("md-button-group",mapOf("size" to size,"density" to density),Modifier.testTag("group")) {
            child("a");child("b")
        } } }
        val base=listOf(32f,40f,56f,96f,136f);val floors=listOf(24f,24f,40f,80f,120f)
        for((i,s) in listOf("xs","sm","md","lg","xl").withIndex()) for(d in 0 downTo -4) {
            compose.runOnIdle {size=s;density=d}
            val a=bounds("a");val b=bounds("b")
            val gap=when(s){"xs"->maxOf(10f,18f+2*d);"sm"->maxOf(6f,12f+1.5f*d);else->maxOf(4f,8f+d)}
            assertEquals("$s/$d gap",gap,b.left.value-a.right.value,.5f)
            assertEquals("$s/$d height",maxOf(floors[i],base[i]+4*d),a.height.value,.5f)
            assertEquals(a.top.value,b.top.value,.1f)
        }
    }
    @Test fun sevenLayoutHooksStretchAndFullWidthSharesSpaceWithoutShrinkingTargets() {
        var appearance by mutableStateOf(AWCButtonGroupAppearance(gap=10.0,width=300.0,height=64.0))
        var full by mutableStateOf(false);var connected by mutableStateOf(false)
        compose.setContent { AWCTheme { Box(Modifier.width(360.dp)) { AWCButtonGroupAppearanceScope(appearance) {
            AWCComponent("md-button-group",mapOf("fullWidth" to full,"variant" to if(connected) "connected" else "standard"),Modifier.testTag("group")) {
                child("a");child("b");child("c")
            }
        } } } }
        assertEquals(300f,bounds("group").width.value,.5f);assertEquals(64f,bounds("a").height.value,.5f)
        compose.runOnIdle { full=true }
        assertEquals(360f,bounds("group").width.value,.5f)
        for(id in listOf("a","b","c")) assertEquals(340f/3,bounds(id).width.value,1f)
        compose.runOnIdle { full=false;appearance=AWCButtonGroupAppearance(width=10.0,minWidth=180.0,maxWidth=120.0,height=100.0,minHeight=20.0,maxHeight=30.0) }
        assertEquals(180f,bounds("group").width.value,.5f);assertEquals(30f,bounds("group").height.value,.5f);assertEquals(30f,bounds("b").height.value,.5f)
        compose.runOnIdle { connected=true;full=true;appearance=AWCButtonGroupAppearance(maxWidth=60.0) }
        assertEquals(60f,bounds("group").width.value,.5f)
        assertTrue(bounds("a").width.value>=48f);assertTrue(bounds("c").right>bounds("group").right)
    }
    @Test fun authoredSizeOverflowAndMixedChildrenKeepNoWrapAndCrossAxisAlignment() {
        val collector=AWCInspectionCollector()
        compose.setContent { AWCTheme { Box(Modifier.width(240.dp)) { AWCInspectionScope(collector) {
            AWCButtonGroupAppearanceScope(AWCButtonGroupAppearance(width=500.0,height=72.0,gap=6.0)) {
                AWCComponent("md-button-group",modifier=Modifier.testTag("group")) {
                    child("first");AWCComponent("md-icon-button",mapOf("icon" to "favorite","aria-label" to "icon"),Modifier.testTag("icon"));child("last")
                }
            }
        } } } }
        compose.runOnIdle { assertEquals(500.0,collector.snapshot().nodes.first { it.id=="component" }.bounds.width,.5) }
        assertEquals(72f,bounds("first").height.value,.5f);assertEquals(40f,bounds("icon").height.value,.5f)
        assertEquals(6f,bounds("icon").left.value-bounds("first").right.value,.5f)
    }
    @Test fun mixedFlexMatchesContentBoxAllocationAndLowHeightKeepsControlFloors() {
        var appearance by mutableStateOf(AWCButtonGroupAppearance(width=200.0,height=20.0))
        var full by mutableStateOf(true)
        compose.setContent { AWCTheme { Box(Modifier.width(200.dp)) { AWCButtonGroupAppearanceScope(appearance) {
            AWCComponent("md-button-group",mapOf("fullWidth" to full),Modifier.testTag("group")) {
                child("long label is clipped");AWCComponent("md-icon-button",mapOf("icon" to "favorite"),Modifier.testTag("icon"));child("last")
            }
        } } } }
        assertEquals(69.333f,bounds("long label is clipped").width.value,1f)
        assertEquals(37.333f,bounds("icon").width.value,1f)
        assertEquals(20f,bounds("group").height.value,.5f)
        assertEquals(40f,bounds("last").height.value,.5f)
        assertEquals(40f,bounds("icon").height.value,.5f)
    }
    @Test fun rawClickReconciliationFollowsCancellationSoftDisabledLoadingAndRequired() {
        compose.mainClock.autoAdvance=false
        var blocked by mutableStateOf("");var required by mutableStateOf(false)
        val state=AWCButtonGroupState();val events=mutableListOf<String>();val deltas=mutableListOf<AWCValue>()
        compose.setContent { AWCTheme { AWCButtonGroupStateScope(state) {
            AWCActionScope(onAction={ if(blocked=="cancel") it.preventDefault() }) {
                AWCComponent("md-button-group",mapOf("required" to required),onEvent={n,v->events+=n;deltas+=v}) {
                    child("a",true,onEvent={n,_->events+=n})
                    child("b",props=mapOf("softDisabled" to (blocked=="soft"),"loading" to (blocked=="loading")),onEvent={n,_->events+=n})
                }
            }
        } } }
        compose.runOnIdle { blocked="cancel" };compose.mainClock.advanceTimeBy(500)
        compose.onNodeWithText("b").performTouchInput {click()}
        compose.runOnIdle { assertEquals(listOf(false,false),state.snapshot());assertEquals(listOf("mdClick","mdSelectionChange"),events);events.clear();required=true;blocked="soft" };compose.mainClock.advanceTimeBy(500)
        compose.onNodeWithText("b").performTouchInput {click()}
        compose.runOnIdle { assertEquals(listOf(false,true),state.snapshot());assertEquals(listOf("mdSelectionChange"),events);events.clear();blocked="loading" };compose.mainClock.advanceTimeBy(500)
        compose.onNodeWithText("b").performTouchInput {click()}
        compose.runOnIdle { assertEquals(listOf(false,true),state.snapshot());assertEquals(listOf("mdSelectionChange"),events) }
    }
    @Test fun multiSelectionKeepsDuplicateValuesAndEmitsChildBeforeGroup() {
        val state=AWCButtonGroupState();val events=mutableListOf<Pair<String,AWCValue>>()
        compose.setContent { AWCTheme { AWCButtonGroupStateScope(state) {
            AWCComponent("md-button-group",mapOf("selectionMode" to "multi-select"),onEvent={n,v->events+=n to v}) {
                child("a",true,props=mapOf("value" to "same"),onEvent={n,v->events+=n to v})
                child("b",props=mapOf("value" to "same"),onEvent={n,v->events+=n to v})
            }
        } } }
        compose.onNodeWithText("b").performTouchInput {click()}
        compose.runOnIdle {
            assertEquals(listOf(true,true),state.snapshot());assertEquals(listOf("mdClick","mdChange","mdSelectionChange"),events.map { it.first })
            assertEquals(mapOf("values" to listOf("same","same"),"added" to emptyList<String>(),"removed" to emptyList<String>()),events.last().second)
        }
    }
    @Test fun retainedKeyedReorderingUpdatesSnapshotAndKeyboardTraversal() {
        var order by mutableStateOf(listOf("a","b","c"));var rtl by mutableStateOf(false)
        val handles=listOf("a","b","c").associateWith { AWCButtonFocusState() };val state=AWCButtonGroupState()
        compose.setContent { CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
            AWCTheme { AWCButtonGroupStateScope(state) { AWCComponent("md-button-group") {
                order.forEach { title-> key(title) { AWCButtonFocusScope(handles.getValue(title)) { child(title,title=="b") } } }
            } } }
        } }
        compose.runOnIdle { order=listOf("c","a","b");rtl=true }
        compose.runOnIdle { assertEquals(listOf(false,false,true),state.snapshot());assertTrue(handles.getValue("c").requestFocus()) }
        compose.onNodeWithText("c").performKeyInput {pressKey(Key.DirectionLeft)}
        compose.runOnIdle { assertTrue(handles.getValue("a").isFocused) }
        assertTrue(bounds("c").left>bounds("a").left)
    }
    @Test fun connectedCornersOverrideCustomRadiusAndFlipInRTL() {
        var rtl by mutableStateOf(false);var selected by mutableStateOf(false)
        compose.mainClock.autoAdvance=false
        compose.setContent { CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
            AWCTheme { Box(Modifier.background(Color.Black)) { AWCButtonAppearanceScope(AWCButtonAppearance(containerColor="#FFFFFF",cornerRadius=0.0)) {
                AWCComponent("md-button-group",mapOf("variant" to "connected","size" to "md")) { child("a",selected);child("b") }
            } } }
        } }
        fun pixels():Pair<Float,Float> { val p=compose.onNodeWithTag("a",true).captureToImage().toPixelMap();val x=(4*compose.density.density).toInt();return p[x,x].red to p[p.width-1-x,x].red }
        compose.mainClock.advanceTimeBy(1000);pixels().let { assertTrue(it.first<.1f);assertTrue(it.second>.9f) }
        compose.runOnIdle {rtl=true};compose.mainClock.advanceTimeBy(1000);pixels().let {assertTrue(it.first>.9f);assertTrue(it.second<.1f)}
        compose.runOnIdle {selected=true};compose.mainClock.advanceTimeBy(1000);pixels().let {assertTrue(it.first<.1f);assertTrue(it.second<.1f)}
    }
    @Test fun standardPressRedistributesNeighborWidthsThenReturnsToRest() {
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { AWCComponent("md-button-group",mapOf("size" to "md"),Modifier.testTag("group")) {child("Alpha");child("Bravo");child("Charlie")} } }
        compose.mainClock.advanceTimeBy(1000)
        val widths=listOf("Alpha","Bravo","Charlie").map { bounds(it).width.value };val total=bounds("group").width.value
        compose.onNodeWithText("Bravo").performTouchInput {down(center)}
        compose.mainClock.advanceTimeBy(180)
        assertTrue("Motion widths before=$widths after=${listOf("Alpha","Bravo","Charlie").map { bounds(it).width.value }} enabled=${android.animation.ValueAnimator.areAnimatorsEnabled()}",bounds("Bravo").width.value>widths[1]+7f)
        assertTrue(bounds("Alpha").width.value<widths[0]-3f)
        assertEquals(total,bounds("group").width.value,1f)
        compose.onNodeWithText("Bravo").performTouchInput {cancel()};compose.mainClock.advanceTimeBy(1000)
        for((i,id) in listOf("Alpha","Bravo","Charlie").withIndex()) assertEquals(widths[i],bounds(id).width.value,.5f)
    }
    @Test fun nestedAndWrappedDescendantsShareStateBubbleInnerThenOuterAndUseOuterNavigation() {
        val outer=AWCButtonGroupState();val inner=AWCButtonGroupState()
        val events=mutableListOf<Pair<String,AWCValue>>()
        var rtl by mutableStateOf(false)
        var multi by mutableStateOf(false)
        compose.setContent { CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
            AWCTheme { AWCButtonGroupStateScope(outer) {
                AWCComponent("md-button-group",mapOf("selectionMode" to if(multi) "multi-select" else "single-select"),onEvent={_,v->events+="outer" to v}) {
                    AWCComponent("md-button",mapOf("label" to "A","value" to "A","selected" to true))
                    AWCButtonGroupStateScope(inner) {
                        AWCComponent("md-button-group",mapOf("required" to true),onEvent={_,v->events+="inner" to v}) {
                            AWCComponent("md-button",mapOf("label" to "B","value" to "B","selected" to true))
                            AWCComponent("md-button",mapOf("label" to "C","value" to "C"))
                        }
                    }
                    Box { AWCComponent("md-icon-button",mapOf("icon" to "add","aria-label" to "D","value" to "D")) }
                    AWCComponent("md-button",mapOf("label" to "E","value" to "E","disabled" to true))
                }
            } }
        } }
        compose.runOnIdle { assertEquals(listOf(true,true,false,false,false),outer.snapshot()) }
        compose.onNodeWithText("C").performClick()
        compose.runOnIdle {
            assertEquals(listOf("inner","outer"),events.map { it.first })
            assertEquals(listOf("C"),(events[0].second as Map<*,*>)["values"])
            assertEquals(listOf("C"),(events[1].second as Map<*,*>)["values"])
            assertEquals(listOf(false,false,true,false,false),outer.snapshot())
            assertEquals(listOf(false,true),inner.snapshot());multi=true
        }
        compose.onNodeWithText("A").performClick()
        compose.runOnIdle { assertEquals(listOf("A","C"),(events.last().second as Map<*,*>)["values"]) }
        compose.onNodeWithText("C").performKeyInput { keyDown(Key.MoveEnd);keyUp(Key.MoveEnd) }
        compose.onNodeWithContentDescription("D").assertIsFocused()
        compose.onNodeWithContentDescription("D").performKeyInput { keyDown(Key.MoveHome);keyUp(Key.MoveHome) }
        compose.onNodeWithText("A").assertIsFocused()
        compose.onNodeWithText("A").performKeyInput { keyDown(Key.DirectionRight);keyUp(Key.DirectionRight) }
        compose.onNodeWithText("B").assertIsFocused()
        compose.runOnIdle { rtl=true }
        compose.onNodeWithText("B").performKeyInput { keyDown(Key.DirectionRight);keyUp(Key.DirectionRight) }
        compose.onNodeWithText("A").assertIsFocused()
    }

    @Test fun wrappedKeyedOrderAndDirectSlotFloorsStaySeparateAndObserverClearsOnUnmount() {
        val observer=AWCButtonGroupState()
        var reverse by mutableStateOf(false);var mounted by mutableStateOf(true)
        val collector=AWCInspectionCollector()
        compose.setContent { AWCTheme { if(mounted) AWCButtonGroupStateScope(observer) {
            AWCButtonGroupAppearanceScope(AWCButtonGroupAppearance(maxHeight=20.0)) {
                AWCComponent("md-button-group",mapOf("size" to "xs","variant" to "connected","selectionMode" to "multi-select")) {
                    AWCComponent("md-button",mapOf("label" to "A","value" to "A"),Modifier.testTag("direct"))
                    Column {
                        for(value in if(reverse) listOf("C","B") else listOf("B","C")) key(value) {
                            AWCInspectionScope(collector,id=value) {
                                AWCComponent("md-button",mapOf("label" to value,"value" to value,"selected" to (value=="B")),Modifier.testTag(value))
                            }
                        }
                    }
                }
            }
        } } }
        compose.onNodeWithTag("direct",true).assertHeightIsEqualTo(20.dp)
        compose.runOnIdle {
            assertEquals(32.0,collector.snapshot().nodes.first { it.id=="B" }.bounds.height,.5)
            assertEquals(listOf(false,true,false),observer.snapshot());reverse=true
        }
        compose.runOnIdle { assertEquals(listOf(false,false,true),observer.snapshot());mounted=false }
        compose.runOnIdle { assertTrue(observer.snapshot().isEmpty()) }
    }

    @Test fun nestedPropertySynchronizationUsesLatestOwnerAndInitialOuterOwner() {
        var outerSize by mutableStateOf("lg");var innerSize by mutableStateOf("xs")
        var innerVariant by mutableStateOf("standard")
        val collector=AWCInspectionCollector()
        compose.setContent { AWCTheme {
            AWCComponent("md-button-group",mapOf("size" to outerSize,"shape" to "round","variant" to "connected")) {
                AWCComponent("md-button",mapOf("label" to "A"))
                AWCComponent("md-button-group",mapOf("size" to innerSize,"shape" to "square","variant" to innerVariant)) {
                    AWCInspectionScope(collector) { AWCComponent("md-icon-button",mapOf("icon" to "add")) }
                }
            }
        } }
        fun height(expected:Double)=compose.runOnIdle { assertEquals(expected,collector.snapshot().nodes.first { it.id=="component" }.bounds.height,.5) }
        height(96.0)
        compose.runOnIdle { innerSize="md" };height(56.0)
        compose.runOnIdle { outerSize="sm" };height(40.0)
        compose.runOnIdle { innerVariant="connected" };height(56.0)
    }

}
