package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performSemanticsAction
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
 * md-radio paint and geometry against Chrome (radio/paint.html, DPR 1): the matrix (theme × direction × density ×
 * unchecked/checked × rest/disabled/soft-disabled), all 7 hooks and each hook alone, the parts, keyboard and method
 * focus and hidden: target, state layer, outer/inner circle boxes and colours, inner scale, focus ring, tab stop
 * and every flat pixel. The two reportValidity cases (inline support line) are not in this pass.
 */
class NativeRadioParityTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"snap\":{\"rect\":{\"x\":40,\"y\":40}}}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var inspection:AWCRadioInspection?=null
    private val selectionController=AWCSelectionControlController()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray();private val skipped=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private val parts=AWCRadioPartAppearance("#C2185B",.2,"#F57F17","#FFF59D","#1A237E")
    private fun props(c:JSONObject):Map<String,Any?> { val p=mutableMapOf<String,Any?>("checked" to c.optBoolean("checked"))
        if(c.has("density") && !c.isNull("density") && c.getDouble("density")!=0.0) p["density"]=c.getDouble("density")
        when(c.optString("state")) { "disabled"->p["disabled"]=true;"softDisabled"->p["softDisabled"]=true }
        if(c.optBoolean("hidden")) p["hidden"]=true
        if(c.optBoolean("required")) p["required"]=true
        return p }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val r=c.getJSONObject("snap").getJSONObject("rect")
        AWCTheme(c.optString("theme")=="dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(r.getDouble("x").dp,r.getDouble("y").dp)) {
                    AWCRadioGroupScope { AWCSelectionReducedMotionScope(true) { AWCRadioAppearanceScope(RadioWeb.hooks(c.optJSONObject("hooks"))) {
                        AWCRadioPartAppearanceScope(if(c.has("parts") && !c.isNull("parts")) parts else AWCRadioPartAppearance()) {
                            AWCRadioInspectionScope({ inspection=it }) { AWCInspectionScope(collector) { AWCSelectionControlControllerScope(selectionController) { AWCComponent("md-radio",props(c)) } } }
                        }
                    } } }
                }
            }
        } } }
    } } }
    @Test fun radioMatchesChromePaintAndGeometry() {
        content()
        for(c in CardWeb.document("RadioWebPaint.json").getJSONArray("cases").objects()) run(c)
        AccordionEvidence.log("radio-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("skipped",skipped).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        android.util.Log.i("AWCAccordion","radio-paint case $name")
        inspection=null;collector.clear();case=c;epoch++;compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        val focus=c.has("focus") && !c.isNull("focus") && c.get("focus")!=false
        if(focus) { compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.Role,Role.RadioButton)).performSemanticsAction(SemanticsActions.RequestFocus);compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle() }
        if(c.optBoolean("report")) {
            val custom=c.optString("custom")
            compose.runOnIdle {
                if(custom.isNotEmpty()) selectionController.setCustomValidity(custom)
                check(selectionController.isConnected,"$name controller attached")
                check(!selectionController.reportValidity(),"$name reportValidity() is false")
                check(selectionController.getValidity().validationMessage==c.getJSONObject("snap").getJSONObject("support").getString("text"),"$name validationMessage ${selectionController.getValidity().validationMessage}")
            }
            compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        }
        val node=collector.snapshot().nodes.firstOrNull { it.name=="md-radio" }
        if(c.optBoolean("hidden")) { check(node==null,"$name hidden radio renders nothing");return }
        val s=c.getJSONObject("snap");val b=node?.bounds;val v=inspection?.values
        if(b==null || v==null) { check(false,"$name measured");return }
        fun near(a:Double,w:Double,label:String,tol:Double=.6)=check(abs(a-w)<=tol,"$name $label $a vs $w")
        fun d(k:String)=(v[k] as Number).toDouble()
        val r=s.getJSONObject("rect")
        near(b.x,r.getDouble("x"),"host x");near(b.y,r.getDouble("y"),"host y");near(b.width,r.getDouble("width"),"host width");near(b.height,r.getDouble("height"),"host height",1.0)
        val touch=d("touch");near(touch,s.getJSONObject("target").getDouble("width"),"target size")
        val layer=s.getJSONObject("stateLayer");val shown=layer.getString("display")!="none";val sl=d("stateLayerSize")
        check(shown==(d("layerOpacity")>=0),"$name state layer presence")
        if(shown) { near(b.x+(touch-sl)/2,layer.getJSONObject("rect").getDouble("x"),"state layer x");near(sl,layer.getJSONObject("rect").getDouble("width"),"state layer size")
            check(abs(d("layerOpacity")-layer.getDouble("opacity"))<.004,"$name state layer opacity ${v["layerOpacity"]} vs ${layer.getDouble("opacity")}")
            check(SwitchWeb.close(v["layerColor"],layer.getString("bg")),"$name state layer colour ${v["layerColor"]} vs ${layer.getString("bg")}") }
        val outer=s.getJSONObject("outer");val or=outer.getJSONObject("rect")
        near(b.x+d("containerX"),or.getDouble("x"),"container x");near(b.y+d("containerX"),or.getDouble("y"),"container y");near(d("iconSize"),or.getDouble("width"),"icon size")
        near(2.0,SwitchWeb.px(outer.getString("borderWidth")),"outer border width")
        check(SwitchWeb.close(v["outerColor"],outer.getString("border")),"$name outer colour ${v["outerColor"]} vs ${outer.getString("border")}")
        check(SwitchWeb.close(v["outerFill"],outer.getString("bg")),"$name outer fill ${v["outerFill"]} vs ${outer.getString("bg")}")
        val inner=s.getJSONObject("inner");val webScale=RadioWeb.scale(inner.getString("transform"))
        check(abs(d("innerScale")-webScale)<.001,"$name inner scale ${v["innerScale"]} vs $webScale")
        if(webScale>0) { near(d("innerSize")*webScale,inner.getJSONObject("rect").getDouble("width"),"inner size")
            check(SwitchWeb.close(v["innerColor"],inner.getString("bg")),"$name inner colour ${v["innerColor"]} vs ${inner.getString("bg")}") }
        val solid=s.getJSONObject("ring").getString("outline").startsWith("solid")
        check((v["focusRing"]==true)==solid,"$name focus ring ${v["focusRing"]}")
        check(v["tabindex"]==s.getString("tabindex").toInt(),"$name tabindex ${v["tabindex"]} vs ${s.getString("tabindex")}")
        val support=s.optJSONObject("support")
        if(support==null || support.optString("text").isEmpty()) check(v["support"]=="","$name no supporting line") else {
            check(v["support"]==support.getString("text"),"$name support text ${v["support"]}")
            check(SwitchWeb.close(v["supportColor"],support.getString("color")),"$name support colour ${v["supportColor"]}")
            val box=v["supportBox"] as androidx.compose.ui.geometry.Rect;val sr=support.getJSONObject("rect")
            near(box.top.toDouble(),sr.getDouble("y"),"support y",1.0)
            if(c.optString("dir")!="rtl") near(box.left.toDouble(),sr.getDouble("x"),"support x",1.0) else near(box.right.toDouble(),sr.getDouble("x")+sr.getDouble("width"),"support inline start (right)",1.5)
        }
        val clip=JSONObject(c.getJSONObject("clip").toString()).let { k-> val x=k.getInt("x");if(x<0) k.put("x",0).put("width",k.getInt("width")+x) else k }
        val nat=CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        val res=CardWeb.compare(CardWeb.webGrid("RadioWebPaint/$name.png",clip),nat)
        check(res.getInt("compared")>800 && res.getInt("over6").toDouble()/res.getInt("compared")<=.005 && res.getDouble("mean")<=1.0,"$name flat pixels $res");report.put(res.put("case",name))
    }
}
