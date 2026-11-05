package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.awc.nativeui.*
import dev.awc.playground.CardWeb.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * md-otp-field paint and geometry against Chrome 153 (Mac capture of otp-paint.html, DPR 1, 168 cases): theme × direction ×
 * density × 13 states, every hook alone and together, the separator slot, reserved support — the same fixture as the SwiftUI
 * NativeOTPFieldPaintIntegration (Tests/Fixtures/otpfield-web-paint.json).
 */
class NativeOTPFieldParityTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"props\":{},\"width\":440}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var values:Map<String,Map<String,Any?>> = emptyMap()
    private val controller=AWCOTPFieldController()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun px(s:String?)=s?.trim()?.removeSuffix("px")?.toDoubleOrNull()
    private fun hooks(h:JSONObject?):AWCOTPFieldAppearance { if(h==null) return AWCOTPFieldAppearance()
        val t="--md-otp-field-"
        fun l(k:String)=if(h.has(t+k)) px(h.getString(t+k)) else null
        fun c(k:String)=if(h.has(t+k)) h.getString(t+k) else null
        return AWCOTPFieldAppearance(l("cell-gap"),l("cell-height"),l("cell-shape"),l("cell-width"),c("focus-color"),l("font-size"),c("outline-color")) }
    private fun props(c:JSONObject):Map<String,Any?> { val o=c.getJSONObject("props");val m=mutableMapOf<String,Any?>()
        for(k in o.keys()) m[k]=when(val v=o.get(k)) { is Number -> v.toDouble(); else -> v };return m }
    private fun rgba(css:String):List<Double> { val n=Regex("[-0-9.]+").findAll(css).map { it.value.toDouble() }.toList()
        return if(css.startsWith("color(srgb")) (n.take(3)+(n.getOrNull(3) ?: 1.0)) else if(css.startsWith("rgba")) listOf(n[0]/255,n[1]/255,n[2]/255,n[3]) else if(css.startsWith("rgb")) listOf(n[0]/255,n[1]/255,n[2]/255,1.0) else listOf(0.0,0.0,0.0,0.0) }
    private fun hexRgba(hex:String?):List<Double>? { val h=hex?.removePrefix("#") ?: return null;if(h.length!=6 && h.length!=8) return null
        val v=(0 until h.length/2).map { h.substring(it*2,it*2+2).toInt(16)/255.0 };return if(v.size==3) v+1.0 else v }
    private fun close(hex:Any?,css:String,tol:Double=.012):Boolean { val a=hexRgba(hex as? String) ?: return false;val b=rgba(css)
        val pa=listOf(a[0]*a[3],a[1]*a[3],a[2]*a[3],a[3]);val pb=listOf(b[0]*b[3],b[1]*b[3],b[2]*b[3],b[3]);return pa.zip(pb).all { abs(it.first-it.second)<=tol } }
    private val roboto=FontFamily(Font(dev.awc.nativeui.R.font.awc_roboto_regular))
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case
        AWCTheme(c.optString("theme")=="dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(24.dp,24.dp).width(c.optDouble("width",440.0).dp)) {
                    AWCDensityScope(if(c.isNull("globalDensity") || !c.has("globalDensity")) 0.0 else c.getDouble("globalDensity")) { AWCFieldReducedMotionScope(true) {
                        AWCOTPFieldAppearanceScope(hooks(c.optJSONObject("hooks"))) { AWCOTPFieldInspectionScope({ values=it }) { AWCInspectionScope(collector) {
                            AWCOTPFieldControllerScope(controller) {
                                val slotText=if(c.isNull("slot")) null else c.optString("slot")
                                // The separator slot as authored on the page: the text in the host's 16px Roboto, on-surface-variant.
                                AWCComponent("md-otp-field",props(c)) { name-> if(name=="separator" && slotText!=null)
                                    BasicText(slotText,style=TextStyle(fontFamily=roboto,fontSize=16.sp,color=Color(if(c.optString("theme")=="dark") 0xFFCAC4D0 else 0xFF49454F))) }
                            }
                        } } }
                    } }
                }
            }
        } } }
    } } }
    @Test fun otpFieldMatchesChromePaintAndGeometry() {
        content()
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcOnly")
        for(c in CardWeb.document("OTPFieldWebPaint.json").getJSONArray("cases").objects()) if(only==null || only.split(",").any { c.getString("name").contains(it) }) run(c)
        AccordionEvidence.log("otpfield-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun settle() { repeat(3) { compose.waitForIdle();compose.mainClock.advanceTimeBy(64) };compose.waitForIdle() }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        android.util.Log.i("AWCAccordion","otpfield-paint case $name")
        values=emptyMap();collector.clear();case=c;epoch++;settle()
        if(c.optBoolean("focus")) { compose.runOnIdle { controller.setFocus() };settle() }
        val nodes=collector.snapshot().nodes
        fun n(part:String)=nodes.firstOrNull { it.name==part }
        fun v(part:String,key:String)=values[part]?.get(key)
        val root=n("md-otp-field");if(root==null) { check(false,"$name measured");return }
        fun near(a:Double,b:Double,label:String,tol:Double=.6)=check(abs(a-b)<=tol,"$name $label $a vs $b")
        fun rect(node:AWCInspectionNode?,r:JSONObject,label:String,tol:Double=.6,wTol:Double=.6) {
            if(node==null) { check(false,"$name $label missing");return }
            val b=node.bounds
            near(b.x,r.getDouble("x"),"$label x",tol);near(b.y,r.getDouble("y"),"$label y",tol);near(b.width,r.getDouble("width"),"$label width",wTol);near(b.height,r.getDouble("height"),"$label height",tol) }
        rect(root,c.getJSONObject("host"),"host",wTol=1.2)
        val cells=c.getJSONArray("cells").objects()
        for((i,w) in cells.withIndex()) { val p="cell-$i"
            rect(n(p),w.getJSONObject("rect"),"cell $i")
            check(close(v(p,"border"),w.getString("border")),"$name cell $i border ${v(p,"border")} vs ${w.getString("border")}")
            near((v(p,"borderWidth") as? Double) ?: -1.0,w.getDouble("borderWidth"),"cell $i border width",.01)
            check(v(p,"text")==w.getString("value"),"$name cell $i text ${v(p,"text")} vs ${w.getString("value")}")
            check(close(v(p,"color"),w.getString("color")),"$name cell $i colour ${v(p,"color")} vs ${w.getString("color")}")
            near((v(p,"fontSize") as? Double) ?: -1.0,w.getDouble("fontSize"),"cell $i font",.01)
            check(v(p,"focused")==w.getBoolean("focused"),"$name cell $i focused")
            check(v(p,"secure")==(w.optString("type")=="password"),"$name cell $i secure") }
        check(nodes.count { it.name.startsWith("cell-") }==cells.size,"$name cell count")
        for((k,s) in c.getJSONArray("separators").objects().withIndex()) rect(n("separator-$k"),s.getJSONObject("rect"),"separator $k")
        val sup=c.optJSONObject("support")
        if(sup!=null) { val text=sup.optString("text")
            rect(n("supporting-text"),sup.getJSONObject("rect"),"support",wTol=if(text.isEmpty()) 99.0 else 1.2)
            check(v("supporting-text","text")==text,"$name support text")
            if(text.isNotEmpty()) check(close(v("supporting-text","color"),sup.getString("color")),"$name support colour ${v("supporting-text","color")} vs ${sup.getString("color")}")
        } else check(n("supporting-text")==null,"$name no support row")
        val clip=JSONObject(c.getJSONObject("clip").toString()).let { k-> val x=k.getInt("x");if(x<0) k.put("x",0).put("width",k.getInt("width")+x) else k }
        fun shot()=compose.onRoot().captureToImage().let { img-> img to CardWeb.compare(CardWeb.webGrid("OTPFieldWebPaint/$name.png",clip),
            CardWeb.nativeGrid(img.toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))) }
        fun ok(r:JSONObject)=r.getInt("over6").toDouble()/r.getInt("compared").coerceAtLeast(1)<=.005 && r.getDouble("mean")<=1.0
        var (image,res)=shot()
        // A capture that caught the surface mid-update (render-thread glitch) is retaken once after the frame settles.
        if(!ok(res)) { settle();val again=shot();if(ok(again.second)) { image=again.first;res=again.second.put("retaken",true) } }
        val flat=ok(res)
        if(!flat) AccordionEvidence.png("otpfield-native-$name",image)
        check(flat,"$name flat pixels $res");report.put(res.put("case",name))
        compose.runOnIdle { controller.runtimeBlur() }
    }
}
