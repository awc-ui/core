package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * md-card paint and geometry against Chrome (web-oracle/paint.html, DPR 1): 360 matrix cases,
 * all fourteen hooks × variant × theme × direction × state, each hook alone, both parts and 25
 * layout/composition cases: box, padding/gap/typography, colours, shadow list, outline, state
 * layer, role/tab stop, authored children and every flat pixel of the source clip.
 */
class NativeCardParityTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"snap\":{\"children\":[]}}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var inspection:AWCCardInspection?=null
    private val children=mutableMapOf<Int,Rect>()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun opt(c:JSONObject,k:String)=if(c.has(k) && !c.isNull(k)) c.get(k) else null
    @Composable private fun Box(i:Int,h:Double,content:@Composable ()->Unit) =
        androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().height(h.dp).onGloballyPositioned { val o=it.positionInRoot();children[i]=Rect(o.x/2,o.y/2,(o.x+it.size.width)/2,(o.y+it.size.height)/2) }) { content() }
    @Composable private fun Content(kind:String,h:List<Double>) { when(kind) {
        "empty"->{}
        "button"->Box(0,h[0]) { Button(onClick={},Modifier.awcCardInteractiveContent()) { Text("Authored action") } }
        "focusable"->Box(0,h[0]) { Text("Custom control",Modifier.awcCardInteractiveContent()) }
        "authored"->{ Box(0,h[0]) { Text("Title") };Box(1,h[1]) { Text("An authored paragraph that wraps when the available width changes.") };Box(2,h[2]) { Button(onClick={},Modifier.awcCardInteractiveContent()) { Text("Continue") } } }
        "overflow"->Box(0,300.0) { Text("Tall body") }
        "wrap"->Box(0,h[0]) { Text("A longer supporting paragraph that has to wrap across several lines inside a narrow card.") }
        "media"->{ androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().layout { m,c-> val p=m.measure(c.copy(minWidth=c.maxWidth+64,maxWidth=c.maxWidth+64,minHeight=192,maxHeight=192))
                layout(c.maxWidth,160) { p.place(-32,-32) } }.onGloballyPositioned { val o=it.positionInRoot();children[0]=Rect(o.x/2,o.y/2,(o.x+it.size.width)/2,(o.y+it.size.height)/2) }.background(Color(0xFF7E57C2)))
            Box(1,h[1]) { Text("Media title") };Box(2,h[2]) { Text("Supporting text below the media block.") }
            Box(3,h[3]) { Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.End) { Button(onClick={},Modifier.awcCardInteractiveContent()) { Text("Open") } } } }
        else->{ Box(0,20.0) { Text("Card title") };Box(1,40.0) { Text("Two lines of body content") };Box(2,30.0) { Text("Footer") } }
    } }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val dark=opt(c,"theme")=="dark"
        AWCTheme(dark) { androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            val props=mutableMapOf<String,Any?>("variant" to (opt(c,"variant") ?: "elevated"))
            for(k in listOf("interactive","disabled","softDisabled","dragEnabled","ripple","fullWidth","fullHeight","hidden")) opt(c,k)?.let { props[k]=it }
            opt(c,"density")?.let { props["density"]=(it as Number).toDouble() }
            val kind=(opt(c,"content") as? String) ?: "default"
            val heights=c.getJSONObject("snap").getJSONArray("children").objects().map { it.getJSONObject("rect").getDouble("height") }
            CompositionLocalProvider(LocalLayoutDirection provides if(opt(c,"dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                androidx.compose.foundation.layout.Box(Modifier.absoluteOffset(40.dp,40.dp).size(320.dp,240.dp)) {
                    AWCDensityScope((opt(c,"inheritedDensity") as? Number)?.toDouble() ?: 0.0) {
                        AWCCardAppearanceScope(CardWeb.appearance(c.optJSONObject("hooks"))) {
                            AWCCardPartAppearanceScope(if(opt(c,"parts")!=null) AWCCardPartAppearance("#EE9955","#44AA88",4.0) else AWCCardPartAppearance()) {
                                AWCCardInspectionScope({ inspection=it }) { AWCInspectionScope(collector) {
                                    AWCComponent("md-card",props) { slot-> if(slot=="") Content(kind,heights) }
                                } }
                            }
                        }
                    }
                }
            }
        } } }
    } } }
    @Test fun cardMatchesChromePaintAndGeometry() {
        content()
        val oracle=CardWeb.document("CardWebPaint.json")
        for(c in oracle.getJSONArray("cases").objects()) run(c)
        AccordionEvidence.log("card-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    private fun px(s:String)=s.removeSuffix("px").toDoubleOrNull() ?: Double.NaN
    private fun near(r:Rect?,w:JSONObject,tol:Double=.6)=r!=null && abs(r.left-w.getDouble("x"))<=tol && abs(r.top-w.getDouble("y"))<=tol && abs(r.width-w.getDouble("width"))<=tol && abs(r.height-w.getDouble("height"))<=tol
    private fun run(c:JSONObject) {
        val name=c.getString("name");val s=c.getJSONObject("snap");val style=s.getJSONObject("style")
        children.clear();inspection=null;collector.clear();case=c;epoch++;compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        val node=collector.snapshot().nodes.firstOrNull { it.name=="md-card" }
        if(opt(c,"hidden")==true) { check(node==null,"$name hidden card renders nothing");return }
        val b=node?.bounds;val rect=b?.let { Rect(it.x.toFloat(),it.y.toFloat(),(it.x+it.width).toFloat(),(it.y+it.height).toFloat()) }
        check(near(rect,s.getJSONObject("rect")),"$name rect $rect vs ${s.getJSONObject("rect")}")
        val ins=inspection;if(ins==null) { check(false,"$name inspection");return }
        val v=ins.values;val t=ins.frameMillis
        @Suppress("UNCHECKED_CAST") val pad=v["padding"] as List<Double>
        check(pad==listOf(px(style.getString("paddingTop")),px(style.getString("paddingRight")),px(style.getString("paddingBottom")),px(style.getString("paddingLeft"))),"$name padding $pad")
        check(v["gap"]==px(style.getString("rowGap")),"$name gap ${v["gap"]} vs ${style.getString("rowGap")}")
        check(v["fontSize"]==px(style.getString("fontSize")) && v["lineHeight"]==px(style.getString("lineHeight")),"$name typography ${v["fontSize"]}/${v["lineHeight"]}")
        fun close(a:List<Double>,b:List<Double>,tol:Double)=a.size==b.size && a.indices.all { abs(a[it]-b[it])<tol }
        check(close(CardWeb.pre(ins.background(t)),CardWeb.pre(CardWeb.color(style.getString("backgroundColor"))),.006),"$name container ${ins.background(t)} vs ${style.getString("backgroundColor")}")
        val ink=v["contentColor"] as Color
        check(close(CardWeb.pre(listOf(ink.red.toDouble(),ink.green.toDouble(),ink.blue.toDouble(),ink.alpha.toDouble())),CardWeb.pre(CardWeb.color(style.getString("color"))),.006),"$name content colour $ink vs ${style.getString("color")}")
        check(close(CardWeb.nativeShadow(ins.shadow(t)),CardWeb.shadow(style.getString("boxShadow")),.006),"$name shadow ${ins.shadow(t)} vs ${style.getString("boxShadow")}")
        val outline=s.optJSONObject("outline")
        if(outline!=null) { val oc=v["outlineColor"] as Color
            check(v["outlineWidth"]==px(outline.getString("borderTopWidth")) && close(CardWeb.pre(listOf(oc.red.toDouble(),oc.green.toDouble(),oc.blue.toDouble(),oc.alpha.toDouble())),CardWeb.pre(CardWeb.color(outline.getString("borderTopColor"))),.006),
                "$name outline ${v["outlineWidth"]} $oc vs ${outline.getString("borderTopWidth")} ${outline.getString("borderTopColor")}") }
        else check(v["outlineWidth"]==0.0,"$name no outline part")
        val layer=s.optJSONObject("stateLayer")
        if(layer!=null && layer.getString("display")!="none") check(v["layerVisible"]==true && abs(ins.layerOpacity(t)-layer.getString("opacity").toDouble())<.001,"$name state layer ${ins.layerOpacity(t)}")
        else check(v["layerVisible"]!=true,"$name no rendered state layer")
        val attrs=s.getJSONObject("attrs");val role=if(attrs.isNull("role")) "" else attrs.getString("role");val tab=if(attrs.isNull("tabindex")) -2 else attrs.getString("tabindex").toInt()
        check(v["role"]==role && v["tabindex"]==tab,"$name role/tabindex ${v["role"]}/${v["tabindex"]} vs $role/$tab")
        check(v["focusRing"]==false,"$name no focus ring at rest")
        val webChildren=s.getJSONArray("children").objects().map { it.getJSONObject("rect") }
        webChildren.forEachIndexed { i,w-> check(near(children[i],w),"$name child $i ${children[i]} vs $w") }
        val clip=c.getJSONObject("clip")
        val nat=CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        val web=CardWeb.webGrid("CardWebPaint/$name.png",clip)
        val masked=c.optBoolean("authoredControls") || c.optString("content")=="wrap"
        val mask=if(masked) webChildren.map { Rect(it.getDouble("x").toFloat(),it.getDouble("y").toFloat(),(it.getDouble("x")+it.getDouble("width")).toFloat(),(it.getDouble("y")+it.getDouble("height")).toFloat()) }+children.values else emptyList()
        val r=CardWeb.compare(web,nat,mask)
        check(CardWeb.ok(r),"$name flat pixels $r");report.put(r.put("case",name))
    }
}
