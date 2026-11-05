package dev.awc.nativeui

import kotlin.math.*

/** Mounted progress lifecycle. Frame timestamps come from Compose's real frame
 * clock; no property mutation recreates this state or fabricates completion. */
internal class ProgressMotion(initial:ProgressMetrics,initialReduced:Boolean) {
    enum class Stage { IDLE, LINEAR_FILL, WAVE_FILL, WAVE_FLATTEN, COLLAPSE, CIRCLE_FILL, CIRCLE_FLATTEN, CIRCLE_ERASE, TRACK_REVEAL, FINISHED }
    var metrics=initial;private set
    var reduced=initialReduced;private set
    var stage=Stage.IDLE;private set
    var fraction=initial.fraction;private set
    var amplitude=if(initialReduced || !initial.wave || !initial.indeterminate && initial.fraction<=0) 0.0 else 1.0;private set
    var wavePhase=0.0;private set
    var erase=0.0;private set
    var collapse=1.0;private set
    var trackOpacity=1.0;private set
    var elapsed=0.0;private set
    var completedHidden=false;private set
    var completedTrack=false;private set
    private var complete=initial.complete
    private var pending=false
    private var started=-1.0
    private var previous=-1.0
    private var stageStarted=-1.0
    private var from=initial.fraction
    private var amplitudeFrom=amplitude
    private var amplitudeTarget=amplitude
    private var amplitudeStarted=-1.0
    private var waveCycleStarted=0.0
    val completing:Boolean get()=stage!=Stage.IDLE && stage!=Stage.FINISHED
    fun takeCompletion():Boolean { val result=pending;pending=false;return result }
    private fun finish() {
        if(stage==Stage.FINISHED) return
        completedTrack=metrics.circular && !metrics.wave
        completedHidden=!completedTrack
        stage=Stage.FINISHED;pending=true;trackOpacity=if(completedTrack) 1.0 else 0.0
        collapse=if(completedHidden) 0.0 else 1.0
    }
    private fun enter(value:Stage,now:Double=-1.0) { stage=value;stageStarted=now }
    fun configure(next:ProgressMetrics,reduce:Boolean) {
        val previousMetrics=metrics;val previousReduced=reduced
        metrics=next;reduced=reduce
        if(previousMetrics.hidden && !next.hidden) { started=-1.0;elapsed=0.0;waveCycleStarted=-1.0 }
        // Match the reduced-preference watcher: active rAF phases settle
        // immediately; an already CSS-driven collapse keeps its 300ms timeline.
        if(reduce && !previousReduced && completing && stage!=Stage.COLLAPSE) {
            amplitude=0.0;finish()
        }
        if(!completing && stage!=Stage.FINISHED) {
            val target=if(!next.wave || reduce || !next.indeterminate && next.fraction<=0) 0.0 else 1.0
            if(target!=amplitudeTarget) { amplitudeFrom=amplitude;amplitudeTarget=target;amplitudeStarted=-1.0 }
            if(reduce) { amplitude=target;fraction=next.fraction }
        }
        if(next.indeterminate!=previousMetrics.indeterminate || next.circular!=previousMetrics.circular || next.wave!=previousMetrics.wave)
            waveCycleStarted=elapsed
        if(next.complete!=complete) {
            complete=next.complete
            if(complete && !next.indeterminate && !completing && stage!=Stage.FINISHED) {
                from=next.fraction
                if(next.circular) {
                    fraction=from;erase=0.0;trackOpacity=0.0
                    if(reduce) finish()
                    else {
                        if(next.wave) { amplitude=1.0;amplitudeFrom=1.0 }
                        enter(if(from>=1-1e-3) { if(next.wave) Stage.CIRCLE_FLATTEN else Stage.CIRCLE_ERASE } else Stage.CIRCLE_FILL)
                    }
                } else if(next.wave) {
                    if(reduce) finish() else { amplitude=1.0;amplitudeFrom=1.0;enter(Stage.WAVE_FILL) }
                } else if(reduce) { fraction=1.0;enter(Stage.COLLAPSE) }
                else enter(Stage.LINEAR_FILL)
            }
        }
    }
    fun needsFrames():Boolean {
        if(metrics.hidden || stage==Stage.FINISHED) return false
        if(completing || metrics.indeterminate) return true
        return !reduced && (amplitude!=amplitudeTarget || metrics.wave && amplitude>0 || abs(fraction-metrics.fraction)>1e-3)
    }
    fun pause() { previous=-1.0;waveCycleStarted=-1.0 }
    fun step(now:Double) {
        if(started<0) started=now
        elapsed=max(0.0,now-started)
        if(waveCycleStarted<0) waveCycleStarted=elapsed
        val dt=if(previous<0) 0.0 else (now-previous).coerceIn(0.0,64.0);previous=now
        val m=metrics
        if(m.wave && !reduced) {
            // Reduce before adding so even an accepted extreme speed remains
            // finite. The source's ordinary phase trajectory is unchanged.
            val turns=(m.speed/m.wavelength)*(dt/1000)
            val travel=if(turns.isFinite()) (turns%1)*2*PI else 0.0
            wavePhase=(wavePhase+travel)%(2*PI)
        }
        if(completing) {
            if(stageStarted<0) stageStarted=now
            val time=now-stageStarted
            when(stage) {
                Stage.LINEAR_FILL -> {
                    fraction+=(1-fraction)*(1-exp(-dt/80))
                    if(abs(1-fraction)<1e-3) { fraction=1.0;enter(Stage.COLLAPSE,now) }
                }
                Stage.WAVE_FILL,Stage.CIRCLE_FILL -> {
                    val p=min(1.0,time/if(stage==Stage.WAVE_FILL) 300 else 500)
                    fraction=from+(1-from)*ProgressGeometry.ease(p)
                    if(p>=1) {
                        fraction=1.0
                        enter(if(stage==Stage.WAVE_FILL) Stage.WAVE_FLATTEN else if(m.wave) Stage.CIRCLE_FLATTEN else Stage.CIRCLE_ERASE,now)
                    }
                }
                Stage.WAVE_FLATTEN,Stage.CIRCLE_FLATTEN -> {
                    val p=min(1.0,time/300)
                    amplitude=amplitudeFrom*(1-ProgressGeometry.ease(p))
                    if(p>=1) { amplitude=0.0;enter(if(stage==Stage.WAVE_FLATTEN) Stage.COLLAPSE else Stage.CIRCLE_ERASE,now) }
                }
                Stage.COLLAPSE -> {
                    val p=min(1.0,time/300)
                    // CSS timing applies independently to the0→60→100% spans.
                    collapse=if(p<.6) 1-.9*ProgressGeometry.ease(p/.6,.2,0.0,1.0,.8)
                        else .1*(1-ProgressGeometry.ease((p-.6)/.4,.2,0.0,1.0,.8))
                    if(p>=1) finish()
                }
                Stage.CIRCLE_ERASE -> {
                    val p=((time-150)/550).coerceIn(0.0,1.0)
                    erase=ProgressGeometry.ease(p)
                    if(p>=1) { if(m.wave) finish() else enter(Stage.TRACK_REVEAL,now) }
                }
                Stage.TRACK_REVEAL -> {
                    val p=min(1.0,time/300);trackOpacity=ProgressGeometry.ease(p)
                    if(p>=1) finish()
                }
                else -> Unit
            }
            return
        }
        if(stage==Stage.FINISHED) return
        if(amplitude!=amplitudeTarget) {
            if(amplitudeStarted<0) amplitudeStarted=now
            val p=min(1.0,(now-amplitudeStarted)/500)
            val e=if(amplitudeTarget>amplitudeFrom) ProgressGeometry.ease(p) else ProgressGeometry.ease(p,.3,0.0,.8,.15)
            amplitude=amplitudeFrom+(amplitudeTarget-amplitudeFrom)*e
            if(p>=1) amplitude=amplitudeTarget
        }
        if(reduced) fraction=m.fraction
        else {
            fraction+=(m.fraction-fraction)*(1-exp(-dt/if(m.circular) 160 else 80))
            if(abs(m.fraction-fraction)<1e-3) fraction=m.fraction
        }
    }
    fun waveSpin():ProgressGeometry.Spin = if(reduced) ProgressGeometry.Spin(.1,0.0,elapsed%4000/4000*360)
        else ProgressGeometry.waveSpin(elapsed-waveCycleStarted)
    fun completionOpacity():Double {
        if(stage!=Stage.CIRCLE_ERASE) return 1.0
        val span=1-erase;val fade=metrics.thickness/(2*PI*metrics.radius)
        return if(span<=1e-4) 0.0 else if(span<fade) (span/fade).coerceIn(0.0,1.0) else 1.0
    }
}
