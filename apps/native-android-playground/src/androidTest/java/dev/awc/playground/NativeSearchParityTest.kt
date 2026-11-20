package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.*
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
import kotlin.math.min

/**
 * md-search against Chrome 153 — the same fixtures as the SwiftUI NativeSearchPaintIntegration / NativeSearchStatesIntegration
 * (SearchWebPaint.json and the SearchWebPaint PNGs = Tests/Fixtures/search-web-paint(.json), SearchWebStates.json = search-web-states.json).
 * Paint (123 cases): theme × direction × variant × states, densities, elevation, full width, voice, no results, the hooks; every
 * part box, colour, corner, opacity and every flat pixel of the clip. States (9 runs, full and reduced motion): the oracle's
 * phases replayed at Chrome's times on the test clock (clicks, typing at Chrome's keystroke times, keys); per Chrome frame the
 * bar box / opacity and panel opacity inside the native envelope, per phase the end state (open, value, focus, status), the md*
 * events with their details.
 */
@OptIn(ExperimentalTestApi::class)
class NativeSearchParityTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf<JSONObject?>(null)
    private var props by mutableStateOf<Map<String,Any?>>(emptyMap())
    private var epoch by mutableIntStateOf(0)
    private var density by mutableFloatStateOf(2f)
    private var reduced by mutableStateOf(true)
    private val collector=AWCInspectionCollector()
    @Volatile private var values:Map<String,Map<String,Any?>> = emptyMap()
    private val controller=AWCSearchController()
    private var focusName:String?=null
    private val events=mutableListOf<Triple<String,Any?,Double>>()
    private var start=0L
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun px(s:String?)=s?.trim()?.removeSuffix("px")?.toDoubleOrNull()
    private fun camel(k:String)=k.removePrefix("--md-search-").split('-').mapIndexed { i,w-> if(i==0) w else w.replaceFirstChar { it.uppercase() } }.joinToString("")
    private fun hooks(h:JSONObject?):AWCSearchAppearance { if(h==null) return AWCSearchAppearance()
        val m=HashMap<String,Any?>();for(k in h.keys()) { val raw=h.getString(k);m[camel(k)]=px(raw) ?: raw.removeSuffix("ms").trim().toDoubleOrNull() ?: raw }
        return AWCSearchAppearance.fromValues(m) }
    /** The case's ::part() rules as the typed part appearance. */
    private fun partsOf(r:JSONObject?):AWCSearchPartAppearance { if(r==null) return AWCSearchPartAppearance()
        fun s(p:String,k:String)=r.optJSONObject(p)?.optString(k)?.takeIf { it.isNotEmpty() }
        fun d(p:String,k:String)=s(p,k)?.toDoubleOrNull()
        return AWCSearchPartAppearance(s("bar","background-color"),s("state-layer","background-color"),d("state-layer","opacity"),s("leading","background-color"),
            s("leading-state-layer","background-color"),d("leading-state-layer","opacity"),s("input","color"),s("input","caret-color"),s("trailing","background-color"),
            s("clear-button","background-color"),s("voice-button","background-color"),s("trigger-button","background-color"),s("divider","background-color"),
            s("panel","background-color"),s("empty","color"),s("results-viewport","background-color"),
            s("trigger","background-color"),s("panel-body","background-color"),s("results-host","background-color"),s("loading","background-color"),s("loading-shape","background-color"),s("status","background-color")) } // parts2
    private fun propsOf(c:JSONObject):Map<String,Any?> { val o=c.optJSONObject("props") ?: return emptyMap();val m=mutableMapOf<String,Any?>()
        for(k in o.keys()) m[k]=when(val v=o.get(k)) { is Number -> v.toDouble(); else -> v };m["id"]="search";return m }
    private fun rgba(css:String):List<Double> { val n=Regex("[-0-9.]+").findAll(css).map { it.value.toDouble() }.toList()
        return if(css.startsWith("color(srgb")) (n.take(3)+(n.getOrNull(3) ?: 1.0)) else if(css.startsWith("rgba")) listOf(n[0]/255,n[1]/255,n[2]/255,n[3]) else if(css.startsWith("rgb")) listOf(n[0]/255,n[1]/255,n[2]/255,1.0) else listOf(0.0,0.0,0.0,0.0) }
    private fun hexRgba(hex:String?):List<Double>? { val h=hex?.removePrefix("#") ?: return null;if(h.length!=6 && h.length!=8) return null
        val v=(0 until h.length/2).map { h.substring(it*2,it*2+2).toInt(16)/255.0 };return if(v.size==3) v+1.0 else v }
    private fun close(hex:Any?,css:String?,tol:Double=.012):Boolean { val b=rgba(css ?: return false)
        if(b[3]<=tol && ((hex as? String).isNullOrEmpty())) return true // a Chrome part with no background has no native paint
        val a=hexRgba(hex as? String) ?: return false
        val pa=listOf(a[0]*a[3],a[1]*a[3],a[2]*a[3],a[3]);val pb=listOf(b[0]*b[3],b[1]*b[3],b[2]*b[3],b[3]);return pa.zip(pb).all { abs(it.first-it.second)<=tol } }

    private val rows=listOf("alpha" to "Alpha","alpine" to "Alpine","alpaca" to "Alpaca")
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(density,1f)) {
        val c=case ?: return@CompositionLocalProvider
        AWCTheme(c.optString("theme")=="dark") { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            // Chrome's page: the 1200 × 900 viewport (full-screen views fill it; the device shows its first 1080 px) and the harness box
            // (position:absolute; left:24px; top:24px; inline-size:<width>; dir on the box), whatever the direction.
            // The page is recorded in a layer: paint cases read it in layout pixels (a window PixelCopy at density 1 came back
            // stretched ~4% vertically).
            val layer=rememberGraphicsLayer();pageLayer=layer;val pageBg=MaterialTheme.colorScheme.surface
            Box(Modifier.wrapContentSize(Alignment.TopStart,unbounded=true).requiredSize(1200.dp,900.dp).drawWithContent { layer.record { drawRect(pageBg);this@drawWithContent.drawContent() };drawLayer(layer) }) {
               // The box's direction reaches the modal layer too (a full-screen view inherits it from the host).
               CompositionLocalProvider(LocalLayoutDirection provides if(c.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                AWCModalScope(Modifier.fillMaxSize()) {
                 Box(Modifier.fillMaxSize(),contentAlignment=androidx.compose.ui.AbsoluteAlignment.TopLeft) {
                  Box(Modifier.absoluteOffset(24.dp,24.dp).width(c.optDouble("width",420.0).dp)) {
                   run {
                    Column(Modifier.fillMaxWidth()) {
                        // Chrome's page: an inline "before" button (21px line) or a two-line textarea (40px) above the search.
                        if(c.optBoolean("before")) Spacer(Modifier.size(60.dp,21.dp))
                        if(c.optBoolean("textarea")) { var text by remember { mutableStateOf("one\ntwo") }
                            BasicTextField(text,{ text=it },Modifier.size(180.dp,40.dp).onFocusChanged { if(it.isFocused) focusName="textarea#ta" else if(focusName=="textarea#ta") focusName=null }) }
                        Box(Modifier.fillMaxWidth()) {
                            AWCSearchReducedMotionScope(reduced) { AWCSearchAppearanceScope(hooks(c.optJSONObject("hooks"))) { AWCSearchPartAppearanceScope(partsOf(c.optJSONObject("partRules"))) { AWCSearchInspectionScope({ values=it }) {
                                AWCSearchControllerScope(controller) { AWCInspectionScope(collector) {
                                    AWCComponent("md-search",props,onEvent={ n,d-> if(n in ORACLE_EVENTS) events+=Triple(n,d,chromeNow()) }) { slot->
                                        if(slot=="trailing" && c.optBoolean("avatar")) AWCMaterialSymbol("account_circle")
                                        if(slot=="results" && c.optBoolean("list")) AWCComponent("md-list",emptyMap()) { s-> if(s=="") for((id,label) in rows) {
                                            AWCInspectionScope(collector,id) { AWCComponent("md-list-item",buildMap { put("headline",label);put("type","button")
                                                if(id=="alpha" && c.has("hooks")) put("supportingText","First result") },
                                                Modifier.onFocusChanged { if(it.hasFocus) focusName="md-list-item[$label]" else if(focusName=="md-list-item[$label]") focusName=null }) } } }
                                    }
                                } }
                            } } } }
                        }
                    }
                   }
                  }
                 }
                }
               }
            }
        } } }
    } } }

    // ── Paint ──────────────────────────────────────────────────────────────────────────────────────────────────────────
    /** ax finding (story 1-2): a disabled search with a value still exposes Clear search; shown open (the Web show() method has no disabled guard) it exposes the panel pane and the empty text. */
    @Test fun searchDisabledExposesClearAndPanel() {
        density=1f;reduced=true;content()
        compose.mainClock.autoAdvance=false
        val c=JSONObject("{\"name\":\"ax-disabled\",\"width\":560,\"props\":{\"layout\":\"docked\",\"placeholder\":\"Search projects\",\"value\":\"pro\",\"disabled\":true}}")
        compose.runOnIdle { case=c;props=propsOf(c);epoch++ };settle()
        fun count(d:String)=compose.onAllNodesWithContentDescription(d,useUnmergedTree=true).fetchSemanticsNodes().size
        fun text(t:String)=compose.onAllNodesWithText(t,useUnmergedTree=true).fetchSemanticsNodes().size
        val closedClear=count("Clear search")
        compose.runOnIdle { controller.show() };settle(100,8)
        val openClear=count("Clear search");val openEmpty=text("No results available")
        val panes=compose.onAllNodes(SemanticsMatcher.keyIsDefined(androidx.compose.ui.semantics.SemanticsProperties.PaneTitle),useUnmergedTree=true).fetchSemanticsNodes().size
        val msg="disabled closedClear=$closedClear openClear=$openClear openEmpty=$openEmpty panes=$panes"
        android.util.Log.i("AWCAccordion","search-disabled-ax $msg")
        assertTrue(msg,closedClear>0 && openClear>0 && openEmpty>0 && panes>0)
    }
    @Test fun searchMatchesChromePaint() {
        density=1f;reduced=true;content()
        // The loading indicator animates forever: the clock is stepped by hand (waitForIdle then only waits for recomposition).
        compose.mainClock.autoAdvance=false
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcOnly")
        for(c in CardWeb.document("SearchWebPaint.json").getJSONArray("cases").objects()) if(only==null || only.split(",").any { c.getString("name").contains(it) }) paint(c)
        // The ::part() reference (search-parts.html: 9 cases).
        for(c in CardWeb.document("SearchWebParts.json").getJSONArray("cases").objects()) if(only==null || only.split(",").any { c.getString("name").contains(it) }) paint(c,"SearchWebParts")
        AccordionEvidence.log("search-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(400))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    /** CardWeb.nativeGrid at density 1: one device pixel per CSS pixel. */
    private var captureScale=Pair(1.0,1.0)
    private var pageLayer:androidx.compose.ui.graphics.layer.GraphicsLayer?=null
    private fun grid1(map:androidx.compose.ui.graphics.PixelMap,x:Int,y:Int,w:Int,h:Int):CardWeb.Grid { val v=DoubleArray(w*h*3)
        for(py in 0 until h) for(px in 0 until w) { val X=((x+px+.5)*captureScale.first).toInt();val Y=((y+py+.5)*captureScale.second).toInt()
            if(X in 0 until map.width && Y in 0 until map.height) { val c=map[X,Y];v[(py*w+px)*3]=c.red*255.0;v[(py*w+px)*3+1]=c.green*255.0;v[(py*w+px)*3+2]=c.blue*255.0 }
            else for(k in 0..2) v[(py*w+px)*3+k]=-999.0 }
        return CardWeb.Grid(x,y,w,h,v) }
    private fun settle(ms:Long=64,times:Int=4) { repeat(times) { compose.mainClock.advanceTimeBy(ms);compose.waitForIdle() } }
    private fun paint(c:JSONObject,shots:String="SearchWebPaint") {
        val name=c.getString("name")
        android.util.Log.i("AWCAccordion","search-paint case $name")
        values=emptyMap();collector.clear()
        compose.runOnIdle { case=c;props=propsOf(c);epoch++ };settle()
        if(c.optBoolean("open")) { compose.runOnIdle { controller.show() };settle(100,8) }
        val nodes=collector.snapshot().nodes
        fun n(part:String)=nodes.firstOrNull { it.name==part && it.id.startsWith("component") }
        fun v(part:String,key:String)=values[part]?.get(key)
        fun near(a:Double,b:Double,label:String,tol:Double=.6)=check(abs(a-b)<=tol,"$name $label $a vs $b")
        fun rect(node:AWCInspectionNode?,r:JSONObject?,label:String,tol:Double=.6,wTol:Double=.6) { if(r==null) return
            if(node==null) { check(false,"$name $label missing");return }
            val b=node.bounds;near(b.x,r.getDouble("x"),"$label x",tol);near(b.y,r.getDouble("y"),"$label y",tol);near(b.width,r.getDouble("width"),"$label width",wTol);near(b.height,r.getDouble("height"),"$label height",tol) }
        val root=n("md-search");if(root==null) { check(false,"$name measured");compose.runOnIdle { controller.close() };return }
        val p=c.optJSONObject("props") ?: JSONObject()
        val open=c.optBoolean("open")
        check(v("","open")==open,"$name open ${v("","open")} vs $open")
        check((v("","status") ?: "")==c.optString("status"),"$name status ${v("","status")} vs ${c.optString("status")}")
        val fullScreenOpen=open && p.optString("layout","full-screen")=="full-screen"
        if(!fullScreenOpen) rect(root,c.optJSONObject("host"),"host",wTol=1.2)
        c.optJSONObject("bar")?.let { bar->
            rect(n("bar"),bar.optJSONObject("rect"),"bar")
            check(close(v("bar","background"),bar.optString("backgroundColor")),"$name bar colour ${v("bar","background")} vs ${bar.optString("backgroundColor")}")
            val h=bar.getJSONObject("rect").getDouble("height")
            near((v("bar","radiusTop") as? Double) ?: -1.0,min(px(bar.optString("borderTopLeftRadius")) ?: 0.0,h/2),"bar top radius",.01)
            near((v("bar","radiusBottom") as? Double) ?: -1.0,min(px(bar.optString("borderBottomLeftRadius")) ?: 0.0,h/2),"bar bottom radius",.01)
            near((v("bar","opacity") as? Double) ?: -1.0,bar.optString("opacity","1").toDoubleOrNull() ?: 1.0,"bar opacity",.001)
            val shadow=bar.optString("boxShadow","none");val visible=!shadow.startsWith("rgba(0, 0, 0, 0) 0px 0px 0px 0px") && shadow!="none"
            check(((v("bar","elevation") as? Int) ?: 0)==(if(visible) shadow.split("px, ").size else 0),"$name bar elevation layers ${v("bar","elevation")}")
            rect(n("leading"),c.optJSONObject("leading")?.optJSONObject("rect"),"leading")
            c.optJSONObject("leadingButton")?.let { lb-> rect(n("leading-button"),lb.optJSONObject("rect"),"leading button")
                check(v("leading-button","label")==lb.optString("label"),"$name leading label ${v("leading-button","label")} vs ${lb.optString("label")}") }
            c.optJSONObject("input")?.let { inp-> rect(n("input"),inp.optJSONObject("rect"),"input")
                check(v("input","value")==inp.optString("value"),"$name input value ${v("input","value")} vs ${inp.optString("value")}")
                check(v("input","label")==inp.optString("label"),"$name input name ${v("input","label")} vs ${inp.optString("label")}")
                check(v("input","expanded")==(inp.optString("expanded")=="true"),"$name input expanded")
                check(close(v("input","color"),inp.optString("color")),"$name input colour ${v("input","color")} vs ${inp.optString("color")}")
                near((v("input","fontSize") as? Double) ?: -1.0,px(inp.optString("fontSize")) ?: 0.0,"input font",.01) }
            c.optJSONObject("trailing")?.optJSONObject("rect")?.let { if(it.getDouble("height")>0) rect(n("trailing"),it,"trailing") }
        } ?: check(n("bar")==null,"$name no bar")
        c.optJSONObject("clear")?.let { cl-> rect(n("clear-button"),cl.optJSONObject("rect"),"clear button",1.0,1.0)
            near((v("clear-button","opacity") as? Double) ?: -1.0,cl.optString("opacity","1").toDoubleOrNull() ?: 1.0,"clear opacity",.01)
            check(close(v("clear-button","color"),cl.optString("color")),"$name clear colour ${v("clear-button","color")} vs ${cl.optString("color")}") }
            ?: check(n("clear-button")==null || ((v("clear-button","opacity") as? Double) ?: 0.0)==0.0,"$name no clear button")
        if(!c.isNull("voice") && c.has("voice")) rect(n("voice-button"),c.optJSONObject("voice")?.optJSONObject("rect"),"voice button") else check(n("voice-button")==null,"$name no voice button")
        if(!c.isNull("loading") && c.has("loading")) rect(n("loading"),c.optJSONObject("loading"),"loading") else check(n("loading")==null,"$name no loading indicator")
        if(!c.isNull("trigger") && c.has("trigger")) rect(n("trigger-button"),c.optJSONObject("trigger"),"trigger button") else check(n("trigger-button")==null,"$name no trigger button")
        c.optJSONObject("panel")?.let { panel-> val opacity=panel.optString("opacity","0").toDoubleOrNull() ?: 0.0
            near((v("panel","opacity") as? Double) ?: 0.0,opacity,"panel opacity",.01)
            if(opacity>0) { rect(n("panel"),panel.optJSONObject("rect"),"panel")
                check(close(v("panel","background"),panel.optString("backgroundColor")),"$name panel colour ${v("panel","background")} vs ${panel.optString("backgroundColor")}")
                if(p.optString("layout")=="docked") (v("panel","radiusTop") as? Double)?.let { top-> near(top,px(panel.optString("borderTopLeftRadius")) ?: 0.0,"panel top radius",.01)
                    near((v("panel","radiusBottom") as? Double) ?: -1.0,min(px(panel.optString("borderBottomLeftRadius")) ?: 0.0,28.0),"panel bottom radius",.01) } } }
        c.optJSONObject("divider")?.let { d-> rect(n("divider"),d.optJSONObject("rect"),"divider");check(close(v("divider","color"),d.optString("backgroundColor")),"$name divider colour") }
            ?: check(n("divider")==null,"$name no divider")
        c.optJSONObject("empty")?.let { e-> rect(n("empty"),e.optJSONObject("rect"),"empty state");check(v("empty","text")==e.optString("text"),"$name empty text")
            check(close(v("empty","color"),e.optString("color")),"$name empty colour") } ?: check(n("empty")==null,"$name no empty state")
        // ::part() cases: the typed parts' paint (backgrounds, layers, caret) as Chrome computes it.
        if(c.has("partRules") && !c.isNull("partRules")) {
            for((node,key) in listOf("leading" to "leading","trailing" to "trailing","clear-button" to "clear","voice-button" to "voice","trigger-button" to "triggerButton","results-viewport" to "viewport","panel-body" to "panelBody","results-host" to "resultsHost","loading" to "loadingPart")) {
                val o=c.optJSONObject(key) ?: continue;val bg=o.optString("backgroundColor").takeIf { it.isNotEmpty() } ?: continue
                if((o.optJSONObject("rect")?.optDouble("height",0.0) ?: 0.0)<=0.0) continue
                check(close(v(node,"background"),bg),"$name $node background ${v(node,"background")} vs $bg") }
            c.optJSONObject("stateLayer")?.let { sl-> if(n("bar")!=null) { check(close(v("bar","stateLayerColor"),sl.optString("backgroundColor")),"$name state layer colour ${v("bar","stateLayerColor")}")
                near((v("bar","stateLayer") as? Double) ?: -1.0,sl.optString("opacity").toDoubleOrNull() ?: 0.0,"state layer opacity",.01) } }
            c.optJSONObject("leadingStateLayer")?.let { sl-> if(n("leading-button")!=null) { check(close(v("leading-button","layer"),sl.optString("backgroundColor")),"$name leading state layer colour ${v("leading-button","layer")}")
                near((v("leading-button","layerOpacity") as? Double) ?: -1.0,sl.optString("opacity").toDoubleOrNull() ?: 0.0,"leading state layer opacity",.01) } }
            c.optJSONObject("input")?.let { inp-> check(close(v("input","caret"),inp.optString("caretColor")),"$name caret colour ${v("input","caret")} vs ${inp.optString("caretColor")}") }
        }
        val natRows=rows.mapNotNull { (id,_)-> nodes.firstOrNull { it.id==id } }
        if(open && c.optJSONObject("panel")?.optString("opacity")=="1") {
            val wr=c.optJSONArray("rows")?.objects() ?: emptyList()
            wr.forEachIndexed { i,r-> if(i<natRows.size) rect(natRows[i],r,"row $i",1.0,1.0) }
            check(natRows.size==wr.size || wr.isEmpty(),"$name rows ${natRows.size} vs ${wr.size}")
        }
        // Flat pixels of the clip (the 1200 × 900 viewport, like the page).
        val clip=JSONObject(c.getJSONObject("clip").toString()).let { k-> val x=k.getInt("x");if(x<0) k.put("x",0).put("width",k.getInt("width")+x) else k }
        compose.waitForIdle()
        val image=pageLayer?.let { l-> kotlinx.coroutines.runBlocking(kotlinx.coroutines.Dispatchers.Main) { l.toImageBitmap() } } ?: compose.onRoot().captureToImage()
        // The capture can be scaled against the root's layout (emulator window insets): sample it in layout pixels.
        val rootSize=compose.onRoot().fetchSemanticsNode().size
        captureScale=if(pageLayer!=null) Pair(1.0,1.0) else Pair(image.width.toDouble()/rootSize.width.coerceAtLeast(1),image.height.toDouble()/rootSize.height.coerceAtLeast(1))
        clip.put("width",min(clip.getInt("width"),min(1200,image.width)-clip.getInt("x"))).put("height",min(clip.getInt("height"),min(900,image.height)-clip.getInt("y")))
        val nat=grid1(image.toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height"))
        val res=CardWeb.compare(CardWeb.webGrid("$shots/$name.png",clip),nat)
        val flat=res.getInt("over6").toDouble()/res.getInt("compared").coerceAtLeast(1)<=.005 && res.getDouble("mean")<=1.0
        if(!flat) AccordionEvidence.png("search-native-$name",image)
        check(flat,"$name flat pixels $res capture scale ${"%.4f".format(captureScale.first)}×${"%.4f".format(captureScale.second)}");report.put(res.put("case",name))
        compose.runOnIdle { controller.close() };settle(100,10)
    }

    // ── States ─────────────────────────────────────────────────────────────────────────────────────────────────────────
    private fun chromeNow()=(compose.mainClock.currentTime-start)/SCALE
    companion object { const val SCALE=16.0/(50.0/3)
        /** The events the oracle records (md-list's own events bubble natively). */
        val ORACLE_EVENTS=setOf("mdInput","mdSearch","mdSubmit","mdChange","mdOpen","mdClose","mdClear","mdLeadingIconClick") }
    private data class Sample(val t:Double,val bar:AWCInspectionBounds?,val barOpacity:Double?,val panelOpacity:Double?,val focus:String,val root:Map<String,Any?>?)
    private fun focusPath():String = focusName ?: when {
        values["input"]?.get("focused")==true -> "md-search>input.md-search__input"
        values["leading-button"]?.get("focused")==true -> "md-search>button.md-search__leading-button"
        values["clear-button"]?.get("focused")==true -> "md-search>button.md-search__icon-button"
        values["trigger-button"]?.get("focused")==true -> "md-search>md-icon-button"
        else -> "body" }
    private fun sample(t:Double):Sample { val nodes=collector.snapshot().nodes
        val bar=nodes.firstOrNull { it.name=="bar" && it.id.startsWith("component") }?.bounds
        return Sample(t,bar,(values["bar"]?.get("barOpacity") as? Double),(values["panel"]?.get("opacity") as? Double),focusPath(),values[""]) }

    @Test fun searchMatchesChromeStates() {
        density=1f;content()
        val oracle=CardWeb.document("SearchWebStates.json")
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcRun")
        for((k,red) in listOf("runs" to false,"reduced" to true)) for(r in oracle.getJSONArray(k).objects()) if(only==null || r.getString("name").contains(only)) states(r,red)
        AccordionEvidence.log("search-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(400))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun states(r:JSONObject,red:Boolean) {
        val name=r.getString("name")+(if(red) " (reduced)" else "")
        compose.mainClock.autoAdvance=false
        compose.onRoot().performMouseInput { moveTo(Offset(1060f,800f)) }
        compose.runOnIdle { values=emptyMap();collector.clear();focusName=null;events.clear();reduced=red;case=r;props=propsOf(r).let { if(r.optBoolean("list")) it else it };epoch++ }
        settle(64,8)
        start=compose.mainClock.currentTime
        val phases=r.getJSONArray("phases").objects()
        val samples=ArrayList<Sample>()
        fun frame() { compose.mainClock.advanceTimeByFrame();samples+=sample(chromeNow()) }
        fun until(t:Double) { var g=0;while(chromeNow()<t-0.5 && g++<2000) frame() }
        fun centre(part:String)=collector.snapshot().nodes.firstOrNull { it.name==part && it.id.startsWith("component") }?.bounds?.let { Offset((it.x+it.width/2).toFloat(),(it.y+it.height/2).toFloat()) }
        fun click(q:Offset?) { if(q==null) { check(false,"$name click target missing");return };compose.onRoot().performMouseInput { moveTo(q,delayMillis=0);press() };frame();compose.onRoot().performMouseInput { release() } }
        fun windowClick(q:Offset) { val o=compose.onRoot().fetchSemanticsNode().positionOnScreen;val x=o.x+q.x;val y=o.y+q.y
            val inst=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation();val t0=android.os.SystemClock.uptimeMillis()
            inst.sendPointerSync(android.view.MotionEvent.obtain(t0,t0,android.view.MotionEvent.ACTION_DOWN,x,y,0).apply { source=android.view.InputDevice.SOURCE_MOUSE })
            frame()
            inst.sendPointerSync(android.view.MotionEvent.obtain(t0,t0+16,android.view.MotionEvent.ACTION_UP,x,y,0).apply { source=android.view.InputDevice.SOURCE_MOUSE }) }
        fun key(k:Key,shift:Boolean=false) { compose.onRoot().performKeyInput { if(shift) withKeyDown(Key.ShiftLeft) { keyDown(k);keyUp(k) } else { keyDown(k);keyUp(k) } } }
        val letters=mapOf('a' to Key.A,'l' to Key.L,'x' to Key.X)
        for((i,p) in phases.withIndex()) {
            val label=p.getString("label");val t0=p.getDouble("t")
            val next=if(i+1<phases.size) phases[i+1].getDouble("t") else t0+700
            until(t0)
            val phaseStart=chromeNow();val first=samples.size
            // Chrome's keystroke times in this phase: its mdInput events (one per key).
            val cadence=r.getJSONArray("events").objects().filter { it.getString("name")=="mdInput" && it.getDouble("t")>=t0 && it.getDouble("t")<next }.map { it.getDouble("t")-2 }.toMutableList()
            fun type(text:String) { for(ch in text) { if(cadence.isNotEmpty()) until(cadence.removeAt(0));letters[ch]?.let { key(it) };frame() } }
            when(label) {
                "click-bar-focus","click-bar","click-bar-opens" -> click(centre("bar"))
                "type-al-opens","type-al" -> type("al")
                "type-x-opens" -> type("x")
                "ArrowDown","ArrowDown-in-textarea" -> key(Key.DirectionDown)
                "ArrowUp","ArrowUp-to-input" -> key(Key.DirectionUp)
                "Enter-submit" -> key(Key.Enter)
                "Escape-closes","Escape-in-textarea" -> key(Key.Escape)
                "Tab","Tab-wraps" -> key(Key.Tab)
                "Shift+Tab-wraps-back" -> key(Key.Tab,true)
                "click-icon-opens" -> click(centre("trigger-button"))
                "leading-back-closes" -> click(centre("leading-button"))
                "loading-on" -> compose.runOnIdle { props=props+("loading" to true) }
                "loading-off" -> compose.runOnIdle { props=props+("loading" to false) }
                "click-clear" -> click(centre("clear-button"))
                // Chrome (1100, 700): outside the search. Outside presses reach the search through the window (its window-level
                // listener), so this one goes in through the instrumentation, not the Compose root.
                "outside-click-closes" -> windowClick(Offset(1060f,700f))
                "focus-textarea" -> click(Offset(24f+90f,24f+(if(r.optBoolean("before")) 21f else 0f)+20f))
                else -> check(false,"$name unknown phase $label")
            }
            until(next)
            val got=samples.subList(first,samples.size).map { it.copy(t=it.t-phaseStart) }
            val prev=samples.subList(0,first).map { it.copy(t=it.t-phaseStart) }.filter { it.t>=-45 }
            val all=prev+got
            fun envelope(t:Double,read:(Sample)->Double?):Pair<Double,Double>? { val vs=all.filter { it.t>=t-40 && it.t<=t+34 }.mapNotNull(read);if(vs.isEmpty()) return null;return vs.min() to vs.max() }
            var motion=0;var bad=0
            // Chrome's frame times are run times; the native frames are in phase time.
            for(s in p.getJSONArray("samples").objects()) { val t=s.getDouble("t")-t0
                fun within(want:Double?,tol:Double,label2:String,read:(Sample)->Double?) { if(want==null) return;val env=envelope(t,read) ?: return;motion++
                    if(want<env.first-tol || want>env.second+tol) { bad++;if(bad<=4) failures+="  $name $label t=${t.toInt()} $label2 $want not in $env" } }
                s.optJSONObject("bar")?.let { b-> if(b.optDouble("opacity",0.0)>0.02) { val rr=b.getJSONObject("rect")
                    within(rr.getDouble("x"),1.0,"bar x") { it.bar?.x };within(rr.getDouble("width"),1.0,"bar width") { it.bar?.width }
                    within(b.getDouble("opacity"),.04,"bar opacity") { sm-> sm.bar?.let { sm.barOpacity ?: 1.0 } } } }
                s.optJSONObject("panel")?.let { pn-> within(pn.getDouble("opacity"),.04,"panel opacity") { it.panelOpacity ?: 0.0 } }
            }
            check(bad==0,"$name $label motion: $bad/$motion frames outside the envelope")
            if(bad>0) failures+="  DBG $name $label native "+all.filter { it.t>=-20 && it.t<=200 }.joinToString(" ") { "t${it.t.toInt()}:x${it.bar?.x?.let { v-> "%.1f".format(v) }},w${it.bar?.width?.let { v-> "%.1f".format(v) }},o${it.barOpacity?.let { v-> "%.2f".format(v) }},p${it.panelOpacity?.let { v-> "%.2f".format(v) }},${it.focus.takeLast(12)}" }
            report.put(JSONObject().put("run",name).put("phase",label).put("frames",motion).put("outside",bad))
            val lastS=p.getJSONArray("samples").objects().lastOrNull() ?: continue
            val fin=samples.lastOrNull() ?: continue
            check(fin.root?.get("open")==lastS.optBoolean("open"),"$name $label open ${fin.root?.get("open")} vs ${lastS.opt("open")}")
            check((fin.root?.get("value") ?: "-")==lastS.optString("value"),"$name $label value ${fin.root?.get("value")} vs ${lastS.optString("value")}")
            val webFocus=lastS.optString("focus").replace(">span","").replace("md-icon-button.md-search__trigger-button","md-icon-button")
            check(fin.focus==webFocus,"$name $label focus ${fin.focus} vs $webFocus")
            if(fin.focus!=webFocus) failures+="  DBG focusLog ${fin.root?.get("focusLog")}"
            check((fin.root?.get("status") ?: "")==lastS.optString("status"),"$name $label status ${fin.root?.get("status")} vs ${lastS.optString("status")}")
        }
        val web=r.getJSONArray("events").objects()
        check(events.size==web.size,"$name ${events.size} md events vs ${web.size}: native ${events.map { "${it.first} ${it.second}" }}")
        for((i,w) in web.withIndex()) { val n=events.getOrNull(i) ?: break
            check(w.getString("name")==n.first,"$name event $i ${n.first} vs ${w.getString("name")}")
            if(!w.isNull("detail")) { val want=w.get("detail").toString().replace(" ","");val mine=JSONObject.wrap(n.second).toString().replace(" ","")
                check(want==mine,"$name event $i ${n.first} detail $mine vs $want") } }
        compose.runOnIdle { controller.close() };settle(64,15)
    }
}
