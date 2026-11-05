package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.platform.testTag
import androidx.compose.material3.LocalContentColor
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

class NativeSnackbarParityTest {
    @get:Rule val compose=createComposeRule()
    private fun document(theme:String,prefix:String="SnackbarWeb")=InstrumentationRegistry.getInstrumentation().context.assets.open("$prefix-$theme.json").bufferedReader().use { JSONObject(it.readText()) }
    private fun appearance(f:JSONObject):AWCSnackbarAppearance {
        val s=f.optJSONObject("style") ?: return AWCSnackbarAppearance()
        fun corner(x:Double,y:Double)=AWCCornerRadius(AWCCornerLength(x),AWCCornerLength(y))
        return AWCSnackbarAppearance(s.optString("container-color").takeIf(String::isNotEmpty),s.optString("message-color").takeIf(String::isNotEmpty),
            s.optString("action-color").takeIf(String::isNotEmpty),s.optString("close-color").takeIf(String::isNotEmpty),
            if(s.has("container-shape")) AWCCornerShape(corner(20.0,8.0),corner(4.0,12.0),corner(20.0,8.0),corner(4.0,12.0)) else null,
            s.optString("min-width").takeIf(String::isNotEmpty)?.let(AWCSnackbarLength::parse),
            s.optString("max-width").takeIf(String::isNotEmpty)?.let(AWCSnackbarLength::parse))
    }
    @Test fun all122NativeLayoutsMatchSourceViewportRootAndRealParts() = runMatrix(false)
    @Test fun all122PristineDefaultPaletteCasesPaintWithoutInjectedTokens() = runMatrix(true)
    @Test fun supplemental48PartFixturesMatchActualSourceGeometry() = runMatrix(false,"SnackbarExtra",48)
    @Test fun supplemental48PartFixturesPaintSourceCascade() = runMatrix(true,"SnackbarExtra",48)
    private fun runMatrix(paint:Boolean,prefix:String?=null,expected:Int=122) {
        val renderDensity=if(paint) 1f else 2f
        var authored by mutableStateOf(false);var parts by mutableStateOf(false);var simpleSlots by mutableStateOf(false)
        var extraParts by mutableStateOf<Map<AWCSnackbarPart,AWCSnackbarPartAppearance>>(emptyMap())
        fun resolved(part:AWCSnackbarPart,base:AWCSnackbarPartAppearance)=extraParts[part] ?: base
        var props by mutableStateOf<Map<String,AWCValue>>(emptyMap())
        var a by mutableStateOf(AWCSnackbarAppearance());var dark by mutableStateOf(false)
        var width by mutableDoubleStateOf(800.0);var inherited by mutableDoubleStateOf(0.0)
        var direction by mutableStateOf(LayoutDirection.Ltr);var epoch by mutableIntStateOf(0)
        val collector=AWCInspectionCollector()
        var parentX=0.0;var parentY=0.0
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(renderDensity,1f),LocalLayoutDirection provides direction) {
            AWCTheme(dark) { AWCDensityScope(inherited) { AWCAccessibilityAppearanceScope(reducedMotion=true) {
                AWCSnackbarAppearanceScope(a) {
                    AWCSnackbarScope(Modifier.requiredSize(width.dp,240.dp).background(Color.White).testTag("canvas").onGloballyPositioned { parentX=it.positionInRoot().x/renderDensity.toDouble();parentY=it.positionInRoot().y/renderDensity.toDouble() }) {
                        Box(Modifier.fillMaxSize())
                        key(epoch) {
                            AWCSnackbarPartAppearanceScope(resolved(AWCSnackbarPart.Surface,if(parts) AWCSnackbarPartAppearance(borderColor="#FFAA33",borderWidth=2.0,cornerShape=AWCCornerShape.uniform(12.0)) else AWCSnackbarPartAppearance())) {
                            AWCSnackbarPartAppearanceScope(resolved(AWCSnackbarPart.Message,if(parts) AWCSnackbarPartAppearance(fontWeight=700) else AWCSnackbarPartAppearance()),AWCSnackbarPart.Message) {
                            AWCSnackbarPartAppearanceScope(resolved(AWCSnackbarPart.Actions,if(parts) AWCSnackbarPartAppearance(paddingInlineStart=13.0) else AWCSnackbarPartAppearance()),AWCSnackbarPart.Actions) {
                            AWCSnackbarPartAppearanceScope(resolved(AWCSnackbarPart.Close,if(parts) AWCSnackbarPartAppearance(marginInlineStart=7.0) else AWCSnackbarPartAppearance()),AWCSnackbarPart.Close) {
                            AWCSnackbarPartAppearanceScope(resolved(AWCSnackbarPart.CloseIcon,if(parts) AWCSnackbarPartAppearance(color="#22CC99") else AWCSnackbarPartAppearance()),AWCSnackbarPart.CloseIcon) {
                                val slots=if(authored) AWCSlotRegistry(mapOf(
                                    "" to { AWCSlotText("Authored message") },
                                    "action" to { if(simpleSlots) AWCSlotText("Authored action") else AuthoredControl("Custom action") },
                                    "close" to { if(simpleSlots) AWCSlotText("Authored close") else AuthoredControl("Custom close") })) else AWCSlotRegistry(emptyMap())
                                AWCSlotsScope(slots) { AWCInspectionScope(collector) { AWCComponent("md-snackbar",props) } }
                            } } } } }
                        }
                    }
                }
            } } }
        } }
        val failures=mutableListOf<String>();var count=0
        fun near(id:String,key:String,want:Double,actual:Double) { if(!paint && abs(want-actual)>.76) failures+="$id $key Web=$want Android=$actual" }
        for(theme in listOf("light","dark")) {
            val data=document(theme,prefix ?: if(paint) "SnackbarDefaultWeb" else "SnackbarWeb").getJSONArray("results")
            for(index in 0 until data.length()) {
                val entry=data.getJSONObject(index);val fixture=entry.getJSONObject("fixture")
                
                val id="$theme/${fixture.getString("id")}"
                compose.runOnIdle {
                    props=mapOf("open" to true,"autoHide" to false)+listOf("message","action","closeable","stacked","position","politeness","dismissLabel","density","hidden","open")
                        .filter { fixture.has(it) }.associateWith { fixture.get(it) }
                    authored=fixture.optBoolean("slots");parts=fixture.optBoolean("parts");simpleSlots=fixture.optBoolean("simpleSlots")
                    val css=fixture.optString("partCSS")
                    val partName=css.substringAfter("::part(","").substringBefore(")")
                    val part=when(partName) { "surface"->AWCSnackbarPart.Surface;"message"->AWCSnackbarPart.Message;"actions"->AWCSnackbarPart.Actions;"close"->AWCSnackbarPart.Close;"close-icon"->AWCSnackbarPart.CloseIcon;else->null }
                    val decoration=if(css.contains("background-color")) AWCSnackbarPartAppearance(color="#22CC99",backgroundColor="#22446688",borderColor="#FFAA33",borderWidth=2.0,cornerShape=AWCCornerShape.uniform(9.0),paddingInlineStart=5.0,marginInlineStart=-3.0,fontWeight=700)
                        else if(css.contains("font-weight")) AWCSnackbarPartAppearance(fontWeight=700)
                        else AWCSnackbarPartAppearance(marginInlineStart=if(css.contains("-7px")) -7.0 else 7.0)
                    extraParts=if(part!=null) mapOf(part to decoration) else emptyMap()
                    a=appearance(fixture);dark=theme=="dark";width=fixture.optDouble("width",800.0)
                    inherited=fixture.optDouble("inheritedDensity",0.0);direction=if(fixture.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr;epoch++
                }
                compose.waitForIdle();count++
                val nodes=compose.runOnIdle { collector.snapshot().nodes }
                if(fixture.optBoolean("hidden") || fixture.has("open") && !fixture.getBoolean("open")) {
                    assertTrue("$id invisible tree absent",nodes.isEmpty());continue
                }
                val root=nodes.singleOrNull { it.id=="component" }
                assertNotNull("$id must have a real viewport root",root)
                val host=entry.getJSONObject("host").getJSONObject("rect")
                near(id,"root.width",host.getDouble("width"),root!!.bounds.width);near(id,"root.height",host.getDouble("height"),root.bounds.height)
                if(paint) {
                    val pixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                    fun rgb(css:String):List<Double> = Regex("[0-9.]+").findAll(css).map { it.value.toDouble() }.toList().let { values-> listOf(values[0]/255,values[1]/255,values[2]/255,values.getOrElse(3){1.0}) }
                    fun composite(top:List<Double>,bottom:List<Double>)=listOf(top[0]*top[3]+bottom[0]*(1-top[3]),top[1]*top[3]+bottom[1]*(1-top[3]),top[2]*top[3]+bottom[2]*(1-top[3]),1.0)
                    val sourceParts=entry.getJSONArray("parts")
                    val surfaceSource=(0 until sourceParts.length()).map { sourceParts.getJSONObject(it) }.single { it.getString("part")=="surface" }
                    val surfaceColor=composite(rgb(surfaceSource.getJSONObject("style").getString("backgroundColor")),listOf(1.0,1.0,1.0,1.0))
                    val b=nodes.single { it.id=="component.surface" }.bounds
                    val px=(b.x-parentX+5).toInt().coerceIn(0,pixels.width-1)
                    val py=(b.y-parentY+b.height/2).toInt().coerceIn(0,pixels.height-1)
                    val c=pixels[px,py]
                    if(listOf(abs(c.red-surfaceColor[0]),abs(c.green-surfaceColor[1]),abs(c.blue-surfaceColor[2])).max()>.025) failures+="$id actual surface paint $c differs from $surfaceColor"
                    fun sourceBackground(name:String,base:List<Double>):List<Double> {
                        val part=(0 until sourceParts.length()).map { sourceParts.getJSONObject(it) }.firstOrNull { it.getString("part")==name }
                        return part?.getJSONObject("style")?.optString("backgroundColor")?.takeIf { it.isNotBlank() }?.let { composite(rgb(it),base) } ?: base
                    }
                    fun glyph(name:String,css:String,background:List<Double> = sourceBackground(name,surfaceColor)) {
                        val node=nodes.singleOrNull { it.id=="component.$name" } ?: return
                        val expected=composite(rgb(css),background)
                        val area=node.bounds
                        var nearest=1.0
                        for(y in maxOf(0,(area.y-parentY).toInt()) until minOf(pixels.height,(area.y-parentY+area.height).toInt()))
                            for(x in maxOf(0,(area.x-parentX).toInt()) until minOf(pixels.width,(area.x-parentX+area.width).toInt())) {
                                val v=pixels[x,y]
                                nearest=minOf(nearest,maxOf(abs(v.red-expected[0]),abs(v.green-expected[1]),abs(v.blue-expected[2])))
                            }
                        if(nearest>.07) failures+="$id actual $name glyph color absent (nearest=$nearest, expected=$expected)"
                    }
                    val sourceMessage=(0 until sourceParts.length()).map { sourceParts.getJSONObject(it) }.single { it.getString("part")=="message" }
                    if(sourceMessage.optString("text").isNotEmpty()) glyph("message",sourceMessage.getJSONObject("style").getString("color"))
                    val nested=entry.getJSONArray("nested")
                    for(i in 0 until nested.length()) {
                        val child=nested.getJSONObject(i);val childParts=child.getJSONArray("parts")
                        val label=if(child.getString("tag")=="md-button") "label" else "icon"
                        val childStyle=(0 until childParts.length()).map { childParts.getJSONObject(it) }.single { it.getString("part")==label }.getJSONObject("style")
                        val childPaint=childStyle.optString("color")
                        if(childPaint.isBlank()) continue
                        val bg=sourceBackground(if(label=="label") "actions" else "close",surfaceColor)
                        val inner=childStyle.optString("backgroundColor").takeIf { it.isNotBlank() }?.let { composite(rgb(it),bg) } ?: bg
                        glyph(if(label=="label") "actions" else "close-icon",childPaint,inner)
                    }
                }
                if(prefix!=null && !authored) {
                    val nested=entry.getJSONArray("nested")
                    for(j in 0 until nested.length()) {
                        val n=nested.getJSONObject(j)
                        if(n.getString("tag")!="md-icon-button") continue
                        val pp=n.getJSONArray("parts")
                        val icon=(0 until pp.length()).map { pp.getJSONObject(it) }.single { it.getString("part")=="icon" }.getJSONObject("rect")
                        val b=nodes.single { it.id=="component.close-icon" }.bounds
                        near(id,"close-icon.x",icon.getDouble("x"),b.x-parentX);near(id,"close-icon.y",icon.getDouble("y"),b.y-parentY)
                        near(id,"close-icon.width",icon.getDouble("width"),b.width);near(id,"close-icon.height",icon.getDouble("height"),b.height)
                    }
                }
                val parts=entry.getJSONArray("parts")
                for(i in 0 until parts.length()) {
                    val part=parts.getJSONObject(i);val name=part.getString("part");val web=part.getJSONObject("rect")
                    val native=nodes.singleOrNull { it.id=="component.$name" }
                    if(native==null) { failures+="$id missing $name";continue }
                    near(id,"$name.x",web.getDouble("x"),native.bounds.x-parentX);near(id,"$name.y",web.getDouble("y"),native.bounds.y-parentY)
                    near(id,"$name.width",web.getDouble("width"),native.bounds.width);near(id,"$name.height",web.getDouble("height"),native.bounds.height)
                }
            }
        }
        assertEquals(expected,count)
        assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }
    @Composable private fun AuthoredControl(label:String) {
        AWCButtonAppearanceScope(AWCButtonAppearance(labelColor=LocalContentColor.current.let { "#%02X%02X%02X".format((it.red*255).toInt(),(it.green*255).toInt(),(it.blue*255).toInt()) },containerColor="#EFEFEF",height=28.0,minHeight=0.0,minWidth=0.0,paddingInline=10.0,paddingBlock=4.0,
            fontSize=12.0,lineHeight=16.0,fontWeight=500.0,letterSpacing=0.0,outlineWidth=2.0,cornerRadius=0.0)) {
            AWCComponent("md-button",mapOf("variant" to "outlined","label" to label))
        }
    }

}
