package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.objects
import dev.awc.playground.AccordionWebFixtures.toMap
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/**
 * s7-20-01 / 9-30: same as NativeAccordionInitializationTest, inside an AWCModalScope. The 20 actual-Web initialization traces (accordion-web-initialization.json): capture,
 * target and nested bubble order, cancellation/stop modes, in-listener item state,
 * final state and root height, dispatched through real native action scopes.
 */
class NativeAccordionModalInitializationTest {
    @get:Rule val compose=createComposeRule()

    @Test fun twentyWebInitializationTracesMatchThroughNativeScopes() {
        val reference=AccordionWebFixtures.document("AccordionWebInitialization.json").getJSONArray("cases").objects()
        var case by mutableStateOf<JSONObject?>(null);var epoch by mutableIntStateOf(0);var noise by mutableIntStateOf(0)
        val trace=JSONArray()
        val controllers=List(2) { AWCAccordionItemController() }
        val collector=AWCInspectionCollector()
        fun snapshot():JSONArray { val list=controllers.mapIndexed { i,c-> i to c }.sortedBy { it.second.index }
            return JSONArray(list.map { (i,c)-> JSONObject().put("id",if(i==0) "first" else "second").put("expanded",c.isExpanded).put("collapsible",c.isCollapsible).put("index",c.index) }) }
        fun detail(value:Any?):Any? = when(value) { is Map<*,*>->JSONObject().apply { value.forEach { (k,v)-> put(k as String,detail(v)) } };is List<*>->JSONArray(value.map(::detail));else->value }
        fun record(e:AWCActionEvent,phase:String) { trace.put(JSONObject().put("phase",phase).put("name",e.name).put("target",e.targetID).put("detail",detail(e.detail))
            .put("prevented",e.defaultPrevented).put("stopped",e.propagationStopped).put("items",snapshot())) }
        compose.setContent {
            val c=case ?: return@setContent
            val mode=c.getString("mode")
            @Suppress("UNUSED_VARIABLE") val n=noise
            val target:(AWCActionEvent)->Unit={ e->
                if(e.name=="mdItemToggle") when(mode) { "prevent"->e.preventDefault();"stop"->e.stopPropagation();"immediate"->e.stopImmediatePropagation() }
                record(e,"target") }
            CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { run { AWCModalScope(Modifier.width(400.dp),insets=WindowInsets(0.dp)) {
                key(epoch) {
                    AWCActionScope(onAction={ record(it,"bubble") },id="outer",onCapture={ e-> if(mode=="capture-stop" && e.name=="mdItemToggle") e.stopPropagation();record(e,"capture") }) {
                        AWCInspectionScope(collector) {
                            AWCActionTargetScope(id="accordion",listeners=listOf(target)) {
                                AWCComponent("md-accordion",mapOf<String,AWCValue>("transition" to "none")+c.getJSONObject("properties").toMap()) { slot-> if(slot=="")
                                    c.getJSONArray("items").objects().forEachIndexed { i,p->
                                        AWCActionTargetScope(id=if(i==0) "first" else "second",listeners=listOf(target)) { AWCAccordionItemControllerScope(controllers[i]) {
                                            AWCComponent("md-accordion-item",mapOf<String,AWCValue>("headline" to if(i==0) "Account settings" else "Secondary details")+p.toMap()) { if(it=="") AWCSlotText("Expanded content with useful details.") }
                                        } }
                                    }
                                }
                            }
                        }
                    }
                }
            } } } }
        }
        val failures=mutableListOf<String>();var checks=0
        for(test in reference) {
            val id=test.getString("id")
            compose.runOnIdle { while(trace.length()>0) trace.remove(0);case=test;epoch++ }
            compose.waitForIdle()
            checks++;if(AccordionWebFixtures.normalize(trace)!=AccordionWebFixtures.normalize(test.getJSONArray("trace"))) failures+="$id trace\n  web=${test.getJSONArray("trace")}\n  android=$trace"
            checks++;if(AccordionWebFixtures.normalize(snapshot())!=AccordionWebFixtures.normalize(test.getJSONArray("final"))) failures+="$id final web=${test.getJSONArray("final")} android=${snapshot()}"
            val height=collector.snapshot().nodes.single { it.id=="component" }.bounds.height
            checks++;if(kotlin.math.abs(height-test.getDouble("height"))>.51) failures+="$id root height web=${test.getDouble("height")} android=$height"
            val count=trace.length()
            compose.runOnIdle { noise++ };compose.waitForIdle()
            checks++;if(trace.length()!=count) failures+="$id recomposition replayed initialization (${trace.length()} vs $count)"
        }
        AccordionEvidence.log("modal-initialization",JSONObject().put("cases",reference.size).put("checks",checks).put("failures",failures.size))
        assertEquals(20,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
    }
}
