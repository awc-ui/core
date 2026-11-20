package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.performTextReplacement
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

/* SelectWeb (NativeSelectPaintTest.kt) renders the trees. */
/**
 * md-autocomplete paint and geometry against Chrome 153 (Mac oracle web-paint.json, 60 cases from picker-paint.html acCases;
 * shared fixture ac-web-paint.json). The compiled AWCNode trees render through the production AWCComponent dispatch inside an
 * AWCMenuScope sized to the oracle viewport; typed-open cases focus the input and type as the page does. The host box, every
 * [part] box of the autocomplete's shadow root (field, clear, caret, loading spinner, chips, chip, menu, options, option icons,
 * loading row), the selected options, and every flat pixel of the clipped Chrome screenshot (DPR 1 vs density 2, 2×2
 * averaged) are compared.
 */
class NativeAutocompletePaintTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"nodes\":[],\"viewport\":[1200,900]}"))
    private var epoch by mutableIntStateOf(0)
    private var shift by mutableFloatStateOf(0f)
    private var scope=AWCMenuScopeState()
    private val collector=AWCInspectionCollector()
    private val inspection=AWCMenuInspection()
    private var controller=AWCAutocompleteController()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        // Chrome has no on-screen keyboard: the focused input must not pan or resize the scene (the test activity's default
        // soft-input mode does once the emulator's IME shows for a focused field).
        val imeHost=androidx.compose.ui.platform.LocalView.current
        androidx.compose.runtime.SideEffect { var ctx=imeHost.context;while(ctx is android.content.ContextWrapper && ctx !is android.app.Activity) ctx=ctx.baseContext
            (ctx as? android.app.Activity)?.window?.setSoftInputMode(
            android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING or android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN) }
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
                        AWCAutocompleteAppearanceScope(AWCAutocompleteAppearance.fromCss(MenuWeb.hooks(c))) { AWCAutocompleteControllerScope(controller) { AWCMenuReducedMotionScope(false) { AWCFieldReducedMotionScope(false) { AWCMenuInspectionScope(inspection) {
                            for(n in nodes) Box(Modifier.absoluteOffset(24.dp,host[1].dp).width(width.dp)) {
                                CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                    Box(Modifier.align(if(rtl) Alignment.TopEnd else Alignment.TopStart)) {
                                        // Typed-open cases type after mount (the typing gate filters only typed text); the others open through `open`.
                                        AWCInspectionScope(collector,n.id) { SelectWeb.Render(n) { x-> if(x.id!="m") emptyMap() else if(!c.isNull("typed")) mapOf("inputValue" to "") else if(open) mapOf("open" to true) else emptyMap() } }
                                    }
                                }
                            }
                        } } } } }
                    }
                }
            }
        } }
    } } }
    @Test fun autocompleteMatchesChromePaintAndGeometry() {
        // The paused frame clock: md-loading-indicator's endless frame loop would otherwise keep Compose busy forever.
        content();compose.mainClock.autoAdvance=false
        val oracle=CardWeb.document("ac-web-paint.json")
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("acPaintOnly")
        for(c in oracle.getJSONArray("cases").objects()) if(only==null || only.split(',').any { c.getString("name").contains(it) }) run(c)
        val out=JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("report",report)
        SelectWeb.log("ac-paint",out)
        android.util.Log.i("AWCSelect","ac-paint ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun near(b:AWCInspectionBounds?,r:List<Double>,tol:Double)=b!=null && abs(b.x-r[0])<=tol && abs(b.y-r[1])<=tol && abs(b.width-r[2])<=tol && abs(b.height-r[3])<=tol
    private fun d(b:AWCInspectionBounds?)=b?.let { "(%.2f,%.2f,%.2f,%.2f)".format(it.x,it.y,it.width,it.height) } ?: "nil"
    /** A closed autocomplete keeps its md-menu mounted on the Web (opacity 0, scaled 0.8); natively the menu is not
     *  mounted, so the parts inside the menu are compared only while it is open. */
    private val inMenu=setOf("menu","option","option option-selected","option-icon","loading","loading-progress")
    private fun compare(t:JSONObject,name:String,m:Map<String,AWCInspectionNode>,open:Boolean) {
        val web=MenuWeb.rect(t.optJSONObject("rect"))
        check(near(m["m"]?.bounds,web,.75),"$name md-autocomplete ${d(m["m"]?.bounds)} vs $web")
        val parts=(t.optJSONArray("parts") ?: JSONArray()).objects().filter { it.optString("display")!="none" && it.optString("visibility")!="hidden" &&
            it.optString("part")!="live-region" && (open || it.optString("part") !in inMenu) }
        val options=parts.filter { it.optString("part").startsWith("option") && it.optString("part")!="option-icon" }
        var chip=0
        // Rows carry the option's index in the full list (stable across filtering): the k-th visible row is the k-th id present.
        val rowIds=(0 until 12).map { "m::opt$it" }.filter { m[it]!=null }
        fun row(k:Int)=rowIds.getOrNull(k) ?: "m::none"
        for(p in parts) {
            val part=p.getString("part");val r=MenuWeb.rect(p.optJSONObject("rect"))
            if(r[2]<=0 || r[3]<=0) continue
            val got:AWCInspectionBounds?=when(part) {
                "menu"->m["m::menu"]?.bounds
                "listbox"->{ val rows=rowIds.mapNotNull { m[it]?.bounds }
                    if(rows.isEmpty()) null else { val x0=rows.minOf { it.x };val y0=rows.minOf { it.y };AWCInspectionBounds(x0,y0,rows.maxOf { it.x+it.width }-x0,rows.maxOf { it.y+it.height }-y0) } }
                "option","option option-selected"->{
                    val k=options.indexOfFirst { MenuWeb.rect(it.optJSONObject("rect"))==r }
                    if(part.endsWith("selected")) check(inspection.rows[row(k)]?.get("selected")==true,"$name option $k selected")
                    m[row(k)]?.bounds }
                "option-icon"->{
                    val cx=r[0]+r[2]/2;val cy=r[1]+r[3]/2
                    val k=options.indexOfFirst { val o=MenuWeb.rect(it.optJSONObject("rect"));cx>=o[0] && cx<=o[0]+o[2] && cy>=o[1] && cy<=o[1]+o[3] }
                    m["${row(k)}.option-icon"]?.bounds }
                "chip"->m["m.chip-${chip++}"]?.bounds
                else->m["m.$part"]?.bounds
            }
            check(near(got,r,.75),"$name $part ${d(got)} vs $r")
        }
    }
    private fun settle(ms:Long) { compose.waitForIdle();compose.mainClock.advanceTimeBy(ms);compose.waitForIdle() }
    private fun run(c:JSONObject) {
        val name=c.getString("name");val open=c.optBoolean("open")
        shift=0f;scope=AWCMenuScopeState();collector.clear();inspection.clear();controller=AWCAutocompleteController();case=c;epoch++
        settle(600)
        if(c.optBoolean("focused")) { compose.runOnIdle { controller.focusInput() };settle(100) }
        // One user edit through the field's own text path (BasicTextField's SetText action → onValueChange → mdInput → filter).
        if(!c.isNull("typed")) { val typed=c.getString("typed");compose.onAllNodes(hasSetTextAction())[0].performTextReplacement(typed);settle(600) }
        else if(open) settle(600)
        val nodes=collector.snapshot().nodes.associateBy { it.id }
        if(System.getProperty("awc.select.debug")!=null) nodes.values.sortedBy { it.id }.forEach { android.util.Log.i("AWCSelect","  ${it.id} ${d(it.bounds)}") }
        compare(c.getJSONObject("tree"),name,nodes,open)
        if(!open) check(nodes["m::menu.surface"]==null,"$name closed autocomplete paints no menu")
        val clip=c.getJSONObject("clip")
        val nat=MenuEvidence.capture(compose,clip) { shift=it;compose.waitForIdle() }
        shift=0f
        val web=CardWeb.webGrid("ac-web-paint/$name.png",clip)
        val r=CardWeb.compare(web,nat)
        val area=max(1,(clip.getInt("width")-2)*(clip.getInt("height")-2))
        check(r.getInt("compared").toDouble()/area>.4,"$name flat-pixel coverage ${r.getInt("compared")}")
        val pixelsOK=r.getInt("over6").toDouble()/max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0
        check(pixelsOK,"$name flat pixels $r")
        // Evidence for a pixel failure: the whole scene, saved next to the report (files/select/shots).
        if(!pixelsOK) {
            val bmp=compose.onRoot().captureToImage().asAndroidBitmap()
            val dir=java.io.File(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"select/shots").apply { mkdirs() }
            java.io.File(dir,"paint-$name.png").outputStream().use { bmp.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) } }
        report.put(r.put("case",name))
        android.util.Log.i("AWCSelect","ac case $name: ${checks-failures.size}/$checks")
    }
}
