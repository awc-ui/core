package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.channels
import dev.awc.playground.AccordionWebFixtures.objects
import dev.awc.playground.AccordionWebFixtures.toMap
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * Native ::part() equivalents against the 192 actual-Web part configurations
 * (accordion-web-parts.json: 24 styles x light/dark x LTR/RTL x closed/open).
 */
class NativeAccordionPartsTest {
    @get:Rule val compose=createComposeRule()
    @Composable private fun Parts(parts:Map<AWCAccordionItemPart,AWCAccordionPartAppearance>,content:@Composable ()->Unit) {
        if(parts.isEmpty()) { content();return }
        val (part,value)=parts.entries.first()
        AWCAccordionItemPartAppearanceScope(part,value) { Parts(parts-part,content) }
    }

    @Test fun oneHundredNinetyTwoWebPartConfigurationsMatchBoxesAndPaint() {
        val reference=AccordionWebFixtures.document("AccordionWebParts.json").getJSONArray("cases").objects()
        var case by mutableStateOf<JSONObject?>(null);var epoch by mutableIntStateOf(0)
        val collector=AWCInspectionCollector()
        compose.setContent {
            val c=case ?: return@setContent
            val spec=c.getJSONObject("spec")
            val parts=spec.getJSONObject("parts").let { p-> p.keys().asSequence().associate { AWCAccordionItemPart.fromSource(it)!! to AWCAccordionPartAppearance.fromValues(p.getJSONObject(it).toMap()) } }
            CompositionLocalProvider(LocalDensity provides Density(2f,1f),LocalLayoutDirection provides if(c.getString("direction")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCTheme(c.getString("theme")=="dark") { run {
                    Box(Modifier.testTag("canvas").background(MaterialTheme.colorScheme.surface).padding(30.dp)) { Box(Modifier.requiredWidth(400.dp)) {
                        Parts(parts) { AWCInspectionScope(collector) { key(epoch) {
                            AWCComponent("md-accordion",mapOf<String,AWCValue>("transition" to "none")+(spec.optJSONObject("parent")?.toMap() ?: emptyMap())) { slot-> if(slot=="")
                                AWCComponent("md-accordion-item",mapOf<String,AWCValue>("headline" to "Account settings","supportingText" to "Supporting caption","icon" to "favorite",
                                    "expanded" to c.getBoolean("expanded"))+(spec.optJSONObject("props")?.toMap() ?: emptyMap())) { if(it=="") AWCSlotText("Expanded content with useful details.") }
                            }
                        } } }
                    } }
                } }
            }
        }
        val failures=mutableListOf<String>();var checks=0
        val perStyle=linkedMapOf<String,IntArray>()
        for(c in reference) {
            val id=c.getString("id");val style=c.getJSONObject("spec").getString("id")
            val tally=perStyle.getOrPut(style) { IntArray(2) }
            compose.runOnIdle { case=c;epoch++ };compose.waitForIdle()
            val nodes=collector.snapshot().nodes.associateBy { it.id }
            val root=nodes["component"]!!.bounds
            fun fail(msg:String) { failures+="$id $msg";tally[1]++ }
            fun near(label:String,web:Double,native:Double?) { checks++;tally[0]++;if(native==null || abs(web-native)>.6) fail("$label Web=$web Android=$native") }
            fun rect(label:String,web:JSONObject,nodeID:String) { val n=nodes[nodeID]?.bounds
                near("$label.x",web.getDouble("x"),n?.let { it.x-root.x });near("$label.y",web.getDouble("y"),n?.let { it.y-root.y })
                near("$label.width",web.getDouble("width"),n?.width);near("$label.height",web.getDouble("height"),n?.height) }
            rect("root",c.getJSONObject("root").getJSONObject("rect"),"component")
            rect("item",c.getJSONObject("item").getJSONObject("rect"),"component.item-0")
            val parts=c.getJSONObject("parts")
            for(name in parts.keys()) { if(name.startsWith("chassis")) continue
                val p=parts.getJSONObject(name)
                if(p.getJSONObject("style").getString("display")=="none") { checks++;tally[0]++;if(nodes["component.item-0.$name"]!=null) fail("$name must be absent");continue }
                rect(name,p.getJSONObject("rect"),"component.item-0.$name") }
            // Paint: declared part backgrounds/borders/ink are present where the source paints them.
            val pixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
            fun hits(r:JSONObject,color:List<Double>,limit:Double=.03):Int { var n=0
                for(y in ((r.getDouble("y")+30)*2).toInt() until ((r.getDouble("y")+r.getDouble("height")+30)*2).toInt()) for(x in ((r.getDouble("x")+30)*2).toInt() until ((r.getDouble("x")+r.getDouble("width")+30)*2).toInt()) {
                    if(x !in 0 until pixels.width || y !in 0 until pixels.height) continue
                    val v=pixels[x,y].channels();if((0..2).all { abs(v[it]-color[it])<limit }) n++ };return n }
            val spec=c.getJSONObject("spec").getJSONObject("parts")
            fun at(x:Double,y:Double)=pixels[((x+30)*2).toInt().coerceIn(0,pixels.width-1),((y+30)*2).toInt().coerceIn(0,pixels.height-1)].channels()
            fun hex(h:String)=listOf(h.substring(1,3).toInt(16)/255.0,h.substring(3,5).toInt(16)/255.0,h.substring(5,7).toInt(16)/255.0)
            for(name in spec.keys()) { val declared=spec.getJSONObject(name);val web=parts.optJSONObject(name) ?: continue
                if(web.getJSONObject("style").getString("display")=="none") continue
                val r=web.getJSONObject("rect");if(r.getDouble("width")<4 || r.getDouble("height")<4) continue
                if(declared.optDouble("opacity",1.0)!=1.0) continue
                val inPanel=name in setOf("panel","content","content-inner")
                val b=declared.optDouble("borderWidth",0.0)
                val pad=declared.optJSONObject("padding")
                // A collapsed panel is transparent (opacity 0) in the source: nothing of it may paint.
                if(inPanel && !c.getBoolean("expanded")) { declared.optString("backgroundColor").takeIf { it.isNotEmpty() }?.let { bg-> checks++;tally[0]++
                    if(hits(r,hex(bg))>0) fail("$name collapsed panel paints its background") };continue }
                // Background: the middle of the left padding band, which no child box covers.
                declared.optString("backgroundColor").takeIf { it.isNotEmpty() && pad!=null && pad.getDouble("left")>=2 }?.let { bg-> checks++;tally[0]++
                    val v=at(r.getDouble("x")+b+pad!!.getDouble("left")/2,r.getDouble("y")+r.getDouble("height")/2);val e=hex(bg)
                    if((0..2).any { abs(v[it]-e[it])>.03 }) fail("$name background $bg at padding band = ${v.take(3).map { "%.3f".format(it) }}") }
                // Border: the middle of the left border edge.
                declared.optString("borderColor").takeIf { it.isNotEmpty() && b>=1 }?.let { bc-> checks++;tally[0]++
                    val v=at(r.getDouble("x")+b/2,r.getDouble("y")+r.getDouble("height")/2);val e=hex(bc)
                    if((0..2).any { abs(v[it]-e[it])>.04 }) fail("$name border $bc at left edge = ${v.take(3).map { "%.3f".format(it) }}") }
                // Text/icon ink colour.
                // Header colour paints only through its inheriting headline (not when the headline sets its own).
                val inherited=name!="header" || spec.optJSONObject("headline")?.has("color")!=true
                declared.optString("color").takeIf { it.isNotEmpty() && inherited && name in setOf("header","headline","supporting-text","content-inner","leading-icon","trailing-icon") }?.let { ink-> checks++;tally[0]++
                    if(hits(r,hex(ink),.08)<3) fail("$name ink $ink absent") }
            }
        }
        val styles=JSONObject();perStyle.forEach { (k,v)-> styles.put(k,JSONArray(listOf(v[0],v[1]))) }
        AccordionEvidence.log("parts",JSONObject().put("cases",reference.size).put("checks",checks).put("failures",failures.size).put("perStyle",styles))
        assertEquals(192,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(250).joinToString("\n"),failures.isEmpty())
    }

    @Test fun sharedAndTargetedPartOverridesMergeResetAndKeepTheRetainedHeader() {
        var shared by mutableStateOf(AWCAccordionPartAppearance());var targeted by mutableStateOf(AWCAccordionPartAppearance())
        val controller=AWCAccordionItemController();val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) { run { Box(Modifier.width(400.dp)) {
            AWCInspectionScope(collector) { AWCAccordionItemPartAppearanceScope(AWCAccordionItemPart.Header,shared) {
                AWCComponent("md-accordion",mapOf("transition" to "none")) { slot-> if(slot=="") {
                    AWCAccordionItemPartAppearanceScope(AWCAccordionItemPart.Header,targeted) { AWCAccordionItemControllerScope(controller) {
                        AWCComponent("md-accordion-item",mapOf("headline" to "First","supportingText" to "Supporting caption","icon" to "favorite")) { if(it=="") AWCSlotText("Body") } } }
                    AWCComponent("md-accordion-item",mapOf("headline" to "Second","supportingText" to "Supporting caption","icon" to "favorite")) { if(it=="") AWCSlotText("Body") }
                } }
            } }
        } } } } }
        compose.waitForIdle()
        fun h(i:Int)=collector.snapshot().nodes.single { it.id=="component.item-$i.header" }.bounds.height
        compose.runOnIdle { shared=AWCAccordionPartAppearance(backgroundColor="#335577",borderColor="#DD3377",borderWidth=2.0,minHeight=96.0);targeted=AWCAccordionPartAppearance(backgroundColor="#884422",minHeight=112.0) }
        compose.waitForIdle()
        assertEquals("targeted part height overrides shared style",112.0,h(0),.6);assertEquals("targeted part does not leak to sibling",96.0,h(1),.6)
        compose.runOnIdle { controller.toggle() };compose.waitForIdle();assertTrue(controller.isExpanded)
        compose.runOnIdle { targeted=AWCAccordionPartAppearance() };compose.waitForIdle()
        assertTrue("resetting the targeted part keeps the retained, expanded item",controller.isExpanded && controller.isConnected)
        assertEquals("resetting targeted restores shared",96.0,h(0),.6)
        compose.runOnIdle { shared=AWCAccordionPartAppearance() };compose.waitForIdle()
        assertEquals("resetting shared restores default",74.0,h(0),.6);assertEquals(74.0,h(1),.6)
        AccordionEvidence.log("parts-live",JSONObject().put("checks",7))
    }
}
