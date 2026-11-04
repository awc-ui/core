package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
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
import kotlin.math.max
import kotlin.math.min

/**
 * md-radio interaction against Chrome trusted-input runs (radio/states.html and the reduced-motion set): hover, press,
 * release (select with the inner-circle spring), leave, Tab onto the group's tab stop, Space (150 ms pressed pulse;
 * inert on a checked radio), ArrowDown/ArrowUp (focus moves to the sibling and checks it; the tested radio is
 * unchecked silently, then re-checked), Enter (inert) and Tab past the group; dark, RTL, all hooks, density −4,
 * soft/hard disabled, form reset and press-and-drag-off. Steps fire at Chrome's event times on the test clock; every
 * frame's container scale, outer colour, inner scale and state layer are compared with Chrome's samples; the group's
 * checked states, roving tab stops and focus at each phase end; events and phase paint. Then the keyboard group cases
 * (radio/group.html) with real Tab traversal, and the group `required` rule.
 */
@OptIn(ExperimentalTestApi::class)
class NativeRadioInteractionTest {
    @get:Rule val compose=createComposeRule()
    /** One fixture: a "before" probe, radios at absolute positions (dp) and an "after" probe. */
    private class Scene(val theme:String="light",val dir:String="ltr",val hooks:JSONObject?=null,val form:Boolean=false,
                        val before:androidx.compose.ui.geometry.Rect,val radios:List<Pair<Offset,Map<String,Any?>>>,val after:Offset)
    private var scene by mutableStateOf(Scene(before=androidx.compose.ui.geometry.Rect(0f,0f,1f,1f),radios=emptyList(),after=Offset(10f,860f)))
    private var reduced by mutableStateOf(false);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector();private val inspections=mutableMapOf<String,AWCRadioInspection>()
    private val events=mutableListOf<Triple<String,String,Map<*,*>>>()
    private val before=FocusRequester();private var form=AWCFormState()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val s=scene;focusManager=androidx.compose.ui.platform.LocalFocusManager.current
        AWCTheme(s.theme=="dark") { AWCSelectionReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            Box(Modifier.absoluteOffset(s.before.left.dp,s.before.top.dp).size(s.before.width.dp,s.before.height.dp).focusRequester(before).focusable())
            AWCRadioGroupScope { AWCRadioInspectionScope({ inspections[it.value]=it }) { AWCInspectionScope(collector) {
                val group=@Composable { for((at,p) in s.radios) { val value=p["value"] as String
                    Box(Modifier.absoluteOffset(at.x.dp,at.y.dp)) {
                        // Only the tested radio (r0, value "a") carries the run's direction and hooks, as in the source page.
                        CompositionLocalProvider(LocalLayoutDirection provides if(s.dir=="rtl" && value=="a") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                            AWCRadioAppearanceScope(if(value=="a") RadioWeb.hooks(s.hooks) else AWCRadioAppearance()) {
                                AWCComponent("md-radio",p,onEvent={ n,v-> if(n.startsWith("md")) events+=Triple(value,n,v as? Map<*,*> ?: emptyMap<String,Any>()) })
                            }
                        }
                    } } }
                if(s.form) AWCFormScope(form) { group() } else group()
            } } }
            Box(Modifier.absoluteOffset(s.after.x.dp,s.after.y.dp).size(60.dp,32.dp).focusable())
        } } } }
    } } }
    private fun v(value:String)=inspections[value]?.values
    private data class Group(val checked:List<Boolean>,val tabindex:List<String>,val active:String,val missing:List<Boolean>)
    private fun group(values:List<String>)=Group(values.map { v(it)?.get("checked")==true },values.map { (v(it)?.get("tabindex") as? Int)?.toString() ?: "?" },
        values.firstOrNull { v(it)?.get("focused")==true } ?: "none",values.map { v(it)?.get("valueMissing")==true })
    private fun compareGroup(name:String,g:Group,values:List<String>,w:JSONObject,keyed:(String)->String) {
        val wc=(0 until w.getJSONArray("checked").length()).map { w.getJSONArray("checked").getBoolean(it) }
        val wt=(0 until w.getJSONArray("tabindex").length()).map { w.getJSONArray("tabindex").getString(it) }
        check(g.checked==wc,"$name checked ${g.checked} vs $wc");check(g.tabindex==wt,"$name tabindex ${g.tabindex} vs $wt")
        val wa=w.getString("active");val want=values.firstOrNull { keyed(it)==wa } ?: "none"
        check(g.active==want,"$name focus ${g.active} vs $wa")
    }
    @Test fun radioInteractionMatchesChrome() {
        content()
        for((file,red) in listOf("RadioWebStates.json" to false,"RadioWebStatesReduced.json" to true))
            for(r in CardWeb.document(file).getJSONArray("runs").objects()) runCase(r,red)
        AccordionEvidence.log("radio-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    @Test fun radioGroupKeyboardMatchesChrome() {
        content()
        for(c in CardWeb.document("RadioWebGroup.json").getJSONArray("cases").objects()) runGroup(c)
        requiredGroup()
        AccordionEvidence.log("radio-group",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    private var focusManager:androidx.compose.ui.focus.FocusManager?=null
    private fun load(next:Scene,red:Boolean) {
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(Offset(2380f,1200f),0) }
        // The previous scene's focused radio blurs before the new scene (and its event log) starts.
        compose.runOnIdle { focusManager?.clearFocus(force=true) };compose.waitForIdle()
        form=AWCFormState();events.clear();inspections.clear();collector.clear();reduced=red;scene=next;epoch++;compose.waitForIdle()
    }
    private fun key(k:Key)=compose.onRoot().performKeyInput { pressKey(k) }
    private fun press(k:String)=when(k) { "Tab"->key(Key.Tab);" "->key(Key.Spacebar);"Enter"->key(Key.Enter);"ArrowDown"->key(Key.DirectionDown)
        "ArrowUp"->key(Key.DirectionUp);"ArrowRight"->key(Key.DirectionRight);"ArrowLeft"->key(Key.DirectionLeft);else->Unit }
    /** radio/group.html: trusted keys from the "before" button (real Tab traversal); per key the group state and the md events in order. */
    private fun runGroup(c:JSONObject) {
        val name="group/"+c.getString("name");val unnamed=c.getString("name")=="unnamed"
        val radios=c.getJSONArray("radios").let { a-> (0 until a.length()).map { i-> val f=a.getJSONArray(i).let { x-> (0 until x.length()).map { x.getString(it) } }
            val p=mutableMapOf<String,Any?>("name" to (if(unnamed) "" else "g"),"value" to "v$i")
            if("checked" in f) p["checked"]=true;if("disabled" in f) p["disabled"]=true;if("soft" in f) p["softDisabled"]=true
            Offset(116f+64f*i,40f) to (p as Map<String,Any?>) } }
        load(Scene(before=androidx.compose.ui.geometry.Rect(40f,48f,100f,80f),radios=radios,after=Offset(10f,860f)),true)
        compose.runOnIdle { before.requestFocus() };compose.waitForIdle()
        val values=radios.map { it.second["value"] as String };val keyed={ v:String-> "r"+v.removePrefix("v") }
        val steps=c.getJSONArray("steps").objects()
        // The source's "initial" state is read before "before" is focused; the radios' state is the same either way.
        compareGroup("$name initial",group(values),values,JSONObject(steps[0].toString()).put("active","BODY"),keyed)
        val keys=c.getJSONArray("keys").let { a-> (0 until a.length()).map { a.getString(it) } }
        for((i,k) in keys.withIndex()) {
            events.clear();press(k);compose.waitForIdle()
            val w=steps[i+1];compareGroup("$name $i:$k",group(values),values,w,keyed)
            fun line(t:String,n:String,value:String?)=if(n=="mdChange") "$t $n $value" else "$t $n"
            val want=w.getJSONArray("events").objects().map { line(it.getString("target"),it.getString("name"),it.optJSONObject("detail")?.optString("value")) }
            val got=events.filter { it.second in setOf("mdChange","mdFocus","mdBlur") }.map { line(keyed(it.first),it.second,it.third["value"] as? String) }
            check(got==want,"$name $i:$k events $got vs $want")
        }
        report.put(JSONObject().put("case",name).put("keys",keys.size))
    }
    /** The source's group validity (no oracle page): `required` on any member makes the group required; every member reports valueMissing until one is checked. */
    private fun requiredGroup() {
        val radios=(0..2).map { i-> Offset(116f+64f*i,40f) to (mapOf("name" to "g","value" to "v$i")+(if(i==2) mapOf("required" to true) else emptyMap())) }
        load(Scene(before=androidx.compose.ui.geometry.Rect(40f,48f,100f,80f),radios=radios,after=Offset(10f,860f)),true)
        val values=listOf("v0","v1","v2")
        check(group(values).missing==listOf(true,true,true),"required group: all members missing ${group(values).missing}")
        compose.runOnIdle { before.requestFocus() };compose.waitForIdle();key(Key.Tab);key(Key.DirectionDown);compose.waitForIdle()
        val g=group(values)
        check(g.checked==listOf(false,true,false) && g.missing==listOf(false,false,false),"required group satisfied by an arrow selection ${g.checked} ${g.missing}")
        load(Scene(before=androidx.compose.ui.geometry.Rect(40f,48f,100f,80f),radios=radios.map { it.first to (it.second-"required") },after=Offset(10f,860f)),true)
        check(group(values).missing==listOf(false,false,false),"optional group: nothing missing ${group(values).missing}")
        report.put(JSONObject().put("case","group/required"))
    }
    private class Frame(val web:Double,val scale:Double,val outer:List<Double>,val inner:Double,val layer:Double,val layerColor:List<Double>?)
    private fun runCase(r:JSONObject,red:Boolean) {
        val name=(if(red) "reduced/" else "")+r.getString("name");val cfg=r.getJSONObject("config")
        val phases=r.getJSONArray("phases").objects();val rect=phases[0].getJSONObject("snap").getJSONObject("rect")
        val b=r.getJSONObject("before");val probe=androidx.compose.ui.geometry.Rect(b.getDouble("x").toFloat(),b.getDouble("y").toFloat(),(b.getDouble("x")+b.getDouble("width")).toFloat(),(b.getDouble("y")+b.getDouble("height")).toFloat())
        val gap=if(cfg.optBoolean("form")) 0f else 24f;val x0=rect.getDouble("x").toFloat();val y0=rect.getDouble("y").toFloat()
        val x1=x0+rect.getDouble("width").toFloat()+gap;val x2=x1+48f+gap
        val p0=mutableMapOf<String,Any?>("checked" to cfg.optBoolean("checked"),"name" to "g","value" to "a")
        if(cfg.optDouble("density",0.0)!=0.0) p0["density"]=cfg.getDouble("density")
        when(cfg.optString("state")) { "disabled"->p0["disabled"]=true;"softDisabled"->p0["softDisabled"]=true }
        // Siblings sit on the host's line (centred like the source's flex row; the default 48 dp host).
        val ys=y0+(rect.getDouble("height").toFloat()-48f)/2
        load(Scene(cfg.optString("theme"),cfg.optString("dir"),cfg.optJSONObject("hooks"),cfg.optBoolean("form"),probe,
            listOf(Offset(x0,y0) to p0,Offset(x1,ys) to mapOf("name" to "g","value" to "b"),Offset(x2,ys) to mapOf("name" to "g","value" to "c")),Offset(x2+48f+gap,probe.top)),red)
        compose.mainClock.autoAdvance=false;compose.mainClock.advanceTimeBy(100);compose.waitForIdle()
        val values=listOf("a","b","c");val keyed=mapOf("a" to "r0","b" to "r1","c" to "r2")
        (v("a")?.get("hostBox") as? androidx.compose.ui.geometry.Rect).let { h->
            check(h!=null && abs(h.left-x0)<.6 && abs(h.top-y0)<.6,"$name host at the source position $h") }
        val away=Offset(2380f,1200f)
        val hp=r.getJSONArray("handlePoint").let { Offset(it.getDouble(0).toFloat()*2,it.getDouble(1).toFloat()*2) };val off=hp+Offset(0f,120f)
        fun mouse(block:MouseInjectionScope.()->Unit)=compose.onRoot().performMouseInput(block)
        val webEvents=r.getJSONArray("events").objects()
        val frameTimes=phases.flatMap { it.getJSONArray("samples").objects().map { s-> s.getDouble("t") } }
        val animStarts=r.getJSONArray("anims").objects().mapNotNull { a-> if(a.isNull("startTime")) null else a.getDouble("startTime") }
        fun frameAfter(t:Double)=animStarts.filter { it>=t-17 && it<=t+34 }.minOrNull() ?: frameTimes.firstOrNull { it>=t && it<=t+34 } ?: t
        fun at(ph:JSONObject,kinds:Set<String>,fallback:Double):Double { val t=ph.getDouble("t")
            return frameAfter(webEvents.firstOrNull { it.getString("name") in kinds && it.getDouble("t")>=t && it.getDouble("t")<=t+150 }?.getDouble("t") ?: (t+fallback)) }
        val steps=mutableListOf<Triple<String,Double,()->Unit>>()
        for(ph in phases) { val t=ph.getDouble("t")
            when(val l=ph.getString("label")) {
                "hover"->steps+=Triple(l,frameAfter(t+5)) { mouse { moveTo(hp,0) } }
                "press"->steps+=Triple(l,at(ph,setOf("focus"),10.0)) { mouse { moveTo(hp,0);press() } }
                "release"->steps+=Triple(l,at(ph,setOf("mdChange"),10.0)) { mouse { moveTo(hp+Offset(.001f,0f),0);release() } }
                "leave"->steps+=Triple(l,frameAfter(t+5)) { mouse { moveTo(away,0) } }
                "pressOff"->{ steps+=Triple(l,at(ph,setOf("focus"),10.0)) { mouse { moveTo(hp,0);press() } }
                    steps+=Triple("pressOffMove",at(ph,setOf("pointerleave"),75.0)) { mouse { moveTo(off,0) } } }
                "releaseOff"->steps+=Triple(l,frameAfter(t+10)) { mouse { moveTo(off+Offset(.001f,0f),0);release() } }
                // The source focuses "before", then presses Tab: focus lands on the group's tab stop.
                "tab"->{ steps+=Triple(l,t) { compose.runOnIdle { before.requestFocus() } };steps+=Triple("tabFocus",at(ph,setOf("focus"),30.0)) { key(Key.Tab) } }
                "space"->steps+=Triple(l,at(ph,setOf("mdChange"),5.0)) { key(Key.Spacebar) }
                "arrowDown"->steps+=Triple(l,at(ph,setOf("blur","mdChange"),5.0)) { key(Key.DirectionDown) }
                "arrowUp"->steps+=Triple(l,at(ph,setOf("focus","mdChange"),5.0)) { key(Key.DirectionUp) }
                "enter"->steps+=Triple(l,frameAfter(t+5)) { key(Key.Enter) }
                "tabAway"->steps+=Triple(l,at(ph,setOf("blur"),5.0)) { key(Key.Tab) }
                "reset"->steps+=Triple(l,frameAfter(t+2)) { compose.runOnIdle { form.reset() } }
                else->steps+=Triple(l,t) {}
            }
        }
        val webT0=steps[0].second;val clock0=compose.mainClock.currentTime
        fun elapsed()=(compose.mainClock.currentTime-clock0).toDouble()
        val fired=mutableMapOf<String,Double>()
        fun webTime(native:Double):Double { val done=steps.filter { fired[it.first]?.let { f-> f<=native } ?: false }
            val s=done.lastOrNull() ?: return webT0+native;return s.second+(native-fired[s.first]!!) }
        val frames=mutableListOf<Frame>();val shots=mutableListOf<Triple<JSONObject,CardWeb.Grid,Group>>()
        fun capture(ph:JSONObject) { val clip=ph.getJSONObject("clip")
            shots+=Triple(ph,CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height")),group(values)) }
        // Chrome's phase screenshot completes before the next phase starts (its recorded t); each phase is captured in
        // the first frame at that time, at the latest when the next step fires (the last phase at the end of the run).
        val shotAt=phases.indices.map { k-> if(k+1<phases.size) phases[k+1].getDouble("t") else Double.MAX_VALUE }
        val captured=BooleanArray(phases.size)
        fun captureAt(k:Int) { if(!captured[k]) { captured[k]=true;capture(phases[k]) } }
        val end=steps.last().second-webT0+470;var next=0
        while(elapsed()<end) {
            while(next<steps.size && elapsed()>=steps[next].second-webT0) {
                val s=steps[next]
                if(next>0 && s.first!="tabFocus" && s.first!="pressOffMove") phases.indexOfFirst { it.getString("label")==s.first }.takeIf { it>0 }?.let { captureAt(it-1) }
                fired[s.first]=elapsed();s.third();next++
            }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            val wnow=webTime(elapsed())
            for(k in phases.indices) if(!captured[k] && fired.containsKey(phases[k].getString("label")) && wnow>=shotAt[k]) captureAt(k)
            val v=v("a") ?: continue
            fun c(k:String)=CardWeb.pre(SwitchWeb.rgba(v[k] as Color))
            val layer=v["layerOpacity"] as Double
            frames+=Frame(webTime(elapsed()),v["scale"] as Double,c("outerColor"),v["innerScale"] as Double,layer,if(layer<0) null else c("layerColor"))
        }
        captureAt(phases.size-1)
        compose.mainClock.autoAdvance=true
        // Events: every mdChange (target and detail), and the tested radio's focus/blur sequence within the run.
        val horizon=phases.last().getDouble("t")+470
        val webChanges=webEvents.filter { it.getString("name")=="mdChange" };val changes=events.filter { it.second=="mdChange" }
        check(changes.map { keyed[it.first] }==webChanges.map { it.getString("target") },"$name mdChange targets ${changes.map { keyed[it.first] }} vs ${webChanges.map { it.getString("target") }}")
        for((e,w) in changes.zip(webChanges)) { val wd=w.getJSONObject("detail")
            check(e.third["checked"]==wd.getBoolean("checked") && e.third["value"]==wd.getString("value"),"$name ${e.first} mdChange detail ${e.third} vs $wd") }
        val webFocus=webEvents.filter { it.getString("name") in setOf("focus","blur") && it.getDouble("t")<=horizon }.map { it.getString("name") }
        val focus=events.filter { it.first=="a" && it.second in setOf("mdFocus","mdBlur") }.map { if(it.second=="mdFocus") "focus" else "blur" }
        check(focus==webFocus,"$name r0 focus/blur $focus vs $webFocus")
        // Per-frame values within Chrome's samples.
        val samples=phases.flatMap { it.getJSONArray("samples").objects() }.toMutableList()
        r.optJSONObject("rest")?.let { samples.add(0,JSONObject(it.toString()).put("t",webT0-5)) }
        fun env(read:(JSONObject)->List<Double>,t:Double):Pair<List<Double>,List<Double>> {
            val after=samples.indexOfFirst { it.getDouble("t")>=t }
            if(after<0) return read(samples.last()).let { it to it };if(after==0) return read(samples[0]).let { it to it }
            val a=samples[after-1];val b=samples[after];val ta=a.getDouble("t");val tb=b.getDouble("t");val va=read(a);val vb=read(b)
            if(tb-ta>34) return va.zip(vb).map { min(it.first,it.second) } to va.zip(vb).map { max(it.first,it.second) }
            val x=if(tb>ta) (t-ta)/(tb-ta) else 1.0;val v=va.zip(vb).map { it.first+(it.second-it.first)*x };return v to v }
        val props=mutableListOf<Triple<String,Double,Pair<(JSONObject)->List<Double>,(Frame)->List<Double>?>>>(
            Triple("container scale",.004,Pair({ s-> listOf(s.getDouble("scale")) },{ f-> listOf(f.scale) })),
            Triple("outer colour",.012,Pair({ s-> CardWeb.pre(CardWeb.color(s.getString("outerBorder"))) },{ f-> f.outer })),
            Triple("inner scale",.01,Pair({ s-> listOf(s.getDouble("innerScale")) },{ f-> listOf(f.inner) })),
            Triple("state layer",.004,Pair({ s-> listOf(if(s.getString("layerDisplay")=="none") -1.0 else s.getDouble("layerOpacity")) },{ f-> listOf(f.layer) })))
        if(cfg.optString("state")=="rest") props+=Triple("state layer colour",.012,Pair({ s-> CardWeb.pre(CardWeb.color(s.getString("layerBg"))) },{ f-> f.layerColor }))
        val compared=mutableMapOf<String,Int>()
        for((prop,tol,rw) in props) {
            for(f in frames) { val v=rw.second(f) ?: continue
                var lo:List<Double>?=null;var hi:List<Double>?=null;var x=f.web-34
                while(x<=f.web+40) { val e=env(rw.first,x);lo=lo?.zip(e.first)?.map { min(it.first,it.second) } ?: e.first;hi=hi?.zip(e.second)?.map { max(it.first,it.second) } ?: e.second;x+=2 }
                for(smp in samples) { val st=smp.getDouble("t");if(st<f.web-34 || st>f.web+40) continue;val e=rw.first(smp)
                    lo=lo?.zip(e)?.map { min(it.first,it.second) } ?: e;hi=hi?.zip(e)?.map { max(it.first,it.second) } ?: e }
                val l=lo!!;val h=hi!!
                check(v.indices.all { v[it]>=l[it]-tol && v[it]<=h[it]+tol },"$name $prop rendered $v at web ${f.web.toInt()} within Chrome [$l, $h]");compared[prop]=(compared[prop] ?: 0)+1 }
            frames.lastOrNull()?.let { f-> val want=rw.first(samples.last());val got=rw.second(f) ?: return@let
                check(got.indices.all { abs(got[it]-want[it])<=max(tol,.012) },"$name $prop settles $got vs $want") }
            check((compared[prop] ?: 0)>8,"$name $prop samples compared (${compared[prop] ?: 0})")
        }
        // Group state at each phase end (checked members, roving tab stops, focus), then phase paint.
        for((ph,_,g) in shots) { val w=ph.getJSONArray("samples").objects().last();val wg=w.getJSONArray("group").objects()
            compareGroup("$name/${ph.getString("label")} group",g,values,JSONObject().put("checked",JSONArray(wg.map { it.getBoolean("checked") })).put("tabindex",JSONArray(wg.map { it.getString("tabindex") })).put("active",w.getString("active"))) { keyed[it]!! } }
        for((ph,grid,_) in shots) { val label=ph.getString("label")
            val res=CardWeb.compare(CardWeb.webGrid("${if(red) "RadioWebStatesReduced" else "RadioWebStates"}/${r.getString("name")}-$label.png",ph.getJSONObject("clip")),grid,listOf(probe))
            check(CardWeb.ok(res),"$name/$label flat pixels $res");report.put(res.put("case","$name/$label")) }
        report.put(JSONObject().put("case",name).put("frames",frames.size).put("compared",JSONObject(compared as Map<*,*>)))
        compose.onRoot().performMouseInput { moveTo(away,0) }
    }
}
