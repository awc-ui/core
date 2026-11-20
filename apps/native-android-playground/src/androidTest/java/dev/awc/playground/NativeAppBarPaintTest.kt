package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
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
import kotlin.math.min

/** Shared md-app-bar oracle plumbing: the AWCNode trees of the shared fixtures (byte-identical to the Swift ones). */
internal object AppBarWeb {
    class Node(val id:String,val tag:String,val props:JSONObject,val children:List<Node>,val slot:String)
    fun node(n:JSONObject):Node=Node(n.optString("id"),n.getString("tag"),n.optJSONObject("properties") ?: JSONObject(),
        (n.optJSONArray("children") ?: JSONArray()).objects().map { node(it) },n.optString("slot",""))
    fun props(n:Node,extra:Map<String,Any?> = emptyMap()):Map<String,Any?> {
        val out=mutableMapOf<String,Any?>()
        for(k in n.props.keys()) { val v=n.props.get(k);out[k]=if(v==JSONObject.NULL) null else v }
        return out+(if(n.id.isEmpty()) emptyMap() else mapOf("id" to n.id))+extra
    }
    fun hex(h:String):Color { val v=h.removePrefix("#");val n=v.toLong(16);return if(v.length==8) Color(((n and 255) shl 24) or (n shr 8)) else Color(0xff000000L or n) }
    fun runs(n:Node):AnnotatedString=buildAnnotatedString {
        fun walk(x:Node,bold:Boolean) { if(x.tag=="#text") { if(bold) withStyle(SpanStyle(fontWeight=FontWeight.Bold)) { append(x.props.optString("text")) } else append(x.props.optString("text")) }
            else x.children.forEach { walk(it,bold || x.tag=="b" || x.tag=="strong") } }
        walk(n,false)
    }
    /** Slotted text (`<span slot>` with `<b>` runs) in the slot's inherited text style: one line in a small bar's title/subtitle. */
    @Composable fun Render(n:Node,collector:AWCInspectionCollector,oneLine:Boolean,modifier:Modifier=Modifier) {
        when {
            n.tag=="#text" || n.tag=="span" || n.tag=="b" || n.tag=="strong"->BasicText(runs(n),modifier,style=LocalTextStyle.current,maxLines=if(oneLine) 1 else Int.MAX_VALUE,
                softWrap=!oneLine,overflow=if(oneLine) TextOverflow.Ellipsis else TextOverflow.Clip)
            else->AWCInspectionScope(collector,n.id) {
                AWCComponent(n.tag,props(n),modifier) { slot-> n.children.filter { it.slot==slot }.forEach { Render(it,collector,oneLine) } }
            }
        }
    }
    fun tokens(dark:Boolean):Map<String,String> = if(dark) dev.awc.nativeui.generated.AWCGeneratedTokens.dark else dev.awc.nativeui.generated.AWCGeneratedTokens.light
}

/** Evidence files and segmented captures (the device is narrower than the 1200 px page: the scene shifts, layout does not). */
internal object AppBarEvidence {
    private val dir get()=java.io.File(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"appbar").apply { mkdirs() }
    fun log(name:String,json:JSONObject) { java.io.File(dir,"$name.json").writeText(json.toString(1)) }
    fun capture(compose:androidx.compose.ui.test.junit4.ComposeContentTestRule,clip:JSONObject,setShift:(Float)->Unit):CardWeb.Grid {
        val x=clip.getInt("x");val y=clip.getInt("y");val w=clip.getInt("width");val h=clip.getInt("height")
        val v=DoubleArray(w*h*3) { -999.0 }
        var seg=x
        while(seg<x+w) {
            val s=max(0,seg-8);setShift(s.toFloat())
            val map=compose.onRoot().captureToImage().toPixelMap()
            val end=min(x+w,s+(map.width/2)-2)
            val part=CardWeb.nativeGrid(map,seg-s,y,end-seg,h)
            for(py in 0 until h) for(px in 0 until end-seg) for(k in 0..2) v[(py*w+(px+seg-x))*3+k]=part.v[(py*(end-seg)+px)*3+k]
            seg=end
        }
        return CardWeb.Grid(x,y,w,h,v)
    }
}

/**
 * md-app-bar paint and geometry against Chrome 153 (Mac oracle web-paint.json, 156 cases from paint.html; shared fixture
 * app-bar-web-paint.json). Each case's bar (an AWCNode tree through the production AWCComponent dispatch) sits at (40, 40) in a
 * 1200 × 900 page, the case's width wide: host, row, leading, title, subtitle, trailing, expanded block, search host / pill /
 * field / input / in-pill trailing and every child's box, and every flat pixel of the clipped Chrome shot (DPR 1 vs density 2,
 * 2×2 averaged) are compared. app-bar-web-paint-parts.json (n5's capture of rules in the typed part vocabulary) applies each
 * case's rules through the public AWCAppBarPartAppearanceScope and compares its pixels too; n2's three earlier parts cases
 * (outline / shorthand rules outside the shared vocabulary) stay geometry-only.
 */
class NativeAppBarPaintTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\",\"node\":{\"id\":\"ab\",\"tag\":\"md-app-bar\",\"properties\":{\"hidden\":true}}}"))
    private var epoch by mutableIntStateOf(0)
    private var shift by mutableFloatStateOf(0f)
    private val collector=AWCInspectionCollector()
    private val probe=AWCAppBarInspection()
    private var parts by mutableStateOf<List<Pair<AWCAppBarPart,AWCAccordionPartAppearance>>>(emptyList())
    private var shotDir="app-bar-web-paint"
    @Composable private fun Parts(list:List<Pair<AWCAppBarPart,AWCAccordionPartAppearance>>,body:@Composable ()->Unit) {
        if(list.isEmpty()) body() else AWCAppBarPartAppearanceScope(list[0].first,list[0].second) { Parts(list.drop(1),body) }
    }
    private fun jsonValues(o:JSONObject):Map<String,Any?> =o.keys().asSequence().associateWith { k-> when(val v=o.get(k)) { is JSONObject->jsonValues(v);is Number->v.toDouble();else->v } }
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val dark=c.optString("theme")=="dark";val tokens=AppBarWeb.tokens(dark)
        val rtl=c.optString("dir")=="rtl";val width=c.optDouble("width",720.0)
        val bar=AppBarWeb.node(c.getJSONObject("node"))
        val hooks=c.optJSONObject("hooks")?.let { h-> h.keys().asSequence().associateWith { h.getString(it) } } ?: emptyMap()
        val inherited=c.optDouble("inheritedDensity",0.0).takeIf { !it.isNaN() } ?: 0.0
        val oneLine=bar.props.optString("variant","small") !in setOf("medium","large")
        AWCTheme(dark,emptyMap()) { key(epoch) {
            val page=AppBarWeb.hex(tokens["--md-sys-color-surface-container-lowest"] ?: "#FFFFFF")
            Box(Modifier.fillMaxSize().background(page)) {
                Box(Modifier.wrapContentSize(Alignment.TopStart,unbounded=true).requiredSize(1200.dp,900.dp).background(page).graphicsLayer { translationX=-shift*2 }) {
                    Box(Modifier.absoluteOffset(40.dp,40.dp).width(width.dp)) {
                        AWCAppBarAppearanceScope(AWCAppBarAppearance.fromCss(hooks)) { AWCDensityScope(inherited) { AWCAppBarReducedMotionScope(false) { AWCAppBarInspectionScope(probe) {
                            CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                AWCInspectionScope(collector,"ab") { Parts(parts) {
                                    AWCComponent(bar.tag,AppBarWeb.props(bar)) { slot-> bar.children.filter { it.slot==slot }.forEach { AppBarWeb.Render(it,collector,oneLine) } }
                                } }
                            }
                        } } } }
                    }
                }
            }
        } }
    } } }
    @Test fun appBarMatchesChromePaintAndGeometry() {
        content()
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("appBarPaintOnly")
        for(file in listOf("app-bar-web-paint","app-bar-web-paint-parts")) {
            val oracle=CardWeb.document("$file.json");shotDir=file
            for(c in oracle.getJSONArray("cases").objects()) if(only==null || only.split(',').any { c.getString("name").contains(it) }) run(c)
        }
        val out=JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("report",report)
        AppBarEvidence.log("app-bar-paint",out)
        android.util.Log.i("AWCAppBar","app-bar-paint ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun rect(o:JSONObject?)=o?.let { listOf(it.optDouble("x",0.0),it.optDouble("y",0.0),it.optDouble("width",0.0),it.optDouble("height",0.0)) }
    private fun near(b:AWCInspectionBounds?,r:List<Double>,tol:Double)=b!=null && abs(b.x-r[0])<=tol && abs(b.y-r[1])<=tol && abs(b.width-r[2])<=tol && abs(b.height-r[3])<=tol
    private fun d(b:AWCInspectionBounds?)=b?.let { "(%.2f,%.2f,%.2f,%.2f)".format(it.x,it.y,it.width,it.height) } ?: "nil"
    private fun box(name:String,label:String,web:JSONObject?,n:AWCInspectionNode?,tol:Double=.75) {
        val r=rect(web) ?: return
        // A zero-size Chrome box (an empty leading / trailing slot) has no native counterpart to inspect.
        if(r[2]<=0 && r[3]<=0 && (n==null || (n.bounds.width<.5 && n.bounds.height<.5))) { checks++;return }
        check(near(n?.bounds,r,tol),"$name $label ${d(n?.bounds)} vs $r")
    }
    private fun settle(ms:Long) { compose.waitForIdle();compose.mainClock.advanceTimeBy(ms);compose.waitForIdle() }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        parts=c.optJSONObject("partsValues")?.let { o-> o.keys().asSequence().sorted().map { k-> val p=AWCAppBarPart.fromSource(k)
            check(p!=null,"$name part $k is a typed part");p to AWCAccordionPartAppearance.fromValues(jsonValues(o.getJSONObject(k))) }.mapNotNull { (p,v)-> p?.let { it to v } }.toList() } ?: emptyList()
        shift=0f;collector.clear();probe.bars.clear();case=c;epoch++
        settle(600)
        val nodes=collector.snapshot().nodes.associateBy { it.id }
        val s=c.optJSONObject("snap") ?: JSONObject()
        if(c.optBoolean("hidden")) { check(nodes["ab"]==null || nodes["ab"]!!.bounds.height<.5,"$name hidden bar renders nothing");return }
        fun part(p:String)=nodes["ab.$p"]
        val variant=c.getJSONObject("node").optJSONObject("properties")?.optString("variant") ?: "small"
        box(name,"host",s.optJSONObject("rect"),nodes["ab"])
        box(name,"row",s.optJSONObject("row")?.optJSONObject("rect"),part("row"))
        box(name,"leading",s.optJSONObject("leading")?.optJSONObject("rect"),part("leading"))
        s.optJSONObject("leadingButton")?.let { box(name,"leading-icon",it.optJSONObject("rect"),part("leading-icon")) }
        s.optJSONObject("inline")?.let { box(name,"headline-inline",it.optJSONObject("rect"),part("headline-inline")) }
        s.optJSONObject("title")?.let { box(name,"title",it.optJSONObject("rect"),part("title"),1.0) }
        s.optJSONObject("subtitle")?.let { box(name,"subtitle(inline)",it.optJSONObject("rect"),part(if(variant=="medium" || variant=="large") "inline-subtitle" else "subtitle"),1.0) }
        s.optJSONObject("expanded")?.let { e->
            box(name,"expanded",e.optJSONObject("rect"),part("expanded"))
            box(name,"expanded-headline",e.optJSONObject("headline"),part("expanded-headline"),1.0)
            e.optJSONObject("subtitle")?.let { box(name,"subtitle(expanded)",it,part("subtitle"),1.0) }
        }
        box(name,"trailing",s.optJSONObject("trailing")?.optJSONObject("rect"),part("trailing"))
        s.optJSONObject("search")?.let { q->
            box(name,"search-host",q.optJSONObject("host"),part("search-host"))
            box(name,"search",q.optJSONObject("pill")?.optJSONObject("rect"),part("search"))
            box(name,"search-field",q.optJSONObject("field")?.optJSONObject("rect"),part("search-field"),1.0)
            q.optJSONObject("input")?.let { box(name,"search-input",it.optJSONObject("rect"),part("search-input"),1.0) }
            q.optJSONObject("trailing")?.let { if(it.optDouble("width",0.0)>0) box(name,"search-trailing",it,part("search-trailing")) }
        }
        // Trailing actions beyond the cap are laid out at zero size and never drawn: the bar reports which ones it shows.
        val shown=(probe.bars["ab"]?.get("trailingShown") as? List<*>)?.map { it.toString() }
        for(ch in (s.optJSONArray("children") ?: JSONArray()).objects()) {
            val id=ch.optString("id");val r=rect(ch.optJSONObject("rect")) ?: continue
            val n=nodes[id]
            val hidden=ch.optString("display")=="none" || r[2]<=0
            if(ch.optString("slot")=="trailing" && shown!=null) { check((id in shown)!=hidden,"$name child $id shown ${id in shown}");if(!hidden) box(name,"child $id",ch.optJSONObject("rect"),n) }
            else if(hidden) check(n==null || n.bounds.width<.5,"$name child $id hidden (${d(n?.bounds)})")
            else if(ch.optString("tag")=="span") continue
            else box(name,"child $id",ch.optJSONObject("rect"),n)
        }
        // Paint: flat pixels of the clipped Chrome screenshot (n2's ::part() cases outside the vocabulary: geometry only).
        val clip=c.optJSONObject("clip")
        if((c.optBoolean("parts") && c.optJSONObject("partsValues")==null) || clip==null) { android.util.Log.i("AWCAppBar","case $name: ${checks-failures.size}/$checks");return }
        val nat=AppBarEvidence.capture(compose,clip) { shift=it;compose.waitForIdle() }
        shift=0f
        val web=CardWeb.webGrid("$shotDir/$name.png",clip)
        val r=CardWeb.compare(web,nat)
        val area=max(1,(clip.getInt("width")-2)*(clip.getInt("height")-2))
        check(r.getInt("compared").toDouble()/area>.4,"$name flat-pixel coverage ${r.getInt("compared")}")
        check(r.getInt("over6").toDouble()/max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0,"$name flat pixels $r")
        report.put(r.put("case",name))
        android.util.Log.i("AWCAppBar","case $name: ${checks-failures.size}/$checks")
    }
}
