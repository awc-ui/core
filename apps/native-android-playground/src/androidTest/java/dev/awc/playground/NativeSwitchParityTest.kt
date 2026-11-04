package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.semantics.SemanticsActions
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
 * md-switch paint and geometry against Chrome (switch/paint.html, DPR 1): the 360-case matrix (theme ×
 * direction × density × selected × icon mode × rest/disabled/soft-disabled), all twelve hooks, each hook
 * alone, the four parts, icon slots, the focus ring and hidden: host/track/container/handle boxes,
 * track, outline, handle, state-layer and icon colours, focus ring, tab stop and every flat pixel.
 * The four inline-validation cases run through the selection controller (reportValidity() / getValidity()).
 */
class NativeSwitchParityTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\"}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var inspection:AWCSwitchInspection?=null
    private val selectionController=AWCSelectionControlController()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray();private val skipped=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val dark=c.optString("theme")=="dark"
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            val slots=c.optString("group")=="slots"
            CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(40.dp,40.dp)) {
                    AWCSelectionReducedMotionScope(true) { AWCSwitchAppearanceScope(SwitchWeb.hooks(c.optJSONObject("hooks"))) {
                        AWCSwitchPartAppearanceScope(if(c.has("parts") && !c.isNull("parts")) SwitchWeb.parts else AWCSwitchPartAppearance()) {
                            AWCSwitchInspectionScope({ inspection=it }) { AWCInspectionScope(collector) { AWCSelectionControlControllerScope(selectionController) {
                                AWCComponent("md-switch",SwitchWeb.props(c)) { slot-> if(slots && slot in setOf("selected-icon","unselected-icon"))
                                    Box(Modifier.size(16.dp).background(LocalContentColor.current)) }
                            } } }
                        }
                    } }
                }
            }
        } } }
    } } }
    @Test fun switchMatchesChromePaintAndGeometry() {
        content()
        val oracle=CardWeb.document("SwitchWebPaint.json")
        for(c in oracle.getJSONArray("cases").objects()) run(c)
        AccordionEvidence.log("switch-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("skipped",skipped).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        inspection=null;collector.clear();case=c;epoch++;compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        if(c.optBoolean("focus")) { compose.onNode(SemanticsMatcher.expectValue(SemanticsProperties.Role,Role.Switch)).performSemanticsAction(SemanticsActions.RequestFocus);compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle() }
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
        val node=collector.snapshot().nodes.firstOrNull { it.name=="md-switch" }
        if(c.optBoolean("hidden")) { check(node==null,"$name hidden switch renders nothing");return }
        val s=c.getJSONObject("snap");val b=node?.bounds;val v=inspection?.values
        if(b==null || v==null) { check(false,"$name measured");return }
        fun near(a:Double,w:Double,label:String,tol:Double=.6)=check(abs(a-w)<=tol,"$name $label $a vs $w")
        fun d(k:String)=(v[k] as Number).toDouble()
        val r=s.getJSONObject("rect")
        near(b.x,r.getDouble("x"),"host x");near(b.y,r.getDouble("y"),"host y");near(b.width,r.getDouble("width"),"host width");near(b.height,r.getDouble("height"),"host height")
        val t=s.getJSONObject("track").getJSONObject("rect")
        near(b.x,t.getDouble("x"),"track x");near(b.y+(d("hostHeight")-d("trackHeight"))/2,t.getDouble("y"),"track y");near(d("trackWidth"),t.getDouble("width"),"track width");near(d("trackHeight"),t.getDouble("height"),"track height")
        val cx=b.x+d("containerX");val cy=b.y+d("containerY");val sl=d("layerSize");val k=s.getJSONObject("container")
        near(cx,k.getDouble("x"),"container x");near(cy,k.getDouble("y"),"container y");near(sl,k.getDouble("width"),"container size")
        val hs=d("handleSize");val hr=s.getJSONObject("handle").getJSONObject("rect")
        near(hs,hr.getDouble("width"),"handle size");near(cx+sl/2-hs/2,hr.getDouble("x"),"handle x");near(cy+sl/2-hs/2,hr.getDouble("y"),"handle y")
        val track=s.getJSONObject("track");val handle=s.getJSONObject("handle");val layer=s.getJSONObject("stateLayer")
        check(SwitchWeb.close(v["trackColor"],track.getString("bg")),"$name track colour ${v["trackColor"]} vs ${track.getString("bg")}")
        check(SwitchWeb.close(v["outlineColor"],track.getString("border")),"$name track outline ${v["outlineColor"]} vs ${track.getString("border")}")
        check(SwitchWeb.close(v["handleColor"],handle.getString("bg")),"$name handle colour ${v["handleColor"]} vs ${handle.getString("bg")}")
        check(abs(d("handleOpacity")-handle.getString("opacity").toDouble())<.001,"$name handle opacity ${v["handleOpacity"]}")
        val shown=layer.getString("display")!="none"
        check(shown==(d("layerOpacity")>=0),"$name state layer presence")
        if(shown) { check(abs(d("layerOpacity")-layer.getDouble("opacity"))<.004,"$name state layer opacity ${v["layerOpacity"]} vs ${layer.getDouble("opacity")}")
            check(SwitchWeb.close(v["layerColor"],layer.getString("bg")),"$name state layer colour ${v["layerColor"]} vs ${layer.getString("bg")}") }
        val slotted=s.getJSONArray("slotted").objects();val icon=s.optJSONObject("icon")
        if(slotted.isNotEmpty()) check(v["icon"]=="#slot","$name slotted icon shown (${v["icon"]})")
        else if(icon!=null && icon.getJSONObject("rect").getDouble("width")>0) {
            check(v["icon"]==icon.getString("text"),"$name icon ${v["icon"]} vs ${icon.getString("text")}")
            check(SwitchWeb.close(v["iconColor"],icon.getString("color")),"$name icon colour ${v["iconColor"]} vs ${icon.getString("color")}")
        } else check(v["icon"]=="","$name no icon (${v["icon"]})")
        check((v["focusRing"]==true)==track.getString("outline").startsWith("solid"),"$name focus ring ${v["focusRing"]}")
        check(v["tabindex"]==s.getString("tabindex").toInt(),"$name tabindex ${v["tabindex"]} vs ${s.getString("tabindex")}")
        // Chrome clamps a clip that leaves the viewport (RTL supporting text overflowing left) to x ≥ 0.
        val clip=JSONObject(c.getJSONObject("clip").toString()).let { k-> val x=k.getInt("x");if(x<0) k.put("x",0).put("width",k.getInt("width")+x) else k }
        val nat=CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        val web=CardWeb.webGrid("SwitchWebPaint/$name.png",clip)
        val mask=slotted.map { val a=it.getJSONObject("rect");Rect(a.getDouble("x").toFloat(),a.getDouble("y").toFloat(),(a.getDouble("x")+a.getDouble("width")).toFloat(),(a.getDouble("y")+a.getDouble("height")).toFloat()) }
        val res=CardWeb.compare(web,nat,mask)
        check(CardWeb.ok(res),"$name flat pixels $res");report.put(res.put("case",name))
    }
}
