package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
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
import kotlin.math.max

/**
 * md-button interaction against Chrome 153 trusted-input runs (md-button/states.html and the reduced-motion set):
 * pointer hover/press/release/leave and click on every variant, toggles (with and without shape morph, square),
 * sizes, keyboard Tab/Enter/Space/Tab-away, hard and soft disabled, loading, links, all hooks, RTL and dark. Steps fire
 * on the test clock one frame before the frame where Chrome started the step's animation (both start an animation on
 * the first frame after the input). Checked: events (order, mdClick/mdChange selected), focus per phase and every flat
 * pixel of Chrome's phase screenshot against the frames inside Chrome's recorded capture window [shotStart, shotEnd].
 */
@OptIn(ExperimentalTestApi::class)
class NativeButtonInteractionTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"name\":\"init\",\"variant\":\"filled\",\"label\":\"Init\",\"scenario\":\"pointer\",\"theme\":\"light\",\"dir\":\"ltr\"}"))
    private var reduced by mutableStateOf(false);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private val events=mutableListOf<Pair<String,Map<*,*>>>()
    private val before=FocusRequester();private var focused=false
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private val hooks=AWCButtonAppearance(containerColor="#22556699",labelColor="#C62828",iconColor="#2E7D32",trailingIconColor="#6A1B9A",loadingColor="#00897B",stateLayerColor="#FF6F00",
        outlineColor="#1565C0",iconSize=22.0,trailingIconSize=16.0,loadingSize=18.0,fontSize=15.0,fontWeight=700.0,lineHeight=22.0,letterSpacing=.5,cornerRadius=6.0,outlineWidth=3.0,
        paddingInline=20.0,paddingBlock=6.0,gap=10.0,hoverOpacity=.2,focusOpacity=.24,pressedOpacity=.3,focusRingColor="#D81B60",width=200.0,minWidth=120.0,maxWidth=260.0,height=48.0,minHeight=44.0)
    private fun props(r:JSONObject):Map<String,Any?> { val p=mutableMapOf<String,Any?>()
        for(k in listOf("variant","size","shape","icon","trailingIcon","href")) if(r.has(k) && !r.isNull(k)) p[k]=r.getString(k)
        for(k in listOf("toggle","shapeMorph","loading")) if(r.has(k) && !r.isNull(k)) p[k]=r.getBoolean(k)
        when(r.getString("scenario")) { "disabled"->p["disabled"]=true;"softDisabled"->p["softDisabled"]=true }
        return p }
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val r=run
        AWCTheme(r.optString("theme")=="dark") { AWCButtonReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            Box(Modifier.absoluteOffset(1000.dp,10.dp).size(60.dp,32.dp).focusRequester(before).focusable())
            CompositionLocalProvider(LocalLayoutDirection provides if(r.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                Box(Modifier.absoluteOffset(60.dp,60.dp).width(360.dp),contentAlignment=Alignment.TopStart) {
                    AWCButtonAppearanceScope(if(r.optBoolean("custom")) hooks else AWCButtonAppearance()) { AWCInspectionScope(collector) {
                        Box(Modifier.onFocusChanged { focused=it.hasFocus }) {
                            AWCComponent("md-button",props(r),onEvent={ n,v-> if(n.startsWith("md")) events+=n to (v as? Map<*,*> ?: emptyMap<String,Any>()) }) { slot-> if(slot=="") AWCSlotText(r.optString("label","Create")) }
                        }
                    } }
                }
            }
            Box(Modifier.absoluteOffset(10.dp,860.dp).size(40.dp,20.dp).focusable())
        } } } }
    } } }
    @Test fun buttonInteractionMatchesChrome() {
        content()
        // Loading runs keep an infinite loader animation: the whole test runs on the manual clock.
        compose.mainClock.autoAdvance=false
        for((file,red) in listOf("ButtonWebStates.json" to false,"ButtonWebStatesReduced.json" to true))
            for(r in CardWeb.document(file).getJSONArray("runs").objects()) runCase(r,red)
        AccordionEvidence.log("button-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(400))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }
    private fun runCase(r:JSONObject,red:Boolean) {
        val name=(if(red) "reduced/" else "")+r.getString("name")
        android.util.Log.i("AWCAccordion","button-states run $name")
        val away=Offset(2380f,1200f)
        compose.onRoot().performMouseInput { moveTo(away,0) }
        events.clear();collector.clear();reduced=red;run=r;epoch++;compose.mainClock.advanceTimeBy(100);compose.waitForIdle()
        val phases=r.getJSONArray("phases").objects();val rest=r.getJSONObject("rest")
        collector.snapshot().nodes.firstOrNull { it.id=="component" }.let { n->
            check(n!=null && kotlin.math.abs(n.bounds.x-rest.getDouble("x"))<=1.0 && kotlin.math.abs(n.bounds.y-rest.getDouble("y"))<=.6 && kotlin.math.abs(n.bounds.width-rest.getDouble("width"))<=1.0,"$name rest box ${n?.bounds} vs $rest") }
        val pointer=r.getJSONObject("pointer");val body=Offset(pointer.getJSONArray("body").getDouble(0).toFloat()*2,pointer.getJSONArray("body").getDouble(1).toFloat()*2)
        fun mouse(block:MouseInjectionScope.()->Unit)=compose.onRoot().performMouseInput(block)
        fun key(k:Key)=compose.onRoot().performKeyInput { pressKey(k) }
        val webEvents=r.getJSONArray("events").objects()
        val frameTimes=phases.flatMap { it.getJSONArray("samples").objects().map { s-> s.getDouble("t") } }
        val animStarts=r.getJSONArray("anims").objects().mapNotNull { a-> if(a.isNull("startTime")) null else a.getDouble("startTime") }
        fun frameAfter(t:Double)=animStarts.filter { it>=t-17 && it<=t+34 }.minOrNull()?.let { it-16.0 } ?: frameTimes.firstOrNull { it>=t && it<=t+34 } ?: t
        fun at(ph:JSONObject,fallback:Double):Double { val t=ph.getDouble("t")
            val e=webEvents.firstOrNull { it.getString("name")!="click" && it.getDouble("t")>=t && it.getDouble("t")<=t+150 }?.getDouble("t")
            val start=e?.let { ev-> animStarts.filter { it>=ev-17 && it<=ev+34 }.minOrNull() }
            return if(start!=null) max(t,start-16.0) else frameAfter(e ?: (t+fallback)) }
        val steps=mutableListOf<Triple<String,Double,()->Unit>>()
        for(ph in phases) { val l=ph.getString("label");val t=ph.getDouble("t")
            when(l) {
                "hover","hover2"->steps+=Triple(l,max(t,frameAfter(t+5))) { mouse { moveTo(body,0) } }
                "press"->steps+=Triple(l,max(t,frameAfter(t+10))) { mouse { moveTo(body,0);press() } }
                "release"->steps+=Triple(l,at(ph,10.0)) { mouse { moveTo(body+Offset(.001f,0f),0);release() } }
                "leave","leave2"->steps+=Triple(l,max(t,frameAfter(t+5))) { mouse { moveTo(away,0) } }
                "click2"->steps+=Triple(l,at(ph,20.0)) { mouse { moveTo(body,0);press();release() } }
                "tab"->{ steps+=Triple("tabBefore",t-34) { compose.runOnIdle { before.requestFocus() } };steps+=Triple(l,max(t,frameAfter(t+2))) { key(Key.Tab) } }
                "tabAway"->steps+=Triple(l,max(t,frameAfter(t+2))) { key(Key.Tab) }
                "enter"->steps+=Triple(l,max(t,frameAfter(t+5))) { key(Key.Enter) }
                "space"->steps+=Triple(l,max(t,frameAfter(t+5))) { key(Key.Spacebar) }
                else->steps+=Triple(l,t) {}
            }
        }
        steps.sortBy { it.second }
        val webT0=steps[0].second;val clock0=compose.mainClock.currentTime
        fun elapsed()=(compose.mainClock.currentTime-clock0).toDouble()
        fun grab():CardWeb.Grid { val clip=r.getJSONObject("clip")
            return CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height")) }
        val shots=mutableMapOf<Int,MutableList<Pair<Double,CardWeb.Grid>>>();val focusAt=mutableMapOf<Int,Boolean>()
        // The capture window of each phase: Chrome's [shotStart, shotEnd] (in web time).
        // Chrome chains md-ripple's release fade on the grow animation's `finished` promise, which resolves on the first frame
        // at or after the 450 ms grow ends: depending on Chrome's frame phase the fade starts on time or one frame late. The
        // phase samples show which; the native fade starts exactly at the grow end, so its frames reach back by that lag.
        fun fadeLag(i:Int):Double { val ph=phases[i];val label=ph.getString("label")
            val grow=r.getJSONArray("anims").objects().firstOrNull { it.optString("phase")==label && it.optString("target")=="wave" && !it.isNull("startTime") } ?: return 0.0
            val growEnd=grow.getDouble("startTime")+grow.optDouble("duration",450.0)
            if(growEnd>=ph.optDouble("shotStart",Double.POSITIVE_INFINITY)) return 0.0
            val first=ph.optJSONArray("samples")?.objects()?.firstOrNull { it.getDouble("t")>=growEnd } ?: return 0.0
            return (first.getDouble("t")-growEnd).coerceIn(0.0,17.0) }
        fun windowFor(i:Int):Pair<Double,Double> { val ph=phases[i];val next=if(i+1<phases.size) phases[i+1].getDouble("t") else ph.getDouble("t")+500
            return (ph.optDouble("shotStart",next)-4-fadeLag(i)) to minOf(ph.optDouble("shotEnd",next),next) }
        val end=phases.indices.maxOf { windowFor(it).second }-webT0+20;var next=0;var webNow=webT0
        while(elapsed()<end) {
            while(next<steps.size && elapsed()>=steps[next].second-webT0) { steps[next].third();next++ }
            compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            webNow=webT0+elapsed()
            for(i in phases.indices) { val (a,b)=windowFor(i); if(webNow in a..b) { shots.getOrPut(i) { mutableListOf() }+=webNow to grab();focusAt[i]=focused } }
        }
        val web=webEvents.filter { it.getString("name")!="click" }
        check(events.map { it.first }==web.map { it.getString("name") },"$name events ${events.map { it.first }} vs ${web.map { it.getString("name") }}")
        for((i,w) in web.withIndex()) { val e=events.getOrNull(i) ?: break;val d=w.optJSONObject("detail") ?: continue
            if(d.has("selected")) check(e.second["selected"]==d.getBoolean("selected"),"$name ${e.first}.selected ${e.second["selected"]} vs ${d.getBoolean("selected")}") }
        val loader=collector.snapshot().nodes.firstOrNull { it.id.endsWith("loader") || it.id.endsWith("loading") }?.bounds
        val mask=if(loader==null) emptyList() else listOf(Rect(loader.x.toFloat(),loader.y.toFloat(),(loader.x+loader.width).toFloat(),(loader.y+loader.height).toFloat()))
        for((i,ph) in phases.withIndex()) { val label=ph.getString("label");val active=ph.getJSONObject("snap").optString("active")
            check((focusAt[i]==true)==(active=="button" || active.startsWith("md-button__anchor")),"$name/$label focus ${focusAt[i]} vs $active")
            val webGrid=CardWeb.webGrid("${if(red) "ButtonWebStatesReduced" else "ButtonWebStates"}/${r.getString("name")}-$label.png",r.getJSONObject("clip"))
            val tried=JSONArray();var best:JSONObject?=null
            for((at,g) in shots[i].orEmpty()) { val res=CardWeb.compare(webGrid,g,mask).put("frame",at);tried.put(JSONArray().put(at).put(res.getDouble("mean")))
                val b=best;if(b==null || (CardWeb.ok(res) && !CardWeb.ok(b)) || (CardWeb.ok(res)==CardWeb.ok(b) && res.getDouble("mean")<b.getDouble("mean"))) best=res }
            val res=best ?: JSONObject().put("compared",0).put("mean",99.0).put("over6",0)
            check(CardWeb.ok(res),"$name/$label flat pixels ${res.put("tried",tried)}");report.put(res.put("case","$name/$label"))
        }
        compose.onRoot().performMouseInput { moveTo(away,0) }
    }
}
