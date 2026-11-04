package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.channels
import dev.awc.playground.AccordionWebFixtures.css
import dev.awc.playground.AccordionWebFixtures.objects
import dev.awc.playground.AccordionWebFixtures.over
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/** Real touch input on the drag handle against the eight actual-Web pointer reorder cases. */
class NativeAccordionReorderTest {
    @get:Rule val compose=createComposeRule()
    private var theme by mutableStateOf("light");private var rtl by mutableStateOf(false);private var variant by mutableStateOf("filled")
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private val events=mutableListOf<Pair<String,AWCValue>>()
    private var originX=0.0;private var originY=0.0;private var page=listOf(1.0,1.0,1.0,1.0)
    private var onSurface=androidx.compose.ui.graphics.Color.Black
    private val styles=mutableMapOf<String,AWCAccordionItemStyleInspection>()
    private fun node(id:String)=collector.snapshot().nodes.singleOrNull { it.id==id }
    private fun content(body:@Composable (Int)->Unit={ Text("Body") }) { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f),LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        AWCTheme(theme=="dark") { run {
            page=MaterialTheme.colorScheme.surface.channels();onSurface=MaterialTheme.colorScheme.onSurface
            Box(Modifier.padding(40.dp).requiredWidth(400.dp).background(MaterialTheme.colorScheme.surface).testTag("canvas")
                .onGloballyPositioned { val r=it.boundsInRoot();originX=r.left/2.0;originY=r.top/2.0 }) {
                AWCInspectionScope(collector) { AWCAccordionStyleInspectionScope({ n,i-> styles[n]=i }) { key(epoch) {
                    AWCComponent("md-accordion",mapOf("reorderable" to true,"transition" to "none","variant" to variant),onEvent={ n,v-> events+=n to v }) { slot-> if(slot=="")
                        listOf("first","second","third").forEachIndexed { i,id-> key(id) { AWCComponent("md-accordion-item",mapOf("headline" to id)) { if(it=="") body(i) } } }
                    }
                } } }
            }
        } }
    } } }

    /** The trusted-input Chrome lift capture of the same theme/direction/variant: the header paint 3 px below the tile's top. */
    private fun trustedLift(theme:String,direction:String,variant:String):List<Double> {
        val name="default-$theme-$direction-$variant-closed"
        val case=AccordionWebFixtures.document("AccordionWebLift.json").getJSONArray("cases").objects().single { it.getString("name")==name }
        val item=case.getJSONObject("item")
        val bmp=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().context.assets.open("AccordionWebLift/$name.png").use { android.graphics.BitmapFactory.decodeStream(it) }
        val p=bmp.getPixel((item.getDouble("x")+item.getDouble("width")/2).toInt(),(item.getDouble("y")+3).toInt())
        return listOf((p shr 16 and 255)/255.0,(p shr 8 and 255)/255.0,(p and 255)/255.0,1.0)
    }

    @Test fun eightWebPointerReorderCasesLiftShiftPlaceholderAndDrop() {
        val reference=AccordionWebFixtures.document("AccordionWebReorder.json").getJSONArray("cases").objects()
        content()
        val failures=mutableListOf<String>();var checks=0
        for(c in reference) {
            val id="${c.getString("theme")}/${c.getString("direction")}/${c.getString("variant")}"
            compose.runOnIdle { theme=c.getString("theme");rtl=c.getString("direction")=="rtl";variant=c.getString("variant");events.clear();epoch++ }
            compose.waitForIdle()
            fun near(label:String,web:Double,native:Double?) { checks++;if(native==null || abs(web-native)>.51) failures+="$id $label Web=$web Android=$native" }
            fun stage(name:String,order:List<String>) {
                val web=c.getJSONObject(name)
                near("$name.root.height",web.getJSONObject("root").getDouble("height"),node("component")?.bounds?.height)
                web.getJSONArray("items").objects().forEach { w->
                    val index=listOf("first","second","third").indexOf(w.getString("id"))
                    val displayed=order.indexOf(w.getString("id"))
                    val n=node("component.item-$displayed")
                    val r=w.getJSONObject("rect")
                    near("$name.${w.getString("id")}.y",r.getDouble("y"),n?.bounds?.y?.minus(originY))
                    near("$name.${w.getString("id")}.x",r.getDouble("x"),n?.bounds?.x?.minus(originX))
                    near("$name.${w.getString("id")}.height",r.getDouble("height"),n?.bounds?.height)
                    checks++;if(index<0) failures+="$id unknown item"
                }
                val ghost=web.opt("ghost").takeIf { it is JSONObject } as JSONObject?
                val g=node("component.drop-placeholder")
                if(ghost==null) { checks++;if(g!=null) failures+="$id $name ghost must be absent" }
                else { val r=ghost.getJSONObject("rect")
                    near("$name.ghost.x",r.getDouble("x"),g?.bounds?.x?.minus(originX));near("$name.ghost.y",r.getDouble("y"),g?.bounds?.y?.minus(originY))
                    near("$name.ghost.width",r.getDouble("width"),g?.bounds?.width);near("$name.ghost.height",r.getDouble("height"),g?.bounds?.height) }
                checks++
                val webEvents=web.getJSONArray("events")
                val nativeEvents=events.filter { it.first=="mdReorder" }.map { AccordionWebFixtures.normalize(JSONObject(it.second as Map<*,*>)) }
                if(nativeEvents!=(0 until webEvents.length()).map { AccordionWebFixtures.normalize(webEvents.getJSONObject(it)) }) failures+="$id $name events web=$webEvents android=$nativeEvents"
            }
            fun pixels()=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
            fun background(name:String,which:Int,itemId:String) {
                val w=c.getJSONObject(name).getJSONArray("items").objects().single { it.getString("id")==itemId }
                val n=node("component.item-$which")!!.bounds
                val image=pixels()
                val actual=image[((n.x-originX+n.width/2)*2).toInt(),((n.y-originY+3)*2).toInt()].channels()
                // The pressed (dragged) tile: its header paint with the press feedback (state layer and
                // grown ripple) as Chrome painted it under trusted input (accordion-web-lift capture).
                val expected=if(itemId=="first") trustedLift(c.getString("theme"),c.getString("direction"),c.getString("variant")) else over(css(w.getString("background")),page)
                checks++;if((0..2).any { abs(actual[it]-expected[it])>.03 }) failures+="$id $name $itemId surface Web=$expected Android=$actual"
            }
            stage("before",listOf("first","second","third"))
            val handle=node("component.item-0.drag-handle")!!.bounds
            val start=Offset(((handle.x+handle.width/2)*2).toFloat(),((handle.y+handle.height/2)*2).toFloat())
            val dy=c.getDouble("dy")
            compose.onRoot().performTouchInput { down(start) };compose.waitForIdle()
            stage("lifted",listOf("first","second","third"));background("lifted",0,"first")
            compose.onRoot().performTouchInput { moveTo(start+Offset(0f,(dy*2).toFloat())) };compose.waitForIdle()
            stage("moved",listOf("first","second","third"));background("moved",0,"first")
            // The drop placeholder's default fill is visible in the strip the lifted tile leaves open above it.
            run {
                val moved=c.getJSONObject("moved");val ghost=moved.getJSONObject("ghost");val g=ghost.getJSONObject("rect")
                val first=moved.getJSONArray("items").objects().single { it.getString("id")=="first" };val fr=first.getJSONObject("rect");val firstY=fr.getDouble("y")
                val y=g.getDouble("y")+2.75
                if(firstY-g.getDouble("y")>=3.5) {
                    val x=g.getDouble("x")+g.getDouble("width")/2
                    val image=pixels();val v=image[(x*2).toInt(),(y*2).toInt()].channels()
                    // The lifted tile (above the placeholder) casts its elevation-4 shadow over the strip.
                    val e=AccordionWebFixtures.outerShadow(first.getString("shadow"),fr.getDouble("x"),firstY,fr.getDouble("width"),fr.getDouble("height"),x+.25,y+.25,over(css(ghost.getString("background")),page))
                    checks++;if((0..2).any { abs(v[it]-e[it])>.03 }) failures+="$id placeholder fill Web=${e.take(3)} Android=${v.take(3)}"
                }
            }
            compose.onRoot().performTouchInput { up() };compose.waitForIdle()
            stage("dropped",listOf("second","third","first"))
            checks++;if(events.any { it.first=="mdToggle" }) failures+="$id grip gesture toggled a header"
        }
        AccordionEvidence.log("reorder",JSONObject().put("cases",reference.size).put("checks",checks).put("failures",failures.size))
        assertEquals(8,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
    }

    @Test fun cancellationRestoresOrderWithoutEventAndRetainsAuthoredBodies() {
        var clicks=0
        content { i-> if(i==0) { var n by remember { mutableIntStateOf(0) };androidx.compose.material3.Button(onClick={ n++;clicks++ }) { Text("Retained $n") } } else Text("Body") }
        compose.runOnIdle { theme="light";rtl=false;variant="filled";epoch++ };compose.waitForIdle()
        compose.onNode(hasText("first") and hasClickAction()).performClick();compose.waitForIdle()
        compose.onNodeWithText("Retained 0").performClick();compose.waitForIdle()
        events.clear()
        val handle=node("component.item-0.drag-handle")!!.bounds
        val start=Offset(((handle.x+handle.width/2)*2).toFloat(),((handle.y+handle.height/2)*2).toFloat())
        compose.onRoot().performTouchInput { down(start);moveTo(start+Offset(0f,400f)) };compose.waitForIdle()
        assertNotNull("lifted",node("component.drop-placeholder"))
        compose.onRoot().performTouchInput { cancel() };compose.waitForIdle()
        assertNull("cancel clears the placeholder",node("component.drop-placeholder"))
        assertTrue("no reorder event on cancel",events.none { it.first=="mdReorder" })
        assertEquals("first stays first",originY,node("component.item-0")!!.bounds.y,.51)
        compose.onNodeWithText("Retained 1").assertExists()
        // A real drop keeps the authored subtree (state survives the reorder).
        compose.onRoot().performTouchInput { down(start);moveTo(start+Offset(0f,600f));up() };compose.waitForIdle()
        assertEquals(1,events.count { it.first=="mdReorder" })
        compose.onNodeWithText("Retained 1").assertExists().performClick();compose.waitForIdle()
        compose.onNodeWithText("Retained 2").assertExists()
        assertEquals(2,clicks)
        AccordionEvidence.log("reorder-cancel",JSONObject().put("checks",8))
    }
}

