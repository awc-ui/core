@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
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

class NativeLoadingIndicatorParityTest {
    @get:Rule val compose=createComposeRule()
    private fun document(theme:String,prefix:String="LoadingIndicatorWeb")=InstrumentationRegistry.getInstrumentation().context.assets
        .open("$prefix-$theme.json").bufferedReader().use { JSONObject(it.readText()) }
    private fun shape(css:String):AWCCornerShape {
        fun lengths(part:String):List<AWCCornerLength> {
            val values=part.trim().split(Regex("\\s+")).map { if(it.endsWith("%")) AWCCornerLength(fraction=it.dropLast(1).toDouble()/100) else AWCCornerLength(points=it.removeSuffix("px").toDouble()) }
            return when(values.size) { 1->List(4){values[0]};2->listOf(values[0],values[1],values[0],values[1]);3->listOf(values[0],values[1],values[2],values[1]);else->values }
        }
        val axes=css.split('/');val x=lengths(axes[0]);val y=lengths(axes.getOrElse(1){axes[0]})
        val corners=(0..3).map { AWCCornerRadius(x[it],y[it]) }
        return AWCCornerShape(corners[0],corners[1],corners[2],corners[3])
    }
    private fun appearance(source:JSONObject):AWCLoadingIndicatorAppearance {
        val style=source.optJSONObject("style") ?: return AWCLoadingIndicatorAppearance()
        fun length(key:String)=style.optString(key).removeSuffix("px").toDoubleOrNull()
        return AWCLoadingIndicatorAppearance(style.optString("color").takeIf { it.isNotEmpty() },length("size"),length("shapeSize"),
            style.optString("containerColor").takeIf { it.isNotEmpty() },style.optString("containerShape").takeIf { it.isNotEmpty() }?.let(::shape))
    }
    private fun cssColor(value:String):List<Double> = Regex("-?(?:\\d*\\.)?\\d+").findAll(value).map { it.value.toDouble() }.toList().let { if(it.size==3) it+1.0 else it }
    private fun composite(foreground:List<Double>,background:List<Double>)=(0..2).map { foreground[it]*foreground[3]+background[it]*(1-foreground[3]) }+1.0

    @Test fun all84BrowserFixturesMatchActualGeometryClippingThemesAndRgbaPaint() = runSourceMatrix("LoadingIndicatorWeb",true)
    // Gate-7 R2-D1/R2-D2: fresh default-palette Chrome capture; no colours are injected into the native theme.
    @Test fun all84PristineDefaultPaletteCasesMatchWithoutTokenInjection() = runSourceMatrix("LoadingIndicatorDefaultWeb",false)
    private fun runSourceMatrix(prefix:String,injectTokens:Boolean) {
        compose.mainClock.autoAdvance=false
        var props by mutableStateOf<Map<String,AWCValue>>(emptyMap())
        var appearance by mutableStateOf(AWCLoadingIndicatorAppearance())
        var part by mutableStateOf(AWCLoadingIndicatorShapeAppearance())
        var dark by mutableStateOf(false);var tokens by mutableStateOf<Map<String,String>>(emptyMap())
        var inherited by mutableStateOf(0.0);var rtl by mutableStateOf(false);var epoch by mutableStateOf(0)
        val collector=AWCInspectionCollector();var canvas=Rect.Zero
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(2f,1f),LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCTheme(dark,tokens) { AWCDensityScope(inherited) {
                    Box(Modifier.requiredSize(160.dp).background(Color.White).testTag("canvas").onGloballyPositioned { canvas=it.boundsInRoot() },contentAlignment=Alignment.Center) {
                        key(epoch) { AWCAccessibilityAppearanceScope(reducedMotion=false) {
                            AWCLoadingIndicatorAppearanceScope(appearance) { AWCLoadingIndicatorShapeAppearanceScope(part) {
                                AWCInspectionScope(collector) { AWCComponent("md-loading-indicator",props) }
                            } }
                        } }
                    }
                } }
            }
        }
        val failures=mutableListOf<String>()
        fun expect(id:String,name:String,expected:Double,actual:Double,tolerance:Double=.51) {
            if(abs(expected-actual)>tolerance) failures+="$id $name: native=$actual Web=$expected"
        }
        for(theme in listOf("light","dark")) {
            val document=document(theme,prefix);val all=document.getJSONArray("results");val sourceTokens=document.getJSONObject("tokens")
            val colors=sourceTokens.keys().asSequence().filter { it in AWCThemeColorRoles }.associateWith { sourceTokens.getString(it).let { raw->if(raw.length==4) "#"+raw.drop(1).map { "$it$it" }.joinToString("") else raw } }
            for(i in 0 until all.length()) {
                val entry=all.getJSONObject(i);val source=entry.getJSONObject("fixture");val host=entry.getJSONObject("host");val webShape=entry.getJSONObject("shape");val id="$theme/${source.getString("id")}"
                compose.runOnIdle {
                    props=listOf("variant","label","density","dir","hidden").filter { source.has(it) }.associateWith { source.get(it) }
                    appearance=appearance(source);part=if(source.optBoolean("part")) AWCLoadingIndicatorShapeAppearance(20.0,30.0,"#00FF0080") else AWCLoadingIndicatorShapeAppearance()
                    dark=theme=="dark";tokens=if(injectTokens) colors else emptyMap();inherited=source.optDouble("inheritedDensity",0.0);rtl=source.optString("dir")=="rtl";epoch++
                }
                compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
                val snapshot=compose.runOnIdle { collector.snapshot() }
                if(source.optBoolean("hidden")) { assertTrue("$id has no fabricated bounds",snapshot.nodes.isEmpty());continue }
                val root=snapshot.nodes.single { it.id=="component" };val node=snapshot.nodes.single { it.id=="component.shape" }
                expect(id,"width",host.getDouble("width"),root.bounds.width);expect(id,"height",host.getDouble("height"),root.bounds.height)
                expect(id,"shape width",webShape.getDouble("width"),node.bounds.width);expect(id,"shape height",webShape.getDouble("height"),node.bounds.height)
                expect(id,"shape x",webShape.getDouble("x"),node.bounds.x-root.bounds.x);expect(id,"shape y",webShape.getDouble("y"),node.bounds.y-root.bounds.y)
                assertEquals("component",node.parentId)
                if(root.bounds.width<=0 || node.bounds.width<=0 || node.bounds.height<=0) continue
                val image=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                val centerX=((root.bounds.x+root.bounds.width/2)*2-canvas.left).roundToInt()
                val centerY=((root.bounds.y+root.bounds.height/2)*2-canvas.top).roundToInt()
                val background=composite(cssColor(host.getString("fill")),listOf(255.0,255.0,255.0,1.0))
                val expected=composite(cssColor(webShape.getString("fill")),background)
                val pixel=image[centerX,centerY]
                listOf(pixel.red,pixel.green,pixel.blue).forEachIndexed { c,v -> expect(id,"shape channel$c",expected[c]/255,v.toDouble(),.016) }
                // Explicit oversized shapes must be clipped at the real host,
                // including contained radii, not merely receive smaller metadata.
                val below=((root.bounds.y+root.bounds.height+2)*2-canvas.top).roundToInt()
                assertEquals("$id no paint below host",Color.White,image[centerX,below])
                val left=((root.bounds.x-2)*2-canvas.left).roundToInt()
                assertEquals("$id no paint beside host",Color.White,image[left,centerY])
                if(source.optString("variant")=="contained") {
                    val x=(root.bounds.x*2-canvas.left+1).roundToInt();val y=(root.bounds.y*2-canvas.top+1).roundToInt()
                    val radius=source.optJSONObject("style")?.optString("containerShape")
                    if(radius=="0px") {
                        listOf(image[x,y].red,image[x,y].green,image[x,y].blue).forEachIndexed { c,v->expect(id,"square corner$c",background[c]/255,v.toDouble(),.016) }
                    } else if(radius.isNullOrEmpty() || radius=="25%" || radius=="150%" || radius=="10px / 20px")
                        assertEquals("$id rounded corner clips",Color.White,image[x,y])
                }
            }
        }
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }

    @Test fun semanticLabelIsIndeterminatePoliteAndFocusIsExplicitWithActualPaint() {
        compose.mainClock.autoAdvance=false
        var label by mutableStateOf("Loading records");var hidden by mutableStateOf(false);var optIn by mutableStateOf(false)
        val requester=FocusRequester();var focusManager:androidx.compose.ui.focus.FocusManager?=null
        var bounds=Rect.Zero;var canvas=Rect.Zero
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false,mapOf("--md-sys-color-secondary" to "#FF0000")) {
            focusManager=LocalFocusManager.current
            Box(Modifier.requiredSize(120.dp).background(Color.White).testTag("canvas").onGloballyPositioned { canvas=it.boundsInRoot() },contentAlignment=Alignment.Center) {
                AWCAccessibilityAppearanceScope(reducedMotion=false) { AWCLoadingIndicatorAppearanceScope(AWCLoadingIndicatorAppearance(containerShape=AWCCornerShape.uniform(points=12.0))) {
                    AWCComponent("md-loading-indicator",mapOf("label" to label,"hidden" to hidden),Modifier
                        .testTag("focus-target").onGloballyPositioned { bounds=it.boundsInRoot() }
                        .then(if(optIn) Modifier.focusRequester(requester).focusable() else Modifier))
                } }
            }
        } } }
        val progress=hasContentDescription("Loading records")
        compose.onNode(progress).assert(SemanticsMatcher.expectValue(SemanticsProperties.ProgressBarRangeInfo,ProgressBarRangeInfo.Indeterminate))
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion,LiveRegionMode.Polite))
        assertFalse("No default tabstop",compose.onNode(progress).fetchSemanticsNode().config.contains(SemanticsProperties.Focused))
        compose.onAllNodes(hasText("Loading records")).assertCountEquals(0)
        compose.runOnIdle { optIn=true };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        compose.runOnIdle { requester.requestFocus() };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        compose.onNodeWithTag("focus-target").assertIsFocused()
        fun ringPixel():Color { val pixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap();return pixels[(bounds.center.x-canvas.left).roundToInt(),(bounds.top-canvas.top-7).roundToInt()] }
        assertEquals("Caller programmatic focus paints the 3dp ring beyond its 2dp gap",Color.Red,ringPixel())
        val cornerPixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
        assertEquals("Focus outline expands resolved 12dp host radii",Color.Red,cornerPixels[(bounds.left-canvas.left+3).roundToInt(),(bounds.top-canvas.top+3).roundToInt()])
        compose.runOnIdle { focusManager!!.clearFocus() };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        assertEquals(Color.White,ringPixel())
        compose.runOnIdle { label="  Busy  " };compose.mainClock.advanceTimeByFrame();compose.waitForIdle();compose.onNodeWithContentDescription("  Busy  ").assertExists()
        compose.runOnIdle { hidden=true };compose.mainClock.advanceTimeByFrame();compose.waitForIdle();compose.onNodeWithContentDescription("  Busy  ").assertDoesNotExist()
    }

    @Test fun actualMorphMovesWhileReducedMotionKeepsCircleAndPulsesAndForcedPaletteIsExplicit() {
        compose.mainClock.autoAdvance=false
        var reduced by mutableStateOf(false);var forced by mutableStateOf(false);var hidden by mutableStateOf(false);var epoch by mutableStateOf(0)
        val collector=AWCInspectionCollector()
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false,mapOf("--md-sys-color-on-surface" to "#112233","--md-sys-color-surface" to "#FEDCBA")) {
            Box(Modifier.requiredSize(120.dp).background(Color.White).testTag("canvas"),contentAlignment=Alignment.Center) {
                key(epoch) { AWCAccessibilityAppearanceScope(reducedMotion=reduced,forcedColors=forced) {
                    AWCLoadingIndicatorAppearanceScope(AWCLoadingIndicatorAppearance(color="#FF0000",containerColor="#00FF00")) {
                        AWCInspectionScope(collector) { AWCComponent("md-loading-indicator",mapOf("variant" to "contained","hidden" to hidden)) }
                    }
                } }
            }
        } } }
        fun pixels()=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
        val first=pixels();compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeBy(325);compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        val moved=pixels()
        assertTrue("Actual morph/rotation changes shape pixels",(70 until 170).sumOf { y->(70 until 170).count { x->first[x,y]!=moved[x,y] } }>100)
        val node=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component.shape" } }
        assertTrue("Inspector refreshes the transformed layout bounds",abs(node.bounds.width-38.0)>1)
        compose.runOnIdle { reduced=true;forced=true;epoch++ };compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        val initial=pixels();assertEquals(Color(0xff112233),initial[120,120])
        assertEquals(Color(0xfffedcba),initial[120,74])
        compose.mainClock.advanceTimeByFrame();compose.mainClock.advanceTimeBy(1000);compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
        val faded=pixels()[120,120]
        val expected=listOf(17*.4+254*.6,34*.4+220*.6,51*.4+186*.6)
        listOf(faded.red,faded.green,faded.blue).forEachIndexed { i,v->assertEquals(expected[i]/255,v.toDouble(),.025) }
        val stationary=compose.runOnIdle { collector.snapshot().nodes.single { it.id=="component.shape" } }
        assertEquals(38.0,stationary.bounds.width,.01);assertEquals(38.0,stationary.bounds.height,.01)
        compose.runOnIdle { hidden=true };compose.mainClock.advanceTimeByFrame();compose.waitForIdle();compose.mainClock.advanceTimeBy(4000)
        compose.runOnIdle { assertTrue(collector.snapshot().nodes.isEmpty()) }
    }
}
