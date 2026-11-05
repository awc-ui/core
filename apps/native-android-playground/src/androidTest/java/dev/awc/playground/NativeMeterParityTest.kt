@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.*

class NativeMeterParityTest {
    @get:Rule val compose=createComposeRule()
    private fun document(theme:String,prefix:String="MeterWeb")=InstrumentationRegistry.getInstrumentation().context.assets.open("$prefix-$theme.json").bufferedReader().use { JSONObject(it.readText()) }
    private fun value(input:Any?):Any?=when(input) { is JSONObject->input.keys().asSequence().associateWith { value(input.get(it)) };JSONObject.NULL->null;else->input }
    private fun appearance(source:JSONObject):AWCMeterAppearance {
        val s=source.optJSONObject("style") ?: return AWCMeterAppearance()
        fun length(key:String)=s.optString(key).removeSuffix("px").toDoubleOrNull()
        fun color(key:String)=s.optString(key).takeIf { it.isNotEmpty() }
        val radius=s.optString("trackShape").takeIf { it.isNotEmpty() }?.let { if(it.endsWith('%')) AWCCornerShape.uniform(fraction=it.dropLast(1).toDouble()/100) else AWCCornerShape.uniform(points=it.removeSuffix("px").toDouble()) }
        return AWCMeterAppearance(color("indicatorColor"),color("trackColor"),radius,length("height"),color("labelColor"),color("valueColor"),length("size"))
    }
    private fun color(css:String)=Regex("-?(?:\\d*\\.)?\\d+").findAll(css).map { it.value.toDouble() }.toList().let { if(it.size==3) it+1.0 else it }
    private fun over(fg:List<Double>,bg:List<Double>)=(0..2).map { fg[it]*fg[3]+bg[it]*(1-fg[3]) }+1.0

    @Test fun all196BrowserFixturesMatchNativeRangeTextPartsGeometryAndPaint() = runSourceMatrix("MeterWeb",true)
    // Gate-7 R2-D1/R2-D3: fresh default-palette Chrome capture; no colours are injected into the native theme.
    @Test fun all196PristineDefaultPaletteCasesMatchWithoutTokenInjection() = runSourceMatrix("MeterDefaultWeb",false)
    private fun runSourceMatrix(prefix:String,injectTokens:Boolean) {
        compose.mainClock.autoAdvance=false
        var props by mutableStateOf<Map<String,AWCValue>>(emptyMap());var a by mutableStateOf(AWCMeterAppearance())
        var tokens by mutableStateOf<Map<String,String>>(emptyMap());var dark by mutableStateOf(false);var inherited by mutableStateOf(0.0)
        var width by mutableStateOf(240.0);var epoch by mutableStateOf(0);val collector=AWCInspectionCollector();var canvas=Rect.Zero
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(dark,tokens) { AWCDensityScope(inherited) {
            Box(Modifier.requiredSize(300.dp,340.dp).background(Color.White).testTag("canvas").onGloballyPositioned { canvas=it.boundsInRoot() },contentAlignment=Alignment.Center) {
                Box(Modifier.requiredWidth(width.toFloat().dp),contentAlignment=Alignment.Center) { key(epoch) {
                    AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCMeterAppearanceScope(a) { AWCInspectionScope(collector) { AWCComponent("md-meter",props) } } }
                } }
            }
        } } } }
        val failures=mutableListOf<String>()
        fun expect(id:String,name:String,expected:Double,actual:Double,tolerance:Double=.51) {
            if(abs(expected-actual)>tolerance) failures+="$id $name native=$actual Web=$expected"
        }
        for(theme in listOf("light","dark")) {
            val doc=document(theme,prefix);val fixtureTokens=doc.getJSONObject("tokens")
            val base=fixtureTokens.keys().asSequence().filter { it.startsWith("--md-sys-color-") }.associateWith { fixtureTokens.getString(it).let { c->if(c.length==4) "#"+c.drop(1).map { "$it$it" }.joinToString("") else c } }
            for(i in 0 until doc.getJSONArray("results").length()) {
                val entry=doc.getJSONArray("results").getJSONObject(i);val f=entry.getJSONObject("fixture");val host=entry.getJSONObject("host");val id="$theme/${f.getString("id")}";val attrs=host.getJSONObject("attributes")
                compose.runOnIdle {
                    props=f.keys().asSequence().filter { it !in setOf("id","style","theme","width","inheritedDensity") }.associateWith { value(f.get(it)) }
                    a=appearance(f);tokens=(if(injectTokens) base else emptyMap())+(f.optJSONObject("theme")?.let { t->t.keys().asSequence().associateWith { t.getString(it) } } ?: emptyMap())
                    dark=theme=="dark";inherited=f.optDouble("inheritedDensity",0.0);width=f.optDouble("width",240.0);epoch++
                }
                compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
                val nodes=compose.runOnIdle { collector.snapshot().nodes }
                if(f.optBoolean("hidden")) { assertTrue("$id has no visible measurement",nodes.isEmpty());continue }
                val root=nodes.single { it.id=="component" }
                expect(id,"root width",host.getDouble("width"),root.bounds.width);expect(id,"root height",host.getDouble("height"),root.bounds.height)
                val semantic=compose.onNode(SemanticsMatcher.keyIsDefined(AWCMeterRangeKey)).fetchSemanticsNode().config
                assertEquals("$id formatted semantic value",attrs.getString("aria-valuetext"),semantic[SemanticsProperties.StateDescription])
                assertEquals(AWCMeterRange(attrs.getString("aria-valuemin").toDouble(),attrs.getString("aria-valuemax").toDouble(),attrs.getString("aria-valuenow").toDouble()),semantic[AWCMeterRangeKey])
                assertFalse("$id no loading announcement",semantic.contains(SemanticsProperties.LiveRegion))
                assertFalse("$id no action",semantic.contains(SemanticsActions.OnClick))
                val parts=entry.getJSONArray("parts")
                for(j in 0 until parts.length()) {
                    val web=parts.getJSONObject(j);val part=web.getString("part");val node=nodes.single { it.id=="component.$part" }
                    if(root.bounds.width==0.0 && part in setOf("track","indicator")) {
                        // SVG getBoundingClientRect keeps unpainted user-space
                        // geometry at viewport0. Native measured paths are0.
                        assertEquals(0.0,node.bounds.width,.0);assertEquals(0.0,node.bounds.height,.0);continue
                    }
                    if(f.optString("locale")=="ar-EG" && part=="value") {
                        // Explicit unresolved platform boundary: the shared font
                        // is Latin-only. Android uses its installed Arabic font;
                        // macOS Chrome uses Geeza Pro. Do not call this width a
                        // cross-platform match or widen the other tolerances.
                        assertTrue("Arabic native glyph box remains finite",node.bounds.width.isFinite() && node.bounds.width>0)
                        println("METER_ARABIC_WIDTH_BOUNDARY $id native=${node.bounds.width} Web=${web.getDouble("width")}")
                    } else expect(id,"$part width",web.getDouble("width"),node.bounds.width)
                    expect(id,"$part height",web.getDouble("height"),node.bounds.height)
                    expect(id,"$part x",web.getDouble("x"),node.bounds.x-root.bounds.x)
                    expect(id,"$part y",web.getDouble("y"),node.bounds.y-root.bounds.y)
                }
                if(root.bounds.width<=0 || root.bounds.height<=0) continue
                val pixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                fun pixel(x:Double,y:Double)=pixels[((root.bounds.x+x)*2-canvas.left).roundToInt().coerceIn(0,pixels.width-1),((root.bounds.y+y)*2-canvas.top).roundToInt().coerceIn(0,pixels.height-1)]
                fun channels(name:String,expected:List<Double>,actual:Color) { listOf(actual.red,actual.green,actual.blue).forEachIndexed { c,v->expect(id,"$name color$c",expected[c]/255,v.toDouble(),.02) } }
                val track=(0 until parts.length()).map { parts.getJSONObject(it) }.single { it.getString("part")=="track" }
                val fill=(0 until parts.length()).map { parts.getJSONObject(it) }.single { it.getString("part")=="indicator" }
                if(f.optString("variant")!="circular" && track.getDouble("height")>=2) {
                    val background=over(color(track.getString("fill")),listOf(255.0,255.0,255.0,1.0))
                    val fillNode=nodes.single { it.id=="component.indicator" };val trackNode=nodes.single { it.id=="component.track" }
                    val y=trackNode.bounds.y-root.bounds.y+trackNode.bounds.height/2
                    if(fillNode.bounds.width>5) channels("indicator",over(color(fill.getString("fill")),background),pixel(fillNode.bounds.x-root.bounds.x+fillNode.bounds.width/2,y))
                    if(trackNode.bounds.width-fillNode.bounds.width>5) {
                        val rtl=f.optString("dir")=="rtl";val x=if(rtl) (trackNode.bounds.width-fillNode.bounds.width)/2 else fillNode.bounds.width+(trackNode.bounds.width-fillNode.bounds.width)/2
                        channels("track",background,pixel(x,y))
                    }
                }
            }
        }
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }

    @Test fun realWidthAndArcMotionSettleAndReducedMotionAndForcedColorsApply() {
        compose.mainClock.autoAdvance=false
        var value by mutableStateOf(0);var reduced by mutableStateOf(false);var forced by mutableStateOf(false);var circular by mutableStateOf(false)
        val collector=AWCInspectionCollector();var canvas=Rect.Zero
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false,mapOf("--md-sys-color-primary" to "#FF0000","--md-sys-color-secondary-container" to "#00FF00","--md-sys-color-on-surface" to "#112233","--md-sys-color-outline" to "#445566")) {
            Box(Modifier.requiredSize(160.dp).background(Color.White).testTag("canvas").onGloballyPositioned { canvas=it.boundsInRoot() },contentAlignment=Alignment.Center) {
                AWCAccessibilityAppearanceScope(reducedMotion=reduced,forcedColors=forced) { AWCInspectionScope(collector) {
                    AWCComponent("md-meter",mapOf("value" to value,"variant" to if(circular) "circular" else "linear","size" to 80,"thickness" to 8,"dir" to "rtl"))
                } }
            }
        } } }
        fun width()=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component.indicator" }.bounds.width }
        assertEquals(0.0,width(),.0)
        compose.runOnIdle { value=100 };compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        assertTrue("Width actually animates",width() in .01..159.99)
        compose.mainClock.advanceTimeBy(400);compose.waitForIdle();assertEquals(160.0,width(),.0)
        compose.runOnIdle { reduced=true;value=25 };compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeByFrame();compose.waitForIdle();assertEquals(40.0,width(),.0)
        compose.runOnIdle { circular=true;value=25;forced=true };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        val root=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component" }.bounds }
        val image=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
        fun at(degrees:Double):Color { val angle=degrees*PI/180;return image[((root.x+40+36*cos(angle))*2-canvas.left).roundToInt(),((root.y+40+36*sin(angle))*2-canvas.top).roundToInt()] }
        assertEquals("Clockwise arc remains on right underRTL",Color(0xFF112233),at(-45.0))
        assertEquals("Explicit native forced palette",Color(0xFF445566),at(135.0))
    }
    @Test fun circularUnbrokenTextOverflowsWithSourceCenterAndCaptionDirection() {
        compose.mainClock.autoAdvance=false
        var props by mutableStateOf<Map<String,AWCValue>>(emptyMap());var epoch by mutableStateOf(0)
        val collector=AWCInspectionCollector();var canvas=Rect.Zero
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) {
            Box(Modifier.requiredSize(360.dp,160.dp).background(Color.White).testTag("canvas").onGloballyPositioned { canvas=it.boundsInRoot() },contentAlignment=Alignment.Center) {
                key(epoch) { AWCMeterAppearanceScope(AWCMeterAppearance(labelColor="#FF0000",valueColor="#FF0000")) {
                    AWCInspectionScope(collector) { AWCComponent("md-meter",props) }
                } }
            }
        } } }
        val doc=InstrumentationRegistry.getInstrumentation().context.assets.open("MeterWeb-overflow.json").bufferedReader().use { JSONObject(it.readText()) }
        for(i in 0 until doc.getJSONArray("results").length()) {
            val c=doc.getJSONArray("results").getJSONObject(i);val f=c.getJSONObject("fixture");val h=c.getJSONObject("host")
            compose.runOnIdle { props=(value(f) as Map<String,AWCValue>)+mapOf("variant" to "circular","showValue" to true,"value" to 75);epoch++ }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            val root=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component" }.bounds }
            assertEquals(h.getDouble("width"),root.width,.51);assertEquals(h.getDouble("height"),root.height,.51)
            val image=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
            val caption=f.getBoolean("showLabel");val startY=((root.y+(if(caption) 52 else 0))*2-canvas.top).roundToInt()
            val endY=((root.y+root.height)*2-canvas.top).roundToInt().coerceAtMost(image.height)
            val xs=mutableListOf<Int>()
            for(y in startY until endY) for(x in 0 until image.width) if(image[x,y].red>.8 && image[x,y].green<.2 && image[x,y].blue<.2) xs+=x
            assertTrue("Text really paints",xs.isNotEmpty())
            val left=(xs.min()+canvas.left)/2-root.x;val right=(xs.max()+canvas.left)/2-root.x
            if(!caption) { assertTrue("Centered word overflows both sides",left < -60 && right>108) }
            else if(f.optString("dir")=="rtl") { assertTrue("RTL caption overflow stays inline-start anchored",left < -100 && right<=root.width+1) }
            else assertTrue("LTR caption overflow stays inline-start anchored",left>=-1 && right>180)
        }
    }

    @Test fun extremeFiniteCircleSizeAndStrokeUseAppliedFiniteDimensions() {
        var diameter by mutableStateOf(Double.MAX_VALUE)
        var thickness by mutableStateOf(4.0)
        var showValue by mutableStateOf(true)
        val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) {
            Box(Modifier.requiredSize(160.dp).background(Color.White).testTag("canvas"),contentAlignment=Alignment.Center) {
                AWCAccessibilityAppearanceScope(reducedMotion=true) {
                    AWCMeterAppearanceScope(AWCMeterAppearance(size=diameter,trackColor="#00FF00")) {
                        AWCInspectionScope(collector) {
                            AWCComponent("md-meter",mapOf("variant" to "circular","value" to 0,"showValue" to showValue,
                                "valueText" to "0","thickness" to thickness))
                        }
                    }
                }
            }
        } } }
        compose.waitForIdle()
        val nodes=compose.runOnIdle { collector.snapshot().nodes }
        val root=nodes.single { it.id=="component" }
        assertEquals("Native physical coordinate ceiling",32766/2.0,root.bounds.width,.0)
        val value=nodes.single { it.id=="component.value" }
        assertEquals(root.bounds.width*.26,value.metrics!!.typography!!.size,.001)
        assertEquals(root.bounds.width*.26,value.metrics!!.typography!!.lineHeight,.001)
        assertEquals((32766*.18).roundToInt()/2.0,value.metrics!!.padding!!.left,.0)
        assertTrue(nodes.all { listOf(it.bounds.x,it.bounds.y,it.bounds.width,it.bounds.height).all(Double::isFinite) })

        compose.runOnIdle { diameter=48.0;thickness=Double.MAX_VALUE;showValue=false }
        compose.waitForIdle()
        val small=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component" }.bounds }
        assertEquals(48.0,small.width,.0)
        // A huge finite source stroke covers the entire clipped viewport.
        // This checks actual native paint, not merely a sanitized metric.
        val image=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
        for(x in listOf(113,160,206)) for(y in listOf(113,160,206))
            assertEquals("Extreme stroke paints viewport at $x,$y",Color.Green,image[x,y])
        compose.runOnIdle { diameter=0.0;showValue=true }
        compose.waitForIdle()
        val zero=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component.value" } }
        assertEquals(0.0,zero.metrics!!.typography!!.size,.0)
        assertEquals(0.0,zero.metrics!!.padding!!.left,.0)
    }

}
