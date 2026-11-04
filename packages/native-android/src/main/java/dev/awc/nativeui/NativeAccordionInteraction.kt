package dev.awc.nativeui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import androidx.compose.ui.draw.drawWithContent

/** One CSS transition of a value of any interpolable type (CSS Transitions Level 1). */
internal class AWCCSSValueTransition<T>(
    val from:T,val to:T,val start:Double,val duration:Double,val curve:List<Double>,
    val reversingAdjustedStart:T,val shortening:Double,private val mix:(T,T,Double)->T,
) {
    val end get()=start+duration
    val animated get()=duration>0
    fun outputProgress(now:Double):Double {
        if(duration<=0) return 1.0
        val t=((now-start)/duration).coerceIn(0.0,1.0)
        return if(t==0.0) 0.0 else if(t==1.0) 1.0 else accordionCubicBezier(t,curve)
    }
    fun value(now:Double)=mix(from,to,outputProgress(now))
}

/**
 * The after-change value of one property and its running transition. The starting
 * rules are those of [AWCCSSTransitionTrack] (unchanged end value continues; equal
 * current value or zero duration cancels; a return to the reversing-adjusted start
 * value is shortened by |progress·oldFactor + 1 − oldFactor|; anything else retargets
 * from the current value with the full duration), for any value type.
 */
internal class AWCCSSValueTrack<T>(initial:T,private val mix:(T,T,Double)->T) {
    var value=initial;private set
    var running:AWCCSSValueTransition<T>?=null;private set
    val history=mutableListOf<AWCCSSValueTransition<T>>()
    fun presented(now:Double):T { val r=running ?: return value;return if(now<r.end) r.value(now) else value }
    fun isRunning(now:Double)=running?.let { now<it.end } ?: false
    fun set(target:T,now:Double,duration:Double,curve:List<Double>) {
        val old=running
        if(old!=null && now<old.end) {
            if(old.to==target) return
            val current=old.value(now)
            running=null;value=target
            if(current==target || duration<=0) { history+=instant(current,target,now);return }
            if(old.reversingAdjustedStart==target) {
                val factor=abs(old.outputProgress(now)*old.shortening+1-old.shortening).coerceIn(0.0,1.0)
                begin(AWCCSSValueTransition(current,target,now,duration*factor,curve,old.to,factor,mix))
            } else begin(AWCCSSValueTransition(current,target,now,duration,curve,current,1.0,mix))
            return
        }
        running=null
        val current=value;value=target
        if(current==target) return
        if(duration<=0) { history+=instant(current,target,now);return }
        begin(AWCCSSValueTransition(current,target,now,duration,curve,current,1.0,mix))
    }
    fun snap(target:T) { running=null;value=target }
    private fun instant(from:T,to:T,now:Double)=AWCCSSValueTransition(from,to,now,0.0,listOf(0.0,0.0,1.0,1.0),to,1.0,mix)
    private fun begin(t:AWCCSSValueTransition<T>) { running=t;history+=t }
    fun valueAt(t:Double,initial:T):T {
        val h=history.lastOrNull { it.start<=t } ?: return initial
        return if(t>=h.end) h.to else h.value(t)
    }
}
internal val accordionLerp:(Double,Double,Double)->Double={ a,b,t-> a+(b-a)*t }
/** CSS colour transitions interpolate legacy sRGB colours premultiplied. */
internal val accordionColorLerp:(Color,Color,Double)->Color={ a,b,t-> accordionMix(a,b,t.toFloat()) }

/** Header interaction inputs (CSS :hover of the header and of the grip, :active, :focus-visible, dragging). */
internal data class AccordionInteraction(
    val hovered:Boolean=false,val gripHovered:Boolean=false,val pressed:Boolean=false,
    val focusVisible:Boolean=false,val dragging:Boolean=false,
)
internal data class AccordionStyleTargets(val stateOpacity:Double,val gripOpacity:Double,val gripColor:Color,val gripScale:Double)
/**
 * Source cascade: `.header:hover` 0.08 < `:focus-visible` 0.12 < `:active` 0.12 (later rule
 * wins); a dragging item's header has `pointer-events:none`, so it and the grip lose
 * `:hover` while `:active` persists until release. The grip rests at 0.55 in the icon
 * colour, `:hover` gives opacity 1, headline-color-expanded and scale(1.08), and the
 * dragging rule (higher specificity) gives opacity 1 and icon-color-expanded.
 */
internal fun accordionStyleTargets(
    i:AccordionInteraction,gripRest:Color,gripHover:Color,gripDragging:Color,
    hoverOpacity:Double=.08,focusOpacity:Double=.12,pressedOpacity:Double=.12,
):AccordionStyleTargets {
    val hover=i.hovered && !i.dragging
    val gripHovered=hover && i.gripHovered
    val state=if(i.pressed) pressedOpacity else if(i.focusVisible) focusOpacity else if(hover) hoverOpacity else 0.0
    return AccordionStyleTargets(state,
        if(i.dragging || gripHovered) 1.0 else .55,
        if(i.dragging) gripDragging else if(gripHovered) gripHover else gripRest,
        if(gripHovered) 1.08 else 1.0)
}
/** Transition timing of the interaction styles: effects (state layer, grip opacity/colour) and the grip's spring transform. */
internal data class AccordionStyleTiming(val effectsDuration:Double,val effectsCurve:List<Double>,val springDuration:Double,val springCurve:List<Double>) {
    companion object {
        /**
         * `transition="none"` and reduced motion remove every transition; the spring follows the
         * preset's `--_spring-*`. A disabled item's state layer and grip are `display:none`, so
         * their values change without transitions.
         */
        fun of(preset:String,reduced:Boolean,effectsDuration:Double,effectsCurve:List<Double>,tokens:Map<String,String>,disabled:Boolean=false):AccordionStyleTiming {
            if(reduced || preset=="none" || disabled) return AccordionStyleTiming(0.0,effectsCurve,0.0,listOf(.38,1.21,.22,1.0))
            fun d(key:String,fallback:Double)=accordionCSSDuration(tokens[key]) ?: fallback
            fun c(key:String,fallback:List<Double>)=accordionCSSCubicBezier(tokens[key]) ?: fallback
            val (duration,curve)=when(preset) {
                "standard"->d("--md-sys-motion-duration-medium2",300.0) to c("--md-sys-motion-easing-emphasized",listOf(.2,0.0,0.0,1.0))
                "fade"->d("--md-sys-motion-duration-short3",175.0) to c("--md-sys-motion-easing-standard",listOf(.2,0.0,0.0,1.0))
                "collapse"->d("--md-sys-motion-duration-medium2",300.0) to listOf(0.0,0.0,.2,1.0)
                else->d("--md-sys-motion-spring-spatial-default-duration",500.0) to c("--md-sys-motion-spring-spatial-default-easing",listOf(.38,1.21,.22,1.0))
            }
            return AccordionStyleTiming(effectsDuration,effectsCurve,duration,curve)
        }
    }
}

/**
 * md-ripple wave: grows from the press point to the farthest corner of the header
 * (450 ms, standard easing, opacity 0.12) and fades over 150 ms once both the growth
 * and the press have ended. It ignores `transition="none"` and reduced motion, as
 * the source ripple (its own shadow tree) does.
 */
internal class AccordionRippleWave(val origin:Offset,val radius:Double) {
    var began:Double?=null;private set
    var released:Double?=null;private set
    var releasePending=false
    fun begin(now:Double) { if(began==null) began=now }
    fun release(now:Double) { if(released==null) released=now }
    val fadeStart:Double? get()=began?.let { b-> released?.let { max(b+GROW,it) } }
    fun scale(now:Double):Double { val b=began ?: return 0.0;return accordionCubicBezier((now-b)/GROW,STANDARD) }
    fun opacity(now:Double):Double { val f=fadeStart ?: return OPACITY;return if(now<f) OPACITY else OPACITY*(1-accordionCubicBezier((now-f)/FADE,STANDARD)) }
    fun done(now:Double)=fadeStart?.let { now>=it+FADE-1e-6 } ?: false
    /** Growing or fading; a held, fully grown wave is static. */
    fun animating(now:Double)=began==null || releasePending || now<began!!+GROW || (fadeStart!=null && !done(now))
    companion object {
        const val GROW=450.0;const val FADE=150.0;const val OPACITY=.12
        val STANDARD=listOf(.2,0.0,0.0,1.0)
        /** Farthest-corner radius from [origin] in a [width]×[height] box. */
        fun radius(origin:Offset,width:Double,height:Double)=hypot(max(abs(origin.x.toDouble()),abs(width-origin.x)),max(abs(origin.y.toDouble()),abs(height-origin.y)))
    }
}

/**
 * Header interaction styles of one item on the composition frame clock: the state
 * layer opacity, the grip's opacity/colour/scale and ripple waves. Input handlers
 * update [interaction] and call [request], which registers the frame awaiter
 * synchronously, so a style change applies at the frame time of the frame that first
 * renders it; drawing reads the values at that time and the loop ticks only while
 * something runs.
 */
internal class NativeAccordionItemStyle {
    /** Pointer-owned inputs (hover of the header and grip, :active). */
    var pointer=AccordionInteraction()
    /** All inputs: [pointer] plus live focus-visible and dragging state. */
    var live:()->AccordionInteraction={ pointer }
    /** The floating chassis grip of this item, when it has one. */
    var chassis:NativeAccordionChassisStyle?=null
    val stateOpacity=AWCCSSValueTrack(0.0,accordionLerp)
    val gripOpacity=AWCCSSValueTrack(.55,accordionLerp)
    val gripColor=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    val gripScale=AWCCSSValueTrack(1.0,accordionLerp)
    val waves=mutableListOf<AccordionRippleWave>()
    /** Every wave started (inspection and tests). */
    val waveHistory=mutableListOf<AccordionRippleWave>()
    var frameMillis by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var scope:CoroutineScope?=null
    var targets:()->AccordionStyleTargets={ AccordionStyleTargets(0.0,.55,Color.Transparent,1.0) }
    var timing=AccordionStyleTiming(0.0,listOf(.34,.8,.34,1.0),0.0,listOf(.38,1.21,.22,1.0))
    var initialized=false;private set
    private var job:Job?=null
    private var pending=false
    /** Initial styles have no transition. */
    fun initialize() {
        if(initialized) return
        val t=targets()
        stateOpacity.snap(t.stateOpacity);gripOpacity.snap(t.gripOpacity);gripColor.snap(t.gripColor);gripScale.snap(t.gripScale)
        initialized=true
    }
    fun differs():Boolean {
        val t=targets()
        return stateOpacity.value!=t.stateOpacity || gripOpacity.value!=t.gripOpacity || gripColor.value!=t.gripColor || gripScale.value!=t.gripScale
    }
    fun press(origin:Offset,width:Double,height:Double) {
        // A new press finishes the previous cycle (md-ripple finishCycle).
        val wave=AccordionRippleWave(origin,AccordionRippleWave.radius(origin,width,height))
        waves.clear();waves+=wave;waveHistory+=wave;if(waveHistory.size>16) waveHistory.removeAt(0)
        request()
    }
    fun release() { waves.forEach { it.releasePending=true };request() }
    fun clearWaves() { waves.clear();version++ }
    fun request() {
        pending=true
        if(job?.isActive==true) return
        val scope=scope ?: return
        job=scope.launch(start=CoroutineStart.UNDISPATCHED) {
            while(true) {
                withFrameNanos { t->
                    val now=t/1_000_000.0
                    frameMillis=now
                    if(pending) { pending=false;apply(now) }
                    waves.removeAll { it.done(now) }
                    version++
                }
                if(!pending && !running(frameMillis)) break
            }
        }
    }
    /** Applies the current targets as one style change at [now] (the frame callback; tests replay source times). */
    internal fun apply(now:Double) {
        if(!initialized) initialize()
        val t=targets()
        stateOpacity.set(t.stateOpacity,now,timing.effectsDuration,timing.effectsCurve)
        gripOpacity.set(t.gripOpacity,now,timing.effectsDuration,timing.effectsCurve)
        gripColor.set(t.gripColor,now,timing.effectsDuration,timing.effectsCurve)
        gripScale.set(t.gripScale,now,timing.springDuration,timing.springCurve)
        for(w in waves) { w.begin(now);if(w.releasePending) { w.release(now);w.releasePending=false } }
    }
    fun running(now:Double)=stateOpacity.isRunning(now) || gripOpacity.isRunning(now) || gripColor.isRunning(now) || gripScale.isRunning(now) || waves.any { it.animating(now) }
}

/** One recorded style change of an interaction property (inspection and tests). */
data class AWCAccordionStyleTransition(val property:String,val from:Any,val to:Any,val start:Double,val duration:Double,val curve:List<Double>,val shortening:Double) {
    val animated:Boolean get()=duration>0
}
/** A ripple wave as presented at a time (dp). */
data class AWCAccordionRippleState(val originX:Double,val originY:Double,val radius:Double,val began:Double?,val released:Double?,val opacity:Double,val scale:Double) {
    /** Rendered diameter, the source wave's bounding width. */
    val width:Double get()=2*radius*scale
}
/** Read-only view of one item's header interaction styles (opt-in, see [AWCAccordionStyleInspectionScope]). */
class AWCAccordionItemStyleInspection internal constructor(private val style:NativeAccordionItemStyle,private val disabled:()->Boolean) {
    val frameMillis:Double get()=style.frameMillis
    val hovered:Boolean get()=style.live().let { it.hovered && !it.dragging }
    val gripHovered:Boolean get()=hovered && style.live().gripHovered
    val pressed:Boolean get()=style.live().pressed
    val focusVisible:Boolean get()=style.live().focusVisible
    val dragging:Boolean get()=style.live().dragging
    /** The painted state-layer opacity (0 while disabled: the layer is not displayed). */
    fun stateOpacity(t:Double):Double=if(disabled()) 0.0 else style.stateOpacity.presented(t)
    /** The computed state-layer opacity, painted or not. */
    fun computedStateOpacity(t:Double):Double=style.stateOpacity.presented(t)
    fun gripOpacity(t:Double):Double=style.gripOpacity.presented(t)
    fun gripColor(t:Double):Color=style.gripColor.presented(t)
    fun gripScale(t:Double):Double=style.gripScale.presented(t)
    fun waves(t:Double):List<AWCAccordionRippleState> = style.waves.filter { it.began!=null && !it.done(t) }.map { AWCAccordionRippleState(it.origin.x.toDouble(),it.origin.y.toDouble(),it.radius,it.began,it.released,it.opacity(t),it.scale(t)) }
    fun startedWaves():List<AWCAccordionRippleState> = style.waveHistory.map { AWCAccordionRippleState(it.origin.x.toDouble(),it.origin.y.toDouble(),it.radius,it.began,it.released,it.opacity(Double.MAX_VALUE),1.0) }
    fun history():List<AWCAccordionStyleTransition> {
        fun <T:Any> map(name:String,track:AWCCSSValueTrack<T>)=track.history.map { AWCAccordionStyleTransition(name,it.from,it.to,it.start,it.duration,it.curve,it.shortening) }
        return (map("state-layer.opacity",style.stateOpacity)+map("drag-handle.opacity",style.gripOpacity)+map("drag-handle.color",style.gripColor)+map("drag-handle.transform",style.gripScale)).sortedBy { it.start }
    }
    // ---- floating chassis grip (first item of a floating group) ----
    val chassisFrameMillis:Double get()=style.chassis?.frameMillis ?: 0.0
    val chassisHovered:Boolean get()=style.chassis?.pointer?.hovered ?: false
    val chassisPressed:Boolean get()=style.chassis?.pointer?.pressed ?: false
    fun chassisBarWidth(t:Double):Double?=style.chassis?.barWidth?.presented(t)
    fun chassisBarOpacity(t:Double):Double?=style.chassis?.barOpacity?.presented(t)
    fun chassisBarColor(t:Double):Color?=style.chassis?.barColor?.presented(t)
    fun chassisHandleBackground(t:Double):Color?=style.chassis?.handleBackground?.presented(t)
    fun chassisHistory():List<AWCAccordionStyleTransition> {
        val c=style.chassis ?: return emptyList()
        fun <T:Any> map(name:String,track:AWCCSSValueTrack<T>)=track.history.map { AWCAccordionStyleTransition(name,it.from,it.to,it.start,it.duration,it.curve,it.shortening) }
        return (map("chassis-handle-bar.width",c.barWidth)+map("chassis-handle-bar.opacity",c.barOpacity)+map("chassis-handle-bar.background-color",c.barColor)+map("chassis-handle.background-color",c.handleBackground)).sortedBy { it.start }
    }
    val chassisSpringDuration:Double get()=style.chassis?.timing?.springDuration ?: 0.0
    val chassisSpringCurve:List<Double> get()=style.chassis?.timing?.springCurve ?: emptyList()
    val chassisEffectsDuration:Double get()=style.chassis?.timing?.effectsDuration ?: 0.0
    val chassisEffectsCurve:List<Double> get()=style.chassis?.timing?.effectsCurve ?: emptyList()
    val effectsDuration:Double get()=style.timing.effectsDuration
    val effectsCurve:List<Double> get()=style.timing.effectsCurve
    val springDuration:Double get()=style.timing.springDuration
    val springCurve:List<Double> get()=style.timing.springCurve
}
internal val LocalAWCAccordionStyleInspector=androidx.compose.runtime.staticCompositionLocalOf<((String,AWCAccordionItemStyleInspection)->Unit)?> { null }
/** Opt-in: reports each md-accordion-item's interaction styles, keyed by its headline. */
@androidx.compose.runtime.Composable
fun AWCAccordionStyleInspectionScope(onItem:(String,AWCAccordionItemStyleInspection)->Unit,content:@androidx.compose.runtime.Composable ()->Unit) {
    androidx.compose.runtime.CompositionLocalProvider(LocalAWCAccordionStyleInspector provides onItem,content=content)
}

internal fun accordionTokenNumber(tokens:Map<String,String>,key:String,fallback:Double)=
    tokens[key]?.trim()?.toDoubleOrNull()?.takeIf { it.isFinite() } ?: fallback

/** Root geometry of a header and its grip, and the last hovering pointer (root px). */
internal class AccordionHeaderGeometry {
    var header:androidx.compose.ui.geometry.Rect?=null
    var grip:androidx.compose.ui.geometry.Rect?=null
    var pointer:Offset?=null
    var hoverCapable=false
    /** A drop moved the item: positions stay relative to the old placement until the next layout re-hits. */
    var awaitingLayout=false
    /**
     * The header's new placement. The grip moves with it: a parent's position callback runs before its
     * children's, so re-hitting with the grip's previous rect (the pre-drop placement) would put the
     * pointer over the grip for one frame after a drop.
     */
    fun moveTo(h:androidx.compose.ui.geometry.Rect) {
        val old=header;val g=grip
        if(old!=null && g!=null) grip=g.translate(h.left-old.left,h.top-old.top)
        header=h
    }
    fun overGrip(local:Offset):Boolean {
        val h=header ?: return false;val g=grip ?: return false
        val x=h.left+local.x;val y=h.top+local.y
        return x>=g.left && x<g.right && y>=g.top && y<g.bottom
    }
    /** Hit-tests the last hover position again after layout (like the browser after a drop). */
    fun rehit(style:NativeAccordionItemStyle) {
        val p=pointer ?: return;val h=header ?: return
        if(!hoverCapable || style.pointer.pressed || style.live().dragging) return
        val inside=p.x>=h.left && p.y>=h.top && p.x<h.right && p.y<h.bottom
        val g=grip
        val overGrip=inside && g!=null && p.x>=g.left && p.x<g.right && p.y>=g.top && p.y<g.bottom
        val next=style.pointer.copy(hovered=inside,gripHovered=overGrip)
        if(next!=style.pointer) { style.pointer=next;style.request() }
    }
}

/** md-ripple waves of a header, drawn below its content at the frame-clock time. */
internal fun androidx.compose.ui.Modifier.accordionRipple(style:NativeAccordionItemStyle,color:Color)=
    this.then(androidx.compose.ui.Modifier.drawWithContent {
        @Suppress("UNUSED_VARIABLE") val v=style.version
        val now=style.frameMillis
        for(w in style.waves) {
            if(w.began==null || w.done(now)) continue
            val r=(w.radius*w.scale(now)*density).toFloat()
            if(r>0f) drawCircle(color.copy(alpha=color.alpha*w.opacity(now).toFloat()),r,Offset(w.origin.x*density,w.origin.y*density))
        }
        drawContent()
    })
