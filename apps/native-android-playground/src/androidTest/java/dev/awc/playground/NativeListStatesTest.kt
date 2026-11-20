package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
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
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min

/**
 * md-list / md-list-item interaction against Chrome trusted-input records (states.html full, reduced
 * and extra sets) on the frame clock: pointer, selection, disabled, trailing controls, roving focus and
 * typeahead, disclosure by pointer and keys, pointer/keyboard reorder, image selection and the custom
 * hooks. Per frame: state layer, corners, container, icon colours, panel, caret, translate and drag
 * handle within Chrome's samples; events (order and payloads), focus, selection/expansion and phase paint.
 */
class NativeListStatesTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"rows\":\"none\",\"style\":\"standard\",\"mode\":\"none\",\"interaction\":\"single-action\",\"theme\":\"light\",\"dir\":\"ltr\"}"))
    private var reduced by mutableStateOf(false)
    private var hooks by mutableStateOf(false)
    private var epoch by mutableIntStateOf(0)
    private var image=""
    private var listHooks=AWCListAppearance();private var itemHooks=AWCListItemAppearance()
    private val inspection=AWCListInspection()
    private val collector=AWCInspectionCollector()
    private val controllers=mapOf("r1" to AWCListItemController())
    private var view:android.view.View?=null
    private var checks=0;private val failures=mutableListOf<String>();private val latencyGaps=mutableListOf<String>();private val report=JSONArray();private val pending=mutableListOf<String>()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private data class LR(val id:String,val p:Map<String,Any?>,val children:List<Pair<String,LR>> = emptyList(),val tag:String="md-list-item")
    private fun rows(name:String):List<LR> = when(name) {
        "buttons"->listOf(LR("r0",mapOf("type" to "button","headline" to "Wi-Fi","leadingIcon" to "wifi","trailingIcon" to "chevron_right")),
            LR("r1",mapOf("type" to "button","headline" to "Sound","supportingText" to "Volume and vibration","leadingIcon" to "volume_up","trailingIcon" to "chevron_right")),
            LR("r2",mapOf("type" to "button","headline" to "Storage","leadingIcon" to "storage","trailingIcon" to "chevron_right")))
        "links"->listOf(LR("r0",mapOf("type" to "link","href" to "#one","headline" to "Docs")),LR("r1",mapOf("type" to "link","href" to "#two","headline" to "Guides","leadingIcon" to "menu_book")),
            LR("r2",mapOf("type" to "link","href" to "#three","headline" to "API")))
        "options"->listOf(LR("r0",mapOf("headline" to "Alpha","leadingIcon" to "looks_one","trailingIcon" to "check")),LR("r1",mapOf("headline" to "Bravo","leadingIcon" to "looks_two","trailingIcon" to "check")),
            LR("r2",mapOf("headline" to "Sierra","leadingIcon" to "looks_3","trailingIcon" to "check","selected" to true)))
        "disabled"->listOf(LR("r0",mapOf("type" to "button","headline" to "Enabled")),LR("r1",mapOf("type" to "button","headline" to "Disabled","disabled" to true,"leadingIcon" to "block")),
            LR("r2",mapOf("type" to "button","headline" to "Soft disabled","softDisabled" to true,"leadingIcon" to "visibility_off")))
        "selectedHover"->listOf(LR("r0",mapOf("headline" to "Plain","leadingIcon" to "label","trailingIcon" to "check")),LR("r1",mapOf("headline" to "Selected","leadingIcon" to "label","trailingIcon" to "check","selected" to true)),
            LR("r2",mapOf("headline" to "Plain two","leadingIcon" to "label")))
        "trailing"->listOf(LR("r0",mapOf("type" to "button","headline" to "Inbox","leadingIcon" to "inbox"),listOf("trailing" to LR("del",mapOf("icon" to "delete","label" to "Delete"),tag="md-icon-button"))),
            LR("r1",mapOf("type" to "button","headline" to "Alerts"),listOf("trailing" to LR("sw",mapOf("label" to "Alerts"),tag="md-switch"))),LR("r2",mapOf("type" to "button","headline" to "Archive")))
        "expand"->listOf(LR("r0",mapOf("type" to "button","headline" to "Before")),
            LR("r1",mapOf("type" to "button","headline" to "Folders","leadingIcon" to "folder","expandable" to true),listOf("expanded-content" to LR("c0",mapOf("type" to "button","headline" to "Photos","leadingIcon" to "image")),
                "expanded-content" to LR("c1",mapOf("type" to "button","headline" to "Music","leadingIcon" to "music_note")))),LR("r2",mapOf("type" to "button","headline" to "After")))
        "reorder"->listOf("One","Two","Three","Four").mapIndexed { i,h-> LR("r$i",mapOf("type" to "button","headline" to h,"leadingIcon" to "drag_pan")) }
        "images"->listOf("r0" to "Beach","r1" to "Forest","r2" to "City").map { LR(it.first,mapOf("headline" to it.second,"supportingText" to "Photo","leadingImage" to image)) }
        "typeahead"->listOf("Apple","Banana","Blueberry","Cherry").mapIndexed { i,h-> LR("r$i",mapOf("type" to "button","headline" to h)) }
        else->emptyList()
    }
    private val events=mutableListOf<Triple<String,AWCValue,String>>()
    private var boxes=mapOf<String,Pair<Double,Double>>()
    @Composable private fun Row(r:LR) {
        val comp:@Composable ()->Unit={ AWCComponent(r.tag,r.p+("id" to r.id),onEvent={ n,d-> events+=Triple(n,d,r.id) }) { slot-> r.children.filter { it.first==slot }.forEach { Row(it.second) } } }
        val box=boxes[r.id]
        val c=controllers[r.id]
        if(box!=null) Box(Modifier.size(box.first.dp,box.second.dp).clipToBounds()) { comp() } else if(c!=null) AWCListItemControllerScope(c,r.id,comp) else comp()
    }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        view=LocalView.current
        val r=run;val dark=r.optString("theme")=="dark"
        AWCTheme(dark) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) { key(epoch) {
            Box(Modifier.absoluteOffset(10.dp,860.dp)) { AWCComponent("md-button",mapOf("variant" to "text","label" to "Before","id" to "before")) }
            CompositionLocalProvider(LocalLayoutDirection provides if(r.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(60.dp,60.dp).wrapContentSize(AbsoluteAlignment.TopLeft,unbounded=true).width(360.dp)) {
                    AWCListReducedMotionScope(reduced) { AWCListAppearanceScope(if(hooks) listHooks else AWCListAppearance()) {
                        var inner:@Composable ()->Unit={ AWCListInspectionScope(inspection) { AWCInspectionScope(collector,"list") {
                            val lp=mutableMapOf<String,Any?>("listStyle" to r.optString("style"),"selectionMode" to r.optString("mode"),"interactionMode" to r.optString("interaction"),"label" to "Reference list","id" to "list")
                            if(r.optBoolean("reorderable")) lp["reorderable"]=true
                            AWCComponent("md-list",lp,onEvent={ n,d-> events+=Triple(n,d,"list") }) { slot-> if(slot=="") rows(r.optString("rows")).forEach { Row(it) } }
                        } } }
                        if(hooks) { val ids=rows(r.optString("rows")).flatMap { listOf(it.id)+it.children.filter { c-> c.second.tag=="md-list-item" }.map { c-> c.second.id } }
                            for(id in ids) { val prev=inner;inner={ AWCListItemAppearanceScope(itemHooks,id) { prev() } } } }
                        inner()
                    } }
                }
            }
            Box(Modifier.absoluteOffset(120.dp,860.dp)) { AWCComponent("md-button",mapOf("variant" to "text","label" to "After","id" to "after")) }
        } } }
    } } }
    private fun key(code:Int,meta:Int=0) { compose.runOnUiThread { val v=view!!;val t=compose.mainClock.currentTime
        v.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_DOWN,code,0,meta));v.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_UP,code,0,meta))
        // A state write outside composition reaches the frame once its apply notification is sent (the paused
        // test clock does not drain the main looper between frames; a device does so immediately).
        androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications() } }
    private fun mouse(block:MouseInjectionScope.()->Unit) { compose.onRoot().performMouseInput(block) }
    private fun at(x:Double,y:Double)=Offset((x*2).toFloat(),(y*2).toFloat())
    private val away=Offset(2380f,1200f)
    private fun numbers(s:String)=Regex("-?[0-9.]+(?:e-?[0-9]+)?").findAll(s).map { it.value.toDouble() }.toList()
    private fun pre(c:List<Double>)=listOf(c[0]*c[3],c[1]*c[3],c[2]*c[3],c[3])
    @Test fun listInteractionsMatchChrome() {
        val fixture=ListWeb.document("list-web-fixtures.json");image=fixture.getString("image")
        fun hv(h:JSONObject,kinds:(String)->String)=ListWeb.values(h,h.keys().asSequence().toList(),kinds)
        listHooks=AWCListAppearance.fromValues(hv(fixture.getJSONObject("listHooks")) { ListWeb.listKinds[it] ?: "length" })
        itemHooks=AWCListItemAppearance.fromValues(hv(fixture.getJSONObject("itemHooks"),ListWeb::kind))
        content();compose.mainClock.autoAdvance=false
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("listStatesOnly")
        for((file,set) in listOf("list-web-states" to "full","list-web-states-reduced" to "reduced","list-web-states-extra" to "extra")) {
            val oracle=ListWeb.document("$file.json")
            for(r in oracle.getJSONArray("runs").objects()) if(only==null || "$set/${r.getString("name")}".contains(only)) runCase(r,set,file)
        }
        ListWeb.log("list-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("knownGaps",JSONArray(latencyGaps)).put("knownGapKind","input-latency: within one more frame (±50/56 ms) of Chrome's per-frame envelope").put("report",report).put("pending",JSONArray(pending)))
        android.util.Log.i("AWCList","list-states ${checks-failures.size}/$checks; input-latency gaps ${latencyGaps.size}")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun frames(ms:Double,sample:()->Unit) { var t=0.0;while(t<ms) { compose.mainClock.advanceTimeByFrame();t+=16.0;sample() } }
    private fun runCase(r:JSONObject,set:String,file:String) {
        val name=r.getString("name");val scenario=r.getString("scenario");val label=(if(set=="full") "" else "$set/")+name
        reduced=set=="reduced";hooks=scenario=="custom" || r.optBoolean("hooks")
        mouse { moveTo(away,0) }
        val firstItems=r.getJSONArray("phases").getJSONObject(0).getJSONObject("snap").getJSONArray("items").objects()
        boxes=listOf("r0" to "del","r1" to "sw").mapNotNull { (row,id)-> firstItems.firstOrNull { it.getString("id")==row }?.getJSONObject("slots")?.getJSONArray("trailing")?.objects()?.firstOrNull()
            ?.getJSONObject("rect")?.let { id to (it.getDouble("width") to it.getDouble("height")) } }.toMap().takeIf { r.getString("rows")=="trailing" } ?: emptyMap()
        events.clear();inspection.clear();collector.clear();run=r;epoch++
        repeat(12) { compose.mainClock.advanceTimeByFrame() };compose.waitForIdle()
        compose.runOnUiThread { view?.clearFocus() };repeat(3) { compose.mainClock.advanceTimeByFrame() }
        events.clear();inspection.events.clear()
        val phases=r.getJSONArray("phases").objects();val webT0=phases.first().getDouble("t")
        fun webItem(id:String,before:Int):JSONObject? { for(i in (0 until max(1,before)).reversed()) phases[i].getJSONObject("snap").getJSONArray("items").objects().firstOrNull { it.getString("id")==id }?.let { return it }
            return phases[0].getJSONObject("snap").getJSONArray("items").objects().firstOrNull { it.getString("id")==id } }
        fun center(id:String,i:Int):Offset { val rc=webItem(id,i)!!.getJSONObject("rect");return at(rc.getDouble("x")+60,rc.getDouble("y")+min(rc.getDouble("height"),56.0)/2) }
        fun part(id:String,key:String,i:Int):Offset { val rc=webItem(id,i)!!.getJSONObject(key).getJSONObject("rect");return at(rc.getDouble("x")+rc.getDouble("width")/2,rc.getDouble("y")+rc.getDouble("height")/2) }
        fun slot(id:String,i:Int):Offset { val rc=webItem(id,i)!!.getJSONObject("slots").getJSONArray("trailing").getJSONObject(0).getJSONObject("rect");return at(rc.getDouble("x")+rc.getDouble("width")/2,rc.getDouble("y")+rc.getDouble("height")/2) }
        val keys=mapOf("Tab" to KeyEvent.KEYCODE_TAB,"ArrowDown" to KeyEvent.KEYCODE_DPAD_DOWN,"ArrowUp" to KeyEvent.KEYCODE_DPAD_UP,"ArrowRight" to KeyEvent.KEYCODE_DPAD_RIGHT,"ArrowLeft" to KeyEvent.KEYCODE_DPAD_LEFT,
            "Home" to KeyEvent.KEYCODE_MOVE_HOME,"End" to KeyEvent.KEYCODE_MOVE_END,"Enter" to KeyEvent.KEYCODE_ENTER,"Space" to KeyEvent.KEYCODE_SPACE,"b" to KeyEvent.KEYCODE_B,"l" to KeyEvent.KEYCODE_L,"c" to KeyEvent.KEYCODE_C)
        fun press(k:String) { key(keys[k]!!) }
        val actions=mutableMapOf<Int,()->Unit>()
        var dragHandle:Offset?=null;var dy=0.0
        if(scenario in setOf("drag","dragUp","dragCancel","custom")) { val hi=phases.indexOfFirst { it.getString("label")=="handle-hover" }
            if(hi>=0) { dragHandle=part(if(scenario=="dragUp") "r3" else "r0","dragHandle",hi)
                val step=webItem("r1",hi)!!.getJSONObject("rect").getDouble("y")-webItem("r0",hi)!!.getJSONObject("rect").getDouble("y");dy=if(scenario=="dragUp") -(step*2.6) else step*2.4 } }
        var dragStarted=false
        phases.forEachIndexed { i,ph-> val lbl=ph.getString("label");val h=dragHandle
            actions[i]=when {
                h!=null && (dragStarted || lbl=="handle-hover")->{ if(lbl=="handle-hover") dragStarted=true
                    when(lbl) { "handle-hover"->{ { mouse { moveTo(h,0) } } };"handle-press"->{ { mouse { moveTo(h,0);press() } } }
                        "move1"->{ { mouse { moveTo(h+Offset(0f,(dy*.25*2).toFloat()),0) } } };"move2"->{ { mouse { moveTo(h+Offset(0f,(dy*.6*2).toFloat()),0) } } }
                        "move3"->{ { mouse { moveTo(h+Offset(0f,(dy*2).toFloat())) } } };"back"->{ { mouse { moveTo(h+Offset(0f,4f),0) } } }
                        "release"->{ { mouse { moveTo(currentPosition+Offset(.001f,0f),0);release() } } };else->{ { mouse { moveTo(away,0) } } } } }
                scenario=="pointer" || scenario=="disabled"->{ val id=lbl.substringBefore('-');val step=lbl.substringAfterLast('-');val p=center(id,i)
                    when(step) { "hover"->{ { mouse { moveTo(p,0) } } };"press"->{ { mouse { moveTo(p,0);press() } } };"release"->{ { mouse { moveTo(currentPosition+Offset(.001f,0f),0);release() } } };else->{ { mouse { moveTo(away,0) } } } } }
                scenario in setOf("select","selectedHover","imageSelect")->{ val p=center(if(scenario=="select") "r0" else "r1",i);val p1=center("r1",i)
                    when(lbl) { "hover"->{ { mouse { moveTo(p,0) } } };"press"->{ { mouse { moveTo(p,0);press() } } };"release"->{ { mouse { moveTo(currentPosition+Offset(.001f,0f),0);release() } } }
                        "second"->{ { mouse { moveTo(p1,0);press();moveTo(p1+Offset(.001f,0f),0);release() } } };"again"->{ { mouse { press();moveTo(currentPosition+Offset(.001f,0f),0);release() } } }
                        "select"->{ { mouse { moveTo(p,0);press();moveTo(p+Offset(.001f,0f),0);release() } } };"deselect"->{ { mouse { press();moveTo(currentPosition+Offset(.001f,0f),0);release() } } };else->{ { mouse { moveTo(away,0) } } } } }
                scenario=="trailing"->when(lbl) { "row-hover"->{ val p=center("r0",i);{ mouse { moveTo(p,0) } } };"button-hover"->{ val p=slot("r0",i);{ mouse { moveTo(p,0) } } }
                    "button-press"->{ { mouse { press() } } };"button-release"->{ { mouse { moveTo(currentPosition+Offset(.001f,0f),0);release() } } };"switch-click"->{ val p=slot("r1",i);{ mouse { moveTo(p,0);press();moveTo(p+Offset(.001f,0f),0);release() } } }
                    "leave"->{ { mouse { moveTo(away,0) } } };"focus-button"->{ { pending+="$label/focus-button (authored control focus by id)" } };"enter-button"->{ { press("Enter") } };else->{ { press("Space") } } }
                scenario=="keyboard" || scenario=="custom"->when(lbl) { "tab","tabAway"->{ { press("Tab") } };"down","down2"->{ { press("ArrowDown") } };"end"->{ { press("End") } };"home"->{ { press("Home") } }
                    "typeB"->{ { press("b") } };"typeBl"->{ { press("b");press("l") } };"typeC"->{ { press("c") } };"enter"->{ { press("Enter") } };"space"->{ { press("Space") } }
                    "hover"->{ val p=center("r1",i);{ mouse { moveTo(p,0) } } };"press"->{ val p=center("r1",i);{ mouse { moveTo(p,0);press() } } };"release"->{ { mouse { moveTo(currentPosition+Offset(.001f,0f),0);release() } } };else->{ { mouse { moveTo(away,0) } } } }
                scenario=="expand"->when(lbl) { "hover"->{ val p=center("r1",i);{ mouse { moveTo(p,0) } } };"click-open","click-close"->{ { mouse { press();moveTo(currentPosition+Offset(.001f,0f),0);release() } } }
                    "caret-open"->{ val p=part("r1","expandButton",i);{ mouse { moveTo(p,0);press();moveTo(p+Offset(.001f,0f),0);release() } } };"child-click"->{ val p=center("c0",i);{ mouse { moveTo(p,0);press();moveTo(p+Offset(.001f,0f),0);release() } } };else->{ { mouse { moveTo(away,0) } } } }
                scenario=="expandKeys"->when(lbl) { "focus"->{ { compose.runOnUiThread { controllers["r1"]!!.setFocus(true);androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications() } } };"right"->{ { press("ArrowRight") } };"left","child-left"->{ { press("ArrowLeft") } }
                    "enter","child-enter"->{ { press("Enter") } };else->{ { press("Tab") } } }
                scenario=="keyReorder"->when(lbl) { "focus"->{ { compose.runOnUiThread { controllers["r1"]!!.setFocus(true);androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications() } } };"alt-down"->{ { key(KeyEvent.KEYCODE_DPAD_DOWN,KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON) } }
                    else->{ { key(KeyEvent.KEYCODE_DPAD_UP,KeyEvent.META_ALT_ON or KeyEvent.META_ALT_LEFT_ON) } } }
                else->{ {} } }
        }
        // Frame-clock run: each phase's input at its source time, sampled every frame.
        data class S(val t:Double,val rows:Map<String,Map<String,Any?>>)
        val samples=mutableListOf<S>();val t0=compose.mainClock.currentTime.toDouble();val snaps=mutableListOf<Triple<Int,Map<String,Map<String,Any?>>,androidx.compose.ui.graphics.ImageBitmap>>()
        fun clock()=(compose.mainClock.currentTime-t0).toDouble()
        fun sample() { samples+=S(clock(),HashMap(inspection.rows)) }
        phases.forEachIndexed { i,ph-> val start=ph.getDouble("t")-webT0
            if(ph.getString("label")=="tab" && (scenario=="keyboard" || scenario=="custom")) { compose.runOnUiThread { view?.clearFocus() };press("Tab") } // focus #before
            while(clock()<start) { compose.mainClock.advanceTimeByFrame();sample() }
            actions[i]?.invoke()
            val end=(if(i+1<phases.size) phases[i+1].getDouble("t")-webT0 else start+500)-20
            while(clock()<end) { compose.mainClock.advanceTimeByFrame();sample() }
            snaps+=Triple(i,HashMap(inspection.rows),compose.onRoot().captureToImage())
        }
        repeat(10) { compose.mainClock.advanceTimeByFrame();sample() }
        // Events.
        val lastT=phases.last().getDouble("t")+1000
        val web=r.getJSONArray("events").objects().filter { it.getString("name") !in setOf("click","change") && it.getDouble("t")<lastT && it.optString("target") !in setOf("del","sw") }
        val nat=events.filter { it.first !in setOf("click","change","mdFocus","mdBlur","mdInput","mdItemClick","mdItemSelect","mdRequestActivation","mdItemRequestReorder") && it.third !in setOf("del","sw") }
        check(nat.map { "${it.first}@${it.third}" }==web.map { "${it.getString("name")}@${it.getString("target")}" },"$label events ${nat.map { "${it.first}@${it.third}" }} vs ${web.map { "${it.getString("name")}@${it.getString("target")}" }}")
        nat.zip(web).forEach { (e,w)-> val d=w.optJSONObject("detail") ?: return@forEach;val nd=e.second as? Map<*,*> ?: return@forEach
            for(k in d.keys()) { val v=d.get(k);val n=nd[k]
                val ok=when(v) { is Number->(n as? Number)?.toDouble()?.let { abs(it-v.toDouble())<.01 } ?: false;is JSONArray->(n as? List<*>)?.map { (it as? Number)?.toDouble() }==(0 until v.length()).map { v.getDouble(it) };else->n?.toString()==v.toString() }
                check(ok,"$label ${e.first}.$k $n vs $v") } }
        // Phase ends: selection, expansion, ring, paint.
        for((i,rows,shot) in snaps) { val ph=phases[i];val lbl=ph.getString("label")
            for(it in ph.getJSONObject("snap").getJSONArray("items").objects()) { val id=it.getString("id");val n=rows[id]
                if(n==null) { if(it.getJSONObject("rect").getDouble("width")>0) check(false,"$label/$lbl $id measured");continue }
                check(n["selected"]==it.getString("classes").contains("md-list-item--selected"),"$label/$lbl $id selected ${n["selected"]}")
                check(n["expanded"]==it.getString("classes").contains("md-list-item--expanded"),"$label/$lbl $id expanded ${n["expanded"]}")
                check(n["focusRing"]==it.getJSONObject("host").getString("shadow").contains("inset"),"$label/$lbl $id focus ring ${n["focusRing"]} vs ${it.getJSONObject("host").getString("shadow")}") }
            if(phases.drop(i+1).any { it.getString("label")==lbl }) continue
            // states.html shot clip: the list's initial box widened by 40 and extended 200 below.
            val lr=r.getJSONObject("initial").getJSONObject("list").getJSONObject("rect")
            val clip=JSONObject().put("x",max(0,Math.floor(lr.getDouble("x")).toInt()-40)).put("y",max(0,Math.floor(lr.getDouble("y")).toInt()-40))
                .put("width",Math.ceil(lr.getDouble("width")).toInt()+80).put("height",Math.ceil(lr.getDouble("height")).toInt()+200)
            val bounds=android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds=true }
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().context.assets.open("$file/$name-$lbl.png").use { android.graphics.BitmapFactory.decodeStream(it,null,bounds) }
            val vis=JSONObject(clip.toString()).put("width",minOf(clip.getInt("width"),538-clip.getInt("x"),bounds.outWidth)).put("height",minOf(clip.getInt("height"),1150-clip.getInt("y"),bounds.outHeight))
            val masks=ph.getJSONObject("snap").getJSONArray("items").objects().flatMap { it.getJSONObject("slots").getJSONArray("trailing").objects() }.map { s-> val rc=s.getJSONObject("rect")
                Rect(rc.getDouble("x").toFloat(),rc.getDouble("y").toFloat(),(rc.getDouble("x")+rc.getDouble("width")).toFloat(),(rc.getDouble("y")+rc.getDouble("height")).toFloat()) }
            val res=CardWeb.compare(CardWeb.webGrid("$file/$name-$lbl.png",vis),CardWeb.nativeGrid(shot.toPixelMap(),vis.getInt("x"),vis.getInt("y"),vis.getInt("width"),vis.getInt("height")),masks)
            check(res.getInt("compared")>1000 && res.getInt("over6").toDouble()/max(res.getInt("compared"),1)<=.005 && res.getDouble("mean")<=1.0,"$label/$lbl flat pixels $res");report.put(res.put("case","$label/$lbl"))
        }
        // Per-frame values within Chrome's samples (±2 frames; envelope across gaps).
        val webSamples=phases.flatMap { it.getJSONArray("samples").objects() }
        fun envelope(read:(JSONObject)->List<Double>?,t:Double):Pair<List<Double>,List<Double>>? {
            if(webSamples.isEmpty()) return null
            val after=webSamples.indexOfFirst { it.getDouble("t")>=t }
            if(after<0) return read(webSamples.last())?.let { it to it };if(after==0) return read(webSamples[0])?.let { it to it }
            val a=webSamples[after-1];val b=webSamples[after];val ta=a.getDouble("t");val tb=b.getDouble("t")
            val va=read(a);val vb=read(b);if(va==null || vb==null || va.size!=vb.size) return vb?.let { it to it }
            if(tb-ta>34) return va.zip(vb).map { min(it.first,it.second) } to va.zip(vb).map { max(it.first,it.second) }
            val x=if(tb>ta) (t-ta)/(tb-ta) else 1.0;val v=va.zip(vb).map { it.first+(it.second-it.first)*x };return v to v
        }
        fun rgba(v:Any?):List<Double>?=(v as? String)?.let { pre(ListWeb.hexColor(it)) }
        fun item(s:JSONObject,id:String)=s.getJSONArray("items").objects().firstOrNull { it.getString("id")==id }
        val props=listOf<Triple<String,Double,Pair<(JSONObject)->List<Double>?,(Map<String,Any?>)->List<Double>?>>>(
            Triple("state layer",.004,Pair({ w-> w.optJSONObject("layer")?.takeIf { it.optString("display")!="none" }?.let { listOf(it.getDouble("opacity")) } },{ n-> (n["layerOpacity"] as? Double)?.takeIf { it>=0 }?.let { listOf(it) } })),
            Triple("corners",.6,Pair({ w-> w.getJSONArray("radius").let { a-> (0 until a.length()).map { numbers(a.getString(it)).firstOrNull() ?: 0.0 } } },{ n-> @Suppress("UNCHECKED_CAST") (n["radius"] as? List<Double>) })),
            Triple("container",.008,Pair({ w-> pre(CardWeb.color(w.getString("background"))) },{ n-> rgba(n["background"]) })),
            Triple("leading icon",.008,Pair({ w-> w.optJSONObject("leadingIcon")?.let { pre(CardWeb.color(it.getString("color"))) } },{ n-> rgba(n["leadingIconColor"]) })),
            Triple("trailing icon",.008,Pair({ w-> if(w.isNull("trailingIcon")) null else pre(CardWeb.color(w.getString("trailingIcon"))) },{ n-> rgba(n["trailingIconColor"]) })),
            Triple("panel opacity",.012,Pair({ w-> w.optJSONObject("panel")?.let { listOf(it.getDouble("opacity")) } },{ n-> (n["panel"] as? Double)?.let { listOf(it) } })),
            Triple("caret",2.0,Pair({ w-> if(w.isNull("caret")) null else { val m=numbers(w.getString("caret"));listOf(if(m.size>=2) abs(Math.toDegrees(atan2(m[1],m[0]))) else 0.0) } },{ n-> (n["caret"] as? Double)?.let { listOf(180*it) } })),
            Triple("translate",.6,Pair({ w-> val t=w.getString("transform");if(t=="none") listOf(0.0) else listOf(numbers(t).getOrElse(5) { 0.0 }) },{ n-> (n["offsetY"] as? Number)?.toDouble()?.let { listOf(it) } })),
            Triple("drag handle",.02,Pair({ w-> if(w.isNull("dragHandle")) null else listOf(w.getDouble("dragHandle")) },{ n-> (n["handleOpacity"] as? Double)?.let { listOf(it) } })))
        val ids=webSamples.flatMap { s-> s.getJSONArray("items").objects().map { it.getString("id") } }.toSet()
        val webTimes=webSamples.map { it.getDouble("t") }
        val webRows=webSamples.map { s-> s.getJSONArray("items").objects().associateBy { it.getString("id") } }
        fun firstAtLeast(t:Double):Int { var lo=0;var hi=webTimes.size;while(lo<hi) { val m=(lo+hi)/2;if(webTimes[m]<t) lo=m+1 else hi=m };return lo }
        val compared=mutableMapOf<String,Int>()
        for(id in ids.sorted()) for((pname,tol,rw) in props) {
            val series=webRows.map { m-> m[id]?.let(rw.first) }
            fun env(t:Double):Pair<List<Double>,List<Double>>? {
                if(series.isEmpty()) return null
                val after=firstAtLeast(t)
                if(after>=series.size) return series.last()?.let { it to it };if(after==0) return series[0]?.let { it to it }
                val ta=webTimes[after-1];val tb=webTimes[after];val va=series[after-1];val vb=series[after]
                if(va==null || vb==null || va.size!=vb.size) return vb?.let { it to it }
                if(tb-ta>34) return va.zip(vb).map { min(it.first,it.second) } to va.zip(vb).map { max(it.first,it.second) }
                val x=if(tb>ta) (t-ta)/(tb-ta) else 1.0;val v=va.zip(vb).map { it.first+(it.second-it.first)*x };return v to v
            }
            var fails=0
            for(s in samples) { val n=s.rows[id] ?: continue;val v=rw.second(n) ?: continue;val at=webT0+s.t
                if(webTimes.isNotEmpty() && at-34<webTimes[0]) continue
                fun window(from:Double,to:Double):Pair<List<Double>,List<Double>>? { var lo:List<Double>?=null;var hi:List<Double>?=null;var x=from
                    while(x<=to) { env(x)?.takeIf { it.first.size==v.size }?.let { e-> lo=lo?.zip(e.first)?.map { min(it.first,it.second) } ?: e.first;hi=hi?.zip(e.second)?.map { max(it.first,it.second) } ?: e.second };x+=2 }
                    return lo?.let { it to hi!! } }
                val (l,h)=window(at-34,at+40) ?: continue
                val ok=v.indices.all { v[it]>=l[it]-tol && v[it]<=h[it]+tol }
                // Chrome's inputs reach the page 1-52 ms after the phase time (CDP round trips; measured per phase from
                // the oracle's events), so a value within one more frame of Chrome's envelope is recorded as an
                // input-latency gap, not hidden; anything further is a failure.
                val near=!ok && window(at-50,at+56)?.let { (l2,h2)-> v.indices.all { v[it]>=l2[it]-tol && v[it]<=h2[it]+tol } } == true
                if(near) latencyGaps+="$label $id $pname rendered $v at web ${at.toInt()} within Chrome [$l, $h]"
                else if(!ok) { fails++;if(fails<=3) check(false,"$label $id $pname rendered $v at web ${at.toInt()} within Chrome [$l, $h]") } else check(true,"")
                compared[pname]=(compared[pname] ?: 0)+1 }
            if(fails>3) check(false,"$label $id $pname: $fails frames outside Chrome's envelope") }
        check((compared["corners"] ?: 0)>50,"$label per-frame samples compared $compared")
        report.put(JSONObject().put("case",label).put("samples",samples.size).put("compared",JSONObject(compared as Map<*,*>)))
        mouse { moveTo(away,0) };repeat(6) { compose.mainClock.advanceTimeByFrame() }
    }
}
