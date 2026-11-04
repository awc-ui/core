@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import kotlinx.coroutines.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeFabMenuParityTest {
    @get:Rule val compose=createComposeRule()
    private fun settle() { compose.mainClock.advanceTimeBy(600);compose.waitForIdle() }

    @Test fun all22SourceFixturesMeasureDensitySlotsPlacementAndLogicalAlignment() {
        val reference=JSONObject(InstrumentationRegistry.getInstrumentation().context.assets.open("FabMenuWebGeometry.json").bufferedReader().use { it.readText() }).getJSONArray("results")
        var index by mutableStateOf(0)
        val menu=AWCInspectionCollector();val anchor=AWCInspectionCollector()
        compose.mainClock.autoAdvance=false
        compose.setContent {
            val fixture=reference.getJSONObject(index).getJSONObject("fixture")
            val direction=if(fixture.optString("direction")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr
            CompositionLocalProvider(LocalLayoutDirection provides direction) { AWCTheme {
                AWCFabMenuScope(Modifier.requiredSize(360.dp,480.dp)) {
                    key(index) {
                        val top=when(fixture.optString("id")) { "auto-top"->40;"auto-bottom"->380;else->200 }
                        Box(Modifier.absoluteOffset(120.dp,top.dp)) { AWCInspectionScope(anchor,"anchor") {
                            AWCComponent("md-fab",mapOf("id" to "anchor","icon" to "add","label" to "Create"))
                        } }
                        val style=fixture.optJSONObject("style")
                        AWCFabMenuAppearanceScope(AWCFabMenuAppearance(
                            style?.optString("containerColor"),style?.optString("labelColor"),
                            if(style?.has("gap")==true) style.getDouble("gap") else null)) {
                            AWCInspectionScope(menu) { AWCComponent("md-fab-menu",mapOf(
                                "anchor" to "anchor","open" to true,"placement" to fixture.optString("placement","down"),
                                "variant" to fixture.optString("variant","primary"),"density" to fixture.optInt("density",0))) { name->
                                if(name.isEmpty()) {
                                    val custom=fixture.optBoolean("customItems",false)
                                    AWCComponent("md-fab-menu-item",mapOf("icon" to "edit","label" to if(custom) "" else "Edit")) { part->
                                        if(custom && part=="icon") Text("")
                                        if(custom && part.isEmpty()) AWCSlotText("Authored label")
                                    }
                                    AWCComponent("md-fab-menu-item",mapOf("icon" to "content_copy","label" to "Duplicate","disabled" to custom))
                                    AWCComponent("md-fab-menu-item",mapOf("icon" to "share","label" to "Share","softDisabled" to custom))
                                }
                            } }
                        }
                    }
                }
            } }
        }
        for(i in 0 until reference.length()) {
            compose.runOnIdle { index=i };settle()
            compose.runOnIdle {
                val expected=reference.getJSONObject(i);val fixture=expected.getJSONObject("fixture")
                val name=fixture.getString("id");val nodes=menu.snapshot().nodes.associateBy { it.id }
                assertTrue("$name must expose actual menu geometry",nodes.containsKey("component"))
                val anchorBox=anchor.snapshot().nodes.first { it.id=="anchor" }.bounds
                val items=(1..3).map { nodes.getValue("component.item-$it") }
                val rtl=fixture.optString("direction")=="rtl"
                for(j in items.indices) {
                    val actual=items[j];val source=expected.getJSONArray("items").getJSONObject(j).getJSONObject("host")
                    assertEquals("$name item$j height",source.getDouble("height"),actual.bounds.height,.51)
                    // Text shaping is native; exact dimensions of empty/box geometry
                    // are asserted separately. Native string widths may differ by 2dp.
                    assertEquals("$name item$j width",source.getDouble("width"),actual.bounds.width,2.0)
                    assertEquals("$name item$j inline-end",if(rtl) anchorBox.x else anchorBox.x+anchorBox.width,
                        if(rtl) actual.bounds.x else actual.bounds.x+actual.bounds.width,.51)
                    val padding=source.getString("padding").split(' ').map { it.removeSuffix("px").toDouble() }
                    assertEquals(padding[1],actual.metrics!!.padding!!.right,.01)
                    assertEquals(padding[3],actual.metrics!!.padding!!.left,.01)
                    assertEquals(source.getString("gap").removeSuffix("px").toDouble(),actual.metrics!!.gap!!.column,.01)
                    assertEquals(source.getString("fontSize").removeSuffix("px").toDouble(),actual.metrics!!.typography!!.size,.01)
                    assertEquals(source.getString("lineHeight").removeSuffix("px").toDouble(),actual.metrics!!.typography!!.lineHeight,.01)
                    val icon=nodes.getValue("component.item-${j+1}.icon").bounds
                    val iconSize=20.0+fixture.optInt("density",0)
                    assertEquals(iconSize,icon.width,.51);assertEquals(iconSize,icon.height,.51)
                }
                val up=fixture.optString("placement")=="up" || name=="auto-bottom"
                if(up) {
                    assertTrue(items[0].bounds.y>items[1].bounds.y)
                    assertEquals(anchorBox.y-8,items[0].bounds.y+items[0].bounds.height,.51)
                } else {
                    assertTrue(items[0].bounds.y<items[1].bounds.y)
                    assertEquals(anchorBox.y+anchorBox.height+8,items[0].bounds.y,.51)
                }
                val spatial=items.sortedBy { it.bounds.y }
                val gap=expected.getJSONObject("itemsContainer").getString("gap").removeSuffix("px").toDouble()
                assertEquals(gap,spatial[1].bounds.y-spatial[0].bounds.y-spatial[0].bounds.height,.51)
            }
        }
    }

    @Test fun pointerAndKeyboardCaptureToggleMenuWithoutAnchorNotificationAndKeepSlotsMounted() {
        val controller=AWCFabMenuController();val focus=AWCButtonFocusState()
        val events=mutableListOf<String>();var mounts=0;var disposals=0
        lateinit var scope:CoroutineScope
        compose.mainClock.autoAdvance=false
        compose.setContent { scope=rememberCoroutineScope();AWCTheme {
            AWCFabMenuScope(Modifier.requiredSize(360.dp,480.dp)) {
                Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center) {
                    AWCButtonFocusScope(focus) {
                        AWCComponent("md-fab",mapOf("id" to "anchor","icon" to "add","label" to "Create"),onEvent={name,_->events+="anchor:$name"})
                    }
                }
                AWCFabMenuControllerScope(controller) {
                    AWCComponent("md-fab-menu",mapOf("anchor" to "anchor","placement" to "down","quick" to true),onEvent={name,_->events+=name}) { slot->
                        if(slot.isEmpty()) {
                            DisposableEffect(Unit) { mounts++;onDispose { disposals++ } }
                            AWCComponent("md-fab-menu-item",mapOf("label" to "Edit","icon" to "edit"))
                            AWCComponent("md-fab-menu-item",mapOf("label" to "Share","icon" to "share"))
                        }
                    }
                }
            }
        } }
        settle();compose.runOnIdle { assertFalse(controller.isOpen);assertEquals(1,mounts) }
        compose.onNodeWithContentDescription("Create").performTouchInput { click() };settle()
        compose.runOnIdle { assertTrue(controller.isOpen);assertEquals(listOf("mdOpen"),events) }
        compose.onNodeWithContentDescription("Create").performTouchInput { click() };settle()
        compose.runOnIdle { assertFalse(controller.isOpen);assertEquals(0,disposals);focus.requestFocus() };settle()
        for(key in listOf(Key.Enter,Key.Spacebar)) {
            compose.onNodeWithContentDescription("Create").performKeyInput { pressKey(key) };settle()
            compose.runOnIdle { assertTrue(controller.isOpen);assertTrue(events.none { it.startsWith("anchor:") }) }
            compose.onNodeWithContentDescription("Edit").assertIsFocused()
            compose.runOnIdle { scope.launch { controller.close();controller.whenClosed() } };settle()
        }
        compose.runOnIdle { assertEquals(1,mounts);assertEquals(0,disposals) }
    }

    @Test fun outsideFixtureTapClosesNonmodallyAndUnderlyingActionStillRuns() {
        val controller=AWCFabMenuController();lateinit var scope:CoroutineScope
        var outsideClicks=0
        compose.mainClock.autoAdvance=false
        compose.setContent { scope=rememberCoroutineScope();AWCTheme {
            AWCFabMenuScope(Modifier.requiredSize(400.dp,544.dp).testTag("viewport")) {
                Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center) {
                    Box(Modifier.requiredSize(360.dp,480.dp),contentAlignment=Alignment.Center) {
                        AWCComponent("md-fab",mapOf("id" to "anchor","icon" to "add","label" to "Create"))
                    }
                }
                AWCComponent("md-button",mapOf("label" to "Outside"),onEvent={_,_->outsideClicks++})
                AWCFabMenuControllerScope(controller) {
                    AWCComponent("md-fab-menu",mapOf("anchor" to "anchor","placement" to "down","quick" to true)) { slot->
                        if(slot.isEmpty()) AWCComponent("md-fab-menu-item",mapOf("label" to "Edit"))
                    }
                }
            }
        } }
        settle();compose.runOnIdle { scope.launch { controller.show() } };settle()
        compose.onNodeWithText("Outside").performTouchInput { click() };settle()
        compose.runOnIdle { assertFalse(controller.isOpen);assertEquals(1,outsideClicks) }
        compose.runOnIdle { scope.launch { controller.show() } };settle()
        compose.onNodeWithTag("viewport").performTouchInput { click(bottomLeft+androidx.compose.ui.geometry.Offset(2f,-2f)) };settle()
        compose.runOnIdle { assertFalse(controller.isOpen) }
    }

    @Test fun rovingFocusTypeaheadDisabledActionsAndStoppedItemPropagationMatchSource() {
        val controller=AWCFabMenuController();val anchorFocus=AWCButtonFocusState()
        val events=mutableListOf<String>();var stop by mutableStateOf(true)
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme { AWCFabMenuScope(Modifier.requiredSize(360.dp,480.dp)) {
            Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center) { AWCButtonFocusScope(anchorFocus) {
                AWCComponent("md-fab",mapOf("id" to "anchor","icon" to "add","label" to "Create"))
            } }
            AWCFabMenuControllerScope(controller) {
                AWCComponent("md-fab-menu",mapOf("anchor" to "anchor","placement" to "down","quick" to true)) { slot->
                    if(slot.isEmpty()) {
                        AWCActionTargetScope(onAction={ if(stop) it.stopPropagation() }) {
                            AWCComponent("md-fab-menu-item",mapOf("label" to "Edit"),onEvent={name,_->events+=name})
                        }
                        AWCComponent("md-fab-menu-item",mapOf("label" to "Disabled","disabled" to true),onEvent={_,_->fail("Disabled item activated")})
                        AWCComponent("md-fab-menu-item",mapOf("label" to "Soft","softDisabled" to true),onEvent={_,_->fail("Soft-disabled item activated")})
                        AWCComponent("md-fab-menu-item",mapOf("aria-label" to "Upload","label" to "   ","icon" to "photo")) { part->if(part.isEmpty()) AWCSlotText("Upload image") }
                    }
                }
            }
        } } }
        settle();compose.runOnIdle { anchorFocus.requestFocus() };settle()
        compose.onNodeWithContentDescription("Create").performKeyInput { pressKey(Key.Enter) };settle()
        compose.onNodeWithContentDescription("Edit").assertIsFocused().performKeyInput { pressKey(Key.DirectionDown) };settle()
        compose.onNodeWithContentDescription("Disabled").assertIsFocused().performKeyInput { pressKey(Key.Enter);pressKey(Key.DirectionDown) };settle()
        compose.onNodeWithContentDescription("Soft").assertIsFocused().performKeyInput { pressKey(Key.Enter);pressKey(Key.U) };settle()
        compose.onNodeWithContentDescription("Upload").assertIsFocused().performKeyInput { pressKey(Key.MoveHome) };settle()
        compose.onNodeWithContentDescription("Edit").performKeyInput { pressKey(Key.Enter) };settle()
        compose.runOnIdle { assertTrue(controller.isOpen);assertEquals(listOf("mdClick"),events);stop=false }
        compose.onNodeWithContentDescription("Edit").performKeyInput { pressKey(Key.Enter) };settle()
        compose.runOnIdle { assertFalse(controller.isOpen);assertEquals(2,events.size) }
    }

    @Test fun maskedLabelSlotRemainsMountedAndAllFiveItemStylesAffectActualLayoutAndPaint() {
        val collector=AWCInspectionCollector();var label by mutableStateOf("Authored label")
        var propertyWidth=0.0
        var disabled by mutableStateOf(false);var mounts=0;var disposals=0
        compose.mainClock.autoAdvance=false
        compose.setContent { AWCTheme {
            Box(Modifier.background(Color.White).padding(16.dp)) {
                AWCFabMenuItemAppearanceScope(AWCFabMenuItemAppearance(
                    containerColor="#123456",labelColor="#FEDCBA",iconColor="#00FF00",iconSize=32.0,cornerRadius=0.0)) {
                    AWCInspectionScope(collector) {
                        AWCComponent("md-fab-menu-item",mapOf("label" to label,"icon" to "edit","disabled" to disabled),Modifier.testTag("item")) { name->
                            if(name.isEmpty()) {
                                DisposableEffect(Unit) { mounts++;onDispose { disposals++ } }
                                AWCSlotText("Authored label",Modifier.testTag("authored"))
                            }
                        }
                    }
                }
            }
        } }
        settle()
        compose.onNodeWithTag("authored",true).assertIsNotDisplayed()
        compose.runOnIdle {
            assertEquals(32.0,collector.snapshot().nodes.first { it.id=="component.icon" }.bounds.width,.51)
            propertyWidth=collector.snapshot().nodes.first { it.id=="component" }.bounds.width
            assertEquals(1,mounts);label=""
        }
        settle();compose.onNodeWithTag("authored",true).assertIsDisplayed()
        compose.runOnIdle {
            assertEquals("Author text and the label property use the same native typography",propertyWidth,
                collector.snapshot().nodes.first { it.id=="component" }.bounds.width,.01)

        }
        fun hasColor(pixels:androidx.compose.ui.graphics.PixelMap,color:Color):Boolean=
            (0 until pixels.width).any { x->(0 until pixels.height).any { y->
                val p=pixels[x,y];kotlin.math.abs(p.red-color.red)<.01 && kotlin.math.abs(p.green-color.green)<.01 && kotlin.math.abs(p.blue-color.blue)<.01
            } }
        val enabled=compose.onNodeWithTag("item",true).captureToImage().toPixelMap()
        assertTrue(hasColor(enabled,Color(0xff123456)));assertTrue(hasColor(enabled,Color(0xfffedcba)));assertTrue(hasColor(enabled,Color.Green))
        assertEquals(Color(0xff123456).red,enabled[1,1].red,.01f)
        compose.runOnIdle { disabled=true };settle()
        val blocked=compose.onNodeWithTag("item",true).captureToImage().toPixelMap()
        assertFalse(hasColor(blocked,Color(0xff123456)));assertFalse(hasColor(blocked,Color(0xfffedcba)))
        assertTrue("Explicit icon color overrides the disabled host ink",hasColor(blocked,Color.Green))
        compose.runOnIdle { assertEquals(1,mounts);assertEquals(0,disposals) }
    }
}
