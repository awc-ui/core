package dev.awc.playground

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
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
import kotlin.math.cbrt
import kotlin.math.max
import kotlin.math.pow

/**
 * md-transfer-list interaction states against Chrome 153 (web-oracle states.json + states-reduced-motion.json, slimmed to
 * TransferListWebStates.json; 10 runs): pointer (LTR/RTL), keyboard (Tab order through the page's button, both columns and the
 * movers, Space/Enter, Shift+Tab), search (typing, select-all of the visible rows, Escape and the clear button, a move with a
 * hidden checked row), single-step-only, disabled, programmatic (methods, controlled value/items, count template), stacked
 * (≤ 640) and reduced motion. The oracle's input timeline (trusted pointer and key events) is replayed at Chrome's times on the
 * test clock (a 16 ms test frame is a 16.667 ms Chrome frame); property sets and method calls go in at their phase start; a
 * press outside every focusable part blurs as the page body takes it. Per phase the settled sample must match (value, rows:
 * label/checked/background/ring, counts, select-all, queries, empty texts, movers, the focused part); every Chrome frame's row
 * backgrounds must match one Chrome frame either side (its own frame interval); events by order, phase and payload.
 */
@OptIn(ExperimentalTestApi::class)
class NativeTransferListStatesTest {
    @get:Rule val compose=createComposeRule()
    private var run by mutableStateOf<JSONObject?>(null)
    private var props by mutableStateOf<Map<String,Any?>>(emptyMap())
    private var epoch by mutableIntStateOf(0)
    @Volatile private var probe:TransferListProbe?=null
    private var page by mutableStateOf<String?>(null)
    private val bodyFocus=androidx.compose.ui.focus.FocusRequester()
    private var motionDebug=0
    /** The page body takes the press (Chrome: activeElement = body). */
    private fun pageBlur() { backwardTab=false;compose.runOnIdle { runCatching { bodyFocus.requestFocus() } } }
    @Volatile private var backwardTab=false
    private val controller=AWCTransferListController()
    private val events=mutableListOf<Triple<String,Any?,Double>>()
    private var start=0L
    private val exceptions=sortedSetOf<String>()
    private var checks=0;private val failures=mutableListOf<String>();private val report=JSONArray()
    private fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
    private fun chromeNow()=(compose.mainClock.currentTime-start)/SCALE
    companion object { const val SCALE=16.0/(50.0/3) }

    private fun attr(html:String,name:String):String? {
        val i=html.indexOf("<md-transfer-list");if(i<0) return null
        val tag=html.substring(i,html.indexOf('>',i).let { if(it<0) html.length else it })
        for(q in listOf("'","\"")) { val k=tag.indexOf(" $name=$q");if(k>=0) { val s=k+name.length+3;val e=tag.indexOf(q,s);if(e>=s) return tag.substring(s,e) } }
        return if(Regex(" $name( |$)").containsMatchIn(tag)) "" else null
    }
    private fun initialProps(r:JSONObject):Map<String,Any?> {
        val html=r.getString("html");val p=HashMap<String,Any?>()
        p["id"]="tl";attr(html,"items")?.let { p["items"]=it.replace("&#39;","'").replace("&quot;","\"") };p["value"]=listOf("e","f")
        if(attr(html,"disabled")!=null) p["disabled"]=true
        if(attr(html,"single-step-only")!=null) p["singleStepOnly"]=true
        return p
    }

    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(1f,1f)) {
        val r=run ?: return@CompositionLocalProvider
        AWCTheme(r.optString("theme")=="dark") { AWCTooltipScope { Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface)) { key(epoch) {
            val stacked=r.optJSONArray("viewport")!=null
            // The page's Run button (before the list in the Tab order) and the page end (Tab leaves the page: body).
            Box(Modifier.absoluteOffset(1000.dp,2200.dp).size(8.dp).onFocusChanged { if(it.isFocused) page="button" else if(page=="button") page=null }.focusable())
            Box(Modifier.absoluteOffset(24.dp,24.dp).wrapContentSize(androidx.compose.ui.AbsoluteAlignment.TopLeft,unbounded=true).width((if(stacked) 460 else 900).dp)) {
                CompositionLocalProvider(LocalLayoutDirection provides if(r.optString("dir")=="rtl") LayoutDirection.Rtl else LayoutDirection.Ltr) {
                    AWCTransferListViewportScope(if(stacked) 500.0 else 1200.0) { AWCTransferListReducedMotionScope(r.optBoolean("reduced")) { AWCTransferListInspectionScope({ probe=it }) { AWCTransferListControllerScope(controller,"tl") {
                        AWCComponent("md-transfer-list",props,onEvent={ n,d -> if(n=="mdChange" || n=="mdMove") events+=Triple(n,d,chromeNow()) })
                    } } } }
                }
            }
            // Chrome's document stop is forward only: a backward wrap from the page's first control goes straight to the last one.
            Box(Modifier.absoluteOffset(0.dp,1.dp).size(1.dp).onFocusChanged { if(it.isFocused) page="body" else if(page=="body") page=null }
                .focusRequester(bodyFocus).focusProperties { canFocus=!backwardTab }.focusable())
        } } } }
    } } }

    @org.junit.After fun restoreTouchMode() { androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(true) }

    @Test fun transferListMatchesChromeStates() {
        // Out of touch mode, as after a mouse press or a key (the injected events bypass ViewRootImpl's touch-mode stage).
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().setInTouchMode(false)
        content()
        val oracle=CardWeb.document("TransferListWebStates.json")
        val only=androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("awcRun")
        for(r in oracle.getJSONArray("runs").objects()) if(only==null || r.getString("name").contains(only)) run(r)
        AccordionEvidence.log("transferlist-states",JSONObject().put("checks",checks).put("failures",failures.size).put("failureList",JSONArray(failures.take(400))).put("report",report).put("proposedExceptions",JSONArray(exceptions.toList())))
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(60).joinToString("\n"),failures.isEmpty())
    }

    /** Chrome's colours (rgba(), color(srgb …), oklab(…)) as premultiplied sRGB. */
    private fun chromeColor(s:String):List<Double> {
        val n=CardWeb.numbers(s.substringAfter("("))
        val (r,g,b,a)=when {
            s.startsWith("oklab") -> { val (L,A,B)=Triple(n[0],n[1],n[2]);val alpha=n.getOrElse(3) { 1.0 }
                val l=(L+0.3963377774*A+0.2158037573*B).pow(3);val m=(L-0.1055613458*A-0.0638541728*B).pow(3);val q=(L-0.0894841775*A-1.2914855480*B).pow(3)
                fun gam(x:Double)=if(x<=0.0031308) 12.92*x else 1.055*x.pow(1/2.4)-0.055
                listOf(gam(4.0767416621*l-3.3077115913*m+0.2309699292*q),gam(-1.2684380046*l+2.6097574011*m-0.3413193965*q),gam(-0.0041960863*l-0.7034186147*m+1.7076147010*q),alpha) }
            s.startsWith("color(srgb") -> listOf(n[0],n[1],n[2],n.getOrElse(3) { 1.0 })
            else -> listOf(n[0]/255,n[1]/255,n[2]/255,n.getOrElse(3) { 1.0 })
        }
        return listOf(r*a,g*a,b*a,a)
    }
    private fun nativeColor(c:Color)=c.alpha.toDouble().let { a-> listOf(c.red*a,c.green*a,c.blue*a,a) }
    private fun sameColor(a:List<Double>,b:List<Double>)=a.indices.all { abs(a[it]-b[it])<=0.008 }
    private fun chromeFocus(path:JSONArray,sample:JSONObject):String {
        val parts=(0 until path.length()).map { path.getString(it) }
        val first=parts.first()
        if(first=="body") return "body"; if(first=="button") return "button"
        val last=parts.last()
        return when { last=="item" -> "item"; last=="list" -> "list"; last.startsWith("md-transfer-list__select-all") -> "select-all"
            parts.contains("search") -> "search"; last.startsWith("md-icon-button") -> "mover-"+(if(last.contains("--tonal")) "tonal" else "filled"); parts.size==1 -> "body"; else -> last }
    }
    private fun nativeFocus(s:TransferListSnapshot?):String { val f=s?.focus ?: return page ?: "body"
        return when { f.startsWith("item-") -> "item"; f.startsWith("list-") -> "list"; f.startsWith("select-all") -> "select-all"; f.startsWith("search") -> "search"
            f=="mover-all-right" || f=="mover-all-left" -> "mover-tonal"; f.startsWith("mover-") -> "mover-filled"; else -> f } }

    /** The focused part as the renderer names it (`item-s:<value>`, `mover-right`…), or the page's. */
    private fun nativeFocusPart():String? = compose.runOnIdle { probe?.snapshot?.invoke()?.focus ?: page }

    private fun run(r:JSONObject) {
        val name=(if(r.optBoolean("reduced")) "reduced/" else "")+r.getString("name")
        compose.mainClock.autoAdvance=true
        compose.onRoot().performMouseInput { moveTo(Offset(1060f,1180f)) }
        compose.runOnIdle { probe=null;page=null;events.clear();run=r;props=initialProps(r);epoch++ }
        compose.waitForIdle();compose.mainClock.advanceTimeBy(400);compose.waitForIdle()
        pageBlur();compose.waitForIdle();compose.mainClock.advanceTimeBy(100);compose.waitForIdle()
        compose.mainClock.autoAdvance=false
        start=compose.mainClock.currentTime
        val phases=r.getJSONArray("phases").objects();val inputs=r.getJSONArray("inputs").objects()
        val hostRect=probe?.parts?.invoke()?.let { m-> val ks=m.filterKeys { it.startsWith("column-") || it=="controls" }.values
            if(ks.isEmpty()) null else androidx.compose.ui.geometry.Rect(ks.minOf { it.left },ks.minOf { it.top },ks.maxOf { it.right },ks.maxOf { it.bottom }) }
        data class Act(val t:Double,val order:Int,val go:()->Unit)
        val acts=ArrayList<Act>();var held=false;var shift=false
        fun focusable(q:Offset):Boolean { val m=probe?.parts?.invoke() ?: return false
            return m.any { (k,v)-> v.contains(q) && (k.startsWith("item-") || k.startsWith("search-") || k=="controls" || k.startsWith("header-")) } }
        // A press on a disabled mover: the page takes it (movers in slot order: all-right, right, left, all-left; right, left when single-step-only).
        fun disabledMover(q:Offset):Boolean { val m=probe?.parts?.invoke() ?: return false;val sn=probe?.snapshot?.invoke() ?: return false
            val ids=if(sn.movers.size==2) listOf("right","left") else listOf("all-right","right","left","all-left")
            return ids.indices.any { i-> sn.movers.getOrNull(i)?.second==true && m["mover-"+ids[i]]?.contains(q)==true } }
        // Keys less than a frame apart (the oracle's nine Shift+Tabs in 15 ms) go in together, at the last one's time: Chrome's own
        // samples show the burst land within one frame, whatever the events' timestamps (CDP stamps them before dispatch).
        val due=DoubleArray(inputs.size) { inputs[it].getDouble("t") }
        var b0=0;while(b0<inputs.size) { var j=b0
            while(j+1<inputs.size && inputs[j].getString("type")=="keydown" && inputs[j+1].getString("type")=="keydown" && due[j+1]-due[j]<1000.0/60) j++
            if(j>b0) for(k in b0..j) due[k]=due[j]
            b0=j+1 }
        for((i,e) in inputs.withIndex()) { val q=Offset(e.optDouble("x",0.0).toFloat(),e.optDouble("y",0.0).toFloat())
            acts+=Act(due[i],i) { when(e.getString("type")) {
                "pointermove" -> compose.onRoot().performMouseInput { moveTo(if(q.x<1080 && q.y<2400) q else Offset(1060f,1180f),delayMillis=0) }
                "pointerdown" -> { if(hostRect==null || !hostRect.contains(q) || !focusable(q) || disabledMover(q)) pageBlur()
                    if(q.x<1080 && q.y<2400) { compose.onRoot().performMouseInput { moveTo(q,delayMillis=0);press() };held=true } }
                "pointerup" -> if(held) { compose.onRoot().performMouseInput { release() };held=false }
                "keydown" -> { val k=e.optString("key")
                    if(k=="Shift") shift=true else { val key=when(k) { "Tab" -> Key.Tab; " " -> Key.Spacebar; "Enter" -> Key.Enter; "Escape" -> Key.Escape; "ArrowDown" -> Key.DirectionDown
                        else -> if(k.length==1 && k[0] in 'a'..'z') listOf(Key.A,Key.B,Key.C,Key.D,Key.E,Key.F,Key.G,Key.H,Key.I,Key.J,Key.K,Key.L,Key.M,Key.N,Key.O,Key.P,Key.Q,Key.R,Key.S,Key.T,Key.U,Key.V,Key.W,Key.X,Key.Y,Key.Z)[k[0]-'a'] else null }
                        val arrowFrom=if(key==Key.DirectionDown) nativeFocusPart() else null
                        if(key!=null) { val s=shift;backwardTab=s && key==Key.Tab;compose.onRoot().performKeyInput { if(s) withKeyDown(Key.ShiftLeft) { keyDown(key);keyUp(key) } else { keyDown(key);keyUp(key) } } }
                        // TLX-A2 (proposed): an unhandled arrow key is Android's directional focus navigation; back to the row afterwards.
                        if(key==Key.DirectionDown) { val before=arrowFrom;val after=nativeFocusPart()
                            if(before!=null && after!=before) { exceptions+="TLX-A2 $name ArrowDown: focus $before -> $after (Android directional focus navigation)"
                                if(before.startsWith("item-")) compose.runOnIdle { probe?.focusRow?.invoke(before.startsWith("item-t:"),before.substring(7)) } } }
                        shift=false } }
            } } }
        for(ph in phases) { val t=ph.getDouble("t");val label=ph.getString("label")
            val set:(()->Unit)?=when(label) {
                "set-single-step-false" -> { { props=props+("singleStepOnly" to false) } }
                "enable" -> { { props=props+("disabled" to false) } }
                "set-value-controlled" -> { { props=props+("value" to listOf("b")) } }
                "set-items-controlled" -> { { props=props+("items" to listOf(mapOf("value" to "b","label" to "Billing"),mapOf("value" to "z","label" to "Zeta"))) } }
                "set-count-template" -> { { props=props+("countTemplate" to "{checked} of {total} ({checked})") } }
                "moveSelectedRight()" -> { { controller.moveSelectedRight() } }
                "moveSelectedLeft()-nothing-checked" -> { { controller.moveSelectedLeft() } }
                else -> null }
            if(set!=null) acts+=Act(t,-1) { compose.runOnIdle { set() } } }
        acts.sortWith(compareBy({ it.t },{ it.order }))
        // Step Chrome's frames: acts due before a frame go in, then the frame renders and is recorded.
        val end=phases.last().getJSONArray("samples").objects().last().getDouble("t")+40
        val frames=ArrayList<Pair<Double,TransferListSnapshot?>>();val pages=ArrayList<String?>();val trails=ArrayList<List<String>>()
        var ai=0;var g=0
        while(chromeNow()<end && g++<4000) {
            // The focused part after each input before this frame (a burst passes through several within one frame).
            val trail=ArrayList<String>()
            while(ai<acts.size && acts[ai].t<=chromeNow()+(if(acts[ai].order>=0) 1000.0/60-0.5 else 0.5)) { acts[ai].go();ai++;trail+=nativeFocus(compose.runOnIdle { probe?.snapshot?.invoke() }) }
            trails+=trail
            compose.mainClock.advanceTimeByFrame()
            frames+=chromeNow() to probe?.snapshot?.invoke();pages+=page
        }
        fun nativeAt(t:Double)=frames.indices.minByOrNull { abs(frames[it].first-t) }!!
        var settledFails=0;var motion=0;var motionFails=0
        for((pi,ph) in phases.withIndex()) {
            val samples=ph.getJSONArray("samples").objects();val tag="$name/$pi:${ph.getString("label")}"
            for((si,s) in samples.withIndex()) {
                val settled=si==samples.lastIndex
                val idx=nativeAt(s.getDouble("t"));val window=if(settled) listOf(idx) else listOf(idx-1,idx,idx+1).filter { it in frames.indices }
                // What one native frame differs in, by group. A settled sample must match in every group at its own frame. A motion
                // sample must match, group by group, a native frame within one frame either side: Chrome's sample is read in rAF,
                // before Stencil re-renders, so for one frame a property (value, the query, a check) is already new while the rows
                // are still the old ones; native state and rows change in the same frame. The focused part may also be one the
                // replay passes through between those frames (a key burst).
                fun groups(n:Int):List<Pair<String,List<String>>> { val snap=frames[n].second ?: return listOf("snapshot" to listOf("no snapshot"));val out=ArrayList<Pair<String,List<String>>>()
                    val value=s.getJSONArray("value").let { a-> (0 until a.length()).map { a.getString(it) } }
                    out+="value" to (if(value!=snap.value) listOf("value $value vs ${snap.value}") else emptyList())
                    for((sideName,side) in listOf("source" to snap.source,"target" to snap.target)) { val w=s.getJSONObject(sideName);val rows=w.getJSONArray("rows")
                        val ident=ArrayList<String>();val bg=ArrayList<String>();val ring=ArrayList<String>()
                        if(rows.length()!=side.rows.size) { val m="$sideName rows ${rows.length()} vs ${side.rows.size}";ident+=m;bg+=m;ring+=m }
                        else for(i in 0 until rows.length()) { val row=rows.getJSONArray(i);val nr=side.rows[i]
                            if(row.getString(0)!=nr.label || (row.getString(1)=="true")!=nr.checked) ident+="$sideName row $i ${row.getString(0)} ${row.getString(1)} vs ${nr.label} ${nr.checked}"
                            if(!sameColor(chromeColor(row.getString(2)),nativeColor(nr.background))) bg+="$sideName row $i background ${row.getString(2)} vs ${nativeColor(nr.background).map { "%.3f".format(it) }}"
                            if(!row.isNull(3)!=nr.ring) ring+="$sideName row $i ring ${!row.isNull(3)} vs ${nr.ring}" }
                        out+="$sideName.rows" to ident;out+="$sideName.background" to bg;out+="$sideName.ring" to ring
                        out+="$sideName.count" to (if(w.getString("count")!=side.count) listOf("$sideName count '${w.getString("count")}' vs '${side.count}'") else emptyList())
                        val sa=w.optJSONArray("selectAll")?.let { a-> (0 until a.length()).map { a.getBoolean(it) } }
                        out+="$sideName.select-all" to (if(sa!=side.selectAll) listOf("$sideName select-all $sa vs ${side.selectAll}") else emptyList())
                        val query=if(w.isNull("query")) null else w.getString("query")
                        out+="$sideName.query" to (if(query!=side.query) listOf("$sideName query '$query' vs '${side.query}'") else emptyList())
                        val empty=if(w.isNull("empty")) null else w.getString("empty").trim()
                        out+="$sideName.empty" to (if(empty!=side.empty) listOf("$sideName empty '$empty' vs '${side.empty}'") else emptyList()) }
                    val ma=s.getJSONArray("movers");val movers=(0 until ma.length()).map { val m=ma.getJSONArray(it);m.getString(0) to m.getBoolean(1) }
                    out+="movers" to (if(movers!=snap.movers) listOf("movers $movers vs ${snap.movers}") else emptyList())
                    val cf=chromeFocus(s.getJSONArray("focus"),s);val saved=page;page=pages[n];val nf=nativeFocus(snap);page=saved
                    out+="focus" to (if(cf!=nf) listOf("focus $cf vs $nf") else emptyList())
                    return out }
                fun ok(n:Int):List<String> = groups(n).flatMap { it.second }
                fun motionBad():List<String> { val domWindow=listOf(idx-2).filter { it in frames.indices }+window
                    val all=window.map { groups(it) };val allDom=domWindow.map { groups(it) };val mine=groups(idx)
                    if(allDom.any { it.first().first=="snapshot" }) return listOf("no snapshot")
                    fun backgroundsWithin(sideName:String):Boolean { val rows=s.getJSONObject(sideName).getJSONArray("rows")
                        for(i in 0 until rows.length()) { val row=rows.getJSONArray(i);val web=chromeColor(row.getString(2))
                            val natives=domWindow.mapNotNull { n-> frames[n].second?.let { sn-> (if(sideName=="target") sn.target else sn.source).rows.firstOrNull { it.label==row.getString(0) }?.let { nativeColor(it.background) } } }
                            if(natives.isEmpty()) return false
                            // A row that has left the native list by this frame (Chrome's sampled DOM still holds it one frame).
                            if(frames[idx].second?.let { sn-> (if(sideName=="target") sn.target else sn.source).rows.none { it.label==row.getString(0) } }==true) continue
                            for(c in 0..3) if(web[c]<natives.minOf { it[c] }-0.008 || web[c]>natives.maxOf { it[c] }+0.008) return false }
                        return true }
                    val cf=chromeFocus(s.getJSONArray("focus"),s);val out=ArrayList<String>()
                    for((g,group) in mine.withIndex()) { if(group.second.isEmpty()) continue
                        val name=group.first;val dom=name=="movers" || listOf(".rows",".count",".select-all",".empty",".ring").any { name.endsWith(it) }
                        if((if(dom) allDom else all).any { it[g].second.isEmpty() }) continue
                        if(name.endsWith(".background") && backgroundsWithin(name.removeSuffix(".background"))) continue
                        if(group.first=="focus" && (window+listOf(window.last()+1)).any { it in trails.indices && cf in trails[it] }) continue
                        out+=group.second }
                    // The native values around a background mismatch (alpha and check of the row, two frames either side).
                    if(out.isNotEmpty() && motionDebug<6) Regex("(source|target) row (\\d+) background").find(out.joinToString(";"))?.let { m-> motionDebug++
                        val target=m.groupValues[1]=="target";val r=m.groupValues[2].toInt()
                        out+="DBG frames "+(idx-2..idx+2).filter { it in frames.indices }.joinToString(" ") { k-> val row=frames[k].second?.let { sn-> (if(target) sn.target else sn.source).rows.getOrNull(r) }
                            "%.1f=".format(frames[k].first)+(row?.let { "%.3f%s".format(it.background.alpha,if(it.checked) "c" else "u") } ?: "-") } }
                    return out }
                if(settled) { val bad=ok(idx);check(bad.isEmpty(),"$tag settled: ${bad.joinToString("; ").take(400)}");if(bad.isNotEmpty()) settledFails++
                    if(bad.any { it.startsWith("focus") }) { val t0=ph.getDouble("t");val t1=phases.getOrNull(pi+1)?.getDouble("t") ?: (t0+700)
                        val seq=frames.indices.filter { frames[it].first>=t0-1 && frames[it].first<t1 }.map { frames[it].second?.focus ?: pages[it] ?: "body" }
                        failures+="  DBG $tag native focus ${seq.filterIndexed { i,v-> i==0 || seq[i-1]!=v }}" } }
                else { motion++;val best=motionBad()
                    if(best.isNotEmpty()) { motionFails++;if(motionFails<=12) failures+="$tag t=${"%.1f".format(s.getDouble("t"))}: ${best.joinToString("; ").take(300)}" } }
            }
        }
        checks+=1;if(motionFails>0) failures+="$name motion $motionFails/$motion frames differ"
        // Events: order, payload, phase.
        val web=r.getJSONArray("events").objects()
        fun phaseOf(t:Double)=phases.indexOfLast { it.getDouble("t")<=t+0.5 }
        check(web.map { it.getString("name") }==events.map { it.first },"$name events ${web.map { it.getString("name") }} vs ${events.map { it.first }}")
        for((i,e) in web.withIndex()) events.getOrNull(i)?.let { n-> if(abs(e.getDouble("t")-n.third)>8) failures+="  DBG $name event $i ${e.getString("name")} chrome ${"%.1f".format(e.getDouble("t"))} native ${"%.1f".format(n.third)}" }
        for((i,e) in web.withIndex()) { val n=events.getOrNull(i) ?: break
            val detail=e.get("detail").toString().replace(" ","");val mine=JSONObject.wrap(n.second).toString().replace(" ","")
            check(detail==mine && phaseOf(e.getDouble("t"))==phaseOf(n.third),"$name event $i ${e.getString("name")} $detail @${phaseOf(e.getDouble("t"))} vs $mine @${phaseOf(n.third)}") }
        report.put(JSONObject().put("run",name).put("phases",phases.size).put("settledFails",settledFails).put("motion",motion).put("motionFails",motionFails).put("events","${events.size}/${web.size}"))
        compose.mainClock.autoAdvance=true
    }
}
