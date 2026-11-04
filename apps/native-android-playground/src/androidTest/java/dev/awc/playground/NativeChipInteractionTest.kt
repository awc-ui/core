package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
 * md-chip interaction against Chrome trusted-input runs (md-chip/states.html and the reduced-motion set): pointer on
 * the body, keyboard on button- and group-role chips (primary action, remove button, Delete / Backspace, Shift+Tab),
 * pressing ✕, default removal by click / Delete / Backspace, display tokens, hard and soft disabled, hooks, colour
 * roles, RTL, dark and an avatar. Steps fire at Chrome's event times on the test clock; every frame's state layer,
 * container, label ink and shadow are compared with Chrome's samples (±2 frames, monotone envelope across gaps);
 * events (order, detail, cancellation), focus, selection, removal and phase paint.
 */
@OptIn(ExperimentalTestApi::class)
class NativeChipInteractionTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"variant\":\"assist\",\"appearance\":\"outlined\",\"scenario\":\"pointer\",\"theme\":\"light\",\"dir\":\"ltr\"}"))
    private var reduced by mutableStateOf(false);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector();private var inspection:AWCChipInspection?=null
    private val events=mutableListOf<Pair<String,Map<*,*>>>();private val actionsSeen=mutableListOf<Pair<String,Boolean>>()
    private val before=FocusRequester()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private val hooks=AWCChipHookAppearance("#22556699","#7B1FA2CC","#C62828","#FFF59D","#2E7D32",22.0,CardWeb.corners("14px 2px / 6px 10px"),40.0,"#1565C0CC",3.0,"#FF6F00",
        CardWeb.boxShadow("0px 3px 6px 0px #00000059"))
    private val content=mapOf("assist" to mapOf("icon" to "event","label" to "Add to calendar"),"filter" to mapOf("label" to "Unread"),
        "input" to mapOf("label" to "Ada Lovelace","icon" to "person"),"suggestion" to mapOf("label" to "Nearby"))
    private fun props(r:JSONObject):Map<String,Any?> { val p=mutableMapOf<String,Any?>("variant" to r.getString("variant"),"appearance" to r.getString("appearance"))
        p+=content[r.getString("variant")].orEmpty()
        if(r.has("color") && !r.isNull("color")) p["color"]=r.getString("color")
        for(k in listOf("selected","selectable","removable")) if(r.has(k) && !r.isNull(k)) p[k]=r.getBoolean(k)
        when(r.getString("scenario")) { "disabled"->p["disabled"]=true;"softDisabled"->p["softDisabled"]=true }
        return p }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val r=run;val keep=r.getString("scenario") !in setOf("removeDelete","removeClick","removeBackspace")
        AWCTheme(r.optString("theme")=="dark") { AWCChipReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            Box(Modifier.absoluteOffset(1000.dp,10.dp).size(60.dp,32.dp).focusRequester(before).focusable())
            CompositionLocalProvider(LocalLayoutDirection provides if(r.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(60.dp,60.dp).width(360.dp),contentAlignment=Alignment.TopStart) {
                    AWCChipAppearanceScope(if(r.optBoolean("custom") || r.has("hooks") && !r.isNull("hooks")) hooks else AWCChipHookAppearance()) {
                    AWCChipInspectionScope({ inspection=it }) { AWCInspectionScope(collector) {
                        AWCActionScope(onAction={ e-> if(keep && e.name=="mdRemove") e.preventDefault();actionsSeen+=e.name to e.defaultPrevented }) {
                            AWCComponent("md-chip",props(r),onEvent={ n,v-> if(n.startsWith("md")) events+=n to (v as? Map<*,*> ?: emptyMap<String,Any>()) },
                                content={ slot-> if(slot=="leading-icon" && r.getString("scenario")=="avatar") Box(Modifier.size(18.dp).clip(CircleShape).background(Color(0xFF7E57C2))) })
                        }
                    } } }
                }
            }
            Box(Modifier.absoluteOffset(10.dp,860.dp).size(40.dp,20.dp).focusable())
        } } } }
    } } }
    @Test fun chipInteractionMatchesChrome() {
        content()
        for((file,red) in listOf("ChipWebStates.json" to false,"ChipWebStatesReduced.json" to true))
            for(r in CardWeb.document(file).getJSONArray("runs").objects()) runCase(r,red)
        AccordionEvidence.log("chip-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(400))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private class Frame(val web:Double,val present:Boolean,val layer:Double,val bg:List<Double>,val ink:List<Double>,val shadow:List<Double>,val values:Map<String,Any?>)
    private fun runCase(r:JSONObject,red:Boolean) {
        val name=(if(red) "reduced/" else "")+r.getString("name");val scenario=r.getString("scenario")
        android.util.Log.i("AWCAccordion","chip-states run $name")
        val away=Offset(2380f,1200f)
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(away,0) }
        events.clear();actionsSeen.clear();inspection=null;collector.clear();reduced=red;run=r;epoch++;compose.waitForIdle()
        compose.mainClock.autoAdvance=false;compose.mainClock.advanceTimeBy(100);compose.waitForIdle()
        val phases=r.getJSONArray("phases").objects();val rest=r.getJSONObject("rest")
        collector.snapshot().nodes.firstOrNull { it.name=="md-chip" }.let { n->
            check(n!=null && abs(n.bounds.x-rest.getDouble("x"))<=.6 && abs(n.bounds.y-rest.getDouble("y"))<=.6 && abs(n.bounds.width-rest.getDouble("width"))<=1.0,"$name rest box ${n?.bounds} vs $rest") }
        val pointer=r.getJSONObject("pointer");fun pt(a:JSONArray)=Offset(a.getDouble(0).toFloat()*2,a.getDouble(1).toFloat()*2)
        val body=pt(pointer.getJSONArray("body"));val remove=if(pointer.isNull("remove")) body else pt(pointer.getJSONArray("remove"))
        fun mouse(block:MouseInjectionScope.()->Unit)=compose.onRoot().performMouseInput(block)
        fun key(k:Key,shift:Boolean=false)=compose.onRoot().performKeyInput { if(shift) keyDown(Key.ShiftLeft);pressKey(k);if(shift) keyUp(Key.ShiftLeft) }
        val webEvents=r.getJSONArray("events").objects()
        val frameTimes=phases.flatMap { it.getJSONArray("samples").objects().map { s-> s.getDouble("t") } }
        val animStarts=r.getJSONArray("anims").objects().mapNotNull { a-> if(a.isNull("startTime")) null else a.getDouble("startTime") }
        fun frameAfter(t:Double)=animStarts.filter { it>=t-17 && it<=t+34 }.minOrNull() ?: frameTimes.firstOrNull { it>=t && it<=t+34 } ?: t
        // A pointer step anchored to the frame where Chrome STARTED its animation must be injected one frame before it:
        // Chrome's Web Animation start time is the first frame after the input, and the native wave likewise begins on the
        // first frame after the input (AccordionRippleWave.begin). Injecting at Chrome's start time delayed every native
        // wave by one frame, and its fade (450 ms later) missed Chrome's capture window by that frame.
        fun at(ph:JSONObject,fallback:Double):Double { val t=ph.getDouble("t")
            val e=webEvents.firstOrNull { it.getString("name")!="click" && it.getDouble("t")>=t && it.getDouble("t")<=t+150 }?.getDouble("t")
            val start=e?.let { ev-> animStarts.filter { it>=ev-17 && it<=ev+34 }.minOrNull() }
            return if(start!=null) max(t,start-16.0) else frameAfter(e ?: (t+fallback)) }
        // A keyboard step fires at the frame Chrome started that phase's transitions (focus moves are not events here).
        fun keyAt(ph:JSONObject,fallback:Double):Double { val t=ph.getDouble("t")
            return r.getJSONArray("anims").objects().filter { it.getString("phase")==ph.getString("label") && !it.isNull("startTime") && it.getDouble("startTime")>=t && it.getDouble("startTime")<=t+150 }
                .minOfOrNull { it.getDouble("startTime") } ?: at(ph,fallback) }
        val steps=mutableListOf<Triple<String,Double,()->Unit>>()
        for(ph in phases) { val t=ph.getDouble("t")
            when(val l=ph.getString("label")) {
                "hover","hover2","hoverBody"->steps+=Triple(l,frameAfter(t+5)) { mouse { moveTo(body,0) } }
                "hoverRemove"->steps+=Triple(l,frameAfter(t+5)) { mouse { moveTo(remove,0) } }
                "press"->steps+=Triple(l,frameAfter(t+10)) { mouse { moveTo(body,0);press() } }
                "release"->steps+=Triple(l,at(ph,10.0)) { mouse { moveTo(body+Offset(.001f,0f),0);release() } }
                "pressRemove"->steps+=Triple(l,frameAfter(t+10)) { mouse { moveTo(remove,0);press() } }
                "releaseRemove"->steps+=Triple(l,at(ph,10.0)) { mouse { moveTo(remove+Offset(.001f,0f),0);release() } }
                "leave","leave2"->steps+=Triple(l,frameAfter(t+5)) { mouse { moveTo(away,0) } }
                "click2","clickBody"->steps+=Triple(l,at(ph,20.0)) { mouse { moveTo(body,0);press();release() } }
                // Chrome focuses #before ahead of the phase and sends Tab at its start.
                "tab"->{ steps+=Triple("tabBefore",t-34) { compose.runOnIdle { before.requestFocus() } };steps+=Triple(l,keyAt(ph,2.0)) { key(Key.Tab) } }
                "tabRemove","tabAway"->steps+=Triple(l,keyAt(ph,2.0)) { key(Key.Tab) }
                "shiftTab"->steps+=Triple(l,keyAt(ph,2.0)) { key(Key.Tab,true) }
                "enter","enterRemove"->steps+=Triple(l,keyAt(ph,5.0)) { key(Key.Enter) }
                "space","spaceRemove"->steps+=Triple(l,keyAt(ph,5.0)) { key(Key.Spacebar) }
                "delete","deleteRemove"->steps+=Triple(l,at(ph,5.0)) { key(Key.Delete) }
                "backspace"->steps+=Triple(l,at(ph,5.0)) { key(Key.Backspace) }
                // Chrome sends ArrowRight; the chip ignores it and keeps focus (gate-7 R4-08: no 2D focus search from the chip).
                "arrow"->steps+=Triple(l,keyAt(ph,5.0)) { key(Key.DirectionRight) }
                else->steps+=Triple(l,t) {}
            }
        }
        val webT0=steps[0].second;val clock0=compose.mainClock.currentTime
        fun elapsed()=(compose.mainClock.currentTime-clock0).toDouble()
        val fired=mutableMapOf<String,Double>()
        fun webTime(native:Double):Double { val done=steps.filter { fired[it.first]?.let { f-> f<=native } ?: false }
            val s=done.lastOrNull() ?: return webT0+native;return s.second+(native-fired[s.first]!!) }
        val frames=mutableListOf<Frame>();val ends=mutableListOf<Triple<JSONObject,CardWeb.Grid,Frame?>>()
        fun sample():Frame? { val i=inspection ?: return null;val present=collector.snapshot().nodes.any { it.name=="md-chip" };val t=i.frameMillis
            return Frame(webTime(elapsed()),present,i.layerOpacity(t),CardWeb.pre(i.background(t)),CardWeb.pre(i.ink(t)),CardWeb.nativeShadow(i.shadow(t),2),i.values) }
        fun grab():CardWeb.Grid { val clip=r.getJSONObject("clip")
            return CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height")) }
        fun capture(ph:JSONObject) { ends+=Triple(ph,grab(),sample()) }
        // Chrome photographs a phase after its last sample and before the next phase starts (states.html phase()); the
        // captured frame lies anywhere in that window. Each frame rendered inside it is a paint candidate besides the
        // phase-end capture, so a transition running across the gap (a wave fading 450 ms after a click) is compared at
        // the moments Chrome could have photographed.
        val windowShots=mutableMapOf<Int,MutableList<Pair<Double,CardWeb.Grid>>>();var current=-1
        fun windowCandidate() { if(current<0) return;val ph=phases[current];if(!ph.optBoolean("shot",true)) return
            val ss=ph.getJSONArray("samples");val last=if(ss.length()>0) ss.getJSONObject(ss.length()-1).getDouble("t") else ph.getDouble("t")
            val nextT=if(current+1<phases.size) phases[current+1].getDouble("t") else Double.MAX_VALUE;val wt=webTime(elapsed())
            if(wt>=last && wt<=nextT) windowShots.getOrPut(current) { mutableListOf() }+=wt to grab() }
        val end=steps.last().second-webT0+(phases.last().getJSONArray("samples").length()*16.7).coerceAtLeast(200.0);var next=0
        while(elapsed()<end) {
            while(next<steps.size && elapsed()>=steps[next].second-webT0) {
                val s=steps[next]
                // The previous phase ends where its successor's first input begins (the #before focus ahead of a Tab).
                val captureFor=if(s.first=="tabBefore") "tab" else if(s.first=="tab" && steps.any { it.first=="tabBefore" }) null else s.first
                if(next>0 && captureFor!=null) phases.indexOfFirst { it.getString("label")==captureFor }.takeIf { it>0 }?.let { capture(phases[it-1]) }
                fired[s.first]=elapsed();s.third();next++
                current=if(s.first=="tabBefore") -1 else phases.indexOfFirst { it.getString("label")==s.first }.takeIf { it>=0 } ?: current
            }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            sample()?.let { if(it.present) frames+=it }
            windowCandidate()
        }
        capture(phases.last())
        compose.mainClock.autoAdvance=true
        // Events: order, mdSelect detail and the cancelled default of mdRemove.
        val web=webEvents.filter { it.getString("name")!="click" }
        check(events.map { it.first }==web.map { it.getString("name") },"$name events ${events.map { it.first }} vs ${web.map { it.getString("name") }}")
        for((i,w) in web.withIndex()) { val e=events.getOrNull(i) ?: break
            if(e.first=="mdSelect") check(e.second["selected"]==w.getJSONObject("detail").getBoolean("selected"),"$name mdSelect detail ${e.second}")
            val seen=actionsSeen.getOrNull(i);check(seen!=null && seen.second==w.optBoolean("prevented"),"$name ${e.first} prevented ${seen?.second} vs ${w.optBoolean("prevented")}") }
        // Phase end states: presence, focus, rings, selection, pressed state.
        for((ph,_,f) in ends) { val snap=ph.getJSONObject("snap");val label=ph.getString("label")
            if(!snap.optBoolean("connected",true)) { check(collector.snapshot().nodes.none { it.name=="md-chip" } || f?.present==false,"$name/$label chip removed");continue }
            val v=f?.values ?: run { check(false,"$name/$label measured");null } ?: continue
            val active=snap.optString("active")
            val focus=when { v["removeFocused"]==true->"md-chip__remove";v["hostFocused"]==true->if(v["role"]=="button") "chip" else "md-chip__primary";else->"other" }
            check(focus==active || (focus=="other" && active !in setOf("chip","md-chip__primary","md-chip__remove")),"$name/$label focus $focus vs $active")
            check((v["hostRing"]==true)==(snap.getJSONObject("focusRing").getString("style")=="solid"),"$name/$label host ring ${v["hostRing"]}")
            check((v["primaryRing"]==true)==(snap.optJSONObject("primaryRing")?.getString("style")=="solid"),"$name/$label primary ring ${v["primaryRing"]}")
            check((v["removeRing"]==true)==(snap.optJSONObject("removeRing")?.getString("style")=="solid"),"$name/$label remove ring ${v["removeRing"]}")
            check(v["selected"]==snap.optBoolean("selected"),"$name/$label selected ${v["selected"]} vs ${snap.optBoolean("selected")}")
            val pressed=if(snap.isNull("ariaPressed")) "" else snap.getString("ariaPressed")
            check(v["pressedState"]==pressed,"$name/$label pressed state ${v["pressedState"]} vs $pressed")
        }
        // Per-frame values within Chrome's samples.
        val samples=phases.flatMap { it.getJSONArray("samples").objects() }.filter { it.optBoolean("connected",true) }.toMutableList()
        if(samples.isEmpty()) return
        // Before Chrome's first rAF sample, the first phase's transition records give the pre-input values at their start.
        run { val first=samples[0];val seed=JSONObject(first.toString());var start=first.getDouble("t")
            for(a in r.getJSONArray("anims").objects()) { if(a.getString("phase")!=phases[0].getString("label") || a.isNull("startTime")) continue
                start=min(start,a.getDouble("startTime"));val from=a.getJSONObject("from")
                when(a.getString("target") to a.getString("property")) {
                    "state-layer" to "opacity"->seed.optJSONObject("layer")?.put("opacity",from.optString("opacity","0").toDouble())
                    "host" to "background-color"->seed.put("background",from.getString("backgroundColor"))
                    "host" to "color"->seed.put("color",from.getString("color"))
                    "host" to "box-shadow"->seed.put("shadow",from.getString("boxShadow"))
                } }
            samples.add(0,seed.put("t",start)) }
        fun env(read:(JSONObject)->List<Double>?,t:Double):Pair<List<Double>,List<Double>>? {
            val after=samples.indexOfFirst { it.getDouble("t")>=t }
            // Past Chrome's last sample there is no source value (a ripple still growing when the chip is removed).
            if(after<0) return if(t<=samples.last().getDouble("t")+17) read(samples.last())?.let { it to it } else null
            if(after==0) return read(samples[0])?.let { it to it }
            val a=samples[after-1];val b=samples[after];val ta=a.getDouble("t");val tb=b.getDouble("t");val va=read(a) ?: return null;val vb=read(b) ?: return null
            if(tb-ta>34) return va.zip(vb).map { min(it.first,it.second) } to va.zip(vb).map { max(it.first,it.second) }
            val x=if(tb>ta) (t-ta)/(tb-ta) else 1.0;val v=va.zip(vb).map { it.first+(it.second-it.first)*x };return v to v }
        val props:List<Triple<String,Double,Pair<(JSONObject)->List<Double>?,(Frame)->List<Double>?>>> = listOf(
            Triple("state layer",.004,Pair({ s-> s.optJSONObject("layer")?.takeIf { it.getString("display")!="none" }?.let { listOf(it.getDouble("opacity")) } },{ f-> if(f.values["layerVisible"]==true) listOf(f.layer) else null })),
            Triple("container",.012,Pair({ s-> CardWeb.pre(CardWeb.color(s.getString("background"))) },{ f-> f.bg })),
            Triple("label ink",.012,Pair({ s-> CardWeb.pre(CardWeb.color(s.getString("color"))) },{ f-> f.ink })),
            Triple("shadow",.03,Pair({ s-> CardWeb.shadow(s.getString("shadow"),2) },{ f-> f.shadow })))
        val compared=mutableMapOf<String,Int>()
        for((prop,tol,rw) in props) {
            for(f in frames) { val v=rw.second(f) ?: continue
                var lo:List<Double>?=null;var hi:List<Double>?=null;var x=f.web-34
                while(x<=f.web+40) { env(rw.first,x)?.let { e-> if(e.first.size==v.size) { lo=lo?.zip(e.first)?.map { min(it.first,it.second) } ?: e.first;hi=hi?.zip(e.second)?.map { max(it.first,it.second) } ?: e.second } };x+=2 }
                for(smp in samples) { val st=smp.getDouble("t");if(st<f.web-34 || st>f.web+40) continue;val e=rw.first(smp) ?: continue;if(e.size!=v.size) continue
                    lo=lo?.zip(e)?.map { min(it.first,it.second) } ?: e;hi=hi?.zip(e)?.map { max(it.first,it.second) } ?: e }
                val l=lo ?: continue;val h=hi!!
                check(v.indices.all { v[it]>=l[it]-tol && v[it]<=h[it]+tol },"$name $prop rendered $v at web ${f.web.toInt()} within Chrome [$l, $h]");compared[prop]=(compared[prop] ?: 0)+1 }
        }
        check((compared["container"] ?: 0)>8,"$name samples compared $compared")
        // Source timings: state layer 50 ms (short1), host colours / shadow 100 ms (short2); none under reduced motion.
        for(a in r.getJSONArray("anims").objects().filter { it.getString("target")!="wave" }) {
            val expected=if(a.getString("target")=="state-layer") 50.0 else 100.0
            check(!red && a.getDouble("duration")==expected,"$name ${a.getString("target")} ${a.getString("property")} duration ${a.getDouble("duration")} vs native $expected")
        }
        // Phase paint (the focus probes are plain native focus targets, not the source buttons: masked).
        val probes=listOf(androidx.compose.ui.geometry.Rect(1000f,10f,1060f,42f),androidx.compose.ui.geometry.Rect(10f,860f,50f,880f))
        for((ph,grid,_) in ends) { if(!ph.optBoolean("shot",true)) continue;val label=ph.getString("label")
            val web=CardWeb.webGrid("${if(red) "ChipWebStatesReduced" else "ChipWebStates"}/${r.getString("name")}-$label.png",r.getJSONObject("clip"))
            val options=listOf<Pair<Double?,CardWeb.Grid>>(null to grid)+(windowShots[phases.indexOf(ph)] ?: mutableListOf()).map { it.first to it.second }
            var best:JSONObject?=null;val tried=org.json.JSONArray()
            for((at,g) in options) { val res=CardWeb.compare(web,g,probes).put("frame",at ?: "phase end")
                tried.put(org.json.JSONArray().put(at ?: -1.0).put(res.getDouble("mean")))
                val b=best;if(b==null || (CardWeb.ok(res) && !CardWeb.ok(b)) || (CardWeb.ok(res)==CardWeb.ok(b) && res.getDouble("mean")<b.getDouble("mean"))) best=res
                if(at==null && CardWeb.ok(res)) break }
            val res=best!!.put("windowFrames",options.size-1).put("tried",tried)
            check(CardWeb.ok(res),"$name/$label flat pixels $res");report.put(res.put("case","$name/$label")) }
        report.put(JSONObject().put("case",name).put("frames",frames.size).put("compared",JSONObject(compared as Map<*,*>)))
        compose.onRoot().performMouseInput { moveTo(away,0) }
    }
}
