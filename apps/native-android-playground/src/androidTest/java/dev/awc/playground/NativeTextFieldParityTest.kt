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
 * md-text-field paint and geometry against Chrome 153 (Mac capture of tf-paint.html, DPR 1, 394 cases): theme × direction ×
 * variant × density × 14 states, every hook alone and together, focus-border-width, appear-focused, reserved support row,
 * no label, fixed multiline, speech, chips, densities −1/−3 and a global density −4 — the same fixture as the SwiftUI
 * NativeTextFieldPaintIntegration (Tests/Fixtures/textfield-web-paint.json).
 */
class NativeTextFieldParityTest {
    @get:Rule val compose=createComposeRule()
    // Touch mode is per display (Android 14+): a key-driven suite earlier in the run leaves keyboard mode, where a field takes
    // initial focus when composed. Chrome's baseline is a pointer session: start and leave every test in touch mode.
    @org.junit.Before @org.junit.After fun touchMode() { runCatching { androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true) } }
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{},\"slots\":[],\"width\":320}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var values:Map<String,Map<String,Any?>> = emptyMap()
    private val controller=AWCTextFieldController()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun px(s:String?)=s?.trim()?.removeSuffix("px")?.toDoubleOrNull()
    private fun hooks(h:JSONObject?):AWCTextFieldAppearance { if(h==null) return AWCTextFieldAppearance()
        fun l(k:String)=if(h.has(k)) px(h.getString(k)) else null
        fun c(k:String)=if(h.has(k)) h.getString(k) else null
        return AWCTextFieldAppearance(c("active-indicator-color"),c("container-color"),l("container-shape"),c("cursor"),c("error-color"),
            if(h.has("filled-pill")) h.getString("filled-pill").toDoubleOrNull() else null,l("focus-border-width"),l("focus-inset"),c("icon-color"),l("icon-size"),
            c("input-color"),c("label-color"),l("optical-nudge"),c("outline-color"),l("padding-inline-start"),l("padding-inline-end"),c("supporting-text-color")) }
    private fun parts(h:JSONObject?)=if(h==null) AWCTextFieldPartAppearance() else AWCTextFieldPartAppearance(h.optString("containerColor").ifEmpty { null },
        h.optString("labelColor").ifEmpty { null },h.optString("inputColor").ifEmpty { null },h.optString("caretColor").ifEmpty { null },
        h.optString("supportingTextColor").ifEmpty { null },h.optString("counterColor").ifEmpty { null },h.optString("chipsBackgroundColor").ifEmpty { null },
        if(h.has("chipsGap")) h.getDouble("chipsGap") else null)
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
                        AWCTextFieldAppearanceScope(hooks(c.optJSONObject("hooks"))) { AWCTextFieldPartAppearanceScope(parts(c.optJSONObject("parts"))) { AWCTextFieldInspectionScope({ values=it }) { AWCInspectionScope(collector) {
                            AWCTextFieldControllerScope(controller) {
                                val slots=c.getJSONArray("slots").objects()
                                AWCComponent("md-text-field",props(c),content={ name-> for(s in slots.filter { it.optString("slot")==name }) {
                                    if(s.optString("kind")=="chip") AWCComponent("md-chip",mapOf("label" to s.optString("label"))) else AWCMaterialSymbol(s.optString("name")) } })
                            } } } } }
                    } }
                }
            }
        } } }
    } } }
    @Test fun textFieldMatchesChromePaintAndGeometry() {
        content()
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcOnly")
        for(c in CardWeb.document("TextFieldWebPaint.json").getJSONArray("cases").objects()) if(only==null || only.split(",").any { c.getString("name").contains(it) }) run(c)
        AccordionEvidence.log("textfield-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun settle() { repeat(3) { compose.waitForIdle();compose.mainClock.advanceTimeBy(64) };compose.waitForIdle() }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        android.util.Log.i("AWCAccordion","textfield-paint case $name")
        values=emptyMap();collector.clear();case=c;epoch++;settle()
        if(c.optBoolean("focus")) { compose.runOnIdle { check(controller.setFocus(),"$name setFocus") };settle() }
        val nodes=collector.snapshot().nodes
        fun n(part:String)=nodes.firstOrNull { it.name==part }
        fun v(part:String,key:String)=values[part]?.get(key)
        val root=n("md-text-field");if(root==null) { check(false,"$name measured");return }
        fun near(a:Double,b:Double,label:String,tol:Double=.6)=check(abs(a-b)<=tol,"$name $label $a vs $b")
        fun rect(node:AWCInspectionNode?,w:JSONObject?,label:String,tol:Double=.6,wTol:Double=.6) { if(w==null) return
            if(node==null) { check(false,"$name $label missing");return }
            val r=w.getJSONObject("rect");val b=node.bounds
            near(b.x,r.getDouble("x"),"$label x",tol);near(b.y,r.getDouble("y"),"$label y",tol);near(b.width,r.getDouble("width"),"$label width",wTol);near(b.height,r.getDouble("height"),"$label height",tol) }
        val host=c.getJSONObject("host");val hb=root.bounds
        near(hb.x,host.getDouble("x"),"host x");near(hb.y,host.getDouble("y"),"host y");near(hb.width,host.getDouble("width"),"host width");near(hb.height,host.getDouble("height"),"host height")
        rect(n("container"),c.optJSONObject("container"),"container")
        check(close(v("container","background"),c.getJSONObject("container").getString("backgroundColor")),"$name container colour ${v("container","background")}")
        val lab=c.optJSONObject("label")
        if(lab!=null) { rect(n("label"),lab,"label",wTol=1.2)
            check(close(v("label","color"),lab.getString("color")),"$name label colour ${v("label","color")} vs ${lab.getString("color")}")
            near((v("label","fontSize") as? Double) ?: 0.0,px(lab.getString("fontSize")) ?: 0.0,"label font",.01) }
        val chips=c.getJSONArray("slots").objects().any { it.optString("kind")=="chip" }
        rect(n("input"),c.optJSONObject("input"),"input",if(chips) 1.6 else .6,if(chips) 1.6 else .6)
        check(close(v("input","color"),c.getJSONObject("input").getString("color")),"$name input colour ${v("input","color")}")
        c.optJSONObject("support")?.let { if(it.optString("text").isNotEmpty()) rect(n("supporting-text"),it,"support",wTol=1.2) }
        rect(n("counter"),c.optJSONObject("counter"),"counter",wTol=1.2)
        c.optJSONObject("indicator")?.let { w-> if(w.getJSONObject("rect").getDouble("height")>0) {
            near((v("indicator","height") as? Double) ?: -1.0,w.getJSONObject("rect").getDouble("height"),"indicator height")
            check(close(v("indicator","color"),w.getString("backgroundColor")),"$name indicator colour ${v("indicator","color")} vs ${w.getString("backgroundColor")}") } }
        c.optJSONObject("fieldset")?.let { w-> if(w.getJSONObject("rect").getDouble("width")>0) {
            val f=n("fieldset");val inset=(v("fieldset","inset") as? Double) ?: 0.0
            if(f!=null) { near(f.bounds.x+inset,w.getJSONObject("rect").getDouble("x"),"fieldset x");near(f.bounds.y+inset,w.getJSONObject("rect").getDouble("y"),"fieldset y") }
            near((v("fieldset","borderWidth") as? Double) ?: -1.0,px(w.getString("borderTopWidth")) ?: 0.0,"fieldset width")
            check(close(v("fieldset","color"),w.getString("borderTopColor")),"$name outline colour ${v("fieldset","color")} vs ${w.getString("borderTopColor")}")
            c.optJSONObject("legend")?.let { lg-> val r=lg.getJSONObject("rect");val start=(v("fieldset","legendStart") as? Double) ?: 0.0
                if(f!=null) { if(c.optString("dir")=="rtl") near(f.bounds.x+f.bounds.width-inset-start,r.getDouble("x")+r.getDouble("width"),"legend end",1.2) else near(f.bounds.x+inset+start,r.getDouble("x"),"legend x",1.2) }
                near((v("fieldset","legendWidth") as? Double) ?: -1.0,r.getDouble("width"),"legend width",1.2) } } }
        rect(n("prefix"),c.optJSONObject("prefix"),"prefix",wTol=1.2);rect(n("suffix"),c.optJSONObject("suffix"),"suffix",wTol=1.2)
        // The chips box (one line, or chips-wrap rows and the input on its own line once it no longer fits): md-chip widths differ by
        // their own 0.6 dp paint tolerance each; with ::part(chips) its background.
        if(chips) c.optJSONObject("chips")?.let { w-> rect(n("chips"),w,"chips",1.6,2.0)
            if(c.optJSONObject("parts")?.has("chipsBackgroundColor")==true) check(close(v("chips","background"),w.getString("backgroundColor")),"$name chips background ${v("chips","background")} vs ${w.getString("backgroundColor")}") }
        val parts=mapOf("Clear" to "clear","Show password" to "password-toggle","Hide password" to "password-toggle","Start voice input" to "speech","Stop listening" to "speech")
        for(b in c.getJSONArray("buttons").objects()) { val part=parts[b.optString("label")] ?: b.optString("label");val node=n(part)
            if(node==null) check(false,"$name $part missing") else { val r=b.getJSONObject("rect")
                near(node.bounds.x+node.bounds.width/2-20,r.getDouble("x"),"$part x");near(node.bounds.y+node.bounds.height/2-20,r.getDouble("y"),"$part y") } }
        val clip=JSONObject(c.getJSONObject("clip").toString()).let { k-> val x=k.getInt("x");if(x<0) k.put("x",0).put("width",k.getInt("width")+x) else k }
        fun shot()=compose.onRoot().captureToImage().let { img-> img to CardWeb.compare(CardWeb.webGrid("TextFieldWebPaint/$name.png",clip),
            CardWeb.nativeGrid(img.toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))) }
        fun ok(r:JSONObject)=r.getInt("over6").toDouble()/r.getInt("compared").coerceAtLeast(1)<=.005 && r.getDouble("mean")<=1.0
        var (image,res)=shot()
        // A capture that caught the surface mid-update (render-thread glitch) is retaken once after the frame settles.
        if(!ok(res)) { settle();val again=shot();if(ok(again.second)) { image=again.first;res=again.second.put("retaken",true) } }
        val flat=ok(res)
        if(!flat) AccordionEvidence.png("textfield-native-$name",image)
        check(flat,"$name flat pixels $res");report.put(res.put("case",name))
        compose.runOnIdle { controller.runtimeBlur() }
    }
}
