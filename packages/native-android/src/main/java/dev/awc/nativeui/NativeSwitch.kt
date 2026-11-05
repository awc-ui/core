package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.max

private val SwitchHex=Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$")
internal fun switchColorHex(value:String?)=value?.takeIf { it.matches(SwitchHex) }?.uppercase(java.util.Locale.ROOT)
private fun switchLength(value:Double?)=value?.takeIf { it.isFinite() && it>=0 }

/**
 * The twelve public md-switch hooks (`--md-switch-*`). Track width replaces the density-scaled
 * default; track height is the density base (each rung trims 4 dp, floored at 16); handle size
 * replaces the selected handle (unselected = 2/3, pressed = 7/6 of it). Colours are `#RRGGBB` or
 * `#RRGGBBAA`. Interaction and disabled rules still override the colour hooks where the source does.
 */
@Immutable data class AWCSwitchAppearance(
    val trackWidth:Double?=null,val trackHeight:Double?=null,val handleSize:Double?=null,
    val trackColor:String?=null,val trackOutlineColor:String?=null,val handleColor:String?=null,
    val selectedTrackColor:String?=null,val selectedHandleColor:String?=null,
    val iconColor:String?=null,val selectedIconColor:String?=null,val stateLayerColor:String?=null,val focusRingColor:String?=null,
) {
    internal fun normalized()=AWCSwitchAppearance(switchLength(trackWidth),switchLength(trackHeight),switchLength(handleSize),
        switchColorHex(trackColor),switchColorHex(trackOutlineColor),switchColorHex(handleColor),switchColorHex(selectedTrackColor),
        switchColorHex(selectedHandleColor),switchColorHex(iconColor),switchColorHex(selectedIconColor),switchColorHex(stateLayerColor),switchColorHex(focusRingColor))
    fun merge(o:AWCSwitchAppearance)=AWCSwitchAppearance(o.trackWidth ?: trackWidth,o.trackHeight ?: trackHeight,o.handleSize ?: handleSize,
        o.trackColor ?: trackColor,o.trackOutlineColor ?: trackOutlineColor,o.handleColor ?: handleColor,o.selectedTrackColor ?: selectedTrackColor,
        o.selectedHandleColor ?: selectedHandleColor,o.iconColor ?: iconColor,o.selectedIconColor ?: selectedIconColor,
        o.stateLayerColor ?: stateLayerColor,o.focusRingColor ?: focusRingColor)
    companion object {
        /** Typed hooks from plain data (Laboratory transport); invalid fields are ignored. */
        fun fromValues(values:Map<String,AWCValue>):AWCSwitchAppearance {
            fun n(key:String)=(values[key] as? Number)?.toDouble()
            fun s(key:String)=values[key] as? String
            return AWCSwitchAppearance(n("trackWidth"),n("trackHeight"),n("handleSize"),s("trackColor"),s("trackOutlineColor"),s("handleColor"),
                s("selectedTrackColor"),s("selectedHandleColor"),s("iconColor"),s("selectedIconColor"),s("stateLayerColor"),s("focusRingColor")).normalized()
        }
    }
}

/** `::part(track|handle|icon|state-layer)` styling: outer-tree rules win over hooks and every state and disabled rule. */
@Immutable data class AWCSwitchPartAppearance(
    val trackColor:String?=null,val trackOutlineColor:String?=null,val trackShape:AWCCornerShape?=null,
    val handleColor:String?=null,val handleShape:AWCCornerShape?=null,val handleOpacity:Double?=null,
    val iconColor:String?=null,val stateLayerColor:String?=null,
) {
    internal fun normalized()=AWCSwitchPartAppearance(switchColorHex(trackColor),switchColorHex(trackOutlineColor),trackShape,
        switchColorHex(handleColor),handleShape,handleOpacity?.takeIf { it.isFinite() }?.coerceIn(0.0,1.0),switchColorHex(iconColor),switchColorHex(stateLayerColor))
    fun merge(o:AWCSwitchPartAppearance)=AWCSwitchPartAppearance(o.trackColor ?: trackColor,o.trackOutlineColor ?: trackOutlineColor,o.trackShape ?: trackShape,
        o.handleColor ?: handleColor,o.handleShape ?: handleShape,o.handleOpacity ?: handleOpacity,o.iconColor ?: iconColor,o.stateLayerColor ?: stateLayerColor)
    companion object {
        fun fromValues(values:Map<String,AWCValue>)=AWCSwitchPartAppearance(values["trackColor"] as? String,values["trackOutlineColor"] as? String,
            AWCCornerShape.fromValues(values["trackShape"]),values["handleColor"] as? String,AWCCornerShape.fromValues(values["handleShape"]),
            (values["handleOpacity"] as? Number)?.toDouble(),values["iconColor"] as? String,values["stateLayerColor"] as? String).normalized()
    }
}

internal val LocalAWCSwitchAppearance=staticCompositionLocalOf { AWCSwitchAppearance() }
internal val LocalAWCSwitchPartAppearance=staticCompositionLocalOf { AWCSwitchPartAppearance() }
internal val LocalAWCSelectionReducedMotion=staticCompositionLocalOf<Boolean?> { null }
internal val LocalAWCSwitchInspector=staticCompositionLocalOf<((AWCSwitchInspection)->Unit)?> { null }
/** Applies md-switch hook values to descendant switches. */
@Composable fun AWCSwitchAppearanceScope(appearance:AWCSwitchAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCSwitchAppearance provides LocalAWCSwitchAppearance.current.merge(appearance.normalized()),content=content)
/** Applies `::part(...)` styling to descendant switches. */
@Composable fun AWCSwitchPartAppearanceScope(appearance:AWCSwitchPartAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCSwitchPartAppearance provides LocalAWCSwitchPartAppearance.current.merge(appearance.normalized()),content=content)
/** Forces reduced (or full) motion for descendant selection controls, overriding the animator setting. */
@Composable fun AWCSelectionReducedMotionScope(reduced:Boolean?,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCSelectionReducedMotion provides reduced,content=content)
@Composable fun AWCSwitchInspectionScope(onSwitch:(AWCSwitchInspection)->Unit,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCSwitchInspector provides onSwitch,content=content)

/** md-switch render/class logic (md-switch.tsx). */
internal data class SwitchModel(val selected:Boolean,val disabled:Boolean,val softDisabled:Boolean,val icons:Boolean,val showOnlySelectedIcon:Boolean,
                                val hidden:Boolean,val selectedIcon:String,val unselectedIcon:String) {
    /** `.md-switch--disabled` covers hard and soft disabled. */
    val disabledClass get()=disabled || softDisabled
    /** `.md-switch--with-icon`. */
    val showIcon get()=if(selected) icons || showOnlySelectedIcon else icons
    companion object { fun of(p:Props,selected:Boolean)=SwitchModel(selected,p.bool("disabled"),p.bool("softDisabled"),p.bool("icons"),
        p.bool("showOnlySelectedIcon"),p.bool("hidden"),p.str("selectedIcon","check"),p.str("unselectedIcon","close")) }
}
/** `:hover`, `:focus-visible`, `:active`, `.md-switch--pressed` and the programmatic focus ring. */
internal data class SwitchStates(val hover:Boolean=false,val focusVisible:Boolean=false,val active:Boolean=false,val pressed:Boolean=false,val focusRing:Boolean=false)
/** Every value md-switch.css derives, rule by rule in specificity and source order (lengths in dp). */
internal class SwitchStyle(val m:SwitchModel,val a:AWCSwitchAppearance,val parts:AWCSwitchPartAppearance,val tokens:Map<String,String>,val d:Double) {
    fun token(name:String,fallback:String)=awcColor(tokens["--md-sys-color-$name"] ?: fallback,awcColor(fallback,Color.Black))
    private fun mix(c:Color,alpha:Float)=c.copy(alpha=c.alpha*alpha)
    private fun hex(s:String)=statusDotColor(s)
    val trackWidth get()=a.trackWidth ?: max(28.0,52+d*6)
    val trackHeight get()=max(16.0,(a.trackHeight ?: 32.0)+d*4)
    val border=2.0
    val layerSize get()=trackHeight+8
    val handleSelected get()=a.handleSize ?: trackHeight*.75
    val hostHeight get()=max(48.0,trackHeight)
    /** `inset-inline-start` of the handle container inside the track's padding box. */
    fun inlineOffset(selected:Boolean)=if(selected) trackWidth-trackHeight/2-layerSize/2-border else trackHeight/2-layerSize/2-border
    fun handleSize(s:SwitchStates):Double {
        var size=handleSelected*2/3
        if(m.selected || m.showIcon) size=handleSelected
        if(s.pressed && !m.disabledClass) size=handleSelected*7/6
        return size
    }
    private fun engaged(s:SwitchStates)=!m.disabledClass && (s.hover || s.focusVisible || s.pressed)
    fun trackColor(s:SwitchStates):Color {
        parts.trackColor?.let { return hex(it) }
        if(m.disabledClass) return if(m.selected) mix(token("on-surface","#1C1B1F"),.12f) else mix(token("surface-container-highest","#E6E0E9"),.12f)
        return if(m.selected) a.selectedTrackColor?.let(::hex) ?: token("primary","#6750A4") else a.trackColor?.let(::hex) ?: token("surface-container-highest","#E6E0E9")
    }
    fun outlineColor(s:SwitchStates):Color {
        parts.trackOutlineColor?.let { return hex(it) }
        if(m.disabledClass) return mix(token("on-surface","#1C1B1F"),.12f)
        if(m.selected) return a.selectedTrackColor?.let(::hex) ?: token("primary","#6750A4")
        if(engaged(s)) return token("on-surface","#1C1B1F")
        return a.trackOutlineColor?.let(::hex) ?: token("outline","#79747E")
    }
    fun handleColor(s:SwitchStates):Color {
        parts.handleColor?.let { return hex(it) }
        if(m.disabledClass) return if(m.selected) token("surface","#FEF7FF") else mix(token("on-surface","#1C1B1F"),.38f)
        if(engaged(s)) return if(m.selected) token("primary-container","#EADDFF") else token("on-surface-variant","#49454F")
        return if(m.selected) a.selectedHandleColor?.let(::hex) ?: token("on-primary","#FFFFFF") else a.handleColor?.let(::hex) ?: token("outline","#79747E")
    }
    val iconColor:Color get() {
        parts.iconColor?.let { return hex(it) }
        if(m.disabledClass) return if(m.selected) mix(token("on-surface","#1C1B1F"),.38f) else mix(token("surface-container-highest","#E6E0E9"),.38f)
        return if(m.selected) a.selectedIconColor?.let(::hex) ?: token("on-primary-container","#21005D") else a.iconColor?.let(::hex) ?: token("surface-container-highest","#E6E0E9")
    }
    val stateLayerColor:Color get()=(parts.stateLayerColor ?: a.stateLayerColor)?.let(::hex) ?: if(m.selected) token("primary","#6750A4") else token("on-surface","#1C1B1F")
    val focusRingColor:Color get()=a.focusRingColor?.let(::hex) ?: token("secondary","#625B71")
    /** The state layer has `display: none` when disabled (soft or hard). */
    val layerVisible get()=!m.disabledClass
    fun layerOpacity(s:SwitchStates):Double {
        if(!layerVisible) return 0.0
        fun state(k:String,f:Double)=tokens["--md-sys-state-$k-state-layer-opacity"]?.trim()?.toDoubleOrNull() ?: f
        if(s.active || s.pressed) return state("pressed",.12)
        if(s.focusVisible) return state("focus",.12)
        if(s.hover) return state("hover",.08)
        return 0.0
    }
    /** `:host(:focus-visible:not([disabled]))` or the programmatic ring: only hard disabled hides it. */
    fun focusRing(s:SwitchStates)=!m.disabled && (s.focusVisible || s.focusRing)
}

internal data class SwitchTargets(val offset:Double,val size:Double,val layer:Double,val handle:Color,val track:Color,val outline:Color)
/** Switch transitions on the composition frame clock: spatial spring (position, size), effects spring (colours, state layer). */
internal class NativeSwitchState {
    var frameMillis by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var pending:SwitchTargets?=null
    var last:SwitchTargets?=null
    var spatial=350.0 to listOf(.42,1.67,.21,.90)
    var effects=150.0 to listOf(.31,.94,.34,1.0)
    val offset=AWCCSSValueTrack(0.0,accordionLerp)
    val size=AWCCSSValueTrack(0.0,accordionLerp)
    val layer=AWCCSSValueTrack(0.0,accordionLerp)
    val handle=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    val track=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    val outline=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    var primed=false
    /** True while [frameMillis] is the time of the frame being produced (the loop ticked before this frame's composition). */
    var armed=false
    fun running(now:Double)=pending!=null || offset.isRunning(now) || size.isRunning(now) || layer.isRunning(now) ||
        handle.isRunning(now) || track.isRunning(now) || outline.isRunning(now)
    /** Targets apply at the frame time of the frame that first renders them (CSS transition start). */
    fun apply(now:Double) {
        val t=pending ?: return;pending=null
        if(!primed) { offset.snap(t.offset);size.snap(t.size);layer.snap(t.layer);handle.snap(t.handle);track.snap(t.track);outline.snap(t.outline);primed=true;return }
        offset.set(t.offset,now,spatial.first,spatial.second);size.set(t.size,now,spatial.first,spatial.second)
        layer.set(t.layer,now,effects.first,effects.second);handle.set(t.handle,now,effects.first,effects.second)
        track.set(t.track,now,effects.first,effects.second);outline.set(t.outline,now,effects.first,effects.second)
    }
    fun tick(now:Double) { frameMillis=now;armed=true;apply(now) }
}

/** Rendered switch values for inspection (tests, Laboratory inspector). Lengths in dp relative to the host; times are frame-clock ms. */
class AWCSwitchInspection internal constructor(private val s:NativeSwitchState,internal val read:(Double)->Map<String,Any?>) {
    val frameMillis get()=s.frameMillis
    /** Values presented at the latest rendered frame. */
    val values get()=read(s.frameMillis)
}

private fun switchRoundRect(shape:AWCCornerShape,left:Float,top:Float,width:Float,height:Float,density:Float,delta:Float):RoundRect {
    // Radii resolve against the border box; an outline or inset edge offsets every non-zero radius.
    val radii=shape.radii(width/density.toDouble(),height/density.toDouble())
    fun r(v:Double)=if(v<=0) 0f else max(0f,(v*density).toFloat()+delta)
    fun c(i:Int)=CornerRadius(r(radii[i].first),r(radii[i].second))
    return RoundRect(left-delta,top-delta,left+width+delta,top+height+delta,c(0),c(1),c(2),c(3))
}
private val SwitchFullShape=AWCCornerShape.uniform(9999.0)

/** One icon slot: authored `selected-icon` / `unselected-icon` content replaces the glyph, centred in 16 dp. */
@Composable private fun SwitchIcon(name:String,slotName:String,slot:Slot?,authored:(Boolean)->Unit) {
    Layout(contents=listOf({ slot?.invoke(slotName) },{ AWCMaterialSymbol(name,size=16.dp) })) { (slotItems,glyph),_->
        authored(slotItems.isNotEmpty())
        val placeables=(slotItems.ifEmpty { glyph }).map { it.measure(Constraints()) }
        val box=16.dp.roundToPx()
        layout(box,box) { placeables.forEach { it.place((box-it.width)/2,(box-it.height)/2) } }
    }
}

/**
 * md-switch: the source switch (track, handle container with state layer, handle and icon) with
 * native pointer, focus and Space handling. mdInput is cancelable through native action scopes;
 * a cancelled toggle reaches [onEvent] only (an associated form keeps its value).
 */
@Composable
internal fun NativeSwitch(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?) {
    var selected by awcState(listOf(p["selected"],p["_awcFormReset"])) { p.bool("selected") }
    val selectionEmit=rememberUpdatedState(controlEvent)
    val validation=rememberSelectionValidation(p.str("id"),p.bool("required") && !selected,p["valueMissingLabel"] as? String ?: "Please turn this on if you want to proceed.",p.bool("disabled"),p.str("name"),p["_awcFormReset"]) { e-> selectionEmit.value("mdValidityChange",e) }
    val m=SwitchModel.of(p,selected)
    if(m.hidden) return
    val emitRaw by rememberUpdatedState(onEvent);val emitControl by rememberUpdatedState(controlEvent)
    val tokens=LocalAWCThemeTokens.current;val dens=LocalDensity.current.density
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val style=SwitchStyle(m,LocalAWCSwitchAppearance.current,LocalAWCSwitchPartAppearance.current,tokens,resolveAWCDensity(p["density"],LocalAWCNativeDensity.current))
    val parts=LocalAWCSwitchPartAppearance.current
    val reduced=LocalAWCSelectionReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val state=remember { NativeSwitchState() }
    var hover by remember { mutableStateOf(false) };var held by remember { mutableStateOf(false) };var pressed by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) };var pointerFocus by remember { mutableStateOf(false) }
    var slotAuthored by remember { mutableStateOf(false) }
    val focusRequester=remember { FocusRequester() }
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    LaunchedEffect(m.disabled) { if(m.disabled) { hover=false;held=false;pressed=false } }
    val states=SwitchStates(hover && !m.disabled,focused && !pointerFocus,held && !m.disabled,pressed)
    state.spatial=if(reduced) 0.0 to state.spatial.second else cardDuration(tokens,"--md-sys-motion-spring-spatial-fast-duration",350.0) to
        (accordionCubicBezierCurve(tokens["--md-sys-motion-spring-spatial-fast-easing"]) ?: listOf(.42,1.67,.21,.90))
    state.effects=if(reduced) 0.0 to state.effects.second else cardDuration(tokens,"--md-sys-motion-spring-effects-fast-duration",150.0) to
        (accordionCubicBezierCurve(tokens["--md-sys-motion-spring-effects-fast-easing"]) ?: listOf(.31,.94,.34,1.0))
    val target2=SwitchTargets(style.inlineOffset(m.selected),style.handleSize(states),style.layerOpacity(states),style.handleColor(states),style.trackColor(states),style.outlineColor(states))
    // CSS starts a transition at the style change of the rendering update that first sees the new value.
    // An input change wakes the frame loop, which ticks before that frame's composition, so the new
    // targets start at this frame's time and render with progress 0 in it. First targets and
    // reduced-motion changes are instant; a change no input announced starts at the next frame.
    SideEffect { if(!state.primed || target2!=state.last) { state.last=target2;state.pending=target2;state.version++
        if(!state.primed || state.armed || (state.spatial.first==0.0 && state.effects.first==0.0)) state.apply(state.frameMillis) } }
    LaunchedEffect(state) {
        var woke=false
        fun inputs()=listOf(state.version,hover,held,pressed,focused,pointerFocus,selected)
        while(isActive) {
            withFrameNanos { t-> state.tick(t/1e6) }
            // Stay one more frame after a wake so the woken frame's composition sees its own time.
            if(woke || state.running(state.frameMillis)) { woke=false;continue }
            state.armed=false
            val seen=inputs();snapshotFlow { inputs() }.first { it!=seen };woke=true
        }
    }
    val scope=rememberCoroutineScope();var pulse by remember { mutableIntStateOf(0) }
    /** `toggle()`: cancelable mdInput with the proposed state, then the commit and mdChange. */
    fun toggle() {
        val detail=mapOf("selected" to !selected)
        val input=AWCActionEvent("mdInput","md-switch",detail,cancelable=true,targetID=target?.id ?: targetID)
        dispatchNativeAction(input,actions,target?.listeners?.invoke().orEmpty())
        if(input.defaultPrevented) { emitRaw("mdInput",detail);return }
        emitControl("mdInput",detail)
        selected=!selected
        dispatchNativeAction(AWCActionEvent("mdChange","md-switch",detail,cancelable=false,targetID=target?.id ?: targetID),actions,target?.listeners?.invoke().orEmpty())
        emitControl("mdChange",detail)
    }
    /** Space toggles on keydown with a 150 ms pressed pulse (source handleKeyDown); repeats are ignored. */
    fun keyboardToggle() { pressed=true;toggle();val token=++pulse;scope.launch { delay(150);if(pulse==token) pressed=false } }
    val selectionFocusManager=androidx.compose.ui.platform.LocalFocusManager.current
    validation.bind({ pointerFocus=false;runCatching { focusRequester.requestFocus() }.isSuccess },{ if(focused) selectionFocusManager.clearFocus() },{})
    val w=style.trackWidth;val h=style.trackHeight;val sl=style.layerSize;val hostH=style.hostHeight;val trackY=(hostH-h)/2
    fun containerX(offset:Double)=if(rtl) w-style.border-offset-sl else style.border+offset
    val containerY=trackY+h/2-sl/2
    val ring=style.focusRing(states);val layerColor=style.stateLayerColor;val iconColor=style.iconColor
    val iconName=if(m.selected) m.selectedIcon else m.unselectedIcon
    val inspector=LocalAWCSwitchInspector.current
    if(inspector!=null) {
        val read:(Double)->Map<String,Any?> = { t-> mapOf("containerX" to containerX(state.offset.presented(t)),"containerY" to containerY,"layerSize" to sl,
            "handleSize" to state.size.presented(t),"layerOpacity" to (if(style.layerVisible) state.layer.presented(t) else -1.0),
            "handleColor" to state.handle.presented(t),"trackColor" to state.track.presented(t),"outlineColor" to state.outline.presented(t),
            "layerColor" to layerColor,"iconColor" to iconColor,"icon" to (if(m.showIcon) (if(slotAuthored) "#slot" else iconName) else ""),
            "trackWidth" to w,"trackHeight" to h,"hostHeight" to hostH,"focusRing" to ring,"hover" to states.hover,"pressed" to pressed,"active" to states.active,
            "focused" to focused,"focusVisible" to states.focusVisible,"selected" to m.selected,"tabindex" to (if(m.disabled) -1 else 0),"role" to "switch",
            "handleOpacity" to (parts.handleOpacity ?: 1.0)) }
        val current=AWCSwitchInspection(state,read);SideEffect { inspector(current) }
    }
    val trackShape=parts.trackShape ?: SwitchFullShape
    Column {
        Box(Modifier.size(w.dp,hostH.dp)
            .semantics(mergeDescendants=true) {
                role=Role.Switch;toggleableState=ToggleableState(m.selected)
                p.str("ariaLabel").ifEmpty { p.str("aria-label") }.takeIf { it.isNotEmpty() }?.let { contentDescription=it }
                if(p.bool("required") && !m.selected) error("Required")   // Web aria-invalid: required and unchecked
                if(m.disabledClass) disabled() else onClick { toggle();true }
            }
            .focusRequester(focusRequester)
            .onFocusChanged { focused=it.isFocused;if(!it.isFocused) pointerFocus=false }
            .onKeyEvent { e-> if(e.key==Key.Spacebar && !m.disabledClass) {
                    if(e.type==KeyEventType.KeyDown && e.nativeKeyEvent.repeatCount==0) keyboardToggle();true } else false }
            .focusable(enabled=!m.disabled)
            .pointerInput(m.disabled,m.disabledClass) {
                awaitPointerEventScope {
                    while(true) {
                        val e=awaitPointerEvent()
                        val c=e.changes.firstOrNull() ?: continue
                        val pos=c.position
                        val inside=pos.x>=0 && pos.y>=0 && pos.x<size.width && pos.y<size.height
                        // pointer-events: none when hard disabled.
                        if(m.disabled) continue
                        when(e.type) {
                            PointerEventType.Enter,PointerEventType.Move,PointerEventType.Exit -> {
                                if(c.type==PointerType.Mouse || held) hover=inside && e.type!=PointerEventType.Exit
                                // pointerleave clears .md-switch--pressed; :active stays until release.
                                if(pressed && (!inside || e.type==PointerEventType.Exit)) pressed=false
                            }
                            PointerEventType.Press -> {
                                held=true;if(c.type==PointerType.Mouse) hover=inside
                                if(!m.disabledClass) pressed=true
                                // A tabindex=0 host takes focus on mousedown without matching :focus-visible.
                                pointerFocus=true;runCatching { focusRequester.requestFocus() }
                                c.consume()
                            }
                            PointerEventType.Release -> {
                                val wasHeld=held;held=false;pressed=false
                                // A click needs press and release on the host.
                                if(wasHeld && inside && !m.disabledClass) toggle()
                                hover=c.type==PointerType.Mouse && inside
                                c.consume()
                            }
                            else -> {}
                        }
                    }
                }
            }
            .drawBehind {
                val now=state.frameMillis
                val tw=(w*density).toFloat();val th=(h*density).toFloat();val top=(trackY*density).toFloat();val bw=(style.border*density).toFloat()
                drawPath(Path().apply { addRoundRect(switchRoundRect(trackShape,0f,top,tw,th,dens,0f)) },state.track.presented(now))
                drawPath(Path().apply { addRoundRect(switchRoundRect(trackShape,0f,top,tw,th,dens,-bw/2)) },state.outline.presented(now),style=Stroke(bw))
                if(ring) drawPath(Path().apply { addRoundRect(switchRoundRect(trackShape,0f,top,tw,th,dens,3.5f*density)) },style.focusRingColor,style=Stroke(3f*density))
                if(style.layerVisible) {
                    val o=state.layer.presented(now).toFloat()
                    if(o>0f) drawCircle(layerColor.copy(alpha=layerColor.alpha*o),(sl/2*density).toFloat(),
                        Offset(((containerX(state.offset.presented(now))+sl/2)*density).toFloat(),((containerY+sl/2)*density).toFloat()))
                }
            }) {
            // The handle and its icon share the handle part's opacity (one group, like the source element).
            Box(Modifier.matchParentSize().graphicsLayer { alpha=(parts.handleOpacity ?: 1.0).toFloat() }.drawBehind {
                val now=state.frameMillis;val size=state.size.presented(now)
                val x=containerX(state.offset.presented(now))+(sl-size)/2;val y=containerY+(sl-size)/2
                val px=(size*density).toFloat()
                drawPath(Path().apply { addRoundRect(switchRoundRect(parts.handleShape ?: SwitchFullShape,(x*density).toFloat(),(y*density).toFloat(),px,px,dens,0f)) },state.handle.presented(now))
            }) {
                if(m.showIcon) Box(Modifier.graphicsLayer {
                    val now=state.frameMillis
                    translationX=((containerX(state.offset.presented(now))+sl/2-8)*density).toFloat();translationY=((containerY+sl/2-8)*density).toFloat()
                }) {
                    CompositionLocalProvider(LocalContentColor provides iconColor,LocalLayoutDirection provides LayoutDirection.Ltr) {
                        SwitchIcon(iconName,if(m.selected) "selected-icon" else "unselected-icon",slot) { if(slotAuthored!=it) slotAuthored=it }
                    }
                }
            }
        }
        val message=validation.shown ?: p.str("errorText").takeIf { p.bool("error") && it.isNotBlank() }
        // The source's support line: start-aligned with the track and overflowing toward the inline end (the host keeps the track's width).
        if(message!=null) Text(message,Modifier.padding(top=2.dp).width(w.dp).wrapContentWidth(androidx.compose.ui.Alignment.Start,unbounded=true),color=style.token("error","#B3261E"),
            fontFamily=AccordionRoboto,fontWeight=FontWeight.Normal,fontSize=max(10.0,12+style.d*.5).sp,lineHeight=max(14.0,16+style.d*.5).sp,maxLines=1,softWrap=false,
            style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false),lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None)))
    }
}
