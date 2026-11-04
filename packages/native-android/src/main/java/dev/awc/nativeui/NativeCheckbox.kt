@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min

/**
 * The fourteen public md-checkbox hooks (`--md-checkbox-*`). Lengths are dp; the container shape is a
 * corner shape; colours are `#RRGGBB`/`#RRGGBBAA`. The touch target hook is the density base (each
 * rung trims 4 dp, floored at 32); unset fields keep the density-scaled defaults.
 */
@Immutable data class AWCCheckboxAppearance(
    val containerColor:String?=null,val containerShape:AWCCornerShape?=null,val containerSize:Double?=null,val selectedContainerColor:String?=null,
    val outlineColor:String?=null,val outlineWidth:Double?=null,val iconColor:String?=null,val iconSize:Double?=null,
    val stateLayerColor:String?=null,val selectedStateLayerColor:String?=null,val stateLayerSize:Double?=null,val touchTargetSize:Double?=null,
    val supportingTextColor:String?=null,val errorTextColor:String?=null,
) {
    private fun l(v:Double?)=v?.takeIf { it.isFinite() && it>=0 }
    internal fun normalized()=AWCCheckboxAppearance(switchColorHex(containerColor),containerShape,l(containerSize),switchColorHex(selectedContainerColor),
        switchColorHex(outlineColor),l(outlineWidth),switchColorHex(iconColor),l(iconSize),switchColorHex(stateLayerColor),switchColorHex(selectedStateLayerColor),
        l(stateLayerSize),l(touchTargetSize),switchColorHex(supportingTextColor),switchColorHex(errorTextColor))
    fun merge(o:AWCCheckboxAppearance)=AWCCheckboxAppearance(o.containerColor ?: containerColor,o.containerShape ?: containerShape,o.containerSize ?: containerSize,
        o.selectedContainerColor ?: selectedContainerColor,o.outlineColor ?: outlineColor,o.outlineWidth ?: outlineWidth,o.iconColor ?: iconColor,o.iconSize ?: iconSize,
        o.stateLayerColor ?: stateLayerColor,o.selectedStateLayerColor ?: selectedStateLayerColor,o.stateLayerSize ?: stateLayerSize,o.touchTargetSize ?: touchTargetSize,
        o.supportingTextColor ?: supportingTextColor,o.errorTextColor ?: errorTextColor)
    companion object {
        fun fromValues(values:Map<String,AWCValue>):AWCCheckboxAppearance {
            fun n(k:String)=(values[k] as? Number)?.toDouble()
            fun s(k:String)=values[k] as? String
            return AWCCheckboxAppearance(s("containerColor"),AWCCornerShape.fromValues(values["containerShape"]),n("containerSize"),s("selectedContainerColor"),s("outlineColor"),
                n("outlineWidth"),s("iconColor"),n("iconSize"),s("stateLayerColor"),s("selectedStateLayerColor"),n("stateLayerSize"),n("touchTargetSize"),
                s("supportingTextColor"),s("errorTextColor")).normalized()
        }
    }
}
/** `::part(target|state-layer|container|icon|supporting-text)`: outer-tree rules win over hooks and every state, error and disabled rule. */
@Immutable data class AWCCheckboxPartAppearance(
    val targetColor:String?=null,val stateLayerColor:String?=null,val stateLayerOpacity:Double?=null,val containerColor:String?=null,
    val containerOutlineColor:String?=null,val containerShape:AWCCornerShape?=null,val iconColor:String?=null,val supportingTextColor:String?=null,
) {
    internal fun normalized()=AWCCheckboxPartAppearance(switchColorHex(targetColor),switchColorHex(stateLayerColor),stateLayerOpacity?.takeIf { it.isFinite() }?.coerceIn(0.0,1.0),
        switchColorHex(containerColor),switchColorHex(containerOutlineColor),containerShape,switchColorHex(iconColor),switchColorHex(supportingTextColor))
    fun merge(o:AWCCheckboxPartAppearance)=AWCCheckboxPartAppearance(o.targetColor ?: targetColor,o.stateLayerColor ?: stateLayerColor,o.stateLayerOpacity ?: stateLayerOpacity,
        o.containerColor ?: containerColor,o.containerOutlineColor ?: containerOutlineColor,o.containerShape ?: containerShape,o.iconColor ?: iconColor,o.supportingTextColor ?: supportingTextColor)
}
internal val LocalAWCCheckboxAppearance=staticCompositionLocalOf { AWCCheckboxAppearance() }
internal val LocalAWCCheckboxPartAppearance=staticCompositionLocalOf { AWCCheckboxPartAppearance() }
internal val LocalAWCCheckboxInspector=staticCompositionLocalOf<((AWCCheckboxInspection)->Unit)?> { null }
@Composable fun AWCCheckboxAppearanceScope(appearance:AWCCheckboxAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCCheckboxAppearance provides LocalAWCCheckboxAppearance.current.merge(appearance.normalized()),content=content)
@Composable fun AWCCheckboxPartAppearanceScope(appearance:AWCCheckboxPartAppearance,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCCheckboxPartAppearance provides LocalAWCCheckboxPartAppearance.current.merge(appearance.normalized()),content=content)
@Composable fun AWCCheckboxInspectionScope(onCheckbox:(AWCCheckboxInspection)->Unit,content:@Composable ()->Unit)=
    CompositionLocalProvider(LocalAWCCheckboxInspector provides onCheckbox,content=content)

/** md-checkbox render/class logic (md-checkbox.tsx). */
internal data class CheckboxModel(val checked:Boolean,val indeterminate:Boolean,val disabled:Boolean,val softDisabled:Boolean,val error:Boolean,
                                  val errorText:String,val supportingText:String,val hidden:Boolean,val decorative:Boolean,val validationMessage:String="") {
    val selected get()=checked || indeterminate
    val disabledClass get()=disabled || softDisabled
    val hasError get()=error || validationMessage.isNotEmpty()
    val supportMessage get()=errorText.ifEmpty { validationMessage.ifEmpty { supportingText } }
    val glyph get()=if(indeterminate) "remove" else "check"
    companion object { fun of(p:Props,checked:Boolean,indeterminate:Boolean)=CheckboxModel(checked,indeterminate,p.bool("disabled"),p.bool("softDisabled"),p.bool("error"),
        p.str("errorText"),p.str("supportingText"),p.bool("hidden"),p.str("ariaHidden")=="true") }
}
internal data class CheckboxStates(val hover:Boolean=false,val focusVisible:Boolean=false,val active:Boolean=false,val pressed:Boolean=false)
internal class CheckboxStyle(val m:CheckboxModel,val a:AWCCheckboxAppearance,val parts:AWCCheckboxPartAppearance,val tokens:Map<String,String>,val d:Double) {
    fun token(name:String,fallback:String)=awcColor(tokens["--md-sys-color-$name"] ?: fallback,awcColor(fallback,Color.Black))
    private fun hex(s:String)=statusDotColor(s)
    private val disabledOpacity get()=tokens["--md-sys-state-disabled-content-opacity"]?.trim()?.toFloatOrNull() ?: .38f
    private fun mix(c:Color,alpha:Float)=c.copy(alpha=c.alpha*alpha)
    val touch get()=max(32.0,(a.touchTargetSize ?: 48.0)+d*4)
    val container get()=a.containerSize ?: max(14.0,18+d)
    val icon get()=a.iconSize ?: max(14.0,18+d)
    val stateLayer get()=a.stateLayerSize ?: min(40.0,touch)
    val outlineWidth get()=a.outlineWidth ?: 2.0
    val shape get()=parts.containerShape ?: a.containerShape ?: AWCCornerShape.uniform(2.0)
    val containerColor:Color get() {
        parts.containerColor?.let { return hex(it) }
        if(m.disabledClass) return if(m.selected) mix(token("on-surface","#1C1B1F"),disabledOpacity) else Color.Transparent
        if(m.hasError && m.selected) return token("error","#B3261E")
        return if(m.selected) a.selectedContainerColor?.let(::hex) ?: token("primary","#6750A4") else a.containerColor?.let(::hex) ?: Color.Transparent
    }
    val outlineColor:Color get() {
        parts.containerOutlineColor?.let { return hex(it) }
        if(m.disabledClass) return if(m.selected) Color.Transparent else mix(token("on-surface","#1C1B1F"),disabledOpacity)
        if(m.hasError) return token("error","#B3261E")
        return if(m.selected) a.selectedContainerColor?.let(::hex) ?: token("primary","#6750A4") else a.outlineColor?.let(::hex) ?: token("on-surface-variant","#49454F")
    }
    val iconColor:Color get()=parts.iconColor?.let(::hex) ?: if(m.disabledClass && m.selected) token("surface","#FEF7FF") else a.iconColor?.let(::hex) ?: token("on-primary","#FFFFFF")
    val stateLayerColor:Color get()=parts.stateLayerColor?.let(::hex) ?: if(m.selected) a.selectedStateLayerColor?.let(::hex) ?: token("primary","#6750A4") else a.stateLayerColor?.let(::hex) ?: token("on-surface","#1C1B1F")
    val layerVisible get()=!m.disabledClass
    fun layerOpacity(s:CheckboxStates):Double {
        if(!layerVisible) return 0.0
        parts.stateLayerOpacity?.let { return it }
        fun state(k:String,f:Double)=tokens["--md-sys-state-$k-state-layer-opacity"]?.trim()?.toDoubleOrNull() ?: f
        if(s.active) return state("pressed",.12);if(s.focusVisible) return state("focus",.12);if(s.hover) return state("hover",.08);return 0.0
    }
    val focusRingColor get()=token("secondary","#625B71")
    val ringOffset get()=(stateLayer-touch)/2
    val supportFontSize get()=max(10.0,12+d*.5)
    val supportLineHeight get()=max(14.0,16+d*.5)
    val supportColor:Color get()=parts.supportingTextColor?.let(::hex) ?: if(m.hasError) a.errorTextColor?.let(::hex) ?: token("error","#B3261E") else a.supportingTextColor?.let(::hex) ?: token("on-surface-variant","#49454F")
    fun scale(s:CheckboxStates)=if(s.pressed && !m.disabledClass) .82 else 1.0
}

internal data class CheckboxTargets(val scale:Double,val layer:Double,val fill:Color,val outline:Color,val selected:Boolean)
internal class NativeCheckboxState {
    var frameMillis by mutableDoubleStateOf(0.0)
    var version by mutableIntStateOf(0)
    var pending:CheckboxTargets?=null;var last:CheckboxTargets?=null
    var reduced=false;var tokens:Map<String,String> = emptyMap()
    val scale=AWCCSSValueTrack(1.0,accordionLerp);val layer=AWCCSSValueTrack(0.0,accordionLerp)
    val fill=AWCCSSValueTrack(Color.Transparent,accordionColorLerp);val outline=AWCCSSValueTrack(Color.Transparent,accordionColorLerp)
    var glyphStart:Double?=null;var lastSelected=false;var primed=false;var armed=false
    /** md-ripple in the state-layer-sized ripple layer: one wave at a time (a new press finishes the previous one). */
    val waves=mutableStateListOf<AccordionRippleWave>()
    private fun t(key:String,fallback:Double)=if(reduced) 0.0 else cardDuration(tokens,"--md-sys-motion-duration-$key",fallback)
    private fun e(key:String,fallback:List<Double>)=accordionCubicBezierCurve(tokens["--md-sys-motion-easing-$key"]) ?: fallback
    val standard get()=e("standard",listOf(.2,0.0,0.0,1.0))
    val glyphDuration get()=t("short2",200.0)
    fun running(now:Double)=pending!=null || scale.isRunning(now) || layer.isRunning(now) || fill.isRunning(now) || outline.isRunning(now) || (glyphStart?.let { now<it+glyphDuration } ?: false) || waves.any { it.animating(now) }
    fun apply(now:Double) {
        val n=pending ?: return;pending=null
        if(!primed) { scale.snap(n.scale);layer.snap(n.layer);fill.snap(n.fill);outline.snap(n.outline)
            glyphStart=if(n.selected && !reduced) now else null;lastSelected=n.selected;primed=true;return }
        // Pressing uses the pressed rule's transform transition; releasing the base rule's spring-back.
        if(n.scale<1) scale.set(n.scale,now,t("short4",200.0),standard) else scale.set(n.scale,now,t("medium4",400.0),e("emphasized-decelerate",listOf(.05,.7,.1,1.0)))
        layer.set(n.layer,now,t("short1",100.0),standard)
        fill.set(n.fill,now,t("short2",200.0),standard);outline.set(n.outline,now,t("short2",200.0),standard)
        // The glyph entrance plays when the mark appears (checked ↔ indeterminate keeps the running animation).
        if(n.selected && !lastSelected) glyphStart=if(reduced) null else now
        if(!n.selected) glyphStart=null
        lastSelected=n.selected
    }
    fun tick(now:Double) { frameMillis=now;armed=true;apply(now)
        for(w in waves) { w.begin(now);if(w.releasePending && w.began!=null) { w.release(now);w.releasePending=false } }
        waves.removeAll { it.done(now) } }
    fun startWave(origin:Offset,size:Double,released:Boolean) { waves.clear()
        val radius=AccordionRippleWave.radius(origin,size,size);waves+=AccordionRippleWave(origin,radius).also { it.releasePending=released };version++ }
    /** `md-checkbox-glyph-in` at [now]: scale 0→1.18→1, opacity 0→1; the easing applies per keyframe interval. */
    fun glyph(now:Double):Pair<Double,Double> {
        val s=glyphStart ?: return 1.0 to 1.0;val dur=glyphDuration;if(dur<=0 || now>=s+dur) return 1.0 to 1.0
        val p=((now-s)/dur).coerceAtLeast(0.0);val c=standard
        fun ease(u:Double)=accordionCubicBezier(u,c)
        return if(p<.6) { val k=ease(p/.6);1.18*k to k } else { val k=ease((p-.6)/.4);(1.18+(1-1.18)*k) to 1.0 }
    }
}
class AWCCheckboxInspection internal constructor(private val s:NativeCheckboxState,internal val read:(Double)->Map<String,Any?>) {
    val frameMillis get()=s.frameMillis
    val values get()=read(s.frameMillis)
}
private val CheckboxGlyphFamily by lazy { FontFamily(Font(R.font.awc_material_symbols,FontWeight(600),variationSettings=FontVariation.Settings(
    FontVariation.Setting("FILL",1f),FontVariation.weight(600),FontVariation.Setting("opsz",24f),FontVariation.grade(0)))) }

/** md-checkbox: target, state layer, container with the check/remove glyph and the supporting line, with native pointer, focus and Space. */
@Composable
internal fun NativeCheckbox(p:Props,onEvent:EventSink,controlEvent:EventSink,slot:Slot?) {
    var checked by awcState(listOf(p["checked"],p["_awcFormReset"])) { p.bool("checked") }
    var indeterminate by awcState(listOf(p["indeterminate"],p["_awcFormReset"])) { p.bool("indeterminate") }
    val selectionEmit=rememberUpdatedState(controlEvent)
    val validation=rememberSelectionValidation(p.str("id"),p.bool("required") && !checked,p["valueMissingLabel"] as? String ?: "Please check this box if you want to proceed.",p.bool("disabled"),p.str("name"),p["_awcFormReset"]) { e-> selectionEmit.value("mdValidityChange",e) }
    val m=CheckboxModel.of(p,checked,indeterminate).copy(validationMessage=validation.shown ?: "")
    if(m.hidden) return
    val emitControl by rememberUpdatedState(controlEvent)
    val tokens=LocalAWCThemeTokens.current;val dens=LocalDensity.current.density
    val parts=LocalAWCCheckboxPartAppearance.current
    val style=CheckboxStyle(m,LocalAWCCheckboxAppearance.current,parts,tokens,resolveAWCDensity(p["density"],LocalAWCNativeDensity.current))
    val reduced=LocalAWCSelectionReducedMotion.current ?: !ValueAnimator.areAnimatorsEnabled()
    val state=remember { NativeCheckboxState() };state.reduced=reduced;state.tokens=tokens
    var hover by remember { mutableStateOf(false) };var held by remember { mutableStateOf(false) };var pressed by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) };var pointerFocus by remember { mutableStateOf(false) }
    val focusRequester=remember { FocusRequester() }
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    LaunchedEffect(m.disabled) { if(m.disabled) { hover=false;held=false;pressed=false } }
    val states=CheckboxStates(hover && !m.disabled,focused && !pointerFocus,held && !m.disabled,pressed)
    val targets=CheckboxTargets(style.scale(states),style.layerOpacity(states),style.containerColor,style.outlineColor,m.selected)
    SideEffect { if(!state.primed || targets!=state.last) { state.last=targets;state.pending=targets;state.version++
        if(!state.primed || state.armed || reduced) state.apply(state.frameMillis) } }
    LaunchedEffect(state) {
        var woke=false
        fun inputs()=listOf(state.version,hover,held,pressed,focused,pointerFocus,checked,indeterminate)
        while(isActive) {
            withFrameNanos { t-> state.tick(t/1e6) }
            if(woke || state.running(state.frameMillis)) { woke=false;continue }
            state.armed=false
            val seen=inputs();snapshotFlow { inputs() }.first { it!=seen };woke=true
        }
    }
    val scope=rememberCoroutineScope();var pulse by remember { mutableIntStateOf(0) }
    /** `handleClick`: indeterminate becomes checked, otherwise checked flips; mdChange is not cancelable. */
    fun toggle() {
        if(m.disabledClass) return
        val next=if(indeterminate) true else !checked
        indeterminate=false;checked=next
        val detail=mapOf("checked" to next,"indeterminate" to false)
        dispatchNativeAction(AWCActionEvent("mdChange","md-checkbox",detail,cancelable=false,targetID=target?.id ?: targetID),actions,target?.listeners?.invoke().orEmpty())
        emitControl("mdChange",detail)
    }
    /** Space toggles on keydown with a 150 ms pressed pulse (source handleKeyDown). */
    fun keyboardToggle() { if(!m.disabledClass) state.startWave(Offset((style.stateLayer/2).toFloat(),(style.stateLayer/2).toFloat()),style.stateLayer,true)
        pressed=true;toggle();val token=++pulse;scope.launch { delay(150);if(pulse==token) pressed=false } }
    val selectionFocusManager=androidx.compose.ui.platform.LocalFocusManager.current
    validation.bind({ pointerFocus=false;runCatching { focusRequester.requestFocus() }.isSuccess },{ if(focused) selectionFocusManager.clearFocus() },{})
    val touch=style.touch;val c=style.container;val sl=style.stateLayer;val inset=(touch-c)/2
    val support=m.supportMessage;val hasSupport=support.isNotEmpty()
    var supportBox by remember { mutableStateOf(androidx.compose.ui.geometry.Rect.Zero) }
    val ring=states.focusVisible
    val layerColor=style.stateLayerColor;val iconColor=style.iconColor
    val inspector=LocalAWCCheckboxInspector.current
    if(inspector!=null) {
        val read:(Double)->Map<String,Any?> = { t-> val g=if(m.selected) state.glyph(t) else (1.0 to 1.0)
            mapOf("touch" to touch,"containerSize" to c,"containerX" to inset,"iconSize" to style.icon,"stateLayerSize" to sl,"outlineWidth" to style.outlineWidth,
            "containerColor" to state.fill.presented(t),"outlineColor" to state.outline.presented(t),"scale" to state.scale.presented(t),
            "layerOpacity" to (if(style.layerVisible) state.layer.presented(t) else -1.0),"layerColor" to layerColor,"iconColor" to iconColor,
            "iconOpacity" to (if(m.selected) 1.0 else 0.0),"glyph" to m.glyph,"glyphScale" to g.first,"glyphOpacity" to g.second,"focusRing" to ring,"ringOffset" to style.ringOffset,
            "support" to support,"supportColor" to style.supportColor,"supportBox" to supportBox,"targetColor" to parts.targetColor,
            "hover" to states.hover,"pressed" to pressed,"active" to states.active,"focused" to focused,"focusVisible" to states.focusVisible,
            "checked" to m.checked,"indeterminate" to m.indeterminate,"tabindex" to (if(m.decorative) -2 else if(m.disabled) -1 else 0),
            "wave" to state.waves.lastOrNull()?.takeIf { it.began!=null && !it.done(t) }?.let { mapOf("scale" to it.scale(t),"opacity" to it.opacity(t),"x" to it.origin.x.toDouble(),"y" to it.origin.y.toDouble(),"radius" to it.radius) }) }
        val current=AWCCheckboxInspection(state,read);SideEffect { inspector(current) }
    }
    Box(Modifier.width(touch.dp)
        .semantics(mergeDescendants=true) {
            if(m.decorative) { hideFromAccessibility() } else {
                role=Role.Checkbox;toggleableState=if(m.indeterminate) ToggleableState.Indeterminate else ToggleableState(m.checked)
                p.str("ariaLabel").ifEmpty { p.str("aria-label") }.takeIf { it.isNotEmpty() }?.let { contentDescription=it }
                // Web aria-invalid: an error, or required and unchecked (constraint validation); the error text is the error description.
                if(m.hasError || (p.bool("required") && !m.checked)) error(if(m.hasError) m.supportMessage.ifEmpty { "Invalid" } else "Required")
                if(m.disabledClass) disabled() else onClick { toggle();true }
            }
        }
        .focusRequester(focusRequester)
        .onFocusChanged { focused=it.isFocused;if(!it.isFocused) pointerFocus=false }
        // A held Space toggles once: key repeats are consumed without acting (source handleKeyDown, C1).
        .onKeyEvent { e-> if(e.key==Key.Spacebar && !m.disabledClass) { if(e.type==KeyEventType.KeyDown && e.nativeKeyEvent.repeatCount==0) keyboardToggle();true } else false }
        .then(if(m.decorative) Modifier.focusProperties { canFocus=false } else Modifier.focusable(enabled=!m.disabled))
        .pointerInput(m.disabled,m.disabledClass,touch,style.stateLayer) {
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
                            // md-ripple: a press on the circular ripple layer starts a wave at the press point.
                            val sl=style.stateLayer;val lx=pos.x/dens-(touch-sl)/2;val ly=pos.y/dens-(touch-sl)/2
                            if(!m.disabledClass && kotlin.math.hypot(lx-sl/2,ly-sl/2)<=sl/2) state.startWave(Offset(lx.toFloat(),ly.toFloat()),sl,false)
                            if(!m.decorative) { pointerFocus=true;runCatching { focusRequester.requestFocus() } };ch.consume() }
                        PointerEventType.Release -> { val wasHeld=held;held=false;pressed=false
                            state.waves.lastOrNull()?.let { if(it.released==null) { it.releasePending=true;state.version++ } }
                            if(wasHeld && inside && !m.disabledClass) toggle()
                            hover=ch.type==PointerType.Mouse && inside;ch.consume() }
                        else -> {}
                    }
                }
            }
        }
        .drawBehind {
            if(ring) { val o=style.ringOffset.toFloat()*density;val w=2f*density
                if(hasSupport) drawRect(style.focusRingColor,Offset(-o-w/2,-o-w/2),Size(size.width+2*(o+w/2),size.height+2*(o+w/2)),style=Stroke(w))
                else drawCircle(style.focusRingColor,(touch/2*density).toFloat()+o+w/2,Offset((touch/2*density).toFloat(),(touch/2*density).toFloat()),style=Stroke(w)) }
        }) {
        Column {
            Box(Modifier.size(touch.dp).drawBehind {
                val now=state.frameMillis;val center=Offset(size.width/2,size.height/2)
                parts.targetColor?.let { drawCircle(statusDotColor(it),size.width/2,center) }
                if(style.layerVisible) { val o=state.layer.presented(now).toFloat();if(o>0f) drawCircle(layerColor.copy(alpha=layerColor.alpha*o),(sl/2*density).toFloat(),center) }
                if(!m.disabledClass && state.waves.isNotEmpty()) {
                    val r0=(sl/2*density).toFloat();val left=center.x-r0;val top=center.y-r0
                    clipPath(Path().apply { addOval(androidx.compose.ui.geometry.Rect(left,top,left+2*r0,top+2*r0)) }) {
                        for(w in state.waves) { if(w.began==null || w.done(now)) continue
                            val r=(w.radius*w.scale(now)*density).toFloat()
                            if(r>0f) drawCircle(layerColor.copy(alpha=layerColor.alpha*w.opacity(now).toFloat()),r,Offset(left+w.origin.x*density,top+w.origin.y*density)) }
                    } }
            },contentAlignment=Alignment.Center) {
                Box(Modifier.size(c.dp).graphicsLayer { val s=state.scale.presented(state.frameMillis).toFloat();scaleX=s;scaleY=s }.drawBehind {
                    val now=state.frameMillis;val bw=(style.outlineWidth*density).toFloat()
                    val radii=style.shape.radii(c,c)
                    fun rr(delta:Float):androidx.compose.ui.geometry.RoundRect { val k=radii.map { androidx.compose.ui.geometry.CornerRadius(if(it.first<=0) 0f else max(0f,(it.first*density).toFloat()+delta),if(it.second<=0) 0f else max(0f,(it.second*density).toFloat()+delta)) }
                        return androidx.compose.ui.geometry.RoundRect(-delta,-delta,size.width+delta,size.height+delta,k[0],k[1],k[2],k[3]) }
                    drawPath(Path().apply { addRoundRect(rr(0f)) },state.fill.presented(now))
                    if(bw>0f) drawPath(Path().apply { addRoundRect(rr(-bw/2)) },state.outline.presented(now),style=Stroke(bw))
                },contentAlignment=Alignment.Center) {
                    val fontSize=with(LocalDensity.current) { style.icon.dp.toSp() }
                    Box(Modifier.size(style.icon.dp).graphicsLayer {
                        val g=if(m.selected) state.glyph(state.frameMillis) else (1.0 to 1.0)
                        scaleX=g.first.toFloat();scaleY=g.first.toFloat();alpha=if(m.selected) g.second.toFloat() else 0f
                    },contentAlignment=Alignment.Center) {
                        Text(m.glyph,Modifier.wrapContentSize(unbounded=true).clearAndSetSemantics { },color=iconColor,fontFamily=CheckboxGlyphFamily,fontWeight=FontWeight(600),fontSize=fontSize,lineHeight=fontSize,
                            letterSpacing=0.sp,maxLines=1,softWrap=false,style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false),fontFeatureSettings="liga"))
                    }
                }
            }
            // Web: the error line is role="alert" — its own assertive live region, not part of the checkbox name.
            if(hasSupport) Text(support,Modifier.then(if(m.hasError) Modifier.semantics(mergeDescendants=true) { liveRegion=LiveRegionMode.Assertive } else Modifier).padding(top=2.dp).wrapContentWidth(Alignment.Start,unbounded=true).padding(start=inset.dp)
                .onGloballyPositioned { val o=it.positionInRoot();supportBox=androidx.compose.ui.geometry.Rect(o.x/dens,o.y/dens,(o.x+it.size.width)/dens,(o.y+it.size.height)/dens) },
                color=style.supportColor,fontFamily=AccordionRoboto,fontWeight=FontWeight.Normal,fontSize=style.supportFontSize.sp,lineHeight=style.supportLineHeight.sp,
                // CSS line box: the full line height with the half-leading on both sides (no trimming).
                maxLines=1,softWrap=false,style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false),
                    lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None)))
        }
    }
}
