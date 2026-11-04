package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.*
import androidx.test.platform.app.InstrumentationRegistry
import dev.awc.nativeui.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

class NativeTooltipParityTest {
    @get:Rule val compose=createComposeRule()
    private fun document(theme:String,supplement:Boolean=false)=InstrumentationRegistry.getInstrumentation().context.assets.open("Tooltip${if(supplement) "Supplemental" else "DefaultWeb"}-$theme.json").bufferedReader().use { JSONObject(it.readText()) }
    private fun appearance(f:JSONObject):AWCTooltipAppearance {
        val s=f.optJSONObject("style") ?: return AWCTooltipAppearance()
        fun c(name:String)=s.optString(name).takeIf(String::isNotEmpty)
        fun length(name:String)=c(name)?.let(AWCTooltipLength::parse)
        fun corner(x:Double,y:Double)=AWCCornerRadius(AWCCornerLength(x),AWCCornerLength(y))
        val shape=AWCCornerShape(corner(20.0,8.0),corner(4.0,12.0),corner(20.0,8.0),corner(4.0,12.0))
        return AWCTooltipAppearance(c("plain-container-color"),c("plain-text-color"),c("rich-container-color"),c("rich-subhead-color"),c("rich-text-color"),c("rich-action-color"),
            if(s.has("container-shape")) shape else null,length("plain-max-inline-size"),if(s.has("rich-container-shape")) shape else null,length("rich-min-inline-size"),length("rich-max-inline-size"))
    }
    @Test fun all204NativeLayoutsMatchDefaultPaletteWebReference()=runMatrix(false)
    @Test fun all204NativeDefaultPaintAndAuthoredColorsMatchWebReference()=runMatrix(true)
    @Test fun supplemental104PublicPartLayoutsMatchWebReference()=runMatrix(false,true)
    @Test fun supplemental104PublicPartPaintMatchesWebReference()=runMatrix(true,true)
    private fun runMatrix(paint:Boolean,supplement:Boolean=false) {
        val scale=if(paint) 1f else 2f
        var props by mutableStateOf<Map<String,AWCValue>>(emptyMap());var a by mutableStateOf(AWCTooltipAppearance())
        var width by mutableDoubleStateOf(600.0);var x by mutableDoubleStateOf(260.0);var y by mutableDoubleStateOf(180.0)
        var translation by mutableStateOf(false);var parentBorder by mutableIntStateOf(0)
        var dark by mutableStateOf(false);var inherited by mutableDoubleStateOf(0.0)
        var direction by mutableStateOf(LayoutDirection.Ltr);var authored by mutableStateOf(false);var actions by mutableStateOf(false);var parts by mutableStateOf(false)
        var rawActions by mutableStateOf(false);var partOverrides by mutableStateOf<Map<AWCTooltipPart,AWCTooltipPartAppearance>>(emptyMap())
        var epoch by mutableIntStateOf(0);val collector=AWCInspectionCollector();var parentX=0.0;var parentY=0.0
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(scale,1f),LocalLayoutDirection provides direction) {
            AWCTheme(dark) { AWCDensityScope(inherited) { AWCAccessibilityAppearanceScope(reducedMotion=true) { AWCTooltipAppearanceScope(a) {
                AWCTooltipScope(Modifier.requiredSize(width.dp,400.dp).background(Color.White).testTag("canvas").onGloballyPositioned {
                    parentX=it.positionInRoot().x/scale.toDouble();parentY=it.positionInRoot().y/scale.toDouble()
                }) {
                    Box(Modifier.fillMaxSize(),contentAlignment=AbsoluteAlignment.TopLeft) {
                    Box(Modifier.absoluteOffset(x.dp,y.dp).graphicsLayer { if(translation) { translationX=27*scale;translationY=19*scale } }.padding(parentBorder.dp)) {
                        key(epoch) { TooltipPublicParts(partOverrides) {
                            AWCTooltipPartAppearanceScope(if(parts) AWCTooltipPartAppearance(borderColor="#FFAA33",borderWidth=2.0,cornerShape=AWCCornerShape.uniform(12.0)) else AWCTooltipPartAppearance()) {
                            AWCTooltipPartAppearanceScope(if(parts) AWCTooltipPartAppearance(fontWeight=700) else AWCTooltipPartAppearance(),AWCTooltipPart.Subhead) {
                            AWCTooltipPartAppearanceScope(if(parts) AWCTooltipPartAppearance(letterSpacing=.75) else AWCTooltipPartAppearance(),AWCTooltipPart.SupportingText) {
                            AWCTooltipPartAppearanceScope(if(parts) AWCTooltipPartAppearance(paddingInlineStart=13.0) else AWCTooltipPartAppearance(),AWCTooltipPart.Actions) {
                                val entries=mutableMapOf<String,@Composable ()->Unit>("" to { AuthoredControl("Anchor",true) })
                                if(authored) { entries["subhead"]={AWCSlotText("Authored heading")};entries["content"]={AWCSlotText("Authored supporting text")} }
                                if(rawActions) entries["actions"]={AWCSlotText("Details");AWCSlotText("Dismiss")}
                                else if(authored || actions) entries["actions"]={AuthoredControl("Details");AuthoredControl("Dismiss")}
                                AWCSlotsScope(AWCSlotRegistry(entries)) { AWCInspectionScope(collector) { AWCComponent("md-tooltip",props) } }
                            } } } }
                        } }
                    }
                    }
                }
            } } } }
        } }
        val failures=mutableListOf<String>();var count=0
        val selected=InstrumentationRegistry.getArguments().getString("tooltipCase")
        fun near(id:String,key:String,want:Double,got:Double) { if(!paint && abs(want-got)>.76) failures+="$id $key Web=$want Android=$got" }
        for(theme in listOf("light","dark")) {
            val data=document(theme,supplement).getJSONArray("results")
            for(i in 0 until data.length()) {
                val record=data.getJSONObject(i);val f=record.getJSONObject("fixture");val id="$theme/${f.getString("id")}"
                if(selected!=null && f.getString("id")!=selected) continue
                android.util.Log.i("TooltipMatrix",id)
                compose.runOnIdle {
                    props=mapOf("open" to true)+listOf("text","subhead","variant","position","autoPosition","offset","crossOffset","density","disabled","hidden","open")
                        .filter { f.has(it) }.associateWith { f.get(it) }+if(f.has("localDir")) mapOf("dir" to f.getString("localDir")) else emptyMap()
                    a=appearance(f);width=f.optDouble("width",600.0);x=f.optJSONObject("anchor")?.optDouble("x",260.0) ?: 260.0;y=f.optJSONObject("anchor")?.optDouble("y",180.0) ?: 180.0
                    translation=f.has("transform");parentBorder=f.optInt("parentBorder");dark=theme=="dark";inherited=f.optDouble("inheritedDensity",0.0)
                    direction=if(f.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr;authored=f.optBoolean("slots");actions=f.optBoolean("actions");parts=f.optBoolean("parts");rawActions=f.optBoolean("rawActions");partOverrides=publicParts(f);epoch++
                }
                compose.waitForIdle();count++
                val nodes=compose.runOnIdle { collector.snapshot().nodes }
                if(f.optBoolean("hidden")) { assertTrue("$id hidden tree",nodes.isEmpty());continue }
                val root=nodes.singleOrNull { it.id=="component" };assertNotNull("$id real anchor root",root)
                near(id,"host.x",record.getJSONObject("host").getJSONObject("rect").getDouble("x"),root!!.bounds.x-parentX)
                near(id,"host.y",record.getJSONObject("host").getJSONObject("rect").getDouble("y"),root.bounds.y-parentY)
                near(id,"host.width",80.0,root.bounds.width);near(id,"host.height",32.0,root.bounds.height)
                if(f.optBoolean("disabled") || f.has("open") && !f.getBoolean("open")) { assertNull("$id no visible popup",nodes.singleOrNull { it.id=="component.popup" });continue }
                val webParts=record.getJSONArray("parts")
                for(index in 0 until webParts.length()) {
                    val web=webParts.getJSONObject(index);val name=web.getString("part");val style=web.getJSONObject("style");val box=web.getJSONObject("rect")
                    if(style.getString("display")=="none" || box.getDouble("width")==0.0 || box.getDouble("height")==0.0) continue
                    val native=nodes.singleOrNull { it.id=="component.$name" }
                    if(native==null) { failures+="$id missing $name";continue }
                    near(id,"$name.x",box.getDouble("x"),native.bounds.x-parentX);near(id,"$name.y",box.getDouble("y"),native.bounds.y-parentY)
                    near(id,"$name.width",box.getDouble("width"),native.bounds.width);near(id,"$name.height",box.getDouble("height"),native.bounds.height)
                    if(supplement && !paint) {
                        for((metric,insets) in listOf("padding" to native.metrics?.padding,"margin" to native.metrics?.margin,"border" to native.metrics?.border)) {
                            if(insets==null) failures+="$id $name missing inspector $metric" else {
                                for((edge,value) in listOf("Top" to insets.top,"Right" to insets.right,"Bottom" to insets.bottom,"Left" to insets.left)) {
                                    val property=if(metric=="border") "borderWidth" else metric+edge
                                    near(id,"$name.$metric$edge",style.getString(property).removeSuffix("px").toDouble(),value)
                                }
                            }
                        }
                    }
                    native.metrics?.typography?.let { t->
                        near(id,"$name.fontSize",style.getString("fontSize").removeSuffix("px").toDouble(),t.size)
                        near(id,"$name.lineHeight",style.getString("lineHeight").removeSuffix("px").toDouble(),t.lineHeight)
                        near(id,"$name.weight",style.getString("fontWeight").toDouble(),t.weight.toDouble())
                    }
                }
                if(paint) {
                    val pixels=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                    val popup=nodes.single { it.id=="component.popup" }.bounds
                    val source=webParts.getJSONObject(0).getJSONObject("style")
                    fun rgba(s:String)=Regex("[0-9.]+").findAll(s).map { it.value.toDouble() }.toList().let { listOf(it[0]/255,it[1]/255,it[2]/255,it.getOrElse(3){1.0}) }
                    val bg=rgba(source.getString("backgroundColor"));val expected=listOf(bg[0]*bg[3]+1-bg[3],bg[1]*bg[3]+1-bg[3],bg[2]*bg[3]+1-bg[3])
                    for(index in 1 until webParts.length()) {
                        val part=webParts.getJSONObject(index)
                        val actionText=part.getString("part")=="actions" && f.optBoolean("rawActions")
                        if(part.optString("text").isBlank() && !actionText) continue
                        val native=nodes.singleOrNull { it.id=="component.${part.getString("part")}" } ?: continue
                        val rect=native.bounds
                        val actionSlot=if(actionText) record.getJSONArray("slots").let { slots-> (0 until slots.length()).map{slots.getJSONObject(it)}.first{it.optString("slot")=="actions"} } else null
                        val ink=rgba((actionSlot ?: part).getJSONObject("style").getString("color"))
                        val partBg=rgba(part.getJSONObject("style").getString("backgroundColor"));val surface=(0..2).map { partBg[it]*partBg[3]+expected[it]*(1-partBg[3]) }
                        val expectedInk=(0..2).map { ink[it]*ink[3]+surface[it]*(1-ink[3]) }
                        val left=(rect.x-parentX).toInt().coerceAtLeast(0);val right=kotlin.math.ceil(rect.x-parentX+rect.width).toInt().coerceAtMost(pixels.width)
                        val top=(rect.y-parentY).toInt().coerceAtLeast(0);val bottom=kotlin.math.ceil(rect.y-parentY+rect.height).toInt().coerceAtMost(pixels.height)
                        // Off-viewport content is legitimately clipped by the native window.
                        if(left>=right || top>=bottom) continue
                        var nearest=Double.POSITIVE_INFINITY
                        for(py in top until bottom) for(px in left until right) {
                            val c=pixels[px,py]
                            nearest=minOf(nearest,maxOf(abs(c.red-expectedInk[0]),abs(c.green-expectedInk[1]),abs(c.blue-expectedInk[2])))
                        }
                        if(nearest>.08) failures+="$id ${part.getString("part")} actual glyph color distance=$nearest expected=$expectedInk"
                    }
                    val px=(popup.x-parentX+popup.width/2).toInt();val py=(popup.y-parentY+source.getString("borderWidth").removeSuffix("px").toDouble()+2).toInt()
                    if(px in 0 until pixels.width && py in 0 until pixels.height && !parts) {
                        val c=pixels[px,py]
                        if(maxOf(abs(c.red-expected[0]),abs(c.green-expected[1]),abs(c.blue-expected[2]))>.03) failures+="$id surface $c expected=$expected"
                    }
                }
            }
        }
        assertEquals(if(selected==null) {if(supplement) 104 else 204} else 2,count);assertTrue(failures.joinToString("\n"),failures.isEmpty())
    }
    private fun publicParts(f:JSONObject):Map<AWCTooltipPart,AWCTooltipPartAppearance> {
        val source=f.optJSONObject("partStyles") ?: return emptyMap()
        val names=mapOf("popup" to AWCTooltipPart.Popup,"text" to AWCTooltipPart.Text,"subhead" to AWCTooltipPart.Subhead,"supporting-text" to AWCTooltipPart.SupportingText,"actions" to AWCTooltipPart.Actions)
        return source.keys().asSequence().associate { key->
            val s=source.getJSONObject(key)
            fun text(name:String)=s.optString(name).takeIf(String::isNotEmpty)
            fun number(name:String)=text(name)?.removeSuffix("px")?.toDouble()
            names.getValue(key) to AWCTooltipPartAppearance(color=text("color"),backgroundColor=text("background-color"),borderColor=if(s.has("border")) "#FFAA33" else null,
                borderWidth=if(s.has("border")) 2.0 else null,cornerShape=number("border-radius")?.let(AWCCornerShape::uniform),fontWeight=number("font-weight")?.toInt(),paddingInlineStart=number("padding-inline-start"),marginInlineStart=number("margin-inline-start"),letterSpacing=number("letter-spacing"),fontSize=number("font-size"),lineHeight=number("line-height"))
        }
    }
    @Composable private fun TooltipPublicParts(values:Map<AWCTooltipPart,AWCTooltipPartAppearance>,index:Int=0,content:@Composable ()->Unit) {
        val parts=AWCTooltipPart.entries
        if(index==parts.size) content() else AWCTooltipPartAppearanceScope(values[parts[index]] ?: AWCTooltipPartAppearance(),parts[index]) { TooltipPublicParts(values,index+1,content) }
    }
    @Composable private fun AuthoredControl(label:String,anchor:Boolean=false) {
        val color=if(anchor) "#000000" else LocalContentColor.current.let { "#%02X%02X%02X%02X".format((it.red*255).toInt(),(it.green*255).toInt(),(it.blue*255).toInt(),(it.alpha*255).toInt()) }
        AWCButtonAppearanceScope(AWCButtonAppearance(labelColor=color,containerColor="#00000000",height=if(anchor) 32.0 else 26.0,width=if(anchor) 80.0 else null,minHeight=0.0,minWidth=0.0,
            paddingInline=9.0,paddingBlock=4.0,fontSize=12.0,lineHeight=16.0,fontWeight=500.0,letterSpacing=0.0,outlineWidth=1.0,outlineColor="#888888",cornerRadius=4.0)) {
            AWCComponent("md-button",mapOf("variant" to "outlined","label" to label))
        }
    }
}
