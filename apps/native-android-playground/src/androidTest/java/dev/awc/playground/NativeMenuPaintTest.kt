package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
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
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
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
import kotlin.math.max
import kotlin.math.min

/** Shared md-menu oracle plumbing: the AWCNode trees of the shared fixtures (byte-identical to the Swift ones). */
internal object MenuWeb {
    class Node(val id:String,val tag:String,val props:JSONObject,val children:List<Node>,val slot:String)
    fun nodes(a:JSONArray):List<Node> = a.objects().map { n-> Node(n.getString("id"),n.getString("tag"),n.optJSONObject("properties") ?: JSONObject(),
        nodes(n.optJSONArray("children") ?: JSONArray()),n.optString("slot","")) }
    fun props(n:Node,extra:Map<String,Any?> = emptyMap()):Map<String,Any?> {
        val out=mutableMapOf<String,Any?>()
        for(k in n.props.keys()) { if(k=="style") continue;val v=n.props.get(k);out[k]=if(v==JSONObject.NULL) null else v }
        return out+mapOf("id" to n.id)+extra
    }
    fun all(ns:List<Node>):List<Node> = ns.flatMap { listOf(it)+all(it.children) }
    val roboto=FontFamily(Font(dev.awc.nativeui.R.font.awc_roboto_regular,FontWeight.Normal),Font(dev.awc.nativeui.R.font.awc_roboto_medium,FontWeight.Medium))
    fun text(size:Double,line:Double,weight:Int,color:Color)=TextStyle(color=color,fontSize=size.sp,lineHeight=line.sp,fontFamily=roboto,fontWeight=FontWeight(weight),letterSpacing=0.sp,
        platformStyle=PlatformTextStyle(includeFontPadding=false),lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))
    fun hex(h:String):Color { val v=h.removePrefix("#");val n=v.toLong(16);return if(v.length==8) Color(((n and 255) shl 24) or (n shr 8)) else Color(0xff000000L or n) }
    /** md-menu nodes render through AWCComponent; `#symbol` is a slotted Material Symbol; `#div` the header slot of menu.html. */
    @Composable fun Render(n:Node,tokens:Map<String,String>,extra:(Node)->Map<String,Any?> = { emptyMap() }) {
        when(n.tag) {
            "#symbol"->AWCMaterialSymbol(n.props.optString("name"))
            "#div"->BasicText(n.props.optString("text"),Modifier.fillMaxWidth().padding(vertical=8.dp,horizontal=12.dp),
                style=text(12.0,12*1.171875,500,hex(tokens["--md-sys-color-on-surface-variant"] ?: "#49454F")))
            else->AWCComponent(n.tag,props(n,extra(n))) { slot-> n.children.filter { it.slot==slot }.forEach { Render(it,tokens,extra) } }
        }
    }
    /** menu.html's `.anchor` button: 14px/500 label on a 1px outlined capsule (surface fill). */
    @Composable fun Anchor(n:Node,r:JSONObject,tokens:Map<String,String>,onPress:(()->Unit)?=null) {
        val shape=RoundedCornerShape(50)
        Box(Modifier.absoluteOffset(r.getDouble("x").dp,r.getDouble("y").dp).size(r.getDouble("width").dp,r.getDouble("height").dp)
            .awcMenuAnchor(n.id).focusable()
            .background(hex(tokens["--md-sys-color-surface"] ?: "#FEF7FF"),shape).border(1.dp,hex(tokens["--md-sys-color-outline"] ?: "#79747E"),shape)
            .then(if(onPress!=null) Modifier.menuAnchorPress(onPress) else Modifier),contentAlignment=Alignment.Center) {
            BasicText(n.props.optString("text"),style=text(14.0,14*1.171875,500,hex(tokens["--md-sys-color-on-surface"] ?: "#1D1B20")),maxLines=1,softWrap=false)
        }
    }
    fun rect(o:JSONObject?)=o?.let { listOf(it.optDouble("x",0.0),it.optDouble("y",0.0),it.optDouble("width",0.0),it.optDouble("height",0.0)) } ?: listOf(0.0,0.0,0.0,0.0)
    /** The page's theme: the generated tokens of the case theme plus the case's own token overrides. */
    fun tokens(c:JSONObject):Map<String,String> { val base=if(c.optString("theme")=="dark") dev.awc.nativeui.generated.AWCGeneratedTokens.dark else dev.awc.nativeui.generated.AWCGeneratedTokens.light
        val t=c.optJSONObject("tokens") ?: return base;return base+t.keys().asSequence().associateWith { t.getString(it) } }
    /** Characters Roboto does not cover (arrows, technical symbols such as ⌘ ⌥ ⇧): Chrome and Android draw them with
     *  their platforms' fallback fonts, whose advances differ (Mac Chrome's fallback is not available on Android). */
    fun fallbackGlyphs(text:String)=text.any { it.code in 0x2190..0x2BFF }
    fun hooks(c:JSONObject):Map<String,String> { val t=c.optJSONObject("hooks") ?: return emptyMap();return t.keys().asSequence().associateWith { t.getString(it) } }
}
/** A click on the anchor (release inside) opens its menu, as menu.html's `#a` click handler does. */
internal fun Modifier.menuAnchorPress(onPress:()->Unit):Modifier=this.pointerInput(onPress) {
    awaitEachGesture {
        awaitFirstDown(false)
        val up=waitForUpOrCancellation()
        if(up!=null) onPress()
    }
}

/**
 * md-menu family paint and geometry against Chrome 153 (Mac oracle web-paint.json, 138 cases from menu.html; shared
 * fixture menu-web-paint.json). The compiled AWCNode trees render through the production AWCComponent dispatch inside an
 * AWCMenuScope sized to the oracle viewport. Every md-* box and [part] box, row roles and aria-checked, and every flat
 * pixel of the clipped Chrome screenshot (DPR 1 vs density 2, 2×2 averaged) are compared.
 */
class NativeMenuPaintTest {
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
        val rtl=c.optString("dir")=="rtl";val closed=c.optBoolean("closed")
        val nodes=MenuWeb.nodes(c.optJSONArray("nodes") ?: JSONArray())
        val box=MenuWeb.rect(c.optJSONObject("box"));val anchor=c.optJSONObject("anchor")
        val overrides=c.optJSONObject("tokens")?.let { t-> t.keys().asSequence().associateWith { t.getString(it) } } ?: emptyMap()
        AWCTheme(c.optString("theme")=="dark",overrides) { key(epoch) {
            val surface=MenuWeb.hex(tokens["--md-sys-color-surface"] ?: "#FEF7FF")
            Box(Modifier.fillMaxSize().background(surface)) {
                Box(Modifier.wrapContentSize(Alignment.TopStart,unbounded=true).requiredSize(vw.dp,vh.dp).graphicsLayer { translationX=-shift*2 }) {
                    AWCMenuScope(scope,Modifier.fillMaxSize().background(surface)) {
                        AWCMenuAppearanceScope(AWCMenuAppearance.fromCss(MenuWeb.hooks(c))) { AWCDensityScope(c.optDouble("density",0.0)) { AWCMenuReducedMotionScope(false) { AWCMenuInspectionScope(inspection) { MenuPartsNest(c.optJSONArray("parts"),0) {
                            for(n in nodes) {
                                if(n.tag=="#anchor") { if(anchor!=null) MenuWeb.Anchor(n,anchor,tokens) }
                                else Box(Modifier.absoluteOffset(box[0].dp,box[1].dp).width(box[2].dp)) {
                                    CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                        Box(Modifier.align(if(rtl) Alignment.TopEnd else Alignment.TopStart)) {
                                            MenuInlineFillFixture(c.optJSONObject("inlineFill")) { AWCInspectionScope(collector,n.id) { MenuWeb.Render(n,tokens) { x-> if(x.id=="m" && !closed) mapOf("open" to true) else emptyMap() } } }
                                        }
                                    }
                                }
                            }
                        } } } } }
                    }
                }
            }
        } }
    } } }
    /** The fixtures: menu-web-paint and menu-r4-paint (gate-7 r4 parts and hooks) both run by default (R4-23); the
     *  `menuFixture` argument runs one of them. */
    private val selectedFixture=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("menuFixture")
    private var fixture="menu-web-paint"
    @Test fun menuMatchesChromePaintAndGeometry() { paint(selectedFixture ?: "menu-web-paint") }
    @Test fun menuR4PartsAndHooksMatchChromePaint() { if(selectedFixture==null) paint("menu-r4-paint") }
    private fun paint(f:String) {
        fixture=f
        content()
        val oracle=CardWeb.document("$fixture.json")
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("menuPaintOnly")
        for(c in oracle.getJSONArray("cases").objects()) if(only==null || only.split(',').any { c.getString("name").contains(it) }) run(c)
        val out=JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("report",report)
        val evidence=if(fixture=="menu-web-paint") "menu-paint" else fixture
        MenuEvidence.log(evidence,out)
        android.util.Log.i("AWCMenu","$evidence ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    /** [h] widens only the horizontal checks (x, width): the fallback-font slack never moves anything vertically. */
    private fun near(b:AWCInspectionBounds?,r:List<Double>,tol:Double,h:Double=0.0)=b!=null && abs(b.x-r[0])<=tol+h && abs(b.y-r[1])<=tol && abs(b.width-r[2])<=tol+h && abs(b.height-r[3])<=tol
    private fun d(b:AWCInspectionBounds?)=b?.let { "(%.2f,%.2f,%.2f,%.2f)".format(it.x,it.y,it.width,it.height) } ?: "nil"
    private val textParts=setOf("headline","supporting-text","content","trailing","badge","empty-text")
    /** Oracle tree vs native inspection: host and part boxes, roles and aria-checked. */
    private var slack=0.0
    /** Largest advance difference of a trailing text drawn with a platform fallback font (see [MenuWeb.fallbackGlyphs]). */
    private fun fallbackSlack(t:JSONObject,nodes:Map<String,AWCInspectionNode>):Double {
        var out=0.0
        val text=t.optJSONObject("attrs")?.optString("trailing-text") ?: ""
        val trailing=(t.optJSONArray("parts") ?: JSONArray()).objects().firstOrNull { it.getString("part")=="trailing" }
        val id=t.optString("id")
        if(trailing!=null && MenuWeb.fallbackGlyphs(text.ifEmpty { fallbackTexts[id] ?: "" })) nodes["$id.trailing"]?.let { out=abs(it.bounds.width-MenuWeb.rect(trailing.optJSONObject("rect"))[2]) }
        for(c in (t.optJSONArray("children") ?: JSONArray()).objects()) out=max(out,fallbackSlack(c,nodes))
        return out
    }
    private var fallbackTexts=mapOf<String,String>()
    private fun compare(t:JSONObject,name:String,nodes:Map<String,AWCInspectionNode>) {
        val id=t.getString("id");val web=MenuWeb.rect(t.optJSONObject("rect"));val tag=t.getString("tag")
        if(web[2]<=0 && web[3]<=0) return
        val n=nodes[id]
        check(near(n?.bounds,web,.75,slack),"$name $id $tag ${d(n?.bounds)} vs $web")
        for(p in (t.optJSONArray("parts") ?: JSONArray()).objects()) {
            val part=p.getString("part");val r=MenuWeb.rect(p.optJSONObject("rect"))
            if(r[2]<=0 || r[3]<=0 || p.optString("display")=="none") continue
            val np=nodes["$id.$part"]
            check(near(np?.bounds,r,if(part in textParts) 1.0 else .75,slack),"$name $id $part ${d(np?.bounds)} vs $r")
        }
        val attrs=t.optJSONObject("attrs") ?: JSONObject()
        if(tag=="md-menu-item" || tag=="md-sub-menu-item") {
            val v=inspection.rows[id] ?: emptyMap()
            check(v["role"]==attrs.optString("role"),"$name $id role ${v["role"]} vs ${attrs.optString("role")}")
            check((v["ariaChecked"] as? String ?: "")==attrs.optString("aria-checked",""),"$name $id aria-checked ${v["ariaChecked"]} vs ${attrs.optString("aria-checked","")}")
        }
        if(tag=="md-menu-item-group") check(inspection.rows[id]?.get("role")=="group","$name $id group role ${inspection.rows[id]?.get("role")}")
        for(child in (t.optJSONArray("children") ?: JSONArray()).objects()) compare(child,name,nodes)
    }
    private fun findRect(t:JSONObject,id:String):List<Double>? {
        if(t.optString("id")==id) return MenuWeb.rect(t.optJSONObject("rect"))
        for(c in (t.optJSONArray("children") ?: JSONArray()).objects()) findRect(c,id)?.let { return it }
        return null
    }
    private fun settle(ms:Long) { compose.waitForIdle();compose.mainClock.advanceTimeBy(ms);compose.waitForIdle() }
    private fun run(c:JSONObject) {
        val name=c.getString("name")
        shift=0f;scope=AWCMenuScopeState();collector.clear();inspection.clear();case=c;epoch++
        settle(600)
        val prepare=c.optString("prepare").takeIf { it.isNotEmpty() && it!="null" }
        val root=scope.menu("m")
        if(prepare=="submenu") { val row=root.submenuRows.firstOrNull() ?: ""
            compose.runOnIdle { root.focusRow(row,true) };settle(50);compose.runOnIdle { root.openSubmenu(row,true) };settle(400) }
        else if(prepare!=null && prepare.startsWith("scroll:")) { compose.runOnIdle { root.scrollTop=prepare.removePrefix("scroll:").toDouble() };settle(200) }
        val nodes=collector.snapshot().nodes.associateBy { it.id }
        fallbackTexts=MenuWeb.all(MenuWeb.nodes(c.optJSONArray("nodes") ?: JSONArray())).associate { it.id to it.props.optString("trailingText") }
        slack=if(c.optBoolean("closed")) 0.0 else fallbackSlack(c.getJSONObject("tree"),nodes)
        if(c.optBoolean("closed")) check(nodes["m.surface"]==null,"$name closed menu paints no surface")
        else compare(c.getJSONObject("tree"),name,nodes)
        // Paint: the clip in 520 px segments (the device is 540 dp wide; the scene shifts, layout does not).
        val clip=c.getJSONObject("clip")
        val nat=MenuEvidence.capture(compose,clip) { shift=it;compose.waitForIdle() }
        shift=0f
        val web=CardWeb.webGrid("$fixture/$name.png",clip)
        // With a fallback-font slack the surfaces' edges (and their shadows) may sit up to `slack` px apart: those bands are masked.
        val masks=mutableListOf<androidx.compose.ui.geometry.Rect>()
        if(slack>0) for(m in MenuWeb.all(MenuWeb.nodes(c.optJSONArray("nodes") ?: JSONArray())).filter { it.tag=="md-menu" }) {
            val n=nodes["${m.id}.surface"]?.bounds ?: continue
            val w=findRect(c.getJSONObject("tree"),m.id) ?: continue
            val top=min(n.y,w[1])-4;val bottom=max(n.y+n.height,w[1]+w[3])+12
            for((a,b) in listOf(n.x to w[0],n.x+n.width to w[0]+w[2])) masks+=androidx.compose.ui.geometry.Rect((min(a,b)-4).toFloat(),top.toFloat(),(max(a,b)+10).toFloat(),bottom.toFloat())
        }
        val r=CardWeb.compare(web,nat,masks).put("fallbackSlack",slack)
        val area=max(1,(clip.getInt("width")-2)*(clip.getInt("height")-2))
        check(r.getInt("compared").toDouble()/area>.4,"$name flat-pixel coverage ${r.getInt("compared")}")
        check(r.getInt("over6").toDouble()/max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0,"$name flat pixels $r")
        report.put(r.put("case",name))
        android.util.Log.i("AWCMenu","case $name: ${checks-failures.size}/$checks")
    }
}

/** Evidence files and segmented captures shared by the menu tests. */
internal object MenuEvidence {
    private val dir get()=java.io.File(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"menu").apply { mkdirs() }
    fun log(name:String,json:JSONObject) { java.io.File(dir,"$name.json").writeText(json.toString(1)) }
    /** The clip (CSS px, scene coordinates) as a native grid: the scene shifts left in steps so each segment is on screen. */
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

/** Inline-fill cases (fixture `inlineFill`: the flex container's size): the menu fills it inside AWCMenuInlineFillScope. */
@androidx.compose.runtime.Composable private fun MenuInlineFillFixture(size:JSONObject?,content:@androidx.compose.runtime.Composable ()->Unit) {
    if(size==null) { content();return }
    androidx.compose.foundation.layout.Box(Modifier.size(size.getDouble("width").dp,size.getDouble("height").dp)) { dev.awc.nativeui.AWCMenuInlineFillScope { content() } }
}
/** A case's `::part` rules (fixture `parts`: {tag, id?, part, values}) as nested typed part-appearance scopes. */
@androidx.compose.runtime.Composable private fun MenuPartsNest(parts:JSONArray?,i:Int,content:@androidx.compose.runtime.Composable ()->Unit) {
    if(parts==null || i>=parts.length()) { content();return }
    val p=parts.getJSONObject(i);val v=p.optJSONObject("values") ?: JSONObject()
    fun s(k:String)=v.optString(k).ifEmpty { null }
    fun n(k:String)=v.optDouble(k).takeIf { !it.isNaN() }
    val a=dev.awc.nativeui.AWCMenuPartAppearance(s("background"),s("color"),s("outlineColor"),n("outlineWidth"),n("cornerRadius"),n("opacity"),n("letterSpacing"))
    val id=p.optString("id").ifEmpty { null };val name=p.getString("part")
    when(p.getString("tag")) {
        "md-menu"->dev.awc.nativeui.AWCMenuPartAppearanceScope(dev.awc.nativeui.AWCMenuPart.entries.first { it.source==name },a,id) { MenuPartsNest(parts,i+1,content) }
        "md-menu-item"->dev.awc.nativeui.AWCMenuItemPartAppearanceScope(dev.awc.nativeui.AWCMenuItemPart.entries.first { it.source==name },a,id) { MenuPartsNest(parts,i+1,content) }
        "md-sub-menu-item"->dev.awc.nativeui.AWCSubMenuItemPartAppearanceScope(dev.awc.nativeui.AWCSubMenuItemPart.entries.first { it.source==name },a,id) { MenuPartsNest(parts,i+1,content) }
        else->MenuPartsNest(parts,i+1,content)
    }
}
