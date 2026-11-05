package dev.awc.nativeui

import org.junit.Assert.*
import org.junit.Test

class NativeProgressContractTest {
    private fun metrics(p:Props=emptyMap(),a:AWCProgressIndicatorAppearance=AWCProgressIndicatorAppearance(),d:Double=0.0)=ProgressMetrics.from(p,a,d)
    @Test fun sourceNumericAndDensityRulesKeepVisualAndAccessibleRangesDistinct() {
        for(d in 0 downTo -4) {
            val m=metrics(mapOf("density" to d))
            assertEquals(4+d*.5,m.thickness,.0)
            assertEquals(40+3*d.toDouble(),m.size,.0)
            assertEquals(48+3*d.toDouble(),metrics(mapOf("density" to d,"wave" to true)).size,.0)
        }
        assertEquals(35.5,metrics(d=-1.5).size,.0)
        assertEquals(37.0,metrics(mapOf("density" to -1),d=-4.0).size,.0)
        assertEquals(80.0,metrics(mapOf("size" to 80),d=-4.0).size,.0)
        assertEquals(24.0,metrics(mapOf("size" to 1)).size,.0)
        assertEquals(240.0,metrics(mapOf("size" to Double.MAX_VALUE)).size,.0)
        val negative=metrics(mapOf("max" to -100,"value" to -37))
        assertEquals(.37,negative.fraction,.0);assertEquals(0.0,negative.maximum,.0);assertEquals(0.0,negative.value,.0)
        assertEquals(0.0,metrics(mapOf("max" to 0,"value" to 99)).fraction,.0)
        assertEquals(0.0,metrics(mapOf("thickness" to 0)).height,.0)
        assertEquals(0.0,metrics(mapOf("thickness" to 0)).stroke,.0)
        val negativeStroke=metrics(mapOf("variant" to "circular","thickness" to -2))
        assertEquals(1.0,negativeStroke.stroke,.0);assertEquals(21.0,negativeStroke.radius,.0)
        val negativeWave=metrics(mapOf("wave" to true,"thickness" to -2))
        assertEquals(4.0,negativeWave.height,.0);assertEquals(4.0,negativeWave.linearThickness,.0)
    }
    @Test fun appearanceCascadesAll13HooksWithoutLosingSignedSpacingOrZero() {
        val a=AWCProgressIndicatorAppearance("#12345680",AWCCornerShape.uniform(points=2.0),"#ABCDEF",AWCCornerShape.uniform(fraction=.25),
            "#884422",AWCCornerShape.uniform(points=0.0),2.0,-7.0,-9.0,"#111111","#222222","#333333","#444444")
        assertEquals(13,a.values.size)
        val merged=a.merged(AWCProgressIndicatorAppearance(stopIndicatorSize=0.0,activeIndicatorColor="#abcdef80"))
        assertEquals(0.0,merged.stopIndicatorSize);assertEquals(-9.0,merged.trackActiveIndicatorSpace)
        assertEquals("#ABCDEF80",merged.activeIndicatorColor);assertEquals(a.trackShape,merged.trackShape)
        assertEquals(AWCProgressIndicatorAppearance(),AWCProgressIndicatorAppearance.fromValues(mapOf("stopIndicatorSize" to -2.0,"trackActiveIndicatorSpace" to Double.NaN)))
    }
    @Test fun initiallyCompleteIsInertAndCompletionEmitsOnceWithoutFalseReset() {
        for(circular in listOf(false,true)) for(wave in listOf(false,true)) {
            val initial=metrics(mapOf("variant" to if(circular) "circular" else "linear","wave" to wave,"value" to 37,"complete" to true))
            val motion=ProgressMotion(initial,false)
            motion.configure(initial,false);motion.step(0.0);motion.step(100.0)
            assertFalse(motion.completing);assertFalse(motion.takeCompletion())
            motion.configure(initial.copy(complete=false),false);motion.configure(initial,true)
            if(!circular && !wave) {
                assertEquals(ProgressMotion.Stage.COLLAPSE,motion.stage)
                motion.step(100.0);motion.step(400.0)
            }
            assertTrue(motion.takeCompletion());assertFalse(motion.takeCompletion())
            assertEquals(circular && !wave,motion.completedTrack)
            assertEquals(!circular || wave,motion.completedHidden)
            motion.configure(initial.copy(complete=false),false);motion.configure(initial,false)
            assertEquals(ProgressMotion.Stage.FINISHED,motion.stage);assertFalse(motion.takeCompletion())
        }
    }
    @Test fun actualTimedPhasesRunFillFlattenEraseAndSettlePreferences() {
        for(circular in listOf(false,true)) for(wave in listOf(false,true)) {
            val initial=metrics(mapOf("variant" to if(circular) "circular" else "linear","wave" to wave,"value" to 37))
            val motion=ProgressMotion(initial,false);motion.step(0.0);motion.configure(initial.copy(complete=true),false)
            val stages=mutableSetOf<ProgressMotion.Stage>()
            for(time in 0..3000 step 16) { motion.step(time.toDouble());stages+=motion.stage }
            assertEquals(ProgressMotion.Stage.FINISHED,motion.stage);assertTrue(motion.takeCompletion())
            if(circular) assertTrue(stages.contains(ProgressMotion.Stage.CIRCLE_ERASE)) else assertTrue(stages.contains(ProgressMotion.Stage.COLLAPSE))
            if(wave) assertTrue(stages.contains(if(circular) ProgressMotion.Stage.CIRCLE_FLATTEN else ProgressMotion.Stage.WAVE_FLATTEN))
            val interrupted=ProgressMotion(initial,false);interrupted.configure(initial.copy(complete=true),false);interrupted.step(0.0)
            interrupted.configure(initial.copy(complete=true),true)
            assertTrue("Preference change settles the actual phase",interrupted.takeCompletion())
        }
    }
    @Test fun valueChangesEaseByVariantAndIndeterminateCompletionIsIgnored() {
        val initial=metrics(mapOf("value" to 0))
        val m=ProgressMotion(initial,false);m.step(0.0);m.configure(initial.copy(fraction=1.0),false);m.step(64.0)
        assertEquals(1-kotlin.math.exp(-64.0/80),m.fraction,1e-9)
        m.configure(initial.copy(fraction=.25),true);assertEquals(.25,m.fraction,.0)
        val indeterminate=initial.copy(indeterminate=true)
        val i=ProgressMotion(indeterminate,false);i.configure(indeterminate.copy(complete=true),false)
        assertFalse(i.completing);assertFalse(i.takeCompletion())
        assertTrue(i.needsFrames())
    }
    @Test fun hiddenResumePreservesWavePhaseWithoutLeapingTheChoreography() {
        val initial=metrics(mapOf("variant" to "circular","wave" to true,"indeterminate" to true))
        val motion=ProgressMotion(initial,false);motion.step(0.0);motion.step(64.0)
        val phase=motion.wavePhase
        motion.configure(initial.copy(hidden=true),false);assertFalse(motion.needsFrames());motion.pause()
        motion.configure(initial,false);motion.step(100_000.0)
        assertEquals(phase,motion.wavePhase,.0)
        assertEquals(.1,motion.waveSpin().sweep,.0);assertEquals(0.0,motion.waveSpin().rotation,.0)
        motion.step(100_016.0);assertTrue(motion.wavePhase>phase)
    }

}
