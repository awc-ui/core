package dev.awc.nativeui

import kotlin.math.abs

/** `cubic-bezier(x1, y1, x2, y2)` output for input progress [x] (x solved to double precision). */
internal fun accordionCubicBezier(x:Double,curve:List<Double>):Double {
    if(x<=0) return 0.0
    if(x>=1) return 1.0
    fun bezier(t:Double,a:Double,b:Double)=3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t
    var low=0.0;var high=1.0
    repeat(64) { val t=(low+high)/2;if(bezier(t,curve[0],curve[2])<x) low=t else high=t }
    return bezier((low+high)/2,curve[1],curve[3])
}
/** CSS `<time>` (ms or s) to milliseconds; null when invalid or negative. */
internal fun accordionCSSDuration(raw:String?):Double? {
    val v=raw?.trim() ?: return null
    val ms=v.endsWith("ms");val s=!ms && v.endsWith("s")
    if(!ms && !s) return null
    val n=v.dropLast(if(ms) 2 else 1).toDoubleOrNull()?.takeIf { it.isFinite() && it>=0 } ?: return null
    return if(ms) n else n*1000
}
/** `cubic-bezier(x1, y1, x2, y2)` with x in [0, 1]; null otherwise. */
internal fun accordionCSSCubicBezier(raw:String?):List<Double>? {
    val v=raw?.trim() ?: return null
    if(!v.startsWith("cubic-bezier(") || !v.endsWith(")")) return null
    val values=v.removePrefix("cubic-bezier(").removeSuffix(")").split(',').map { it.trim().toDoubleOrNull() ?: return null }
    return values.takeIf { it.size==4 && it.all(Double::isFinite) && it[0] in 0.0..1.0 && it[2] in 0.0..1.0 }
}

/**
 * One running CSS transition of a numeric property (CSS Transitions Level 1,
 * "Starting of transitions"). Times are milliseconds on the composition frame clock.
 */
internal data class AWCCSSTransition(
    val from:Double,val to:Double,val start:Double,val duration:Double,val curve:List<Double>,
    val reversingAdjustedStart:Double,val shortening:Double,
) {
    val end get()=start+duration
    val animated get()=duration>0
    fun outputProgress(now:Double):Double {
        if(duration<=0) return 1.0
        val t=((now-start)/duration).coerceIn(0.0,1.0)
        return if(t==0.0) 0.0 else if(t==1.0) 1.0 else accordionCubicBezier(t,curve)
    }
    fun value(now:Double)=from+(to-from)*outputProgress(now)
    companion object {
        /** A style change without a transition (zero duration), kept in the track history. */
        fun instant(from:Double,to:Double,now:Double)=AWCCSSTransition(from,to,now,0.0,listOf(0.0,0.0,1.0,1.0),to,1.0)
    }
}

/** The after-change value of one property plus its running transition, if any. */
internal class AWCCSSTransitionTrack {
    var value=0.0;private set
    var running:AWCCSSTransition?=null;private set
    /** Every style change in order: started transitions and zero-duration changes. */
    val history=mutableListOf<AWCCSSTransition>()
    fun presented(now:Double):Double { val r=running ?: return value;return if(now<r.end) r.value(now) else value }
    fun isRunning(now:Double)=running?.let { now<it.end } ?: false
    fun set(target:Double,now:Double,duration:Double,curve:List<Double>) {
        val old=running
        if(old!=null && now<old.end) {
            // A running transition whose end value is already the after-change value continues.
            if(old.to==target) return
            val current=old.value(now)
            running=null;value=target
            // Equal current value or no duration: cancel without a new transition.
            if(current==target || duration<=0) { history+=AWCCSSTransition.instant(current,target,now);return }
            if(old.reversingAdjustedStart==target) {
                // Reversal: shortened by |outputProgress * oldFactor + 1 - oldFactor|.
                val factor=abs(old.outputProgress(now)*old.shortening+1-old.shortening).coerceIn(0.0,1.0)
                begin(AWCCSSTransition(current,target,now,duration*factor,curve,old.to,factor))
            } else begin(AWCCSSTransition(current,target,now,duration,curve,current,1.0))
            return
        }
        running=null
        val current=value;value=target
        if(current==target) return
        if(duration<=0) { history+=AWCCSSTransition.instant(current,target,now);return }
        begin(AWCCSSTransition(current,target,now,duration,curve,current,1.0))
    }
    fun snap(target:Double) { running=null;value=target }
    private fun begin(transition:AWCCSSTransition) { running=transition;history+=transition }
    /** Value at [t] from the full history (the change active at t, else [initial]). */
    fun valueAt(t:Double,initial:Double):Double {
        val h=history.lastOrNull { it.start<=t } ?: return initial
        return if(t>=h.end) h.to else h.value(t)
    }
}

/**
 * Source reorder motion. While an item is lifted its siblings carry
 * `.md-accordion-item--shifting` (`transform var(--md-sys-motion-duration-short3)
 * var(--_state-easing)`) and the drop placeholder glides with `transform
 * var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard)`.
 * `transition="none"` and reduced motion remove both transitions; drop and
 * cancellation clear the transforms in the same tick, so they snap.
 */
internal class NativeAccordionReorderMotion {
    data class Timing(val duration:Double,val curve:List<Double>)
    val siblings=linkedMapOf<String,AWCCSSTransitionTrack>()
    var placeholder:AWCCSSTransitionTrack?=null;private set
    var placeholderInitial=0.0;private set
    companion object {
        private val fallbackCurve=listOf(.2,0.0,0.0,1.0)
        fun timing(preset:String,reduced:Boolean,tokens:Map<String,String>):Pair<Timing,Timing> {
            if(reduced || preset=="none") return Timing(0.0,fallbackCurve) to Timing(0.0,fallbackCurve)
            val emphasized=accordionCSSCubicBezier(tokens["--md-sys-motion-easing-emphasized"]) ?: fallbackCurve
            val standard=accordionCSSCubicBezier(tokens["--md-sys-motion-easing-standard"]) ?: fallbackCurve
            val state=when(preset) { "collapse"->listOf(.4,0.0,.2,1.0);"fade"->standard;else->emphasized }
            return Timing(accordionCSSDuration(tokens["--md-sys-motion-duration-short3"]) ?: 150.0,state) to
                Timing(accordionCSSDuration(tokens["--md-sys-motion-duration-short4"]) ?: 200.0,standard)
        }
    }
    /** Applies one style change at [now]: the current targets of every sibling and of the placeholder. */
    fun update(dragged:String?,ids:List<String>,offsets:Map<String,Double>,placeholderTop:Double?,shift:Timing,glide:Timing,now:Double) {
        if(dragged==null) { clear();return }
        siblings.keys.retainAll(ids.toSet()-dragged)
        for(id in ids) {
            if(id==dragged) continue
            siblings.getOrPut(id) { AWCCSSTransitionTrack() }.set(offsets[id] ?: 0.0,now,shift.duration,shift.curve)
        }
        if(placeholderTop==null) placeholder=null
        else placeholder?.set(placeholderTop,now,glide.duration,glide.curve)
            ?: AWCCSSTransitionTrack().also { it.snap(placeholderTop);placeholder=it;placeholderInitial=placeholderTop }
    }
    fun clear() { siblings.clear();placeholder=null }
    fun offset(id:String,now:Double)=siblings[id]?.presented(now) ?: 0.0
    fun placeholderTop(now:Double)=placeholder?.presented(now)
    fun running(now:Double)=siblings.values.any { it.isRunning(now) } || placeholder?.isRunning(now)==true
    /** Whether [update] with these targets would change any track (used for style changes that bypass the gesture). */
    fun differs(dragged:String?,ids:List<String>,offsets:Map<String,Double>,placeholderTop:Double?):Boolean {
        if(dragged==null) return siblings.isNotEmpty() || placeholder!=null
        if(ids.any { it!=dragged && (siblings[it]?.value ?: 0.0)!=(offsets[it] ?: 0.0) }) return true
        return (placeholder?.value)!=placeholderTop
    }
}

/** One style change of a reorder transform track, in dp and frame-clock milliseconds. */
data class AWCAccordionMotionTransition(
    val from:Double,val to:Double,val start:Double,val duration:Double,val curve:List<Double>,
    /** Reversing shortening factor (1 unless the change returned to the reversing-adjusted start). */
    val shortening:Double,
) { val animated:Boolean get()=duration>0 }

/**
 * Read-only view of one md-accordion group's reorder motion (opt-in inspection,
 * see [AWCAccordionReorderInspectionScope]). Item keys are the group's item order.
 */
class AWCAccordionReorderInspection internal constructor(private val owner:NativeAccordionOwner) {
    private fun record(t:AWCCSSTransition)=AWCAccordionMotionTransition(t.from,t.to,t.start,t.duration,t.curve,t.shortening)
    /** Frame-clock time (ms) of the latest frame the motion observed. */
    val frameMillis:Double get()=owner.frameMillis
    val isDragging:Boolean get()=owner.state.draggedItemID!=null
    /** Index (current group order) of the lifted item, or -1. */
    val draggedIndex:Int get()=owner.state.items.indexOfFirst { it.id==owner.state.draggedItemID }
    /** Style-change history of the sibling at [index] (empty when it has no track). */
    fun siblingHistory(index:Int):List<AWCAccordionMotionTransition> =
        owner.state.items.getOrNull(index)?.let { owner.motion.siblings[it.id] }?.history?.map(::record).orEmpty()
    fun hasSiblingTrack(index:Int)=owner.state.items.getOrNull(index)?.let { owner.motion.siblings.containsKey(it.id) } ?: false
    /** Placeholder style-change history, or null when no placeholder track exists. */
    fun placeholderHistory():List<AWCAccordionMotionTransition>? = owner.motion.placeholder?.history?.map(::record)
    /** Modelled sibling offset at [t] from its history (0 before any change). */
    fun siblingValueAt(index:Int,t:Double):Double =
        owner.state.items.getOrNull(index)?.let { owner.motion.siblings[it.id] }?.valueAt(t,0.0) ?: 0.0
    /** Modelled placeholder top at [t] from its history (the lift position before any change). */
    fun placeholderValueAt(t:Double):Double? = owner.motion.placeholder?.valueAt(t,owner.motion.placeholderInitial)
    // ---- floating panel ----
    /** Physical viewport position (dp) of a floating panel. */
    val floatingX:Double get()=owner.state.x
    val floatingY:Double get()=owner.state.y
    /** Source z-index (null: none; a fixed panel without bring-to-front keeps the stylesheet's 1000). */
    val zIndex:Int? get()=owner.state.zIndex
    val chassisDragging:Boolean get()=owner.state.chassisDragging
    /** Panel elevation fraction at [t]: 0 resting, 1 dragging. */
    fun panelElevation(t:Double):Double=owner.panelElevation.presented(t)
    fun panelHistory():List<AWCAccordionMotionTransition> = owner.panelElevation.history.map { AWCAccordionMotionTransition(it.from,it.to,it.start,it.duration,it.curve,it.shortening) }
    val panelDuration:Double get()=owner.panelTiming.duration
    val panelCurve:List<Double> get()=owner.panelTiming.curve
    val shiftDuration:Double get()=owner.shiftTiming.duration
    val shiftCurve:List<Double> get()=owner.shiftTiming.curve
    val glideDuration:Double get()=owner.glideTiming.duration
    val glideCurve:List<Double> get()=owner.glideTiming.curve
}
internal val LocalAWCAccordionReorderInspector=androidx.compose.runtime.staticCompositionLocalOf<((AWCAccordionReorderInspection)->Unit)?> { null }
/** Opt-in: reports the reorder motion of each md-accordion group composed in [content]. */
@androidx.compose.runtime.Composable
fun AWCAccordionReorderInspectionScope(onGroup:(AWCAccordionReorderInspection)->Unit,content:@androidx.compose.runtime.Composable ()->Unit) {
    androidx.compose.runtime.CompositionLocalProvider(LocalAWCAccordionReorderInspector provides onGroup,content=content)
}
