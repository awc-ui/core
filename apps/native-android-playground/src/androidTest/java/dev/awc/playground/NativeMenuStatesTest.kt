package dev.awc.playground

import android.view.KeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
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
 * md-menu family interactions against Chrome 153 (menu-states.html: 26 runs, full and reduced motion; shared fixtures
 * menu-web-states(-reduced).json). Each run is replayed on the paused frame clock with injected mouse and key input at the
 * oracle's CDP times (move +33, press +67, release +100 ms): open / close motion per frame (opacity, scaleY within the
 * ±2-frame envelope), md* events (order, phase and time), and at every phase end: open / closing menus and their boxes,
 * the focused element, every row's state layer, anchor and submenu-row expanded state, checkbox / radio selection, and
 * the flat pixels of the phase screenshot (best frame between the last sampled frame and the next phase).
 */
class NativeMenuStatesTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"nodes\":[],\"viewport\":[1200,900]}"))
    private var reduced by mutableStateOf(false)
    private var epoch by mutableIntStateOf(0)
    private var shift by mutableFloatStateOf(0f)
    private var base=0f
    private var scope=AWCMenuScopeState()
    private val collector=AWCInspectionCollector()
    private val inspection=AWCMenuInspection()
    private var view:android.view.View?=null
    private var t0=0L
    private val events=mutableListOf<Triple<String,Double,String>>()
    private val anchorFocus=mutableMapOf<String,Boolean>()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun now()=(compose.mainClock.currentTime-t0).toDouble()
    private fun anchorWidth(text:String):Double {
        val ctx=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext
        val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG or android.graphics.Paint.LINEAR_TEXT_FLAG)
        paint.typeface=ctx.resources.getFont(dev.awc.nativeui.R.font.awc_roboto_medium);paint.textSize=14f*64
        return paint.measureText(text)/64.0+34
    }
    @Composable private fun TestAnchor(id:String,text:String,x:Double,y:Double,w:Double,h:Double,tokens:Map<String,String>,menu:String?) {
        val shape=RoundedCornerShape(50)
        Box(Modifier.absoluteOffset(x.dp,y.dp).size(w.dp,h.dp).awcMenuAnchor(id)
            .onFocusChanged { anchorFocus[id]=it.isFocused }.focusable()
            .onKeyEvent { e-> if(e.type!=KeyEventType.KeyDown) false
                else if((e.key==Key.Enter || e.key==Key.Spacebar) && menu!=null) { scope.menu(menu).show(keyboard=true);true }
                // A web <button> ignores arrow keys (Android would move focus spatially).
                else e.key in setOf(Key.DirectionDown,Key.DirectionUp,Key.DirectionLeft,Key.DirectionRight) }
            .background(MenuWeb.hex(tokens["--md-sys-color-surface"] ?: "#FEF7FF"),shape).border(1.dp,MenuWeb.hex(tokens["--md-sys-color-outline"] ?: "#79747E"),shape)
            .menuAnchorPress { if(menu!=null) scope.menu(menu).show() },contentAlignment=Alignment.Center) {
            BasicText(text,style=MenuWeb.text(14.0,14*1.171875,500,MenuWeb.hex(tokens["--md-sys-color-on-surface"] ?: "#1D1B20")),maxLines=1,softWrap=false)
        }
    }
    private var focusManager:androidx.compose.ui.focus.FocusManager?=null
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        view=LocalView.current;focusManager=androidx.compose.ui.platform.LocalFocusManager.current
        val r=run;val dark=r.optString("theme")=="dark"
        AWCTheme(dark) { key(epoch) {
            val tokens=if(dark) dev.awc.nativeui.generated.AWCGeneratedTokens.dark else dev.awc.nativeui.generated.AWCGeneratedTokens.light
            val surface=MenuWeb.hex(tokens["--md-sys-color-surface"] ?: "#FEF7FF")
            val vp=r.optJSONArray("viewport");val vw=vp?.optDouble(0,1200.0) ?: 1200.0;val vh=vp?.optDouble(1,900.0) ?: 900.0
            val nodes=MenuWeb.nodes(r.optJSONArray("nodes") ?: JSONArray())
            val box=MenuWeb.rect(r.optJSONObject("box"));val anchor=MenuWeb.rect(r.optJSONObject("anchor"))
            val rtl=r.optString("dir")=="rtl"
            val menuOf=nodes.filter { it.tag=="md-menu" }.mapNotNull { m-> m.props.optString("anchor").takeIf { it.isNotEmpty() }?.let { it to m.id } }.distinctBy { it.first }.toMap()
            Box(Modifier.fillMaxSize().background(surface)) {
                Box(Modifier.wrapContentSize(Alignment.TopStart,unbounded=true).requiredSize(vw.dp,vh.dp).graphicsLayer { translationX=-shift*2 }) {
                    AWCMenuScope(scope,Modifier.fillMaxSize().background(surface)) { AWCMenuReducedMotionScope(reduced) { AWCMenuInspectionScope(inspection) {
                        val a=nodes.firstOrNull { it.id=="a" }
                        TestAnchor("a",a?.props?.optString("text") ?: "Edit",anchor[0],anchor[1],anchor[2],anchor[3],tokens,menuOf["a"])
                        var x=anchor[0]+anchor[2]
                        for(e in (r.optJSONArray("extraAnchors") ?: JSONArray()).objects()) { x+=e.optDouble("margin",0.0);val w=anchorWidth(e.getString("text"))
                            TestAnchor(e.getString("id"),e.getString("text"),x,anchor[1],w,anchor[3],tokens,menuOf[e.getString("id")]);x+=w }
                        for(n in nodes.filter { it.tag=="md-menu" }) Box(Modifier.absoluteOffset(box[0].dp,box[1].dp).width(box[2].dp)) {
                            CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                Box(Modifier.align(if(rtl) Alignment.TopEnd else Alignment.TopStart)) {
                                    AWCInspectionScope(collector,n.id) { RenderEvents(n,tokens) }
                                }
                            }
                        }
                    } } }
                }
            }
        } }
    } } }
    @Composable private fun RenderEvents(n:MenuWeb.Node,tokens:Map<String,String>) {
        when(n.tag) {
            "#symbol"->AWCMaterialSymbol(n.props.optString("name"))
            else->AWCComponent(n.tag,MenuWeb.props(n),onEvent={ name,_-> if(name.startsWith("md")) events+=Triple(name,now(),n.id) }) { slot-> n.children.filter { it.slot==slot }.forEach { RenderEvents(it,tokens) } }
        }
    }
    private data class Sample(val t:Double,val menus:List<List<Double>>,val open:List<Boolean>,val closing:List<Boolean>,val focus:String,val layers:List<Double>,
                              val anchorExpanded:String,val rowExpanded:String?,val selected:List<Boolean>)
    private lateinit var nodes:List<MenuWeb.Node>
    private val all get()=MenuWeb.all(nodes)
    private fun webName(id:String?):String {
        if(id==null) return ""
        val n=all.firstOrNull { it.id==id }
        if(n!=null && n.tag!="#anchor") { val h=n.props.optString("headline");val hid=n.props.optString("htmlId")
            return n.tag+(if(hid.isEmpty()) "" else "#$hid")+(if(h.isEmpty()) "" else "[$h]") }
        return "button#$id"
    }
    private fun sample():Sample {
        val snap=collector.snapshot().nodes.associateBy { it.id }
        val menus=all.filter { it.tag=="md-menu" }
        val open=menus.map { scope.menu(it.id).isOpen };val closing=menus.map { scope.menu(it.id).isClosing }
        val boxes=menus.mapIndexed { i,m-> val v=inspection.menus[m.id] ?: emptyMap()
            val p=if(open[i]) (v["progress"] as? Double ?: 0.0) else 0.0
            val sy=if(open[i]) (v["scaleY"] as? Double ?: .8) else if(reduced) 1.0 else .8
            val s=snap["${m.id}.surface"]?.bounds
            listOf(p,sy,(s?.x ?: -shift.toDouble())+shift,s?.y ?: 0.0,s?.width ?: 0.0,(s?.height ?: 0.0)*sy) }
        val rows=all.filter { it.tag=="md-menu-item" || it.tag=="md-sub-menu-item" }
        val focused=scope.menu("m").focusedRow ?: anchorFocus.entries.firstOrNull { it.value }?.key
        val layers=rows.map { (inspection.rows[it.id]?.get("layerOpacity") as? Double) ?: 0.0 }
        val sub=rows.firstOrNull { it.tag=="md-sub-menu-item" }
        val rowExpanded=sub?.let { if(inspection.rows[it.id]?.get("expanded")==true) "true" else "false" }
        val selected=rows.filter { it.props.has("type") }.map { r-> (inspection.rows[r.id]?.get("selected") as? Boolean) ?: scope.selectionOf(r.id) ?: r.props.optBoolean("selected") }
        return Sample(now(),boxes,open,closing,webName(focused),layers,if(scope.menu("m").isOpen) "true" else "false",rowExpanded,selected)
    }
    private fun frame() { compose.mainClock.advanceTimeByFrame() }
    /** Draw-only scene shift (layout, hit testing in scene coordinates and the clock are unchanged); waits for a real draw. */
    private fun shiftScene(s:Float) { if(shift==s) return;compose.runOnUiThread { shift=s;androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications();view?.invalidate() };Thread.sleep(60) }
    private fun pump(samples:MutableList<Sample>,start:Double,until:Double) {
        while(now()<until-16) { frame();samples+=sample().let { it.copy(t=it.t-start) } }
        // Land exactly on the oracle's input time (Chrome's CDP input is not frame-aligned).
        if(now()<until) { compose.mainClock.advanceTimeBy((until-now()).toLong(),ignoreFrameDuration=true);samples+=sample().let { it.copy(t=it.t-start) } }
    }
    private fun keyCode(k:String)=when(k) { "ArrowDown"->KeyEvent.KEYCODE_DPAD_DOWN;"ArrowUp"->KeyEvent.KEYCODE_DPAD_UP;"ArrowRight"->KeyEvent.KEYCODE_DPAD_RIGHT;"ArrowLeft"->KeyEvent.KEYCODE_DPAD_LEFT
        "Escape"->KeyEvent.KEYCODE_ESCAPE;"Home"->KeyEvent.KEYCODE_MOVE_HOME;"End"->KeyEvent.KEYCODE_MOVE_END;"Tab"->KeyEvent.KEYCODE_TAB;"Enter"->KeyEvent.KEYCODE_ENTER;" "->KeyEvent.KEYCODE_SPACE
        else->KeyEvent.KEYCODE_A+(k.lowercase()[0]-'a') }
    private fun key(k:String,shiftKey:Boolean) { compose.runOnUiThread { val v=view!!;val t=compose.mainClock.currentTime;val meta=if(shiftKey) KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON else 0
        v.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_DOWN,keyCode(k),0,meta));v.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_UP,keyCode(k),0,meta))
        androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications() } }
    private fun at(p:Pair<Double,Double>)=Offset(((p.first-base)*2).toFloat(),(p.second*2).toFloat())
    private fun mouse(block:MouseInjectionScope.()->Unit) { compose.onRoot().performMouseInput(block) }
    /** Web target names: "#a", "#row" (htmlId), a headline; points are page coordinates. */
    private fun center(target:String):Pair<Double,Double>? {
        val snap=collector.snapshot().nodes.associateBy { it.id }
        // Inspection bounds are root coordinates; the scene is drawn shifted left by `shift`.
        fun mid(b:AWCInspectionBounds)=(b.x+shift+b.width/2) to (b.y+b.height/2)
        if(target.startsWith("#")) { val id=target.drop(1)
            all.firstOrNull { it.props.optString("htmlId")==id }?.let { n-> snap[n.id]?.bounds?.let { return mid(it) } }
            val r=run.optJSONObject("anchor")
            if(id=="a" && r!=null) return (r.getDouble("x")+r.getDouble("width")/2) to (r.getDouble("y")+r.getDouble("height")/2)
            // Extra anchors follow #a (margin + text width).
            var x=(r?.getDouble("x") ?: 0.0)+(r?.getDouble("width") ?: 0.0)
            for(e in (run.optJSONArray("extraAnchors") ?: JSONArray()).objects()) { x+=e.optDouble("margin",0.0);val w=anchorWidth(e.getString("text"))
                if(e.getString("id")==id) return (x+w/2) to ((r?.getDouble("y") ?: 0.0)+(r?.getDouble("height") ?: 0.0)/2);x+=w }
            return null
        }
        val n=all.firstOrNull { (it.tag=="md-menu-item" || it.tag=="md-sub-menu-item") && it.props.optString("headline")==target } ?: return null
        return snap[n.id]?.bounds?.let { mid(it) }
    }
    private fun act(a:JSONObject,samples:MutableList<Sample>,start:Double) {
        when(val kind=a.optString("kind")) {
            "click","down","up","move"->{
                val pa=a.optJSONArray("point")
                // An outside press beyond the device width lands on the same empty page area inside it.
                var p=if(pa!=null) min(pa.getDouble(0),base+530.0) to pa.getDouble(1) else center(a.optString("target"))
                if(p==null) { check(false,"target ${a.optString("target")} not found (inspected: ${collector.snapshot().nodes.map { it.id }.filter { !it.contains(".h") && !it.contains(".c") && !it.contains(".s") }.take(40)})");return }
                val begin=now()
                // Chrome's trusted click: move, press 67 ms later, release 33 ms after that (CDP round trips).
                if(kind=="move" || kind=="click") { pump(samples,start,begin+33);mouse { moveTo(at(p),0) } }
                if(kind=="click") pump(samples,start,begin+67)
                if(kind=="click" || kind=="down") mouse { moveTo(at(p),0);press(MouseButton.Primary) }
                if(kind=="click") pump(samples,start,begin+100)
                if(kind=="click" || kind=="up") mouse { moveTo(at(p),0);release(MouseButton.Primary) }
                // A press on the page outside any control moves the browser's focus to the body.
                if(pa!=null && kind!="move") compose.runOnUiThread { focusManager?.clearFocus(true) }
            }
            "key"->key(a.optString("key"),a.optBoolean("shift"))
            "show"->compose.runOnUiThread { scope.menu("m").show(autoFocus=if(a.optBoolean("autoFocus",true)) null else false) }
        }
    }
    @Test fun menuInteractionsMatchChrome() {
        content();compose.mainClock.autoAdvance=false
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("menuStatesOnly")
        val onlyReduced=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("menuStatesReduced")
        for((file,red) in listOf("menu-web-states" to false,"menu-web-states-reduced" to true)) {
            if(onlyReduced!=null && onlyReduced!=(if(red) "1" else "0")) continue
            val oracle=CardWeb.document("$file.json")
            for(r in oracle.getJSONArray("runs").objects()) if(only==null || only.split(',').any { r.getString("name").contains(it) }) runCase(r,file,red)
        }
        MenuEvidence.log("menu-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("report",report))
        android.util.Log.i("AWCMenu","menu-states ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun runCase(r:JSONObject,file:String,red:Boolean) {
        val name=r.getString("name")+(if(red) " (reduced)" else "")
        val phases=r.getJSONArray("phases").objects()
        val x0=phases.minOf { it.getJSONObject("clip").getInt("x") }
        val x1=phases.maxOf { it.getJSONObject("clip").getInt("x")+it.getJSONObject("clip").getInt("width") }
        base=max(0,min(x0-8,x1-530)).toFloat();shift=base
        mouse { moveTo(Offset(2f,2f),0) }
        nodes=MenuWeb.nodes(r.optJSONArray("nodes") ?: JSONArray())
        scope=AWCMenuScopeState();collector.clear();inspection.clear();anchorFocus.clear();reduced=red;run=r;epoch++
        repeat(30) { frame() }
        if(r.optBoolean("focusAnchor")) { compose.runOnUiThread { scope.focusAnchor("a") };repeat(3) { frame() } }
        events.clear();t0=compose.mainClock.currentTime
        val phaseSamples=mutableListOf<List<Sample>>();val phaseStarts=mutableListOf<Double>();val phaseShots=mutableListOf<List<Pair<Double,CardWeb.Grid>>>()
        for(p in phases) {
            val start=p.optDouble("t",0.0)
            val web=p.getJSONArray("samples").objects();val lastWeb=web.lastOrNull()?.optDouble("t",start) ?: start
            val duration=if(p.isNull("ms")) lastWeb-start+17 else p.getDouble("ms")
            while(now()<start-16) frame()
            if(now()<start) compose.mainClock.advanceTimeBy((start-now()).toLong(),ignoreFrameDuration=true)
            val actual=now()
            val samples=mutableListOf<Sample>(sample().let { it.copy(t=it.t-actual) })
            act(p.getJSONObject("act"),samples,actual)
            // Chrome captures the phase after its last sampled frame and before the next phase; the frames of that window are candidates.
            val shots=mutableListOf<Pair<Double,CardWeb.Grid>>()
            var nextShot=lastWeb-start+17
            while(now()<actual+duration) {
                frame();samples+=sample().let { it.copy(t=it.t-actual) }
                if(now()>=actual+nextShot && now()<=actual+duration+1) { shots+=(now()-actual) to MenuEvidence.capture(compose,p.getJSONObject("clip")) { s-> shiftScene(s) }.also { shiftScene(base) };nextShot+=16 }
            }
            if(shots.isEmpty()) shots+=(now()-actual) to MenuEvidence.capture(compose,p.getJSONObject("clip")) { s-> shiftScene(s) }.also { shiftScene(base) }
            phaseSamples+=samples;phaseStarts+=actual;phaseShots+=shots
        }
        phases.forEachIndexed { i,p-> compare(name,p,phaseSamples[i],phaseShots[i],file,r.getString("name")) }
        // md* events: order and time within the phase that contains them.
        val lastT=phases.last().getJSONArray("samples").objects().lastOrNull()?.optDouble("t") ?: 0.0
        val webEvents=r.getJSONArray("events").objects().filter { it.optDouble("t",0.0)<=lastT+20 }
        val names=events.map { it.first };val webNames=webEvents.map { it.getString("name") }.filter { it.startsWith("md") }
        check(names==webNames,"$name events $names vs $webNames")
        if(names==webNames) {
            val webStarts=phases.map { it.optDouble("t",0.0) }
            fun rel(t:Double,starts:List<Double>):Pair<Int,Double> { val i=max(0,starts.indexOfLast { it<=t+1 });return i to t-starts[i] }
            for((e,w) in events.zip(webEvents.filter { it.getString("name").startsWith("md") })) {
                val n=rel(e.second,phaseStarts);val wv=rel(w.optDouble("t",0.0),webStarts)
                check(n.first==wv.first && abs(n.second-wv.second)<=60,"$name ${e.first} in phase ${n.first} at +${n.second.toInt()} vs phase ${wv.first} at +${wv.second.toInt()} ms")
            }
        }
        report.put(JSONObject().put("run",name).put("phases",phases.size).put("events",JSONArray(names)))
        android.util.Log.i("AWCMenu","run $name: ${checks-failures.size}/$checks")
        // Close anything left open.
        compose.runOnUiThread { scope.menuIds.forEach { scope.menu(it).close() } };repeat(30) { frame() }
    }
    private fun compare(name:String,p:JSONObject,samples:List<Sample>,shots:List<Pair<Double,CardWeb.Grid>>,file:String,run:String) {
        val label=p.getString("label");val web=p.getJSONArray("samples").objects()
        val end=samples.lastOrNull();val w=web.lastOrNull()
        if(end==null || w==null) { check(false,"$name $label no samples");return }
        val tag="$name $label"
        val wm=w.getJSONArray("menus").objects()
        check(wm.size==end.menus.size,"$tag menu count ${end.menus.size} vs ${wm.size}")
        wm.forEachIndexed { i,wmn-> if(i>=end.menus.size) return@forEachIndexed
            check(end.open[i]==wmn.optBoolean("open"),"$tag menu $i open ${end.open[i]}")
            check(end.closing[i]==wmn.optBoolean("closing"),"$tag menu $i closing ${end.closing[i]}")
            if(wmn.optBoolean("open")) {
                check(abs(end.menus[i][0]-wmn.optDouble("opacity",0.0))<=.02,"$tag menu $i opacity ${end.menus[i][0]} vs ${wmn.optDouble("opacity")}")
                val r=listOf(wmn.optDouble("x"),wmn.optDouble("y"),wmn.optDouble("w"),wmn.optDouble("h"));val n=end.menus[i].drop(2)
                check((0..3).all { abs(n[it]-r[it])<=1 },"$tag menu $i box $n vs $r")
            }
        }
        val left=w.optString("focus")=="button#run"
        val webFocus=w.optString("focus").let { if(it=="button#run" || it=="body") "" else it }
        // "button#run": Tab left the fixture through the document boundary (browser chrome); Compose wraps within the
        // window instead. The component contract is that focus left the menu tree (n1 breadcrumbs precedent).
        if(left) check(!end.focus.startsWith("md-"),"$tag focus ${end.focus} left the menu")
        else check(end.focus==webFocus,"$tag focus ${end.focus} vs $webFocus")
        val wl=(0 until w.getJSONArray("layers").length()).map { w.getJSONArray("layers").optDouble(it,0.0) }
        check(wl.size==end.layers.size && wl.zip(end.layers).all { abs(it.first-it.second)<=.02 },"$tag layers ${end.layers} vs $wl")
        check(end.anchorExpanded==w.optString("anchorExpanded"),"$tag anchor expanded ${end.anchorExpanded} vs ${w.optString("anchorExpanded")}")
        if(w.has("rowExpanded") && w.get("rowExpanded") is String) check(end.rowExpanded==w.getString("rowExpanded"),"$tag row expanded ${end.rowExpanded} vs ${w.getString("rowExpanded")}")
        val ws=(0 until (w.optJSONArray("selected")?.length() ?: 0)).map { w.getJSONArray("selected").optBoolean(it) }
        check(ws==end.selected,"$tag selected ${end.selected} vs $ws")
        // Motion: every Chrome frame inside the native ±2-frame envelope (opacity, scaleY).
        // An exit started by the 150 ms activation timer has no input time: Chrome's own start latency after the timer
        // varies between identical runs (oracle: +166.7 ms and +233.3 ms after the click for the same close), so for those
        // phases the envelope reaches that spread (66.7 ms) further back.
        val act=p.getJSONObject("act");val actKind=act.optString("kind")
        val activation=(actKind=="click" && act.optJSONArray("point")==null && !act.optString("target").startsWith("#")) || (actKind=="key" && act.optString("key") in setOf("Enter"," "))
        val exits=web.any { s-> s.getJSONArray("menus").objects().any { it.optBoolean("closing") } }
        val early=if(activation && exits) 40+66.7 else 40.0
        val start=p.optDouble("t",0.0);var checked=0;var bad=0;var worst=""
        for(s in web) {
            val t=s.optDouble("t",0.0)-start
            val near=samples.filter { it.t>=t-early && it.t<=t+34 }.toMutableList()
            samples.lastOrNull { it.t<t-early }?.let { near+=it };samples.firstOrNull { it.t>t+34 }?.let { near+=it }
            if(near.isEmpty()) continue
            s.getJSONArray("menus").objects().forEachIndexed { i,wmn-> if(i>=end.menus.size || !wmn.optBoolean("open") || wmn.optDouble("h",0.0)<=0) return@forEachIndexed
                for((k,v) in listOf(0 to wmn.optDouble("opacity",0.0),1 to wmn.optDouble("scaleY",1.0))) {
                    val vals=near.map { it.menus[i][k] };checked++
                    if(v<vals.min()-.03 || v>vals.max()+.03) { bad++;if(worst.isEmpty()) worst="${if(k==0) "opacity" else "scaleY"} t=${t.toInt()} web $v native ${vals.map { "%.3f".format(it) }}" } } }
        }
        check(bad==0,"$tag motion $bad/$checked frames outside the envelope $worst")
        // Phase-end pixels: the matching frame of Chrome's capture window.
        val clip=p.getJSONObject("clip")
        val webG=CardWeb.webGrid("$file/$run-$label.png",clip)
        val results=shots.map { it.first to CardWeb.compare(webG,it.second) }
        val best=results.minByOrNull { it.second.getInt("over6")*1e6+it.second.getDouble("mean") } ?: return
        val r=best.second
        check(r.getInt("over6").toDouble()/max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0,"$tag flat pixels (frame +${best.first.toInt()} of ${results.map { it.first.toInt() }}) $r")
    }
}
