package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusTarget
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private val CardHex=Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$")
private fun cardColorHex(value:String?)=value?.takeIf { it.matches(CardHex) }?.uppercase(java.util.Locale.ROOT)

/** Physical CSS padding (`--md-card-padding` shorthand order) in dp. */
@Immutable data class AWCCardInsets(val top:Double,val right:Double,val bottom:Double,val left:Double) {
    constructor(all:Double):this(all,all,all,all)
    constructor(vertical:Double,horizontal:Double):this(vertical,horizontal,vertical,horizontal)
    internal val valid get()=listOf(top,right,bottom,left).all { it.isFinite() && it>=0 }
    companion object {
        /** Physical insets from plain data (top/right/bottom/left points); missing edges are 0. */
        fun fromValues(value:Any?):AWCCardInsets? {
            val map=value as? Map<*,*> ?: return null
            if(map.keys.any { it !in setOf("top","right","bottom","left") }) return null
            fun n(key:String)=if(!map.containsKey(key)) 0.0 else (map[key] as? Number)?.toDouble()
            return AWCCardInsets(n("top") ?: return null,n("right") ?: return null,n("bottom") ?: return null,n("left") ?: return null).takeIf { it.valid }
        }
    }
}
/** Affine card length (points + fraction of the parent + em/rem/ch), the source `--md-card-*` size hooks. */
typealias AWCCardLength = AWCSkeletonLength

/**
 * The fourteen public md-card hooks (`--md-card-*`). Unset fields keep the variant/theme/density
 * defaults; state rules override the elevation hook and the disabled rules override colour and
 * elevation, as in the source. Lengths are dp; percentages use the parent constraint.
 */
@Immutable data class AWCCardAppearance(
    val containerColor:String?=null,val containerShape:AWCCornerShape?=null,val containerElevation:List<AWCBoxShadow>?=null,
    val outlineColor:String?=null,val outlineWidth:Double?=null,val stateLayerColor:String?=null,
    val width:AWCSkeletonLength?=null,val minWidth:AWCSkeletonLength?=null,val maxWidth:AWCSkeletonLength?=null,
    val height:AWCSkeletonLength?=null,val minHeight:AWCSkeletonLength?=null,val maxHeight:AWCSkeletonLength?=null,
    val padding:AWCCardInsets?=null,val gap:Double?=null,
) {
    internal fun normalized()=copy(containerColor=cardColorHex(containerColor),outlineColor=cardColorHex(outlineColor),stateLayerColor=cardColorHex(stateLayerColor),
        containerElevation=containerElevation?.takeIf { l-> l.all { it.valid } },outlineWidth=outlineWidth?.takeIf { it.isFinite() && it>=0 },
        padding=padding?.takeIf { it.valid },gap=gap?.takeIf { it.isFinite() && it>=0 })
    fun merge(o:AWCCardAppearance)=AWCCardAppearance(o.containerColor ?: containerColor,o.containerShape ?: containerShape,o.containerElevation ?: containerElevation,
        o.outlineColor ?: outlineColor,o.outlineWidth ?: outlineWidth,o.stateLayerColor ?: stateLayerColor,o.width ?: width,o.minWidth ?: minWidth,o.maxWidth ?: maxWidth,
        o.height ?: height,o.minHeight ?: minHeight,o.maxHeight ?: maxHeight,o.padding ?: padding,o.gap ?: gap)
    companion object {
        /** Typed hooks from plain data (Laboratory transport); invalid fields are ignored. */
        fun fromValues(values:Map<String,AWCValue>):AWCCardAppearance {
            fun n(key:String)=(values[key] as? Number)?.toDouble()
            fun s(key:String)=values[key] as? String
            fun l(key:String)=AWCCardLength.fromValues(values[key])
            return AWCCardAppearance(s("containerColor"),AWCCornerShape.fromValues(values["containerShape"]),AWCBoxShadow.list(values["containerElevation"]),
                s("outlineColor"),n("outlineWidth"),s("stateLayerColor"),l("width"),l("minWidth"),l("maxWidth"),l("height"),l("minHeight"),l("maxHeight"),
                AWCCardInsets.fromValues(values["padding"]),n("gap")).normalized()
        }
    }
}
/** `::part(state-layer)` / `::part(outline)` styling: outer-tree rules win over hooks and state rules. */
@Immutable data class AWCCardPartAppearance(val stateLayerColor:String?=null,val outlineColor:String?=null,val outlineWidth:Double?=null) {
    fun merge(o:AWCCardPartAppearance)=AWCCardPartAppearance(o.stateLayerColor ?: stateLayerColor,o.outlineColor ?: outlineColor,o.outlineWidth ?: outlineWidth)
    companion object {
        fun fromValues(values:Map<String,AWCValue>)=AWCCardPartAppearance(cardColorHex(values["stateLayerColor"] as? String),cardColorHex(values["outlineColor"] as? String),
            (values["outlineWidth"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it>=0 })
    }
}
internal val LocalAWCCardAppearance=staticCompositionLocalOf { AWCCardAppearance() }
internal val LocalAWCCardPartAppearance=staticCompositionLocalOf { AWCCardPartAppearance() }
internal val LocalAWCCardReducedMotion=staticCompositionLocalOf<Boolean?> { null }
internal val LocalAWCCardInspector=staticCompositionLocalOf<((AWCCardInspection)->Unit)?> { null }
/** Authored interactive content of one card: hit regions (state), activation flags and the focused entry. */
internal class AWCCardContentRegistry { val rects=mutableStateMapOf<Any,Rect>();val activates=mutableMapOf<Any,Boolean>();var focused:Any?=null }
internal val LocalAWCCardContentRegions=staticCompositionLocalOf<AWCCardContentRegistry?> { null }
@Composable fun AWCCardAppearanceScope(appearance:AWCCardAppearance,content:@Composable ()->Unit) =
    CompositionLocalProvider(LocalAWCCardAppearance provides LocalAWCCardAppearance.current.merge(appearance.normalized()),content=content)
@Composable fun AWCCardPartAppearanceScope(appearance:AWCCardPartAppearance,content:@Composable ()->Unit) =
    CompositionLocalProvider(LocalAWCCardPartAppearance provides LocalAWCCardPartAppearance.current.merge(appearance),content=content)
/** Forces reduced (or full) motion for descendant cards, overriding the animator setting. */
@Composable fun AWCCardReducedMotionScope(reduced:Boolean?,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCCardReducedMotion provides reduced,content=content)
@Composable fun AWCCardInspectionScope(onCard:(AWCCardInspection)->Unit,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCCardInspector provides onCard,content=content)
/**
 * Marks authored interactive content inside a card (the source's interactive-content selector):
 * the card then keeps a plain container role and a press on it never starts a drag.
 * [activates] says whether Enter/Space activate the content (a button does, a text field does not):
 * only an activation reaches the card as a keyboard mdClick, like the click the source bubbles.
 */
fun Modifier.awcCardInteractiveContent(activates:Boolean=true):Modifier=composed {
    val regions=LocalAWCCardContentRegions.current ?: return@composed this
    val key=remember { Any() }
    DisposableEffect(key) { regions.rects[key]=Rect.Zero;onDispose { regions.rects.remove(key);regions.activates.remove(key);if(regions.focused===key) regions.focused=null } }
    SideEffect { regions.activates[key]=activates }
    onGloballyPositioned { regions.rects[key]=Rect(it.positionInRoot(),androidx.compose.ui.geometry.Size(it.size.width.toFloat(),it.size.height.toFloat())) }
        .onFocusChanged { if(it.hasFocus) regions.focused=key else if(regions.focused===key) regions.focused=null }
}

/** The library's own interactive components (md-card.tsx INTERACTIVE_CONTENT_SELECTOR): interactive content without a marker. */
internal val AWCCardInteractiveTags=setOf("md-button","md-icon-button","md-fab","md-checkbox","md-switch","md-radio","md-chip","md-select",
    "md-multi-select","md-text-field","md-slider","md-segmented-button","md-menu-button","md-link","md-autocomplete")
/** Text entry, pickers and sliders take Enter/Space themselves: no click bubbles to the card. */
private val AWCCardNonActivatingTags=setOf("md-select","md-multi-select","md-text-field","md-slider","md-autocomplete")
/** Marks an AWC component as its card's interactive content; hidden content does not count (the source skips `[hidden]`). */
internal fun Modifier.awcCardContentMarker(tag:String,hidden:Boolean):Modifier=
    if(tag in AWCCardInteractiveTags && !hidden) awcCardInteractiveContent(activates=tag !in AWCCardNonActivatingTags) else this

/** md-card class/attribute logic (md-card.tsx render). */
internal data class CardModel(val variant:String,val interactive:Boolean,val dragEnabled:Boolean,val disabled:Boolean,val softDisabled:Boolean,
                              val ripple:Boolean,val fullWidth:Boolean,val fullHeight:Boolean,val hidden:Boolean) {
    val effectivelyDisabled get()=disabled || softDisabled
    val disabledClass get()=interactive && effectivelyDisabled
    val softClass get()=interactive && softDisabled
    val pointerInert get()=interactive && disabled && !softDisabled
    val hasStateLayer get()=interactive || dragEnabled
    val hasRipple get()=hasStateLayer && ripple
    companion object { fun of(p:Props)=CardModel(p.str("variant").takeIf { it in setOf("elevated","filled","outlined") } ?: "elevated",p.bool("interactive"),p.bool("dragEnabled"),
        p.bool("disabled"),p.bool("softDisabled"),p.bool("ripple",true),p.bool("fullWidth"),p.bool("fullHeight"),p.bool("hidden")) }
}
internal data class CardStates(val hover:Boolean=false,val focusVisible:Boolean=false,val active:Boolean=false,val dragged:Boolean=false)
/** The source cascade, rule by rule in specificity and source order. */
internal class CardStyle(val m:CardModel,val a:AWCCardAppearance,val parts:AWCCardPartAppearance,val tokens:Map<String,String>) {
    fun token(name:String,fallback:String)=tokens["--md-sys-color-$name"] ?: fallback
    fun elevation(level:Int)=NativeShadowLayer.parse(tokens["--md-sys-elevation-$level"] ?: "none")
    val onSurface get()=awcColor(token("on-surface","#1C1B1F"),Color.Black)
    fun layerOpacity(s:CardStates):Double {
        if(!m.hasStateLayer) return 0.0
        var o=0.0
        if(s.dragged) o=.16
        if(s.hover) o=.08
        if(s.focusVisible) o=.12
        if(s.active) o=.12
        if(m.disabledClass && (s.hover || s.active || s.focusVisible)) o=0.0
        return o
    }
    val layerVisible get()=m.hasStateLayer && !m.softClass
    fun shadow(s:CardStates):List<NativeShadowLayer> {
        if(m.disabledClass) return emptyList()
        val elevated=m.variant=="elevated"
        var e=a.containerElevation?.map { it.resolved() } ?: if(elevated) elevation(1) else emptyList()
        if(s.dragged && m.dragEnabled) e=elevation(if(elevated) 4 else 3)
        if(m.hasStateLayer && s.hover) e=elevation(if(elevated) 2 else 1)
        if(m.hasStateLayer && s.focusVisible) e=if(elevated) elevation(1) else emptyList()
        if(m.hasStateLayer && s.active) e=if(elevated) elevation(1) else emptyList()
        return e
    }
    val containerColor:Color get()=if(m.disabledClass) onSurface.copy(alpha=.12f) else a.containerColor?.let(::statusDotColor)
        ?: awcColor(token(when(m.variant) { "filled"->"surface-container-highest";"outlined"->"surface";else->"surface-container-low" },"#F7F2FA"),Color.White)
    val contentColor:Color get()=if(m.disabledClass) onSurface.copy(alpha=.38f) else onSurface
    fun outlineColor(s:CardStates):Color {
        parts.outlineColor?.let { return statusDotColor(it) }
        var c=a.outlineColor?.let(::statusDotColor) ?: awcColor(token("outline-variant","#CAC4D0"),Color.Gray)
        if(s.dragged) c=awcColor(token("outline-variant","#CAC4D0"),Color.Gray)
        if(m.disabledClass) c=onSurface.copy(alpha=.12f)
        if(m.hasStateLayer && s.focusVisible) c=onSurface
        return c
    }
    val outlineWidth get()=parts.outlineWidth ?: a.outlineWidth ?: 1.0
    val stateLayerColor:Color get()=(parts.stateLayerColor ?: a.stateLayerColor)?.let(::statusDotColor) ?: onSurface
    val focusRingColor get()=awcColor(token("secondary","#625B71"),Color.Gray)
}
/** CSS box-shadow list interpolation (padding with transparent layers, premultiplied colours). */
internal val cardShadowLerp:(List<NativeShadowLayer>,List<NativeShadowLayer>,Double)->List<NativeShadowLayer> = { a,b,t->
    if(t<=0) a else if(t>=1) b else {
        val n=max(a.size,b.size)
        val pa=List(n) { a.getOrNull(it) ?: NativeShadowLayer(0.0,0.0,0.0,0.0,Color.Transparent,b[it].inset) }
        val pb=List(n) { b.getOrNull(it) ?: NativeShadowLayer(0.0,0.0,0.0,0.0,Color.Transparent,a[it].inset) }
        if(pa.zip(pb).any { (x,y)-> x.inset!=y.inset }) (if(t<.5) a else b)
        else pa.zip(pb).map { (x,y)-> fun l(u:Double,v:Double)=u+(v-u)*t
            NativeShadowLayer(l(x.x,y.x),l(x.y,y.y),max(0.0,l(x.blur,y.blur)),l(x.spread,y.spread),accordionMix(x.color,y.color,t.toFloat()),x.inset) }
    }
}

/** Card interaction styles on the composition frame clock (state layer, elevation, container, ripple). */
internal class NativeCardState {
    var frameMillis by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var pending:Triple<Double,List<NativeShadowLayer>,Color>?=null
    var timing=Pair(50.0,100.0);var curve=listOf(.2,0.0,0.0,1.0)
    val layer=AWCCSSValueTrack(0.0,accordionLerp)
    val shadow=AWCCSSValueTrack(emptyList(),cardShadowLerp)
    val background=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    var primed=false
    val waves=mutableStateListOf<AccordionRippleWave>()
    fun running(now:Double)=pending!=null || layer.isRunning(now) || shadow.isRunning(now) || background.isRunning(now) || waves.any { it.animating(now) }
    /** Targets apply at the frame time of the frame that first renders them (CSS transition start). */
    fun apply(now:Double) {
        val (l,s,b)=pending ?: return;pending=null
        if(!primed) { layer.snap(l);shadow.snap(s);background.snap(b);primed=true;return }
        layer.set(l,now,timing.first,curve);shadow.set(s,now,timing.second,curve);background.set(b,now,timing.second,curve)
    }
}
/** Rendered card values for inspection (tests, Laboratory inspector). Times are frame-clock milliseconds. */
class AWCCardInspection internal constructor(private val s:NativeCardState,internal val read:()->Map<String,Any?>) {
    val frameMillis get()=s.frameMillis
    fun layerOpacity(t:Double)=s.layer.presented(t)
    fun shadow(t:Double):List<List<Double>> = s.shadow.presented(t).map { listOf(it.x,it.y,it.blur,it.spread,it.color.red.toDouble(),it.color.green.toDouble(),it.color.blue.toDouble(),it.color.alpha.toDouble()) }
    fun background(t:Double)=s.background.presented(t).let { listOf(it.red.toDouble(),it.green.toDouble(),it.blue.toDouble(),it.alpha.toDouble()) }
    /** The newest ripple wave: origin (dp, card box), radius, scale and opacity at [t]. */
    fun ripple(t:Double)=s.waves.lastOrNull()?.takeIf { it.began!=null && !it.done(t) }?.let { mapOf("x" to it.origin.x.toDouble(),"y" to it.origin.y.toDouble(),"radius" to it.radius,"scale" to it.scale(t),"opacity" to it.opacity(t)) }
    val values get()=read()
}

/** md-card: the source card over its default slot, with native input, focus and drag. */
@Composable
internal fun NativeCard(p:Props,onEvent:EventSink,interactiveContent:Boolean=false,content:@Composable ()->Unit) {
    val m=CardModel.of(p)
    if(m.hidden) return
    val emit by rememberUpdatedState(onEvent)
    val tokens=LocalAWCThemeTokens.current;val dens=LocalDensity.current.density
    val appearance=LocalAWCCardAppearance.current;val parts=LocalAWCCardPartAppearance.current
    val style=CardStyle(m,appearance,parts,tokens)
    val d=resolveAWCDensity(p["density"],LocalAWCNativeDensity.current)
    val reduced=LocalAWCCardReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val regions=remember { AWCCardContentRegistry() }
    val actsAsButton=m.interactive && !interactiveContent && regions.rects.isEmpty()
    val state=remember { NativeCardState() }
    var hover by remember { mutableStateOf(false) };var pressed by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) };var pointerFocus by remember { mutableStateOf(false) }
    var dragging by remember { mutableStateOf(false) };var offset by remember { mutableStateOf(Offset.Zero) }
    var root by remember { mutableStateOf(Offset.Zero) };var size by remember { mutableStateOf(androidx.compose.ui.geometry.Size.Zero) }
    val focusRequester=remember { FocusRequester() }
    var within by remember { mutableStateOf(false) }
    // The card's containing block: the incoming constraints. A card larger than them (a min size
    // above the parent) overflows like the source block instead of being clamped and centred.
    val basis=remember { arrayOf(Constraints()) }
    val states=CardStates(hover && !m.pointerInert,actsAsButton && focused && !pointerFocus,pressed && !m.pointerInert,dragging)
    val easing=accordionCubicBezierCurve(tokens["--md-sys-motion-easing-standard"]) ?: listOf(.2,0.0,0.0,1.0)
    state.timing=if(reduced) 0.0 to 0.0 else (cardDuration(tokens,"--md-sys-motion-duration-short1",100.0) to cardDuration(tokens,"--md-sys-motion-duration-short2",200.0))
    state.curve=easing
    val target=Triple(style.layerOpacity(states),style.shadow(states),style.containerColor)
    // First targets and reduced-motion changes are instant: they render in the frame that composes them.
    SideEffect { if(!state.primed || target.first!=state.layer.value || target.second!=state.shadow.value || target.third!=state.background.value) { state.pending=target;state.version++
        if(!state.primed || (state.timing.first==0.0 && state.timing.second==0.0)) state.apply(state.frameMillis) } }
    LaunchedEffect(state) {
        while(isActive) {
            withFrameNanos { t-> val ms=t/1e6;state.apply(ms)
                for(w in state.waves) { w.begin(ms);if(w.releasePending && w.began!=null) { w.release(ms);w.releasePending=false } }
                state.waves.removeAll { it.done(ms) }
                state.frameMillis=ms }
            if(!state.running(state.frameMillis)) { val v=state.version;snapshotFlow { state.version }.first { it!=v } }
        }
    }
    val corners=appearance.containerShape ?: AWCCornerShape.uniform(12.0)
    val fontSize=max(12.0,14+.5*d);val lineHeight=max(16.0,20+d)
    val padding=appearance.padding ?: AWCCardInsets(max(8.0,16+2*d));val gap=appearance.gap ?: max(4.0,8+d)
    val ink=style.contentColor;val outline=style.outlineColor(states);val ring=actsAsButton && focused && !pointerFocus
    var drag by remember { mutableStateOf<Pair<Offset,Boolean>?>(null) };var armed by remember { mutableStateOf(false) }
    fun client(local:Offset)=Offset((root.x+local.x)/dens,(root.y+local.y)/dens)
    fun detail(c:Offset,start:Offset)=mapOf("clientX" to c.x.toDouble(),"clientY" to c.y.toDouble(),"offsetX" to (c.x-start.x).toDouble(),"offsetY" to (c.y-start.y).toDouble(),"startX" to start.x.toDouble(),"startY" to start.y.toDouble())
    LaunchedEffect(m.effectivelyDisabled,m.dragEnabled) { if(m.effectivelyDisabled || !m.dragEnabled) { armed=false;if(dragging) { dragging=false;offset=Offset.Zero } } }
    // The pointer that owns the gesture (the source's activePointer); other pointers never take it over.
    val owner=remember { arrayOfNulls<PointerId>(1) }
    // The move paired with mdDragStart waits for the composition that follows the start event: a start
    // handler's property changes (disable, drag off, removal) apply there, like the source's synchronous
    // re-entrancy guard after emitting mdDragStart. A pointer event arriving first flushes it in order.
    val pendingMove=remember { arrayOfNulls<Pair<Offset,Map<String,Double>>>(1) }
    fun flushMove(model:CardModel) { val pm=pendingMove[0] ?: return;pendingMove[0]=null
        if(armed && drag?.second==true && !model.effectivelyDisabled && model.dragEnabled) { offset=pm.first;emit("mdDragMove",pm.second) } }
    SideEffect { flushMove(m) }
    val inspector=LocalAWCCardInspector.current
    val values={ mapOf("role" to if(actsAsButton) "button" else "","tabindex" to (if(actsAsButton) (if(m.disabled) -1 else 0) else -2),"padding" to listOf(padding.top,padding.right,padding.bottom,padding.left),
        "gap" to gap,"fontSize" to fontSize,"lineHeight" to lineHeight,"contentColor" to ink,"outlineColor" to outline,"outlineWidth" to (if(m.variant=="outlined") style.outlineWidth else 0.0),
        "layerVisible" to style.layerVisible,"stateLayerColor" to style.stateLayerColor,"focusRing" to ring,"focused" to focused,"dragging" to dragging,"offsetX" to offset.x.toDouble(),"offsetY" to offset.y.toDouble(),
        "zIndex" to if(dragging) 1000 else 0,"hover" to states.hover,"active" to states.active) }
    if(inspector!=null) { val current=AWCCardInspection(state,values);SideEffect { inspector(current) } }
    val shape=corners
    CompositionLocalProvider(LocalAWCCardContentRegions provides regions,LocalContentColor provides ink,
        LocalTextStyle provides LocalTextStyle.current.merge(androidx.compose.ui.text.TextStyle(color=ink,fontSize=fontSize.sp,lineHeight=lineHeight.sp,letterSpacing=.25.sp))) {
        Layout(content=content,modifier=Modifier
            .layout { measurable,constraints-> basis[0]=constraints
                val pl=measurable.measure(Constraints())
                layout(pl.width.coerceIn(constraints.minWidth,constraints.maxWidth),pl.height.coerceIn(constraints.minHeight,constraints.maxHeight)) { pl.placeRelative(0,0) } }
            .zIndex(if(dragging) 1000f else 0f)
            .graphicsLayer { translationX=offset.x*dens;translationY=offset.y*dens }
            .onGloballyPositioned { root=it.positionInRoot();size=androidx.compose.ui.geometry.Size(it.size.width.toFloat(),it.size.height.toFloat()) }
            .inspectAWCNode(LocalAWCInspection.current,"","md-card")
            .accordionShadow(shape,{ state.shadow.presented(state.frameMillis) },false)
            .drawWithContent {
                drawContent()
                if(ring) { val o=(3.5f*density);val path=cardPath(shape,size.width+2*o,size.height+2*o,density,-o)
                    drawPath(path,style.focusRingColor,style=Stroke(3f*density)) }
            }
            .clip(shape)
            .drawBehind { drawRect(state.background.presented(state.frameMillis)) }
            .drawWithContent {
                drawContent()
                val now=state.frameMillis
                if(m.hasRipple && !m.effectivelyDisabled) for(w in state.waves) { if(w.began==null || w.done(now)) continue
                    val r=(w.radius*w.scale(now)*density).toFloat();if(r>0f) drawCircle(ink.copy(alpha=ink.alpha*w.opacity(now).toFloat()),r,Offset(w.origin.x*density,w.origin.y*density)) }
                if(m.variant=="outlined") { val wpx=(style.outlineWidth*density).toFloat();if(wpx>0f) drawPath(cardPath(shape,size.width-wpx,size.height-wpx,density,wpx/2f),outline,style=Stroke(wpx)) }
                if(style.layerVisible) drawRect(style.stateLayerColor.copy(alpha=style.stateLayerColor.alpha*state.layer.presented(now).toFloat()))
            }
            .semantics(mergeDescendants=actsAsButton) { if(actsAsButton) { role=Role.Button;if(m.effectivelyDisabled) disabled() } }
            .focusRequester(focusRequester)
            .onFocusChanged { within=it.hasFocus && !it.isFocused }
            .onPreviewKeyEvent { e->
                // Enter (keydown) / Space (keyup) on authored focused content clicks it; the click
                // bubbles to the card in the source, so the card reports a keyboard mdClick.
                val activates=regions.focused?.let { regions.activates[it] } ?: true
                if(within && activates && m.interactive && !m.effectivelyDisabled && ((e.type==KeyEventType.KeyDown && (e.key==Key.Enter || e.key==Key.NumPadEnter)) || (e.type==KeyEventType.KeyUp && e.key==Key.Spacebar)))
                    emit("mdClick",mapOf("type" to "click","isTrusted" to true,"button" to 0,"detail" to 0,"clientX" to 0.0,"clientY" to 0.0))
                false }
            .onFocusChanged { focused=it.isFocused;if(!it.isFocused) pointerFocus=false }
            // The card is always a focus target (so focus-within and its own focus stay distinct);
            // only a button card is a tab stop.
            .then(if(actsAsButton && !m.disabled) Modifier.focusable() else Modifier.focusProperties { canFocus=false }.focusTarget())
            .onKeyEvent { e-> if(e.type==KeyEventType.KeyDown && (e.key==Key.Enter || e.key==Key.Spacebar || e.key==Key.NumPadEnter) && actsAsButton && m.interactive && !m.effectivelyDisabled) {
                if(m.hasRipple) { val c=Offset(size.width/2/dens,size.height/2/dens)
                    state.waves+=AccordionRippleWave(c,AccordionRippleWave.radius(c,(size.width/dens).toDouble(),(size.height/dens).toDouble())).also { it.releasePending=true };state.version++ }
                emit("mdClick",mapOf("type" to "click","isTrusted" to false,"button" to 0,"detail" to 0,"clientX" to 0.0,"clientY" to 0.0));true } else false }
            .pointerInput(m,actsAsButton) {
                awaitPointerEventScope {
                    while(true) {
                        val e=awaitPointerEvent(PointerEventPass.Final)
                        // ACTION_CANCEL (capture loss, an intercepting parent, removal) arrives as a synthetic
                        // release without a MotionEvent: the source's pointercancel/lostpointercapture path.
                        val cancelled=e.type==PointerEventType.Release && e.motionEvent.let { it==null || it.actionMasked==android.view.MotionEvent.ACTION_CANCEL }
                        val held=owner[0]
                        val c=(if(held!=null) e.changes.firstOrNull { it.id==held } else e.changes.firstOrNull { it.changedToDownIgnoreConsumed() } ?: e.changes.firstOrNull()) ?: continue
                        val p=c.position
                        val inside=p.x>=0 && p.y>=0 && p.x<size.width && p.y<size.height
                        if(m.pointerInert) { hover=false;owner[0]=null;continue }
                        if(cancelled) {
                            pendingMove[0]=null;owner[0]=null;pressed=false;drag=null;armed=false;dragging=false;offset=Offset.Zero
                            state.waves.lastOrNull()?.releasePending=true;state.version++;hover=false;continue
                        }
                        // A second pointer's press or release belongs to no gesture of this card.
                        if(held!=null && (e.type==PointerEventType.Press || e.type==PointerEventType.Release) && !(c.pressed!=c.previousPressed)) continue
                        if(pendingMove[0]!=null) flushMove(m)
                        when(e.type) {
                            PointerEventType.Enter,PointerEventType.Move,PointerEventType.Exit -> {
                                if(c.type==PointerType.Mouse || drag!=null) hover=inside && e.type!=PointerEventType.Exit || (drag!=null && inside)
                                val start=drag?.first
                                if(start!=null && armed) {
                                    val now=client(p);val dx=now.x-start.x;val dy=now.y-start.y
                                    if(drag?.second!=true) {
                                        if(abs(dx)+abs(dy)>=5f) { drag=start to true;dragging=true
                                            emit("mdDragStart",detail(now,start))
                                            pendingMove[0]=Offset(dx,dy) to detail(now,start) }
                                    } else { offset=Offset(dx,dy);emit("mdDragMove",detail(now,start)) }
                                }
                            }
                            PointerEventType.Press -> {
                                owner[0]=c.id
                                pressed=true;hover=inside
                                if(actsAsButton) { pointerFocus=true;runCatching { focusRequester.requestFocus() } }
                                val start=client(p);val onContent=regions.rects.values.any { it.contains(Offset(root.x+p.x,root.y+p.y)) }
                                drag=start to false;armed=m.dragEnabled && !m.effectivelyDisabled && !onContent
                                if(m.hasRipple && !m.effectivelyDisabled) { val o=Offset(p.x/dens,p.y/dens)
                                    state.waves+=AccordionRippleWave(o,AccordionRippleWave.radius(o,(size.width/dens).toDouble(),(size.height/dens).toDouble()));state.version++ }
                            }
                            PointerEventType.Release -> {
                                owner[0]=null
                                val start=drag?.first;val started=drag?.second==true
                                pressed=false;drag=null
                                state.waves.lastOrNull()?.releasePending=true;state.version++
                                if(started && armed && start!=null) { emit("mdDragEnd",detail(client(p),start)) }
                                dragging=false;offset=Offset.Zero;armed=false
                                if(!started && start!=null && inside && m.interactive && !m.effectivelyDisabled)
                                    emit("mdClick",mapOf("type" to "click","isTrusted" to true,"button" to 0,"detail" to 1,"clientX" to client(p).x.toDouble(),"clientY" to client(p).y.toDouble()))
                                if(c.type==PointerType.Mouse) hover=inside else hover=false
                            }
                            else -> {}
                        }
                    }
                }
            }) { measurables,constraints ->
            val padH=(padding.left+padding.right);val padV=(padding.top+padding.bottom)
            val outer=basis[0]
            fun res(l:AWCSkeletonLength?,basis:Int):Double? = l?.resolve(if(basis==Constraints.Infinity) null else basis/dens.toDouble(),fontSize,16.0,fontSize*.5)
            val wl=if(m.fullWidth) AWCSkeletonLength(fraction=1.0) else appearance.width
            val hl=if(m.fullHeight) AWCSkeletonLength(fraction=1.0) else appearance.height
            var w=res(wl,outer.maxWidth) ?: if(outer.hasBoundedWidth) outer.maxWidth/dens.toDouble() else
                (measurables.maxOfOrNull { it.maxIntrinsicWidth(Constraints.Infinity) }?.div(dens.toDouble()) ?: 0.0)+padH
            res(appearance.maxWidth,outer.maxWidth)?.let { w=min(w,it) };res(appearance.minWidth,outer.maxWidth)?.let { w=max(w,it) };w=max(w,padH)
            val cw=((w-padH)*dens).roundToInt().coerceAtLeast(0)
            val placeables=measurables.map { it.measure(Constraints(minWidth=cw,maxWidth=cw)) }
            val contentH=placeables.sumOf { it.height/dens.toDouble() }+gap*max(0,placeables.size-1)
            var h=res(hl,outer.maxHeight) ?: (contentH+padV)
            res(appearance.maxHeight,outer.maxHeight)?.let { h=min(h,it) };res(appearance.minHeight,outer.maxHeight)?.let { h=max(h,it) };h=max(h,padV)
            layout((w*dens).roundToInt(),(h*dens).roundToInt()) {
                var y=padding.top*dens
                for(pl in placeables) { pl.place((padding.left*dens).roundToInt(),y.roundToInt());y+=pl.height+gap*dens }
            }
        }
    }
}
private fun cardPath(shape:AWCCornerShape,width:Float,height:Float,density:Float,inset:Float):Path {
    val radii=shape.radii((width+2*inset)/density.toDouble(),(height+2*inset)/density.toDouble())
    fun r(v:Double)=max(0f,(v*density).toFloat()-inset)
    return Path().apply { addRoundRect(androidx.compose.ui.geometry.RoundRect(Rect(inset,inset,inset+width,inset+height),
        androidx.compose.ui.geometry.CornerRadius(r(radii[0].first),r(radii[0].second)),androidx.compose.ui.geometry.CornerRadius(r(radii[1].first),r(radii[1].second)),
        androidx.compose.ui.geometry.CornerRadius(r(radii[2].first),r(radii[2].second)),androidx.compose.ui.geometry.CornerRadius(r(radii[3].first),r(radii[3].second)))) }
}
internal fun accordionCubicBezierCurve(raw:String?):List<Double>? =
    raw?.let { Regex("cubic-bezier\\(([^)]*)\\)").find(it)?.groupValues?.get(1)?.split(',')?.mapNotNull { v-> v.trim().toDoubleOrNull() }?.takeIf { l-> l.size==4 } }

internal fun cardDuration(tokens:Map<String,String>,key:String,fallback:Double):Double {
    val raw=tokens[key]?.trim() ?: return fallback
    return when { raw.endsWith("ms")->raw.removeSuffix("ms").trim().toDoubleOrNull();raw.endsWith("s")->raw.removeSuffix("s").trim().toDoubleOrNull()?.times(1000);else->raw.toDoubleOrNull() }?.takeIf { it.isFinite() } ?: fallback
}
