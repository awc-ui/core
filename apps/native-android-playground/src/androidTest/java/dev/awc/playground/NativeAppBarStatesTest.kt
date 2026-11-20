package dev.awc.playground

import android.view.KeyEvent
import android.view.MotionEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.test.MouseButton
import androidx.compose.ui.test.MouseInjectionScope
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performMouseInput
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
 * md-app-bar interactions against Chrome 153 (states.html: 15 runs, and 3 under prefers-reduced-motion; shared fixtures
 * app-bar-web-states(-reduced).json, byte-identical to the Swift ones). The bar is rendered through the production AWCComponent
 * dispatch at (60, 60), 720 wide, after a focusable "Before" and before an "After"; the steps of states.html are replayed
 * on a paused clock with injected mouse and key events. At every phase end: the focused element, the host and pill
 * backgrounds, focus / focus-ring state, the pill opacity, the visible state layer, the input value, caret and placeholder
 * alignment and the shown children; every Chrome frame of the colours and the state layer inside the native ±2-frame
 * envelope; the md* events (order, value, time in their phase); the console warnings; the phase screenshots.
 */
class NativeAppBarStatesTest {
    @get:Rule val compose=createComposeRule()
    private data class Sample(val t:Double,val focus:String,val host:List<Double>?,val pill:List<Double>?,val pillOpacity:Double?,val layer:Double?,
                              val focused:Boolean,val ring:Boolean,val value:String?,val selection:Int?,val centered:Boolean?,val visible:Map<String,Boolean>)
    private var bar by mutableStateOf(AppBarWeb.node(JSONObject("{\"id\":\"ab\",\"tag\":\"md-app-bar\",\"properties\":{\"hidden\":true}}")))
    private var dark by mutableStateOf(false)
    private var rtl by mutableStateOf(false)
    private var reduced by mutableStateOf(false)
    private var epoch by mutableIntStateOf(0)
    private var shift by mutableFloatStateOf(0f)
    private var base=0f
    private val collector=AWCInspectionCollector()
    private val probe=AWCAppBarInspection()
    private val events=mutableListOf<Triple<String,Any?,Double>>()
    private var focusedID=""
    private var barFocused=false
    private var view:android.view.View?=null
    private var focusManager:FocusManager?=null
    private val before=FocusRequester()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private var t0=0L
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun now()=(compose.mainClock.currentTime-t0).toDouble()
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        view=LocalView.current;focusManager=LocalFocusManager.current;if(view!=null && !exitSpy) { exitSpy=true;view!!.setOnGenericMotionListener { _,e-> if(e.actionMasked==MotionEvent.ACTION_HOVER_EXIT) hoverExits++;false } }
        val tokens=AppBarWeb.tokens(dark)
        val b=bar
        AWCTheme(dark,emptyMap()) { key(epoch) {
            val page=AppBarWeb.hex(tokens["--md-sys-color-surface-container-lowest"] ?: "#FFFFFF")
            Box(Modifier.fillMaxSize().background(page)) {
                Box(Modifier.wrapContentSize(Alignment.TopStart,unbounded=true).requiredSize(1200.dp,900.dp).background(page).graphicsLayer { translationX=-shift*2 }) {
                    // #before precedes the bar in the DOM (and in the Compose focus order).
                    Box(Modifier.absoluteOffset(10.dp,860.dp).size(60.dp,24.dp).focusRequester(before).onFocusChanged { if(it.isFocused) focusedID="before" else if(focusedID=="before") focusedID="" }.focusable())
                    Box(Modifier.absoluteOffset(60.dp,60.dp).width(720.dp).onFocusChanged { barFocused=it.hasFocus }) {
                        AWCAppBarReducedMotionScope(reduced) { AWCAppBarInspectionScope(probe) {
                            CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                AWCInspectionScope(collector,"ab") {
                                    AWCComponent(b.tag,AppBarWeb.props(b),onEvent={ n,v-> if(n.startsWith("md")) events+=Triple(n,v,now())
                                        // A controlled host: searchValue follows the input (the Web property reflects it).
                                        if(n=="mdSearchInput") (v as? Map<*,*>)?.get("value")?.let { value-> bar=edited { j-> j.getJSONObject("properties").put("searchValue",value) } } }) { slot->
                                        b.children.filter { it.slot==slot }.forEach { c->
                                            // On the element itself (a wrapper would hide its slot data from the bar's layout).
                                            AppBarWeb.Render(c,collector,true,Modifier.onFocusChanged { if(it.hasFocus) focusedID=c.id else if(focusedID==c.id) focusedID="" })
                                        }
                                    }
                                }
                            }
                        } }
                    }
                    Box(Modifier.absoluteOffset(120.dp,860.dp).size(60.dp,24.dp).onFocusChanged { if(it.isFocused) focusedID="after" else if(focusedID=="after") focusedID="" }.focusable())
                }
            }
        } }
    } } }
    private fun v():Map<String,Any?> = probe.bars["ab"] ?: emptyMap()
    private fun rgb(hex:Any?)=(hex as? String)?.let { h-> listOf(1,3,5).map { h.substring(it,it+2).toInt(16).toDouble() } }
    private fun focus():String {
        val p=v()
        if(p["focused"]==true) return "md-app-bar#ab > input.md-app-bar__search-input"
        return when {
            focusedID=="before" || focusedID=="after"->"button#$focusedID"
            focusedID.isNotEmpty()->"md-icon-button#$focusedID"
            barFocused->"md-app-bar#ab > md-icon-button.md-app-bar__leading-button"
            else->"body"
        }
    }
    private fun sample():Sample {
        val p=v();val nodes=collector.snapshot().nodes.associateBy { it.id }
        val shown=(p["trailingShown"] as? List<*>)?.map { it.toString() }
        val visible=bar.children.filter { it.tag.startsWith("md-") && it.id.isNotEmpty() }.associate { c->
            c.id to (if(c.slot=="trailing" && shown!=null) c.id in shown else (nodes[c.id]?.bounds?.width ?: 0.0)>.5) }
        val search=bar.props.optString("variant")=="search"
        return Sample(now(),focus(),rgb(p["fill"]),if(search) rgb(p["pillFill"]) else null,if(search) p["opacity"] as? Double else null,if(search) p["layer"] as? Double else null,
            p["focused"]==true,p["focusRing"]==true,if(search) p["value"] as? String else null,if(search) p["selection"] as? Int else null,
            if(search) p["placeholderCentered"] as? Boolean else null,visible)
    }
    // 6-4: the injected hover exit is delivered to the view asynchronously (measured under load: 560 test-ms / 1.5 s real after the injection, after the last shot); wait until the view has received it, so the shots sample the state after the exit and not before its delivery.
    @Volatile private var hoverExits=0
    private var exitSpy=false
    private val exitLog=mutableListOf<String>()
    private fun mouseExit() { val before=hoverExits;val t0=android.os.SystemClock.uptimeMillis();val c0=now();mouse { exit() };val end=t0+3000
        while(hoverExits<=before && android.os.SystemClock.uptimeMillis()<end) Thread.sleep(5)
        val got=hoverExits>before;val t1=android.os.SystemClock.uptimeMillis()
        // 6-4 (A007): after the view saw the exit, let compose finish the pending interaction/recomposition work before the next sample.
        compose.waitForIdle();exitLog+="exit clk0=$c0 clk1=${now()} got=$got waitedMs=${t1-t0} idleMs=${android.os.SystemClock.uptimeMillis()-t1} exits=$hoverExits" }
    private fun frame() { compose.mainClock.advanceTimeByFrame() }
    private fun shiftScene(s:Float) { if(shift==s) return;compose.runOnUiThread { shift=s;androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications();view?.invalidate() };Thread.sleep(60) }
    private fun advanceTo(t:Double,samples:MutableList<Sample>,start:Double) {
        while(now()<t-16) { frame();samples+=sample().let { it.copy(t=it.t-start) } }
        if(now()<t) { compose.mainClock.advanceTimeBy((t-now()).toLong(),ignoreFrameDuration=true);samples+=sample().let { it.copy(t=it.t-start) } }
    }
    private fun keyCode(k:String)=when(k) { "Tab"->KeyEvent.KEYCODE_TAB;"Enter"->KeyEvent.KEYCODE_ENTER;" "->KeyEvent.KEYCODE_SPACE;"Home"->KeyEvent.KEYCODE_MOVE_HOME
        "End"->KeyEvent.KEYCODE_MOVE_END;"Escape"->KeyEvent.KEYCODE_ESCAPE;else->KeyEvent.KEYCODE_A+(k.lowercase()[0]-'a') }
    private fun key(k:String,shiftKey:Boolean=false) { compose.runOnUiThread { val vw=view!!;val t=compose.mainClock.currentTime;val meta=if(shiftKey) KeyEvent.META_SHIFT_ON or KeyEvent.META_SHIFT_LEFT_ON else 0
        vw.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_DOWN,keyCode(k),0,meta));vw.dispatchKeyEvent(KeyEvent(t,t,KeyEvent.ACTION_UP,keyCode(k),0,meta))
        androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications() } }
    private fun at(p:Pair<Double,Double>)=Offset(((p.first-base)*2).toFloat(),(p.second*2).toFloat())
    private fun mouse(block:MouseInjectionScope.()->Unit) { compose.onRoot().performMouseInput(block) }
    private fun center(target:Any?):Pair<Double,Double>? {
        if(target is JSONArray) return min(target.getDouble(0),base+530.0) to target.getDouble(1)
        val part=when(target) { "pill"->"search";"leading"->"leading-icon";else->target.toString() }
        val b=collector.snapshot().nodes.firstOrNull { it.id=="ab.$part" }?.bounds ?: return null
        return (b.x+shift+b.width/2) to (b.y+b.height/2)
    }
    private fun mutate(change:(JSONObject)->Unit) { val next=edited(change);compose.runOnUiThread { bar=next;androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications() } }
    private fun edited(change:(JSONObject)->Unit):AppBarWeb.Node {
        val json=JSONObject().put("id","ab").put("tag","md-app-bar").put("properties",JSONObject(bar.props.toString()))
            .put("children",JSONArray(bar.children.map { c-> JSONObject().put("id",c.id).put("tag",c.tag).put("slot",c.slot).put("properties",JSONObject(c.props.toString()))
                .put("children",JSONArray(c.children.map { t-> JSONObject().put("id",t.id).put("tag",t.tag).put("properties",t.props) })) }))
        change(json);return AppBarWeb.node(json)
    }
    private fun act(a:JSONObject?,samples:MutableList<Sample>,start:Double) {
        if(a==null) return
        a.opt("move")?.let { t-> val p=center(t) ?: return check(false,"move target $t");mouse { moveTo(at(p),0) }
            // The page point lies beyond the 540 dp device: the pointer leaves the window (hover exit), as it leaves the bar on Web.
            if(t is JSONArray && t.getDouble(0)>base+530.0) mouseExit() }
        a.opt("down")?.let { t-> val p=center(t) ?: return check(false,"down target $t");mouse { moveTo(at(p),0);press(MouseButton.Primary) } }
        a.opt("up")?.let { t-> val p=center(t) ?: return check(false,"up target $t");mouse { moveTo(at(p),0);release(MouseButton.Primary) } }
        a.opt("click")?.let { t-> val p=center(t) ?: return check(false,"click target $t")
            mouse { moveTo(at(p),0);press(MouseButton.Primary) };advanceTo(now()+33,samples,start);mouse { moveTo(at(p),0);release(MouseButton.Primary) } }
        if(a.has("key")) key(a.getString("key"),a.optBoolean("shift"))
        if(a.has("type")) a.getString("type").forEachIndexed { i,ch-> advanceTo(start+1+i*32.6,samples,start);key(ch.toString()) }
        if(a.optString("focus")=="before") compose.runOnUiThread { before.requestFocus() }
        a.optJSONObject("props")?.let { pr-> mutate { j-> val props=j.getJSONObject("properties");for(k in pr.keys()) props.put(k,pr.get(k)) } }
        a.optJSONArray("append")?.let { kids-> mutate { j-> val arr=j.getJSONArray("children");for(k in kids.objects()) arr.put(JSONObject().put("id",k.getString("id")).put("tag",k.getString("tag"))
            .put("slot",k.optString("slot")).put("properties",JSONObject(k.optJSONObject("props")?.toString() ?: "{}").apply { k.optJSONObject("attrs")?.let { at-> for(x in at.keys()) put(x,at.get(x)) } })) } }
        a.optString("hide").takeIf { it.isNotEmpty() }?.let { id-> mutate { j-> j.getJSONArray("children").objects().firstOrNull { it.getString("id")==id }?.getJSONObject("properties")?.put("hidden",true) } }
        a.optString("show").takeIf { it.isNotEmpty() }?.let { id-> mutate { j-> j.getJSONArray("children").objects().firstOrNull { it.getString("id")==id }?.getJSONObject("properties")?.remove("hidden") } }
        a.optString("remove").takeIf { it.isNotEmpty() }?.let { id-> mutate { j-> val arr=j.getJSONArray("children");val keep=JSONArray();for(c in arr.objects()) if(c.getString("id")!=id) keep.put(c);j.put("children",keep) } }
    }
    @Test fun appBarInteractionsMatchChrome() {
        content();compose.mainClock.autoAdvance=false
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("appBarStatesOnly")
        for((file,red) in listOf("app-bar-web-states" to false,"app-bar-web-states-reduced" to true)) {
            val oracle=CardWeb.document("$file.json")
            for(r in oracle.getJSONArray("runs").objects()) if(only==null || only.split(',').any { r.getString("name").contains(it) }) runCase(r,file,red)
        }
        AppBarEvidence.log("app-bar-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(3000))).put("report",report))
        android.util.Log.i("AWCAppBar","app-bar-states ${checks-failures.size}/$checks")
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n")+(if(failures.isEmpty()) "" else "\nexitLog(last 6)=${exitLog.takeLast(6)}"),failures.isEmpty())
    }
    private fun runCase(r:JSONObject,file:String,red:Boolean) {
        val name=r.getString("name")+(if(red) " (reduced)" else "")
        base=36f;shift=base
        mouse { moveTo(at(1190.0 to 600.0),0) }
        compose.runOnUiThread { focusManager?.clearFocus(true);focusedID="";dark=r.optString("theme")=="dark";rtl=r.optString("dir")=="rtl";reduced=red
            bar=AppBarWeb.node(r.getJSONObject("node"));collector.clear();probe.bars.clear();epoch++ }
        repeat(30) { frame() }
        events.clear();AWCAppBarDiagnostics.clear();t0=compose.mainClock.currentTime
        val phases=r.getJSONArray("phases").objects()
        val phaseSamples=mutableListOf<List<Sample>>();val phaseStarts=mutableListOf<Double>();val phaseShots=mutableListOf<List<Pair<Double,CardWeb.Grid>>>()
        phases.forEachIndexed { i,p->
            if(p.optString("pre")=="focusBefore") { compose.runOnUiThread { before.requestFocus() };repeat(2) { frame() } }
            val start=p.optDouble("t",0.0)
            while(now()<start-16) frame()
            if(now()<start) compose.mainClock.advanceTimeBy((start-now()).toLong(),ignoreFrameDuration=true)
            val actual=now()
            val samples=mutableListOf(sample().let { it.copy(t=it.t-actual) })
            act(p.optJSONObject("act"),samples,actual)
            val acted=now()-actual;val ms=p.optDouble("ms",250.0)
            val lastWeb=(p.getJSONArray("samples").objects().lastOrNull()?.optDouble("t",start) ?: start)-start
            val next=if(i+1<phases.size) phases[i+1].optDouble("t",0.0)-start else acted+ms+60
            val clip=JSONObject().put("x",44).put("y",44)
            val shots=mutableListOf<Pair<Double,CardWeb.Grid>>()
            var nextShot=max(lastWeb+17,acted+ms)
            val size=shotSize(file,r.getString("name"),p.getString("label"))
            if(size!=null) { clip.put("width",size.first).put("height",size.second) }
            while(now()<actual+max(nextShot,min(next,acted+ms+60))) {
                frame();samples+=sample().let { it.copy(t=it.t-actual) }
                if(size!=null && now()>=actual+nextShot && now()<actual+next) { shots+=(now()-actual) to AppBarEvidence.capture(compose,clip) { s-> shiftScene(s) }.also { shiftScene(base) };nextShot+=16 }
            }
            if(size!=null && shots.isEmpty()) shots+=(now()-actual) to AppBarEvidence.capture(compose,clip) { s-> shiftScene(s) }.also { shiftScene(base) }
            phaseSamples+=samples;phaseStarts+=actual;phaseShots+=shots
        }
        phases.forEachIndexed { i,p-> compare(name,p,phaseSamples[i],phaseShots[i],file,r.getString("name")) }
        val web=r.getJSONArray("events").objects()
        val names=events.map { it.first };val webNames=web.map { it.getString("name") }
        check(names==webNames,"$name events $names vs $webNames")
        if(names==webNames) {
            val webStarts=phases.map { it.optDouble("t",0.0) }
            fun rel(t:Double,starts:List<Double>):Pair<Int,Double> { val i=max(0,starts.indexOfLast { it<=t+1 });return i to t-starts[i] }
            for((e,w) in events.zip(web)) {
                if(e.first!="mdLeadingClick") { val nv=(e.second as? Map<*,*>)?.get("value");val wv=w.optJSONObject("detail")?.opt("value")
                    check(nv==wv,"$name ${e.first} value $nv vs $wv") }
                val n=rel(e.third,phaseStarts);val wv=rel(w.optDouble("t",0.0),webStarts)
                check(n.first==wv.first && abs(n.second-wv.second)<=60,"$name ${e.first} in phase ${n.first} at +${n.second.toInt()} vs phase ${wv.first} at +${wv.second.toInt()} ms")
            }
        }
        val warnings=(0 until r.getJSONArray("warnings").length()).map { r.getJSONArray("warnings").getString(it) }
        check(AWCAppBarDiagnostics.warnings==warnings,"$name warnings ${AWCAppBarDiagnostics.warnings} vs $warnings")
        report.put(JSONObject().put("run",name).put("phases",phases.size).put("events",JSONArray(names)))
        android.util.Log.i("AWCAppBar","run $name: ${checks-failures.size}/$checks")
    }
    private fun shotSize(file:String,run:String,label:String):Pair<Int,Int>? = runCatching {
        val bmp=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().context.assets.open("$file/$run-$label.png").use { android.graphics.BitmapFactory.decodeStream(it) }
        bmp.width to bmp.height }.getOrNull()
    private fun close(a:List<Double>?,b:List<Double>?,tol:Double=3.0)=if(a==null || b==null) a==null && b==null else a.zip(b).all { abs(it.first-it.second)<=tol }
    private fun web(a:JSONArray?)=a?.let { (0 until min(3,it.length())).map { i-> it.getDouble(i) } }
    private fun compare(name:String,p:JSONObject,samples:List<Sample>,shots:List<Pair<Double,CardWeb.Grid>>,file:String,run:String) {
        val label=p.getString("label");val tag="$name $label";val w=p.getJSONObject("snap")
        val end=samples.lastOrNull() ?: return check(false,"$tag no samples")
        val webFocus=w.optString("active").let { if(it=="body" || it=="button#run" || it=="null") "body" else it }
        check(end.focus==webFocus,"$tag focus ${end.focus} vs $webFocus")
        check(close(end.host,web(w.optJSONArray("host"))),"$tag host ${end.host} vs ${web(w.optJSONArray("host"))}")
        w.optJSONObject("pill")?.let { pl->
            check(close(end.pill,web(pl.optJSONArray("bg"))),"$tag pill ${end.pill} vs ${web(pl.optJSONArray("bg"))}")
            check(abs((end.pillOpacity ?: -1.0)-pl.optDouble("opacity",1.0))<=.01,"$tag pill opacity ${end.pillOpacity}")
            check(end.focused==pl.optBoolean("focused"),"$tag pill focused ${end.focused}")
            check(end.ring==pl.optBoolean("ring"),"$tag focus ring ${end.ring}")
        }
        w.optJSONObject("layer")?.let { l-> val shown=l.optBoolean("shown");val wv=if(shown) l.optDouble("opacity",0.0) else 0.0
            check(abs((end.layer ?: -1.0)-wv)<=.02,"$tag state layer ${end.layer} vs $wv${if(shown) "" else " (display: none)"}") }
        w.optJSONObject("input")?.let { i->
            check(end.value==i.optString("value"),"$tag input value ${end.value} vs ${i.optString("value")}")
            check(end.selection==i.optInt("selection",-1),"$tag caret ${end.selection} vs ${i.optInt("selection",-1)}")
            check(end.centered==i.optBoolean("centered"),"$tag placeholder centred ${end.centered}")
        }
        for(c in (w.optJSONArray("children") ?: JSONArray()).objects()) { if(c.optString("slot")=="search") continue
            val id=c.getString("id");check(end.visible[id]==!c.optBoolean("hidden"),"$tag child $id shown ${end.visible[id]} vs ${!c.optBoolean("hidden")}") }
        // Every Chrome frame inside the native ±2-frame envelope.
        val start=p.optDouble("t",0.0);var checked=0;var bad=0;var worst=""
        for(s in p.getJSONArray("samples").objects()) {
            val t=s.optDouble("t",0.0)-start
            val near=samples.filter { it.t>=t-40 && it.t<=t+34 }.toMutableList()
            samples.lastOrNull { it.t<t-40 }?.let { near+=it };samples.firstOrNull { it.t>t+34 }?.let { near+=it }
            if(near.isEmpty()) continue
            fun within(key:String,webV:List<Double>?,nat:(Sample)->List<Double>?,tol:Double) {
                if(webV==null) return;val vals=near.mapNotNull(nat);if(vals.isEmpty()) return;checked++
                for(k in webV.indices) { if(k>=vals[0].size) break;val lo=vals.minOf { it[k] };val hi=vals.maxOf { it[k] }
                    if(webV[k]<lo-tol || webV[k]>hi+tol) { bad++;if(worst.isEmpty()) worst="$key t=${t.toInt()} web $webV native $vals";break } }
            }
            within("host",web(s.optJSONArray("host")),{ it.host },3.0)
            s.optJSONObject("pill")?.let { within("pill",web(it.optJSONArray("bg")),{ x-> x.pill },3.0) }
            s.optJSONObject("layer")?.let { if(it.optBoolean("shown")) within("layer",listOf(it.optDouble("opacity",0.0)),{ x-> x.layer?.let { l-> listOf(l) } },.02) }
        }
        check(bad==0,"$tag motion $bad/$checked frames outside the envelope $worst")
        if(shots.isEmpty()) return check(false,"$tag no shot")
        val clip=JSONObject().put("x",44).put("y",44).put("width",shots[0].second.w).put("height",shots[0].second.h)
        val webG=CardWeb.webGrid("$file/$run-$label.png",clip)
        val results=shots.map { it.first to CardWeb.compare(webG,it.second) }
        val best=results.minByOrNull { it.second.getInt("over6")*1e6+it.second.getDouble("mean") } ?: return
        val r=best.second
        check(r.getInt("over6").toDouble()/max(r.getInt("compared"),1)<=.005 && r.getDouble("mean")<=1.0,"$tag flat pixels (frame +${best.first.toInt()} of ${results.map { it.first.toInt() }}) $r")
    }
}
