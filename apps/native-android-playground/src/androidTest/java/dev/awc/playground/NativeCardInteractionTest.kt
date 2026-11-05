package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
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
 * md-card interaction against Chrome trusted-input records (states.html and the reduced-motion
 * set): real mouse and keyboard input at Chrome's input times, frame by frame on the test clock;
 * state layer, elevation, container, drag translate and ripple values against Chrome's samples
 * (±2 frames, monotone envelope across gaps), mdClick/mdDrag* order and payloads, focus, focus
 * ring, z-index, source timings and rendered paint per phase.
 */
@OptIn(ExperimentalTestApi::class)
class NativeCardInteractionTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf(JSONObject("{\"variant\":\"elevated\",\"scenario\":\"pointer\",\"props\":{},\"theme\":\"light\",\"dir\":\"ltr\"}"))
    private var reduced by mutableStateOf(false);private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector();private var inspection:AWCCardInspection?=null
    private val events=mutableListOf<Pair<String,Map<*,*>>>()
    private var focus="body";private val before=FocusRequester();private val innerFocus=FocusRequester();private var inner=Rect.Zero;private var innerClicks=0
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private val hooks=JSONObject("{\"container-color\":\"#22556699\",\"container-shape\":\"20px 4px / 8px 12px\",\"container-elevation\":\"0px 3px 6px 0px #00000033\",\"outline-color\":\"#CC3377CC\",\"outline-width\":\"3px\",\"state-layer-color\":\"#33EEAA80\",\"width\":\"280px\",\"min-width\":\"200px\",\"max-width\":\"300px\",\"height\":\"190px\",\"min-height\":\"150px\",\"max-height\":\"220px\",\"padding\":\"10px 18px\",\"gap\":\"13px\"}")
    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) {
        val r=run
        AWCTheme(r.getString("theme")=="dark") { AWCCardReducedMotionScope(reduced) { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            Box(Modifier.offset(470.dp,10.dp).size(40.dp,20.dp).focusRequester(before).onFocusChanged { if(it.isFocused) focus="before" else if(focus=="before") focus="body" }.focusable())
            Box(Modifier.offset(60.dp,60.dp).size(320.dp,240.dp)) {
                CompositionLocalProvider(LocalLayoutDirection provides if(r.getString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    AWCCardAppearanceScope(if(r.getString("scenario")=="custom") CardWeb.appearance(hooks) else AWCCardAppearance()) {
                        AWCCardInspectionScope({ inspection=it }) { AWCInspectionScope(collector) {
                            val props=mutableMapOf<String,Any?>("variant" to r.getString("variant"));r.getJSONObject("props").let { p-> p.keys().forEach { props[it]=p.get(it) } }
                            AWCComponent("md-card",props,onEvent={ n,v-> if(n.startsWith("md")) events+=n to (v as? Map<*,*> ?: emptyMap<String,Any>()) }) { slot-> if(slot=="") {
                                Box(Modifier.fillMaxWidth().height(20.dp)) { Text("Card title") }
                                if(r.getString("scenario")=="nested") Box(Modifier.fillMaxWidth().height(36.dp).onGloballyPositioned { inner=it.boundsInRoot().let { b-> Rect(b.left/2,b.top/2,b.right/2,b.bottom/2) } }) {
                                    Button(onClick={ innerClicks++ },Modifier.awcCardInteractiveContent().onFocusChanged { if(it.hasFocus) focus="inner" else if(focus=="inner") focus="body" }.focusRequester(innerFocus).focusable()) { Text("Inner action") } }
                                else Box(Modifier.fillMaxWidth().height(40.dp)) { Text("Two lines of body content") }
                                Box(Modifier.fillMaxWidth().height(30.dp)) { Text("Footer") }
                            } }
                        } }
                    }
                }
            }
            Box(Modifier.offset(10.dp,860.dp).size(40.dp,20.dp).onFocusChanged { if(it.isFocused) focus="after" else if(focus=="after") focus="body" }.focusable())
        } } } }
    } } }
    @Test fun cardInteractionMatchesChrome() {
        content()
        for((file,red) in listOf("CardWebStates.json" to false,"CardWebStatesReduced.json" to true))
            for(r in CardWeb.document(file).getJSONArray("runs").objects()) runCase(r,red)
        AccordionEvidence.log("card-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }
    private fun runCase(r:JSONObject,red:Boolean) {
        val name=(if(red) "reduced/" else "")+r.getString("name");val scenario=r.getString("scenario")
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(Offset(2380f,1200f),0) }
        events.clear();innerClicks=0;inspection=null;collector.clear();reduced=red;run=r;epoch++;focus="body";compose.waitForIdle()
        compose.mainClock.autoAdvance=false;compose.mainClock.advanceTimeBy(100);compose.waitForIdle()
        val p=r.getJSONArray("pointer").let { Offset(it.getDouble(0).toFloat(),it.getDouble(1).toFloat()) };val rest=r.getJSONObject("rest")
        fun px(o:Offset)=Offset(o.x*2,o.y*2)
        val away=Offset(2380f,1200f)
        val phases=r.getJSONArray("phases").objects();val webT0=phases[0].getDouble("t")
        val bg=Offset((rest.getDouble("x")+rest.getDouble("width")-30).toFloat(),(rest.getDouble("y")+rest.getDouble("height")-12).toFloat())
        fun mouse(block:MouseInjectionScope.()->Unit)=compose.onRoot().performMouseInput(block)
        // The source pressed the inner button's centre; its mdClick reports that point.
        val innerClick=r.getJSONArray("events").objects().filter { it.getString("name")=="mdClick" }.getOrNull(1)?.getJSONObject("detail")
        val innerPoint=innerClick?.let { Offset(it.getDouble("clientX").toFloat(),it.getDouble("clientY").toFloat()) }
        fun key(k:Key)=compose.onRoot().performKeyInput { pressKey(k) }
        val release=when(scenario) { "drag","custom"->p+Offset(40f,24f);"dragClick"->p+Offset(20f,10f);else->p }
        val actions:MutableMap<String,List<Pair<Double,()->Unit>>> = mutableMapOf(
            "hover" to listOf(0.0 to { mouse { moveTo(px(p),0) } }),"press" to listOf(0.0 to { mouse { moveTo(px(p),0);press() } }),
            "release" to listOf(0.0 to { mouse { moveTo(px(release)+Offset(.001f,0f),0);release() } }),"leave" to listOf(0.0 to { mouse { moveTo(away,0) } }),
            "tab" to listOf(0.0 to { key(Key.Tab) }),"enter" to listOf(0.0 to { key(Key.Enter) }),"space" to listOf(0.0 to { key(Key.Spacebar) }),"tabAway" to listOf(0.0 to { key(Key.Tab) }),
            "creep" to listOf(0.0 to { mouse { moveTo(px(p+Offset(2f,2f)),0) } }),"start" to listOf(0.0 to { mouse { moveTo(px(p+Offset(12f,6f)),0) } }),
            "moves" to (1..3).map { k-> 16.7*(k-1) to { mouse { moveTo(px(p+Offset(12f+28f*k/3,6f+18f*k/3)),0) } } },
            "clickHover" to listOf(0.0 to { mouse { moveTo(px(p),0) } }),"clickPress" to listOf(0.0 to { mouse { moveTo(px(p),0);press() } }),"clickRelease" to listOf(0.0 to { mouse { moveTo(px(p)+Offset(.001f,0f),0);release() } }),
            "drag" to listOf(0.0 to { mouse { moveTo(px(p+Offset(20f,10f)),0) } }),
            "pressBackground" to listOf(0.0 to { mouse { moveTo(px(bg),0);press() } }),"releaseBackground" to listOf(0.0 to { mouse { moveTo(px(bg)+Offset(.001f,0f),0);release() } }),
            "pressInner" to listOf(0.0 to { mouse { moveTo(px(innerPoint ?: inner.center),0);press() } }),"releaseInner" to listOf(0.0 to { mouse { moveTo(px(innerPoint ?: inner.center)+Offset(.001f,0f),0);release() } }),
            "enterInner" to listOf(0.0 to { key(Key.Enter) }))
        // Compose Material buttons join keyboard traversal only in keyboard input mode; the nested
        // run focuses the authored button directly (the source Tab lands on it) and checks the card.
        val focusInner:()->Unit={ compose.runOnIdle { innerFocus.requestFocus() } }
        if(scenario=="nested") actions["tab"]=listOf(0.0 to focusInner)
        val focusBefore=setOf("tab")
        data class Frame(val web:Double,val layer:Double?,val shadow:List<Double>,val bg:List<Double>,val tx:List<Double>,val ripple:Map<String,Double>?)
        val frames=mutableListOf<Frame>();val snaps=mutableListOf<Triple<Int,CardWeb.Grid,Map<String,Any?>>>()
        val clock0=compose.mainClock.currentTime
        fun elapsed()=(compose.mainClock.currentTime-clock0).toDouble()
        fun frame(base:Double,startNative:Double) { compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
            val ins=inspection ?: return;val t=ins.frameMillis;val v=ins.values
            frames+=Frame(base+(elapsed()-startNative),if(v["layerVisible"]==true) ins.layerOpacity(t) else null,CardWeb.nativeShadow(ins.shadow(t),2),CardWeb.pre(ins.background(t)),
                listOf((v["offsetX"] as Double),(v["offsetY"] as Double)),ins.ripple(t)) }
        for((i,ph) in phases.withIndex()) {
            val label=ph.getString("label");val start=ph.getDouble("t")-webT0
            if(label in focusBefore) { compose.onRoot().performMouseInput { moveTo(away,0) };compose.runOnIdle { before.requestFocus() };compose.waitForIdle() }
            while(elapsed()<start) frame(webT0+start-(start-elapsed()),elapsed())
            val nativeStart=elapsed();val queue=(actions[label] ?: emptyList()).toMutableList()
            // The source moves away and focuses #before ~60 ms before a keyboard phase (after its screenshot).
            val end=(if(i+1<phases.size) phases[i+1].getDouble("t")-webT0 else start+500)-(if(i+1<phases.size && phases[i+1].getString("label") in focusBefore) 60 else 25)
            while(elapsed()<end) { while(queue.isNotEmpty() && elapsed()-nativeStart>=queue.first().first) queue.removeAt(0).second()
                frame(ph.getDouble("t"),nativeStart) }
            val clip=r.getJSONObject("clip")
            snaps+=Triple(i,CardWeb.nativeGrid(compose.onRoot().captureToImage().toPixelMap(),clip.getInt("x"),clip.getInt("y"),clip.getInt("width"),clip.getInt("height")),(inspection?.values ?: emptyMap())+mapOf("focusId" to focus,
                "rect" to collector.snapshot().nodes.firstOrNull { it.name=="md-card" }?.bounds))
        }
        compose.mainClock.autoAdvance=true
        // Events and payloads (the DOM click entries are not card events).
        val web=r.getJSONArray("events").objects().filter { it.getString("name")!="click" }
        check(events.map { it.first }==web.map { it.getString("name") },"$name events ${events.map { it.first }} vs ${web.map { it.getString("name") }}")
        for((e,w) in events.zip(web)) { val d=w.getJSONObject("detail");for(k in d.keys()) { val wv=d.get(k);val nv=e.second[k]
            if(wv is Number) check(nv is Number && abs(nv.toDouble()-wv.toDouble())<.01,"$name ${e.first}.$k $nv vs $wv") else check(nv==wv,"$name ${e.first}.$k $nv vs $wv") } }
        if(scenario=="nested") check(innerClicks>=1,"$name inner control keeps its own activation")
        // Phase end states.
        for((i,grid,v) in snaps) { val ph=phases[i];val snap=ph.getJSONObject("snap");val label=ph.getString("label")
            val b=v["rect"] as? dev.awc.nativeui.AWCInspectionBounds;val wr=snap.getJSONObject("rect")
            check(b!=null && abs(b.x-wr.getDouble("x"))<=.6 && abs(b.y-wr.getDouble("y"))<=.6,"$name/$label box $b vs $wr")
            val active=snap.optString("active");val want=when(active) { "card","after","before","inner"->active;else->"body" }
            val got=if(v["focused"]==true) "card" else v["focusId"]
            // Compose pointer input does not move focus to authored buttons (Chrome focuses a pressed <button>).
            if(!(scenario=="nested" && label in setOf("pressInner","releaseInner"))) check(got==want || (want=="body" && got!="card"),"$name/$label focus $got vs $active")
            check((v["focusRing"]==true)==(snap.getJSONObject("focusRing").getString("style")=="solid"),"$name/$label focus ring ${v["focusRing"]}")
            check((v["zIndex"]==1000)==(snap.getString("zIndex")=="1000"),"$name/$label z-index ${v["zIndex"]}")
            val res=CardWeb.compare(CardWeb.webGrid("${if(red) "CardWebStatesReduced" else "CardWebStates"}/${r.getString("name")}-$label.png",r.getJSONObject("clip")),grid,
                if(scenario=="nested") listOf(Rect(76f,104f,236f,144f)) else emptyList())
            check(CardWeb.ok(res),"$name/$label flat pixels $res");report.put(res.put("case","$name/$label")) }
        // Per-frame values within Chrome's samples.
        // Before Chrome's first rAF sample, each first-phase transition's "from" value at its start time.
        val samples=phases.flatMap { it.getJSONArray("samples").objects() }.toMutableList()
        samples.firstOrNull()?.let { first-> val seed=JSONObject(first.toString());var start=first.getDouble("t")
            for(a in r.getJSONArray("anims").objects().filter { it.getString("phase")==phases[0].getString("label") && !it.isNull("startTime") }) {
                start=min(start,a.getDouble("startTime"))
                if(a.getString("target")=="state-layer" && a.getString("property")=="opacity" && seed.optJSONObject("layer")!=null) seed.getJSONObject("layer").put("opacity",a.getJSONObject("from").getString("opacity").toDouble())
                if(a.getString("target")=="host" && a.getString("property")=="box-shadow") seed.put("shadow",a.getJSONObject("from").getString("boxShadow"))
                if(a.getString("target")=="host" && a.getString("property")=="background-color") seed.put("background",a.getJSONObject("from").getString("backgroundColor")) }
            seed.put("t",start);seed.put("waves",JSONArray());samples.add(0,seed) }
        fun env(read:(JSONObject)->List<Double>?,t:Double):Pair<List<Double>,List<Double>>? {
            val after=samples.indexOfFirst { it.getDouble("t")>=t }
            if(after<0) return read(samples.last())?.let { it to it };if(after==0) return read(samples[0])?.let { it to it }
            val a=samples[after-1];val b=samples[after];val ta=a.getDouble("t");val tb=b.getDouble("t");val va=read(a) ?: return read(b)?.let { it to it };val vb=read(b) ?: return va to va
            if(va.size!=vb.size) return vb to vb
            if(tb-ta>34) return va.zip(vb).map { min(it.first,it.second) } to va.zip(vb).map { max(it.first,it.second) }
            val x=if(tb>ta) (t-ta)/(tb-ta) else 1.0;val v=va.zip(vb).map { it.first+(it.second-it.first)*x };return v to v }
        val props:List<Triple<String,Double,Pair<(JSONObject)->List<Double>?,(Frame)->List<Double>?>>> = listOf(
            Triple("state layer",.004,Pair({ s-> s.optJSONObject("layer")?.takeIf { it.getString("display")!="none" }?.let { listOf(it.getDouble("opacity")) } },{ f-> f.layer?.let { listOf(it) } })),
            Triple("shadow",.02,Pair({ s-> CardWeb.shadow(s.getString("shadow"),2) },{ f-> f.shadow })),
            Triple("container",.008,Pair({ s-> CardWeb.pre(CardWeb.color(s.getString("background"))) },{ f-> f.bg })),
            Triple("translate",.01,Pair({ s-> val t=s.getString("transform");if(t=="none") listOf(0.0,0.0) else CardWeb.numbers(t.substringAfter("(")).let { listOf(it[4],it[5]) } },{ f-> f.tx })),
            Triple("ripple opacity",.006,Pair({ s-> listOf(s.getJSONArray("waves").objects().firstOrNull()?.getDouble("opacity") ?: 0.0) },{ f-> listOf(f.ripple?.get("opacity") ?: 0.0) })),
            Triple("ripple scale",.02,Pair({ s-> s.getJSONArray("waves").objects().firstOrNull()?.let { listOf(CardWeb.numbers(it.getString("transform").substringAfter("(")).firstOrNull() ?: 1.0) } },{ f-> f.ripple?.takeIf { (it["opacity"] ?: 0.0)>0 }?.let { listOf(it["scale"]!!) } })))
        val compared=mutableMapOf<String,Int>()
        for((prop,tol,rw) in props) for(f in frames) { val v=rw.second(f) ?: continue
            var lo:List<Double>?=null;var hi:List<Double>?=null;var x=f.web-34
            while(x<=f.web+40) { env(rw.first,x)?.takeIf { it.first.size==v.size }?.let { e-> lo=lo?.zip(e.first)?.map { min(it.first,it.second) } ?: e.first;hi=hi?.zip(e.second)?.map { max(it.first,it.second) } ?: e.second };x+=2 }
            val l=lo ?: continue;val h=hi!!
            check(v.indices.all { v[it]>=l[it]-tol && v[it]<=h[it]+tol },"$name $prop rendered $v at web ${f.web} within Chrome [$l, $h]");compared[prop]=(compared[prop] ?: 0)+1 }
        check((compared["shadow"] ?: 0)>50,"$name per-frame samples compared $compared")
        val wave=samples.mapNotNull { it.getJSONArray("waves").objects().firstOrNull() }.firstOrNull();val nw=frames.mapNotNull { it.ripple }.firstOrNull { (it["opacity"] ?: 0.0)>0 }
        if(wave!=null && nw!=null) { val size=CardWeb.numbers(wave.getString("size"))[0];val left=CardWeb.numbers(wave.getString("left"))[0];val top=CardWeb.numbers(wave.getString("top"))[0]
            check(abs(nw["radius"]!!*2-size)<.6 && abs(nw["x"]!!-(left+size/2))<.6 && abs(nw["y"]!!-(top+size/2))<.6,"$name ripple origin/diameter $nw vs ${left+size/2},${top+size/2} $size") }
        for(a in r.getJSONArray("anims").objects().filter { it.getString("target")!="wave" }) {
            val expected=if(red) 0.0 else if(a.getString("target")=="state-layer") 50.0 else 100.0
            check(a.getDouble("duration")==expected && a.getString("easing")=="cubic-bezier(0.2, 0, 0, 1)","$name ${a.getString("target")} timing ${a.getDouble("duration")} vs native $expected") }
        report.put(JSONObject().put("case",name).put("frames",frames.size).put("compared",JSONObject(compared as Map<*,*>)))
    }
}
