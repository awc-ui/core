package dev.awc.nativeui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.unit.dp
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntSize
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

/** Source z-index of a floating group, applied to its root among its siblings (null: not floating). */
internal class NativeAccordionFloatingHolder { var zIndex:Float? by mutableStateOf(null) }

/** The viewport floating panels are placed in (root px). */
internal class AccordionViewportHolder {
    var origin by mutableStateOf(Offset.Zero)
    var size by mutableStateOf(IntSize.Zero)
}
internal val LocalAWCAccordionViewport=staticCompositionLocalOf<AccordionViewportHolder?> { null }

/**
 * The viewport of `position: fixed` floating md-accordion panels composed in [content]:
 * `initial-x`/`initial-y` and the drag position are physical coordinates from its top-left
 * corner, and the panel width is limited to its width − 16 dp. Without one, floating panels use
 * the window's root.
 */
@Composable fun AWCAccordionViewport(modifier:Modifier=Modifier,content:@Composable ()->Unit) {
    val holder=remember { AccordionViewportHolder() }
    Box(modifier.onGloballyPositioned { holder.origin=it.positionInRoot();holder.size=it.size }) {
        CompositionLocalProvider(LocalAWCAccordionViewport provides holder,content=content)
    }
}

/**
 * `position: fixed` placement: the group reports no size to its parent (zero in-flow footprint)
 * and draws its panel at the physical viewport position, [width] wide.
 */
internal fun Modifier.accordionFloatingPlacement(viewport:()->Offset,x:()->Double,y:()->Double,width:Int):Modifier=layout { measurable,constraints->
    val placeable=measurable.measure(Constraints(minWidth=width,maxWidth=width))
    layout(0,0) {
        val origin=coordinates?.positionInRoot() ?: Offset.Zero
        val v=viewport()
        placeable.place((v.x+x()*density-origin.x).roundToInt(),(v.y+y()*density-origin.y).roundToInt())
    }
}

/** Chassis grip interaction inputs (CSS :hover/:active of the handle and the owner's dragging state). */
internal data class AccordionChassisInput(val hovered:Boolean=false,val pressed:Boolean=false,val dragging:Boolean=false,val expanded:Boolean=false)
internal data class AccordionChassisTargets(val barWidth:Double,val barOpacity:Double,val barColor:Color,val handleBackground:Color)
/**
 * Source cascade of the chassis grip: the pill rests 32×4 at 0.45 in the handle colour
 * (on-surface-variant, or on-secondary-container on an expanded item); `:hover` gives 38 / 0.9 and
 * a 10 % state-layer tint behind it, `:active` 40 / 1 and a 16 % tint, and a dragging owner 40 / 1
 * in primary (the expanded rule, later in the sheet, keeps on-secondary-container). Both custom
 * hooks replace the defaults in every state.
 */
internal fun accordionChassisTargets(i:AccordionChassisInput,handleColor:Color?,hoverBackground:Color?,onSurfaceVariant:Color,onSecondaryContainer:Color,primary:Color,stateLayer:Color,forced:Boolean=false):AccordionChassisTargets {
    val active=i.pressed
    val width=if(i.dragging || active) 40.0 else if(i.hovered) 38.0 else 32.0
    // forced-colors: `.md-accordion-item__chassis-handle-bar { opacity: 1 }`.
    val opacity=if(forced || i.dragging || active) 1.0 else if(i.hovered) .9 else .45
    val color=handleColor ?: if(i.expanded) onSecondaryContainer else if(i.dragging) primary else onSurfaceVariant
    val tint=if(active) hoverBackground ?: stateLayer.copy(alpha=stateLayer.alpha*.16f) else if(i.hovered) hoverBackground ?: stateLayer.copy(alpha=stateLayer.alpha*.10f) else Color.Transparent
    return AccordionChassisTargets(width,opacity,color,tint)
}

/** Chassis grip styles of the first item of a floating group on the composition frame clock. */
internal class NativeAccordionChassisStyle {
    var pointer=AccordionChassisInput()
    var live:()->AccordionChassisInput={ pointer }
    val barWidth=AWCCSSValueTrack(32.0,accordionLerp)
    val barOpacity=AWCCSSValueTrack(.45,accordionLerp)
    val barColor=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    val handleBackground=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    var frameMillis by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var scope:kotlinx.coroutines.CoroutineScope?=null
    var targets:()->AccordionChassisTargets={ AccordionChassisTargets(32.0,.45,Color.Transparent,Color.Transparent) }
    var timing=AccordionStyleTiming(0.0,listOf(.34,.8,.34,1.0),0.0,listOf(.38,1.21,.22,1.0))
    var initialized=false;private set
    private var job:kotlinx.coroutines.Job?=null
    private var pending=false
    fun initialize() {
        if(initialized) return
        val t=targets();barWidth.snap(t.barWidth);barOpacity.snap(t.barOpacity);barColor.snap(t.barColor);handleBackground.snap(t.handleBackground);initialized=true
    }
    fun differs():Boolean { val t=targets();return barWidth.value!=t.barWidth || barOpacity.value!=t.barOpacity || barColor.value!=t.barColor || handleBackground.value!=t.handleBackground }
    fun request() {
        pending=true
        if(job?.isActive==true) return
        val scope=scope ?: return
        job=scope.launch(start=kotlinx.coroutines.CoroutineStart.UNDISPATCHED) {
            while(true) {
                withFrameNanos { t-> val now=t/1_000_000.0;frameMillis=now;if(pending) { pending=false;apply(now) };version++ }
                if(!pending && !running(frameMillis)) break
            }
        }
    }
    internal fun apply(now:Double) {
        if(!initialized) initialize()
        val t=targets()
        barWidth.set(t.barWidth,now,timing.springDuration,timing.springCurve)
        barOpacity.set(t.barOpacity,now,timing.effectsDuration,timing.effectsCurve)
        barColor.set(t.barColor,now,timing.effectsDuration,timing.effectsCurve)
        handleBackground.set(t.handleBackground,now,timing.effectsDuration,timing.effectsCurve)
    }
    fun running(now:Double)=barWidth.isRunning(now) || barOpacity.isRunning(now) || barColor.isRunning(now) || handleBackground.isRunning(now)
}

/**
 * Hosts the floating panel: in place, or (floating, with an [AWCModalScope]) as an entry of the scope's overlay layer. `movableContentOf`
 * keeps the panel's remembered state when `floating` moves it between the two; the placeholder in the flow has no size. The entry keeps the
 * placeholder's composition locals and is inert while a modal is open, like the page content the panel belongs to.
 */
@OptIn(androidx.compose.runtime.ExperimentalComposeApi::class)
@Composable internal fun AccordionFloatingLayer(floating:Boolean,id:String,zIndex:Double,panel:@Composable ()->Unit) {
    val session=LocalAWCModalSession.current
    val latest=rememberUpdatedState(panel)
    val movable=remember { movableContentOf { latest.value() } }
    // Without an overlay scope the panel is always in place: its content is composed inline, so the items' layout nodes are attached when the
    // group's connection effect runs (s7-12-01). movableContentOf attaches them after that effect, so no item had a marker, index or
    // parent coordinates at connection and the defaultExpanded pass ran on unregistered, provisionally owned items.
    // Inside an AWCModalScope the panel is composed inline too while it is not floating (s7-20-01): movableContentOf attaches the items' nodes
    // after the group's connection effect in a dialog or sheet exactly as outside one, so the first mdItemToggle read index -1 / expanded false.
    // Only a floating panel is hosted by the scope's overlay entry, through the movable content.
    if(session==null || !floating) { panel();return }
    val locals=currentCompositionLocalContext
    Box(Modifier.size(0.dp))
    AWCModalEntryEffect(session,id,true,zIndex) {
        CompositionLocalProvider(locals) {
            val blocked=session.isActive
            Box(Modifier.then(if(blocked) Modifier.clearAndSetSemantics {}.pointerInput(Unit) {
                awaitPointerEventScope { while(true) { awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() } } }
            } else Modifier)) { movable() }
        }
    }
}
