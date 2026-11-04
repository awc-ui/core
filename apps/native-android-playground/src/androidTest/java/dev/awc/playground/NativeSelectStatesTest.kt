package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
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
import kotlin.math.max
import kotlin.math.min

/**
 * md-select interactions and motion against Chrome 153 (picker-states.html: 10 runs, full and reduced motion; shared
 * fixtures select-web-states(-reduced).json, byte-identical to the Swift ones). Pointer open / pick / reopen / outside
 * close, keyboard open (ArrowDown, Enter, Space), roving focus and typeahead in the listbox, Escape and Tab, closed-trigger
 * keys, the filterable header. Each run is replayed on the paused frame clock with injected mouse and key input at the
 * oracle's CDP times (move +33, press +67, release +100 ms). Per phase: open state, value, caret rotation, listbox surface
 * (opacity, scaleY, box), focus, the roving row, per-frame motion inside Chrome's ±2-frame envelope, md* events (order,
 * phase, time, mdChange detail) and the phase-end pixels (best frame of Chrome's capture window).
 */
class NativeSelectStatesTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"nodes\":[],\"viewport\":[1200,900]}"))
    private var reduced by mutableStateOf(false)
    private var epoch by mutableIntStateOf(0)
    private var shift by mutableFloatStateOf(0f)
    private var base=0f
    private var scope=AWCMenuScopeState()
    private val collector=AWCInspectionCollector()
    private val inspection=AWCMenuInspection()
    private val selectInspection=AWCSelectInspection()
    private var view:android.view.View?=null
    private var focusManager:androidx.compose.ui.focus.FocusManager?=null
    private var t0=0L
    private val events=mutableListOf<Triple<String,Double,Any?>>()
    private var options=listOf<Pair<String,String>>()   // (row id, label)
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun now()=(compose.mainClock.currentTime-t0).toDouble()
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        view=LocalView.current;focusManager=androidx.compose.ui.platform.LocalFocusManager.current
        val r=run;val dark=r.optString("theme")=="dark"
        AWCTheme(dark) { key(epoch) {
            val tokens=if(dark) dev.awc.nativeui.generated.AWCGeneratedTokens.dark else dev.awc.nativeui.generated.AWCGeneratedTokens.light
            val surface=MenuWeb.hex(tokens["--md-sys-color-surface"] ?: "#FEF7FF")
            val vp=r.optJSONArray("viewport");val vw=vp?.optDouble(0,1200.0) ?: 1200.0;val vh=vp?.optDouble(1,900.0) ?: 900.0
            val nodes=MenuWeb.nodes(r.optJSONArray("nodes") ?: JSONArray())
            val host=MenuWeb.rect(r.optJSONObject("host"));val rtl=r.optString("dir")=="rtl"
            Box(Modifier.fillMaxSize().background(surface)) {
                Box(Modifier.wrapContentSize(Alignment.TopStart,unbounded=true).requiredSize(vw.dp,vh.dp).graphicsLayer { translationX=-shift*2 }) {
                    AWCMenuScope(scope,Modifier.fillMaxSize().background(surface)) {
                        AWCMenuReducedMotionScope(reduced) { AWCFieldReducedMotionScope(reduced) { AWCMenuInspectionScope(inspection) { AWCSelectInspectionScope(selectInspection) {
                            for(n in nodes) Box(Modifier.absoluteOffset(24.dp,host[1].dp).width(r.optDouble("width",320.0).dp)) {
                                CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                    Box(Modifier.align(if(rtl) Alignment.TopEnd else Alignment.TopStart)) {
                                        AWCInspectionScope(collector,n.id) { RenderEvents(n) }
                                    }
                                }
                            }
                            // The oracle page's next focusable lies outside the fixture: Tab from the select leaves it.
                            Box(Modifier.absoluteOffset(1100.dp,850.dp).size(1.dp).focusable())
                        } } } }
                    }
                }
            }
        } }
    } } }
    @Composable private fun RenderEvents(n:MenuWeb.Node) {
        when(n.tag) {
            "#text"->AWCSlotText(n.props.optString("text"))
            "#symbol"->AWCMaterialSymbol(n.props.optString("name"))
            else->AWCComponent(n.tag,MenuWeb.props(n),onEvent={ name,d-> if(name.startsWith("md") && n.id=="m") events+=Triple(name,now(),d) }) { slot->
                n.children.filter { it.slot==slot }.forEach { RenderEvents(it) } }
        }
    }
    private data class Sample(val t:Double,val open:Boolean,val value:String,val caret:Double,val opacity:Double,val scaleY:Double,val surface:AWCInspectionBounds?,
                              val focus:String,val roving:String?)
    private fun label(row:String?)=options.firstOrNull { it.first==row }?.second
    private fun sample():Sample {
        val snap=collector.snapshot().nodes.associateBy { it.id }
        val st=selectInspection.states["m"] ?: emptyMap()
        val menu=scope.menu("m::menu");val open=menu.isOpen
        val v=inspection.menus["m::menu"] ?: emptyMap()
        val progress=if(open) (v["progress"] as? Double ?: 0.0) else 0.0
        val sy=if(open) (v["scaleY"] as? Double ?: .8) else if(reduced) 1.0 else .8
        val row=if(open) menu.focusedRow else null
        val focus=label(row)?.let { "option:$it" } ?: if(st["focused"]==true) "field" else "body"
        return Sample(now(),st["open"]==true,st["value"] as? String ?: "",(selectInspection.states["m::caret"]?.get("rotation") as? Double) ?: 0.0,progress,sy,
            snap["m::menu.surface"]?.bounds,focus,label(row))
    }
    private fun frame() { compose.mainClock.advanceTimeByFrame() }
    private fun shiftScene(s:Float) { if(shift==s) return;compose.runOnUiThread { shift=s;androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications();view?.invalidate() };Thread.sleep(60) }
    private fun pump(samples:MutableList<Sample>,start:Double,until:Double) {
        while(now()<until-16) { frame();samples+=sample().let { it.copy(t=it.t-start) } }
        if(now()<until) { compose.mainClock.advanceTimeBy((until-now()).toLong(),ignoreFrameDuration=true);samples+=sample().let { it.copy(t=it.t-start) } }
    }
    private fun keyCode(k:String)=when(k) { "ArrowDown"->KeyEvent.KEYCODE_DPAD_DOWN;"ArrowUp"->KeyEvent.KEYCODE_DPAD_UP;"ArrowRight"->KeyEvent.KEYCODE_DPAD_RIGHT;"ArrowLeft"->KeyEvent.KEYCODE_DPAD_LEFT
        "Escape"->KeyEvent.KEYCODE_ESCAPE;"Home"->KeyEvent.KEYCODE_MOVE_HOME;"End"->KeyEvent.KEYCODE_MOVE_END;"Tab"->KeyEvent.KEYCODE_TAB;"Enter"->KeyEvent.KEYCODE_ENTER;" "->KeyEvent.KEYCODE_SPACE
        else->KeyEvent.KEYCODE_A+(k.lowercase()[0]-'a') }
    private fun key(k:String) { compose.runOnUiThread { val v=view!!;val t=compose.mainClock.currentTime
        v.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_DOWN,keyCode(k),0,0));v.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_UP,keyCode(k),0,0))
        androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications() } }
    private fun at(p:Pair<Double,Double>)=Offset(((p.first-base)*2).toFloat(),(p.second*2).toFloat())
    private fun mouse(block:MouseInjectionScope.()->Unit) { compose.onRoot().performMouseInput(block) }
    private fun bounds(id:String)=collector.snapshot().nodes.firstOrNull { it.id==id }?.bounds
    /** "field" or "row:<label>" in page coordinates (the scene draws shifted left by `shift`). */
    private fun center(target:String):Pair<Double,Double>? {
        val b=when { target=="field"->bounds("m.field");target.startsWith("row:")->options.firstOrNull { it.second==target.drop(4) }?.let { bounds(it.first) };else->null } ?: return null
        return (b.x+shift+b.width/2) to (b.y+b.height/2)
    }
    private fun act(a:JSONObject?,samples:MutableList<Sample>,start:Double) {
        a ?: return
        when(val kind=a.optString("kind")) {
            "click","move"->{
                val pa=a.optJSONArray("point")
                var p=if(pa!=null) min(pa.getDouble(0),base+530.0) to pa.getDouble(1) else center(a.optString("target"))
                if(kind=="move") bounds("m.field")?.let { p=(it.x+shift+a.optDouble("dx",0.0)) to (it.y+a.optDouble("dy",0.0)) }
                if(p==null) { check(false,"target ${a.optString("target")} not found");return }
                val begin=now()
                pump(samples,start,begin+33);mouse { moveTo(at(p),0) }
                if(kind=="click") {
                    pump(samples,start,begin+67);mouse { moveTo(at(p),0);press(MouseButton.Primary) }
                    pump(samples,start,begin+100);mouse { moveTo(at(p),0);release(MouseButton.Primary) }
                    // A press on the page outside any control moves the browser's focus to the body.
                    if(pa!=null) compose.runOnUiThread { focusManager?.clearFocus(true) }
                }
            }
            "key"->key(a.optString("key"))
            "keys"->{ val begin=now();for(k in (a.optJSONArray("keys") ?: JSONArray()).let { arr-> (0 until arr.length()).map { arr.getJSONArray(it) } }) {
                pump(samples,start,begin+k.optDouble(1,0.0));key(k.getString(0)) } }
            "type"->for(ch in a.optString("text")) { key(ch.toString());val b=now();pump(samples,start,b+20) }
            "tabIn"->compose.runOnUiThread { scope.focusAnchor("m::trigger") }
        }
    }
    @Test fun selectInteractionsMatchChrome() {
        content();compose.mainClock.autoAdvance=false
        val args=androidx.test.platform.app.InstrumentationRegistry.getArguments()
        val only=args.getString("selectStatesOnly");val onlyReduced=args.getString("selectStatesReduced")
        for((file,red) in listOf("select-web-states" to false,"select-web-states-reduced" to true)) {
            if(onlyReduced!=null && onlyReduced!=(if(red) "1" else "0")) continue
            val oracle=CardWeb.document("$file.json")
            for(r in oracle.getJSONArray("runs").objects()) if(only==null || only.split(',').any { r.getString("name").contains(it) }) runCase(r,file,red)
        }
        SelectWeb.log("select-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("report",report))
        android.util.Log.i("AWCSelect","select-states ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun runCase(r:JSONObject,file:String,red:Boolean) {
        val name=r.getString("name")+(if(red) " (reduced)" else "")
        val phases=r.getJSONArray("phases").objects()
        val x0=phases.minOf { it.getJSONObject("clip").getInt("x") }
        val x1=phases.maxOf { it.getJSONObject("clip").getInt("x")+it.getJSONObject("clip").getInt("width") }
        base=max(0,min(x0-8,x1-530)).toFloat();shift=base
        mouse { moveTo(Offset(2f,1790f),0) }
        compose.runOnUiThread { focusManager?.clearFocus(true) }
        val nodes=MenuWeb.nodes(r.optJSONArray("nodes") ?: JSONArray())
        options=(nodes.firstOrNull()?.children ?: emptyList()).filter { it.tag=="md-select-option" && !it.props.optBoolean("hidden") }
            .mapIndexed { i,o-> "m::opt$i" to o.props.optString("label").ifEmpty { o.children.filter { it.tag=="#text" }.joinToString("") { it.props.optString("text") }.trim() } }
        scope=AWCMenuScopeState();collector.clear();inspection.clear();selectInspection.states.clear();selectInspection.events.clear();reduced=red;run=r;epoch++
        repeat(30) { frame() }
        events.clear();t0=compose.mainClock.currentTime
        val phaseSamples=mutableListOf<List<Sample>>();val phaseStarts=mutableListOf<Double>();val phaseShots=mutableListOf<Pair<Double,JSONObject>?>()
        for(p in phases) {
            val start=p.optDouble("t",0.0)
            val web=p.getJSONArray("samples").objects();val lastWeb=web.lastOrNull()?.optDouble("t",start) ?: start
            val duration=if(p.isNull("ms")) lastWeb-start+17 else p.getDouble("ms")
            while(now()<start-16) frame()
            if(now()<start) compose.mainClock.advanceTimeBy((start-now()).toLong(),ignoreFrameDuration=true)
            val actual=now()
            val samples=mutableListOf(sample().let { it.copy(t=it.t-actual) })
            act(p.optJSONObject("act"),samples,actual)
            // Chrome captures the phase after its last sampled frame: each candidate frame is compared at once and only the
            // best result is kept (holding every frame's grid exhausts the instrumentation heap).
            val clip=p.getJSONObject("clip");val webG=CardWeb.webGrid("$file/${p.getString("shot")}",clip)
            val masks=selectionMask(webG)
            var best:Pair<Double,JSONObject>?=null;var shots=0
            fun shoot() { val r=CardWeb.compare(webG,MenuEvidence.capture(compose,clip) { s-> shiftScene(s) }.also { shiftScene(base) },masks).put("selectionMask",masks.size);shots++
                if(best==null || r.getInt("over6")*1e6+r.getDouble("mean")<best!!.second.getInt("over6")*1e6+best!!.second.getDouble("mean")) best=(now()-actual) to r }
            var nextShot=lastWeb-start+17
            while(now()<actual+duration) {
                frame();samples+=sample().let { it.copy(t=it.t-actual) }
                if(now()>=actual+nextShot && now()<=actual+duration+1) { shoot();nextShot+=16 }
            }
            if(shots==0) shoot()
            phaseSamples+=samples;phaseStarts+=actual;phaseShots+=best
        }
        phases.forEachIndexed { i,p-> compare(name,p,phaseSamples[i],phaseShots[i],file) }
        val end=phases.last().let { it.optDouble("t",0.0)+it.optDouble("ms",0.0) }
        val webEvents=r.getJSONArray("events").objects().filter { it.optDouble("t",0.0)<=end }
        val names=events.map { it.first };val webNames=webEvents.map { it.getString("name") }
        check(names==webNames,"$name events $names vs $webNames")
        if(names==webNames) {
            val webStarts=phases.map { it.optDouble("t",0.0) }
            fun rel(t:Double,starts:List<Double>):Pair<Int,Double> { val i=max(0,starts.indexOfLast { it<=t+1 });return i to t-starts[i] }
            for((e,w) in events.zip(webEvents)) {
                val n=rel(e.second,phaseStarts);val wv=rel(w.optDouble("t",0.0),webStarts)
                // A phase the oracle page stalled in (over 5 s between its steps, Mac Chrome reduced-motion captures) has no
                // meaningful event time: order and detail are still checked.
                val stalled=phases.getOrNull(wv.first)?.optDouble("ms",0.0)?.let { it>5000 } ?: false
                if(!stalled) check(n.first==wv.first && abs(n.second-wv.second)<=60,"$name ${e.first} in phase ${n.first} at +${n.second.toInt()} vs phase ${wv.first} at +${wv.second.toInt()} ms")
                if(e.first=="mdChange") check(e.third?.toString()==w.opt("detail")?.toString(),"$name mdChange detail ${e.third} vs ${w.opt("detail")}")
            }
        }
        report.put(JSONObject().put("run",name).put("events",JSONArray(names)))
        android.util.Log.i("AWCSelect","run $name: ${checks-failures.size}/$checks")
        compose.runOnUiThread { scope.menuIds.forEach { scope.menu(it).close() } };repeat(30) { frame() }
    }
    /** Chrome selects the text of an input focused with Tab and paints it with the macOS selection highlight (#B3D5FE); a
     *  native read-only trigger does not select on keyboard focus (Android convention). That highlight box is masked. */
    private fun selectionMask(g:CardWeb.Grid):List<androidx.compose.ui.geometry.Rect> {
        var x0=Int.MAX_VALUE;var y0=Int.MAX_VALUE;var x1=-1;var y1=-1
        for(py in 0 until g.h) for(px in 0 until g.w) { val i=(py*g.w+px)*3
            if(abs(g.v[i]-179)<=8 && abs(g.v[i+1]-213)<=8 && abs(g.v[i+2]-254)<=8) { x0=min(x0,px);y0=min(y0,py);x1=max(x1,px);y1=max(y1,py) } }
        if(x1<0) return emptyList()
        return listOf(androidx.compose.ui.geometry.Rect((g.x+x0-2).toFloat(),(g.y+y0-2).toFloat(),(g.x+x1+3).toFloat(),(g.y+y1+3).toFloat()))
    }
    private fun compare(name:String,p:JSONObject,samples:List<Sample>,best:Pair<Double,JSONObject>?,file:String) {
        val label=p.getString("label");val web=p.getJSONArray("samples").objects();val tag="$name $label"
        val end=samples.lastOrNull();val w=web.lastOrNull()
        if(end==null || w==null) { check(false,"$tag no samples");return }
        check(end.open==w.optBoolean("open"),"$tag open ${end.open}")
        check(end.value==w.optString("value"),"$tag value ${end.value} vs ${w.optString("value")}")
        check(abs(end.caret-w.optDouble("caret",0.0))<=.05,"$tag caret ${end.caret} vs ${w.optDouble("caret")}")
        val ws=w.optJSONObject("surface") ?: JSONObject();val webOpacity=ws.optDouble("opacity",0.0)
        check(abs(end.opacity-webOpacity)<=.02,"$tag surface opacity ${end.opacity} vs $webOpacity")
        if(webOpacity>.99) { val s=end.surface
            check(s!=null && abs(s.y-ws.optDouble("y"))<=1 && abs(s.width-ws.optDouble("w"))<=1 && abs(s.height-ws.optDouble("h"))<=1,
                "$tag surface y/w/h ${s?.let { "(%.1f,%.1f,%.1f)".format(it.y,it.width,it.height) }} vs (${ws.optDouble("y")},${ws.optDouble("w")},${ws.optDouble("h")})") }
        // "body": focus left the fixture (the next focusable of the oracle page lies outside it).
        val wf=w.optString("active")
        check(if(wf=="body") end.focus!="field" && !end.focus.startsWith("option:") else end.focus==wf,"$tag focus ${end.focus} vs $wf")
        if(w.optBoolean("open")) {
            val rows=w.optJSONArray("rows") ?: JSONArray()
            val webRoving=(0 until rows.length()).map { rows.getJSONObject(it) }.firstOrNull { it.optString("tab")=="0" }?.optString("t")
            check(end.roving==webRoving,"$tag roving row ${end.roving} vs $webRoving")
        }
        // Motion: every Chrome frame inside the native envelope (−40 / +34 ms plus the neighbour samples).
        val start=p.optDouble("t",0.0);var checked=0;var bad=0;var worst=""
        for(s in web) {
            val t=s.optDouble("t",0.0)-start
            val near=samples.filter { it.t>=t-40 && it.t<=t+34 }.toMutableList()
            samples.lastOrNull { it.t<t-40 }?.let { near+=it };samples.firstOrNull { it.t>t+34 }?.let { near+=it }
            if(near.isEmpty()) continue
            val so=s.optJSONObject("surface") ?: JSONObject();val o=so.optDouble("opacity",0.0)
            val pairs=mutableListOf(Triple("caret",s.optDouble("caret",0.0),near.map { it.caret }))
            if(o>0 || near.any { it.opacity>0 }) {
                pairs+=Triple("opacity",o,near.map { it.opacity })
                if(o>0) pairs+=Triple("scaleY",so.optDouble("scaleY",1.0),near.map { it.scaleY })
            }
            for((k,v,vals) in pairs) { checked++
                if(v<vals.min()-.03 || v>vals.max()+.03) { bad++;if(worst.isEmpty()) worst="$k t=${t.toInt()} web $v native ${vals.map { "%.3f".format(it) }}" } }
        }
        check(bad==0,"$tag motion $bad/$checked frames outside the envelope $worst")
        best ?: return
        val r=best.second
        check(r.getInt("over6").toDouble()/max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0,"$tag flat pixels (frame +${best.first.toInt()}) $r")
    }
}
