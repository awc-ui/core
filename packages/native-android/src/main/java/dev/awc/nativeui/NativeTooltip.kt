package dev.awc.nativeui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.*
import androidx.compose.foundation.interaction.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.*
import androidx.compose.ui.focus.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.layout.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.*
import kotlinx.coroutines.*
import kotlin.math.*

private val TooltipFont=FontFamily(Font(R.font.awc_roboto_regular,FontWeight.Normal),Font(R.font.awc_roboto_medium,FontWeight.Medium),Font(R.font.awc_roboto_bold,FontWeight.Bold))

@Composable internal fun NativeTooltip(p:Props,emit:EventSink,slot:Slot?) {
    // Without an AWCTooltipScope there is no viewport layer for the bubble: like the SwiftUI renderer, the trigger content
    // still renders inline and the tooltip never shows (instead of failing composition in a generic AWCComponent tree).
    val registry=LocalNativeTooltipRegistry.current ?: run {
        LaunchedEffect(Unit) { android.util.Log.w("AWCTooltip","md-tooltip needs AWCTooltipScope covering the viewport; showing only its trigger.") }
        if(p.bool("hidden")) return
        val slots=LocalAWCSlots.current
        CompositionLocalProvider(LocalAWCSlots provides null,LocalAWCInspection provides null) {
            Layout(content={ if(slots?.contains("")==true) slots.Render("") else slot?.invoke("") }) { children,constraints->
                val items=children.map { it.measure(constraints.copy(minWidth=0,minHeight=0)) }
                layout(constraints.constrainWidth(items.sumOf { it.width }),constraints.constrainHeight(items.maxOfOrNull { it.height } ?: 0)) {
                    var x=0;items.forEach { it.placeRelative(x,0);x+=it.width } }
            }
        }
        return
    }
    val controller=LocalAWCTooltipController.current
    val state=remember(controller) { controller?.state ?: NativeTooltipState() }
    val identity=remember { Any() };val scope=rememberCoroutineScope()
    val locals=currentCompositionLocalContext;val inspection=LocalAWCInspection.current
    val latestEmit=rememberUpdatedState(emit);val target=LocalAWCActionTarget.current;val action=LocalAWCAction.current
    val targetID=remember { java.util.UUID.randomUUID().toString() }
    val slots=LocalAWCSlots.current
    val headingText=remember { AWCSlotTextRegistry() };val contentText=remember { AWCSlotTextRegistry() }
    val headingPresence=remember { TooltipSlotPresence() };val contentPresence=remember { TooltipSlotPresence() }
    val focus=remember { FocusRequester() }
    val description=if(state.disabled) "" else if(p.str("variant","plain")!="rich") p.str("text") else listOf(
        if(headingPresence.authored) headingText.text.trim() else p.str("subhead"),
        if(contentPresence.authored) contentText.text.trim() else p.str("text")).filter { it.isNotEmpty() }.joinToString(". ")
    SideEffect {
        state.emit={name,detail->
            // Non-bubbling source events still reach capture listeners in the
            // same native tree. The dispatcher stops at the nearest boundary.
            dispatchNativeAction(AWCActionEvent(name,"md-tooltip",emptyMap(),cancelable=true,bubbles=false,
                crossesBoundaries=false,targetID=target?.id ?: targetID,rawDetail=null),action,target?.listeners?.invoke().orEmpty())
            latestEmit.value(name,detail)
        }
        state.restoreAnchorFocus={runCatching { focus.requestFocus() }}
        state.showDelay=(p["showDelay"] as? Number)?.toDouble() ?: 500.0
        state.hideDelay=(p["hideDelay"] as? Number)?.toDouble() ?: 200.0
        state.updateDisabled(p.bool("disabled"));state.sourceOpen(p.bool("open"))
    }
    lateinit var entry:NativeTooltipEntry
    val layer=rememberUpdatedState<@Composable ()->Unit> {
        CompositionLocalProvider(locals) {
            CompositionLocalProvider(LocalAWCTooltipController provides null,LocalAWCInspection provides null,LocalAWCActionTarget provides null) {
                NativeTooltipLayer(state,p,registry,entry,slots,slot,inspection,headingText,contentText,headingPresence,contentPresence)
            }
        }
    }
    entry=remember(state) { NativeTooltipEntry(state,layer) }
    DisposableEffect(registry,entry,controller,identity) {
        controller?.attach(identity);registry.entries+=entry
        onDispose { state.disconnect();registry.entries.remove(entry);controller?.detach(identity) }
    }
    LaunchedEffect(state) {
        state.connect(TooltipScheduler { millis,action->
            val job=scope.launch { delay(millis);action() };TooltipCancellation { job.cancel() }
        })
    }
    var focusedBefore by remember { mutableStateOf(false) }
    var hadAnchor by remember { mutableStateOf(false) }
    val anchorModifier=Modifier.onGloballyPositioned { entry.coordinates=it;registry.refresh() }
        .inspectAWCNode(inspection,"","md-tooltip",AWCInspectionMetrics(display="Compose anchor"))
        .focusRequester(focus).onFocusChanged { f->
            if(f.hasFocus && !focusedBefore) state.triggerFocus()
            else if(!f.hasFocus && focusedBefore) {
                state.anchorFocused=false
                // Focus callbacks for the popup arrive later in the same frame.
                scope.launch { yield();state.triggerBlur(state.popupFocused || state.anchorFocused) }
            }
            focusedBefore=f.hasFocus
        }.focusGroup()
        .semantics(mergeDescendants=true) {
            if(description.isNotEmpty()) customActions=listOf(CustomAccessibilityAction(description) { state.show();true })
        }
        .pointerInput(state,state.disabled) {
            if(!state.disabled) awaitEachGesture {
                val down=awaitFirstDown(requireUnconsumed=false,pass=PointerEventPass.Initial)
                if(down.type==PointerType.Touch) {
                    val long=awaitLongPressOrCancellation(down.id)
                    if(long!=null) state.show()
                }
            }
        }
    if(p.bool("hidden")) return
    CompositionLocalProvider(LocalAWCSlots provides null,LocalAWCInspection provides null,LocalAWCActionTarget provides null) {
        Layout(modifier=anchorModifier,content={ if(slots?.contains("")==true) slots.Render("") else slot?.invoke("") }) { children,constraints->
            val present=children.isNotEmpty()
            if(hadAnchor && !present) state.removeAnchor()
            hadAnchor=present
            val items=children.map { it.measure(constraints.copy(minWidth=0,minHeight=0)) }
            val width=constraints.constrainWidth(items.sumOf { it.width })
            val height=constraints.constrainHeight(items.maxOfOrNull { it.height } ?: 0)
            layout(width,height) { var x=0;items.forEach { it.placeRelative(x,0);x+=it.width } }
        }
    }
}

private data class TooltipSpacing(val xs:Double=4.0,val sm:Double=8.0,val md:Double=12.0,val lg:Double=16.0,val gapXs:Double=4.0,val gapSm:Double=8.0,val gapMd:Double=12.0)
private fun tooltipSpacing(p:Props,tokens:Map<String,String>):TooltipSpacing {
    fun value(key:String,fallback:Double)=tokens["--md-sys-spacing-$key"]?.removeSuffix("px")?.toDoubleOrNull() ?: fallback
    val base=TooltipSpacing(value("inset-xs",4.0),value("inset-sm",8.0),value("inset-md",12.0),value("inset-lg",16.0),value("gap-xs",4.0),value("gap-sm",8.0),value("gap-md",12.0))
    return when(p.int("density")) {
        -2->base.copy(md=8.0,lg=12.0,gapMd=8.0)
        -3->base.copy(sm=4.0,md=8.0,lg=12.0,gapSm=4.0,gapMd=8.0)
        -4->base.copy(sm=4.0,md=8.0,lg=8.0,gapXs=2.0,gapSm=4.0,gapMd=4.0)
        else->base
    }
}

@Composable private fun NativeTooltipLayer(state:NativeTooltipState,p:Props,registry:NativeTooltipRegistry,entry:NativeTooltipEntry,
    slots:AWCSlotRegistry?,slot:Slot?,inspection:AWCInspectionContext?,headingText:AWCSlotTextRegistry,contentText:AWCSlotTextRegistry,
    headingPresence:TooltipSlotPresence,contentPresence:TooltipSlotPresence) {
    if(p.bool("hidden")) return
    val a=LocalAWCTooltipAppearance.current.normalized();val parts=LocalAWCTooltipParts.current
    val d=LocalAWCNativeDensity.current;val tokens=LocalAWCThemeTokens.current
    val spacing=tooltipSpacing(p,tokens);val density=LocalDensity.current
    val rtl=when(p.str("dir")) { "rtl"->true;"ltr"->false;else->LocalLayoutDirection.current==LayoutDirection.Rtl }
    val (reduced,forced)=rememberAWCAccessibilityAppearance()
    val progress=remember { Animatable(if(state.visible) 1f else 0f) }
    LaunchedEffect(state.visible,reduced) {
        if(reduced) progress.snapTo(if(state.visible) 1f else 0f)
        else progress.animateTo(if(state.visible) 1f else 0f,tween(100,easing=CubicBezierEasing(.2f,0f,0f,1f)))
    }
    var placement by remember { mutableStateOf(TooltipPlacement(0.0,0.0,"top")) }
    val visible=state.visible || progress.value>0
    val scope=rememberCoroutineScope();var focusedBefore by remember { mutableStateOf(false) }
    CompositionLocalProvider(LocalLayoutDirection provides if(rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Layout(modifier=Modifier.fillMaxSize(),content={
            TooltipSurface(p,a,parts,spacing,d,slots,slot,inspection.takeIf { visible },headingText,contentText,headingPresence,contentPresence,forced,
                Modifier.graphicsLayer {
                    alpha=progress.value;scaleX=if(reduced) 1f else .9f+.1f*progress.value;scaleY=scaleX
                    transformOrigin=TransformOrigin(placement.originX,placement.originY)
                }.then(if(state.visible) Modifier.semantics { this[SemanticsProperties.IsPopup]=Unit;liveRegion=LiveRegionMode.Polite } else Modifier.clearAndSetSemantics { hideFromAccessibility() })
                    .onGloballyPositioned { entry.popupCoordinates=it;registry.refresh() }
                    .focusProperties { canFocus=state.visible }
                    .onFocusChanged { f->
                        if(f.hasFocus && !focusedBefore) state.popupFocus()
                        else if(!f.hasFocus && focusedBefore) { state.popupFocused=false;scope.launch { yield();state.popupBlur(state.anchorFocused || state.popupFocused) } }
                        focusedBefore=f.hasFocus
                    }.focusGroup()
                    .pointerInput(state.visible) { if(!state.visible) awaitPointerEventScope { while(true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() } } })
        }) { children,constraints->
            val w=constraints.maxWidth;val h=constraints.maxHeight
            val popup=children.single().measure(Constraints(maxWidth=w,maxHeight=32766))
            val anchor=entry.bounds;val viewport=registry.bounds
            val next=nativeTooltipPlacement(TooltipBox((anchor.left-viewport.left)/this.density.toDouble(),(anchor.top-viewport.top)/this.density.toDouble(),
                anchor.width/this.density.toDouble(),anchor.height/this.density.toDouble()),popup.width/this.density.toDouble(),popup.height/this.density.toDouble(),
                w/this.density.toDouble(),h/this.density.toDouble(),p.str("position","top"),rtl,p.bool("autoPosition",true),
                (p["offset"] as? Number)?.toDouble() ?: 8.0,(p["crossOffset"] as? Number)?.toDouble() ?: 0.0)
            placement=next
            val margin=if(rtl) 0.0 else parts[AWCTooltipPart.Popup]?.marginInlineStart ?: 0.0
            layout(w,h) { if(visible) popup.placeWithLayer(((next.left+margin)*this.density).roundToInt(),(next.top*this.density).roundToInt()) }
        }
    }
}

@Composable private fun TooltipSurface(p:Props,a:AWCTooltipAppearance,parts:Map<AWCTooltipPart,AWCTooltipPartAppearance>,spacing:TooltipSpacing,d:Double,
    slots:AWCSlotRegistry?,slot:Slot?,inspection:AWCInspectionContext?,headingText:AWCSlotTextRegistry,contentText:AWCSlotTextRegistry,
    headingPresence:TooltipSlotPresence,contentPresence:TooltipSlotPresence,forced:Boolean,modifier:Modifier) {
    val rich=p.str("variant","plain")=="rich";val colors=MaterialTheme.colorScheme
    val tokens=LocalAWCThemeTokens.current;val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val popupPart=parts[AWCTooltipPart.Popup] ?: AWCTooltipPartAppearance()
    val shape=popupPart.cornerShape ?: (if(rich) a.richShape else a.plainShape) ?: AWCCornerShape.uniform(
        tokens[if(rich) "--md-sys-shape-corner-medium" else "--md-sys-shape-corner-extra-small"]?.removeSuffix("px")?.toDoubleOrNull() ?: if(rich) 12.0 else 4.0)
    val background=(popupPart.backgroundColor ?: if(rich) a.richContainerColor else a.plainContainerColor)?.let(::statusDotColor) ?: if(rich) colors.surfaceContainer else colors.inverseSurface
    val foreground=(popupPart.color ?: if(rich) a.richTextColor else a.plainTextColor)?.let(::statusDotColor) ?: if(rich) colors.onSurfaceVariant else colors.inverseOnSurface
    val border=if(forced) 1.0 else popupPart.borderWidth ?: 0.0
    val top=if(rich) spacing.md else spacing.xs;val bottom=if(rich) spacing.sm else spacing.xs
    val end=if(rich) spacing.lg else spacing.sm;val start=popupPart.paddingInlineStart ?: end
    val font=LocalAWCSkeletonSizingContext.current;val scale=LocalDensity.current.fontScale
    fun style(part:AWCTooltipPart,color:Color):TextStyle {
        val partStyle=parts[part] ?: AWCTooltipPartAppearance()
        val plain=part==AWCTooltipPart.Text
        val size=partStyle.fontSize ?: if(plain) popupPart.fontSize ?: max(10.0,12+.5*d) else max(11.0,14+.5*d)
        val line=partStyle.lineHeight ?: if(plain) popupPart.lineHeight ?: max(14.0,16+.5*d) else max(16.0,20+d)
        val weight=partStyle.fontWeight ?: if(plain) popupPart.fontWeight ?: 400 else if(part==AWCTooltipPart.Subhead) 500 else 400
        val tracking=partStyle.letterSpacing ?: if(plain) popupPart.letterSpacing ?: .4 else if(part==AWCTooltipPart.Subhead) .1 else .25
        return TextStyle(color=partStyle.color?.let(::statusDotColor) ?: color,fontFamily=TooltipFont,fontSize=size.sp,lineHeight=line.sp,
            fontWeight=FontWeight(weight),letterSpacing=tracking.sp,platformStyle=PlatformTextStyle(includeFontPadding=false),
            lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))
    }
    val supportingStyle=style(if(rich) AWCTooltipPart.SupportingText else AWCTooltipPart.Text,if(rich) a.richTextColor?.let(::statusDotColor) ?: colors.onSurfaceVariant else foreground)
    val headingStyle=style(AWCTooltipPart.Subhead,a.richSubheadColor?.let(::statusDotColor) ?: colors.onSurfaceVariant)
    val actionPart=parts[AWCTooltipPart.Actions] ?: AWCTooltipPartAppearance()
    val actionStyle=TextStyle(color=a.richActionColor?.let(::statusDotColor) ?: colors.primary,fontFamily=TooltipFont,
        fontSize=(actionPart.fontSize ?: popupPart.fontSize ?: 16.0).sp,lineHeight=(actionPart.lineHeight ?: popupPart.lineHeight ?: 19.0).sp,
        fontWeight=FontWeight(actionPart.fontWeight ?: popupPart.fontWeight ?: 400),letterSpacing=(actionPart.letterSpacing ?: popupPart.letterSpacing ?: 0.0).sp,
        platformStyle=PlatformTextStyle(includeFontPadding=false),lineHeightStyle=LineHeightStyle(LineHeightStyle.Alignment.Center,LineHeightStyle.Trim.None,LineHeightStyle.Mode.Fixed))
    val actionsPresence=remember { TooltipSlotPresence() }
    val metrics=AWCInspectionMetrics(padding=AWCInspectionInsets(top,if(rtl) start else end,bottom,if(rtl) end else start),
        border=AWCInspectionInsets(border,border,border,border),margin=AWCInspectionInsets(left=if(rtl) 0.0 else popupPart.marginInlineStart ?: 0.0,right=if(rtl) popupPart.marginInlineStart ?: 0.0 else 0.0),gap=AWCInspectionGap(0.0,0.0),display=if(rich) "Compose block" else "Compose row",direction=if(rtl) "rtl" else "ltr")
    MultiMeasureLayout(modifier=modifier.then(if(rich) Modifier.tooltipShadow(shape) else Modifier).background(background,shape)
        .then(if(border>0) Modifier.border(border.dp,if(forced) colors.onSurface else popupPart.borderColor?.let(::statusDotColor) ?: foreground,shape) else Modifier)
        .inspectAWCNode(inspection,"popup","Popup",metrics),content={
        if(rich) {
            TooltipPart("subhead",p.str("subhead"),slots,slot,parts[AWCTooltipPart.Subhead] ?: AWCTooltipPartAppearance(),headingStyle,
                inspection,headingText,headingPresence,sourceGap=spacing.gapXs,skipEmptyFallback=true)
            TooltipPart("content",p.str("text"),slots,slot,parts[AWCTooltipPart.SupportingText] ?: AWCTooltipPartAppearance(),supportingStyle,
                inspection,contentText,contentPresence)
            TooltipActions(slots,slot,actionStyle,actionsPresence,spacing.gapSm)
            val actionBorder=actionPart.borderWidth ?: 0.0
            val actionShape=actionPart.cornerShape ?: AWCCornerShape.uniform(0.0)
            Box(Modifier.inspectAWCNode(inspection,"actions","Actions",AWCInspectionMetrics(
                padding=AWCInspectionInsets(left=if(rtl) 0.0 else actionPart.paddingInlineStart ?: 0.0,right=if(rtl) actionPart.paddingInlineStart ?: 0.0 else 0.0),
                border=AWCInspectionInsets(actionBorder,actionBorder,actionBorder,actionBorder),margin=AWCInspectionInsets(top=spacing.gapMd,left=if(rtl) 0.0 else actionPart.marginInlineStart ?: 0.0,right=if(rtl) actionPart.marginInlineStart ?: 0.0 else 0.0),gap=AWCInspectionGap(spacing.gapSm,spacing.gapSm),display="Compose row",direction=if(rtl) "rtl" else "ltr"))
                .then(actionPart.backgroundColor?.let { Modifier.background(statusDotColor(it),actionShape) } ?: Modifier)
                .then(if(actionBorder>0) Modifier.border(actionBorder.dp,actionPart.borderColor?.let(::statusDotColor) ?: actionStyle.color,actionShape) else Modifier))
        } else TooltipPart("text",p.str("text"),null,null,parts[AWCTooltipPart.Text] ?: AWCTooltipPartAppearance(),supportingStyle,inspection,null,null,plain=true)
    }) { children,constraints->
        fun px(v:Double)=(v*this.density).coerceIn(0.0,32766.0).roundToInt()
        val viewport=constraints.maxWidth/this.density.toDouble()
        fun resolve(length:AWCTooltipLength?,fallback:Double)=length?.resolve(viewport,font.fontSize*scale,font.rootFontSize*scale,font.zeroGlyphAdvance ?: font.fontSize*.5*scale) ?: fallback
        val insetStart=px(start+border);val insetEnd=px(end+border);val insetTop=px(top+border);val insetBottom=px(bottom+border)
        val floorWidth=insetStart+insetEnd
        val maximum=px(min(if(rich) resolve(a.richMaxWidth,320.0) else resolve(a.plainMaxWidth,280.0),max(0.0,viewport-16)))
        val minimum=if(rich) px(resolve(a.richMinWidth,120.0)) else 0
        // Authored native controls may use SubcomposeLayout and deliberately
        // offer no intrinsic API. Measure the non-wrapping action row once at
        // max-content width, then size its real part surface independently.
        val actionRow=if(rich) children[2].measure(Constraints(maxWidth=32766,maxHeight=32766)) else null
        val actionBorder=px(actionPart.borderWidth ?: 0.0)
        val actionPadding=px(actionPart.paddingInlineStart ?: 0.0)
        val actionMargin=((actionPart.marginInlineStart ?: 0.0)*density).roundToInt()
        // A real authored Compose control may not implement intrinsic queries.
        // MultiMeasureLayout measures this same composition at max-content and
        // final width; it never creates a duplicate control or callback tree.
        val natural=max(children.take(if(rich) 2 else 1).maxOfOrNull { it.measure(Constraints(maxWidth=32766,maxHeight=32766)).width } ?: 0,
            if(actionRow!=null && actionsPresence.authored) actionRow.width+2*actionBorder+actionPadding+actionMargin else 0)
        val width=max(floorWidth,(natural+floorWidth).coerceIn(minimum,max(minimum,maximum)))
        val available=(width-floorWidth).coerceAtLeast(0)
        val measures=children.take(if(rich) 2 else 1).map { it.measure(Constraints(minWidth=if(rich) available else 0,
            maxWidth=if(rich) available else max(available,it.minIntrinsicWidth(32766)),maxHeight=32766)) }
        val hasHeading=rich && (p.str("subhead").isNotEmpty() || headingPresence.authored)
        val hasActions=rich && actionsPresence.authored
        val actionHeight=if(hasActions) actionRow!!.height+2*actionBorder else 0
        val actionBox=if(rich) children[3].measure(Constraints.fixed((available-actionMargin).coerceAtLeast(0),actionHeight)) else null
        val heights=if(rich) (if(hasHeading) measures[0].height+px(spacing.gapXs) else 0)+measures[1].height+(if(hasActions) actionHeight+px(spacing.gapMd) else 0) else measures.single().height
        val h=max(insetTop+insetBottom+heights,if(rich) 0 else px(max(20.0,24+d)))
        layout(width,h) {
            var y=insetTop
            if(rich) {
                if(hasHeading) { measures[0].placeRelative(insetStart,y);y+=measures[0].height+px(spacing.gapXs) }
                measures[1].placeRelative(insetStart,y);y+=measures[1].height
                if(hasActions) {
                    val actionY=y+px(spacing.gapMd)
                    actionBox!!.placeRelative(insetStart+actionMargin,actionY)
                    actionRow!!.placeRelative(insetStart+available-actionBorder-actionRow.width,actionY+actionBorder)
                }
            } else measures.single().placeRelative(insetStart,insetTop+(h-insetTop-insetBottom-measures.single().height)/2)
        }
    }
}

private class TooltipSlotPresence { var authored by mutableStateOf(false) }

@Composable private fun TooltipActions(slots:AWCSlotRegistry?,slot:Slot?,style:TextStyle,presence:TooltipSlotPresence,gap:Double) {
    val explicit=slots?.contains("actions")==true
    CompositionLocalProvider(LocalAWCSourceText provides true,LocalAWCSlotTextNoWrap provides true,
        LocalTextStyle provides style,LocalContentColor provides style.color,LocalAWCSlots provides null,LocalAWCInspection provides null) {
        Layout(content={ if(explicit) slots!!.Render("actions") else slot?.invoke("actions") }) { items,constraints->
            presence.authored=explicit || items.isNotEmpty()
            val children=items.map { it.measure(constraints.copy(minWidth=0,minHeight=0)) }
            val spacing=(gap*density).roundToInt()
            val width=children.sumOf { it.width }+max(0,children.size-1)*spacing
            val height=children.maxOfOrNull { it.height } ?: 0
            layout(width,height) { var x=0;children.forEach { it.placeRelative(x,0);x+=it.width+spacing } }
        }
    }
}

@Composable private fun TooltipPart(name:String,fallback:String,slots:AWCSlotRegistry?,slot:Slot?,part:AWCTooltipPartAppearance,style:TextStyle,
    inspection:AWCInspectionContext?,textRegistry:AWCSlotTextRegistry?,presence:TooltipSlotPresence?,sourceGap:Double=0.0,
    skipEmptyFallback:Boolean=false,actions:Boolean=false,plain:Boolean=false) {
    val explicit=slots?.contains(name)==true
    val rtl=LocalLayoutDirection.current==LayoutDirection.Rtl
    val border=part.borderWidth ?: 0.0;val padding=part.paddingInlineStart ?: 0.0;val margin=part.marginInlineStart ?: 0.0
    val path=when(name) { "content"->"supporting-text";else->name }
    val metrics=AWCInspectionMetrics(padding=AWCInspectionInsets(0.0,if(rtl) padding else 0.0,0.0,if(rtl) 0.0 else padding),
        border=AWCInspectionInsets(border,border,border,border),margin=AWCInspectionInsets(bottom=if(name=="subhead") sourceGap else 0.0,left=if(rtl) 0.0 else margin,right=if(rtl) margin else 0.0),
        gap=AWCInspectionGap(0.0,if(actions) sourceGap else 0.0),typography=AWCInspectionTypography(style.fontSize.value.toDouble(),style.lineHeight.value.toDouble(),style.fontWeight?.weight ?: 400,style.letterSpacing.value.toDouble(),"Roboto"),
        display=if(actions) "Compose row" else "Compose text",direction=if(rtl) "rtl" else "ltr")
    val shape=part.cornerShape ?: AWCCornerShape.uniform(0.0)
    val paint=Modifier.inspectAWCNode(inspection,path,path,metrics)
        .then(part.backgroundColor?.let { Modifier.background(statusDotColor(it),shape) } ?: Modifier)
        .then(if(border>0) Modifier.border(border.dp,part.borderColor?.let(::statusDotColor) ?: style.color,shape).padding(border.dp) else Modifier)
        .padding(start=padding.dp)
    Layout(modifier=Modifier.tooltipMargin(margin).then(paint),content={
        CompositionLocalProvider(LocalAWCSourceText provides true,LocalAWCSlotTextRegistry provides textRegistry,
            LocalAWCSourceTextWordWrapOnly provides !plain,
            LocalAWCSlotTextNoWrap provides actions,LocalTextStyle provides style,LocalContentColor provides style.color,
            LocalAWCSlots provides null,LocalAWCInspection provides null) {
            Layout(content={ if(explicit) slots!!.Render(name) else slot?.invoke(name) }) { items,constraints->
                presence?.authored=explicit || items.isNotEmpty()
                val children=items.map { it.measure(if(actions) Constraints(maxWidth=32766,maxHeight=32766) else constraints.copy(minWidth=0)) }
                val gap=if(actions) (sourceGap*density).roundToInt() else 0
                val natural=children.sumOf { it.width }+max(0,children.size-1)*gap
                val width=constraints.constrainWidth(natural);val height=children.maxOfOrNull { it.height } ?: 0
                layout(width,height) { var x=if(actions) width-natural else 0;children.forEach { it.placeRelative(x,0);x+=it.width+gap } }
            }
            if(fallback.isNotEmpty()) NativeSourceText(awcCollapsedWhitespace(fallback),style,wrap=true,wordWrapOnly=!plain,wrapAnywhere=plain)
        }
    }) { children,constraints->
        val authored=children[0].measure(constraints)
        val present=explicit || presence?.authored==true
        val fallbackChild=if(!present) children.getOrNull(1)?.measure(constraints) else null
        val active=if(present) authored else fallbackChild
        val width=if(active!=null) constraints.constrainWidth(active.width) else if(skipEmptyFallback) 0 else constraints.minWidth
        val height=active?.height ?: 0
        layout(width,height) { active?.place(0,0) }
    }
}

private fun Modifier.tooltipMargin(start:Double)=if(start==0.0) this else layout { measurable,constraints->
    val margin=(start*density).roundToInt()
    val child=measurable.measure(constraints.offset(horizontal=-margin))
    layout((child.width+margin).coerceAtLeast(0),child.height) { child.placeRelative(margin,0) }
}
private fun Modifier.tooltipShadow(shape:AWCCornerShape)=drawWithCache {
    val path=when(val outline=shape.createOutline(size,layoutDirection,this)) {
        is Outline.Generic->outline.path;is Outline.Rounded->Path().apply { addRoundRect(outline.roundRect) };is Outline.Rectangle->Path().apply { addRect(outline.rect) }
    }
    val a=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { color=android.graphics.Color.BLACK;setShadowLayer(4.dp.toPx(),0f,1.dp.toPx(),android.graphics.Color.argb(38,0,0,0)) }
    val b=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { color=android.graphics.Color.BLACK;setShadowLayer(2.dp.toPx(),0f,1.dp.toPx(),android.graphics.Color.argb(77,0,0,0)) }
    onDrawBehind { clipPath(path,ClipOp.Difference) { drawIntoCanvas { it.nativeCanvas.drawPath(path.asAndroidPath(),a);it.nativeCanvas.drawPath(path.asAndroidPath(),b) } } }
}
