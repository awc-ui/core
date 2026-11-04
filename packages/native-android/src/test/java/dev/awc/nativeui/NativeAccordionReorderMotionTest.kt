package dev.awc.nativeui

import dev.awc.nativeui.generated.AWCGeneratedTokens
import org.junit.Assert.*
import org.junit.Test
import kotlin.math.abs
import kotlin.math.round

/**
 * Deterministic model replay of the reorder sibling-shift and drop-placeholder
 * transitions: Chrome's own style-change times (CSSTransition.startTime) drive the
 * native CSS-transition tracks, which must start the same transitions (duration
 * including reversal shortening ±0.01 ms, from-value, easing) and reproduce every
 * per-frame sample (±0.05 px). Oracle: NativeAccordionShiftOracle (generated from
 * accordion-web-shift.json, 5 presets × 4 scenarios, normal and reduced motion).
 */
class NativeAccordionReorderMotionTest {
    private val ids=listOf("a","b","c","d")
    private fun g(x:Double)=if(x==Math.floor(x) && abs(x)<1e15) x.toLong().toString() else x.toString()
    private fun easing(curve:List<Double>)="cubic-bezier(${curve.joinToString(", ") { g(it) }})"

    @Test fun fortyChromeCasesReplayThroughNativeTracks() {
        val cases=NativeAccordionShiftOracle.cases
        assertEquals(40,cases.size)
        var checks=0;val failures=mutableListOf<String>()
        fun check(ok:Boolean,label:String) { checks++;if(!ok) failures+=label }
        fun near(a:Double,b:Double,tol:Double,label:String)=check(abs(a-b)<=tol,"$label: native $a vs web $b")
        val combos=mutableSetOf<String>()
        for(c in cases) {
            val label="${c.preset}${if(c.reduced) "-reduced" else ""}/${c.scenario}"
            combos+=label
            val (shift,glide)=NativeAccordionReorderMotion.timing(c.preset,c.reduced,AWCGeneratedTokens.light)
            val transitions=c.transitions.filter { it.startTime>-100 }
            for(target in ids+"placeholder") {
                if(target==ids[c.from]) continue
                val own=transitions.filter { (if(it.target=="drop-placeholder") "placeholder" else it.target)==target }.sortedBy { it.startTime }
                val timing=if(target=="placeholder") glide else shift
                val initial=if(target=="placeholder") c.rectY[c.from] else 0.0
                val track=AWCCSSTransitionTrack();track.snap(initial)
                for(w in own) track.set(w.to,w.startTime,timing.duration,timing.curve)
                val started=track.history.filter { it.animated }
                check(started.size==own.size,"$label/$target starts ${started.size} transitions vs ${own.size}")
                for((n,w) in started.zip(own)) {
                    near(n.duration,w.duration,.01,"$label/$target duration (incl. reversal shortening)")
                    near(n.from,w.from,.01,"$label/$target retarget starts from the current value")
                    check(w.easing==easing(timing.curve),"$label/$target easing ${w.easing} vs ${easing(timing.curve)}")
                    check(n.start==w.startTime,"$label/$target start")
                }
                val values=c.samples.mapNotNull { if(target=="placeholder") it.placeholder else it.items[target] }
                if(own.isEmpty() && c.samples.isNotEmpty()) {
                    // No source transition: every sample is a settled slot value, never an intermediate one.
                    val distinct=values.map { round(it*100)/100 }.toSet()
                    check(distinct.size<=3,"$label/$target snaps without intermediate values $distinct")
                    check(distinct.all { abs(it/72-round(it/72))<1e-9 },"$label/$target only settled slot offsets $distinct")
                    check(timing.duration==0.0 || distinct.size<=1,"$label/$target native timing also snaps")
                } else for(s in c.samples) {
                    val v=(if(target=="placeholder") s.placeholder else s.items[target]) ?: continue
                    near(track.valueAt(s.timeline,initial),v,.05,"$label/$target CSS value at t=${s.timeline}")
                }
            }
            // Source timing rules: short3 + state easing for siblings, short4 + standard for the placeholder.
            val snap=c.reduced || c.preset=="none"
            check(shift.duration==(if(snap) 0.0 else 150.0) && glide.duration==(if(snap) 0.0 else 200.0),"$label durations")
            if(!snap) {
                check(shift.curve==(if(c.preset=="collapse") listOf(.4,0.0,.2,1.0) else listOf(.2,0.0,0.0,1.0)),"$label state easing")
                check(glide.curve==listOf(.2,0.0,0.0,1.0),"$label placeholder easing")
                check(c.transitions.any { it.startTime>-100 } ,"$label source starts transitions")
            } else check(transitions.isEmpty(),"$label source starts no transition")
        }
        assertEquals(40,combos.size)
        println("AWCAccordionShiftModel checks=$checks failures=${failures.size}")
        assertTrue("${failures.size} of $checks failed:\n"+failures.joinToString("\n"),failures.isEmpty())
        assertTrue(checks>1000)
    }

    @Test fun cssTransitionsLevelOneStartingRules() {
        val curve=listOf(.2,0.0,0.0,1.0)
        // Start: before-change != after-change with a duration starts a transition from the before-change value.
        val t=AWCCSSTransitionTrack()
        t.set(-72.0,0.0,150.0,curve)
        assertEquals(1,t.history.size);assertEquals(0.0,t.history[0].from,0.0);assertEquals(150.0,t.history[0].duration,0.0)
        // Same end value while running: nothing happens.
        t.set(-72.0,40.0,150.0,curve);assertEquals(1,t.history.size)
        // Return to the reversing-adjusted start: shortened by the output progress.
        val p=t.history[0].outputProgress(60.0);val current=t.history[0].value(60.0)
        t.set(0.0,60.0,150.0,curve)
        val reversal=t.history.last()
        assertEquals(current,reversal.from,1e-12);assertEquals(150.0*p,reversal.duration,1e-9);assertEquals(p,reversal.shortening,1e-12)
        assertEquals(-72.0,reversal.reversingAdjustedStart,0.0)
        // Reversing the reversal uses |progress * oldFactor + 1 - oldFactor|.
        val p2=reversal.outputProgress(80.0)
        t.set(-72.0,80.0,150.0,curve)
        assertEquals(abs(p2*p+1-p),t.history.last().shortening,1e-12)
        // A new target that is not the reversing-adjusted start retargets from the current value with the full duration.
        val cur=t.presented(90.0);t.set(-144.0,90.0,150.0,curve)
        assertEquals(cur,t.history.last().from,1e-12);assertEquals(150.0,t.history.last().duration,0.0);assertEquals(1.0,t.history.last().shortening,0.0)
        // Zero duration (none/reduced): an instant change, never a running transition.
        val z=AWCCSSTransitionTrack();z.set(72.0,0.0,0.0,curve)
        assertFalse(z.isRunning(0.0));assertEquals(72.0,z.presented(0.0),0.0);assertFalse(z.history.single().animated)
        // Completed transitions do not affect the next change.
        val c=AWCCSSTransitionTrack();c.set(10.0,0.0,100.0,curve);c.set(0.0,200.0,100.0,curve)
        assertEquals(100.0,c.history.last().duration,0.0);assertEquals(10.0,c.history.last().from,0.0)
        // Timing tokens: invalid values fall back to the source defaults.
        assertEquals(150.0,NativeAccordionReorderMotion.timing("standard",false,mapOf("--md-sys-motion-duration-short3" to "-3ms")).first.duration,0.0)
        assertEquals(1500.0,accordionCSSDuration("1.5s")!!,0.0);assertNull(accordionCSSDuration("10"));assertNull(accordionCSSCubicBezier("cubic-bezier(2,0,0,1)"))
        assertEquals(listOf(.4,0.0,.2,1.0),NativeAccordionReorderMotion.timing("collapse",false,emptyMap()).first.curve)
        assertEquals(0.0,NativeAccordionReorderMotion.timing("expressive",true,emptyMap()).second.duration,0.0)
    }

    @Test fun motionModelLiftsSnapsPlaceholderAndClearsOnDrop() {
        val m=NativeAccordionReorderMotion()
        val shift=NativeAccordionReorderMotion.Timing(150.0,listOf(.2,0.0,0.0,1.0));val glide=NativeAccordionReorderMotion.Timing(200.0,listOf(.2,0.0,0.0,1.0))
        m.update("a",ids,emptyMap(),0.0,shift,glide,0.0)
        assertEquals(0.0,m.placeholderTop(0.0)!!,0.0);assertTrue(m.placeholder!!.history.isEmpty())
        m.update("a",ids,mapOf("b" to -72.0),72.0,shift,glide,16.0)
        assertTrue(m.running(20.0));assertEquals(0.0,m.offset("b",16.0),0.0);assertTrue(m.offset("b",40.0)<0)
        assertFalse(m.siblings.containsKey("a"))
        assertTrue(m.differs("a",ids,mapOf("b" to -72.0,"c" to -72.0),144.0));assertFalse(m.differs("a",ids,mapOf("b" to -72.0),72.0))
        m.update(null,ids,emptyMap(),null,shift,glide,30.0)
        assertTrue(m.siblings.isEmpty());assertNull(m.placeholder)
    }
}
