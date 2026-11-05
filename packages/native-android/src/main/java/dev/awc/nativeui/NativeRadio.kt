@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * The seven public md-radio hooks (`--md-radio-*`). Sizes are dp (the state-layer hook is the density base: each
 * rung trims 4 dp, floor 24); colours are `#RRGGBB`/`#RRGGBBAA`.
 */
@Immutable data class AWCRadioAppearance(
    val iconColor:String?=null,val selectedIconColor:String?=null,val iconSize:Double?=null,val innerCircleSize:Double?=null,
    val stateLayerSize:Double?=null,val stateLayerColor:String?=null,val selectedStateLayerColor:String?=null,
) {
    private fun l(v:Double?)=v?.takeIf { it.isFinite() && it>=0 }
    internal fun normalized()=AWCRadioAppearance(switchColorHex(iconColor),switchColorHex(selectedIconColor),l(iconSize),l(innerCircleSize),l(stateLayerSize),
        switchColorHex(stateLayerColor),switchColorHex(selectedStateLayerColor))
    fun merge(o:AWCRadioAppearance)=AWCRadioAppearance(o.iconColor ?: iconColor,o.selectedIconColor ?: selectedIconColor,o.iconSize ?: iconSize,
        o.innerCircleSize ?: innerCircleSize,o.stateLayerSize ?: stateLayerSize,o.stateLayerColor ?: stateLayerColor,o.selectedStateLayerColor ?: selectedStateLayerColor)
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCRadioAppearance {
            fun n(k:String)=(values[k] as? Number)?.toDouble()
            fun s(k:String)=values[k] as? String
            return AWCRadioAppearance(s("iconColor"),s("selectedIconColor"),n("iconSize"),n("innerCircleSize"),n("stateLayerSize"),s("stateLayerColor"),s("selectedStateLayerColor")).normalized()
        }
    }
}
/** `::part(state-layer|outer-circle|inner-circle)`: outer-tree rules win over hooks and every state and disabled rule (the `container` part paints nothing). */
@Immutable data class AWCRadioPartAppearance(
    val stateLayerColor:String?=null,val stateLayerOpacity:Double?=null,val outerColor:String?=null,val outerFill:String?=null,val innerColor:String?=null,
) {
    internal fun normalized()=AWCRadioPartAppearance(switchColorHex(stateLayerColor),stateLayerOpacity?.takeIf { it.isFinite() }?.coerceIn(0.0,1.0),
        switchColorHex(outerColor),switchColorHex(outerFill),switchColorHex(innerColor))
    fun merge(o:AWCRadioPartAppearance)=AWCRadioPartAppearance(o.stateLayerColor ?: stateLayerColor,o.stateLayerOpacity ?: stateLayerOpacity,
        o.outerColor ?: outerColor,o.outerFill ?: outerFill,o.innerColor ?: innerColor)
}
internal val LocalAWCRadioAppearance=staticCompositionLocalOf { AWCRadioAppearance() }
internal val LocalAWCRadioPartAppearance=staticCompositionLocalOf { AWCRadioPartAppearance() }
internal val LocalAWCRadioInspector=staticCompositionLocalOf<((AWCRadioInspection)->Unit)?> { null }
@Composable fun AWCRadioAppearanceScope(appearance:AWCRadioAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCRadioAppearance provides LocalAWCRadioAppearance.current.merge(appearance.normalized()),content=content)
@Composable fun AWCRadioPartAppearanceScope(appearance:AWCRadioPartAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCRadioPartAppearance provides LocalAWCRadioPartAppearance.current.merge(appearance.normalized()),content=content)
@Composable fun AWCRadioInspectionScope(onRadio:(AWCRadioInspection)->Unit,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCRadioInspector provides onRadio,content=content)

/**
 * Name-scoped radio groups of one window (the source's `md-radio[name]` in one root), or of an [AWCRadioGroupScope].
 * Members are read in document order — the reading order of the rendered radios (rows top to bottom, leading to
 * trailing; right to left only when every member is right-to-left), registration order until all are placed. The
 * checked member, the single roving tab stop and the group's `required` state derive from it.
 */
@Stable internal class AWCRadioGroups {
    class Member(val id:String,val seq:Int) {
        var value="";var disabled=false;var softDisabled=false;var required=false
        var focus:()->Unit={};var select:(String)->Unit={};var uncheck:()->Unit={}
        var frame:Rect?=null;var rtl=false
    }
    val checked=mutableStateMapOf<String,String>()
    var revision by mutableIntStateOf(0)
    private val members=mutableMapOf<String,MutableList<Member>>()
    private var seq=0
    fun member(name:String,id:String):Member {
        members[name]?.firstOrNull { it.id==id }?.let { return it }
        return Member(id,++seq).also { members.getOrPut(name) { mutableListOf() }.add(it) }
    }
    /** A member joined (after composition): observers re-read the group. */
    fun joined() { revision++ }
    fun remove(name:String,id:String) { members[name]?.removeAll { it.id==id };if(checked[name]==id) checked.remove(name);revision++ }
    fun ordered(name:String):List<Member> {
        val list=members[name].orEmpty()
        if(list.size<2 || list.any { it.frame==null || it.frame!!.isEmpty }) return list.toList()
        val rtl=list.all { it.rtl }
        return list.sortedWith { a,b->
            val fa=a.frame!!;val fb=b.frame!!
            val overlap=min(fa.bottom,fb.bottom)-max(fa.top,fb.top)
            if(overlap>.5f*min(fa.height,fb.height)) {
                if(abs(fa.left-fb.left)>.5f) (if(rtl) fb.left.compareTo(fa.left) else fa.left.compareTo(fb.left)) else a.seq.compareTo(b.seq)
            } else fa.top.compareTo(fb.top)
        }
    }
    fun place(name:String,id:String,frame:Rect,rtl:Boolean) {
        val m=members[name]?.firstOrNull { it.id==id } ?: return
        if(m.frame==frame && m.rtl==rtl) return
        val before=ordered(name).map { it.id };m.frame=frame;m.rtl=rtl
        if(ordered(name).map { it.id }!=before) revision++
    }
    fun update(m:Member,value:String,disabled:Boolean,softDisabled:Boolean,required:Boolean) {
        val changed=m.disabled!=disabled || m.softDisabled!=softDisabled || m.required!=required
        m.value=value;m.disabled=disabled;m.softDisabled=softDisabled;m.required=required
        if(changed) revision++
    }
    /** `checked` became true for [id]: every other member is unchecked silently (source `uncheckOthers`). */
    fun didCheck(name:String,id:String) { checked[name]=id;for(m in ordered(name)) if(m.id!=id) m.uncheck() }
    fun didUncheck(name:String,id:String) { if(checked[name]==id) checked.remove(name) }
    /** Roving tab index (WAI-ARIA radio group): the checked radio, else the first radio that is not hard disabled. */
    fun tabIndex(name:String,id:String,isChecked:Boolean,disabled:Boolean):Int {
        revision
        if(disabled) return -1
        if(isChecked || name.isEmpty()) return 0
        val c=checked[name];if(c!=null && c!=id) return -1
        return if(ordered(name).firstOrNull { !it.disabled }?.id==id) 0 else -1
    }
    /** `required` on any member makes the whole group required; it is missing while nothing is checked. */
    fun valueMissing(name:String,required:Boolean):Boolean {
        revision
        if(name.isEmpty()) return false
        return (required || ordered(name).any { it.required }) && checked[name]==null
    }
    /** Arrow navigation (source `focusSibling`): the next/previous member that is neither disabled nor soft-disabled, wrapping; it is focused and, unless already checked, checked with its own `mdChange`. */
    fun move(name:String,from:String,step:Int) {
        val enabled=ordered(name).filter { !it.disabled && !it.softDisabled }
        val i=enabled.indexOfFirst { it.id==from };if(enabled.isEmpty() || i<0) return
        val target=enabled[(i+step+enabled.size)%enabled.size]
        target.focus()
        if(checked[name]==target.id) return
        target.select("arrow")
    }
}
internal val LocalAWCRadioGroups=staticCompositionLocalOf<AWCRadioGroups?> { null }
private val radioGroupsByRoot=java.util.WeakHashMap<android.view.View,AWCRadioGroups>()
/** Scopes md-radio name groups to [content] (by default one registry per window). */
@Composable fun AWCRadioGroupScope(content:@Composable ()->Unit) { val groups=remember { AWCRadioGroups() };CompositionLocalProvider(LocalAWCRadioGroups provides groups,content=content) }
@Composable internal fun currentAWCRadioGroups():AWCRadioGroups {
    LocalAWCRadioGroups.current?.let { return it }
    val root=LocalView.current.rootView
    return remember(root) { radioGroupsByRoot.getOrPut(root) { AWCRadioGroups() } }
}

/** md-radio render/class logic (md-radio.tsx). */
internal data class RadioModel(val checked:Boolean,val disabled:Boolean,val softDisabled:Boolean,val required:Boolean,val hidden:Boolean,
                               val name:String,val value:String,val validationMessage:String) {
    /** `.md-radio--disabled` covers hard and soft disabled. */
    val disabledClass get()=disabled || softDisabled
    companion object { fun of(p:Props,checked:Boolean)=RadioModel(checked,p.bool("disabled"),p.bool("softDisabled"),p.bool("required"),p.bool("hidden"),
        p.str("name"),p.str("value"),if(p.bool("error")) p.str("errorText") else "") }
}
internal data class RadioStates(val hover:Boolean=false,val focusVisible:Boolean=false,val active:Boolean=false,val pressed:Boolean=false)
/** Every value md-radio.css derives, rule by rule in specificity and source order. */
internal class RadioStyle(val m:RadioModel,val a:AWCRadioAppearance,val parts:AWCRadioPartAppearance,val tokens:Map<String,String>,val d:Double) {
    fun token(name:String,fallback:String)=awcColor(tokens["--md-sys-color-$name"] ?: fallback,awcColor(fallback,Color.Black))
    private fun hex(s:String)=statusDotColor(s)
    private val disabledOpacity get()=tokens["--md-sys-state-disabled-content-opacity"]?.trim()?.toFloatOrNull() ?: .38f
    private val disabledInk get()=token("on-surface","#1C1B1F").let { it.copy(alpha=it.alpha*disabledOpacity) }
    val touch get()=max(32.0,48+d*4)
    val stateLayer get()=max(24.0,(a.stateLayerSize ?: 40.0)+d*4)
    val icon get()=a.iconSize ?: max(16.0,20+d)
    val inner get()=a.innerCircleSize ?: max(8.0,10+d*.5)
    val border=2.0
    val outerColor:Color get() {
        parts.outerColor?.let { return hex(it) }
        if(m.disabledClass) return disabledInk
        return if(m.checked) a.selectedIconColor?.let(::hex) ?: token("primary","#6750A4") else a.iconColor?.let(::hex) ?: token("on-surface-variant","#49454F")
    }
    val outerFill:Color get()=parts.outerFill?.let(::hex) ?: Color.Transparent
    val innerColor:Color get()=parts.innerColor?.let(::hex) ?: if(m.disabledClass && m.checked) disabledInk else a.selectedIconColor?.let(::hex) ?: token("primary","#6750A4")
    val innerScale get()=if(m.checked) 1.0 else 0.0
    val stateLayerColor:Color get()=parts.stateLayerColor?.let(::hex) ?: if(m.checked) a.selectedStateLayerColor?.let(::hex) ?: token("primary","#6750A4") else a.stateLayerColor?.let(::hex) ?: token("on-surface","#1C1B1F")
    val layerVisible get()=!m.disabledClass
    /** Hover and :active only: the radio has no focus-visible state layer (its focus is the ring). */
    fun layerOpacity(s:RadioStates):Double {
        if(!layerVisible) return 0.0
        parts.stateLayerOpacity?.let { return it }
        fun state(k:String,f:Double)=tokens["--md-sys-state-$k-state-layer-opacity"]?.trim()?.toDoubleOrNull() ?: f
        if(s.active) return state("pressed",.12)
        if(s.hover) return state("hover",.08)
        return 0.0
    }
    val focusRingColor get()=token("secondary","#625B71")
    val supportFontSize get()=max(10.0,12+d*.5)
    val supportLineHeight get()=max(14.0,16+d*.5)
    fun scale(s:RadioStates)=if(s.pressed && !m.disabledClass) .82 else 1.0
}

internal data class RadioTargets(val scale:Double,val layer:Double,val inner:Double,val outer:Color)
internal class NativeRadioState {
    var frameMillis by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var pending:RadioTargets?=null;var last:RadioTargets?=null
    var reduced=false;var tokens:Map<String,String> = emptyMap()
    val scale=AWCCSSValueTrack(1.0,accordionLerp);val layer=AWCCSSValueTrack(0.0,accordionLerp);val inner=AWCCSSValueTrack(0.0,accordionLerp)
    val outer=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    var primed=false;var armed=false;var focusPending=false
    /** md-ripple in the state-layer-sized ripple layer: one wave at a time. */
    val waves=mutableStateListOf<AccordionRippleWave>()
    private fun t(key:String,fallback:Double)=if(reduced) 0.0 else cardDuration(tokens,"--md-sys-motion-duration-$key",fallback)
    private fun e(key:String,fallback:List<Double>)=accordionCubicBezierCurve(tokens["--md-sys-motion-easing-$key"]) ?: fallback
    fun running(now:Double)=pending!=null || scale.isRunning(now) || layer.isRunning(now) || inner.isRunning(now) || outer.isRunning(now) || waves.any { it.animating(now) }
    fun apply(now:Double) {
        val n=pending ?: return;pending=null
        if(!primed) { scale.snap(n.scale);layer.snap(n.layer);inner.snap(n.inner);outer.snap(n.outer);primed=true;return }
        val standard=e("standard",listOf(.2,0.0,0.0,1.0));val spring=e("emphasized-decelerate",listOf(.05,.7,.1,1.0))
        // Pressing uses the pressed rule's transform transition; releasing the base rule's spring-back.
        if(n.scale<1) scale.set(n.scale,now,t("short4",200.0),standard) else scale.set(n.scale,now,t("medium4",400.0),spring)
        layer.set(n.layer,now,t("short2",100.0),standard)
        inner.set(n.inner,now,t("medium4",400.0),spring)
        outer.set(n.outer,now,t("short2",100.0),standard)
    }
    fun tick(now:Double) { frameMillis=now;armed=true;apply(now)
        for(w in waves) { w.begin(now);if(w.releasePending && w.began!=null) { w.release(now);w.releasePending=false } }
        waves.removeAll { it.done(now) } }
    fun startWave(origin:Offset,size:Double,released:Boolean) { waves.clear()
        waves+=AccordionRippleWave(origin,AccordionRippleWave.radius(origin,size,size)).also { it.releasePending=released };version++ }
}
class AWCRadioInspection internal constructor(private val s:NativeRadioState,val value:String,internal val read:(Double)->Map<String,Any?>) {
    val frameMillis get()=s.frameMillis
    val values get()=read(s.frameMillis)
}

/** md-radio: target, state layer, outer/inner circles and the validation line, with native pointer, focus, Space, arrows and the name group. */
@Composable
internal fun NativeRadio(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?) {
    var checked by awcState(listOf(p["checked"],p["_awcFormReset"])) { p.bool("checked") }
    val selectionGroups=currentAWCRadioGroups()
    val selectionEmit=rememberUpdatedState(controlEvent)
    val validation=rememberSelectionValidation(p.str("id"),if(p.str("name").isEmpty()) p.bool("required") && !checked else selectionGroups.valueMissing(p.str("name"),p.bool("required")),p["valueMissingLabel"] as? String ?: "Please select one of these options.",p.bool("disabled"),p.str("name"),p["_awcFormReset"]) { e-> selectionEmit.value("mdValidityChange",e) }
    val m=RadioModel.of(p,checked).let { r-> validation.shown?.let { r.copy(validationMessage=it) } ?: r }
    if(m.hidden) return
    val emitControl by rememberUpdatedState(controlEvent)
    val tokens=LocalAWCThemeTokens.current;val dens=LocalDensity.current.density
    val parts=LocalAWCRadioPartAppearance.current
    val style=RadioStyle(m,LocalAWCRadioAppearance.current,parts,tokens,resolveAWCDensity(p["density"],LocalAWCNativeDensity.current))
    val reduced=LocalAWCSelectionReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val state=remember { NativeRadioState() };state.reduced=reduced;state.tokens=tokens
    var hover by remember { mutableStateOf(false) };var held by remember { mutableStateOf(false) };var pressed by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) };var pointerFocus by remember { mutableStateOf(false) }
    val focusRequester=remember { FocusRequester() }
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val groups=currentAWCRadioGroups()
    val member=remember(groups,m.name) { groups.member(m.name,targetID) }
    DisposableEffect(groups,m.name) { groups.joined();onDispose { groups.remove(m.name,targetID) } }
    LaunchedEffect(m.disabled) { if(m.disabled) { hover=false;held=false;pressed=false } }
    val states=RadioStates(hover && !m.disabled,focused && !pointerFocus,held && !m.disabled,pressed)
    val targets=RadioTargets(style.scale(states),style.layerOpacity(states),style.innerScale,style.outerColor)
    SideEffect { if(!state.primed || targets!=state.last) { state.last=targets;state.pending=targets;state.version++
        if(!state.primed || state.armed || reduced) state.apply(state.frameMillis) } }
    LaunchedEffect(state) {
        var woke=false
        fun inputs()=listOf(state.version,hover,held,pressed,focused,pointerFocus,checked)
        while(isActive) {
            withFrameNanos { t-> state.tick(t/1e6) }
            if(woke || state.running(state.frameMillis)) { woke=false;continue }
            state.armed=false
            val seen=inputs();snapshotFlow { inputs() }.first { it!=seen };woke=true
        }
    }
    val scope=rememberCoroutineScope();var pulse by remember { mutableIntStateOf(0) }
    fun emit(name:String,detail:Map<String,AWCValue>) {
        dispatchNativeAction(AWCActionEvent(name,"md-radio",detail,cancelable=false,targetID=target?.id ?: targetID),actions,target?.listeners?.invoke().orEmpty())
        emitControl(name,detail)
    }
    /** `handleClick`/arrow selection: check this radio (siblings are unchecked silently) and emit `mdChange {checked, value}`. */
    fun select() {
        if(m.disabledClass || checked) return
        checked=true
        if(m.name.isNotEmpty()) groups.didCheck(m.name,targetID)
        emit("mdChange",mapOf("checked" to true,"value" to m.value))
    }
    fun centreWave() { val c=(style.stateLayer/2).toFloat();state.startWave(Offset(c,c),style.stateLayer,true) }
    fun requestFocus(pointer:Boolean) { pointerFocus=pointer;state.focusPending=true;runCatching { focusRequester.requestFocus() };state.focusPending=false }
    // Group membership (document order, roving tab stop, arrows) and silent unchecking by a sibling.
    SideEffect {
        groups.update(member,m.value,m.disabled,m.softDisabled,m.required)
        member.focus={ requestFocus(false) }
        member.select={ source-> if(source=="arrow" && !m.disabledClass) centreWave();select() }
        member.uncheck={ checked=false }
    }
    val lastChecked=remember { arrayOfNulls<Boolean>(1) }
    SideEffect { if(lastChecked[0]!=checked) { lastChecked[0]=checked
        if(m.name.isNotEmpty()) { if(checked) { if(groups.checked[m.name]!=targetID) groups.didCheck(m.name,targetID) } else groups.didUncheck(m.name,targetID) } } }
    val selectLatest=rememberUpdatedState { select() }
    val tabIndex=groups.tabIndex(m.name,targetID,m.checked,m.disabled)
    val valueMissing=groups.valueMissing(m.name,m.required)
    /** Space: 150 ms pressed pulse, centred ripple and the click (a checked radio ignores it) — source handleKeyDown. */
    fun keyboardSpace() { if(m.disabledClass) return
        centreWave();pressed=true;select();val token=++pulse;scope.launch { delay(150);if(pulse==token) pressed=false } }
    val selectionFocusManager=androidx.compose.ui.platform.LocalFocusManager.current
    validation.bind({ requestFocus(false);true },{ if(focused) selectionFocusManager.clearFocus() },{ select() })
    val touch=style.touch;val ic=style.icon;val sl=style.stateLayer;val inset=(touch-ic)/2
    val support=m.validationMessage;val hasSupport=support.isNotEmpty()
    var supportBox by remember { mutableStateOf(Rect.Zero) }
    val hostBox=remember { arrayOf(Rect.Zero) }
    val ring=states.focusVisible
    val layerColor=style.stateLayerColor;val innerColor=style.innerColor;val outerFill=style.outerFill
    val inspector=LocalAWCRadioInspector.current
    if(inspector!=null) {
        val read:(Double)->Map<String,Any?> = { t-> mapOf("touch" to touch,"stateLayerSize" to sl,"iconSize" to ic,"innerSize" to style.inner,"containerX" to inset,
            "outerColor" to state.outer.presented(t),"outerFill" to outerFill,"innerColor" to innerColor,"innerScale" to state.inner.presented(t),"scale" to state.scale.presented(t),
            "layerOpacity" to (if(style.layerVisible) state.layer.presented(t) else -1.0),"layerColor" to layerColor,"focusRing" to ring,
            "support" to support,"supportColor" to style.token("error","#B3261E"),"supportBox" to supportBox,
            "hover" to states.hover,"pressed" to pressed,"active" to states.active,"focused" to focused,"focusVisible" to states.focusVisible,
            "checked" to m.checked,"tabindex" to tabIndex,"valueMissing" to valueMissing,"value" to m.value,"name" to m.name,"hostBox" to hostBox[0],
            "wave" to state.waves.lastOrNull()?.takeIf { it.began!=null && !it.done(t) }?.let { mapOf("scale" to it.scale(t),"opacity" to it.opacity(t)) }) }
        val current=AWCRadioInspection(state,m.value,read);SideEffect { inspector(current) }
    }
    Box(Modifier.width(touch.dp)
        .onGloballyPositioned { val o=it.positionInRoot();val r=Rect(o.x,o.y,o.x+it.size.width,o.y+it.size.height)
            hostBox[0]=Rect(r.left/dens,r.top/dens,r.right/dens,r.bottom/dens);groups.place(m.name,targetID,r,rtl) }
        .semantics(mergeDescendants=true) {
            role=Role.RadioButton;selected=m.checked
            p.str("ariaLabel").ifEmpty { p.str("aria-label") }.takeIf { it.isNotEmpty() }?.let { contentDescription=it }
            if(p.bool("required") && !m.checked) error("Required")   // Web aria-invalid: required and unchecked
            if(m.disabledClass) disabled() else onClick { select();true }
        }
        .focusRequester(focusRequester)
        .onFocusChanged { s-> if(focused!=s.isFocused) { focused=s.isFocused;if(!s.isFocused) pointerFocus=false;emit(if(s.isFocused) "mdFocus" else "mdBlur",emptyMap()) } }
        .onKeyEvent { e->
            if(m.disabledClass) return@onKeyEvent false
            val down=e.type==KeyEventType.KeyDown
            when(e.key) {
                Key.Spacebar->{ if(down) keyboardSpace();true }
                // Arrows never move focus out of the radio (source preventDefault); an unnamed radio has no siblings.
                Key.DirectionDown,Key.DirectionRight->{ if(down && m.name.isNotEmpty()) groups.move(m.name,targetID,1);true }
                Key.DirectionUp,Key.DirectionLeft->{ if(down && m.name.isNotEmpty()) groups.move(m.name,targetID,-1);true }
                Key.Enter,Key.NumPadEnter->true   // inert (no activation)
                else->false
            }
        }
        // Roving tab stop: only the group's tab stop takes sequential focus; arrows and presses focus any member.
        .focusProperties { canFocus=!m.disabled && (tabIndex==0 || focused || state.focusPending) }
        .focusable(enabled=!m.disabled)
        .pointerInput(m.disabled,m.disabledClass,touch,sl) {
            awaitPointerEventScope {
                while(true) {
                    val e=awaitPointerEvent();val ch=e.changes.firstOrNull() ?: continue
                    val pos=ch.position;val inside=pos.x>=0 && pos.y>=0 && pos.x<size.width && pos.y<size.height
                    if(m.disabled) continue   // pointer-events: none
                    when(e.type) {
                        PointerEventType.Enter,PointerEventType.Move,PointerEventType.Exit -> {
                            if(ch.type==PointerType.Mouse || held) hover=inside && e.type!=PointerEventType.Exit
                            if(pressed && (!inside || e.type==PointerEventType.Exit)) pressed=false   // pointerleave
                        }
                        PointerEventType.Press -> { held=true;if(ch.type==PointerType.Mouse) hover=inside;if(!m.disabledClass) pressed=true
                            val lx=pos.x/dens-(touch-sl)/2;val ly=pos.y/dens-(touch-sl)/2
                            if(!m.disabledClass && kotlin.math.hypot(lx-sl/2,ly-sl/2)<=sl/2) state.startWave(Offset(lx.toFloat(),ly.toFloat()),sl,false)
                            requestFocus(true);ch.consume() }
                        PointerEventType.Release -> { val wasHeld=held;held=false;pressed=false
                            state.waves.lastOrNull()?.let { if(it.released==null) { it.releasePending=true;state.version++ } }
                            if(wasHeld && inside) selectLatest.value()
                            hover=ch.type==PointerType.Mouse && inside;ch.consume() }
                        else -> {}
                    }
                }
            }
        }) {
        Column {
            Box(Modifier.size(touch.dp).clip(CircleShape).drawBehind {
                val now=state.frameMillis;val center=Offset(size.width/2,size.height/2)
                val r0=(sl/2*density).toFloat()
                if(style.layerVisible) { val o=state.layer.presented(now).toFloat();if(o>0f) drawCircle(layerColor.copy(alpha=layerColor.alpha*o),r0,center) }
                if(!m.disabledClass && state.waves.isNotEmpty()) {
                    val left=center.x-r0;val top=center.y-r0
                    clipPath(Path().apply { addOval(Rect(left,top,left+2*r0,top+2*r0)) }) {
                        for(w in state.waves) { if(w.began==null || w.done(now)) continue
                            val r=(w.radius*w.scale(now)*density).toFloat()
                            if(r>0f) drawCircle(layerColor.copy(alpha=layerColor.alpha*w.opacity(now).toFloat()),r,Offset(left+w.origin.x*density,top+w.origin.y*density)) }
                    } }
                // Container (icon-sized, scaled about its centre): outer ring (2dp border inside the box) and inner dot.
                val s=state.scale.presented(now).toFloat();val ro=(ic/2*density).toFloat()*s;val bw=(style.border*density).toFloat()*s
                if(outerFill.alpha>0f) drawCircle(outerFill,ro,center)
                drawCircle(state.outer.presented(now),ro-bw/2,center,style=Stroke(bw))
                val k=state.inner.presented(now).toFloat()
                if(k>0f) drawCircle(innerColor,(style.inner/2*density).toFloat()*k*s,center)
                // The focus ring is the target's ::after: a 3dp outline outside the state-layer circle.
                if(ring) { val w=3f*density;drawCircle(style.focusRingColor,r0+w/2,center,style=Stroke(w)) }
            })
            if(hasSupport) Text(support,Modifier.padding(top=2.dp).wrapContentWidth(Alignment.Start,unbounded=true).padding(start=inset.dp)
                .onGloballyPositioned { val o=it.positionInRoot();supportBox=Rect(o.x/dens,o.y/dens,(o.x+it.size.width)/dens,(o.y+it.size.height)/dens) },
                color=style.token("error","#B3261E"),fontFamily=AccordionRoboto,fontWeight=FontWeight.Normal,fontSize=style.supportFontSize.sp,lineHeight=style.supportLineHeight.sp,
                maxLines=1,softWrap=false,style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false),
                    lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None)))
        }
    }
}
