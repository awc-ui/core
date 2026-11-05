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
import androidx.compose.ui.input.key.onPreviewKeyEvent
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
 * md-checkbox interaction against Chrome trusted-input runs (switch/states.html and the reduced-motion set):
 * hover, press, release (toggle: spatial-spring slide and handle morph), leave, keyboard focus, Space
 * (toggle + 150 ms pressed pulse), Enter (inert), blur; dark, RTL, all hooks, density −4, soft/hard
 * disabled, a cancelled mdInput, form reset and press-and-drag-off. Steps fire at Chrome's event times
 * on the test clock; every frame's handle position/size, handle/track/outline colours and state layer
 * are compared with Chrome's samples (±2 frames, monotone envelope across gaps); events and phase paint.
 */
@OptIn(ExperimentalTestApi::class)
class NativeCheckboxInteractionTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"config\":{\"theme\":\"light\",\"dir\":\"ltr\"},\"phases\":[{\"snap\":{\"rect\":{\"x\":0,\"y\":0}}}],\"before\":{\"x\":0,\"y\":0,\"width\":1,\"height\":1}}"))
    private var reduced by mutableStateOf(false);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector();private var inspection:AWCCheckboxInspection?=null
    private val events=mutableListOf<Pair<String,Map<*,*>>>();private val actionsSeen=mutableListOf<Pair<String,Boolean>>()
    private val before=FocusRequester();private var form=AWCFormState()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val r=run;val cfg=r.getJSONObject("config");val rect=r.getJSONArray("phases").getJSONObject(0).getJSONObject("snap").getJSONObject("rect");val b=r.getJSONObject("before")
        AWCTheme(cfg.optString("theme")=="dark") { AWCSelectionReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            Box(Modifier.absoluteOffset(b.getDouble("x").dp,b.getDouble("y").dp).size(b.getDouble("width").dp,b.getDouble("height").dp).focusRequester(before).focusable())
            Box(Modifier.absoluteOffset(rect.getDouble("x").dp,rect.getDouble("y").dp)) {
                CompositionLocalProvider(LocalLayoutDirection provides if(cfg.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    AWCCheckboxAppearanceScope(CheckboxWeb.hooks(cfg.optJSONObject("hooks"))) { AWCCheckboxInspectionScope({ inspection=it }) { AWCInspectionScope(collector) {
                        AWCActionScope(onAction={ e-> if(cfg.optBoolean("cancel") && e.name=="mdInput") e.preventDefault();actionsSeen+=e.name to e.defaultPrevented }) {
                            val sw=@Composable { AWCComponent("md-checkbox",CheckboxWeb.props(cfg)+mapOf("name" to "cb"),onEvent={ n,v-> if(n.startsWith("md")) events+=n to (v as? Map<*,*> ?: emptyMap<String,Any>()) }) }
                            if(cfg.optBoolean("form")) AWCFormScope(form) { sw() } else sw()
                        }
                    } } }
                }
            }
            Box(Modifier.absoluteOffset(10.dp,860.dp).size(40.dp,20.dp).focusable())
        } } } }
    } } }
    @Test fun checkboxInteractionMatchesChrome() {
        content()
        for((file,red) in listOf("CheckboxWebStates.json" to false,"CheckboxWebStatesReduced.json" to true))
            for(r in CardWeb.document(file).getJSONArray("runs").objects()) runCase(r,red)
        AccordionEvidence.log("checkbox-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    /** Source C1: a held Space (OS auto-repeat) toggles once; the repeats are consumed without acting. */
    @Test fun heldSpaceTogglesOnce() {
        val changes=mutableListOf<Any?>();var repeats=0
        compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) {
            Box(Modifier.onPreviewKeyEvent { if(it.nativeKeyEvent.repeatCount>0) repeats++;false }) {
                AWCComponent("md-checkbox",mapOf("checked" to false),onEvent={ n,v-> if(n=="mdChange") changes+=v }) } } } }
        compose.onNode(androidx.compose.ui.test.SemanticsMatcher.expectValue(androidx.compose.ui.semantics.SemanticsProperties.Role,androidx.compose.ui.semantics.Role.Checkbox))
            .performSemanticsAction(androidx.compose.ui.semantics.SemanticsActions.RequestFocus)
        compose.onRoot().performKeyInput { keyDown(Key.Spacebar);advanceEventTime(1500);keyUp(Key.Spacebar) }
        compose.waitForIdle()
        assertTrue("key repeats were delivered ($repeats)",repeats>0)
        assertTrue("one mdChange for a held Space: $changes",changes.size==1)
        compose.onRoot().performKeyInput { pressKey(Key.Spacebar) };compose.waitForIdle()
        assertTrue("a second press toggles back: $changes",changes.size==2 && (changes[1] as Map<*,*>)["checked"]==false)
    }
    private class Frame(val web:Double,val scale:Double,val fill:List<Double>,val outline:List<Double>,val layer:Double,val glyphScale:Double,val glyphOpacity:Double)
    private fun runCase(r:JSONObject,red:Boolean) {
        val name=(if(red) "reduced/" else "")+r.getString("name");val cfg=r.getJSONObject("config")
        val away=Offset(2380f,1200f)
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(away,0) }
        form=AWCFormState();events.clear();actionsSeen.clear();inspection=null;collector.clear();reduced=red;run=r;epoch++;compose.waitForIdle()
        compose.mainClock.autoAdvance=false;compose.mainClock.advanceTimeBy(100);compose.waitForIdle()
        val phases=r.getJSONArray("phases").objects();val hostX=phases[0].getJSONObject("snap").getJSONObject("rect").getDouble("x")
        collector.snapshot().nodes.firstOrNull { it.name=="md-checkbox" }.let { n-> val w=phases[0].getJSONObject("snap").getJSONObject("rect")
            check(n!=null && abs(n.bounds.x-w.getDouble("x"))<.6 && abs(n.bounds.y-w.getDouble("y"))<.6,"$name host at the source position ${n?.bounds}") }
        val hp=r.getJSONArray("handlePoint").let { Offset(it.getDouble(0).toFloat()*2,it.getDouble(1).toFloat()*2) };val off=hp+Offset(0f,120f)
        fun mouse(block:MouseInjectionScope.()->Unit)=compose.onRoot().performMouseInput(block)
        fun key(k:Key)=compose.onRoot().performKeyInput { pressKey(k) }
        // Chrome step time: the trusted event's delivery where the source reports it (focus/blur/mdInput), else the phase start plus its CDP round trips.
        val webEvents=r.getJSONArray("events").objects()
        // Chrome renders an input's style change in the first frame at or after it (transitions start at that
        // frame's time); the step fires at that frame, which the every-frame samples give exactly.
        val frameTimes=phases.flatMap { it.getJSONArray("samples").objects().map { s-> s.getDouble("t") } }
        // A transition the input started gives that frame directly (rAF-aligned mouse moves start in the frame
        // that dispatched them, before the event's own timestamp); otherwise the first frame at or after it.
        val animStarts=r.getJSONArray("anims").objects().mapNotNull { a-> if(a.isNull("startTime")) null else a.getDouble("startTime") }
        fun frameAfter(t:Double)=animStarts.filter { it>=t-17 && it<=t+34 }.minOrNull() ?: frameTimes.firstOrNull { it>=t && it<=t+34 } ?: t
        fun at(ph:JSONObject,kinds:Set<String>,fallback:Double):Double { val t=ph.getDouble("t")
            return frameAfter(webEvents.firstOrNull { it.getString("name") in kinds && it.getDouble("t")>=t && it.getDouble("t")<=t+150 }?.getDouble("t") ?: (t+fallback)) }
        val steps=mutableListOf<Triple<String,Double,()->Unit>>()
        for(ph in phases) { val t=ph.getDouble("t")
            when(val l=ph.getString("label")) {
                "hover"->steps+=Triple(l,frameAfter(t+5)) { mouse { moveTo(hp,0) } }
                "press"->steps+=Triple(l,at(ph,setOf("focus","mdInput"),10.0)) { mouse { moveTo(hp,0);press() } }
                "release"->steps+=Triple(l,at(ph,setOf("mdInput"),10.0)) { mouse { moveTo(hp+Offset(.001f,0f),0);release() } }
                "leave"->steps+=Triple(l,frameAfter(t+5)) { mouse { moveTo(away,0) } }
                // Press, hold four frames, then move off the host (pointerleave clears the pressed class mid-morph).
                "pressOff"->{ steps+=Triple(l,at(ph,setOf("focus"),10.0)) { mouse { moveTo(hp,0);press() } }
                    steps+=Triple("pressOffMove",at(ph,setOf("pointerleave"),75.0)) { mouse { moveTo(off,0) } } }
                "releaseOff"->steps+=Triple(l,frameAfter(t+10)) { mouse { moveTo(off+Offset(.001f,0f),0);release() } }
                "tab"->{ steps+=Triple(l,t) { compose.runOnIdle { before.requestFocus() } };steps+=Triple("tabFocus",at(ph,setOf("focus"),30.0)) { key(Key.Tab) } }
                "space","space2"->steps+=Triple(l,at(ph,setOf("mdInput"),5.0)) { key(Key.Spacebar) }
                "enter"->steps+=Triple(l,frameAfter(t+5)) { key(Key.Enter) }
                "tabAway"->steps+=Triple(l,at(ph,setOf("blur"),5.0)) { key(Key.Tab) }
                "reset"->steps+=Triple(l,t+2) { compose.runOnIdle { form.reset() } }
                else->steps+=Triple(l,t) {}
            }
        }
        val webT0=steps[0].second;val clock0=compose.mainClock.currentTime
        fun elapsed()=(compose.mainClock.currentTime-clock0).toDouble()
        val fired=mutableMapOf<String,Double>()
        fun webTime(native:Double):Double { val done=steps.filter { fired[it.first]?.let { f-> f<=native } ?: false }
            val s=done.lastOrNull() ?: return webT0+native;return s.second+(native-fired[s.first]!!) }
        val frames=mutableListOf<Frame>();val shots=mutableListOf<Pair<JSONObject,CardWeb.Grid>>()
        fun capture(ph:JSONObject) { val clip=ph.getJSONObject("clip")
            shots+=ph to CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height")) }
        val end=steps.last().second-webT0+470;var next=0
        while(elapsed()<end) {
            while(next<steps.size && elapsed()>=steps[next].second-webT0) {
                val s=steps[next]
                if(next>0 && s.first!="tabFocus" && s.first!="pressOffMove") phases.indexOfFirst { it.getString("label")==s.first }.takeIf { it>0 }?.let { capture(phases[it-1]) }
                fired[s.first]=elapsed();s.third();next++
            }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            val v=inspection?.values ?: continue
            fun c(k:String)=CardWeb.pre(SwitchWeb.rgba(v[k] as Color))
            frames+=Frame(webTime(elapsed()),(v["scale"] as Double),c("containerColor"),c("outlineColor"),(v["layerOpacity"] as Double),(v["glyphScale"] as Double),(v["iconOpacity"] as Double)*(v["glyphOpacity"] as Double))
        }
        capture(phases.last())
        compose.mainClock.autoAdvance=true
        // Events: names, proposed/committed state and cancellation.
        val web=webEvents.filter { it.getString("name")=="mdChange" }
        check(events.map { it.first }==web.map { it.getString("name") },"$name events ${events.map { it.first }} vs ${web.map { it.getString("name") }}")
        for((i,w) in web.withIndex()) { val e=events.getOrNull(i) ?: break
            val wd=w.getJSONObject("detail")
            check(e.second["checked"]==wd.getBoolean("checked") && e.second["indeterminate"]==wd.getBoolean("indeterminate"),"$name ${e.first} detail ${e.second} vs $wd") }
        // Per-frame values within Chrome's samples.
        val samples=phases.flatMap { it.getJSONArray("samples").objects() }.toMutableList()
        r.optJSONObject("rest")?.let { samples.add(0,JSONObject(it.toString()).put("t",webT0-5)) }
        // Chrome samples at the start of each frame, before the component writes its classes in that frame: the frame
        // in which the glyph entrance starts is painted at keyframe 0 (scale 0, opacity 0) while its sample still shows
        // the previous state. Each recorded entrance therefore adds that painted frame (the previous sample's other values).
        for(a in r.getJSONArray("anims").objects().filter { it.optString("property")=="md-checkbox-glyph-in" && !it.isNull("startTime") }) {
            val start=a.getDouble("startTime");val i=samples.indexOfLast { it.getDouble("t")<=start };if(i<0) continue
            samples.add(i+1,JSONObject(samples[i].toString()).put("t",start).put("iconOpacity",1.0).put("glyphScale",0.0).put("glyphOpacity",0.0)) }
        fun env(read:(JSONObject)->List<Double>,t:Double):Pair<List<Double>,List<Double>> {
            val after=samples.indexOfFirst { it.getDouble("t")>=t }
            if(after<0) return read(samples.last()).let { it to it };if(after==0) return read(samples[0]).let { it to it }
            val a=samples[after-1];val b=samples[after];val ta=a.getDouble("t");val tb=b.getDouble("t");val va=read(a);val vb=read(b)
            if(tb-ta>34) return va.zip(vb).map { min(it.first,it.second) } to va.zip(vb).map { max(it.first,it.second) }
            val x=if(tb>ta) (t-ta)/(tb-ta) else 1.0;val v=va.zip(vb).map { it.first+(it.second-it.first)*x };return v to v }
        val props:List<Triple<String,Double,Pair<(JSONObject)->List<Double>,(Frame)->List<Double>>>> = listOf(
            Triple("container scale",.004,Pair({ s-> listOf(s.getDouble("scale")) },{ f-> listOf(f.scale) })),
            Triple("container colour",.012,Pair({ s-> CardWeb.pre(CardWeb.color(s.getString("containerBg"))) },{ f-> f.fill })),
            Triple("container outline",.012,Pair({ s-> CardWeb.pre(CardWeb.color(s.getString("containerBorder"))) },{ f-> f.outline })),
            Triple("state layer",.004,Pair({ s-> listOf(if(s.getString("layerDisplay")=="none") -1.0 else s.getDouble("layerOpacity")) },{ f-> listOf(f.layer) })),
            Triple("glyph scale",.02,Pair({ s-> listOf(if(s.getDouble("iconOpacity")==0.0) 1.0 else s.getDouble("glyphScale")) },{ f-> listOf(f.glyphScale) })),
            Triple("glyph opacity",.012,Pair({ s-> listOf(s.getDouble("iconOpacity")*s.getDouble("glyphOpacity")) },{ f-> listOf(f.glyphOpacity) })))
        val compared=mutableMapOf<String,Int>()
        for((prop,tol,rw) in props) {
            for(f in frames) { val v=rw.second(f)
                var lo:List<Double>?=null;var hi:List<Double>?=null;var x=f.web-34
                while(x<=f.web+40) { val e=env(rw.first,x);lo=lo?.zip(e.first)?.map { min(it.first,it.second) } ?: e.first;hi=hi?.zip(e.second)?.map { max(it.first,it.second) } ?: e.second;x+=2 }
                // The sampled values themselves (a 2 ms grid can step over a one-frame extreme such as an entrance's first frame).
                for(smp in samples) { val st=smp.getDouble("t");if(st<f.web-34 || st>f.web+40) continue;val e=rw.first(smp)
                    lo=lo?.zip(e)?.map { min(it.first,it.second) } ?: e;hi=hi?.zip(e)?.map { max(it.first,it.second) } ?: e }
                val l=lo!!;val h=hi!!
                check(v.indices.all { v[it]>=l[it]-tol && v[it]<=h[it]+tol },"$name $prop rendered $v at web ${f.web.toInt()} within Chrome [$l, $h]");compared[prop]=(compared[prop] ?: 0)+1 }
            frames.lastOrNull()?.let { f-> val want=rw.first(samples.last());val got=rw.second(f)
                check(got.indices.all { abs(got[it]-want[it])<=max(tol,.012) },"$name $prop settles $got vs $want") }
            check((compared[prop] ?: 0)>8,"$name $prop samples compared (${compared[prop] ?: 0})")
        }
        // Phase paint: every flat pixel of each source phase screenshot.
        // The source's "before" probe is a native <button>; native uses a plain focus target there (not part of the switch).
        val probe=r.getJSONObject("before").let { androidx.compose.ui.geometry.Rect(it.getDouble("x").toFloat(),it.getDouble("y").toFloat(),(it.getDouble("x")+it.getDouble("width")).toFloat(),(it.getDouble("y")+it.getDouble("height")).toFloat()) }
        // Inside the form the "after" probe follows the switch inline (1px after it, the size of "before").
        val hostRect=phases[0].getJSONObject("snap").getJSONObject("rect");val right=(hostRect.getDouble("x")+hostRect.getDouble("width")).toFloat()+1f
        val probes=listOf(probe)+(if(cfg.optBoolean("form")) listOf(androidx.compose.ui.geometry.Rect(right,probe.top,right+probe.width,probe.bottom)) else emptyList())
        for((ph,grid) in shots) { val label=ph.getString("label")
            val res=CardWeb.compare(CardWeb.webGrid("${if(red) "CheckboxWebStatesReduced" else "CheckboxWebStates"}/${r.getString("name")}-$label.png",ph.getJSONObject("clip")),grid,probes)
            check(CardWeb.ok(res),"$name/$label flat pixels $res");report.put(res.put("case","$name/$label")) }
        report.put(JSONObject().put("case",name).put("frames",frames.size).put("compared",JSONObject(compared as Map<*,*>)))
        compose.onRoot().performMouseInput { moveTo(away,0) }
    }
}
