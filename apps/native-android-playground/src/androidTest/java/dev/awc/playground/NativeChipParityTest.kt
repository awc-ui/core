package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.toPixelMap
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
 * md-chip paint and geometry against Chrome (md-chip/paint.html, DPR 1): the variant × appearance × state × theme ×
 * direction matrix, density rungs × content shapes plus inherited / local density, content compositions (slots,
 * truncation, alignment, removable / display token / deprecated elevated), colour roles, all hooks, each hook alone,
 * both part fixtures and hidden: host box, padding, gap, typography, container / label / icon / outline / state-layer
 * colours, shadow, role and tab stops, part boxes and every flat pixel. Rendered through AWCComponent (dispatch).
 */
class NativeChipParityTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"variant\":\"assist\",\"label\":\"Init\"}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var inspection:AWCChipInspection?=null
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun hooks(h:JSONObject?):AWCChipHookAppearance { if(h==null) return AWCChipHookAppearance()
        fun s(k:String)=if(h.has(k)) h.getString(k) else null
        fun n(k:String)=s(k)?.removeSuffix("px")?.toDouble()
        return AWCChipHookAppearance(s("container-color")?.let(CardWeb::hex),s("container-color-selected")?.let(CardWeb::hex),s("label-color")?.let(CardWeb::hex),
            s("label-color-selected")?.let(CardWeb::hex),s("icon-color")?.let(CardWeb::hex),n("icon-size"),s("container-shape")?.let(CardWeb::corners),n("container-height"),
            s("outline-color")?.let(CardWeb::hex),n("outline-width"),s("state-layer-color")?.let(CardWeb::hex),s("elevation")?.let(CardWeb::boxShadow)) }
    private fun parts(name:String)=when(name) {
        "parts-input"->AWCChipPartAppearance(stateLayerColor="#F4511E",stateLayerOpacity=.2,outlineColor="#00897B",outlineWidth=2.0,labelColor="#3949AB",iconColor="#8E24AA",removeColor="#E53935")
        "parts-primary"->AWCChipPartAppearance(primaryBackground="#00897B3D",primaryOutlineStyle="solid",primaryOutlineColor="#E53935",primaryOutlineWidth=2.0,primaryOutlineOffset=-4.0)
        "parts-filter"->AWCChipPartAppearance(outlineColor="#000000",trailingIconColor="#1E88E5",checkmarkColor="#E53935")
        else->AWCChipPartAppearance() }
    private fun props(c:JSONObject):Map<String,Any?> { val p=mutableMapOf<String,Any?>()
        for(k in listOf("variant","appearance","color","icon","trailingIcon","label","contentAlign")) if(c.has(k) && !c.isNull(k)) p[k]=c.getString(k)
        for(k in listOf("selected","selectable","removable","disabled","softDisabled","elevated","hidden")) if(c.has(k) && !c.isNull(k)) p[k]=c.getBoolean(k)
        if(c.has("density") && !c.isNull("density")) p["density"]=c.getDouble("density")
        return p }
    @Composable private fun slots(c:JSONObject):(@Composable (String)->Unit) { val slot=c.optString("slot")
        return { name-> when {
            name=="leading-icon" && slot.contains("circle")->Box(Modifier.size(18.dp).clip(CircleShape).background(Color(0xFF7E57C2)))
            name=="trailing-icon" && slot.contains("M7 10")->{ val ink=LocalContentColor.current
                Box(Modifier.size(18.dp).drawBehind { val s=size.width/24f
                    drawPath(Path().apply { moveTo(7*s,10*s);lineTo(12*s,15*s);lineTo(17*s,10*s);close() },ink) }) }
            name=="" && slot.isNotEmpty() && !slot.startsWith("<")->Text(slot)
            else->{} } } }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case
        AWCTheme(c.optString("theme")=="dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(40.dp,40.dp).width(320.dp),contentAlignment=Alignment.TopStart) {
                    val width=c.optString("width").removeSuffix("px").toDoubleOrNull()
                    AWCDensityScope(if(c.has("inheritedDensity")) c.getDouble("inheritedDensity") else 0.0) {
                    AWCChipReducedMotionScope(true) { AWCChipStretchScope(width!=null) { AWCChipAppearanceScope(hooks(c.optJSONObject("hooks"))) { AWCChipPartAppearanceScope(parts(c.optString("name"))) {
                        AWCChipInspectionScope({ inspection=it }) { AWCInspectionScope(collector) {
                            Box(if(width!=null) Modifier.width(width.dp) else Modifier) { AWCComponent("md-chip",props(c),content=slots(c)) }
                        } }
                    } } } } }
                }
            }
        } } }
    } } }
    @Test fun chipMatchesChromePaintAndGeometry() {
        content()
        for(c in CardWeb.document("ChipWebPaint.json").getJSONArray("cases").objects()) run(c)
        AccordionEvidence.log("chip-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        android.util.Log.i("AWCAccordion","chip-paint case $name")
        inspection=null;collector.clear();case=c;epoch++;compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        val nodes=collector.snapshot().nodes;val node=nodes.firstOrNull { it.name=="md-chip" }
        if(c.optBoolean("hidden")) { check(node==null,"$name hidden chip renders nothing");return }
        val s=c.getJSONObject("snap");val b=node?.bounds;val ins=inspection;val v=ins?.values
        if(b==null || v==null || ins==null) { check(false,"$name measured");return }
        fun near(a:Double,w:Double,label:String,tol:Double=.6)=check(abs(a-w)<=tol,"$name $label $a vs $w")
        fun d(k:String)=(v[k] as Number).toDouble()
        val st=s.getJSONObject("style");val r=s.getJSONObject("rect");val t=ins.frameMillis
        // In RTL the host's x carries its width difference (shaped label advances differ by up to 1 px from Chrome).
        near(b.x,r.getDouble("x"),"host x",if(c.optString("dir")=="rtl") 1.0 else .6);near(b.y,r.getDouble("y"),"host y");near(b.width,r.getDouble("width"),"host width",1.0);near(b.height,r.getDouble("height"),"host height")
        near(d("paddingLeft"),SwitchWeb.px(st.getString("paddingLeft")),"padding-left",.01);near(d("paddingRight"),SwitchWeb.px(st.getString("paddingRight")),"padding-right",.01)
        near(d("gap"),SwitchWeb.px(st.getString("columnGap")),"gap",.01)
        near(d("fontSize"),SwitchWeb.px(st.getString("fontSize")),"font size",.01);near(d("lineHeight"),SwitchWeb.px(st.getString("lineHeight")),"line height",.01)
        fun same(native:List<Double>,css:String)=CardWeb.pre(native).zip(CardWeb.pre(CardWeb.color(css))).all { (a,w)-> abs(a-w)<.012 }
        check(same(ins.background(t),st.getString("backgroundColor")),"$name container ${ins.background(t)} vs ${st.getString("backgroundColor")}")
        check(same(ins.ink(t),st.getString("color")),"$name label ink ${ins.ink(t)} vs ${st.getString("color")}")
        val ns=CardWeb.nativeShadow(ins.shadow(t),2);val ws=CardWeb.shadow(st.getString("boxShadow"),2)
        check(ns.size==ws.size && ns.zip(ws).all { (a,w)-> abs(a-w)<.02 },"$name shadow $ns vs ${st.getString("boxShadow")}")
        val outline=s.optJSONObject("outline")
        if(outline!=null) { val col=outline.getString("borderTopColor")
            check(SwitchWeb.close(v["outlineColor"],col),"$name outline ${v["outlineColor"]} vs $col")
            if(CardWeb.color(col)[3]>0) near(d("outlineWidth"),SwitchWeb.px(outline.getString("borderTopWidth")),"outline width",.01) }
        else check((v["outlineColor"] as Color).alpha==0f,"$name no outline element: transparent native outline")
        val layer=s.getJSONObject("stateLayer")
        check((layer.getString("display")!="none")==(v["layerVisible"]==true),"$name state layer presence")
        if(layer.getString("display")!="none") { check(abs(ins.layerOpacity(t)-layer.getString("opacity").toDouble())<.004,"$name layer opacity ${ins.layerOpacity(t)}")
            check(SwitchWeb.close(v["stateLayerColor"],layer.getString("backgroundColor")),"$name layer colour ${v["stateLayerColor"]} vs ${layer.getString("backgroundColor")}") }
        for((part,key) in listOf("icon" to "icon","checkmark" to "checkmark","label" to "label","remove" to "remove","trailing-icon" to "trailingIcon")) {
            val web=s.optJSONObject(key);val n=nodes.firstOrNull { it.name==part }
            val rendered=web!=null && web.getJSONObject("rect").let { it.getDouble("width")>0 || it.getDouble("height")>0 }
            if(!rendered) { check(n==null,"$name no $part part");continue }
            if(n==null) { check(false,"$name $part part measured");continue }
            // The label box (and, in RTL, every box laid out after it from the right edge) carries the ≤1 px shaped-advance difference.
            val wr=web!!.getJSONObject("rect");val tol=if(part=="label" || c.optString("dir")=="rtl") 1.0 else .6
            check(abs(n.bounds.x-wr.getDouble("x"))<=tol && abs(n.bounds.y-wr.getDouble("y"))<=tol && abs(n.bounds.width-wr.getDouble("width"))<=tol && abs(n.bounds.height-wr.getDouble("height"))<=tol,
                "$name $part box ${n.bounds} vs $wr")
        }
        val attrs=s.getJSONObject("attrs");val role=attrs.optString("role");val tab=if(attrs.isNull("tabindex")) -2 else attrs.getString("tabindex").toInt()
        check(v["role"]==role && v["tabindex"]==tab,"$name role/tabindex ${v["role"]}/${v["tabindex"]} vs $role/$tab")
        val primary=s.optJSONObject("primary");val pt=if(primary==null) -2 else primary.optString("tabindex").toIntOrNull() ?: -2
        check(v["primaryTabindex"]==pt,"$name primary tabindex ${v["primaryTabindex"]} vs $pt")
        s.optJSONObject("remove")?.let { check(v["removeTabindex"]==it.getString("tabindex").toInt(),"$name remove tabindex ${v["removeTabindex"]}") }
        val pressed=if(role=="button") attrs.optString("ariaPressed").takeUnless { attrs.isNull("ariaPressed") } ?: "" else primary?.takeUnless { it.isNull("ariaPressed") }?.optString("ariaPressed") ?: ""
        check(v["pressedState"]==pressed,"$name pressed state ${v["pressedState"]} vs $pressed")
        check(v["hostRing"]==false,"$name no focus ring at rest")
        val clip=c.getJSONObject("clip")
        val nat=CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        val res=CardWeb.compare(CardWeb.webGrid("ChipWebPaint/$name.png",clip),nat)
        check(res.getInt("compared")>600 && res.getInt("over6").toDouble()/res.getInt("compared")<=.005 && res.getDouble("mean")<=1.0,"$name flat pixels $res");report.put(res.put("case",name))
    }
}
