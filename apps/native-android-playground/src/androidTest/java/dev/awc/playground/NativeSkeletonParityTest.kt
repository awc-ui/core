@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
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

class NativeSkeletonParityTest {
    @get:Rule val compose=createComposeRule()
    private fun document(theme:String,prefix:String="SkeletonWeb")=InstrumentationRegistry.getInstrumentation().context.assets
        .open("$prefix-$theme.json").bufferedReader().use { JSONObject(it.readText()) }
    private fun appearance(source:JSONObject):AWCSkeletonAppearance {
        val style=source.optJSONObject("style") ?: return AWCSkeletonAppearance()
        fun length(key:String)=style.optString(key).takeIf(String::isNotEmpty)?.let(AWCSkeletonLength::parse)
        fun duration(key:String)=style.optString(key).takeIf(String::isNotEmpty)?.let { if(it.endsWith("ms")) it.dropLast(2).toDouble()/1000 else it.removeSuffix("s").toDouble() }
        val radius=if(style.has("radius")) AWCCornerRadius(AWCCornerLength(points=10.0),AWCCornerLength(points=20.0)) else null
        fun corner(value:Double)=AWCCornerRadius(AWCCornerLength(points=value),AWCCornerLength(points=value))
        return AWCSkeletonAppearance(style.optString("color").takeIf(String::isNotEmpty),style.optString("highlight").takeIf(String::isNotEmpty),
            radius?.let { AWCCornerShape(it,it,it,it) },if(style.has("roundedRadius")) AWCCornerShape(corner(2.0),corner(12.0),corner(20.0),corner(5.0)) else null,
            length("width"),length("height"),length("size"),length("lineGap"),duration("pulseDuration"),duration("waveDuration"),duration("bloomDuration"))
    }
    private fun color(css:String):List<Double> {
        val values=Regex("-?(?:\\d*\\.)?\\d+").findAll(css).map { it.value.toDouble() }.toList()
        return if(css.startsWith("color(srgb")) values.take(3)+values.getOrElse(3) { 1.0 }
            else values.take(3).map { it/255.0 }+values.getOrElse(3) { 1.0 }
    }
    @Test fun all212WebCasesMatchActualNativeRootPartsAndAlphaFill() = runSourceMatrix("SkeletonWeb",true)
    @Test fun all212PristineDefaultPaletteCasesMatchWithoutTokenInjection() = runSourceMatrix("SkeletonDefaultWeb",false)
    private fun runSourceMatrix(prefix:String,injectTokens:Boolean) {
        var props by mutableStateOf<Map<String,AWCValue>>(emptyMap())
        var style by mutableStateOf(AWCSkeletonAppearance())
        var dark by mutableStateOf(false)
        var tokens by mutableStateOf<Map<String,String>>(emptyMap())
        var rtl by mutableStateOf(false)
        var inheritedDensity by mutableStateOf(0.0)
        var context by mutableStateOf(AWCSkeletonSizingContext())
        var partOverride by mutableStateOf(false)
        var epoch by mutableIntStateOf(0)
        var parentBounds=Rect.Zero;var canvasBounds=Rect.Zero
        val collector=AWCInspectionCollector()
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(2f,1f),LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCTheme(dark,tokens) {
                    AWCDensityScope(inheritedDensity) {
                        AWCSkeletonSizingContextScope(context) {
                            AWCSkeletonAppearanceScope(style.copy(bloomDuration=0.0,pulseDuration=0.0,waveDuration=0.0)) {
                                Box(Modifier.requiredSize(320.dp,400.dp).background(Color.White).testTag("canvas").onGloballyPositioned { canvasBounds=it.boundsInRoot() },contentAlignment=Alignment.TopStart) {
                                    val parent=Modifier.requiredWidth(240.dp).then(context.parentHeight?.let { Modifier.height(it.toFloat().dp) } ?: Modifier)
                                        .onGloballyPositioned { parentBounds=it.boundsInRoot() }
                                    Box(parent,contentAlignment=Alignment.TopStart) {
                                        key(epoch) {
                                            val skeleton:@Composable ()->Unit={ AWCInspectionScope(collector) { AWCComponent("md-skeleton",props) } }
                                            if(partOverride) AWCSkeletonPartAppearanceScope(AWCSkeletonPartAppearance(color="#00FF0080",height=AWCSkeletonLength(points=12.0)),AWCSkeletonPart.Line) {
                                                AWCSkeletonPartAppearanceScope(AWCSkeletonPartAppearance(width=AWCSkeletonLength(fraction=.4),cornerShape=AWCCornerShape.uniform()),AWCSkeletonPart.LineLast,skeleton)
                                            } else skeleton()
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        val failures=mutableListOf<String>()
        fun expect(id:String,name:String,want:Double,actual:Double,tolerance:Double=.3) { if(abs(want-actual)>tolerance) failures+="$id $name Web=$want Android=$actual" }
        for(theme in listOf("light","dark")) {
            val doc=document(theme,prefix);val sourceTokens=doc.getJSONObject("tokens");val entries=doc.getJSONArray("results")
            val themeColors=sourceTokens.keys().asSequence().filter { it in AWCThemeColorRoles }.associateWith { key->
                val raw=sourceTokens.getString(key);if(raw.length==4) "#"+raw.drop(1).map { "$it$it" }.joinToString("") else raw }
            for(index in 0 until entries.length()) {
                val entry=entries.getJSONObject(index);val fixture=entry.getJSONObject("fixture");val id="$theme/${fixture.getString("id")}"
                compose.runOnIdle {
                    props=listOf("variant","animation","lines","width","height","fullWidth","fullHeight","ariaLabelProp","announce","density","hidden")
                        .filter { fixture.has(it) }.associateWith { fixture.get(it) } + if(fixture.has("hostDir")) mapOf("dir" to fixture.getString("hostDir")) else emptyMap()
                    style=appearance(fixture);dark=theme=="dark";tokens=if(injectTokens) themeColors else emptyMap();rtl=fixture.optString("dir")=="rtl"
                    inheritedDensity=fixture.optDouble("inheritedDensity",0.0)
                    context=AWCSkeletonSizingContext(fontSize=fixture.optDouble("fontSize",16.0),parentHeight=if(fixture.has("parentHeight")) fixture.getDouble("parentHeight") else null)
                    partOverride=fixture.optBoolean("part");epoch++
                }
                compose.waitForIdle()
                if(fixture.optBoolean("hidden")) { compose.runOnIdle { assertTrue("$id hidden removes measurement",collector.snapshot().nodes.isEmpty()) };continue }
                var root:AWCInspectionNode?=null;var nativeParts=listOf<AWCInspectionNode>()
                compose.runOnIdle {
                    val nodes=collector.snapshot().nodes;root=nodes.singleOrNull { it.id=="component" }
                    assertNotNull("$id measured root",root)
                    val host=entry.getJSONObject("host");val b=root!!.bounds
                    expect(id,"host width",host.getDouble("width"),b.width);expect(id,"host height",host.getDouble("height"),b.height)
                    expect(id,"host x",host.getDouble("x"),b.x-parentBounds.left/2.0);expect(id,"host y",host.getDouble("y"),b.y-parentBounds.top/2.0)
                    nativeParts=nodes.filter { it.parentId=="component" }.sortedBy { it.id }
                    val parts=entry.getJSONArray("parts");assertEquals("$id actual parts",parts.length(),nativeParts.size)
                    for(i in 0 until parts.length()) {
                        val part=parts.getJSONObject(i);val actual=nativeParts[i].bounds
                        expect(id,"part$i x",part.getDouble("x"),actual.x-b.x);expect(id,"part$i y",part.getDouble("y"),actual.y-b.y)
                        expect(id,"part$i width",part.getDouble("width"),actual.width);expect(id,"part$i height",part.getDouble("height"),actual.height)
                    }
                }
                if(nativeParts.any { it.bounds.width>=4 && it.bounds.height>=4 }) {
                    val image=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                    for((i,node) in nativeParts.withIndex()) {
                        val b=node.bounds;if(b.width<4 || b.height<4) continue
                        val x=((b.x+b.width/2)*2-canvasBounds.left).roundToInt();val y=((b.y+b.height/2)*2-canvasBounds.top).roundToInt()
                        if(x !in 0 until image.width || y !in 0 until image.height) continue
                        val actual=image[x,y];val css=entry.getJSONArray("parts").getJSONObject(i).getJSONObject("style").getString("fill");val expected=color(css)
                        for((channel,value) in listOf(actual.red,actual.green,actual.blue).withIndex()) expect(id,"part$i fill$channel",expected[channel]*expected[3]+1-expected[3],value.toDouble(),.016)
                    }
                }
            }
        }
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }
    @Test fun announcedStatusHasNativeNamePoliteUpdatesAndNoActionWhileDecorativeIsHidden() {
        var properties by mutableStateOf<Map<String,AWCValue>>(mapOf("animation" to "none","ariaLabelProp" to "Loading article"))
        compose.setContent { AWCTheme { AWCSkeletonAppearanceScope(AWCSkeletonAppearance(bloomDuration=0.0)) { AWCComponent("md-skeleton",properties) } } }
        compose.onNodeWithContentDescription("Loading article").assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion,LiveRegionMode.Polite))
            .assert(SemanticsMatcher.expectValue(AWCSkeletonBusyKey,true)).assertHasNoClickAction()
        compose.runOnIdle { properties=properties+("ariaLabelProp" to "Loading next page") }
        compose.onNodeWithContentDescription("Loading next page").assertExists()
        compose.onAllNodesWithText("Loading next page").assertCountEquals(0)
        compose.runOnIdle { properties=properties+("announce" to false) }
        compose.onAllNodesWithContentDescription("Loading next page").assertCountEquals(0)
        compose.runOnIdle { properties=properties+("announce" to true)+("hidden" to true) }
        compose.onAllNodesWithContentDescription("Loading next page").assertCountEquals(0)
    }
    @Test fun actualEntrancePulseShimmerPreferencesAndRemountRenderNativePixels() {
        compose.mainClock.autoAdvance=false
        var animation by mutableStateOf("pulse");var reduced by mutableStateOf(false);var forced by mutableStateOf(false)
        var hidden by mutableStateOf(false);var bloom by mutableStateOf(0.0);var epoch by mutableIntStateOf(0)
        val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
            AWCTheme(false,mapOf("--md-sys-color-outline" to "#112233")) {
                Box(Modifier.requiredSize(280.dp,100.dp).background(Color.White).testTag("motion"),contentAlignment=Alignment.Center) {
                    key(epoch) { AWCAccessibilityAppearanceScope(reducedMotion=reduced,forcedColors=forced) {
                        AWCSkeletonAppearanceScope(AWCSkeletonAppearance(color="#000000",highlight="#FF0000",radius=AWCCornerShape.uniform(),
                            bloomDuration=bloom,pulseDuration=.8,waveDuration=.8)) {
                            AWCInspectionScope(collector) { AWCComponent("md-skeleton",mapOf("variant" to "rectangular","width" to "240px","height" to "40px","animation" to animation,"hidden" to hidden)) }
                        }
                    } }
                }
            }
        } }
        fun pixels()=compose.onNodeWithTag("motion").captureToImage().toPixelMap()
        compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeBy(400);compose.waitForIdle()
        val low=pixels()[280,100]
        assertEquals("Pulse really fades black over white at its trough",.45,low.red.toDouble(),.035)
        assertEquals(low.red,low.green,.002f);assertEquals(low.red,low.blue,.002f)
        compose.mainClock.advanceTimeBy(400);compose.waitForIdle();assertTrue("Pulse returns toward opaque",pixels()[280,100].red<.04f)
        compose.runOnIdle { animation="wave";epoch++ };compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeBy(120);compose.waitForIdle()
        val moving=pixels();val redCount=(60 until 140).sumOf { y->(40 until 520).count { x->moving[x,y].red>.1f && moving[x,y].green<.02f } }
        assertTrue("Actual clipped red gradient is visible: $redCount",redCount>100)
        compose.mainClock.advanceTimeBy(160);compose.waitForIdle();val later=pixels()
        assertTrue("Shimmer translates across the real native shape",(60 until 140).sumOf { y->(40 until 520).count { x->moving[x,y]!=later[x,y] } }>100)
        assertEquals("Outside the source shape stays unpainted",Color.White,later[20,100])
        compose.runOnIdle { reduced=true };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        val still=pixels();assertEquals(Color.Black,still[280,100])
        compose.mainClock.advanceTimeBy(1600);compose.waitForIdle();val settled=pixels()
        assertEquals("Reduced motion removes shimmer",0,(60 until 140).sumOf { y->(40 until 520).count { x->still[x,y]!=settled[x,y] } })
        compose.runOnIdle { forced=true };compose.mainClock.advanceTimeByFrame();compose.waitForIdle();assertEquals(Color(0xff112233),pixels()[280,100])
        compose.runOnIdle { hidden=true };compose.mainClock.advanceTimeByFrame();compose.waitForIdle();compose.runOnIdle { assertTrue(collector.snapshot().nodes.isEmpty()) }
        compose.runOnIdle { hidden=false;reduced=false;forced=false;animation="none";bloom=.5 }
        compose.mainClock.advanceTimeByFrame();compose.waitForIdle();assertTrue("A fresh mount retains its entrance even with animation none",pixels()[280,100].red>.8f)
        compose.mainClock.advanceTimeBy(600);compose.waitForIdle();assertEquals(Color.Black,pixels()[280,100])
    }

}
