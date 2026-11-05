@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.foundation.focusable
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Real Compose input (pointer, keyboard, semantics actions, controllers) on the dedicated renderer. */
class NativeAccordionInteractionTest {
    @get:Rule val compose=createComposeRule()
    private val log=mutableListOf<String>()
    private val payloads=mutableListOf<Pair<String,AWCValue>>()
    private fun record(source:String):(String,AWCValue)->Unit={ n,v-> log+="$source:$n";payloads+="$source:$n" to v }
    private var checks=0
    private fun check(label:String,condition:Boolean) { checks++;assertTrue(label,condition) }
    private fun <T> same(label:String,expected:T,actual:T) { checks++;assertEquals(label,expected,actual) }
    private fun header(text:String)=compose.onNode(hasText(text) and SemanticsMatcher.keyIsDefined(AWCAccordionHeadingLevel))
    private fun key(text:String,key:Key,alt:Boolean=false) { header(text).performKeyInput { if(alt) withKeyDown(Key.AltLeft) { pressKey(key) } else pressKey(key) };compose.waitForIdle() }

    @Composable private fun Group(props:Map<String,AWCValue>,items:List<Map<String,AWCValue>>,controllers:List<AWCAccordionItemController> = emptyList(),
                                  body:@Composable (Int)->Unit={ Text("Body ${it}") }) {
        CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { run {
            Box(Modifier.width(400.dp)) {
                AWCComponent("md-accordion",props,onEvent=record("group")) { slot-> if(slot=="") items.forEachIndexed { i,p->
                    key(p["headline"]) {
                        val item=@Composable { AWCComponent("md-accordion-item",p,onEvent=record("item$i")) { s-> if(s=="") body(i) } }
                        if(i<controllers.size) AWCAccordionItemControllerScope(controllers[i]) { item() } else item()
                    }
                } }
            }
        } } }
    }
    private fun items(vararg names:String,extra:(Int)->Map<String,AWCValue> = { emptyMap() })=names.mapIndexed { i,n-> mapOf<String,AWCValue>("headline" to n)+extra(i) }

    @Test fun pointerToggleEmitsItemThenGroupPayloadsAndExclusiveClosesSibling() {
        compose.setContent { Group(mapOf("exclusive" to true,"transition" to "none"),items("One","Two")) }
        compose.waitForIdle();log.clear();payloads.clear()
        header("One").performClick();compose.waitForIdle()
        same("open order",listOf("item0:mdItemToggle","group:mdToggle"),log.toList())
        same("item payload",mapOf("expanded" to true,"index" to 0),payloads[0].second)
        same("group payload",mapOf("index" to 0,"expanded" to true,"expandedIndices" to listOf(0)),payloads[1].second)
        compose.onNodeWithText("Body 0").assertIsDisplayed()
        log.clear();payloads.clear()
        header("Two").performClick();compose.waitForIdle()
        // Source: Two's Watch emits, the owner closes One synchronously (nested), then reports Two.
        same("exclusive order",listOf("item1:mdItemToggle","item0:mdItemToggle","group:mdToggle","group:mdToggle"),log.toList())
        same("nested close payload",mapOf("index" to 0,"expanded" to false,"expandedIndices" to listOf(1)),payloads[2].second)
        same("final payload",mapOf("index" to 1,"expanded" to true,"expandedIndices" to listOf(1)),payloads[3].second)
        compose.onNodeWithText("Body 0").assertDoesNotExist()
        compose.onNodeWithText("Body 1").assertIsDisplayed()
    }

    @Test fun keepOneLocksOpenItemDisabledItemIsInertAndDefaultsEmitAtConnection() {
        compose.setContent { Group(mapOf("keepOneExpanded" to true,"defaultExpanded" to "1","transition" to "none"),
            items("One","Two","Off") { if(it==2) mapOf("disabled" to true) else emptyMap() }) }
        compose.waitForIdle()
        same("connection events",listOf("item1:mdItemToggle","group:mdToggle"),log.toList())
        same("connection payload",mapOf("index" to 1,"expanded" to true,"expandedIndices" to listOf(1)),payloads[1].second)
        log.clear()
        // Locked: still focusable and announced as unavailable, but activation does nothing.
        header("Two").assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Disabled)).assertHasClickAction().performClick();compose.waitForIdle()
        same("locked click",emptyList<String>(),log.toList())
        compose.onNodeWithText("Body 1").assertIsDisplayed()
        check("locked header has no collapse action",header("Two").fetchSemanticsNode().config.getOrNull(SemanticsActions.Collapse)==null)
        header("Off").assertIsNotEnabled().performClick();compose.waitForIdle()
        same("disabled click",emptyList<String>(),log.toList())
        // Opening another item releases the lock (source syncCollapsible).
        header("One").performClick();compose.waitForIdle()
        check("released",header("Two").fetchSemanticsNode().config.getOrNull(SemanticsProperties.Disabled)==null)
        header("Two").performClick();compose.waitForIdle()
        compose.onNodeWithText("Body 1").assertDoesNotExist()
    }

    @Test fun keyboardNavigationWrapsSkipsDisabledAndActivatesWithEnterAndSpace() {
        val controllers=List(4) { AWCAccordionItemController() }
        compose.setContent { Group(mapOf("transition" to "none"),items("One","Two","Off","Four") { if(it==2) mapOf("disabled" to true) else emptyMap() },controllers) }
        compose.waitForIdle()
        compose.runOnIdle { controllers[0].focusHeader() };compose.waitForIdle()
        header("One").assertIsFocused();log.clear();payloads.clear()
        key("One",Key.DirectionDown);header("Two").assertIsFocused()
        same("focus request payload","item0:mdItemRequestFocus" to mapOf("direction" to "next","from" to 0),payloads[0].first to payloads[0].second)
        key("Two",Key.DirectionDown);header("Four").assertIsFocused()
        key("Four",Key.DirectionDown);header("One").assertIsFocused()
        key("One",Key.DirectionUp);header("Four").assertIsFocused()
        key("Four",Key.MoveHome);header("One").assertIsFocused()
        key("One",Key.MoveEnd);header("Four").assertIsFocused()
        log.clear()
        key("Four",Key.Enter);compose.onNodeWithText("Body 3").assertIsDisplayed()
        key("Four",Key.Spacebar);compose.onNodeWithText("Body 3").assertDoesNotExist()
        same("keyboard toggles",listOf("item3:mdItemToggle","group:mdToggle","item3:mdItemToggle","group:mdToggle"),log.toList())
        // Controllers: toggle() follows the source guards; focusHeader() ignores disabled items.
        compose.runOnIdle { controllers[1].toggle() };compose.waitForIdle()
        compose.onNodeWithText("Body 1").assertIsDisplayed()
        check("controller state",controllers[1].isExpanded && controllers[1].isConnected)
        compose.runOnIdle { controllers[2].toggle();controllers[2].focusHeader() };compose.waitForIdle()
        check("disabled controller toggle ignored",!controllers[2].isExpanded)
        header("Four").assertIsFocused()
    }

    @Test fun altArrowReorderMovesRetainedItemAndReportsOriginalOrder() {
        compose.setContent { Group(mapOf("reorderable" to true,"transition" to "none"),items("One","Two","Three")) }
        compose.waitForIdle()
        header("One").performClick();compose.waitForIdle()
        header("One").requestFocus();compose.waitForIdle();log.clear();payloads.clear()
        key("One",Key.DirectionDown,alt=true)
        same("reorder events",listOf("item0:mdItemRequestReorder","group:mdReorder"),log.toList())
        same("request payload",mapOf("direction" to "down","from" to 0),payloads[0].second)
        same("reorder payload",mapOf("from" to 0,"to" to 1,"order" to listOf(1,0,2)),payloads[1].second)
        header("One").assertIsFocused()
        compose.onNodeWithText("Body 0").assertIsDisplayed()
        val one=header("One").fetchSemanticsNode().boundsInRoot;val two=header("Two").fetchSemanticsNode().boundsInRoot
        check("One now displayed below Two",one.top>two.top)
        log.clear();payloads.clear()
        key("One",Key.DirectionDown,alt=true)
        same("second move",mapOf("from" to 1,"to" to 2,"order" to listOf(1,2,0)),payloads[1].second)
        key("One",Key.DirectionDown,alt=true)
        same("boundary emits request only",listOf("item0:mdItemRequestReorder","group:mdReorder","item0:mdItemRequestReorder"),log.toList())
        // The moved item keeps its index-based event detail.
        header("One").performClick();compose.waitForIdle()
        same("toggle index after reorder",mapOf("index" to 2,"expanded" to false,"expandedIndices" to emptyList<Int>()),payloads.last().second)
    }

    @Test fun collapsedContentIsRetainedButRemovedFromSemanticsFocusAndInput() {
        var clicks=0
        val controllers=List(2) { AWCAccordionItemController() }
        compose.setContent { Group(mapOf("transition" to "none"),items("One","Two") { if(it==0) mapOf("expanded" to true) else emptyMap() },controllers) { i->
            if(i==0) Column { var count by remember { mutableIntStateOf(0) }
                Button(onClick={ count++;clicks++ }) { Text("Count $count") }
                Box(Modifier.size(12.dp).focusable().testTag("probe")) } else Text("Body $i") } }
        compose.waitForIdle()
        compose.onNodeWithText("Count 0").performClick();compose.waitForIdle()
        // A focus target inside the open panel (focusable in every input mode).
        compose.onNodeWithTag("probe").requestFocus();compose.waitForIdle()
        compose.onNodeWithTag("probe").assertIsFocused()
        // Programmatic collapse while a descendant has focus: the source makes it inert.
        compose.runOnIdle { controllers[0].toggle() };compose.waitForIdle()
        compose.onNodeWithText("Count 1").assertDoesNotExist()
        // The accessibility (merged) tree no longer contains any retained descendant;
        // NativeAccordionAccessibilityTest checks the platform AccessibilityNodeInfo tree.
        compose.onAllNodes(hasText("Count",substring=true)).assertCountEquals(0)
        compose.onAllNodes(isFocused()).assertCountEquals(0)
        compose.onNodeWithTag("probe").assertDoesNotExist()
        // Keyboard traversal skips the retained hidden subtree.
        compose.runOnIdle { controllers[0].focusHeader() };compose.waitForIdle()
        header("One").performKeyInput { pressKey(Key.Tab) };compose.waitForIdle()
        header("Two").assertIsFocused()
        header("One").performClick();compose.waitForIdle()
        compose.onNodeWithText("Count 1").assertIsDisplayed().performClick();compose.waitForIdle()
        compose.onNodeWithText("Count 2").assertIsDisplayed()
        same("retained local state",2,clicks)
    }

    @Test fun collapsedPanelBlocksPointerInputAtTheRetainedControlsPosition() {
        var clicks=0
        val controller=AWCAccordionItemController()
        compose.setContent { Column { Group(mapOf("transition" to "none"),items("Only") { mapOf("expanded" to true) },listOf(controller)) {
            Button(onClick={ clicks++ }) { Text("Hidden target") } }
            Spacer(Modifier.height(200.dp)) } }
        compose.waitForIdle()
        val bounds=compose.onNodeWithText("Hidden target").fetchSemanticsNode().boundsInRoot
        compose.onRoot().performTouchInput { click(bounds.center) };compose.waitForIdle()
        same("open control receives the click",1,clicks)
        compose.runOnIdle { controller.toggle() };compose.waitForIdle()
        compose.onRoot().performTouchInput { click(bounds.center) };compose.waitForIdle()
        same("collapsed (retained) control receives nothing",1,clicks)
    }

    @Test fun ownerControlsHeadingRegionAndCollapsibleThenRestoresAuthoredValues() {
        var inside by mutableStateOf(true)
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { run { Column(Modifier.width(400.dp)) {
            val authored=mapOf<String,AWCValue>("headline" to "Moved","headingLevel" to 5,"regionRole" to "none","expanded" to true)
            AWCComponent("md-accordion",mapOf("headingLevel" to 2,"regionThreshold" to 1,"transition" to "none")) { slot-> if(slot=="") {
                if(inside) key("moved") { AWCComponent("md-accordion-item",authored) { if(it=="") Text("Moved body") } }
                AWCComponent("md-accordion-item",mapOf("headline" to "Stay","expanded" to true)) { if(it=="") Text("Stay body") }
            } }
            if(!inside) key("moved") { AWCComponent("md-accordion-item",authored) { if(it=="") Text("Moved body") } }
        } } } } }
        compose.waitForIdle()
        same("owner heading level",2,header("Moved").fetchSemanticsNode().config[AWCAccordionHeadingLevel])
        same("owner region policy above threshold","group",compose.onNode(SemanticsMatcher.expectValue(AWCAccordionRegionLabel,"Moved")).fetchSemanticsNode().config[AWCAccordionRegionRole])
        compose.runOnIdle { inside=false };compose.waitForIdle()
        same("authored heading level restored",5,header("Moved").fetchSemanticsNode().config[AWCAccordionHeadingLevel])
        same("authored region none restored",0,compose.onAllNodes(SemanticsMatcher.expectValue(AWCAccordionRegionLabel,"Moved")).fetchSemanticsNodes().size)
        same("remaining item now region (1 <= threshold)","region",compose.onNode(SemanticsMatcher.expectValue(AWCAccordionRegionLabel,"Stay")).fetchSemanticsNode().config[AWCAccordionRegionRole])
    }

    @Test fun stoppedItemEventSkipsOwnerCoordinationButKeepsLocalState() {
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { run { Box(Modifier.width(400.dp)) {
            AWCComponent("md-accordion",mapOf("exclusive" to true,"transition" to "none"),onEvent=record("group")) { slot-> if(slot=="") {
                AWCComponent("md-accordion-item",mapOf("headline" to "One","expanded" to true),onEvent=record("item0")) { if(it=="") Text("Body 0") }
                AWCActionTargetScope(listeners=listOf({ e:AWCActionEvent-> if(e.name=="mdItemToggle") e.stopPropagation() })) {
                    AWCComponent("md-accordion-item",mapOf("headline" to "Two"),onEvent=record("item1")) { if(it=="") Text("Body 1") }
                }
            } }
        } } } } }
        compose.waitForIdle();log.clear()
        header("Two").performClick();compose.waitForIdle()
        same("only the item observed its event",listOf("item1:mdItemToggle"),log.toList())
        compose.onNodeWithText("Body 0").assertIsDisplayed();compose.onNodeWithText("Body 1").assertIsDisplayed()
    }

    @Test fun nestedGroupsKeepTheirOwnCoordination() {
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { run { Box(Modifier.width(400.dp)) {
            AWCComponent("md-accordion",mapOf("exclusive" to true,"transition" to "none"),onEvent=record("outer")) { slot-> if(slot=="") {
                AWCComponent("md-accordion-item",mapOf("headline" to "Outer A","expanded" to true)) { if(it=="")
                    AWCComponent("md-accordion",mapOf("exclusive" to true,"transition" to "none"),onEvent=record("inner")) { s-> if(s=="") {
                        AWCComponent("md-accordion-item",mapOf("headline" to "Inner A","expanded" to true)) { if(it=="") Text("Inner body A") }
                        AWCComponent("md-accordion-item",mapOf("headline" to "Inner B")) { if(it=="") Text("Inner body B") }
                    } }
                }
                AWCComponent("md-accordion-item",mapOf("headline" to "Outer B")) { if(it=="") Text("Outer body B") }
            } }
        } } } } }
        compose.waitForIdle();log.clear();payloads.clear()
        header("Inner B").performClick();compose.waitForIdle()
        same("inner events only",listOf("inner:mdToggle","inner:mdToggle"),log.toList())
        compose.onNodeWithText("Inner body A").assertDoesNotExist();compose.onNodeWithText("Inner body B").assertIsDisplayed()
        header("Outer A").assertExists();compose.onNodeWithText("Outer body B").assertDoesNotExist()
        log.clear()
        header("Outer B").performClick();compose.waitForIdle()
        same("outer events only",listOf("outer:mdToggle","outer:mdToggle"),log.toList())
        compose.onNodeWithText("Inner body B").assertDoesNotExist()
    }
}
