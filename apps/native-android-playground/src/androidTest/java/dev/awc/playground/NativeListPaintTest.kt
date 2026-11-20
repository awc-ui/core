package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.getOrNull
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
import kotlin.math.min

/** Shared md-list oracle plumbing (web-oracle paint.html / states.html; assets byte-identical to the Swift fixtures). */
internal object ListWeb {
    fun document(name:String)=CardWeb.document(name)
    private val dir get()=java.io.File(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null),"list").apply { mkdirs() }
    fun log(name:String,json:JSONObject) { android.util.Log.i("AWCList","$name ${json.toString().take(3000)}");java.io.File(dir,"$name.json").writeText(json.toString(1)) }
    fun hexColor(h:String):List<Double> { val v=h.removePrefix("#");val n=v.chunked(2).map { it.toInt(16)/255.0 };return if(n.size==4) n else n+1.0 }
    fun px(v:Any?):Double? = when(v) { is Number->v.toDouble();is String->v.removeSuffix("px").removeSuffix("ms").trim().toDoubleOrNull();else->null }
    fun cornerValues(p:Double)=mapOf("x" to mapOf("points" to p),"y" to mapOf("points" to p)).let { c-> mapOf("topLeft" to c,"topRight" to c,"bottomRight" to c,"bottomLeft" to c) }
    fun shadowValues(css:String)=CardWeb.boxShadow(css).map { mapOf("x" to it.x,"y" to it.y,"blur" to it.blur,"spread" to it.spread,"color" to it.color,"inset" to it.inset) }
    fun kind(css:String)=when { css=="container-shape"->"shape";css=="dragged-container-elevation"->"shadow";css.endsWith("-font")->"font"
        css.endsWith("-color") || css.endsWith("-background")->"color";css.endsWith("opacity")->"number";else->"length" }
    fun camel(s:String)=s.split('-').mapIndexed { i,w-> if(i==0) w else w.replaceFirstChar { it.uppercase() } }.joinToString("")
    fun values(hooks:JSONObject,keys:List<String>,kindOf:(String)->String):Map<String,Any?> {
        val out=mutableMapOf<String,Any?>()
        for(k in keys) { if(!hooks.has(k)) continue;val raw=hooks.get(k).toString()
            out[camel(k)]=when(kindOf(k)) { "color"->CardWeb.hex(raw);"font"->raw;"shape"->cornerValues(px(raw) ?: 0.0);"shadow"->shadowValues(raw);else->px(raw) ?: 0.0 } }
        return out
    }
    val listKinds=mapOf("container-color" to "color","container-shape" to "shape","padding-block" to "length","padding-inline" to "length","segmented-gap" to "length",
        "drop-placeholder-color" to "color","drop-placeholder-outline-color" to "color","drop-placeholder-outline-width" to "length","drop-placeholder-shape" to "shape","drop-placeholder-opacity" to "number")
    /** Node tree with Swift-identical ids: rows i0… in pre-order, other elements n1…. */
    class Built(val json:JSONObject,val id:String,val children:List<Built>) { val tag:String get()=json.getString("tag");val slot:String get()=json.optString("slot","") }
    fun build(nodes:JSONArray,image:String,setImage:Boolean=false):Pair<List<Built>,List<String>> {
        var counter=0;val items=mutableListOf<String>()
        fun b(n:JSONObject):Built { val tag=n.getString("tag")
            val id=if(tag=="md-list-item") "i${items.size}".also { items+=it } else if(tag=="#text") "" else "n${++counter}"
            val props=n.optJSONObject("props")
            if(props!=null && (props.optString("leadingImage").startsWith("swatch:") || (setImage && tag=="md-list-item"))) props.put("leadingImage",image)
            return Built(n,id,(n.optJSONArray("children") ?: JSONArray()).objects().map(::b)) }
        return nodes.objects().map(::b) to items
    }
    fun props(b:Built,extra:Map<String,Any?> = emptyMap()):Map<String,Any?> { val p=b.json.optJSONObject("props") ?: JSONObject()
        return p.keys().asSequence().associateWith { p.get(it).let { v-> if(v==JSONObject.NULL) null else v } }+mapOf("id" to b.id)+extra }
    @Composable fun Render(b:Built,boxes:Map<String,Pair<Double,Double>>,extra:Map<String,Map<String,Any?>> = emptyMap()) {
        when(b.tag) {
            "#text"->AWCSlotText(b.json.optString("text"))
            "video"->AWCListLeadingVideo()
            else->{ val box=boxes[b.id]
                val comp:@Composable ()->Unit={ AWCComponent(b.tag,props(b,extra[b.id] ?: emptyMap())) { slot-> b.children.filter { it.slot==slot }.forEach { Render(it,boxes,extra) } } }
                if(box!=null) Box(Modifier.size(box.first.dp,box.second.dp)) { comp() } else comp() }
        }
    }
}

/**
 * md-list / md-list-item paint against Chrome (paint.html, 264 cases): list and row boxes, padding,
 * gap, role, resting corners and container colours, every part box and every flat pixel of the
 * source clip (DPR 1 vs density 2; slotted authored controls masked).
 */
class NativeListPaintTest {
    @get:Rule val compose=createComposeRule()
    private var case by mutableStateOf(JSONObject("{\"name\":\"init\"}"))
    private var nodes by mutableStateOf<List<ListWeb.Built>>(emptyList())
    private var boxes by mutableStateOf<Map<String,Pair<Double,Double>>>(emptyMap())
    private var extra by mutableStateOf<Map<String,Map<String,Any?>>>(emptyMap())
    private var listHooks by mutableStateOf(AWCListAppearance())
    private var itemHooks by mutableStateOf<AWCListItemAppearance?>(null)
    private var itemIDs by mutableStateOf<List<String>>(emptyList())
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private val inspection=AWCListInspection()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private val knownGaps=mutableListOf<String>()
    /** The hybrid-density case needs an inherited spacing-token rung the shared Android density scope does not carry (documented gap). */
    /** role=option → RadioButton (single-select) / Checkbox (multi-select, toggleable) with aria-selected; menuitem and a
     *  button/link primary → Button; aria-disabled → Disabled; set position → CollectionItemInfo.rowIndex. */
    private fun accessibility(name:String,id:String,b:AWCInspectionBounds?,w:JSONObject,c:JSONObject,sem:List<androidx.compose.ui.semantics.SemanticsNode>,index:Int?) {
        if(b==null) return
        val role=w.getJSONObject("attrs").optString("role");val primary=w.optJSONObject("primary")?.optString("role") ?: ""
        val expected=when { role=="option"-> if(c.optString("mode")=="multi-select") Role.Checkbox else Role.RadioButton
            role=="menuitem" || primary=="button" || primary=="link"-> Role.Button;else->null } ?: return
        val P=androidx.compose.ui.semantics.SemanticsProperties
        // Unclipped position (rows scrolled past a fixed-height list keep their node).
        fun dist(n:androidx.compose.ui.semantics.SemanticsNode)=abs(n.positionInRoot.x/2-b.x)+abs(n.positionInRoot.y/2-b.y)+abs(n.size.width/2.0-b.width)
        val node=sem.minByOrNull { dist(it) }?.takeIf { dist(it)<12 }
        if(node==null) { check(false,"$name $id accessibility node for $role/$primary at ${b} near ${sem.map { it.boundsInRoot }.filter { abs(it.top/2-b.y)<80 }.map { "${it.left/2},${it.top/2},${it.width/2}x${it.height/2}" }}");return }
        val cfg=node.config
        check(cfg.getOrNull(P.Role)==expected,"$name $id role ${cfg.getOrNull(P.Role)} vs $role/$primary")
        val sel=w.getJSONObject("attrs").optString("ariaSelected")=="true"
        if(role=="option") check(if(expected==Role.Checkbox) cfg.getOrNull(P.ToggleableState)==androidx.compose.ui.state.ToggleableState(sel) else cfg.getOrNull(P.Selected)==sel,"$name $id aria-selected $sel")
        val disabled=w.getJSONObject("attrs").optString("ariaDisabled")=="true"
        check(cfg.contains(P.Disabled)==disabled,"$name $id disabled ${cfg.contains(P.Disabled)} vs aria-disabled $disabled")
        if(index!=null) check(cfg.getOrNull(P.CollectionItemInfo)?.rowIndex==index,"$name $id set position ${cfg.getOrNull(P.CollectionItemInfo)?.rowIndex} vs $index")
    }
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun opt(c:JSONObject,k:String)=if(c.has(k) && !c.isNull(k)) c.get(k) else null
    @Composable private fun Hooked(content:@Composable ()->Unit) {
        val h=itemHooks
        if(h==null) content()
        else if(opt(case,"hookTarget")=="list") AWCListItemAppearanceScope(h,content=content)
        else { var wrapped:@Composable ()->Unit=content;for(id in itemIDs) { val inner=wrapped;wrapped={ AWCListItemAppearanceScope(h,id) { inner() } } };wrapped() }
    }
    @Composable private fun Parts(content:@Composable ()->Unit) {
        if(opt(case,"parts")!=true) { content();return }
        AWCListItemPartAppearanceScope(AWCListItemPart.Row,AWCAccordionPartAppearance(borderColor="#00897B",borderWidth=2.0)) {
        AWCListItemPartAppearanceScope(AWCListItemPart.StateLayer,AWCAccordionPartAppearance(backgroundColor="#FF6F00")) {
        AWCListItemPartAppearanceScope(AWCListItemPart.Headline,AWCAccordionPartAppearance(color="#5D4037",letterSpacing=1.0)) {
        AWCListItemPartAppearanceScope(AWCListItemPart.LeadingIcon,AWCAccordionPartAppearance(color="#2E7D32")) {
        AWCListItemPartAppearanceScope(AWCListItemPart.Trailing,AWCAccordionPartAppearance(backgroundColor="#FFF59D")) {
        AWCListItemPartAppearanceScope(AWCListItemPart.DragHandle,AWCAccordionPartAppearance(color="#C2185B")) {
        AWCListItemPartAppearanceScope(AWCListItemPart.ExpandedPanel,AWCAccordionPartAppearance(backgroundColor="#F3E5F5")) {
        AWCListItemPartAppearanceScope(AWCListItemPart.Avatar,AWCAccordionPartAppearance(borderColor="#3949AB",borderWidth=2.0)) { content() } } } } } } } }
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val c=case;val dark=opt(c,"theme")=="dark"
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) { key(epoch) {
            CompositionLocalProvider(LocalLayoutDirection provides if(opt(c,"dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                val w=(opt(c,"width") as? Number)?.toDouble() ?: 360.0;val h=(opt(c,"height") as? Number)?.toDouble()
                Box(Modifier.absoluteOffset(40.dp,40.dp).wrapContentSize(androidx.compose.ui.AbsoluteAlignment.TopLeft,unbounded=true).width(w.dp).then(if(h!=null) Modifier.height(h.dp).clipToBounds().wrapContentHeight(androidx.compose.ui.Alignment.Top,unbounded=true) else Modifier)) {
                    AWCDensityScope((opt(c,"inheritedDensity") as? Number)?.toDouble() ?: 0.0) {
                    AWCListAppearanceScope(listHooks) { Hooked { Parts { AWCListShapeMorphScope(opt(c,"shapeMorph")!="off") { AWCListInspectionScope(inspection) {
                        if(opt(c,"standalone")==true) Column { nodes.forEach { n-> AWCInspectionScope(collector,n.id) { ListWeb.Render(n,boxes,extra) } } }
                        else AWCInspectionScope(collector,"list") {
                            val lp=mutableMapOf<String,Any?>("listStyle" to opt(c,"style"),"selectionMode" to opt(c,"mode"),"interactionMode" to opt(c,"interaction"),"id" to "list")
                            if(opt(c,"reorderable")==true) lp["reorderable"]=true
                            (opt(c,"density") as? Number)?.toDouble()?.takeIf { it!=0.0 }?.let { lp["density"]=it }
                            for(k in listOf("label","labelledby","roleOverride")) (opt(c,k) as? String)?.takeIf { it.isNotEmpty() }?.let { lp[k]=it }
                            AWCComponent("md-list",lp) { slot-> if(slot=="") nodes.forEach { ListWeb.Render(it,boxes,extra) } }
                        }
                    } } } } } }
                }
            }
        } } }
    } } }
    @Test fun listMatchesChromePaintAndGeometry() {
        content()
        val oracle=ListWeb.document("list-web-paint.json");val fixture=ListWeb.document("list-web-fixtures.json")
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("listPaintOnly")
        for(c in oracle.getJSONArray("cases").objects()) if(only==null || c.getString("name").contains(only)) run(c,fixture)
        ListWeb.log("list-paint",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("knownGaps",JSONArray(knownGaps)).put("report",report))
        android.util.Log.i("AWCList","list-paint ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun near(b:AWCInspectionBounds?,w:JSONObject,tol:Double=.6)=b!=null && abs(b.x-w.getDouble("x"))<=tol && abs(b.y-w.getDouble("y"))<=tol && abs(b.width-w.getDouble("width"))<=tol && abs(b.height-w.getDouble("height"))<=tol
    private fun d(b:AWCInspectionBounds?)=b?.let { "(${it.x},${it.y},${it.width},${it.height})" } ?: "nil"
    private fun run(c:JSONObject,fixture:JSONObject) {
        val name=c.getString("name")
        val image=fixture.getString("image")
        val (built,items)=ListWeb.build(fixture.getJSONObject("paint").getJSONArray(name),image,c.optString("recipe")=="imageSelect")
        val standalone=opt(c,"standalone")==true
        // Authored slot boxes and the row the Web capture shows with the roving ring.
        val bx=mutableMapOf<String,Pair<Double,Double>>();val ex=mutableMapOf<String,Map<String,Any?>>()
        val byID=mutableMapOf<String,ListWeb.Built>();fun index(b:ListWeb.Built) { byID[b.id]=b;b.children.forEach(::index) };built.forEach(::index)
        c.getJSONArray("items").objects().forEachIndexed { i,w-> if(i>=items.size) return@forEachIndexed
            val item=byID[items[i]] ?: return@forEachIndexed
            for(slot in listOf("leading","trailing")) { val natives=item.children.filter { it.slot==slot && it.tag!="#text" };val webs=w.getJSONObject("slots").getJSONArray(slot).objects()
                natives.zip(webs).forEach { (n,wv)-> if(n.tag!="video") bx[n.id]=wv.getJSONObject("rect").getDouble("width") to wv.getJSONObject("rect").getDouble("height") } }
            if(w.getString("classes").contains("md-list-item--roving-focus-visible")) ex[items[i]]=mapOf("rovingFocusVisible" to true) }
        val lh=fixture.getJSONObject("listHooks");val ih=fixture.getJSONObject("itemHooks")
        listHooks=c.optJSONArray("listHooks")?.let { k-> AWCListAppearance.fromValues(ListWeb.values(lh,(0 until k.length()).map { k.getString(it) }) { ListWeb.listKinds[it] ?: "length" }) } ?: AWCListAppearance()
        itemHooks=c.optJSONArray("itemHooks")?.let { k-> AWCListItemAppearance.fromValues(ListWeb.values(ih,(0 until k.length()).map { k.getString(it) },ListWeb::kind)) }
        (opt(c,"itemDensity") as? Number)?.toDouble()?.let { dd-> items.forEach { id-> ex[id]=(ex[id] ?: emptyMap())+("density" to dd) } }
        itemIDs=items;nodes=built;boxes=bx;extra=ex
        collector.clear();inspection.clear();case=c;epoch++
        compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle();compose.mainClock.advanceTimeBy(64);compose.waitForIdle()
        val snap=collector.snapshot().nodes
        fun node(id:String)=snap.firstOrNull { it.id==id }
        val prefix=if(standalone) "" else "list."
        if(!standalone && c.has("list") && !c.isNull("list")) {
            val wl=c.getJSONObject("list");val nl=node("list")
            check(near(nl?.bounds,wl.getJSONObject("rect")),"$name list ${d(nl?.bounds)} vs ${wl.getJSONObject("rect")}")
            val lv=inspection.lists["list"] ?: emptyMap()
            @Suppress("UNCHECKED_CAST") val pad=lv["padding"] as? List<Double> ?: emptyList()
            val wp=wl.getJSONObject("style").getJSONArray("padding")
            check(pad.size==2 && abs(pad[0]-wp.getDouble(0))<.01 && abs(pad[1]-wp.getDouble(1))<.01,"$name list padding $pad vs $wp")
            check(abs(((lv["gap"] as? Double) ?: -1.0)-wl.getJSONObject("style").optDouble("gap",0.0))<.01,"$name list gap ${lv["gap"]}")
            check(lv["role"]==wl.getJSONObject("attrs").optString("role"),"$name list role ${lv["role"]} vs ${wl.getJSONObject("attrs").optString("role")}")
        }
        val masks=mutableListOf<Rect>()
        val sem=compose.onAllNodes(androidx.compose.ui.test.SemanticsMatcher.keyIsDefined(androidx.compose.ui.semantics.SemanticsProperties.CollectionItemInfo),useUnmergedTree=true).fetchSemanticsNodes()
        val topIDs=built.firstOrNull { it.tag=="md-list" }?.children?.filter { it.tag=="md-list-item" }?.map { it.id } ?: emptyList()
        c.getJSONArray("items").objects().forEachIndexed { i,w-> if(i>=items.size) return@forEachIndexed
            val id=items[i];val host=w.getJSONObject("rect")
            for(s in listOf("leading","trailing")) w.getJSONObject("slots").getJSONArray(s).objects().forEach { r-> val rc=r.getJSONObject("rect")
                masks+=Rect(rc.getDouble("x").toFloat(),rc.getDouble("y").toFloat(),(rc.getDouble("x")+rc.getDouble("width")).toFloat(),(rc.getDouble("y")+rc.getDouble("height")).toFloat()) }
            if(host.getDouble("width")==0.0) { check(node("$prefix$id")==null,"$name $id hidden row is not rendered");return@forEachIndexed }
            val n=node("$prefix$id");if(n==null) { check(false,"$name $id rendered");return@forEachIndexed }
            check(near(n.bounds,host),"$name $id host ${d(n.bounds)} vs $host")
            val v=inspection.rows[id] ?: emptyMap()
            // Accessibility (role, selection, disabled state, set position) against Chrome's attributes.
            accessibility(name,id,n.bounds,w,c,sem,topIDs.indexOf(id).takeIf { it>=0 })
            // Truncation tooltips: enabled exactly when Chrome's md-tooltip wrappers are.
            val tips=w.optJSONArray("tooltips")
            if(tips!=null && tips.length()==2) {
                check((v["headlineTooltip"]==true)==(tips.getJSONObject(0).opt("disabled")==false),"$name $id headline tooltip ${v["headlineTooltip"]} vs disabled ${tips.getJSONObject(0).opt("disabled")}")
                if(!tips.getJSONObject(1).optString("cls").contains("--empty"))
                    check((v["supportingTooltip"]==true)==(tips.getJSONObject(1).opt("disabled")==false),"$name $id supporting tooltip ${v["supportingTooltip"]} vs disabled ${tips.getJSONObject(1).opt("disabled")}")
            }
            @Suppress("UNCHECKED_CAST") val nr=v["radius"] as? List<Double> ?: emptyList()
            val wr=w.getJSONObject("host").getJSONArray("radius").let { a-> (0 until a.length()).mapNotNull { ListWeb.px(a.get(it)) } }
            check(wr.size==4 && nr.size==4 && wr.zip(nr).all { (a,b)-> abs(a-b)<.6 },"$name $id corners $nr vs $wr")
            val wb=CardWeb.color(w.getJSONObject("host").getString("background"));val nb=ListWeb.hexColor(v["background"] as? String ?: "#00000000")
            check((0..3).all { abs(wb[it]*(if(wb[3]>0) 1 else 0)-nb[it]*(if(nb[3]>0) 1 else 0))<.012 },"$name $id background $nb vs $wb")
            @Suppress("UNCHECKED_CAST") val pn=v["padding"] as? List<Double> ?: emptyList()
            val pw=w.getJSONObject("row").getJSONArray("padding").let { a-> (0 until a.length()).map { a.getDouble(it) } }
            check(pn.size==4 && pn.zip(pw).all { (a,b)-> abs(a-b)<.01 },"$name $id row padding $pn vs $pw")
            check(abs(((v["gap"] as? Double) ?: -1.0)-w.getJSONObject("row").getDouble("gap"))<.01,"$name $id row gap ${v["gap"]}")
            check(abs(((v["minHeight"] as? Double) ?: -1.0)-w.getJSONObject("row").getDouble("minHeight"))<.01,"$name $id row min height ${v["minHeight"]}")
            check(near(node("$prefix$id.row")?.bounds,w.getJSONObject("row").getJSONObject("rect")),"$name $id row ${d(node("$prefix$id.row")?.bounds)} vs ${w.getJSONObject("row").getJSONObject("rect")}")
            for((part,key) in listOf("content" to "content","headline" to "headline","supporting-text" to "supporting","overline" to "overline","leading" to "leading","trailing" to "trailing",
                    "leading-icon" to "leadingIcon","trailing-icon" to "trailingIcon","avatar" to "avatar","image" to "imageWrap","expand-button" to "expandButton","drag-handle" to "dragHandle")) {
                val wv=w.optJSONObject(key) ?: continue;val wrc=wv.getJSONObject("rect")
                val np=node("$prefix$id.$part")
                if(wrc.getDouble("width")==0.0 && wrc.getDouble("height")==0.0) { check(np==null || part=="headline","$name $id $part absent");continue }
                if(key=="trailing" && w.getJSONObject("slots").getJSONArray("trailing").length()>0) continue
                // Chrome resolves the generic `serif` family to Times; Android has only Noto Serif, so the trailing
                // text advance (and the flexible content beside it) differs by the font's own widths.
                val fontSub=itemHooks?.trailingSupportingTextFont!=null && !w.isNull("trailingText") && part in setOf("headline","supporting-text","content","overline","trailing")
                val tol=if(fontSub) 3.0 else if(part in setOf("headline","supporting-text","content","overline")) 1.0 else .6
                check(near(np?.bounds,wrc,tol),"$name $id $part ${d(np?.bounds)} vs $wrc")
            }
        }
        val clip=c.getJSONObject("clip")
        val visible=JSONObject(clip.toString()).put("width",min(clip.getInt("width"),538-clip.getInt("x")))
        val nat=CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),visible.getInt("x"),visible.getInt("y"),visible.getInt("width"),visible.getInt("height"))
        val web=CardWeb.webGrid("list-web-paint/$name.png",visible)
        val r=CardWeb.compare(web,nat,masks)
        check(r.getInt("over6").toDouble()/kotlin.math.max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0 && r.getInt("compared")>400,"$name flat pixels $r");report.put(r.put("case",name))
    }
}
