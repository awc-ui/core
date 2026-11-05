package dev.awc.nativeui

import android.animation.ValueAnimator
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
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
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.*
import androidx.compose.ui.unit.*
import kotlinx.coroutines.*
import kotlin.math.*

internal data class NativeFabMetrics(val size: String, val density: Float, val hasLabel: Boolean) {
    val rung = density.takeIf { it in -4f..0f && it == floor(it) } ?: 0f
    private val index = if(hasLabel) 0 else listOf("standard","medium","large").indexOf(size).coerceAtLeast(0)
    val height = max(listOf(40f,64f,80f)[index],listOf(56f,80f,96f)[index]+rung*4)
    val icon = max(listOf(18f,21f,27f)[index],listOf(24f,28f,36f)[index]+rung)
    val radius = if(index==0) 16f else 28f
    // The spacing tokens resolve to the source's discrete density scale.
    val inset = when(rung.toInt()) { -4 -> 8f; -3,-2 -> 12f; else -> 16f }
    val gap = if(rung<=-2) 8f else 12f
    val plainInset = max(12f,20f+2*rung)
    val font = max(11f,14f+.5f*rung)
}
internal data class NativeFabPalette(val container: String, val icon: String) {
    companion object {
        fun resolve(variant: String, lowered: Boolean) = when(variant) {
            "surface" -> NativeFabPalette(if(lowered) "surface-container-low" else "surface-container-high","primary")
            "primary","secondary","tertiary" -> NativeFabPalette(variant,"on-$variant")
            "secondary-container","tertiary-container" -> NativeFabPalette(variant,"on-$variant")
            else -> NativeFabPalette("primary-container","on-primary-container")
        }
    }
}

/** Native input coordinates replace the Web MouseEvent object without inventing DOM fields. */
internal fun performNativeFabAction(p: Props, emit: EventSink, actions: AWCActionDispatcher?,
    targetID: String, listeners: List<(AWCActionEvent)->Unit>, activation: AWCActivationMetadata): Boolean {
    if(!p.enabled()) return false
    // The existing scoped API has a nonnullable map; no fabricated DOM fields
    // are inserted. Callback/transport detail is null, with native input in activation.
    dispatchNativeAction(AWCActionEvent("mdClick","md-fab",emptyMap(),targetID=targetID,activation=activation),actions,listeners)
    emit("mdClick",null)
    return true
}

private val FabStandard=CubicBezierEasing(.2f,0f,0f,1f)
private val FabSpatial=CubicBezierEasing(.38f,1.21f,.22f,1f)
private val FabEffects=CubicBezierEasing(.34f,.8f,.34f,1f)
private val FabFont=FontFamily(Font(R.font.awc_roboto_medium,FontWeight.Medium))
private data class FabWave(val press: PressInteraction.Press, val start: Long?=null, val end: Long?=null, val released: Boolean=false)

@Composable internal fun NativeFab(p: Props, emit: EventSink, slot: Slot?) {
    val identity=remember { Any() }
    val controller=LocalAWCFabController.current
    val anchor=LocalNativeAnchor.current
    val presentation=anchor?.fabPresentation
    var menuIcon by remember { mutableStateOf<String?>(null) }
    DisposableEffect(controller,identity) {
        controller?.attach(identity) { menuIcon=it }
        onDispose { controller?.detach(identity) }
    }
    DisposableEffect(anchor,identity) {
        val setter: (String?)->Unit={ menuIcon=it?.takeUnless(String::isEmpty) }
        anchor?.setMenuIcon=setter
        onDispose { anchor?.let { if(it.setMenuIcon===setter) it.setMenuIcon=null } }
    }
    val label=p.str("label")
    val hasLabel=label.isNotEmpty()
    val extended=if(p["extended"]==null) hasLabel else p.bool("extended")
    val metrics=NativeFabMetrics(p.str("size","standard"),p.num("density"),hasLabel)
    val appearance=LocalAWCFabAppearance.current
    val iconSize=appearance.iconSize?.toFloat() ?: metrics.icon
    val enabled=p.enabled()
    val reduced=!ValueAnimator.areAnimatorsEnabled()
    val spatialDuration=if(reduced) 0 else 500
    val extent by animateFloatAsState(if(extended) 1f else 0f,tween(spatialDuration,easing=FabSpatial),label="FAB extent")
    val labelOpacity by animateFloatAsState(if(extended) 1f else 0f,tween(if(reduced) 0 else 200,easing=FabEffects),label="FAB label opacity")
    val style=TextStyle(fontFamily=FabFont,fontWeight=FontWeight.Medium,fontSize=metrics.font.sp,lineHeight=20.sp,letterSpacing=.1.sp,
        platformStyle=PlatformTextStyle(includeFontPadding=false),lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None))
    val inheritedTextStyle=LocalTextStyle.current
    val slotTextStyle=if(hasLabel) style.copy(lineHeight=style.fontSize) else inheritedTextStyle.copy(lineHeight=inheritedTextStyle.fontSize)
    val textMeasurer=rememberTextMeasurer()
    val density=LocalDensity.current
    val naturalLabelWidth=if(hasLabel) textMeasurer.measure(label,style,maxLines=1,softWrap=false).size.width.toFloat() else 0f
    val maxLabelWidth by animateFloatAsState(if(extended) naturalLabelWidth else 0f,tween(spatialDuration,easing=FabSpatial),label="FAB label width")
    val interactions=remember { MutableInteractionSource() }
    val pointerPressed by interactions.collectIsPressedAsState()
    val hovered by interactions.collectIsHoveredAsState()
    var keyboardPressed by remember { mutableStateOf(false) }
    val pressed=enabled && (pointerPressed || keyboardPressed)
    val focus=nativeButtonFocusModifier(p,identity,null,false)
    val focused=focus.isFocusVisible
    var pointer by remember { mutableStateOf<AWCActivationMetadata?>(null) }
    val action=LocalAWCAction.current
    val target=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    fun activate(metadata:AWCActivationMetadata) {
        if(anchor?.activate(metadata)==true) return
        performNativeFabAction(p,emit,action,target?.id ?: targetID,target?.listeners?.invoke().orEmpty(),metadata)
    }
    val scope=rememberCoroutineScope()
    var keyboardJob by remember { mutableStateOf<Job?>(null) }
    DisposableEffect(enabled) { onDispose { keyboardJob?.cancel();keyboardPressed=false } }
    val waves=remember { mutableStateListOf<FabWave>() }
    var now by remember { mutableLongStateOf(0) }
    LaunchedEffect(interactions,enabled,p.bool("ripple",true),reduced) {
        if(!enabled || !p.bool("ripple",true)) waves.clear()
        var frames:Job?=null
        interactions.interactions.collect { event ->
            if(enabled && p.bool("ripple",true)) {
                when(event) {
                    is PressInteraction.Press -> { waves+=FabWave(event);if(waves.size>4) waves.removeAt(0) }
                    is PressInteraction.Release -> { val i=waves.indexOfFirst { it.press==event.press };if(i>=0) waves[i]=waves[i].copy(released=true) }
                    is PressInteraction.Cancel -> { val i=waves.indexOfFirst { it.press==event.press };if(i>=0) waves[i]=waves[i].copy(released=true) }
                }
                if(frames?.isActive!=true && waves.isNotEmpty()) frames=launch(start=CoroutineStart.UNDISPATCHED) {
                    while(isActive && waves.isNotEmpty()) {
                        now=withFrameNanos { it }
                        waves.indices.forEach { i -> val w=waves[i];waves[i]=w.copy(start=w.start ?: now,end=if(w.released) w.end ?: now else null) }
                        waves.removeAll { it.end?.let { end -> reduced || now>max((it.start ?: now)+450_000_000L,end)+150_000_000L } ?: false }
                    }
                }
            }
        }
    }
    val colors=MaterialTheme.colorScheme
    val palette=NativeFabPalette.resolve(p.str("variant","primary-container"),p.bool("lowered"))
    fun role(name:String)=when(name) {
        "surface-container-high"->colors.surfaceContainerHigh;"surface-container-low"->colors.surfaceContainerLow
        "primary"->colors.primary;"on-primary"->colors.onPrimary;"primary-container"->colors.primaryContainer;"on-primary-container"->colors.onPrimaryContainer
        "secondary"->colors.secondary;"on-secondary"->colors.onSecondary;"secondary-container"->colors.secondaryContainer;"on-secondary-container"->colors.onSecondaryContainer
        "tertiary"->colors.tertiary;"on-tertiary"->colors.onTertiary;"tertiary-container"->colors.tertiaryContainer;else->colors.onTertiaryContainer
    }
    fun color(value:String?,fallback:Color)=value?.let { Color(0xff000000L or it.drop(1).toLong(16)) } ?: fallback
    val vibrant=if(presentation?.circle==true) presentation.variant else null
    val container by animateColorAsState(if(enabled) { if(vibrant!=null) role(vibrant) else color(appearance.containerColor,role(palette.container)) } else colors.onSurface.copy(alpha=.12f),
        tween(if(reduced) 0 else 280,easing=FabStandard),label="FAB container")
    val hostInk by animateColorAsState(if(enabled) { if(vibrant!=null) role("on-$vibrant") else color(appearance.iconColor,role(palette.icon)) } else colors.onSurface.copy(alpha=.38f),
        tween(if(reduced) 0 else 200,easing=FabStandard),label="FAB host ink")
    // Source inner-part custom colors override even the disabled host ink.
    val iconInk=if(vibrant!=null) role("on-$vibrant") else color(appearance.iconColor,hostInk)
    val labelInk=color(appearance.labelColor,hostInk)
    val opacity by animateFloatAsState(if(!enabled) 0f else if(pressed || focused) .10f else if(hovered) .08f else 0f,
        tween(if(reduced) 0 else 280,easing=FabStandard),label="FAB state opacity")
    // Source elevation levels (md-fab.css): 3, hover 4; lowered 1, hover 2; disabled 0.
    val elevation by animateFloatAsState(if(!enabled || LocalAWCFabFlatElevation.current) 0f else if(hovered && !pressed && !focused) { if(p.bool("lowered")) 2f else 4f } else { if(p.bool("lowered")) 1f else 3f },
        tween(if(reduced) 0 else 280,easing=FabStandard),label="FAB elevation")
    val radius by animateFloatAsState(appearance.cornerRadius?.toFloat() ?: metrics.radius,tween(if(reduced) 0 else 200,easing=FabStandard),label="FAB radius")
    val circle by animateFloatAsState(if(presentation?.circle==true) 1f else 0f,tween(if(reduced) 0 else 200,easing=FabStandard),label="FAB menu shape")
    val iconOpacity by animateFloatAsState(if(presentation?.fading==true) 0f else 1f,tween(if(reduced) 0 else 120,easing=FabStandard),label="FAB menu icon opacity")
    val shape=remember(radius,circle) { object: Shape {
        override fun createOutline(size:Size,layoutDirection:LayoutDirection,density:Density):Outline {
            val base=with(density) { radius.dp.toPx() }.coerceAtMost(min(size.width,size.height)/2)
            val corner=CornerRadius(base+(size.width/2-base)*circle,base+(size.height/2-base)*circle)
            return Outline.Rounded(RoundRect(0f,0f,size.width,size.height,corner))
        }
    } }
    val themeTokens=LocalAWCThemeTokens.current
    val elevationLevels=remember(themeTokens) { awcElevationTokenLayers(themeTokens) }
    val inspection=LocalAWCInspection.current
    val registry=LocalAWCSlots.current
    val direction=if(LocalLayoutDirection.current==LayoutDirection.Rtl) "rtl" else "ltr"
    val name=if(p.containsKey("aria-label")) p.str("aria-label") else label
    SubcomposeLayout(Modifier
        .drawBehind {
            if(focused && !p.bool("disabled")) {
                val offset=3.5.dp.toPx()
                val outline=RoundedCornerShape((radius+3.5f).dp).createOutline(Size(size.width+offset*2,size.height+offset*2),layoutDirection,this)
                translate(-offset,-offset) { drawOutline(outline,colors.secondary,style=Stroke(3.dp.toPx())) }
            }
        }
        .accordionShadow(AWCCornerShape.uniform(radius.toDouble()*(1-circle),.5*circle),{ awcElevationLayers(elevationLevels,elevation) },false)
        .clip(shape).background(container)
        .drawWithContent {
            drawRect(hostInk.copy(alpha=hostInk.alpha*opacity))
            waves.forEach { wave ->
                val elapsed=max(0f,(now-(wave.start ?: now))/1_000_000f)
                val origin=wave.press.pressPosition.takeIf { it.x.isFinite() && it.y.isFinite() } ?: center
                val r=hypot(max(origin.x,size.width-origin.x),max(origin.y,size.height-origin.y))
                val growth=if(reduced) 1f else FabStandard.transform((elapsed/450f).coerceIn(0f,1f))
                val fade=wave.end?.let { max(450f,(it-(wave.start ?: now))/1_000_000f) } ?: Float.POSITIVE_INFINITY
                val alpha=if(reduced) { if(wave.end==null) .12f else 0f } else .12f*(1-FabStandard.transform(((elapsed-fade)/150f).coerceIn(0f,1f)))
                drawCircle(hostInk.copy(alpha=hostInk.alpha*alpha),r*growth,origin)
            }
            drawContent()
        }
        .then(focus.modifier)
        .pointerInput(density.density) {
            awaitEachGesture {
                val down=awaitFirstDown(false,PointerEventPass.Initial)
                pointer=AWCActivationMetadata("pointer",down.position.x/density.density,down.position.y/density.density)
                do { val event=awaitPointerEvent(PointerEventPass.Final) } while(event.changes.any { it.pressed })
                pointer=null
            }
        }
        .onPreviewKeyEvent { event ->
            if(event.key !in listOf(Key.Enter,Key.NumPadEnter,Key.Spacebar)) false else {
                if(event.type==KeyEventType.KeyDown && enabled) {
                    keyboardPressed=true;keyboardJob?.cancel()
                    keyboardJob=scope.launch(start=CoroutineStart.UNDISPATCHED) {
                        val press=PressInteraction.Press(Offset.Unspecified)
                        try {
                            interactions.emit(press)
                            val beginning=withFrameNanos { it };var next=beginning
                            while(next-beginning<150_000_000L) next=withFrameNanos { it }
                        } finally { interactions.tryEmit(PressInteraction.Release(press));keyboardPressed=false }
                    }
                    pointer=null;activate(AWCActivationMetadata("keyboard"))
                }
                true
            }
        }
        .clickable(interactionSource=interactions,indication=null,enabled=!p.bool("disabled"),role=Role.Button) { activate(pointer ?: AWCActivationMetadata("accessibility")) }
        .semantics {
            if(!enabled) disabled();if(name.isNotEmpty()) contentDescription=name
            anchor?.expanded?.let { stateDescription=if(it) "Expanded" else "Collapsed" }
        }
    ) { _ ->
        val iconPx=iconSize.dp.roundToPx().coerceAtLeast(0)
        val authored=subcompose("authored-icon") {
            // Keep the authored composition alive while a menu icon hides it.
            CompositionLocalProvider(LocalAWCFabController provides null,LocalContentColor provides iconInk,
                LocalAWCButtonSlotSize provides iconSize.dp,LocalAWCButtonSlotPart provides "icon",
                LocalAWCInspection provides if(menuIcon==null) inspection else null) {
                ProvideTextStyle(slotTextStyle) {
                    if(registry?.contains("icon")==true) registry.Render("icon") else slot?.invoke("icon")
                }
            }
        }.map { it.measure(Constraints(maxWidth=iconPx,maxHeight=iconPx)) }
        val fallbackName=menuIcon ?: p.str("icon")
        val fallback=if(menuIcon!=null || authored.isEmpty()) {
            if(fallbackName.isNotEmpty()) subcompose("fallback") {
                CompositionLocalProvider(LocalContentColor provides iconInk,LocalAWCButtonSlotSize provides iconSize.dp,LocalAWCButtonSlotPart provides "icon") { AWCMaterialSymbol(fallbackName) }
            }.map { it.measure(Constraints.fixed(iconPx,iconPx)) } else emptyList()
        } else emptyList()
        val icons=if(menuIcon!=null || authored.isEmpty()) fallback else authored
        val hasIcon=icons.isNotEmpty()
        val start=if(!hasLabel) 0f else if(hasIcon) metrics.inset else metrics.plainInset
        val end=if(!hasLabel) 0f else if(hasIcon) metrics.inset+(20f-metrics.inset)*extent else metrics.plainInset
        val gap=if(hasLabel && hasIcon) max(0f,metrics.gap*extent) else 0f
        val visibleLabel=if(hasLabel) min(naturalLabelWidth,max(0f,maxLabelWidth)).roundToInt() else 0
        val startPx=start.dp.roundToPx();val endPx=end.dp.roundToPx();val gapPx=gap.dp.roundToPx()
        val iconWidth=icons.size*iconPx
        val contentWidth=iconWidth+gapPx+visibleLabel
        val minWidth=if(hasLabel) max(0f,56f+24f*extent).dp.roundToPx() else metrics.height.dp.roundToPx()
        val width=if(hasLabel) max(minWidth,startPx+contentWidth+endPx) else metrics.height.dp.roundToPx()
        val height=metrics.height.dp.roundToPx()
        val rootMetrics=AWCInspectionMetrics(padding=AWCInspectionInsets(0.0,if(direction=="rtl") start.toDouble() else end.toDouble(),0.0,if(direction=="rtl") end.toDouble() else start.toDouble()),
            margin=AWCInspectionInsets(),border=AWCInspectionInsets(),gap=AWCInspectionGap(0.0,gap.toDouble()),
            typography=if(hasLabel) AWCInspectionTypography(metrics.font.toDouble(),20.0,500,.1,"Roboto") else null,display="Row",direction=direction)
        val markers=subcompose("root-markers") {
            Box(Modifier.inspectAWCNode(inspection,"","md-fab",rootMetrics))
            Box(Modifier.inspectAWCNode(inspection,"state-layer","State layer",AWCInspectionMetrics(display="Overlay",direction=direction)))
        }.map { it.measure(Constraints.fixed(width,height)) }
        val iconMarker=if(hasIcon) subcompose("icon-marker") {
            Box(Modifier.inspectAWCNode(inspection,"icon","Icon",AWCInspectionMetrics(display="Slot",direction=direction)))
        }.map { it.measure(Constraints.fixed(iconWidth,iconPx)) } else emptyList()
        val labelBox=if(hasLabel) subcompose("label") {
            Box(Modifier.clipToBounds().alpha(labelOpacity).inspectAWCNode(inspection,"label","Label",AWCInspectionMetrics(
                typography=AWCInspectionTypography(metrics.font.toDouble(),20.0,500,.1,"Roboto"),display="Text",direction=direction))) {
                Text(label,color=labelInk,style=style,softWrap=false,maxLines=1,overflow=TextOverflow.Clip,
                    modifier=Modifier.wrapContentWidth(Alignment.Start,unbounded=true).requiredWidth(with(density) { naturalLabelWidth.toDp() }).clearAndSetSemantics { })
            }
        }.map { it.measure(Constraints.fixed(visibleLabel,with(density) { 20.sp.toPx() }.roundToInt())) } else emptyList()
        layout(width,height) {
            markers.forEach { it.place(0,0) }
            var x=startPx+(width-startPx-endPx-contentWidth)/2
            iconMarker.forEach { it.placeRelative(x,(height-iconPx)/2) }
            icons.forEach { it.placeRelativeWithLayer(x+(iconPx-it.width)/2,(height-it.height)/2) { alpha=iconOpacity };x+=iconPx }
            x+=gapPx
            labelBox.forEach { it.placeRelative(x,(height-it.height)/2) }
        }
    }
}
