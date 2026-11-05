package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.*
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.*
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.*
import androidx.compose.ui.semantics.*
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.*
import androidx.compose.ui.unit.*
import kotlinx.coroutines.Job
import kotlin.math.*
import dev.awc.nativeui.generated.AWCGeneratedTokens

internal data class SegmentedMetrics(val density:Int,val inset:Float) {
    val height=40f+4*density
    val icon=max(14f,18f+density)
    val gap=max(4f,8f+density)
    val font=max(12f,14f+.5f*density)
    val line=max(16f,20f+density)
    companion object {
        fun from(p:Props,inheritedDensity:Int=0,inheritedInset:Float=12f):SegmentedMetrics {
            val local=p.int("density")
            val parent=-abs(p.int("segmentDensity"))
            val resolved=when { local in -4..-1->local;parent in -4..-1->parent;inheritedDensity in -4..-1->inheritedDensity;else->0 }
            return SegmentedMetrics(resolved,if(local in -4..-2) 8f else inheritedInset)
        }
    }
}
private class SegmentInitialContent { var hasLabel:Boolean?=null }
private val SegmentEasing=CubicBezierEasing(.2f,0f,0f,1f)
private val SegmentFont=FontFamily(Font(R.font.awc_roboto_medium,FontWeight.Medium))
private fun segmentOpacity(name:String,fallback:Float)=AWCGeneratedTokens.light[name]?.toFloatOrNull() ?: fallback

internal fun segmentedUsedRadius(width:Float,height:Float,first:Boolean,last:Boolean,radius:Float):Float {
    if(radius<=0 || (!first && !last)) return 0f
    val horizontal=radius*((if(first) 1 else 0)+(if(last) 1 else 0))
    return radius*minOf(1f,if(horizontal>0) width/horizontal else 1f,height/(2*radius))
}
/** CSS scales all overlapping radii together; an outer-only corner may exceed half the width. */
private data class SegmentedShape(val first:Boolean,val last:Boolean,val radius:Dp):Shape {
    override fun createOutline(size:Size,layoutDirection:LayoutDirection,density:Density):Outline {
        val value=segmentedUsedRadius(size.width,size.height,first,last,with(density) { radius.toPx() })
        val start=if(first) CornerRadius(value) else CornerRadius.Zero
        val end=if(last) CornerRadius(value) else CornerRadius.Zero
        val left=if(layoutDirection==LayoutDirection.Rtl) end else start
        val right=if(layoutDirection==LayoutDirection.Rtl) start else end
        return Outline.Rounded(RoundRect(0f,0f,size.width,size.height,left,right,right,left))
    }
}

@Composable internal fun NativeSegmentedButton(source:Props,emit:EventSink,slot:Slot?) {
    if(source.bool("hidden")) return
    val ancestors=LocalSegmentedSets.current
    val nearest=ancestors.lastOrNull()
    val managed=ancestors.maxByOrNull { it.revision }
    val childRecord=LocalSegmentedChild.current
    val identity=childRecord?.id ?: remember { Any() }
    val managedIndex=managed?.entries?.indexOfFirst { it.id===identity }?.coerceAtLeast(0) ?: source.int("segmentIndex")
    val managedTotal=managed?.entries?.size?.coerceAtLeast(1) ?: source.int("segmentTotal",1)
    val p=if(managed==null) source else source+mapOf("segmentIndex" to managedIndex,"segmentTotal" to managedTotal,
        "segmentDensity" to managed.props.int("density"),"segmentMultiselect" to managed.props.bool("multiselect"))
    val selected=nearest?.selected?.get(identity) ?: source.bool("selected")
    val multi=p.bool("segmentMultiselect")
    val enabled=p.enabled()
    val focus=nativeButtonFocusModifier(p,identity,null,selected)
    val actions=LocalAWCAction.current;val target=LocalAWCActionTarget.current
    val generatedID=remember { java.util.UUID.randomUUID().toString() }
    val targetID=target?.id ?: generatedID
    fun activate(activation:AWCActivationMetadata) {
        if(!enabled) return
        val detail=mapOf("value" to p.str("value"),"selected" to if(multi) !selected else true)
        dispatchNativeAction(AWCActionEvent("mdSegmentClick","md-segmented-button",detail,targetID=targetID,activation=activation),
            actions,target?.listeners?.invoke().orEmpty()+{ _:AWCActionEvent -> emit("mdSegmentClick",detail) })
    }
    val latestActivation=rememberUpdatedState<(AWCActivationMetadata)->Unit>(::activate)
    val entry=remember(identity,targetID,p.str("value"),p.bool("disabled"),focus.state) {
        SegmentEntry(identity,targetID,p.str("value"),p.bool("disabled"),focus.state) { latestActivation.value(it) }
    }
    SideEffect { ancestors.forEach { it.register(entry,source.bool("selected")) } }
    DisposableEffect(ancestors,identity) { onDispose { ancestors.forEach { it.remove(identity) } } }
    LaunchedEffect(source["selected"]) { nearest?.selected?.set(identity,source.bool("selected")) }
    val metrics=SegmentedMetrics.from(p,nearest?.props?.int("density") ?: 0,LocalSegmentedInset.current)
    val first=p.int("segmentIndex")==0
    val last=p.int("segmentIndex")==p.int("segmentTotal",1)-1
    val appearance=LocalAWCSegmentedButtonAppearance.current
    val colors=MaterialTheme.colorScheme
    fun color(value:String?,fallback:Color)=value?.let { Color(0xff000000L or it.drop(1).toLong(16)) } ?: fallback
    val ink=if(!enabled) colors.onSurface.copy(alpha=.38f) else if(selected) color(appearance.selectedLabelColor,colors.onSecondaryContainer) else color(appearance.labelColor,colors.onSurface)
    val stateInk=if(selected) colors.onSecondaryContainer else colors.onSurface
    val outline=if(enabled) color(appearance.outlineColor,colors.outline) else colors.onSurface.copy(alpha=.12f)
    val reduced=!ValueAnimator.areAnimatorsEnabled()
    val container by animateColorAsState(if(!enabled && selected) colors.onSurface.copy(alpha=.12f)
        else if(selected) color(appearance.selectedContainerColor,colors.secondaryContainer) else color(appearance.containerColor,Color.Transparent),
        tween(if(reduced) 0 else 100,easing=SegmentEasing),label="Segment background")
    val radius=appearance.cornerRadius?.toFloat() ?: 9999f
    val shape=SegmentedShape(first,last,radius.dp)
    val interactions=remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    val opacity by animateFloatAsState(if(!enabled) 0f
        else if(pressed) segmentOpacity("--md-sys-state-pressed-state-layer-opacity",.10f)
        else if(focus.isFocusVisible) segmentOpacity("--md-sys-state-focus-state-layer-opacity",.10f)
        else if(hovered) segmentOpacity("--md-sys-state-hover-state-layer-opacity",.08f) else 0f,
        tween(if(reduced) 0 else 100,easing=SegmentEasing),label="Segment state layer")
    val density=LocalDensity.current
    var pointer by remember { mutableStateOf<AWCActivationMetadata?>(null) }
    val coroutine=rememberCoroutineScope();var keyRipple by remember { mutableStateOf<Job?>(null) }
    DisposableEffect(enabled) { onDispose { keyRipple?.cancel() } }
    val ripple=nativeSourceRipple(interactions,ink,enabled && p.bool("ripple",true))
    val inspection=LocalAWCInspection.current
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val direction=if(rtl) "rtl" else "ltr"
    val label=p.str("label")
    val labelRegistry=remember { AWCSlotTextRegistry() }
    val iconTextRegistry=remember { AWCSlotTextRegistry() }
    val initialContent=remember { SegmentInitialContent() }
    val slots=LocalAWCSlots.current
    val style=TextStyle(fontFamily=SegmentFont,fontSize=metrics.font.sp,lineHeight=metrics.line.sp,fontWeight=FontWeight.Medium,
        letterSpacing=.1.sp,textMotion=TextMotion.Animated,platformStyle=PlatformTextStyle(includeFontPadding=false),
        lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))
    val hasIcon=p.str("icon").isNotEmpty()
    val reserveGraphic=hasIcon || !p.bool("noCheckmark")
    val showCheckmark=selected && !p.bool("noCheckmark")
    val iconSize=appearance.iconSize?.toFloat() ?: metrics.icon
    SubcomposeLayout(Modifier.segmentTree(child=identity).clip(shape).background(container)
        .drawWithContent {
            drawRect(stateInk.copy(alpha=stateInk.alpha*opacity))
            // The omitted interior leading border leaves the predecessor's single
            // edge. The last child's overlapping box restores that leading edge.
            val stroke=1.dp.toPx()
            clipRect(left=if(!first && !last && !rtl) stroke else 0f,right=if(!first && !last && rtl) size.width-stroke else size.width) {
                val borderShape=SegmentedShape(first,last,max(0f,radius-.5f).dp)
                translate(stroke/2,stroke/2) {
                    drawOutline(borderShape.createOutline(Size(max(0f,size.width-stroke),max(0f,size.height-stroke)),layoutDirection,this),outline,style=Stroke(stroke))
                }
            }
            drawContent()
            if(focus.isFocusVisible) {
                val ring=3.dp.toPx()
                translate(ring/2,ring/2) { drawOutline(shape.createOutline(Size(max(0f,size.width-ring),max(0f,size.height-ring)),layoutDirection,this),colors.secondary,style=Stroke(ring)) }
            }
        }.then(ripple).then(focus.modifier).hoverable(interactions)
        .pointerInput(density.density) {
            awaitEachGesture {
                val down=awaitFirstDown(false,PointerEventPass.Initial)
                pointer=AWCActivationMetadata("pointer",down.position.x/density.density,down.position.y/density.density)
                do { val event=awaitPointerEvent(PointerEventPass.Final) } while(event.changes.any { it.pressed })
                pointer=null
            }
        }.onPreviewKeyEvent { event ->
            if(event.type!=KeyEventType.KeyDown) event.key in listOf(Key.Enter,Key.NumPadEnter,Key.Spacebar)
            else when(event.key) {
                Key.Enter,Key.NumPadEnter,Key.Spacebar->{ if(enabled) { keyRipple?.cancel();keyRipple=coroutine.nativeKeyboardRipple(interactions);activate(AWCActivationMetadata("keyboard")) };true }
                Key.DirectionLeft,Key.DirectionRight,Key.DirectionUp,Key.DirectionDown->{ nearest?.move(identity,event.key in listOf(Key.DirectionRight,Key.DirectionDown),!multi);true }
                else->false
            }
        }.clickable(interactionSource=interactions,indication=null,enabled=!p.bool("disabled"),role=if(multi) Role.Checkbox else Role.RadioButton) {
            activate(pointer ?: AWCActivationMetadata("accessibility"))
        }.semantics {
            if(multi) toggleableState=if(selected) ToggleableState.On else ToggleableState.Off else this.selected=selected
            if(!enabled) disabled()
            if(p.containsKey("aria-label")) contentDescription=p.str("aria-label") else if(label.isNotEmpty()) contentDescription=label
        }
    ) { constraints ->
        val iconPx=iconSize.dp.roundToPx();val gapPx=metrics.gap.dp.roundToPx();val insetPx=metrics.inset.dp.roundToPx()
        val typography=AWCInspectionTypography(metrics.font.toDouble(),metrics.line.toDouble(),500,.1,"Roboto")
        val authoredIcons=subcompose("icon-slot") {
            CompositionLocalProvider(LocalContentColor provides ink,LocalAWCButtonSlotSize provides iconSize.dp,
                LocalAWCButtonSlotPart provides "icon-slot",LocalAWCInspection provides null,LocalAWCSlotTextRegistry provides iconTextRegistry) {
                ProvideTextStyle(style) { if(slots?.contains("icon")==true) slots.Render("icon") else slot?.invoke("icon") }
            }
        }.map { it.measure(Constraints.fixed(iconPx,iconPx)) }
        // Retain authored label state while a property label masks its display.
        val authoredLabels=subcompose("default-slot") {
            CompositionLocalProvider(LocalContentColor provides ink,LocalAWCSlotTextRegistry provides labelRegistry,LocalAWCInspection provides null,LocalAWCSlotTextNoWrap provides true) {
                ProvideTextStyle(style) { if(slots?.contains("")==true) slots.Render("") else slot?.invoke("") }
            }
        }.map { it.measure(Constraints()) }
        val labels=if(label.isEmpty()) authoredLabels else subcompose("property-label") {
            val visible=awcCollapsedWhitespace(label)
            if(visible.isNotEmpty()) Text(visible,color=ink,style=style,softWrap=false,maxLines=1,overflow=TextOverflow.Clip,modifier=Modifier.clearAndSetSemantics { })
        }.map { it.measure(Constraints()) }
        val labelWidth=labels.sumOf { it.width }
        val labelHeight=labels.maxOfOrNull { it.height } ?: 0
        // Web captures host textContent once, including named icon text. Native
        // authored strings/symbols register their actual text; arbitrary native
        // content can provide the same information with AWCSearchableLabelScope.
        if(initialContent.hasLabel==null) initialContent.hasLabel=
            if(labelRegistry.hasEntries || iconTextRegistry.hasEntries) (labelRegistry.text+iconTextRegistry.text).trim().isNotEmpty()
            else authoredLabels.any { it.width>0 } || authoredIcons.any { it.width>0 }
        val hasLabel=label.isNotEmpty() || initialContent.hasLabel==true
        val graphicPart=if(showCheckmark) "checkmark" else if(hasIcon) "icon" else null
        val graphic=if(reserveGraphic) subcompose("graphic") {
            Box(Modifier.inspectAWCNode(if(graphicPart!=null) inspection else null,graphicPart ?: "graphic","${if(showCheckmark) "Checkmark" else "Icon"}",AWCInspectionMetrics(display="Glyph",direction="ltr"))) {
                if(graphicPart!=null) CompositionLocalProvider(LocalContentColor provides ink,LocalAWCButtonSlotSize provides iconSize.dp,
                    LocalAWCButtonSlotPart provides graphicPart) { AWCMaterialSymbol(if(showCheckmark) "check" else p.str("icon")) }
            }
        }.map { it.measure(Constraints.fixed(iconPx,iconPx)) } else emptyList()
        val spacer=reserveGraphic && !hasIcon
        val labelItemCount=if(hasLabel) 1 else labels.count { it.width>0 }
        val count=(if(reserveGraphic) 1 else 0)+authoredIcons.size+labelItemCount+(if(spacer) 1 else 0)
        val contentWidth=(if(reserveGraphic) iconPx else 0)+authoredIcons.sumOf { it.width }+labelWidth+(if(spacer) iconPx else 0)+max(0,count-1)*gapPx
        val contentHeight=max(labelHeight,if(reserveGraphic || authoredIcons.isNotEmpty()) iconPx else 0)
        // A CSS border box cannot make its content box negative. The parent
        // grid uses this measured padding floor to freeze undersized fr tracks.
        childRecord?.minimumWidth=2*insetPx
        val width=max(2*insetPx,constraints.constrainWidth(contentWidth+2*insetPx))
        val height=constraints.constrainHeight(max(metrics.height.dp.roundToPx(),contentHeight))
        val markers=subcompose("markers") {
            Box(Modifier.inspectAWCNode(inspection,"","md-segmented-button",AWCInspectionMetrics(
                padding=AWCInspectionInsets(0.0,insetPx/density.density.toDouble(),0.0,insetPx/density.density.toDouble()),border=AWCInspectionInsets(),
                margin=if(last && !first) AWCInspectionInsets(0.0,if(rtl) -1.0 else 0.0,0.0,if(rtl) 0.0 else -1.0) else AWCInspectionInsets(),
                gap=AWCInspectionGap(0.0,metrics.gap.toDouble()),typography=typography,display="Row",direction=direction)))
            Box(Modifier.inspectAWCNode(inspection,"state-layer","State layer",AWCInspectionMetrics(display="Overlay",direction=direction)))
        }.map { it.measure(Constraints.fixed(width,height)) }
        val labelMarker=if(hasLabel) subcompose("label-marker") {
            Box(Modifier.inspectAWCNode(inspection,"label","Label",AWCInspectionMetrics(typography=typography,display="Row",direction=direction)))
        }.map { it.measure(Constraints.fixed(labelWidth,labelHeight)) } else emptyList()
        val slotMarkers=authoredIcons.mapIndexed { index,icon -> subcompose("slot-marker-$index") {
            Box(Modifier.inspectAWCNode(inspection,"icon-slot-$index","Icon slot",AWCInspectionMetrics(display="Slot",direction=direction)))
        }.single().measure(Constraints.fixed(icon.width,icon.height)) }
        layout(width,height) {
            markers.forEach { it.place(0,0) }
            var x=(width-contentWidth)/2
            if(reserveGraphic) { graphic.forEach { it.placeRelative(x,(height-it.height)/2) };x+=iconPx+gapPx }
            authoredIcons.forEachIndexed { i,icon -> slotMarkers[i].placeRelative(x,(height-icon.height)/2);icon.placeRelative(x,(height-icon.height)/2);x+=icon.width+gapPx }
            labelMarker.forEach { it.placeRelative(x,(height-labelHeight)/2) }
            labels.forEach { it.placeRelative(x,(height-it.height)/2);x+=it.width+(if(!hasLabel && it.width>0) gapPx else 0) }
        }
    }
}
