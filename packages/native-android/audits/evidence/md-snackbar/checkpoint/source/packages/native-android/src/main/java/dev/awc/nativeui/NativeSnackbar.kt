package dev.awc.nativeui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.*
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextMotion
import androidx.compose.ui.unit.*
import kotlinx.coroutines.*
import kotlin.math.*

private val SnackbarFont=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_bold,FontWeight.Bold))

@Composable internal fun NativeSnackbar(p:Props,emit:EventSink,slot:Slot?) {
    val registry=checkNotNull(LocalNativeSnackbarRegistry.current) { "Place md-snackbar inside AWCSnackbarScope covering the native viewport." }
    val controller=LocalAWCSnackbarController.current
    val state=remember(controller) { controller?.state ?: NativeSnackbarState() }
    val identity=remember { Any() }
    val scope=rememberCoroutineScope()
    val locals=currentCompositionLocalContext
    val inspection=LocalAWCInspection.current
    val latestEmit=rememberUpdatedState(emit)
    val actions=LocalAWCAction.current
    val actionTarget=LocalAWCActionTarget.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    SideEffect {
        state.emit={name,detail->
            @Suppress("UNCHECKED_CAST")
            val payload=(detail as? Map<String,AWCValue>) ?: emptyMap()
            dispatchNativeAction(AWCActionEvent(name,"md-snackbar",payload,
                targetID=actionTarget?.id ?: targetID),actions,actionTarget?.listeners?.invoke().orEmpty())
            latestEmit.value(name,detail)
        }
        state.raise={ registry.raise(state) }
        state.autoHide=p.bool("autoHide",true)
        state.autoHideDuration=(p["autoHideDuration"] as? Number)?.toDouble() ?: 4000.0
        state.closeable=p.bool("closeable")
        state.sourceOpen(p.bool("open"))
    }
    val layer=rememberUpdatedState<@Composable ()->Unit> {
        CompositionLocalProvider(locals) {
            CompositionLocalProvider(LocalAWCSnackbarController provides null,LocalAWCInspection provides null,
                LocalAWCActionTarget provides null) { NativeSnackbarLayer(state,p,inspection,slot) }
        }
    }
    val entry=remember(state) { NativeSnackbarEntry(state,layer) }
    DisposableEffect(registry,entry,controller,identity) {
        controller?.attach(identity);registry.entries+=entry
        onDispose {
            state.disconnect();registry.entries.remove(entry);controller?.detach(identity)
        }
    }
    LaunchedEffect(state) {
        state.connect(SnackbarScheduler { delayMillis,action->
            val job=scope.launch { delay(delayMillis);action() }
            SnackbarCancellation { job.cancel() }
        })
    }
    Spacer(Modifier.size(0.dp))
}

private data class SnackbarSpacing(val xs:Double=4.0,val sm:Double=8.0,val md:Double=12.0,val lg:Double=16.0,val xl:Double=24.0,val gap:Double=12.0)
private fun snackbarSpacing(p:Props,tokens:Map<String,String>):SnackbarSpacing {
    fun value(key:String,fallback:Double)=tokens["--md-sys-spacing-$key"]?.removeSuffix("px")?.toDoubleOrNull() ?: fallback
    val base=SnackbarSpacing(value("inset-xs",4.0),value("inset-sm",8.0),value("inset-md",12.0),value("inset-lg",16.0),value("inset-xl",24.0),value("gap-md",12.0))
    // The source's attribute token rules are distinct from an inherited raw
    // density signal. Zero inherits; only explicit negative rungs rebind tokens.
    return when(p.int("density")) {
        -2->base.copy(md=8.0,lg=12.0,xl=20.0,gap=8.0)
        -3->base.copy(sm=4.0,md=8.0,lg=12.0,xl=16.0,gap=8.0)
        -4->base.copy(sm=4.0,md=8.0,lg=8.0,xl=16.0,gap=4.0)
        else->base
    }
}

@Composable private fun NativeSnackbarLayer(state:NativeSnackbarState,p:Props,inspection:AWCInspectionContext?,slot:Slot?) {
    val hidden=p.bool("hidden")
    if(hidden) return
    val a=LocalAWCSnackbarAppearance.current.normalized()
    val parts=LocalAWCSnackbarParts.current
    val surfacePart=parts[AWCSnackbarPart.Surface] ?: AWCSnackbarPartAppearance()
    val messagePart=parts[AWCSnackbarPart.Message] ?: AWCSnackbarPartAppearance()
    val tokens=LocalAWCThemeTokens.current
    val spacing=snackbarSpacing(p,tokens)
    val d=LocalAWCNativeDensity.current
    val density=LocalDensity.current
    val rtl=when(p.str("dir")) { "rtl"->true;"ltr"->false;else->LocalLayoutDirection.current==LayoutDirection.Rtl }
    val direction=if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    val (reduced,forced)=rememberAWCAccessibilityAppearance()
    val progress=remember { Animatable(0f) }
    val position=p.str("position","bottom")
    LaunchedEffect(state.open,reduced) {
        if(reduced) progress.snapTo(if(state.open) 1f else 0f)
        else progress.animateTo(if(state.open) 1f else 0f,tween(if(state.open) 250 else 200,
            easing=if(state.open) CubicBezierEasing(.05f,.7f,.1f,1f) else CubicBezierEasing(.3f,0f,.8f,.15f)))
    }
    val visible=state.open || progress.value>0
    val colors=MaterialTheme.colorScheme
    val container=(surfacePart.backgroundColor ?: a.containerColor)?.let(::statusDotColor) ?: colors.inverseSurface
    val message=(messagePart.color ?: a.messageColor ?: surfacePart.color)?.let(::statusDotColor) ?: colors.inverseOnSurface
    val action=a.actionColor?.let(::statusDotColor) ?: colors.inversePrimary
    val close=a.closeColor?.let(::statusDotColor) ?: colors.inverseOnSurface
    val shape=surfacePart.cornerShape ?: a.containerShape ?: AWCCornerShape.uniform(tokens["--md-sys-shape-corner-extra-small"]?.removeSuffix("px")?.toDoubleOrNull() ?: 4.0)
    val slots=LocalAWCSlots.current
    val fontSize=max(12.0,14+.5*d).coerceAtMost(1024.0)
    val lineHeight=max(16.0,20+d).coerceAtMost(2048.0)
    val style=TextStyle(color=message,fontSize=fontSize.sp,lineHeight=lineHeight.sp,fontFamily=SnackbarFont,
        fontWeight=FontWeight(messagePart.fontWeight ?: surfacePart.fontWeight ?: 400),letterSpacing=.25.sp,textMotion=TextMotion.Animated,platformStyle=PlatformTextStyle(includeFontPadding=false),
        lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))
    val fontContext=LocalAWCSkeletonSizingContext.current
    val font=fontContext.fontSize*density.fontScale
    val rootFont=fontContext.rootFontSize*density.fontScale
    val measurer=rememberTextMeasurer()
    val zero=fontContext.zeroGlyphAdvance ?: remember(font,measurer) {
        val result=measurer.measure(AnnotatedString("0"),TextStyle(fontFamily=SnackbarFont,fontSize=fontContext.fontSize.sp,
            platformStyle=PlatformTextStyle(includeFontPadding=false)),softWrap=false)
        (result.getLineRight(0)-result.getLineLeft(0))/density.density.toDouble()
    }
    val interactions=remember { MutableInteractionSource() }
    val hovered by interactions.collectIsHoveredAsState()
    LaunchedEffect(hovered) { if(hovered) state.pause() else state.resume() }
    var hadFocus by remember { mutableStateOf(false) }
    CompositionLocalProvider(LocalLayoutDirection provides direction) {
      BoxWithConstraints(Modifier.fillMaxSize()) {
        val viewportWidth=maxWidth.value.toDouble()
        val edge=if(viewportWidth<600) spacing.lg else spacing.xl
        val rootMetrics=AWCInspectionMetrics(padding=AWCInspectionInsets(edge,edge,edge,edge),margin=AWCInspectionInsets(),
            border=AWCInspectionInsets(),gap=AWCInspectionGap(0.0,0.0),display="Compose overlay",direction=if(rtl) "rtl" else "ltr")
        Layout(modifier=Modifier.fillMaxSize().graphicsLayer {
            alpha=progress.value
            translationY=(1-progress.value)*size.height*when {
                position.startsWith("top")->-1f
                position.startsWith("bottom")->1f
                else->0f
            }
        }.then(if(visible) Modifier.semantics {
            liveRegion=if(p.str("politeness","polite")=="assertive") LiveRegionMode.Assertive else LiveRegionMode.Polite
            isTraversalGroup=true
        }.inspectAWCNode(inspection,"","md-snackbar",rootMetrics) else Modifier.clearAndSetSemantics {}),content={
            SnackbarSurface(p,a,if(forced) parts+(AWCSnackbarPart.Surface to surfacePart.copy(borderWidth=1.0)) else parts,spacing,d,viewportWidth,font,rootFont,zero,style,slots,slot,inspection.takeIf { visible },
                Modifier.snackbarShadow(shape).background(container,shape)
                    .then(if(forced) Modifier.border(1.dp,colors.onSurface,shape) else if((surfacePart.borderWidth ?: 0.0)>0) Modifier.border(surfacePart.borderWidth!!.dp,surfacePart.borderColor?.let(::statusDotColor) ?: message,shape) else Modifier)
                    .hoverable(interactions,enabled=state.open)
                    .pointerInput(state.open) {
                        if(!state.open) awaitPointerEventScope {
                            while(true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() }
                        }
                    }
                    .onFocusChanged { focus->
                        if(focus.hasFocus && !hadFocus) state.pause()
                        else if(!focus.hasFocus && hadFocus) state.resume()
                        hadFocus=focus.hasFocus
                    }.focusGroup(),state,action,close)
        }) { children,constraints->
            val width=constraints.maxWidth.takeUnless { it==Constraints.Infinity } ?: constraints.minWidth
            val height=constraints.maxHeight.takeUnless { it==Constraints.Infinity } ?: constraints.minHeight
            val actualWidth=width/this.density.toDouble()
            val inset=(if(actualWidth<600) spacing.lg else spacing.xl).dp.roundToPx().coerceAtLeast(0)
            val margin=((surfacePart.marginInlineStart ?: 0.0)*this.density).roundToInt()
            val surface=children.single().measure(Constraints(maxWidth=(width-2*inset-margin).coerceAtLeast(0),maxHeight=Constraints.Infinity))
            val x=when { position.endsWith("start")->inset+margin;position.endsWith("end")->width-inset-surface.width;else->(width-surface.width+margin)/2 }
            val y=when { position.startsWith("top")->inset;position.startsWith("bottom")->height-inset-surface.height;else->(height-surface.height)/2 }
            layout(width,height) { if(visible) surface.placeRelative(x,y) }
        }
      }
    }
}

@Composable private fun SnackbarSurface(
    p:Props,a:AWCSnackbarAppearance,parts:Map<AWCSnackbarPart,AWCSnackbarPartAppearance>,spacing:SnackbarSpacing,d:Double,viewportWidth:Double,font:Double,rootFont:Double,zero:Double,
    style:TextStyle,slots:AWCSlotRegistry?,slot:Slot?,inspection:AWCInspectionContext?,modifier:Modifier,
    state:NativeSnackbarState,actionColor:Color,closeColor:Color,
) {
    val stacked=p.bool("stacked")
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val surfacePart=parts[AWCSnackbarPart.Surface] ?: AWCSnackbarPartAppearance()
    val messagePart=parts[AWCSnackbarPart.Message] ?: AWCSnackbarPartAppearance()
    val actionsPart=parts[AWCSnackbarPart.Actions] ?: AWCSnackbarPartAppearance()
    val closePart=parts[AWCSnackbarPart.Close] ?: AWCSnackbarPartAppearance()
    val iconPart=parts[AWCSnackbarPart.CloseIcon] ?: AWCSnackbarPartAppearance()
    val border=surfacePart.borderWidth ?: 0.0
    val start=surfacePart.paddingInlineStart ?: max(8.0,16+2*d).coerceAtMost(8192.0)
    val messageTop=max(6.0,14+2*d).coerceAtMost(8192.0)
    val messageBottom=if(stacked) spacing.xs else messageTop
    val block=if(stacked) spacing.sm else 0.0
    val actionPresence=remember { SnackbarSlotPresence() };val closePresence=remember { SnackbarSlotPresence() }
    var measuredEnd by remember { mutableDoubleStateOf(start) }
    val metrics=AWCInspectionMetrics(padding=AWCInspectionInsets(block,if(rtl) start else measuredEnd,block,if(rtl) measuredEnd else start),
        margin=AWCInspectionInsets(left=if(rtl) 0.0 else surfacePart.marginInlineStart ?: 0.0,right=if(rtl) surfacePart.marginInlineStart ?: 0.0 else 0.0),border=AWCInspectionInsets(border,border,border,border),gap=AWCInspectionGap(if(stacked) 6.0 else 0.0,if(stacked) spacing.gap else 0.0),
        display=if(stacked) "Compose grid" else "Compose row",direction=if(rtl) "rtl" else "ltr")
    val messageMetrics=AWCInspectionMetrics(padding=AWCInspectionInsets(messageTop,if(rtl) messagePart.paddingInlineStart ?: 0.0 else 0.0,messageBottom,if(rtl) 0.0 else messagePart.paddingInlineStart ?: 0.0),margin=AWCInspectionInsets(left=if(rtl) 0.0 else messagePart.marginInlineStart ?: 0.0,right=if(rtl) messagePart.marginInlineStart ?: 0.0 else 0.0),
        typography=AWCInspectionTypography(style.fontSize.value.toDouble(),style.lineHeight.value.toDouble(),style.fontWeight!!.weight,.25,"Roboto"),display="Compose text",direction=if(rtl) "rtl" else "ltr")
    Layout(modifier=modifier.inspectAWCNode(inspection,"surface","Surface",metrics),content={
        CompositionLocalProvider(LocalAWCSourceText provides true,LocalContentColor provides style.color,LocalAWCSlots provides null,LocalAWCInspection provides null) {
            ProvideTextStyle(style) {
                SnackbarSlot("",slots,slot,true,Modifier.inspectAWCNode(inspection,"message","Message",messageMetrics)
                    .snackbarPartPaint(messagePart).padding(start=(messagePart.paddingInlineStart ?: 0.0).dp,top=messageTop.dp,bottom=messageBottom.dp)) { if(p.str("message").isNotEmpty()) NativeSourceText(awcCollapsedWhitespace(p.str("message")),style=style) }
            }
        }
        CompositionLocalProvider(LocalTextStyle provides LocalTextStyle.current.copy(fontWeight=FontWeight(actionsPart.fontWeight ?: surfacePart.fontWeight ?: 400)),LocalContentColor provides (actionsPart.color?.let(::statusDotColor) ?: actionColor),LocalAWCSlots provides null,LocalAWCInspection provides null) {
            SnackbarSlot("action",slots,slot,p.str("action").isNotEmpty(),Modifier.inspectAWCNode(inspection,"actions","Actions",AWCInspectionMetrics(display="Compose row",padding=AWCInspectionInsets(left=if(rtl) 0.0 else actionsPart.paddingInlineStart ?: 0.0,right=if(rtl) actionsPart.paddingInlineStart ?: 0.0 else 0.0))).snackbarPartPaint(actionsPart).padding(start=(actionsPart.paddingInlineStart ?: 0.0).dp),actionPresence) {
                if(p.str("action").isNotEmpty()) {
                    val paint=(actionsPart.color?.let(::statusDotColor) ?: actionColor).toSnackbarHex()
                    AWCButtonAppearanceScope(AWCButtonAppearance(labelColor=paint,iconColor=paint,stateLayerColor=paint)) {
                        AWCComponent("md-button",mapOf("variant" to "text","size" to "sm","label" to p.str("action")),
                            onEvent={name,_->if(name=="mdClick") state.action()})
                    }
                }
            }
        }
        CompositionLocalProvider(LocalTextStyle provides LocalTextStyle.current.copy(fontWeight=FontWeight(closePart.fontWeight ?: surfacePart.fontWeight ?: 400)),LocalContentColor provides (closePart.color?.let(::statusDotColor) ?: closeColor),LocalAWCSlots provides null,LocalAWCInspection provides null) {
            SnackbarSlot("close",slots,slot,p.bool("closeable"),Modifier.inspectAWCNode(inspection,"close","Close",AWCInspectionMetrics(display="Compose row",margin=AWCInspectionInsets(left=if(rtl) 0.0 else closePart.marginInlineStart ?: 0.0,right=if(rtl) closePart.marginInlineStart ?: 0.0 else 0.0))).snackbarPartPaint(closePart).padding(start=(closePart.paddingInlineStart ?: 0.0).dp),closePresence) {
                if(p.bool("closeable")) {
                    val size=max(32.0,40+4*d).coerceAtMost(2400.0);val icon=max(18.0,24+d).coerceAtMost(2400.0)
                    AWCIconButtonAppearanceScope(AWCIconButtonAppearance(iconColor=(iconPart.color?.let(::statusDotColor) ?: closePart.color?.let(::statusDotColor) ?: closeColor).toSnackbarHex(),width=size,height=size,iconSize=icon)) {
                        CompositionLocalProvider(LocalAWCForwardedIconAppearance provides iconPart,LocalAWCForwardedIconInspection provides inspection?.let { it to "close-icon" }) {
                            AWCComponent("md-icon-button",mapOf("variant" to "standard","icon" to "close","aria-label" to p.str("dismissLabel","Dismiss")),
                                onEvent={name,_->if(name=="mdClick") state.requestClose()})
                        }
                    }
                }
            }
        }
    }) { children,constraints->
        fun px(value:Double)=(value*density).coerceIn(0.0,32766.0).roundToInt()
        val action=children[1].measure(Constraints(maxWidth=32766,maxHeight=32766))
        val close=children[2].measure(Constraints(maxWidth=32766,maxHeight=32766))
        val hasAction=actionPresence.authored || p.str("action").isNotEmpty()
        val hasClose=closePresence.authored || p.bool("closeable")
        val end=if(hasClose) spacing.md else if(hasAction) spacing.sm else start
        if(measuredEnd!=end) measuredEnd=end
        val left=px(start+border);val right=px(end+border);val vertical=px(block+border);val closeMargin=((closePart.marginInlineStart ?: 0.0)*density).roundToInt();val messageMargin=((messagePart.marginInlineStart ?: 0.0)*density).roundToInt();val actionMargin=((actionsPart.marginInlineStart ?: 0.0)*density).roundToInt();val gap=if(stacked) px(spacing.gap) else 0
        val available=constraints.maxWidth.coerceAtMost(32766)
        val minimum=px(a.minWidth?.resolve(available/density.toDouble(),font,rootFont,zero) ?: 288.0)
        val maximum=px(a.maxWidth?.resolve(available/density.toDouble(),font,rootFont,zero) ?: 568.0)
        val maxAllowed=max(minimum,min(maximum,available))
        val naturalMessage=runCatching { children[0].maxIntrinsicWidth(Constraints.Infinity) }.getOrDefault(maxAllowed)
        val minimumMessage=runCatching { children[0].minIntrinsicWidth(Constraints.Infinity) }.getOrDefault(0)
        val natural=left+right+if(stacked) max(naturalMessage+messageMargin+close.width+closeMargin+gap,action.width+actionMargin) else naturalMessage+messageMargin+action.width+actionMargin+close.width+closeMargin
        val width=if(viewportWidth<600) available else max(left+right,natural.coerceIn(minimum,maxAllowed))
        val messageWidth=max(minimumMessage,width-left-right-close.width-closeMargin-messageMargin-if(stacked) gap else action.width+actionMargin).coerceIn(0,32766)
        val message=children[0].measure(Constraints(minWidth=messageWidth,maxWidth=messageWidth,maxHeight=32766))
        val row1=if(stacked) max(message.height,close.height+if(hasClose) px(spacing.xs) else 0) else max(message.height,max(action.height,close.height))
        val rowGap=if(stacked) px(6.0) else 0
        val height=max(px(if(stacked) 68.0 else max(36.0,48+3*d)),row1+if(stacked) vertical*2+rowGap+action.height else px(border*2)).coerceAtMost(32766)
        layout(width,height) {
            if(stacked) {
                message.placeRelative(left+messageMargin,vertical)
                if(hasClose) close.placeRelative(width-right-close.width,vertical+px(spacing.xs))
                if(hasAction) action.placeRelative(width-right-action.width,vertical+row1+rowGap)
            } else {
                message.placeRelative(left+messageMargin,(height-message.height)/2)
                if(hasAction) action.placeRelative(left+messageMargin+messageWidth+actionMargin,(height-action.height)/2)
                if(hasClose) close.placeRelative(left+messageMargin+messageWidth+action.width+actionMargin+closeMargin,(height-close.height)/2)
            }
        }
    }
}

private fun Color.toSnackbarHex()="#%02X%02X%02X%02X".format((red*255).roundToInt(),(green*255).roundToInt(),(blue*255).roundToInt(),(alpha*255).roundToInt())
private class SnackbarSlotPresence { var authored=false }

/** Authored content is composed exactly once. The unplaced fallback has no
 * pointer/semantics surface, and explicit empty registered slots suppress it. */
@Composable private fun SnackbarSlot(name:String,registry:AWCSlotRegistry?,slot:Slot?,fallbackPresent:Boolean,modifier:Modifier,presence:SnackbarSlotPresence?=null,fallback:@Composable ()->Unit) {
    val registered=registry?.contains(name)==true
    val policy=remember(registered,fallbackPresent) { object:MeasurePolicy {
        fun <T:IntrinsicMeasurable> selected(all:List<T>):List<T> =
            if(registered || all.size>1) all.dropLast(1) else if(fallbackPresent) all.takeLast(1) else emptyList()
        override fun MeasureScope.measure(measurables:List<Measurable>,constraints:Constraints):MeasureResult {
            presence?.authored=registered || measurables.size>1
            val chosen=selected(measurables)
            val items=chosen.map { it.measure(constraints.copy(minWidth=0,minHeight=0)) }
            val width=constraints.constrainWidth(items.sumOf { it.width })
            val height=constraints.constrainHeight(items.maxOfOrNull { it.height } ?: 0)
            return layout(width,height) { var x=0;items.forEach { it.placeRelative(x,(height-it.height)/2);x+=it.width } }
        }
        override fun IntrinsicMeasureScope.maxIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=selected(measurables).sumOf { it.maxIntrinsicWidth(height) }
        override fun IntrinsicMeasureScope.minIntrinsicWidth(measurables:List<IntrinsicMeasurable>,height:Int)=selected(measurables).maxOfOrNull { it.minIntrinsicWidth(height) } ?: 0
    } }
    Layout(modifier=modifier,content={
        if(registered) registry?.Render(name) else slot?.invoke(name)
        Box { if(!registered) fallback() }
    },measurePolicy=policy)
}

internal fun Modifier.snackbarPartPaint(part:AWCSnackbarPartAppearance):Modifier {
    val shape=part.cornerShape ?: AWCCornerShape.uniform(0.0)
    return this.then(part.backgroundColor?.let { Modifier.background(statusDotColor(it),shape) } ?: Modifier)
        .then(if((part.borderWidth ?: 0.0)>0) Modifier.border(part.borderWidth!!.dp,part.borderColor?.let(::statusDotColor) ?: Color.Transparent,shape).padding(part.borderWidth.dp) else Modifier)
}

/** Android elevation also shades the inside of a translucent fill. Source outer
 * shadows are clipped out of the border box, so keep that region untouched. */
private fun Modifier.snackbarShadow(shape:AWCCornerShape)=drawWithCache {
    val path=when(val outline=shape.createOutline(size,layoutDirection,this)) {
        is Outline.Generic->outline.path
        is Outline.Rounded->Path().apply { addRoundRect(outline.roundRect) }
        is Outline.Rectangle->Path().apply { addRect(outline.rect) }
    }
    val first=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color=android.graphics.Color.BLACK
        setShadowLayer(8.dp.toPx(),0f,4.dp.toPx(),android.graphics.Color.argb(38,0,0,0))
    }
    val second=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
        color=android.graphics.Color.BLACK
        setShadowLayer(3.dp.toPx(),0f,1.dp.toPx(),android.graphics.Color.argb(77,0,0,0))
    }
    onDrawBehind { clipPath(path,ClipOp.Difference) { drawIntoCanvas {
        it.nativeCanvas.drawPath(path.asAndroidPath(),first)
        it.nativeCanvas.drawPath(path.asAndroidPath(),second)
    } } }
}
