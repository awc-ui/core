@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.objects
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/** contentMaxHeight against the 38 actual-Web scrolling configurations plus the retained-offset lifecycle. */
class NativeAccordionScrollingTest {
    @get:Rule val compose=createComposeRule()
    private var cap by mutableStateOf("")
    private var height by mutableDoubleStateOf(20.0)
    private var density by mutableDoubleStateOf(0.0)
    private var expanded by mutableStateOf(true)
    private var epoch by mutableIntStateOf(0)
    private var clicks=0
    private val collector=AWCInspectionCollector()
    private fun node(id:String)=collector.snapshot().nodes.singleOrNull { it.id==id }
    private fun scroller()=compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange))
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { run { Box(Modifier.width(400.dp)) {
        AWCInspectionScope(collector) { key(epoch) {
            AWCComponent("md-accordion",mapOf("transition" to "none")) { slot-> if(slot=="")
                AWCComponent("md-accordion-item",mapOf("headline" to "Scroller","expanded" to expanded,"contentMaxHeight" to cap,"density" to density)) { if(it=="") Box(Modifier.fillMaxWidth().height(height.dp)) {
                    var value by remember { mutableIntStateOf(0) }
                    Button(onClick={ value++;clicks++ }) { Text("Retained $value") } } }
            }
        } }
    } } } } } }

    @Test fun thirtyEightWebCapsMatchViewportDocumentFocusabilityAndRoot() {
        val reference=AccordionWebFixtures.document("AccordionWebScrolling.json").getJSONArray("cases").objects()
        content()
        val failures=mutableListOf<String>();var checks=0
        for(c in reference) {
            compose.runOnIdle { cap=c.getString("cap");height=c.getDouble("height");density=c.getDouble("density");expanded=true;epoch++ }
            compose.waitForIdle()
            val id="'${c.getString("cap")}'/${c.getDouble("height")}/${c.getDouble("density")}"
            fun near(label:String,web:Double,native:Double?) { checks++;if(native==null || abs(web-native)>.51) failures+="$id $label Web=$web Android=$native" }
            near("root height",c.getDouble("rootHeight"),node("component")?.bounds?.height)
            near("content-inner (viewport) height",c.getDouble("bodyHeight"),node("component.item-0.content-inner")?.bounds?.height)
            val scrollable=c.getInt("tabIndex")==0
            val nodes=compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)).fetchSemanticsNodes()
            checks++;if(nodes.size!=(if(scrollable) 1 else 0)) failures+="$id scroll container present=${nodes.size} expected tabIndex=${c.getInt("tabIndex")}"
            if(scrollable && nodes.size==1) {
                val range=nodes[0].config[SemanticsProperties.VerticalScrollAxisRange]
                near("scroll range",c.getDouble("scrollHeight")-c.getDouble("clientHeight"),range.maxValue()/2.0)
                checks++;if(!nodes[0].config.contains(SemanticsProperties.Focused)) failures+="$id scroll container is not a focus target (source tabindex=0)"
            }
        }
        AccordionEvidence.log("scrolling",JSONObject().put("cases",reference.size).put("checks",checks).put("failures",failures.size))
        assertEquals(38,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
    }

    @Test fun retainedOffsetSurvivesCollapseAndCapEditsAndKeyboardScrollsTheRealContainer() {
        val lifecycle=AccordionWebFixtures.document("AccordionWebScrolling.json").getJSONArray("lifecycle").objects().associateBy { it.getString("stage") }
        content()
        compose.runOnIdle { cap="70px";height=240.0;density=0.0;expanded=true;epoch++ };compose.waitForIdle()
        compose.onNodeWithText("Retained 0").performClick();compose.waitForIdle()
        scroller().performSemanticsAction(SemanticsActions.ScrollBy) { it(0f,200f) };compose.waitForIdle()
        fun state(stage:String) {
            val web=lifecycle.getValue(stage)
            assertEquals("$stage root",web.getDouble("rootHeight"),node("component")!!.bounds.height,.51)
            if(web.getInt("tabIndex")==0) {
                val range=scroller().fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange]
                if(!web.optBoolean("inert")) assertEquals("$stage scrollTop",web.getDouble("scrollTop"),range.value()/2.0,.51)
                assertEquals("$stage viewport",web.getDouble("bodyHeight"),node("component.item-0.content-inner")!!.bounds.height,.51)
            } else compose.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)).assertCountEquals(0)
        }
        state("scrolled")
        compose.runOnIdle { expanded=false };compose.waitForIdle()
        assertEquals("closed root",64.0,node("component")!!.bounds.height,.51)
        compose.onNodeWithText("Retained 1").assertDoesNotExist()
        compose.runOnIdle { expanded=true };compose.waitForIdle()
        state("reopened");compose.onNodeWithText("Retained 1",useUnmergedTree=true).assertExists()
        compose.runOnIdle { cap="120px" };compose.waitForIdle();state("cap:120px")
        compose.runOnIdle { cap="" };compose.waitForIdle();state("cap:")
        compose.runOnIdle { cap="70px" };compose.waitForIdle();state("cap:70px")
        assertEquals("authored control retained its state across every edit",1,clicks)
        // Keyboard: Tab from the header reaches the scroll container; keys move the actual offset.
        compose.onNode(hasText("Scroller") and hasClickAction()).requestFocus();compose.waitForIdle()
        compose.onNode(hasText("Scroller") and hasClickAction()).performKeyInput { pressKey(Key.Tab) };compose.waitForIdle()
        fun offset()=scroller().fetchSemanticsNode().config[SemanticsProperties.VerticalScrollAxisRange].value()/2.0
        // The authored Button is the next focus target inside the scroll container; the
        // container itself is a focus stop (source tabindex=0) reached before its content.
        scroller().assertIsFocused()
        scroller().performKeyInput { pressKey(Key.MoveHome) };compose.waitForIdle();assertEquals(0.0,offset(),.51)
        scroller().performKeyInput { pressKey(Key.DirectionDown) };compose.waitForIdle();assertEquals(40.0,offset(),.51)
        scroller().performKeyInput { pressKey(Key.MoveEnd) };compose.waitForIdle();assertEquals(170.0,offset(),.51)
        AccordionEvidence.log("scrolling-lifecycle",JSONObject().put("stages",6).put("keyboard",3))
    }
}
