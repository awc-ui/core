@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package dev.awc.nativeui

import androidx.compose.foundation.border
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.rememberScrollableState
import androidx.compose.foundation.gestures.scrollable
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.inset
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerType
import androidx.compose.ui.input.pointer.isPrimaryPressed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChanged
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.roundToInt

/** Compose semantics metadata (not Android accessibility roles) for source attributes without a native equivalent. */
val AWCAccordionHeadingLevel=SemanticsPropertyKey<Int>("AWCAccordionHeadingLevel")
val AWCAccordionRegionRole=SemanticsPropertyKey<String>("AWCAccordionRegionRole")
val AWCAccordionRegionLabel=SemanticsPropertyKey<String>("AWCAccordionRegionLabel")
/** Elapsed milliseconds of the running disclosure on the header node; -1 when settled. Verification metadata. */
val AWCAccordionTransitionElapsed=SemanticsPropertyKey<Double>("AWCAccordionTransitionElapsed")

internal val AccordionRoboto=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium),Font(R.font.awc_roboto_bold,FontWeight.Bold))
// A source font-size of 0 keeps its line box but paints nothing; Compose needs a positive size.
internal fun accordionTextStyle(size:Double,lineHeight:Double,weight:Int,spacing:Double,color:Color)=TextStyle(color=color,fontSize=(if(size>0) size else .01).sp,lineHeight=lineHeight.sp,
    fontFamily=AccordionRoboto,fontWeight=FontWeight(weight.coerceIn(1,1000)),letterSpacing=spacing.sp,platformStyle=PlatformTextStyle(includeFontPadding=false),
    lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))

/** A running disclosure starts from the current presented values when interrupted. */
internal class NativeAccordionRunning(val start:NativeAccordionMotion.Frame,val motion:NativeAccordionMotion) {
    fun frame(elapsed:Double):NativeAccordionMotion.Frame {
        val next=motion.frame(elapsed.coerceAtLeast(0.0));val target=if(motion.opening) 1.0 else 0.0
        fun interpolate(from:Double,value:Double)=from+(target-from)*(if(motion.opening) value else 1-value)
        val height=interpolate(start.height,next.height)
        return NativeAccordionMotion.Frame(height,height*height,if(motion.preset=="collapse") 1.0 else interpolate(start.opacity,next.opacity),
            interpolate(start.shape,next.shape),interpolate(start.spatial,next.spatial),interpolate(start.effects,next.effects))
    }
}
internal fun accordionSteadyFrame(preset:String,expanded:Boolean)=NativeAccordionMotion(preset,expanded,reduced=true).frame(0.0)

/** A source CSS length: affine in the percentage base (the content's natural height). */
internal class AccordionLength(val evaluate:(Double)->Double,val usesPercent:Boolean)
private class AccordionLengthParser(val text:String,val font:Double,val zero:Double,val root:Double) {
    private class V(val f:(Double)->Double,val length:Boolean,val percent:Boolean)
    var i=0
    private fun ws() { while(i<text.length && text[i].isWhitespace()) i++ }
    private fun sum():V? {
        var left=product() ?: return null
        while(true) { ws();if(i>=text.length) break
            val op=text[i];if(op!='+' && op!='-') break
            // CSS requires whitespace around binary +/- inside calc().
            if(i==0 || !text[i-1].isWhitespace() || i+1>=text.length || !text[i+1].isWhitespace()) return null
            i++;val right=product() ?: return null
            if(right.length!=left.length) return null
            val l=left;left=V(if(op=='+') { b->l.f(b)+right.f(b) } else { b->l.f(b)-right.f(b) },l.length,l.percent || right.percent) }
        return left
    }
    private fun product():V? {
        var left=factor() ?: return null
        while(true) { ws();if(i>=text.length) break
            val op=text[i];if(op!='*' && op!='/') break
            i++;val right=factor() ?: return null
            if(op=='*' && left.length && right.length || op=='/' && right.length) return null
            val l=left;left=V(if(op=='*') { b->l.f(b)*right.f(b) } else { b->l.f(b)/right.f(b) },l.length || right.length,l.percent || right.percent) }
        return left
    }
    private fun args():List<V>? {
        val list=mutableListOf<V>()
        while(true) { list+=sum() ?: return null;ws();if(i>=text.length) return null
            if(text[i]==',') { i++;continue };if(text[i]==')') { i++;return list };return null }
    }
    private fun factor():V? {
        ws();if(i>=text.length) return null
        val lower=text.substring(i).lowercase(java.util.Locale.ROOT)
        for(name in listOf("calc","min","max","clamp")) if(lower.startsWith("$name(")) {
            i+=name.length+1
            val a=args() ?: return null
            if(a.any { !it.length }) return null
            val percent=a.any { it.percent }
            return when(name) {
                "calc"->if(a.size==1) a[0] else null
                "min"->V({ b->a.minOf { it.f(b) } },true,percent)
                "max"->V({ b->a.maxOf { it.f(b) } },true,percent)
                else->if(a.size==3) V({ b->maxOf(a[0].f(b),minOf(a[1].f(b),a[2].f(b))) },true,percent) else null
            }
        }
        if(text[i]=='(') { i++;val e=sum() ?: return null;ws();if(i>=text.length || text[i]!=')') return null;i++;return e }
        val match=Regex("^([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)(px|em|rem|ch|%)?",RegexOption.IGNORE_CASE).find(text.substring(i)) ?: return null
        i+=match.value.length
        val n=match.groupValues[1].toDoubleOrNull() ?: return null
        return when(match.groupValues[2].lowercase(java.util.Locale.ROOT)) {
            "px"->V({ n },true,false);"em"->V({ n*font },true,false);"rem"->V({ n*root },true,false);"ch"->V({ n*zero },true,false)
            "%"->V({ b->n/100*b },true,true);else->V({ n },false,false)
        }
    }
    fun parse():AccordionLength? {
        val v=sum() ?: return null;ws()
        if(i!=text.length) return null
        // A top-level unitless value is valid only as zero; a negative literal max-height is invalid.
        if(!v.length) return if(v.f(0.0)==0.0) AccordionLength({ 0.0 },false) else null
        val top=text.trim()
        if(top.startsWith("-") && !top.startsWith("-0")) return null
        return AccordionLength({ b->v.f(b).takeIf(Double::isFinite)?.coerceAtLeast(0.0) ?: 0.0 },v.percent)
    }
}
/** max-block-size of the content box: px/em/rem/ch/% with calc(), min(), max() and clamp(). Null is "no cap". */
internal fun accordionContentCap(css:String,fontSize:Double,zeroAdvance:Double=fontSize*.5,rootFontSize:Double=16.0):AccordionLength? {
    val text=css.trim()
    if(text.isEmpty() || text.equals("none",true)) return null
    return AccordionLengthParser(text,fontSize,zeroAdvance,rootFontSize).parse()
}

@Composable private fun AccordionSymbol(name:String,size:Double,fill:Double,weight:Double,color:Color) {
    // Quantized axes bound the native typeface cache during an animated FILL change.
    val fillStep=(fill.coerceIn(0.0,1.0)*50).roundToInt()/50f
    val weightStep=weight.roundToInt().coerceIn(100,700)
    val family=remember(fillStep,weightStep) { FontFamily(Font(R.font.awc_material_symbols,FontWeight(weightStep),
        variationSettings=FontVariation.Settings(FontVariation.Setting("FILL",fillStep),FontVariation.weight(weightStep),FontVariation.Setting("opsz",24f),FontVariation.grade(0)))) }
    val fontSize=with(LocalDensity.current) { size.dp.toSp() }
    Box(Modifier.clearAndSetSemantics { hideFromAccessibility() },contentAlignment=Alignment.Center) {
        Text(name,Modifier.wrapContentSize(unbounded=true),color=color,fontFamily=family,fontWeight=FontWeight(weightStep),fontSize=fontSize,lineHeight=fontSize,
            letterSpacing=0.sp,maxLines=1,softWrap=false,style=TextStyle(platformStyle=PlatformTextStyle(includeFontPadding=false),fontFeatureSettings="liga"))
    }
}

/** The grip glyph in its transitioning colour; only this scope recomposes per frame. */
@Composable private fun AccordionGripSymbol(style:NativeAccordionItemStyle,override:Color?,size:Double) {
    @Suppress("UNUSED_VARIABLE") val v=style.version
    AccordionSymbol("drag_indicator",size,0.0,400.0,override ?: style.gripColor.presented(style.frameMillis))
}

private enum class HeaderPart { Drag, Leading, Text, Trailing }

@Composable internal fun NativeAccordionItem(p:Props,emit:EventSink,slot:Slot?,child:NativeAccordionChild,componentInspection:AWCInspectionContext?) {
    val item=child.state
    val candidate=LocalNativeAccordionOwner.current
    val target=LocalAWCActionTarget.current
    val actions=LocalAWCAction.current
    val controller=LocalAWCAccordionItemController.current
    val latestEmit=rememberUpdatedState(emit)
    val previous=remember { HashMap<String,AWCValue>(p) }
    val requester=remember { FocusRequester() }
    var focused by remember { mutableStateOf(false) }
    var keyboardFocus by remember { mutableStateOf(true) }
    SideEffect {
        fun changed(key:String)=p[key]!=previous[key]
        if(changed("disabled")) item.disabled=p.bool("disabled")
        if(changed("headingLevel")) item.headingLevel=p.int("headingLevel",3)
        if(changed("regionRole")) item.regionRole=p.str("regionRole","region")
        if(changed("collapsible")) item.collapsible=p.bool("collapsible",true)
        val expandedChanged=changed("expanded")
        previous.clear();previous.putAll(p)
        if(expandedChanged) item.assignExpanded(p.bool("expanded"))
    }
    // Wiring and registration happen during composition: the owner's first connection
    // (its own effect) may run before child effects, and must already dispatch through
    // this item's real native scopes. Plain field assignments; no snapshot writes.
    child.targetID=target?.id ?: child.generatedTarget
    item.emit={ name,detail->
        if(candidate?.initializing==true) child.snapNext=true
        accordionDispatch(name,"md-accordion-item",detail,child.generatedTarget,actions,target) { n,v->latestEmit.value(n,v) }
        false // Coordination already ran in the owner's bubble listener.
    }
    item.requestFocus={ keyboardFocus=true;runCatching { requester.requestFocus() } }
    remember(candidate,child) { NativeAccordionRegistration(candidate,child) }
    candidate?.retarget(child)
    DisposableEffect(controller,item) { controller?.item=item;onDispose { if(controller?.item===item) controller.item=null } }
    item.hidden=p.bool("hidden")
    if(item.hidden) return
    val owner=candidate?.takeIf { item.index>=0 && item.owner===it.state }
    val configuration=owner?.state?.configuration ?: NativeAccordionConfiguration()
    val outlined=configuration.variant=="outlined"
    val d=LocalAWCNativeDensity.current
    // forced-colors: author colours are forced (backgrounds Canvas, text and icons CanvasText); state layers are display: none.
    val forcedPalette=awcForcedColors()
    val appearance=LocalAWCAccordionItemAppearance.current.normalized().let { a-> forcedPalette?.let { f-> a.copy(containerColor=f.canvas,containerColorExpanded=f.canvas,
        containerColorDragging=f.canvas,headerColor=f.canvas,headerColorExpanded=f.canvas,headlineColor=f.canvasText,headlineColorExpanded=f.canvasText,supportingColor=f.canvasText,
        iconColor=f.canvasText,iconColorExpanded=f.canvasText,stateLayerColor="#00000000",stateLayerColorExpanded="#00000000",elevation=emptyList(),elevationExpanded=emptyList(),
        chassisHandleColor=f.canvasText) } ?: a }
    val groupAppearance=LocalAWCAccordionAppearance.current.normalized()
    val colors=MaterialTheme.colorScheme
    val tokens=LocalAWCThemeTokens.current
    val (reduced,forced)=rememberAWCAccessibilityAppearance()
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val expanded=item.expanded
    val dragging=owner!=null && owner.state.draggedItemID==item.id
    val ownerContext=owner?.inspection
    val index=item.index
    val ctx=if(owner!=null) ownerContext?.let { remember(it,index) { AWCInspectionContext(it.collector,"${it.id}.item-$index",true,it.id) } } else componentInspection

    // ---- motion ----
    val preset=configuration.transition
    val motion=remember(preset,expanded,appearance.expandDuration,appearance.collapseDuration,reduced) {
        NativeAccordionMotion(preset,expanded,appearance.expandDuration,appearance.collapseDuration,reduced) }
    var running by remember { mutableStateOf<NativeAccordionRunning?>(null) }
    var elapsed by remember { mutableDoubleStateOf(0.0) }
    var presented by remember { mutableStateOf(expanded) }
    LaunchedEffect(expanded,reduced,preset) {
        if(presented==expanded && running==null) return@LaunchedEffect
        val start=running?.frame(elapsed) ?: accordionSteadyFrame(preset,presented)
        presented=expanded
        if(child.snapNext || motion.duration<=0.0) { child.snapNext=false;running=null;return@LaunchedEffect }
        val transition=NativeAccordionRunning(start,motion)
        running=transition;elapsed=0.0
        val begin=withFrameNanos { it }
        while(true) {
            val now=withFrameNanos { it }
            elapsed=(now-begin)/1_000_000.0
            if(elapsed>=motion.duration) break
        }
        // Only a completed transition clears itself. A cancelled one stays presented so
        // the replacing effect (an interruption) starts from its current values.
        if(running===transition) running=null
    }
    val pending=running==null && presented!=expanded && !child.snapNext && motion.duration>0
    val frame=running?.frame(elapsed) ?: if(pending) accordionSteadyFrame(preset,presented) else accordionSteadyFrame(preset,expanded)
    // The elapsed time actually composed into this frame (semantics blocks read lazily).
    val composedElapsed=if(running!=null) elapsed else -1.0

    // ---- source values ----
    fun hex(value:String?,fallback:Color)=value?.let(::statusDotColor) ?: fallback
    val medium=accordionTokenLength(tokens,"--md-sys-shape-corner-medium",12.0)
    val large=accordionTokenLength(tokens,"--md-sys-shape-corner-large",16.0)
    // A floating filled group's slotted defaults: flush, square, transparent and flat tiles (item hooks still win).
    val floatingFilled=owner!=null && configuration.floating && !outlined
    val restingShape=if(outlined) AccordionZeroShape else appearance.containerShape ?: if(floatingFilled) AccordionZeroShape else AWCCornerShape.uniform(medium)
    val expandedShape=if(outlined) AccordionZeroShape else appearance.containerShapeExpanded ?: if(floatingFilled) AccordionZeroShape else AWCCornerShape.uniform(large)
    val currentShape=if(dragging) appearance.containerShapeDragging ?: AWCCornerShape.uniform(medium) else restingShape.lerp(expandedShape,frame.shape)
    val headerShape=AWCCornerShape(restingShape.topLeft.lerp(expandedShape.topLeft,frame.shape),restingShape.topRight.lerp(expandedShape.topRight,frame.shape),
        restingShape.bottomRight.lerp(AWCCornerRadius(),frame.shape),restingShape.bottomLeft.lerp(AWCCornerRadius(),frame.shape))
    val effects=frame.effects.toFloat()
    val restingContainer=hex(appearance.containerColor,if(outlined || floatingFilled) Color.Transparent else colors.surfaceContainerLow)
    val container=when {
        dragging->hex(appearance.containerColorDragging,colors.surfaceContainerLow)
        outlined->restingContainer
        else->accordionMix(restingContainer,hex(appearance.containerColorExpanded,colors.surfaceContainer),effects)
    }
    val headerExpanded=hex(appearance.headerColorExpanded,colors.secondaryContainer).let { if(item.disabled) it.copy(alpha=it.alpha*.12f) else it }
    val headerBackground=accordionMix(hex(appearance.headerColor,Color.Transparent),headerExpanded,effects)
    val headline=hex(appearance.headlineColor,colors.onSurface)
    val headerInk=if(item.disabled) headline.copy(alpha=headline.alpha*.38f) else accordionMix(headline,hex(appearance.headlineColorExpanded,colors.onSecondaryContainer),effects)
    val icon=accordionMix(hex(appearance.iconColor,colors.onSurfaceVariant),hex(appearance.iconColorExpanded,colors.onSecondaryContainer),effects)
    val supporting=hex(appearance.supportingColor,colors.onSurfaceVariant)
    val stateColor=accordionMix(hex(appearance.stateLayerColor,colors.onSurface),hex(appearance.stateLayerColorExpanded,colors.onSecondaryContainer),effects)
    val level=configuration.elevation.takeIf { it in 1..5 } ?: 0
    fun token(n:Int)=NativeShadowLayer.parse(tokens["--md-sys-elevation-$n"])
    val restingShadow=if(outlined) emptyList() else appearance.elevation?.map { it.resolved() } ?: if(floatingFilled) emptyList() else token(if(owner!=null) level else 0)
    val expandedShadow=if(outlined) emptyList() else appearance.elevationExpanded?.map { it.resolved() } ?: if(floatingFilled) emptyList() else if(owner!=null && level in 1..5) token(minOf(5,level+1)) else restingShadow
    val shadow=if(dragging) token(4) else NativeShadowLayer.interpolate(restingShadow,expandedShadow,frame.effects)
    val headerPadding=appearance.headerPadding ?: AWCAccordionInsets(max(4.0,16+2*d),max(12.0,24+2*d))
    val contentPadding=appearance.contentPadding ?: AWCAccordionInsets(max(8.0,20+2*d),max(12.0,24+2*d))
    val minHeight=appearance.headerMinHeight ?: max(40.0,64+4*d)
    val gap=max(8.0,16+2*d)
    val headlineStyle=accordionTextStyle(max(13.0,16+.5*d),max(18.0,24+d),500,.15,headerInk)
    val supportingStyle=accordionTextStyle(max(10.0,12+.5*d),max(14.0,16+.5*d),400,.4,supporting)
    val bodyFont=max(12.0,14+.5*d)
    val bodyStyle=accordionTextStyle(bodyFont,max(16.0,20+d),400,0.0,supporting)
    val iconSize=max(18.0,24+d)
    val headlineText=p.str("headline");val supportText=p.str("supportingText");val iconName=p.str("icon")
    val separator=outlined && owner!=null && owner.state.items.lastOrNull()!==item
    val outline=hex(groupAppearance.outlineColor,colors.outlineVariant)
    val animateEffects=!reduced && preset!="none"
    val effectsDuration=accordionTokenDuration(tokens,"--md-sys-motion-spring-effects-default-duration",200.0).toInt()

    // ---- interaction ----
    val interactions=remember { MutableInteractionSource() }
    val focusVisible=focused && keyboardFocus
    // Header interaction styles (state layer, grip, ripple) are CSS transitions on the frame clock.
    val style=remember { NativeAccordionItemStyle() }
    val styleScope=rememberCoroutineScope()
    val gripRest=hex(appearance.iconColor,colors.onSurfaceVariant)
    val gripHoverInk=hex(appearance.headlineColorExpanded,colors.onSecondaryContainer)
    val gripDragInk=hex(appearance.iconColorExpanded,colors.onSecondaryContainer)
    style.targets={ accordionStyleTargets(style.live(),gripRest,gripHoverInk,gripDragInk,
        accordionTokenNumber(tokens,"--md-sys-state-hover-state-layer-opacity",.08),
        accordionTokenNumber(tokens,"--md-sys-state-focus-state-layer-opacity",.12),
        accordionTokenNumber(tokens,"--md-sys-state-pressed-state-layer-opacity",.12)) }
    style.live={ style.pointer.copy(focusVisible=focused && keyboardFocus,dragging=owner!=null && owner.state.draggedItemID==item.id) }
    val styleInspector=LocalAWCAccordionStyleInspector.current
    val styleInspection=remember(style) { AWCAccordionItemStyleInspection(style) { item.disabled || forced } }
    SideEffect {
        style.scope=styleScope
        style.timing=AccordionStyleTiming.of(preset,reduced,motion.effectsDuration,motion.effectsCurve,tokens,item.disabled)
        if(item.disabled) { if(style.pointer.pressed) style.pointer=style.pointer.copy(pressed=false);if(style.waves.isNotEmpty()) style.clearWaves() }
        if(!style.initialized) style.initialize() else if(style.differs()) style.request()
        styleInspector?.invoke(headlineText,styleInspection)
    }
    val headerGeometry=remember { AccordionHeaderGeometry() }
    // ---- floating chassis grip (first item of a floating group) ----
    val chassis=owner!=null && configuration.floating && item.hasChassisHandle
    val chassisStyle=remember { NativeAccordionChassisStyle() }
    style.chassis=chassisStyle
    val chassisHook=appearance.chassisHandleColor?.let(::statusDotColor)
    val chassisHoverHook=appearance.chassisHandleBackgroundHover?.let(::statusDotColor)
    val chassisStateLayer=hex(appearance.stateLayerColor,colors.onSurface)
    chassisStyle.live={ chassisStyle.pointer.copy(dragging=owner?.state?.chassisDragging==true,expanded=item.expanded) }
    chassisStyle.targets={ accordionChassisTargets(chassisStyle.live(),chassisHook,chassisHoverHook,colors.onSurfaceVariant,colors.onSecondaryContainer,colors.primary,chassisStateLayer,forcedPalette!=null) }
    val accordionViewport=LocalAWCAccordionViewport.current
    val chassisBounds=remember { arrayOfNulls<androidx.compose.ui.geometry.Rect>(1) }
    SideEffect {
        chassisStyle.scope=styleScope
        chassisStyle.timing=AccordionStyleTiming.of(preset,reduced,motion.effectsDuration,motion.effectsCurve,tokens)
        if(!chassisStyle.initialized) chassisStyle.initialize() else if(chassisStyle.differs()) chassisStyle.request()
    }
    val focusManager=LocalFocusManager.current
    var panelFocused by remember { mutableStateOf(false) }
    LaunchedEffect(expanded) { if(!expanded && panelFocused) focusManager.clearFocus(force=true) }
    val focusColor=colors.secondary
    val label=listOf(headlineText,supportText).filter { it.isNotEmpty() }.joinToString(" ")
    val capText=p.str("contentMaxHeight").trim()
    val scrollable=capText.isNotEmpty()
    val context=androidx.compose.ui.platform.LocalContext.current
    // CSS `ch`: the unrounded advance of "0" in the body font (Compose text layout rounds widths).
    val zeroAdvance=remember(bodyFont,context) {
        // Measured unhinted at a large size: small-size hinting rounds advances to whole pixels.
        android.graphics.Paint(android.graphics.Paint.SUBPIXEL_TEXT_FLAG).apply { typeface=context.resources.getFont(R.font.awc_roboto_regular);textSize=1000f;isLinearText=true }.measureText("0").toDouble()*bodyFont/1000 }
    // Retained physical offset: removing the cap exposes all content; reapplying restores it.
    val scrollOffset=remember { mutableFloatStateOf(0f) }
    val scrollMax=remember { mutableIntStateOf(0) }
    val viewport=remember { mutableIntStateOf(0) }
    val contribution=remember { IntArray(1) }
    val scrollState=rememberScrollableState { delta->
        val max=scrollMax.intValue.toFloat();val before=scrollOffset.floatValue.coerceIn(0f,max)
        val next=(before-delta).coerceIn(0f,max);scrollOffset.floatValue=next;before-next }
    var scrollFocused by remember { mutableStateOf(false) }
    val naturalHeight=remember { IntArray(1) }
    val handleTop=remember { FloatArray(1) }
    val density=LocalDensity.current
    val cap=accordionContentCap(capText,bodyFont,zeroAdvance)

    // ---- exported part styles (sparse ::part() equivalents) ----
    val partStyles=LocalAWCAccordionItemParts.current
    fun part(p:AWCAccordionItemPart)=partStyles[p]?.normalized() ?: AWCAccordionPartAppearance()
    val headingPart=part(AWCAccordionItemPart.Heading);val headerPart=part(AWCAccordionItemPart.Header)
    val layerPart=part(AWCAccordionItemPart.StateLayer);val dragPart=part(AWCAccordionItemPart.DragHandle)
    val leadingPart=part(AWCAccordionItemPart.LeadingIcon);val trailingPart=part(AWCAccordionItemPart.TrailingIcon)
    val headlinePart=part(AWCAccordionItemPart.Headline);val supportingPart=part(AWCAccordionItemPart.SupportingText)
    val panelPart=part(AWCAccordionItemPart.Panel);val contentPart=part(AWCAccordionItemPart.Content);val innerPart=part(AWCAccordionItemPart.ContentInner)
    val zero=AWCAccordionInsets(0.0,0.0)
    // The item is a block formatting context: heading/header/panel vertical margins collapse
    // where the source block flow collapses them (through an unpadded, unbordered heading).
    val headingMargin=headingPart.margin ?: zero;val headerMargin=headerPart.margin ?: zero;val panelMargin=panelPart.margin ?: zero
    val collapseTop=(headingPart.padding?.top ?: 0.0)==0.0 && headingPart.border==0.0
    val collapseBottom=(headingPart.padding?.bottom ?: 0.0)==0.0 && headingPart.border==0.0 && headingPart.height==null && (headingPart.minHeight ?: 0.0)==0.0
    val stackTop=if(collapseTop) accordionCollapsedMargin(headingMargin.top,headerMargin.top) else headingMargin.top
    val stackBetween=if(collapseBottom) accordionCollapsedMargin(headingMargin.bottom,headerMargin.bottom,panelMargin.top) else accordionCollapsedMargin(headingMargin.bottom,panelMargin.top)
    val headerInkStyled=hex(headerPart.color,headerInk)
    val headlineStyleStyled=accordionTextStyle(headlinePart.fontSize ?: headerPart.fontSize ?: max(13.0,16+.5*d),headlinePart.lineHeight ?: headerPart.lineHeight ?: max(18.0,24+d),
        (headlinePart.fontWeight ?: headerPart.fontWeight ?: 500.0).roundToInt(),headlinePart.letterSpacing ?: headerPart.letterSpacing ?: .15,hex(headlinePart.color,headerInkStyled))
    val supportingStyleStyled=accordionTextStyle(supportingPart.fontSize ?: max(10.0,12+.5*d),supportingPart.lineHeight ?: max(14.0,16+.5*d),
        (supportingPart.fontWeight ?: 400.0).roundToInt(),supportingPart.letterSpacing ?: .4,hex(supportingPart.color,supporting))
    val innerStyle=accordionTextStyle(innerPart.fontSize ?: bodyFont,innerPart.lineHeight ?: max(16.0,20+d),(innerPart.fontWeight ?: 400.0).roundToInt(),
        innerPart.letterSpacing ?: 0.0,hex(innerPart.color,supporting))
    val headerPad=headerPart.padding ?: headerPadding
    val innerPad=innerPart.padding ?: contentPadding
    val iconInk=hex(null,icon)
    val trackNatural=remember { IntArray(2) }

    Box(Modifier.fillMaxWidth()
        .onGloballyPositioned { if(owner!=null) owner.itemBounds[item.id]=it.boundsInRoot() }
        .accordionShadow(currentShape,shadow,false)
        .background(container,currentShape)
        .accordionShadow(currentShape,shadow,true)
        .then(if(dragging) Modifier.clip(currentShape) else Modifier)
        .awcCursor(if(dragging) AWCCursorStyle.Grabbing else null,stable=true)
        .inspectAWCNode(ctx,"","md-accordion-item")
        // forced-colors: `:host { border: 1px solid CanvasText }`, inside the item's border box.
        .then(if(forcedPalette!=null) Modifier.border(1.dp,awcColor(forcedPalette.canvasText,Color.White),currentShape).awcBorderInset(1.dp) else Modifier)) {
      Layout(contents=listOf({
        // ---- heading (source h1-h6 box) + header ----
        Box(Modifier.fillMaxWidth()
            .accordionBoxSize(headingPart,borderBox=false)
            .inspectAWCNode(ctx,"heading","heading")
            .accordionDecor(hex(headingPart.backgroundColor,Color.Transparent),headingPart.border,hex(headingPart.borderColor,colors.onSurface),headingPart.cornerShape ?: AccordionZeroShape)
            .then(headingPart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
            .accordionPadding(headingPart.padding,headingPart.border)) {
            val headerStyleShape=headerPart.cornerShape ?: headerShape
            Box(Modifier.fillMaxWidth()
                .accordionHeaderPlacement(headerPart,headerMargin,collapseTop,collapseBottom,rtl)
                .focusRequester(requester)
                .onFocusChanged { focused=it.isFocused;style.request() }
                .focusProperties { canFocus=!item.disabled }
                .onPreviewKeyEvent { e->
                    val confirm=e.key==Key.Enter || e.key==Key.NumPadEnter || e.key==Key.Spacebar
                    if(e.type==KeyEventType.KeyDown) {
                        keyboardFocus=true
                        val name=when(e.key) { Key.Enter,Key.NumPadEnter->"Enter";Key.Spacebar->" ";Key.DirectionUp->"ArrowUp";Key.DirectionDown->"ArrowDown"
                            Key.MoveHome->"Home";Key.MoveEnd->"End";else->null }
                        if(name==null) false else item.key(name,e.isAltPressed)
                    } else confirm && e.type==KeyEventType.KeyUp
                }
                .onGloballyPositioned { headerGeometry.moveTo(it.boundsInRoot());headerGeometry.awaitingLayout=false;headerGeometry.rehit(style) }
                .pointerInput(item.disabled) {
                    // Observes (never consumes) every pointer event of the header and its grip in the
                    // initial pass: CSS :hover of the header and grip, :active, the ripple, pointer focus.
                    awaitPointerEventScope {
                        while(true) {
                            val e=awaitPointerEvent(PointerEventPass.Initial)
                            val change=e.changes.firstOrNull() ?: continue
                            val local=change.position
                            headerGeometry.pointer=headerGeometry.header?.let { Offset(it.left+local.x,it.top+local.y) }
                            val hoverCapable=change.type!=PointerType.Touch
                            headerGeometry.hoverCapable=hoverCapable
                            val inside=local.x>=0 && local.y>=0 && local.x<size.width && local.y<size.height
                            val dragging=style.live().dragging
                            var next=style.pointer
                            when(e.type) {
                                PointerEventType.Exit->{ next=next.copy(hovered=false,gripHovered=false);headerGeometry.pointer=null }
                                PointerEventType.Press->{
                                    val primary=change.type!=PointerType.Mouse || e.buttons.isPrimaryPressed
                                    headerGeometry.awaitingLayout=false
                                    if(primary && !item.disabled) {
                                        next=next.copy(pressed=true,hovered=hoverCapable && inside,gripHovered=hoverCapable && inside && headerGeometry.overGrip(local))
                                        style.press(Offset(local.x/density.density,local.y/density.density),size.width/density.density.toDouble(),size.height/density.density.toDouble())
                                        keyboardFocus=false;runCatching { requester.requestFocus() }
                                    }
                                }
                                PointerEventType.Release->{
                                    // A drop lays the item out again; the grip leaves the pointer (re-hit after layout).
                                    // A mouse release can arrive as two events (button release, then up): the second one sees the drop
                                    // already ended, so it must not hit-test the pre-drop geometry either.
                                    next=next.copy(pressed=false,hovered=hoverCapable && inside,gripHovered=!dragging && !headerGeometry.awaitingLayout && hoverCapable && inside && headerGeometry.overGrip(local))
                                    // Until that layout, pointer positions are relative to the pre-drop placement: the browser hit-tests
                                    // the dropped layout, so hover events in between must not re-derive hover from stale geometry (a
                                    // hover move racing the drop's layout made the grip hovered for one frame).
                                    if(dragging && (owner?.state?.draggedOffset ?: 0.0)!=0.0) headerGeometry.awaitingLayout=true
                                    style.release()
                                }
                                else->if(!headerGeometry.awaitingLayout) next=next.copy(hovered=hoverCapable && inside,gripHovered=hoverCapable && inside && headerGeometry.overGrip(local))
                            }
                            if(next!=style.pointer) { style.pointer=next;style.request() }
                        }
                    }
                }
                .then(headerPart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
                .background(hex(headerPart.backgroundColor,headerBackground),headerStyleShape)
                .clip(headerStyleShape)
                .then(if(item.disabled || forced) Modifier else Modifier.accordionRipple(style,headerInkStyled))
                .clickable(interactions,null,enabled=!item.disabled && !dragging,role=Role.Button) { item.toggle() }
                .semantics {
                    heading()
                    this[AWCAccordionHeadingLevel]=item.headingLevel.coerceIn(1,6)
                    this[AWCAccordionTransitionElapsed]=composedElapsed
                    stateDescription=if(expanded) "Expanded" else "Collapsed"
                    if(!item.disabled) { if(expanded) { if(!item.toggleBlocked) collapse { item.toggle();true } } else expand { item.toggle();true } }
                    if(item.toggleBlocked && !item.disabled) disabled()
                }
                .drawWithContent {
                    drawContent()
                    if(headerPart.border>0) { val w=(headerPart.border*density.density).toFloat()
                        inset(w/2) { drawOutline(headerStyleShape.createOutline(size,layoutDirection,this),hex(headerPart.borderColor,headerInkStyled),style=Stroke(w)) } }
                    if(focusVisible) { val w=3.dp.toPx()
                        inset(w/2) { drawOutline(headerStyleShape.createOutline(size,layoutDirection,this),focusColor,style=Stroke(w)) } }
                }
                .awcCursor(if(item.disabled) AWCCursorStyle.NotAllowed else AWCCursorStyle.Pointer)
                .inspectAWCNode(ctx,"header","header")) {
                if(!item.disabled && !forced) Box(Modifier.matchParentSize().absolutePadding(headerPart.border.dp,headerPart.border.dp,headerPart.border.dp,headerPart.border.dp)) {
                    Box(Modifier.fillMaxSize().inspectAWCNode(ctx,"state-layer","state-layer")
                        .graphicsLayer { @Suppress("UNUSED_VARIABLE") val v=style.version
                            alpha=layerPart.opacity?.toFloat() ?: style.stateOpacity.presented(style.frameMillis).toFloat() }
                        .accordionDecor(hex(layerPart.backgroundColor,stateColor),layerPart.border,hex(layerPart.borderColor,headerInkStyled),layerPart.cornerShape ?: AccordionZeroShape))
                }
                Layout(contents=listOf(
                    {
                        if(configuration.reorderable && owner!=null && !item.disabled) {
                            val dragInk=hex(dragPart.color,style.gripColor.value)
                            AccordionSlotHost("",null,Modifier.accordionMargin(dragPart.margin ?: if(rtl) AWCAccordionInsets(0.0,0.0,0.0,-4.0) else AWCAccordionInsets(0.0,-4.0,0.0,0.0))
                                .onGloballyPositioned { handleTop[0]=it.boundsInRoot().top;headerGeometry.grip=it.boundsInRoot();headerGeometry.rehit(style) }
                                .pointerInput(owner,item) { accordionReorderGesture(owner,item) { handleTop[0] } }
                                .graphicsLayer { @Suppress("UNUSED_VARIABLE") val v=style.version
                                    val now=style.frameMillis
                                    alpha=dragPart.opacity?.toFloat() ?: style.gripOpacity.presented(now).toFloat()
                                    val scale=style.gripScale.presented(now).toFloat();scaleX=scale;scaleY=scale }
                                .awcCursor(if(dragging) AWCCursorStyle.Grabbing else AWCCursorStyle.Grab)
                                .inspectAWCNode(ctx,"drag-handle","drag-handle")
                                .accordionDecor(hex(dragPart.backgroundColor,Color.Transparent),dragPart.border,hex(dragPart.borderColor,dragInk),dragPart.cornerShape ?: AccordionZeroShape)
                                .clearAndSetSemantics {},AccordionBoxFrame((dragPart.width ?: 24.0).dp,(dragPart.height ?: 24.0).dp,dragPart.padding,dragPart.border)) {
                                AccordionGripSymbol(style,dragPart.color?.let { hex(it,Color.Unspecified) },max(16.0,22+d))
                            }
                        }
                    },
                    {
                        val scale=if(reduced) 1f else frame.leadingScale.toFloat()
                        val leadInk=hex(leadingPart.color,iconInk)
                        CompositionLocalProvider(LocalContentColor provides leadInk,LocalTextStyle provides headlineStyleStyled.copy(color=leadInk)) {
                            AccordionSlotHost("leading-icon",slot,Modifier.accordionMargin(leadingPart.margin).graphicsLayer { scaleX=scale;scaleY=scale }
                                .then(leadingPart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
                                .inspectAWCNode(ctx,"leading-icon","leading-icon")
                                .accordionDecor(hex(leadingPart.backgroundColor,Color.Transparent),leadingPart.border,hex(leadingPart.borderColor,leadInk),leadingPart.cornerShape ?: AccordionZeroShape)
                                .clearAndSetSemantics {},AccordionBoxFrame((leadingPart.width ?: 24.0).dp,(leadingPart.height ?: 24.0).dp,leadingPart.padding,leadingPart.border),
                                if(iconName.isNotEmpty()) ({ AccordionSymbol(iconName,iconSize,frame.effects,400+100*frame.effects,leadInk) }) else null)
                        }
                    },
                    {
                        CompositionLocalProvider(LocalContentColor provides headlineStyleStyled.color,LocalTextStyle provides headlineStyleStyled,LocalAWCSlotTextNoWrap provides true) {
                            Column(verticalArrangement=Arrangement.spacedBy(2.dp)) {
                                AccordionSlotHost("headline",slot,Modifier.fillMaxWidth().accordionMargin(headlinePart.margin,block=true)
                                    .accordionBoxSize(headlinePart,borderBox=false)
                                    .then(headlinePart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
                                    .inspectAWCNode(ctx,"headline","headline")
                                    .accordionDecor(hex(headlinePart.backgroundColor,Color.Transparent),headlinePart.border,hex(headlinePart.borderColor,headlineStyleStyled.color),headlinePart.cornerShape ?: AccordionZeroShape),
                                    AccordionBoxFrame(null,null,headlinePart.padding,headlinePart.border)) {
                                    AccordionText(headlineText,headlineStyleStyled)
                                }
                                if(supportText.isNotEmpty()) Box(Modifier.fillMaxWidth().accordionMargin(supportingPart.margin,block=true)
                                    .accordionBoxSize(supportingPart,borderBox=false)
                                    .then(supportingPart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
                                    .inspectAWCNode(ctx,"supporting-text","supporting-text")
                                    .accordionDecor(hex(supportingPart.backgroundColor,Color.Transparent),supportingPart.border,hex(supportingPart.borderColor,supportingStyleStyled.color),supportingPart.cornerShape ?: AccordionZeroShape)
                                    .accordionPadding(supportingPart.padding,supportingPart.border)) {
                                    AccordionText(supportText,supportingStyleStyled)
                                }
                            }
                        }
                    },
                    {
                        val radians=frame.chevronRadians
                        val trailInk=hex(trailingPart.color,iconInk)
                        CompositionLocalProvider(LocalContentColor provides trailInk,LocalTextStyle provides headlineStyleStyled.copy(color=trailInk)) {
                            AccordionSlotHost("trailing-icon",slot,Modifier.accordionMargin(trailingPart.margin).graphicsLayer { rotationZ=(radians*180/Math.PI).toFloat() }
                                .then(trailingPart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
                                .inspectAWCNode(ctx,"trailing-icon","trailing-icon")
                                .accordionDecor(hex(trailingPart.backgroundColor,Color.Transparent),trailingPart.border,hex(trailingPart.borderColor,trailInk),trailingPart.cornerShape ?: AccordionZeroShape)
                                .clearAndSetSemantics {},AccordionBoxFrame((trailingPart.width ?: iconSize).dp,(trailingPart.height ?: iconSize).dp,trailingPart.padding,trailingPart.border)) {
                                Box(Modifier.size(24.dp).drawBehind { drawPath(accordionChevron(density.density,0f,0f),trailInk) })
                            }
                        }
                    },
                ),modifier=Modifier.fillMaxWidth()) { (dragM,leadM,textM,trailM),constraints->
                    fun px(v:Double)=(v*density.density).roundToInt()
                    val b=headerPart.border
                    val start=px(headerPad.start(rtl)+b);val end=px(headerPad.end(rtl)+b);val top=px(headerPad.top+b);val bottom=px(headerPad.bottom+b)
                    val gapPx=px(headerPart.gap ?: gap);val inner=(constraints.maxWidth-start-end).coerceAtLeast(0)
                    val loose=Constraints(maxWidth=inner)
                    val drag=dragM.firstOrNull()?.measure(loose)?.takeIf { it.width>0 || it.height>0 }
                    val lead=leadM.firstOrNull()?.measure(loose)?.takeIf { it.width>0 || it.height>0 }
                    val trail=trailM.firstOrNull()?.measure(loose)?.takeIf { it.width>0 || it.height>0 }
                    val count=1+listOfNotNull(drag,lead,trail).size
                    val textWidth=(inner-(drag?.width ?: 0)-(lead?.width ?: 0)-(trail?.width ?: 0)-gapPx*(count-1)).coerceAtLeast(0)
                    val text=textM.first().measure(Constraints(minWidth=textWidth,maxWidth=textWidth))
                    val content=listOfNotNull(drag,lead,text,trail).maxOf { it.height }
                    val fixed=headerPart.height?.let { px(it) }
                    val height=(fixed ?: max(px(headerPart.minHeight ?: minHeight),top+content+bottom)).coerceIn(constraints.minHeight,constraints.maxHeight)
                    val box=height-top-bottom
                    fun y(h:Int)=top+((box-h)/2f).roundToInt()
                    layout(constraints.maxWidth,height) {
                        var x=start
                        drag?.let { it.placeRelative(x,y(it.height));x+=it.width+gapPx }
                        lead?.let { it.placeRelative(x,y(it.height));x+=it.width+gapPx }
                        text.placeRelative(x,y(text.height));x+=textWidth+gapPx
                        trail?.placeRelative(x,y(trail.height))
                    }
                }
            }
        }
      },{
        // ---- panel: retained content, height track (fraction) and inner clip (its square) ----
        val panelEdges=(panelPart.padding?.let { it.top+it.bottom } ?: 0.0)+2*panelPart.border
        Box(Modifier.fillMaxWidth()
            .inspectAWCNode(ctx,"panel","panel",allowZeroSize=true)
            .layout { m,c->
                val placeable=m.measure(c.copy(minHeight=0,maxHeight=Constraints.Infinity))
                val track=maxOf(trackNatural[1],(trackNatural[0]*frame.height).roundToInt())
                layout(placeable.width,(panelEdges*density.density).roundToInt()+track) { placeable.place(0,0) }
            }
            .graphicsLayer { alpha=panelPart.opacity?.toFloat() ?: frame.opacity.toFloat() }
            .onFocusChanged { panelFocused=it.hasFocus }
            .then(if(expanded) Modifier.semantics {
                if(item.regionRole!="none") { isTraversalGroup=true;this[AWCAccordionRegionRole]=item.regionRole;this[AWCAccordionRegionLabel]=label }
            } else Modifier.clearAndSetSemantics {}
                .focusProperties { onEnter={ cancelFocusChange() } }
                .pointerInput(Unit) { awaitPointerEventScope { while(true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() } } })
            .accordionDecor(hex(panelPart.backgroundColor,Color.Transparent),panelPart.border,hex(panelPart.borderColor,colors.onSurface),panelPart.cornerShape ?: AccordionZeroShape)
            .accordionPadding(panelPart.padding,panelPart.border)
            .focusGroup()) {
            val contentMargin=contentPart.margin ?: zero
            val contentEdges=(contentPart.padding?.let { it.top+it.bottom } ?: 0.0)+2*contentPart.border
            Box(Modifier.fillMaxWidth()
                .accordionMargin(contentPart.margin,block=true)
                .inspectAWCNode(ctx,"content","content",allowZeroSize=true)
                .accordionDecor(hex(contentPart.backgroundColor,Color.Transparent),contentPart.border,hex(contentPart.borderColor,colors.onSurface),contentPart.cornerShape ?: AccordionZeroShape)
                .then(contentPart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
                .accordionPadding(null,contentPart.border)
                .clipToBounds()
                .accordionPadding(contentPart.padding,0.0)
                .layout { m,c->
                    val placeable=m.measure(c.copy(minHeight=0,maxHeight=Constraints.Infinity))
                    val innerMargins=innerPart.margin?.let { ((it.top+it.bottom)*density.density).roundToInt() } ?: 0
                    val natural=maxOf(placeable.height,contribution[0]+innerMargins)
                    val outside=((contentMargin.top+contentMargin.bottom+contentEdges)*density.density).roundToInt()
                    trackNatural[0]=natural+outside;trackNatural[1]=outside
                    layout(placeable.width,(natural*frame.contentClip).roundToInt()) { placeable.place(0,0) }
                }) {
                Layout(content={
                    Box(Modifier.fillMaxWidth().accordionPadding(innerPad,0.0)) {
                        CompositionLocalProvider(LocalTextStyle provides innerStyle,LocalContentColor provides innerStyle.color,LocalNativeAccordionOwner provides null,
                            LocalAWCSlots provides null,LocalAWCAccordionItemController provides null) {
                            slot?.invoke("")
                        }
                    }
                },modifier=Modifier.fillMaxWidth()
                    .accordionMargin(innerPart.margin,block=true)
                    .inspectAWCNode(ctx,"content-inner","content-inner")
                    .accordionDecor(hex(innerPart.backgroundColor,Color.Transparent),innerPart.border,hex(innerPart.borderColor,innerStyle.color),innerPart.cornerShape ?: AccordionZeroShape)
                    .then(innerPart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
                    .accordionPadding(null,innerPart.border)
                    .then(if(scrollable) Modifier
                        .onFocusChanged { scrollFocused=it.isFocused }
                        .onKeyEvent { e->
                            if(e.type!=KeyEventType.KeyDown) return@onKeyEvent false
                            val max=scrollMax.intValue.toFloat();val current=scrollOffset.floatValue.coerceIn(0f,max)
                            val step=40*density.density;val page=viewport.intValue*.875f
                            val delta=when(e.key) { Key.DirectionDown->step;Key.DirectionUp->-step;Key.PageDown->page;Key.PageUp->-page
                                Key.Spacebar->if(e.isShiftPressed) -page else page;Key.MoveHome->-current;Key.MoveEnd->max-current;else->return@onKeyEvent false }
                            // At a boundary the key continues to an enclosing scroll container.
                            if(delta<0 && current<=0f || delta>0 && current>=max) false else { scrollOffset.floatValue=(current+delta).coerceIn(0f,max);true }
                        }
                        .focusable(expanded)
                        .semantics {
                            verticalScrollAxisRange=ScrollAxisRange(value={ scrollOffset.floatValue.coerceIn(0f,scrollMax.intValue.toFloat()) },maxValue={ scrollMax.intValue.toFloat() })
                            scrollBy { _,y-> val max=scrollMax.intValue.toFloat();val before=scrollOffset.floatValue.coerceIn(0f,max)
                                scrollOffset.floatValue=(before+y).coerceIn(0f,max);scrollOffset.floatValue!=before }
                        }
                        .drawWithContent { drawContent();if(scrollFocused) { val w=3.dp.toPx();inset(w/2) { drawRect(focusColor,style=Stroke(w)) } } }
                        .clipToBounds()
                        .scrollable(scrollState,Orientation.Vertical,enabled=expanded)
                    else Modifier)) { measurables,constraints->
                    val placeable=measurables.single().measure(constraints.copy(minHeight=0,maxHeight=Constraints.Infinity))
                    val natural=placeable.height
                    val pad=innerPad.top+innerPad.bottom
                    val dp=density.density.toDouble()
                    // Content-box sizing: height, then max (the cap), then min wins (CSS precedence).
                    val explicit=innerPart.height
                    val capped=if(scrollable) cap?.evaluate(natural/dp) else null
                    var contentHeight=explicit ?: (natural/dp-pad)
                    if(capped!=null) contentHeight=minOf(contentHeight,capped)
                    innerPart.minHeight?.let { contentHeight=maxOf(contentHeight,it) }
                    val height=if(explicit==null && capped==null && innerPart.minHeight==null) natural else ((contentHeight+pad)*dp).roundToInt()
                    val max=if(scrollable) (natural-height).coerceAtLeast(0) else 0
                    if(scrollMax.intValue!=max) scrollMax.intValue=max
                    if(viewport.intValue!=height) viewport.intValue=height
                    // A percentage cap keeps the natural grid contribution (source behavior).
                    contribution[0]=(if(cap?.usesPercent==true && scrollable) natural else height)+((2*innerPart.border)*dp).roundToInt()
                    layout(placeable.width,height) { placeable.place(0,-scrollOffset.floatValue.coerceIn(0f,max.toFloat()).roundToInt()) }
                }
            }
        }
      },{
        if(separator) Box(Modifier.fillMaxWidth().height(1.dp).background(outline))
      }),modifier=Modifier.fillMaxWidth()) { (headingM,panelM,separatorM),constraints->
        fun px(v:Double)=(v*density.density).roundToInt()
        val width=constraints.maxWidth
        val heading=headingM.single().measure(Constraints.fixedWidth((width-px(headingMargin.left)-px(headingMargin.right)).coerceAtLeast(0)))
        val panel=panelM.single().measure(Constraints.fixedWidth((width-px(panelMargin.left)-px(panelMargin.right)).coerceAtLeast(0)))
        val line=separatorM.firstOrNull()?.measure(Constraints.fixedWidth(width))
        val headingY=px(stackTop);val panelY=headingY+heading.height+px(stackBetween)
        val body=(panelY+panel.height+px(panelMargin.bottom)).coerceAtLeast(0)
        val total=body+(line?.height ?: 0)
        layout(width,total) { heading.place(px(headingMargin.left),headingY);panel.place(px(panelMargin.left),panelY);line?.place(0,body) }
      }
      if(chassis && owner!=null) AccordionChassisHandle(Modifier.align(Alignment.TopCenter),owner,chassisStyle,chassisBounds,accordionViewport,ctx,
          part(AWCAccordionItemPart.ChassisHandle),part(AWCAccordionItemPart.ChassisHandleBar))
    }
}

/**
 * The chassis grip of a floating group's first item: a 52×16 hit area 4 dp below the item's
 * top above the header (pointing at it hovers only the grip), with the 32×4 pill. A press
 * starts the panel drag at once (source pointerdown), moves follow the captured pointer and the
 * release or cancellation ends it; payloads are physical viewport client coordinates.
 */
@Composable private fun AccordionChassisHandle(modifier:Modifier,owner:NativeAccordionOwner,style:NativeAccordionChassisStyle,
                                               bounds:Array<androidx.compose.ui.geometry.Rect?>,viewport:AccordionViewportHolder?,ctx:AWCInspectionContext?,
                                               handlePart:AWCAccordionPartAppearance=AWCAccordionPartAppearance(),barPart:AWCAccordionPartAppearance=AWCAccordionPartAppearance()) {
    val density=LocalDensity.current.density
    @Suppress("UNUSED_VARIABLE") val v=style.version
    val coordinates=remember { arrayOfNulls<androidx.compose.ui.layout.LayoutCoordinates>(1) }
    Box(modifier.padding(top=4.dp).size((handlePart.width ?: 52.0).dp,(handlePart.height ?: 16.0).dp)
        .then(handlePart.opacity?.let { o-> Modifier.graphicsLayer { alpha=o.toFloat() } } ?: Modifier)
        .onGloballyPositioned { bounds[0]=it.boundsInRoot();coordinates[0]=it }
        .pointerInput(owner) {
            awaitPointerEventScope {
                var active:androidx.compose.ui.input.pointer.PointerId?=null
                var last:Pair<Double,Double>?=null
                while(true) {
                    val e=awaitPointerEvent()
                    // The captured pointer's change; else a newly pressed pointer; else the latest one.
                    val change=active?.let { id-> e.changes.firstOrNull { it.id==id } } ?: e.changes.firstOrNull { it.pressed && !it.previousPressed } ?: e.changes.lastOrNull() ?: continue
                    val local=change.position
                    val inside=local.x>=0 && local.y>=0 && local.x<size.width && local.y<size.height
                    val hoverCapable=change.type!=PointerType.Touch
                    // Physical viewport client point (dp) of the event, through the handle's live coordinates.
                    fun client():Pair<Double,Double> {
                        val o=viewport?.origin ?: Offset.Zero
                        val root=coordinates[0]?.takeIf { it.isAttached }?.localToRoot(local) ?: bounds[0]?.let { Offset(it.left+local.x,it.top+local.y) } ?: return 0.0 to 0.0
                        return ((root.x-o.x)/density).toDouble() to ((root.y-o.y)/density).toDouble()
                    }
                    var next=style.pointer
                    when(e.type) {
                        PointerEventType.Press->{
                            val primary=change.type!=PointerType.Mouse || e.buttons.isPrimaryPressed
                            if(primary && active==null) {
                                change.consume();active=change.id
                                next=next.copy(pressed=true,hovered=hoverCapable && inside)
                                val (cx,cy)=client();last=cx to cy
                                owner.state.beginChassis(change.id.value.toInt(),0,cx,cy);owner.requestMotion();style.request()
                            }
                        }
                        PointerEventType.Release->{
                            if(change.id==active) {
                                change.consume();active=null
                                val (cx,cy)=client()
                                next=next.copy(pressed=false,hovered=hoverCapable && inside)
                                owner.state.endChassis(change.id.value.toInt(),cx,cy);owner.requestMotion();style.request()
                            } else next=next.copy(hovered=hoverCapable && inside)
                        }
                        else->{
                            // Move, and the Enter/Exit a captured pointer produces while it outruns the
                            // panel, are pointer moves; a re-sent event after relayout (no screen
                            // movement) is not.
                            val over=hoverCapable && inside && e.type!=PointerEventType.Exit
                            if(change.id==active) { change.consume();val point=client()
                                if(point!=last) { last=point;owner.state.moveChassis(change.id.value.toInt(),point.first,point.second) }
                                next=next.copy(hovered=over) }
                            else next=next.copy(hovered=over)
                        }
                    }
                    if(next!=style.pointer) { style.pointer=next;style.request() }
                }
            }
        }
        .drawBehind {
            @Suppress("UNUSED_VARIABLE") val vv=style.version
            // A declared ::part(chassis-handle) background wins in every state; its corner shape replaces the pill.
            val c=handlePart.backgroundColor?.let(::statusDotColor) ?: style.handleBackground.presented(style.frameMillis)
            if(c.alpha>0f) { val cs=handlePart.cornerShape
                if(cs!=null) drawOutline(cs.createOutline(size,layoutDirection,this),c) else drawRoundRect(c,cornerRadius=androidx.compose.ui.geometry.CornerRadius(size.height/2,size.height/2)) }
        }
        .awcCursor(if(owner.state.chassisDragging) AWCCursorStyle.Grabbing else AWCCursorStyle.Grab)
        .inspectAWCNode(ctx,"chassis-handle","chassis-handle")
        .clearAndSetSemantics {},contentAlignment=Alignment.Center) {
        Box(Modifier.layout { m,_->
                @Suppress("UNUSED_VARIABLE") val vv=style.version
                val w=((barPart.width ?: style.barWidth.presented(style.frameMillis))*density).roundToInt();val h=((barPart.height ?: 4.0)*density).roundToInt()
                val p=m.measure(Constraints.fixed(w,h));layout(w,h) { p.place(0,0) } }
            .graphicsLayer { @Suppress("UNUSED_VARIABLE") val vv=style.version;alpha=(barPart.opacity ?: style.barOpacity.presented(style.frameMillis)).toFloat() }
            .drawBehind { @Suppress("UNUSED_VARIABLE") val vv=style.version
                val c=barPart.backgroundColor?.let(::statusDotColor) ?: style.barColor.presented(style.frameMillis);val cs=barPart.cornerShape
                if(cs!=null) drawOutline(cs.createOutline(size,layoutDirection,this),c) else drawRoundRect(c,cornerRadius=androidx.compose.ui.geometry.CornerRadius(size.height/2,size.height/2)) }
            .inspectAWCNode(ctx,"chassis-handle-bar","chassis-handle-bar"))
    }
}

/**
 * The source pointer reorder: the grip lifts on pointer-down using item rectangles
 * sampled once (root dp), follows only the same pointer, commits on release and
 * abandons on cancellation. The grip consumes the gesture so its header never toggles.
 */
internal suspend fun androidx.compose.ui.input.pointer.PointerInputScope.accordionReorderGesture(
    owner:NativeAccordionOwner,item:NativeAccordionItemState,handleTop:()->Float,
) {
    awaitEachGesture {
        val down=awaitFirstDown(requireUnconsumed=false)
        val d=owner.density
        val root=owner.rootBounds ?: return@awaitEachGesture
        val rects=owner.state.items.map { s-> owner.itemBounds[s.id]?.let { AccordionItemRect(it.top/d.toDouble(),it.height/d.toDouble()) } ?: return@awaitEachGesture }
        val pointer=down.id.value.toInt()
        fun clientY(y:Float)=((handleTop()+y)/d).toDouble()
        if(!owner.state.beginReorder(item,pointer,0,clientY(down.position.y),(root.top/d).toDouble(),rects)) return@awaitEachGesture
        down.consume();owner.requestMotion()
        var finished=false
        try {
            while(true) {
                val event=awaitPointerEvent()
                val change=event.changes.firstOrNull { it.id==down.id } ?: continue
                if(!change.pressed) {
                    // Compose reports a platform cancel as a synthesized release; the
                    // underlying MotionEvent tells a real release from pointercancel.
                    val action=event.motionEvent?.actionMasked
                    val cancelled=action==null || action==android.view.MotionEvent.ACTION_CANCEL
                    change.consume();finished=true;owner.state.endReorder(pointer,cancelled);owner.endMotion();break
                }
                if(change.positionChanged()) { change.consume();owner.state.moveReorder(pointer,clientY(change.position.y));owner.requestMotion() }
            }
        } finally { if(!finished) { owner.state.endReorder(pointer,cancelled=true);owner.endMotion() } }
    }
}
