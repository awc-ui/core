@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.*
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

class NativeProgressParityTest {
    @get:Rule val compose=createComposeRule()
    private fun doc(name:String)=InstrumentationRegistry.getInstrumentation().context.assets.open("ProgressWeb-$name.json").bufferedReader().use { JSONObject(it.readText()) }
    private fun map(input:JSONObject):Map<String,AWCValue> =input.keys().asSequence().associateWith { value(input.get(it)) }
    private fun value(input:Any?):Any?=when(input) { is JSONObject->map(input);JSONObject.NULL->null;else->input }
    private fun appearance(f:JSONObject):AWCProgressIndicatorAppearance {
        val aliases=mapOf("activeColor" to "activeIndicatorColor","activeShape" to "activeIndicatorShape","stopColor" to "stopIndicatorColor",
            "stopShape" to "stopIndicatorShape","stopSize" to "stopIndicatorSize","stopTrailingSpace" to "stopIndicatorTrailingSpace",
            "gap" to "trackActiveIndicatorSpace","four1" to "fourColor1","four2" to "fourColor2","four3" to "fourColor3","four4" to "fourColor4")
        val styles=f.optJSONObject("style") ?: JSONObject()
        val values=styles.keys().asSequence().associate { key->
            val name=aliases[key] ?: key.split('-').mapIndexed { i,part->if(i==0) part else part.replaceFirstChar { it.uppercase() } }.joinToString("");val raw=styles.getString(key)
            name to when {
                name.endsWith("Shape") -> listOf("topLeft","topRight","bottomRight","bottomLeft").associateWith { mapOf("x" to mapOf("points" to if(raw.endsWith('%')) 0.0 else raw.removeSuffix("px").toDouble(), "fraction" to if(raw.endsWith('%')) raw.dropLast(1).toDouble()/100 else 0.0), "y" to mapOf("points" to if(raw.endsWith('%')) 0.0 else raw.removeSuffix("px").toDouble(), "fraction" to if(raw.endsWith('%')) raw.dropLast(1).toDouble()/100 else 0.0)) }
                raw.startsWith('#') -> raw
                else -> raw.removeSuffix("px").toDouble()
            }
        }
        return AWCProgressIndicatorAppearance.fromValues(values)
    }
    private fun tokens(d:JSONObject):Map<String,String> = d.getJSONObject("tokens").let { t->
        t.keys().asSequence().filter { it.startsWith("--md-sys-color-") }.associateWith { t.getString(it).let { if(it.length==4) "#"+it.drop(1).map { c->"$c$c" }.joinToString("") else it } }
    }

    @Test fun actual184ThemeFixturesAnd52EdgeConfigurationsMatchMeasuredRootAndParts() = runProgressMatrix(false)
    // Gate-7 R2-D1/R2-D4: fresh default-palette Chrome capture; no colours are injected into the native theme.
    @Test fun all184PristineDefaultPaletteCasesMatchWithoutTokenInjection() = runProgressMatrix(true)
    private fun runProgressMatrix(defaultPalette:Boolean) {
        compose.mainClock.autoAdvance=false
        var props by mutableStateOf<Map<String,AWCValue>>(emptyMap());var style by mutableStateOf(AWCProgressIndicatorAppearance())
        var theme by mutableStateOf<Map<String,String>>(emptyMap());var dark by mutableStateOf(false)
        var inherited by mutableStateOf(0.0);var width by mutableStateOf(240.0);var direction by mutableStateOf(LayoutDirection.Ltr)
        var epoch by mutableStateOf(0);val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f),LocalLayoutDirection provides direction) { AWCTheme(dark,theme) {
            AWCDensityScope(inherited) {
                Box(Modifier.requiredSize(320.dp,300.dp).background(Color.White).testTag("canvas"),contentAlignment=Alignment.Center) {
                    Box(Modifier.requiredWidth(width.toFloat().dp),contentAlignment=Alignment.Center) {
                        key(epoch) { AWCProgressIndicatorAppearanceScope(style) { AWCInspectionScope(collector) { AWCComponent("md-progress-indicator",props) } } }
                    }
                }
            }
        } } }
        val light=doc(if(defaultPalette) "default-light" else "light")
        val geometry=light.getJSONArray("samples").getJSONObject(0).getJSONArray("results")
        val all=mutableListOf<Triple<JSONObject,JSONObject,Boolean>>()
        for(themeName in listOf("light","dark")) {
            val source=doc(if(defaultPalette) "default-$themeName" else themeName)
            for(i in 0 until source.getJSONArray("results").length()) all+=Triple(geometry.getJSONObject(i),source,themeName=="dark")
        }
        val edge=doc("edges");val edgeCases=edge.getJSONArray("samples").getJSONObject(0).getJSONArray("results")
        // The 52 edge configurations were captured with the recorded Laboratory palette: recorded pass only.
        if(!defaultPalette) for(i in 0 until edgeCases.length()) all+=Triple(edgeCases.getJSONObject(i),edge,false)
        val failures=mutableListOf<String>()
        fun near(id:String,name:String,expected:Double,actual:Double,tolerance:Double=.51) {
            if(!actual.isFinite() || abs(actual-expected)>tolerance) failures+="$id $name native=$actual Web=$expected"
        }
        for((entry,source,isDark) in all) {
            val f=entry.getJSONObject("fixture");val id="${if(isDark) "dark" else "light"}/${f.getString("id")}"
            compose.runOnIdle {
                props=map(f);style=appearance(f);theme=if(defaultPalette) emptyMap() else tokens(source);dark=isDark;inherited=f.optDouble("inheritedDensity",0.0)
                width=f.optDouble("width",240.0);direction=if(f.optString("parentDir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr;epoch++
            }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            val nodes=compose.runOnIdle { collector.snapshot().nodes }
            if(f.optBoolean("hidden")) { assertTrue("$id hidden has no measured substitute",nodes.isEmpty());continue }
            val root=nodes.single { it.id=="component" };val host=entry.getJSONObject("host")
            near(id,"root width",host.getDouble("width"),root.bounds.width);near(id,"root height",host.getDouble("height"),root.bounds.height)
            val semantics=compose.onNode(SemanticsMatcher.keyIsDefined(AWCProgressRangeKey)).fetchSemanticsNode().config
            val attrs=host.getJSONObject("attributes")
            assertEquals(id,AWCProgressRange(attrs.getString("aria-valuemax").toDouble(),attrs.optString("aria-valuenow").toDoubleOrNull()),semantics[AWCProgressRangeKey])
            assertFalse("$id no activation",semantics.contains(SemanticsActions.OnClick))
            assertFalse("$id no invented live region",semantics.contains(SemanticsProperties.LiveRegion))
            val parts=entry.getJSONArray("parts")
            for(i in 0 until parts.length()) {
                val web=parts.getJSONObject(i);val part=web.getString("part")
                val native=nodes.singleOrNull { it.id=="component.$part" }
                if(native==null) { failures+="$id missing $part";continue }
                for((name,actual) in listOf("x" to native.bounds.x-root.bounds.x,"y" to native.bounds.y-root.bounds.y,"width" to native.bounds.width,"height" to native.bounds.height))
                    near(id,"$part $name",web.getDouble(name),actual)
            }
            if(!f.optBoolean("wave") && !f.optBoolean("indeterminate") && f.optString("variant")!="circular" && root.bounds.height>=2) {
                val pixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                val filled=nodes.single { it.id=="component.active-indicator" }.bounds
                val color=(style.activeIndicatorColor ?: tokens(source)["--md-sys-color-primary"])!!
                if(filled.width>4 && color.length==7) {
                    val centerX=((320-width)/2+(if(props["dir"]=="rtl") width-filled.width/2 else filled.width/2))*2
                    val pixel=pixels[centerX.roundToInt().coerceIn(0,pixels.width-1),300]
                    val expected=Color(android.graphics.Color.parseColor(color))
                    near(id,"paint red",expected.red.toDouble(),pixel.red.toDouble(),.02)
                    near(id,"paint green",expected.green.toDouble(),pixel.green.toDouble(),.02)
                    near(id,"paint blue",expected.blue.toDouble(),pixel.blue.toDouble(),.02)
                }
            }
        }
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }

    @Test fun mountedCompletionRetainsIdentityAndEmitsExactlyOneVoidEvent() {
        compose.mainClock.autoAdvance=false
        var props by mutableStateOf<Map<String,AWCValue>>(emptyMap());var epoch by mutableStateOf(0)
        var reduced by mutableStateOf(false);val events=mutableListOf<Pair<String,AWCValue>>();val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) {
            Box(Modifier.requiredSize(300.dp,100.dp),contentAlignment=Alignment.Center) { key(epoch) {
                AWCAccessibilityAppearanceScope(reducedMotion=reduced) {
                    AWCInspectionScope(collector) { AWCComponent("md-progress-indicator",props,onEvent={name,detail->events+=name to detail}) }
                }
            } }
        } } }
        for(variant in listOf("linear","circular")) for(wave in listOf(false,true)) for(reduce in listOf(false,true)) {
            compose.runOnIdle { events.clear();props=mapOf("variant" to variant,"wave" to wave,"value" to 37,"complete" to true);reduced=reduce;epoch++ }
            compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeBy(128);compose.waitForIdle()
            assertTrue("Initially complete is source-inert",events.isEmpty())
            compose.runOnIdle { props=props+("complete" to false) };compose.mainClock.advanceTimeByFrame()
            compose.runOnIdle { props=props+("complete" to true) };compose.mainClock.advanceTimeByFrame()
            compose.mainClock.advanceTimeBy(3200);compose.waitForIdle()
            assertEquals("$variant/$wave/$reduce",listOf("mdComplete" to null),events)
            val root=compose.runOnIdle { collector.snapshot().nodes.singleOrNull { it.id=="component" } }
            assertEquals("Only flat circular retains its empty track",variant=="circular" && !wave,root!=null)
            compose.runOnIdle { props=props+("complete" to false) };compose.mainClock.advanceTimeByFrame()
            compose.runOnIdle { props=props+("complete" to true) };compose.mainClock.advanceTimeBy(500);compose.waitForIdle()
            assertEquals(1,events.size)
        }
        compose.runOnIdle { events.clear();epoch++;reduced=false;props=mapOf("indeterminate" to true,"value" to 100) }
        compose.mainClock.advanceTimeByFrame();compose.runOnIdle { props=props+("complete" to true) }
        compose.mainClock.advanceTimeBy(3200);compose.waitForIdle()
        assertTrue("Indeterminate does not complete",events.isEmpty())
    }

    @Test fun determinateUpdatesAnimateAndReducedMotionDoesNotFreezeIndeterminatePaint() {
        compose.mainClock.autoAdvance=false
        var props by mutableStateOf<Map<String,AWCValue>>(mapOf("value" to 0));var reduced by mutableStateOf(false)
        val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) {
            Box(Modifier.requiredSize(240.dp,100.dp),contentAlignment=Alignment.Center) {
                AWCAccessibilityAppearanceScope(reducedMotion=reduced) { AWCInspectionScope(collector) { AWCComponent("md-progress-indicator",props) } }
            }
        } } }
        fun width()=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component.active-indicator" }.bounds.width }
        assertEquals(0.0,width(),.0)
        compose.runOnIdle { props=props+("value" to 100) };compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        assertTrue(width() in .01..239.99)
        compose.mainClock.advanceTimeBy(800);compose.waitForIdle();assertEquals(240.0,width(),.01)
        compose.runOnIdle { reduced=true;props=props+("value" to 25) };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        assertEquals(60.0,width(),.01)
        compose.runOnIdle { props=props+("indeterminate" to true) };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        val first=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component.active-indicator" }.bounds }
        compose.mainClock.advanceTimeBy(1000);compose.waitForIdle()
        val second=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component.active-indicator" }.bounds }
        assertNotEquals("Reduced motion slows the real bar instead of freezing it",first,second)
    }
    @Test fun nonzeroPhaseRtlMirrorsActualWavesAndPhysicalCornersOnce() {
        compose.mainClock.autoAdvance=false
        var wave by mutableStateOf(true);var epoch by mutableStateOf(0)
        val corner=AWCCornerShape(topLeft=AWCCornerRadius(AWCCornerLength(points=9.0),AWCCornerLength(points=8.0)),
            bottomRight=AWCCornerRadius(AWCCornerLength(points=2.0),AWCCornerLength(points=3.0)))
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) {
            Column { for(dir in listOf("ltr","rtl")) {
                Box(Modifier.requiredSize(240.dp,30.dp).background(Color.White).testTag(dir),contentAlignment=Alignment.Center) {
                    key(epoch) { AWCProgressIndicatorAppearanceScope(AWCProgressIndicatorAppearance(activeIndicatorColor="#1122AA",trackColor="#AABBCC",trackShape=corner,activeIndicatorShape=corner)) {
                        AWCComponent("md-progress-indicator",mapOf("indeterminate" to true,"wave" to wave,"thickness" to 10,"waveAmplitude" to 5,"dir" to dir))
                    } }
                }
            } }
        } } }
        for(isWave in listOf(true,false)) {
            compose.runOnIdle { wave=isWave;epoch++ };compose.mainClock.advanceTimeByFrame()
            for(delta in listOf(256L,744L,600L)) {
                compose.mainClock.advanceTimeBy(delta);compose.waitForIdle()
                val l=compose.onNodeWithTag("ltr").captureToImage().toPixelMap();val r=compose.onNodeWithTag("rtl").captureToImage().toPixelMap()
                fun difference(a:Color,b:Color)=maxOf(abs(a.red-b.red),abs(a.green-b.green),abs(a.blue-b.blue))
                fun edge(image:PixelMap,x:Int,y:Int):Boolean {
                    val center=image[x,y]
                    return (-1..1).any { dy -> (-1..1).any { dx ->
                        val nx=(x+dx).coerceIn(0,image.width-1);val ny=(y+dy).coerceIn(0,image.height-1)
                        difference(center,image[nx,ny])>.04
                    } }
                }
                var boundaryDifferences=0;var invalid=0
                for(y in 0 until l.height) for(x in 0 until l.width) {
                    val rx=l.width-1-x;val error=difference(l[x,y],r[rx,y])
                    if(error>.04) {
                        boundaryDifferences++
                        // The device's four-sample rasterizer can change one
                        // coverage sample under reflection. This is permitted
                        // only at a real one-physical-pixel boundary; solid
                        // interiors/background must retain the strict limit.
                        if(error>60f/255+.00001 || !edge(l,x,y) || !edge(r,rx,y)) invalid++
                    }
                }
                if(isWave && delta==256L) {
                    for((name,image) in listOf("ltr" to compose.onNodeWithTag("ltr").captureToImage(),"rtl" to compose.onNodeWithTag("rtl").captureToImage())) {
                        val stream=java.io.ByteArrayOutputStream();image.asAndroidBitmap().compress(android.graphics.Bitmap.CompressFormat.PNG,100,stream)
                        val encoded=android.util.Base64.encodeToString(stream.toByteArray(),android.util.Base64.NO_WRAP)
                        encoded.chunked(3000).forEachIndexed { index,chunk->android.util.Log.i("AWCProgressRTL","$name:$index:$chunk") }
                    }
                    android.util.Log.i("AWCProgressRTL","boundary-differences:$boundaryDifferences; invalid:$invalid; pixels:${l.width*l.height}")
                }
                assertEquals("$isWave RTL must agree in solid pixels and differ by no more than one measured edge coverage sample",0,invalid)
            }
        }
    }

    @Test fun rgbaAndForcedColorsUseActualNativePaintWithoutInventingActions() {
        compose.mainClock.autoAdvance=false
        var forced by mutableStateOf(false);var reduced by mutableStateOf(false)
        val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false,mapOf("--md-sys-color-on-surface" to "#123456","--md-sys-color-outline" to "#8899AA")) {
            Box(Modifier.requiredSize(240.dp,30.dp).background(Color.White).testTag("paint"),contentAlignment=Alignment.Center) {
                AWCAccessibilityAppearanceScope(reducedMotion=reduced,forcedColors=forced) {
                    AWCProgressIndicatorAppearanceScope(AWCProgressIndicatorAppearance(activeIndicatorColor="#FF000080",trackColor="#00FF0080",stopIndicatorColor="#0000FF80")) {
                        AWCInspectionScope(collector) { AWCComponent("md-progress-indicator",mapOf("value" to 50,"thickness" to 10,"label" to "Build")) }
                    }
                }
            }
        } } }
        fun pixel(x:Int)=compose.onNodeWithTag("paint").captureToImage().toPixelMap()[x,30]
        fun near(actual:Color,expected:Color) { assertEquals(expected.red,actual.red,.015f);assertEquals(expected.green,actual.green,.015f);assertEquals(expected.blue,actual.blue,.015f) }
        near(pixel(80),Color(1f,127/255f,127/255f));near(pixel(360),Color(127/255f,1f,127/255f))
        compose.runOnIdle { forced=true;reduced=true };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        near(pixel(80),Color(0xFF123456));near(pixel(360),Color(0xFF8899AA))
        compose.onNodeWithContentDescription("Build").assertExists().assertHasNoClickAction()
    }

}
