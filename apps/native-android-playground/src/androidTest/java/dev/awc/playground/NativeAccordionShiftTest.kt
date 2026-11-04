package dev.awc.playground

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.objects
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Rendered reorder motion: real touch input on the grip, frame-by-frame on the
 * composition clock, for the 40 Chrome cases of accordion-web-shift.json (5 presets ×
 * cross/reverse/extend/up, normal and reduced motion). Every rendered sibling offset and
 * placeholder top must equal the native CSS-transition track at that frame; the tracks
 * must start the same transitions as the source (count, end values, durations including
 * reversal shortening) at the frame that renders the input, then snap clear on drop.
 */
class NativeAccordionShiftTest {
    @get:Rule val compose=createComposeRule()
    private val ids=listOf("a","b","c","d")
    private var preset by mutableStateOf("expressive");private var reduced by mutableStateOf(false)
    private var epoch by mutableIntStateOf(0)
    private val collector=AWCInspectionCollector()
    private var motion:AWCAccordionReorderInspection?=null
    private fun node(id:String)=collector.snapshot().nodes.singleOrNull { it.id==id }
    private fun translate(v:String)=if(v=="none" || v.isEmpty()) 0.0 else v.removePrefix("translateY(").removeSuffix("px)").toDouble()

    private fun content() { compose.setContent { CompositionLocalProvider(LocalDensity provides Density(2f,1f)) { AWCTheme(false) {
            AWCAccessibilityAppearanceScope(reducedMotion=reduced) { Box(Modifier.padding(40.dp).requiredWidth(400.dp)) {
                AWCInspectionScope(collector) { AWCAccordionReorderInspectionScope({ motion=it }) { key(epoch) {
                    AWCComponent("md-accordion",mapOf("reorderable" to true,"transition" to preset,"variant" to "filled")) { slot-> if(slot=="")
                        ids.forEach { id-> key(id) { AWCComponent("md-accordion-item",mapOf("headline" to id)) { if(it=="") Text("Body") } } }
                    }
                } } }
            } }
        } } } }

    @Test fun fortyChromeShiftCasesRenderTheNativeTransitionTracks() {
        val reference=AccordionWebFixtures.document("AccordionWebShift.json").getJSONArray("cases").objects()
        content()
        var checks=0;val failures=mutableListOf<String>();val report=JSONArray()
        fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
        fun near(a:Double?,b:Double,tol:Double,label:String)=check(a!=null && abs(a-b)<=tol,"$label: Android $a vs $b")
        var maxReversalDelta=0.0
        for(c in reference) {
            val label="${c.getString("preset")}${if(c.getBoolean("reduced")) "-reduced" else ""}/${c.getString("scenario")}"
            compose.mainClock.autoAdvance=true
            compose.runOnIdle { preset=c.getString("preset");reduced=c.getBoolean("reduced");motion=null;epoch++ }
            compose.waitForIdle()
            compose.mainClock.autoAdvance=false
            val from=c.getInt("from");val rects=c.getJSONArray("rects").objects()
            val root=node("component")!!.bounds
            val base=ids.indices.map { node("component.item-$it")!!.bounds }
            ids.indices.forEach { i-> near(base[i].y-root.y,rects[i].getDouble("y"),.51,"$label/${ids[i]} Web slot y");near(base[i].height,rects[i].getDouble("height"),.51,"$label/${ids[i]} Web slot height") }
            val grip=node("component.item-$from.drag-handle")!!.bounds
            val start=Offset(((grip.x+grip.width/2)*2).toFloat(),((grip.y+grip.height/2)*2).toFloat())
            compose.onRoot().performTouchInput { down(start) }
            compose.mainClock.advanceTimeByFrame()
            val m=motion!!
            check(m.isDragging && m.draggedIndex==from,"$label lifted")
            near(m.placeholderValueAt(0.0),rects[from].getDouble("y"),.26,"$label placeholder appears at the lifted slot")
            check(m.placeholderHistory()?.isEmpty()==true,"$label placeholder appears without a transition")
            // Moves at the fixture's times, rounded to frames (16 ms) from the first move.
            val moves=c.getJSONArray("moves").objects()
            val t0=moves[0].getDouble("t")
            val plan=moves.associate { ((it.getDouble("t")-t0)/16).roundToInt() to it.getDouble("dy") }
            val moveFrameTimes=mutableListOf<Double>()
            var previousFrame=m.frameMillis
            val samples=JSONArray()
            var lastOffsets=DoubleArray(4);var lastPlaceholder:Double?=null
            for(f in 0 until 30) {
                val dy=plan[f]
                if(dy!=null) compose.onRoot().performTouchInput { moveTo(start+Offset(0f,(dy*2).toFloat()),delayMillis=0) }
                compose.mainClock.advanceTimeByFrame()
                val now=m.frameMillis
                val ticking=now!=previousFrame;previousFrame=now
                if(dy!=null) { check(ticking,"$label frame $f applies the move on the frame clock");moveFrameTimes+=now }
                val at=if(ticking) now else Double.MAX_VALUE
                val sample=JSONObject().put("frame",f).put("time",now)
                for(i in ids.indices) {
                    if(i==from) continue
                    val actual=node("component.item-$i")!!.bounds.y-base[i].y
                    val expected=m.siblingValueAt(i,at)
                    near(actual,expected,.26,"$label/${ids[i]} frame $f rendered offset follows its track")
                    sample.put(ids[i],actual);lastOffsets[i]=actual
                }
                val ghost=node("component.drop-placeholder")?.bounds?.let { it.y-root.y }
                near(ghost,m.placeholderValueAt(at) ?: Double.NaN,.26,"$label frame $f rendered placeholder follows its track")
                sample.put("placeholder",ghost);lastPlaceholder=ghost
                samples.put(sample)
                if(c.getBoolean("reduced") || c.getString("preset")=="none") {
                    // Snap: only settled slot offsets are ever rendered.
                    for(i in ids.indices) if(i!=from) check(abs(lastOffsets[i]/72-Math.round(lastOffsets[i]/72))<.01,"$label/${ids[i]} frame $f snaps (${lastOffsets[i]})")
                    check(ghost!=null && abs(ghost/72-Math.round(ghost/72))<.01,"$label frame $f placeholder snaps ($ghost)")
                }
            }
            // Native tracks reproduce the source transitions (count, end values, durations).
            val web=c.getJSONArray("transitions").objects().filter { it.getDouble("startTime")>-100 }
            val shiftBase=m.shiftDuration;val glideBase=m.glideDuration
            for(target in ids+"placeholder") {
                if(target==ids.getOrNull(from)) continue
                val own=web.filter { (if(it.getString("target")=="drop-placeholder") "placeholder" else it.getString("target"))==target }.sortedBy { it.getDouble("startTime") }
                val history=(if(target=="placeholder") m.placeholderHistory().orEmpty() else m.siblingHistory(ids.indexOf(target))).filter { it.animated }
                check(history.size==own.size,"$label/$target rendered transition count ${history.size} vs source ${own.size}")
                for((index,pair) in history.zip(own).withIndex()) {
                    val (n,w)=pair
                    near(n.to,translate(w.getString("to")),.26,"$label/$target transition end value")
                    check(n.start in moveFrameTimes,"$label/$target transition starts at the frame that renders the input (${n.start} in $moveFrameTimes)")
                    if(index>0 && n.shortening<1) {
                        val previous=history[index-1]
                        val progress=AccordionWebFixtures.cubic((n.start-previous.start)/previous.duration,previous.curve)
                        near(n.shortening,progress*previous.shortening+1-previous.shortening,1e-9,"$label/$target reversal factor from the previous output progress")
                        near(n.duration,(if(target=="placeholder") glideBase else shiftBase)*n.shortening,1e-6,"$label/$target shortened duration")
                        near(n.duration,w.getDouble("duration"),25.0,"$label/$target shortened duration close to source")
                        maxReversalDelta=maxOf(maxReversalDelta,abs(n.duration-w.getDouble("duration")))
                    } else near(n.duration,w.getDouble("duration"),.01,"$label/$target duration")
                    check(w.getString("easing")=="cubic-bezier(${n.curve.joinToString(", ") { if(it==Math.floor(it)) it.toLong().toString() else it.toString() }})","$label/$target easing")
                }
                // Settles to the source end value.
                val last=c.getJSONArray("samples").objects().last()
                val expected=if(target=="placeholder") last.optDouble("placeholder",Double.NaN) else last.getJSONObject("items").getDouble(target)
                near(if(target=="placeholder") lastPlaceholder else lastOffsets[ids.indexOf(target)],expected,.26,"$label/$target settles to the source end value")
            }
            if(c.getBoolean("reduced") || c.getString("preset")=="none") check(shiftBase==0.0 && glideBase==0.0,"$label native timing snaps")
            report.put(JSONObject().put("case",label).put("frames",samples.length()).put("moveFrames",JSONArray(moveFrameTimes))
                .put("siblings",JSONObject().apply { ids.indices.filter { it!=from }.forEach { i-> put(ids[i],JSONArray(m.siblingHistory(i).map { JSONObject().put("from",it.from).put("to",it.to).put("start",it.start).put("duration",it.duration).put("shortening",it.shortening) })) } })
                .put("placeholder",JSONArray(m.placeholderHistory().orEmpty().map { JSONObject().put("from",it.from).put("to",it.to).put("start",it.start).put("duration",it.duration).put("shortening",it.shortening) }))
                .put("samples",samples))
            // Drop clears every transform in the same tick.
            compose.onRoot().performTouchInput { up() }
            compose.mainClock.advanceTimeByFrame()
            check(!m.isDragging,"$label dropped")
            check(ids.indices.none { m.hasSiblingTrack(it) } && m.placeholderHistory()==null,"$label drop clears reorder motion")
            check(node("component.drop-placeholder")==null,"$label drop removes placeholder")
            val order=ids.indices.map { node("component.item-$it")!!.bounds }
            for(i in ids.indices) {
                near(order[i].x,base[i].x,.26,"$label item-$i no horizontal drift")
                near(order[i].y,base[i].y,.26,"$label display slot $i snaps to its slot on drop")
            }
        }
        AccordionEvidence.log("shift",JSONObject().put("cases",reference.size).put("checks",checks).put("failures",failures.size).put("maxReversalDurationDelta",maxReversalDelta).put("report",report))
        assertEquals(40,reference.size)
        assertTrue("${failures.size} of $checks failed:\n"+failures.take(80).joinToString("\n"),failures.isEmpty())
    }

    /** Drop and cancellation clear the transforms in the same tick: a running shift/glide snaps. */
    @Test fun dropAndCancelDuringRunningTransitionsSnapInTheNextFrame() {
        content()
        val results=JSONArray()
        for(cancel in listOf(false,true)) {
            compose.mainClock.autoAdvance=true
            compose.runOnIdle { preset="expressive";reduced=false;motion=null;epoch++ }
            compose.waitForIdle()
            compose.mainClock.autoAdvance=false
            val root=node("component")!!.bounds
            val base=ids.indices.map { node("component.item-$it")!!.bounds }
            val grip=node("component.item-0.drag-handle")!!.bounds
            val start=Offset(((grip.x+grip.width/2)*2).toFloat(),((grip.y+grip.height/2)*2).toFloat())
            compose.onRoot().performTouchInput { down(start) };compose.mainClock.advanceTimeByFrame()
            compose.onRoot().performTouchInput { moveTo(start+Offset(0f,77f*2),delayMillis=0) }
            repeat(3) { compose.mainClock.advanceTimeByFrame() }
            val m=motion!!
            val mid=node("component.item-1")!!.bounds.y-base[1].y
            val ghost=node("component.drop-placeholder")!!.bounds.y-root.y
            assertTrue("shift is mid-transition ($mid)",mid<-1 && mid>-71)
            assertTrue("glide is mid-transition ($ghost)",ghost>1 && ghost<71)
            assertTrue(m.isDragging)
            compose.onRoot().performTouchInput { if(cancel) cancel() else up() }
            compose.mainClock.advanceTimeByFrame()
            assertFalse(m.isDragging)
            assertTrue("tracks cleared",ids.indices.none { m.hasSiblingTrack(it) } && m.placeholderHistory()==null)
            assertNull("placeholder removed",node("component.drop-placeholder"))
            // Dropped: b moves to slot 0 and a to slot 1 in the same frame; cancelled: every item is back in its slot.
            val after=ids.indices.map { node("component.item-$it")!!.bounds.y }
            for(i in ids.indices) assertEquals("${if(cancel) "cancel" else "drop"} slot $i snaps",base[i].y,after[i],.26)
            results.put(JSONObject().put("cancel",cancel).put("midShift",mid).put("midPlaceholder",ghost).put("after",JSONArray(after.mapIndexed { i,y-> y-base[i].y })))
        }
        AccordionEvidence.log("shift-snap",JSONObject().put("cases",results))
    }
}
