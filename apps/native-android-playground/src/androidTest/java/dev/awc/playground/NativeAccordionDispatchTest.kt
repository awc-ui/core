package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.nativeui.generated.AWCNativeCatalog
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/** Production dispatch: AWCComponent renders md-accordion/md-accordion-item with the dedicated renderer. */
class NativeAccordionDispatchTest {
    @get:Rule val compose=createComposeRule()
    private val collector=AWCInspectionCollector()
    private fun node(id:String)=collector.snapshot().nodes.singleOrNull { it.id==id }
    private fun header(text:String)=compose.onNode(hasText(text) and SemanticsMatcher.keyIsDefined(SemanticsProperties.StateDescription))
    private fun state(text:String)=header(text).fetchSemanticsNode().config[SemanticsProperties.StateDescription]

    @Test fun defaultDispatchRendersThePlaygroundSampleWithTheDedicatedRenderer() {
        val events=mutableListOf<Pair<String,AWCValue>>()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { Box(Modifier.width(400.dp)) {
            AWCInspectionScope(collector) {
                AWCComponent("md-accordion",AWCNativeCatalog.defaults["md-accordion"].orEmpty()+fixture("md-accordion"),onEvent={ n,v-> events+=n to v }) { SampleSlot("md-accordion",it) { n,v-> events+=n to v } }
            }
        } } } }
        compose.waitForIdle()
        // Dedicated parts and owned items (the legacy adapter exposed none of these).
        for(i in 0..1) { assertNotNull("item-$i",node("component.item-$i"));assertNotNull("item-$i header",node("component.item-$i.header")) }
        assertNull("the Laboratory sample has the two items of the Web recipe",node("component.item-2"))
        val r=(0..1).map { node("component.item-$it")!!.bounds }
        assertEquals("filled tiles keep the source gap",8.0,r[1].y-(r[0].y+r[0].height),.51)
        assertEquals("Expanded",state("A shared design language"))
        assertEquals("Collapsed",state("Native by design"))
        assertTrue("keep-one locks the open header",header("A shared design language").fetchSemanticsNode().config.contains(SemanticsProperties.Disabled))
        // The recipe authors the first item open: committing defaultExpanded "0" changes nothing, so no toggle is emitted (source @Watch semantics).
        assertTrue("no connection toggle for an already open authored item",events.none { it.first=="mdToggle" })
        events.clear()
        header("Native by design").performClick();compose.waitForIdle()
        assertEquals("Expanded",state("Native by design"));assertEquals("Collapsed",state("A shared design language"))
        val toggle=events.last { it.first=="mdToggle" }.second as Map<*,*>
        assertEquals(1,toggle["index"]);assertEquals(true,toggle["expanded"]);assertEquals(listOf(1),toggle["expandedIndices"])
        AccordionEvidence.log("dispatch-sample",JSONObject().put("items",2).put("gap",r[1].y-(r[0].y+r[0].height)))
    }

    @Test fun itemsWrappedInAnotherLayoutAreNeverOwnedNotEvenAtConnection() {
        val group=mutableListOf<Pair<String,AWCValue>>();val items=mutableListOf<Pair<String,AWCValue>>()
        compose.mainClock.autoAdvance=false
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { Box(Modifier.width(400.dp)) {
            AWCInspectionScope(collector) {
                AWCComponent("md-accordion",mapOf("defaultExpanded" to "0,1","keepOneExpanded" to true,"exclusive" to true),onEvent={ n,v-> group+=n to v }) { slot-> if(slot=="") {
                    Column { listOf("w0","w1").forEach { t-> AWCComponent("md-accordion-item",mapOf("headline" to t),onEvent={ n,v-> items+="$t:$n" to v }) { if(it=="") Text("Body $t") } } }
                    AWCComponent("md-accordion-item",mapOf("headline" to "d0"),onEvent={ n,v-> items+="d0:$n" to v }) { if(it=="") Text("Body d0") }
                    AWCComponent("md-accordion-item",mapOf("headline" to "d1"),onEvent={ n,v-> items+="d1:$n" to v }) { if(it=="") Text("Body d1") }
                } }
            }
        } } } }
        // Frame 0 is the initial composition (the connection's recomposition needs the first
        // test-clock frame); from frame 1 the connected selection is presented. A provisional
        // (wrongly owned) wrapped item would be index 0 and take the exclusive default.
        val frames=mutableListOf<String>();val panels=mutableListOf<Double?>()
        repeat(5) { f->
            compose.waitForIdle()
            val w0=runCatching { state("w0") }.getOrNull();val w1=runCatching { state("w1") }.getOrNull()
            val d0=runCatching { state("d0") }.getOrNull();val d1=runCatching { state("d1") }.getOrNull()
            val panel=compose.runOnIdle { node("component.item-0.panel")?.bounds?.height };panels+=panel
            frames+="$f:w0=$w0,w1=$w1,d0=$d0,d1=$d1,panel=$panel"
            assertEquals("frame $f wrapped item untouched by defaultExpanded ($frames)","Collapsed",w0)
            assertEquals("frame $f wrapped item untouched by defaultExpanded ($frames)","Collapsed",w1)
            if(f>=1) assertEquals("frame $f first direct item selected at connection ($frames)","Expanded",d0)
            assertEquals("frame $f exclusive keeps only the first default ($frames)","Collapsed",d1)
            compose.mainClock.advanceTimeByFrame()
        }
        compose.mainClock.autoAdvance=true;compose.waitForIdle()
        val settled=compose.runOnIdle { node("component.item-0.panel")!!.bounds.height }
        assertTrue(settled>0)
        for(f in 1..4) assertEquals("frame $f connection selects without an opening transition ($frames)",settled,panels[f]!!,.01)
        assertTrue("connection events name only direct items: $group",group.filter { it.first=="mdToggle" }.map { (it.second as Map<*,*>)["index"] }==listOf<Any?>(0))
        assertTrue("wrapped items emit nothing at connection: $items",items.none { it.first.startsWith("w") })
        // Only the two direct items are owned (inspection ids follow ownership).
        assertNotNull(node("component.item-0"));assertNotNull(node("component.item-1"));assertNull(node("component.item-2"))
        // A wrapped item toggles alone: no exclusive coordination, no lock, no group event.
        group.clear()
        header("w1").performClick();compose.waitForIdle()
        assertEquals("Expanded",state("w1"));assertEquals("Expanded",state("d0"))
        assertTrue("no group event for a wrapped item: $group",group.none { it.first=="mdToggle" })
        assertTrue(items.any { it.first=="w1:mdItemToggle" })
        header("w1").performClick();compose.waitForIdle()
        assertEquals("not locked by keep-one","Collapsed",state("w1"))
        // Direct items keep their coordination.
        header("d1").performClick();compose.waitForIdle()
        assertEquals("Expanded",state("d1"));assertEquals("Collapsed",state("d0"))
        assertEquals(1,(group.last { it.first=="mdToggle" }.second as Map<*,*>)["index"])
        AccordionEvidence.log("dispatch-wrapped",JSONObject().put("frames",org.json.JSONArray(frames)).put("settledPanel",settled))
    }
}
