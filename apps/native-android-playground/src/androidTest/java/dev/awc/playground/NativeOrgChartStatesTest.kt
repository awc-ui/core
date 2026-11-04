@file:OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
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
import kotlin.math.roundToInt

/**
 * md-organization-chart interaction, motion and lifecycle against Chrome 153 (web-oracle states.json 16 runs and
 * states-reduced-motion.json 4 runs, shared fixture OrgChartWebStates.json = Swift Tests/Fixtures/orgchart-web-states.json):
 * pointer fold/unfold per orientation and direction, the WAI-ARIA tree keyboard model in LTR and RTL, pointer selection,
 * selection-mode none, an unselectable parent, a card press, collapsible="false", folding with focus inside and
 * controlled updates, driven by mouse and key input on the frame clock. Per phase: the settled state of every visible tree
 * item (tab stop, expanded, selected, trail, border colour and width, box-shadow, focus ring, state layer, z-index) and the
 * focused element; per frame: the layer, border and shadow transitions and the unfold keyframes inside Chrome's samples one
 * Chrome frame either side; the component events (order, phase, payload). Time is Chrome's: inputs go in at the oracle's
 * send times (a press at the frame Chrome's samples show it took effect), the chart composes them at the next frame.
 */
/** The test clock steps 16 ms; Chrome's frames are 16.667 ms apart: the chart and this test run on Chrome's frame grid. */
private const val SCALE=50.0/3/16

class NativeOrgChartStatesTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf<JSONObject?>(null)
    private var props by mutableStateOf<Map<String,Any?>>(emptyMap())
    private var epoch by mutableIntStateOf(0)
    @Volatile private var probe:OrgChartProbe?=null
    /** The frame clock's last frame time (a recorder runs while a run steps the clock by hand). */
    private var recording by mutableStateOf(false)
    @Volatile private var lastFrame=Double.NaN
    private val events=mutableListOf<Triple<String,Map<*,*>,Int>>()
    private var phase=-1
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private val hx=24.0;private val hy=56.0

    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) {
        LaunchedEffect(recording) { if(recording) while(true) withFrameMillis { lastFrame=it.toDouble()*SCALE } }
        val r=run ?: return@CompositionLocalProvider
        AWCTheme(r.optString("theme")=="dark") { AWCTooltipScope { AWCOrgChartReducedMotionScope(r.getString("set")=="reduced") { AWCOrgChartInspectionScope({ probe=it },frameScale=SCALE) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
                Box(Modifier.absoluteOffset(24.dp,8.dp)) { AWCComponent("md-button",mapOf("variant" to "text"),content={ if(it=="") AWCSlotText("before") }) }
                Box(Modifier.absoluteOffset(hx.dp,hy.dp).width(920.dp)) {
                    CompositionLocalProvider(LocalLayoutDirection provides if(r.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                        AWCComponent("md-organization-chart",props,onEvent={ n,d-> events+=Triple(n,(d as? Map<*,*>) ?: emptyMap<String,Any?>(),phase) })
                    }
                }
                Box(Modifier.absoluteOffset(24.dp,840.dp)) { AWCComponent("md-button",mapOf("variant" to "text"),content={ if(it=="") AWCSlotText("after") }) }
            } }
        } } } }
    } } }

    private fun focusedText(t:String)=runCatching { compose.onAllNodes(hasText(t)).fetchSemanticsNodes().any { n-> generateSequence(n) { it.parent }.any { it.config.getOrNull(SemanticsProperties.Focused)==true } } }.getOrDefault(false)
    private fun active(s:OrgChartSnapshot?)=s?.active ?: if(focusedText("before")) "before" else if(focusedText("after")) "after" else null
    private fun nums(a:JSONArray?)=a?.let { List(it.length()) { i-> it.getDouble(i) } } ?: emptyList()
    private fun close(a:List<Double>,b:List<Double>,tol:Double)=a.size==b.size && a.zip(b).all { abs(it.first-it.second)<=tol }
    private fun shadowClose(a:List<Double>,b:List<Double>)=a.size==b.size && a.indices.all { abs(a[it]-b[it])<=(if(it%8<4) .15 else .02) }

    @Test fun organizationChartMatchesChromeInteractionStates() {
        content()
        val oracle=CardWeb.document("OrgChartWebStates.json")
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcCase")
        for(r in oracle.getJSONArray("runs").objects()) if(only==null || "${r.getString("set")}/${r.getString("name")}".contains(only)) runOne(r)
        AccordionEvidence.log("orgchart-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(300))).put("report",report))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }

    /** Chrome's own timing, read from its samples: the frame (ms after the phase start) at which the given card's state layer
     *  takes its new value — the first changed sample, or with motion the frame before it, where its transition starts at
     *  progress 0. Null when it does not change. Chrome applies `:active` a frame after the move when the move restyles the card's layer, otherwise two frames
     *  after the send (trusted CDP input: page.mouse.move, then page.mouse.down) — the press is injected at that frame. */
    private fun layerStart(ph:JSONObject,id:String,reduced:Boolean):Double? {
        val s=ph.getJSONArray("samples").objects();val t=ph.getDouble("t")
        val v=s.map { x-> x.getJSONArray("nodes").objects().firstOrNull { it.getString("id")==id }?.getDouble("layer") }
        val v0=v.firstOrNull() ?: return null
        val k=v.indexOfFirst { it!=null && abs(it-v0)>1e-6 }; if(k<1) return null
        return s[k].getDouble("t")-t-(if(reduced) 0.0 else 16.67)
    }

    private fun runOne(r:JSONObject) {
        val name="${r.getString("set")}/${r.getString("name")}";val reduced=r.getString("set")=="reduced"
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(Offset(1060f,1180f)) }
        val p=HashMap<String,Any?>(); p["label"]="Project team"; p["nodes"]=r.getJSONArray("nodes")
        r.getJSONObject("props").let { o-> o.keys().forEach { k-> p[k]=o.get(k) } }
        compose.runOnIdle { run=r;props=p;epoch++ }
        compose.waitForIdle();compose.mainClock.advanceTimeBy(400);compose.waitForIdle()
        events.clear();phase=-1
        compose.mainClock.autoAdvance=false
        compose.runOnIdle { recording=true }
        fun frame() { compose.mainClock.advanceTimeByFrame() }
        frame();frame()
        fun snap()=probe?.snapshot?.invoke()
        fun rects(id:String)=snap()?.nodes?.firstOrNull { it.id==id }
        fun px(x:Double,y:Double)=Offset(x.toFloat(),y.toFloat())
        fun cardCentre(id:String)=rects(id)?.card?.let { px(hx+it.midX,hy+it.midY) }
        fun toggleCentre(id:String)=rects(id)?.toggle?.let { px(hx+it.midX,hy+it.midY) }
        // Frames run to the frame nearest a Chrome time.
        fun until(at:Double) { var g=0; while(lastFrame<at-8 && g++<400) frame() }
        // oc-states.html click(): oracleMouse('down') (move, then down), a frame, oracleMouse('up') — Chrome restyles the
        // hover a frame after the send, `:active` at the measured frame, and releases it at actEnd.
        fun click(q:Offset?,c0:Double,press:Double,end:Double) { if(q==null) { check(false,"$name target present");return }
            compose.onRoot().performMouseInput { moveTo(q,delayMillis=0) }
            until(c0+press-16.67);compose.onRoot().performMouseInput { press() }
            until(end-16.67);compose.onRoot().performMouseInput { release() } }
        fun key(k:Key,shift:Boolean=false) = compose.onRoot().performKeyInput { if(shift) withKeyDown(Key.ShiftLeft) { keyDown(k);keyUp(k) } else { keyDown(k);keyUp(k) } }
        val keys=mapOf("ArrowDown" to Key.DirectionDown,"ArrowUp" to Key.DirectionUp,"ArrowRight" to Key.DirectionRight,"ArrowLeft" to Key.DirectionLeft,"Home" to Key.MoveHome,"End" to Key.MoveEnd,"Enter" to Key.Enter,"Space" to Key.Spacebar)
        var motionChecks=0;var motionFails=0;var settledFails=0
        val phases=r.getJSONArray("phases").objects()
        for((i,ph) in phases.withIndex()) {
            val label=ph.getString("label");val tag="$name/$i:$label";phase=i
            // Chrome-aligned time: the phase starts at the last frame (Chrome's phase start is a frame time too); inputs go
            // in at Chrome's send times and this chart composes them at the next frame, where Chrome restyles them.
            val c0=lastFrame;val webT=ph.getDouble("t");val webEnd=ph.getDouble("actEnd");val act=webEnd-webT
            val target=Regex("^(?:click|toggle)-(.+)$").find(label)?.groupValues?.get(1)
            when {
                label.startsWith("key-")->key(keys[label.removePrefix("key-")]!!)
                label.startsWith("toggle-")->click(toggleCentre(target!!),c0,layerStart(ph,target,reduced) ?: 16.67,c0+act)
                label.startsWith("click-")->click(cardCentre(target!!),c0,layerStart(ph,target,reduced) ?: 16.67,c0+act)
                label=="hover-toggle"->toggleCentre("root")?.let { q-> compose.onRoot().performMouseInput { moveTo(q,delayMillis=0) } }
                label=="tab-in"->{ compose.onAllNodes(hasText("before")).onFirst().requestFocus();frame();key(Key.Tab) }
                label=="tab-out" || label=="tab-back"->key(Key.Tab)
                label=="shift-tab-back" || label=="shift-tab-out"->key(Key.Tab,true)
                label=="hover"->cardCentre("eng")?.let { q-> compose.onRoot().performMouseInput { moveTo(q,delayMillis=0) } }
                label=="down"->{ until(c0+(layerStart(ph,"eng",reduced) ?: 33.3)-16.67);compose.onRoot().performMouseInput { press() } }
                label=="up"->{ until(c0+(layerStart(ph,"eng",reduced) ?: 33.3)-16.67);compose.onRoot().performMouseInput { release() } }
                label=="leave"->compose.onRoot().performMouseInput { moveTo(Offset(1060f,1180f),delayMillis=0) }
                label=="nodes-fold-eng"->props=props+("nodes" to r.getJSONArray("foldedNodes"))
                label=="selected-ids-set"->props=props+("selectedIds" to listOf("support","design"))
                label=="collapsible-false"->props=props+("collapsible" to false)
                label=="collapsible-true"->props=props+("collapsible" to true)
                label=="orientation-horizontal"->props=props+("orientation" to "horizontal")
                label=="density-4"->props=props+("density" to -4.0)
                else->{ check(false,"$tag action known");continue }
            }
            val a1=c0+act
            val frames=mutableListOf<Pair<Double,OrgChartSnapshot>>()
            var guard=0
            while(lastFrame<c0+(ph.getDouble("end")-webT)-8 && guard++<400) { frame();if(lastFrame>=a1-8) probe?.at?.invoke(lastFrame)?.let { s-> frames+=(lastFrame-a1) to s } }
            if(frames.isEmpty()) probe?.at?.invoke(lastFrame)?.let { s-> frames+=(lastFrame-a1) to s }
            val all=ph.getJSONArray("samples").objects()
            val samples=all.filter { it.getDouble("t")>=webEnd-.5 }
            val last=all.lastOrNull();val mine=frames.lastOrNull()?.second
            if(last==null || mine==null) { check(false,"$tag samples");continue }
            val webIds=last.getJSONArray("nodes").objects().map { it.getString("id") };val myIds=mine.nodes.map { it.id }
            check(webIds==myIds,"$tag visible items $myIds vs $webIds")
            val wa=if(last.isNull("active")) null else last.getString("active")
            check(active(mine)==wa,"$tag focus ${active(mine)} vs $wa")
            for(w in last.getJSONArray("nodes").objects()) {
                val n=mine.nodes.firstOrNull { it.id==w.getString("id") } ?: continue
                val exp=if(w.isNull("exp")) null else w.getString("exp");val sel=if(w.isNull("sel")) null else w.getString("sel")
                val ok=n.tab==w.getInt("tab") && n.expanded?.toString()==exp && n.selected?.toString()==sel && n.onPath==w.getBoolean("onPath") && abs(n.borderWidth-w.getDouble("bw"))<.01
                    && n.focusRing==w.getBoolean("outline") && n.z==w.getInt("z") && abs(n.layer-w.getDouble("layer"))<=.005 && close(n.border.take(3),nums(w.getJSONArray("border")).take(3),.01)
                    && close(n.layerColor.take(3),nums(w.getJSONArray("layerBg")).take(3),.01) && shadowClose(n.shadow,nums(w.getJSONArray("shadow")))
                if(!ok) settledFails++
                check(ok,"$tag ${n.id} settled: tab ${n.tab} exp ${n.expanded} sel ${n.selected} path ${n.onPath} bw ${n.borderWidth} ring ${n.focusRing} z ${n.z} layer ${n.layer} border ${n.border.take(3).map { (it*255).roundToInt() }} shadow ${n.shadow.take(8)} vs $w")
            }
            // Group keyframes per Chrome sample, with the frame Chrome painted but did not sample: the source renders a
            // (re)started group after the sampling callback, so a group first sampled one frame into md-org-chart-grow
            // (opacity <= 0.05) was painted at its 0% keyframe in the frame before.
            val groupAt=HashMap<Int,MutableMap<String,DoubleArray>>()
            for((j,x) in all.withIndex()) for(g in x.getJSONArray("groups").objects()) groupAt.getOrPut(j) { HashMap() }[g.getString("id")]=doubleArrayOf(g.getDouble("opacity"),g.getDouble("scale"),g.getDouble("tx"),g.getDouble("ty"))
            val implicit=HashMap<Int,MutableMap<String,DoubleArray>>()
            for(j in 1 until all.size) for((id,g) in groupAt[j].orEmpty()) { val before=groupAt[j-1]?.get(id)
                if(g[0]<=.05 && (before==null || before[0]>g[0]+.01)) implicit.getOrPut(j-1) { HashMap() }[id]=doubleArrayOf(0.0,.96,if(abs(g[2])>.1) 8.0*Math.signum(g[2]) else 0.0,if(abs(g[3])>.1) 8.0*Math.signum(g[3]) else 0.0) }
            // Per frame: each native frame inside Chrome's samples one Chrome frame either side (the frame interval Chrome
            // itself recorded in this phase, timer jitter included), centred on the Chrome frame nearest the native one.
            val times=samples.map { it.getDouble("t") }
            val window=maxOf(16.7,times.zipWithNext { a,b-> b-a }.maxOrNull() ?: 16.7)+.05
            for((t,s) in frames) {
                val centre=times.minByOrNull { abs((it-webEnd)-t) }?.let { if(abs((it-webEnd)-t)<=8.4) it-webEnd else t } ?: t
                val idx=all.indices.filter { abs((all[it].getDouble("t")-webEnd)-centre)<=window }
                if(idx.isEmpty()) continue
                val win=idx.map { all[it] }
                fun within(m:Double,web:List<Double>,tol:Double)=m>=(web.minOrNull() ?: 0.0)-tol && m<=(web.maxOrNull() ?: 0.0)+tol
                for(n in s.nodes) {
                    val ws=win.mapNotNull { x-> x.getJSONArray("nodes").objects().firstOrNull { it.getString("id")==n.id } }; if(ws.isEmpty()) continue
                    var ok=within(n.layer,ws.map { it.getDouble("layer") },.006)
                    for(c in 0..2) ok=ok && within(n.border[c],ws.map { it.getJSONArray("border").getDouble(c) },.012)
                    for(k in listOf(3,7,11,15,23)) ok=ok && within(n.shadow[k],ws.map { it.getJSONArray("shadow").getDouble(k) },if(k%8==7) .012 else .1)
                    motionChecks++;if(!ok) { motionFails++;if(motionFails<=6) check(false,"$tag ${n.id} frame +${t.roundToInt()} ms: layer ${n.layer} border ${n.border.take(3).map { (it*255).roundToInt() }} shadow-a ${n.shadow[7]} outside Chrome ${ws.map { it.getDouble("layer") }} ${ws.map { nums(it.getJSONArray("border")).take(3).map { c-> (c*255).roundToInt() } }}") }
                }
                for(g in s.groups) {
                    val ws=idx.flatMap { j-> listOfNotNull(groupAt[j]?.get(g.id),implicit[j]?.get(g.id)) }; if(ws.isEmpty()) continue
                    val ok=within(g.opacity,ws.map { it[0] },.01) && within(g.scale,ws.map { it[1] },.001) && within(g.tx,ws.map { it[2] },.1) && within(g.ty,ws.map { it[3] },.1)
                    motionChecks++;if(!ok) { motionFails++;if(motionFails<=6) check(false,"$tag group ${g.id} frame +${t.roundToInt()} ms: opacity ${g.opacity} scale ${g.scale} t ${g.tx},${g.ty} outside Chrome ${ws.map { it[0] }} ${ws.map { it[3] }}") }
                }
            }
        }
        check(motionFails==0,"$name per-frame motion ${motionChecks-motionFails}/$motionChecks")
        val web=r.getJSONArray("events").objects().filter { it.getString("name") in setOf("mdNodeToggle","mdSelectionChange") }
        fun phaseOf(t:Double)=phases.indexOfLast { it.getDouble("t")<=t+.5 }.coerceAtLeast(0)
        val mine=events.filter { it.first in setOf("mdNodeToggle","mdSelectionChange") }
        check(mine.size==web.size,"$name events ${mine.map { it.first }} vs ${web.map { it.getString("name") }}")
        for((m,w) in mine.zip(web)) {
            val node=(m.second["node"] as? Map<*,*>)?.get("id")?.toString()
            val ids=(m.second["selectedIds"] as? List<*>)?.map { it.toString() }
            val wIds=if(w.isNull("selectedIds")) null else w.getJSONArray("selectedIds").let { a-> List(a.length()) { a.getString(it) } }
            check(m.first==w.getString("name") && m.third==phaseOf(w.getDouble("t")) && node==w.optString("node") && (w.isNull("expanded") || m.second["expanded"]==w.getBoolean("expanded")) && (wIds==null || ids==wIds),
                "$name event ${m.first} phase ${m.third} $node ${m.second["expanded"]} $ids vs ${w.getString("name")} phase ${phaseOf(w.getDouble("t"))} ${w.optString("node")} $wIds")
        }
        report.put(JSONObject().put("run",name).put("phases",phases.size).put("motionChecks",motionChecks).put("motionFails",motionFails).put("settledFails",settledFails).put("events",mine.size))
        compose.runOnIdle { recording=false }
        compose.mainClock.autoAdvance=true
    }
}
