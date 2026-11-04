package dev.awc.playground

import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import dev.awc.nativeui.*
import dev.awc.playground.AccordionWebFixtures.channels
import dev.awc.playground.AccordionWebFixtures.css
import dev.awc.playground.AccordionWebFixtures.objects
import dev.awc.playground.AccordionWebFixtures.over
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * Actual rendered disclosure frames against the 100 actual Chrome transition samples
 * (web-motion.json: five presets x filled/outlined x open/close x five fractions,
 * 4000/3000 ms duration overrides). Each Web transition was paused at a fraction of its
 * OWN duration, so geometry is compared at elapsed = fraction x disclosure duration and
 * colour at elapsed = fraction x the bounded 200 ms effects duration. The Android
 * trajectory is linearly interpolated between the two real frames bracketing that instant.
 */
class NativeAccordionMotionRenderTest {
    @get:Rule val compose=createComposeRule()
    private data class Frame(val elapsed:Double,val geometry:Map<String,Double>,val pixels:List<Double>?=null,val ink:Double?=null)

    @Test fun renderedOpenAndCloseFramesFollowAllHundredWebTransitionSamples() {
        val web=AccordionWebFixtures.document("AccordionWebMotion.json").getJSONArray("samples").objects()
        val host=AccordionFixtureHost(2f)
        compose.mainClock.autoAdvance=false
        compose.setContent { host.Content() }
        fun settle(ms:Long=64) { compose.mainClock.advanceTimeBy(ms);compose.waitForIdle() }
        val failures=mutableListOf<String>();var checks=0;var samples=0
        val summary=JSONArray()
        for(variant in listOf("filled","outlined")) for(preset in listOf("expressive","standard","fade","collapse","none")) {
            compose.runOnIdle {
                host.load(JSONObject().put("id","motion-$variant-$preset").put("parent",JSONObject().put("variant",variant).put("transition",preset))
                    .put("item",JSONObject().put("icon","favorite")),"dark")
                host.itemHooks=AWCAccordionItemAppearance(expandDuration=4000.0,collapseDuration=3000.0)
            }
            settle(600)
            for(phase in listOf("open","close")) {
                val duration=if(preset=="none") 0.0 else if(phase=="open") 4000.0 else 3000.0
                compose.runOnIdle { host.itemOverride=listOf(mapOf("expanded" to (phase=="open")),emptyMap()) }
                val frames=mutableListOf<Frame>();var started=false;var guard=0
                while(guard++<400) {
                    compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
                    val header=compose.onNode(hasText("Account settings") and SemanticsMatcher.keyIsDefined(AWCAccordionTransitionElapsed)).fetchSemanticsNode()
                    val elapsed=header.config[AWCAccordionTransitionElapsed]
                    if(elapsed>=0) started=true
                    fun b(part:String)=host.node(if(part.isEmpty()) "component.item-0" else "component.item-0.$part")?.bounds
                    val geometry=buildMap {
                        put("root.height",host.node("component")!!.bounds.height);put("host.height",b("")!!.height)
                        put("panel.height",b("panel")?.height ?: 0.0);put("content.height",b("content")?.height ?: 0.0)
                        b("trailing-icon")?.let { put("trailing.x",it.x-host.originX);put("trailing.y",it.y-host.originY);put("trailing.width",it.width);put("trailing.height",it.height) }
                        b("leading-icon")?.let { put("leading.x",it.x-host.originX);put("leading.y",it.y-host.originY);put("leading.width",it.width);put("leading.height",it.height) }
                    }
                    val effectsWindow=elapsed in 0.0..240.0 || !started
                    var pixel:List<Double>?=null;var ink:Double?=null
                    if(effectsWindow) {
                        val image=compose.onNodeWithTag("canvas").captureToImage().toPixelMap()
                        val hr=b("header")!!
                        pixel=image[((hr.x-host.originX+hr.width/2)*2).toInt(),((hr.y-host.originY+4)*2).toInt()].channels()
                    }
                    frames+=Frame(if(elapsed<0) (if(started) Double.POSITIVE_INFINITY else -1.0) else elapsed,geometry,pixel,ink)
                    if(started && elapsed<0 || !started && duration==0.0 && guard>3) break
                }
                val running=frames.filter { it.elapsed>=0 && it.elapsed.isFinite() }
                // Timing: a real transition starts at 0 and ends no earlier than its duration.
                checks++;if(duration>0 && (running.isEmpty() || running.first().elapsed!=0.0 || running.last().elapsed>=duration+.5 || running.last().elapsed<duration-17))
                    failures+="$variant/$preset/$phase running frames ${running.firstOrNull()?.elapsed}..${running.lastOrNull()?.elapsed} for $duration ms"
                checks++;if(duration==0.0 && running.isNotEmpty()) failures+="$variant/$preset/$phase instant preset produced ${running.size} running frames"
                val settled=frames.last()
                for(f in listOf(0.0,.25,.5,.75,1.0)) {
                    val sample=web.single { it.getString("variant")==variant && it.getString("transition")==preset && it.getString("phase")==phase && it.getDouble("fraction")==f }
                    samples++
                    val id="$variant/$preset/$phase@$f"
                    fun at(t:Double,select:(Frame)->Double?):Double? {
                        if(duration==0.0 || t>=duration) return select(settled)
                        val before=running.lastOrNull { it.elapsed<=t } ?: return null
                        val after=running.firstOrNull { it.elapsed>=t } ?: settled
                        val a=select(before) ?: return null;val bv=select(after) ?: return null
                        val span=(if(after.elapsed.isFinite()) after.elapsed else duration)-before.elapsed
                        return if(span<=0) a else a+(bv-a)*(t-before.elapsed)/span
                    }
                    val parts=sample.getJSONObject("parts")
                    fun webRect(part:String)=parts.optJSONObject(part)?.getJSONObject("rect")
                    val expected=buildMap {
                        put("root.height",sample.getJSONObject("root").getDouble("height"));put("host.height",sample.getJSONObject("host").getJSONObject("rect").getDouble("height"))
                        put("panel.height",webRect("panel")!!.getDouble("height"));put("content.height",webRect("content")!!.getDouble("height"))
                        webRect("trailing-icon")?.let { put("trailing.x",it.getDouble("x"));put("trailing.y",it.getDouble("y"));put("trailing.width",it.getDouble("width"));put("trailing.height",it.getDouble("height")) }
                        webRect("leading-icon")?.let { put("leading.x",it.getDouble("x"));put("leading.y",it.getDouble("y"));put("leading.width",it.getDouble("width"));put("leading.height",it.getDouble("height")) }
                    }
                    for((key,value) in expected) {
                        checks++
                        val actual=at(f*duration) { it.geometry[key] }
                        if(actual==null || abs(actual-value)>.6) failures+="$id $key Web=${"%.3f".format(value)} Android=${actual?.let { "%.3f".format(it) }}"
                    }
                    // Effects: header surface over the item surface, at fraction x 200 ms.
                    val effects=minOf(duration,200.0)
                    val page=host.surface.channels()
                    val hostColor=over(css(sample.getJSONObject("host").getJSONObject("style").getString("backgroundColor")),page)
                    val headerColor=over(css(parts.getJSONObject("header").getJSONObject("style").getString("backgroundColor")),hostColor)
                    checks++
                    val t=f*effects
                    val got=(0..2).map { c-> at(t) { it.pixels?.get(c) } }
                    if(got.any { it==null } || (0..2).any { abs(got[it]!!-headerColor[it])>.03 })
                        failures+="$id header pixel at ${t}ms Web=${headerColor.take(3).map { "%.3f".format(it) }} Android=${got.map { it?.let { v-> "%.3f".format(v) } }}"
                }
                summary.put(JSONObject().put("case","$variant/$preset/$phase").put("frames",frames.size).put("runningFrames",running.size)
                    .put("lastElapsed",running.lastOrNull()?.elapsed ?: -1.0))
                settle(200)
            }
        }
        AccordionEvidence.log("motion",JSONObject().put("samples",samples).put("checks",checks).put("failures",failures.size).put("cases",summary))
        assertEquals(100,samples)
        assertTrue("${failures.size} of $checks motion checks failed:\n"+failures.take(160).joinToString("\n"),failures.isEmpty())
    }

    @Test fun reducedMotionAndNoneSnapWithoutRunningFramesAndRemoveLeadingScale() {
        val host=AccordionFixtureHost(2f)
        compose.mainClock.autoAdvance=false
        compose.setContent { host.Content() }
        fun settle(ms:Long=64) { compose.mainClock.advanceTimeBy(ms);compose.waitForIdle() }
        for(preset in listOf("expressive","standard","fade","collapse","none")) {
            compose.runOnIdle {
                host.load(JSONObject().put("id","reduced-$preset").put("parent",JSONObject().put("transition",preset)).put("item",JSONObject().put("icon","favorite")),"light")
                host.reduced=true
            }
            settle(300)
            // Frame 1 applies the authored property; frame 2 is the first render of the new state.
            fun heights(target:Boolean):List<Double> {
                compose.runOnIdle { host.itemOverride=listOf(mapOf("expanded" to target),emptyMap()) }
                return (1..4).map {
                    compose.mainClock.advanceTimeByFrame();compose.waitForIdle()
                    val header=compose.onNode(hasText("Account settings") and SemanticsMatcher.keyIsDefined(AWCAccordionTransitionElapsed)).fetchSemanticsNode()
                    assertEquals("$preset reduced has no running transition",-1.0,header.config[AWCAccordionTransitionElapsed],0.0)
                    host.node("component.item-0.panel")?.bounds?.height ?: 0.0
                }
            }
            val opening=heights(true)
            assertTrue("$preset opens without intermediate heights: $opening",opening.all { abs(it)<.51 || abs(it-60)<.51 } && abs(opening.last()-60)<.51 && abs(opening[1]-60)<.51)
            assertEquals("$preset leading icon unscaled (24dp)",24.0,host.node("component.item-0.leading-icon")!!.bounds.width,.51)
            val closing=heights(false)
            assertTrue("$preset closes without intermediate heights: $closing",closing.all { abs(it)<.51 || abs(it-60)<.51 } && abs(closing[1])<.51 && abs(closing.last())<.51)
        }
        compose.runOnIdle { host.reduced=false;host.load(JSONObject().put("id","interrupt").put("parent",JSONObject().put("transition","expressive")).put("item",JSONObject()),"light") }
        settle(300)
        // An interrupted opening reverses from the current presented height: the per-frame
        // change around the reversal never exceeds the largest opening step (no jump), and
        // the panel then closes monotonically to zero.
        compose.runOnIdle { host.itemOverride=listOf(mapOf("expanded" to true),emptyMap()) }
        val heights=mutableListOf<Double>()
        fun frame() { compose.mainClock.advanceTimeByFrame();compose.waitForIdle();heights+=host.node("component.item-0.panel")?.bounds?.height ?: 0.0 }
        repeat(10) { frame() }
        val opening=heights.toList()
        compose.runOnIdle { host.itemOverride=listOf(mapOf("expanded" to false),emptyMap()) }
        repeat(40) { frame() }
        val maxStep=opening.zipWithNext { a,b-> abs(b-a) }.max()
        val reversal=heights.drop(opening.size-1).zipWithNext { a,b-> abs(b-a) }
        val mid=opening.last()
        assertTrue("opening had started ($opening)",mid>1 && mid<59)
        assertTrue("no jump at reversal: heights $heights steps $reversal vs opening max $maxStep",reversal.take(4).all { it<=maxStep+.51 })
        val closing=heights.drop(opening.size+2)
        assertTrue("closes monotonically: $closing",closing.zipWithNext { a,b-> b<=a+.01 }.all { it } && closing.last()<.51)
        AccordionEvidence.log("reduced-motion",JSONObject().put("presets",5).put("interruptHeights",org.json.JSONArray(heights)))
    }
}
