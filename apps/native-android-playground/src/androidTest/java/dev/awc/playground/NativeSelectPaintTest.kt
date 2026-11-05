package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.createComposeRule
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
import kotlin.math.max

/** Shared md-select oracle plumbing (fixtures byte-identical to the Swift Tests/Fixtures copies). */
internal object SelectWeb {
    /** md-select / md-select-option nodes render through AWCComponent; `#text` is slotted text, `#symbol` a slotted glyph. */
    @Composable fun Render(n:MenuWeb.Node,extra:(MenuWeb.Node)->Map<String,Any?> = { emptyMap() }) {
        when(n.tag) {
            "#text"->AWCSlotText(n.props.optString("text"))
            "#symbol"->AWCMaterialSymbol(n.props.optString("name"))
            else->AWCComponent(n.tag,MenuWeb.props(n,extra(n))) { slot-> n.children.filter { it.slot==slot }.forEach { Render(it,extra) } }
        }
    }
    private val dir get()=java.io.File(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"select").apply { mkdirs() }
    fun log(name:String,json:JSONObject) { java.io.File(dir,"$name.json").writeText(json.toString(1)) }
}

/**
 * md-select paint and geometry against Chrome 153 (Mac oracle web-paint.json, 197 cases from picker-paint.html; shared
 * fixture select-web-paint.json). The compiled AWCNode trees render through the production AWCComponent dispatch inside an
 * AWCMenuScope sized to the oracle viewport. The host box, every [part] box of the select's shadow root (field, trailing,
 * caret, clear, spinner, menu, options, option icons, search, loading bar), the selected option, and every flat pixel of
 * the clipped Chrome screenshot (DPR 1 vs density 2, 2×2 averaged) are compared.
 */
class NativeSelectPaintTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"nodes\":[],\"viewport\":[1200,900]}"))
    private var epoch by mutableIntStateOf(0)
    private var shift by mutableFloatStateOf(0f)
    private var scope=AWCMenuScopeState()
    private val collector=AWCInspectionCollector()
    private val inspection=AWCMenuInspection()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val tokens=MenuWeb.tokens(c)
        val vp=c.optJSONArray("viewport");val vw=vp?.optDouble(0,1200.0) ?: 1200.0;val vh=vp?.optDouble(1,900.0) ?: 900.0
        val rtl=c.optString("dir")=="rtl";val open=c.optBoolean("open")
        val nodes=MenuWeb.nodes(c.optJSONArray("nodes") ?: JSONArray())
        val host=MenuWeb.rect(c.optJSONObject("tree")?.optJSONObject("rect"));val width=c.optDouble("width",320.0)
        AWCTheme(c.optString("theme")=="dark",emptyMap()) { key(epoch) {
            val surface=MenuWeb.hex(tokens["--md-sys-color-surface"] ?: "#FEF7FF")
            Box(Modifier.fillMaxSize().background(surface)) {
                Box(Modifier.wrapContentSize(Alignment.TopStart,unbounded=true).requiredSize(vw.dp,vh.dp).graphicsLayer { translationX=-shift*2 }) {
                    AWCMenuScope(scope,Modifier.fillMaxSize().background(surface)) {
                        AWCSelectAppearanceScope(AWCSelectAppearance.fromCss(MenuWeb.hooks(c))) { AWCMenuReducedMotionScope(false) { AWCFieldReducedMotionScope(false) { AWCMenuInspectionScope(inspection) {
                            for(n in nodes) Box(Modifier.absoluteOffset(24.dp,host[1].dp).width(width.dp)) {
                                CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                    Box(Modifier.align(if(rtl) Alignment.TopEnd else Alignment.TopStart)) {
                                        AWCInspectionScope(collector,n.id) { SelectWeb.Render(n) { x-> if(x.id=="m" && open) mapOf("open" to true) else emptyMap() } }
                                    }
                                }
                            }
                        } } } }
                    }
                }
            }
        } }
    } } }
    @Test fun selectMatchesChromePaintAndGeometry() {
        // The paused frame clock: md-loading-indicator's endless frame loop would otherwise keep Compose busy forever.
        content();compose.mainClock.autoAdvance=false
        val oracle=CardWeb.document("select-web-paint.json")
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("selectPaintOnly")
        for(c in oracle.getJSONArray("cases").objects()) if(only==null || only.split(',').any { c.getString("name").contains(it) }) run(c)
        val out=JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("report",report)
        SelectWeb.log("select-paint",out)
        android.util.Log.i("AWCSelect","select-paint ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun near(b:AWCInspectionBounds?,r:List<Double>,tol:Double)=b!=null && abs(b.x-r[0])<=tol && abs(b.y-r[1])<=tol && abs(b.width-r[2])<=tol && abs(b.height-r[3])<=tol
    private fun d(b:AWCInspectionBounds?)=b?.let { "(%.2f,%.2f,%.2f,%.2f)".format(it.x,it.y,it.width,it.height) } ?: "nil"
    /** A closed select keeps its md-menu mounted on the Web (opacity 0, scaled 0.8); natively the menu is not mounted, so
     *  the parts inside the menu are compared only while it is open. */
    private val inMenu=setOf("menu","option","option option-selected","option-icon","loading-bar","loading-progress","search","search-wrap")
    private fun compare(t:JSONObject,name:String,m:Map<String,AWCInspectionNode>,open:Boolean) {
        val web=MenuWeb.rect(t.optJSONObject("rect"))
        check(near(m["m"]?.bounds,web,.75),"$name md-select ${d(m["m"]?.bounds)} vs $web")
        val parts=(t.optJSONArray("parts") ?: JSONArray()).objects().filter { it.optString("display")!="none" && it.optString("visibility")!="hidden" && (open || it.optString("part") !in inMenu) }
        val options=parts.filter { it.optString("part").startsWith("option") && it.optString("part")!="option-icon" }
        for(p in parts) {
            val part=p.getString("part");val r=MenuWeb.rect(p.optJSONObject("rect"))
            if(r[2]<=0 || r[3]<=0) continue
            val id=when(part) {
                "menu"->"m::menu"
                "option","option option-selected"->{
                    val k=options.indexOfFirst { MenuWeb.rect(it.optJSONObject("rect"))==r }
                    if(part.endsWith("selected")) check(inspection.rows["m::opt$k"]?.get("selected")==true,"$name option $k selected")
                    "m::opt$k" }
                "option-icon"->{
                    val cx=r[0]+r[2]/2;val cy=r[1]+r[3]/2
                    val k=options.indexOfFirst { val o=MenuWeb.rect(it.optJSONObject("rect"));cx>=o[0] && cx<=o[0]+o[2] && cy>=o[1] && cy<=o[1]+o[3] }
                    "m::opt$k.leading-icon" }
                else->"m.$part"
            }
            check(near(m[id]?.bounds,r,if(part=="search") 1.0 else .75),"$name $part ${d(m[id]?.bounds)} vs $r")
        }
    }
    private fun settle(ms:Long) { compose.waitForIdle();compose.mainClock.advanceTimeBy(ms);compose.waitForIdle() }
    private fun run(c:JSONObject) {
        val name=c.getString("name");val open=c.optBoolean("open")
        shift=0f;scope=AWCMenuScopeState();collector.clear();inspection.clear();case=c;epoch++
        settle(600)
        if(open) settle(600)
        val nodes=collector.snapshot().nodes.associateBy { it.id }
        if(System.getProperty("awc.select.debug")!=null) nodes.values.sortedBy { it.id }.forEach { android.util.Log.i("AWCSelect","  ${it.id} ${d(it.bounds)}") }
        compare(c.getJSONObject("tree"),name,nodes,open)
        if(!open) check(nodes["m::menu.surface"]==null,"$name closed select paints no menu")
        val clip=c.getJSONObject("clip")
        val nat=MenuEvidence.capture(compose,clip) { shift=it;compose.waitForIdle() }
        shift=0f
        val web=CardWeb.webGrid("select-web-paint/$name.png",clip)
        val r=CardWeb.compare(web,nat)
        val area=max(1,(clip.getInt("width")-2)*(clip.getInt("height")-2))
        check(r.getInt("compared").toDouble()/area>.4,"$name flat-pixel coverage ${r.getInt("compared")}")
        check(r.getInt("over6").toDouble()/max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0,"$name flat pixels $r")
        report.put(r.put("case",name))
        android.util.Log.i("AWCSelect","case $name: ${checks-failures.size}/$checks")
    }
}
