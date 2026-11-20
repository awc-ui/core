package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
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
 * md-number-field paint and geometry against Chrome 153 (Mac capture of nf-paint.html, DPR 1, 208 cases): theme × direction ×
 * variant × steppers × states, densities, Intl formats, every hook alone and together — the same fixture as the SwiftUI
 * NativeNumberFieldPaintIntegration (Tests/Fixtures/numberfield-web-paint.json).
 */
class NativeNumberFieldParityTest {
    @get:Rule val compose=createComposeRule()
    // Touch mode is per display (Android 14+): a key-driven suite earlier in the run leaves keyboard mode, where a field takes
    // initial focus when composed. Chrome's baseline is a pointer session: start and leave every test in touch mode.
    @org.junit.Before @org.junit.After fun touchMode() { runCatching { androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true) } }
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{},\"width\":320}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var values:Map<String,Map<String,Any?>> = emptyMap()
    private var fieldValues:Map<String,Map<String,Any?>> = emptyMap()
    private val controller=AWCNumberFieldController()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun px(s:String?)=s?.trim()?.removeSuffix("px")?.toDoubleOrNull()
    private fun json(o:JSONObject):Map<String,Any?> = o.keys().asSequence().associateWith { k-> o.get(k).let { if(it is JSONObject) json(it) else if(it==JSONObject.NULL) null else it } }
    private fun nfParts(o:JSONObject?)=if(o==null) AWCNumberFieldPartAppearance() else AWCNumberFieldPartAppearance.fromValues(json(o))
    private fun nfHooks(h:JSONObject?):AWCNumberFieldAppearance { if(h==null) return AWCNumberFieldAppearance()
        fun l(k:String)=if(h.has(k)) px(h.getString(k)) else null
        return AWCNumberFieldAppearance(l("--md-number-field-width"),l("--md-number-field-min-width"),l("--md-number-field-stepper-icon-size"),
            if(h.has("--md-number-field-stepper-color")) h.getString("--md-number-field-stepper-color") else null,l("--md-number-field-split-stepper-size")) }
    private fun tfHooks(h:JSONObject?):AWCTextFieldAppearance { if(h==null) return AWCTextFieldAppearance()
        val t="--md-text-field-";fun l(k:String)=if(h.has(t+k)) px(h.getString(t+k)) else null
        fun c(k:String)=if(h.has(t+k)) h.getString(t+k) else null
        return AWCTextFieldAppearance(activeIndicatorColor=c("active-indicator-color"),containerColor=c("container-color"),containerShape=l("container-shape"),
            inputColor=c("input-color"),labelColor=c("label-color"),outlineColor=c("outline-color"),paddingInlineStart=l("padding-inline-start"),
            paddingInlineEnd=l("padding-inline-end"),supportingTextColor=c("supporting-text-color")) }
    private fun props(c:JSONObject):Map<String,Any?> { val o=c.getJSONObject("props");val m=mutableMapOf<String,Any?>()
        for(k in o.keys()) m[k]=when(val v=o.get(k)) { is Number -> v.toDouble(); else -> v };return m }
    private fun rgba(css:String):List<Double> { val n=Regex("[-0-9.]+").findAll(css).map { it.value.toDouble() }.toList()
        return if(css.startsWith("color(srgb")) (n.take(3)+(n.getOrNull(3) ?: 1.0)) else if(css.startsWith("rgba")) listOf(n[0]/255,n[1]/255,n[2]/255,n[3]) else if(css.startsWith("rgb")) listOf(n[0]/255,n[1]/255,n[2]/255,1.0) else listOf(0.0,0.0,0.0,0.0) }
    private fun hexRgba(hex:String?):List<Double>? { val h=hex?.removePrefix("#") ?: return null;if(h.length!=6 && h.length!=8) return null
        val v=(0 until h.length/2).map { h.substring(it*2,it*2+2).toInt(16)/255.0 };return if(v.size==3) v+1.0 else v }
    private fun close(hex:Any?,css:String,tol:Double=.012):Boolean { val a=hexRgba(hex as? String) ?: return false;val b=rgba(css)
        val pa=listOf(a[0]*a[3],a[1]*a[3],a[2]*a[3],a[3]);val pb=listOf(b[0]*b[3],b[1]*b[3],b[2]*b[3],b[3]);return pa.zip(pb).all { abs(it.first-it.second)<=tol } }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case
        AWCTheme(c.optString("theme")=="dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(24.dp,24.dp).width(c.optDouble("width",320.0).dp)) {
                    AWCDensityScope(if(c.isNull("globalDensity") || !c.has("globalDensity")) 0.0 else c.getDouble("globalDensity")) { AWCFieldReducedMotionScope(true) {
                        AWCNumberFieldAppearanceScope(nfHooks(c.optJSONObject("hooks"))) { AWCTextFieldAppearanceScope(tfHooks(c.optJSONObject("hooks"))) { AWCNumberFieldPartAppearanceScope(nfParts(c.optJSONObject("parts"))) {
                            AWCTextFieldInspectionScope({ fieldValues=it }) { AWCNumberFieldInspectionScope({ values=it }) { AWCInspectionScope(collector) {
                                AWCNumberFieldControllerScope(controller) { AWCComponent("md-number-field",props(c)) }
                            } } } } } }
                    } }
                }
            }
        } } }
    } } }
    @Test fun numberFieldMatchesChromePaintAndGeometry() {
        content()
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcOnly")
        for(c in CardWeb.document("NumberFieldWebPaint.json").getJSONArray("cases").objects()) if(only==null || only.split(",").any { c.getString("name").contains(it) }) run(c)
        AccordionEvidence.log("numberfield-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun settle() { repeat(3) { compose.waitForIdle();compose.mainClock.advanceTimeBy(64) };compose.waitForIdle() }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        android.util.Log.i("AWCAccordion","numberfield-paint case $name")
        values=emptyMap();fieldValues=emptyMap();collector.clear();case=c;epoch++;settle()
        if(c.optBoolean("focus")) { compose.runOnIdle { check(controller.setFocus(),"$name setFocus") };settle() }
        val nodes=collector.snapshot().nodes
        fun n(part:String)=nodes.firstOrNull { it.name==part }
        fun v(part:String,key:String)=values[part]?.get(key)
        fun fv(part:String,key:String)=fieldValues[part]?.get(key)
        val root=n("md-number-field");if(root==null) { check(false,"$name measured");return }
        fun near(a:Double,b:Double,label:String,tol:Double=.6)=check(abs(a-b)<=tol,"$name $label $a vs $b")
        fun rect(node:AWCInspectionNode?,w:JSONObject?,label:String,tol:Double=.6,wTol:Double=.6) { if(w==null) return
            if(node==null) { check(false,"$name $label missing");return }
            val r=w.getJSONObject("rect");val b=node.bounds
            near(b.x,r.getDouble("x"),"$label x",tol);near(b.y,r.getDouble("y"),"$label y",tol);near(b.width,r.getDouble("width"),"$label width",wTol);near(b.height,r.getDouble("height"),"$label height",tol) }
        val host=c.getJSONObject("host");val hb=root.bounds
        near(hb.x,host.getDouble("x"),"host x");near(hb.y,host.getDouble("y"),"host y");near(hb.width,host.getDouble("width"),"host width");near(hb.height,host.getDouble("height"),"host height")
        rect(n("field"),c.optJSONObject("field"),"field")
        if(c.optJSONObject("parts")!=null) { val f=c.getJSONObject("field")   // ::part(field): background and opacity of the inner field box
            check(close(v("field","background"),f.optString("backgroundColor")),"$name field background ${v("field","background")} vs ${f.optString("backgroundColor")}")
            near((v("field","opacity") as? Double) ?: -1.0,f.optString("opacity","1").toDouble(),"field opacity",.001) }
        for(k in listOf("increment","decrement")) { val w=c.optJSONObject(k)
            if(w==null) { check(n(k)==null,"$name no $k");continue }
            rect(n(k),w,k);check(v(k,"disabled")==w.getBoolean("disabled"),"$name $k disabled ${v(k,"disabled")} vs ${w.getBoolean("disabled")}") }
        rect(n("container"),c.optJSONObject("container"),"container")
        check(close(fv("container","background"),c.getJSONObject("container").getString("backgroundColor")),"$name container colour ${fv("container","background")}")
        c.optJSONObject("label")?.let { lab-> rect(n("label"),lab,"label",wTol=1.2)
            check(close(fv("label","color"),lab.getString("color")),"$name label colour ${fv("label","color")} vs ${lab.getString("color")}")
            near((fv("label","fontSize") as? Double) ?: 0.0,px(lab.getString("fontSize")) ?: 0.0,"label font",.01) }
        c.optJSONObject("input")?.let { inp-> rect(n("input"),inp,"input")
            check(fv("input","value")==inp.getString("value"),"$name input text ${fv("input","value")} vs ${inp.getString("value")}")
            check(close(fv("input","color"),inp.getString("color")),"$name input colour ${fv("input","color")}")
            check(v("md-number-field","inputMode")==inp.optString("inputmode"),"$name inputmode ${v("md-number-field","inputMode")} vs ${inp.optString("inputmode")}") }
        c.optJSONObject("support")?.let { if(it.optString("text").isNotEmpty()) rect(n("supporting-text"),it,"support",wTol=1.2) }
        c.optJSONObject("indicator")?.let { w-> if(w.getJSONObject("rect").getDouble("height")>0) {
            near((fv("indicator","height") as? Double) ?: -1.0,w.getJSONObject("rect").getDouble("height"),"indicator height")
            check(close(fv("indicator","color"),w.getString("backgroundColor")),"$name indicator colour ${fv("indicator","color")} vs ${w.getString("backgroundColor")}") } }
        c.optJSONObject("fieldset")?.let { w-> if(w.getJSONObject("rect").getDouble("width")>0)
            check(close(fv("fieldset","color"),w.getString("borderTopColor")),"$name outline colour ${fv("fieldset","color")} vs ${w.getString("borderTopColor")}") }
        val clip=JSONObject(c.getJSONObject("clip").toString()).let { k-> val x=k.getInt("x");if(x<0) k.put("x",0).put("width",k.getInt("width")+x) else k }
        fun shot()=compose.onRoot().captureToImage().let { img-> img to CardWeb.compare(CardWeb.webGrid("NumberFieldWebPaint/$name.png",clip),
            CardWeb.nativeGrid(img.toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))) }
        fun ok(r:JSONObject)=r.getInt("over6").toDouble()/r.getInt("compared").coerceAtLeast(1)<=.005 && r.getDouble("mean")<=1.0
        var (image,res)=shot()
        // A capture that caught the surface mid-update (render-thread glitch) is retaken once after the frame settles.
        if(!ok(res)) { settle();val again=shot();if(ok(again.second)) { image=again.first;res=again.second.put("retaken",true) } }
        val flat=ok(res)
        if(!flat) AccordionEvidence.png("numberfield-native-$name",image)
        check(flat,"$name flat pixels $res");report.put(res.put("case",name))
        compose.runOnIdle { controller.runtimeBlur() }
    }
}
