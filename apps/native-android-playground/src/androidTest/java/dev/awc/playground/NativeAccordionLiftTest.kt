package dev.awc.playground

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.*

/**
 * Lifted-item clipping against the 32 actual Chrome captures (accordion-web-lift, DPR 1, trusted
 * CDP mouse input: the grip press is a header :active with a fully grown md-ripple wave). The same
 * real mouse sequence (hover, press, 40 px move, 600 ms) is replayed: corner "ears" outside the
 * dragging radius must show what Chrome shows behind the tile, inner corner pixels and the
 * pressed header paint must match the source directly, and the headline ink must be present.
 * Thresholds are the same as the Swift lift checkpoint (0..255 channel units).
 */
@OptIn(ExperimentalTestApi::class)
class NativeAccordionLiftTest {
    @get:Rule val compose=createComposeRule()
    @Test fun thirtyTwoChromeLiftCapturesMatchClipCornersSurfaceAndHeadline() {
        val reference=AccordionWebFixtures.document("AccordionWebLift.json").getJSONArray("cases").objects()
        var case by mutableStateOf<JSONObject?>(null);var epoch by mutableIntStateOf(0)
        val collector=AWCInspectionCollector()
        var canvasX=0.0;var canvasY=0.0
        val styles=mutableMapOf<String,AWCAccordionItemStyleInspection>()
        val outside=Offset(1000f,1500f)
        compose.setContent {
            val c=case ?: return@setContent
            val custom=c.getString("style")=="custom"
            CompositionLocalProvider(LocalDensity provides Density(2f,1f),LocalLayoutDirection provides if(c.getString("direction")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCTheme(c.getString("theme")=="dark") { run {
                    Box(Modifier.testTag("canvas").onGloballyPositioned { val r=it.boundsInRoot();canvasX=r.left/2.0;canvasY=r.top/2.0 }.background(MaterialTheme.colorScheme.surface).padding(40.dp)) {
                        Box(Modifier.requiredWidth(400.dp)) {
                            AWCAccordionAppearanceScope(AWCAccordionAppearance(dropPlaceholderOpacity=0.0)) {
                            AWCAccordionItemAppearanceScope(if(custom) AWCAccordionItemAppearance(headerColorExpanded="#B71C1C",containerColorDragging="#C8E6C9",containerShapeDragging=AWCCornerShape.uniform(20.0)) else AWCAccordionItemAppearance()) {
                                AWCInspectionScope(collector) { AWCAccordionStyleInspectionScope({ n,i-> styles[n]=i }) { key(epoch) {
                                    AWCComponent("md-accordion",mapOf("reorderable" to true,"transition" to "none","variant" to c.getString("variant"))) { slot-> if(slot=="")
                                        listOf("first","second","third").forEachIndexed { i,id-> key(id) { AWCComponent("md-accordion-item",mapOf("headline" to id,"expanded" to (c.getBoolean("expanded") && i==0))) { if(it=="") Text("Body") } } } }
                                } } }
                            } }
                        }
                    }
                } }
            }
        }
        val failures=mutableListOf<String>();var checks=0;val report=JSONArray()
        fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
        for(c in reference) {
            val name=c.getString("name")
            compose.mainClock.autoAdvance=true
            compose.onRoot().performMouseInput { moveTo(outside) }
            compose.runOnIdle { case=c;epoch++ };compose.waitForIdle()
            val handle=collector.snapshot().nodes.single { it.id=="component.item-0.drag-handle" }.bounds
            val start=Offset(((handle.x+handle.width/2)*2).toFloat(),((handle.y+handle.height/2)*2).toFloat())
            // The source sequence: hover the grip, press, move 40 px down, capture after 600 ms.
            compose.onRoot().performMouseInput { moveTo(start) };compose.mainClock.advanceTimeBy(260)
            compose.onRoot().performMouseInput { press() };compose.mainClock.advanceTimeBy(260)
            compose.onRoot().performMouseInput { moveTo(start+Offset(0f,(c.getDouble("dy")*2).toFloat())) };compose.mainClock.advanceTimeBy(600);compose.waitForIdle()
            val item=collector.snapshot().nodes.single { it.id=="component.item-0" }.bounds
            val pixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
            compose.onRoot().performMouseInput { release();moveTo(outside) };compose.waitForIdle()
            val web=InstrumentationRegistry.getInstrumentation().context.assets.open("AccordionWebLift/$name.png").use { BitmapFactory.decodeStream(it) }
            val w=c.getJSONObject("item");val wx=w.getDouble("x").roundToInt();val wy=w.getDouble("y").roundToInt()
            val width=w.getDouble("width");val height=w.getDouble("height")
            check(abs(item.width-width)<.7 && abs(item.height-height)<.7,"$name lifted item size ${item.width}x${item.height} vs ${width}x$height")
            fun webCell(x:Double,y:Double):List<Double> { val px=web.getPixel(x.toInt().coerceIn(0,web.width-1),y.toInt().coerceIn(0,web.height-1))
                return listOf((px shr 16 and 255).toDouble(),(px shr 8 and 255).toDouble(),(px and 255).toDouble()) }
            fun nativeCell(x:Double,y:Double):List<Double> { val x0=((x-canvasX)*2).roundToInt();val y0=((y-canvasY)*2).roundToInt();val s=doubleArrayOf(0.0,0.0,0.0);var n=0
                for(yy in y0 until y0+2) for(xx in x0 until x0+2) if(xx in 0 until pixels.width && yy in 0 until pixels.height) { val v=pixels[xx,yy];s[0]+=v.red*255.0;s[1]+=v.green*255.0;s[2]+=v.blue*255.0;n++ }
                return if(n==0) listOf(-999.0,-999.0,-999.0) else s.map { it/n } }
            fun maxDiff(a:List<Double>,b:List<Double>)=(0..2).maxOf { abs(a[it]-b[it]) }
            fun distance(a:List<Double>,b:List<Double>)=sqrt((0..2).sumOf { (a[it]-b[it]).pow(2) })
            val radius=c.getString("radius").removeSuffix("px").toDouble()
            val tint=if(c.getString("style")=="custom") listOf(0xB7.toDouble(),0x1C.toDouble(),0x1C.toDouble()) else null
            var ear=0;var inner=0;var earDiff=0.0;var innerDiff=0.0;var earMax=0.0;var earTint=0;var innerTint=0;var innerTintSource=0
            val span=radius.toInt()+2
            for(corner in listOf(0 to 0,1 to 0,1 to 1,0 to 1)) for(v in 0 until span) for(u in 0 until span) {
                val px=if(corner.first==0) u.toDouble() else width-1-u;val py=if(corner.second==0) v.toDouble() else height-1-v
                val cx=u+.5;val cy=v+.5;val d=hypot(radius-cx,radius-cy)
                if(cx>=radius || cy>=radius) continue
                val outside=d>radius+1.25;val inside=d<radius-1.25
                if(!outside && !inside) continue
                val a=webCell(wx+px,wy+py)
                val b=nativeCell(item.x+px,item.y+py);val diff=maxDiff(a,b)
                if(outside) { ear++;earDiff+=diff;earMax=max(earMax,diff);if(tint!=null && distance(b,tint)<60) earTint++ }
                else { inner++;innerDiff+=diff;if(tint!=null) { if(distance(b,tint)<30) innerTint++;if(distance(a,tint)<30) innerTintSource++ } }
            }
            val earMean=if(ear==0) 0.0 else earDiff/ear;val innerMean=if(inner==0) 0.0 else innerDiff/inner
            check(ear>0 && inner>0,"$name corner samples exist")
            check(earMean<=6,"$name corner ears match the source backdrop/shadow (mean ${"%.2f".format(earMean)})")
            check(earMax<=40,"$name no ear pixel departs grossly from the source (max ${"%.1f".format(earMax)})")
            check(innerMean<=6,"$name inner corner paint matches the source (mean ${"%.2f".format(innerMean)})")
            if(tint!=null) { check(earTint==0,"$name header tint never paints outside the dragging radius ($earTint)")
                check(abs(innerTint-innerTintSource)<=max(2,innerTintSource/10),"$name header tint fills the same inner corner pixels ($innerTint vs $innerTintSource)") }
            // Headline ink presence inside the lifted header.
            val hl=c.getJSONObject("headline").getJSONObject("rect");val hx=hl.getDouble("x")-w.getDouble("x");val hy=hl.getDouble("y")-w.getDouble("y")
            fun rgb(css:String)=AccordionWebFixtures.css(css).let { listOf(it[0]*255,it[1]*255,it[2]*255,it[3]) }
            fun over(top:List<Double>,base:List<Double>)=(0..2).map { top[it]*top[3]+base[it]*(1-top[3]) }
            // The pressed header paint (state layer and grown ripple included) is the median of the headline box.
            val webCells=mutableListOf<List<Double>>();val nativeCells=mutableListOf<List<Double>>()
            for(v in 0 until hl.getDouble("height").toInt()) for(u in 0 until hl.getDouble("width").toInt()) { webCells+=webCell(wx+hx+u,wy+hy+v);nativeCells+=nativeCell(item.x+hx+u,item.y+hy+v) }
            fun median(cells:List<List<Double>>)=(0..2).map { ch-> cells.map { it[ch] }.sorted()[cells.size/2] }
            val webPaint=median(webCells);val nativePaint=median(nativeCells)
            check(maxDiff(webPaint,nativePaint)<=6,"$name pressed header paint matches the trusted capture (web ${webPaint.map { it.roundToInt() }} native ${nativePaint.map { it.roundToInt() }})")
            val inkColor=rgb(c.getJSONObject("headline").getString("color"))
            val webThreshold=max(12.0,.4*distance(over(inkColor,webPaint),webPaint))
            val threshold=max(12.0,.4*distance(over(inkColor,nativePaint),nativePaint))
            val webInk=webCells.count { distance(it,webPaint)>webThreshold };val nativeInk=nativeCells.count { distance(it,nativePaint)>threshold }
            check(webInk>20 && nativeInk>=webInk*.6 && nativeInk<=webInk*1.6,"$name lifted headline ink is present like the source ($nativeInk vs $webInk)")
            report.put(JSONObject().put("name",name).put("ear",ear).put("earMean",earMean).put("earMax",earMax).put("inner",inner).put("innerMean",innerMean)
                .put("earTint",earTint).put("innerTint",innerTint).put("innerTintSource",innerTintSource).put("webInk",webInk).put("nativeInk",nativeInk)
                .put("headerPaint",JSONArray(listOf(JSONArray(webPaint),JSONArray(nativePaint)))))
        }
        AccordionEvidence.log("lift",JSONObject().put("cases",reference.size).put("checks",checks).put("failures",failures.size).put("report",report))
        assertEquals(32,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
    }
}
