package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusTarget
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private val ChipHex=Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$")
internal fun chipColorHex(value:String?)=value?.takeIf { it.matches(ChipHex) }?.uppercase(java.util.Locale.ROOT)
private fun chipLength(value:Double?)=value?.takeIf { it.isFinite() && it>=0 }

/**
 * The twelve public md-chip hooks (`--md-chip-*`). Unset fields keep the variant / appearance /
 * colour-role / density defaults; the disabled rules still override the content colours and the
 * elevation, as in the source. Colours are `#RRGGBB` or `#RRGGBBAA`; lengths are dp.
 */
@Immutable data class AWCChipHookAppearance(
    val containerColor:String?=null,val containerColorSelected:String?=null,val labelColor:String?=null,val labelColorSelected:String?=null,
    val iconColor:String?=null,val iconSize:Double?=null,val containerShape:AWCCornerShape?=null,val containerHeight:Double?=null,
    val outlineColor:String?=null,val outlineWidth:Double?=null,val stateLayerColor:String?=null,val elevation:List<AWCBoxShadow>?=null,
) {
    internal fun normalized()=AWCChipHookAppearance(chipColorHex(containerColor),chipColorHex(containerColorSelected),chipColorHex(labelColor),chipColorHex(labelColorSelected),
        chipColorHex(iconColor),chipLength(iconSize),containerShape,chipLength(containerHeight),chipColorHex(outlineColor),chipLength(outlineWidth),chipColorHex(stateLayerColor),
        elevation?.takeIf { l-> l.all { it.valid } })
    fun merge(o:AWCChipHookAppearance)=AWCChipHookAppearance(o.containerColor ?: containerColor,o.containerColorSelected ?: containerColorSelected,o.labelColor ?: labelColor,
        o.labelColorSelected ?: labelColorSelected,o.iconColor ?: iconColor,o.iconSize ?: iconSize,o.containerShape ?: containerShape,o.containerHeight ?: containerHeight,
        o.outlineColor ?: outlineColor,o.outlineWidth ?: outlineWidth,o.stateLayerColor ?: stateLayerColor,o.elevation ?: elevation)
    companion object {
        /** Typed hooks from plain data (Laboratory transport); invalid fields are ignored. */
        fun fromValues(values:Map<String,AWCValue>):AWCChipHookAppearance {
            fun n(key:String)=(values[key] as? Number)?.toDouble()
            fun s(key:String)=values[key] as? String
            return AWCChipHookAppearance(s("containerColor"),s("containerColorSelected"),s("labelColor"),s("labelColorSelected"),s("iconColor"),n("iconSize"),
                AWCCornerShape.fromValues(values["containerShape"]),n("containerHeight"),s("outlineColor"),n("outlineWidth"),s("stateLayerColor"),AWCBoxShadow.list(values["elevation"])).normalized()
        }
    }
}
/** `::part()` styling: outer-tree rules win over the hooks and every internal rule. */
@Immutable data class AWCChipPartAppearance(
    val stateLayerColor:String?=null,val stateLayerOpacity:Double?=null,val outlineColor:String?=null,val outlineWidth:Double?=null,
    val labelColor:String?=null,val iconColor:String?=null,val trailingIconColor:String?=null,val checkmarkColor:String?=null,val removeColor:String?=null,
    /** `::part(primary)`: background tint and outline; unset style keeps the focus-visible ring, unset colour/width/offset keep secondary/3/-3 (gate-7 R4-09). */
    val primaryBackground:String?=null,val primaryOutlineStyle:String?=null,val primaryOutlineColor:String?=null,val primaryOutlineWidth:Double?=null,val primaryOutlineOffset:Double?=null,
) {
    internal fun normalized()=AWCChipPartAppearance(chipColorHex(stateLayerColor),stateLayerOpacity?.takeIf { it.isFinite() }?.coerceIn(0.0,1.0),chipColorHex(outlineColor),
        chipLength(outlineWidth),chipColorHex(labelColor),chipColorHex(iconColor),chipColorHex(trailingIconColor),chipColorHex(checkmarkColor),chipColorHex(removeColor),
        chipColorHex(primaryBackground),primaryOutlineStyle?.takeIf { it in setOf("none","solid") },chipColorHex(primaryOutlineColor),chipLength(primaryOutlineWidth),primaryOutlineOffset?.takeIf { it.isFinite() })
    fun merge(o:AWCChipPartAppearance)=AWCChipPartAppearance(o.stateLayerColor ?: stateLayerColor,o.stateLayerOpacity ?: stateLayerOpacity,o.outlineColor ?: outlineColor,
        o.outlineWidth ?: outlineWidth,o.labelColor ?: labelColor,o.iconColor ?: iconColor,o.trailingIconColor ?: trailingIconColor,o.checkmarkColor ?: checkmarkColor,o.removeColor ?: removeColor,
        o.primaryBackground ?: primaryBackground,o.primaryOutlineStyle ?: primaryOutlineStyle,o.primaryOutlineColor ?: primaryOutlineColor,o.primaryOutlineWidth ?: primaryOutlineWidth,o.primaryOutlineOffset ?: primaryOutlineOffset)
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCChipPartAppearance {
            fun n(key:String)=(values[key] as? Number)?.toDouble()
            fun s(key:String)=values[key] as? String
            return AWCChipPartAppearance(s("stateLayerColor"),n("stateLayerOpacity"),s("outlineColor"),n("outlineWidth"),s("labelColor"),s("iconColor"),
                s("trailingIconColor"),s("checkmarkColor"),s("removeColor"),s("primaryBackground"),s("primaryOutlineStyle"),s("primaryOutlineColor"),n("primaryOutlineWidth"),n("primaryOutlineOffset")).normalized()
        }
    }
}
internal val LocalAWCChipAppearance=staticCompositionLocalOf { AWCChipHookAppearance() }
internal val LocalAWCChipPartAppearance=staticCompositionLocalOf { AWCChipPartAppearance() }
internal val LocalAWCChipReducedMotion=staticCompositionLocalOf<Boolean?> { null }
internal val LocalAWCChipInspector=staticCompositionLocalOf<((AWCChipInspection)->Unit)?> { null }
internal val LocalAWCChipStretch=staticCompositionLocalOf { false }
/** Descendant chips fill a bounded width proposed to them (the source chip given an inline size), aligning content with contentAlign. */
@Composable fun AWCChipStretchScope(stretch:Boolean=true,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCChipStretch provides stretch,content=content)
@Composable fun AWCChipAppearanceScope(appearance:AWCChipHookAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCChipAppearance provides LocalAWCChipAppearance.current.merge(appearance.normalized()),content=content)
@Composable fun AWCChipPartAppearanceScope(appearance:AWCChipPartAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCChipPartAppearance provides LocalAWCChipPartAppearance.current.merge(appearance.normalized()),content=content)
/** Forces reduced (or full) motion for descendant chips, overriding the animator setting. */
@Composable fun AWCChipReducedMotionScope(reduced:Boolean?,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCChipReducedMotion provides reduced,content=content)
@Composable fun AWCChipInspectionScope(onChip:(AWCChipInspection)->Unit,content:@Composable ()->Unit)=CompositionLocalProvider(LocalAWCChipInspector provides onChip,content=content)

/** md-chip.tsx class / attribute logic. */
internal data class ChipModel(val variant:String,val icon:String,val trailingIcon:String,val selected:Boolean,val selectable:Boolean?,val appearance:String,val color:String?,
                              val elevated:Boolean,val disabled:Boolean,val softDisabled:Boolean,val removable:Boolean?,val label:String,val contentAlign:String,val density:Double?,val hidden:Boolean) {
    val effectivelyDisabled get()=disabled || softDisabled
    val effectiveAppearance get()=if(elevated) "elevated" else appearance
    val isSelectable get()=selectable ?: (variant=="filter" || variant=="input")
    val isRemovable get()=removable ?: (variant=="input")
    /** `colorVars`: only a plain CSS ident switches the colour-role rules on. */
    val colored get()=!color.isNullOrEmpty() && Regex("^[a-zA-Z][a-zA-Z0-9-]*$").matches(color)
    val selectedClass get()=selected && isSelectable
    val elevatedClass get()=effectiveAppearance=="elevated"
    val tonal get()=effectiveAppearance=="filled" || effectiveAppearance=="elevated"
    val isInteractiveHost get()=!(selectable==false && isRemovable)
    val hostIsButton get()=isInteractiveHost && !isRemovable
    val renderPrimary get()=isInteractiveHost && isRemovable
    fun showCheckmark(hasLeading:Boolean)=variant=="filter" && selected && !hasLeading
    companion object {
        fun of(p:Props,selected:Boolean)=ChipModel(p.str("variant").takeIf { it in setOf("assist","filter","input","suggestion") } ?: "assist",p.str("icon"),p.str("trailingIcon"),selected,
            (p["selectable"] as? Boolean),p.str("appearance").takeIf { it in setOf("outlined","filled","elevated") } ?: "outlined",(p["color"] as? String),p.bool("elevated"),
            p.bool("disabled"),p.bool("softDisabled"),(p["removable"] as? Boolean),p.str("label"),p.str("contentAlign").takeIf { it in setOf("start","center","end") } ?: "center",
            (p["density"] as? Number)?.toDouble(),p.bool("hidden"))
    }
}
internal data class ChipStates(val hover:Boolean=false,val focusVisible:Boolean=false,val active:Boolean=false)
internal data class ChipResolved(val container:Color,val label:Color,val icon:Color,val outline:Color,val outlineVisible:Boolean,val stateLayer:Color,val elevation:List<NativeShadowLayer>)
/** The source cascade (md-chip.css), rule by rule in specificity and source order. */
internal class ChipStyle(val m:ChipModel,val a:AWCChipHookAppearance,val parts:AWCChipPartAppearance,val tokens:Map<String,String>) {
    fun token(name:String,fallback:String)=awcColor(tokens["--md-sys-color-$name"] ?: fallback,Color.Black)
    fun elevation(level:Int)=NativeShadowLayer.parse(tokens["--md-sys-elevation-$level"] ?: "none")
    private fun hex(v:String?)=v?.let(::statusDotColor)
    val onSurface get()=token("on-surface","#1C1B1F")
    val resolved:ChipResolved get() {
        val primary=token("primary","#6750A4");val osv=token("on-surface-variant","#49454F")
        val sc=token("secondary-container","#E8DEF8");val osc=token("on-secondary-container","#1D192B")
        val role=if(m.colored) Triple(tokens["--md-sys-color-${m.color}"]?.let { awcColor(it,primary) } ?: primary,
            tokens["--md-sys-color-${m.color}-container"]?.let { awcColor(it,sc) } ?: sc,tokens["--md-sys-color-on-${m.color}-container"]?.let { awcColor(it,osc) } ?: osc) else Triple(primary,sc,osc)
        // :host (0,1,0)
        var container=hex(a.containerColor) ?: Color.Transparent;val containerSelected=hex(a.containerColorSelected) ?: sc
        var label=hex(a.labelColor) ?: osv;var labelSelected=hex(a.labelColorSelected) ?: osc
        var icon=hex(a.iconColor) ?: primary;var outline=hex(a.outlineColor) ?: token("outline","#79747E")
        var layer=hex(a.stateLayerColor) ?: onSurface;var shadow=a.elevation?.map { it.resolved() } ?: emptyList()
        var hostColor:Color?=null
        // (0,2,0) in source order.
        when(m.variant) {
            "assist"->{ icon=hex(a.iconColor) ?: primary;label=hex(a.labelColor) ?: onSurface }
            "filter","suggestion"->{ icon=hex(a.iconColor) ?: osv;label=hex(a.labelColor) ?: osv }
            "input"->{ outline=hex(a.outlineColor) ?: token("outline-variant","#CAC4D0");icon=hex(a.iconColor) ?: osv;label=hex(a.labelColor) ?: osv }
        }
        if(m.selectedClass) { container=containerSelected;hostColor=labelSelected;icon=hex(a.iconColor) ?: osc;layer=hex(a.stateLayerColor) ?: osc }
        if(m.elevatedClass) shadow=a.elevation?.map { it.resolved() } ?: elevation(1)
        if(m.tonal) { container=hex(a.containerColor) ?: token("surface-container-high","#ECE6F0");label=hex(a.labelColor) ?: osv;icon=hex(a.iconColor) ?: osv }
        // (0,3,0) in source order.
        if(m.elevatedClass && m.selectedClass) shadow=a.elevation?.map { it.resolved() } ?: elevation(1)
        if(m.effectiveAppearance=="outlined" && m.colored) { outline=hex(a.outlineColor) ?: role.first;label=hex(a.labelColor) ?: role.first;icon=hex(a.iconColor) ?: role.first;layer=hex(a.stateLayerColor) ?: role.first }
        if(m.selectedClass && m.tonal) { container=containerSelected;icon=hex(a.iconColor) ?: osc }
        if(m.tonal && m.colored) { container=hex(a.containerColor) ?: role.second;label=hex(a.labelColor) ?: role.third;icon=hex(a.iconColor) ?: role.third;layer=hex(a.stateLayerColor) ?: role.third }
        if(m.selectedClass && m.colored) { container=hex(a.containerColorSelected) ?: role.second;labelSelected=hex(a.labelColorSelected) ?: role.third;hostColor=labelSelected
            icon=hex(a.iconColor) ?: role.third;layer=hex(a.stateLayerColor) ?: role.third }
        val dis=m.effectivelyDisabled
        if(dis && m.selectedClass) container=onSurface.copy(alpha=.12f)
        // (0,4,0): disabled filled and elevated chips share the dimmed tonal container.
        if(dis && (m.elevatedClass || m.effectiveAppearance=="filled") && !m.selectedClass) container=onSurface.copy(alpha=.12f)
        // !important: disabled content colours and elevation.
        if(dis) { hostColor=onSurface.copy(alpha=.38f);icon=onSurface.copy(alpha=.38f);shadow=emptyList() }
        var outlineVisible=!(m.selectedClass || m.elevatedClass || m.effectiveAppearance=="filled")
        if(dis && !m.selectedClass && !m.elevatedClass && m.effectiveAppearance!="filled") { outline=onSurface.copy(alpha=.12f);outlineVisible=true }
        return ChipResolved(container,hostColor ?: label,icon,outline,outlineVisible,layer,shadow)
    }
    fun layerOpacity(s:ChipStates):Double {
        parts.stateLayerOpacity?.let { return it }
        var o=0.0
        if(s.hover) o=.08;if(s.focusVisible) o=.12;if(s.active) o=.12
        if(m.effectivelyDisabled && (s.hover || s.active || s.focusVisible)) o=0.0
        return o
    }
    /** `:host([soft-disabled]) .md-chip__state-layer { display: none }`. */
    val layerVisible get()=!m.softDisabled
    val focusRingColor get()=token("secondary","#625B71")
}

/** Chip interaction styles on the composition frame clock (state layer, elevation, container, ink, ripple). */
internal class NativeChipState {
    var frameMillis by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var pending:List<Any>?=null
    var timing=Pair(50.0,100.0);var curve=listOf(.2,0.0,0.0,1.0)
    val layer=AWCCSSValueTrack(0.0,accordionLerp)
    val shadow=AWCCSSValueTrack(emptyList(),cardShadowLerp)
    val background=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    val ink=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    var primed=false
    val waves=mutableStateListOf<AccordionRippleWave>()
    fun running(now:Double)=pending!=null || layer.isRunning(now) || shadow.isRunning(now) || background.isRunning(now) || ink.isRunning(now) || waves.any { it.animating(now) }
    @Suppress("UNCHECKED_CAST")
    fun apply(now:Double) {
        val t=pending ?: return;pending=null
        val l=t[0] as Double;val s=t[1] as List<NativeShadowLayer>;val b=t[2] as Color;val i=t[3] as Color
        if(!primed) { layer.snap(l);shadow.snap(s);background.snap(b);ink.snap(i);primed=true;return }
        layer.set(l,now,timing.first,curve);shadow.set(s,now,timing.second,curve);background.set(b,now,timing.second,curve);ink.set(i,now,timing.second,curve)
    }
}
/** Rendered chip values for inspection (tests, Laboratory inspector). Times are frame-clock milliseconds. */
class AWCChipInspection internal constructor(private val s:NativeChipState,internal val read:()->Map<String,Any?>) {
    val frameMillis get()=s.frameMillis
    fun layerOpacity(t:Double)=s.layer.presented(t)
    fun shadow(t:Double):List<List<Double>> = s.shadow.presented(t).map { listOf(it.x,it.y,it.blur,it.spread,it.color.red.toDouble(),it.color.green.toDouble(),it.color.blue.toDouble(),it.color.alpha.toDouble()) }
    fun background(t:Double)=s.background.presented(t).let { listOf(it.red.toDouble(),it.green.toDouble(),it.blue.toDouble(),it.alpha.toDouble()) }
    fun ink(t:Double)=s.ink.presented(t).let { listOf(it.red.toDouble(),it.green.toDouble(),it.blue.toDouble(),it.alpha.toDouble()) }
    /** The newest ripple wave: origin (dp, chip box), radius, scale and opacity at [t]. */
    fun ripple(t:Double)=s.waves.lastOrNull()?.takeIf { it.began!=null && !it.done(t) }?.let { mapOf("x" to it.origin.x.toDouble(),"y" to it.origin.y.toDouble(),"radius" to it.radius,"scale" to it.scale(t),"opacity" to it.opacity(t)) }
    val values get()=read()
}

private object ChipLeadingSlot
private object ChipTrailingSlot
private object ChipLabelSlot
private object ChipCheckmark
private object ChipIcon
private object ChipRemove
private object ChipTrailingIcon
private val ChipCheckmarkPoints=listOf(6.75 to 12.127,3.623 to 9.0,2.563 to 10.057,6.75 to 14.25,15.75 to 5.25,14.693 to 4.193)
private val ChipRemovePoints=listOf(14.25 to 4.808,13.192 to 3.75,9.0 to 7.942,4.808 to 3.75,3.75 to 4.808,7.942 to 9.0,3.75 to 13.192,4.808 to 14.25,9.0 to 10.058,13.192 to 14.25,14.25 to 13.192,10.058 to 9.0)
private fun chipGlyph(points:List<Pair<Double,Double>>,size:Float):Path { val s=size/18f
    return Path().apply { moveTo(points[0].first.toFloat()*s,points[0].second.toFloat()*s);for(q in points.drop(1)) lineTo(q.first.toFloat()*s,q.second.toFloat()*s);close() } }
/** Chrome keeps focus on a chip for an unhandled arrow key (no spatial navigation); the key event still bubbles to ancestors (gate-7 R4-08). */
private val chipArrowStop=Modifier.focusProperties { left=androidx.compose.ui.focus.FocusRequester.Cancel;right=androidx.compose.ui.focus.FocusRequester.Cancel;up=androidx.compose.ui.focus.FocusRequester.Cancel;down=androidx.compose.ui.focus.FocusRequester.Cancel }

private fun chipPath(shape:AWCCornerShape,width:Float,height:Float,density:Float,inset:Float):Path {
    val radii=shape.radii((width+2*inset)/density.toDouble(),(height+2*inset)/density.toDouble())
    fun r(v:Double)=max(0f,(v*density).toFloat()-inset)
    return Path().apply { addRoundRect(RoundRect(Rect(inset,inset,inset+width,inset+height),CornerRadius(r(radii[0].first),r(radii[0].second)),CornerRadius(r(radii[1].first),r(radii[1].second)),
        CornerRadius(r(radii[2].first),r(radii[2].second)),CornerRadius(r(radii[3].first),r(radii[3].second)))) }
}

/** md-chip: the source chip with its leading-icon, default and trailing-icon slots, native input, focus and removal. */
@Composable
internal fun NativeChip(p:Props,onEvent:EventSink,slot:Slot?) {
    var selected by awcState(p["selected"]) { p.bool("selected") }
    var removed by remember { mutableStateOf(false) }
    val m=ChipModel.of(p,selected)
    if(m.hidden || removed) return
    val emit by rememberUpdatedState(onEvent)
    val tokens=LocalAWCThemeTokens.current;val dens=LocalDensity.current.density
    val appearance=LocalAWCChipAppearance.current;val parts=LocalAWCChipPartAppearance.current
    val style=ChipStyle(m,appearance,parts,tokens);val r=style.resolved
    val inherited=LocalAWCNativeDensity.current
    val d=resolveAWCDensity(p["density"],inherited)
    // md3.css spacing tokens: the nearest density rung that defines each token wins (own rung, then the ancestors'; gate-7 R4-02).
    val spacingRungs=LocalAWCDensityRungs.current.ifEmpty { listOfNotNull(m.density?.takeIf { it in listOf(-1.0,-2.0,-3.0,-4.0) },inherited.takeIf { it<=-1 }) }
    val reduced=LocalAWCChipReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val dir=LocalLayoutDirection.current;val rtl=dir==LayoutDirection.Rtl
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current;val targetID=remember { java.util.UUID.randomUUID().toString() }
    val state=remember { NativeChipState() }
    var hover by remember { mutableStateOf(false) };var pressed by remember { mutableStateOf(false) }
    var hostFocused by remember { mutableStateOf(false) };var removeFocused by remember { mutableStateOf(false) }
    // Focus taken by a pointer press is not :focus-visible (per target, like the source's two buttons).
    var hostPointerFocus by remember { mutableStateOf(false) };var removePointerFocus by remember { mutableStateOf(false) }
    var root by remember { mutableStateOf(Offset.Zero) };var size by remember { mutableStateOf(androidx.compose.ui.geometry.Size.Zero) }
    var removeBox by remember { mutableStateOf(Rect.Zero) }
    var hasLeadingSlot by remember { mutableStateOf(false) };var hasTrailingSlot by remember { mutableStateOf(false) }
    val hostFocus=remember { FocusRequester() };val removeFocus=remember { FocusRequester() }
    val pointerInert=m.effectivelyDisabled && !m.softDisabled
    val hasLeading=m.icon.isNotEmpty() || hasLeadingSlot;val showCheckmark=m.showCheckmark(hasLeading)
    val hasTrailing=m.trailingIcon.isNotEmpty() || hasTrailingSlot
    val hostRing=m.hostIsButton && hostFocused && !hostPointerFocus
    val primaryRing=m.renderPrimary && hostFocused && !hostPointerFocus
    val removeRing=m.isRemovable && removeFocused && !removePointerFocus
    // Only a button-role host matches :host(:focus-visible); inner primary / remove focus leaves the layer at rest.
    val states=ChipStates(hover && !pointerInert,hostRing,pressed && !pointerInert)
    val easing=accordionCubicBezierCurve(tokens["--md-sys-motion-easing-standard"]) ?: listOf(.2,0.0,0.0,1.0)
    state.timing=if(reduced) 0.0 to 0.0 else (cardDuration(tokens,"--md-sys-motion-duration-short1",50.0) to cardDuration(tokens,"--md-sys-motion-duration-short2",100.0))
    state.curve=easing
    val target4=listOf(style.layerOpacity(states),r.elevation,r.container,r.label)
    SideEffect { if(!state.primed || target4[0]!=state.layer.value || target4[1]!=state.shadow.value || target4[2]!=state.background.value || target4[3]!=state.ink.value) { state.pending=target4;state.version++
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
    fun dispatch(name:String,detail:Map<String,AWCValue>):Boolean {
        val event=AWCActionEvent(name,"md-chip",detail,targetID=target?.id ?: targetID)
        dispatchNativeAction(event,actions,target?.listeners?.invoke().orEmpty())
        emit(name,if(detail.isEmpty()) null else detail)
        return event.defaultPrevented
    }
    /** `handleClick`: disabled chips cancel the click; selectable chips toggle (mdSelect), then mdClick. */
    fun click() {
        if(m.effectivelyDisabled) return
        if(m.isSelectable) { val next=!selected;selected=next;dispatch("mdSelect",mapOf("selected" to next)) }
        dispatch("mdClick",emptyMap())
    }
    fun dispatchRemove() { if(m.effectivelyDisabled) return;if(!dispatch("mdRemove",emptyMap())) removed=true }
    fun wave(o:Offset,release:Boolean) { if(m.effectivelyDisabled) return
        state.waves+=AccordionRippleWave(o,AccordionRippleWave.radius(o,(size.width/dens).toDouble(),(size.height/dens).toDouble())).also { it.releasePending=release };state.version++ }
    fun keyboardActivate() { if(m.effectivelyDisabled) return;wave(Offset(size.width/2/dens,size.height/2/dens),true);click() }
    val fontSize=max(11.0,14+.5*d);val lineHeight=max(16.0,20+d)
    val iconSize=appearance.iconSize ?: max(14.0,18+d)
    val height=max(24.0,(appearance.containerHeight ?: 32.0)+4*d)
    val insetLg=AWCSpacingTokens.token("inset-lg",spacingRungs);val insetSm=AWCSpacingTokens.token("inset-sm",spacingRungs);val gap=AWCSpacingTokens.token("gap-sm",spacingRungs)
    val leadPad=if(hasLeading || showCheckmark) insetSm else insetLg;val trailPad=if(hasTrailing || m.isRemovable) insetSm else insetLg
    val shape=appearance.containerShape ?: AWCCornerShape.uniform(tokens["--md-sys-shape-corner-small"]?.removeSuffix("px")?.toDoubleOrNull() ?: 8.0)
    val iconInk=r.icon;val labelInk=parts.labelColor?.let(::statusDotColor);val outlineWidth=parts.outlineWidth ?: appearance.outlineWidth ?: 1.0
    val outlineInk=parts.outlineColor?.let(::statusDotColor) ?: if(r.outlineVisible) r.outline else Color.Transparent
    val layerInk=parts.stateLayerColor?.let(::statusDotColor) ?: r.stateLayer
    val inspector=LocalAWCChipInspector.current
    val stretchToWidth=LocalAWCChipStretch.current
    val label=m.label
    val values={ mapOf("role" to if(m.hostIsButton) "button" else "group","primary" to m.renderPrimary,
        "tabindex" to (if(m.hostIsButton) (if(m.disabled) -1 else 0) else -2),"primaryTabindex" to (if(m.renderPrimary) (if(m.disabled) -1 else 0) else -2),
        "removeTabindex" to (if(m.isRemovable) (if(m.disabled) -1 else 0) else -2),"pressedState" to (if(m.isSelectable && m.isInteractiveHost) selected.toString() else ""),
        "selected" to selected,"paddingLeft" to (if(rtl) trailPad else leadPad),"paddingRight" to (if(rtl) leadPad else trailPad),"gap" to gap,"fontSize" to fontSize,"lineHeight" to lineHeight,
        "iconSize" to iconSize,"height" to height,"checkmark" to showCheckmark,"iconColor" to iconInk,"outlineColor" to outlineInk,"outlineWidth" to outlineWidth,
        "layerVisible" to style.layerVisible,"stateLayerColor" to layerInk,"hostRing" to hostRing,"primaryRing" to primaryRing,"removeRing" to removeRing,
        "hostFocused" to hostFocused,"removeFocused" to removeFocused,"hover" to states.hover,"active" to states.active,"label" to label) }
    if(inspector!=null) { val current=AWCChipInspection(state,values);SideEffect { inspector(current) } }
    val inspection=LocalAWCInspection.current
    val ringColor=style.focusRingColor
    val textInk=state.ink.presented(state.frameMillis)
    Layout(content={
        if(showCheckmark) Box(Modifier.layoutId(ChipCheckmark).size(iconSize.dp).inspectAWCNode(inspection,"checkmark","checkmark")
            // `this.size`: the glyph box (the DrawScope), not NativeChip's `size` state (the whole chip).
            .drawBehind { drawPath(chipGlyph(ChipCheckmarkPoints,this.size.width),parts.checkmarkColor?.let(::statusDotColor) ?: iconInk) })
        Box(Modifier.layoutId(ChipLeadingSlot)) {
            CompositionLocalProvider(LocalContentColor provides iconInk,LocalAWCButtonSlotSize provides iconSize.dp) { slot?.invoke("leading-icon") } }
        if(m.icon.isNotEmpty() && !showCheckmark) Box(Modifier.layoutId(ChipIcon).inspectAWCNode(inspection,"icon","icon")) {
            CompositionLocalProvider(LocalContentColor provides (parts.iconColor?.let(::statusDotColor) ?: iconInk)) { AWCMaterialSymbol(m.icon,size=iconSize.dp) } }
        Box(Modifier.layoutId(ChipLabelSlot).inspectAWCNode(inspection,"label","label")) {
            val ink=labelInk ?: textInk
            CompositionLocalProvider(LocalContentColor provides ink) {
                if(label.isNotEmpty()) ChipLabel(label,TextStyle(color=ink,fontFamily=AccordionRoboto,fontWeight=FontWeight.Medium,fontSize=fontSize.sp,lineHeight=lineHeight.sp,letterSpacing=.1.sp,
                    platformStyle=androidx.compose.ui.text.PlatformTextStyle(includeFontPadding=false)),lineHeight)
                // Authored default-slot text inherits the label typography, as slotted text inherits the source label's font.
                else Box(Modifier.height(lineHeight.dp),contentAlignment=Alignment.CenterStart) {
                    CompositionLocalProvider(androidx.compose.material3.LocalTextStyle provides androidx.compose.material3.LocalTextStyle.current.merge(TextStyle(color=ink,fontFamily=AccordionRoboto,
                        fontWeight=FontWeight.Medium,fontSize=fontSize.sp,lineHeight=lineHeight.sp,letterSpacing=.1.sp))) { slot?.invoke("") } }
            }
        }
        if(m.isRemovable) {
            val removeInk=parts.removeColor?.let(::statusDotColor) ?: iconInk
            Box(Modifier.layoutId(ChipRemove).size(max(18.0,iconSize).dp).inspectAWCNode(inspection,"remove","remove")
                .onGloballyPositioned { val p0=it.positionInRoot();removeBox=Rect(p0.x-root.x,p0.y-root.y,p0.x-root.x+it.size.width,p0.y-root.y+it.size.height) }
                .drawWithContent { drawContent()
                    if(removeRing) drawCircle(ringColor,size.minDimension/2+2*density,style=Stroke(2*density)) }
                // Its own element even when it cannot take focus (disabled): Web exposes a separate (disabled) button.
                .semantics(mergeDescendants=true) { role=Role.Button;contentDescription=if(label.isEmpty()) "Remove" else "Remove $label";if(m.effectivelyDisabled) disabled() }
                .focusRequester(removeFocus).onFocusChanged { removeFocused=it.isFocused;if(!it.isFocused) removePointerFocus=false }
                .then(if(m.effectivelyDisabled) Modifier.focusProperties { canFocus=false } else chipArrowStop.focusable())
                .onKeyEvent { e-> if(e.type!=KeyEventType.KeyDown) false else when(e.key) {
                    Key.Enter,Key.NumPadEnter,Key.Spacebar,Key.Delete,Key.Backspace->{ dispatchRemove();true }
                    else->false } },contentAlignment=Alignment.Center) {
                // Slotted trailing-icon content replaces the ✕ glyph inside the remove button.
                ChipSlotOr({ CompositionLocalProvider(LocalContentColor provides removeInk,LocalAWCButtonSlotSize provides iconSize.dp) { slot?.invoke("trailing-icon") } },
                    { Box(Modifier.fillMaxSize().drawBehind { drawPath(chipGlyph(ChipRemovePoints,this.size.width),removeInk) }) },(iconSize*dens).roundToInt()) { if(it!=hasTrailingSlot) hasTrailingSlot=it }
            }
        } else {
            Box(Modifier.layoutId(ChipTrailingSlot)) {
                CompositionLocalProvider(LocalContentColor provides iconInk,LocalAWCButtonSlotSize provides iconSize.dp) { slot?.invoke("trailing-icon") } }
            if(m.trailingIcon.isNotEmpty()) Box(Modifier.layoutId(ChipTrailingIcon).inspectAWCNode(inspection,"trailing-icon","trailing-icon")) {
                CompositionLocalProvider(LocalContentColor provides (parts.trailingIconColor?.let(::statusDotColor) ?: iconInk)) { AWCMaterialSymbol(m.trailingIcon,size=iconSize.dp) } }
        }
    },modifier=Modifier
        .onGloballyPositioned { root=it.positionInRoot();size=androidx.compose.ui.geometry.Size(it.size.width.toFloat(),it.size.height.toFloat()) }
        .inspectAWCNode(inspection,"","md-chip")
        .accordionShadow(shape,{ state.shadow.presented(state.frameMillis) },false)
        .drawWithContent {
            drawContent()
            if(hostRing) { val o=3.5f*density;drawPath(chipPath(shape,size.width+2*o,size.height+2*o,density,-o),ringColor,style=Stroke(3f*density)) }
            // ::part(primary) outline: the focus-visible ring unless the part restyles it (gate-7 R4-09).
            if(m.renderPrimary && (parts.primaryOutlineStyle ?: if(primaryRing) "solid" else "none")=="solid") {
                val w=(parts.primaryOutlineWidth ?: 3.0).toFloat();val o=(-((parts.primaryOutlineOffset ?: -3.0).toFloat()+w/2f))*density
                drawPath(chipPath(shape,size.width-2*o,size.height-2*o,density,o),parts.primaryOutlineColor?.let(::statusDotColor) ?: ringColor,style=Stroke(w*density)) }
        }
        .clip(shape)
        .drawBehind {
            drawRect(state.background.presented(state.frameMillis))
            val now=state.frameMillis
            if(!m.effectivelyDisabled) for(w in state.waves) { if(w.began==null || w.done(now)) continue
                val rr=(w.radius*w.scale(now)*density).toFloat();if(rr>0f) drawCircle(textInk.copy(alpha=textInk.alpha*w.opacity(now).toFloat()),rr,Offset(w.origin.x*density,w.origin.y*density)) }
            val wpx=(outlineWidth*density).toFloat();if(wpx>0f) drawPath(chipPath(shape,size.width-wpx,size.height-wpx,density,wpx/2f),outlineInk,style=Stroke(wpx))
            if(style.layerVisible) drawRect(layerInk.copy(alpha=layerInk.alpha*state.layer.presented(now).toFloat()))
            if(m.renderPrimary) parts.primaryBackground?.let(::statusDotColor)?.let { drawRect(it) }   // ::part(primary) background (gate-7 R4-09)
        }
        .semantics(mergeDescendants=m.isInteractiveHost) {
            if(m.isInteractiveHost) { role=Role.Button;if(m.isSelectable) this.selected=selected }
            else { contentDescription=label }
            if(m.effectivelyDisabled) disabled()
        }
        .focusRequester(hostFocus).onFocusChanged { hostFocused=it.isFocused;if(!it.isFocused) hostPointerFocus=false }
        .then(if(m.isInteractiveHost && !m.disabled) chipArrowStop.focusable() else Modifier.focusProperties { canFocus=false }.focusTarget())
        .onKeyEvent { e-> if(e.type!=KeyEventType.KeyDown || !hostFocused) false else when(e.key) {
            Key.Enter,Key.NumPadEnter,Key.Spacebar->{ if(m.isInteractiveHost) keyboardActivate();m.isInteractiveHost }
            Key.Delete,Key.Backspace->{ if(m.isRemovable) dispatchRemove();m.isRemovable }
            else->false } }
        .pointerInput(m,pointerInert) {
            awaitPointerEventScope {
                var onRemove=false
                while(true) {
                    val e=awaitPointerEvent(PointerEventPass.Final)
                    val c=e.changes.firstOrNull() ?: continue
                    val p0=c.position;val inside=p0.x>=0 && p0.y>=0 && p0.x<size.width && p0.y<size.height
                    if(pointerInert) { hover=false;continue }
                    when(e.type) {
                        PointerEventType.Enter,PointerEventType.Move->{ if(c.type==PointerType.Mouse) hover=inside }
                        PointerEventType.Exit->{ hover=false }
                        PointerEventType.Press->{ pressed=true;hover=inside
                            onRemove=m.isRemovable && removeBox.contains(p0)
                            if(onRemove) { removePointerFocus=true;runCatching { removeFocus.requestFocus() } }
                            else if(m.isInteractiveHost) { hostPointerFocus=true;runCatching { hostFocus.requestFocus() } }
                            wave(Offset(p0.x/dens,p0.y/dens),false) }
                        PointerEventType.Release->{ pressed=false
                            state.waves.lastOrNull()?.releasePending=true;state.version++
                            val cancelled=e.motionEvent.let { it==null || it.actionMasked==android.view.MotionEvent.ACTION_CANCEL }
                            if(!cancelled && inside) { if(onRemove) { if(removeBox.contains(p0)) dispatchRemove() } else if(!(m.isRemovable && removeBox.contains(p0))) click() }
                            onRemove=false
                            hover=c.type==PointerType.Mouse && inside }
                        else->{}
                    }
                }
            }
        }) { measurables,constraints->
        val px={ v:Double-> (v*dens).roundToInt() }
        val h=px(height)
        fun find(id:Any)=measurables.firstOrNull { it.layoutId===id }
        // Slot presence (the source's slotchange state): authored content has an intrinsic width.
        val leadSlotM=find(ChipLeadingSlot);val trailSlotM=find(ChipTrailingSlot)
        val ls=(leadSlotM?.maxIntrinsicWidth(h) ?: 0)>0;val ts=(trailSlotM?.maxIntrinsicWidth(h) ?: 0)>0
        if(ls!=hasLeadingSlot) hasLeadingSlot=ls;if(!m.isRemovable && ts!=hasTrailingSlot) hasTrailingSlot=ts
        val lead=if(m.icon.isNotEmpty() || ls || m.showCheckmark(m.icon.isNotEmpty() || ls)) insetSm else insetLg
        val trail=if(m.trailingIcon.isNotEmpty() || (if(m.isRemovable) hasTrailingSlot else ts) || m.isRemovable) insetSm else insetLg
        val items=mutableListOf<androidx.compose.ui.layout.Placeable>()
        find(ChipCheckmark)?.measure(Constraints())?.let { if(!ls) items+=it }
        leadSlotM?.measure(Constraints.fixed(px(iconSize),px(iconSize)))?.let { if(ls) items+=it }
        find(ChipIcon)?.measure(Constraints())?.let { if(!ls) items+=it }
        val labelM=find(ChipLabelSlot)
        val tail=mutableListOf<androidx.compose.ui.layout.Placeable>()
        find(ChipRemove)?.measure(Constraints())?.let { tail+=it }
        trailSlotM?.measure(Constraints.fixed(px(iconSize),px(iconSize)))?.let { if(ts && !m.isRemovable) tail+=it }
        find(ChipTrailingIcon)?.measure(Constraints())?.let { if(!ts) tail+=it }
        val fixedW=items.sumOf { it.width }+tail.sumOf { it.width }+px(lead)+px(trail)
        val count=items.size+tail.size+1;val gaps=px(gap)*(count-1)
        val labelIdeal=labelM?.maxIntrinsicWidth(h) ?: 0
        val stretch=constraints.hasBoundedWidth && (stretchToWidth || constraints.minWidth==constraints.maxWidth)
        val maxW=if(constraints.hasBoundedWidth) constraints.maxWidth else Int.MAX_VALUE
        val w=if(stretch) max(constraints.maxWidth,fixedW+gaps) else min(maxW,fixedW+gaps+labelIdeal).coerceAtLeast(fixedW+gaps)
        val labelW=min(labelIdeal,(w-fixedW-gaps).coerceAtLeast(0))
        val labelP=labelM?.measure(Constraints(minWidth=if(stretch || labelW<labelIdeal) labelW else 0,maxWidth=labelW))
        val row=items+listOfNotNull(labelP)+tail
        layout(w,h) {
            val used=row.sumOf { it.width }+gaps;val free=(w-px(lead)-px(trail)-used).coerceAtLeast(0)
            val align=when(m.contentAlign) { "start"->0;"end"->free;else->free/2 }
            var x=px(lead)+align
            for(pl in row) { pl.placeRelative(x,(h-pl.height)/2);x+=pl.width+px(gap) }
        }
    }
}

/** Slot content when it is authored (non-zero intrinsic width), else the [fallback]; both in a [size] px box. */
@Composable private fun ChipSlotOr(slotContent:@Composable ()->Unit,fallback:@Composable ()->Unit,size:Int,onSlotted:(Boolean)->Unit) {
    Layout(contents=listOf(slotContent,fallback)) { (slotted,defaults),_->
        val authored=slotted.any { it.maxIntrinsicWidth(size)>0 }
        onSlotted(authored)
        val placeables=(if(authored) slotted else defaults).map { it.measure(Constraints.fixed(size,size)) }
        layout(size,size) { placeables.forEach { it.place(0,0) } }
    }
}

/**
 * The chip label: a CSS flex item with min-width 0 and `text-overflow: ellipsis`. Its content box is the shaped
 * advance (Chrome's subpixel width, rounded to device pixels, without Compose's intrinsic guard pixels); a
 * narrower box ellipsizes; the line box is the label line height with the glyphs centred in it.
 */
@Composable private fun ChipLabel(text:String,style:TextStyle,lineHeight:Double) {
    val context=androidx.compose.ui.platform.LocalContext.current
    val density=LocalDensity.current;val direction=LocalLayoutDirection.current
    val face=remember { context.resources.getFont(R.font.awc_roboto_medium) }
    val precise=remember(text,style,density,direction) { android.text.TextPaint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.SUBPIXEL_TEXT_FLAG).run {
        typeface=face;textSize=with(density) { style.fontSize.toPx() };letterSpacing=style.letterSpacing.value/style.fontSize.value;isLinearText=true
        getRunAdvance(text,0,text.length,0,text.length,direction==LayoutDirection.Rtl,text.length) } }
    val natural=precise.roundToInt()
    Layout(content={ Text(text,style=style,maxLines=1,softWrap=false,overflow=TextOverflow.Ellipsis) },measurePolicy=object:androidx.compose.ui.layout.MeasurePolicy {
        override fun androidx.compose.ui.layout.MeasureScope.measure(measurables:List<androidx.compose.ui.layout.Measurable>,constraints:Constraints):androidx.compose.ui.layout.MeasureResult {
            val width=constraints.constrainWidth(natural);val h=(lineHeight*density.density).roundToInt()
            val paragraph=if(width>=natural) max(width,kotlin.math.ceil(precise).toInt()) else width
            val child=measurables.single().measure(Constraints(minWidth=paragraph,maxWidth=paragraph))
            return layout(width,h) { child.placeRelative(0,(h-child.height)/2) }
        }
        override fun androidx.compose.ui.layout.IntrinsicMeasureScope.maxIntrinsicWidth(measurables:List<androidx.compose.ui.layout.IntrinsicMeasurable>,height:Int)=natural
        override fun androidx.compose.ui.layout.IntrinsicMeasureScope.minIntrinsicWidth(measurables:List<androidx.compose.ui.layout.IntrinsicMeasurable>,height:Int)=0
        override fun androidx.compose.ui.layout.IntrinsicMeasureScope.maxIntrinsicHeight(measurables:List<androidx.compose.ui.layout.IntrinsicMeasurable>,width:Int)=(lineHeight*density.density).roundToInt()
        override fun androidx.compose.ui.layout.IntrinsicMeasureScope.minIntrinsicHeight(measurables:List<androidx.compose.ui.layout.IntrinsicMeasurable>,width:Int)=(lineHeight*density.density).roundToInt()
    })
}
