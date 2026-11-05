package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
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
 * md-checkbox paint and geometry against Chrome (checkbox/paint.html, DPR 1): the 180-case matrix (theme × direction ×
 * density × unchecked/checked/indeterminate × rest/disabled/soft-disabled), error and error text, supporting text,
 * all 14 hooks, each hook alone, the five parts, keyboard focus, decorative and hidden: target, state layer and
 * container boxes and colours, the glyph, the supporting line, focus ring, tab stop and every flat pixel.
 */
class NativeCheckboxParityTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"snap\":{\"rect\":{\"x\":40,\"y\":40}}}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var inspection:AWCCheckboxInspection?=null
    private val selectionController=AWCSelectionControlController()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray();private val skipped=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private val parts=AWCCheckboxPartAppearance("#FFF8E1","#C2185B",.2,"#FFF59D","#F57F17",AWCCornerShape.uniform(5.0),"#1A237E","#4A148C")
    private fun hooks(h:JSONObject?):AWCCheckboxAppearance { if(h==null) return AWCCheckboxAppearance()
        fun n(k:String)=if(h.has(k)) SwitchWeb.px(h.getString(k)) else null
        fun c(k:String)=if(h.has(k)) h.getString(k) else null
        return AWCCheckboxAppearance(c("container-color"),n("container-shape")?.let { AWCCornerShape.uniform(it) },n("container-size"),c("selected-container-color"),c("outline-color"),
            n("outline-width"),c("icon-color"),n("icon-size"),c("state-layer-color"),c("selected-state-layer-color"),n("state-layer-size"),n("touch-target-size"),c("supporting-text-color"),c("error-text-color")) }
    private fun props(c:JSONObject):Map<String,Any?> { val p=mutableMapOf<String,Any?>("checked" to (c.optString("value")=="checked"),"indeterminate" to (c.optString("value")=="indeterminate"))
        if(c.has("density") && !c.isNull("density") && c.getDouble("density")!=0.0) p["density"]=c.getDouble("density")
        when(c.optString("state")) { "disabled"->p["disabled"]=true;"softDisabled"->p["softDisabled"]=true }
        if(c.optBoolean("error")) p["error"]=true
        for(k in listOf("errorText","supportingText")) c.optString(k).takeIf { it.isNotEmpty() }?.let { p[k]=it }
        if(c.optBoolean("required")) p["required"]=true
        if(c.optBoolean("decorative")) p["ariaHidden"]="true";if(c.optBoolean("hidden")) p["hidden"]=true
        return p }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val r=c.getJSONObject("snap").getJSONObject("rect")
        AWCTheme(c.optString("theme")=="dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                if(c.optBoolean("focus")) Box(Modifier.absoluteOffset(40.dp,48.dp).size(60.dp,32.dp).focusable())
                Box(Modifier.absoluteOffset(r.getDouble("x").dp,r.getDouble("y").dp)) {
                    AWCSelectionReducedMotionScope(true) { AWCCheckboxAppearanceScope(hooks(c.optJSONObject("hooks"))) {
                        AWCCheckboxPartAppearanceScope(if(c.has("parts") && !c.isNull("parts")) parts else AWCCheckboxPartAppearance()) {
                            AWCCheckboxInspectionScope({ inspection=it }) { AWCInspectionScope(collector) { AWCSelectionControlControllerScope(selectionController) { AWCComponent("md-checkbox",props(c)) } } }
                        }
                    } }
                }
            }
        } } }
    } } }
    @Test fun checkboxMatchesChromePaintAndGeometry() {
        content()
        for(c in CardWeb.document("CheckboxWebPaint.json").getJSONArray("cases").objects()) run(c)
        AccordionEvidence.log("checkbox-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("skipped",skipped).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        android.util.Log.i("AWCAccordion","checkbox-paint case $name")
        inspection=null;collector.clear();case=c;epoch++;compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        if(c.optBoolean("focus")) { compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.Role,Role.Checkbox)).performSemanticsAction(SemanticsActions.RequestFocus);compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle() }
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
        val node=collector.snapshot().nodes.firstOrNull { it.name=="md-checkbox" }
        if(c.optBoolean("hidden")) { check(node==null,"$name hidden checkbox renders nothing");return }
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
        val box=s.getJSONObject("container");val br=box.getJSONObject("rect")
        near(b.x+d("containerX"),br.getDouble("x"),"container x");near(b.y+d("containerX"),br.getDouble("y"),"container y");near(d("containerSize"),br.getDouble("width"),"container size")
        near(d("outlineWidth"),SwitchWeb.px(box.getString("borderWidth")),"outline width")
        check(SwitchWeb.close(v["containerColor"],box.getString("bg")),"$name container colour ${v["containerColor"]} vs ${box.getString("bg")}")
        check(SwitchWeb.close(v["outlineColor"],box.getString("border")),"$name outline colour ${v["outlineColor"]} vs ${box.getString("border")}")
        val icon=s.getJSONObject("icon")
        check(v["glyph"]==icon.getString("text"),"$name glyph ${v["glyph"]} vs ${icon.getString("text")}")
        check(d("iconOpacity")==icon.getString("opacity").toDouble(),"$name icon opacity ${v["iconOpacity"]} vs ${icon.getString("opacity")}")
        near(d("iconSize"),SwitchWeb.px(icon.getString("fontSize")),"icon size")
        if(icon.getString("opacity")!="0") check(SwitchWeb.close(v["iconColor"],icon.getString("color")),"$name icon colour ${v["iconColor"]} vs ${icon.getString("color")}")
        val support=s.optJSONObject("support")
        if(support==null) check(v["support"]=="","$name no supporting line") else {
            check(v["support"]==support.getString("text"),"$name support text ${v["support"]}")
            check(SwitchWeb.close(v["supportColor"],support.getString("color")),"$name support colour ${v["supportColor"]} vs ${support.getString("color")}")
            val sb=v["supportBox"] as Rect;val wr=support.getJSONObject("rect")
            near(sb.top.toDouble(),wr.getDouble("y"),"support y",1.0)
            if(c.optString("dir")!="rtl") near(sb.left.toDouble(),wr.getDouble("x"),"support x",1.0) else near(sb.right.toDouble(),wr.getDouble("x")+wr.getDouble("width"),"support inline start (right)",1.0) }
        val solid=s.getString("outline").startsWith("solid")
        check((v["focusRing"]==true)==solid,"$name focus ring ${v["focusRing"]}")
        if(solid) near(d("ringOffset"),SwitchWeb.px(s.getString("outlineOffset")),"ring offset")
        val tab=if(s.isNull("tabindex")) -2 else s.getString("tabindex").toInt()
        check(v["tabindex"]==tab,"$name tabindex ${v["tabindex"]} vs $tab")
        // Chrome clamps a clip that leaves the viewport (RTL supporting text overflowing left) to x ≥ 0.
        val clip=JSONObject(c.getJSONObject("clip").toString()).let { k-> val x=k.getInt("x");if(x<0) k.put("x",0).put("width",k.getInt("width")+x) else k }
        val nat=CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        val res=CardWeb.compare(CardWeb.webGrid("CheckboxWebPaint/$name.png",clip),nat)
        check(res.getInt("compared")>800 && res.getInt("over6").toDouble()/res.getInt("compared")<=.005 && res.getDouble("mean")<=1.0,"$name flat pixels $res");report.put(res.put("case",name))
    }
}
