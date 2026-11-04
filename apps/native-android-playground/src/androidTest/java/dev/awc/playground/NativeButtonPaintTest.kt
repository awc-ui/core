package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
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
 * md-button (and md-fab elevation) paint and geometry against Chrome 153 (md-button/web-reference/paint.html, DPR 1):
 * variant × state × theme × direction, size × shape, density × size × content, inherited/local density, content
 * compositions, every hook per variant × state × theme, each hook alone, the part fixtures and the md-fab elevation
 * cases. Rendered through AWCComponent. Checks the border box and every flat pixel of the source clip (the default
 * loader is frozen at t = 0 in Chrome; its box is masked and only its geometry is compared).
 */
class NativeButtonPaintTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"label\":\"Init\"}"))
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun appearance(c:JSONObject):AWCButtonAppearance { val h=c.optJSONObject("hooks")
        fun s(k:String)=if(h!=null && h.has(k)) h.getString(k) else null
        fun n(k:String)=s(k)?.removeSuffix("px")?.toDouble()
        val parts=c.optString("name")
        return AWCButtonAppearance(containerColor=s("container-color")?.let(CardWeb::hex),labelColor=s("label-color")?.let(CardWeb::hex) ?: if(parts=="parts-filled") "#3949AB" else null,
            iconColor=s("icon-color")?.let(CardWeb::hex) ?: if(parts=="parts-filled") "#8E24AA" else null,trailingIconColor=s("trailing-icon-color")?.let(CardWeb::hex) ?: if(parts=="parts-filled") "#E53935" else null,
            loadingColor=s("loading-color")?.let(CardWeb::hex) ?: if(parts=="parts-loading") "#E53935" else null,stateLayerColor=s("state-layer-color")?.let(CardWeb::hex) ?: if(parts=="parts-filled") "#F4511E" else null,
            outlineColor=s("outline-color")?.let(CardWeb::hex),iconSize=n("icon-size"),trailingIconSize=n("trailing-icon-size"),loadingSize=n("loading-size"),fontSize=n("font-size"),
            fontWeight=n("font-weight"),lineHeight=n("line-height"),letterSpacing=n("letter-spacing"),cornerRadius=n("container-shape"),outlineWidth=n("outline-width"),
            paddingInline=n("padding-inline"),paddingBlock=n("padding-block"),gap=n("gap"),hoverOpacity=n("hover-opacity"),focusOpacity=n("focus-opacity"),pressedOpacity=n("pressed-opacity"),
            focusRingColor=s("focus-ring-color")?.let(CardWeb::hex),width=n("width") ?: c.optString("width").removeSuffix("px").toDoubleOrNull(),minWidth=n("min-width"),maxWidth=n("max-width"),
            height=n("height"),minHeight=n("min-height"),stateLayerOpacity=if(parts=="parts-filled") .2 else null) }
    private fun props(c:JSONObject,tag:String):Map<String,Any?> { val p=mutableMapOf<String,Any?>()
        val strings=if(tag=="md-fab") listOf("variant","size","icon","label") else listOf("variant","size","shape","icon","trailingIcon","href")
        val bools=if(tag=="md-fab") listOf("disabled","softDisabled","lowered","extended") else listOf("disabled","softDisabled","loading","toggle","selected","shapeMorph","mirrorIcon","suppressExpandIconFlip","fullWidth","connectedLeft","connectedRight","ripple")
        for(k in strings) if(c.has(k) && !c.isNull(k)) p[k]=c.getString(k)
        for(k in bools) if(c.has(k) && !c.isNull(k)) p[k]=c.getBoolean(k)
        if(c.has("density") && !c.isNull("density")) p["density"]=c.getDouble("density")
        if(c.has("expanded")) p["aria-expanded"]=c.getBoolean("expanded").toString()
        return p }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val tag=c.optString("tag").ifEmpty { "md-button" };val slot=c.optString("slot")
        AWCTheme(c.optString("theme")=="dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(40.dp,40.dp).width(360.dp),contentAlignment=Alignment.TopStart) {
                    AWCDensityScope(if(c.has("inheritedDensity")) c.getDouble("inheritedDensity") else 0.0) { AWCButtonAppearanceScope(appearance(c)) {
                        AWCInspectionScope(collector) {
                            AWCComponent(tag,props(c,tag)) { name-> when {
                                tag=="md-fab"->{}
                                // Authored default-slot text, rendered the way the Laboratory host renders slot text.
                                name=="" && c.has("label")->AWCSlotText(c.getString("label"))
                                name=="leading-icon" && slot.contains("slot=\"leading-icon\"")->AWCMaterialSymbol("favorite")
                                name=="trailing-icon" && slot.contains("slot=\"trailing-icon\"")->AWCMaterialSymbol("arrow_drop_down")
                                else->{} } }
                        } } }
                }
            }
        } } }
    } } }
    @Test fun buttonMatchesChromePaintAndGeometry() {
        content()
        // The default loader is an infinite animation: a manual clock keeps Compose idle between cases.
        compose.mainClock.autoAdvance=false
        for(c in CardWeb.document("ButtonWebPaint.json").getJSONArray("cases").objects()) run(c)
        AccordionEvidence.log("button-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        android.util.Log.i("AWCAccordion","button-paint case $name")
        collector.clear();case=c;epoch++;compose.mainClock.advanceTimeBy(96);compose.waitForIdle()
        val nodes=collector.snapshot().nodes;val node=nodes.firstOrNull { it.id=="component" }
        val s=c.getJSONObject("snap");val r=s.getJSONObject("rect");val b=node?.bounds
        if(b==null) { check(false,"$name measured");return }
        val tol=if(c.optString("dir")=="rtl") 1.0 else .6
        check(abs(b.x-r.getDouble("x"))<=tol && abs(b.y-r.getDouble("y"))<=.6 && abs(b.width-r.getDouble("width"))<=1.0 && abs(b.height-r.getDouble("height"))<=.6,"$name border box $b vs $r; parts ${nodes.filter { it.id.startsWith("component.") }.joinToString { "${it.id}=${it.bounds}" }}")
        val loading=s.optJSONObject("loading")?.getJSONObject("rect")
        val mask=if(loading==null) emptyList() else listOf(Rect(loading.getDouble("x").toFloat(),loading.getDouble("y").toFloat(),(loading.getDouble("x")+loading.getDouble("width")).toFloat(),(loading.getDouble("y")+loading.getDouble("height")).toFloat()))
        val clip=c.getJSONObject("clip")
        val nat=CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        val res=CardWeb.compare(CardWeb.webGrid("ButtonWebPaint/$name.png",clip),nat,mask)
        check(res.getInt("compared")>400 && res.getInt("over6").toDouble()/res.getInt("compared")<=.005 && res.getDouble("mean")<=1.0,"$name flat pixels $res");report.put(res.put("case",name).put("group",c.optString("group")))
    }
}
